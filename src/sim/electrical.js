/* Quasi-static 24 V circuit model — not SPICE.
 *
 * Every connection point is a node. Wires, a rail's power contacts, bridged
 * busbars and *closed* switch contacts merge nodes into nets (union-find).
 * Sources then put a level on a net: +24 V, 0 V, or AC line / neutral. A net
 * with both +24 V and 0 V on it is a short. A load (lamp, coil, stack-light
 * segment) is on when one side sits at +24 V and the other at 0 V.
 *
 * Relay and contactor coils switch contacts, which can change the nets, so the
 * solve repeats until the coils settle. A short on a digital output trips that
 * output (EL2xxx outputs are short-circuit protected); a short anywhere else
 * puts the feeding supply into overload.
 *
 * Power contacts follow the rail: a coupler or embedded PC feeds them from its
 * + / − points, a potential feed (EL91xx/EL9410) starts a new group, and a
 * separation terminal, an end cover, a gap or a rail PSU ends the group.
 *
 * A device whose supply terminals are all unwired is taken to be fed from
 * outside the drawing, so a station still talks EtherCAT before its field
 * wiring is done. Field power (Up) is never assumed — outputs need it wired. */

import { railPointRole, freeSlaveChannels, ioChannels } from "./station.js";

const NO_NET = new Set(["eth", "fo", "usb", "hdmi", "dp", "dvi", "oct"]);

class UF {
  constructor() { this.p = new Map(); }
  find(a) {
    let r = a;
    while (this.p.has(r) && this.p.get(r) !== r) r = this.p.get(r);
    let x = a;
    while (x !== r) { const n = this.p.get(x); this.p.set(x, r); x = n; }
    if (!this.p.has(r)) this.p.set(r, r);
    return r;
  }
  union(a, b) { const ra = this.find(a), rb = this.find(b); if (ra !== rb) this.p.set(ra, rb); }
}

// point index by label (nth occurrence)
const idx = (pts, label, nth = 0) => {
  let k = 0;
  for (let i = 0; i < pts.length; i++) if (pts[i].label === label && k++ === nth) return i;
  return -1;
};
const P = (uid, i) => `${uid}:${i}`;

