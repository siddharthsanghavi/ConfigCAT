/* EtherCAT side of the simulation: which devices the master can reach, in
 * what order, and the process image their channels pack into.
 *
 * E-bus segments follow the topology view's rules: a segment starts at a
 * coupler or embedded PC and ends at an end cover, a gap, a rail PSU or the
 * next coupler. Terminals before any coupler are strays — never on the bus.
 *
 * Reachability is a walk from the master along EtherCAT cabling: a CX masters
 * its own segment; an IPC masters whatever its Ethernet ports are cabled to.
 * With no master in the drawing, a TwinCAT runtime on the engineering PC is
 * assumed on the first coupler whose X1 is free — the usual bench setup. */

import { buildProcessImage, networkToDevice, pdoAddress, variableName } from "../plcsim/ecat/model.js";
import { masterForPart, getMaster } from "../plcsim/masters.js";

const NET_KINDS = new Set(["eth", "fo"]);

export function ebusSegments(rails, byId) {
  const segs = [];
  rails.forEach((rail, ri) => {
    let cur = null;
    const close = () => { if (cur) segs.push(cur); cur = null; };
    for (const inst of rail.items) {
      const d = byId[inst.catId]; if (!d) continue;
      if (inst.gap > 0) close();
      if (d.psu) { close(); continue; }
      if (d.coupler || d.cx) { close(); cur = { ri, head: inst.uid, headD: d, items: [] }; }
      if (!cur) cur = { ri, head: null, headD: null, items: [] };
      cur.items.push(inst.uid);
      if (d.endcap) close();
    }
    close();
  });
  return segs;
}

/* Channel number (1-based) and role behind a rail terminal's clamp point,
 * from the verified pinout where there is one. */
export function railPointRole(d, label) {
  const n = Number(label);
  if (d.dist) return { r: d.dist === "24V" ? "p24" : "gnd" };
  if (!Number.isFinite(n)) return null;
  if (d.pinout) {
    const p = d.pinout[n - 1];
    return p ? { r: p.r, ch: p.ch } : null;
  }
  if (d.io && n <= d.ch) return { r: d.io, ch: n };
  return null;
}

// I/O channels a free-standing EtherCAT slave exposes, by connection point
export function freeSlaveChannels(d, pts) {
  const out = [];
  if (d.kind === "epbox" && !d.iolMaster) {
    let n = 0;
    pts.forEach((p, i) => { if (p.role && ["di", "do", "ai", "ao"].includes(p.role)) out.push({ pt: i, r: p.role, ch: ++n }); });
  } else if (d.kind === "valvebank" && d.netport) {
    let n = 0;
    pts.forEach((p, i) => { if (p.role === "do") out.push({ pt: i, r: "do", ch: ++n }); });
  }
  return out;
}

const isSlaveKind = (d) => d.kind === "epbox" || d.kind === "drive" || (d.kind === "valvebank" && d.netport);

/**
 * Build the EtherCAT view of a design.
 * `pos` is the canvas layout map (uid → { d, geom: { pts }, free }).
 * `runtimeId` overrides the master's runtime profile (must be an EtherCAT master).
 */
