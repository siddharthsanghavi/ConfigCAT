/* Simulation loop: electrical solve → inputs → PLC scan → outputs → solve,
 * once per task cycle, while Simulate is on.
 *
 * EtherCAT state gates the process data the way a master does: inputs are
 * exchanged from SAFEOP up, outputs only in OP, and nothing in INIT/PREOP.
 * A slave the master cannot reach — unpowered, or past a missing cable —
 * keeps its process data at zero whatever state the master asks for. */

import { useEffect, useMemo, useRef, useState } from "react";
import { buildStation } from "./station.js";
import { buildCircuit, solveCircuit, readCircuit } from "./electrical.js";
import { createPlc, starterProgram } from "./plc.js";

// actuators: momentary buttons follow the pointer; everything else toggles
export const actuatorKind = (d) => {
  if (!d) return null;
  if (d.kind === "btn") return d.sel ? "toggle" : "momentary";
  if (["estop", "limit", "sensor", "curtain", "scanner", "breaker", "disconnect"].includes(d.kind)) return d.analogOut ? null : "toggle";
  return null;
};

const ESM_RANK = { INIT: 0, PREOP: 1, SAFEOP: 2, OP: 3 };
const RUN_LED = { INIT: false, PREOP: "blink", SAFEOP: "flash", OP: true };

export function useSim({ enabled, doc, byId, pos, wireById, runtimeId, code }) {
  const station = useMemo(
    () => (enabled ? buildStation(doc, byId, pos, wireById, runtimeId) : null),
    [enabled, doc.rails, doc.free, doc.wires, pos, runtimeId] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const circuit = useMemo(
    () => (station ? buildCircuit(doc, byId, pos, wireById, station) : null),
    [station] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const act = useRef({});
  const forces = useRef(new Map());
  const coil = useRef({});
  const plc = useRef(null);
  // no program saved yet → the I/O-check program, regenerated as the design changes
  const starter = useMemo(() => (station ? starterProgram(station) : ""), [station]);
  const effCode = code ?? starter;
  const codeRef = useRef(effCode);
  codeRef.current = effCode;
  const [loadedCode, setLoadedCode] = useState(null);
  const [errors, setErrors] = useState([]);
  const [plcRun, setPlcRun] = useState(true);
  const [esm, setEsm] = useState("OP");
  const [view, setView] = useState(null);
  const [forceList, setForceList] = useState({});
  const runRef = useRef(plcRun), esmRef = useRef(esm);
  runRef.current = plcRun; esmRef.current = esm;

  const download = () => {
    if (!station) return;
    const p = createPlc(station, codeRef.current);
    plc.current = p.errors.length ? null : p;
    setErrors(p.errors);
    setLoadedCode(codeRef.current);
  };
  // a changed design is a new configuration: reload the program against it
  useEffect(() => { if (station) download(); }, [station]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!enabled) { plc.current = null; setView(null); act.current = {}; coil.current = {}; setEsm("OP"); setPlcRun(true); }
  }, [enabled]);

  const actuate = (uid, d, down) => {
    const k = actuatorKind(d);
    if (!k) return false;
    if (k === "momentary") act.current = { ...act.current, [uid]: down };
    else if (down) act.current = { ...act.current, [uid]: !act.current[uid] };
    return true;
  };
  const releaseAll = () => {
    const a = { ...act.current };
    let changed = false;
    for (const uid in a) if (actuatorKind(pos[uid]?.d) === "momentary" && a[uid]) { a[uid] = false; changed = true; }
    if (changed) act.current = a;
  };
  const setForce = (key, v) => {
    if (v === null || v === undefined) forces.current.delete(key); else forces.current.set(key, v);
    setForceList(Object.fromEntries(forces.current));
  };

  useEffect(() => {
    if (!station || !circuit) return undefined;
    const S = station, Cc = circuit;
    let last = performance.now(), lastPub = 0, lastSig = "";
    let cmd = new Map(); // what the PLC commanded last scan, per DO channel key
    let prevAlive = null;

    const aliveSet = (rd) => {
      const alive = new Set();
      if (!S.master) return alive;
      const unitPowered = (u) => {
        if (u[0] === "s") { const h = S.segs[+u.slice(1)].head; return !!rd.powered[h]; }
        const uid = u.slice(1);
        return Cc.powerPins[uid] ? !!rd.powered[uid] : true;
      };
      if (!unitPowered(S.master.unit)) return alive;
      const seen = new Set([S.master.unit]), q = [S.master.unit];
      while (q.length) {
        const u = q.shift();
        S.unitUids(u).forEach((x) => alive.add(x));
        for (const v of S.adj[u] || []) if (!seen.has(v) && unitPowered(v)) { seen.add(v); q.push(v); }
      }
      return alive;
    };

    const tick = () => {
      const now = performance.now();
      const dt = Math.min(200, now - last);
      last = now;
      const st = esmRef.current, rank = ESM_RANK[st];
      const p = plc.current;

      // effective outputs from the previous scan
      const eff = new Map();
      const solve = (aliveGuess) => {
        eff.clear();
        for (const c of S.chans) {
          if (c.r !== "do" && c.r !== "ao") continue;
          const f = forces.current.get(c.key);
          const want = f !== undefined ? f : runRef.current && p ? cmd.get(c.key) : false;
          eff.set(c.key, !!want && rank === 3 && aliveGuess.has(c.uid));
        }
        const sol = solveCircuit(Cc, { act: act.current, outputs: eff }, coil.current);
        coil.current = sol.coil;
        return sol;
      };
      // who is on the bus depends on supply voltages, which outputs rarely
      // change — so the previous cycle's answer drives this cycle's outputs
      if (!prevAlive) prevAlive = aliveSet(readCircuit(Cc, solveCircuit(Cc, { act: act.current, outputs: new Map() }, coil.current)));
      let sol = solve(prevAlive);
      let rd = readCircuit(Cc, sol);
      const alive = aliveSet(rd);
      prevAlive = alive;

      // inputs → PLC
      const ioVal = {};
      for (const c of S.chans) {
        if (c.r !== "di" && c.r !== "ai") continue;
        const f = forces.current.get(c.key);
        const live = alive.has(c.uid) && rank >= 2;
        const v = f !== undefined ? f : live ? (c.r === "di" ? !!rd.di[c.key] : 0) : c.r === "di" ? false : 0;
        ioVal[c.key] = v;
        if (p && c.address) p.ctrl.io.inputs.set(c.address, v);
      }
      // scan
      let fault = null;
      if (p && runRef.current) {
        if (p.ctrl.mode === "FAULT") fault = p.ctrl.fault;
        else {
          p.ctrl.scan(dt);
          if (p.ctrl.mode === "FAULT") fault = p.ctrl.fault;
        }
      }
      // PLC outputs
      cmd = new Map();
      if (p) for (const c of S.chans) {
        if ((c.r === "do" || c.r === "ao") && c.address) cmd.set(c.key, p.ctrl.io.outputs.get(c.address));
      }
      if (fault) cmd = new Map();
      sol = solve(alive);
      rd = readCircuit(Cc, sol);
      for (const c of S.chans) if (c.r === "do" || c.r === "ao") {
        const f = forces.current.get(c.key);
        ioVal[c.key] = f !== undefined ? f : cmd.get(c.key) ?? (c.r === "ao" ? 0 : false);
      }

      if (now - lastPub < 33) return;
      lastPub = now;
      const v = buildView({ S, Cc, sol, rd, alive, eff, ioVal, st, p, fault, pos, doc, wireById, act: act.current, plcRun: runRef.current });
      const sig = JSON.stringify(v);
      if (sig !== lastSig) { lastSig = sig; setView(v); }
    };
    const timer = setInterval(tick, Math.max(4, station.runtime.periodMs));
    tick();
    return () => clearInterval(timer);
  }, [station, circuit]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    station, view, errors, download, code: effCode, dirty: loadedCode !== null && loadedCode !== effCode,
    plcRun, setPlcRun, esm, setEsm, actuate, releaseAll, forces: forceList, setForce,
    clearFault: () => { plc.current?.ctrl.clearFault(); },
  };
}