/** Static part of the circuit — rebuilt only when the design changes. */
export function buildCircuit(doc, byId, pos, wireById, station) {
  const links = [];          // always-closed connections [a, b]
  const switches = [];       // { uid, a, b, closed: (st) => bool }
  const supplies = [];       // { uid, plus: [], minus: [], acL, acN, kind }
  const fixed = [];          // unconditional sources { node, v }
  const loads = [];          // { uid, key, a, b }
  const coils = [];          // { uid, a, b }
  const sensors = [];        // { uid, bn, bu, out, kind, assumed }
  const powerPins = {};      // uid → { p, n, assumed } supply terminals for "is it powered"
  const railDo = [];         // { key, uid, node, group }
  const freeDo = [];         // { key, uid, node }
  const diNode = {};         // chanKey → node
  const aiNode = {};
  const wired = new Set();
  const groupOf = {};        // rail uid → power-contact group
  const groups = [];         // { id, feeder }

  for (const w of doc.wires) {
    if (NO_NET.has(wireById[w.type]?.net)) continue;
    const a = P(w.a.uid, w.a.pt), b = P(w.b.uid, w.b.pt);
    wired.add(a); wired.add(b);
    links.push([a, b]);
  }
  const isWired = (uid, i) => i >= 0 && wired.has(P(uid, i));
  const pins = (uid, p, n) => {
    const assumed = !isWired(uid, p) && !isWired(uid, n);
    powerPins[uid] = { p: P(uid, p), n: P(uid, n), assumed };
    if (assumed) { fixed.push({ node: P(uid, p), v: "p24", ext: true }); fixed.push({ node: P(uid, n), v: "gnd", ext: true }); }
  };

  // ---- rails ----------------------------------------------------------
  doc.rails.forEach((rail) => {
    let g = null;
    const newGroup = (feeder) => { g = groups.length; groups.push({ id: g, feeder }); };
    for (const inst of rail.items) {
      const t = pos[inst.uid]; if (!t) continue;
      const d = t.d, uid = inst.uid, pts = t.geom.pts;
      if (inst.gap > 0) g = null;
      if (d.psu) {
        g = null;
        const plus = pts.map((p, i) => (p.label === "+" ? P(uid, i) : null)).filter(Boolean);
        const minus = pts.map((p, i) => (p.label === "−" ? P(uid, i) : null)).filter(Boolean);
        for (let k = 1; k < plus.length; k++) links.push([plus[0], plus[k]]);
        for (let k = 1; k < minus.length; k++) links.push([minus[0], minus[k]]);
        const L = idx(pts, "L"), N = idx(pts, "N");
        supplies.push({ uid, plus, minus, acL: L >= 0 ? P(uid, L) : null, acN: N >= 0 ? P(uid, N) : null, acWired: isWired(uid, L) });
        continue;
      }
      if (d.coupler || d.cx) newGroup(uid);
      else if (d.pcFeed) newGroup(uid);
      groupOf[uid] = d.pcBreak && !d.pcFeed ? null : g;
      const pc24 = g !== null ? `pc24:${g}` : null, pc0 = g !== null ? `pc0:${g}` : null, pcpe = g !== null ? `pcpe:${g}` : null;
      const to = (i, node) => { if (node) links.push([P(uid, i), node]); };

      pts.forEach((p, i) => {
        if (p.port) return;
        const lb = p.label;
        if (d.coupler && d.pinout) {
          // EK18xx / EK1914 / EK1960: roles from the verified pinout, by point
          const q = d.pinout[i];
          if (!q || !q.r) return;
          if (q.r === "us24") to(i, `us24:${uid}`);
          else if (q.r === "us0") to(i, `us0:${uid}`);
          else if (q.r === "up24") to(i, pc24);
          else if (q.r === "up0") to(i, pc0);
          else if (q.r === "clk") { to(i, `clk:${uid}:${i + 1}`); fixed.push({ node: `clk:${uid}:${i + 1}`, v: "p24" }); }
          else if (q.r === "usup") to(i, `ups:${uid}:${q.k}`);
          else to(i, `ch:${uid}:${i + 1}`);
        } else if (d.coupler) {
          if (lb === "24V") to(i, `us24:${uid}`);
          else if (lb === "0V") to(i, `us0:${uid}`);
          else if (lb === "+") to(i, pc24);
          else if (lb === "−") to(i, pc0);
          else to(i, pcpe);
        } else if (d.cx) {
          if (lb === "24V") { to(i, `us24:${uid}`); to(i, pc24); }
          else if (lb === "0V") { to(i, `us0:${uid}`); to(i, pc0); }
          else to(i, pcpe);
        } else if (d.feed) {
          if (!d.pcFeed || lb === "NC") return; // EL91x0 clamps 1 / 5: not used
          // EL922x electronic fuses: 24 V in on 2 / 6, output 1 drives the +
          // contact, output 2 its own clamp; the channels are taken as closed
          // (switching and tripping are not simulated), the DI clamps unused
          if (d.efuse) {
            if (lb === "O1" || lb === "O2" || lb === "+") to(i, pc24);
            else if (lb === "−") to(i, pc0);
            return;
          }
          if (lb === "B") { to(i, `br:${uid}:1`); return; } // EL9195 1 ↔ 5
          // EL9550: system supply in on 4 / 8, filtered out on 1 / 5
          if (d.sysFilter && (lb === "S+" || lb === "S−")) { to(i, lb === "S+" ? `us24:${uid}` : `us0:${uid}`); return; }
          if (d.ac || d.anyV) { to(i, lb === "L" ? `pcL:${g}` : lb === "N" ? `pcN:${g}` : pcpe); return; }
          // EL95xx: 24 V in on clamps 1 / 5; the power contacts carry U0, which
          // the 24 V solver leaves undriven. 0 V in and out share a reference
          // unless the part is isolated (EL9560).
          if (d.uOut && (lb === "24V" || lb === "0V")) {
            to(i, lb === "24V" ? `us24:${uid}` : `us0:${uid}`);
            if (lb === "0V" && !d.iso) to(i, pc0);
            return;
          }
          if (d.uOut && d.uOut !== 24 && lb === "+") { to(i, `uo:${uid}`); return; }
          // EL9410 clamps 1 / 5 supply the E-bus only, not the power contacts
          if (d.ebus > 0 && (lb === "24V" || lb === "0V")) { to(i, lb === "24V" ? `us24:${uid}` : `us0:${uid}`); return; }
          if (lb === "24V" || lb === "+") to(i, pc24);
          else if (lb === "0V" || lb === "−") to(i, pc0);
          else to(i, pcpe);
        } else {
          const role = railPointRole(d, lb);
          if (!role) return;
          // TwinSAFE: a clock output is a 24 V source of its own; the EL2911
          // safe output runs from its Up clamps (tsup) and drives the + contact
          if (role.r === "clk") { to(i, `clk:${uid}:${Number(lb)}`); fixed.push({ node: `clk:${uid}:${Number(lb)}`, v: "p24" }); }
          else if (role.r === "up24") to(i, `tsup:${uid}`);
          else if (role.r === "up0") to(i, pc0);
          else if (role.r === "link") to(i, `ch:${uid}:${role.to}`);
          else if (role.r === "p24") to(i, pc24);
          else if (role.r === "gnd") to(i, pc0);
          else if (role.r === "pe") to(i, pcpe);
          else if (role.r === "agnd") to(i, `agnd:${uid}`);
          else if (role.r === "bridge") to(i, `br:${uid}:${role.b}`);
          else if (role.n) to(i, `ch:${uid}:${role.n}`);
        }
      });
      // EK1914: no Up clamp, its power contacts carry Us
      if (d.coupler && d.pinout && !d.pinout.some((q) => q?.r === "up24") && pc24) { links.push([`us24:${uid}`, pc24]); links.push([`us0:${uid}`, pc0]); }
      if (d.tsFeed && pc24) links.push([`ch:${uid}:${d.pinout.findIndex((q) => q?.r === "do") + 1}`, pc24]);
      if (d.coupler || d.cx) {
        const pin = (r, lb) => (d.pinout ? d.pinout.findIndex((q) => q?.r === r) : pts.findIndex((x) => x.label === lb));
        const p = pin("us24", "24V"), n = pin("us0", "0V");
        const assumed = !isWired(uid, p) && !isWired(uid, n);
        powerPins[uid] = { p: `us24:${uid}`, n: `us0:${uid}`, assumed };
        if (assumed) { fixed.push({ node: `us24:${uid}`, v: "p24", ext: true }); fixed.push({ node: `us0:${uid}`, v: "gnd", ext: true }); }
      }
      for (const c of ioChannels(d)) {
        const key = `${uid}:${c.n}`, node = `ch:${uid}:${c.n}`;
        if (c.r === "di") diNode[key] = node;
        else if (c.r === "do") {
          // outputs with their own supply: EK1960 (Up1–Up6 against GND), EL2911 (Up clamps)
          const q = d.io === "mix" ? d.pinout?.[c.n - 1] : null;
          const sup = q?.sup ? [`ups:${uid}:${q.sup}`, `us0:${uid}`] : d.tsFeed ? [`tsup:${uid}`, pc0] : null;
          railDo.push({ key, uid, node, group: groupOf[uid], sup });
        }
        else if (c.r === "ai") aiNode[key] = node;
      }
      if (d.pcBreak && !d.pcFeed) g = null;
      if (d.endcap) g = null;
    }
  });

  // ---- free-standing devices -------------------------------------------
  for (const f of doc.free || []) {
    const t = pos[f.uid]; if (!t) continue;
    const d = t.d, uid = f.uid, pts = t.geom.pts;
    const at = (lb, nth) => P(uid, idx(pts, lb, nth));
    const has = (lb) => idx(pts, lb) >= 0;
    switch (d.kind) {
      case "btn": case "estop": {
        // contact rows in freeGeom order, then the lamp
        let i = 0;
        (d.contacts || []).forEach((c) => {
          const a = P(uid, i), b = P(uid, i + 1);
          switches.push({ uid, a, b, closed: c === "NO" ? (st) => !!st.act[uid] : (st) => !st.act[uid] });
          i += 2;
        });
        if (d.illum) loads.push({ uid, key: "lamp", a: P(uid, i), b: P(uid, i + 1) });
        break;
      }
      case "limit":
        switches.push({ uid, a: at("C"), b: at("NO"), closed: (st) => !!st.act[uid] });
        switches.push({ uid, a: at("C"), b: at("NC"), closed: (st) => !st.act[uid] });
        break;
      case "relay":
        coils.push({ uid, a: at("A1"), b: at("A2") });
        switches.push({ uid, a: at("11"), b: at("14"), closed: (st) => !!st.coil[uid] });
        switches.push({ uid, a: at("11"), b: at("12"), closed: (st) => !st.coil[uid] });
        break;
      case "contactor":
        coils.push({ uid, a: at("A1"), b: at("A2") });
        ["1", "2", "3"].forEach((n) => switches.push({ uid, a: at(`L${n}`), b: at(`T${n}`), closed: (st) => !!st.coil[uid] }));
        break;
      case "breaker": {
        const poles = d.poles || 1;
        for (let k = 0; k < poles; k++) switches.push({ uid, a: P(uid, 2 * k), b: P(uid, 2 * k + 1), closed: (st) => !st.act[uid] });
        break;
      }
      case "disconnect":
        ["1", "2", "3"].forEach((n) => switches.push({ uid, a: at(`L${n}`), b: at(`T${n}`), closed: (st) => !st.act[uid] }));
        break;
      case "fusebox": case "busbar":
        for (let i = 1; i < pts.length; i++) links.push([P(uid, 0), P(uid, i)]);
        break;
      case "wago": {
        const plus = [], minus = [];
        pts.forEach((p, i) => (p.label === "+" ? plus : minus).push(P(uid, i)));
        for (let k = 1; k < plus.length; k++) links.push([plus[0], plus[k]]);
        for (let k = 1; k < minus.length; k++) links.push([minus[0], minus[k]]);
        break;
      }
      case "supplybox": {
        const plus = [at("+", 0), at("+", 1)], minus = [at("−")];
        links.push([plus[0], plus[1]]);
        supplies.push({ uid, plus, minus, acL: at("L"), acN: at("N"), acWired: isWired(uid, idx(pts, "L")) });
        break;
      }
      case "source":
        if (d.st === "3ph") { ["L1", "L2", "L3"].forEach((l) => fixed.push({ node: at(l), v: "L" })); fixed.push({ node: at("N"), v: "N" }); }
        else if (d.st === "1ph") { fixed.push({ node: at("L"), v: "L" }); fixed.push({ node: at("N"), v: "N" }); }
        else { fixed.push({ node: at("+"), v: "p24" }); fixed.push({ node: at("−"), v: "gnd" }); }
        break;
      case "sensor": {
        const out = has("BK") ? at("BK") : at("S");
        const bn = at("BN"), bu = at("BU");
        sensors.push({ uid, bn, bu, out, analog: !!d.analogOut, assumed: !wired.has(bn) && !wired.has(bu), kind: "sensor" });
        break;
      }
      case "curtain":
        sensors.push({ uid, bn: at("24V"), bu: at("0V"), out: at("O1"), out2: at("O2"), assumed: !isWired(uid, idx(pts, "24V")) && !isWired(uid, idx(pts, "0V")), kind: "ossd" });
        break;
      case "scanner":
        sensors.push({ uid, bn: at("24V"), bu: at("0V"), out: at("O1"), assumed: !isWired(uid, idx(pts, "24V")) && !isWired(uid, idx(pts, "0V")), kind: "ossd" });
        break;
      case "stack": {
        const c = at("C");
        pts.forEach((p, i) => { if (i !== idx(pts, "C")) loads.push({ uid, key: p.label, a: P(uid, i), b: c }); });
        break;
      }
      case "valve":
        loads.push({ uid, key: "coil", a: at("+"), b: at("−") });
        break;
      case "valvebank": {
        const z = at("0V");
        if (d.netport) {
          freeSlaveChannels(d, pts).forEach((c) => freeDo.push({ key: `${uid}:${c.ch}`, uid, node: P(uid, c.pt), load: { a: P(uid, c.pt), b: z, key: `V${c.ch}` } }));
          pts.forEach((p, i) => { if (p.role === "do") loads.push({ uid, key: p.label, a: P(uid, i), b: z, internal: true }); });
        } else pts.forEach((p, i) => { if (p.role === "do") loads.push({ uid, key: p.label, a: P(uid, i), b: z }); });
        break;
      }
      case "epbox":
        freeSlaveChannels(d, pts).forEach((c) => {
          const key = `${uid}:${c.ch}`, node = P(uid, c.pt);
          if (c.r === "di") diNode[key] = node;
          else if (c.r === "do") freeDo.push({ key, uid, node });
          else if (c.r === "ai") aiNode[key] = node;
        });
        break;
      case "ipc": case "panel": case "drive":
        pins(uid, idx(pts, "24V"), idx(pts, "0V"));
        break;
      default: break;
    }
  }

  // a box-supplied sensor: its signal goes straight to an IP67 box channel
  // over one M8/M12 cable, which carries the supply too
  return { links, switches, supplies, fixed, loads, coils, sensors, powerPins, railDo, freeDo, diNode, aiNode, wired, groupOf, groups };
}

