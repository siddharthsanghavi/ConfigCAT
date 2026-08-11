import { useState, useMemo, useEffect, useRef } from "react";
import { jsPDF } from "jspdf";
import { CATALOG, GROUPS } from "./catalog";
import { ETG_BRANDS } from "./catalog-etg.js";
import { validateStation, classifyPoint } from "./validate";

/* ------------------------------------------------------------------ *
 * Beckhoff EtherCAT Station Configurator
 * Faces drawn from official Beckhoff product imagery + infosys docs:
 * light-grey housings, recessed rectangular LED window, stacked-square
 * spring clamp units, colored designation tabs (24V/0V/+/−/PE), orange
 * marking labels + side latch, vertical BECKHOFF/type print, EtherCAT
 * logo, ID-switch badge above the rail for EK1101/EK1501.
 * ------------------------------------------------------------------ */

const C = {
  bg: "#EDEFF1", panel: "#FFFFFF", ink: "#1C2126", muted: "#69727C",
  line: "#D9DDE1", brand: "#D71920",
};
const M = {
  // housing (light grey, per product photos)
  hL: "#F5F6F7", h: "#E9EAEC", hR: "#D3D5D8", hEdge: "rgba(0,0,0,0.18)",
  groove: "rgba(0,0,0,0.10)", hi: "rgba(255,255,255,0.75)",
  // safety yellow
  yL: "#F6D34E", y: "#F0C33C", yR: "#D9A926",
  // LED window
  win: "#3B3E42", winFrame: "#F2F3F4", winEdge: "rgba(0,0,0,0.25)",
  ledOn: "#7DE24A", ledOff: "#565B54", ledYel: "#E8D21E",
  // clamp unit
  sq: "#17181A", sqRim: "#43464A", oval: "#101113",
  // tabs
  red: "#D0342C", blue: "#2E6DB4", kh: "#A8A23E", org: "#E8821E", orgDk: "#B85F0E",
  // misc
  txt: "#3A3D40", txtDim: "#7A7E82",
  gold: "#CDA84F", goldDk: "#9C7E33",
  rjBez: "#C9CBCD", rjPort: "#26221D", pin: "#C8A24A",
  yellow: "#F2C21E",
};
const FN = {
  di:   { c: "#F2B705", label: "Digital in" },
  do:   { c: "#E8503A", label: "Digital out" },
  ai:   { c: "#25A37A", label: "Analog in" },
  ao:   { c: "#2F80ED", label: "Analog out" },
  mot:  { c: "#8A5CF6", label: "Motion / drive" },
  pos:  { c: "#8A5CF6", label: "Position" },
  com:  { c: "#7A828C", label: "Communication" },
  sys:  { c: "#7A828C", label: "System" },
  cplr: { c: "#373C42", label: "Coupler / junction" },
  epc:  { c: "#2F3A8F", label: "Embedded PC" },
  pc:   { c: "#2F4BD8", label: "Industrial PC" },
  pnl:  { c: "#0FA3A3", label: "Panel / HMI" },
  drv:  { c: "#B02FB8", label: "Servo drive" },
  fld:  { c: "#D97706", label: "Field device" },
  distb: { c: "#B7791F", label: "Power distribution" },
  net:  { c: "#5A6B7A", label: "Network" },
  acc:  { c: "#98A2AC", label: "Accessory" },
  psu:  { c: "#4A5560", label: "Power supply" },
  saf:  { c: "#E8C400", label: "TwinSAFE" },
  // palette-group colors for the branded / mixed sections
  iobox: { c: "#0069B4", label: "IP67 I/O box" },
  sens: { c: "#25A37A", label: "Sensor" },
  hmi:  { c: "#E8503A", label: "Operator / signaling" },
  safe: { c: "#E8C400", label: "Safety device" },
  sw:   { c: "#7A828C", label: "Switching / protection" },
  pwr:  { c: "#4A5560", label: "Power / distribution" },
  pneu: { c: "#2F80ED", label: "Pneumatics" },
  drv3: { c: "#B02FB8", label: "Drive / motor" },
  mech: { c: "#8A5CF6", label: "Mechanical" },
  src:  { c: "#C4262E", label: "Power source" },
  klbus: { c: "#0090B2", label: "Beckhoff KL (K-bus)" },
  w750: { c: "#6DA544", label: "WAGO 750 I/O" },
};
// manufacturer badge: wordmark text + brand color (NOT the real logo art)
const BRANDS = {
  beckhoff:   { name: "BECKHOFF", c: "#D71920" },
  wago:       { name: "WAGO", c: "#009B3E" },
  murr:       { name: "MURR", c: "#00833E" },
  banner:     { name: "BANNER", c: "#F2C200" },
  eaton:      { name: "EATON", c: "#005DAA" },
  balluff:    { name: "BALLUFF", c: "#0069B4" },
  smc:        { name: "SMC", c: "#004B9B" },
  festo:      { name: "FESTO", c: "#0091DC" },
  igus:       { name: "igus", c: "#FF6600" },
  leuze:      { name: "LEUZE", c: "#003F87" },
  siemens:    { name: "SIEMENS", c: "#009999" },
  phoenix:    { name: "PHOENIX", c: "#0098A1" },
  sick:       { name: "SICK", c: "#005AAA" },
  turck:      { name: "TURCK", c: "#004E9E" },
  ifm:        { name: "ifm", c: "#00558C" },
  pilz:       { name: "PILZ", c: "#E2001A" },
  schneider:  { name: "SCHNEIDER", c: "#3DCD58" },
  kollmorgen: { name: "KOLLMORGEN", c: "#0033A0" },
  omron:      { name: "OMRON", c: "#0068B7" },
  adc:        { name: "AUTOMATIONDIRECT", c: "#E31837" },
  generic:    { name: "SUPPLY", c: "#C4262E" },
  weidmuller: { name: "WEIDMÜLLER", c: "#F58220" },
  // vendors from the ETG directory import: name-only wordmarks in a neutral
  // slate — their real brand colours are not known here, and guessing one
  // would put fake branding on the drawing
  ...ETG_BRANDS,
};
/* The palette is a two-level tree: company → category → parts, so a vendor's
 * folder holds everything it makes, EtherCAT directory imports and curated
 * parts alike. The category comes from the GROUPS entry a part already belongs
 * to (hand-listed or auto-filed by kind), relabelled for use as a subfolder;
 * `drv3`/`psu` fold into their siblings so a company never shows two subfolders
 * that mean the same thing. Every key here must exist in FN — the subfolder
 * dot is FN[key].c. */
const CAT_CANON = { drv3: "drv", psu: "pwr" };
const CAT_LABEL = {
  cplr: "Couplers & Junctions", epc: "Embedded PCs", pc: "Industrial PCs", pnl: "Panels & HMI",
  di: "Digital Input", do: "Digital Output", ai: "Analog Input", ao: "Analog Output",
  pos: "Position & Encoder", mot: "Motion Terminals", com: "Communication",
  saf: "TwinSAFE", sys: "System & Power Terminals",
  klbus: "KL Bus Terminals (K-bus)", w750: "WAGO 750 I/O",
  iobox: "IP67 I/O & IO-Link", drv: "Drives & Motors", sens: "Sensors",
  hmi: "Operators & Signaling", safe: "Safety Devices", pneu: "Pneumatics & Valves",
  net: "Network & Infrastructure", sw: "Switching & Protection",
  pwr: "Power & Distribution", src: "Power Sources",
};
// controllers first, then rail I/O, then field devices, then supporting kit
const CAT_ORDER = ["cplr", "epc", "pc", "pnl", "di", "do", "ai", "ao", "pos", "mot", "com", "saf",
  "sys", "klbus", "w750", "iobox", "drv", "sens", "hmi", "safe", "pneu", "net", "sw", "pwr", "src"];
// ec: EtherCAT-capable cable (gets a green glow; blinks yellow when the
// station carries Safety over EtherCAT / FSoE — i.e. safe I/O + a TwinSAFE
// Logic are both present, so the black-channel telegrams ride these cables)
const WIRES = [
  { id: "rd",   name: "Red 0.75 mm² — +24 V DC",        stroke: "#C4262E", w: 2.6 },
  { id: "bk",   name: "Black 0.75 mm² — 0 V DC",        stroke: "#23262A", w: 2.6 },
  { id: "bu",   name: "Blue 0.75 mm² — 24 V signal (DI/DO)", stroke: "#2456C4", w: 2.6 },
  { id: "og",   name: "Orange 1.5 mm² — AC control",    stroke: "#E8781E", w: 2.8 },
  { id: "bulg", name: "Lt-Blue 0.75 mm² — jumper/bridge", stroke: "#7FA8E0", w: 2.6 },
  { id: "gnye", name: "GN/YE — protective earth",       stroke: "#1E8A3C", w: 3.2, gnye: true },
  { id: "sh",   name: "Gray shielded — analog/encoder pair", stroke: "#8D939A", w: 3.2, shield: true },
  // network / connector cabling (Beckhoff ZB/ZK pre-assembled cable families)
  { id: "cat5e", name: "EtherCAT Cat.5e RJ45 (ZB9010)", stroke: "#1F9D4D", w: 3.6, net: "eth", conn: "rj45", ec: true },
  { id: "cat6a", name: "Ethernet Cat.6A RJ45 (ZB9020)", stroke: "#E3C51E", w: 3.6, net: "eth", conn: "rj45" },
  { id: "ecm12", name: "EtherCAT M12 D-coded (ZK1090-3131)", stroke: "#177A52", w: 3.6, net: "eth", conn: "m12", ec: true },
  { id: "ecm12rj", name: "EtherCAT M12↔RJ45 cord (ZK1090-3191)", stroke: "#2C8A5E", w: 3.6, net: "eth", conn: "m12", ec: true },
  { id: "ecp",  name: "EtherCAT P — power over EtherCAT, M8 (ZK700x)", stroke: "#0F7A3D", w: 4.0, net: "eth", conn: "m8", ec: true },
  { id: "fog",  name: "Glass fiber duplex — SC (ZK109x)", stroke: "#12A5C6", w: 3.2, net: "fo", conn: "sc", ec: true },
  { id: "pofd", name: "POF duplex — versatile link",    stroke: "#F07820", w: 3.2, net: "fo", conn: "vl", ec: true },
  { id: "oct",  name: "OCT motor cable — One Cable Technology (ZK4704)", stroke: "#6B4FD8", w: 4.2, net: "oct", conn: "m12" },
  { id: "m8s",  name: "M8 3-pin sensor cable (ZK2000-2xxx)", stroke: "#7A5CC4", w: 2.8, conn: "m8" },
  { id: "m12s", name: "M12 A-coded sensor/IO-Link (ZK2000-5xxx)", stroke: "#3E8E8E", w: 3.0, conn: "m12" },
  { id: "m12p", name: "M12 L-coded 24 V power (ZK2020)", stroke: "#6E3B3B", w: 3.6, conn: "m12" },
  // PC / panel connections
  { id: "usb",  name: "USB 3.0 cable",                  stroke: "#1273B8", w: 3.4, net: "usb",  conn: "plug" },
  { id: "hdmi", name: "HDMI cable",                     stroke: "#3A3F47", w: 3.8, net: "hdmi", conn: "plug" },
  { id: "dp",   name: "DisplayPort cable",              stroke: "#5A616C", w: 3.8, net: "dp",   conn: "plug" },
  { id: "cpl4", name: "CP-Link 4 — panel link over Cat.6A (CU8803)", stroke: "#C9A227", w: 3.6, net: "dp", conn: "rj45" },
  { id: "dvi",  name: "DVI-D cable",                    stroke: "#8A8F98", w: 3.8, net: "dvi",  conn: "plug" },
];
const wireById = Object.fromEntries(WIRES.map((w) => [w.id, w]));
const byId = Object.fromEntries(CATALOG.map((d) => [d.id, d]));

let SEQ = 1;
const mkInst = (catId) => ({ uid: `n${SEQ++}`, catId, idNum: byId[catId]?.idSwitch ? 1 : undefined });
const findUidCat = (rails, uid) => {
  for (const r of rails) {
    const it = r.items.find((x) => x.uid === uid);
    if (it) return it.catId;
  }
  return null;
};
// resolved part number: swap the trailing -NNNN variant suffix (or append)
const resolveId = (d, inst) => {
  const v = inst?.variant;
  if (!d) return "?";
  if (!v) return d.id;
  return /-\d{4}$/.test(d.id) ? d.id.replace(/-\d{4}$/, `-${v}`) : `${d.id}-${v}`;
};

/* ---- smart cable selection ------------------------------------------
 * Which pre-assembled cables physically fit a pair of connection points.
 * Mirrors Beckhoff's cable program: RJ45 patch (ZB9010/ZB9020), M12
 * D-coded (ZK1090-3131), M12↔RJ45 cords (ZK1090-3191), EtherCAT P
 * (ZK700x), fiber, sensor M8/M12 (ZK2000), M12 power (ZK2020).
 * ------------------------------------------------------------------- */
const NET_FEASIBLE = {
  "rj45+rj45": ["cat5e", "cat6a"],
  "m12net+m12net": ["ecm12", "ecp"],
  "m12net+rj45": ["ecm12rj"],
  "fo+fo": ["fog", "pofd"],
  "usb+usb": ["usb"],
  "dp+dp": ["dp", "cpl4"],
  "hdmi+hdmi": ["hdmi"],
  "dvi+dvi": ["dvi"],
  "dp+hdmi": ["dp", "hdmi"],
  "dp+dvi": ["dp", "dvi"],
  "dvi+hdmi": ["dvi", "hdmi"],
  "oct+oct": ["oct"],
};
// field devices that come with a pre-configured connection cable; the
// device setting `cbl` switches between "m12" (default) and "braid"
const SENSOR_KINDS = new Set(["sensor", "iol", "loop2", "curtain", "iolhub", "encf", "valve"]);
// A/B: { d, p, inst } — every wire id this pair of points can legitimately use
function feasibleWireIds(A, B) {
  const pa = A.p.port, pb = B.p.port;
  if (pa || pb) {
    if (!pa || !pb) return []; // media port to bare clamp: nothing fits
    return NET_FEASIBLE[[pa, pb].sort().join("+")] || [];
  }
  return WIRES.filter((w) => !w.net).map((w) => w.id);
}
// best-guess cable for a new connection (null = infeasible pair)
function autoWireType(A, B) {
  const feas = feasibleWireIds(A, B);
  if (!feas.length) return null;
  if (A.p.port || B.p.port) return feas[0];
  // pre-configured field-device cabling (unless switched to braided pigtail)
  const sensorish = (X) => SENSOR_KINDS.has(X.d.kind);
  const braided = (X) => X.inst?.cbl === "braid";
  if ((sensorish(A) && !braided(A)) || (sensorish(B) && !braided(B))) return "m12s";
  const ra = A.p.role || classifyPoint(A.d, A.p.label);
  const rb = B.p.role || classifyPoint(B.d, B.p.label);
  const has = (r) => ra === r || rb === r;
  if (has("pe")) return "gnye";
  if (has("ac")) return "og";
  if (has("ai") || has("ao") || has("agnd")) return "sh";
  // encoder / motion terminals default to shielded pairs
  if (A.d.fn === "mot" || A.d.fn === "pos" || B.d.fn === "mot" || B.d.fn === "pos") return "sh";
  if (has("p24")) return "rd";
  if (has("gnd")) return "bk";
  return "bu";
}

