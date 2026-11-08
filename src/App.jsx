import { useState, useMemo, useEffect, useRef } from "react";
import { useSim, actuatorKind } from "./sim/useSim.js";
import SimPanel from "./sim/SimPanel.jsx";
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
// how many matched parts a search may auto-expand before the palette leaves the
// company folders closed instead (1500-odd buttons per keystroke is not useful)
const EXPAND_LIMIT = 250;
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
// simulation: halo on a wire by the level its net sits at
const SIM_GLOW = { p24: "#FF6B5E", L: "#FFA24A", short: "#E040FB" };
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
const APP_VERSION = "0.1";
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
  const plc = raw.plc && typeof raw.plc === "object" ? {
    code: typeof raw.plc.code === "string" ? raw.plc.code.slice(0, 200000) : undefined,
    runtime: typeof raw.plc.runtime === "string" ? raw.plc.runtime : undefined,
  } : undefined;
  return { name: cleanName(raw.name) || DEF_NAME, rails, wires, free, ...(plc ? { plc } : {}) };
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
// rail-device housing height. 336 px plus the 12 mm EL face's latch hooks
// (8 px above and below) is about the real terminal's 12 × 100 mm outline.
const TH = 336;
// 12 mm EL face (M7, EL1002 pilot): four clamp rows, each a colour tab, a
// release button and a round wire entry `entry` px below the row top.
const EL12 = { gTop: 68, gh: 62.5, entry: 42 };
// HD 16-point face (M7, EL1859 pilot): eight push-in rows, a gap for the
// brand print after row 3 and one for the 0 V power contact after row 5.
const HD16 = { rows: [120, 144.5, 169, 206, 230.5, 268, 292.5, 317] };
// ED push-in face (M7, ED1008 / ED1859 pilots): four raised clamp blocks.
// 8-point: tab, push button, square entry per clamp; 16-point: 2 × 2 per block.
const ED = { g: [78, 140, 202, 264] };
const edPointY = (d, p) => {
  if (!d.hd) return ED.g[p % 4] + 41.5;
  const i = p % 8;
  return ED.g[i >> 1] + (i & 1) * 27 + 18;
};
const RAIL_PAD_X = 26;
const RAIL_GAP = 130;
const RAIL_TOP = 44; // room for ID badges
const RAIL_Y = Math.round(TH * 0.74); // DIN rail stripe, from the housing top