/**
 * Solve the circuit for one instant.
 * st = { act: {uid: bool}, outputs: Map(chanKey → commanded bool) }
 * Returns levels per node plus everything the UI needs.
 */
export function solveCircuit(cir, st, prevCoil = {}) {
  let coil = { ...prevCoil };
  let tripped = new Set(), overload = new Set();
  let res = null;

  for (let outer = 0; outer < 8; outer++) {
    for (let inner = 0; inner < 8; inner++) {
      res = solveOnce(cir, { ...st, coil }, tripped, overload);
      if (!res.newTrips.size && !res.newOverloads.size) break;
      res.newTrips.forEach((k) => tripped.add(k));
      res.newOverloads.forEach((k) => overload.add(k));
    }
    // coils settle?
    const next = {};
    for (const c of cir.coils) next[c.uid] = res.on(c.a, c.b);
    const changed = cir.coils.some((c) => !!next[c.uid] !== !!coil[c.uid]);
    coil = next;
    if (!changed) break;
  }
  return { ...res, coil, tripped, overload };
}

function solveOnce(cir, st, tripped, overload) {
  const uf = new UF();
  for (const [a, b] of cir.links) uf.union(a, b);
  for (const s of cir.switches) if (s.closed(st)) uf.union(s.a, s.b);

  const lv = new Map(); // root → { p24, gnd, L, N, src: [] }
  const add = (node, v, src) => {
    const r = uf.find(node);
    let e = lv.get(r);
    if (!e) lv.set(r, (e = { p24: false, gnd: false, L: false, N: false, src: [] }));
    e[v] = true;
    if (src) e.src.push(src);
  };
  const level = (node) => {
    const e = lv.get(uf.find(node));
    if (!e) return "float";
    if (e.p24 && e.gnd) return "short";
    if (e.p24) return "p24";
    if (e.gnd) return "gnd";
    if (e.L) return "L";
    if (e.N) return "N";
    return "float";
  };

  // 1. unconditional sources (mains, DC sources, devices assumed fed externally)
  for (const f of cir.fixed) add(f.node, f.v);
  // 2. supplies: on when they see mains, or when their mains input is not drawn
  const supplyOn = {};
  for (const s of cir.supplies) {
    const on = !overload.has(s.uid) && (!s.acWired || (s.acL && level(s.acL) === "L"));
    supplyOn[s.uid] = on;
    if (on) { s.plus.forEach((n) => add(n, "p24", { supply: s.uid })); s.minus.forEach((n) => add(n, "gnd", { supply: s.uid })); }
  }
  // 3. things powered by the supplies: sensors, safety outputs, digital outputs
  const sensorOut = {};
  for (const s of cir.sensors) {
    const powered = s.assumed || (level(s.bn) === "p24" && level(s.bu) === "gnd");
    const target = !!st.act[s.uid];
    // a photo-eye / prox switches on its target; an OSSD pair is high while the field is clear
    const on = powered && !s.analog && (s.kind === "ossd" ? !target : target);
    sensorOut[s.uid] = { powered, on };
    if (on) { add(s.out, "p24", { sensor: s.uid }); if (s.out2) add(s.out2, "p24", { sensor: s.uid }); }
  }
  const upOk = (g) => g !== null && g !== undefined && level(`pc24:${g}`) === "p24" && level(`pc0:${g}`) === "gnd";
  const doLive = {}, noUp = [];
  for (const o of cir.railDo) {
    if (!st.outputs.get(o.key)) continue;
    if (tripped.has(o.key)) continue;
    const fed = o.sup ? level(o.sup[0]) === "p24" && level(o.sup[1]) === "gnd" : upOk(o.group);
    if (!fed) { noUp.push(o.key); continue; }
    add(o.node, "p24", { out: o.key });
    doLive[o.key] = true;
  }
  for (const o of cir.freeDo) {
    if (!st.outputs.get(o.key) || tripped.has(o.key)) continue;
    add(o.node, "p24", { out: o.key });
    doLive[o.key] = true;
  }

  // shorts: trip the outputs feeding them, else overload the supply
  const newTrips = new Set(), newOverloads = new Set(), shorts = [];
  for (const [root, e] of lv) {
    if (!(e.p24 && e.gnd)) continue;
    const outs = e.src.filter((s) => s.out).map((s) => s.out);
    const sups = e.src.filter((s) => s.supply).map((s) => s.supply);
    shorts.push({ root, outs, sups });
    if (outs.length) outs.forEach((k) => newTrips.add(k));
    else sups.forEach((u) => newOverloads.add(u));
  }

  const on = (a, b) => level(a) === "p24" && level(b) === "gnd";
  return { level, on, supplyOn, sensorOut, doLive, noUp, shorts, newTrips, newOverloads, find: (n) => uf.find(n) };
}

/** Everything a tick needs from a solve, in plain data. */
export function readCircuit(cir, sol) {
  const di = {}, lit = {};
  for (const k in cir.diNode) di[k] = sol.level(cir.diNode[k]) === "p24";
  for (const l of cir.loads) {
    const v = sol.on(l.a, l.b);
    (lit[l.uid] ||= {})[l.key] = v;
  }
  const powered = {};
  for (const uid in cir.powerPins) {
    const p = cir.powerPins[uid];
    powered[uid] = sol.level(p.p) === "p24" && sol.level(p.n) === "gnd";
  }
  return { di, lit, powered };
}