/* ---- persistence ---------------------------------------------------- */
const STORE_KEY = "beckhoff-configurator-v1";        // the working doc (autosaved)
const LIB_KEY = "beckhoff-configurator-library-v1";  // named in-browser saves
const FILE_TAG = "sids-ethercat-configurator";
const DEF_NAME = "Untitled station";
const cleanName = (s) => (typeof s === "string" ? s.trim().slice(0, 60) : "");
const slug = (s) => cleanName(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "station";

// the library is a plain { id: {id, name, savedAt, doc} } map so a corrupt
// entry can never take out the rest of the list
function loadLibrary() {
  try {
    const raw = JSON.parse(localStorage.getItem(LIB_KEY));
    if (!raw || typeof raw !== "object") return {};
    const out = {};
    for (const [id, e] of Object.entries(raw)) {
      const doc = sanitizeDoc(e?.doc);
      if (doc) out[id] = { id, name: cleanName(e.name) || DEF_NAME, savedAt: e.savedAt || "", doc };
    }
    return out;
  } catch { return {}; }
}
function saveLibrary(lib) {
  try { localStorage.setItem(LIB_KEY, JSON.stringify(lib)); return true; }
  catch { return false; } // quota / private mode
}
// counts what sanitizeDoc threw away, so an import can say so out loud
function droppedBy(raw, clean) {
  if (!raw || !clean) return null;
  const rawItems = (Array.isArray(raw.rails) ? raw.rails : []).reduce((n, r) => n + (Array.isArray(r?.items) ? r.items.length : 0), 0);
  const items = clean.rails.reduce((n, r) => n + r.items.length, 0);
  const free = (Array.isArray(raw.free) ? raw.free : []).length - clean.free.length;
  const wires = (Array.isArray(raw.wires) ? raw.wires : []).length - clean.wires.length;
  const unknown = [...new Set([
    ...(Array.isArray(raw.rails) ? raw.rails : []).flatMap((r) => (Array.isArray(r?.items) ? r.items : [])),
    ...(Array.isArray(raw.free) ? raw.free : []),
  ].filter((x) => x?.catId && !byId[x.catId]).map((x) => x.catId))];
  const n = (rawItems - items) + Math.max(0, free) + Math.max(0, wires);
  return n > 0 ? { n, unknown } : null;
}
function reseedSeq(rails, free = []) {
  let m = 0;
  const bump = (uid) => { const n = Number(String(uid).slice(1)); if (n > m) m = n; };
  rails.forEach((r) => r.items.forEach((i) => bump(i.uid)));
  free.forEach((f) => bump(f.uid));
  SEQ = m + 1;
}
// accept only known parts / resolvable wire endpoints from stored or loaded JSON
function sanitizeDoc(raw) {
  if (!raw || !Array.isArray(raw.rails)) return null;
  const rails = raw.rails.map((r, i) => ({
    id: r?.id || `r${i + 1}`,
    items: (Array.isArray(r?.items) ? r.items : []).filter((it) => it && it.uid && byId[it.catId]),
  }));
  const free = (Array.isArray(raw.free) ? raw.free : []).filter(
    (f) => f && f.uid && byId[f.catId]?.free && Number.isFinite(f.x) && Number.isFinite(f.y)
  );
  const uids = new Set();
  rails.forEach((r) => r.items.forEach((it) => uids.add(it.uid)));
  free.forEach((f) => uids.add(f.uid));
  const wires = (Array.isArray(raw.wires) ? raw.wires : []).filter(
    (w) => w && w.id && w.a && w.b && wireById[w.type] && uids.has(w.a.uid) && uids.has(w.b.uid)
  );
  return { name: cleanName(raw.name) || DEF_NAME, rails, wires, free };
}
const demoDoc = () => ({
  name: "Demo station",
  rails: [{ id: "r1", items: ["EK1100", "EL1008", "EL2008", "EL3004", "EL4004", "EL9410", "EL1904", "EK1110", "EL9011"].map(mkInst) }],
  wires: [],
  free: [],
});
function loadInitial() {
  try {
    const doc = sanitizeDoc(JSON.parse(localStorage.getItem(STORE_KEY)));
    if (doc && doc.rails.length) { reseedSeq(doc.rails, doc.free); return doc; }
  } catch { /* fall through to demo */ }
  return demoDoc();
}
function download(name, content, type) {
  const url = URL.createObjectURL(content instanceof Blob ? content : new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}
const PX_PER_MM = 4.4;
const TH = 292;
const RAIL_PAD_X = 26;
const RAIL_GAP = 130;
const RAIL_TOP = 44; // room for ID badges

const FEED_GROUPS = [
  { labels: ["24V", "0V"], colors: ["red", "blue"] },
  { labels: ["+", "+"],    colors: ["red", "red"] },
  { labels: ["−", "−"],    colors: ["blue", "blue"] },
  { labels: ["⏚", "⏚"],   colors: ["kh", "kh"] },
];
// 120…230 V AC feed terminals (EL9150) — approximate point layout
const AC_FEED_GROUPS = [
  { labels: ["L", "N"], colors: ["gy", "gy"] },
  { labels: ["L", "N"], colors: ["gy", "gy"] },
  { labels: ["⏚", "⏚"], colors: ["kh", "kh"] },
  { labels: ["⏚", "⏚"], colors: ["kh", "kh"] },
];
const feedGroupsFor = (d) => (d.ac ? AC_FEED_GROUPS : FEED_GROUPS);

// ---- clamp point geometry (must mirror rendering) ------------------
// number of network ports a RjTermFace device shows
function portCount(d) {
  if (d.ports) return d.ports;
  if (typeof d.rj === "number" && d.rj > 1) return d.rj;
  return d.junction && !d.fiber ? 2 : 1;
}
function pointGeom(d) {
  const W = Math.round(d.w * PX_PER_MM);
  const pts = [];
  if (d.endcap || d.blank || (d.fn === "saf" && !d.io && !d.feed)) return { W, pts };
  if (d.ext || d.junction || d.rj) {
    // network ports only — appended as wireable points (match RjTermFace)
    if (d.fiber) {
      pts.push({ x: W / 2, y: 100, label: "X1", port: "fo", size: 10 });
    } else {
      const n = portCount(d);
      const pitch = n > 2 ? 50 : 66;
      for (let i = 0; i < n; i++) {
        const lb = d.ext ? "OUT" : n > 1 ? `X${i + 1}` : "X1";
        pts.push({ x: W / 2, y: 78 + i * pitch + 13.5, label: lb, port: "rj45", size: 10 });
      }
    }
    return { W, pts };
  }
  if (d.coupler) {
    const bx = W - 76;
    const cols = [bx + 22, bx + 54];
    const gTop = 64, gh = (TH - 24 - gTop) / 4;
    FEED_GROUPS.forEach((g, gi) => g.labels.forEach((lb, ci) =>
      pts.push({ x: cols[ci], y: gTop + gi * gh + 32, label: lb, size: 7.5, col: ci })));
    // network ports appended AFTER feed points so saved wire indexes stay valid
    const housingCx = bx * 0.42;
    if (d.fiber) {
      pts.push({ x: housingCx, y: 56, label: "X1", port: "fo", size: 10 });
      pts.push({ x: housingCx, y: 128, label: "X2", port: "fo", size: 10 });
    } else {
      pts.push({ x: housingCx, y: 35.5, label: "X1", port: "rj45", size: 10 });
      pts.push({ x: housingCx, y: 91.5, label: "X2", port: "rj45", size: 10 });
    }
    return { W, pts, block: { bx, cols, gTop, gh } };
  }
  if (d.cx) {
    const labels = ["24V", "0V", "⏚", "⏚"];
    labels.forEach((lb, i) => pts.push({ x: W - 26, y: 46 + i * 36, label: lb, size: 7.5, col: 1 }));
    pts.push({ x: 32, y: 113.5, label: "X001", port: "rj45", size: 10 });
    return { W, pts };
  }
  if (d.psu) {
    ["L", "N", "\u23DA"].forEach((lb, i) => pts.push({ x: W * 0.25 + i * W * 0.25, y: 78, label: lb, size: 7.5, col: i > 0 ? 1 : 0 }));
    const oc = [W * 0.32, W * 0.68];
    [["+", "+"], ["\u2212", "\u2212"]].forEach((pair, r) => pair.forEach((lb, ci) =>
      pts.push({ x: oc[ci], y: 196 + r * 42, label: lb, size: 8.5, col: ci })));
    return { W, pts };
  }
  if (d.feed) {
    const cols = [W * 0.30, W * 0.70];
    const gTop = 64, gh = (TH - 24 - gTop) / 4;
    feedGroupsFor(d).forEach((g, gi) => g.labels.forEach((lb, ci) =>
      pts.push({ x: cols[ci], y: gTop + gi * gh + 32, label: lb, size: 7.5, col: ci })));
    return { W, pts, block: { cols, gTop, gh } };
  }
  // io / dist / motion / position / plain comm
  const hd = !!d.hd;
  const cols = [W * 0.30, W * 0.70];
  if (hd) {
    const rows = 8, top = 78, bot = TH - 22, pitch = (bot - top) / rows;
    for (let p = 0; p < 16; p++) {
      const col = p < rows ? 0 : 1, row = p % rows;
      pts.push({ x: cols[col], y: top + pitch * (row + 0.5), label: String(p + 1), size: 5.6, col });
    }
    return { W, pts, block: { cols, top, bot, rows, hd } };
  }
  // 8-point terminals share the coupler block's group spacing
  const gTop = 64, gh = (TH - 24 - gTop) / 4;
  for (let p = 0; p < 8; p++) {
    const col = p < 4 ? 0 : 1, row = p % 4;
    const lb = d.dist ? d.dist : String(p + 1);
    pts.push({ x: cols[col], y: gTop + row * gh + 32, label: lb, size: 7.5, col });
  }
  return { W, pts, block: { cols, gTop, gh } };
}

/* ---- free-placed component geometry --------------------------------- */
// Every pt: { x, y, label, size, tip, role?, port? }. role feeds wire
// validation (p24/gnd/pe/ac); port marks media ports (rj45/fo/usb/dp/hdmi/dvi).
function freeGeom(d) {
  const W = d.fw, H = d.fh;
  const pts = [];
  const clamp = (x, y, label, role, tip) => pts.push({ x, y, label, size: 5.5, role, tip });
  const port = (x, y, label, kind, tip) => pts.push({ x, y, label, port: kind, size: 9, tip });
  switch (d.kind) {
    case "ipc": {
      // connector panel along the bottom edge (like the real front face)
      const list = [];
      for (let i = 0; i < (d.ethM12 || 0); i++) list.push([`X${i + 1}`, "m12net", `X${i + 1} — EtherCAT/Ethernet, M12 D-coded socket`]);
      for (let i = 0; i < (d.eth || 0); i++) list.push([`ETH${i + 1}`, "rj45", `ETH${i + 1} — Gigabit Ethernet / EtherCAT (RJ45)`]);
      for (let i = 0; i < (d.usb || 0); i++) list.push([`USB${i + 1}`, "usb", `USB${i + 1} — USB 3.0 type A`]);
      (d.video || []).forEach((v, i) => list.push([`${v}${i + 1}`, v.toLowerCase(), `${v} — monitor output`]));
      const perRow = Math.max(2, Math.floor((W - 28) / 30));
      const rows = Math.ceil(list.length / perRow);
      list.forEach((p, i) => {
        const r = Math.floor(i / perRow), c = i % perRow;
        port(26 + c * 30, H - 18 - (rows - 1 - r) * 26, p[0], p[1], p[2]);
      });
      // 3-pin power connector, top right
      clamp(W - 54, 18, "24V", "p24", "+24 V DC supply in");
      clamp(W - 36, 18, "0V", "gnd", "0 V supply return");
      clamp(W - 18, 18, "⏚", "pe", "PE — functional earth");
      break;
    }
    case "panel": {
      let px = 24;
      (d.video || []).forEach((v) => { port(px, H - 15, v, v.toLowerCase(), `${v} in — from PC video output`); px += 32; });
      for (let i = 0; i < (d.usb || 0); i++) { port(px, H - 15, `USB`, "usb", "USB — touch/peripheral link to PC"); px += 32; }
      for (let i = 0; i < (d.eth || 0); i++) { port(px, H - 15, `ETH${i + 1}`, "rj45", `ETH${i + 1} — Ethernet (built-in PC)`); px += 32; }
      clamp(W - 44, H - 15, "24V", "p24", "+24 V DC supply in");
      clamp(W - 22, H - 15, "0V", "gnd", "0 V supply return");
      break;
    }
    case "drive": {
      port(W / 2, 24, "X1", "rj45", "X1 IN — EtherCAT from master (RJ45)");
      port(W / 2, 52, "X2", "rj45", "X2 OUT — EtherCAT to next device (RJ45)");
      clamp(W * 0.3, 96, "DC+", null, "DC link + (shared across drive group)");
      clamp(W * 0.7, 96, "DC−", null, "DC link − (shared across drive group)");
      clamp(W * 0.3, 124, "24V", "p24", "+24 V control supply");
      clamp(W * 0.7, 124, "0V", "gnd", "0 V control return");
      port(W / 2, 156, "OCT", "oct", "OCT — motor power + feedback in one cable (to AM8xxx)");
      const mx = W / (4 + 1);
      ["U", "V", "W"].forEach((ph, i) => clamp(mx * (i + 1), H - 16, ph, "ac", `${ph} — motor phase (classic wiring)`));
      clamp(mx * 4, H - 16, "⏚", "pe", "PE — motor earth");
      break;
    }
    case "motor": {
      port(16, H / 2 - 10, "OCT", "oct", "OCT — power + feedback from the drive, one cable");
      const mx = (W - 30) / 4;
      ["U", "V", "W"].forEach((ph, i) => clamp(30 + mx * (i + 0.5), H - 12, ph, "ac", `${ph} — motor phase (classic wiring)`));
      clamp(30 + mx * 3.5, H - 12, "⏚", "pe", "PE — motor earth");
      break;
    }
    case "switch8": {
      const n = d.nports || 8;
      for (let i = 0; i < n; i++) {
        port(24 + (i % 4) * 36, i < 4 ? 32 : 66, `P${i + 1}`, "rj45", `Port ${i + 1} — Gigabit Ethernet (RJ45)`);
      }
      break;
    }
    case "conv": {
      port(26, H / 2 - 4, "X1", "rj45", "X1 — copper EtherCAT (RJ45)");
      port(W - 26, H / 2 - 4, "X2", "fo", "X2 — multi-mode fiber optic (SC)");
      break;
    }
    case "encf": {
      clamp(W / 2 - 28, H - 10, "+V", "p24", "+V — supply (5/24 V)");
      clamp(W / 2 - 14, H - 10, "0V", "gnd", "0 V — supply return");
      clamp(W / 2, H - 10, "A", null, "Channel A → encoder terminal (EL5101/EL5151)");
      clamp(W / 2 + 14, H - 10, "B", null, "Channel B → encoder terminal");
      clamp(W / 2 + 28, H - 10, "Z", null, "Zero pulse → encoder terminal");
      break;
    }
    case "valve": {
      clamp(W / 2 - 8, H - 10, "+", null, "Coil + — from a digital output");
      clamp(W / 2 + 8, H - 10, "−", "gnd", "Coil − — to 0 V");
      break;
    }
    case "stack": {
      // terminals live in the junction box at the base of the tower
      const items = [...(d.lights || [])];
      if (d.buzzer) items.push("BZ");
      const all = [["C", "gnd", "Common — to 0 V"],
        ...items.map((lb) => [lb, null, lb === "BZ" ? "Buzzer input — switch +24 V (from DO)" : `${lb} segment input — switch +24 V (from DO)`])];
      all.forEach(([lb, role, tip], i) => {
        const c = i % 4, r = Math.floor(i / 4);
        clamp(11 + c * 14, H - 22 + r * 14, lb, role, tip);
      });
      break;
    }
    case "btn": case "estop": {
      const rows = [];
      (d.contacts || []).forEach((c, i) => rows.push(c === "NO" ? [`${i + 1}3`, `${i + 1}4`, "NO contact"] : [`${i + 1}1`, `${i + 1}2`, "NC contact"]));
      if (d.illum) rows.push(["X1", "X2", "LED 24 V"]);
      rows.forEach(([a, b, what], i) => {
        const y = H - 14 - (rows.length - 1 - i) * 20;
        clamp(W * 0.3, y, a, null, `${a} — ${what}`);
        clamp(W * 0.7, y, b, what.includes("LED") ? "gnd" : null, `${b} — ${what}${what.includes("LED") ? " (to 0 V)" : ""}`);
      });
      break;
    }
    case "relay": {
      // scale the 5 pin positions to the actual width so narrow relay modules
      // keep their points inside the body (standard 62 px ≈ the old 9…55)
      const xs = [0.14, 0.34, 0.53, 0.72, 0.89].map((f) => f * W);
      clamp(xs[0], H - 10, "A1", null, "A1 — coil + (from DO / +24 V)");
      clamp(xs[1], H - 10, "A2", "gnd", "A2 — coil − (to 0 V)");
      clamp(xs[2], H - 10, "11", null, "11 — contact common");
      clamp(xs[3], H - 10, "12", null, "12 — NC contact");
      clamp(xs[4], H - 10, "14", null, "14 — NO contact");
      break;
    }
    case "contactor": {
      // scale to width so compact contactors/starters keep their points on the
      // body (standard 84 px reproduces the old 12 / 30·50·70 layout)
      clamp(W * 0.14, 34, "A1", null, "A1 — coil + (24 V DC)");
      clamp(W * 0.14, H - 40, "A2", "gnd", "A2 — coil − (0 V)");
      ["L1", "L2", "L3"].forEach((lb, i) => clamp(W * (0.36 + i * 0.235), 12, lb, "ac", `${lb} — mains in`));
      ["T1", "T2", "T3"].forEach((lb, i) => clamp(W * (0.36 + i * 0.235), H - 12, lb, "ac", `${lb} — to motor`));
      break;
    }
    case "sensor": {
      clamp(W / 2 - 14, H - 8, "BN", "p24", "BN (brown) — +24 V");
      clamp(W / 2, H - 8, d.analogOut ? "S" : "BK", null, d.analogOut ? "4-20 mA out — to AI terminal" : "BK (black) — switching output PNP → DI");
      clamp(W / 2 + 14, H - 8, "BU", "gnd", "BU (blue) — 0 V");
      break;
    }
    case "loop2": {
      clamp(W / 2 - 8, H - 8, "+", null, "loop + — from +24 V");
      clamp(W / 2 + 8, H - 8, "−", null, "loop − — 4-20 mA to AI terminal");
      break;
    }
    case "limit": {
      clamp(W * 0.25, H - 12, "C", null, "COM — common");
      clamp(W * 0.5, H - 12, "NO", null, "NO contact");
      clamp(W * 0.75, H - 12, "NC", null, "NC contact");
      break;
    }
    case "curtain": {
      // M12 pigtail terminals at the base of the receiver bar
      clamp(W / 2 - 21, H - 8, "24V", "p24", "+24 V supply");
      clamp(W / 2 - 7, H - 8, "0V", "gnd", "0 V return");
      clamp(W / 2 + 7, H - 8, "O1", null, "OSSD1 — safety output → safe input (EL1904)");
      clamp(W / 2 + 21, H - 8, "O2", null, "OSSD2 — safety output → safe input (EL1904)");
      break;
    }
    case "iol": {
      clamp(W / 2 - 14, H - 8, "L+", "p24", "L+ — +24 V (pin 1)");
      clamp(W / 2, H - 8, "C/Q", null, "C/Q — IO-Link data (pin 4) → IO-Link master port (EL6224)");
      clamp(W / 2 + 14, H - 8, "L−", "gnd", "L− — 0 V (pin 3)");
      break;
    }
    case "iolhub": {
      clamp(16, H - 26, "L+", "p24", "L+ — +24 V");
      clamp(38, H - 26, "L−", "gnd", "L− — 0 V");
      clamp(62, H - 26, "C/Q", null, "C/Q — IO-Link to master port (EL6224)");
      for (let i = 0; i < 8; i++) clamp(14 + i * 14, H - 9, String(i + 1), null, `Channel ${i + 1} — DI/DO to field device`);
      break;
    }
    case "busbar": {
      const role = d.pol === "24V" ? "p24" : d.pol === "0V" ? "gnd" : "pe";
      clamp(14, H / 2, "IN", role, `Feed — from PSU ${d.pol}`);
      for (let i = 0; i < (d.ch || 8); i++) clamp(40 + i * 21, H / 2, String(i + 1), role, `Tap ${i + 1} — ${d.pol}`);
      break;
    }
    case "wago": {
      for (let i = 0; i < 8; i++) clamp(16 + i * 17, 16, "+", "p24", "+24 V push-in (bridged row)");
      for (let i = 0; i < 8; i++) clamp(16 + i * 17, H - 12, "−", "gnd", "0 V push-in (bridged row)");
      break;
    }
    case "epbox": {
      // IP67 field box: 2 network M12 at top, IO M8/M12 sockets down the body
      port(W * 0.32, 22, "X1", "m12net", `X1 IN — ${d.etherP ? "EtherCAT P" : "EtherCAT"} (M12 D-coded)`);
      port(W * 0.68, 22, "X2", "m12net", `X2 OUT — ${d.etherP ? "EtherCAT P" : "EtherCAT"} to next box (M12)`);
      const n = d.ioconn || 8, cols = 2, rows = Math.ceil(n / cols);
      const top = 46, bot = H - 26, pitch = (bot - top) / Math.max(1, rows - 1 || 1);
      for (let i = 0; i < n; i++) {
        const c = i % cols, r = Math.floor(i / cols);
        const x = W * (c ? 0.72 : 0.28), y = rows > 1 ? top + r * pitch : (top + bot) / 2;
        if (d.iolMaster) clamp(x, y, `${i + 1} C/Q`, null, `Port ${i + 1} — IO-Link C/Q (M12)`);
        else {
          const role = d.io === "di" ? "di" : d.io === "do" ? "do" : d.io === "ai" ? "ai" : d.io === "ao" ? "ao" : (i % 2 ? "do" : "di");
          clamp(x, y, `${d.ioLabel || "IO"}${i + 1}`, role, `${d.ioLabel || "I/O"} channel ${i + 1} (M${d.m12io ? 12 : 8})`);
        }
      }
      clamp(W * 0.5, H - 10, "⏚", "pe", "PE / shield");
      break;
    }
    case "supplybox": {
      clamp(W * 0.28, 14, "L", "ac", "L — AC line in");
      clamp(W * 0.5, 14, "N", "ac", "N — AC neutral in");
      clamp(W * 0.72, 14, "⏚", "pe", "PE — earth");
      clamp(W * 0.3, H - 10, "+", "p24", "+24 V DC output");
      clamp(W * 0.5, H - 10, "+", "p24", "+24 V DC output");
      clamp(W * 0.7, H - 10, "−", "gnd", "0 V DC output");
      break;
    }
    case "fusebox": {
      clamp(14, 14, "IN", "p24", "+24 V feed in");
      const n = d.ch || 4;
      for (let i = 0; i < n; i++) clamp(20 + i * ((W - 34) / Math.max(1, n - 1)), H - 10, String(i + 1), "p24", `Protected output ${i + 1}`);
      break;
    }
    case "breaker": {
      const p = d.poles || 1;
      for (let i = 0; i < p; i++) {
        const x = W * (0.5 + (i - (p - 1) / 2) * 0.28);
        clamp(x, 12, i === 0 && p > 1 ? "L1" : p === 1 ? "L" : `L${i + 1}`, "ac", "Line in");
        clamp(x, H - 12, p === 1 ? "T" : `T${i + 1}`, "ac", "Load out");
      }
      break;
    }
    case "disconnect": {
      ["L1", "L2", "L3"].forEach((l, i) => clamp(20 + i * ((W - 30) / 2), 12, l, "ac", `${l} — supply in`));
      ["T1", "T2", "T3"].forEach((l, i) => clamp(20 + i * ((W - 30) / 2), H - 12, l, "ac", `${l} — load out`));
      break;
    }
    case "valvebank": {
      if (d.netport) port(W - 16, 20, "X1", "m12net", "X1 — EtherCAT/fieldbus node (M12)");
      const n = d.ch || 5;
      for (let i = 0; i < n; i++) clamp(16 + i * ((W - 30) / Math.max(1, n - 1)), H - 10, `V${i + 1}`, "do", `Valve ${i + 1} solenoid — drive from DO / node`);
      clamp(W - 14, H - 10, "0V", "gnd", "0 V common");
      break;
    }
    case "scanner": {
      port(W / 2 - 16, H - 12, "NET", "m12net", "M12 — EtherCAT/config (D-coded)");
      clamp(W / 2 + 2, H - 12, "24V", "p24", "+24 V supply");
      clamp(W / 2 + 16, H - 12, "0V", "gnd", "0 V return");
      clamp(W / 2 + 30, H - 12, "O1", null, "OSSD1 — safety output → safe input");
      break;
    }
    case "linaxis": {
      port(16, H / 2, "OCT", "oct", "Motor cable to the drive (OCT/classic)");
      break;
    }
    case "box": {
      const n = d.ioconn || 4;
      for (let i = 0; i < n; i++) clamp(14 + i * ((W - 24) / Math.max(1, n - 1)), H - 10, String(i + 1), null, `Terminal ${i + 1}`);
      if (d.safety) { clamp(14, 14, "A1", "p24", "A1 — +24 V"); clamp(W - 14, 14, "A2", "gnd", "A2 — 0 V"); }
      break;
    }
    case "source": {
      // incoming supply feed — terminals along the bottom, wireable to
      // contactors / motors / PSUs / DC loads
      const y = H - 11;
      if (d.st === "3ph") {
        ["L1", "L2", "L3", "N"].forEach((lb, i) => clamp(W * (0.14 + i * 0.2), y, lb, "ac", `${lb} — 3-phase ${d.volt || ""}`));
        clamp(W * 0.94, y, "PE", "pe", "PE — protective earth");
      } else if (d.st === "1ph") {
        clamp(W * 0.3, y, "L", "ac", `L — line ${d.volt || ""}`);
        clamp(W * 0.5, y, "N", "ac", "N — neutral");
        clamp(W * 0.7, y, "PE", "pe", "PE — protective earth");
      } else {
        clamp(W * 0.3, y, "+", "p24", `+ DC ${d.volt || ""}`);
        clamp(W * 0.5, y, "−", "gnd", "− DC / 0 V");
        clamp(W * 0.7, y, "PE", "pe", "PE — protective earth");
      }
      break;
    }
    case "fan": case "cyl": case "echain": case "spool":
      break; // mechanical / accessory — no electrical points
    default: break; // accessories — no points
  }
  return { W, H, pts };
}

// what a connection point does — shown on hover
function pointRole(d, p) {
  const lb = p.label;
  if (p.tip) return p.tip;
  if (p.port) {
    if (p.port === "fo") return `${lb} — fiber optic port`;
    if (lb === "OUT") return "OUT — E-bus extension to next station (RJ45)";
    if (lb === "X1" && d.coupler) return "X1 IN — EtherCAT from master (RJ45)";
    if (lb === "X2" && d.coupler) return "X2 OUT — EtherCAT to next station (RJ45)";
    return `${lb} — Ethernet/EtherCAT port (RJ45)`;
  }
  if (d.psu) {
    if (lb === "L") return "L \u2014 AC line input";
    if (lb === "N") return "N \u2014 AC neutral input";
    if (lb === "\u23DA") return "PE \u2014 protective earth";
    if (lb === "+") return "+24 V DC output (supply source)";
    return "0 V DC output (supply return)";
  }
  if (d.feed && d.ac) {
    if (lb === "L") return "L \u2014 120\u2026230 V AC feed to power contacts";
    if (lb === "N") return "N \u2014 AC neutral to power contacts";
    return "PE \u2014 earth power contact";
  }
  if (d.coupler || d.feed) {
    if (lb === "24V") return "Us +24 V in \u2014 powers coupler & E-bus";
    if (lb === "0V") return "Us 0 V in \u2014 supply return";
    if (lb === "+") return "Up +24 V in \u2014 feeds power contacts (source)";
    if (lb === "\u2212") return "Up 0 V \u2014 power contact return";
    return "PE \u2014 earth power contact";
  }
  if (d.dist) return d.dist === "24V" ? "+24 V source (from power contacts)" : "0 V common (from power contacts)";
  const n = Number(lb);
  if (d.pinout) {
    const pi = d.pinout[n - 1];
    if (pi) {
      if (pi.r === "di") return `Pt ${n} \u2014 digital input ${pi.ch} (signal sink)`;
      if (pi.r === "do") return `Pt ${n} \u2014 digital output ${pi.ch} (sources +24 V)`;
      if (pi.r === "p24") return `Pt ${n} \u2014 +24 V sensor supply (source)`;
      if (pi.r === "gnd") return `Pt ${n} \u2014 0 V (\u2192 negative power contact)`;
      if (pi.r === "ai") return `Pt ${n} \u2014 analog input ${pi.ch} (signal)`;
      if (pi.r === "ao") return `Pt ${n} \u2014 analog output ${pi.ch} (signal)`;
      if (pi.r === "agnd") return `Pt ${n} \u2014 analog GND (signal return)`;
      if (pi.r === "pe") return `Pt ${n} \u2014 PE`;
    }
  }
  const aux = n % 2 ? "+24 V supply (source)" : "0 V return (sink)";
  if (d.io === "di") return n <= d.ch ? `Pt ${n} \u2014 digital input ${n} (signal sink)` : `Pt ${n} \u2014 ${aux}`;
  if (d.io === "do") return n <= d.ch ? `Pt ${n} \u2014 digital output ${n} (sources +24 V)` : `Pt ${n} \u2014 ${aux}`;
  if (d.io === "ai") return n <= d.ch ? `Pt ${n} \u2014 analog input ${n}+` : `Pt ${n} \u2014 analog GND / shield`;
  if (d.io === "ao") return n <= d.ch ? `Pt ${n} \u2014 analog output ${n}` : `Pt ${n} \u2014 analog GND 0 V`;
  if (d.fn === "mot" || d.fn === "pos") return `Pt ${n} \u2014 motor / encoder connection`;
  return `Pt ${lb}`;
}

// ==================================================================
export default function BeckhoffConfigurator() {
  const [doc, setDoc] = useState(loadInitial);
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const { rails, wires } = doc;
  const free = doc.free || [];
  const [activeRail, setActiveRail] = useState(0);
  const [newGroup, setNewGroup] = useState(false); // one-shot: next add starts a separated group
  const [selected, setSelected] = useState(null);
  const [selWire, setSelWire] = useState(null);
  const [wireMode, setWireMode] = useState(false);
  const [pending, setPending] = useState(null);
  const [wireCursor, setWireCursor] = useState(null);
  const [flash, setFlash] = useState(null);
  const flashRef = useRef(null);
  const showFlash = (msg) => {
    setFlash(msg);
    clearTimeout(flashRef.current);
    flashRef.current = setTimeout(() => setFlash(null), 2600);
  };
  const [hover, setHover] = useState(null);
  const [showWires, setShowWires] = useState(true);
  const [copied, setCopied] = useState(false);
  const [q, setQ] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [srcFilter, setSrcFilter] = useState("all"); // all | curated | etg
  const [detail, setDetail] = useState(null);
  const [diagOpen, setDiagOpen] = useState(false);
  const [topoOpen, setTopoOpen] = useState(false);
  // palette folders: keyed by company, and by `company/category` for subfolders
  const [openGroups, setOpenGroups] = useState({ beckhoff: true, "beckhoff/cplr": true });
  const svgRef = useRef(null);
  const fileRef = useRef(null);

  // every undoable mutation goes through update()
  const update = (fn) => {
    const nd = fn(doc);
    if (nd === doc) return;
    setPast((p) => [...p.slice(-59), doc]);
    setFuture([]);
    setDoc(nd);
  };
  const setRailsW = (fn) => update((d) => ({ ...d, rails: fn(d.rails) }));
  const setWiresW = (fn) => update((d) => ({ ...d, wires: fn(d.wires) }));
  const undo = () => {
    if (!past.length) return;
    setFuture((f) => [doc, ...f.slice(0, 59)]);
    setDoc(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
    setSelected(null); setSelWire(null); setPending(null);
  };
  const redo = () => {
    if (!future.length) return;
    setPast((p) => [...p.slice(-59), doc]);
    setDoc(future[0]);
    setFuture((f) => f.slice(1));
    setSelected(null); setSelWire(null); setPending(null);
  };

  // autosave the project to localStorage
  useEffect(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(doc)); } catch { /* storage full/blocked */ }
  }, [doc]);

  const addRail = () => setRailsW((r) => [...r, { id: `r${Date.now()}`, items: [] }]);
  const removeRail = (ri) => {
    const uids = new Set(rails[ri].items.map((i) => i.uid));
    update((d) => ({
      rails: d.rails.filter((_, i) => i !== ri),
      wires: d.wires.filter((x) => !uids.has(x.a.uid) && !uids.has(x.b.uid)),
    }));
    setActiveRail(0); setSelected(null); setPending(null);
  };
  const NEW_GROUP_GAP = 16; // mm of clear rail between separate groups
  const add = (catId) => {
    const d = byId[catId];
    if (d?.free) { addFree(catId); return; }
    const inst = mkInst(catId);
    const startsGroup = d.coupler || d.cx;
    setRailsW((r) => r.map((rail, i) => {
      if (i !== activeRail) return rail;
      const items = rail.items;
      const last = items[items.length - 1];
      const lastIsCap = last && byId[last.catId]?.endcap;
      // Explicit "new group", or a coupler placed after a finished station:
      // append as a separated group with a visible gap on this first item.
      if ((newGroup && items.length) || (startsGroup && lastIsCap)) {
        return { ...rail, items: [...items, { ...inst, gap: NEW_GROUP_GAP }] };
      }
      // Never let a device dangle past the end cover: slot it in before the
      // trailing cover so it joins the station instead.
      if (lastIsCap && !d.endcap) {
        return { ...rail, items: [...items.slice(0, -1), inst, last] };
      }
      return { ...rail, items: [...items, inst] };
    }));
    setNewGroup(false);
    setSelected(inst.uid);
  };
  const addFree = (catId, x, y) => {
    // uniform placement pitch so newly added parts never overlap each other
    const n = free.length;
    const inst = {
      ...mkInst(catId),
      x: x ?? 60 + (n % 6) * 240,
      y: y ?? RAIL_TOP + rails.length * (TH + RAIL_GAP) + 60 + Math.floor(n / 6) * 280,
    };
    update((dd) => ({ ...dd, free: [...(dd.free || []), inst] }));
    setSelected(inst.uid);
  };
  const findTerm = (uid) => {
    for (let ri = 0; ri < rails.length; ri++) {
      const ii = rails[ri].items.findIndex((x) => x.uid === uid);
      if (ii >= 0) return { ri, ii, inst: rails[ri].items[ii] };
    }
    return null;
  };
  const findFree = (uid) => free.find((f) => f.uid === uid) || null;
  const remove = (uid) => {
    update((d) => ({
      rails: d.rails.map((rail) => ({ ...rail, items: rail.items.filter((x) => x.uid !== uid) })),
      wires: d.wires.filter((x) => x.a.uid !== uid && x.b.uid !== uid),
      free: (d.free || []).filter((f) => f.uid !== uid),
    }));
    if (selected === uid) setSelected(null);
    if (pending?.uid === uid) setPending(null);
  };
  const duplicate = (uid) => {
    const fr = findFree(uid);
    if (fr) {
      const inst = { ...mkInst(fr.catId), x: fr.x + 28, y: fr.y + 28 };
      update((d) => ({ ...d, free: [...(d.free || []), inst] }));
      setSelected(inst.uid);
      return;
    }
    const loc = findTerm(uid); if (!loc) return;
    const inst = mkInst(loc.inst.catId);
    setRailsW((r) => r.map((rail, ri) => (ri === loc.ri
      ? { ...rail, items: [...rail.items.slice(0, loc.ii + 1), inst, ...rail.items.slice(loc.ii + 1)] }
      : rail)));
    setSelected(inst.uid);
  };
  const move = (uid, dir) => {
    const loc = findTerm(uid); if (!loc) return;
    setRailsW((r) => r.map((rail, ri) => {
      if (ri !== loc.ri) return rail;
      const j = loc.ii + dir;
      if (j < 0 || j >= rail.items.length) return rail;
      const items = [...rail.items];
      [items[loc.ii], items[j]] = [items[j], items[loc.ii]];
      return { ...rail, items };
    }));
  };
  const moveToRail = (uid, target) => {
    const loc = findTerm(uid); if (!loc || target === loc.ri) return;
    const inst = loc.inst;
    setRailsW((r) => r.map((rail, ri) => {
      if (ri === loc.ri) return { ...rail, items: rail.items.filter((x) => x.uid !== uid) };
      if (ri === target) return { ...rail, items: [...rail.items, inst] };
      return rail;
    }));
  };
  const setIdNum = (uid, v) => setRailsW((r) => r.map((rail) => ({
    ...rail,
    items: rail.items.map((x) => (x.uid === uid ? { ...x, idNum: Math.max(0, Math.min(4095, v)) } : x)),
  })));
  // gap (mm) placed before a rail item — separates groups on the same rail
  const setGap = (uid, mm) => setRailsW((r) => r.map((rail) => ({
    ...rail,
    items: rail.items.map((x) => {
      if (x.uid !== uid) return x;
      const g = Math.max(0, Math.min(200, Math.round(mm) || 0));
      const { gap, ...rest } = x;
      return g > 0 ? { ...rest, gap: g } : rest;
    }),
  })));
  // set the variant suffix on a rail item or a free component
  const setVariant = (uid, v) => update((d) => ({
    ...d,
    rails: d.rails.map((rail) => ({ ...rail, items: rail.items.map((x) => (x.uid === uid ? { ...x, variant: v } : x)) })),
    free: (d.free || []).map((f) => (f.uid === uid ? { ...f, variant: v } : f)),
  }));

  // wiring: press a point to start, then click OR drag-release on the target.
  // The cable type is chosen automatically from what the two points are.
  const resolveEnd = (e) => {
    const t = layout.pos[e.uid]; if (!t) return null;
    const p = t.geom.pts[e.pt]; if (!p) return null;
    return { d: t.d, p, inst: t.inst };
  };
  const completeWire = (a, b) => {
    const A = resolveEnd(a), B = resolveEnd(b);
    setPending(null); setWireCursor(null);
    if (!A || !B) return;
    const type = autoWireType(A, B);
    if (!type) {
      showFlash(`✕ no compatible cable between ${A.d.id}·${A.p.label} and ${B.d.id}·${B.p.label}`);
      return;
    }
    setWiresW((w) => [...w, { id: `w${Date.now()}`, a, b, type, label: "" }]);
    showFlash(`✓ ${wireById[type].name}`);
  };
  const pointDown = (uid, pt) => {
    if (!wireMode) return;
    if (!pending) { setPending({ uid, pt }); return; }
    if (pending.uid === uid && pending.pt === pt) { setPending(null); setWireCursor(null); return; }
    completeWire(pending, { uid, pt });
  };
  const pointUp = (uid, pt) => {
    if (!wireMode || !pending) return;
    if (pending.uid === uid && pending.pt === pt) return; // same point → click-click flow continues
    completeWire(pending, { uid, pt });
  };
  const deleteWire = (id) => { setWiresW((w) => w.filter((x) => x.id !== id)); if (selWire === id) setSelWire(null); };
  const setWireLabel = (id, label) => setWiresW((w) => w.map((x) => (x.id === id ? { ...x, label } : x)));
  const setWireTypeOf = (id, type) => setWiresW((w) => w.map((x) => (x.id === id ? { ...x, type } : x)));

  /* ---- project I/O + exports ---------------------------------------- */
  const projName = doc.name || DEF_NAME;
  // renaming is not a structural edit — keep it out of the undo stack
  const setProjName = (name) => setDoc((d) => ({ ...d, name }));
  // swap the whole document in (file import or library open)
  const openDoc = (nd) => {
    reseedSeq(nd.rails, nd.free);
    update(() => nd);
    setSelected(null); setSelWire(null); setPending(null); setActiveRail(0);
  };
  const saveProject = () =>
    download(`${slug(projName)}.json`,
      JSON.stringify({ app: FILE_TAG, version: 1, name: projName, savedAt: new Date().toISOString(), ...doc }, null, 2),
      "application/json");
  const loadProject = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    f.text().then((txt) => {
      const raw = JSON.parse(txt);
      const nd = sanitizeDoc(raw);
      if (!nd || !nd.rails.length) throw new Error("empty");
      // fall back to the file name when the project carries no name of its own
      if (!cleanName(raw.name)) nd.name = cleanName(f.name.replace(/\.json$/i, "")) || DEF_NAME;
      openDoc(nd);
      const lost = droppedBy(raw, nd);
      showFlash(lost
        ? `Loaded “${nd.name}” — ${lost.n} item(s) skipped${lost.unknown.length ? `: unknown part(s) ${lost.unknown.slice(0, 4).join(", ")}` : ""}`
        : `Loaded “${nd.name}”`);
    }).catch(() => alert("Not a valid station project file (expected JSON with rails/wires)."));
  };

  /* ---- in-browser project library ------------------------------------ */
  const [library, setLibrary] = useState(loadLibrary);
  const [projOpen, setProjOpen] = useState(false);
  const writeLibrary = (lib) => {
    if (!saveLibrary(lib)) { alert("Could not save — browser storage is full or blocked. Use Save to keep a JSON file instead."); return false; }
    setLibrary(lib);
    return true;
  };
  // save the current design into a slot; omit id to create a new one
  const libSave = (name, id) => {
    const key = id || `p${Date.now()}`;
    const entry = { id: key, name: cleanName(name) || DEF_NAME, savedAt: new Date().toISOString(), doc: { ...doc, name: cleanName(name) || DEF_NAME } };
    if (!writeLibrary({ ...library, [key]: entry })) return;
    setProjName(entry.name);
    showFlash(`Saved “${entry.name}” to this browser`);
  };
  const libOpen = (id) => {
    const e = library[id]; if (!e) return;
    openDoc({ ...e.doc, name: e.name });
    setProjOpen(false);
    showFlash(`Opened “${e.name}”`);
  };
  const libDelete = (id) => {
    const rest = { ...library }; delete rest[id];
    writeLibrary(rest);
  };
  const libRename = (id, name) => {
    const e = library[id]; if (!e) return;
    const nm = cleanName(name) || DEF_NAME;
    writeLibrary({ ...library, [id]: { ...e, name: nm, doc: { ...e.doc, name: nm } } });
  };
  // aggregate the BOM keyed by resolved part number (variant-aware)
  const bomRows = () => {
    const m = {};
    const add = (d, inst) => {
      if (!d) return;
      const id = resolveId(d, inst);
      const key = id;
      if (!m[key]) m[key] = { qty: 0, id, brand: (BRANDS[d.brand]?.name || d.brand), name: d.name, cat: FN[d.fn]?.label || d.fn };
      m[key].qty++;
    };
    rails.forEach((r) => r.items.forEach((it) => add(byId[it.catId], it)));
    free.forEach((f) => add(byId[f.catId], f));
    return Object.values(m).sort((a, b) => a.brand.localeCompare(b.brand) || a.id.localeCompare(b.id));
  };
  const cableRows = () => {
    const wc = {};
    wires.forEach((w) => (wc[w.type] = (wc[w.type] || 0) + 1));
    return Object.entries(wc).map(([t, n]) => ({ qty: n, name: wireById[t].name }));
  };
  // genuine Excel spreadsheet via SpreadsheetML 2003 (no dependency)
  const exportXlsx = () => {
    const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const cell = (v, type = "String") => `<Cell><Data ss:Type="${type}">${esc(v)}</Data></Cell>`;
    const row = (cells) => `<Row>${cells}</Row>`;
    const hdr = (arr) => row(arr.map((h) => `<Cell ss:StyleID="hdr"><Data ss:Type="String">${esc(h)}</Data></Cell>`));
    const bom = bomRows();
    const cables = cableRows();
    const bomSheet = [
      hdr(["Qty", "Part Number", "Manufacturer", "Description", "Category"]),
      ...bom.map((r) => row(cell(r.qty, "Number") + cell(r.id) + cell(r.brand) + cell(r.name) + cell(r.cat))),
    ].join("");
    const cableSheet = [
      hdr(["Qty", "Cable"]),
      ...cables.map((r) => row(cell(r.qty, "Number") + cell(r.name))),
    ].join("");
    const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles><Style ss:ID="hdr"><Font ss:Bold="1"/><Interior ss:Color="#D9DDE1" ss:Pattern="Solid"/></Style></Styles>
<Worksheet ss:Name="Bill of Materials"><Table>${bomSheet}</Table></Worksheet>
<Worksheet ss:Name="Cables"><Table>${cableSheet}</Table></Worksheet>
</Workbook>`;
    download("sids-ethercat-bom.xls", xml, "application/vnd.ms-excel");
  };
  const exportXml = () => {
    const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const lines = ['<?xml version="1.0" encoding="utf-8"?>', "<!-- device order for comparison against TwinCAT EtherCAT > Scan -->", "<EtherCATConfig>"];
    rails.forEach((rail, ri) => {
      lines.push(`  <Rail no="${ri + 1}">`);
      rail.items.forEach((it, ii) => {
        const d = byId[it.catId];
        const rid = resolveId(d, it);
        const idAttr = d.idSwitch ? ` stationId="${it.idNum ?? 1}"` : "";
        lines.push(`    <Device pos="${ii + 1}" type="${esc(rid)}" name="${esc(`Term ${ii + 1} (${rid})`)}"${idAttr}/>`);
      });
      lines.push("  </Rail>");
    });
    if (free.length) {
      lines.push("  <FieldDevices>");
      free.forEach((f) => {
        const d = byId[f.catId];
        lines.push(`    <Device type="${esc(resolveId(d, f))}" name="${esc(d.name)}"/>`);
      });
      lines.push("  </FieldDevices>");
    }
    lines.push("</EtherCATConfig>");
    download("beckhoff-station.xml", lines.join("\n"), "application/xml");
  };
  const exportPng = () => {
    const svg = svgRef.current; if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement("canvas");
      cv.width = svg.width.baseVal.value * 2;
      cv.height = svg.height.baseVal.value * 2;
      const ctx = cv.getContext("2d");
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      cv.toBlob((b) => b && download("beckhoff-station.png", b));
    };
    img.src = url;
  };

  // Delete key removes selection; Ctrl+Z / Ctrl+Y (or Ctrl+Shift+Z) undo/redo
  useEffect(() => {
    const h = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault(); redo();
      } else if (e.key === "Delete") {
        if (selWire) deleteWire(selWire);
        else if (selected) remove(selected);
      } else if (e.key === "Escape") {
        setDetail(null); setPending(null); setWireCursor(null);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  const layout = useMemo(() => {
    const pos = {};
    let maxW = 820;
    rails.forEach((rail, ri) => {
      let x = RAIL_PAD_X;
      const y = RAIL_TOP + ri * (TH + RAIL_GAP);
      rail.items.forEach((inst) => {
        const d = byId[inst.catId];
        const geom = pointGeom(d);
        // an optional gap (mm) sets this item — and everything after it —
        // discernibly apart, starting a separate group on the same rail
        if (inst.gap > 0) x += Math.round(inst.gap * PX_PER_MM);
        pos[inst.uid] = { x, y, d, geom, ri, inst };
        x += geom.W + 1;
      });
      maxW = Math.max(maxW, x + RAIL_PAD_X + 40);
    });
    // free-placed components expand the canvas in both directions
    let maxH = RAIL_TOP + rails.length * (TH + RAIL_GAP);
    free.forEach((f) => {
      const d = byId[f.catId];
      const geom = freeGeom(d);
      pos[f.uid] = { x: f.x, y: f.y, d, geom, free: true, inst: f };
      maxW = Math.max(maxW, f.x + geom.W + 90);
      maxH = Math.max(maxH, f.y + geom.H + 90);
    });
    return { pos, canvasW: maxW, canvasH: maxH + 60 };
  }, [rails, free]);

  const absPoint = (uid, pt) => {
    const t = layout.pos[uid]; if (!t) return null;
    const p = t.geom.pts[pt]; if (!p) return null;
    // while a free component is being dragged, wires follow it live
    const dragging = freeVis && freeVis.uid === uid;
    const bx = dragging ? freeVis.x : t.x;
    const by = dragging ? freeVis.y : t.y;
    // duct = the y level just below this device where its wires may travel
    const duct = t.free ? by + t.geom.H + 24 : RAIL_TOP + t.ri * (TH + RAIL_GAP) + TH + 30;
    return { x: bx + p.x, y: by + p.y, duct };
  };
  const wiredPts = useMemo(() => {
    const s = new Set();
    wires.forEach((w) => { s.add(`${w.a.uid}:${w.a.pt}`); s.add(`${w.b.uid}:${w.b.pt}`); });
    return s;
  }, [wires]);
  // components that have at least one wire connected (→ motion parts animate)
  const wiredComps = useMemo(() => {
    const s = new Set();
    wires.forEach((w) => { s.add(w.a.uid); s.add(w.b.uid); });
    return s;
  }, [wires]);

  // rail items that actually receive power/E-bus: a terminal is powered only
  // if it sits in a segment fed by a coupler/embedded PC and before the end
  // cover. Stranded terminals (no coupler in the segment, or past a cover)
  // are dead — their LEDs stay off.
  const poweredUids = useMemo(() => {
    const s = new Set();
    rails.forEach((rail) => {
      let seg = [], head = false;
      const flush = () => { if (head) seg.forEach((u) => s.add(u)); seg = []; head = false; };
      for (const inst of rail.items) {
        const d = byId[inst.catId]; if (!d) continue;
        if (d.endcap) { flush(); continue; } // end cover terminates the segment
        if (d.coupler || d.cx) head = true;  // a coupler/embedded PC sources it
        seg.push(inst.uid);
      }
      flush();
    });
    return s;
  }, [rails]);

  // FSoE (Safety over EtherCAT) is a "black channel" protocol: safe I/O
  // (EL1904/EL2904…) only exchange telegrams once a TwinSAFE Logic
  // (EL6910/EL6930/EK1960, or a TwinCAT Safety PLC) is present to be their
  // FSoE master. Those telegrams ride the EtherCAT cables — and the E-bus
  // backplane — never the 24 V field wiring. So FSoE is active only when a
  // twinsafe bus node AND a logic instance both exist.
  const twinsafe = useMemo(() => {
    let node = false, logic = false;
    const scan = (d) => { if (!d) return; if (d.twinsafe) node = true; if (d.tsLogic) logic = true; };
    rails.forEach((r) => r.items.forEach((i) => scan(byId[i.catId])));
    free.forEach((f) => scan(byId[f.catId]));
    return { node, logic, active: node && logic };
  }, [rails, free]);
  const fsoeActive = twinsafe.active;

  const issues = useMemo(() => validateStation(rails, wires, byId, (uid, pt) => {
    const t = layout.pos[uid]; if (!t) return null;
    const p = t.geom.pts[pt]; if (!p) return null;
    return { d: t.d, label: p.label, port: p.port, role: p.role };
  }), [rails, wires, layout]);
  const nErr = issues.filter((i) => i.level === "error").length;
  const nWarn = issues.length - nErr;

  const stats = useMemo(() => {
    let di = 0, do_ = 0, ai = 0, ao = 0;
    const perRail = rails.map((rail) => {
      let supply = 0, consume = 0, mm = 0;
      rail.items.forEach((inst) => {
        const d = byId[inst.catId]; if (!d) return;
        mm += d.w;
        if (d.ebus > 0) supply += d.ebus; else consume += -d.ebus;
        if (d.io === "di") di += d.ch; if (d.io === "do") do_ += d.ch;
        if (d.io === "ai") ai += d.ch; if (d.io === "ao") ao += d.ch;
      });
      return { supply, consume, mm, over: consume > supply && rail.items.length > 0 };
    });
    return { di, do_, ai, ao, perRail };
  }, [rails]);

  const bom = useMemo(() => {
    const m = {};
    const add = (d, inst) => { if (!d) return; const id = resolveId(d, inst); (m[id] = m[id] || { qty: 0, d }).qty++; };
    rails.forEach((r) => r.items.forEach((it) => add(byId[it.catId], it)));
    free.forEach((f) => add(byId[f.catId], f));
    const lines = Object.entries(m).map(([id, v]) => `${v.qty}×  ${id}  ${(BRANDS[v.d.brand]?.name || "")} · ${v.d.name}`);
    const wc = {};
    wires.forEach((w) => (wc[w.type] = (wc[w.type] || 0) + 1));
    Object.entries(wc).forEach(([t, n]) => lines.push(`${n}×  wire — ${wireById[t].name}`));
    return lines.join("\n");
  }, [rails, wires, free]);
  const copyBom = async () => { try { await navigator.clipboard.writeText(bom || ""); setCopied(true); setTimeout(() => setCopied(false), 1400); } catch {} };

  // rail index from Y, insertion index from X (optionally ignoring a dragged item)
  const svgXY = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const dropTarget = (x, y, excludeUid) => {
    let ri = Math.round((y - RAIL_TOP - TH / 2) / (TH + RAIL_GAP));
    ri = Math.max(0, Math.min(rails.length - 1, ri));
    const items = rails[ri].items.filter((it) => it.uid !== excludeUid);
    let idx = items.length;
    for (let i = 0; i < items.length; i++) {
      const p = layout.pos[items[i].uid];
      if (p && x < p.x + p.geom.W / 2) { idx = i; break; }
    }
    return { ri, idx, railItems: items };
  };
  // drop a palette part onto the canvas
  const onCanvasDrop = (e) => {
    e.preventDefault();
    const catId = e.dataTransfer.getData("text/catid");
    const d = byId[catId];
    if (!d || !svgRef.current) return;
    const { x, y } = svgXY(e);
    if (d.free) { addFree(catId, Math.max(0, x - d.fw / 2), Math.max(0, y - d.fh / 2)); return; }
    const { ri, idx } = dropTarget(x, y);
    const inst = mkInst(catId);
    setRailsW((r) => r.map((rail, i) => (i === ri
      ? { ...rail, items: [...rail.items.slice(0, idx), inst, ...rail.items.slice(idx)] }
      : rail)));
    setSelected(inst.uid);
    setActiveRail(ri);
  };
  // drag a placed terminal along/between rails
  const dragTermRef = useRef(null); // { uid, startX, startY, moved }
  const [dragVis, setDragVis] = useState(null); // { uid, x, y, ri, idx }
  const startDragTerm = (uid, e) => {
    if (wireMode) return;
    dragTermRef.current = { uid, startX: e.clientX, startY: e.clientY, moved: false };
  };
  // free components drag with a live position override, committed on release
  const dragFreeRef = useRef(null); // { uid, offX, offY, moved }
  const [freeVis, setFreeVis] = useState(null); // { uid, x, y }
  const startDragFree = (uid, e) => {
    if (wireMode) return;
    const f = findFree(uid); if (!f) return;
    const { x, y } = svgXY(e);
    dragFreeRef.current = { uid, offX: x - f.x, offY: y - f.y, moved: false };
  };
  const onCanvasPointerMove = (e) => {
    if (wireMode) {
      if (pending) setWireCursor(svgXY(e));
      return;
    }
    const df = dragFreeRef.current;
    if (df) {
      const { x, y } = svgXY(e);
      df.moved = true;
      setFreeVis({ uid: df.uid, x: Math.max(0, x - df.offX), y: Math.max(0, y - df.offY) });
      return;
    }
    const dr = dragTermRef.current;
    if (!dr) return;
    if (!dr.moved && Math.hypot(e.clientX - dr.startX, e.clientY - dr.startY) < 6) return;
    dr.moved = true;
    const { x, y } = svgXY(e);
    setDragVis({ uid: dr.uid, x, y, ...dropTarget(x, y, dr.uid) });
  };
  const endCanvasDrag = () => {
    const df = dragFreeRef.current;
    if (df) {
      dragFreeRef.current = null;
      if (df.moved && freeVis) {
        const fv = freeVis;
        update((d) => ({ ...d, free: (d.free || []).map((f) => (f.uid === fv.uid ? { ...f, x: fv.x, y: fv.y } : f)) }));
        setSelected(df.uid);
      }
      setFreeVis(null);
      return;
    }
    const dr = dragTermRef.current;
    dragTermRef.current = null;
    if (dr?.moved && dragVis) {
      const loc = findTerm(dr.uid);
      if (loc) {
        const inst = loc.inst;
        update((d) => ({
          ...d,
          rails: d.rails.map((rail, i) => {
            const items = rail.items.filter((x) => x.uid !== dr.uid);
            if (i === dragVis.ri) {
              return { ...rail, items: [...items.slice(0, dragVis.idx), inst, ...items.slice(dragVis.idx)] };
            }
            return items.length === rail.items.length ? rail : { ...rail, items };
          }),
        }));
        setSelected(dr.uid);
        setActiveRail(dragVis.ri);
      }
    }
    setDragVis(null);
  };

  const selLoc = selected ? findTerm(selected) : null;
  const selFree = selected && !selLoc ? findFree(selected) : null;
  const selD = selLoc ? byId[selLoc.inst.catId] : selFree ? byId[selFree.catId] : null;
  const detailLoc = detail ? findTerm(detail) : null;
  const detailD = detailLoc ? byId[detailLoc.inst.catId] : null;
  const wireOf = (id) => wires.find((w) => w.id === id);
  const ptName = (e) => {
    const t = layout.pos[e.uid]; if (!t) return "?";
    const lb = t.geom.pts[e.pt]?.label ?? e.pt + 1;
    return `${t.d.id}·${lb}`;
  };
  const filt = (ids) => {
    const needle = q.trim().toLowerCase();
    return ids.filter((id) => {
      const d = byId[id];
      if (brandFilter !== "all" && d.brand !== brandFilter) return false;
      if (srcFilter === "etg" && !d.etg) return false;
      if (srcFilter === "curated" && d.etg) return false;
      if (!needle) return true;
      // vendor and device type are searchable too, so grouping the ETG import
      // by company doesn't lose the "show me every servo drive" question
      return id.toLowerCase().includes(needle)
        || d.name.toLowerCase().includes(needle)
        || (BRANDS[d.brand]?.name || d.brand).toLowerCase().includes(needle)
        || (d.etg || "").toLowerCase().includes(needle);
    });
  };
  // manufacturers present in the catalog, for the filter dropdown
  const brandList = useMemo(() => {
    const set = new Set(CATALOG.map((d) => d.brand));
    return [...set].sort((a, b) => (BRANDS[a]?.name || a).localeCompare(BRANDS[b]?.name || b));
  }, []);

  // company → category → parts. Beckhoff leads (it is what this app is for),
  // everyone else alphabetical; categories keep CAT_ORDER, not alphabetical.
  const palTree = useMemo(() => {
    const catOf = {};
    GROUPS.forEach((g) => g.ids.forEach((id) => { catOf[id] = CAT_CANON[g.key] || g.key; }));
    const cos = {};
    CATALOG.forEach((d) => {
      const co = (cos[d.brand] ||= { brand: d.brand, name: BRANDS[d.brand]?.name || d.brand, cats: {}, n: 0 });
      (co.cats[catOf[d.id] || "sens"] ||= []).push(d.id);
      co.n++;
    });
    return Object.values(cos)
      .sort((a, b) => (a.brand === "beckhoff" ? -1 : b.brand === "beckhoff" ? 1 : a.name.localeCompare(b.name)))
      .map((co) => ({
        ...co,
        cats: Object.entries(co.cats)
          .sort((a, b) => CAT_ORDER.indexOf(a[0]) - CAT_ORDER.indexOf(b[0]))
          .map(([key, ids]) => ({ key, label: CAT_LABEL[key] || key, ids })),
      }));
  }, []);

  return (
    <div style={S.root}>
      <style>{CSS}</style>
      <header style={S.header}>
        <div style={S.brandBlock}>
          <span style={S.brandMark}>SID'S</span>
          <span style={S.brandSub}>EtherCAT Configurator</span>
        </div>
        <div style={S.headerActions}>
          <button style={{ ...S.btnGhost, opacity: past.length ? 1 : 0.4 }} disabled={!past.length} onClick={undo} title="Undo (Ctrl+Z)">↶</button>
          <button style={{ ...S.btnGhost, opacity: future.length ? 1 : 0.4 }} disabled={!future.length} onClick={redo} title="Redo (Ctrl+Y)">↷</button>
          <button style={{ ...S.btnGhost, ...(wireMode ? S.btnOn : null) }}
            onClick={() => { setWireMode((v) => !v); setPending(null); setWireCursor(null); }}>
            {wireMode ? "✕ Exit wire tool" : "⚡ Wire tool"}
          </button>
          <button style={{ ...S.btnGhost, ...(showWires ? null : S.btnOn) }} onClick={() => setShowWires((v) => !v)}>
            {showWires ? "Hide wires" : `Show wires (${wires.length})`}
          </button>
          <button style={S.btnGhost} onClick={addRail}>+ Add rail</button>
          <input style={S.projName} value={projName} onChange={(e) => setProjName(e.target.value.slice(0, 60))}
            onFocus={(e) => e.target.select()} title="Project name — used for the saved file and the in-browser library" />
          <button style={S.btnGhost} onClick={() => setProjOpen(true)} title="Save to / open from this browser (no file needed)">
            Projects{Object.keys(library).length ? ` (${Object.keys(library).length})` : ""}
          </button>
          <button style={S.btnGhost} onClick={saveProject} title="Download the project as a JSON file">Save file</button>
          <button style={S.btnGhost} onClick={() => fileRef.current?.click()} title="Import a project JSON file">Import</button>
          <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: "none" }} onChange={loadProject} />
          <button style={S.btnGhost} onClick={exportPng} title="Export the station drawing as PNG">PNG</button>
          <button style={S.btnGhost} onClick={exportXlsx} title="Export the BOM as an Excel spreadsheet">Excel</button>
          <button style={S.btnGhost} onClick={exportXml} title="Export a TwinCAT-style device list (compare against EtherCAT > Scan)">XML</button>
          <button style={S.btnGhost} onClick={() => setDiagOpen(true)} title="Generate a compact electrical connection diagram">Diagram</button>
          <button style={S.btnGhost} onClick={() => setTopoOpen(true)} title="Show the EtherCAT network topology (master → couplers → terminals → next station)">Topology</button>
          <button style={S.btnGhost} onClick={() => { update(() => ({ name: DEF_NAME, rails: [{ id: "r1", items: [] }], wires: [], free: [] })); setSelected(null); setPending(null); setSelWire(null); setActiveRail(0); }}>Clear all</button>
        </div>
      </header>

      {wireMode && (
        <div style={S.wireBar}>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginRight: 4 }}>
            {pending
              ? `From ${ptName(pending)} — click or drag-release on the target point (cable is picked automatically)`
              : "Press a connection point to start a wire — the right cable type is chosen for you"}
          </span>
          {flash && (
            <span style={{ fontSize: 12, fontWeight: 700, color: flash.startsWith("✕") ? C.brand : "#1F7A4D" }}>
              {flash}
            </span>
          )}
        </div>
      )}

      {/* the wire bar owns the flash while wiring; everywhere else it toasts */}
      {flash && !wireMode && (
        <div style={{ ...S.toast, color: flash.startsWith("✕") ? "#FF9A9A" : "#fff" }}>{flash}</div>
      )}

      <div style={S.layout}>
        <aside style={S.palette} className="scroll">
          <div style={S.railPick}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.muted }}>ADD TO</span>
            <select value={activeRail} onChange={(e) => setActiveRail(+e.target.value)} style={S.railSelect}>
              {rails.map((_, i) => <option key={i} value={i}>Rail {i + 1}</option>)}
            </select>
            <button
              onClick={() => setNewGroup((v) => !v)}
              title="Start a separate station on the same rail: the next device you add is placed after the end cover with a visible gap. Auto-clears after one add."
              style={{
                ...S.btnGhost, padding: "3px 8px", fontSize: 11, whiteSpace: "nowrap",
                ...(newGroup ? { background: C.brand, color: "#fff", border: `1px solid ${C.brand}` } : {}),
              }}>
              ＋ new group
            </button>
          </div>
          {newGroup && (
            <div style={{ fontSize: 10.5, color: C.brand, margin: "-4px 0 8px", lineHeight: 1.3 }}>
              Next device starts a gapped station on Rail {activeRail + 1}.
            </div>
          )}
          <input className="wireInput" style={{ ...S.wireInput, width: "100%", boxSizing: "border-box", marginBottom: 8 }}
            placeholder="Search catalog… (EL32, relay, ABB, servo)" value={q} onChange={(e) => setQ(e.target.value)} />
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.muted }}>MFR</span>
            <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}
              style={{ ...S.railSelect, flex: 1 }}>
              <option value="all">All manufacturers</option>
              {brandList.map((b) => <option key={b} value={b}>{BRANDS[b]?.name || b}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.muted }}>SRC</span>
            <select value={srcFilter} onChange={(e) => setSrcFilter(e.target.value)}
              style={{ ...S.railSelect, flex: 1 }}
              title="Curated = hand-checked specs. ETG = the EtherCAT Technology Group directory import (representative specs)">
              <option value="all">All parts</option>
              <option value="curated">Curated catalog only</option>
              <option value="etg">ETG / EtherCAT directory only</option>
            </select>
          </div>
          {(() => {
            // a search or a manufacturer pick opens what it matched, otherwise
            // 280-odd company folders would just sit there closed
            const forced = !!q.trim() || brandFilter !== "all";
            let anyHit = false;
            const rows = palTree.map((co) => {
              const cats = co.cats.map((c) => ({ ...c, hits: filt(c.ids) })).filter((c) => c.hits.length);
              if (!cats.length) return null;
              anyHit = true;
              const total = cats.reduce((n, c) => n + c.hits.length, 0);
              const coOpen = forced || !!openGroups[co.brand];
              return (
                <div key={co.brand} style={{ marginBottom: 8 }}>
                  <button style={S.groupBtn}
                    onClick={() => setOpenGroups((o) => ({ ...o, [co.brand]: !o[co.brand] }))}>
                    <span style={{ ...S.groupDot, background: BRANDS[co.brand]?.c || "#5A6B7A" }} />
                    <span style={{ flex: 1, textAlign: "left" }}>{co.name}</span>
                    <span style={{ color: C.muted, fontWeight: 500 }}>{total} {coOpen ? "▾" : "▸"}</span>
                  </button>
                  {coOpen && cats.map((c) => {
                    const ck = `${co.brand}/${c.key}`;
                    // with one category there is nothing to choose between, so
                    // skip the extra click and show the parts directly
                    const catOpen = forced || cats.length === 1 || !!openGroups[ck];
                    return (
                      <div key={ck} style={{ marginLeft: 8 }}>
                        <button style={S.catBtn} onClick={() => setOpenGroups((o) => ({ ...o, [ck]: !o[ck] }))}>
                          <span style={{ ...S.catDot, background: FN[c.key]?.c || "#98A2AC" }} />
                          <span style={{ flex: 1, textAlign: "left" }}>{c.label}</span>
                          <span style={{ color: C.muted, fontWeight: 500 }}>{c.hits.length} {catOpen ? "▾" : "▸"}</span>
                        </button>
                        {catOpen && c.hits.map((id) => {
                          const d = byId[id];
                          return (
                            <button key={id} className="palItem" style={S.palItem} onClick={() => add(id)} title={d.desc || d.name}
                              draggable onDragStart={(e) => e.dataTransfer.setData("text/catid", id)}>
                              <span style={{ ...S.palStripe, background: FN[d.fn].c }} />
                              <span style={S.palId}>{id}</span>
                              <span style={S.palName}>{d.name}</span>
                              <span style={S.palPlus}>+</span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            });
            return anyHit ? rows : (
              <div style={{ fontSize: 12, color: C.muted, padding: "6px 2px" }}>
                Nothing matches that search and filter combination.
              </div>
            );
          })()}
        </aside>

        <main style={S.stage} className="scroll">
          <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" width={layout.canvasW} height={layout.canvasH} style={{ display: "block" }}
            onDragOver={(e) => e.preventDefault()} onDrop={onCanvasDrop}
            onPointerMove={onCanvasPointerMove} onPointerUp={endCanvasDrag} onPointerLeave={endCanvasDrag}>
            <defs>
              <linearGradient id="railg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#F1F3F4" /><stop offset="0.22" stopColor="#C9CDD2" />
                <stop offset="0.5" stopColor="#AEB4BA" /><stop offset="0.78" stopColor="#C4C8CD" />
                <stop offset="1" stopColor="#8F959B" />
              </linearGradient>
              <linearGradient id="tbody" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor={M.hL} /><stop offset="0.5" stopColor={M.h} /><stop offset="1" stopColor={M.hR} />
              </linearGradient>
              <linearGradient id="psbody" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#E2E5E8" /><stop offset="0.5" stopColor="#C9CDD1" /><stop offset="1" stopColor="#ADB2B7" />
              </linearGradient>
              <linearGradient id="ybody" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor={M.yL} /><stop offset="0.5" stopColor={M.y} /><stop offset="1" stopColor={M.yR} />
              </linearGradient>
            </defs>

            {rails.map((rail, ri) => {
              const y = RAIL_TOP + ri * (TH + RAIL_GAP);
              const st = stats.perRail[ri];
              return (
                <g key={rail.id}>
                  <text x={RAIL_PAD_X} y={y - 26} fill={activeRail === ri ? C.ink : C.muted} fontSize="11.5"
                    fontWeight="700" style={{ cursor: "pointer" }} onClick={() => setActiveRail(ri)}>
                    RAIL {ri + 1}{activeRail === ri ? " ●" : ""}
                  </text>
                  <text x={RAIL_PAD_X + 70} y={y - 26} fill={st.over ? C.brand : C.muted} fontSize="10.5">
                    {st.mm} mm · E-bus {st.consume}/{st.supply} mA{st.over ? " — OVER, add EL9410" : ""}
                  </text>
                  {rails.length > 1 && (
                    <text x={layout.canvasW - RAIL_PAD_X} y={y - 26} fill={C.brand} fontSize="10.5" textAnchor="end"
                      style={{ cursor: "pointer" }} onClick={() => removeRail(ri)}>remove rail ✕</text>
                  )}
                  <rect x="8" y={y + 216} width={layout.canvasW - 16} height="28" fill="url(#railg)" />
                  <rect x="8" y={y + 216} width={layout.canvasW - 16} height="1.6" fill="#FAFBFC" />
                  <rect x="8" y={y + 242} width={layout.canvasW - 16} height="2" fill="#767C82" />
                  {Array.from({ length: Math.floor((layout.canvasW - 30) / 26) }).map((_, i) => (
                    <rect key={i} x={18 + i * 26} y={y + 225} width="12" height="10" rx="2.5" fill="#878D93" stroke="#6E747A" strokeWidth="0.6" />
                  ))}
                  {rail.items.length === 0 && (
                    <text x={layout.canvasW / 2} y={y + 140} fill={C.muted} fontSize="12" textAnchor="middle">
                      Empty rail — select it and add devices from the palette
                    </text>
                  )}
                  {rail.items.map((inst) => (
                    <TerminalG key={inst.uid} inst={inst} layout={layout} selected={selected === inst.uid}
                      wireMode={wireMode} pending={pending} wiredPts={wiredPts} powered={poweredUids.has(inst.uid)}
                      dragging={dragVis?.uid === inst.uid}
                      onSelect={() => { setSelected(inst.uid); setSelWire(null); }}
                      onDetail={() => setDetail(inst.uid)}
                      onDragStart={(e) => startDragTerm(inst.uid, e)}
                      onPointDown={pointDown} onPointUp={pointUp}
                      onHover={(u, i) => setHover({ uid: u, pt: i })}
                      onLeave={() => setHover(null)} />
                  ))}
                  <BackplaneLayer rail={rail} y={y} layout={layout} fsoeActive={fsoeActive} />
                </g>
              );
            })}

            {showWires && wires.map((w, wi) => {
              const A = absPoint(w.a.uid, w.a.pt), B = absPoint(w.b.uid, w.b.pt);
              if (!A || !B) return null;
              const t = wireById[w.type];
              // orthogonal route: run just below the LOWER of the two endpoints
              // (not all the way down to the rail) so wires stay near their
              // ports and cover as little of the devices as possible. Staggered
              // into thin lanes so parallel runs stay readable. Never route
              // deeper than the old rail-duct level.
              const near = Math.max(A.y, B.y) + 14 + (wi % 6) * 5;
              const ductY = Math.min(near, Math.max(A.duct, B.duct) + (wi % 6) * 5);
              const r = 6 * Math.sign(B.x - A.x || 1);
              const path = Math.abs(B.x - A.x) > 14
                ? `M ${A.x} ${A.y} L ${A.x} ${ductY - 6} Q ${A.x} ${ductY} ${A.x + r} ${ductY} L ${B.x - r} ${ductY} Q ${B.x} ${ductY} ${B.x} ${ductY - 6} L ${B.x} ${B.y}`
                : `M ${A.x} ${A.y} L ${A.x} ${ductY} L ${B.x} ${ductY} L ${B.x} ${B.y}`;
              const isSel = selWire === w.id;
              // FSoE telegrams ride only EtherCAT-capable cabling, and only
              // when the station has a working safety loop (I/O + logic).
              // Field wiring to a safe terminal is plain 24 V — never FSoE.
              const fsoe = t.ec && fsoeActive;
              // IO-Link segment: either endpoint is an IO-Link C/Q port → blink blue
              const iolink = [w.a, w.b].some((e2) => {
                const tp = layout.pos[e2.uid];
                return (tp?.geom.pts[e2.pt]?.label || "").includes("C/Q");
              });
              return (
                <g key={w.id} onClick={(e) => { e.stopPropagation(); setSelWire(w.id); setSelected(null); }} style={{ cursor: "pointer" }}>
                  <path d={path} fill="none" stroke="transparent" strokeWidth="12" />
                  {isSel && <path d={path} fill="none" stroke="#1C2126" strokeWidth={t.w + 4} opacity="0.25" />}
                  {t.ec && <path d={path} fill="none" stroke="#7FE2A9" strokeWidth={t.w + 4} opacity="0.45" strokeLinecap="round" />}
                  {iolink && <path d={path} fill="none" stroke="#4AA3FF" strokeWidth={t.w + 4} opacity="0.4" strokeLinecap="round" />}
                  {t.shield && <path d={path} fill="none" stroke="#5F656C" strokeWidth={t.w + 2} />}
                  <path d={path} fill="none" stroke={t.stroke} strokeWidth={t.w} strokeLinecap="round" strokeLinejoin="round" />
                  {t.gnye && <path d={path} fill="none" stroke="#F2D703" strokeWidth={t.w} strokeLinecap="round" strokeDasharray="7 9" />}
                  {t.net === "fo" && <path d={path} fill="none" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="5 5" opacity="0.8" />}
                  {iolink && (
                    <path d={path} fill="none" stroke="#2E8BFF" strokeWidth={t.w + 1} strokeDasharray="9 8" strokeLinecap="round">
                      <animate attributeName="opacity" values="0.95;0.1;0.95" dur="1.1s" repeatCount="indefinite" />
                    </path>
                  )}
                  {fsoe && (
                    <path d={path} fill="none" stroke="#F2C21E" strokeWidth={t.w + 1} strokeDasharray="10 8" strokeLinecap="round">
                      <animate attributeName="opacity" values="0.95;0.1;0.95" dur="1.1s" repeatCount="indefinite" />
                    </path>
                  )}
                  <WireEnd x={A.x} y={A.y} t={t} />
                  <WireEnd x={B.x} y={B.y} t={t} />
                  {w.label && (
                    <text x={(A.x + B.x) / 2} y={ductY - 5} fill={C.ink} fontSize="10" textAnchor="middle"
                      style={{ paintOrder: "stroke", stroke: "#EDEFF1", strokeWidth: 4 }}>{w.label}</text>
                  )}
                </g>
              );
            })}

            {/* free-placed components (PCs, panels, drives, field devices…) */}
            {free.map((f) => {
              const vis = freeVis?.uid === f.uid ? freeVis : null;
              const lay = vis
                ? { pos: { ...layout.pos, [f.uid]: { ...layout.pos[f.uid], x: vis.x, y: vis.y } } }
                : layout;
              return (
                <FreeCompG key={f.uid} inst={f} layout={lay} selected={selected === f.uid}
                  wireMode={wireMode} pending={pending} wired={wiredComps.has(f.uid)}
                  onSelect={() => { setSelected(f.uid); setSelWire(null); }}
                  onDragStart={(e) => startDragFree(f.uid, e)}
                  onPointDown={pointDown} onPointUp={pointUp}
                  onHover={(u, i) => setHover({ uid: u, pt: i })}
                  onLeave={() => setHover(null)} />
              );
            })}

            {/* live wire preview while picking the second point */}
            {wireMode && pending && wireCursor && (() => {
              const P = absPoint(pending.uid, pending.pt);
              if (!P) return null;
              return (
                <line x1={P.x} y1={P.y} x2={wireCursor.x} y2={wireCursor.y}
                  stroke="#1C2126" strokeWidth="1.6" strokeDasharray="6 5" opacity="0.55" pointerEvents="none" />
              );
            })()}

            {/* drag ghost + insertion caret */}
            {dragVis && (() => {
              const railY = RAIL_TOP + dragVis.ri * (TH + RAIL_GAP);
              const items = dragVis.railItems;
              let caretX;
              if (dragVis.idx < items.length) {
                caretX = layout.pos[items[dragVis.idx].uid]?.x ?? RAIL_PAD_X;
              } else if (items.length) {
                const last = layout.pos[items[items.length - 1].uid];
                caretX = last ? last.x + last.geom.W + 2 : RAIL_PAD_X;
              } else {
                caretX = RAIL_PAD_X;
              }
              const dd = byId[findUidCat(rails, dragVis.uid)] || null;
              return (
                <g pointerEvents="none">
                  <line x1={caretX} y1={railY - 8} x2={caretX} y2={railY + TH + 8} stroke="#D71920" strokeWidth="2.5" strokeDasharray="6 4" />
                  <rect x={dragVis.x - 30} y={dragVis.y - 14} width="60" height="24" rx="5" fill="#1C2126" opacity="0.85" />
                  <text x={dragVis.x} y={dragVis.y + 2} fill="#fff" fontSize="9.5" textAnchor="middle" fontFamily="ui-monospace,monospace">
                    {dd ? dd.id : ""}
                  </text>
                </g>
              );
            })()}

            {hover && (() => {
              const t = layout.pos[hover.uid]; if (!t) return null;
              const p = t.geom.pts[hover.pt]; if (!p) return null;
              const x = t.x + p.x, y = t.y + p.y - (selected === hover.uid && !t.free ? 8 : 0);
              const txt = pointRole(t.d, p);
              const w = txt.length * 5.7 + 18;
              const bx = Math.max(4, Math.min(x - w / 2, layout.canvasW - w - 4));
              return (
                <g pointerEvents="none">
                  <rect x={bx} y={y - 38} width={w} height="19" rx="4" fill="#1C2126" opacity="0.93" />
                  <path d={`M ${x - 4} ${y - 19} l 4 5 l 4 -5 z`} fill="#1C2126" opacity="0.93" />
                  <text x={bx + w / 2} y={y - 24.5} fill="#fff" fontSize="9.5" textAnchor="middle" fontFamily="system-ui">{txt}</text>
                </g>
              );
            })()}
          </svg>
        </main>

        <aside style={S.side} className="scroll">
          <section style={S.card}>
            <div style={S.cardHead}>Station summary</div>
            <div style={S.ioGrid}>
              <IoStat label="DI" v={stats.di} c={FN.di.c} />
              <IoStat label="DO" v={stats.do_} c={FN.do.c} />
              <IoStat label="AI" v={stats.ai} c={FN.ai.c} />
              <IoStat label="AO" v={stats.ao} c={FN.ao.c} />
            </div>
            {stats.perRail.map((st, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={S.meterTop}>
                  <span>Rail {i + 1} E-bus</span>
                  <span style={{ color: st.over ? C.brand : C.ink, fontVariantNumeric: "tabular-nums" }}>{st.consume} / {st.supply} mA</span>
                </div>
                <div style={S.meterTrack}>
                  <div style={{ ...S.meterFill, width: st.supply ? `${Math.min(100, (st.consume / st.supply) * 100)}%` : "0%", background: st.over ? C.brand : "#25A37A" }} />
                </div>
              </div>
            ))}
            <div style={S.factRow}><span>Wires</span><b>{wires.length}</b></div>
          </section>

          <section style={S.card}>
            <div style={S.cardHead}>
              Validation
              {issues.length > 0 && (
                <span style={{ fontWeight: 700, textTransform: "none", letterSpacing: 0 }}>
                  {nErr > 0 && <span style={{ color: C.brand }}>{nErr} error{nErr > 1 ? "s" : ""}</span>}
                  {nErr > 0 && nWarn > 0 && " · "}
                  {nWarn > 0 && <span style={{ color: "#B7791F" }}>{nWarn} warning{nWarn > 1 ? "s" : ""}</span>}
                </span>
              )}
            </div>
            {issues.length === 0 ? (
              <p style={{ color: "#25A37A", fontSize: 13, margin: 0 }}>✓ No issues — structure, E-bus, power contacts and wiring check out.</p>
            ) : (
              <div className="scroll" style={{ maxHeight: 190, overflowY: "auto", display: "flex", flexDirection: "column", gap: 7 }}>
                {issues.map((it, i) => (
                  <div key={i} style={{ display: "flex", gap: 7, fontSize: 11.5, lineHeight: 1.4 }}>
                    <span style={{ color: it.level === "error" ? C.brand : "#B7791F", fontWeight: 800, flex: "0 0 auto" }}>
                      {it.level === "error" ? "✕" : "⚠"}
                    </span>
                    <span>{it.rail != null && <b>Rail {it.rail + 1}: </b>}{it.msg}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section style={S.card}>
            <div style={S.cardHead}>{selWire ? "Wire" : selD ? "Device" : "Inspector"}</div>
            {selWire && wireOf(selWire) ? (() => {
              const w = wireOf(selWire), t = wireById[w.type];
              return (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <WireSwatch type={w.type} big />
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>{t.name}</div>
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>{ptName(w.a)} → {ptName(w.b)}</div>
                  {(() => {
                    const A = resolveEnd(w.a), B = resolveEnd(w.b);
                    const opts = (A && B ? feasibleWireIds(A, B) : []).filter((t2) => t2 !== w.type);
                    if (!opts.length) return null;
                    return (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 5 }}>Change cable (compatible only):</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {opts.map((t2) => (
                            <button key={t2} onClick={() => setWireTypeOf(w.id, t2)}
                              style={{ ...S.wireChip, outline: "1px solid " + C.line }}>
                              <WireSwatch type={t2} />
                              <span style={{ fontSize: 11, textAlign: "left" }}>{wireById[t2].name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                  <input className="wireInput" style={{ ...S.wireInput, width: "100%", boxSizing: "border-box" }}
                    placeholder="Signal / wire label" value={w.label}
                    onChange={(e) => setWireLabel(w.id, e.target.value)} />
                  <div style={S.inspBtns}>
                    <button style={{ ...S.btnMini, color: C.brand, border: "1px solid #F3C7C9" }} onClick={() => deleteWire(w.id)}>Delete wire</button>
                  </div>
                </div>
              );
            })() : selD ? (
              <div>
                <div style={S.inspHead}>
                  <span style={{ ...S.inspTag, background: FN[selD.fn].c }} />
                  <div>
                    <div style={S.inspId}>{resolveId(selD, selLoc?.inst || selFree)}</div>
                    <div style={S.inspName}>{(BRANDS[selD.brand]?.name || "")} · {selD.name}</div>
                  </div>
                </div>
                {selD.etg && (
                  <div style={S.etgNote}>
                    <b>ETG directory entry — {selD.etg}.</b> {selD.family
                      ? "This is a product family, not an orderable part number — pick the exact model from the vendor."
                      : "Part number as listed in the directory."}
                    {" "}Size, channel count and pinout are representative defaults, not the vendor's data sheet.
                    {selD.etgCert ? " Listed as ETG-certified." : " Not listed as ETG-certified."}
                  </div>
                )}
                {selD.desc && <div style={S.inspDesc}>{selD.desc}</div>}
                <div style={S.inspMeta}>
                  <span>{FN[selD.fn].label}</span>
                  <span>{selD.free ? "free-placed — drag to move" : `${selD.ebus > 0 ? `+${selD.ebus}` : selD.ebus} mA E-bus`}</span>
                </div>
                {selD.variants && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 5 }}>Variant:</div>
                    <select className="wireInput" style={{ ...S.wireInput, width: "100%", boxSizing: "border-box" }}
                      value={(selLoc?.inst || selFree)?.variant || selD.variants[0].s}
                      onChange={(e) => setVariant(selected, e.target.value)}>
                      {selD.variants.map((v) => (
                        <option key={v.s} value={v.s}>-{v.s} — {v.d}</option>
                      ))}
                    </select>
                  </div>
                )}
                {selLoc && selD.idSwitch && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>Station ID switch</span>
                    <input type="number" min="0" max="4095" value={selLoc.inst.idNum ?? 1}
                      onChange={(e) => setIdNum(selected, +e.target.value)}
                      className="wireInput" style={{ ...S.wireInput, width: 76 }} />
                  </div>
                )}
                {selLoc && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>Gap before</span>
                    <input type="number" min="0" max="200" step="2" value={selLoc.inst.gap ?? 0}
                      onChange={(e) => setGap(selected, +e.target.value)}
                      className="wireInput" style={{ ...S.wireInput, width: 72 }} />
                    <span style={{ fontSize: 11, color: C.muted }}>mm — separates a new group on this rail</span>
                  </div>
                )}
                {selFree && SENSOR_KINDS.has(selD.kind) && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 5 }}>Connection style (affects auto-cable):</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {[["m12", "M12 connector"], ["braid", "Braided pigtail"]].map(([v, lb]) => (
                        <button key={v}
                          style={{ ...S.btnMini, ...((selFree.cbl || "m12") === v ? { background: C.ink, color: "#fff", border: `1px solid ${C.ink}` } : null) }}
                          onClick={() => update((dd) => ({ ...dd, free: (dd.free || []).map((f) => (f.uid === selected ? { ...f, cbl: v } : f)) }))}>
                          {lb}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div style={S.inspBtns}>
                  {selLoc && <button style={S.btnMini} onClick={() => move(selected, -1)}>◀ Move</button>}
                  {selLoc && <button style={S.btnMini} onClick={() => move(selected, +1)}>Move ▶</button>}
                  <button style={S.btnMini} onClick={() => duplicate(selected)}>⧉ Dup</button>
                  <button style={{ ...S.btnMini, color: C.brand, border: "1px solid #F3C7C9" }} onClick={() => remove(selected)}>Remove</button>
                </div>
                <div style={S.inspBtns}>
                  {selLoc && <button style={S.btnMini} onClick={() => setDetail(selected)}>🔍 Detail view</button>}
                  <a href={selD.url
                      ? selD.url
                      : selD.brand === "beckhoff"
                        ? `https://www.beckhoff.com/en-us/search-results/?q=${encodeURIComponent(selD.id)}`
                        : `https://duckduckgo.com/?q=${encodeURIComponent((BRANDS[selD.brand]?.name || "") + " " + selD.id)}`}
                    target="_blank" rel="noreferrer"
                    style={{ ...S.btnMini, textDecoration: "none", textAlign: "center", lineHeight: 1.4 }}>
                    {selD.url ? "ethercat.org ↗" : selD.brand === "beckhoff" ? "beckhoff.com ↗" : "web ↗"}
                  </a>
                </div>
                {selLoc && rails.length > 1 && (
                  <div style={{ marginTop: 8 }}>
                    <select style={{ ...S.railSelect, width: "100%" }} value={selLoc.ri}
                      onChange={(e) => moveToRail(selected, +e.target.value)}>
                      {rails.map((_, i) => <option key={i} value={i}>On Rail {i + 1}</option>)}
                    </select>
                  </div>
                )}
              </div>
            ) : (
              <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>
                Select a terminal or a wire. Toggle the <b>Wire tool</b> and click two clamp points to run a wire — across rails too.
              </p>
            )}
          </section>

          <section style={S.card}>
            <div style={S.cardHead}>Wire list</div>
            {wires.length === 0 ? <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>No wires yet.</p> : (
              <div className="scroll" style={{ maxHeight: 150, overflowY: "auto", display: "flex", flexDirection: "column", gap: 5 }}>
                {wires.map((w) => (
                  <button key={w.id} onClick={() => { setSelWire(w.id); setSelected(null); setShowWires(true); }}
                    style={{ ...S.wireRowBtn, outline: selWire === w.id ? `2px solid ${C.ink}` : "1px solid " + C.line }}>
                    <WireSwatch type={w.type} />
                    <span style={{ fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {w.label || `${ptName(w.a)} → ${ptName(w.b)}`}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section style={S.card}>
            <div style={S.cardHead}>Bill of materials<button style={S.copyBtn} onClick={copyBom}>{copied ? "Copied" : "Copy"}</button></div>
            {!bom ? <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>Nothing yet.</p>
              : <textarea className="scroll" readOnly style={S.bomBox} value={bom} />}
          </section>
        </aside>
      </div>

      {diagOpen && <DiagramModal rails={rails} free={free} wires={wires} layout={layout} onClose={() => setDiagOpen(false)} />}
      {topoOpen && <TopologyModal rails={rails} free={free} onClose={() => setTopoOpen(false)} />}
      {projOpen && (
        <ProjectsModal library={library} current={projName} doc={doc}
          onSave={libSave} onOpen={libOpen} onDelete={libDelete} onRename={libRename}
          onClose={() => setProjOpen(false)} />
      )}

      {/* zoomed terminal detail view (double-click a terminal or 🔍 Detail) */}
      {detailD && detailLoc && (() => {
        const d = detailD;
        const inst = detailLoc.inst;
        const geom = pointGeom(d);
        const fakeLayout = { pos: { [inst.uid]: { x: 0, y: 0, d, geom, ri: 0 } } };
        const scale = 1.8;
        return (
          <div style={S.modalWrap} onClick={() => setDetail(null)}>
            <div style={S.modal} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div>
                  <span style={{ ...S.inspId, fontSize: 17 }}>{d.id}</span>
                  <span style={{ color: C.muted, fontSize: 13, marginLeft: 10 }}>{d.name}</span>
                </div>
                <button style={S.btnGhost} onClick={() => setDetail(null)}>✕ Close</button>
              </div>
              <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
                <svg width={geom.W * scale + 24} height={TH * scale + 64} style={{ flex: "0 0 auto" }}>
                  <g transform={`translate(12, 52) scale(${scale})`}>
                    <TerminalG inst={inst} layout={fakeLayout} selected={false} wireMode={false}
                      pending={null} wiredPts={new Set()}
                      onSelect={() => {}} onPointDown={() => {}} onPointUp={() => {}} onHover={() => {}} onLeave={() => {}} />
                  </g>
                </svg>
                <div style={{ minWidth: 260, maxWidth: 380 }}>
                  {d.desc && <p style={{ fontSize: 13, marginTop: 0 }}>{d.desc}</p>}
                  <div style={S.inspMeta}>
                    <span>{FN[d.fn].label}</span>
                    <span>{d.w} mm · {d.ebus > 0 ? `+${d.ebus}` : d.ebus} mA E-bus</span>
                  </div>
                  {geom.pts.length > 0 && (
                    <table style={{ borderCollapse: "collapse", width: "100%", marginTop: 12, fontSize: 12 }}>
                      <thead>
                        <tr style={{ textAlign: "left", color: C.muted }}>
                          <th style={S.tCell}>Pt</th><th style={S.tCell}>Assignment{d.pinout ? " (verified)" : " (approx.)"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {geom.pts.map((p, i) => (
                          <tr key={i}>
                            <td style={{ ...S.tCell, fontFamily: "ui-monospace,monospace", fontWeight: 700 }}>{p.label}</td>
                            <td style={S.tCell}>{pointRole(d, p)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <a href={`https://www.beckhoff.com/en-us/search-results/?q=${encodeURIComponent(d.id)}`}
                    target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 12, fontSize: 12.5, color: C.brand }}>
                    Look up {d.id} on beckhoff.com ↗
                  </a>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// wire endpoint glyph — shows the connector type (RJ45/SC/VL plug, M8/M12 screw)
function WireEnd({ x, y, t }) {
  if (t.conn === "rj45" || t.conn === "sc" || t.conn === "vl" || t.conn === "plug") {
    return <rect x={x - 4} y={y - 3} width="8" height="6" rx="1" fill="#2B2F33" stroke="#C9CDD2" strokeWidth="0.8" />;
  }
  if (t.conn === "m8") {
    return (
      <g>
        <circle cx={x} cy={y} r="3.4" fill="#9BA0A6" stroke="#54585C" strokeWidth="1" />
        <circle cx={x} cy={y} r="1.2" fill="#26282B" />
      </g>
    );
  }
  if (t.conn === "m12") {
    return (
      <g>
        <circle cx={x} cy={y} r="4.4" fill="#9BA0A6" stroke="#54585C" strokeWidth="1.2" />
        <circle cx={x} cy={y} r="1.6" fill="#26282B" />
      </g>
    );
  }
  return <circle cx={x} cy={y} r="2.2" fill="#C9CDD2" stroke="#7B8187" strokeWidth="0.6" />;
}

function WireSwatch({ type, big }) {
  const t = wireById[type];
  const w = big ? 34 : 24, h = big ? 10 : 8;
  return (
    <svg width={w} height={h} style={{ flex: "0 0 auto" }}>
      {t.shield && <rect x="0" y="0" width={w} height={h} rx={h / 2} fill="#5F656C" />}
      <rect x={t.shield ? 1 : 0} y={t.shield ? 1 : 0} width={w - (t.shield ? 2 : 0)} height={h - (t.shield ? 2 : 0)} rx={h / 2} fill={t.stroke} />
      {t.gnye && <rect x="2" y={h / 2 - 1} width={w - 4} height="2" fill="#F2D703" />}
    </svg>
  );
}

/* ================= REALISTIC FACE PRIMITIVES ================= */

// stacked-square spring clamp unit (release sq + entry sq + wire hole)
function ClampUnit({ x, y, size = 7.5, hl }) {
  const s = size, rel = s * 0.72;
  return (
    <g>
      {hl && <rect x={x - s} y={y - s * 2.3} width={s * 2} height={s * 3.6} rx="2" fill="none" stroke="#D71920" strokeWidth="1.4" strokeDasharray="3 2" />}
      <rect x={x - rel / 2} y={y - s / 2 - rel - 2.4} width={rel} height={rel} rx="1" fill={M.sq} stroke={M.sqRim} strokeWidth="0.5" />
      <rect x={x - s / 2 - 0.8} y={y - s / 2 - 0.8} width={s + 1.6} height={s + 1.6} rx="1.4" fill={M.sqRim} />
      <rect x={x - s / 2} y={y - s / 2} width={s} height={s} rx="1" fill={M.sq} />
      <ellipse cx={x} cy={y + s / 2 + 3.4} rx={s * 0.34} ry={s * 0.26} fill={M.oval} />
    </g>
  );
}

// colored designation tab (24V / 0V / + / − / ⏚)
function Tab({ x, y, w = 15, h = 9.5, color, text }) {
  const fill = color === "red" ? M.red : color === "blue" ? M.blue : color === "kh" ? M.kh : color === "gy" ? "#8A9096" : M.org;
  return (
    <g>
      <rect x={x - w / 2} y={y} width={w} height={h} rx="1.2" fill={fill} stroke="rgba(0,0,0,0.25)" strokeWidth="0.5" />
      <rect x={x - w / 2 + 0.8} y={y + 0.8} width={w - 1.6} height="1.4" rx="0.7" fill="rgba(255,255,255,0.28)" />
      <text x={x} y={y + h / 2 + 2.1} fill="#fff" fontSize="5.4" fontWeight="700" fontFamily="system-ui" textAnchor="middle">{text}</text>
    </g>
  );
}

// recessed LED window with rectangular LEDs
function LedWindow({ x, y, w, h, states }) {
  const rows = Math.ceil(states.length / 2);
  const px = [x + w * 0.30, x + w * 0.70];
  const pitch = rows ? (h - 10) / rows : 0;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="2" fill={M.winFrame} stroke={M.winEdge} strokeWidth="0.7" />
      <rect x={x + 2.5} y={y + 2.5} width={w - 5} height={h - 5} rx="1.5" fill={M.win} />
      {states.map((on, i) => {
        const col = i % 2, row = Math.floor(i / 2);
        const lx = px[col], ly = y + 6 + pitch * row + pitch / 2 - 2;
        return (
          <g key={i}>
            <rect x={lx - 3.4} y={ly - 1.8} width="6.8" height="3.6" rx="0.8" fill={on ? M.ledOn : M.ledOff} />
            {on && <rect x={lx - 3.4} y={ly - 1.8} width="6.8" height="3.6" rx="0.8" fill={M.ledOn} opacity="0.5" filter="blur(2px)" />}
          </g>
        );
      })}
    </g>
  );
}

// two orange marking labels at the terminal top
function OrangeLabels({ cx1, cx2, y = 6 }) {
  return (
    <g>
      {[cx1, cx2].map((cx, i) => (
        <g key={i}>
          <rect x={cx - 7.5} y={y} width="15" height="9" rx="1.2" fill={M.org} stroke={M.orgDk} strokeWidth="0.6" />
          <rect x={cx - 6} y={y + 1.5} width="12" height="6" rx="0.8" fill="rgba(255,255,255,0.22)" />
        </g>
      ))}
    </g>
  );
}

function Rj45({ cx, y, tag, ledL = true, ledR = true }) {
  const w = 34, h = 27;
  return (
    <g>
      <rect x={cx - w / 2 - 2.5} y={y - 2.5} width={w + 5} height={h + 5} rx="2.5" fill={M.rjBez} stroke="rgba(0,0,0,0.3)" strokeWidth="0.7" />
      <rect x={cx - w / 2} y={y} width={w} height={h} rx="1.5" fill="#B9BBBD" stroke="rgba(0,0,0,0.35)" strokeWidth="0.6" />
      <rect x={cx - w / 2 + 3} y={y + 3} width={w - 6} height={h * 0.55} rx="1" fill={M.rjPort} />
      {Array.from({ length: 8 }).map((_, i) => (
        <rect key={i} x={cx - w / 2 + 4.8 + i * ((w - 9.6) / 8)} y={y + 4} width="1.4" height={h * 0.3} fill={M.pin} />
      ))}
      <rect x={cx - 4} y={y + h * 0.58 + 1.5} width="8" height={h * 0.3} fill={M.rjPort} />
      {ledL && <rect x={cx - w / 2 + 1} y={y + h - 5} width="4.5" height="3.5" rx="0.8" fill={M.ledYel} />}
      {ledR && <rect x={cx + w / 2 - 5.5} y={y + h - 5} width="4.5" height="3.5" rx="0.8" fill={M.ledOn} />}
      {tag && <text x={cx} y={y + h + 8} fill={M.txtDim} fontSize="5" fontFamily="system-ui" textAnchor="middle">{tag}</text>}
    </g>
  );
}

// vertical EtherCAT logo mark
function EtherCatMark({ x, y }) {
  return (
    <g transform={`rotate(-90 ${x} ${y})`}>
      <text x={x} y={y} fontSize="7.5" fontFamily="system-ui" fill={M.txt}>
        Ether<tspan fontWeight="800">CAT.</tspan>
      </text>
      <path d={`M ${x - 12} ${y - 6} l 5 -4 l -2 4 l 5 -1 l -8 6 l 2.5 -4.5 z`} fill={C.brand} />
    </g>
  );
}

// circled point numbers printed on housing
function NumberKey({ x, y }) {
  const pairs = [["1", "5"], ["2", "6"], ["3", "7"], ["4", "8"]];
  return (
    <g>
      {pairs.map(([a, b], i) => (
        <g key={i}>
          <circle cx={x} cy={y + i * 13} r="4" fill="none" stroke={M.txtDim} strokeWidth="0.7" />
          <text x={x} y={y + i * 13 + 2} fill={M.txtDim} fontSize="4.8" textAnchor="middle" fontFamily="system-ui">{a}</text>
          <circle cx={x + 13} cy={y + i * 13} r="4" fill="none" stroke={M.txtDim} strokeWidth="0.7" />
          <text x={x + 13} y={y + i * 13 + 2} fill={M.txtDim} fontSize="4.8" textAnchor="middle" fontFamily="system-ui">{b}</text>
        </g>
      ))}
    </g>
  );
}

function VerticalBrand({ x, yBottom, id }) {
  return (
    <g>
      <text x={x} y={yBottom} fill={C.brand} fontSize="8.5" fontWeight="800" fontFamily="system-ui"
        transform={`rotate(-90 ${x} ${yBottom})`} style={{ letterSpacing: "0.5px" }}>BECKHOFF</text>
      <text x={x + 11} y={yBottom} fill={M.txt} fontSize="7.5" fontWeight="700" fontFamily="ui-monospace,monospace"
        transform={`rotate(-90 ${x + 11} ${yBottom})`}>{id}</text>
    </g>
  );
}

/* ================= TERMINAL RENDERER ================= */
/* --- backplane buses: the E-bus (EtherCAT comms + FSoE black channel) runs
 * above the terminals; the power contacts (Up) run as potential groups near
 * the rail. Both are made by clipping terminals together — no drawn cable —
 * so we visualize them as bars in the clear lanes above and below. --------- */
// backplane geometry for one station segment (already end-cover-bounded and
// known to have a coupler/CX head). Returns the E-bus span, the FSoE sub-span
// and the power-contact potential groups.
function segBackplane(seg, fsoeActive) {
  const eb = seg.filter((x) => !x.d.psu);
  const ebus = eb.length
    ? { x0: eb[0].p.x, x1: eb[eb.length - 1].p.x + eb[eb.length - 1].p.geom.W }
    : null;
  const ts = seg.filter((x) => x.d.twinsafe);
  const fsoeSpan = fsoeActive && ts.length && ebus
    ? { x0: ebus.x0, x1: ts[ts.length - 1].p.x + ts[ts.length - 1].p.geom.W }
    : null;
  const groups = [];
  let g = null;
  const push = () => { if (g && g.r != null) { g.x1 = g.r; groups.push(g); } g = null; };
  for (const x of seg) {
    const d = x.d, L = x.p.x, R = x.p.x + x.p.geom.W;
    if (d.psu) continue;
    if (d.blank) { if (g) g.r = Math.max(g.r ?? L, R); continue; }
    if (d.coupler || d.cx) { push(); g = { x0: L, volt: "24", src: d.id, r: R }; continue; }
    if (d.pcFeed) { push(); g = { x0: L, volt: d.ac ? "230" : "24", src: d.id, r: R }; continue; }
    if (d.pcBreak) { push(); g = { x0: L, volt: null, src: d.id, r: R }; continue; }
    if (g) g.r = R;
  }
  push();
  return { ebus, fsoeSpan, groups };
}

function BackplaneLayer({ rail, y, layout, fsoeActive }) {
  const its = rail.items
    .map((inst) => ({ d: byId[inst.catId], p: layout.pos[inst.uid] }))
    .filter((x) => x.d && x.p);
  if (!its.length) return null;

  const busY = y - 8;      // E-bus lane, just above the terminals
  const pcY = y + 250;     // power-contact lane, just below the rail

  // A rail may hold several separate stations, each closed by an end cover
  // (EL9011/EL9012) and set apart by a gap. Split at each end cover and draw
  // buses per segment — only for segments that have a coupler/CX to source
  // them, so a device stranded past an end cover shows nothing.
  const segments = [];
  let cur = [];
  for (const x of its) { cur.push(x); if (x.d.endcap) { segments.push(cur); cur = []; } }
  if (cur.length) segments.push(cur);

  const pcColor = (v) => (v === "230" ? "#E8781E" : v === "24" ? "#2E9E5B" : "#9AA0A6");
  const pcText = (v) => (v === "230" ? "230 V" : v === "24" ? "24 V" : "no feed");

  return (
    <g pointerEvents="none">
      {segments.map((segAll, si) => {
        const seg = segAll.filter((x) => !x.d.endcap); // buses stop at the cover
        if (!seg.some((x) => x.d.coupler || x.d.cx)) return null; // no source → no bus
        const { ebus, fsoeSpan, groups } = segBackplane(seg, fsoeActive);
        return (
          <g key={si}>
            {ebus && <rect x={ebus.x0} y={busY} width={ebus.x1 - ebus.x0} height="5" rx="2.5" fill="#3E8E8E" opacity="0.85" />}
            {ebus && <text x={ebus.x0 + 3} y={busY - 3} fill="#2F7070" fontSize="7" fontWeight="700" style={{ letterSpacing: "0.5px" }}>E-BUS</text>}
            {fsoeSpan && (
              <>
                <rect x={fsoeSpan.x0} y={busY} width={fsoeSpan.x1 - fsoeSpan.x0} height="5" rx="2.5" fill="none" stroke="#F2C21E" strokeWidth="2" strokeDasharray="8 6">
                  <animate attributeName="opacity" values="1;0.2;1" dur="1.1s" repeatCount="indefinite" />
                </rect>
                <text x={fsoeSpan.x1 - 3} y={busY - 3} fill="#B8930A" fontSize="7" fontWeight="700" textAnchor="end">FSoE</text>
              </>
            )}
            {groups.length > 0 && ebus && (
              <text x={ebus.x0} y={pcY - 4} fill={C.muted} fontSize="7" fontWeight="700" style={{ letterSpacing: "0.5px" }}>POWER CONTACTS (Up)</text>
            )}
            {groups.map((gr, gi) => (
              <g key={gi}>
                <rect x={gr.x0} y={pcY} width={Math.max(gr.x1 - gr.x0, 2)} height="6" rx="3" fill={pcColor(gr.volt)} opacity="0.8" />
                <text x={gr.x0 + 3} y={pcY + 15} fill={pcColor(gr.volt)} fontSize="7.5" fontWeight="600">{pcText(gr.volt)} · {gr.src}</text>
              </g>
            ))}
          </g>
        );
      })}
    </g>
  );
}

function TerminalG({ inst, layout, selected, wireMode, pending, wiredPts, powered = true, dragging, onSelect, onDetail, onDragStart, onPointDown, onPointUp, onHover, onLeave }) {
  const t = layout.pos[inst.uid];
  if (!t) return null;
  const { d, geom } = t;
  const W = geom.W;
  const uid = inst.uid;
  const body = d.psu ? "url(#psbody)" : d.safety ? "url(#ybody)" : "url(#tbody)";

  return (
    <g transform={`translate(${t.x}, ${t.y + (selected ? -8 : 0)})`}
      opacity={dragging ? 0.45 : 1}
      onClick={(e) => { if (!wireMode) { e.stopPropagation(); onSelect(); } }}
      onDoubleClick={(e) => { if (!wireMode && onDetail) { e.stopPropagation(); onDetail(); } }}
      onPointerDown={(e) => { if (!wireMode && onDragStart) onDragStart(e); }}
      style={{ cursor: wireMode ? "crosshair" : "pointer" }}
      filter={selected ? "drop-shadow(0 10px 14px rgba(0,0,0,0.25))" : "drop-shadow(0 2px 4px rgba(0,0,0,0.16))"}>

      {/* ID switch badge above the rail */}
      {d.idSwitch && (
        <g>
          <rect x={W / 2 - 26} y={-24} width="52" height="17" rx="4" fill="#2B2F33" />
          <circle cx={W / 2 - 16} cy={-15.5} r="4.5" fill="#4A4F54" stroke="#1A1D20" strokeWidth="0.8" />
          <rect x={W / 2 - 17.6} y={-16.2} width="3.2" height="1.4" rx="0.7" fill="#C9CDD2" transform={`rotate(35 ${W / 2 - 16} ${-15.5})`} />
          <text x={W / 2 + 8} y={-11.5} fill="#fff" fontSize="8" fontWeight="700" fontFamily="ui-monospace,monospace" textAnchor="middle">
            {String(inst.idNum ?? 1).padStart(3, "0")}
          </text>
          <path d={`M ${W / 2} -7 l 4 5 h -8 z`} fill="#2B2F33" />
        </g>
      )}

      {/* housing */}
      <rect x="0.5" y="1.5" width={W - 1} height={TH - 3} rx="3" fill={body} stroke={selected ? C.ink : M.hEdge} strokeWidth={selected ? 1.6 : 0.9} />
      <rect x="2" y="3" width="1" height={TH - 8} fill={M.hi} />
      <rect x={W - 3} y="3" width="1" height={TH - 8} fill={M.groove} />
      {/* silver rail-latch nub near rail line */}
      <rect x="-1.2" y={190} width="3" height="12" rx="1.2" fill="#C9CDD2" stroke="rgba(0,0,0,0.25)" strokeWidth="0.5" />

      {d.coupler ? <CouplerFace d={d} W={W} uid={uid} /> :
        d.psu ? <PsuFace d={d} W={W} /> :
        d.cx ? <CxFace d={d} W={W} /> :
        d.endcap || d.blank ? <PlainFace d={d} W={W} /> :
        d.ext || d.junction || d.rj ? <RjTermFace d={d} W={W} /> :
        <ElFace d={d} W={W} uid={uid} geom={geom} wiredPts={wiredPts} powered={powered} />}

      {/* interactive clamp points + network ports */}
      {geom.pts.map((p, i) => {
        const isPending = pending && pending.uid === uid && pending.pt === i;
        const ptHandlers = {
          onPointerDown: (e) => { if (wireMode) { e.stopPropagation(); onPointDown(uid, i); } },
          onPointerUp: (e) => { if (wireMode) { e.stopPropagation(); onPointUp(uid, i); } },
          onMouseEnter: () => onHover(uid, i),
          onMouseLeave: onLeave,
        };
        if (p.port) {
          return (
            <g key={i} {...ptHandlers} style={{ cursor: wireMode ? "crosshair" : "help" }}>
              {isPending && <rect x={p.x - 21} y={p.y - 17} width="42" height="34" rx="3" fill="none" stroke="#D71920" strokeWidth="1.4" strokeDasharray="3 2" />}
              <rect x={p.x - 20} y={p.y - 16} width="40" height="32" fill="transparent">
                <title>{pointRole(d, p)}</title>
              </rect>
            </g>
          );
        }
        return (
          <g key={i} {...ptHandlers} style={{ cursor: wireMode ? "crosshair" : "help" }}>
            <ClampUnit x={p.x} y={p.y} size={p.size} hl={isPending} />
            <rect x={p.x - 9.5} y={p.y - p.size * 2.2 - 3} width="19" height={p.size * 3.6 + 6} fill="transparent">
              <title>{pointRole(d, p)}</title>
            </rect>
          </g>
        );
      })}

      {/* gold power contact blades on right edge */}
      {!d.endcap && !d.blank && !d.psu && [0, 1, 2].map((i) => (
        <rect key={i} x={W - 1.8} y={168 + i * 26} width="3.2" height="15" rx="1" fill={M.gold} stroke={M.goldDk} strokeWidth="0.5" />
      ))}
      {/* orange release latch on right edge */}
      {!d.endcap && !d.blank && !d.psu && (
        <rect x={W - 2.4} y={128} width="4.8" height="22" rx="2" fill={M.org} stroke={M.orgDk} strokeWidth="0.6" />
      )}
    </g>
  );
}

/* --- standard EL terminal face -------------------------------------- */
function ElFace({ d, W, uid, geom, wiredPts, powered = true }) {
  const b = geom.block || {};
  const cols = b.cols || [W * 0.30, W * 0.70];
  const isFeedLike = !!d.feed;
  // LEDs light only when the terminal actually receives power/E-bus; a dead
  // (stranded) terminal keeps its LED dots but shows them all off.
  const ledStates = [];
  if (d.io) for (let c = 0; c < d.ch; c++) ledStates.push(powered && wiredPts.has(`${uid}:${c}`));
  else if (d.feed) ledStates.push(powered, powered); // Us / Up
  else if (d.fn === "mot" || d.fn === "pos") ledStates.push(powered, false, false, false);
  else if (d.fn === "saf" && !d.io) ledStates.push(powered, false);

  return (
    <g>
      <OrangeLabels cx1={cols[0]} cx2={cols[1]} />
      <LedWindow x={W * 0.13} y={18} w={W * 0.74} h={d.hd ? 52 : 44} states={ledStates.slice(0, d.hd ? 16 : 8)} />
      {/* type print: vertical along center seam like the real housing */}
      <text x={W / 2} y={172} fill={M.txt} fontSize="5.8" fontWeight="700"
        fontFamily="ui-monospace,monospace" textAnchor="middle"
        transform={`rotate(-90 ${W / 2} 172)`} style={{ letterSpacing: "0.4px" }}>{d.id}</text>
      {d.safety && <text x={W / 2} y={TH - 14} fill={M.txt} fontSize="4.4" fontFamily="system-ui" textAnchor="middle">TwinSAFE</text>}

      {isFeedLike ? (
        // feed terminals: colored tab groups like the coupler power section
        feedGroupsFor(d).map((g, gi) => {
          const gTop = (geom.block?.gTop ?? 64) + gi * (geom.block?.gh ?? (TH - 24 - 64) / 4);
          return (
            <g key={gi}>
              <Tab x={cols[0]} y={gTop + 4} color={g.colors[0]} text={g.labels[0]} />
              <Tab x={cols[1]} y={gTop + 4} color={g.colors[1]} text={g.labels[1]} />
            </g>
          );
        })
      ) : d.dist ? (
        geom.pts.map((p, i) => (
          <Tab key={i} x={p.x} y={p.y - 28} color={d.dist === "24V" ? "red" : "blue"} text={d.dist} w={16} h={8.5} />
        ))
      ) : (
        // grey number tabs above each clamp pair, matching the coupler block look
        geom.pts.length > 0 && !d.hd && geom.pts.map((p, i) => (
          <g key={i}>
            <rect x={p.x - 6.5} y={p.y - 28} width="13" height="8.5" rx="1.2" fill="#C9CBCE" stroke="rgba(0,0,0,0.25)" strokeWidth="0.5" />
            <rect x={p.x - 5.5} y={p.y - 27.2} width="11" height="1.2" rx="0.6" fill="rgba(255,255,255,0.5)" />
            <text x={p.x} y={p.y - 21.6} fill={M.txt} fontSize="5.2" fontWeight="700" fontFamily="ui-monospace,monospace" textAnchor="middle">{p.label}</text>
          </g>
        ))
      )}
    </g>
  );
}

/* --- EK1100 / EK1101 / EK1501 coupler ------------------------------- */
function CouplerFace({ d, W, uid }) {
  const bx = W - 76;                       // terminal block left edge
  const cols = [bx + 22, bx + 54];
  const housingCx = bx * 0.42;
  return (
    <g>
      {/* housing details, left section */}
      <rect x={bx - 1} y="3" width="1.2" height={TH - 8} fill={M.groove} />
      <rect x={bx - 14} y="3" width="1" height={TH - 8} fill={M.groove} opacity="0.6" />
      {d.fiber ? (
        <g>
          <M8 cx={housingCx} cy={56} />
          <M8 cx={housingCx} cy={128} />
          <text x={housingCx} y={92} fill={M.txtDim} fontSize="5" textAnchor="middle" fontFamily="system-ui">POF</text>
        </g>
      ) : (
        <g>
          <Rj45 cx={housingCx} y={22} tag="X1 IN" />
          <Rj45 cx={housingCx} y={78} tag="X2 OUT" />
        </g>
      )}
      <EtherCatMark x={bx - 22} y={78} />
      <NumberKey x={bx - 34} y={150} />
      <VerticalBrand x={housingCx - 6} yBottom={TH - 14} id={d.id} />

      {/* terminal block section (right) */}
      <rect x={bx} y="2" width={W - bx - 1} height={TH - 4} fill="url(#tbody)" opacity="0.6" />
      <OrangeLabels cx1={cols[0]} cx2={cols[1]} />
      <LedWindow x={bx + 6} y={18} w={64} h={40} states={[true, true, true, false, true, false, false, false]} />
      {FEED_GROUPS.map((g, gi) => {
        const gTop = 64 + gi * ((TH - 24 - 64) / 4);
        return (
          <g key={gi}>
            <Tab x={cols[0]} y={gTop + 4} color={g.colors[0]} text={g.labels[0]} />
            <Tab x={cols[1]} y={gTop + 4} color={g.colors[1]} text={g.labels[1]} />
          </g>
        );
      })}
    </g>
  );
}

function M8({ cx, cy }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r="15" fill="#C9CBCD" stroke="rgba(0,0,0,0.3)" strokeWidth="0.8" />
      <circle cx={cx} cy={cy} r="11" fill="#AEB0B2" stroke="rgba(0,0,0,0.25)" strokeWidth="0.6" />
      <circle cx={cx} cy={cy} r="7" fill="#2E7D32" />
      {[[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]].map(([dx, dy], i) => (
        <circle key={i} cx={cx + dx} cy={cy + dy} r="1" fill="#101113" />
      ))}
    </g>
  );
}

/* --- PS-series power supply ------------------------------------------ */
function PsuFace({ d, W }) {
  const oc = [W * 0.32, W * 0.68];
  return (
    <g>
      <text x="10" y="24" fill={C.brand} fontSize="8.5" fontWeight="800" fontFamily="system-ui" style={{ letterSpacing: "0.4px" }}>BECKHOFF</text>
      <text x="10" y="35" fill={M.txt} fontSize="6.6" fontWeight="700" fontFamily="ui-monospace,monospace">{d.id}</text>
      <text x="10" y="44" fill={M.txtDim} fontSize="4.8" fontFamily="system-ui">{d.out}</text>
      {/* DC OK LED */}
      <rect x={W - 34} y="18" width="24" height="12" rx="2" fill={M.winFrame} stroke={M.winEdge} strokeWidth="0.6" />
      <rect x={W - 31} y="21" width="7" height="4" rx="1" fill={M.ledOn} />
      <text x={W - 22} y="26" fill={M.txt} fontSize="4.2" fontFamily="system-ui">DC OK</text>
      {/* AC input tabs */}
      <text x="10" y="60" fill={M.txtDim} fontSize="4.6" fontFamily="system-ui">AC INPUT 100-240 V</text>
      {["L", "N", "\u23DA"].map((lb, i) => (
        <Tab key={lb + i} x={W * 0.25 + i * W * 0.25} y={50} color={lb === "\u23DA" ? "kh" : "gy"} text={lb} w={13} h={8.5} />
      ))}
      {/* vent slits */}
      {Array.from({ length: 9 }).map((_, i) => (
        <rect key={i} x={W * 0.18} y={104 + i * 7} width={W * 0.64} height="2.6" rx="1.3" fill="rgba(0,0,0,0.14)" />
      ))}
      {/* DC output tabs */}
      <text x="10" y="178" fill={M.txtDim} fontSize="4.6" fontFamily="system-ui">24 V DC OUTPUT</text>
      <Tab x={oc[0]} y={168 - 0} color="red" text="+" w={14} h={8.5} />
      <Tab x={oc[1]} y={168 - 0} color="red" text="+" w={14} h={8.5} />
      <Tab x={oc[0]} y={210} color="blue" text="\u2212" w={14} h={8.5} />
      <Tab x={oc[1]} y={210} color="blue" text="\u2212" w={14} h={8.5} />
    </g>
  );
}

/* --- CX7000 embedded PC --------------------------------------------- */
function CxFace({ d, W }) {
  return (
    <g>
      <text x="12" y="22" fill={C.brand} fontSize="9" fontWeight="800" fontFamily="system-ui" style={{ letterSpacing: "0.5px" }}>BECKHOFF</text>
      <text x="12" y="34" fill={M.txt} fontSize="8" fontWeight="700" fontFamily="ui-monospace,monospace">{d.id}</text>
      <LedWindow x={12} y={44} w={40} h={34} states={[true, true, false, false]} />
      <text x={14} y={88} fill={M.txtDim} fontSize="4.6" fontFamily="system-ui">PWR · TC · ERR</text>
      <Rj45 cx={32} y={100} tag="X001 ETH" />
      <rect x="14" y="150" width="36" height="12" rx="2" fill={M.rjPort} />
      <text x="32" y="171" fill={M.txtDim} fontSize="4.6" textAnchor="middle" fontFamily="system-ui">USB</text>
      <rect x={W - 44} y="18" width="1" height={TH - 40} fill={M.groove} />
      <text x={W - 26} y={TH - 60} fill={M.txtDim} fontSize="4.6" textAnchor="middle" fontFamily="system-ui">24V DC</text>
    </g>
  );
}

/* --- comm terminals with RJ45, extensions, junctions ----------------- */
function RjTermFace({ d, W }) {
  const n = portCount(d);
  const pitch = n > 2 ? 50 : 66;
  return (
    <g>
      <OrangeLabels cx1={W * 0.32} cx2={W * 0.68} />
      <LedWindow x={W * 0.13} y={18} w={W * 0.74} h={36} states={[true, false, true, false]} />
      <text x={W / 2} y={64} fill={M.txt} fontSize="5.6" fontWeight="700" fontFamily="ui-monospace,monospace" textAnchor="middle">{d.id}</text>
      {d.fiber ? (
        <g>
          <M8 cx={W / 2} cy={100} />
          <text x={W / 2} y={126} fill={M.txtDim} fontSize="5" textAnchor="middle" fontFamily="system-ui">{d.id.startsWith("EK156") ? "POF" : "FO"}</text>
        </g>
      ) : (
        Array.from({ length: n }).map((_, i) => (
          <Rj45 key={i} cx={W / 2} y={78 + i * pitch} tag={n > 1 ? `X${i + 1}` : d.ext ? "OUT" : "X1"} />
        ))
      )}
    </g>
  );
}

function PlainFace({ d, W }) {
  return (
    <g>
      <text x={W / 2} y={150} fill={M.txtDim} fontSize="7" fontWeight="700" fontFamily="ui-monospace,monospace"
        textAnchor="middle" transform={`rotate(-90 ${W / 2} 150)`}>{d.id}</text>
    </g>
  );
}

/* ---- electrical connection diagram ---------------------------------- *
 * Modal shows the device-to-device overview using the SAME component
 * drawings as the canvas (one lane per device pair, no overlapping
 * runs). "Export PDF" produces page 1 = this overview and page 2+ =
 * the cable schedule (one row per cable, W# tags, color swatches).
 * --------------------------------------------------------------------- */
const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const EMPTY_SET = new Set();
const noop = () => {};
// connection-point ring color by electrical role (clarity)
const ROLE_COLOR = {
  p24: "#C4262E", gnd: "#23262A", pe: "#1E8A3C", ac: "#8A5A2B",
  di: "#F2B705", do: "#E8503A", ai: "#25A37A", ao: "#2F80ED", agnd: "#7FA8B8",
};

/* --- in-browser project library: named saves in localStorage, so a design
 * survives a reload without juggling JSON files. Files remain the way to move
 * a design between machines / browsers. ------------------------------------ */
function ProjectsModal({ library, current, doc, onSave, onOpen, onDelete, onRename, onClose }) {
  const [name, setName] = useState(current);
  const [confirmDel, setConfirmDel] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [renameTo, setRenameTo] = useState("");

  const rows = Object.values(library).sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || ""));
  const count = (d) => d.rails.reduce((n, r) => n + r.items.length, 0) + (d.free?.length || 0);
  const when = (s) => { const t = new Date(s); return isNaN(t) ? "—" : t.toLocaleString(); };
  const clash = rows.find((r) => r.name.toLowerCase() === cleanName(name).toLowerCase());

  return (
    <div style={S.modalWrap} onClick={onClose}>
      <div style={{ ...S.modal, width: 620, maxWidth: "94vw" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ ...S.inspId, fontSize: 16 }}>Projects</span>
          <button style={S.btnGhost} onClick={onClose}>✕ Close</button>
        </div>
        <p style={{ color: C.muted, fontSize: 12, margin: "0 0 12px" }}>
          Saved in this browser on this machine — clearing site data removes them. Use <b>Save file</b> in the header
          for a JSON copy you can back up, email, or open on another machine.
        </p>

        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
          <input style={{ ...S.wireInput, flex: 1 }} value={name} placeholder="Project name"
            onChange={(e) => setName(e.target.value.slice(0, 60))} />
          <button style={{ ...S.btnGhost, ...S.btnOn }} onClick={() => { onSave(name, clash?.id); onClose(); }}>
            {clash ? "Overwrite" : "Save current"}
          </button>
        </div>
        <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 14 }}>
          {clash ? `“${clash.name}” already exists — saving replaces it.` : `Saves ${count(doc)} device(s) and ${doc.wires.length} wire(s).`}
        </div>

        {rows.length === 0 ? (
          <p style={{ color: C.muted, fontSize: 13 }}>Nothing saved yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={S.tCell}>
                    {renaming === r.id ? (
                      <input style={{ ...S.wireInput, width: "100%" }} value={renameTo} autoFocus
                        onChange={(e) => setRenameTo(e.target.value.slice(0, 60))}
                        onKeyDown={(e) => { if (e.key === "Enter") { onRename(r.id, renameTo); setRenaming(null); } if (e.key === "Escape") setRenaming(null); }} />
                    ) : (
                      <>
                        <div style={{ fontWeight: 600 }}>{r.name}</div>
                        <div style={{ color: C.muted, fontSize: 11 }}>
                          {when(r.savedAt)} · {count(r.doc)} device(s) · {r.doc.wires.length} wire(s)
                        </div>
                      </>
                    )}
                  </td>
                  <td style={{ ...S.tCell, textAlign: "right", whiteSpace: "nowrap" }}>
                    {renaming === r.id ? (
                      <>
                        <button style={S.btnMini} onClick={() => { onRename(r.id, renameTo); setRenaming(null); }}>Save name</button>{" "}
                        <button style={S.btnMini} onClick={() => setRenaming(null)}>Cancel</button>
                      </>
                    ) : confirmDel === r.id ? (
                      <>
                        <span style={{ color: C.muted, fontSize: 11.5, marginRight: 6 }}>Delete?</span>
                        <button style={{ ...S.btnMini, color: C.brand }} onClick={() => { onDelete(r.id); setConfirmDel(null); }}>Yes</button>{" "}
                        <button style={S.btnMini} onClick={() => setConfirmDel(null)}>No</button>
                      </>
                    ) : (
                      <>
                        <button style={S.btnMini} onClick={() => onOpen(r.id)}>Open</button>{" "}
                        <button style={S.btnMini} onClick={() => { onSave(r.name, r.id); onClose(); }} title="Replace this save with the current design">Update</button>{" "}
                        <button style={S.btnMini} onClick={() => { setRenaming(r.id); setRenameTo(r.name); }}>Rename</button>{" "}
                        <button style={S.btnMini} onClick={() => setConfirmDel(r.id)}>Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* --- EtherCAT topology view: the logical slave order (master → coupler →
 * terminals over the E-bus → extension → next station). Each coupler-headed
 * segment on a rail is a station row; field devices attach via cabling. ----- */
function TopologyModal({ rails, free, onClose }) {
  const tref = useRef(null);

  // The E-bus is a physical contact chain: it starts at a coupler / embedded PC
  // and is broken by an end cover, by a gap on the rail, by the next coupler,
  // and by anything with no E-bus contacts (a PSU brick). Devices outside a
  // coupler-headed run sit on the rail but are NOT on the network — they are
  // listed apart rather than drawn into the chain.
  const { stations, strays } = useMemo(() => {
    const out = [], stray = [];
    const railCount = {};
    rails.forEach((rail, ri) => {
      let seg = [], head = false;
      const flush = () => {
        if (head && seg.length) { railCount[ri] = (railCount[ri] || 0) + 1; out.push({ items: seg, ri, part: railCount[ri] }); }
        else seg.forEach((x) => stray.push({ ...x, ri, why: "no coupler ahead of it" }));
        seg = []; head = false;
      };
      for (const inst of rail.items) {
        const d = byId[inst.catId]; if (!d) continue;
        if (inst.gap > 0) flush();            // gapped away — the contacts do not touch
        if (d.endcap) { flush(); continue; }  // the cover terminates the station
        if (d.psu) {                          // mains PSU: sits on the rail, no E-bus
          flush();
          stray.push({ d, uid: inst.uid, ri, why: "no E-bus contacts" });
          continue;
        }
        if (d.coupler || d.cx) { flush(); head = true; } // a coupler heads its own station
        seg.push({ d, uid: inst.uid });
      }
      flush();
    });
    out.forEach((s) => { s.multi = railCount[s.ri] > 1; });
    return { stations: out, strays: stray };
  }, [rails]);

  const ecFree = useMemo(() => (free || [])
    .map((f) => ({ f, d: byId[f.catId] }))
    .filter((x) => x.d && ["epbox", "iol", "iolhub", "drive", "linaxis"].includes(x.d.kind)), [free]);

  // TwinCAT's online topology draws one box per slave top-down: the frame enters
  // a station at the coupler, runs the E-bus terminals in order, leaves over
  // RJ45 to the next station. Branch ports (junctions) drop to a second column.
  const NW = 190, NH = 40, VGAP = 22, X0 = 34, TOPY = 22;
  const MASTER_W = 214, MASTER_H = 46, PORTX = 24, COLGAP = 78, LABEL_H = 20, SGAP = 50;

  // --- lay out the trunk: master → station → station, one node per slave ---
  const nodes = [], bands = [];
  let y = TOPY + MASTER_H + 40 + LABEL_H, slaveNo = 0;
  stations.forEach((st, si) => {
    const y0 = y;
    st.items.forEach((it) => {
      nodes.push({ ...it, x: X0, y, no: ++slaveNo, si, first: !nodes.length || nodes[nodes.length - 1].si !== si });
      y += NH + VGAP;
    });
    bands.push({ si, ri: st.ri, part: st.part, multi: st.multi, y0, y1: y - VGAP, n: si + 1 });
    y += SGAP - VGAP;
  });
  const trunkBottom = nodes.length ? nodes[nodes.length - 1].y + NH : TOPY + MASTER_H;

  // links between consecutive slaves: inside a station it is the E-bus, across
  // stations it is a real Ethernet hop out of the extension / coupler port
  const links = nodes.map((n, k) => {
    const prev = k ? nodes[k - 1] : null;
    return { k, from: prev, to: n, type: !prev ? "master" : prev.si === n.si ? "ebus" : "rj45" };
  });

  // field devices hang off the last junction if there is one, else off the master
  const anchor = [...nodes].reverse().find((n) => n.d.junction) || null;
  const bx = X0 + NW + COLGAP;
  const branchY0 = anchor ? anchor.y : TOPY + MASTER_H + 40 + LABEL_H;
  const freeNodes = ecFree.map((x, k) => ({ ...x, x: bx, y: branchY0 + k * (NH + VGAP) }));
  const branchBottom = freeNodes.length ? freeNodes[freeNodes.length - 1].y + NH : 0;

  // on the rail but off the network — drawn unlinked so nothing implies a bus
  const strayY0 = (nodes.length ? trunkBottom + SGAP : TOPY + MASTER_H + 40) + LABEL_H;
  const strayNodes = strays.map((s, k) => ({ ...s, x: X0, y: strayY0 + k * (NH + 12) }));
  const strayBottom = strayNodes.length ? strayNodes[strayNodes.length - 1].y + NH : 0;

  const width = Math.max(700, X0 * 2 + NW + (freeNodes.length ? COLGAP + NW : 0));
  const height = Math.max(trunkBottom, branchBottom, strayBottom) + 46;

  const color = (d) => FN[d.fn]?.c || "#7A828A";
  const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
  const masterCx = X0 + MASTER_W / 2, masterBot = TOPY + MASTER_H, masterPortX = X0 + PORTX;
  const inP = (n) => [n.x + PORTX, n.y], outP = (n) => [n.x + PORTX, n.y + NH];
  const L = { ebus: "#5B93C7", rj45: "#1F9D4D", master: "#1F9D4D", drop: "#1F9D4D" };

  // small square straddling the box edge, like the port stubs in the TwinCAT view
  const Port = ({ px, py, label, side }) => (
    <g>
      <rect x={px - 3.5} y={py - 3.5} width="7" height="7" rx="1" fill="#fff" stroke="#6E7781" strokeWidth="1" />
      {label && (
        <text x={side === "right" ? px + 7 : px - 7} y={py + 3} fontSize="7.5" fontWeight="700"
          textAnchor={side === "right" ? "start" : "end"} fill={C.muted}>{label}</text>
      )}
    </g>
  );

  const Node = ({ n, term, chain, off }) => {
    const d = n.d, c = off ? "#A8B0B8" : color(d);
    // port letters only where the device really has RJ45 sockets (A in / B out)
    const rj = d.coupler || d.cx || d.ext || d.junction;
    const sub = off
      ? `Rail ${n.ri + 1} · ${n.why}`
      : [FN[d.fn]?.label, d.ch ? `${d.ch} ch` : null, d.ebus ? `${d.ebus > 0 ? "+" : ""}${d.ebus} mA` : null]
        .filter(Boolean).join("  ·  ");
    return (
      <g>
        {!off && <rect x={n.x + 1.5} y={n.y + 2.5} width={NW} height={NH} rx="4" fill="rgba(28,33,38,0.10)" />}
        <rect x={n.x} y={n.y} width={NW} height={NH} rx="4" fill={off ? "#F4F6F8" : "#fff"}
          stroke={off ? "#B6BEC6" : "#8E97A0"} strokeWidth="1" strokeDasharray={off ? "4 3" : ""} />
        <path d={`M ${n.x + 4} ${n.y} h -0.5 a 3.5 3.5 0 0 0 -3.5 3.5 v ${NH - 7} a 3.5 3.5 0 0 0 3.5 3.5 h 0.5 z`} fill={c} />
        <rect x={n.x + 4} y={n.y} width="2.5" height={NH} fill={c} />
        <text x={n.x + 14} y={n.y + 17} fontSize="10.5" fontWeight="700" fill={off ? C.muted : C.ink} fontFamily="ui-monospace,monospace">
          {clip(term ? `Term ${n.no} (${d.id})` : d.id, 26)}
        </text>
        <text x={n.x + 14} y={n.y + 30} fontSize="8" fill={C.muted}>{clip(sub, off ? 40 : 34)}</text>
        {chain && <Port px={inP(n)[0]} py={inP(n)[1]} label={rj ? "A" : ""} />}
        {chain && <Port px={outP(n)[0]} py={outP(n)[1]} label={rj ? "B" : ""} />}
        {chain && d.junction && <Port px={n.x + NW} py={n.y + NH / 2} label="C" side="right" />}
      </g>
    );
  };

  const exportPng = () => {
    const svg = tref.current; if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement("canvas");
      cv.width = width * 2; cv.height = height * 2;
      const ctx = cv.getContext("2d");
      ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.scale(2, 2); ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      cv.toBlob((b) => b && download("beckhoff-ethercat-topology.png", b));
    };
    img.src = url;
  };

  return (
    <div style={S.modalWrap} onClick={onClose}>
      <div style={{ ...S.modal, maxWidth: "94vw" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ ...S.inspId, fontSize: 16 }}>EtherCAT topology</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={S.btnGhost} onClick={exportPng}>Export PNG</button>
            <button style={S.btnGhost} onClick={onClose}>✕ Close</button>
          </div>
        </div>
        {nodes.length === 0 && freeNodes.length === 0 && strayNodes.length === 0 ? (
          <p style={{ color: C.muted, fontSize: 13 }}>No EtherCAT devices yet — add a coupler and some terminals.</p>
        ) : (
          <>
            <p style={{ color: C.muted, fontSize: 12, margin: "0 0 8px" }}>
              Logical slave order, as the TwinCAT online topology shows it — the frame runs master → coupler → terminals (over the E-bus) → extension → next station.
              <b> Term n</b> is the auto-increment position; ports <b>A</b> in / <b>B</b> out / <b>C</b> branch.
              A link is only drawn where the devices really touch: an end cover, a gap, a PSU or the next coupler breaks the E-bus, and stations are assumed to be cabled in the order shown.
            </p>
            <div className="scroll" style={{ overflow: "auto", maxHeight: "74vh" }}>
              <svg ref={tref} width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ background: "#FBFCFD", borderRadius: 8 }}>
                <defs>
                  <pattern id="topogrid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#E7EBEF" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect x="0" y="0" width={width} height={height} fill="url(#topogrid)" />

                {/* station frames, drawn behind everything */}
                {bands.map((b) => (
                  <g key={"B" + b.si}>
                    <rect x={X0 - 14} y={b.y0 - LABEL_H + 4} width={NW + 28} height={b.y1 - b.y0 + LABEL_H + 4}
                      rx="6" fill="#FFFFFF" stroke="#DCE2E8" strokeWidth="1" strokeDasharray="4 3" />
                    <text x={X0 - 6} y={b.y0 - 8} fontSize="9" fontWeight="700" fill={C.muted}>
                      Station {b.n} · Rail {b.ri + 1}{b.multi ? ` (part ${b.part})` : ""}
                    </text>
                  </g>
                ))}

                {/* master */}
                <rect x={X0} y={TOPY} width={MASTER_W} height={MASTER_H} rx="5" fill="#1C2A3A" />
                <text x={masterCx} y={TOPY + 20} fontSize="11" fontWeight="700" textAnchor="middle" fill="#fff">EtherCAT Master</text>
                <text x={masterCx} y={TOPY + 34} fontSize="8.5" textAnchor="middle" fill="#9FB0C2">TwinCAT on IPC / Embedded PC</text>
                <Port px={masterPortX} py={masterBot} />

                {/* the chain: E-bus inside a station, RJ45 hop between stations */}
                {links.map((l) => {
                  const [fx, fy] = l.from ? outP(l.from) : [masterPortX, masterBot];
                  const [tx, ty] = inP(l.to);
                  const ebus = l.type === "ebus";
                  return (
                    <g key={"L" + l.k}>
                      <line x1={fx} y1={fy} x2={tx} y2={ty} stroke={L[l.type]} strokeWidth={ebus ? 2 : 2.5} />
                      {!ebus && (
                        <text x={tx + 10} y={(fy + ty) / 2 + 3} fontSize="8" fill="#1F9D4D">
                          {l.type === "master" ? "Ethernet / EtherCAT" : "RJ45 to next station"}
                        </text>
                      )}
                    </g>
                  );
                })}

                {nodes.map((n) => <Node key={n.uid} n={n} term chain />)}

                {/* branch column: EtherCAT field devices dropped off a junction port */}
                {freeNodes.length > 0 && (
                  <text x={bx - 6} y={branchY0 - 8} fontSize="9" fontWeight="700" fill={C.muted}>
                    {anchor ? `Drop line off ${anchor.d.id} (port C)` : "EtherCAT field devices"}
                  </text>
                )}
                {freeNodes.map((n) => {
                  const [ax, ay] = anchor ? [anchor.x + NW, anchor.y + NH / 2] : [masterPortX, masterBot];
                  const midX = (ax + n.x) / 2, ly = n.y + NH / 2;
                  return (
                    <g key={n.f.uid}>
                      <path d={`M ${ax} ${ay} L ${midX} ${ay} L ${midX} ${ly} L ${n.x} ${ly}`}
                        fill="none" stroke={L.drop} strokeWidth="1.75" strokeDasharray={anchor ? "" : "5 4"} />
                      <Node n={n} />
                      <Port px={n.x} py={ly} label="A" />
                    </g>
                  );
                })}

                {/* on the rail, off the network — no links drawn to these */}
                {strayNodes.length > 0 && (
                  <>
                    <rect x={X0 - 14} y={strayY0 - LABEL_H + 4} width={NW + 28} height={strayBottom - strayY0 + LABEL_H + 4}
                      rx="6" fill="#FFFFFF" stroke="#E3C6C6" strokeWidth="1" strokeDasharray="4 3" />
                    <text x={X0 - 6} y={strayY0 - 8} fontSize="9" fontWeight="700" fill={C.brand}>
                      Not on the E-bus — no connection to the network
                    </text>
                    {strayNodes.map((n) => <Node key={n.uid} n={n} off />)}
                  </>
                )}

                {/* legend */}
                <g>
                  <line x1={X0} y1={height - 16} x2={X0 + 22} y2={height - 16} stroke={L.ebus} strokeWidth="2" />
                  <text x={X0 + 28} y={height - 13} fontSize="8.5" fill={C.muted}>E-bus (inside station)</text>
                  <line x1={X0 + 150} y1={height - 16} x2={X0 + 172} y2={height - 16} stroke={L.rj45} strokeWidth="2.5" />
                  <text x={X0 + 178} y={height - 13} fontSize="8.5" fill={C.muted}>Ethernet / RJ45 hop</text>
                </g>
              </svg>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// renders the diagram nodes (assembled rail strips + free comps) and the
// per-wire lane routing; shared by the modal preview and the PDF raster
function DiagramSvg({ dref, width, height, nodes, edges, layout, NODE_PAD, NODES_Y, TOP_PAD, DRAW_H, nodesBottom }) {
  return (
    <svg ref={dref} xmlns="http://www.w3.org/2000/svg" width={width} height={height} style={{ display: "block", background: "#fff" }}>
      <defs>
        <linearGradient id="railg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F1F3F4" /><stop offset="0.5" stopColor="#AEB4BA" /><stop offset="1" stopColor="#8F959B" />
        </linearGradient>
        <linearGradient id="tbody" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={M.hL} /><stop offset="0.5" stopColor={M.h} /><stop offset="1" stopColor={M.hR} />
        </linearGradient>
        <linearGradient id="psbody" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#E2E5E8" /><stop offset="0.5" stopColor="#C9CDD1" /><stop offset="1" stopColor="#ADB2B7" />
        </linearGradient>
        <linearGradient id="ybody" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={M.yL} /><stop offset="0.5" stopColor={M.y} /><stop offset="1" stopColor={M.yR} />
        </linearGradient>
      </defs>
      <text x={NODE_PAD} y="24" fontSize="12" fontWeight="700" fill={C.ink} fontFamily="system-ui">
        Device-to-device overview — cables attach at their real connection points
      </text>
      {nodes.map((n) => {
        const gx = n.x + (n.w - n.drawW) / 2, gy = NODES_Y + TOP_PAD;
        if (n.type === "rail") {
          // fake layout: each item positioned by cumulative width from strip start
          const pos = {}; let cx = 0;
          n.items.forEach((it) => {
            const t = layout.pos[it.uid];
            if (t) { pos[it.uid] = { ...t, x: cx, y: 0 }; cx += t.geom.W + 1; }
          });
          const fake = { pos };
          return (
            <g key={n.key}>
              <g transform={`translate(${gx}, ${gy}) scale(${n.scale})`}>
                <rect x="8" y={TH + 4} width={cx - 8} height="14" fill="url(#railg)" rx="2" />
                {n.items.map((it) => (
                  <TerminalG key={it.uid} inst={it} layout={fake} selected={false} wireMode={false}
                    pending={null} wiredPts={EMPTY_SET}
                    onSelect={noop} onDetail={noop} onDragStart={noop} onPointDown={noop} onPointUp={noop} onHover={noop} onLeave={noop} />
                ))}
              </g>
              <text x={n.x + n.w / 2} y={NODES_Y + TOP_PAD + DRAW_H + 20} fontSize="10" fontWeight="700" textAnchor="middle" fill={C.ink} fontFamily="ui-monospace,monospace">{n.label}</text>
            </g>
          );
        }
        const fake = { pos: { [n.t.inst.uid]: { ...n.t, x: 0, y: 0 } } };
        return (
          <g key={n.key}>
            <g transform={`translate(${gx}, ${gy}) scale(${n.scale})`}>
              <FreeCompG inst={n.t.inst} layout={fake} selected={false} wireMode={false} pending={null}
                onSelect={noop} onDragStart={noop} onPointDown={noop} onPointUp={noop} onHover={noop} onLeave={noop} />
            </g>
            <text x={n.x + n.w / 2} y={NODES_Y + TOP_PAD + DRAW_H + 20} fontSize="10" fontWeight="700" textAnchor="middle" fill={C.ink} fontFamily="ui-monospace,monospace">{n.label}</text>
          </g>
        );
      })}
      {edges.map((e) => {
        const t = wireById[e.w.type];
        const d = `M ${e.A.x} ${e.A.y} V ${e.laneY - 6} Q ${e.A.x} ${e.laneY} ${e.ax + 6 * Math.sign(e.bx - e.ax || 1)} ${e.laneY} H ${e.bx - 6 * Math.sign(e.bx - e.ax || 1)} Q ${e.bx} ${e.laneY} ${e.bx} ${e.laneY - 6} V ${e.B.y}`;
        return (
          <g key={e.w.id}>
            {t.shield && <path d={d} fill="none" stroke="#5F656C" strokeWidth={t.w + 2} />}
            <path d={d} fill="none" stroke={t.stroke} strokeWidth={t.w} strokeLinecap="round" strokeLinejoin="round" />
            {t.gnye && <path d={d} fill="none" stroke="#F2D703" strokeWidth={t.w} strokeDasharray="7 9" />}
            <circle cx={e.A.x} cy={e.A.y} r="2.4" fill="#fff" stroke={t.stroke} strokeWidth="1.2" />
            <circle cx={e.B.x} cy={e.B.y} r="2.4" fill="#fff" stroke={t.stroke} strokeWidth="1.2" />
            <rect x={(e.ax + e.bx) / 2 - 13} y={e.laneY - 7} width="26" height="13" rx="6.5" fill="#fff" stroke={C.line} />
            <text x={(e.ax + e.bx) / 2} y={e.laneY + 3} fontSize="8" fontWeight="700" textAnchor="middle" fill={C.ink} fontFamily="system-ui">W{e.i + 1}</text>
          </g>
        );
      })}
    </svg>
  );
}
function DiagramModal({ rails, free, wires, layout, onClose }) {
  const dref = useRef(null);
  const NODE_PAD = 26, DRAW_H = 112, NODES_Y = 40, TOP_PAD = 18;

  const rows = useMemo(
    () => wires.filter((w) => layout.pos[w.a.uid] && layout.pos[w.b.uid]),
    [wires, layout]
  );
  const wiredUids = useMemo(() => new Set(rows.flatMap((w) => [w.a.uid, w.b.uid])), [rows]);

  // nodes: each rail with wired devices renders as the ASSEMBLED strip
  // (coupler + its terminals, same drawings as the canvas); wired free
  // components render individually
  const nodes = useMemo(() => {
    const list = [];
    let x = NODE_PAD;
    rails.forEach((r, ri) => {
      if (!r.items.some((it) => wiredUids.has(it.uid))) return;
      const scale = DRAW_H / TH;
      const drawW = r.items.reduce((s, it) => s + (layout.pos[it.uid]?.geom.W ?? 0) + 1, 0) * scale;
      const w = Math.max(96, drawW);
      list.push({ key: `rail${ri}`, type: "rail", items: r.items, label: `Rail ${ri + 1}`, scale, drawW, w, x });
      x += w + 36;
    });
    (free || []).forEach((f) => {
      if (!wiredUids.has(f.uid)) return;
      const t = layout.pos[f.uid];
      const scale = Math.min(DRAW_H / Math.max(t.geom.H, 60), 1.1);
      const drawW = t.geom.W * scale;
      const w = Math.max(78, drawW);
      list.push({ key: f.uid, type: "free", t, label: t.d.id, scale, drawW, w, x });
      x += w + 36;
    });
    return list;
  }, [rails, free, wiredUids, layout]);

  const nodeOfUid = useMemo(() => {
    const m = {};
    nodes.forEach((n) => {
      if (n.type === "rail") n.items.forEach((it) => { m[it.uid] = n; });
      else m[n.t.inst.uid] = n;
    });
    return m;
  }, [nodes]);

  // PDF page configuration
  const [inc, setInc] = useState({});
  const [schedOn, setSchedOn] = useState(true);
  const isOn = (key) => inc[key] !== false;

  // where a wire endpoint sits in the diagram — the REAL connection
  // point on the drawing (ports/clamps it typically connects from)
  const diagPt = (e) => {
    const t = layout.pos[e.uid];
    const p = t?.geom.pts[e.pt];
    const nd = nodeOfUid[e.uid];
    if (!t || !p || !nd) return null;
    const localX = nd.type === "rail" ? (t.x - RAIL_PAD_X) + p.x : p.x;
    return {
      x: nd.x + (nd.w - nd.drawW) / 2 + localX * nd.scale,
      y: NODES_Y + TOP_PAD + p.y * nd.scale,
    };
  };

  const visWires = rows.filter((w) => isOn(nodeOfUid[w.a.uid]?.key) && isOn(nodeOfUid[w.b.uid]?.key));

  // routes: exact point → jog → own lane → jog → exact point. One lane
  // per wire plus per-x jogs on the verticals ⇒ runs never overlap.
  const nodesBottom = NODES_Y + TOP_PAD + DRAW_H + 26;
  const edges = (() => {
    const pts = visWires
      .map((w) => ({ w, A: diagPt(w.a), B: diagPt(w.b) }))
      .filter((e) => e.A && e.B)
      .sort((e1, e2) => Math.min(e1.A.x, e1.B.x) - Math.min(e2.A.x, e2.B.x));
    const xCount = {};
    const jog = (x) => {
      const k = Math.round(x / 4);
      const n = (xCount[k] = (xCount[k] || 0) + 1);
      return x + (n - 1) * 5;
    };
    return pts.map((e, i) => ({ ...e, laneY: nodesBottom + 16 + i * 16, ax: jog(e.A.x), bx: jog(e.B.x), i }));
  })();

  const ptLabel = (e) => {
    const t = layout.pos[e.uid];
    return `${t?.d.id}·${t?.geom.pts[e.pt]?.label ?? e.pt + 1}`;
  };

  const visNodes = nodes.filter((n) => isOn(n.key));
  const width = Math.max(700, (nodes.length ? nodes[nodes.length - 1].x + nodes[nodes.length - 1].w : 0) + NODE_PAD);
  const height = nodesBottom + 16 + edges.length * 16 + 34;

  const exportPdf = async () => {
    const svg = dref.current; if (!svg) return;
    // page 1: rasterize the overview
    const xml = new XMLSerializer().serializeToString(svg);
    const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const cv = document.createElement("canvas");
    cv.width = width * 2; cv.height = height * 2;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.scale(2, 2); ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    const overview = cv.toDataURL("image/png");

    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const M = 12;
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(15);
    pdf.text("Electrical connection diagram", M, M + 4);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(105);
    pdf.text("1 · Device-to-device overview", M, M + 11);
    pdf.setTextColor(0);
    let iw = 297 - M * 2;
    let ih = iw * (height / width);
    if (ih > 210 - 34) { ih = 210 - 34; iw = ih * (width / height); }
    pdf.addImage(overview, "PNG", M, M + 16, iw, ih);

    if (!schedOn || visWires.length === 0) { pdf.save("beckhoff-wiring-diagram.pdf"); return; }
    // page 2+: cable schedule, drawn as vector rows
    pdf.addPage("a4", "portrait");
    const PW = 210;
    let y = 18;
    const header = () => {
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(12);
      pdf.text("2 · Cable schedule", M, y);
      y += 8;
      pdf.setFontSize(8); pdf.setTextColor(105);
      pdf.text("#", M, y); pdf.text("From", M + 10, y); pdf.text("Cable", M + 62, y); pdf.text("To", M + 150, y);
      pdf.setTextColor(0);
      pdf.setDrawColor(200); pdf.setLineWidth(0.2);
      pdf.line(M, y + 1.5, PW - M, y + 1.5);
      y += 6;
    };
    header();
    visWires.forEach((w, i) => {
      if (y > 280) { pdf.addPage("a4", "portrait"); y = 18; header(); }
      const t = wireById[w.type];
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(8);
      pdf.text(`W${i + 1}`, M, y);
      pdf.setFont("helvetica", "normal");
      pdf.text(ptLabel(w.a), M + 10, y);
      pdf.text(ptLabel(w.b), M + 150, y);
      // color swatch line (with shield/PE patterns)
      const sx = M + 62, ex = M + 92, sy = y - 1.2;
      if (t.shield) { pdf.setDrawColor(95, 101, 108); pdf.setLineWidth(2.2); pdf.line(sx, sy, ex, sy); }
      pdf.setDrawColor(...hexToRgb(t.stroke));
      pdf.setLineWidth(t.shield ? 1.2 : 1.6);
      pdf.line(sx, sy, ex, sy);
      if (t.gnye) {
        pdf.setDrawColor(242, 215, 3); pdf.setLineWidth(1.2);
        pdf.setLineDashPattern([2, 2.4], 0);
        pdf.line(sx, sy, ex, sy);
        pdf.setLineDashPattern([], 0);
      }
      pdf.setFontSize(7); pdf.setTextColor(105);
      const nm = t.name + (w.label ? `  —  "${w.label}"` : "");
      pdf.text(nm.length > 58 ? nm.slice(0, 57) + "…" : nm, sx, y + 3.4);
      pdf.setTextColor(0);
      y += 9;
    });
    pdf.save("beckhoff-wiring-diagram.pdf");
  };

  return (
    <div style={S.modalWrap} onClick={onClose}>
      <div style={{ ...S.modal, maxWidth: "94vw" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ ...S.inspId, fontSize: 16 }}>Electrical connection diagram</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={S.btnGhost} onClick={exportPdf}>Export PDF</button>
            <button style={S.btnGhost} onClick={onClose}>✕ Close</button>
          </div>
        </div>
        {rows.length === 0 ? (
          <p style={{ color: C.muted, fontSize: 13 }}>No wires yet — run some connections first.</p>
        ) : (
          <div style={{ display: "flex", gap: 12 }}>
            <div className="scroll" style={{ overflow: "auto", maxHeight: "76vh", flex: 1 }}>
              <DiagramSvg dref={dref} width={width} height={height} nodes={visNodes} edges={edges}
                layout={layout} NODE_PAD={NODE_PAD} NODES_Y={NODES_Y} TOP_PAD={TOP_PAD} DRAW_H={DRAW_H} nodesBottom={nodesBottom} />
            </div>
            {/* PDF configuration panel */}
            <div style={{ width: 210, flex: "0 0 auto", borderLeft: `1px solid ${C.line}`, paddingLeft: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>PDF contents</div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Include in overview:</div>
              <div className="scroll" style={{ maxHeight: "40vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 5 }}>
                {nodes.map((n) => (
                  <label key={n.key} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, cursor: "pointer" }}>
                    <input type="checkbox" checked={isOn(n.key)} onChange={() => setInc((o) => ({ ...o, [n.key]: !isOn(n.key) }))} />
                    <span>{n.label}</span>
                  </label>
                ))}
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, cursor: "pointer", marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.line}` }}>
                <input type="checkbox" checked={schedOn} onChange={() => setSchedOn((v) => !v)} />
                <span>Cable schedule pages</span>
              </label>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
                {visWires.length} of {rows.length} cables shown
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- free-placed component renderer --------------------------------- */
function PortGlyph({ x, y, kind, label }) {
  return (
    <g>
      {kind === "rj45" ? (
        <g>
          <rect x={x - 7} y={y - 5.5} width="14" height="11" rx="1.5" fill="#26221D" stroke="#C9CBCD" strokeWidth="0.8" />
          <rect x={x - 4.5} y={y - 4} width="9" height="3" fill="#C8A24A" />
        </g>
      ) : kind === "fo" ? (
        <g>
          <circle cx={x} cy={y} r="6" fill="#AEB0B2" stroke="rgba(0,0,0,0.3)" strokeWidth="0.7" />
          <circle cx={x} cy={y} r="3" fill="#2E7D32" />
        </g>
      ) : kind === "oct" ? (
        <g>
          <circle cx={x} cy={y} r="7.5" fill="#6B4FD8" stroke="#3F2E8A" strokeWidth="1.4" />
          <circle cx={x} cy={y} r="3" fill="#26282B" />
        </g>
      ) : kind === "m12net" ? (
        <g>
          <circle cx={x} cy={y} r="6.5" fill="#9BA0A6" stroke="#54585C" strokeWidth="1.2" />
          {[[-2, -2], [2, -2], [-2, 2], [2, 2]].map(([dx, dy], i) => (
            <circle key={i} cx={x + dx} cy={y + dy} r="0.9" fill="#26282B" />
          ))}
        </g>
      ) : kind === "usb" ? (
        <rect x={x - 6.5} y={y - 3.5} width="13" height="7" rx="1" fill="#1E2126" stroke="#8A9096" strokeWidth="0.8" />
      ) : (
        // dp / hdmi / dvi
        <path d={`M ${x - 7} ${y - 4} h 11 l 3 3 v 5 h -14 z`} fill="#1E2126" stroke="#8A9096" strokeWidth="0.8" />
      )}
      {label && <text x={x} y={y + 13} fill={M.txtDim} fontSize="4.6" textAnchor="middle" fontFamily="system-ui">{label}</text>}
    </g>
  );
}

function FreeCompG({ inst, layout, selected, wireMode, pending, wired, onSelect, onDragStart, onPointDown, onPointUp, onHover, onLeave }) {
  const t = layout.pos[inst.uid];
  if (!t) return null;
  const { d, geom } = t;
  const { W, H } = geom;
  const uid = inst.uid;
  const brand = BRANDS[d.brand] || BRANDS.beckhoff;
  const brandColor = brand.c;
  // faces with a dark housing need the wordmark lifted toward white, or a
  // dark brand colour disappears into the body
  const brandOnDark = (() => {
    const [r, g, b] = hexToRgb(brandColor);
    const m = (v) => Math.round(v + (255 - v) * 0.42);
    return `rgb(${m(r)},${m(g)},${m(b)})`;
  })();
  const animate = d.motion && wired; // motion parts move once powered + wired
  const face = (() => {
    switch (d.kind) {
      case "ipc": return (
        <g>
          <rect x="0" y="0" width={W} height={H} rx="5" fill="url(#psbody)" stroke={M.hEdge} strokeWidth="0.9" />
          <text x="10" y="16" fill={brandColor} fontSize="7.5" fontWeight="800" fontFamily="system-ui">{brand.name}</text>
          <text x="10" y="26" fill={M.txt} fontSize="6.5" fontWeight="700" fontFamily="ui-monospace,monospace">{d.id}</text>
          {Array.from({ length: 4 }).map((_, i) => (
            <rect key={i} x="10" y={36 + i * 7} width={W * 0.4} height="2.4" rx="1.2" fill="rgba(0,0,0,0.14)" />
          ))}
        </g>
      );
      case "panel": return (
        <g>
          <rect x="0" y="0" width={W} height={H - 30} rx="5" fill="#2B2F33" stroke="#54585C" strokeWidth="1" />
          <rect x="7" y="7" width={W - 14} height={H - 52} rx="2" fill="#12405E" />
          <text x={W / 2} y={(H - 30) / 2} fill="#7FB6D9" fontSize="7" textAnchor="middle" fontFamily="system-ui">{d.name}</text>
          <text x={W - 10} y={H - 36} fill="#C9CDD2" fontSize="5" textAnchor="end" fontFamily="system-ui">{brand.name} {d.id}</text>
          <rect x="0" y={H - 30} width={W} height="30" rx="3" fill="url(#psbody)" stroke={M.hEdge} strokeWidth="0.7" />
        </g>
      );
      case "drive": return (
        <g>
          <rect x="0" y="0" width={W} height={H} rx="4" fill="#3A3F45" stroke="#1E2126" strokeWidth="1" />
          {Array.from({ length: 7 }).map((_, i) => (
            <rect key={i} x={W - 8} y={12 + i * 27} width="6" height="20" rx="1" fill="#2A2E33" />
          ))}
          <text x="8" y="14" fill={brandOnDark} fontSize="6.5" fontWeight="800" fontFamily="system-ui">{brand.name}</text>
          <text x="8" y={H - 34} fill="#C9CDD2" fontSize="6.5" fontWeight="700" fontFamily="ui-monospace,monospace">{d.id}</text>
          <rect x={W * 0.2} y={72} width={W * 0.6} height="12" rx="2" fill={M.winFrame} />
          <rect x={W * 0.2 + 3} y={75} width="6" height="6" rx="1" fill={M.ledOn}>
            {animate && <animate attributeName="opacity" values="1;0.2;1" dur="0.5s" repeatCount="indefinite" />}
          </rect>
          {/* motion indicator — spinning rotor arc when powered + wired */}
          <g style={{ transformOrigin: `${W / 2}px ${H - 20}px` }}>
            <circle cx={W / 2} cy={H - 20} r="9" fill="none" stroke="#454A50" strokeWidth="2" />
            <path d={`M ${W / 2} ${H - 29} A 9 9 0 0 1 ${W / 2 + 9} ${H - 20}`} fill="none" stroke="#7DE24A" strokeWidth="2.5" />
            {animate && <animateTransform attributeName="transform" type="rotate" from={`0 ${W / 2} ${H - 20}`} to={`360 ${W / 2} ${H - 20}`} dur="0.8s" repeatCount="indefinite" />}
          </g>
        </g>
      );
      case "switch8": case "conv": return (
        <g>
          <rect x="0" y="0" width={W} height={H} rx="4" fill="url(#psbody)" stroke={M.hEdge} strokeWidth="0.9" />
          <text x="8" y="14" fill={M.txt} fontSize="6" fontWeight="700" fontFamily="ui-monospace,monospace">{d.id}</text>
          {d.kind === "conv" && <path d={`M 40 ${H / 2 - 4} h ${W - 80}`} stroke={M.txtDim} strokeWidth="1.4" strokeDasharray="4 3" markerEnd="" />}
        </g>
      );
      case "motor": return (
        <g>
          {/* flange + housing + shaft */}
          <rect x="0" y="14" width="14" height={H - 42} rx="2" fill="#8A9096" stroke="#54585C" strokeWidth="1" />
          <rect x="14" y="20" width={W - 44} height={H - 54} rx="6" fill="#3A3F45" stroke="#1E2126" strokeWidth="1" />
          {Array.from({ length: 5 }).map((_, i) => (
            <rect key={i} x="20" y={26 + i * (H - 66) / 5} width={W - 56} height="3" rx="1.5" fill="#2A2E33" />
          ))}
          <rect x={W - 30} y={H / 2 - 14} width="26" height="8" rx="3" fill="#B7BCC2" stroke="#54585C" strokeWidth="1" />
          {/* rotor disc — spins when powered + wired */}
          <g>
            <circle cx="7" cy={H / 2 - 7} r="6" fill="#54585C" stroke="#2A2E33" strokeWidth="0.8" />
            <g style={{ transformOrigin: `7px ${H / 2 - 7}px` }}>
              <line x1="7" y1={H / 2 - 12} x2="7" y2={H / 2 - 2} stroke="#C9CDD2" strokeWidth="1.4" />
              {animate && <animateTransform attributeName="transform" type="rotate" from={`0 7 ${H / 2 - 7}`} to={`360 7 ${H / 2 - 7}`} dur="0.9s" repeatCount="indefinite" />}
            </g>
          </g>
          <text x={(W - 30) / 2 + 14} y={H - 26} fill="#C9CDD2" fontSize="5.6" fontWeight="700" textAnchor="middle" fontFamily="ui-monospace,monospace">{d.id}</text>
        </g>
      );
      case "encf": return (
        <g>
          <circle cx={W / 2} cy={(H - 26) / 2} r={(H - 46) / 2} fill="#B7BCC2" stroke="#7A8086" strokeWidth="1" />
          <circle cx={W / 2} cy={(H - 26) / 2} r="6" fill="#54585C" />
          <rect x={W / 2 - 2.5} y={(H - 26) / 2 - (H - 46) / 2 - 8} width="5" height="10" rx="2" fill="#8A9096" />
          <line x1={W / 2} y1={(H - 26) / 2 + (H - 46) / 2} x2={W / 2} y2={H - 22} stroke="#3A3F45" strokeWidth="2.4" />
        </g>
      );
      case "valve": return (
        <g>
          <rect x="8" y={H - 52} width={W - 16} height="22" rx="3" fill="#B7BCC2" stroke="#7A8086" strokeWidth="1" />
          <rect x={W / 2 - 16} y="6" width="32" height={H - 60} rx="3" fill="#3A3F45" stroke="#1E2126" strokeWidth="1" />
          <text x={W / 2} y={H / 2 - 18} fill="#C9CDD2" fontSize="5.2" textAnchor="middle" fontFamily="system-ui">24VDC</text>
        </g>
      );
      case "stack": {
        const items = [...(d.lights || [])];
        const colors = { R: "#D0342C", Y: "#E8C400", G: "#25A37A", B: "#2E6DB4", W: "#E8EAEC", BZ: "#54585C" };
        const nRows = Math.ceil((items.length + (d.buzzer ? 1 : 0) + 1) / 4);
        const boxTop = H - 14 - nRows * 14 - 6;
        return (
          <g>
            {/* junction box holding the terminals */}
            <rect x="0" y={boxTop} width={W} height={H - boxTop} rx="3" fill="#3A3F45" stroke="#1E2126" strokeWidth="0.9" />
            <rect x={W / 2 - 6} y={boxTop - 12} width="12" height="12" fill="#54585C" />
            {items.map((lb, i) => (
              <rect key={i} x={W / 2 - 13} y={boxTop - 32 - i * 20} width="26" height="19" rx="2"
                fill={colors[lb] || "#888"} stroke="rgba(0,0,0,0.3)" strokeWidth="0.7" opacity="0.9" />
            ))}
            {d.buzzer && <rect x={W / 2 - 13} y={boxTop - 32 - items.length * 20 + 8} width="26" height="11" rx="4" fill="#54585C" />}
            <rect x={W / 2 - 9} y={boxTop - 38 - (items.length + (d.buzzer ? 1 : 0)) * 20 + (d.buzzer ? 8 : 0)} width="18" height="6" rx="3" fill="#3A3F45" />
          </g>
        );
      }
      case "btn": case "estop": return (
        <g>
          <rect x="0" y="0" width={W} height={W * 0.85} rx="6" fill={d.kind === "estop" ? "#E8C400" : "#DADDE0"} stroke={M.hEdge} strokeWidth="0.9" />
          <circle cx={W / 2} cy={W * 0.42} r={W * 0.28} fill={d.kind === "estop" ? "#C4262E" : d.illum ? "#E8C400" : "#3A3F45"} stroke="rgba(0,0,0,0.35)" strokeWidth="1" />
          {d.sel && <rect x={W / 2 - 2} y={W * 0.42 - 12} width="4" height="24" rx="2" fill="#DADDE0" transform={`rotate(35 ${W / 2} ${W * 0.42})`} />}
          {d.kind === "estop" && <circle cx={W / 2} cy={W * 0.42} r={W * 0.15} fill="#A31C24" />}
        </g>
      );
      case "relay": return (
        <g>
          <rect x="4" y="0" width={W - 8} height={H - 22} rx="3" fill="#E9EAEC" stroke={M.hEdge} strokeWidth="0.9" />
          <rect x="10" y="8" width={W - 20} height="14" rx="1.5" fill="#C9CDD2" />
          <text x={W / 2} y={40} fill={M.txt} fontSize="5.4" textAnchor="middle" fontFamily="system-ui">24VDC · 1CO</text>
          {/* socket base the pins sit in */}
          <rect x="0" y={H - 22} width={W} height="22" rx="2.5" fill="#C4C9CE" stroke={M.hEdge} strokeWidth="0.8" />
        </g>
      );
      case "contactor": return (
        <g>
          {/* lug strips top and bottom, coil terminals on the left face */}
          <rect x="20" y="2" width={W - 24} height="18" rx="2" fill="#54585C" />
          <rect x="20" y={H - 22} width={W - 24} height="20" rx="2" fill="#54585C" />
          <rect x="4" y="18" width={W - 8} height={H - 40} rx="3" fill="#3A3F45" stroke="#1E2126" strokeWidth="0.9" />
          <text x={W / 2 + 4} y={H / 2} fill="#C9CDD2" fontSize="5.6" textAnchor="middle" fontFamily="system-ui">3P · 24VDC</text>
        </g>
      );
      case "sensor": case "iol": case "loop2": return (
        <g>
          <rect x={W / 2 - 8} y="8" width="16" height={H - 44} rx="4" fill="#B7BCC2" stroke="#7A8086" strokeWidth="0.9" />
          {Array.from({ length: 5 }).map((_, i) => (
            <line key={i} x1={W / 2 - 8} y1={16 + i * 7} x2={W / 2 + 8} y2={16 + i * 7} stroke="#8A9096" strokeWidth="0.7" />
          ))}
          <circle cx={W / 2} cy="12" r="5" fill={d.kind === "iol" ? "#25A37A" : "#E8781E"} />
          {/* cable stub down to the wiring terminals */}
          <line x1={W / 2} y1={H - 36} x2={W / 2} y2={H - 20} stroke="#3A3F45" strokeWidth="2.4" />
        </g>
      );
      case "limit": return (
        <g>
          <rect x="6" y="24" width={W - 12} height={H - 44} rx="3" fill="#E9EAEC" stroke={M.hEdge} strokeWidth="0.9" />
          <line x1={W / 2} y1="24" x2={W - 8} y2="6" stroke="#54585C" strokeWidth="3" strokeLinecap="round" />
          <circle cx={W - 8} cy="6" r="5" fill="#B7BCC2" stroke="#54585C" strokeWidth="1" />
        </g>
      );
      case "curtain": return (
        <g>
          <rect x={W / 2 - 13} y="0" width="26" height={H - 40} rx="3" fill="#E8C400" stroke="#A38A00" strokeWidth="1" />
          <rect x={W / 2 - 4} y="8" width="8" height={H - 58} rx="2" fill="#7A1618" />
          {Array.from({ length: 8 }).map((_, i) => (
            <circle key={i} cx={W / 2} cy={16 + i * (H - 76) / 7} r="1.6" fill="#E85055" />
          ))}
          {/* M12 pigtail down to the wiring terminals */}
          <line x1={W / 2} y1={H - 40} x2={W / 2} y2={H - 20} stroke="#3A3F45" strokeWidth="2.4" />
        </g>
      );
      case "iolhub": return (
        <g>
          <rect x="0" y="0" width={W} height={H} rx="4" fill="#3A3F45" stroke="#1E2126" strokeWidth="0.9" />
          {Array.from({ length: 4 }).map((_, i) => (
            <circle key={i} cx={18 + i * 28} cy="22" r="8" fill="#AEB0B2" stroke="#54585C" strokeWidth="1" />
          ))}
          <text x={W - 8} y="12" fill="#C9CDD2" fontSize="5" textAnchor="end" fontFamily="system-ui">IO-Link</text>
        </g>
      );
      case "busbar": {
        const barFill = d.pol === "24V" ? "#B4622D" : d.pol === "0V" ? "#5C7FB8" : "#3F9A4D";
        return (
          <g>
            <rect x="0" y={H / 2 - 7} width={W} height="14" rx="2" fill={barFill} stroke="rgba(0,0,0,0.35)" strokeWidth="0.8" />
            {Array.from({ length: d.ch || 8 }).map((_, i) => (
              <circle key={i} cx={40 + i * 21} cy={H / 2} r="2.4" fill="rgba(0,0,0,0.35)" />
            ))}
            <text x={W - 4} y={H / 2 - 10} fill={M.txtDim} fontSize="5" textAnchor="end" fontFamily="system-ui">{d.pol}</text>
          </g>
        );
      }
      case "wago": return (
        <g>
          <rect x="0" y="4" width={W} height={H - 8} rx="3" fill="#D8DBDE" stroke={M.hEdge} strokeWidth="0.9" />
          {Array.from({ length: 8 }).map((_, i) => (
            <g key={i}>
              <rect x={12 + i * 17} y="8" width="9" height="7" rx="1" fill="#E8781E" />
              <rect x={12 + i * 17} y={H - 19} width="9" height="7" rx="1" fill="#2E6DB4" />
            </g>
          ))}
        </g>
      );
      case "epbox": return (
        <g>
          <rect x="0" y="0" width={W} height={H} rx="6" fill="#2B2F33" stroke="#15181B" strokeWidth="1" />
          <rect x="0" y="0" width={W} height="12" rx="6" fill={brandColor} opacity="0.9" />
          <rect x="6" y="34" width={W - 12} height={H - 44} rx="3" fill="#23262A" stroke="#3A3F45" strokeWidth="0.7" />
          {geom.pts.filter((p) => !p.port).map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="6.5" fill="#9BA0A6" stroke="#54585C" strokeWidth="1.1" />
          ))}
          <text x={W / 2} y={H - 3} fill="#C9CDD2" fontSize="5" textAnchor="middle" fontFamily="ui-monospace,monospace">IP67</text>
        </g>
      );
      case "supplybox": return (
        <g>
          <rect x="0" y="0" width={W} height={H} rx="4" fill="url(#psbody)" stroke={M.hEdge} strokeWidth="0.9" />
          <rect x={W - 30} y="26" width="22" height="11" rx="2" fill={M.winFrame} stroke={M.winEdge} strokeWidth="0.6" />
          <rect x={W - 27} y="29" width="6" height="4" rx="1" fill={M.ledOn} />
          {Array.from({ length: 10 }).map((_, i) => (
            <rect key={i} x={W * 0.16} y={48 + i * 8} width={W * 0.68} height="2.6" rx="1.3" fill="rgba(0,0,0,0.14)" />
          ))}
          <text x="8" y={H - 34} fill={M.txt} fontSize="5.4" fontWeight="700" fontFamily="ui-monospace,monospace">{d.psuV || 24}V</text>
        </g>
      );
      case "fusebox": return (
        <g>
          <rect x="0" y="0" width={W} height={H} rx="4" fill="#E9EAEC" stroke={M.hEdge} strokeWidth="0.9" />
          {Array.from({ length: d.ch || 4 }).map((_, i) => (
            <rect key={i} x={12 + i * ((W - 24) / (d.ch || 4))} y="26" width="8" height="8" rx="1.5" fill={M.ledOn} />
          ))}
          <text x={W / 2} y={H / 2 + 8} fill={M.txt} fontSize="5.4" textAnchor="middle" fontFamily="system-ui">24VDC</text>
        </g>
      );
      case "breaker": return (
        <g>
          <rect x={W * 0.15} y="0" width={W * 0.7} height={H} rx="2.5" fill="#E9EAEC" stroke={M.hEdge} strokeWidth="0.9" />
          <rect x={W / 2 - 5} y={H / 2 - 12} width="10" height="20" rx="2" fill="#3A3F45" />
          <rect x={W / 2 - 3} y={H / 2 - 8} width="6" height="7" rx="1" fill="#D0342C" />
        </g>
      );
      case "disconnect": return (
        <g>
          <rect x="2" y="2" width={W - 4} height={H - 4} rx="4" fill="#E8C400" stroke="#A38A00" strokeWidth="1" />
          <circle cx={W / 2} cy={H / 2} r={Math.min(W, H) * 0.26} fill="#C4262E" stroke="#7A1618" strokeWidth="1.5" />
          <rect x={W / 2 - 2.5} y={H / 2 - 14} width="5" height="28" rx="2.5" fill="#3A3F45" transform={`rotate(35 ${W / 2} ${H / 2})`} />
          <text x={W / 2} y={H - 6} fill="#3A3F45" fontSize="5" fontWeight="700" textAnchor="middle" fontFamily="system-ui">O–I</text>
        </g>
      );
      case "valvebank": return (
        <g>
          <rect x="0" y="18" width={W} height={H - 40} rx="3" fill="#8A9096" stroke="#54585C" strokeWidth="1" />
          {Array.from({ length: d.ch || 5 }).map((_, i) => (
            <rect key={i} x={8 + i * ((W - 16) / (d.ch || 5))} y="10" width={((W - 16) / (d.ch || 5)) - 4} height={H - 44} rx="2" fill="#3A3F45" stroke="#1E2126" strokeWidth="0.7" />
          ))}
          <text x="6" y={H - 26} fill="#C9CDD2" fontSize="5" fontFamily="system-ui">manifold</text>
        </g>
      );
      case "scanner": return (
        <g>
          <rect x={W / 2 - 22} y={H - 34} width="44" height="24" rx="3" fill="#3A3F45" stroke="#1E2126" strokeWidth="1" />
          <ellipse cx={W / 2} cy={H - 44} rx="26" ry="20" fill="#1E2126" stroke="#E8C400" strokeWidth="2" />
          <path d={`M ${W / 2 - 20} ${H - 44} A 20 16 0 0 1 ${W / 2 + 20} ${H - 44}`} fill="none" stroke="#454A50" strokeWidth="3" />
          <circle cx={W / 2} cy={H - 46} r="4" fill="#E85055" />
        </g>
      );
      case "linaxis": return (
        <g>
          <rect x="30" y={H / 2 - 8} width={W - 34} height="16" rx="3" fill="#B7BCC2" stroke="#7A8086" strokeWidth="1" />
          <rect x="2" y={H / 2 - 16} width="30" height="32" rx="3" fill="#54585C" stroke="#2A2E33" strokeWidth="1" />
          {/* carriage slides along the axis when powered + wired */}
          <g>
            <rect x={W * 0.45} y={H / 2 - 12} width="26" height="24" rx="2" fill="#3A3F45" />
            {animate && <animateTransform attributeName="transform" type="translate" values={`0 0; ${W * 0.28} 0; 0 0`} dur="2.2s" repeatCount="indefinite" />}
          </g>
        </g>
      );
      case "fan": return (
        <g>
          <rect x="0" y="0" width={W} height={H} rx="4" fill="#3A3F45" stroke="#1E2126" strokeWidth="1" />
          <circle cx={W / 2} cy={H / 2} r={Math.min(W, H) * 0.36} fill="none" stroke="#8A9096" strokeWidth="2" />
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <path key={a} d={`M ${W / 2} ${H / 2} l ${12 * Math.cos(a * Math.PI / 180)} ${12 * Math.sin(a * Math.PI / 180)}`} stroke="#8A9096" strokeWidth="2.5" strokeLinecap="round" />
          ))}
        </g>
      );
      case "cyl": return (
        <g>
          <rect x="20" y={H / 2 - 12} width={W - 40} height="24" rx="6" fill="#B7BCC2" stroke="#7A8086" strokeWidth="1" />
          <rect x={W - 20} y={H / 2 - 3} width="18" height="6" rx="3" fill="#8A9096" />
          <rect x="6" y={H / 2 - 8} width="16" height="16" rx="2" fill="#54585C" />
        </g>
      );
      case "echain": return (
        <g>
          {Array.from({ length: 7 }).map((_, i) => (
            <rect key={i} x={6 + i * ((W - 12) / 7)} y={H / 2 - 12} width={((W - 12) / 7) - 3} height="24" rx="3" fill="#3A3F45" stroke="#1E2126" strokeWidth="0.8" />
          ))}
        </g>
      );
      case "spool": return (
        <g>
          <circle cx={W / 2} cy={H / 2} r={Math.min(W, H) * 0.42} fill="#3A3F45" stroke="#1E2126" strokeWidth="1.5" />
          <circle cx={W / 2} cy={H / 2} r={Math.min(W, H) * 0.28} fill="none" stroke="#54585C" strokeWidth="3" />
          <circle cx={W / 2} cy={H / 2} r="4" fill="#8A9096" />
        </g>
      );
      case "box": return (
        <g>
          <rect x="2" y="0" width={W - 4} height={H} rx="3" fill={d.safety ? "url(#ybody)" : "#E9EAEC"} stroke={M.hEdge} strokeWidth="0.9" />
          <rect x="8" y="8" width={W - 16} height="12" rx="1.5" fill={M.win} />
          <rect x="11" y="11" width="5" height="3" rx="0.6" fill={M.ledOn} />
          <text x={W / 2} y={H / 2 + 12} fill={M.txt} fontSize="5.2" textAnchor="middle" fontFamily="system-ui">{d.safety ? "SAFETY" : "MODULE"}</text>
        </g>
      );
      case "source": return (
        <g>
          <rect x="2" y="0" width={W - 4} height={H - 16} rx="4" fill={d.st === "dc" ? "#1F3A5F" : "#8A4A16"} stroke="#12202F" strokeWidth="1" />
          <rect x="6" y="5" width={W - 12} height="2.6" rx="1.3" fill={d.st === "dc" ? "#5B8FD0" : "#E8A05A"} />
          <text x={W / 2} y={H * 0.4} fill="#fff" fontSize="11" fontWeight="800" textAnchor="middle" fontFamily="system-ui">{d.volt || ""}</text>
          <text x={W / 2} y={H * 0.4 + 13} fill="#CBD6E2" fontSize="6.4" textAnchor="middle" fontFamily="system-ui">{d.st === "3ph" ? "3-PHASE AC" : d.st === "1ph" ? "1-PHASE AC" : "DC SUPPLY"}</text>
          <rect x="0" y={H - 16} width={W} height="16" rx="2.5" fill="#C4C9CE" stroke={M.hEdge} strokeWidth="0.8" />
        </g>
      );
      default: return (
        <g>
          <rect x="0" y="0" width={W} height={H} rx="5" fill="none" stroke={M.txtDim} strokeWidth="1" strokeDasharray="5 4" />
          <text x={W / 2} y={H / 2 - 2} fill={M.txt} fontSize="6.5" fontWeight="700" textAnchor="middle" fontFamily="system-ui">{d.name}</text>
          <text x={W / 2} y={H / 2 + 9} fill={M.txtDim} fontSize="5" textAnchor="middle" fontFamily="system-ui">accessory · BOM item</text>
        </g>
      );
    }
  })();

  return (
    <g transform={`translate(${t.x}, ${t.y})`}
      onClick={(e) => { if (!wireMode) { e.stopPropagation(); onSelect(); } }}
      onPointerDown={(e) => { if (!wireMode && onDragStart) onDragStart(e); }}
      style={{ cursor: wireMode ? "crosshair" : "grab" }}
      filter={selected ? "drop-shadow(0 8px 12px rgba(0,0,0,0.28))" : "drop-shadow(0 2px 4px rgba(0,0,0,0.14))"}>
      {selected && <rect x="-6" y="-6" width={W + 12} height={H + 12} rx="7" fill="none" stroke={C.ink} strokeWidth="1.4" strokeDasharray="5 4" />}
      {face}
      {/* manufacturer wordmark badge on the right side (brand color) */}
      <g transform={`translate(${W + 5}, ${H})`}>
        <text x="0" y="0" fill={brandColor} fontSize="7" fontWeight="800" fontFamily="system-ui"
          transform="rotate(-90)" style={{ letterSpacing: "0.4px" }}>{brand.name}</text>
      </g>
      {/* backing plates: ground each row of terminals/ports on the housing */}
      {!["wago", "busbar", "switch8", "epbox", "supplybox", "fusebox", "breaker", "disconnect", "valvebank", "scanner", "linaxis", "fan", "cyl", "echain", "spool", "box"].includes(d.kind) && (() => {
        const rows = [];
        [...geom.pts].sort((a, b) => a.y - b.y).forEach((p) => {
          const row = rows.find((r) => Math.abs(r.y - p.y) <= 10 && r.port === !!p.port);
          if (row) { row.pts.push(p); row.y = (row.y + p.y) / 2; }
          else rows.push({ y: p.y, port: !!p.port, pts: [p] });
        });
        return rows.map((r, i) => {
          const xs = r.pts.map((p) => p.x);
          const minX = Math.min(...xs), maxX = Math.max(...xs);
          return r.port ? (
            <rect key={i} x={minX - 12} y={r.y - 11} width={maxX - minX + 24} height="28" rx="3"
              fill="#2E3338" stroke="#1E2126" strokeWidth="0.8" />
          ) : (
            <rect key={i} x={minX - 9} y={r.y - 12} width={maxX - minX + 18} height="20" rx="2.5"
              fill="#DFE2E5" stroke="rgba(0,0,0,0.22)" strokeWidth="0.7" />
          );
        });
      })()}
      <text x={W / 2} y={H + 13} fill={M.txtDim} fontSize="6" textAnchor="middle" fontFamily="ui-monospace,monospace">{d.id}</text>
      {geom.pts.map((p, i) => {
        const isPending = pending && pending.uid === uid && pending.pt === i;
        return (
          <g key={i}
            onPointerDown={(e) => { if (wireMode) { e.stopPropagation(); onPointDown(uid, i); } }}
            onPointerUp={(e) => { if (wireMode) { e.stopPropagation(); onPointUp(uid, i); } }}
            onMouseEnter={() => onHover(uid, i)} onMouseLeave={onLeave}
            style={{ cursor: wireMode ? "crosshair" : "help" }}>
            {p.port ? (
              <g>
                <PortGlyph x={p.x} y={p.y} kind={p.port} label={p.label} />
                {isPending && <rect x={p.x - 12} y={p.y - 10} width="24" height="20" rx="3" fill="none" stroke="#D71920" strokeWidth="1.3" strokeDasharray="3 2" />}
              </g>
            ) : (
              <g>
                {/* role-colored halo makes the terminal purpose clear */}
                <circle cx={p.x} cy={p.y} r="5.6" fill="#fff" stroke={ROLE_COLOR[p.role] || "#8A9096"} strokeWidth="1.6" />
                <circle cx={p.x} cy={p.y} r="2.4" fill="#17181A" />
                <text x={p.x} y={p.y - 8} fill={M.txt} fontSize="5" fontWeight="600" textAnchor="middle" fontFamily="system-ui"
                  style={{ paintOrder: "stroke", stroke: "#fff", strokeWidth: 2.4 }}>{p.label}</text>
                {isPending && <circle cx={p.x} cy={p.y} r="8.5" fill="none" stroke="#D71920" strokeWidth="1.4" strokeDasharray="3 2" />}
              </g>
            )}
            <rect x={p.x - 11} y={p.y - 11} width="22" height="22" fill="transparent">
              <title>{pointRole(d, p)}</title>
            </rect>
          </g>
        );
      })}
    </g>
  );
}

function IoStat({ label, v, c }) {
  return (<div style={S.ioStat}><span style={{ ...S.ioDot, background: c }} /><span style={S.ioVal}>{v}</span><span style={S.ioLbl}>{label}</span></div>);
}

/* ================= styles ================= */
const S = {
  root: { fontFamily: "-apple-system,system-ui,'Segoe UI',Roboto,sans-serif", color: C.ink, background: C.bg, height: "100%", display: "flex", flexDirection: "column", minHeight: 560 },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: `1px solid ${C.line}`, background: C.panel },
  brandBlock: { display: "flex", flexDirection: "column", lineHeight: 1.15 },
  brandMark: { fontWeight: 800, letterSpacing: "0.14em", color: C.brand, fontSize: 15 },
  brandSub: { fontSize: 12, color: C.muted },
  headerActions: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end", rowGap: 8 },
  btnGhost: { border: `1px solid ${C.line}`, background: C.panel, color: C.ink, padding: "7px 12px", borderRadius: 8, fontSize: 12.5, cursor: "pointer", fontWeight: 500 },
  btnOn: { background: C.ink, color: "#fff", border: `1px solid ${C.ink}` },
  projName: { border: `1px solid ${C.line}`, background: C.panel, color: C.ink, padding: "7px 10px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, width: 168, outline: "none" },
  toast: { position: "fixed", top: 68, left: "50%", transform: "translateX(-50%)", background: C.ink, padding: "9px 16px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, zIndex: 80, boxShadow: "0 10px 28px rgba(0,0,0,0.28)", maxWidth: "70vw" },
  wireBar: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", padding: "8px 20px", background: "#FAFBFC", borderBottom: `1px solid ${C.line}` },
  wireChip: { display: "flex", alignItems: "center", gap: 6, padding: "5px 9px", borderRadius: 7, background: C.panel, border: "none", cursor: "pointer" },
  layout: { display: "grid", gridTemplateColumns: "244px 1fr 300px", flex: 1, minHeight: 0 },
  palette: { borderRight: `1px solid ${C.line}`, padding: 14, overflowY: "auto", background: C.panel },
  railPick: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${C.line}` },
  railSelect: { border: `1px solid ${C.line}`, borderRadius: 7, padding: "5px 8px", fontSize: 12, background: C.panel, color: C.ink },
  groupHead: { display: "flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.muted, margin: "2px 0 8px" },
  groupBtn: { display: "flex", alignItems: "center", gap: 8, width: "100%", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.ink, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 7, padding: "7px 9px", margin: "0 0 6px", cursor: "pointer" },
  catBtn: { display: "flex", alignItems: "center", gap: 7, width: "100%", fontSize: 10.5, fontWeight: 600, color: C.muted, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: "5px 8px", margin: "0 0 5px", cursor: "pointer" },
  catDot: { width: 6, height: 6, borderRadius: 2, flex: "0 0 auto" },
  groupDot: { width: 8, height: 8, borderRadius: 2 },
  palItem: { display: "grid", gridTemplateColumns: "6px auto 1fr auto", alignItems: "center", gap: 8, width: "100%", textAlign: "left", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: "7px 10px", marginBottom: 5, cursor: "pointer" },
  palStripe: { width: 6, height: 24, borderRadius: 3 },
  palId: { fontFamily: "ui-monospace,Menlo,Consolas,monospace", fontSize: 12, fontWeight: 700 },
  palName: { fontSize: 10.5, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  palPlus: { color: C.muted, fontSize: 16 },
  stage: { overflow: "auto", padding: 10, background: C.bg },
  side: { borderLeft: `1px solid ${C.line}`, padding: 14, overflowY: "auto", background: C.bg, display: "flex", flexDirection: "column", gap: 12 },
  card: { background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: 14 },
  cardHead: { fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: C.muted, marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" },
  ioGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 14 },
  ioStat: { background: C.bg, borderRadius: 8, padding: "8px 4px", textAlign: "center", position: "relative" },
  ioDot: { position: "absolute", top: 6, left: 6, width: 6, height: 6, borderRadius: 2 },
  ioVal: { display: "block", fontSize: 19, fontWeight: 800, fontVariantNumeric: "tabular-nums" },
  ioLbl: { display: "block", fontSize: 10, color: C.muted, fontWeight: 600 },
  meterTop: { display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, marginBottom: 5 },
  meterTrack: { height: 8, borderRadius: 4, background: C.bg, overflow: "hidden" },
  meterFill: { height: "100%", borderRadius: 4, transition: "width .2s ease" },
  factRow: { display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "5px 0", borderTop: `1px solid ${C.line}`, color: C.muted },
  inspHead: { display: "flex", alignItems: "center", gap: 10, marginBottom: 8 },
  inspTag: { width: 10, height: 34, borderRadius: 3 },
  inspId: { fontFamily: "ui-monospace,Menlo,Consolas,monospace", fontWeight: 700, fontSize: 15 },
  inspName: { fontSize: 12, color: C.muted },
  inspDesc: { fontSize: 12.5, marginBottom: 8 },
  etgNote: { fontSize: 11.5, lineHeight: 1.45, color: "#7A5B12", background: "#FFF8E6", border: "1px solid #F0DFAE", borderRadius: 7, padding: "7px 9px", marginBottom: 8 },
  inspMeta: { display: "flex", justifyContent: "space-between", fontSize: 11.5, color: C.muted, borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}`, padding: "7px 0" },
  inspBtns: { display: "flex", gap: 6, marginTop: 12 },
  btnMini: { flex: 1, border: `1px solid ${C.line}`, background: C.panel, borderRadius: 7, padding: "7px 4px", fontSize: 11.5, cursor: "pointer", fontWeight: 600, color: C.ink },
  wireInput: { border: `1px solid ${C.line}`, borderRadius: 6, padding: "6px 8px", fontSize: 12.5, outline: "none" },
  wireRowBtn: { display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 7, background: C.panel, border: "none", cursor: "pointer", textAlign: "left" },
  copyBtn: { border: `1px solid ${C.line}`, background: C.panel, borderRadius: 6, padding: "3px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600, color: C.ink, textTransform: "none", letterSpacing: 0 },
  bomBox: { width: "100%", boxSizing: "border-box", minHeight: 92, border: `1px solid ${C.line}`, borderRadius: 8, padding: 10, fontFamily: "ui-monospace,Menlo,Consolas,monospace", fontSize: 11.5, resize: "vertical", background: C.bg },
  modalWrap: { position: "fixed", inset: 0, background: "rgba(20,24,28,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 },
  modal: { background: C.panel, borderRadius: 12, padding: 18, maxHeight: "90vh", maxWidth: "90vw", overflow: "auto", boxShadow: "0 18px 50px rgba(0,0,0,0.3)" },
  tCell: { borderBottom: `1px solid ${C.line}`, padding: "4px 8px 4px 0", verticalAlign: "top" },
};

const CSS = `
  .scroll::-webkit-scrollbar{width:9px;height:9px}
  .scroll::-webkit-scrollbar-thumb{background:#C4C9CE;border-radius:6px}
  .scroll::-webkit-scrollbar-track{background:transparent}
  .palItem:hover{border-color:#B7BEC6;box-shadow:0 1px 3px rgba(0,0,0,.06)}
  .wireInput:focus{border-color:#8A929B;box-shadow:0 0 0 2px rgba(28,33,38,.08)}
  .ptHit:hover{stroke:#1C2126;stroke-width:1.4}
  button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #1C2126;outline-offset:1px}
`;