function buildView({ S, Cc, sol, rd, alive, eff, ioVal, st, p, fault, pos, doc, wireById, act, plcRun }) {
  const term = {}, dev = {}, wires = {}, issues = [...S.notes];
  const runLed = RUN_LED[st];
  const name = (uid) => pos[uid]?.d?.id || uid;
  const slaveOf = Object.fromEntries(S.slaves.map((s) => [s.uid, s]));
  const label = (uid) => (slaveOf[uid] ? `${slaveOf[uid].name} (${name(uid)})` : name(uid));
  const upOk = (g) => g !== null && g !== undefined && sol.level(`pc24:${g}`) === "p24" && sol.level(`pc0:${g}`) === "gnd";

  // rail terminals
  for (const seg of S.segs) for (const uid of seg.items) {
    const d = pos[uid]?.d; if (!d) continue;
    const on = alive.has(uid);
    const up = upOk(Cc.groupOf[uid]);
    const t = { alive: on, up, run: on ? runLed : false };
    if (d.coupler || d.cx) t.us = !!rd.powered[uid];
    if (d.cx) t.plc = fault ? "FAULT" : plcRun && p ? "RUN" : "STOP";
    if (d.io) {
      t.ch = [];
      for (let c = 1; c <= d.ch; c++) {
        const k = `${uid}:${c}`;
        t.ch.push(d.io === "di" ? !!rd.di[k] : d.io === "do" ? !!eff.get(k) : on);
      }
    }
    term[uid] = t;
  }

  // free devices
  for (const f of doc.free || []) {
    const d = pos[f.uid]?.d; if (!d) continue;
    const uid = f.uid, lit = rd.lit[uid] || {}, so = sol.sensorOut[uid];
    const v = { act: !!act[uid] };
    if (so) { v.powered = so.powered; v.out = so.on; }
    if (Object.keys(lit).length) v.lit = lit;
    if (d.kind === "relay" || d.kind === "contactor") v.coil = !!sol.coil[uid];
    if (d.kind === "supplybox") { v.ok = !!sol.supplyOn[uid]; v.overload = sol.overload?.has(uid); }
    if (Cc.powerPins[uid]) v.powered = !!rd.powered[uid];
    if (d.kind === "drive" || d.kind === "epbox" || d.kind === "valvebank") v.alive = alive.has(uid);
    if (d.kind === "drive") v.run = v.alive && v.powered && st === "OP";
    if (d.kind === "epbox" || (d.kind === "valvebank" && d.netport)) {
      v.ch = {};
      S.chans.filter((c) => c.uid === uid).forEach((c) => { v.ch[c.ch] = c.r === "di" ? !!rd.di[c.key] : !!eff.get(c.key); });
    }
    if (d.kind === "fusebox") v.ok = sol.level(`${uid}:0`) === "p24";
    dev[uid] = v;
  }
  // motors follow the drive their OCT cable comes from
  for (const w of doc.wires) {
    if (wireById[w.type]?.net !== "oct") continue;
    for (const [a, b] of [[w.a.uid, w.b.uid], [w.b.uid, w.a.uid]]) {
      if (pos[a]?.d?.kind === "drive" && dev[b] && dev[a]?.run) dev[b].run = true;
    }
  }
  // rail PSUs
  for (const s of Cc.supplies) if (pos[s.uid]?.d?.psu) term[s.uid] = { ...(term[s.uid] || {}), ok: !!sol.supplyOn[s.uid], overload: sol.overload?.has(s.uid) };

  // wire levels, for the live glow
  for (const w of doc.wires) {
    const net = wireById[w.type]?.net;
    if (net) continue;
    wires[w.id] = sol.level(`${w.a.uid}:${w.a.pt}`);
  }

  // messages
  for (const sh of sol.shorts) {
    const who = sh.outs.length
      ? `${[...new Set(sh.outs.map((k) => `${label(k.split(":")[0])} output ${k.split(":")[1]}`))].join(", ")} tripped`
      : sh.sups.length ? `${sh.sups.map(name).join(", ")} in overload` : "";
    issues.push({ level: "error", msg: `Short circuit: +24 V meets 0 V${who ? ` — ${who}` : ""}.` });
  }
  sol.tripped?.forEach((k) => {
    if (!sol.shorts.some((s) => s.outs.includes(k))) issues.push({ level: "error", msg: `${label(k.split(":")[0])} output ${k.split(":")[1]} tripped on a short — switch it off to reset.` });
  });
  const noUp = {};
  sol.noUp.forEach((k) => { const [u, c] = k.split(":"); (noUp[u] ||= []).push(c); });
  for (const u in noUp) issues.push({ level: "warn", msg: `${label(u)} output ${noUp[u].join(", ")} is ON but its power contacts have no 24 V — wire + / − (Up) on the coupler or feed terminal to a supply.` });
  const dead = S.slaves.filter((s) => !alive.has(s.uid));
  if (S.master && dead.length) issues.push({ level: "error", msg: `${dead.length} of ${S.slaves.length} slaves are not responding (${dead.slice(0, 4).map((s) => s.name).join(", ")}${dead.length > 4 ? "…" : ""}) — no 24 V on their coupler, or the EtherCAT cable to them is missing.` });
  if (S.strays.length) issues.push({ level: "warn", msg: `${S.strays.map(name).join(", ")} ${S.strays.length > 1 ? "sit" : "sits"} before any coupler — not on the E-bus.` });
  const assumed = Object.entries(Cc.powerPins).filter(([, p]) => p.assumed).map(([u]) => name(u));
  if (assumed.length) issues.push({ level: "info", msg: `Supply not drawn for ${[...new Set(assumed)].join(", ")} — assumed fed from outside the drawing.` });
  if (fault) issues.push({ level: "error", msg: `PLC fault: ${fault.message}` });

  const expectWkc = S.slaves.filter((s) => s.txPdos.length || s.rxPdos.length).length;
  const wkc = S.slaves.filter((s) => (s.txPdos.length || s.rxPdos.length) && alive.has(s.uid)).length;
  return {
    esm: st, plcMode: fault ? "FAULT" : plcRun && p ? "RUN" : "STOP",
    scanMs: p?.ctrl.scanMs || 0, loadPct: p?.ctrl.loadPct || 0,
    wkc, expectWkc, term, dev, wires, io: ioVal, issues,
    // outputs that actually put 24 V on their terminal this cycle
    driven: Object.fromEntries(S.chans.filter((c) => c.r === "do").map((c) => [c.key, !!sol.doLive[c.key]])),
  };
}