const FEED_GROUPS = [
  { labels: ["24V", "0V"], colors: ["red", "blue"] },
  { labels: ["+", "+"],    colors: ["red", "red"] },
  { labels: ["−", "−"],    colors: ["blue", "blue"] },
  { labels: ["⏚", "⏚"],   colors: ["kh", "kh"] },
];
// EL9 potential feeds (Infosys pinouts, checked against the product finder
// pictures): clamps 1 / 5 are "not used", 2 / 6 feed the + (or L) power
// contact, 3 / 7 the − (or N) one, 4 / 8 PE. Rows hold clamps n and n + 4.
const PC_FEED_GROUPS = [
  { labels: ["NC", "NC"], colors: ["gy", "gy"] },
  { labels: ["+", "+"],    colors: ["red", "red"] },
  { labels: ["−", "−"],    colors: ["blue", "blue"] },
  { labels: ["⏚", "⏚"],   colors: ["kh", "kh"] },
];
// 120…230 V AC (EL9150 / EL9160) and any-voltage (EL9190) feeds
const AC_FEED_GROUPS = [
  { labels: ["NC", "NC"], colors: ["gy", "gy"] },
  { labels: ["L", "L"],   colors: ["gy", "gy"] },
  { labels: ["N", "N"],   colors: ["gy", "gy"] },
  { labels: ["⏚", "⏚"],  colors: ["kh", "kh"] },
];
// Feed terminals drawn on the 12 mm M7 face: marker colour and LED slots
// (slot 0 top-left, 1 top-right, …) from Beckhoff's pictures and Infosys.
// EL9410: Power (E-bus), Power, Diag Us, Diag Up, RUN; the EL91x0 parts have
// one Power LED top right; the EL9190 has none.
const EFUSE_GROUPS = (two) => [
  { labels: ["I1", "O1"], colors: ["gy", "gy"] },
  { labels: ["+", "+"],   colors: ["red", "red"] },
  { labels: ["−", "−"],   colors: ["blue", "blue"] },
  { labels: two ? ["I2", "O2"] : ["X", "X"], colors: ["gy", "gy"] },
];
const BLANK = { fill: "#A19D9A", edge: "#7E7A77", ink: "#A19D9A", text: "", fs: 6 };
const OLIVE = (text) => ({ fill: "#B3B51B", edge: "#85870F", ink: "#2A2B10", text, fs: 6.4 });
const EFUSE_TABS = { I1: OLIVE("I1"), O1: OLIVE("O1"), I2: OLIVE("I2"), O2: OLIVE("O2"), X: { hide: true } };
const FEED12 = {
  EL9410: { mark: "grey", g: FEED_GROUPS, leds: ["us", "up", "diag", "diag", "run"] },
  EL9100: { mark: "orange", g: PC_FEED_GROUPS, leds: [null, "up"] },
  EL9110: { mark: "orange", g: PC_FEED_GROUPS, leds: [null, "up"] },
  EL9150: { mark: "orange", g: AC_FEED_GROUPS, leds: [null, "up"] },
  EL9160: { mark: "orange", g: AC_FEED_GROUPS, leds: [null, "up"] },
  EL9190: { mark: "orange", g: AC_FEED_GROUPS, leds: [] },
  // EL95xx supplies (same clamps as the EL9410 layout: 1 / 5 in, 2 / 6 U0
  // out, 3 / 7 0 V out, 4 / 8 PE); LEDs as on the pictures: two green power
  // LEDs, the red overcurrent LED (EL9505…9515), a third green one (EL9560)
  ...Object.fromEntries([["EL9505", "5V"], ["EL9508", "8V"], ["EL9510", "10V"], ["EL9512", "12V"], ["EL9515", "15V"]].map(([id, v]) =>
    [id, { mark: "grey", g: FEED_GROUPS, leds: ["us", "us", "diag"], tabs: { "+": { text: v, fs: 6.4 } } }])),
  EL9560: { mark: "grey", g: FEED_GROUPS, leds: ["us", "us", null, null, "us"], tabs: { "+": { text: "U₀", fs: 6.4 }, "−": { text: "0V", fs: 6.4 } } },
  // special terminals (board 03d): EL9195 shield feed (1 ↔ 5 bridged, blank
  // grey tabs), EL9540 / EL9550 surge filters, EL922x electronic fuses
  EL9195: { mark: "orange", g: [
    { labels: ["B", "B"], colors: ["gy", "gy"] }, { labels: ["L", "L"], colors: ["gy", "gy"] },
    { labels: ["N", "N"], colors: ["gy", "gy"] }, { labels: ["⏚", "⏚"], colors: ["kh", "kh"] }],
    leds: [], tabs: { B: BLANK, L: BLANK, N: BLANK, "⏚": BLANK } },
  EL9540: { mark: "orange", g: PC_FEED_GROUPS, leds: [null, "up"], tabs: { "+": { text: "24V", fs: 6.4 }, "−": { text: "0V", fs: 6.4 } } },
  EL9550: { mark: "orange", g: [
    { labels: ["S+", "S−"], colors: ["red", "blue"] }, { labels: ["+", "+"], colors: ["red", "red"] },
    { labels: ["−", "−"], colors: ["blue", "blue"] }, { labels: ["S+", "S−"], colors: ["red", "blue"] }],
    leds: ["up", "us"], tabs: { "S+": { fill: "#D3262B", edge: "#9B191D", ink: "#FFFFFF", text: "24V", fs: 6.4 }, "S−": { fill: "#2C7BC0", edge: "#1D5A90", ink: "#FFFFFF", text: "0V", fs: 6.4 },
      "+": { text: "24V", fs: 6.4 }, "−": { text: "0V", fs: 6.4 } } },
  EL9221: { mark: "grey", g: EFUSE_GROUPS(false), leds: ["run", "run", "up"], tabs: EFUSE_TABS },
  EL9222: { mark: "grey", g: EFUSE_GROUPS(true), leds: ["run", "run", "up", null, "up"], tabs: EFUSE_TABS },
  EL9227: { mark: "grey", g: EFUSE_GROUPS(true), leds: ["run", "run", "up", null, "up"], tabs: EFUSE_TABS },
};
// EL9570 buffer capacitor / EL9576 brake chopper: R tabs on clamps 1 / 5,
// LED slots from the pictures (EL9576: RUN and Out voltage OK green)
const PIN_TABS = {
  EL9570: { 1: { fill: "#D3262B", edge: "#9B191D", ink: "#FFFFFF", text: "R", fs: 6.4 }, 5: { fill: "#2C7BC0", edge: "#1D5A90", ink: "#FFFFFF", text: "R", fs: 6.4 } },
};
PIN_TABS.EL9576 = PIN_TABS.EL9570;
const PIN_LEDS = { EL9576: ["up", "up"] };
// EL9200 / EL9210 (Infosys; rows measured on the product picture): clamps
// 1-3 left, 4-6 right, n and n + 3 linked to the same power contact
const FUSED = { rows: [94, 188.5, 254], labels: [["+", "+"], ["−", "−"], ["⏚", "⏚"]] };
const feedGroupsFor = (d) => FEED12[d.id]?.g || (d.ac ? AC_FEED_GROUPS : FEED_GROUPS);

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
  if (d.endcap) return { W, pts, block: { cap: true } };
  if (d.sep) return { W, pts, block: { sep: true } };
  if (d.blank) return { W, pts };
  // TwinSAFE Logic (EL6910 / EL6930): eight clamps, all "not used, no function"
  if (d.fn === "saf" && !d.io) return { W, pts, block: { cols: [W * 0.32, W * 0.68], el12: true, logic: true } };
  // EK1960 compact controller (must mirror CompactFace): plugs X3 / X4 /
  // X5–X9 in pinout order, then the two RJ45 jacks
  if (d.compact) {
    const add = (x, y, i) => pts.push({ x, y, label: String(i + 1), size: 5, round: true, plug: true });
    let i = 0;
    for (let k = 0; k < 4; k++) add(44, 278 + 12 * k, i++);
    for (let k = 0; k < 10; k++) add(278, 154.75 + 17.5 * k, i++);
    for (const mx of TS_MODS) for (let k = 0; k < 10; k++) add(mx + 66, 204.2 + 12.4 * k, i++);
    pts.push({ x: 46, y: 46, label: "X1", port: "rj45", size: 10 });
    pts.push({ x: 46, y: 102, label: "X2", port: "rj45", size: 10 });
    return { W, pts, block: { compact: true } };
  }
  // M7 coupler family (board 04): EK1110 mirrored (12 mm strip left, RJ45
  // housing right), 24 mm RJ45 junctions, couplers with the EL / HD block
  if (d.extM7) {
    pts.push({ x: 67 + (W - 67) / 2, y: 64, label: "OUT", port: "rj45", size: 10 });
    return { W, pts, block: { cplr: true, bx: 0 } };
  }
  if (d.jM7) {
    [124, 214].forEach((y, i) => pts.push({ x: 44, y, label: `X${i + 1}`, port: "rj45", size: 10 }));
    return { W, pts, block: { cplr: true, bx: null } };
  }
  if (d.coupler && (!d.safety || d.ek18)) {
    const bx = W - 53, c12 = [bx + 53 * 0.32, bx + 53 * 0.68];
    if (d.ek18) {
      for (let p = 0; p < 16; p++) {
        const col = p < 8 ? 0 : 1;
        // EK1914: rows 6-8 are the safe I/O in a yellow insert
        pts.push({ x: c12[col], y: HD16.rows[p % 8], label: String(p + 1), size: 5.2, col, round: true, r: 5.2, ys: !!d.safety && p % 8 >= 5 });
      }
    } else {
      FEED_GROUPS.forEach((g, row) => g.labels.forEach((lb, col) =>
        pts.push({ x: c12[col], y: EL12.gTop + row * EL12.gh + EL12.entry, label: lb, size: 6.2, col, round: true })));
    }
    // network ports after the clamps, as before, so saved wire indexes stay valid
    const hx = (bx - 14) / 2;
    if (d.fiber) {
      pts.push({ x: hx - 8, y: 142, label: "X1", port: "fo", size: 10 });
      pts.push({ x: hx - 8, y: 254, label: "X2", port: "fo", size: 10 });
    } else {
      pts.push({ x: hx, y: 83, label: "X1", port: "rj45", size: 10 });
      pts.push({ x: hx, y: 189, label: "X2", port: "rj45", size: 10 });
    }
    return { W, pts, block: { cplr: true, bx, cols: c12 } };
  }
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
  if (d.fused) {
    // EL9200 / EL9210: fuse holder on top, three rows (must mirror FusedFace)
    const c12 = [W * 0.32, W * 0.68];
    FUSED.labels.forEach((pair, row) => pair.forEach((lb, col) =>
      pts.push({ x: c12[col], y: FUSED.rows[row] + EL12.entry, label: lb, size: 6.2, col, round: true })));
    return { W, pts, block: { cols: c12, el12: true, fused: true } };
  }
  if (d.feed && FEED12[d.id]) {
    // EL9 feeds on the 12 mm face (must mirror El12Face): point i sits in
    // row i >> 1, column i & 1, the same order as the feed groups
    const c12 = [W * 0.32, W * 0.68];
    feedGroupsFor(d).forEach((g, row) => g.labels.forEach((lb, col) =>
      pts.push({ x: c12[col], y: EL12.gTop + row * EL12.gh + EL12.entry, label: lb, size: 6.2, col, round: true })));
    return { W, pts, block: { cols: c12, gTop: EL12.gTop, gh: EL12.gh, el12: true, feed12: true } };
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
  if (d.ed) {
    // ED push-in terminals (must mirror EdFace)
    const ce = [W * 0.31, W * 0.69], n = hd ? 16 : 8;
    for (let p = 0; p < n; p++) {
      const col = p < n / 2 ? 0 : 1;
      pts.push({ x: ce[col], y: edPointY(d, p), label: String(p + 1), size: 6.5, col, round: true, sq: true });
    }
    return { W, pts, block: { cols: ce, ed: true } };
  }
  if (hd && (d.pins || (!d.dist && d.fn !== "sys"))) {
    // HD terminals: the redrawn face (must mirror Hd16Face)
    const c16 = [W * 0.32, W * 0.68];
    for (let p = 0; p < 16; p++) {
      const col = p < 8 ? 0 : 1;
      pts.push({ x: c16[col], y: HD16.rows[p % 8], label: String(p + 1), size: 5.2, col, round: true, r: 5.2, ys: !!d.safety });
    }
    return { W, pts, block: { cols: c16, hd16: true } };
  }
  if (hd) {
    const rows = 8, top = 78, bot = TH - 22, pitch = (bot - top) / rows;
    for (let p = 0; p < 16; p++) {
      const col = p < rows ? 0 : 1, row = p % rows;
      pts.push({ x: cols[col], y: top + pitch * (row + 0.5), label: String(p + 1), size: 5.6, col });
    }
    return { W, pts, block: { cols, top, bot, rows, hd } };
  }
  // TwinSAFE 24 mm (EL2904 / EL2911): two 12 mm halves, clamps 1-8 left,
  // 9-16 right (the manuals' 1'-8')
  if (d.safety && d.w === 24) {
    const c4 = [17, 36, 70, 89];
    for (let p = 0; p < 16; p++) {
      const col = Math.floor(p / 4), row = p % 4;
      pts.push({ x: c4[col], y: EL12.gTop + row * EL12.gh + EL12.entry, label: String(p + 1), size: 6.2, col, round: true, ys: true });
    }
    return { W, pts, block: { cols: c4, gTop: EL12.gTop, gh: EL12.gh, el12: true, el24: true } };
  }
  // 12 mm EL terminals: the redrawn face (must mirror El12Face)
  if ((d.pins || !d.dist) && d.w === 12) {
    const c12 = [W * 0.32, W * 0.68];
    for (let p = 0; p < 8; p++) {
      const col = p < 4 ? 0 : 1, row = p % 4;
      pts.push({ x: c12[col], y: EL12.gTop + row * EL12.gh + EL12.entry, label: String(p + 1), size: 6.2, col, round: true, ys: !!d.safety });
    }
    return { W, pts, block: { cols: c12, gTop: EL12.gTop, gh: EL12.gh, el12: true } };
  }
  // other 8-point terminals share the coupler block's group spacing
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
  if (d.safety && d.pinout) {
    // TwinSAFE (Beckhoff manuals): EK1960 clamps go by their printed name
    const n = Number(lb), q = d.pinout[n - 1];
    const tag = q?.t && d.compact ? `${q.t}` : `Pt ${lb}`;
    if (!q || (!q.r && !q.rel)) return `${tag} — not used, no function`;
    if (q.rel) return `${tag} — relay ${q.rel} make contact, ${q.io === "in" ? "input" : "output"} side (relay option, not simulated)`;
    if (q.r === "clk") return `${tag} — Input ${q.ch}+ · clock output (test pulses) for safe input ${q.ch}`;
    if (q.r === "di") return `${tag} — ${q.safe || !d.coupler || d.compact ? "safe " : "standard "}input ${q.ch}${d.coupler ? "" : ` (Input ${q.ch}−)`}`;
    if (q.r === "do") return `${tag} — ${q.t && !d.compact ? q.t : `${q.safe || !d.coupler || d.compact ? "safe " : "standard "}output ${q.ch}`}${q.sup ? ` from Up${q.sup.slice(1)}` : ""}`;
    if (q.r === "usup") return `${tag} — Up${q.k.slice(1)} +24 V, supply of its four outputs`;
    if (q.r === "link") return `${tag} — ${q.t || `same signal as Pt ${q.to}`}`;
    if (q.r === "us24") return `${tag} — Us +24 V, ${d.compact ? "internal logic and E-bus" : "coupler, E-bus and the power contacts"}`;
    if (q.r === "us0") return `${tag} — Us 0 V (GND)`;
    if (q.r === "up24") return `${tag} — ${q.t || "Up +24 V"}`;
    if (q.r === "up0") return `${tag} — ${q.t || "Up 0 V (GND)"}`;
    if (q.r === "p24") return `${tag} — + power contact (24 V Up)`;
    if (q.r === "gnd") return `${tag} — ${q.t ? `${q.t}, on the − power contact` : "− power contact (GND Up)"}`;
  }
  if (d.coupler && d.pinout) {
    const q = d.pinout[Number(lb) - 1];
    if (!q) return `Pt ${lb} \u2014 not connected`;
    if (q.r === "us24") return `Pt ${lb} \u2014 Us +24 V, coupler and E-bus supply`;
    if (q.r === "us0") return `Pt ${lb} \u2014 Us 0 V`;
    if (q.r === "up24") return `Pt ${lb} \u2014 Up +24 V, feeds the power contacts`;
    if (q.r === "up0") return `Pt ${lb} \u2014 Up 0 V, the \u2212 power contact`;
    if (q.r === "di") return `Pt ${lb} \u2014 digital input ${q.ch} (signal sink)`;
    return `Pt ${lb} \u2014 digital output ${q.ch} (sources +24 V from Up)`;
  }
  if (d.feed && (lb === "NC" || lb === "X")) return "Not used (no internal connection)";
  if (d.feed && lb === "B") return "Bridged to the other B clamp (1 \u2194 5) only";
  if (d.efuse) {
    if (lb[0] === "I") return `DI${lb[1]} \u2014 switches channel ${lb[1]} on / off`;
    if (lb === "O1") return "Protected output 1 \u2014 drives the + power contact";
    if (lb === "O2") return "Protected output 2";
    if (lb === "+") return "+24 V supply in";
    if (lb === "\u2212") return "0 V in (to the 0 V power contact)";
  }
  if (d.sysFilter) {
    if (lb === "S+") return "System +24 V (4 in, 1 filtered out)";
    if (lb === "S\u2212") return "System 0 V (8 in, 5 filtered out)";
    if (lb === "+") return "Field +24 V in \u2014 feeds the + power contact";
    if (lb === "\u2212") return "Field 0 V \u2014 the \u2212 power contact";
  }
  if (d.feed && (d.ac || d.anyV)) {
    if (lb === "L") return d.anyV ? "L \u2014 feed up to 230 V AC/DC to power contacts" : "L \u2014 120\u2026230 V AC feed to power contacts";
    if (lb === "N") return "N \u2014 neutral to power contacts";
    return "PE \u2014 earth power contact";
  }
  if (d.feed && d.uOut) {
    if (lb === "24V") return "+24 V input";
    if (lb === "0V") return "0 V input";
    if (lb === "+") return `U0 output ${d.uOut} V DC (to the power contact)`;
    if (lb === "\u2212") return d.iso ? "0 V output (isolated)" : "0 V output";
    return "PE \u2014 earth power contact";
  }
  if (d.feed && d.ebus > 0 && lb === "24V") return "+24 V for the E-bus supply (Us)";
  if (d.feed && d.ebus > 0 && lb === "0V") return "0 V for the E-bus supply";
  if (d.coupler || d.feed) {
    if (lb === "24V") return "Us +24 V in \u2014 powers coupler & E-bus";
    if (lb === "0V") return "Us 0 V in \u2014 supply return";
    if (lb === "+") return "Up +24 V in \u2014 feeds power contacts (source)";
    if (lb === "\u2212") return "Up 0 V \u2014 power contact return";
    return "PE \u2014 earth power contact";
  }
  if (d.pins) {
    const p = d.pins[Number(lb) - 1];
    if (p === "p24") return `Pt ${lb} \u2014 +24 V (from the + power contact)`;
    if (p === "gnd") return `Pt ${lb} \u2014 0 V (from the \u2212 power contact)`;
    if (p === "pe") return `Pt ${lb} \u2014 PE (from the PE power contact)`;
    if (p === "up") return `Pt ${lb} \u2014 + power contact (any voltage up to 230 V)`;
    if (p === "un") return `Pt ${lb} \u2014 \u2212 power contact (any voltage up to 230 V)`;
    if (p[0] === "r") return `Pt ${lb} \u2014 external resistor`;
    const mates = d.pins.map((q, i) => (q === p && i !== Number(lb) - 1 ? i + 1 : null)).filter(Boolean);
    return `Pt ${lb} \u2014 free bridge, connected to ${mates.join(", ")} only`;
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
  const [aboutOpen, setAboutOpen] = useState(false);
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
      ...d,
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

  // ---- simulation (PLCSIM engine over the drawn station) ----
  const [simOn, setSimOn] = useState(false);
  const setPlc = (patch) => setDoc((d) => ({ ...d, plc: { ...(d.plc || {}), ...patch } })); // not undoable
  const sim = useSim({ enabled: simOn, doc, byId, pos: layout.pos, wireById, runtimeId: doc.plc?.runtime, code: doc.plc?.code });
  const sv = simOn ? sim.view : null;
  useEffect(() => {
    if (!simOn) return undefined;
    const up = () => sim.releaseAll();
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  });
  const toggleSim = () => {
    setSimOn((v) => !v);
    setWireMode(false); setPending(null); setWireCursor(null);
  };
  const actuate = (uid, down) => sim.actuate(uid, layout.pos[uid]?.d, down);

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
        if (d.io === "mix") (d.pinout || []).forEach((p) => { if (p?.r === "di") di++; if (p?.r === "do") do_++; });
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

  // the filtered palette, recomputed only when a filter actually changes
  const palView = useMemo(() => {
    const cos = [];
    let total = 0;
    for (const co of palTree) {
      const cats = co.cats.map((c) => ({ ...c, hits: filt(c.ids) })).filter((c) => c.hits.length);
      if (!cats.length) continue;
      const n = cats.reduce((sum, c) => sum + c.hits.length, 0);
      cos.push({ ...co, cats, total: n });
      total += n;
    }
    return { cos, total };
  }, [palTree, q, brandFilter, srcFilter]);

  return (
    <div style={S.root}>
      <style>{CSS}</style>
      <header style={S.header}>
        <div style={S.brandBlock}>
          <span style={S.brandMark}>SID'S</span>
          <span style={S.brandSub}>EtherCAT Configurator</span>
          <span style={S.brandVer}>v{APP_VERSION}</span>
        </div>
        <div style={S.headerActions}>
          <button style={{ ...S.btnGhost, opacity: past.length ? 1 : 0.4 }} disabled={!past.length} onClick={undo} title="Undo (Ctrl+Z)">↶</button>
          <button style={{ ...S.btnGhost, opacity: future.length ? 1 : 0.4 }} disabled={!future.length} onClick={redo} title="Redo (Ctrl+Y)">↷</button>
          <button style={{ ...S.btnGhost, ...(simOn ? S.btnSim : null) }} onClick={toggleSim}
            title="Run the station: a simulated EtherCAT master executes a PLC program, and inputs, outputs and device lights follow the wiring">
            {simOn ? "■ Stop simulation" : "▶ Simulate"}
          </button>
          <button style={{ ...S.btnGhost, ...(wireMode ? S.btnOn : null), ...(simOn ? { opacity: 0.4 } : null) }} disabled={simOn}
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
          <button style={S.btnGhost} onClick={() => setAboutOpen(true)}
            title="Version, data sources, trademarks and accuracy notice">About</button>
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
            // A search or a manufacturer pick opens what it matched — but only
            // while that stays a sane number of rows. A one-letter query matches
            // most of the catalog, and expanding every company then paints
            // ~1500 buttons on each keystroke; past the limit the companies stay
            // closed with their counts, which is the more useful view anyway.
            const searching = !!q.trim() || brandFilter !== "all";
            const forced = searching && palView.total <= EXPAND_LIMIT;
            const anyHit = palView.cos.length > 0;
            const rows = palView.cos.map((co) => {
              const { cats, total } = co;
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
            if (!anyHit) return (
              <div style={{ fontSize: 12, color: C.muted, padding: "6px 2px" }}>
                Nothing matches that search and filter combination.
              </div>
            );
            return (
              <>
                {searching && !forced && (
                  <div style={{ fontSize: 11, color: C.muted, margin: "-2px 0 8px", lineHeight: 1.4 }}>
                    {palView.total} matches in {palView.cos.length} {palView.cos.length === 1 ? "company" : "companies"} —
                    open one, or narrow the search to expand them automatically.
                  </div>
                )}
                {rows}
              </>
            );
          })()}
        </aside>

        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
        <main style={{ ...S.stage, flex: 1, minHeight: 0 }} className="scroll">
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
              <linearGradient id="cplrbody" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#E6E8EA" /><stop offset="0.6" stopColor="#DCDFE2" /><stop offset="1" stopColor="#CDD1D5" />
              </linearGradient>
              <linearGradient id="rjshield" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#EEF0F2" /><stop offset="1" stopColor="#B8BDC2" />
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
                  <rect x="8" y={y + RAIL_Y} width={layout.canvasW - 16} height="28" fill="url(#railg)" />
                  <rect x="8" y={y + RAIL_Y} width={layout.canvasW - 16} height="1.6" fill="#FAFBFC" />
                  <rect x="8" y={y + RAIL_Y + 26} width={layout.canvasW - 16} height="2" fill="#767C82" />
                  {Array.from({ length: Math.floor((layout.canvasW - 30) / 26) }).map((_, i) => (
                    <rect key={i} x={18 + i * 26} y={y + RAIL_Y + 9} width="12" height="10" rx="2.5" fill="#878D93" stroke="#6E747A" strokeWidth="0.6" />
                  ))}
                  {rail.items.length === 0 && (
                    <text x={layout.canvasW / 2} y={y + 140} fill={C.muted} fontSize="12" textAnchor="middle">
                      Empty rail — select it and add devices from the palette
                    </text>
                  )}
                  {rail.items.map((inst) => (
                    <TerminalG key={inst.uid} inst={inst} layout={layout} selected={selected === inst.uid}
                      wireMode={wireMode} pending={pending} wiredPts={wiredPts} powered={poweredUids.has(inst.uid)}
                      sim={sv ? sv.term[inst.uid] || {} : null}
                      dragging={dragVis?.uid === inst.uid}
                      onSelect={() => { setSelected(inst.uid); setSelWire(null); }}
                      onDetail={() => setDetail(inst.uid)}
                      onDragStart={simOn ? null : (e) => startDragTerm(inst.uid, e)}
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
                  {sv && SIM_GLOW[sv.wires[w.id]] && (
                    <path d={path} fill="none" stroke={SIM_GLOW[sv.wires[w.id]]} strokeWidth={t.w + 5} opacity="0.42" strokeLinecap="round" pointerEvents="none" />
                  )}
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
                  sim={sv ? sv.dev[f.uid] || {} : null}
                  actuator={simOn && !!actuatorKind(layout.pos[f.uid]?.d)}
                  onSelect={() => { setSelected(f.uid); setSelWire(null); }}
                  onDragStart={simOn ? (e) => { if (actuate(f.uid, true)) e.stopPropagation(); } : (e) => startDragFree(f.uid, e)}
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
        {simOn && (
          <SimPanel sim={sim} code={sim.code} setCode={(code) => setPlc({ code })}
            runtimeId={doc.plc?.runtime} setRuntime={(runtime) => setPlc({ runtime: runtime || undefined })}
            onReset={() => setPlc({ code: undefined })} />
        )}
        </div>

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
                    {selD.etgCert
                      ? " Listed as certified in the ETG product guide."
                      : " Certification status is not listed in the ETG product guide (the guide is incomplete; this is not a statement that the product is uncertified)."}
                  </div>
                )}
                {/* a directory part's description only repeats the note above */}
                {selD.desc && !selD.etg && <div style={S.inspDesc}>{selD.desc}</div>}
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
      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
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
// a state is true / false, "blink" (2.5 Hz), "flash" (single flash, EtherCAT
// SAFEOP) or "red" (error). Blinking uses SMIL so the screenshot tool can
// freeze it on a fixed frame.
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
            <rect x={lx - 3.4} y={ly - 1.8} width="6.8" height="3.6" rx="0.8" fill={M.ledOff} />
            {on && (
              <g>
                <rect x={lx - 3.4} y={ly - 1.8} width="6.8" height="3.6" rx="0.8" fill={on === "red" ? "#FF3B30" : M.ledOn} />
                <rect x={lx - 3.4} y={ly - 1.8} width="6.8" height="3.6" rx="0.8" fill={on === "red" ? "#FF3B30" : M.ledOn} opacity="0.5" filter="blur(2px)" />
                {(on === "blink" || on === "flash") && (
                  <animate attributeName="opacity" values={on === "blink" ? "1;1;0;0" : "1;0;0;0;0"} dur={on === "blink" ? "0.4s" : "1.2s"} calcMode="discrete" repeatCount="indefinite" />
                )}
              </g>
            )}
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
    if (d.pcFeed) { push(); g = { x0: L, volt: d.ac ? "230" : d.anyV ? "any" : d.uOut ? String(d.uOut) : "24", src: d.id, r: R }; continue; }
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

  const pcColor = (v) => (v === "230" ? "#E8781E" : v === "24" ? "#2E9E5B" : v === "any" ? "#8A7A2E" : v ? "#5B7FA6" : "#9AA0A6");
  const pcText = (v) => (v === "230" ? "230 V" : v === "24" ? "24 V" : v === "any" ? "≤ 230 V AC/DC" : v ? `${v} V` : "no feed");

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

function TerminalG({ inst, layout, selected, wireMode, pending, wiredPts, powered = true, sim = null, dragging, onSelect, onDetail, onDragStart, onPointDown, onPointUp, onHover, onLeave }) {
  const t = layout.pos[inst.uid];
  if (!t) return null;
  const { d, geom } = t;
  const W = geom.W;
  const uid = inst.uid;
  // TwinSAFE housings are yellow, except the EK1914 (grey, a yellow insert under its safe clamps)
  const body = d.psu ? "url(#psbody)" : d.safety && !(d.coupler && !d.compact) ? "url(#ybody)" : "url(#tbody)";
  const hd16 = !!geom.block?.hd16, ed = !!geom.block?.ed;
  const cap = !!geom.block?.cap; // EL9011 / EL9012 end cover
  const sep = !!geom.block?.sep; // EL9080 separation terminal
  const cplr = geom.block?.cplr ? geom.block : null; // M7 coupler / extension / junction
  const compact = !!geom.block?.compact; // EK1960
  const el12 = !!geom.block?.el12 || hd16 || ed || cap || sep || !!cplr || compact; // the M7 12 mm housing
  const yHooks = d.safety && (!d.coupler || compact); // TwinSAFE latch hooks are yellow
  const blockRight = !cplr || cplr.bx === W - 53; // E-bus springs and release tab on the right

  return (
    <g transform={`translate(${t.x}, ${t.y + (selected ? -8 : 0)})`} data-uid={uid}
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

      {/* latch hooks above and below the 12 mm EL housing */}
      {el12 && !(cplr && cplr.bx == null) && [-7.5, TH - 1.5].map((y) => {
        const x0 = cplr ? cplr.bx : 0, w = cplr ? 53 : W;
        return (
          <g key={y}>
            <rect x={x0 + 3} y={y} width={w - 6} height="9" rx="1" fill={yHooks ? "#F2C414" : "#F3F4F5"} stroke={yHooks ? "#C99A00" : "#A9ADB1"} strokeWidth="0.5" />
            <rect x={x0 + Math.min(9, w / 2 - 4)} y={y + 2.7} width={Math.max(8, w - 18)} height="3.6" rx="0.6" fill={yHooks ? "#D9A90A" : "#C5C9CC"} />
          </g>
        );
      })}

      {/* housing */}
      <rect x="0.5" y={el12 ? 0 : 1.5} width={W - 1} height={el12 ? TH : TH - 3} rx={el12 ? 1.5 : 3} fill={body} stroke={selected ? C.ink : el12 ? "#A3A7AB" : M.hEdge} strokeWidth={selected ? 1.6 : el12 ? 0.6 : 0.9} />
      <rect x="2" y="3" width="1" height={TH - 8} fill={M.hi} />
      {!el12 && <rect x={W - 3} y="3" width="1" height={TH - 8} fill={M.groove} />}
      {/* silver rail-latch nub near rail line */}
      {!el12 && <rect x="-1.2" y={190} width="3" height="12" rx="1.2" fill="#C9CDD2" stroke="rgba(0,0,0,0.25)" strokeWidth="0.5" />}

      {compact ? <CompactFace d={d} W={W} sim={sim} /> :
        d.coupler && cplr ? <CouplerM7Face d={d} W={W} geom={geom} sim={sim} /> :
        cplr && d.extM7 ? <ExtensionFace d={d} W={W} sim={sim} /> :
        cplr && d.jM7 ? <JunctionFace d={d} W={W} sim={sim} /> :
        d.coupler ? <CouplerFace d={d} W={W} uid={uid} sim={sim} /> :
        d.psu ? <PsuFace d={d} W={W} sim={sim} /> :
        d.cx ? <CxFace d={d} W={W} sim={sim} /> :
        cap ? <EndCoverFace d={d} W={W} /> :
        sep ? <SeparationFace d={d} W={W} /> :
        d.endcap || d.blank ? <PlainFace d={d} W={W} /> :
        d.ext || d.junction || d.rj ? <RjTermFace d={d} W={W} sim={sim} /> :
        <ElFace d={d} W={W} uid={uid} geom={geom} wiredPts={wiredPts} powered={powered} sim={sim} />}

      {/* interactive clamp points + network ports */}
      {geom.pts.map((p, i) => {
        const isPending = pending && pending.uid === uid && pending.pt === i;
        const ptHandlers = {
          onPointerDown: (e) => { if (wireMode) { e.stopPropagation(); onPointDown(uid, i); } },
          onPointerUp: (e) => { if (wireMode) { e.stopPropagation(); onPointUp(uid, i); } },
          onMouseEnter: () => onHover(uid, i),
          onMouseLeave: onLeave,
        };
        // inert addressing for automation (scripts/shots): device uid on the
        // root group, point index + label here
        const ptData = { "data-pt": i, "data-label": p.label };
        if (p.port) {
          return (
            <g key={i} {...ptHandlers} {...ptData} style={{ cursor: wireMode ? "crosshair" : "help" }}>
              {isPending && <rect x={p.x - 21} y={p.y - 17} width="42" height="34" rx="3" fill="none" stroke="#D71920" strokeWidth="1.4" strokeDasharray="3 2" />}
              <rect x={p.x - 20} y={p.y - 16} width="40" height="32" fill="transparent">
                <title>{pointRole(d, p)}</title>
              </rect>
            </g>
          );
        }
        if (p.round) {
          return (
            <g key={i} {...ptHandlers} {...ptData} style={{ cursor: wireMode ? "crosshair" : "help" }}>
              {p.sq ? <PushIn x={p.x} y={p.y} hl={isPending} /> : p.plug ? <PlugHole x={p.x} y={p.y} hl={isPending} /> : <RoundClamp x={p.x} y={p.y} r={p.r} hl={isPending} ys={p.ys} />}
              <rect x={p.x - (p.plug ? 7 : p.sq ? 8 : p.r ? 7.5 : 9.5)} y={p.y - (p.plug ? 5.5 : p.sq ? 18.5 : p.r ? 15.5 : 27)} width={p.plug ? 22 : p.sq ? 16 : p.r ? 15 : 19} height={p.plug ? 11 : p.sq ? 26 : p.r ? 22 : 36} fill="transparent">
                <title>{pointRole(d, p)}</title>
              </rect>
            </g>
          );
        }
        return (
          <g key={i} {...ptHandlers} {...ptData} style={{ cursor: wireMode ? "crosshair" : "help" }}>
            <ClampUnit x={p.x} y={p.y} size={p.size} hl={isPending} />
            <rect x={p.x - 9.5} y={p.y - p.size * 2.2 - 3} width="19" height={p.size * 3.6 + 6} fill="transparent">
              <title>{pointRole(d, p)}</title>
            </rect>
          </g>
        );
      })}

      {/* 12 mm EL sides: E-bus springs and the orange release tab on the
          right, the three power contacts (+24 V, 0 V, PE) on the left */}
      {el12 && !cap && (
        <g>
          {!ed && blockRight && [0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} x={W - 1.4} y={hd16 ? 38 + i * 11 : 29 + i * 14} width="2.6" height={hd16 ? 5 : 6} rx="0.6" fill="#CDD0D3" stroke="#979B9F" strokeWidth="0.4" />
          ))}
          {!sep && blockRight && <rect x={W - 2} y={hd16 || ed ? 206 : 208} width="4.2" height={hd16 ? 22 : 30} rx="1.6" fill={ed ? "#EE7A3C" : "#F0961C"} stroke={ed ? "#B9561F" : "#BF730E"} strokeWidth="0.5" />}
          {(sep || cplr || compact ? [] : ed ? [168, 232] : hd16 ? [179, 241] : d.noPE ? [179, 246] : [179, 246, 310]).map((y) => (
            <rect key={y} x="-0.9" y={y} width="2.4" height="8" rx="0.5" fill={d.safety ? "#B08304" : "#9A9EA2"} />
          ))}
        </g>
      )}
      {/* gold power contact blades on right edge */}
      {!el12 && !d.endcap && !d.blank && !d.psu && [0, 1, 2].map((i) => (
        <rect key={i} x={W - 1.8} y={168 + i * 26} width="3.2" height="15" rx="1" fill={M.gold} stroke={M.goldDk} strokeWidth="0.5" />
      ))}
      {/* orange release latch on right edge */}
      {!el12 && !d.endcap && !d.blank && !d.psu && (
        <rect x={W - 2.4} y={128} width="4.8" height="22" rx="2" fill={M.org} stroke={M.orgDk} strokeWidth="0.6" />
      )}
    </g>
  );
}

/* --- standard EL terminal face -------------------------------------- */
// LED slot → channel (0-based): four-channel terminals pair LEDs across
// (1 2 / 3 4); on eight- and sixteen-channel ones each LED sits over a clamp
// column, so it shows the channel wired to that column's clamp — which the
// verified pinout gives (EL1008: 1 3 5 7 left, 2 4 6 8 right).
const ledChannel = (slot, d) => {
  if (d.ch <= 4) return slot;
  const idx = (slot % 2) * (d.ch / 2) + Math.floor(slot / 2);
  const p = d.pinout?.[idx];
  return p?.ch ? p.ch - 1 : idx;
};

// clamp point index (0-based) that carries channel c (0-based)
const SIGNAL_ROLES = ["di", "do", "ai", "ao"];
const channelPoint = (d, c) => {
  if (!d.pinout) return c;
  const i = d.pinout.findIndex((p) => p?.ch === c + 1 && SIGNAL_ROLES.includes(p.r));
  return i < 0 ? c : i;
};

// colour tab over a 12 mm EL clamp, from the verified pinout. Without one
// the tab only shows the clamp number, so nothing unverified is claimed.
const EL12_TAB = {
  sig: { fill: "#DCD13B", edge: "#A39A22", ink: "#2A2A22" },
  p24: { fill: "#D3262B", edge: "#9B191D", ink: "#FFFFFF" },
  gnd: { fill: "#2C7BC0", edge: "#1D5A90", ink: "#FFFFFF" },
  pe:  { fill: "#BCA957", edge: "#8A7C3B", ink: "#3A3420" },
  none: { fill: "#C9CBCE", edge: "#9A9EA2", ink: "#3A3F44" },
};
const FEED_TAB = {
  "24V": { ...EL12_TAB.p24, text: "24V", fs: 6.4 },
  "0V": { ...EL12_TAB.gnd, text: "0V", fs: 6.4 },
  "+": { ...EL12_TAB.p24, text: "+", fs: 9 },
  "−": { ...EL12_TAB.gnd, text: "−", fs: 9 },
  "⏚": { ...EL12_TAB.pe, text: "⏚", fs: 8 },
  L: { fill: "#B3B51B", edge: "#85870F", ink: "#2A2B10", text: "L", fs: 7 },
  N: { fill: "#B3B51B", edge: "#85870F", ink: "#2A2B10", text: "N", fs: 7 },
  NC: { fill: "#A19D9A", edge: "#7E7A77", ink: "#A19D9A", text: "", fs: 6 },
};
const DIST_TAB = { p24: "+", up: "+", gnd: "−", un: "−", pe: "⏚" };
// TwinSAFE tab texts as printed on the product pictures (EL1904 I1-I8 across
// the rows, EL2904 O1-O8 on its right half, plain grey tabs elsewhere)
const TS_OLIVE = (t) => ({ fill: "#B3B31C", edge: "#85860F", ink: "#2A2B10", text: t, fs: 6.4 });
const TS_GREY = { fill: "#A8A4A1", edge: "#7E7A77", ink: "#A8A4A1", text: "", fs: 6 };
const tsRows = (n0, pre) => Object.fromEntries([0, 1, 2, 3].flatMap((r) => [[n0 + r + 1, TS_OLIVE(`${pre}${r * 2 + 1}`)], [n0 + r + 5, TS_OLIVE(`${pre}${r * 2 + 2}`)]]));
const tsGrey = (a, b) => Object.fromEntries(Array.from({ length: b - a + 1 }, (_, i) => [a + i, TS_GREY]));
const TS_TABS = {
  EL1904: tsRows(0, "I"),
  EL2904: { ...tsGrey(1, 8), ...tsRows(8, "O") },
  EL2911: tsGrey(1, 16),
  EL2912: tsGrey(1, 8),
};
// yellow TwinSAFE housing parts
const TS_Y = { push: "#E7B10E", pushEdge: "#B98A05", slot: "#6B500C", entry: "#DDA70A", entryEdge: "#B08304", hole: "#3B2E0E", num: "#5E4A08", win: "#D8C21A", winEdge: "#A8960C" };
// EK1960 I/O module left edges (X5-X9), shared by pointGeom and CompactFace
const TS_MODS = [345, 475, 605, 735, 865];
function el12Tab(d, n) {
  if (d.safety) return TS_TABS[d.id]?.[n] || { hide: true };
  if (d.coupler) return FEED_TAB[FEED_GROUPS[(n - 1) % 4].labels[n > 4 ? 1 : 0]];
  if (FEED12[d.id]) {
    const lb = feedGroupsFor(d)[(n - 1) % 4].labels[n > 4 ? 1 : 0];
    return { ...FEED_TAB[lb], ...FEED12[d.id].tabs?.[lb] };
  }
  if (d.pins) {
    // EL9186 / EL9187 carry olive marker tabs numbered across the rows
    // (01 02 / 03 04 …), the others show their potential
    if (PIN_TABS[d.id]?.[n]) return PIN_TABS[d.id][n];
    if (d.distTabs === "num") return { ...FEED_TAB.L, text: `0${((n - 1) % 4) * 2 + (n <= 4 ? 1 : 2)}`, fs: 6.4 };
    return FEED_TAB[DIST_TAB[d.pins[n - 1]] || "NC"];
  }
  const p = d.pinout?.[n - 1];
  const sig = { di: "I", do: "O", ai: "AI", ao: "AO" };
  if (p && sig[p.r]) return { ...EL12_TAB.sig, text: `${sig[p.r]}${p.ch ?? ""}`, fs: p.r.length > 1 && p.r[0] === "a" ? 6 : 7 };
  if (p?.r === "p24") return { ...EL12_TAB.p24, text: "+", fs: 9 };
  if (p?.r === "gnd") return { ...EL12_TAB.gnd, text: "−", fs: 9 };
  if (p?.r === "agnd") return { ...EL12_TAB.gnd, text: "GND", fs: 5.6 };
  if (p?.r === "pe") return { ...EL12_TAB.pe, text: "⏚", fs: 8 };
  return { ...EL12_TAB.none, text: String(n), fs: 6.4 };
}

// round wire entry of a 12 mm EL clamp (the clickable wiring point)
function RoundClamp({ x, y, hl, r, ys }) {
  const hd = !!r, R = r || 6.2;
  return (
    <g>
      {hl && (hd
        ? <rect x={x - 7.5} y={y - 15.5} width="15" height="22" rx="2" fill="none" stroke="#D71920" strokeWidth="1.4" strokeDasharray="3 2" />
        : <rect x={x - 9.5} y={y - 27} width="19" height="36" rx="2" fill="none" stroke="#D71920" strokeWidth="1.4" strokeDasharray="3 2" />)}
      <circle cx={x} cy={y} r={R} fill={ys ? TS_Y.entry : "#9EA2A6"} stroke={ys ? TS_Y.entryEdge : "#7C8084"} strokeWidth="0.5" />
      <circle cx={x} cy={y} r={R * 0.7} fill={ys ? TS_Y.hole : "#2E3134"} />
    </g>
  );
}

// wire opening of a black spring plug (EK1960 X3-X9)
function PlugHole({ x, y, hl }) {
  return (
    <g>
      {hl && <rect x={x - 6.5} y={y - 6} width="21" height="12" rx="2" fill="none" stroke="#D71920" strokeWidth="1.4" strokeDasharray="3 2" />}
      <circle cx={x} cy={y} r="4.4" fill="#0E1012" stroke="#4A4E52" strokeWidth="0.5" />
    </g>
  );
}

// square push-in opening of an ED clamp (the clickable wiring point)
function PushIn({ x, y, hl }) {
  return (
    <g>
      {hl && <rect x={x - 8} y={y - 18.5} width="16" height="26" rx="2" fill="none" stroke="#D71920" strokeWidth="1.4" strokeDasharray="3 2" />}
      <rect x={x - 6.5} y={y - 6.5} width="13" height="13" rx="0.8" fill="#D9DCDF" stroke="#A3A7AB" strokeWidth="0.5" />
      <rect x={x - 4.5} y={y - 4.5} width="9" height="9" rx="0.5" fill="#7D8185" />
      <rect x={x - 4.5} y={y - 4.5} width="9" height="1.6" rx="0.5" fill="#55595D" />
    </g>
  );
}

// ED marker-label colour by signal type, as on Beckhoff's ED terminals:
// inputs yellow, outputs red, analog inputs green, analog outputs blue
const ED_MARK = { di: ["#EBC31E", "#B8941A"], do: ["#D8322E", "#9E1F1C"], ai: ["#3DAF4B", "#28803A"], ao: ["#2F7FD0", "#1F5C9A"] };
// EL marker labels by signal type (checked against Beckhoff pictures: EL1008
// yellow, EL2008 red, EL3004 green, EL4004 blue). Inputs and mixed keep the
// approved EL yellow.
const elMark = (d) => {
  if (d.coupler) return ["#C96E14", "#94500B"]; // couplers: orange
  // TwinSAFE (product pictures): olive on safe inputs, red on safe outputs, grey on the logic
  if (d.safety) return !d.io ? ["#A8A4A1", "#7E7A77"] : d.io === "di" ? ["#B9B81E", "#878710"] : ["#D3262B", "#9B191D"];
  const f = FEED12[d.id];
  if (f) return f.mark === "grey" ? ["#A8A4A1", "#7E7A77"] : ["#C96E14", "#94500B"]; // feeds: orange, EL9410 grey
  if (d.pins) return ["#A8A4A1", "#7E7A77"]; // distribution: grey
  return d.io === "do" || d.io === "ai" || d.io === "ao" ? ED_MARK[d.io] : ["#DCD13B", "#A39A22"];
};

// ED push-in face (M7, confirmed on the ED1008 and ED1859). Geometry
// mirrors pointGeom's ED branch; LED n sits beside clamp n's column.
function EdFace({ d, W, cols, states }) {
  const n = d.hd ? 16 : 8, rows = n / 2;
  const [mk, mkE] = ED_MARK[d.io] || ED_MARK.di;
  // an illustrative Data Matrix pattern, stable per part (not a real code)
  let seed = [...d.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
  const dots = [];
  for (let cx = 0; cx < 26; cx++) for (let cy = 0; cy < 7; cy++)
    if (cx === 0 || cy === 6 || rnd() < 0.45) dots.push(<rect key={`${cx}-${cy}`} x={W / 2 - 13 + cx} y={2.4 + cy} width="1" height="1" fill="#1E2124" />);
  const top = 29.5, h = rows === 4 ? 44 : 46, pitch = (h - 6) / rows;
  const sig = { di: "I", do: "O", ai: "AI", ao: "AO" };
  return (
    <g>
      {ED.g.map((g) => <rect key={g} x="3" y={g - 4} width={W - 6} height="58" rx="1.2" fill="#ECEEF0" stroke="#C3C7CB" strokeWidth="0.5" />)}
      <rect x={W / 2 - 14} y="1.6" width="28" height="8.4" rx="0.6" fill="#FFFFFF" stroke="#C3C7CB" strokeWidth="0.4" />
      {dots}
      <rect x="4.5" y="11.5" width="21.5" height="15.5" rx="1" fill={mk} stroke={mkE} strokeWidth="0.5" />
      <rect x={W - 26} y="11.5" width="21.5" height="15.5" rx="1" fill={mk} stroke={mkE} strokeWidth="0.5" />
      <rect x={W / 2 - 9.5} y={top} width="19" height={h} rx="1" fill="#D3E3CC" stroke="#A9BBA2" strokeWidth="0.5" />
      <rect x={W / 2 - 7.9} y={top + 1.6} width="15.8" height={h - 3.2} rx="0.6" fill="#5B5F63" />
      {Array.from({ length: n }).map((_, s) => {
        const c = s < rows ? 0 : 1, r = s % rows;
        const y = top + 3 + r * pitch + (pitch - 3.4) / 2, x = c ? W / 2 + 1.3 : W / 2 - 6.3, on = states[s];
        const col = on === "red" ? "#FF3B30" : "#B7EE3F";
        return (
          <g key={s}>
            <rect x={x} y={y} width="5" height="3.4" rx="0.5" fill="#747A7F" />
            {on && <rect x={x} y={y} width="5" height="3.4" rx="0.5" fill={col} />}
            {on && <rect x={x} y={y} width="5" height="3.4" rx="0.5" fill={col} opacity="0.55" filter="blur(1.2px)" />}
            <text x={c ? W - 11.5 : 11.5} y={y + 2.9} fill="#3A3F44" fontSize={rows === 4 ? 5.2 : 3.9} fontWeight="500" fontFamily="system-ui" textAnchor="middle">{s + 1}</text>
          </g>
        );
      })}
      {Array.from({ length: n }).map((_, s) => {
        const ci = s < rows ? 0 : 1, cx = cols[ci], y = edPointY(d, s), by = y - (d.hd ? 16.5 : 17.5);
        const p = d.pinout?.[s];
        const tab = !d.hd && (p && sig[p.r] ? { fill: "#EBC31E", edge: "#B8941A", ink: "#1E1E16", text: `${sig[p.r]}${p.ch ?? ""}`, fs: p.r[0] === "a" ? 7 : 9 }
          : p?.r === "p24" ? { ...EL12_TAB.p24, text: "+", fs: 10 } : p?.r === "gnd" ? { ...EL12_TAB.gnd, text: "\u2212", fs: 10 }
          : p?.r === "pe" ? { ...EL12_TAB.pe, text: "\u23DA", fs: 9 } : { ...EL12_TAB.none, text: String(s + 1), fs: 7.5 });
        return (
          <g key={s}>
            {tab && <rect x={cx - 10.25} y={y - 41.5} width="20.5" height="17" rx="1" fill={tab.fill} stroke={tab.edge} strokeWidth="0.5" />}
            {tab && <text x={cx} y={y - 41.5 + 8.5 + tab.fs * 0.36} fill={tab.ink} fontSize={tab.fs} fontWeight="600" fontFamily="system-ui" textAnchor="middle">{tab.text}</text>}
            <rect x={cx - 6.5} y={by} width="13" height="7.5" rx="0.8" fill="#EE7A3C" stroke="#B9561F" strokeWidth="0.5" />
            <rect x={cx - 5.5} y={by + 3} width="11" height="0.7" fill="#B9561F" opacity="0.7" />
            <rect x={cx - 5.5} y={by + 5} width="11" height="0.7" fill="#B9561F" opacity="0.7" />
            <circle cx={cx - 0.5} cy={by + 0.6} r="1.7" fill="#2B2E31" />
            <text x={cx + 9.1} y={by + 6.6} fill="#3A3F44" fontSize="4.6" fontWeight="500" fontFamily="system-ui" textAnchor="middle">{s + 1}</text>
          </g>
        );
      })}
      <text x="5" y={TH - 13.8} fill="#2B2F33" fontSize="6" fontWeight="800" fontFamily="system-ui" style={{ letterSpacing: "0.2px" }}>BECKHOFF</text>
      <text x="5" y={TH - 5.6} fill="#2B2F33" fontSize="5.6" fontWeight="600" fontFamily="ui-monospace,monospace">{d.id}</text>
    </g>
  );
}

// index into sim.ch (channel key n - 1) for clamp point s, or -1
function pointChannelIdx(d, s) {
  const p = d.pinout?.[s];
  if (d.io === "mix") return p && SIGNAL_ROLES.includes(p.r) ? s : -1;
  if (d.pinout) return p && SIGNAL_ROLES.includes(p.r) ? p.ch - 1 : -1;
  return d.io && s < d.ch ? s : -1;
}

// HD 16-point face (M7, confirmed on the EL1859 pilot). Rows mirror
// pointGeom's hd16 branch; LED n sits beside signal n, 1-8 left, 9-16 right.
function Hd16Face({ d, W, cols, states, print = true }) {
  const beckhoff = print && (!d.brand || d.brand === "beckhoff");
  const ysRow = (row) => !!d.safety && (!d.coupler || row >= 5);
  return (
    <g>
      {d.safety && d.coupler && <rect x="1" y="251" width={W - 2} height={TH - 252} rx="1" fill="url(#ybody)" stroke="#C99A00" strokeWidth="0.5" />}
      {print && <text x={W / 2} y="9.2" fill="#2B2F33" fontSize="6.4" fontWeight="700" fontFamily="ui-monospace,monospace" textAnchor="middle">{d.id}</text>}
      <rect x="4.5" y="12" width="20.5" height="12" rx="1" fill={elMark(d)[0]} stroke={elMark(d)[1]} strokeWidth="0.5" />
      <rect x={W - 25} y="12" width="20.5" height="12" rx="1" fill={elMark(d)[0]} stroke={elMark(d)[1]} strokeWidth="0.5" />
      <rect x={W / 2 - 13.5} y="28" width="27" height="72" rx="1.5" fill={d.safety && !d.coupler ? TS_Y.win : "#C9CCCF"} stroke={d.safety && !d.coupler ? TS_Y.winEdge : "#999DA1"} strokeWidth="0.5" />
      <rect x={W / 2 - 11.5} y="30" width="23" height="68" rx="1" fill={d.pins ? "#4F5859" : "#2C2F32"} />
      {!d.pins && Array.from({ length: 16 }).map((_, s) => {
        const c = s < 8 ? 0 : 1, y = 32.5 + (s % 8) * 8.4, x = W / 2 - 10 + c * 11, on = states[s];
        const col = on === "red" ? "#FF3B30" : "#46E36E";
        return (
          <g key={s}>
            <rect x={x} y={y} width="9" height="4.5" rx="0.7" fill="#4A4E52" />
            {on && <rect x={x} y={y} width="9" height="4.5" rx="0.7" fill={col} />}
            {on && <rect x={x} y={y} width="9" height="4.5" rx="0.7" fill={col} opacity="0.55" filter="blur(1.6px)" />}
            <text x={c ? W - 9 : 9.6} y={y + 3.6} fill="#51565B" fontSize="4.2" fontWeight="600" fontFamily="system-ui" textAnchor="middle">{s + 1}</text>
          </g>
        );
      })}
      {HD16.rows.map((cy, row) => cols.map((cx, ci) => (
        <g key={`${row}-${ci}`}>
          <rect x={cx - 6.5} y={cy - 14.5} width="13" height="8.5" rx="1" fill={ysRow(row) ? TS_Y.push : "#B3B7BB"} stroke={ysRow(row) ? TS_Y.pushEdge : "#8C9094"} strokeWidth="0.5" />
          <rect x={cx - 4.5} y={cy - 12.5} width="9" height="4.5" rx="0.6" fill={ysRow(row) ? TS_Y.slot : "#585C60"} />
          <text x={cx - 9} y={cy - 9} fill={ysRow(row) ? TS_Y.num : "#51565B"} fontSize="4.2" fontWeight="600" fontFamily="system-ui" textAnchor="middle">{ci * 8 + row + 1}</text>
        </g>
      )))}
      {beckhoff && <text x={W / 2} y="185.2" fill="#2B2F33" fontSize="5.6" fontWeight="800" fontFamily="system-ui" textAnchor="middle" style={{ letterSpacing: "0.3px" }}>BECKHOFF</text>}
      <rect x="2.5" y="244.4" width={W - 5} height="0.7" fill="#B9BDC1" />
    </g>
  );
}

// 12 mm EL terminal face (M7, confirmed on the EL1002 pilot). Geometry
// mirrors pointGeom's el12 branch: rows at EL12.gTop + row·gh, each a tab,
// a release button and the wire entry (drawn by TerminalG).
function El12Face({ d, W, cols, states, print = true, n0 = 0 }) {
  const led = (on, x, y, key) => {
    const col = on === "red" ? "#FF3B30" : "#46E36E";
    return (
      <g key={key}>
        <rect x={x} y={y} width="14" height="5" rx="0.8" fill="#4A4E52" />
        {on && (
          <g>
            <rect x={x} y={y} width="14" height="5" rx="0.8" fill={col} />
            <rect x={x} y={y} width="14" height="5" rx="0.8" fill={col} opacity="0.55" filter="blur(2px)" />
            {(on === "blink" || on === "flash") && (
              <animate attributeName="opacity" values={on === "blink" ? "1;1;0;0" : "1;0;0;0;0"} dur={on === "blink" ? "0.4s" : "1.2s"} calcMode="discrete" repeatCount="indefinite" />
            )}
          </g>
        )}
      </g>
    );
  };
  const beckhoff = print && (!d.brand || d.brand === "beckhoff");
  return (
    <g>
      {/* marker labels */}
      <rect x="4.5" y="6" width="20.5" height="13" rx="1" fill={elMark(d)[0]} stroke={elMark(d)[1]} strokeWidth="0.5" />
      <rect x={W - 25} y="6" width="20.5" height="13" rx="1" fill={elMark(d)[0]} stroke={elMark(d)[1]} strokeWidth="0.5" />
      {/* LED window: 4 rows × 2, slot s at row ⌊s/2⌋, column s mod 2 */}
      <rect x="6" y="23" width={W - 12} height="40" rx="1.5" fill={d.safety ? TS_Y.win : "#C9CCCF"} stroke={d.safety ? TS_Y.winEdge : "#999DA1"} strokeWidth="0.5" />
      <rect x="8" y="25" width={W - 16} height="36" rx="1" fill="#2C2F32" />
      {Array.from({ length: 8 }).map((_, s) => led(states[s] || false, cols[s % 2] - 7, 27.5 + Math.floor(s / 2) * 8.5, s))}
      {/* clamp rows */}
      {[0, 1].map((ci) => [0, 1, 2, 3].map((row) => {
        const n = n0 + ci * 4 + row + 1, g = EL12.gTop + row * EL12.gh, cx = cols[ci], t = el12Tab(d, n), ys = !!d.safety;
        return (
          <g key={n}>
            {!t.hide && <rect x={cx - 9.5} y={g} width="19" height="11" rx="1" fill={t.fill} stroke={t.edge} strokeWidth="0.5" />}
            {!t.hide && <text x={cx} y={g + 5.5 + t.fs * 0.36} fill={t.ink} fontSize={t.fs} fontWeight="700" fontFamily="system-ui" textAnchor="middle">{t.text}</text>}
            <rect x={cx - 7} y={g + 15} width="14" height="13" rx="1.2" fill={ys ? TS_Y.push : "#B3B7BB"} stroke={ys ? TS_Y.pushEdge : "#8C9094"} strokeWidth="0.5" />
            <rect x={cx - 5} y={g + 17} width="10" height="8" rx="0.8" fill={ys ? TS_Y.slot : "#585C60"} />
            <text x={cx - 8.2} y={g + 33.6} fill={ys ? TS_Y.num : "#51565B"} fontSize="4.4" fontWeight="600" fontFamily="system-ui" textAnchor="middle">{n}</text>
          </g>
        );
      }))}
      {/* part print */}
      {print && <text x={W / 2} y={TH - 20.5} fill="#2B2F33" fontSize={d.id.length > 6 ? 5 : 6.4} fontWeight="700" fontFamily="ui-monospace,monospace" textAnchor="middle">{d.id}</text>}
      {beckhoff && <text x={W / 2} y={TH - 12} fill="#2B2F33" fontSize="5.6" fontWeight="800" fontFamily="system-ui" textAnchor="middle" style={{ letterSpacing: "0.3px" }}>BECKHOFF</text>}
    </g>
  );
}

function ElFace({ d, W, uid, geom, wiredPts, powered = true, sim = null }) {
  const b = geom.block || {};
  const cols = b.cols || [W * 0.30, W * 0.70];
  const isFeedLike = !!d.feed;
  // LEDs light only when the terminal actually receives power/E-bus; a dead
  // (stranded) terminal keeps its LED dots but shows them all off.
  // While simulating, a channel LED shows that channel's real state.
  const ledStates = [];
  if (sim) {
    if (d.io && sim.ch) for (let s = 0; s < d.ch; s++) ledStates.push(!!sim.ch[ledChannel(s, d)]);
    else if (d.feed) ledStates.push(!!sim.up, !!sim.up);
    else if (d.fn === "mot" || d.fn === "pos") ledStates.push(sim.run || false, false, false, false);
    else if (d.fn === "saf" && !d.io) ledStates.push(sim.run || false, false);
  } else if (d.io) for (let c = 0; c < d.ch; c++) ledStates.push(powered && wiredPts.has(`${uid}:${channelPoint(d, c)}`));
  else if (d.feed) ledStates.push(powered, powered); // Us / Up
  else if (d.fn === "mot" || d.fn === "pos") ledStates.push(powered, false, false, false);
  else if (d.fn === "saf" && !d.io) ledStates.push(powered, false);

  if (b.fused) {
    const fed = geom.pts.some((p, i) => p.label === "+" && wiredPts.has(`${uid}:${i}`));
    return <FusedFace d={d} W={W} cols={cols} power={sim ? !!sim.up : powered && fed} />;
  }
  if (b.feed12) {
    // us: E-bus supply (clamp 1 / 5), up: power-contact feed (+ or L), run:
    // E-bus alive. Off-sim a supply LED lights once its clamp is wired; the
    // diag LEDs stay off.
    const fed = (lbs) => geom.pts.some((p, i) => lbs.includes(p.label) && wiredPts.has(`${uid}:${i}`));
    const lit = (k) => k === "us" ? (sim ? !!sim.us : powered && fed(["24V", "S+"]))
      : k === "up" ? (sim ? !!sim.up : powered && fed(["+", "L"]))
      : k === "run" ? (sim ? !!sim.alive : powered) : false;
    return <El12Face d={d} W={W} cols={cols} states={FEED12[d.id].leds.map(lit)} />;
  }
  if (b.logic) {
    // EL6910 / EL6930: the LEDs sit in the bottom two rows (Run green, the rest red diag)
    const run = sim ? sim.run || false : powered;
    return <El12Face d={d} W={W} cols={cols} states={[false, false, false, false, run, false, false, false]} />;
  }
  if (b.el24) {
    // inputs light the left window in channel order, outputs the right one
    const lit = (i) => (sim ? !!sim.ch?.[i] : powered && wiredPts.has(`${uid}:${i}`));
    const sigs = (r) => (d.pinout || []).map((q, i) => ({ q, i })).filter((x) => x.q?.r === r).sort((a, b) => a.q.ch - b.q.ch);
    let left, right = [];
    if (d.io === "mix") {
      left = sigs("di").map((x) => lit(x.i));
      right = sigs("do").map((x) => lit(x.i));
    } else left = ledStates.slice(0, 8);
    return (
      <g>
        <rect x="52.6" y="4" width="0.8" height={TH - 8} fill="#000" opacity="0.08" />
        <El12Face d={d} W={53} cols={[17, 36]} states={left} />
        <g transform="translate(53 0)"><El12Face d={d} W={53} cols={[17, 36]} states={right} print={false} n0={8} /></g>
      </g>
    );
  }
  if (b.el12 && PIN_LEDS[d.id]) return <El12Face d={d} W={W} cols={cols} states={PIN_LEDS[d.id].map(() => (sim ? !!sim.up : powered))} />;
  if (b.el12) return <El12Face d={d} W={W} cols={cols} states={ledStates.slice(0, 8)} />;
  if (b.ed) {
    const st = Array.from({ length: d.hd ? 16 : 8 }, (_, s) => {
      const i = pointChannelIdx(d, s);
      if (i < 0) return false;
      return sim ? !!sim.ch?.[i] : powered && wiredPts.has(`${uid}:${s}`);
    });
    return <EdFace d={d} W={W} cols={cols} states={st} />;
  }
  if (b.hd16) {
    const hd = Array.from({ length: 16 }, (_, s) => {
      const i = pointChannelIdx(d, s);
      if (i < 0) return false;
      return sim ? !!sim.ch?.[i] : powered && wiredPts.has(`${uid}:${s}`);
    });
    return <Hd16Face d={d} W={W} cols={cols} states={hd} />;
  }

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

/* --- M7 coupler family (board 04) ------------------------------------ */
// RJ45 jack as Beckhoff mounts it: turned 90°, the contacts in a column on
// one side, the latch notch and the two LEDs on the other (EK1100: contacts
// right; EK1110 / EK1122: contacts left, yellow LED over green).
function RjJack({ cx, cy, contacts = "right", la = true, top = "#46E36E", bot = "#8FCB3A" }) {
  // drawn contacts-right (EK1100) and mirrored for contacts-left; proportions
  // from the product picture: a tall opening with the latch step on the LED
  // side, a small LED window above it and a larger LED below
  const flip = contacts === "right" ? "" : " scale(-1 1)";
  return (
    <g transform={`translate(${cx} ${cy})${flip}`}>
      <rect x="-27.5" y="-33.5" width="55" height="67" rx="3.5" fill="#C4C8CC" stroke="#8E9398" strokeWidth="0.6" />
      <rect x="-26" y="-32" width="52" height="64" rx="2.5" fill="url(#rjshield)" stroke="rgba(255,255,255,0.7)" strokeWidth="0.6" />
      {/* opening with the latch step */}
      <path d="M -8 -25 H 21 V 27 H -8 V 13 H -17 V -7 H -8 Z" fill="#141618" stroke="#5E6368" strokeWidth="0.7" strokeLinejoin="round" />
      <path d="M -6.5 -23.5 H 19.5 V -19 H -6.5 Z" fill="#000" opacity="0.35" />
      {/* contact carrier and the eight gold contacts */}
      <rect x="10" y="-17" width="9.5" height="36" rx="0.8" fill="#34383C" />
      {Array.from({ length: 8 }).map((_, i) => (
        <rect key={i} x="11" y={-14.6 + i * 4.2} width="8.5" height="1.5" rx="0.5" fill="#D7B24A" />
      ))}
      {/* LEDs: small window above the step, a larger lens below */}
      <rect x="-21" y="-27" width="10" height="12" rx="1" fill={la ? top : "#4A4E52"} stroke="rgba(0,0,0,0.25)" strokeWidth="0.5" />
      <rect x="-20" y="-26" width="8" height="3" rx="0.6" fill="#fff" opacity="0.35" />
      <rect x="-21" y="15" width="10" height="12" rx="1" fill={bot} opacity={la ? 1 : 0.4} stroke="rgba(0,0,0,0.25)" strokeWidth="0.5" />
      <rect x="-20" y="16" width="8" height="3" rx="0.6" fill="#fff" opacity="0.35" />
    </g>
  );
}

// SC duplex fiber socket pair (EK1501)
function ScPort({ cx, cy }) {
  return (
    <g>
      <rect x={cx - 26} y={cy - 38} width="52" height="76" rx="2" fill="#C9CCCF" stroke="#9A9EA2" strokeWidth="0.6" />
      {[-18, 18].map((dy) => (
        <g key={dy}>
          <rect x={cx - 18} y={cy + dy - 15} width="36" height="30" rx="2" fill="#5A5F64" stroke="#3E4246" strokeWidth="0.6" />
          <rect x={cx - 11} y={cy + dy - 8} width="22" height="16" rx="1.5" fill="#2A2D30" />
          <rect x={cx - 3} y={cy + dy - 3} width="6" height="6" rx="1" fill="#8A8F94" />
        </g>
      ))}
    </g>
  );
}

const vprint = (x, y, txt, fs, fill, mono = false) => (
  <text x={x} y={y} transform={`rotate(-90 ${x} ${y})`} fill={fill} fontSize={fs} fontWeight={mono ? 700 : 800}
    fontFamily={mono ? "ui-monospace,monospace" : "system-ui"} style={{ letterSpacing: mono ? "0" : "0.4px" }}>{txt}</text>
);

// EK1960 TwinSAFE compact controller (board 05): network / address module,
// status strip, red brand band, then the relay module X4 and the I/O modules
// X5-X9, each a black LED panel over a spring plug. Plug labels, LED names
// and the pin order are the EK1960 manual's; wire openings are drawn by
// TerminalG (pointGeom's compact branch).
function CompactFace({ d, W, sim = null }) {
  const alive = sim ? !!sim.alive : true;
  const pins = d.pinout || [];
  const G = "#46E36E", R = "#FF3B30", INK = "#E8EAEC";
  const plug = (x, y0, n, pitch) => (
    <g>
      <rect x={x - 2} y={y0 - 4} width="34" height={n * pitch + 8} rx="2" fill="#26292C" stroke="#111315" strokeWidth="0.6" />
      <rect x={x + 32} y={y0 + 6} width="5" height={n * pitch - 12} rx="1" fill="#3A3E42" />
    </g>
  );
  const pusher = (x, cy, pitch, key) => <rect key={key} x={x + 18} y={cy - pitch * 0.36} width="9" height={pitch * 0.72} rx="1" fill="#E7E9EB" stroke="#9EA3A8" strokeWidth="0.4" />;
  const pinTxt = (x, cy, t, key) => <text key={key} x={x} y={cy + 1.8} fill={TS_Y.num} fontSize="5" fontWeight="600" fontFamily="system-ui">{t}</text>;
  const chLit = (i) => !!(sim?.ch?.[i]);
  // module list: [x, width, plug name, first point, count, legend]
  const mods = [[212, 133, "X4", 4, 10, "Relais"], ...TS_MODS.map((x, k) => [x, k === 4 ? W - x - 2 : 130, `X${5 + k}`, 14 + k * 10, 10, k % 2 ? "dig in" : "dig out"])];
  const status = [["EC Link 1", alive], ["EC Run", alive], ["EC Err", false, R], ["EC Link 2", alive], ["S PLC", sim ? sim.run || false : true], ["FSoE", alive], ["Us", alive], ["GND"], ["Up", alive], ["GND"]];
  return (
    <g>
      {/* network / address module */}
      <rect x="108" y="0" width="1" height={TH} fill="#000" opacity="0.12" />
      <text x="100" y="14" fill="#3A3F44" fontSize="5.4" fontWeight="600" fontFamily="system-ui" textAnchor="end">X1</text>
      <text x="100" y="132" fill="#3A3F44" fontSize="5.4" fontWeight="600" fontFamily="system-ui" textAnchor="end">X2</text>
      <g transform="translate(46 46) scale(0.78)"><RjJack cx={0} cy={0} la={alive} /></g>
      <g transform="translate(46 102) scale(0.78)"><RjJack cx={0} cy={0} la={alive} /></g>
      {[[164, "×256"], [202, "×16"], [238, "×1"]].map(([y, t]) => (
        <g key={t}>
          <circle cx="40" cy={y} r="11" fill="#E3B10C" stroke="#C99A00" strokeWidth="0.5" />
          {Array.from({ length: 16 }).map((_, k) => <circle key={k} cx={40 + 14.5 * Math.cos(k * Math.PI / 8)} cy={y + 14.5 * Math.sin(k * Math.PI / 8)} r="0.7" fill="#3A3F44" />)}
          <circle cx="40" cy={y} r="8" fill="#2B2E31" />
          <rect x="39" y={y - 7} width="2" height="7" fill="#C9CCCF" />
          <text x="58" y={y + 5} fill="#3A3F44" fontSize="5" fontFamily="system-ui">{t}</text>
        </g>
      ))}
      {plug(36, 272, 4, 12)}
      {[0, 1, 2, 3].map((k) => pusher(36, 278 + 12 * k, 12, `p${k}`))}
      {[0, 1, 2, 3].map((k) => pinTxt(14, 278 + 12 * k, pins[k]?.t, `t${k}`))}
      <text x="78" y="326" fill="#3A3F44" fontSize="5.4" fontWeight="600" fontFamily="system-ui">X3</text>
      {/* status strip, serial label, red BECKHOFF band */}
      <rect x="114" y="14" width="70" height="114" rx="2" fill="#151719" />
      {status.map(([t, on, col = G], k) => {
        const y = 24 + k * 10.2;
        return (
          <g key={k}>
            {on === undefined
              ? <rect x="120" y={y - 1.2} width="5" height="2.4" fill={INK} />
              : <circle cx="122.5" cy={y} r="2.6" fill={on ? col : "#3A3E42"} />}
            <text x="129" y={y + 2} fill={INK} fontSize="5.2" fontFamily="system-ui">{t}</text>
          </g>
        );
      })}
      <rect x="126" y="218" width="20" height="20" fill="#FFFFFF" stroke="#2B2F33" strokeWidth="0.6" />
      {[[128, 220], [139, 220], [128, 231], [134, 226], [141, 232], [136, 221], [130, 228]].map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="4" height="4" fill="#2B2F33" />)}
      <text x="124" y="254" fill="#3A3F44" fontSize="5" fontFamily="system-ui">Serial No.</text>
      <text x="124" y="262" fill="#3A3F44" fontSize="5" fontFamily="system-ui">date code</text>
      <rect x="186" y="0" width="26" height={TH} fill="#D9262B" />
      {vprint(203, TH - 8, "BECKHOFF", 11, "#FFFFFF")}
      {vprint(209.5, 242, d.id, 5, "#FFE3E3", true)}
      {/* relay and I/O modules */}
      {mods.map(([x, w, name, i0, n, leg], k) => {
        const relay = k === 0, pitch = relay ? 17.5 : 12.4, y0 = relay ? 146 : 198;
        return (
          <g key={name}>
            <rect x={x} y="0" width="1" height={TH} fill="#000" opacity="0.12" />
            <rect x={x + 6} y="14" width={w - 12} height="114" rx="2" fill="#151719" />
            {k === 2 && <path d={`M${x + 6} 14 h${w - 40} l-40 114 h-${w - 52} z`} fill="#FFFFFF" opacity="0.08" />}
            <text x={x + w - 12} y="24" fill={INK} fontSize="5.2" fontFamily="system-ui" textAnchor="end">{leg}</text>
            {relay && <text x={x + w - 12} y="31" fill={INK} fontSize="5.2" fontFamily="system-ui" textAnchor="end">in/out</text>}
            {(relay || leg === "dig out") && <text x={x + w - 12} y={23 + 5 * 10.4 + 2} fill={INK} fontSize="5.2" fontFamily="system-ui" textAnchor="end">{relay ? "Relais" : "dig out"}</text>}
            {relay && <text x={x + w - 12} y={23 + 5 * 10.4 + 9} fill={INK} fontSize="5.2" fontFamily="system-ui" textAnchor="end">in/out</text>}
            {Array.from({ length: n }).map((_, j) => {
              const i = i0 + j, q = pins[i];
              if (!q || q.t === "n.c.") return null;
              // the LED panel lists the signals top to bottom (relay: 4.1-4.4, gap, 4.5-4.8)
              const row = relay ? (j < 4 ? j : j - 1) : j, y = 23 + row * 10.4;
              const up = q.r === "usup";
              const on = up ? alive : relay ? false : chLit(i);
              return (
                <g key={j}>
                  <text x={x + 38} y={y + 2} fill={INK} fontSize="5" fontFamily="system-ui" textAnchor="end">{q.t}</text>
                  {relay && q.io === "out"
                    ? <rect x={x + 43.5} y={y - 1.2} width="5" height="2.4" fill={INK} />
                    : <circle cx={x + 46} cy={y} r="2.6" fill={on ? G : "#3A3E42"} />}
                  {up && <text x={x + w - 12} y={y + 2} fill={INK} fontSize="5.2" fontFamily="system-ui" textAnchor="end">24V</text>}
                </g>
              );
            })}
            {plug(x + 58, y0, n, pitch)}
            {Array.from({ length: n }).map((_, j) => {
              const q = pins[i0 + j], cy = y0 + pitch * (j + 0.5);
              return q && q.t !== "n.c." ? <g key={j}>{pusher(x + 58, cy, pitch)}{pinTxt(x + 30, cy, q.t)}</g> : null;
            })}
            <text x={x + w - 10} y="326" fill="#3A3F44" fontSize="5.4" fontWeight="600" fontFamily="system-ui" textAnchor="end">{name}</text>
          </g>
        );
      })}
    </g>
  );
}

function CouplerM7Face({ d, W, geom, sim = null }) {
  const b = geom.block, bx = b.bx, hx = (bx - 14) / 2;
  const la = sim ? !!sim.alive : true;
  const states = sim ? [!!sim.us, !!sim.up, !!sim.alive, sim.run || false] : [true, false, true, true];
  const hd = Array.from({ length: 16 }, (_, s) => {
    const q = d.pinout?.[s];
    return !!(q && (q.r === "di" || q.r === "do") && sim?.ch?.[s]);
  });
  return (
    <g>
      {/* housing (left), seam strip, rail latch */}
      <rect x="0.5" y="0" width={bx - 14} height={TH} rx="1.5" fill="url(#cplrbody)" />
      <rect x={bx - 14} y="0" width="14" height={TH} fill="#E9EBED" stroke="#B9BDC1" strokeWidth="0.4" />
      <rect x="-3" y="182" width="5" height="24" rx="1.2" fill="#E8A21A" stroke="#B87A0E" strokeWidth="0.5" />
      {d.fiber ? (
        <g>
          {[0, 1].map((k) => <circle key={k} cx={hx - 22} cy={18 + k * 10} r="3.4" fill={la ? "#46E36E" : "#4A4E52"} />)}
          <ScPort cx={hx - 8} cy={142} />
          <ScPort cx={hx - 8} cy={254} />
          {[["RUN", sim ? sim.run || false : true], ["LINK/ACT", la]].map(([t, on], k) => (
            <g key={t}>
              <circle cx={bx - 52} cy={44 + k * 24} r="3" fill={on ? "#46E36E" : "#4A4E52"} />
              <text x={bx - 46} y={46 + k * 24} fill="#3A3F44" fontSize="5" fontWeight="600" fontFamily="system-ui">{t}</text>
            </g>
          ))}
        </g>
      ) : (
        <g>
          <text x={hx - 27} y="45" fill={M.txtDim} fontSize="5" fontFamily="system-ui">X1 IN</text>
          <RjJack cx={hx} cy={83} la={la} />
          <text x={hx - 27} y="151" fill={M.txtDim} fontSize="5" fontFamily="system-ui">X2 OUT</text>
          <RjJack cx={hx} cy={189} la={la} />
          {d.idSwitch && <NumberKey x={bx - 36} y={136} />}
        </g>
      )}
      <EtherCatMark x={bx - 4} y={84} />
      {vprint(bx - 18, TH - 6, "BECKHOFF", 12, C.brand)}
      {vprint(bx - 5, TH - 8, d.id, 6.6, M.txt, true)}
      {/* the terminal block: the EL face, or the HD face on the EK18xx */}
      <g transform={`translate(${bx} 0)`}>
        {d.ek18
          ? <Hd16Face d={d} W={53} cols={[17, 36]} states={hd} print={false} />
          : <El12Face d={d} W={53} cols={[17, 36]} states={states} print={false} />}
      </g>
    </g>
  );
}

// EK1110: 12 mm strip on the left (RUN LED, unused clamp openings), the
// RJ45 housing on the right
function ExtensionFace({ d, W, sim = null }) {
  const run = sim ? sim.run || false : true;
  return (
    <g>
      <rect x="53" y="0" width="14" height={TH} fill="#E9EBED" stroke="#B9BDC1" strokeWidth="0.4" />
      <rect x="67" y="0" width={W - 67.5} height={TH} rx="1.5" fill="url(#cplrbody)" />
      <rect x={W - 2} y="244" width="5" height="24" rx="1.2" fill="#E8A21A" stroke="#B87A0E" strokeWidth="0.5" />
      {[4.5, 28].map((x) => <rect key={x} x={x} y="6" width="20.5" height="13" rx="1" fill="#E3E5E7" stroke="#B9BDC1" strokeWidth="0.5" />)}
      <rect x="6" y="23" width="41" height="40" rx="1.5" fill="#C9CCCF" stroke="#999DA1" strokeWidth="0.5" />
      <rect x="8" y="25" width="37" height="36" rx="1" fill="#2C2F32" />
      {Array.from({ length: 8 }).map((_, s) => (
        <rect key={s} x={[10, 29][s % 2]} y={27.5 + Math.floor(s / 2) * 8.5} width="14" height="5" rx="0.8" fill={s === 0 && run ? "#46E36E" : "#4A4E52"} />
      ))}
      {[0, 1, 2, 3].map((r) => [17, 36].map((cx) => {
        const g = EL12.gTop + r * EL12.gh;
        return (
          <g key={`${r}${cx}`}>
            <rect x={cx - 7} y={g + 15} width="14" height="13" rx="1.2" fill="#B3B7BB" stroke="#8C9094" strokeWidth="0.5" />
            <rect x={cx - 5} y={g + 17} width="10" height="8" rx="0.8" fill="#585C60" />
            <circle cx={cx} cy={g + EL12.entry} r="6.2" fill="#9EA2A6" stroke="#7C8084" strokeWidth="0.5" />
            <circle cx={cx} cy={g + EL12.entry} r="4.3" fill="#2E3134" />
          </g>
        );
      }))}
      <EtherCatMark x={63} y={84} />
      {vprint(64, TH - 6, "BECKHOFF", 9, C.brand)}
      {vprint(76, TH - 8, d.id, 6.4, M.txt, true)}
      <RjJack cx={67 + (W - 67) / 2} cy={64} contacts="left" la={sim ? !!sim.alive : true} top="#C9B23A" bot="#46E36E" />
    </g>
  );
}

// EK1122: 24 mm junction, Run LED, EtherCAT mark, X1 OUT / X2 OUT
function JunctionFace({ d, W, sim = null }) {
  const run = sim ? sim.run || false : true, la = sim ? !!sim.alive : true;
  return (
    <g>
      <rect x="12" y="2" width={W - 46} height="7" rx="1" fill="#F0961C" stroke="#BF730E" strokeWidth="0.5" />
      <circle cx="34" cy="32" r="4.4" fill={run ? "#46E36E" : "#4A4E52"} />
      <text x="42" y="34.5" fill="#3A3F44" fontSize="6" fontFamily="system-ui">Run</text>
      <text x="14" y="68" fill="#3A3F44" fontSize="11" fontWeight="500" fontFamily="system-ui">Ether<tspan fontWeight="800">CAT</tspan></text>
      {[[124, "X1"], [214, "X2"]].map(([cy, t]) => (
        <g key={t}>
          <RjJack cx={44} cy={cy} contacts="left" la={la} top="#C9B23A" bot="#46E36E" />
          <text x="74" y={cy - 14} fill="#3A3F44" fontSize="6" fontWeight="600" fontFamily="system-ui">{t}</text>
          <text x="74" y={cy - 7} fill="#3A3F44" fontSize="6" fontWeight="600" fontFamily="system-ui">OUT</text>
        </g>
      ))}
      <text x={W / 2} y="292" fill="#3A3F44" fontSize="7" textAnchor="middle" fontFamily="system-ui">Junction</text>
      <text x="8" y="318" fill="#2B2F33" fontSize="6.6" fontWeight="800" fontFamily="system-ui" style={{ letterSpacing: "0.3px" }}>BECKHOFF</text>
      <text x="62" y="318" fill="#2B2F33" fontSize="6.4" fontWeight="700" fontFamily="ui-monospace,monospace">{d.id}</text>
    </g>
  );
}

/* --- EK1914 / EK1960 coupler (old face until the TwinSAFE family) ------ */
function CouplerFace({ d, W, uid, sim = null }) {
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
      {/* RUN · link X1 · link X2 · ERR · Us · Up */}
      <LedWindow x={bx + 6} y={18} w={64} h={40} states={sim
        ? [sim.run || false, !!sim.alive, !!sim.alive, false, !!sim.us, !!sim.up, false, false]
        : [true, true, true, false, true, false, false, false]} />
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
function PsuFace({ d, W, sim = null }) {
  const oc = [W * 0.32, W * 0.68];
  return (
    <g>
      <text x="10" y="24" fill={C.brand} fontSize="8.5" fontWeight="800" fontFamily="system-ui" style={{ letterSpacing: "0.4px" }}>BECKHOFF</text>
      <text x="10" y="35" fill={M.txt} fontSize="6.6" fontWeight="700" fontFamily="ui-monospace,monospace">{d.id}</text>
      <text x="10" y="44" fill={M.txtDim} fontSize="4.8" fontFamily="system-ui">{d.out}</text>
      {/* DC OK LED */}
      <rect x={W - 34} y="18" width="24" height="12" rx="2" fill={M.winFrame} stroke={M.winEdge} strokeWidth="0.6" />
      <rect x={W - 31} y="21" width="7" height="4" rx="1" fill={!sim || sim.ok ? M.ledOn : sim.overload ? "#FF3B30" : M.ledOff}>
        {sim?.overload && <animate attributeName="opacity" values="1;0" dur="0.5s" calcMode="discrete" repeatCount="indefinite" />}
      </rect>
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
function CxFace({ d, W, sim = null }) {
  return (
    <g>
      <text x="12" y="22" fill={C.brand} fontSize="9" fontWeight="800" fontFamily="system-ui" style={{ letterSpacing: "0.5px" }}>BECKHOFF</text>
      <text x="12" y="34" fill={M.txt} fontSize="8" fontWeight="700" fontFamily="ui-monospace,monospace">{d.id}</text>
      <LedWindow x={12} y={44} w={40} h={34} states={sim
        ? [!!sim.us, sim.plc === "RUN" ? true : sim.plc === "FAULT" ? false : "blink", sim.plc === "FAULT" ? "red" : false, false]
        : [true, true, false, false]} />
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
function RjTermFace({ d, W, sim = null }) {
  const n = portCount(d);
  const pitch = n > 2 ? 50 : 66;
  return (
    <g>
      <OrangeLabels cx1={W * 0.32} cx2={W * 0.68} />
      <LedWindow x={W * 0.13} y={18} w={W * 0.74} h={36} states={sim ? [sim.run || false, false, !!sim.alive, false] : [true, false, true, false]} />
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

// EL9080: the orange front that marks the break in the power contacts
// (E-bus passes through); grey recesses as on the product picture
function SeparationFace({ d, W }) {
  return (
    <g>
      <rect x="4.5" y="6" width="20.5" height="13" rx="1" fill="#C96E14" stroke="#94500B" strokeWidth="0.5" />
      <rect x={W - 25} y="6" width="20.5" height="13" rx="1" fill="#C96E14" stroke="#94500B" strokeWidth="0.5" />
      <rect x="3" y="23" width={W - 6} height="282" rx="1" fill="#CA8200" stroke="#9C6400" strokeWidth="0.5" />
      {[W * 0.32, W * 0.68].map((cx) => <rect key={cx} x={cx - 5} y="206" width="10" height="16" rx="1.5" fill="#8C5A00" opacity="0.55" />)}
      <text x={W / 2} y={TH - 20.5} fill="#2B2F33" fontSize="6.4" fontWeight="700" fontFamily="ui-monospace,monospace" textAnchor="middle">{d.id}</text>
      <text x={W / 2} y={TH - 12} fill="#2B2F33" fontSize="5.6" fontWeight="800" fontFamily="system-ui" textAnchor="middle" style={{ letterSpacing: "0.3px" }}>BECKHOFF</text>
    </g>
  );
}

// EL9200 / EL9210: orange markers, Error (red, left) and Power (green,
// right) LEDs, the fuse holder, three clamp rows at FUSED.rows
function FusedFace({ d, W, cols, power }) {
  return (
    <g>
      <rect x="4.5" y="6" width="20.5" height="13" rx="1" fill="#C96E14" stroke="#94500B" strokeWidth="0.5" />
      <rect x={W - 25} y="6" width="20.5" height="13" rx="1" fill="#C96E14" stroke="#94500B" strokeWidth="0.5" />
      {cols.map((cx, i) => {
        const on = i === 1 && power;
        return (
          <g key={i}>
            <circle cx={cx} cy="37" r="6.4" fill="#C9CCCF" stroke="#999DA1" strokeWidth="0.5" />
            <circle cx={cx} cy="37" r="4.8" fill="#4A4E52" />
            {on && <circle cx={cx} cy="37" r="4.8" fill="#46E36E" />}
            {on && <circle cx={cx} cy="37" r="4.8" fill="#46E36E" opacity="0.55" filter="blur(2px)" />}
          </g>
        );
      })}
      <rect x="4" y="57" width={W - 8} height="33" rx="2" fill="#EE9E0C" stroke="#B87708" strokeWidth="0.6" />
      <rect x={W / 2 - 11.5} y="64" width="23" height="8" rx="1" fill="none" stroke="#2A2010" strokeWidth="0.8" />
      <line x1={W / 2 - 15.5} y1="68" x2={W / 2 + 15.5} y2="68" stroke="#2A2010" strokeWidth="0.8" />
      <text x={W / 2} y="84" fill="#2A2010" fontSize="5.6" fontWeight="700" fontFamily="system-ui" textAnchor="middle">250V/6,3A</text>
      {FUSED.rows.map((g, row) => cols.map((cx, ci) => {
        const n = ci * 3 + row + 1, t = FEED_TAB[FUSED.labels[row][ci]];
        return (
          <g key={n}>
            <rect x={cx - 9.5} y={g} width="19" height="11" rx="1" fill={t.fill} stroke={t.edge} strokeWidth="0.5" />
            <text x={cx} y={g + 5.5 + t.fs * 0.36} fill={t.ink} fontSize={t.fs} fontWeight="700" fontFamily="system-ui" textAnchor="middle">{t.text}</text>
            <rect x={cx - 7} y={g + 15} width="14" height="13" rx="1.2" fill="#B3B7BB" stroke="#8C9094" strokeWidth="0.5" />
            <rect x={cx - 5} y={g + 17} width="10" height="8" rx="0.8" fill="#585C60" />
            <text x={cx - 8.2} y={g + 33.6} fill="#51565B" fontSize="4.4" fontWeight="600" fontFamily="system-ui" textAnchor="middle">{n}</text>
          </g>
        );
      }))}
      <text x={W / 2} y={TH - 20.5} fill="#2B2F33" fontSize="6.4" fontWeight="700" fontFamily="ui-monospace,monospace" textAnchor="middle">{d.id}</text>
      <text x={W / 2} y={TH - 12} fill="#2B2F33" fontSize="5.6" fontWeight="800" fontFamily="system-ui" textAnchor="middle" style={{ letterSpacing: "0.3px" }}>BECKHOFF</text>
    </g>
  );
}

// EL9011 / EL9012 end cover on the M7 housing: plain cover, the slots that
// take the last terminal's E-bus springs on the left, print up the middle
function EndCoverFace({ d, W }) {
  return (
    <g>
      <rect x={W - 2.5} y="2" width="1" height={TH - 4} fill="#000000" opacity="0.08" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect key={i} x="-0.6" y={29 + i * 14} width="2" height="6" rx="0.5" fill="#B9BDC1" />
      ))}
      <text x={W / 2} y="168" fill="#2B2F33" fontSize="6.4" fontWeight="700" fontFamily="ui-monospace,monospace"
        textAnchor="middle" transform={`rotate(-90 ${W / 2} 168)`}>{d.id}</text>
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

/* --- About: the disclaimers have to ship INSIDE the single HTML file, because
 * that file is what gets downloaded and passed around, and nothing in the repo
 * travels with it. --------------------------------------------------------- */
function AboutModal({ onClose }) {
  const P = { fontSize: 12.5, lineHeight: 1.5, margin: "0 0 10px", color: C.ink };
  return (
    <div style={S.modalWrap} onClick={onClose}>
      <div style={{ ...S.modal, width: 560, maxWidth: "94vw" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ ...S.inspId, fontSize: 16 }}>Sid&apos;s EtherCAT Configurator v{APP_VERSION}</span>
          <button style={S.btnGhost} onClick={onClose}>&#10005; Close</button>
        </div>
        <p style={P}>
          A design aid and learning tool &mdash; <b>not an engineering or procurement system</b>.
          Verify everything against the manufacturer&apos;s data sheet before using it for real
          design, ordering or installation. Use at your own risk.
        </p>
        <p style={P}>
          <b>Independent project.</b> Not affiliated with, authorised, endorsed or sponsored by
          Beckhoff Automation, the EtherCAT Technology Group, or any other company named here.
          All company names, product names and part numbers are trademarks of their respective
          owners, used for identification only. EtherCAT&reg; is a registered trademark and
          patented technology licensed by Beckhoff Automation GmbH. No company logos or product
          photographs are reproduced: device drawings are original stylised SVG and manufacturer
          badges are plain name-in-colour wordmarks.
        </p>
        <p style={P}>
          <b>Catalog data.</b> Beckhoff entries are the most accurate; other parts are
          representative models with approximate specs. Entries marked as coming from the
          <b> EtherCAT Technology Group product guide</b> (ethercat.org/en/products.html) are
          member-submitted listings: ETG assumes no responsibility for their content, correctness,
          completeness or quality, and the guide is incomplete. Sizes, channel counts and pinouts
          for those parts are representative defaults chosen per product type, not vendor data.
        </p>
        <p style={{ ...P, color: C.muted, margin: 0 }}>
          Copyright &copy; 2026 Siddharth Sanghavi. Code and original artwork are released under
          the MIT License, provided "as is", without warranty of any kind. The licence covers neither third-party
          trademarks and product names nor third-party catalog data.
        </p>
      </div>
    </div>
  );
}

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

  // free-placed devices that sit on the EtherCAT network: the kinds that are
  // EtherCAT by construction, plus anything from the ETG directory — every
  // product in it is an EtherCAT device, whatever face it borrows to draw
  const ecFree = useMemo(() => (free || [])
    .map((f) => ({ f, d: byId[f.catId] }))
    .filter((x) => x.d && (x.d.etg || ["epbox", "iol", "iolhub", "drive", "linaxis"].includes(x.d.kind))), [free]);

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
        <linearGradient id="cplrbody" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#E6E8EA" /><stop offset="0.6" stopColor="#DCDFE2" /><stop offset="1" stopColor="#CDD1D5" />
        </linearGradient>
        <linearGradient id="rjshield" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#EEF0F2" /><stop offset="1" stopColor="#B8BDC2" />
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

function FreeCompG({ inst, layout, selected, wireMode, pending, wired, sim = null, actuator = false, onSelect, onDragStart, onPointDown, onPointUp, onHover, onLeave }) {
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
  // motion parts move once powered + wired; while simulating, only when their
  // drive is powered, on the bus and in OP
  const animate = sim ? !!sim.run : d.motion && wired;
  const lit = sim?.lit || {};
  const glow = (c) => ({ filter: `drop-shadow(0 0 3px ${c}) drop-shadow(0 0 7px ${c})` });
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
          {sim && <rect x={W - 22} y="34" width="9" height="4" rx="1" fill={sim.powered ? M.ledOn : M.ledOff} style={sim.powered ? glow(M.ledOn) : null} />}
        </g>
      );
      case "panel": return (
        <g>
          <rect x="0" y="0" width={W} height={H - 30} rx="5" fill="#2B2F33" stroke="#54585C" strokeWidth="1" />
          <rect x="7" y="7" width={W - 14} height={H - 52} rx="2" fill={sim && !sim.powered ? "#15191D" : "#12405E"} />
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
          <rect x={W * 0.2 + 3} y={75} width="6" height="6" rx="1" fill={sim && !sim.powered ? M.ledOff : sim && !sim.alive ? "#FF3B30" : M.ledOn}>
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
          {sim && <circle cx={W / 2} cy="16" r="3.2" fill={lit.coil ? "#FFD60A" : "#4A4F55"} style={lit.coil ? glow("#FFD60A") : null} />}
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
                fill={colors[lb] || "#888"} stroke="rgba(0,0,0,0.3)" strokeWidth="0.7"
                opacity={!sim ? 0.9 : lit[lb] ? 1 : 0.26} style={sim && lit[lb] ? glow(colors[lb] || "#fff") : null} />
            ))}
            {d.buzzer && <rect x={W / 2 - 13} y={boxTop - 32 - items.length * 20 + 8} width="26" height="11" rx="4" fill="#54585C" />}
            {d.buzzer && sim && lit.BZ && (
              <path d={`M ${W / 2 + 16} ${boxTop - 30 - items.length * 20 + 8} q 5 5 0 10 M ${W / 2 + 20} ${boxTop - 33 - items.length * 20 + 8} q 8 8 0 16`} fill="none" stroke="#54585C" strokeWidth="1.2">
                <animate attributeName="opacity" values="1;0.2;1" dur="0.4s" repeatCount="indefinite" />
              </path>
            )}
            <rect x={W / 2 - 9} y={boxTop - 38 - (items.length + (d.buzzer ? 1 : 0)) * 20 + (d.buzzer ? 8 : 0)} width="18" height="6" rx="3" fill="#3A3F45" />
          </g>
        );
      }
      case "btn": case "estop": {
        // pressed: the cap sinks (smaller, darker rim); an illuminated cap lights
        // only when its lamp terminals see 24 V
        const pressed = !!sim?.act;
        const lampOn = !!lit.lamp;
        const capR = W * (pressed ? 0.245 : 0.28);
        const cap = d.kind === "estop" ? "#C4262E" : d.illum ? (!sim ? "#E8C400" : lampOn ? "#FFE14D" : "#8C7A2A") : "#3A3F45";
        return (
          <g>
            <rect x="0" y="0" width={W} height={W * 0.85} rx="6" fill={d.kind === "estop" ? "#E8C400" : "#DADDE0"} stroke={M.hEdge} strokeWidth="0.9" />
            {sim && <circle cx={W / 2} cy={W * 0.42} r={W * 0.3} fill="rgba(0,0,0,0.22)" />}
            <circle cx={W / 2} cy={W * 0.42} r={capR} fill={cap} stroke={pressed ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.35)"} strokeWidth={pressed ? 1.8 : 1}
              style={sim && lampOn ? glow("#FFD60A") : null} />
            {d.sel && <rect x={W / 2 - 2} y={W * 0.42 - 12} width="4" height="24" rx="2" fill="#DADDE0" transform={`rotate(${pressed ? -35 : 35} ${W / 2} ${W * 0.42})`} />}
            {d.kind === "estop" && <circle cx={W / 2} cy={W * 0.42} r={W * (pressed ? 0.12 : 0.15)} fill="#A31C24" />}
            {d.kind === "estop" && sim && pressed && (
              <text x={W / 2} y={W * 0.8} fill="#7A1618" fontSize="5" fontWeight="800" textAnchor="middle" fontFamily="system-ui">PRESSED</text>
            )}
          </g>
        );
      }
      case "relay": return (
        <g>
          <rect x="4" y="0" width={W - 8} height={H - 22} rx="3" fill="#E9EAEC" stroke={M.hEdge} strokeWidth="0.9" />
          <rect x="10" y="8" width={W - 20} height="14" rx="1.5" fill="#C9CDD2" />
          <text x={W / 2} y={40} fill={M.txt} fontSize="5.4" textAnchor="middle" fontFamily="system-ui">24VDC · 1CO</text>
          {sim && <rect x={W / 2 - 3.5} y="12" width="7" height="5" rx="1" fill={sim.coil ? "#FFD60A" : M.ledOff} style={sim.coil ? glow("#FFD60A") : null} />}
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
          {sim && (
            <g>
              <rect x={W / 2 - 4} y={H / 2 + 6} width="16" height="10" rx="1.5" fill={sim.coil ? "#25A37A" : "#2A2E33"} stroke="#1E2126" strokeWidth="0.6" />
              <text x={W / 2 + 4} y={H / 2 + 13.6} fill="#fff" fontSize="6" fontWeight="800" textAnchor="middle" fontFamily="system-ui">{sim.coil ? "I" : "O"}</text>
            </g>
          )}
        </g>
      );
      case "sensor": case "iol": case "loop2": return (
        <g>
          <rect x={W / 2 - 8} y="8" width="16" height={H - 44} rx="4" fill="#B7BCC2" stroke="#7A8086" strokeWidth="0.9" />
          {Array.from({ length: 5 }).map((_, i) => (
            <line key={i} x1={W / 2 - 8} y1={16 + i * 7} x2={W / 2 + 8} y2={16 + i * 7} stroke="#8A9096" strokeWidth="0.7" />
          ))}
          <circle cx={W / 2} cy="12" r="5" fill={!sim || d.kind !== "sensor" ? (d.kind === "iol" ? "#25A37A" : "#E8781E") : sim.out ? "#FFD60A" : sim.powered ? "#25A37A" : "#5A5F64"}
            style={sim && sim.out ? glow("#FFD60A") : null} />
          {sim && d.kind === "sensor" && sim.act && (
            <path d={`M ${W / 2 + 9} 4 l 6 -2 M ${W / 2 + 9} 12 h 7 M ${W / 2 + 9} 20 l 6 2`} stroke="#E8781E" strokeWidth="1.4" strokeLinecap="round" />
          )}
          {/* cable stub down to the wiring terminals */}
          <line x1={W / 2} y1={H - 36} x2={W / 2} y2={H - 20} stroke="#3A3F45" strokeWidth="2.4" />
        </g>
      );
      case "limit": return (
        <g>
          <rect x="6" y="24" width={W - 12} height={H - 44} rx="3" fill="#E9EAEC" stroke={M.hEdge} strokeWidth="0.9" />
          <line x1={W / 2} y1="24" x2={sim?.act ? W - 4 : W - 8} y2={sim?.act ? 16 : 6} stroke="#54585C" strokeWidth="3" strokeLinecap="round" />
          <circle cx={sim?.act ? W - 4 : W - 8} cy={sim?.act ? 16 : 6} r="5" fill="#B7BCC2" stroke="#54585C" strokeWidth="1" />
        </g>
      );
      case "curtain": return (
        <g>
          <rect x={W / 2 - 13} y="0" width="26" height={H - 40} rx="3" fill="#E8C400" stroke="#A38A00" strokeWidth="1" />
          <rect x={W / 2 - 4} y="8" width="8" height={H - 58} rx="2" fill="#7A1618" />
          {Array.from({ length: 8 }).map((_, i) => (
            <circle key={i} cx={W / 2} cy={16 + i * (H - 76) / 7} r="1.6"
              fill={!sim ? "#E85055" : !sim.powered ? "#5A1012" : sim.act ? "#FF3B30" : "#3DD16B"} />
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
          {sim?.ch && geom.pts.filter((p) => !p.port && p.label !== "⏚").map((p, i) => (
            <rect key={`l${i}`} x={p.x + (p.x < W / 2 ? 9 : -14)} y={p.y - 2} width="5" height="4" rx="1"
              fill={sim.ch[i + 1] ? "#FFD60A" : "#3A3F45"} style={sim.ch[i + 1] ? glow("#FFD60A") : null} />
          ))}
          <text x={W / 2} y={H - 3} fill="#C9CDD2" fontSize="5" textAnchor="middle" fontFamily="ui-monospace,monospace">IP67</text>
        </g>
      );
      case "supplybox": return (
        <g>
          <rect x="0" y="0" width={W} height={H} rx="4" fill="url(#psbody)" stroke={M.hEdge} strokeWidth="0.9" />
          <rect x={W - 30} y="26" width="22" height="11" rx="2" fill={M.winFrame} stroke={M.winEdge} strokeWidth="0.6" />
          <rect x={W - 27} y="29" width="6" height="4" rx="1" fill={!sim || sim.ok ? M.ledOn : sim.overload ? "#FF3B30" : M.ledOff}>
            {sim?.overload && <animate attributeName="opacity" values="1;0" dur="0.5s" calcMode="discrete" repeatCount="indefinite" />}
          </rect>
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
            <rect key={i} x={12 + i * ((W - 24) / (d.ch || 4))} y="26" width="8" height="8" rx="1.5" fill={!sim || sim.ok ? M.ledOn : M.ledOff} />
          ))}
          <text x={W / 2} y={H / 2 + 8} fill={M.txt} fontSize="5.4" textAnchor="middle" fontFamily="system-ui">24VDC</text>
        </g>
      );
      case "breaker": return (
        <g>
          <rect x={W * 0.15} y="0" width={W * 0.7} height={H} rx="2.5" fill="#E9EAEC" stroke={M.hEdge} strokeWidth="0.9" />
          <rect x={W / 2 - 5} y={H / 2 - 12} width="10" height="20" rx="2" fill="#3A3F45" />
          <rect x={W / 2 - 3} y={sim?.act ? H / 2 + 0 : H / 2 - 8} width="6" height="7" rx="1" fill={sim?.act ? "#25A37A" : "#D0342C"} />
        </g>
      );
      case "disconnect": return (
        <g>
          <rect x="2" y="2" width={W - 4} height={H - 4} rx="4" fill="#E8C400" stroke="#A38A00" strokeWidth="1" />
          <circle cx={W / 2} cy={H / 2} r={Math.min(W, H) * 0.26} fill="#C4262E" stroke="#7A1618" strokeWidth="1.5" />
          <rect x={W / 2 - 2.5} y={H / 2 - 14} width="5" height="28" rx="2.5" fill="#3A3F45" transform={`rotate(${sim?.act ? -55 : 35} ${W / 2} ${H / 2})`} />
          <text x={W / 2} y={H - 6} fill="#3A3F45" fontSize="5" fontWeight="700" textAnchor="middle" fontFamily="system-ui">O–I</text>
        </g>
      );
      case "valvebank": return (
        <g>
          <rect x="0" y="18" width={W} height={H - 40} rx="3" fill="#8A9096" stroke="#54585C" strokeWidth="1" />
          {Array.from({ length: d.ch || 5 }).map((_, i) => (
            <rect key={i} x={8 + i * ((W - 16) / (d.ch || 5))} y="10" width={((W - 16) / (d.ch || 5)) - 4} height={H - 44} rx="2" fill="#3A3F45" stroke="#1E2126" strokeWidth="0.7" />
          ))}
          {sim && Array.from({ length: d.ch || 5 }).map((_, i) => {
            const onV = d.netport ? !!sim.ch?.[i + 1] : !!lit[`V${i + 1}`];
            return <rect key={`v${i}`} x={8 + i * ((W - 16) / (d.ch || 5)) + 2} y="14" width="6" height="4" rx="1"
              fill={onV ? "#FFD60A" : "#54585C"} style={onV ? glow("#FFD60A") : null} />;
          })}
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
    <g transform={`translate(${t.x}, ${t.y})`} data-uid={uid}
      onClick={(e) => { if (!wireMode) { e.stopPropagation(); onSelect(); } }}
      onPointerDown={(e) => { if (!wireMode && onDragStart) onDragStart(e); }}
      style={{ cursor: wireMode ? "crosshair" : actuator ? "pointer" : sim ? "default" : "grab" }}
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
          <g key={i} data-pt={i} data-label={p.label}
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
  brandVer: { fontSize: 10.5, fontWeight: 700, color: C.muted, marginLeft: 6, letterSpacing: "0.04em" },
  brandSub: { fontSize: 12, color: C.muted },
  headerActions: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end", rowGap: 8 },
  btnGhost: { border: `1px solid ${C.line}`, background: C.panel, color: C.ink, padding: "7px 12px", borderRadius: 8, fontSize: 12.5, cursor: "pointer", fontWeight: 500 },
  btnOn: { background: C.ink, color: "#fff", border: `1px solid ${C.ink}` },
  btnSim: { background: "#1F7A4D", color: "#fff", border: "1px solid #1F7A4D", fontWeight: 700 },
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