export function buildStation(doc, byId, pos, wireById, runtimeId) {
  const rails = doc.rails, free = doc.free || [], wires = doc.wires;
  const segs = ebusSegments(rails, byId);
  const segOf = {};
  segs.forEach((s, si) => s.items.forEach((u) => { segOf[u] = si; }));
  const notes = [];

  // units: an E-bus segment or a free device; EtherCAT cabling links them
  const unitOf = (uid) => (segOf[uid] !== undefined ? `s${segOf[uid]}` : `f${uid}`);
  const adj = {};
  const link = (a, b) => { (adj[a] ||= []).push(b); (adj[b] ||= []).push(a); };
  const netWired = new Set(); // `${uid}:${pt}` with an EtherCAT/Ethernet cable on it
  for (const w of wires) {
    if (!NET_KINDS.has(wireById[w.type]?.net)) continue;
    netWired.add(`${w.a.uid}:${w.a.pt}`); netWired.add(`${w.b.uid}:${w.b.pt}`);
    link(unitOf(w.a.uid), unitOf(w.b.uid));
  }

  // the master: a CX on a rail, else an IPC, else a PC-side runtime
  let master = null;
  const cxSeg = segs.findIndex((s) => s.headD?.cx);
  const ipc = free.find((f) => byId[f.catId]?.kind === "ipc");
  if (cxSeg >= 0) master = { uid: segs[cxSeg].head, part: segs[cxSeg].headD.id, unit: `s${cxSeg}` };
  else if (ipc) master = { uid: ipc.uid, part: ipc.catId, unit: `f${ipc.uid}` };
  else {
    // first coupler with a free X1 — where a laptop's Ethernet cable would go
    const si = segs.findIndex((s) => {
      if (!s.headD?.coupler) return false;
      const pts = pos[s.head]?.geom.pts || [];
      const x1 = pts.findIndex((p) => p.label === "X1");
      return x1 >= 0 && !netWired.has(`${s.head}:${x1}`);
    });
    if (si >= 0) {
      master = { uid: null, part: null, unit: `s${si}`, virtual: true };
      notes.push({ level: "info", msg: `No EtherCAT master in the drawing — simulating TwinCAT 3 on the engineering PC, cabled to ${segs[si].headD.id} X1 on rail ${segs[si].ri + 1}.` });
    } else notes.push({ level: "error", msg: "No EtherCAT master: add a CX embedded PC to a rail, or an IPC (C6015…) cabled to the coupler's X1." });
  }
  const placed = master && !master.virtual ? masterForPart(master.part) : null;
  const runtime = getMaster(runtimeId) || placed || getMaster("tc-um");
  if (placed && runtime.family !== placed.family)
    notes.push({ level: "info", msg: `${master.part} runs ${placed.name.split(" · ")[1]} — simulating ${runtime.name} instead, for its scan timing and memory.` });
  if (master && !master.virtual && !placed && !getMaster(runtimeId))
    notes.push({ level: "info", msg: `${master.part} has no runtime profile of its own yet — using ${runtime.name}.` });

  // walk outward from the master in cabling order
  const order = [];
  if (master) {
    const seen = new Set([master.unit]);
    const queue = [master.unit];
    while (queue.length) {
      const u = queue.shift();
      order.push(u);
      for (const v of adj[u] || []) if (!seen.has(v)) { seen.add(v); queue.push(v); }
    }
  }

  // slaves in ring order, each with its PDOs
  const slaves = [];
  const chans = []; // { key, uid, ch, r, slave, name }
  let position = 0;
  const addSlave = (uid, d, channels) => {
    position++;
    const name = `Term${position}`;
    const tx = [], rx = [];
    for (const c of channels) {
      const analog = c.r === "ai" || c.r === "ao";
      const ename = c.r === "di" ? `In${c.ch}` : c.r === "do" ? `Out${c.ch}` : `${c.r.toUpperCase()}${c.ch}`;
      const base = c.r === "di" || c.r === "ai" ? 0x6000 : 0x7000;
      const entry = { index: base + (c.ch - 1) * 0x10, subindex: analog ? 0x11 : 1, name: ename, bitLength: analog ? 16 : 1 };
      (c.r === "di" || c.r === "ai" ? tx : rx).push(entry);
      chans.push({ key: `${uid}:${c.ch}`, uid, ch: c.ch, r: c.r, slave: position, name: `${name}_${ename}` });
    }
    slaves.push({
      position, name, part: d.id, uid,
      txPdos: tx.length ? [{ index: 0x1a00, name: "Inputs", entries: tx }] : [],
      rxPdos: rx.length ? [{ index: 0x1600, name: "Outputs", entries: rx }] : [],
    });
  };
  const reachable = new Set();
  for (const u of order) {
    if (u[0] === "s") {
      const s = segs[+u.slice(1)];
      for (const uid of s.items) {
        reachable.add(uid);
        const d = pos[uid]?.d;
        if (!d || d.cx || d.endcap || d.blank) continue;
        const channels = [];
        if (d.io) for (let c = 1; c <= d.ch; c++) channels.push({ r: d.io, ch: c });
        addSlave(uid, d, channels);
      }
    } else {
      const uid = u.slice(1);
      reachable.add(uid);
      const t = pos[uid]; if (!t) continue;
      if (isSlaveKind(t.d)) addSlave(uid, t.d, freeSlaveChannels(t.d, t.geom.pts));
    }
  }

  const network = { name: doc.name, master: runtime.name, cycleTimeUs: runtime.periodMs * 1000, slaves };
  const image = buildProcessImage(network);
  const device = { ...networkToDevice(network, image), name: runtime.name, family: runtime.family,
    overheadUs: runtime.overheadUs + slaves.length * 4, usPerElement: runtime.usPerElement,
    memPerElement: runtime.memPerElement, memPerTag: runtime.memPerTag, memBytes: runtime.memBytes,
    defaultPeriodMs: runtime.periodMs };

  // process-image address per channel
  const vars = [...image.inputs, ...image.outputs];
  for (const c of chans) {
    const ename = c.name.slice(c.name.indexOf("_") + 1);
    const v = vars.find((x) => x.slave === c.slave && x.name === ename);
    if (v) { c.address = pdoAddress(v); c.tag = variableName(v); c.analog = v.bitLength > 1; }
  }
  const strays = segs.filter((s) => !s.head).flatMap((s) => s.items);
  for (const s of segs) {
    if (s.head && !reachable.has(s.head))
      notes.push({ level: "warn", msg: `${s.headD.id} on rail ${s.ri + 1} is not cabled to the master — its terminals are not on the bus. Cable its X1 from the previous station's EK1110 / X2.` });
  }
  const unitUids = (u) => (u[0] === "s" ? segs[+u.slice(1)].items : [u.slice(1)]);
  return { segs, segOf, master, runtime, slaves, chans, image, device, network, reachable, strays, notes, adj, unitUids };
}
