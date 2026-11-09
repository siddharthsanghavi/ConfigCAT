/* EtherCAT device catalog — representative set of common part numbers.
 * ebus: E-bus current mA (+ = supplies, − = consumes, typical values from
 * Beckhoff datasheets, approximate unless marked verified). w = width in mm.
 * hd = high-density 16-point housing. idSwitch = station ID selector.
 * safety = TwinSAFE yellow housing. upA = worst-case rated load the terminal
 * can draw from the 24 V power contacts (Up), amps — used for the 10 A
 * power-contact budget check. ac = feeds 120…230 V AC to the power contacts.
 * pinout = exact terminal-point assignment from infosys "LEDs and connection"
 * pages, index 0 = point 1: { r: role (di|do|p24|gnd|pe), ch?: channel }.
 * Extend by scraping beckhoff.com family pages (see CLAUDE.md).
 * Bulk expansion parts live in ./catalog-extended.js (spread in below) to
 * keep this core file lean.
 */
import { EXTRA } from "./catalog-extended.js";
import { ETG } from "./catalog-etg.js";
import { MORE, MORE_GROUPS } from "./catalog-more.js";
import { ELXM, ELXM_GROUPS } from "./catalog-elxm.js";
import { moreFaces, FACE_GROUPS } from "./catalog-more-faces.js";
import { PINOUTS, HD_FIX } from "./catalog-pinouts.js";
// TwinSAFE clamp roles (Beckhoff manuals, 2026): clk = the clock (test-pulse)
// output that feeds a safe input's contact, "Input x+"; the safe input itself
// is the "Input x−" clamp. usup = an output supply clamp (EK1960 Up1–Up6),
// link = a second clamp of the same signal.
const CLK = (ch) => ({ r: "clk", ch });
const TS_IN4 = [CLK(1), { r: "di", ch: 1 }, CLK(3), { r: "di", ch: 3 }, CLK(2), { r: "di", ch: 2 }, CLK(4), { r: "di", ch: 4 }];
const TS_IN8 = [CLK(1), { r: "di", ch: 1 }, CLK(3), { r: "di", ch: 3 }, CLK(5), { r: "di", ch: 5 }, CLK(7), { r: "di", ch: 7 },
  CLK(2), { r: "di", ch: 2 }, CLK(4), { r: "di", ch: 4 }, CLK(6), { r: "di", ch: 6 }, CLK(8), { r: "di", ch: 8 }];
const EK1960_PINS = (() => {
  const p = [{ r: "us24", t: "Us" }, { r: "us0", t: "GND" }, { r: "up24", t: "Up" }, { r: "up0", t: "GND" }];
  for (let k = 1; k <= 4; k++) p.push({ r: null, t: `4.${k}`, rel: k, io: "in" });
  p.push({ r: null, t: "n.c." }, { r: null, t: "n.c." });
  for (let k = 1; k <= 4; k++) p.push({ r: null, t: `4.${k + 4}`, rel: k, io: "out" });
  const outs = (x, o) => {
    for (let k = 0; k < 4; k++) p.push({ r: "do", ch: o + k, sup: `u${(x - 5) / 2 * 2 + 1}`, t: `${x}.${k + 1}` });
    p.push({ r: "usup", k: `u${(x - 5) / 2 * 2 + 1}`, t: `Up${(x - 5) / 2 * 2 + 1}` });
    for (let k = 0; k < 4; k++) p.push({ r: "do", ch: o + 4 + k, sup: `u${(x - 5) / 2 * 2 + 2}`, t: `${x}.${k + 5}` });
    p.push({ r: "usup", k: `u${(x - 5) / 2 * 2 + 2}`, t: `Up${(x - 5) / 2 * 2 + 2}` });
  };
  const ins = (x, o) => { for (let k = 0; k < 10; k++) p.push({ r: "di", ch: o + k, t: `${x}.${k + 1}` }); };
  outs(5, 1); ins(6, 1); outs(7, 9); ins(8, 11); outs(9, 17);
  return p;
})();

// Motion / encoder clamps (Infosys "LEDs and connection", 2026). A plain
// entry carries the manual's name (t) and, where the product picture prints
// one, the tab text; p24 / gnd mark clamps tied to the power contacts. The
// 24 mm parts list the left block first, then the right (the manual's 1′…).
const T_ = (t, tab) => (tab ? { t, tab } : { t });
const PC24 = (t) => ({ r: "p24", t, tab: "+" });
const PC0 = (t) => ({ r: "gnd", t, tab: "−" });
const NC = { t: "not connected" };
const STEP_RIGHT = [T_("A1 · motor winding A1", "A1"), T_("B1 · motor winding B1", "B1"), T_("motor supply +48 V", "+"), T_("motor supply +48 V", "+"),
  T_("A2 · motor winding A2", "A2"), T_("B2 · motor winding B2", "B2"), T_("motor supply 0 V", "−"), T_("motor supply 0 V", "−")];
const EL7041_PINS = [T_("A · encoder input A", "A"), T_("C · encoder input C (zero)", "C"), PC24("encoder supply +24 V (from the + power contact)"), T_("Input 1 · digital input 24 V", "I1"),
  T_("B · encoder input B", "B"), T_("Latch · latch input", "L"), PC0("encoder supply 0 V (from the − power contact)"), T_("Input 2 · digital input 24 V", "I2"), ...STEP_RIGHT];
const EL7342_PINS = [T_("Enc. A, A · encoder A input A"), T_("Enc. B, A · encoder B input A"), PC24("encoder supply +24 V (from the + power contact)"), T_("Input 1 · digital / latch input 24 V", "I1"),
  T_("Enc. A, B · encoder A input B"), T_("Enc. B, B · encoder B input B"), PC0("encoder supply 0 V (from the − power contact)"), T_("Input 2 · digital / latch input 24 V", "I2"),
  T_("A1 · motor A winding A1", "A1"), T_("B1 · motor B winding B1", "B1"), T_("motor supply +48 V", "+"), T_("motor supply +48 V", "+"),
  T_("A2 · motor A winding A2", "A2"), T_("B2 · motor B winding B2", "B2"), T_("motor supply 0 V", "−"), T_("motor supply 0 V", "−")];
const EL5101_PINS = [T_("A · encoder input A", "A"), T_("B · encoder input B", "B"), T_("C · encoder input C", "C"), T_("Latch 24 V · latch input", "L"),
  T_("A̅ · encoder input A inverted", "A̅"), T_("B̅ · encoder input B inverted", "B̅"), T_("C̅ · encoder input C inverted", "C̅"), T_("Gate 24 V · gate input", "G"),
  T_("Ue +5 V · encoder supply"), PC24("+24 V (internally on the + power contact)"), PC0("0 V (internally on the − power contact)"), T_("Input 1 · status input (encoder alarm)"),
  T_("Uo 0 V · encoder supply"), PC24("+24 V (internally on the + power contact)"), PC0("0 V (internally on the − power contact)"), T_("Shield")];
const EL5102_ENC = (k) => [T_(`A${k} · encoder input A${k}`), T_(`B${k} · encoder input B${k}`), T_(`C${k} · encoder input C${k}`), T_(`Status input ${k}`),
  T_(`+Ue${k} · encoder supply (5 V, 12 V or 24 V)`), T_(`−Uo${k} · encoder supply 0 V`), T_(`Latch ${k} · latch input`), NC,
  T_(`A̅${k} · encoder input A${k} inverted`), T_(`B̅${k} · encoder input B${k} inverted`), T_(`C̅${k} · encoder input C${k} inverted`), NC,
  T_(`+Ue${k} · encoder supply (5 V, 12 V or 24 V)`), T_(`−Uo${k} · encoder supply 0 V`), T_(`Gate ${k} · gate / latch 2 input`), NC];
const SERVO_POWER = (oct) => [T_("U · motor phase U"), T_("W · motor phase W"), T_("Brake + · motor brake +"), T_("48 V · DC link supply + (8 … 48 V)"), T_("48 V · DC link supply + (8 … 48 V)")];
const EL7211_PINS = [T_("Ref + · resolver excitation + (R1)"), T_("Sin + · resolver sine + (S2)"), T_("Cos + · resolver cosine + (S1)"), ...SERVO_POWER(),
  T_("Ref − · resolver excitation − (R2)"), T_("Sin − · resolver sine − (S4)"), T_("Cos − · resolver cosine − (S3)"), T_("V · motor phase V"), NC,
  T_("GND · motor brake GND"), T_("0 V · DC link 0 V"), T_("0 V · DC link 0 V")];
const EL7211_0010_PINS = [T_("OCT + · feedback +"), T_("Input 1 · digital input"), PC24("+24 V · power contact"), ...SERVO_POWER(),
  T_("OCT − · feedback −"), T_("Input 2 · digital input"), PC0("0 V · power contact"), T_("V · motor phase V"), NC,
  T_("Brake GND · motor brake 0 V"), T_("0 V · DC link 0 V"), T_("0 V · DC link 0 V")];
const NC16 = Array.from({ length: 16 }, () => NC);
const EL7411_PINS = [T_("Encoder supply +"), T_("ENC A+"), T_("ENC B+"), T_("ENC C+"), T_("Hall sensor U"), T_("Hall sensor W"), T_("Hall sensor supply +"), T_("Input 1 · digital input 24 V"),
  T_("Encoder supply GND"), T_("ENC A−"), T_("ENC B−"), T_("ENC C−"), T_("Hall sensor V"), NC, T_("Hall sensor supply GND"), T_("Input 2 · digital input 24 V"),
  T_("Fan supply + (ZB8610)"), T_("Fan diagnostics (ZB8610)"), NC, T_("U · motor phase U"), T_("W · motor phase W"), T_("Brake + · motor brake output"), T_("Load voltage 48 V DC (8 … 48 V)"), T_("Load voltage 48 V DC (8 … 48 V)"),
  T_("Fan supply GND (ZB8610)"), T_("Fan mode (ZB8610)"), NC, T_("V · motor phase V"), T_("HW Enable · enables the output stage"), T_("Brake GND · motor brake 0 V"), T_("Load voltage GND"), T_("Load voltage GND")];
const EL7201_PINS = [T_("Ref + · resolver excitation +"), T_("Sin + · resolver sine +"), T_("Cos + · resolver cosine +"), ...SERVO_POWER(),
  T_("Ref − · resolver excitation −"), T_("Sin − · resolver sine −"), T_("Cos − · resolver cosine −"), T_("V · motor phase V"), NC,
  T_("GND · motor brake GND"), T_("0 V · DC link 0 V"), T_("0 V · DC link 0 V")];
const ED7062_PINS = [T_("Enc supply +5 V"), T_("Ch 1 Enc A"), T_("Ch 1 Enc B"), T_("Ch 1 Enc C"), T_("Enc supply +5 V"), T_("Ch 2 Enc A"), T_("Ch 2 Enc B"), T_("Ch 2 Enc C"),
  T_("Enc supply 0 V"), T_("Ch 1 Enc A̅"), T_("Ch 1 Enc B̅"), T_("Ch 1 Enc C̅"), T_("Enc supply 0 V"), T_("Ch 2 Enc A̅"), T_("Ch 2 Enc B̅"), T_("Ch 2 Enc C̅"),
  T_("Ch 1 Drive A1 · motor winding"), T_("Ch 1 Drive B1 · motor winding"), T_("Ch 2 Drive A1 · motor winding"), T_("Ch 2 Drive B1 · motor winding"), T_("Ch 1 latch 1"), T_("Ch 1 latch 2"), T_("Ch 1 brake · brake output"), T_("Infeed + 8 … 48 V · motor supply"),
  T_("Ch 1 Drive A2 · motor winding"), T_("Ch 1 Drive B2 · motor winding"), T_("Ch 2 Drive A2 · motor winding"), T_("Ch 2 Drive B2 · motor winding"), T_("Ch 2 latch 1"), T_("Ch 2 latch 2"), T_("Ch 2 brake · brake output"), T_("Infeed 0 V · ground for all points")];
const ED5112_PINS = [T_("Ch1 A · encoder input A"), T_("Ch1 B · encoder input B"), T_("Ch1 C / Ch2 A"), T_("Ch1 DI / Ch2 B"), T_("Enc supply + (5 V default)"), T_("Enc supply − (0 V)"), T_("Latch"), NC,
  T_("Ch1 A̅"), T_("Ch1 B̅"), T_("Ch1 C̅ / Ch2 A̅"), T_("Ch2 B̅"), T_("Enc supply + (5 V default)"), T_("Enc supply − (0 V)"), T_("Gate"), NC];
const ED6224_PINS = [T_("Ch 1 · IO-Link port 1 (C/Q)"), PC24("+24 V"), T_("Ch 2 · IO-Link port 2 (C/Q)"), PC24("+24 V"), T_("Ch 3 · IO-Link port 3 (C/Q)"), PC24("+24 V"), T_("Ch 4 · IO-Link port 4 (C/Q)"), PC24("+24 V"),
  PC24("+24 V"), PC0("0 V"), PC24("+24 V"), PC0("0 V"), PC24("+24 V"), PC0("0 V"), PC24("+24 V"), PC0("0 V")];
// CX70xx multi-function I/O block (Infosys CX7000 / CX7293 "Digital inputs"):
// 1 / 9 Us, 6 / 14 Up, inputs 1-8 on 2-5 / 10-13, outputs 1-4 on 7 / 15 / 8 / 16
const CX7_PINS = [
  { r: "us24", t: "+24 V Us", tab: "+" }, { r: "di", ch: 1, tab: "I1" }, { r: "di", ch: 3, tab: "I3" }, { r: "di", ch: 5, tab: "I5" },
  { r: "di", ch: 7, tab: "I7" }, { r: "up24", t: "+24 V Up", tab: "+" }, { r: "do", ch: 1, tab: "O1" }, { r: "do", ch: 3, tab: "O3" },
  { r: "us0", t: "0 V Us", tab: "\u2212" }, { r: "di", ch: 2, tab: "I2" }, { r: "di", ch: 4, tab: "I4" }, { r: "di", ch: 6, tab: "I6" },
  { r: "di", ch: 8, tab: "I8" }, { r: "up0", t: "0 V Up", tab: "\u2212" }, { r: "do", ch: 2, tab: "O2" }, { r: "do", ch: 4, tab: "O4" },
];
export const CATALOG = [
  // --- Couplers & Embedded PCs ---
  { id: "EK1100", name: "EtherCAT Coupler",            fn: "cplr", io: null, ch: 0, w: 44, ebus: +2000, coupler: true, desc: "E-bus head station, X1 IN / X2 OUT, 5 V / 2 A E-bus" },
  { id: "EK1101", name: "EtherCAT Coupler w/ ID",      fn: "cplr", io: null, ch: 0, w: 44, ebus: +2000, coupler: true, idSwitch: true, desc: "EK1100 + station ID switch for Hot Connect groups" },
  { id: "EK1101-0080", name: "Coupler w/ ID, Fast Hot Connect", fn: "cplr", io: null, ch: 0, w: 44, ebus: +2000, coupler: true, idSwitch: true, fhc: true, desc: "EK1101 variant with Fast Hot Connect for quick topology changes (verified)" },
  { id: "EK1501", name: "Coupler MM fiber w/ ID",      fn: "cplr", io: null, ch: 0, w: 51, ebus: +2000, coupler: true, idSwitch: true, fiber: true, desc: "Multi-mode glass fiber 50/125 µm, 2× SC duplex, max 2 km, ID switch (verified)" },
  { id: "EK1501-0010", name: "Coupler SM fiber w/ ID", fn: "cplr", io: null, ch: 0, w: 51, ebus: +2000, coupler: true, idSwitch: true, fiber: true, desc: "Single-mode glass fiber 9/125 µm, max 20 km, ID switch (verified)" },
  { id: "EK1110", name: "EtherCAT Extension",          fn: "sys",  io: null, ch: 0, w: 44, ebus: -130, ext: true, extM7: true, desc: "Extends the E-bus to the next station via RJ45, 44 mm, RUN LED (verified) — must be last device before the end cover" },
  { id: "EK1122", name: "2-Port EtherCAT Junction",    fn: "sys",  io: null, ch: 0, w: 24, ebus: -220, junction: true, jM7: true, desc: "Line / star / drop topology branch: X1 OUT / X2 OUT, Run LED (verified)" },
  { id: "EK1561", name: "1-Port POF Junction",         fn: "sys",  io: null, ch: 0, w: 24, ebus: -200, junction: true, fiber: true, desc: "Plastic optical fiber junction, 100BASE-FX, max 50 m (verified)" },
  // --- Embedded PCs (DIN rail, head of the E-bus strip) ---
  // — couplers/junctions from Beckhoff catalog 2026 (widths/ebus typical, approximate) —
  { id: "EK1000", name: "Ethernet/TSN Coupler",        fn: "cplr", io: null, ch: 0, w: 44, ebus: +2000, coupler: true, desc: "EtherCAT via Ethernet/TSN networks" },
  { id: "EK1101-0010", name: "Coupler w/ ID, Extended Distance", fn: "cplr", io: null, ch: 0, w: 44, ebus: +2000, coupler: true, idSwitch: true, desc: "Extended Distance (up to 300 m between stations)" },
  { id: "EK1300", name: "EtherCAT P Coupler",          fn: "cplr", io: null, ch: 0, w: 44, ebus: +2000, coupler: true, desc: "EtherCAT P (power + data on one cable), M8 in" },
  { id: "EK1400", name: "EtherCAT G Coupler",          fn: "cplr", io: null, ch: 0, w: 44, ebus: +2000, coupler: true, desc: "EtherCAT G, 1 Gbit/s" },
  { id: "EK1541", name: "Coupler POF w/ ID",           fn: "cplr", io: null, ch: 0, w: 44, ebus: +2000, coupler: true, idSwitch: true, fiber: true, desc: "Plastic optical fiber, versatile link, ID switch" },
  { id: "EK1501-0100", name: "Coupler MM fiber→RJ45 w/ ID", fn: "cplr", io: null, ch: 0, w: 51, ebus: +2000, coupler: true, idSwitch: true, fiber: true, desc: "Multi-mode fiber optic to RJ45, ID switch" },
  { id: "EK1814", name: "Coupler + 4 DI / 4 DO",       fn: "cplr", io: "mix", ch: 8, w: 44, ebus: +2000, coupler: true, ek18: true, pinout: [{ r: "us24" }, { r: "di", ch: 1 }, { r: "di", ch: 3 }, null, null, { r: "up24" }, { r: "do", ch: 1 }, { r: "do", ch: 3 }, { r: "us0" }, { r: "di", ch: 2 }, { r: "di", ch: 4 }, null, null, { r: "up0" }, { r: "do", ch: 2 }, { r: "do", ch: 4 }], desc: "EK1100 + 4 digital inputs, 4 digital outputs 24 V, HD block (verified pinout)" },
  { id: "EK1818", name: "Coupler + 8 DI / 4 DO",       fn: "cplr", io: "mix", ch: 12, w: 44, ebus: +2000, coupler: true, ek18: true, pinout: [{ r: "us24" }, { r: "di", ch: 1 }, { r: "di", ch: 3 }, { r: "di", ch: 5 }, { r: "di", ch: 7 }, { r: "up24" }, { r: "do", ch: 1 }, { r: "do", ch: 3 }, { r: "us0" }, { r: "di", ch: 2 }, { r: "di", ch: 4 }, { r: "di", ch: 6 }, { r: "di", ch: 8 }, { r: "up0" }, { r: "do", ch: 2 }, { r: "do", ch: 4 }], desc: "EK1100 + 8 DI / 4 DO 24 V, HD block (verified pinout)" },
  { id: "EK1828", name: "Coupler + 4 DI / 8 DO",       fn: "cplr", io: "mix", ch: 12, w: 44, ebus: +2000, coupler: true, ek18: true, pinout: [{ r: "us24" }, { r: "di", ch: 1 }, { r: "di", ch: 3 }, { r: "do", ch: 1 }, { r: "do", ch: 3 }, { r: "up24" }, { r: "do", ch: 5 }, { r: "do", ch: 7 }, { r: "us0" }, { r: "di", ch: 2 }, { r: "di", ch: 4 }, { r: "do", ch: 2 }, { r: "do", ch: 4 }, { r: "up0" }, { r: "do", ch: 6 }, { r: "do", ch: 8 }], desc: "EK1100 + 4 DI / 8 DO 24 V, HD block (verified pinout)" },
  { id: "EK1828-0010", name: "Coupler + 8 DO",         fn: "cplr", io: "mix", ch: 8, w: 44, ebus: +2000, coupler: true, ek18: true, pinout: [{ r: "us24" }, null, null, { r: "do", ch: 1 }, { r: "do", ch: 3 }, { r: "up24" }, { r: "do", ch: 5 }, { r: "do", ch: 7 }, { r: "us0" }, null, null, { r: "do", ch: 2 }, { r: "do", ch: 4 }, { r: "up0" }, { r: "do", ch: 6 }, { r: "do", ch: 8 }], desc: "EK1100 + 8 digital outputs 24 V, HD block (verified pinout)" },
  { id: "EK1914", name: "Coupler + TwinSAFE I/O",      fn: "cplr", io: "mix", ch: 12, w: 44, ebus: +500, coupler: true, ek18: true, safety: true, twinsafe: true, pinout: [{ r: "us24" }, { r: "di", ch: 1 }, { r: "di", ch: 3 }, { r: "do", ch: 1 }, { r: "do", ch: 3 }, CLK(5), { r: "di", ch: 5, safe: true }, { r: "do", ch: 5, safe: true }, { r: "us0" }, { r: "di", ch: 2 }, { r: "di", ch: 4 }, { r: "do", ch: 2 }, { r: "do", ch: 4 }, CLK(6), { r: "di", ch: 6, safe: true }, { r: "do", ch: 6, safe: true }], desc: "EtherCAT coupler with 4 standard DI + 4 standard DO and 2 safe inputs + 2 safe outputs (clamps 6–8 / 14–16); power contacts fed from Us, max. 4 A" },
  { id: "EK1960", name: "TwinSAFE Compact Controller", fn: "cplr", io: "mix", ch: 44, w: 230.5, ebus: +500, coupler: true, compact: true, safety: true, twinsafe: true, tsLogic: true, pinout: EK1960_PINS, desc: "TwinSAFE Logic, 20 safe inputs (X6 / X8), 24 safe outputs from Up1–Up6 (X5 / X7 / X9), relay option X4, power X3 (Us / GND / Up / GND)" },
  { id: "EK1310", name: "EtherCAT P Extension",        fn: "sys",  io: null, ch: 0, w: 12, ebus: -130, ext: true, desc: "EtherCAT P extension with feed-in, M8" },
  { id: "EK1121-0010", name: "1-Port Junction Extended Distance", fn: "sys", io: null, ch: 0, w: 12, ebus: -200, junction: true, ports: 1, desc: "Extended Distance junction (up to 300 m)" },
  { id: "EK1122-0080", name: "2-Port Junction Fast Hot Connect", fn: "sys", io: null, ch: 0, w: 24, ebus: -220, junction: true, jM7: true, desc: "2-port junction with Fast Hot Connect" },
  { id: "EK1322", name: "2-Port EtherCAT P Junction",  fn: "sys",  io: null, ch: 0, w: 24, ebus: -220, junction: true, desc: "EtherCAT P junction with feed-in" },
  { id: "EK1521", name: "1-Port MM Fiber Junction",    fn: "sys",  io: null, ch: 0, w: 24, ebus: -200, junction: true, fiber: true, ports: 1, desc: "Multi-mode fiber-optic junction, SC duplex" },
  { id: "EK1521-0010", name: "1-Port SM Fiber Junction", fn: "sys", io: null, ch: 0, w: 24, ebus: -200, junction: true, fiber: true, ports: 1, desc: "Single-mode fiber-optic junction, up to 20 km" },
  // --- System / Power ---
  { id: "EL9011", name: "End Cover (E-bus)",           fn: "sys", io: null, ch: 0, w: 5, ebus: 0, endcap: true, desc: "Covers E-bus contacts of last terminal, 5 mm (verified)" },
  { id: "EL9012", name: "End Cover (power + E-bus)",   fn: "sys", io: null, ch: 0, w: 5, ebus: 0, endcap: true, desc: "Covers power contacts in addition to E-bus, 500 V isolation, 5 mm (verified)" },
  { id: "EL9080", name: "Separation Terminal",         fn: "sys", io: null, ch: 0, w: 12, ebus: 0, blank: true, pcBreak: true, sep: true, desc: "Orange front; interrupts the power contacts (E-bus passes through) — separates potential groups (verified)" },
  { id: "EL9100", name: "Potential Feed 24V",          fn: "sys", io: null, ch: 0, w: 12, ebus: 0, feed: true, pcFeed: true, desc: "New 24 V DC potential group for power contacts, ≤ 10 A. Clamps 2/6 +24 V, 3/7 0 V, 4/8 PE, 1/5 not used; green Power LED (verified)" },
  { id: "EL9110", name: "Potential Feed 24V w/ diag",  fn: "sys", io: null, ch: 0, w: 12, ebus: -90, feed: true, pcFeed: true, desc: "24 V DC feed, ≤ 10 A, reports PowerOK in the process data. Clamps 2/6 +24 V, 3/7 0 V, 4/8 PE, 1/5 not used (verified)" },
  { id: "EL9150", name: "Potential Feed 230V AC",      fn: "sys", io: null, ch: 0, w: 12, ebus: 0, feed: true, pcFeed: true, ac: true, desc: "120…230 V AC potential group for power contacts, ≤ 10 A. Clamps 2/6 L, 3/7 N, 4/8 PE, 1/5 not used (verified)" },
  { id: "EL9186", name: "Potential Distribution 24V",  fn: "sys", io: null, ch: 8, w: 12, ebus: 0, dist: "24V", distTabs: "num", noPE: true, pins: ["p24", "p24", "p24", "p24", "p24", "p24", "p24", "p24"],
    desc: "8 outputs on the + power contact; no PE power contact (verified)" },
  { id: "EL9187", name: "Potential Distribution 0V",   fn: "sys", io: null, ch: 8, w: 12, ebus: 0, dist: "0V", distTabs: "num", noPE: true, pins: ["gnd", "gnd", "gnd", "gnd", "gnd", "gnd", "gnd", "gnd"],
    desc: "8 outputs on the − power contact; no PE power contact (verified)" },
  { id: "EL9410", name: "E-Bus Power Supply",          fn: "sys", io: null, ch: 0, w: 12, ebus: +2000, feed: true, pcFeed: true, desc: "Refreshes the E-bus (2 A) and starts a new potential group. Clamps 1/5 +24 V / 0 V for the E-bus, 2/6 +24 V, 3/7 0 V, 4/8 PE (verified)" },
  { id: "EL9505", name: "Power Supply 5V",             fn: "sys", io: null, ch: 0, w: 12, ebus: -90, feed: true, pcFeed: true, uOut: 5, desc: "In 24 V DC (clamps 1/5), out 5 V DC / 0.5 A on 2/6 and the power contacts, 0 V out on 3/7, PE 4/8; not isolated (verified)" },
  // — system terminals from Beckhoff catalog 2026 (typical values, approximate) —
  { id: "EL9070", name: "Shield Terminal",             fn: "sys", io: null, ch: 8, w: 12, ebus: 0, dist: true, pins: ["b1", "b1", "b1", "b1", "b1", "b1", "b1", "b1"], desc: "Shield terminal: clamps 1-8 linked to each other, grey blank tabs (verified)" },
  { id: "EL9195", name: "Shield Terminal",             fn: "sys", io: null, ch: 0, w: 12, ebus: 0, feed: true, pcFeed: true, anyV: true, desc: "Shield feed for any voltage: 1 ↔ 5 bridged, 2/6 to the + contact, 3/7 0 V / N, 4/8 shield on the DIN rail (verified)" },
  { id: "EL9160", name: "Potential Feed 230V AC w/ diag", fn: "sys", io: null, ch: 0, w: 12, ebus: 0, feed: true, pcFeed: true, ac: true, desc: "120…230 V AC feed, reports PowerOK in the process data. Clamps 2/6 L, 3/7 N, 4/8 PE, 1/5 not used (verified)" },
  { id: "EL9190", name: "Potential Feed any voltage",  fn: "sys", io: null, ch: 0, w: 12, ebus: 0, feed: true, pcFeed: true, anyV: true, desc: "Feed for any voltage up to 230 V AC/DC, no LED. Clamps 2/6 L, 3/7 N, 4/8 PE, 1/5 not used (verified)" },
  { id: "EL9200", name: "Potential Feed 24V w/ fuse",  fn: "sys", io: null, ch: 0, w: 12, ebus: 0, feed: true, pcFeed: true, fused: true, desc: "24 V DC feed, 6.3 A fine-wire fuse. Clamps 1/4 +24 V, 2/5 0 V, 3/6 PE; Power and Error (fuse) LEDs (verified)" },
  { id: "EL9210", name: "Potential Feed 24V fuse+diag", fn: "sys", io: null, ch: 0, w: 12, ebus: -90, feed: true, pcFeed: true, fused: true, desc: "24 V DC feed, 6.3 A fuse, reports PowerOK and FuseError. Clamps 1/4 +24 V, 2/5 0 V, 3/6 PE (verified)" },
  { id: "EL9520", name: "Potential Feed 24V w/ filter", fn: "sys", io: null, ch: 0, w: 12, ebus: 0, feed: true, pcFeed: true, desc: "24 V DC feed with surge filter" },
  { id: "EL9184", name: "Potential Distribution 8×24V + 8×0V", fn: "sys", io: null, ch: 16, w: 12, ebus: 0, hd: true, dist: true, pins: ["p24", "p24", "p24", "p24", "p24", "p24", "p24", "p24", "gnd", "gnd", "gnd", "gnd", "gnd", "gnd", "gnd", "gnd"],
    desc: "HD: clamps 1-8 on the + power contact, 9-16 on the − power contact (verified)" },
  { id: "EL9188", name: "Potential Distribution 16×24V HD", fn: "sys", io: null, ch: 16, w: 12, ebus: 0, dist: "24V", hd: true, pins: ["p24", "p24", "p24", "p24", "p24", "p24", "p24", "p24", "p24", "p24", "p24", "p24", "p24", "p24", "p24", "p24"], desc: "HD: clamps 1-16 on the + power contact (verified)" },
  { id: "EL9189", name: "Potential Distribution 16×0V HD",  fn: "sys", io: null, ch: 16, w: 12, ebus: 0, dist: "0V", hd: true, pins: ["gnd", "gnd", "gnd", "gnd", "gnd", "gnd", "gnd", "gnd", "gnd", "gnd", "gnd", "gnd", "gnd", "gnd", "gnd", "gnd"], desc: "HD: clamps 1-16 on the − power contact (verified)" },
  { id: "EL9180", name: "Potential Distribution 2×24V/0V/PE", fn: "sys", io: null, ch: 8, w: 12, ebus: 0, dist: true, pins: ["b1", "p24", "gnd", "pe", "b1", "p24", "gnd", "pe"],
    desc: "Clamps 2/6 +24 V, 3/7 0 V, 4/8 PE from the power contacts; 1 and 5 are bridged to each other only (verified)" },
  { id: "EL9181", name: "Potential Distribution 2×8 HD", fn: "sys", io: null, ch: 16, w: 12, ebus: 0, hd: true, dist: true, pins: ["b1", "b1", "b1", "b1", "b1", "b1", "b1", "b1", "b2", "b2", "b2", "b2", "b2", "b2", "b2", "b2"],
    desc: "HD: two free potentials, clamps 1-8 and 9-16 bridged internally, ≤ 60 V (verified)" },
  { id: "EL9182", name: "Potential Distribution 8×2 HD", fn: "sys", io: null, ch: 16, w: 12, ebus: 0, hd: true, dist: true, pins: ["b1", "b2", "b3", "b4", "b5", "b6", "b7", "b8", "b1", "b2", "b3", "b4", "b5", "b6", "b7", "b8"],
    desc: "HD: eight free potentials, clamp n bridged to n + 8, ≤ 60 V (verified)" },
  { id: "EL9183", name: "Potential Distribution 1×16 HD", fn: "sys", io: null, ch: 16, w: 12, ebus: 0, hd: true, dist: true, pins: ["b1", "b1", "b1", "b1", "b1", "b1", "b1", "b1", "b1", "b1", "b1", "b1", "b1", "b1", "b1", "b1"],
    desc: "HD: one free potential, clamps 1-16 bridged internally, ≤ 60 V (verified)" },
  { id: "EL9185", name: "Potential Distribution 4×24V + 4×0V", fn: "sys", io: null, ch: 8, w: 12, ebus: 0, dist: true, pins: ["p24", "p24", "gnd", "gnd", "p24", "p24", "gnd", "gnd"],
    desc: "Clamps 1, 2, 5, 6 on the + power contact; 3, 4, 7, 8 on the − power contact (verified)" },
  { id: "EL9185-0010", name: "Potential Distribution 4×+ / 4×− any V", fn: "sys", io: null, ch: 8, w: 12, ebus: 0, dist: true, pins: ["up", "up", "un", "un", "up", "up", "un", "un"],
    desc: "Any voltage up to 230 V AC/DC: clamps 1, 2, 5, 6 on the + contact, 3, 4, 7, 8 on the − contact (verified)" },
  { id: "EL9221", name: "Overcurrent Protection 1-Ch", fn: "sys", io: null, ch: 1, w: 12, ebus: -100, feed: true, pcFeed: true, efuse: true, desc: "EL9221-5000: 1 DI1, 5 protected output 1 on the + contact, 2/6 +24 V in, 3/7 0 V in, 4/8 not used (verified)" },
  { id: "EL9222", name: "Overcurrent Protection 2-Ch", fn: "sys", io: null, ch: 2, w: 12, ebus: -100, feed: true, pcFeed: true, efuse: true, desc: "EL9222-5500: DI1 / DI2 on 1 / 4, output 1 on 5 (+ contact), output 2 on 8, 2/6 +24 V in, 3/7 0 V in (verified)" },
  { id: "EL9227", name: "Overcurrent Protection 2-Ch adv.", fn: "sys", io: null, ch: 2, w: 12, ebus: -100, feed: true, pcFeed: true, efuse: true, desc: "EL9227-5500: as EL9222-5500 with extended diagnostics (verified)" },
  { id: "EL9501", name: "Power Supply 0…20V",          fn: "sys", io: null, ch: 0, w: 12, ebus: -60, feed: true, desc: "In 24 V DC, out 0…20 V / 0…2 A" },
  { id: "EL9508", name: "Power Supply 8V",             fn: "sys", io: null, ch: 0, w: 12, ebus: -90, feed: true, pcFeed: true, uOut: 8, desc: "In 24 V DC (clamps 1/5), out 8 V DC / 0.5 A on 2/6 and the power contacts, 0 V out on 3/7, PE 4/8; not isolated (verified)" },
  { id: "EL9510", name: "Power Supply 10V",            fn: "sys", io: null, ch: 0, w: 12, ebus: -90, feed: true, pcFeed: true, uOut: 10, desc: "In 24 V DC (clamps 1/5), out 10 V DC / 0.5 A on 2/6 and the power contacts, 0 V out on 3/7, PE 4/8; not isolated (verified)" },
  { id: "EL9512", name: "Power Supply 12V",            fn: "sys", io: null, ch: 0, w: 12, ebus: -90, feed: true, pcFeed: true, uOut: 12, desc: "In 24 V DC (clamps 1/5), out 12 V DC / 0.5 A on 2/6 and the power contacts, 0 V out on 3/7, PE 4/8; not isolated (verified)" },
  { id: "EL9515", name: "Power Supply 15V",            fn: "sys", io: null, ch: 0, w: 12, ebus: -90, feed: true, pcFeed: true, uOut: 15, desc: "In 24 V DC (clamps 1/5), out 15 V DC / 0.5 A on 2/6 and the power contacts, 0 V out on 3/7, PE 4/8; not isolated (verified)" },
  { id: "EL9560", name: "Power Supply 24V isolated",   fn: "sys", io: null, ch: 0, w: 12, ebus: -90, feed: true, pcFeed: true, uOut: 24, iso: true, desc: "In 24 V DC (clamps 1/5), out 24 V DC / 0.1 A on 2/6 and the power contacts, 0 V out on 3/7, PE 4/8; output isolated from the input (verified)" },
  { id: "EL9540", name: "Surge Filter Field Supply",   fn: "sys", io: null, ch: 0, w: 12, ebus: 0, feed: true, pcFeed: true, desc: "Surge filter feed: 2/6 +24 V, 3/7 0 V, 4/8 PE, 1/5 not connected; green Power LED (verified)" },
  { id: "EL9550", name: "Surge Filter",                fn: "sys", io: null, ch: 0, w: 12, ebus: 0, feed: true, pcFeed: true, sysFilter: true, desc: "Surge filter for field and system supply: 2/6 +24 V field, 3/7 0 V field, 4 / 8 system in, 1 / 5 system out (verified)" },
  { id: "EL9570", name: "Buffer Capacitor",            fn: "sys", io: null, ch: 8, w: 12, ebus: 0, dist: true, pins: ["r1", "up", "up", "up", "r2", "un", "un", "un"], desc: "Buffer capacitor: 2-4 +Uin, 6-8 −Uin on the power contacts, 1 / 5 external resistor; Overload LED (verified)" },
  { id: "EL9576", name: "Brake Chopper",               fn: "sys", io: null, ch: 8, w: 12, ebus: 0, dist: true, pins: ["r1", "up", "up", "up", "r2", "un", "un", "un"], desc: "Brake chopper up to 72 V: 2-4 +Uin, 6-8 −Uin on the power contacts, 1 / 5 external brake resistor (verified)" },
  { id: "EL9930", name: "PROFIsafe Segment End",       fn: "sys", io: null, ch: 0, w: 12, ebus: 0, blank: true, desc: "PROFIsafe segment end terminal" },
  // --- ED series (push-in successors of the EL range; Beckhoff product pages) ---
  { id: "ED1008", name: "8-Ch DI 24V 3ms push-in", fn: "di", io: "di", ch: 8, w: 12, ebus: -65, ed: true, desc: "ED series, push-in. Pinout from the product picture (I1/I2 on clamps 1/5); data from beckhoff.com",
    pinout: [{ r: "di", ch: 1 }, { r: "di", ch: 3 }, { r: "di", ch: 5 }, { r: "di", ch: 7 }, { r: "di", ch: 2 }, { r: "di", ch: 4 }, { r: "di", ch: 6 }, { r: "di", ch: 8 }] },
  { id: "ED1808", name: "8-Ch DI 24V 2-wire push-in", fn: "di", io: "di", ch: 8, w: 12, ebus: -65, ed: true, hd: true, desc: "ED series, push-in. data from beckhoff.com" },
  { id: "ED1809", name: "16-Ch DI 24V 3ms push-in", fn: "di", io: "di", ch: 16, w: 12, ebus: -65, ed: true, hd: true, desc: "ED series, push-in. data from beckhoff.com" },
  { id: "ED1819", name: "16-Ch DI 24V 10µs push-in", fn: "di", io: "di", ch: 16, w: 12, ebus: -65, ed: true, hd: true, desc: "ED series, push-in. data from beckhoff.com" },
  { id: "ED1829", name: "16-Ch DI 24V pos./neg. push-in", fn: "di", io: "di", ch: 16, w: 12, ebus: -95, ed: true, hd: true, desc: "ED series, push-in. data from beckhoff.com" },
  { id: "ED1839", name: "16-Ch DI 24V adjustable push-in", fn: "di", io: "di", ch: 16, w: 12, ebus: -55, ed: true, hd: true, desc: "ED series, push-in. data from beckhoff.com" },
  { id: "ED1859", name: "8-Ch DI + 8-Ch DO 24V push-in", fn: "di", io: "mix", ch: 16, w: 12, ebus: -85, ed: true, hd: true, upA: 4, desc: "ED series, push-in. Inputs on clamps 1-8, outputs on 9-16, 0.5 A each (verified); data from beckhoff.com",
    pinout: [{ r: "di", ch: 1 }, { r: "di", ch: 2 }, { r: "di", ch: 3 }, { r: "di", ch: 4 }, { r: "di", ch: 5 }, { r: "di", ch: 6 }, { r: "di", ch: 7 }, { r: "di", ch: 8 }, { r: "do", ch: 1 }, { r: "do", ch: 2 }, { r: "do", ch: 3 }, { r: "do", ch: 4 }, { r: "do", ch: 5 }, { r: "do", ch: 6 }, { r: "do", ch: 7 }, { r: "do", ch: 8 }] },
  { id: "ED1889", name: "16-Ch DI 24V neg. push-in", fn: "di", io: "di", ch: 16, w: 12, ebus: -65, ed: true, hd: true, desc: "ED series, push-in. data from beckhoff.com" },
  { id: "ED2008", name: "8-Ch DO 24V 0.5A push-in", fn: "do", io: "do", ch: 8, w: 12, ebus: -80, ed: true, upA: 4, desc: "ED series, push-in. Pinout from the product picture (O1/O2 on clamps 1/5); data from beckhoff.com",
    pinout: [{ r: "do", ch: 1 }, { r: "do", ch: 3 }, { r: "do", ch: 5 }, { r: "do", ch: 7 }, { r: "do", ch: 2 }, { r: "do", ch: 4 }, { r: "do", ch: 6 }, { r: "do", ch: 8 }] },
  { id: "ED2032", name: "2-Ch DO 24V 2A diag push-in", fn: "do", io: "do", ch: 2, w: 12, ebus: -65, ed: true, upA: 4, desc: "ED series, push-in. data from beckhoff.com" },
  { id: "ED2034", name: "4-Ch DO 24V 2A diag push-in", fn: "do", io: "do", ch: 4, w: 12, ebus: -70, ed: true, upA: 8, desc: "ED series, push-in. data from beckhoff.com" },
  { id: "ED2808", name: "8-Ch DO 24V 0.5A 2-wire push-in", fn: "do", io: "do", ch: 8, w: 12, ebus: -75, ed: true, hd: true, upA: 4, desc: "ED series, push-in. data from beckhoff.com" },
  { id: "ED2809", name: "16-Ch DO 24V 0.5A push-in", fn: "do", io: "do", ch: 16, w: 12, ebus: -100, ed: true, hd: true, upA: 8, desc: "ED series, push-in. data from beckhoff.com" },
  { id: "ED2828", name: "8-Ch DO 24V 2A push-in", fn: "do", io: "do", ch: 8, w: 12, ebus: -80, ed: true, hd: true, upA: 16, desc: "ED series, push-in. data from beckhoff.com" },
  { id: "ED2838", name: "8-Ch DO 24V 2A diag push-in", fn: "do", io: "do", ch: 8, w: 12, ebus: -85, ed: true, hd: true, upA: 16, desc: "ED series, push-in. data from beckhoff.com" },
  { id: "ED2889", name: "16-Ch DO 24V 0.5A neg. push-in", fn: "do", io: "do", ch: 16, w: 12, ebus: -100, ed: true, hd: true, upA: 8, desc: "ED series, push-in. data from beckhoff.com" },
  { id: "ED3072", name: "2-Ch AI ±10V/±20mA 16bit push-in", fn: "ai", io: "ai", ch: 2, w: 12, ebus: -85, ed: true, hd: true, desc: "ED series, push-in. data from beckhoff.com" },
  { id: "ED3074", name: "4-Ch AI ±10V/±20mA 16bit push-in", fn: "ai", io: "ai", ch: 4, w: 12, ebus: -95, ed: true, hd: true, desc: "ED series, push-in. data from beckhoff.com" },
  { id: "ED3078", name: "8-Ch AI ±10V/±20mA 16bit push-in", fn: "ai", io: "ai", ch: 8, w: 12, ebus: -100, ed: true, hd: true, desc: "ED series, push-in. data from beckhoff.com" },
  { id: "ED3172", name: "2-Ch AI ±10V/±20mA 20ksps push-in", fn: "ai", io: "ai", ch: 2, w: 12, ebus: -180, ed: true, hd: true, desc: "ED series, push-in. data from beckhoff.com" },
  { id: "ED3174", name: "4-Ch AI ±10V/±20mA 20ksps push-in", fn: "ai", io: "ai", ch: 4, w: 12, ebus: -180, ed: true, hd: true, desc: "ED series, push-in. data from beckhoff.com" },
  { id: "ED4072", name: "2-Ch AO ±10V/±20mA 16bit push-in", fn: "ao", io: "ao", ch: 2, w: 12, ebus: -100, ed: true, hd: true, desc: "ED series, push-in. data from beckhoff.com" },
  { id: "ED4074", name: "4-Ch AO ±10V/±20mA 16bit push-in", fn: "ao", io: "ao", ch: 4, w: 12, ebus: -125, ed: true, hd: true, desc: "ED series, push-in. data from beckhoff.com" },
  { id: "ED4078", name: "8-Ch AO ±10V/±20mA 16bit push-in", fn: "ao", io: "ao", ch: 8, w: 12, ebus: -180, ed: true, hd: true, desc: "ED series, push-in. data from beckhoff.com" },
  { id: "ED4172", name: "2-Ch AO ±10V/±20mA 10ksps push-in", fn: "ao", io: "ao", ch: 2, w: 12, ebus: -70, ed: true, hd: true, desc: "ED series, push-in. data from beckhoff.com" },
  { id: "ED4174", name: "4-Ch AO ±10V/±20mA 10ksps push-in", fn: "ao", io: "ao", ch: 4, w: 12, ebus: -70, ed: true, hd: true, desc: "ED series, push-in. data from beckhoff.com" },
  // --- Digital Input ---
  { id: "EL1002", name: "2-Ch DI 24V 3ms",   fn: "di", io: "di", ch: 2,  w: 12, ebus: -90,
    pinout: [{ r: "di", ch: 1 }, { r: "p24" }, { r: "gnd" }, { r: "pe" }, { r: "di", ch: 2 }, { r: "p24" }, { r: "gnd" }, { r: "pe" }] },
  { id: "EL1004", name: "4-Ch DI 24V 3ms",   fn: "di", io: "di", ch: 4,  w: 12, ebus: -90,
    pinout: [{ r: "di", ch: 1 }, { r: "p24" }, { r: "p24" }, { r: "di", ch: 3 }, { r: "di", ch: 2 }, { r: "p24" }, { r: "p24" }, { r: "di", ch: 4 }] },
  { id: "EL1008", name: "8-Ch DI 24V 3ms",   fn: "di", io: "di", ch: 8,  w: 12, ebus: -90,
    pinout: [{ r: "di", ch: 1 }, { r: "di", ch: 3 }, { r: "di", ch: 5 }, { r: "di", ch: 7 }, { r: "di", ch: 2 }, { r: "di", ch: 4 }, { r: "di", ch: 6 }, { r: "di", ch: 8 }] },
  { id: "EL1014", name: "4-Ch DI 24V 10µs",  fn: "di", io: "di", ch: 4,  w: 12, ebus: -90,
    pinout: [{ r: "di", ch: 1 }, { r: "p24" }, { r: "p24" }, { r: "di", ch: 3 }, { r: "di", ch: 2 }, { r: "p24" }, { r: "p24" }, { r: "di", ch: 4 }] },
  { id: "EL1018", name: "8-Ch DI 24V 10µs",  fn: "di", io: "di", ch: 8,  w: 12, ebus: -90,
    pinout: [{ r: "di", ch: 1 }, { r: "di", ch: 3 }, { r: "di", ch: 5 }, { r: "di", ch: 7 }, { r: "di", ch: 2 }, { r: "di", ch: 4 }, { r: "di", ch: 6 }, { r: "di", ch: 8 }] },
  { id: "EL1088", name: "8-Ch DI 24V neg.",  fn: "di", io: "di", ch: 8,  w: 12, ebus: -90, desc: "Ground-switching inputs" },
  { id: "EL1104", name: "4-Ch DI 24V +sensor supply", fn: "di", io: "di", ch: 4, w: 12, ebus: -90 },
  { id: "EL1809", name: "16-Ch DI 24V HD",   fn: "di", io: "di", ch: 16, w: 12, ebus: -130, hd: true },
  { id: "EL1819", name: "16-Ch DI 24V 10µs HD", fn: "di", io: "di", ch: 16, w: 12, ebus: -130, hd: true },
  // — DI additions from Beckhoff catalog 2026 (typical values, approximate) —
  { id: "EL1012", name: "2-Ch DI 24V 10µs",  fn: "di", io: "di", ch: 2,  w: 12, ebus: -90 },
  { id: "EL1024", name: "4-Ch DI 24V type 2", fn: "di", io: "di", ch: 4, w: 12, ebus: -90 },
  { id: "EL1084", name: "4-Ch DI 24V neg.",  fn: "di", io: "di", ch: 4,  w: 12, ebus: -90, desc: "Ground-switching inputs" },
  { id: "EL1094", name: "4-Ch DI 24V neg. 10µs", fn: "di", io: "di", ch: 4, w: 12, ebus: -90, desc: "Ground-switching inputs" },
  { id: "EL1098", name: "8-Ch DI 24V neg. 10µs", fn: "di", io: "di", ch: 8, w: 12, ebus: -90, desc: "Ground-switching inputs" },
  { id: "EL1114", name: "4-Ch DI 24V 10µs +sensor supply", fn: "di", io: "di", ch: 4, w: 12, ebus: -90 },
  { id: "EL1124", name: "4-Ch DI 5V",        fn: "di", io: "di", ch: 4,  w: 12, ebus: -90 },
  { id: "EL1134", name: "4-Ch DI 48V",       fn: "di", io: "di", ch: 4,  w: 12, ebus: -90 },
  { id: "EL1144", name: "4-Ch DI 12V",       fn: "di", io: "di", ch: 4,  w: 12, ebus: -90 },
  { id: "EL1202", name: "2-Ch DI 24V 1µs XFC", fn: "di", io: "di", ch: 2, w: 12, ebus: -110, desc: "Extreme Fast Control, TON/TOFF 1 µs" },
  { id: "EL1252", name: "2-Ch DI 24V timestamp XFC", fn: "di", io: "di", ch: 2, w: 12, ebus: -110, desc: "Timestamped inputs, XFC" },
  { id: "EL1262", name: "2-Ch DI 24V oversampling", fn: "di", io: "di", ch: 2, w: 12, ebus: -130 },
  { id: "EL1502", name: "2-Ch Up/Down Counter 100kHz", fn: "di", io: "di", ch: 2, w: 12, ebus: -130, desc: "Type 1, 100 kHz, 32 bit counter" },
  { id: "EL1512", name: "2-Ch Counter 1kHz", fn: "di", io: "di", ch: 2,  w: 12, ebus: -130, desc: "Up counter, 32 bit" },
  { id: "EL1804", name: "4-Ch DI 24V 3-wire HD", fn: "di", io: "di", ch: 4, w: 12, ebus: -100, hd: true, desc: "16-point housing, signal/+24 V/0 V per sensor" },
  { id: "EL1808", name: "8-Ch DI 24V 2-wire HD", fn: "di", io: "di", ch: 8, w: 12, ebus: -110, hd: true, desc: "16-point housing, 8 × 24 V supply points" },
  { id: "EL1814", name: "4-Ch DI 24V 10µs 3-wire HD", fn: "di", io: "di", ch: 4, w: 12, ebus: -100, hd: true },
  { id: "EL1889", name: "16-Ch DI 24V neg. HD", fn: "di", io: "di", ch: 16, w: 12, ebus: -130, hd: true, desc: "Ground-switching inputs" },
  { id: "EL1859", name: "8-Ch DI + 8-Ch DO 24V HD", fn: "di", io: "mix", ch: 16, w: 12, ebus: -130, hd: true, upA: 4,
    desc: "Combi terminal: inputs on clamps 1-8 (0 V reference from the power contact), outputs on 9-16 fed from the +24 V power contact, 0.5 A each (verified)",
    pinout: [{ r: "di", ch: 1 }, { r: "di", ch: 2 }, { r: "di", ch: 3 }, { r: "di", ch: 4 }, { r: "di", ch: 5 }, { r: "di", ch: 6 }, { r: "di", ch: 7 }, { r: "di", ch: 8 }, { r: "do", ch: 1 }, { r: "do", ch: 2 }, { r: "do", ch: 3 }, { r: "do", ch: 4 }, { r: "do", ch: 5 }, { r: "do", ch: 6 }, { r: "do", ch: 7 }, { r: "do", ch: 8 }] },
  // --- Digital Output ---
  { id: "EL2002", name: "2-Ch DO 24V 0.5A",  fn: "do", io: "do", ch: 2,  w: 12, ebus: -100, upA: 1 },
  { id: "EL2004", name: "4-Ch DO 24V 0.5A",  fn: "do", io: "do", ch: 4,  w: 12, ebus: -100, upA: 2,
    pinout: [{ r: "do", ch: 1 }, { r: "gnd" }, { r: "gnd" }, { r: "do", ch: 3 }, { r: "do", ch: 2 }, { r: "gnd" }, { r: "gnd" }, { r: "do", ch: 4 }] },
  { id: "EL2008", name: "8-Ch DO 24V 0.5A",  fn: "do", io: "do", ch: 8,  w: 12, ebus: -110, upA: 4,
    pinout: [{ r: "do", ch: 1 }, { r: "do", ch: 3 }, { r: "do", ch: 5 }, { r: "do", ch: 7 }, { r: "do", ch: 2 }, { r: "do", ch: 4 }, { r: "do", ch: 6 }, { r: "do", ch: 8 }] },
  { id: "EL2022", name: "2-Ch DO 24V 2A",    fn: "do", io: "do", ch: 2,  w: 12, ebus: -100, upA: 4 },
  { id: "EL2024", name: "4-Ch DO 24V 2A",    fn: "do", io: "do", ch: 4,  w: 12, ebus: -100, upA: 8 },
  { id: "EL2124", name: "4-Ch DO 5V TTL",    fn: "do", io: "do", ch: 4,  w: 12, ebus: -100 },
  { id: "EL2202", name: "2-Ch DO 24V push-pull TON/TOFF", fn: "do", io: "do", ch: 2, w: 12, ebus: -100, upA: 1 },
  { id: "EL2522", name: "2-Ch Pulse Train Output", fn: "do", io: "do", ch: 2, w: 12, ebus: -140, desc: "Incremental encoder emulation / PTO for drives" },
  { id: "EL2622", name: "2-Ch Relay 230VAC/30VDC 5A", fn: "do", io: "do", ch: 2, w: 12, ebus: -100, relay: true, pcBreak: true, desc: "Potential-free contacts; power contacts are NOT looped through (verified)" },
  { id: "EL2624", name: "4-Ch Relay 125VAC 0.5A", fn: "do", io: "do", ch: 4, w: 12, ebus: -100, relay: true, desc: "Relay contacts wired at the front — load is not drawn from the power contacts" },
  { id: "EL2809", name: "16-Ch DO 24V 0.5A HD", fn: "do", io: "do", ch: 16, w: 12, ebus: -150, hd: true, upA: 8 },
  { id: "EL2819", name: "16-Ch DO 24V 0.5A diag HD", fn: "do", io: "do", ch: 16, w: 12, ebus: -150, hd: true, upA: 8 },
  // — DO additions from Beckhoff catalog 2026 (typical values, approximate) —
  { id: "EL2032", name: "2-Ch DO 24V 2A diag", fn: "do", io: "do", ch: 2, w: 12, ebus: -100, upA: 4 },
  { id: "EL2042", name: "2-Ch DO 24V 4A",    fn: "do", io: "do", ch: 2,  w: 12, ebus: -100, upA: 8 },
  { id: "EL2084", name: "4-Ch DO 24V 0.5A neg.", fn: "do", io: "do", ch: 4, w: 12, ebus: -100, upA: 2, desc: "Switching to 0 V" },
  { id: "EL2088", name: "8-Ch DO 24V 0.5A neg.", fn: "do", io: "do", ch: 8, w: 12, ebus: -110, upA: 4, desc: "Switching to 0 V" },
  { id: "EL2262", name: "2-Ch DO 24V oversampling", fn: "do", io: "do", ch: 2, w: 12, ebus: -140, upA: 1 },
  { id: "EL2502", name: "2-Ch PWM Output 24V", fn: "do", io: "do", ch: 2, w: 12, ebus: -140, upA: 1, desc: "PWM current/voltage, 0.5 A" },
  { id: "EL2521", name: "1-Ch Pulse Train RS422", fn: "do", io: "do", ch: 1, w: 12, ebus: -140, desc: "Incremental encoder emulation, RS422" },
  { id: "EL2535", name: "2-Ch PWM current-controlled 1A", fn: "do", io: "do", ch: 2, w: 12, ebus: -140, upA: 2 },
  { id: "EL2564", name: "4-Ch LED Output RGBW", fn: "do", io: "do", ch: 4, w: 12, ebus: -140, upA: 4, desc: "5…48 V DC LED strings, common anode" },
  { id: "EL2595", name: "1-Ch LED Constant Current", fn: "do", io: "do", ch: 1, w: 12, ebus: -140, desc: "Dimmable constant-current LED supply" },
  { id: "EL2602", name: "2-Ch Relay 230VAC 5A make", fn: "do", io: "do", ch: 2, w: 12, ebus: -100, relay: true, desc: "Make contacts, 230 V AC / 30 V DC 5 A" },
  { id: "EL2612", name: "2-Ch Relay 125VAC changeover", fn: "do", io: "do", ch: 2, w: 12, ebus: -100, relay: true, desc: "Changeover contacts, 125 V AC 0.5 A" },
  { id: "EL2634", name: "4-Ch Relay 250VAC 4A make", fn: "do", io: "do", ch: 4, w: 12, ebus: -100, relay: true },
  { id: "EL2652", name: "2-Ch Relay 230VAC changeover", fn: "do", io: "do", ch: 2, w: 12, ebus: -100, relay: true, desc: "Changeover contacts, 230 V AC 1 A" },
  { id: "EL2712", name: "2-Ch Triac 12-230VAC 0.5A", fn: "do", io: "do", ch: 2, w: 12, ebus: -100, relay: true, desc: "Solid-state AC output (triac)" },
  { id: "EL2722", name: "2-Ch Triac 12-230VAC 1A", fn: "do", io: "do", ch: 2, w: 12, ebus: -100, relay: true, desc: "Solid-state AC output (triac)" },
  { id: "EL2798", name: "8-Ch Solid-State 30V 2A", fn: "do", io: "do", ch: 8, w: 12, ebus: -140, upA: 16, desc: "Potential-free semiconductor contacts, 30 V AC/DC" },
  { id: "EL2808", name: "8-Ch DO 24V 0.5A HD", fn: "do", io: "do", ch: 8, w: 12, ebus: -110, hd: true, upA: 4 },
  { id: "EL2828", name: "8-Ch DO 24V 2A HD", fn: "do", io: "do", ch: 8, w: 12, ebus: -150, hd: true, upA: 16 },
  { id: "EL2889", name: "16-Ch DO 24V 0.5A neg. HD", fn: "do", io: "do", ch: 16, w: 12, ebus: -150, hd: true, upA: 8, desc: "Switching to 0 V" },
  // --- Analog Input ---
  { id: "EL3002", name: "2-Ch AI ±10V 12-bit",   fn: "ai", io: "ai", ch: 2, w: 12, ebus: -130 },
  { id: "EL3004", name: "4-Ch AI ±10V 12-bit",   fn: "ai", io: "ai", ch: 4, w: 12, ebus: -130,
    pinout: [{ r: "ai", ch: 1 }, { r: "agnd" }, { r: "ai", ch: 3 }, { r: "agnd" }, { r: "ai", ch: 2 }, { r: "agnd" }, { r: "ai", ch: 4 }, { r: "agnd" }] },
  { id: "EL3008", name: "8-Ch AI ±10V 12-bit",   fn: "ai", io: "ai", ch: 8, w: 12, ebus: -130 },
  { id: "EL3054", name: "4-Ch AI 4-20mA 12-bit", fn: "ai", io: "ai", ch: 4, w: 12, ebus: -130 },
  { id: "EL3062", name: "2-Ch AI 0-10V 12-bit",  fn: "ai", io: "ai", ch: 2, w: 12, ebus: -130 },
  { id: "EL3104", name: "4-Ch AI ±10V 16-bit diff", fn: "ai", io: "ai", ch: 4, w: 12, ebus: -130 },
  { id: "EL3204", name: "4-Ch RTD PT100",        fn: "ai", io: "ai", ch: 4, w: 12, ebus: -130 },
  { id: "EL3208", name: "8-Ch RTD PT100 HD",     fn: "ai", io: "ai", ch: 8, w: 12, ebus: -140, hd: true },
  { id: "EL3314", name: "4-Ch Thermocouple",     fn: "ai", io: "ai", ch: 4, w: 12, ebus: -140 },
  { id: "EL3356", name: "1-Ch Load Cell (bridge)", fn: "ai", io: "ai", ch: 1, w: 12, ebus: -140, desc: "Strain gauge / weighing, 16-bit" },
  { id: "EL3403", name: "3-Phase Power Measurement", fn: "ai", io: "ai", ch: 3, w: 12, ebus: -140, desc: "500 V AC, current via CTs" },
  // — AI additions from Beckhoff catalog 2026 (typical values, approximate) —
  { id: "EL3001", name: "1-Ch AI ±10V 12-bit",   fn: "ai", io: "ai", ch: 1, w: 12, ebus: -130 },
  { id: "EL3021", name: "1-Ch AI 4-20mA diff 12-bit", fn: "ai", io: "ai", ch: 1, w: 12, ebus: -130 },
  { id: "EL3042", name: "2-Ch AI 0-20mA 12-bit", fn: "ai", io: "ai", ch: 2, w: 12, ebus: -130 },
  { id: "EL3044", name: "4-Ch AI 0-20mA 12-bit", fn: "ai", io: "ai", ch: 4, w: 12, ebus: -130 },
  { id: "EL3048", name: "8-Ch AI 0-20mA 12-bit", fn: "ai", io: "ai", ch: 8, w: 12, ebus: -140 },
  { id: "EL3052", name: "2-Ch AI 4-20mA 12-bit", fn: "ai", io: "ai", ch: 2, w: 12, ebus: -130 },
  { id: "EL3058", name: "8-Ch AI 4-20mA 12-bit", fn: "ai", io: "ai", ch: 8, w: 12, ebus: -140 },
  { id: "EL3061", name: "1-Ch AI 0-10V 12-bit",  fn: "ai", io: "ai", ch: 1, w: 12, ebus: -130 },
  { id: "EL3064", name: "4-Ch AI 0-10V 12-bit",  fn: "ai", io: "ai", ch: 4, w: 12, ebus: -130 },
  { id: "EL3068", name: "8-Ch AI 0-10V 12-bit",  fn: "ai", io: "ai", ch: 8, w: 12, ebus: -140 },
  { id: "EL3101", name: "1-Ch AI ±10V 16-bit diff", fn: "ai", io: "ai", ch: 1, w: 12, ebus: -130 },
  { id: "EL3102", name: "2-Ch AI ±10V 16-bit diff", fn: "ai", io: "ai", ch: 2, w: 12, ebus: -130 },
  { id: "EL3121", name: "1-Ch AI 4-20mA 16-bit diff", fn: "ai", io: "ai", ch: 1, w: 12, ebus: -130 },
  { id: "EL3124", name: "4-Ch AI 4-20mA 16-bit diff", fn: "ai", io: "ai", ch: 4, w: 12, ebus: -130 },
  { id: "EL3142", name: "2-Ch AI 0-20mA 16-bit", fn: "ai", io: "ai", ch: 2, w: 12, ebus: -130 },
  { id: "EL3144", name: "4-Ch AI 0-20mA 16-bit", fn: "ai", io: "ai", ch: 4, w: 12, ebus: -130 },
  { id: "EL3152", name: "2-Ch AI 4-20mA 16-bit", fn: "ai", io: "ai", ch: 2, w: 12, ebus: -130 },
  { id: "EL3154", name: "4-Ch AI 4-20mA 16-bit", fn: "ai", io: "ai", ch: 4, w: 12, ebus: -130 },
  { id: "EL3162", name: "2-Ch AI 0-10V 16-bit",  fn: "ai", io: "ai", ch: 2, w: 12, ebus: -130 },
  { id: "EL3164", name: "4-Ch AI 0-10V 16-bit",  fn: "ai", io: "ai", ch: 4, w: 12, ebus: -130 },
  { id: "EL3174", name: "4-Ch AI ±10V/±20mA configurable", fn: "ai", io: "ai", ch: 4, w: 12, ebus: -200, desc: "Per-channel voltage or current, 16 bit" },
  { id: "EL3201", name: "1-Ch RTD PT100 16-bit", fn: "ai", io: "ai", ch: 1, w: 12, ebus: -130 },
  { id: "EL3202", name: "2-Ch RTD PT100 16-bit", fn: "ai", io: "ai", ch: 2, w: 12, ebus: -130 },
  { id: "EL3214", name: "4-Ch RTD PT100 3-wire", fn: "ai", io: "ai", ch: 4, w: 12, ebus: -140 },
  { id: "EL3218", name: "8-Ch RTD PT100 HD",     fn: "ai", io: "ai", ch: 8, w: 12, ebus: -140, hd: true },
  { id: "EL3255", name: "5-Ch Potentiometer",    fn: "ai", io: "ai", ch: 5, w: 12, ebus: -140, desc: "Potentiometer measurement with sensor supply" },
  { id: "EL3311", name: "1-Ch Thermocouple",     fn: "ai", io: "ai", ch: 1, w: 12, ebus: -130 },
  { id: "EL3312", name: "2-Ch Thermocouple",     fn: "ai", io: "ai", ch: 2, w: 12, ebus: -130 },
  { id: "EL3318", name: "8-Ch Thermocouple HD",  fn: "ai", io: "ai", ch: 8, w: 12, ebus: -140, hd: true },
  { id: "EL3351", name: "1-Ch Resistor Bridge 16-bit", fn: "ai", io: "ai", ch: 1, w: 12, ebus: -140, desc: "Strain gauge / load cell" },
  { id: "EL3443", name: "3-Phase Power Measurement 24-bit", fn: "ai", io: "ai", ch: 3, w: 12, ebus: -140, desc: "480 V AC, extended power values" },
  { id: "EL3453", name: "3-Phase Power Measurement 690V", fn: "ai", io: "ai", ch: 3, w: 24, ebus: -140, blk: "el2x8", desc: "24 mm, 2 × 8 clamps (current IL1–IN / IL1'–IN', voltage L1–N; Infosys)" },
  { id: "EL3602", name: "2-Ch AI ±10V 24-bit",   fn: "ai", io: "ai", ch: 2, w: 12, ebus: -200, desc: "High-precision measurement" },
  { id: "EL3612", name: "2-Ch AI 0/4-20mA 24-bit", fn: "ai", io: "ai", ch: 2, w: 12, ebus: -200 },
  { id: "EL3632", name: "2-Ch IEPE Condition Monitoring", fn: "ai", io: "ai", ch: 2, w: 12, ebus: -200, desc: "Accelerometer inputs, 50 ksps" },
  { id: "EL3681", name: "Digital Multimeter 300V", fn: "ai", io: "ai", ch: 1, w: 12, ebus: -200, desc: "U/I/R measurement, CAT II" },
  { id: "EL3702", name: "2-Ch AI ±10V oversampling", fn: "ai", io: "ai", ch: 2, w: 12, ebus: -200, desc: "XFC oversampling up to 100 ksps" },
  { id: "EL3742", name: "2-Ch AI 0-20mA oversampling", fn: "ai", io: "ai", ch: 2, w: 12, ebus: -200 },
  { id: "EL3751", name: "1-Ch Multi-Function 24-bit 10ksps", fn: "ai", io: "ai", ch: 1, w: 12, ebus: -200, desc: "U/I/RTD/bridge, measurement-grade" },
  // --- Analog Output ---
  { id: "EL4002", name: "2-Ch AO 0-10V 12-bit",  fn: "ao", io: "ao", ch: 2, w: 12, ebus: -130 },
  { id: "EL4004", name: "4-Ch AO 0-10V 12-bit",  fn: "ao", io: "ao", ch: 4, w: 12, ebus: -130,
    pinout: [{ r: "ao", ch: 1 }, { r: "agnd" }, { r: "ao", ch: 3 }, { r: "agnd" }, { r: "ao", ch: 2 }, { r: "agnd" }, { r: "ao", ch: 4 }, { r: "agnd" }] },
  { id: "EL4008", name: "8-Ch AO 0-10V 12-bit",  fn: "ao", io: "ao", ch: 8, w: 12, ebus: -140 },
  { id: "EL4024", name: "4-Ch AO 4-20mA 12-bit", fn: "ao", io: "ao", ch: 4, w: 12, ebus: -130 },
  { id: "EL4102", name: "2-Ch AO ±10V 16-bit",   fn: "ao", io: "ao", ch: 2, w: 12, ebus: -130 },
  { id: "EL4134", name: "4-Ch AO ±10V 16-bit",   fn: "ao", io: "ao", ch: 4, w: 12, ebus: -140 },
  // — AO additions from Beckhoff catalog 2026 (typical values, approximate) —
  { id: "EL4001", name: "1-Ch AO 0-10V 12-bit",  fn: "ao", io: "ao", ch: 1, w: 12, ebus: -130 },
  { id: "EL4011", name: "1-Ch AO 0-20mA 12-bit", fn: "ao", io: "ao", ch: 1, w: 12, ebus: -130 },
  { id: "EL4012", name: "2-Ch AO 0-20mA 12-bit", fn: "ao", io: "ao", ch: 2, w: 12, ebus: -130 },
  { id: "EL4014", name: "4-Ch AO 0-20mA 12-bit", fn: "ao", io: "ao", ch: 4, w: 12, ebus: -130 },
  { id: "EL4018", name: "8-Ch AO 0-20mA 12-bit", fn: "ao", io: "ao", ch: 8, w: 12, ebus: -140 },
  { id: "EL4021", name: "1-Ch AO 4-20mA 12-bit", fn: "ao", io: "ao", ch: 1, w: 12, ebus: -130 },
  { id: "EL4022", name: "2-Ch AO 4-20mA 12-bit", fn: "ao", io: "ao", ch: 2, w: 12, ebus: -130 },
  { id: "EL4028", name: "8-Ch AO 4-20mA 12-bit", fn: "ao", io: "ao", ch: 8, w: 12, ebus: -140 },
  { id: "EL4031", name: "1-Ch AO ±10V 12-bit",   fn: "ao", io: "ao", ch: 1, w: 12, ebus: -130 },
  { id: "EL4032", name: "2-Ch AO ±10V 12-bit",   fn: "ao", io: "ao", ch: 2, w: 12, ebus: -130 },
  { id: "EL4034", name: "4-Ch AO ±10V 12-bit",   fn: "ao", io: "ao", ch: 4, w: 12, ebus: -130 },
  { id: "EL4038", name: "8-Ch AO ±10V 12-bit",   fn: "ao", io: "ao", ch: 8, w: 12, ebus: -140 },
  { id: "EL4104", name: "4-Ch AO 0-10V 16-bit",  fn: "ao", io: "ao", ch: 4, w: 12, ebus: -130 },
  { id: "EL4112", name: "2-Ch AO 0-20mA 16-bit", fn: "ao", io: "ao", ch: 2, w: 12, ebus: -130 },
  { id: "EL4114", name: "4-Ch AO 0-20mA 16-bit", fn: "ao", io: "ao", ch: 4, w: 12, ebus: -130 },
  { id: "EL4122", name: "2-Ch AO 4-20mA 16-bit", fn: "ao", io: "ao", ch: 2, w: 12, ebus: -130 },
  { id: "EL4124", name: "4-Ch AO 4-20mA 16-bit", fn: "ao", io: "ao", ch: 4, w: 12, ebus: -130 },
  { id: "EL4712", name: "2-Ch AO 0-20mA oversampling", fn: "ao", io: "ao", ch: 2, w: 12, ebus: -200, desc: "XFC oversampling" },
  { id: "EL4732", name: "2-Ch AO ±10V oversampling", fn: "ao", io: "ao", ch: 2, w: 12, ebus: -200, desc: "XFC oversampling" },
  // --- Position / Encoder ---
  { id: "EL5001", name: "1-Ch SSI Encoder",          fn: "mot", io: null, ch: 1, w: 12, ebus: -120 },
  { id: "EL5101", name: "1-Ch Incremental Encoder RS422", fn: "mot", io: null, ch: 1, w: 24, ebus: -130, blk: "el2x8", pinout: EL5101_PINS, desc: "24 mm, 2 × 8 clamps; pinout from Infosys (verified, beckhoff.com / Infosys)" },
  { id: "EL5151", name: "1-Ch Incremental Encoder 24V", fn: "mot", io: null, ch: 1, w: 12, ebus: -130 },
  { id: "EL5152", name: "2-Ch Incremental Encoder 24V", fn: "mot", io: null, ch: 2, w: 12, ebus: -130 },
  // — position/encoder additions from Beckhoff catalog 2026 (approximate) —
  { id: "EL5002", name: "2-Ch SSI Encoder",          fn: "mot", io: null, ch: 2, w: 12, ebus: -130 },
  { id: "EL5021", name: "1-Ch Sin/Cos Encoder 1Vpp", fn: "mot", io: null, ch: 1, w: 12, ebus: -120 },
  { id: "EL5032", name: "2-Ch EnDat 2.2 Encoder",    fn: "mot", io: null, ch: 2, w: 12, ebus: -120 },
  { id: "EL5042", name: "2-Ch BiSS-C Encoder",       fn: "mot", io: null, ch: 2, w: 12, ebus: -120 },
  { id: "EL5072", name: "2-Ch Inductive Displacement", fn: "mot", io: null, ch: 2, w: 12, ebus: -200, desc: "Inductive sensor interface (LVDT / half bridge)" },
  { id: "EL5102", name: "2-Ch Incremental Encoder RS422", fn: "mot", io: null, ch: 2, w: 24, ebus: -210, blk: "hd2x16", pinout: [...EL5102_ENC(1), ...EL5102_ENC(2)], desc: "24 mm, 2 × 16 clamps (encoder 1 left, encoder 2 right); pinout from Infosys (verified, beckhoff.com / Infosys)" },
  { id: "EL5112", name: "Incremental Encoder 2×AB / 1×ABC", fn: "mot", io: null, ch: 2, w: 12, ebus: -190 },
  { id: "EL5131", name: "1-Ch Incremental Encoder XFC", fn: "mot", io: null, ch: 1, w: 12, ebus: -240 },
  // --- Communication ---
  { id: "EL6001", name: "Serial RS232",          fn: "sys", io: null, ch: 1, w: 12, ebus: -120 },
  { id: "EL6021", name: "Serial RS422/RS485",    fn: "sys", io: null, ch: 1, w: 12, ebus: -170 },
  { id: "EL6224", name: "IO-Link Master 4-port", fn: "sys", io: null, ch: 4, w: 12, ebus: -120 },
  { id: "EL6601", name: "Ethernet Switchport", fn: "sys", io: null, ch: 1, w: 24, ebus: -260, c24: true, desc: "1 × RJ45; 24 mm EL-24 housing (verified, beckhoff.com / Infosys)" },
  { id: "EL6631", name: "PROFINET Controller", fn: "sys", io: null, ch: 1, w: 24, ebus: -400, c24: true, desc: "2 × RJ45, switched; 24 mm EL-24 housing (verified, beckhoff.com / Infosys)" },
  { id: "EL6652", name: "EtherNet/IP Master", fn: "sys", io: null, ch: 1, w: 24, ebus: -400, c24: true, desc: "2 × RJ45, switched; 24 mm EL-24 housing (verified, beckhoff.com / Infosys)" },
  { id: "EL6751", name: "CANopen Master", fn: "sys", io: null, ch: 1, w: 24, ebus: -230, c24: true, desc: "CANopen, D-sub 9 male; 24 mm EL-24 housing (verified, beckhoff.com / Infosys)" },
  // — communication additions from Beckhoff catalog 2026 (approximate) —
  { id: "EL6002", name: "2-Ch Serial RS232", fn: "sys", io: null, ch: 2, w: 24, ebus: -170, c24: true, desc: "2 × D-sub 9 male; 24 mm EL-24 housing (verified, beckhoff.com / Infosys)" },
  { id: "EL6022", name: "2-Ch Serial RS422/RS485", fn: "sys", io: null, ch: 2, w: 24, ebus: -270, c24: true, desc: "2 × D-sub 9 female; 24 mm EL-24 housing (verified, beckhoff.com / Infosys)" },
  { id: "EL6070", name: "License Key Terminal",  fn: "sys", io: null, ch: 0, w: 12, ebus: -120, desc: "TwinCAT 3 license dongle" },
  { id: "EL6080", name: "Memory Terminal 128 kB", fn: "sys", io: null, ch: 0, w: 12, ebus: -130, desc: "Non-volatile memory terminal" },
  { id: "EL6090", name: "Display Terminal", fn: "sys", io: null, ch: 0, w: 24, ebus: -80, c24: true, desc: "LCD, 2 × 16 characters, navigation switch; 24 mm EL-24 housing (verified, beckhoff.com / Infosys)" },
  { id: "EL6614", name: "4-Port Ethernet Switch", fn: "sys", io: null, ch: 4, w: 24, ebus: -310, c24: true, desc: "4 × RJ45; 24 mm EL-24 housing (verified, beckhoff.com / Infosys)" },
  { id: "EL6688", name: "IEEE 1588 PTP Sync", fn: "sys", io: null, ch: 1, w: 24, ebus: -310, c24: true, desc: "External synchronization, 1 × RJ45; 24 mm EL-24 housing (verified, beckhoff.com / Infosys)" },
  { id: "EL6692", name: "EtherCAT Bridge", fn: "sys", io: null, ch: 1, w: 24, ebus: -120, c24: true, desc: "X1 IN / X2 OUT, 24 V for the secondary side on X3 (typ. 60 mA); 24 mm EL-24 housing (verified, beckhoff.com / Infosys)" },
  { id: "EL6695", name: "EtherCAT Bridge fast", fn: "sys", io: null, ch: 1, w: 24, ebus: -400, c24: true, desc: "X1 IN / X2 OUT, 24 V for the secondary side on X3 (typ. 70 mA); 24 mm EL-24 housing (verified, beckhoff.com / Infosys)" },
  { id: "EL6731", name: "PROFIBUS Master", fn: "sys", io: null, ch: 1, w: 24, ebus: -200, c24: true, desc: "12 Mbit/s, D-sub 9 female; 24 mm EL-24 housing (verified, beckhoff.com / Infosys)" },
  { id: "EL6752", name: "DeviceNet Master", fn: "sys", io: null, ch: 1, w: 24, ebus: -260, c24: true, desc: "DeviceNet, 5-pin open-style plug; 24 mm EL-24 housing (verified, beckhoff.com / Infosys)" },
  // --- Motion / Drives (DIN-rail drive terminals) ---
  { id: "EL7031", name: "Stepper 24V 1.5A",      fn: "mot", io: null, ch: 1, w: 12, ebus: -120 },
  { id: "EL7041", name: "Stepper 50V 5A + enc",  fn: "mot", io: null, ch: 1, w: 24, ebus: -140, blk: "el2x8", pinout: EL7041_PINS, desc: "24 mm, 2 × 8 clamps; pinout from Infosys (verified, beckhoff.com / Infosys)" },
  { id: "EL7047", name: "Stepper 50V 5A vector", fn: "mot", io: null, ch: 1, w: 24, ebus: -140, blk: "el2x8", pinout: EL7041_PINS, desc: "24 mm, 2 × 8 clamps, same points as the EL7041 (Infosys, verified, beckhoff.com / Infosys)" },
  { id: "EL7211", name: "Servo 50V 4.5A resolver", fn: "mot", io: null, ch: 1, w: 24, ebus: -120, blk: "hd2x16", pinout: [...EL7211_PINS, ...NC16], desc: "24 mm, 2 × 16 clamps, right block not connected; resolver feedback (Infosys, verified, beckhoff.com / Infosys)" },
  { id: "EL7211-0010", name: "Servo 50V 4.5A OCT",  fn: "mot", io: null, ch: 1, w: 24, ebus: -120, blk: "hd2x16", pinout: [...EL7211_0010_PINS, ...NC16], desc: "One Cable Technology; 24 mm, 2 × 16 clamps, right block not connected (Infosys, verified, beckhoff.com / Infosys)" },
  { id: "EL7332", name: "2-Ch DC Motor 24V 1A",  fn: "mot", io: null, ch: 2, w: 12, ebus: -140 },
  { id: "EL7342", name: "2-Ch DC Motor 50V 3.5A", fn: "mot", io: null, ch: 2, w: 24, ebus: -140, blk: "el2x8", pinout: EL7342_PINS, desc: "24 mm, 2 × 8 clamps; pinout from Infosys (verified, beckhoff.com / Infosys)" },
  // — motion additions from Beckhoff catalog 2026 (approximate) —
  { id: "EL7037", name: "Stepper 24V 1.5A vector", fn: "mot", io: null, ch: 1, w: 12, ebus: -100 },
  { id: "EL7201", name: "Servo 50V 2.8A resolver", fn: "mot", io: null, ch: 1, w: 12, ebus: -120, hd: true, pinout: EL7201_PINS, desc: "16 clamps, resolver feedback (Infosys, verified, beckhoff.com / Infosys)" },
  { id: "EL7411", name: "BLDC Motor 50V 4.5A",   fn: "mot", io: null, ch: 1, w: 24, ebus: -190, blk: "hd2x16", pinout: EL7411_PINS, desc: "Brushless DC with Hall / encoder feedback; 24 mm, 2 × 16 clamps (Infosys, verified, beckhoff.com / Infosys)" },
  // — ED communication / encoder / drive terminals (beckhoff.com, 2026) —
  { id: "ED6001-0009", name: "Serial RS232 D-sub",       fn: "sys", io: null, ch: 1, w: 24, ebus: -120, c24: true, ed: true, desc: "ED-24 housing, D-sub 9 (beckhoff.com; E-bus not listed, EL6001 value)" },
  { id: "ED6002-0009", name: "2-Ch Serial RS232 D-sub",  fn: "sys", io: null, ch: 2, w: 24, ebus: -170, c24: true, ed: true, desc: "ED-24 housing, 2 × D-sub 9 (beckhoff.com; E-bus not listed, EL6002 value)" },
  { id: "ED6011", name: "Serial RS232/422/485 push-in",   fn: "sys", io: null, ch: 1, w: 12, ebus: -190, ed: true, hd: true, desc: "ED series, push-in, 16 points (beckhoff.com; pinout not yet verified)" },
  { id: "ED6012", name: "2-Ch Serial RS232/422/485 push-in", fn: "sys", io: null, ch: 2, w: 12, ebus: -190, ed: true, hd: true, desc: "ED series, push-in, 16 points (beckhoff.com; pinout not yet verified)" },
  { id: "ED6060", name: "Bluetooth Diagnostics Interface", fn: "sys", io: null, ch: 0, w: 12, ebus: -65, ed: true, desc: "Interface for the Beckhoff Diagnostics app (beckhoff.com)" },
  { id: "ED6224", name: "IO-Link Master 4-port push-in", fn: "sys", io: null, ch: 4, w: 12, ebus: -120, ed: true, hd: true, pinout: ED6224_PINS, desc: "ED series, push-in; pinout from Infosys (verified, beckhoff.com / Infosys)" },
  { id: "ED6781", name: "M-Bus Master push-in",          fn: "sys", io: null, ch: 1, w: 12, ebus: -70, ed: true, desc: "ED series, push-in, 8 points (beckhoff.com; pinout not yet verified)" },
  { id: "ED5002", name: "2-Ch SSI Encoder push-in",      fn: "mot", io: null, ch: 2, w: 12, ebus: -90, ed: true, hd: true, desc: "ED series, push-in, 16 points (beckhoff.com; pinout not yet verified)" },
  { id: "ED5112", name: "Incremental Encoder 2×AB / 1×ABC push-in", fn: "mot", io: null, ch: 2, w: 12, ebus: -100, ed: true, hd: true, pinout: ED5112_PINS, desc: "ED series, push-in; pinout from Infosys (verified, beckhoff.com / Infosys)" },
  { id: "ED7062", name: "2-Ch Stepper 48V 3A + enc push-in", fn: "mot", io: null, ch: 2, w: 24, ebus: -175, ed: true, blk: "ed2x16", pinout: ED7062_PINS, desc: "ED-24, 2 × 16 push-in points; pinout from Infosys (verified, beckhoff.com / Infosys)" },
  { id: "ED7211-0010", name: "Servo 48V 4.5A OCT push-in", fn: "mot", io: null, ch: 1, w: 12, ebus: -175, ed: true, hd: true, desc: "ED series, push-in, One Cable Technology (beckhoff.com; pinout not yet verified)" },
  // --- Power Supplies (PS series, DIN rail) ---
  { id: "PS1011-2401", name: "PSU 24V 1A 1-phase",  fn: "psu", io: null, ch: 0, w: 32, ebus: 0, psu: true, psuV: 24, psuA: 1,  out: "24 V DC \u00b7 1 A",  desc: "1-phase 100-240 V AC in, 24 V DC 1 A out (approximate)" },
  { id: "PS1011-2405", name: "PSU 24V 5A 1-phase",  fn: "psu", io: null, ch: 0, w: 39, ebus: 0, psu: true, psuV: 24, psuA: 5,  out: "24 V DC \u00b7 5 A",  desc: "1-phase 100-240 V AC in, 24 V DC 5 A out" },
  { id: "PS1011-2410", name: "PSU 24V 10A 1-phase", fn: "psu", io: null, ch: 0, w: 49, ebus: 0, psu: true, psuV: 24, psuA: 10, out: "24 V DC \u00b7 10 A", desc: "1-phase 100-240 V AC in, 24 V DC 10 A out" },
  { id: "PS1021-2420", name: "PSU 24V 20A 1-phase", fn: "psu", io: null, ch: 0, w: 69, ebus: 0, psu: true, psuV: 24, psuA: 20, out: "24 V DC \u00b7 20 A", desc: "1-phase 100-240 V AC in, 24 V DC 20 A out" },
  { id: "PS2001-4810", name: "PSU 48V 10A 1-phase", fn: "psu", io: null, ch: 0, w: 49, ebus: 0, psu: true, psuV: 48, psuA: 10, out: "48 V DC \u00b7 10 A", desc: "1-phase in, 48 V DC 10 A out (drive supply)" },
  { id: "PS3011-2410", name: "PSU 24V 10A 3-phase", fn: "psu", io: null, ch: 0, w: 49, ebus: 0, psu: true, psuV: 24, psuA: 10, out: "24 V DC \u00b7 10 A", desc: "3-phase 400-500 V AC in, 24 V DC 10 A out (approximate)" },
  { id: "PS3021-2420", name: "PSU 24V 20A 3-phase", fn: "psu", io: null, ch: 0, w: 69, ebus: 0, psu: true, psuV: 24, psuA: 20, out: "24 V DC \u00b7 20 A", desc: "3-phase in, 24 V DC 20 A out (approximate)" },
  { id: "PS3021-2440", name: "PSU 24V 40A 3-phase", fn: "psu", io: null, ch: 0, w: 89, ebus: 0, psu: true, psuV: 24, psuA: 40, out: "24 V DC \u00b7 40 A", desc: "3-phase in, 24 V DC 40 A out (approximate)" },
  /* ---- FREE-PLACED COMPONENTS (not on the EtherCAT terminal strip) ------
   * free: true → placed anywhere on the canvas with x/y, dragged freely.
   * kind selects the face renderer + connection-point geometry in App.jsx.
   * fw/fh = drawn size in px. Specs approximate/representative.
   * ---------------------------------------------------------------------- */
  // --- Industrial PCs (cabinet / mounting-plate) ---
  { id: "C6015", name: "Ultra-Compact IPC",       fn: "pc", free: true, kind: "ipc", fw: 122, fh: 104, io: null, ch: 0, w: 0, ebus: 0, eth: 2, usb: 2, video: ["DP"], desc: "Intel Atom, 82×82×40 mm, mounting plate" },
  { id: "C6030", name: "Ultra-Compact IPC high-perf", fn: "pc", free: true, kind: "ipc", fw: 136, fh: 116, io: null, ch: 0, w: 0, ebus: 0, eth: 2, usb: 4, video: ["DP", "DP"], desc: "Intel Core i, 132×132×67 mm" },
  { id: "C6650", name: "Control Cabinet IPC",     fn: "pc", free: true, kind: "ipc", fw: 156, fh: 190, io: null, ch: 0, w: 0, ebus: 0, eth: 2, usb: 4, video: ["DP", "DVI"], desc: "ATX motherboard, cabinet mount" },
  { id: "C6920", name: "Control Cabinet PC",      fn: "pc", free: true, kind: "ipc", fw: 142, fh: 172, io: null, ch: 0, w: 0, ebus: 0, eth: 2, usb: 4, video: ["DVI"], desc: "Compact cabinet PC, Intel Core i" },
  { id: "C6017", name: "Ultra-Compact IPC 4×ETH", fn: "pc", free: true, kind: "ipc", fw: 122, fh: 116, io: null, ch: 0, w: 0, ebus: 0, eth: 4, usb: 2, video: ["DP"], desc: "Like C6015 with 4 Ethernet ports" },
  { id: "C6025", name: "Ultra-Compact IPC fanless", fn: "pc", free: true, kind: "ipc", fw: 128, fh: 108, io: null, ch: 0, w: 0, ebus: 0, eth: 2, usb: 4, video: ["DP"], desc: "Intel Core U, fanless (pairs with ZB8610 fan cartridge)" },
  { id: "C6032", name: "Ultra-Compact IPC modular", fn: "pc", free: true, kind: "ipc", fw: 136, fh: 120, io: null, ch: 0, w: 0, ebus: 0, eth: 2, usb: 4, video: ["DP", "DP"], desc: "Modular interface slots, Intel Core i" },
  { id: "C6040", name: "Ultra-Compact IPC high-end", fn: "pc", free: true, kind: "ipc", fw: 140, fh: 124, io: null, ch: 0, w: 0, ebus: 0, eth: 2, usb: 4, video: ["DP", "DP"], desc: "Intel Core i9, high clock rates" },
  { id: "C6670", name: "Industrial Server",       fn: "pc", free: true, kind: "ipc", fw: 170, fh: 200, io: null, ch: 0, w: 0, ebus: 0, eth: 2, usb: 4, video: ["DP", "DVI"], desc: "Many-core control server for TwinCAT" },
  { id: "C7015", name: "IP65/67 IPC (M12)",       fn: "pc", free: true, kind: "ipc", fw: 122, fh: 116, io: null, ch: 0, w: 0, ebus: 0, ethM12: 2, usb: 1, video: [], desc: "Machine-mount IPC, M12 network/power connectors, EtherCAT P capable" },
  { id: "C6027", name: "Ultra-Compact IPC Core i", fn: "pc", free: true, kind: "ipc", fw: 128, fh: 112, io: null, ch: 0, w: 0, ebus: 0, eth: 2, usb: 4, video: ["DP", "DP"], desc: "Ultra-compact board-level IPC, Intel Core i (width approximate)" },
  { id: "C6905", name: "Control Cabinet IPC compact", fn: "pc", free: true, kind: "ipc", fw: 150, fh: 180, io: null, ch: 0, w: 0, ebus: 0, eth: 2, usb: 4, video: ["DP"], desc: "Compact cabinet IPC, Intel Core i (width approximate)" },
  // --- Embedded PCs CX (board 07): beckhoff.com product pages and Infosys,
  // faces from the product pictures; cxk picks the face (c7 / c8 / pc / c20 / psu / mod)
  { id: "CX7000", name: "Embedded PC M7 + 8DI/4DO", fn: "epc", io: "mix", ch: 12, w: 49, ebus: +1500, cx: true, cxk: "c7", leds: ["TC", "WD", "ERR"], usb: 1, pinout: CX7_PINS, desc: "Arm Cortex-M7 480 MHz, TwinCAT 3 (RTOS); 8 DI + 4 DO multi-function I/O (24 V, 0.5 A) on the 16-point block; 49 mm (beckhoff.com, Infosys)" },
  { id: "CX7031", name: "Embedded PC M7 PROFIBUS slave", fn: "epc", io: "mix", ch: 12, w: 49, ebus: +1500, cx: true, cxk: "c7", bus: "dsubF", busTxt: "PROFIBUS", leds: ["TC", "BF", "DIA"], usb: 1, pinout: CX7_PINS, desc: "Arm Cortex-M7, PROFIBUS slave (D-sub socket); 8 DI + 4 DO multi-function I/O (24 V, 0.5 A) on the 16-point block; 49 mm (beckhoff.com, Infosys)" },
  { id: "CX7050", name: "Embedded PC M7 CANopen master", fn: "epc", io: "mix", ch: 12, w: 49, ebus: +1500, cx: true, cxk: "c7", bus: "dsubM", busTxt: "CANopen", leds: ["TC", "BF", "DIA"], usb: 1, pinout: CX7_PINS, desc: "Arm Cortex-M7, CANopen commander (D-sub plug); 8 DI + 4 DO multi-function I/O (24 V, 0.5 A) on the 16-point block; 49 mm (beckhoff.com, Infosys)" },
  { id: "CX7051", name: "Embedded PC M7 CANopen slave", fn: "epc", io: "mix", ch: 12, w: 49, ebus: +1500, cx: true, cxk: "c7", bus: "dsubM", busTxt: "CANopen", leds: ["TC", "BF", "DIA"], usb: 1, pinout: CX7_PINS, desc: "Arm Cortex-M7, CANopen responder (D-sub plug); 8 DI + 4 DO multi-function I/O (24 V, 0.5 A) on the 16-point block; 49 mm (beckhoff.com, Infosys)" },
  { id: "CX7080", name: "Embedded PC M7 RS232/RS485", fn: "epc", io: "mix", ch: 12, w: 49, ebus: +1500, cx: true, cxk: "c7", bus: "dsubF", busTxt: "RS232/RS485", leds: ["TC", "WD", "ERR"], usb: 1, pinout: CX7_PINS, desc: "Arm Cortex-M7, RS232 + RS485 (D-sub socket); 8 DI + 4 DO multi-function I/O (24 V, 0.5 A) on the 16-point block; 49 mm (beckhoff.com, Infosys)" },
  { id: "CX7291", name: "Embedded PC A9 BACnet/IP", fn: "epc", io: "mix", ch: 12, w: 71, ebus: +2000, cx: true, cxk: "c7", bus: "sw", busTxt: "BACnet/IP", leds: ["TC", "WD", "ERR"], pinout: CX7_PINS, desc: "Arm Cortex-A9 720 MHz, 2 x RJ45 switched with BACnet/IP; 8 DI + 4 DO multi-function I/O (24 V, 0.5 A) on the 16-point block; 71 mm (beckhoff.com, Infosys)" },
  { id: "CX7293", name: "Embedded PC A9 PROFINET device", fn: "epc", io: "mix", ch: 12, w: 71, ebus: +2000, cx: true, cxk: "c7", bus: "sw", busTxt: "PROFINET", leds: ["TC", "PN", "DG"], pinout: CX7_PINS, desc: "Arm Cortex-A9 720 MHz, 2 x RJ45 switched, PROFINET RT device; 8 DI + 4 DO multi-function I/O (24 V, 0.5 A) on the 16-point block; 71 mm (beckhoff.com, Infosys)" },
  { id: "CX8010", name: "Embedded PC ARM9 EtherCAT slave", fn: "epc", io: null, ch: 0, w: 64, ebus: +2000, cx: true, cxk: "c8", bus: "ecat", busTxt: "EtherCAT", leds: ["TC", "EC Run", "EC Err"], desc: "Arm9 400 MHz, TwinCAT 2 PLC, Windows Embedded CE 6, EtherCAT slave IN/OUT; 64 mm (beckhoff.com)" },
  { id: "CX8030", name: "Embedded PC ARM9 PROFIBUS master", fn: "epc", io: null, ch: 0, w: 64, ebus: +2000, cx: true, cxk: "c8", bus: "dsubF", busTxt: "PROFIBUS", leds: ["TC", "BF", "DIA"], desc: "Arm9, TwinCAT 2 PLC, Windows Embedded CE 6, PROFIBUS master; 64 mm (beckhoff.com)" },
  { id: "CX8031", name: "Embedded PC ARM9 PROFIBUS slave", fn: "epc", io: null, ch: 0, w: 64, ebus: +2000, cx: true, cxk: "c8", bus: "dsubF", busTxt: "PROFIBUS", leds: ["TC", "BF", "DIA"], desc: "Arm9, TwinCAT 2 PLC, Windows Embedded CE 6, PROFIBUS slave; 64 mm (beckhoff.com)" },
  { id: "CX8050", name: "Embedded PC ARM9 CANopen master", fn: "epc", io: null, ch: 0, w: 64, ebus: +2000, cx: true, cxk: "c8", bus: "dsubM", busTxt: "CANopen", leds: ["TC", "BF", "DIA"], desc: "Arm9, TwinCAT 2 PLC, Windows Embedded CE 6, CANopen master; 64 mm (beckhoff.com)" },
  { id: "CX8051", name: "Embedded PC ARM9 CANopen slave", fn: "epc", io: null, ch: 0, w: 64, ebus: +2000, cx: true, cxk: "c8", bus: "dsubM", busTxt: "CANopen", leds: ["TC", "BF", "DIA"], desc: "Arm9, TwinCAT 2 PLC, Windows Embedded CE 6, CANopen slave; 64 mm (beckhoff.com)" },
  { id: "CX8080", name: "Embedded PC ARM9 RS232/RS485", fn: "epc", io: null, ch: 0, w: 64, ebus: +2000, cx: true, cxk: "c8", bus: "dsubF", busTxt: "RS232/RS485", leds: ["TC", "WD", "ERR"], desc: "Arm9, TwinCAT 2 PLC, Windows Embedded CE 6, RS232 + RS485; 64 mm (beckhoff.com)" },
  { id: "CX8090", name: "Embedded PC ARM9 Ethernet switch", fn: "epc", io: null, ch: 0, w: 64, ebus: +2000, cx: true, cxk: "c8", bus: "sw", busTxt: "Ethernet", leds: ["TC", "WD", "ERR"], desc: "Arm9, TwinCAT 2 PLC, Windows Embedded CE 6, 2-port switch; 64 mm (beckhoff.com)" },
  { id: "CX8091", name: "Embedded PC ARM9 BACnet/OPC UA", fn: "epc", io: null, ch: 0, w: 64, ebus: +2000, cx: true, cxk: "c8", bus: "sw", busTxt: "BACnet/IP", leds: ["TC", "WD", "ERR"], desc: "Arm9, TwinCAT 2 PLC, Windows Embedded CE 6, BACnet/IP or OPC UA; 64 mm (beckhoff.com)" },
  { id: "CX8093", name: "Embedded PC ARM9 PROFINET device", fn: "epc", io: null, ch: 0, w: 64, ebus: +2000, cx: true, cxk: "c8", bus: "sw", busTxt: "PROFINET", leds: ["TC", "PN", "DG"], desc: "Arm9, TwinCAT 2 PLC, Windows Embedded CE 6, PROFINET device; 64 mm (beckhoff.com)" },
  { id: "CX8095", name: "Embedded PC ARM9 EtherNet/IP", fn: "epc", io: null, ch: 0, w: 64, ebus: +2000, cx: true, cxk: "c8", bus: "sw", busTxt: "EtherNet/IP", leds: ["TC", "MS", "NS"], desc: "Arm9, TwinCAT 2 PLC, Windows Embedded CE 6, EtherNet/IP adapter; 64 mm (beckhoff.com)" },
  { id: "CX8110", name: "Embedded PC A9 EtherCAT slave", fn: "epc", io: null, ch: 0, w: 71, ebus: +2000, cx: true, cxk: "c8", bus: "ecat", busTxt: "EtherCAT", leds: ["TC", "EC Run", "EC Err"], desc: "Arm Cortex-A9 800 MHz, TwinCAT 3, EtherCAT slave IN/OUT; 71 mm (beckhoff.com)" },
  { id: "CX8180", name: "Embedded PC A9 RS232/RS485", fn: "epc", io: null, ch: 0, w: 71, ebus: +2000, cx: true, cxk: "c8", bus: "dsubF", busTxt: "RS232/RS485", leds: ["TC", "WD", "ERR"], desc: "Arm Cortex-A9 800 MHz, TwinCAT 3, RS232 + RS485; 71 mm (beckhoff.com)" },
  { id: "CX8190", name: "Embedded PC A9 Ethernet switch", fn: "epc", io: null, ch: 0, w: 71, ebus: +2000, cx: true, cxk: "c8", bus: "sw", busTxt: "Ethernet", leds: ["TC", "WD", "ERR"], desc: "Arm Cortex-A9 800 MHz, TwinCAT 3, 2-port switch; 71 mm (beckhoff.com)" },
  { id: "CX8191", name: "Embedded PC A9 BACnet/IP", fn: "epc", io: null, ch: 0, w: 71, ebus: +2000, cx: true, cxk: "c8", bus: "sw", busTxt: "BACnet/IP", leds: ["TC", "WD", "ERR"], desc: "Arm Cortex-A9 800 MHz, TwinCAT 3, BACnet/IP; 71 mm (beckhoff.com)" },
  { id: "CX8200", name: "Embedded PC A53", fn: "epc", io: null, ch: 0, w: 71, ebus: +2000, cx: true, cxk: "c8", leds: ["TC", "WD", "ERR"], usb: 1, desc: "Arm Cortex-A53 1.2 GHz, TwinCAT 3, Beckhoff RT Linux, 1 x USB 3.0; 71 mm (beckhoff.com)" },
  { id: "CX8210", name: "Embedded PC A53 EtherCAT slave", fn: "epc", io: null, ch: 0, w: 71, ebus: +2000, cx: true, cxk: "c8", bus: "ecat", busTxt: "EtherCAT", leds: ["TC", "EC Run", "EC Err"], usb: 1, desc: "Arm Cortex-A53 1.2 GHz, TwinCAT 3, Beckhoff RT Linux, EtherCAT slave IN/OUT; 71 mm (beckhoff.com)" },
  { id: "CX8280", name: "Embedded PC A53 RS232/RS485", fn: "epc", io: null, ch: 0, w: 71, ebus: +2000, cx: true, cxk: "c8", bus: "dsubF", busTxt: "RS232/RS485", leds: ["TC", "WD", "ERR"], usb: 1, desc: "Arm Cortex-A53 1.2 GHz, TwinCAT 3, Beckhoff RT Linux, RS232 + RS485; 71 mm (beckhoff.com)" },
  { id: "CX8290", name: "Embedded PC A53 Ethernet switch", fn: "epc", io: null, ch: 0, w: 71, ebus: +2000, cx: true, cxk: "c8", bus: "sw", busTxt: "Ethernet", leds: ["TC", "WD", "ERR"], usb: 1, desc: "Arm Cortex-A53 1.2 GHz, TwinCAT 3, Beckhoff RT Linux, 2-port switch (PROFINET / EtherNet/IP / BACnet optional); 71 mm (beckhoff.com)" },
  { id: "CX9020", name: "Embedded PC A8 1 GHz", fn: "epc", io: null, ch: 0, w: 84, ebus: +2000, cx: true, cxk: "pc", disp: "dvi", usb: 4, leds: ["PWR", "TC", "HDD", "FB1", "FB2"], desc: "Arm Cortex-A8 1 GHz, TwinCAT 3; 2 x RJ45, 4 x USB, DVI, optional interface X300; 84 mm (beckhoff.com)" },
  { id: "CX9240", name: "Embedded PC A53 quad", fn: "epc", io: null, ch: 0, w: 84, ebus: +2000, cx: true, cxk: "pc", disp: "dp", usb: 4, leds: ["PWR", "TC", "HDD", "FB1", "FB2"], desc: "Arm Cortex-A53 quad-core 1.2 GHz, TwinCAT 3; 2 x RJ45, 4 x USB, DisplayPort, optional interface X300; 84 mm (beckhoff.com)" },
  { id: "CX5120", name: "Embedded PC Atom E3815", fn: "epc", io: null, ch: 0, w: 122, ebus: +2000, cx: true, cxk: "pc", disp: "dvi", usb: 4, leds: ["PWR", "TC", "HDD", "FB1", "FB2"], desc: "Intel Atom E3815 1.46 GHz; 2 x RJ45, 4 x USB, DVI, optional interface X300; 122 mm (beckhoff.com)" },
  { id: "CX5130", name: "Embedded PC Atom E3827", fn: "epc", io: null, ch: 0, w: 142, ebus: +2000, cx: true, cxk: "pc", disp: "dvi", usb: 4, leds: ["PWR", "TC", "HDD", "FB1", "FB2"], desc: "Intel Atom E3827 dual-core 1.75 GHz; 2 x RJ45, 4 x USB, DVI, optional interface X300; 142 mm (beckhoff.com)" },
  { id: "CX5140", name: "Embedded PC Atom E3845", fn: "epc", io: null, ch: 0, w: 142, ebus: +2000, cx: true, cxk: "pc", disp: "dvi", usb: 4, leds: ["PWR", "TC", "HDD", "FB1", "FB2"], desc: "Intel Atom E3845 quad-core 1.91 GHz; 2 x RJ45, 4 x USB, DVI, optional interface X300; 142 mm (beckhoff.com)" },
  { id: "CX5230", name: "Embedded PC Atom x5-E3930", fn: "epc", io: null, ch: 0, w: 142, ebus: +2000, cx: true, cxk: "pc", disp: "dvi", usb: 4, leds: ["PWR", "TC", "HDD", "FB1", "FB2"], desc: "Intel Atom x5-E3930 dual-core; 2 x RJ45, 4 x USB, DVI, optional interface X300; 142 mm (beckhoff.com)" },
  { id: "CX5240", name: "Embedded PC Atom x5-E3940", fn: "epc", io: null, ch: 0, w: 142, ebus: +2000, cx: true, cxk: "pc", disp: "dvi", usb: 4, leds: ["PWR", "TC", "HDD", "FB1", "FB2"], desc: "Intel Atom x5-E3940 quad-core; 2 x RJ45, 4 x USB, DVI, optional interface X300; 142 mm (beckhoff.com)" },
  { id: "CX5330", name: "Embedded PC Atom x6214RE", fn: "epc", io: null, ch: 0, w: 142, ebus: +2000, cx: true, cxk: "pc", disp: "dp", usb: 4, leds: ["PWR", "TC", "HDD", "FB1", "FB2"], desc: "Intel Atom x6214RE dual-core, 2.5 Gbit Ethernet; 2 x RJ45, 4 x USB, DisplayPort, optional interface X300; 142 mm (beckhoff.com)" },
  { id: "CX5340", name: "Embedded PC Atom x6425RE", fn: "epc", io: null, ch: 0, w: 142, ebus: +2000, cx: true, cxk: "pc", disp: "dp", usb: 4, leds: ["PWR", "TC", "HDD", "FB1", "FB2"], desc: "Intel Atom x6425RE quad-core, 2.5 Gbit Ethernet; 2 x RJ45, 4 x USB, DisplayPort, optional interface X300; 142 mm (beckhoff.com)" },
  { id: "CX5620", name: "Embedded PC Ryzen R1102G", fn: "epc", io: null, ch: 0, w: 124, ebus: +2000, cx: true, cxk: "pc", disp: "dvi", usb: 4, leds: ["PWR", "TC", "HDD", "FB1", "FB2", "U1", "U2"], desc: "AMD Ryzen R1102G dual-core; 2 x RJ45, 4 x USB, DVI, optional interface X300; 124 mm (beckhoff.com)" },
  { id: "CX5630", name: "Embedded PC Ryzen R1505G", fn: "epc", io: null, ch: 0, w: 142, ebus: +2000, cx: true, cxk: "pc", disp: "dvi", usb: 4, leds: ["PWR", "TC", "HDD", "FB1", "FB2", "U1", "U2"], desc: "AMD Ryzen R1505G dual-core; 2 x RJ45, 4 x USB, DVI, optional interface X300; 142 mm (beckhoff.com)" },
  { id: "CX2033", name: "Embedded PC Ryzen V1202B", fn: "epc", io: null, ch: 0, w: 144, ebus: 0, cx: true, cxk: "c20", disp: "dvi", usb: 4, leds: ["PWR", "TC", "HDD", "FB1", "FB2"], desc: "AMD Ryzen V1202B dual-core; 2 x RJ45, 4 x USB, DVI, optional interface X300; 144 mm, needs a CX2100 power supply module to its right (beckhoff.com)" },
  { id: "CX2043", name: "Embedded PC Ryzen V1807B", fn: "epc", io: null, ch: 0, w: 144, ebus: 0, cx: true, cxk: "c20", disp: "dvi", usb: 4, leds: ["PWR", "TC", "HDD", "FB1", "FB2"], desc: "AMD Ryzen V1807B quad-core; 2 x RJ45, 4 x USB, DVI, optional interface X300; 144 mm, needs a CX2100 power supply module to its right (beckhoff.com)" },
  { id: "CX2042", name: "Embedded PC Xeon D-1527", fn: "epc", io: null, ch: 0, w: 204, ebus: 0, cx: true, cxk: "c20", disp: "dvi", usb: 4, leds: ["PWR", "TC", "HDD", "FB1", "FB2"], desc: "Intel Xeon D-1527 quad-core; 2 x RJ45, 4 x USB, DVI, optional interface X300; 204 mm, needs a CX2100 power supply module to its right (beckhoff.com)" },
  { id: "CX2062", name: "Embedded PC Xeon D-1548", fn: "epc", io: null, ch: 0, w: 204, ebus: 0, cx: true, cxk: "c20", disp: "dvi", usb: 4, leds: ["PWR", "TC", "HDD", "FB1", "FB2"], desc: "Intel Xeon D-1548 8-core; 2 x RJ45, 4 x USB, DVI, optional interface X300; 204 mm, needs a CX2100 power supply module to its right (beckhoff.com)" },
  { id: "CX2072", name: "Embedded PC Xeon D-1567", fn: "epc", io: null, ch: 0, w: 204, ebus: 0, cx: true, cxk: "c20", disp: "dvi", usb: 4, leds: ["PWR", "TC", "HDD", "FB1", "FB2"], desc: "Intel Xeon D-1567 12-core; 2 x RJ45, 4 x USB, DVI, optional interface X300; 204 mm, needs a CX2100 power supply module to its right (beckhoff.com)" },
  { id: "CX2100-0004", name: "CX20xx Power Supply 45 W", fn: "psu", io: null, ch: 0, w: 40, ebus: +2000, cxk: "psu", desc: "Power supply unit for CX20xx, 45 W; 24 V Us / Up and the E-bus (2 A); 40 mm (beckhoff.com)" },
  { id: "CX2100-0014", name: "CX20xx Power Supply 130 W", fn: "psu", io: null, ch: 0, w: 60, ebus: +2000, cxk: "psu", desc: "Power supply unit for CX20xx, 130 W, display + navigation switch; 24 V Us / Up and the E-bus (2 A); 60 mm (beckhoff.com)" },
  { id: "CX2100-0022", name: "CX20xx Power Supply 100 W isolated", fn: "psu", io: null, ch: 0, w: 60, ebus: +2000, cxk: "psu", desc: "Power supply unit for CX20xx, 100 W, electrically isolated, UPS OCT-capable; 24 V Us / Up and the E-bus (2 A); 60 mm (beckhoff.com)" },
  { id: "CX2100-0024", name: "CX20xx Power Supply 200 W isolated", fn: "psu", io: null, ch: 0, w: 60, ebus: +2000, cxk: "psu", desc: "Power supply unit for CX20xx, 200 W, electrically isolated, UPS OCT-capable; 24 V Us / Up and the E-bus (2 A); 60 mm (beckhoff.com)" },
  { id: "CX2100-0904", name: "CX20xx Power Supply 45 W + UPS", fn: "psu", io: null, ch: 0, w: 118, ebus: +2000, cxk: "psu", desc: "Power supply unit for CX20xx, 45 W, internal capacitive UPS; 24 V Us / Up and the E-bus (2 A); 118 mm (beckhoff.com)" },
  { id: "CX2100-0914", name: "CX20xx Power Supply 100 W + UPS", fn: "psu", io: null, ch: 0, w: 84, ebus: +2000, cxk: "psu", desc: "Power supply unit for CX20xx, 100 W, for the external CX2900-0192 battery pack; 24 V Us / Up and the E-bus (2 A); 84 mm (beckhoff.com)" },
  { id: "CX2500-0030", name: "CX Module RS232", fn: "epc", io: null, ch: 0, w: 24, ebus: 0, cxk: "mod", mports: [["dsubM", "X300"]], desc: "RS232; 24 mm, mounts left of the CPU on the system bus, no E-bus (beckhoff.com)" },
  { id: "CX2500-0031", name: "CX Module RS422/RS485", fn: "epc", io: null, ch: 0, w: 24, ebus: 0, cxk: "mod", mports: [["dsubF", "X300"]], desc: "RS422 / RS485; 24 mm, mounts left of the CPU on the system bus, no E-bus (beckhoff.com)" },
  { id: "CX2500-0060", name: "CX Module 2x Ethernet", fn: "epc", io: null, ch: 0, w: 24, ebus: 0, cxk: "mod", mports: [["rj45", "X000"], ["rj45", "X001"]], desc: "2 x Ethernet 10/100/1000; 24 mm, mounts left of the CPU on the system bus, no E-bus (beckhoff.com)" },
  { id: "CX2500-0061", name: "CX Module PoE", fn: "epc", io: null, ch: 0, w: 24, ebus: 0, cxk: "mod", mports: [["rj45", "X000"]], desc: "1 x Ethernet, Power over Ethernet; 24 mm, mounts left of the CPU on the system bus, no E-bus (beckhoff.com)" },
  { id: "CX2500-0062", name: "CX Module 2x 2.5G Ethernet", fn: "epc", io: null, ch: 0, w: 24, ebus: 0, cxk: "mod", mports: [["rj45", "X000"], ["rj45", "X001"]], desc: "2 x Ethernet 2.5 Gbit; 24 mm, mounts left of the CPU on the system bus, no E-bus (beckhoff.com)" },
  { id: "CX2500-0070", name: "CX Module 4x USB 3.0", fn: "epc", io: null, ch: 0, w: 24, ebus: 0, cxk: "mod", mports: [["usb", "X100"], ["usb", "X101"], ["usb", "X102"], ["usb", "X103"]], desc: "4 x USB 3.0; 24 mm, mounts left of the CPU on the system bus, no E-bus (beckhoff.com)" },
  { id: "CX2500-1060", name: "CX Module 2x Ethernet", fn: "epc", io: null, ch: 0, w: 24, ebus: 0, cxk: "mod", mports: [["rj45", "X000"], ["rj45", "X001"]], desc: "2 x Ethernet 10/100/1000; 24 mm, mounts left of the CPU on the system bus, no E-bus (beckhoff.com)" },
  { id: "CX2500-1061", name: "CX Module PoE", fn: "epc", io: null, ch: 0, w: 24, ebus: 0, cxk: "mod", mports: [["rj45", "X000"]], desc: "1 x Ethernet, Power over Ethernet; 24 mm, mounts left of the CPU on the system bus, no E-bus (beckhoff.com)" },
  { id: "CX2500-B310", name: "CX Module PROFIBUS slave", fn: "epc", io: null, ch: 0, w: 24, ebus: 0, cxk: "mod", mports: [["dsubF", "X310"]], desc: "PROFIBUS slave, D-sub socket; 24 mm, mounts left of the CPU on the system bus, no E-bus (beckhoff.com)" },
  { id: "CX2500-B510", name: "CX Module CANopen slave", fn: "epc", io: null, ch: 0, w: 24, ebus: 0, cxk: "mod", mports: [["dsubF", "X510"]], desc: "CANopen slave, D-sub; 24 mm, mounts left of the CPU on the system bus, no E-bus (beckhoff.com)" },
  { id: "CX2500-M310", name: "CX Module PROFIBUS master", fn: "epc", io: null, ch: 0, w: 24, ebus: 0, cxk: "mod", mports: [["dsubF", "X310"]], desc: "PROFIBUS master, D-sub socket; 24 mm, mounts left of the CPU on the system bus, no E-bus (beckhoff.com)" },
  { id: "CX2500-M510", name: "CX Module CANopen master", fn: "epc", io: null, ch: 0, w: 24, ebus: 0, cxk: "mod", mports: [["dsubF", "X510"]], desc: "CANopen master, D-sub; 24 mm, mounts left of the CPU on the system bus, no E-bus (beckhoff.com)" },
  { id: "CX2500-0021", name: "CX Module Audio", fn: "epc", io: null, ch: 0, w: 24, ebus: 0, cxk: "mod", mports: [], desc: "audio Line in/out, Mic, SPDIF (CX20x3); 24 mm, mounts left of the CPU on the system bus, no E-bus (beckhoff.com)" },
  { id: "CX2550-0010", name: "CX Module CFast slot", fn: "epc", io: null, ch: 0, w: 24, ebus: 0, cxk: "mod", mports: [], desc: "extension module, CFast slot; 24 mm, mounts left of the CPU on the system bus, no E-bus (beckhoff.com)" },
  { id: "CX2550-0020", name: "CX Module 2.5-inch HDD/SSD", fn: "epc", io: null, ch: 0, w: 24, ebus: 0, cxk: "mod", mports: [], desc: "extension module for a 2.5-inch HDD / SSD; 24 mm, mounts left of the CPU on the system bus, no E-bus (beckhoff.com)" },
  { id: "CX2550-0179", name: "CX USB Extender Tx 1.1", fn: "epc", io: null, ch: 0, w: 24, ebus: 0, cxk: "mod", mports: [], desc: "USB extender 1.1 Tx for CP69xx / CP79xx panels; 24 mm, mounts left of the CPU on the system bus, no E-bus (beckhoff.com)" },
  { id: "CX2550-0279", name: "CX USB Extender Tx 2.0", fn: "epc", io: null, ch: 0, w: 24, ebus: 0, cxk: "mod", mports: [], desc: "USB extender 2.0 Tx for CP29xx / CP39xx / CP69xx-0010 panels; 24 mm, mounts left of the CPU on the system bus, no E-bus (beckhoff.com)" },
  // --- IPC accessories: UPS modules, battery pack, cabinet dome (Beckhoff) ---
  { id: "CU8110-0120", name: "UPS Module (capacitive)", fn: "psu", free: true, kind: "supplybox", fw: 58, fh: 150, io: null, ch: 0, w: 0, ebus: 0, psuV: 24, psuA: 4.5,
    variants: [{ s: "0060", d: "0.45 Wh, 55 W" }, { s: "0120", d: "0.9 Wh, 110 W" }],
    desc: "Capacitive UPS (EDLC), 24 V DC in/out — maintenance-free hold-up for IPC/Embedded PC (representative; drawn as a supply module)" },
  { id: "CU8130-0120", name: "UPS Module (battery)", fn: "psu", free: true, kind: "supplybox", fw: 58, fh: 150, io: null, ch: 0, w: 0, ebus: 0, psuV: 24, psuA: 4.5,
    variants: [{ s: "0120", d: "15 Wh, 110 W" }, { s: "0240", d: "30 Wh, 220 W" }],
    desc: "Battery-backed UPS, 24 V DC in/out — longer hold-up for controlled shutdown (representative)" },
  { id: "CX2900-0192", name: "Battery Pack (UPS)", fn: "pwr", free: true, kind: "box", fw: 60, fh: 120, io: null, ch: 0, w: 0, ebus: 0, ioconn: 2, desc: "External battery pack in metal housing for the CX2100-0914 power supply's integrated UPS — TS35 DIN-rail mount, + / − to the PSU" },
  { id: "C9900-U330", name: "External UPS 24 V", fn: "psu", free: true, kind: "supplybox", fw: 60, fh: 150, io: null, ch: 0, w: 0, ebus: 0, psuV: 24, psuA: 5, desc: "External 24 V DC UPS with battery — representative of the C9900-U3xx external UPS family" },
  { id: "CU8210-M001", name: "Cabinet Dome (WLAN/mobile)", fn: "net", free: true, kind: "box", fw: 70, fh: 70, io: null, ch: 0, w: 0, ebus: 0, ioconn: 1, desc: "Cabinet-mount antenna dome for industrial WLAN / mobile-network USB sticks (CU8210-D001 WLAN, CU8210-M001-0110 LTE) — antenna/USB lead to the IPC" },
  // --- Control Panels / Panel PCs ---
  { id: "CP2907", name: "Control Panel 7\" DP",   fn: "pnl", free: true, kind: "panel", fw: 150, fh: 112, io: null, ch: 0, w: 0, ebus: 0, usb: 1, video: ["DP"], desc: "Multi-touch, CP-Link 4 / DisplayPort" },
  { id: "CP2912", name: "Control Panel 12\"",     fn: "pnl", free: true, kind: "panel", fw: 190, fh: 140, io: null, ch: 0, w: 0, ebus: 0, usb: 1, video: ["DP"], desc: "Multi-touch, CP-Link 4 / DisplayPort" },
  { id: "CP2915", name: "Control Panel 15\"",     fn: "pnl", free: true, kind: "panel", fw: 220, fh: 160, io: null, ch: 0, w: 0, ebus: 0, usb: 1, video: ["DP"], desc: "Multi-touch, CP-Link 4 / DisplayPort" },
  { id: "CP6606", name: "Panel PC 7\" ARM",       fn: "pnl", free: true, kind: "panel", fw: 150, fh: 112, io: null, ch: 0, w: 0, ebus: 0, eth: 2, usb: 1, video: [], desc: "Built-in ARM PC, Ethernet + USB" },
  { id: "CP2216", name: "Panel PC 15.6\"",        fn: "pnl", free: true, kind: "panel", fw: 230, fh: 160, io: null, ch: 0, w: 0, ebus: 0, eth: 2, usb: 2, video: ["DP"], desc: "Built-in Intel PC, multi-touch" },
  // --- Servo Drives (AX series, cabinet mount) ---
  { id: "AX5103", name: "Servo Drive 1-Ch 3A",    fn: "drv", free: true, kind: "drive", fw: 92, fh: 210, motion: true, io: null, ch: 1, w: 0, ebus: 0, desc: "AX5000, 1-channel, 3 A, EtherCAT in/out, 100-480 V AC" },
  { id: "AX5203", name: "Servo Drive 2-Ch 3A",    fn: "drv", free: true, kind: "drive", fw: 92, fh: 210, motion: true, io: null, ch: 2, w: 0, ebus: 0, desc: "AX5000, 2-channel, 2×3 A, EtherCAT in/out" },
  { id: "AX8100", name: "AX8000 Supply Module",   fn: "drv", free: true, kind: "drive", fw: 80, fh: 210, motion: true, io: null, ch: 0, w: 0, ebus: 0, desc: "Multi-axis supply module, feeds DC link to axis modules" },
  { id: "AX8108", name: "AX8000 Axis Module 8A",  fn: "drv", free: true, kind: "drive", fw: 70, fh: 210, motion: true, io: null, ch: 1, w: 0, ebus: 0, desc: "1-axis module, 8 A, OCT" },
  { id: "AX8206", name: "AX8000 2-Axis Module 6A", fn: "drv", free: true, kind: "drive", fw: 70, fh: 210, motion: true, io: null, ch: 2, w: 0, ebus: 0, desc: "2-axis module, 2×6 A, OCT" },
  { id: "AM8031", name: "Servomotor 1.1 Nm OCT",  fn: "drv", free: true, kind: "motor", fw: 116, fh: 96, motion: true, io: null, ch: 0, w: 0, ebus: 0, desc: "AM8000 synchronous servomotor — One Cable Technology (power + feedback in one OCT cable) or classic U/V/W wiring" },
  // --- Network infrastructure (beckhoff.com → I/O → infrastructure components) ---
  { id: "CU2008", name: "8-Port Ethernet Switch", fn: "net", free: true, kind: "switch8", fw: 160, fh: 90, io: null, ch: 0, w: 0, ebus: 0, desc: "Unmanaged Gigabit switch, DIN-rail cabinet mount" },
  { id: "CU2005", name: "5-Port Ethernet Switch", fn: "net", free: true, kind: "switch8", nports: 5, fw: 130, fh: 90, io: null, ch: 0, w: 0, ebus: 0, desc: "Unmanaged Gigabit switch, DIN-rail cabinet mount" },
  { id: "CU1128", name: "8-Port EtherCAT Junction", fn: "net", free: true, kind: "switch8", fw: 160, fh: 90, io: null, ch: 0, w: 0, ebus: 0, desc: "EtherCAT star hub — 8 junction ports in one device" },
  { id: "CU2508", name: "Real-time Port Multiplier", fn: "net", free: true, kind: "switch8", fw: 160, fh: 90, io: null, ch: 0, w: 0, ebus: 0, desc: "8× Gbit real-time ports from one PC uplink" },
  { id: "CU1521", name: "EtherCAT Media Converter", fn: "net", free: true, kind: "conv", fw: 110, fh: 84, io: null, ch: 0, w: 0, ebus: 0, desc: "Copper RJ45 ↔ multi-mode fiber optic converter" },
  // --- Beckhoff EtherCAT Box (IP67, field-mount) ---
  { id: "EP1008-0001", name: "EtherCAT Box 8-Ch DI", fn: "fld", free: true, kind: "epbox", fw: 84, fh: 150, io: "di", ch: 8, w: 0, ebus: 0, ioconn: 8, ioLabel: "DI", desc: "IP67, 8 digital inputs, M8",
    variants: [{ s: "0001", d: "8 DI, M8" }, { s: "0002", d: "8 DI, M8, 10 µs filter" }, { s: "0022", d: "8 DI, M8, ground-switching" }] },
  { id: "EP1018-0001", name: "EtherCAT Box 16-Ch DI", fn: "fld", free: true, kind: "epbox", fw: 84, fh: 158, io: "di", ch: 16, w: 0, ebus: 0, ioconn: 8, ioLabel: "DI", desc: "IP67, 16 digital inputs, M8" },
  { id: "EP2008-0002", name: "EtherCAT Box 8-Ch DO", fn: "fld", free: true, kind: "epbox", fw: 84, fh: 150, io: "do", ch: 8, w: 0, ebus: 0, ioconn: 8, ioLabel: "DO", desc: "IP67, 8 digital outputs 0.5 A, M8",
    variants: [{ s: "0001", d: "8 DO 0.5 A, M8" }, { s: "0002", d: "8 DO 0.5 A, M8, diagnostics" }] },
  { id: "EP2338-0001", name: "EtherCAT Box 8-Ch DI/DO", fn: "fld", free: true, kind: "epbox", fw: 84, fh: 150, io: "do", ch: 8, w: 0, ebus: 0, ioconn: 8, ioLabel: "IO", desc: "IP67, 8 configurable digital in/out, M8",
    variants: [{ s: "0000", d: "8 DI/DO, M8" }, { s: "0001", d: "8 DI/DO, M8, diagnostics" }, { s: "1000", d: "8 DI/DO, M12" }] },
  { id: "EP2809-0021", name: "EtherCAT Box 16-Ch DO", fn: "fld", free: true, kind: "epbox", fw: 84, fh: 158, io: "do", ch: 16, w: 0, ebus: 0, ioconn: 8, ioLabel: "DO", desc: "IP67, 16 digital outputs 0.5 A, M8" },
  { id: "EP3174-0002", name: "EtherCAT Box 4-Ch AI", fn: "fld", free: true, kind: "epbox", fw: 92, fh: 150, io: "ai", ch: 4, w: 0, ebus: 0, ioconn: 4, ioLabel: "AI", m12io: true, desc: "IP67, 4 analog inputs ±10 V/0-20 mA, M12",
    variants: [{ s: "0002", d: "4 AI, ±10 V / 0-20 mA" }, { s: "0092", d: "4 AI, TwinSAFE SC" }] },
  { id: "EP3182-1002", name: "EtherCAT Box 4-Ch AI + 2DI/DO", fn: "fld", free: true, kind: "epbox", fw: 92, fh: 158, io: "ai", ch: 4, w: 0, ebus: 0, ioconn: 6, ioLabel: "AI", m12io: true, desc: "IP67, 4 analog inputs + 2 digital I/O, M12" },
  { id: "EP4174-0002", name: "EtherCAT Box 4-Ch AO", fn: "fld", free: true, kind: "epbox", fw: 92, fh: 150, io: "ao", ch: 4, w: 0, ebus: 0, ioconn: 4, ioLabel: "AO", m12io: true, desc: "IP67, 4 analog outputs ±10 V/0-20 mA, M12",
    variants: [{ s: "0002", d: "4 AO, ±10 V / 0-20 mA" }, { s: "0042", d: "4 AO, current only" }] },
  { id: "EP5151-0002", name: "EtherCAT Box 1-Ch Encoder", fn: "fld", free: true, kind: "epbox", fw: 84, fh: 150, io: null, ch: 1, w: 0, ebus: 0, ioconn: 2, ioLabel: "ENC", m12io: true, desc: "IP67, incremental encoder interface, M12" },
  { id: "EP7041-0002", name: "EtherCAT Box Stepper", fn: "fld", free: true, kind: "epbox", fw: 92, fh: 158, io: null, ch: 1, w: 0, ebus: 0, ioconn: 4, ioLabel: "STEP", m12io: true, motion: true, desc: "IP67, stepper motor output 50 V 5 A + I/O, M12" },
  { id: "EP7211-0034", name: "EtherCAT Box Servo OCT", fn: "fld", free: true, kind: "epbox", fw: 92, fh: 158, io: null, ch: 1, w: 0, ebus: 0, ioconn: 4, ioLabel: "SERVO", m12io: true, motion: true, desc: "IP67, servomotor output 48 V, OCT, M12" },
  { id: "EP6224-2022", name: "EtherCAT Box IO-Link Master", fn: "fld", free: true, kind: "epbox", fw: 92, fh: 150, io: null, ch: 4, w: 0, ebus: 0, ioconn: 4, ioLabel: "IO-L", m12io: true, iolMaster: true, desc: "IP67, 4-port IO-Link master, M12 — C/Q per port",
    variants: [
      { s: "0002", d: "IO-Link master, standard" },
      { s: "0022", d: "IO-Link master + digital inputs" },
      { s: "0042", d: "IO-Link master, Class B ports" },
      { s: "0092", d: "IO-Link master, extended diagnostics" },
      { s: "2022", d: "IO-Link master, 4-port M12 (default)" },
    ] },
  { id: "EP7402-0057", name: "EtherCAT Box Motor+I/O", fn: "fld", free: true, kind: "epbox", fw: 92, fh: 158, io: null, ch: 2, w: 0, ebus: 0, ioconn: 4, ioLabel: "M/IO", m12io: true, motion: true, desc: "IP67, 2 BLDC/roller-drive outputs + digital I/O, M12",
    variants: [{ s: "0057", d: "2× roller-drive + 4 DI" }, { s: "1057", d: "2× BLDC + 4 DI" }] },
  { id: "EPP2334-0061", name: "EtherCAT P Box 4DI/4DO", fn: "fld", free: true, kind: "epbox", fw: 84, fh: 150, io: "do", ch: 8, w: 0, ebus: 0, ioconn: 8, ioLabel: "IO", etherP: true, desc: "IP67 EtherCAT P (power+data one cable), 4 DI + 4 DO, M8" },
  { id: "EQ2339-0022", name: "EtherCAT Box V4A 8DI/DO", fn: "fld", free: true, kind: "epbox", fw: 84, fh: 150, io: "do", ch: 8, w: 0, ebus: 0, ioconn: 8, ioLabel: "IO", desc: "IP69K stainless housing, 8 configurable digital I/O, M12" },
  /* =================== THIRD-PARTY BRANDED PARTS ====================
   * Representative real part numbers from each maker; drawn faces and
   * electrical specs are approximate. brand → logo badge + colors. */
  // --- WAGO ---
  { id: "WAGO-787-2861", brand: "wago", name: "Pro 2 PSU 24V 10A", fn: "psu", free: true, kind: "supplybox", fw: 60, fh: 150, io: null, ch: 0, w: 0, ebus: 0, psuV: 24, psuA: 10, desc: "Cabinet power supply, 100-240 V AC in, 24 V DC 10 A out" },
  { id: "WAGO-2857-534", brand: "wago", name: "PLC-Relay 24V 1CO", fn: "distb", free: true, kind: "relay", fw: 60, fh: 88, io: null, ch: 1, w: 0, ebus: 0, desc: "Slim pluggable relay module, 24 V DC coil" },
  { id: "WAGO-2016-DIST", brand: "wago", name: "TopJob S Potential Block", fn: "distb", free: true, kind: "busbar", fw: 210, fh: 34, io: null, ch: 8, w: 0, ebus: 0, pol: "24V", desc: "Rail-mount potential distribution, push-in, 8 taps" },
  { id: "WAGO-221-DIST", brand: "wago", name: "221 Splice Block 0V", fn: "distb", free: true, kind: "busbar", fw: 210, fh: 34, io: null, ch: 8, w: 0, ebus: 0, pol: "0V", desc: "Lever-nut distribution block, 8 taps to 0 V" },
  { id: "WAGO-2006-PE", brand: "wago", name: "TopJob S PE Rail", fn: "distb", free: true, kind: "busbar", fw: 210, fh: 34, io: null, ch: 8, w: 0, ebus: 0, pol: "PE", desc: "Ground/PE distribution rail, 8 taps" },
  // --- Murr Elektronik ---
  { id: "MURR-EMPARRO", brand: "murr", name: "Emparro PSU 24V 20A", fn: "psu", free: true, kind: "supplybox", fw: 66, fh: 156, io: null, ch: 0, w: 0, ebus: 0, psuV: 24, psuA: 20, desc: "1-phase cabinet PSU, 24 V DC 20 A" },
  { id: "MURR-MICO", brand: "murr", name: "MICO 4.10 Fuse", fn: "distb", free: true, kind: "fusebox", fw: 74, fh: 96, io: null, ch: 4, w: 0, ebus: 0, desc: "4-channel electronic circuit protection, 24 V DC" },
  { id: "MURR-MVK", brand: "murr", name: "MVK Fusion IP67 I/O", fn: "fld", free: true, kind: "epbox", fw: 92, fh: 158, io: "do", ch: 8, w: 0, ebus: 0, ioconn: 8, ioLabel: "IO", m12io: true, iolMaster: true, desc: "IP67 EtherCAT + IO-Link + safety module, M12" },
  { id: "MURR-MIRO", brand: "murr", name: "MIRO Relay 24V", fn: "distb", free: true, kind: "relay", fw: 46, fh: 88, io: null, ch: 1, w: 0, ebus: 0, desc: "Ultra-slim interface relay, 6.2 mm" },
  { id: "MURR-REDBOX", brand: "murr", name: "Emparro ACCUcontrol Buffer", fn: "distb", free: true, kind: "supplybox", fw: 60, fh: 150, io: null, ch: 0, w: 0, ebus: 0, desc: "24 V DC buffer / redundancy module" },
  // --- Banner Engineering ---
  { id: "BANNER-TL50", brand: "banner", name: "TL50 Tower Light", fn: "fld", free: true, kind: "stack", fw: 64, fh: 150, io: null, ch: 3, w: 0, ebus: 0, lights: ["R", "Y", "G"], desc: "50 mm indicator tower, 24 V DC segments" },
  { id: "BANNER-K50", brand: "banner", name: "K50 Beacon RGB", fn: "fld", free: true, kind: "stack", fw: 58, fh: 96, io: null, ch: 3, w: 0, ebus: 0, lights: ["R", "Y", "G"], desc: "Dome indicator, multicolor 24 V DC" },
  { id: "BANNER-QS18", brand: "banner", name: "QS18 Photoelectric", fn: "fld", free: true, kind: "sensor", fw: 40, fh: 112, io: null, ch: 1, w: 0, ebus: 0, desc: "Diffuse/retro photo sensor, 3-wire PNP, M12" },
  { id: "BANNER-Q4X", brand: "banner", name: "Q4X Laser Distance", fn: "fld", free: true, kind: "sensor", fw: 44, fh: 112, io: null, ch: 1, w: 0, ebus: 0, analogOut: true, desc: "Laser distance, analog 4-20 mA + discrete, M12" },
  { id: "BANNER-LX", brand: "banner", name: "LS Safety Light Curtain", fn: "fld", free: true, kind: "curtain", fw: 58, fh: 184, io: null, ch: 0, w: 0, ebus: 0, safety: true, desc: "Type 4 safety light screen, OSSD outputs" },
  // --- Eaton ---
  { id: "EATON-M22-BTN", brand: "eaton", name: "M22 Push Button", fn: "fld", free: true, kind: "btn", fw: 54, fh: 92, io: null, ch: 0, w: 0, ebus: 0, contacts: ["NO", "NC"], desc: "22 mm momentary button + contact blocks" },
  { id: "EATON-M22-ESTOP", brand: "eaton", name: "M22 E-Stop", fn: "fld", free: true, kind: "estop", fw: 58, fh: 96, io: null, ch: 0, w: 0, ebus: 0, contacts: ["NC", "NC"], safety: true, desc: "22 mm twist-release E-stop, 2 NC" },
  { id: "EATON-DILM", brand: "eaton", name: "DILM Contactor 3P", fn: "fld", free: true, kind: "contactor", fw: 84, fh: 104, io: null, ch: 3, w: 0, ebus: 0, desc: "XT/DILM motor contactor, 24 V DC coil" },
  { id: "EATON-FAZ", brand: "eaton", name: "FAZ Circuit Breaker", fn: "distb", free: true, kind: "breaker", fw: 40, fh: 108, io: null, ch: 1, w: 0, ebus: 0, poles: 1, desc: "Miniature circuit breaker, 1-pole C-curve" },
  { id: "EATON-PKZ", brand: "eaton", name: "PKZM Motor Protector", fn: "distb", free: true, kind: "breaker", fw: 54, fh: 112, io: null, ch: 3, w: 0, ebus: 0, poles: 3, desc: "Motor-protective circuit breaker, adjustable" },
  { id: "EATON-P1", brand: "eaton", name: "P1 Main Disconnect", fn: "distb", free: true, kind: "disconnect", fw: 84, fh: 108, io: null, ch: 3, w: 0, ebus: 0, desc: "Rotary load-break main switch / power shutoff, 3-pole" },
  // --- Balluff ---
  { id: "BALLUFF-BES", brand: "balluff", name: "BES Inductive Sensor", fn: "fld", free: true, kind: "sensor", fw: 36, fh: 112, io: null, ch: 1, w: 0, ebus: 0, desc: "Inductive proximity, 3-wire PNP NO, M12" },
  { id: "BALLUFF-BOS", brand: "balluff", name: "BOS Photoelectric", fn: "fld", free: true, kind: "sensor", fw: 40, fh: 112, io: null, ch: 1, w: 0, ebus: 0, desc: "Photoelectric sensor, 3-wire PNP, M12" },
  { id: "BALLUFF-BNI", brand: "balluff", name: "BNI IO-Link Master IP67", fn: "fld", free: true, kind: "epbox", fw: 92, fh: 158, io: null, ch: 8, w: 0, ebus: 0, ioconn: 8, ioLabel: "IO-L", m12io: true, iolMaster: true, desc: "IP67 EtherCAT/IO-Link master block, 8-port M12" },
  { id: "BALLUFF-BIS", brand: "balluff", name: "BIS RFID Head", fn: "fld", free: true, kind: "iol", fw: 44, fh: 100, io: null, ch: 1, w: 0, ebus: 0, desc: "RFID read/write head, IO-Link — C/Q to master" },
  { id: "BALLUFF-BMF", brand: "balluff", name: "BMF Cylinder Sensor", fn: "fld", free: true, kind: "sensor", fw: 30, fh: 96, io: null, ch: 1, w: 0, ebus: 0, desc: "Magnetic field sensor for pneumatic cylinders, PNP" },
  // --- SMC ---
  { id: "SMC-EX600", brand: "smc", name: "EX600 Valve Manifold", fn: "fld", free: true, kind: "valvebank", fw: 150, fh: 96, io: null, ch: 8, w: 0, ebus: 0, m12io: true, iolMaster: false, netport: true, desc: "8-station solenoid valve manifold + EtherCAT/IO-Link node" },
  { id: "SMC-SY", brand: "smc", name: "SY Valve Manifold", fn: "fld", free: true, kind: "valvebank", fw: 130, fh: 90, io: null, ch: 5, w: 0, ebus: 0, desc: "5-station solenoid valve manifold, 24 V DC" },
  { id: "SMC-ISE30", brand: "smc", name: "ISE30 Pressure Switch", fn: "fld", free: true, kind: "sensor", fw: 40, fh: 92, io: null, ch: 1, w: 0, ebus: 0, analogOut: true, desc: "Digital pressure switch, PNP + analog out" },
  { id: "SMC-ZK2", brand: "smc", name: "ZK2 Vacuum Ejector", fn: "fld", free: true, kind: "valve", fw: 76, fh: 90, io: null, ch: 1, w: 0, ebus: 0, desc: "Vacuum ejector w/ solenoid, 24 V DC" },
  // --- Festo ---
  { id: "FESTO-VTUG", brand: "festo", name: "VTUG Valve Terminal", fn: "fld", free: true, kind: "valvebank", fw: 150, fh: 92, io: null, ch: 8, w: 0, ebus: 0, netport: true, desc: "8-station valve terminal, multi-pin / fieldbus node" },
  { id: "FESTO-CPX-AP", brand: "festo", name: "CPX-AP-I Remote I/O", fn: "fld", free: true, kind: "epbox", fw: 92, fh: 150, io: "di", ch: 8, w: 0, ebus: 0, ioconn: 8, ioLabel: "IO", m12io: true, netport: true, desc: "IP65 remote I/O block, EtherCAT-capable node, M12" },
  { id: "FESTO-SDE", brand: "festo", name: "SDE Pressure Sensor", fn: "fld", free: true, kind: "sensor", fw: 40, fh: 92, io: null, ch: 1, w: 0, ebus: 0, analogOut: true, desc: "Pressure sensor, PNP switch + analog" },
  { id: "FESTO-VUVG", brand: "festo", name: "VUVG Solenoid Valve", fn: "fld", free: true, kind: "valve", fw: 70, fh: 90, io: null, ch: 1, w: 0, ebus: 0, desc: "Single solenoid valve, 24 V DC" },
  // --- igus (electrically-driven motion only) ---
  { id: "IGUS-DRYLIN-E", brand: "igus", name: "drylin E Linear Axis", fn: "drv", free: true, kind: "linaxis", fw: 190, fh: 60, io: null, ch: 0, w: 0, ebus: 0, motion: true, desc: "Motorized lead-screw linear axis w/ stepper — motor/data cable" },
  // --- Leuze ---
  { id: "LEUZE-CML", brand: "leuze", name: "CML Measuring Curtain", fn: "fld", free: true, kind: "curtain", fw: 54, fh: 176, io: null, ch: 0, w: 0, ebus: 0, desc: "Measuring light curtain, switching + IO-Link" },
  { id: "LEUZE-MLC", brand: "leuze", name: "MLC 500 Safety Curtain", fn: "fld", free: true, kind: "curtain", fw: 58, fh: 184, io: null, ch: 0, w: 0, ebus: 0, safety: true, desc: "Type 4 safety light curtain, OSSD" },
  { id: "LEUZE-RSL", brand: "leuze", name: "RSL 400 Safety Scanner", fn: "fld", free: true, kind: "scanner", fw: 96, fh: 110, io: null, ch: 0, w: 0, ebus: 0, safety: true, desc: "Safety laser scanner, OSSD pair, M12" },
  { id: "LEUZE-HRT", brand: "leuze", name: "HRT 46B Photoelectric", fn: "fld", free: true, kind: "sensor", fw: 40, fh: 112, io: null, ch: 1, w: 0, ebus: 0, desc: "Diffuse photoelectric sensor, PNP, M12" },
  { id: "LEUZE-DCR", brand: "leuze", name: "DCR 200 Code Reader", fn: "fld", free: true, kind: "sensor", fw: 48, fh: 100, io: null, ch: 1, w: 0, ebus: 0, desc: "2D barcode reader, PNP + data, M12" },
  // --- Siemens (field components, no PLC) ---
  { id: "SIEMENS-3RT", brand: "siemens", name: "SIRIUS 3RT Contactor", fn: "fld", free: true, kind: "contactor", fw: 84, fh: 104, io: null, ch: 3, w: 0, ebus: 0, desc: "3RT2 motor contactor, 24 V DC coil" },
  { id: "SIEMENS-3RV", brand: "siemens", name: "SIRIUS 3RV Motor Breaker", fn: "distb", free: true, kind: "breaker", fw: 54, fh: 112, io: null, ch: 3, w: 0, ebus: 0, poles: 3, desc: "Motor-protective circuit breaker, adjustable" },
  { id: "SIEMENS-3SU-BTN", brand: "siemens", name: "SIRIUS 3SU Push Button", fn: "fld", free: true, kind: "btn", fw: 54, fh: 92, io: null, ch: 0, w: 0, ebus: 0, contacts: ["NO", "NC"], desc: "22 mm pushbutton + contact modules" },
  { id: "SIEMENS-3SB-ESTOP", brand: "siemens", name: "SIRIUS E-Stop", fn: "fld", free: true, kind: "estop", fw: 58, fh: 96, io: null, ch: 0, w: 0, ebus: 0, contacts: ["NC", "NC"], safety: true, desc: "22 mm emergency stop, 2 NC" },
  { id: "SIEMENS-3LD", brand: "siemens", name: "SENTRON 3LD Main Switch", fn: "distb", free: true, kind: "disconnect", fw: 84, fh: 108, io: null, ch: 3, w: 0, ebus: 0, desc: "Rotary main/EMERGENCY-OFF disconnect, 3-pole" },
  { id: "SIEMENS-SITOP", brand: "siemens", name: "SITOP PSU 24V 20A", fn: "psu", free: true, kind: "supplybox", fw: 66, fh: 156, io: null, ch: 0, w: 0, ebus: 0, psuV: 24, psuA: 20, desc: "SITOP PSU8200, 3-phase in, 24 V DC 20 A" },
  { id: "SIEMENS-1FK2", brand: "siemens", name: "1FK2 Servomotor", fn: "drv", free: true, kind: "motor", fw: 116, fh: 96, motion: true, io: null, ch: 0, w: 0, ebus: 0, desc: "Synchronous servomotor (pair with an EtherCAT drive, OCT/classic)" },
  // --- Phoenix Contact ---
  { id: "PHOENIX-QUINT", brand: "phoenix", name: "QUINT PSU 24V 20A", fn: "psu", free: true, kind: "supplybox", fw: 66, fh: 156, io: null, ch: 0, w: 0, ebus: 0, psuV: 24, psuA: 20, desc: "QUINT4 power supply, 3-phase, 24 V DC 20 A" },
  { id: "PHOENIX-PLC-RSC", brand: "phoenix", name: "PLC-RSC Relay 24V", fn: "distb", free: true, kind: "relay", fw: 56, fh: 88, io: null, ch: 1, w: 0, ebus: 0, desc: "Pluggable interface relay, 24 V DC coil, 1 CO" },
  { id: "PHOENIX-CONTACTRON", brand: "phoenix", name: "CONTACTRON Motor Starter", fn: "fld", free: true, kind: "contactor", fw: 40, fh: 104, io: null, ch: 3, w: 0, ebus: 0, desc: "Hybrid reversing motor starter, 22.5 mm" },
  { id: "PHOENIX-TRIO", brand: "phoenix", name: "TRIO PSU 24V 10A", fn: "psu", free: true, kind: "supplybox", fw: 56, fh: 150, io: null, ch: 0, w: 0, ebus: 0, psuV: 24, psuA: 10, desc: "TRIO power supply, 1-phase, 24 V DC 10 A" },
  // --- SICK ---
  { id: "SICK-W4", brand: "sick", name: "W4 Photoelectric", fn: "fld", free: true, kind: "sensor", fw: 40, fh: 112, io: null, ch: 1, w: 0, ebus: 0, desc: "Compact photoelectric sensor, PNP, M12" },
  { id: "SICK-DFS60", brand: "sick", name: "DFS60 Encoder", fn: "fld", free: true, kind: "encf", fw: 88, fh: 100, io: null, ch: 1, w: 0, ebus: 0, desc: "Incremental encoder, A/B/Z, M12 or cable" },
  { id: "SICK-MICROSCAN3", brand: "sick", name: "microScan3 Safety Scanner", fn: "fld", free: true, kind: "scanner", fw: 100, fh: 110, io: null, ch: 0, w: 0, ebus: 0, safety: true, desc: "Safety laser scanner, EtherCAT/OSSD, M12" },
  { id: "SICK-DT35", brand: "sick", name: "DT35 Distance Sensor", fn: "fld", free: true, kind: "sensor", fw: 44, fh: 112, io: null, ch: 1, w: 0, ebus: 0, analogOut: true, desc: "Mid-range distance sensor, analog 4-20 mA + IO-Link" },
  // --- Turck ---
  { id: "TURCK-BI", brand: "turck", name: "Bi Inductive Sensor", fn: "fld", free: true, kind: "sensor", fw: 36, fh: 112, io: null, ch: 1, w: 0, ebus: 0, desc: "Inductive proximity, PNP NO, M12" },
  { id: "TURCK-TBEN", brand: "turck", name: "TBEN IP67 I/O Block", fn: "fld", free: true, kind: "epbox", fw: 92, fh: 158, io: "do", ch: 16, w: 0, ebus: 0, ioconn: 8, ioLabel: "IO", m12io: true, iolMaster: true, desc: "IP67 multiprotocol I/O + IO-Link master, M12" },
  { id: "TURCK-PS", brand: "turck", name: "PS+ Pressure Sensor", fn: "fld", free: true, kind: "sensor", fw: 40, fh: 92, io: null, ch: 1, w: 0, ebus: 0, analogOut: true, desc: "Pressure sensor, PNP + analog + IO-Link" },
  // --- ifm electronic ---
  { id: "IFM-IG", brand: "ifm", name: "efector Inductive IG", fn: "fld", free: true, kind: "sensor", fw: 36, fh: 112, io: null, ch: 1, w: 0, ebus: 0, desc: "Inductive proximity sensor, PNP, M12" },
  { id: "IFM-AL1350", brand: "ifm", name: "AL1350 IO-Link Master", fn: "fld", free: true, kind: "epbox", fw: 92, fh: 158, io: null, ch: 8, w: 0, ebus: 0, ioconn: 8, ioLabel: "IO-L", m12io: true, iolMaster: true, desc: "IP67 EtherCAT IO-Link master, 8-port, M12" },
  { id: "IFM-PN", brand: "ifm", name: "PN Pressure Sensor", fn: "fld", free: true, kind: "sensor", fw: 40, fh: 92, io: null, ch: 1, w: 0, ebus: 0, analogOut: true, desc: "Pressure sensor w/ display, PNP + analog/IO-Link" },
  { id: "IFM-SM", brand: "ifm", name: "SM Flow Meter", fn: "fld", free: true, kind: "sensor", fw: 42, fh: 100, io: null, ch: 1, w: 0, ebus: 0, analogOut: true, desc: "Magnetic-inductive flow meter, analog + IO-Link" },
  // --- Pilz (safety relays, not PLC) ---
  { id: "PILZ-PNOZ", brand: "pilz", name: "PNOZ Safety Relay", fn: "fld", free: true, kind: "box", fw: 60, fh: 108, io: null, ch: 0, w: 0, ebus: 0, safety: true, ioconn: 0, desc: "PNOZ single safety relay, E-stop/guard monitoring" },
  { id: "PILZ-PSEN", brand: "pilz", name: "PSEN Safety Switch", fn: "fld", free: true, kind: "limit", fw: 52, fh: 96, io: null, ch: 0, w: 0, ebus: 0, safety: true, desc: "Coded magnetic safety door switch" },
  // --- Schneider Electric ---
  { id: "SCHNEIDER-LC1D", brand: "schneider", name: "TeSys D Contactor", fn: "fld", free: true, kind: "contactor", fw: 84, fh: 104, io: null, ch: 3, w: 0, ebus: 0, desc: "TeSys LC1D motor contactor, 24 V DC coil" },
  { id: "SCHNEIDER-XB5-BTN", brand: "schneider", name: "Harmony Push Button", fn: "fld", free: true, kind: "btn", fw: 54, fh: 92, io: null, ch: 0, w: 0, ebus: 0, contacts: ["NO", "NC"], desc: "22 mm Harmony XB5 pushbutton" },
  { id: "SCHNEIDER-VCF", brand: "schneider", name: "TeSys Disconnect Switch", fn: "distb", free: true, kind: "disconnect", fw: 84, fh: 108, io: null, ch: 3, w: 0, ebus: 0, desc: "Rotary load-break main disconnect, 3-pole" },
  // --- EtherCAT servo drives (3rd party) ---
  { id: "KOLLMORGEN-AKD", brand: "kollmorgen", name: "AKD EtherCAT Servo Drive", fn: "drv", free: true, kind: "drive", fw: 92, fh: 210, motion: true, io: null, ch: 1, w: 0, ebus: 0, desc: "AKD-N/P EtherCAT servo drive, 3 A" },
  { id: "OMRON-1S", brand: "omron", name: "1S EtherCAT Servo Drive", fn: "drv", free: true, kind: "drive", fw: 92, fh: 210, motion: true, io: null, ch: 1, w: 0, ebus: 0, desc: "Sysmac 1S EtherCAT servo drive" },
  // --- AutomationDirect ---
  { id: "ADC-STRIDE-SW", brand: "adc", name: "Stride 5-Port Switch", fn: "net", free: true, kind: "switch8", nports: 5, fw: 130, fh: 90, io: null, ch: 0, w: 0, ebus: 0, desc: "Unmanaged Ethernet switch, DIN mount" },
  { id: "ADC-RHINO-PSU", brand: "adc", name: "RHINO PSU 24V 10A", fn: "psu", free: true, kind: "supplybox", fw: 56, fh: 150, io: null, ch: 0, w: 0, ebus: 0, psuV: 24, psuA: 10, desc: "RHINO PSC power supply, 24 V DC 10 A" },
  { id: "ADC-PROSENSE-PROX", brand: "adc", name: "ProSense Inductive Prox", fn: "fld", free: true, kind: "sensor", fw: 36, fh: 112, io: null, ch: 1, w: 0, ebus: 0, desc: "Inductive proximity sensor, 3-wire PNP, M12" },
  { id: "ADC-PROSENSE-TMP", brand: "adc", name: "ProSense Temp Transmitter", fn: "fld", free: true, kind: "sensor", fw: 36, fh: 100, io: null, ch: 1, w: 0, ebus: 0, analogOut: true, desc: "RTD temperature transmitter, 4-20 mA" },
  { id: "ADC-FUJI-CONT", brand: "adc", name: "Fuji Contactor 3P", fn: "fld", free: true, kind: "contactor", fw: 84, fh: 104, io: null, ch: 3, w: 0, ebus: 0, desc: "IEC motor contactor, 24 V DC coil" },
  { id: "ADC-MERCURY-DISC", brand: "adc", name: "Mercury Disconnect Switch", fn: "distb", free: true, kind: "disconnect", fw: 84, fh: 108, io: null, ch: 3, w: 0, ebus: 0, desc: "Rotary main disconnect / power shutoff, 3-pole" },
  { id: "ADC-SURESTEP-MOT", brand: "adc", name: "SureStep Stepper Motor", fn: "drv", free: true, kind: "motor", fw: 110, fh: 96, motion: true, io: null, ch: 0, w: 0, ebus: 0, desc: "NEMA stepper motor (drive from a stepper terminal)" },
  // --- Weidmüller ---
  { id: "WEIDMULLER-PRO", brand: "weidmuller", name: "PRO MAX PSU 24V 20A", fn: "psu", free: true, kind: "supplybox", fw: 66, fh: 156, io: null, ch: 0, w: 0, ebus: 0, psuV: 24, psuA: 20, desc: "PRO MAX power supply, 24 V DC 20 A" },
  { id: "WEIDMULLER-TERM", brand: "weidmuller", name: "Klippon Potential Block", fn: "distb", free: true, kind: "busbar", fw: 210, fh: 34, io: null, ch: 8, w: 0, ebus: 0, pol: "24V", desc: "Rail-mount distribution terminal, 8 taps" },
  // === additional branded parts (representative, approximate) ===
  { id: "BANNER-WLS15", brand: "banner", name: "WLS15 LED Light Strip", fn: "fld", free: true, kind: "stack", fw: 40, fh: 150, io: null, ch: 3, w: 0, ebus: 0, lights: ["G", "Y", "R"], desc: "Multicolor LED work light, 24 V DC" },
  { id: "BANNER-DF", brand: "banner", name: "DF-G Fiber Amplifier", fn: "fld", free: true, kind: "sensor", fw: 40, fh: 100, io: null, ch: 1, w: 0, ebus: 0, desc: "Fiber-optic amplifier, PNP + IO-Link" },
  { id: "BALLUFF-BTL", brand: "balluff", name: "BTL Linear Transducer", fn: "fld", free: true, kind: "sensor", fw: 44, fh: 112, io: null, ch: 1, w: 0, ebus: 0, analogOut: true, desc: "Magnetostrictive position, analog + IO-Link" },
  { id: "BALLUFF-BNS", brand: "balluff", name: "BNS Mechanical Switch", fn: "fld", free: true, kind: "limit", fw: 52, fh: 96, io: null, ch: 0, w: 0, ebus: 0, desc: "Multiple-position mechanical switch" },
  { id: "SICK-WTB", brand: "sick", name: "WTB4 Photoelectric", fn: "fld", free: true, kind: "sensor", fw: 40, fh: 112, io: null, ch: 1, w: 0, ebus: 0, desc: "Compact photoelectric, PNP, M12" },
  { id: "SICK-UM30", brand: "sick", name: "UM30 Ultrasonic", fn: "fld", free: true, kind: "sensor", fw: 42, fh: 112, io: null, ch: 1, w: 0, ebus: 0, analogOut: true, desc: "Ultrasonic distance sensor, analog + IO-Link" },
  { id: "SICK-CLV", brand: "sick", name: "CLV Barcode Scanner", fn: "fld", free: true, kind: "sensor", fw: 48, fh: 100, io: null, ch: 1, w: 0, ebus: 0, desc: "Fixed-mount barcode scanner, M12" },
  { id: "IFM-OGD", brand: "ifm", name: "OGD Photoelectric", fn: "fld", free: true, kind: "sensor", fw: 40, fh: 112, io: null, ch: 1, w: 0, ebus: 0, desc: "Diffuse photoelectric w/ IO-Link, M12" },
  { id: "IFM-TN", brand: "ifm", name: "TN Temperature Sensor", fn: "fld", free: true, kind: "sensor", fw: 40, fh: 100, io: null, ch: 1, w: 0, ebus: 0, analogOut: true, desc: "Compact temperature sensor, analog + IO-Link" },
  { id: "TURCK-RU", brand: "turck", name: "RU Ultrasonic Sensor", fn: "fld", free: true, kind: "sensor", fw: 42, fh: 112, io: null, ch: 1, w: 0, ebus: 0, analogOut: true, desc: "Ultrasonic distance, analog + IO-Link" },
  { id: "TURCK-NI", brand: "turck", name: "Ni Inductive Sensor", fn: "fld", free: true, kind: "sensor", fw: 36, fh: 112, io: null, ch: 1, w: 0, ebus: 0, desc: "Factor-1 inductive sensor, PNP, M12" },
  { id: "EATON-M22-SEL", brand: "eaton", name: "M22 Selector Switch", fn: "fld", free: true, kind: "btn", fw: 54, fh: 92, io: null, ch: 0, w: 0, ebus: 0, contacts: ["NO", "NO"], sel: true, desc: "22 mm selector switch, 2-position" },
  { id: "EATON-M22-PILOT", brand: "eaton", name: "M22 Pilot Light", fn: "fld", free: true, kind: "btn", fw: 54, fh: 80, io: null, ch: 0, w: 0, ebus: 0, contacts: [], illum: true, desc: "22 mm LED indicator, 24 V" },
  { id: "EATON-DILA", brand: "eaton", name: "DILA Control Relay", fn: "fld", free: true, kind: "relay", fw: 62, fh: 88, io: null, ch: 1, w: 0, ebus: 0, desc: "Control relay, 24 V DC coil, aux contacts" },
  { id: "SIEMENS-3SU-PILOT", brand: "siemens", name: "SIRIUS 3SU Pilot Light", fn: "fld", free: true, kind: "btn", fw: 54, fh: 80, io: null, ch: 0, w: 0, ebus: 0, contacts: [], illum: true, desc: "22 mm LED indicator, 24 V" },
  { id: "SIEMENS-3SK", brand: "siemens", name: "SIRIUS 3SK Safety Relay", fn: "fld", free: true, kind: "box", fw: 44, fh: 108, io: null, ch: 0, w: 0, ebus: 0, safety: true, ioconn: 0, desc: "Safety relay for E-stop / guard monitoring" },
  { id: "SCHNEIDER-XVB", brand: "schneider", name: "Harmony XVB Tower Light", fn: "fld", free: true, kind: "stack", fw: 62, fh: 150, io: null, ch: 3, w: 0, ebus: 0, lights: ["R", "Y", "G"], desc: "Modular signal tower, 24 V DC" },
  { id: "SCHNEIDER-GV2", brand: "schneider", name: "TeSys GV2 Motor Breaker", fn: "distb", free: true, kind: "breaker", fw: 54, fh: 112, io: null, ch: 3, w: 0, ebus: 0, poles: 3, desc: "Motor-protective circuit breaker" },
  { id: "PHOENIX-QUINT-UPS", brand: "phoenix", name: "QUINT UPS 24V", fn: "psu", free: true, kind: "supplybox", fw: 60, fh: 150, io: null, ch: 0, w: 0, ebus: 0, psuV: 24, psuA: 10, desc: "DC-UPS w/ energy storage, 24 V DC" },
  { id: "PHOENIX-TERM", brand: "phoenix", name: "CLIPLINE Potential Block", fn: "distb", free: true, kind: "busbar", fw: 210, fh: 34, io: null, ch: 8, w: 0, ebus: 0, pol: "24V", desc: "Rail distribution terminal, 8 taps" },
  { id: "WAGO-2042-DO", brand: "wago", name: "PLC-Interface Opto-Coupler", fn: "distb", free: true, kind: "relay", fw: 46, fh: 88, io: null, ch: 1, w: 0, ebus: 0, desc: "Solid-state relay / optocoupler module, 24 V" },
  { id: "MURR-CUBE67", brand: "murr", name: "Cube67 IP67 I/O Node", fn: "fld", free: true, kind: "epbox", fw: 92, fh: 158, io: "do", ch: 16, w: 0, ebus: 0, ioconn: 8, ioLabel: "IO", m12io: true, netport: true, desc: "IP67 modular fieldbus I/O node, M12" },
  { id: "SMC-ITV", brand: "smc", name: "ITV Electro-Pneumatic Reg.", fn: "fld", free: true, kind: "valve", fw: 70, fh: 96, io: null, ch: 1, w: 0, ebus: 0, analogOut: true, desc: "Proportional pressure regulator, 4-20 mA setpoint" },
  { id: "FESTO-MPA", brand: "festo", name: "MPA Valve Terminal", fn: "fld", free: true, kind: "valvebank", fw: 150, fh: 92, io: null, ch: 8, w: 0, ebus: 0, netport: true, desc: "Modular valve terminal, fieldbus node" },
  { id: "OMRON-E3Z", brand: "omron", name: "E3Z Photoelectric", fn: "fld", free: true, kind: "sensor", fw: 40, fh: 112, io: null, ch: 1, w: 0, ebus: 0, desc: "Photoelectric sensor, PNP, M8/M12" },
  { id: "OMRON-G7Z", brand: "omron", name: "G7Z Power Relay", fn: "fld", free: true, kind: "relay", fw: 62, fh: 96, io: null, ch: 1, w: 0, ebus: 0, desc: "High-power relay, 24 V DC coil" },
  { id: "KOLLMORGEN-AKM", brand: "kollmorgen", name: "AKM Servomotor", fn: "drv", free: true, kind: "motor", fw: 116, fh: 96, io: null, ch: 0, w: 0, ebus: 0, motion: true, desc: "Synchronous servomotor, pairs with AKD (OCT/classic)" },

  /* ===== EXPANDED FAMILY COVERAGE (representative; series ratings are
     exposed as `variants` so one entry covers a whole product line) ===== */
  // WAGO
  { id: "WAGO-787-1226", brand: "wago", name: "EPSITRON PSU 24V", fn: "psu", free: true, kind: "supplybox", fw: 58, fh: 150, io: null, ch: 0, w: 0, ebus: 0, psuV: 24, psuA: 5, desc: "EPSITRON Classic power supply", variants: [{ s: "0005", d: "24 V / 5 A" }, { s: "0010", d: "24 V / 10 A" }, { s: "0020", d: "24 V / 20 A" }] },
  { id: "WAGO-787-UPS", brand: "wago", name: "EPSITRON DC-UPS", fn: "psu", free: true, kind: "supplybox", fw: 58, fh: 150, io: null, ch: 0, w: 0, ebus: 0, psuV: 24, psuA: 10, desc: "24 V DC uninterruptible supply w/ battery" },
  { id: "WAGO-787-FUSE", brand: "wago", name: "EPSITRON Electronic Fuse", fn: "distb", free: true, kind: "fusebox", fw: 74, fh: 96, io: null, ch: 4, w: 0, ebus: 0, desc: "4-channel electronic circuit breaker, 24 V DC" },
  { id: "WAGO-2002-TERM", brand: "wago", name: "TopJob S Feed-Through", fn: "distb", free: true, kind: "busbar", fw: 210, fh: 34, io: null, ch: 8, w: 0, ebus: 0, pol: "24V", desc: "Feed-through terminal strip, push-in" },
  { id: "WAGO-859-RELAY", brand: "wago", name: "Relay Module 2CO", fn: "distb", free: true, kind: "relay", fw: 56, fh: 88, io: null, ch: 1, w: 0, ebus: 0, desc: "Interface relay, 24 V DC coil, 2 changeover" },
  // Murr Elektronik
  { id: "MURR-MICO-PRO", brand: "murr", name: "MICO Pro Fuse Module", fn: "distb", free: true, kind: "fusebox", fw: 74, fh: 96, io: null, ch: 4, w: 0, ebus: 0, desc: "Modular electronic fuse, configurable channels", variants: [{ s: "0002", d: "2-channel" }, { s: "0004", d: "4-channel" }, { s: "0008", d: "8-channel" }] },
  { id: "MURR-IMPACT67", brand: "murr", name: "Impact67 IP67 I/O", fn: "fld", free: true, kind: "epbox", fw: 92, fh: 158, io: "do", ch: 16, w: 0, ebus: 0, ioconn: 8, ioLabel: "IO", m12io: true, netport: true, desc: "IP67 fieldbus I/O module, M12" },
  { id: "MURR-MODLINK", brand: "murr", name: "Modlink Panel Interface", fn: "distb", free: true, kind: "box", fw: 60, fh: 100, io: null, ch: 0, w: 0, ebus: 0, ioconn: 4, desc: "Panel feed-through interface (power/data)" },
  { id: "MURR-EMPARRO67", brand: "murr", name: "Emparro67 IP67 PSU", fn: "psu", free: true, kind: "supplybox", fw: 60, fh: 150, io: null, ch: 0, w: 0, ebus: 0, psuV: 24, psuA: 10, desc: "IP67 field power supply, 24 V DC" },
  // Banner
  { id: "BANNER-TL70", brand: "banner", name: "TL70 Modular Tower", fn: "fld", free: true, kind: "stack", fw: 66, fh: 168, io: null, ch: 5, w: 0, ebus: 0, lights: ["R", "Y", "G", "B", "W"], buzzer: true, desc: "70 mm modular tower light w/ audible" },
  { id: "BANNER-K30", brand: "banner", name: "K30 Touch Indicator", fn: "fld", free: true, kind: "stack", fw: 54, fh: 92, io: null, ch: 3, w: 0, ebus: 0, lights: ["R", "Y", "G"], desc: "30 mm indicator w/ touch button" },
  { id: "BANNER-QS30", brand: "banner", name: "QS30 Photoelectric", fn: "fld", free: true, kind: "sensor", fw: 44, fh: 112, io: null, ch: 1, w: 0, ebus: 0, desc: "Long-range photoelectric, PNP, M12" },
  { id: "BANNER-T30R", brand: "banner", name: "T30R Radar Sensor", fn: "fld", free: true, kind: "sensor", fw: 46, fh: 112, io: null, ch: 1, w: 0, ebus: 0, analogOut: true, desc: "Radar distance sensor, analog + IO-Link" },
  { id: "BANNER-SI-HG", brand: "banner", name: "SI-HG Safety E-Stop", fn: "fld", free: true, kind: "estop", fw: 58, fh: 96, io: null, ch: 0, w: 0, ebus: 0, contacts: ["NC", "NC"], safety: true, desc: "Grip safety E-stop, 2 NC" },
  // Eaton
  { id: "EATON-XTCE", brand: "eaton", name: "XT IEC Contactor", fn: "fld", free: true, kind: "contactor", fw: 84, fh: 104, io: null, ch: 3, w: 0, ebus: 0, desc: "XT series IEC contactor, 24 V DC coil", variants: [{ s: "0009", d: "9 A" }, { s: "0018", d: "18 A" }, { s: "0032", d: "32 A" }] },
  { id: "EATON-FAZ-3P", brand: "eaton", name: "FAZ Breaker 3-Pole", fn: "distb", free: true, kind: "breaker", fw: 54, fh: 108, io: null, ch: 3, w: 0, ebus: 0, poles: 3, desc: "3-pole miniature circuit breaker" },
  { id: "EATON-P3", brand: "eaton", name: "P3 Main Disconnect 100A", fn: "distb", free: true, kind: "disconnect", fw: 92, fh: 116, io: null, ch: 3, w: 0, ebus: 0, desc: "Heavy-duty rotary disconnect / power shutoff" },
  { id: "EATON-M22-ILL-SEL", brand: "eaton", name: "M22 Illuminated Selector", fn: "fld", free: true, kind: "btn", fw: 54, fh: 92, io: null, ch: 0, w: 0, ebus: 0, contacts: ["NO", "NO"], sel: true, illum: true, desc: "22 mm illuminated selector switch" },
  { id: "EATON-EMS", brand: "eaton", name: "EMS Hybrid Motor Starter", fn: "fld", free: true, kind: "contactor", fw: 40, fh: 104, io: null, ch: 3, w: 0, ebus: 0, desc: "Compact hybrid motor starter, 24 V DC control" },
  // Balluff
  { id: "BALLUFF-BCC", brand: "balluff", name: "BCC Cordset M12", fn: "distb", free: true, kind: "box", fw: 56, fh: 80, io: null, ch: 0, w: 0, ebus: 0, ioconn: 2, desc: "M12 connection cordset / junction (field wiring)" },
  { id: "BALLUFF-BSP", brand: "balluff", name: "BSP Pressure Sensor", fn: "fld", free: true, kind: "sensor", fw: 40, fh: 96, io: null, ch: 1, w: 0, ebus: 0, analogOut: true, desc: "Pressure sensor w/ display, analog + IO-Link" },
  { id: "BALLUFF-BOD", brand: "balluff", name: "BOD Laser Distance", fn: "fld", free: true, kind: "sensor", fw: 44, fh: 112, io: null, ch: 1, w: 0, ebus: 0, analogOut: true, desc: "Optical distance sensor, analog + IO-Link" },
  { id: "BALLUFF-BAE-PSU", brand: "balluff", name: "BAE Power Supply", fn: "psu", free: true, kind: "supplybox", fw: 56, fh: 150, io: null, ch: 0, w: 0, ebus: 0, psuV: 24, psuA: 10, desc: "24 V DC cabinet power supply" },
  // SMC
  { id: "SMC-VQC", brand: "smc", name: "VQC Valve Manifold", fn: "fld", free: true, kind: "valvebank", fw: 150, fh: 96, io: null, ch: 8, w: 0, ebus: 0, netport: true, desc: "Plug-in valve manifold w/ serial node" },
  { id: "SMC-JSY", brand: "smc", name: "JSY Compact Manifold", fn: "fld", free: true, kind: "valvebank", fw: 130, fh: 90, io: null, ch: 5, w: 0, ebus: 0, desc: "Compact solenoid valve manifold, 24 V DC" },
  { id: "SMC-EX260", brand: "smc", name: "EX260 Fieldbus Node", fn: "fld", free: true, kind: "epbox", fw: 92, fh: 150, io: "do", ch: 16, w: 0, ebus: 0, ioconn: 4, ioLabel: "V", m12io: true, netport: true, desc: "IP67 valve-manifold fieldbus node (EtherCAT), M12" },
  { id: "SMC-ZSE30", brand: "smc", name: "ZSE30 Vacuum Switch", fn: "fld", free: true, kind: "sensor", fw: 40, fh: 92, io: null, ch: 1, w: 0, ebus: 0, analogOut: true, desc: "Digital vacuum switch, PNP + analog" },
  { id: "SMC-D-M9", brand: "smc", name: "D-M9 Cylinder Switch", fn: "fld", free: true, kind: "sensor", fw: 30, fh: 96, io: null, ch: 1, w: 0, ebus: 0, desc: "Solid-state auto switch for cylinders, PNP" },
  // Festo
  { id: "FESTO-CMMT", brand: "festo", name: "CMMT-AS Servo Drive", fn: "drv", free: true, kind: "drive", fw: 92, fh: 210, io: null, ch: 1, w: 0, ebus: 0, motion: true, desc: "CMMT-AS servo drive, EtherCAT-capable" },
  { id: "FESTO-EMMT", brand: "festo", name: "EMMT-AS Servomotor", fn: "drv", free: true, kind: "motor", fw: 116, fh: 96, io: null, ch: 0, w: 0, ebus: 0, motion: true, desc: "Synchronous servomotor, one-cable capable" },
  { id: "FESTO-SPAU", brand: "festo", name: "SPAU Pressure Sensor", fn: "fld", free: true, kind: "sensor", fw: 42, fh: 96, io: null, ch: 1, w: 0, ebus: 0, analogOut: true, desc: "Pressure sensor w/ display, PNP + analog/IO-Link" },
  { id: "FESTO-SFAB", brand: "festo", name: "SFAB Flow Sensor", fn: "fld", free: true, kind: "sensor", fw: 42, fh: 100, io: null, ch: 1, w: 0, ebus: 0, analogOut: true, desc: "Air flow sensor, analog + IO-Link" },
  { id: "FESTO-VAEM", brand: "festo", name: "VAEM Solenoid Driver", fn: "distb", free: true, kind: "box", fw: 60, fh: 96, io: null, ch: 4, w: 0, ebus: 0, ioconn: 4, desc: "Solenoid coil driver module, 24 V DC" },
  // igus
  { id: "IGUS-DRYLIN-ZLW", brand: "igus", name: "drylin ZLW Belt Axis", fn: "drv", free: true, kind: "linaxis", fw: 190, fh: 60, io: null, ch: 0, w: 0, ebus: 0, motion: true, desc: "Motorized toothed-belt linear axis" },
  { id: "IGUS-MOT-NEMA", brand: "igus", name: "drylin Stepper Motor", fn: "drv", free: true, kind: "motor", fw: 100, fh: 92, io: null, ch: 0, w: 0, ebus: 0, motion: true, desc: "NEMA stepper motor w/ encoder option" },
  // Leuze
  { id: "LEUZE-PRK", brand: "leuze", name: "PRK Retro-Reflective", fn: "fld", free: true, kind: "sensor", fw: 40, fh: 112, io: null, ch: 1, w: 0, ebus: 0, desc: "Retro-reflective photoelectric sensor, PNP" },
  { id: "LEUZE-IS", brand: "leuze", name: "IS Inductive Sensor", fn: "fld", free: true, kind: "sensor", fw: 36, fh: 112, io: null, ch: 1, w: 0, ebus: 0, desc: "Inductive proximity switch, PNP, M12" },
  { id: "LEUZE-BCL", brand: "leuze", name: "BCL Barcode Reader", fn: "fld", free: true, kind: "sensor", fw: 48, fh: 100, io: null, ch: 1, w: 0, ebus: 0, desc: "Stationary barcode reader, M12" },
  { id: "LEUZE-MSI", brand: "leuze", name: "MSI Safety Relay", fn: "fld", free: true, kind: "box", fw: 56, fh: 108, io: null, ch: 0, w: 0, ebus: 0, safety: true, ioconn: 0, desc: "Safety relay module for E-stop/curtains" },
  // Siemens
  { id: "SIEMENS-3RH", brand: "siemens", name: "SIRIUS 3RH Control Relay", fn: "fld", free: true, kind: "relay", fw: 62, fh: 96, io: null, ch: 1, w: 0, ebus: 0, desc: "Contactor relay, 24 V DC coil, aux contacts" },
  { id: "SIEMENS-3VA", brand: "siemens", name: "SENTRON 3VA Breaker", fn: "distb", free: true, kind: "breaker", fw: 66, fh: 116, io: null, ch: 3, w: 0, ebus: 0, poles: 3, desc: "Molded-case circuit breaker" },
  { id: "SIEMENS-3SE", brand: "siemens", name: "SIRIUS 3SE Position Switch", fn: "fld", free: true, kind: "limit", fw: 52, fh: 96, io: null, ch: 0, w: 0, ebus: 0, desc: "Mechanical position/limit switch" },
  { id: "SIEMENS-3RW", brand: "siemens", name: "SIRIUS 3RW Soft Starter", fn: "fld", free: true, kind: "contactor", fw: 84, fh: 116, io: null, ch: 3, w: 0, ebus: 0, desc: "Soft starter for 3-phase motors, 24 V control" },
  { id: "SIEMENS-SITOP-PSU100", brand: "siemens", name: "SITOP PSU100L 24V", fn: "psu", free: true, kind: "supplybox", fw: 60, fh: 150, io: null, ch: 0, w: 0, ebus: 0, psuV: 24, psuA: 10, desc: "1-phase stabilized supply", variants: [{ s: "0005", d: "24 V / 5 A" }, { s: "0010", d: "24 V / 10 A" }, { s: "0020", d: "24 V / 20 A" }] },
  { id: "SIEMENS-1FT2", brand: "siemens", name: "1FT2 Servomotor", fn: "drv", free: true, kind: "motor", fw: 116, fh: 96, io: null, ch: 0, w: 0, ebus: 0, motion: true, desc: "Servomotor w/ one-cable connection" },
  // Phoenix Contact
  { id: "PHOENIX-STEP", brand: "phoenix", name: "STEP POWER PSU", fn: "psu", free: true, kind: "supplybox", fw: 54, fh: 148, io: null, ch: 0, w: 0, ebus: 0, psuV: 24, psuA: 5, desc: "Compact DIN power supply", variants: [{ s: "0003", d: "24 V / 3 A" }, { s: "0005", d: "24 V / 5 A" }, { s: "0010", d: "24 V / 10 A" }] },
  { id: "PHOENIX-VAL", brand: "phoenix", name: "VAL Surge Protection", fn: "distb", free: true, kind: "box", fw: 56, fh: 100, io: null, ch: 0, w: 0, ebus: 0, ioconn: 3, desc: "Surge protective device for power circuits" },
  { id: "PHOENIX-FLSWITCH", brand: "phoenix", name: "FL SWITCH 8-Port", fn: "net", free: true, kind: "switch8", fw: 160, fh: 90, io: null, ch: 0, w: 0, ebus: 0, desc: "Industrial Ethernet switch, DIN mount" },
  { id: "PHOENIX-PSR", brand: "phoenix", name: "PSR Safety Relay", fn: "fld", free: true, kind: "box", fw: 56, fh: 108, io: null, ch: 0, w: 0, ebus: 0, safety: true, ioconn: 0, desc: "Safety relay for E-stop / guard door" },
  // SICK
  { id: "SICK-IME", brand: "sick", name: "IME Inductive Sensor", fn: "fld", free: true, kind: "sensor", fw: 36, fh: 112, io: null, ch: 1, w: 0, ebus: 0, desc: "Inductive proximity sensor, PNP, M12" },
  { id: "SICK-PBS", brand: "sick", name: "PBS Pressure Sensor", fn: "fld", free: true, kind: "sensor", fw: 40, fh: 96, io: null, ch: 1, w: 0, ebus: 0, analogOut: true, desc: "Pressure transmitter, analog + IO-Link" },
  { id: "SICK-DETEC4", brand: "sick", name: "deTec4 Safety Curtain", fn: "fld", free: true, kind: "curtain", fw: 58, fh: 184, io: null, ch: 0, w: 0, ebus: 0, safety: true, desc: "Type 4 safety light curtain, OSSD" },
  { id: "SICK-NANOSCAN3", brand: "sick", name: "nanoScan3 Safety Scanner", fn: "fld", free: true, kind: "scanner", fw: 92, fh: 106, io: null, ch: 0, w: 0, ebus: 0, safety: true, desc: "Compact safety laser scanner, EtherCAT/OSSD" },
  { id: "SICK-LECTOR", brand: "sick", name: "Lector Code Reader", fn: "fld", free: true, kind: "sensor", fw: 48, fh: 100, io: null, ch: 1, w: 0, ebus: 0, desc: "Image-based code reader, M12" },
  { id: "SICK-AFS60", brand: "sick", name: "AFS60 Absolute Encoder", fn: "fld", free: true, kind: "encf", fw: 88, fh: 100, io: null, ch: 1, w: 0, ebus: 0, desc: "Absolute encoder, SSI/BiSS, M12" },
  // Turck
  { id: "TURCK-FS", brand: "turck", name: "FS Flow Sensor", fn: "fld", free: true, kind: "sensor", fw: 42, fh: 100, io: null, ch: 1, w: 0, ebus: 0, analogOut: true, desc: "Flow monitor, analog + IO-Link" },
  { id: "TURCK-BLIDENT", brand: "turck", name: "BL ident RFID Head", fn: "fld", free: true, kind: "iol", fw: 44, fh: 100, io: null, ch: 1, w: 0, ebus: 0, desc: "HF/UHF RFID read-write head, IO-Link" },
  { id: "TURCK-TBEN-S", brand: "turck", name: "TBEN-S Compact I/O", fn: "fld", free: true, kind: "epbox", fw: 84, fh: 150, io: "do", ch: 8, w: 0, ebus: 0, ioconn: 4, ioLabel: "IO", m12io: true, iolMaster: true, desc: "Compact IP67 I/O + IO-Link master, M12" },
  { id: "TURCK-LI", brand: "turck", name: "Li Linear Position Sensor", fn: "fld", free: true, kind: "sensor", fw: 44, fh: 112, io: null, ch: 1, w: 0, ebus: 0, analogOut: true, desc: "Magnetostrictive linear position, analog" },
  // ifm
  { id: "IFM-O5", brand: "ifm", name: "O5 Photoelectric Sensor", fn: "fld", free: true, kind: "sensor", fw: 40, fh: 112, io: null, ch: 1, w: 0, ebus: 0, desc: "Photoelectric sensor, PNP + IO-Link, M12" },
  { id: "IFM-PT", brand: "ifm", name: "PT Pressure Transmitter", fn: "fld", free: true, kind: "sensor", fw: 40, fh: 96, io: null, ch: 1, w: 0, ebus: 0, analogOut: true, desc: "Pressure transmitter, 4-20 mA" },
  { id: "IFM-VVB", brand: "ifm", name: "VVB Vibration Sensor", fn: "fld", free: true, kind: "sensor", fw: 42, fh: 100, io: null, ch: 1, w: 0, ebus: 0, desc: "Vibration/condition monitoring, IO-Link" },
  { id: "IFM-DTE", brand: "ifm", name: "DTE RFID Reader", fn: "fld", free: true, kind: "iol", fw: 46, fh: 100, io: null, ch: 1, w: 0, ebus: 0, desc: "UHF RFID reader/antenna, IO-Link" },
  { id: "IFM-AL1332", brand: "ifm", name: "AL1332 IO-Link Master 4-Port", fn: "fld", free: true, kind: "epbox", fw: 84, fh: 150, io: null, ch: 4, w: 0, ebus: 0, ioconn: 4, ioLabel: "IO-L", m12io: true, iolMaster: true, desc: "IP67 EtherCAT IO-Link master, 4-port" },
  // Pilz
  { id: "PILZ-PNOZ-MULTI", brand: "pilz", name: "PNOZmulti Safety Relay", fn: "fld", free: true, kind: "box", fw: 60, fh: 108, io: null, ch: 0, w: 0, ebus: 0, safety: true, ioconn: 0, desc: "Configurable safety relay base unit" },
  { id: "PILZ-PSENSCAN", brand: "pilz", name: "PSENscan Safety Scanner", fn: "fld", free: true, kind: "scanner", fw: 96, fh: 110, io: null, ch: 0, w: 0, ebus: 0, safety: true, desc: "Safety laser scanner, OSSD, M12" },
  { id: "PILZ-PSEN-OPT", brand: "pilz", name: "PSENopt Light Curtain", fn: "fld", free: true, kind: "curtain", fw: 58, fh: 184, io: null, ch: 0, w: 0, ebus: 0, safety: true, desc: "Type 4 safety light curtain, OSSD" },
  // Schneider
  { id: "SCHNEIDER-LC1K", brand: "schneider", name: "TeSys K Contactor", fn: "fld", free: true, kind: "contactor", fw: 70, fh: 96, io: null, ch: 3, w: 0, ebus: 0, desc: "Miniature contactor, 24 V DC coil" },
  { id: "SCHNEIDER-XB5-ESTOP", brand: "schneider", name: "Harmony E-Stop", fn: "fld", free: true, kind: "estop", fw: 58, fh: 96, io: null, ch: 0, w: 0, ebus: 0, contacts: ["NC", "NC"], safety: true, desc: "22 mm emergency stop, 2 NC" },
  { id: "SCHNEIDER-XUB", brand: "schneider", name: "OsiSense XUB Photoelectric", fn: "fld", free: true, kind: "sensor", fw: 40, fh: 112, io: null, ch: 1, w: 0, ebus: 0, desc: "Photoelectric sensor, PNP, M12" },
  { id: "SCHNEIDER-XS", brand: "schneider", name: "OsiSense XS Inductive", fn: "fld", free: true, kind: "sensor", fw: 36, fh: 112, io: null, ch: 1, w: 0, ebus: 0, desc: "Inductive proximity sensor, PNP, M12" },
  { id: "SCHNEIDER-ABL", brand: "schneider", name: "Phaseo ABL PSU", fn: "psu", free: true, kind: "supplybox", fw: 58, fh: 150, io: null, ch: 0, w: 0, ebus: 0, psuV: 24, psuA: 10, desc: "Phaseo regulated power supply, 24 V DC" },
  // Kollmorgen / Omron
  { id: "KOLLMORGEN-AKD2G", brand: "kollmorgen", name: "AKD2G Dual-Axis Drive", fn: "drv", free: true, kind: "drive", fw: 92, fh: 210, io: null, ch: 2, w: 0, ebus: 0, motion: true, desc: "2-axis EtherCAT servo drive" },
  { id: "OMRON-E2E", brand: "omron", name: "E2E Inductive Sensor", fn: "fld", free: true, kind: "sensor", fw: 36, fh: 112, io: null, ch: 1, w: 0, ebus: 0, desc: "Inductive proximity sensor, PNP, M12" },
  { id: "OMRON-F3SG", brand: "omron", name: "F3SG Safety Curtain", fn: "fld", free: true, kind: "curtain", fw: 58, fh: 184, io: null, ch: 0, w: 0, ebus: 0, safety: true, desc: "Type 4 safety light curtain, OSSD" },
  { id: "OMRON-G2R", brand: "omron", name: "G2R Interface Relay", fn: "fld", free: true, kind: "relay", fw: 56, fh: 88, io: null, ch: 1, w: 0, ebus: 0, desc: "Plug-in relay + socket, 24 V DC coil" },
  { id: "OMRON-1SL", brand: "omron", name: "1S Servomotor", fn: "drv", free: true, kind: "motor", fw: 116, fh: 96, io: null, ch: 0, w: 0, ebus: 0, motion: true, desc: "Sysmac 1S servomotor, one-cable" },
  // AutomationDirect
  { id: "ADC-PROSENSE-PHOTO", brand: "adc", name: "ProSense Photoelectric", fn: "fld", free: true, kind: "sensor", fw: 40, fh: 112, io: null, ch: 1, w: 0, ebus: 0, desc: "Photoelectric sensor, PNP, M12" },
  { id: "ADC-PROSENSE-PRESS", brand: "adc", name: "ProSense Pressure Sensor", fn: "fld", free: true, kind: "sensor", fw: 40, fh: 96, io: null, ch: 1, w: 0, ebus: 0, analogOut: true, desc: "Pressure transmitter, 4-20 mA" },
  { id: "ADC-PROSENSE-FLOW", brand: "adc", name: "ProSense Flow Switch", fn: "fld", free: true, kind: "sensor", fw: 42, fh: 100, io: null, ch: 1, w: 0, ebus: 0, analogOut: true, desc: "Flow switch/transmitter, analog" },
  { id: "ADC-STRIDE-SW8", brand: "adc", name: "Stride 8-Port Switch", fn: "net", free: true, kind: "switch8", fw: 160, fh: 90, io: null, ch: 0, w: 0, ebus: 0, desc: "Unmanaged Ethernet switch, 8-port" },
  { id: "ADC-RHINO-UPS", brand: "adc", name: "RHINO DC-UPS", fn: "psu", free: true, kind: "supplybox", fw: 56, fh: 150, io: null, ch: 0, w: 0, ebus: 0, psuV: 24, psuA: 10, desc: "24 V DC UPS / buffer module" },
  { id: "ADC-SURESERVO2", brand: "adc", name: "SureServo2 Drive", fn: "drv", free: true, kind: "drive", fw: 92, fh: 200, io: null, ch: 1, w: 0, ebus: 0, motion: true, desc: "Servo drive w/ industrial network option" },
  { id: "ADC-TOWER", brand: "adc", name: "Signal Tower Light", fn: "fld", free: true, kind: "stack", fw: 62, fh: 150, io: null, ch: 3, w: 0, ebus: 0, lights: ["R", "Y", "G"], desc: "Modular signal tower, 24 V DC" },
  // Weidmüller
  { id: "WEIDMULLER-RELAY", brand: "weidmuller", name: "TERMSERIES Relay", fn: "distb", free: true, kind: "relay", fw: 46, fh: 88, io: null, ch: 1, w: 0, ebus: 0, desc: "Ultra-slim interface relay, 24 V DC" },
  { id: "WEIDMULLER-PROECO", brand: "weidmuller", name: "PROeco PSU", fn: "psu", free: true, kind: "supplybox", fw: 56, fh: 150, io: null, ch: 0, w: 0, ebus: 0, psuV: 24, psuA: 10, desc: "PROeco power supply", variants: [{ s: "0005", d: "24 V / 5 A" }, { s: "0010", d: "24 V / 10 A" }, { s: "0020", d: "24 V / 20 A" }] },
  { id: "WEIDMULLER-SURGE", brand: "weidmuller", name: "VARITECTOR Surge", fn: "distb", free: true, kind: "box", fw: 56, fh: 100, io: null, ch: 0, w: 0, ebus: 0, ioconn: 3, desc: "Surge protection device, power circuits" },
  // --- TwinSAFE (yellow) ---
  // twinsafe = FSoE bus node (safety telegrams ride the E-bus/EtherCAT, not
  // field wiring). tsLogic = TwinSAFE Logic-capable (an FSoE master that the
  // safe I/O talk to; a TwinCAT Safety PLC on an IPC also counts).
  { id: "EL1904", name: "4-Ch Safe Input",       fn: "saf", io: "di", ch: 4, w: 12, ebus: -200, safety: true, twinsafe: true, pinout: TS_IN4 },
  { id: "EL2904", name: "4-Ch Safe Output",      fn: "saf", io: "do", ch: 4, w: 24, ebus: -221, safety: true, twinsafe: true, upA: 2, pinout: [null, { r: "p24" }, { r: "gnd" }, null, null, { r: "p24" }, { r: "gnd" }, null, { r: "do", ch: 1 }, { r: "gnd", t: "Output 1−" }, { r: "do", ch: 3 }, { r: "gnd", t: "Output 3−" }, { r: "do", ch: 2 }, { r: "gnd", t: "Output 2−" }, { r: "do", ch: 4 }, { r: "gnd", t: "Output 4−" }] },
  { id: "EL6910", name: "TwinSAFE Logic",        fn: "saf", io: null, ch: 0, w: 12, ebus: -160, safety: true, twinsafe: true, tsLogic: true },
  // pinouts, widths and E-bus currents from the Beckhoff manuals (2026)
  { id: "EL1918", name: "8-Ch Safe Input + Logic", fn: "saf", io: "di", ch: 8, w: 12, hd: true, ebus: -165, safety: true, twinsafe: true, tsLogic: true, pinout: TS_IN8, desc: "8 fail-safe inputs with integrated TwinSAFE Logic — can be the FSoE master itself (no separate EL6910 needed)" },
  { id: "EL2911", name: "Safe Input + 10 A Safe Feed", fn: "saf", io: "mix", ch: 5, w: 24, ebus: -180, safety: true, twinsafe: true, tsLogic: true, pcFeed: true, tsFeed: true, pinout: [...TS_IN4.map((q) => q.r === "di" ? { ...q } : q), null, { r: "do", ch: 1, t: "Safe output 1 (also the + power contact)" }, { r: "up0", t: "GND Up (the − power contact)" }, { r: "up24", t: "24 V Up, supply of the safe output" }, null, { r: "link", to: 10, t: "Safe output 1" }, { r: "up0", t: "GND Up (the − power contact)" }, { r: "up24", t: "24 V Up, supply of the safe output" }], desc: "4 safe inputs and one 10 A safe output that drives the + power contact of the terminals after it; integrated TwinSAFE Logic" },
  { id: "EL2912", name: "2-Ch Safe Output 2 A",  fn: "saf", io: "do", ch: 2, w: 12, ebus: -200, safety: true, twinsafe: true, tsLogic: true, upA: 4, pinout: [{ r: "do", ch: 1 }, { r: "p24" }, { r: "gnd" }, { r: "do", ch: 2 }, { r: "gnd", t: "Output 1 GND" }, { r: "p24" }, { r: "gnd" }, { r: "gnd", t: "Output 2 GND" }], desc: "2 safe outputs up to 2 A from the power contacts, integrated TwinSAFE Logic" },
  { id: "EL6930", name: "TwinSAFE Logic + PROFIsafe", fn: "saf", io: null, ch: 0, w: 12, ebus: -188, safety: true, twinsafe: true, tsLogic: true },

  // ==========================================================================
  // Expanded control gear — contactors, motor protection, command & signaling,
  // control/monitoring/safety relays. Everything here is HARDWIRED (digital) or
  // EtherCAT; PROFINET / PROFIBUS bus devices (e.g. SIMOCODE pro, PROFINET
  // IO-Link masters) are deliberately excluded. Third-party specs are
  // representative; rating ranges are modelled with `variants`.
  // ==========================================================================

  // ---- Siemens SIRIUS / SENTRON ----
  { id: "SIEMENS-3RT2015", brand: "siemens", name: "SIRIUS 3RT2 Contactor S00", fn: "fld", free: true, kind: "contactor", fw: 74, fh: 100, io: null, ch: 3, w: 0, ebus: 0, desc: "3-pole contactor, size S00, 24 V DC coil", variants: [{ s: "07A", d: "3 kW / 7 A" }, { s: "09A", d: "4 kW / 9 A" }, { s: "12A", d: "5.5 kW / 12 A" }] },
  { id: "SIEMENS-3RT2025", brand: "siemens", name: "SIRIUS 3RT2 Contactor S0", fn: "fld", free: true, kind: "contactor", fw: 84, fh: 104, io: null, ch: 3, w: 0, ebus: 0, desc: "3-pole contactor, size S0, 24 V DC coil", variants: [{ s: "17A", d: "7.5 kW / 17 A" }, { s: "25A", d: "11 kW / 25 A" }, { s: "32A", d: "15 kW / 32 A" }] },
  { id: "SIEMENS-3RT2035", brand: "siemens", name: "SIRIUS 3RT2 Contactor S2", fn: "fld", free: true, kind: "contactor", fw: 92, fh: 116, io: null, ch: 3, w: 0, ebus: 0, desc: "3-pole contactor, size S2, 24 V DC coil", variants: [{ s: "40A", d: "18.5 kW / 40 A" }, { s: "50A", d: "22 kW / 50 A" }] },
  { id: "SIEMENS-3RT2045", brand: "siemens", name: "SIRIUS 3RT2 Contactor S3", fn: "fld", free: true, kind: "contactor", fw: 100, fh: 124, io: null, ch: 3, w: 0, ebus: 0, desc: "3-pole contactor, size S3, 24 V DC coil", variants: [{ s: "65A", d: "30 kW / 65 A" }, { s: "80A", d: "37 kW / 80 A" }, { s: "95A", d: "45 kW / 95 A" }] },
  { id: "SIEMENS-3RT1065", brand: "siemens", name: "SIRIUS 3RT1 Power Contactor S10", fn: "fld", free: true, kind: "contactor", fw: 116, fh: 140, io: null, ch: 3, w: 0, ebus: 0, desc: "3-pole power contactor, size S10/S12, 24 V DC coil", variants: [{ s: "150A", d: "75 kW / 150 A" }, { s: "225A", d: "110 kW / 225 A" }, { s: "300A", d: "160 kW / 300 A" }] },
  { id: "SIEMENS-3RH21", brand: "siemens", name: "SIRIUS 3RH2 Contactor Relay", fn: "fld", free: true, kind: "relay", fw: 62, fh: 96, io: null, ch: 1, w: 0, ebus: 0, desc: "Auxiliary contactor relay, 24 V DC coil", variants: [{ s: "40", d: "4 NO" }, { s: "31", d: "3 NO + 1 NC" }, { s: "22", d: "2 NO + 2 NC" }] },
  { id: "SIEMENS-3RA23", brand: "siemens", name: "SIRIUS 3RA2 Reversing Assembly", fn: "fld", free: true, kind: "contactor", fw: 96, fh: 112, io: null, ch: 3, w: 0, ebus: 0, desc: "Pre-wired reversing contactor assembly, 24 V DC" },
  { id: "SIEMENS-3RA24", brand: "siemens", name: "SIRIUS 3RA2 Wye-Delta Assembly", fn: "fld", free: true, kind: "contactor", fw: 120, fh: 112, io: null, ch: 3, w: 0, ebus: 0, desc: "Pre-wired star-delta starter assembly, 24 V DC" },
  { id: "SIEMENS-3RA6", brand: "siemens", name: "SIRIUS 3RA6 Compact Starter", fn: "fld", free: true, kind: "contactor", fw: 46, fh: 116, io: null, ch: 3, w: 0, ebus: 0, desc: "Compact load feeder (contactor + overload), 24 V DC control", variants: [{ s: "08", d: "0.1-3 A" }, { s: "12", d: "3-12 A" }, { s: "32", d: "8-32 A" }] },
  { id: "SIEMENS-3RF2", brand: "siemens", name: "SIRIUS 3RF2 Solid-State Contactor", fn: "fld", free: true, kind: "contactor", fw: 48, fh: 116, io: null, ch: 3, w: 0, ebus: 0, desc: "Semiconductor contactor, 3-phase, 24 V DC control", variants: [{ s: "20", d: "20 A" }, { s: "30", d: "30 A" }, { s: "50", d: "50 A" }] },
  { id: "SIEMENS-3RF34", brand: "siemens", name: "SIRIUS 3RF34 Solid-State Relay", fn: "fld", free: true, kind: "relay", fw: 46, fh: 100, io: null, ch: 1, w: 0, ebus: 0, desc: "Single-phase solid-state relay, DC/AC control" },
  { id: "SIEMENS-3RW30", brand: "siemens", name: "SIRIUS 3RW30 Soft Starter", fn: "fld", free: true, kind: "contactor", fw: 48, fh: 116, io: null, ch: 3, w: 0, ebus: 0, desc: "Compact soft starter, 24 V DC control", variants: [{ s: "09A", d: "4 kW / 9 A" }, { s: "25A", d: "11 kW / 25 A" }, { s: "38A", d: "18.5 kW / 38 A" }] },
  { id: "SIEMENS-3RW44", brand: "siemens", name: "SIRIUS 3RW44 Soft Starter", fn: "fld", free: true, kind: "contactor", fw: 120, fh: 150, io: null, ch: 3, w: 0, ebus: 0, desc: "High-feature soft starter, inside-delta, 24 V DC control" },
  { id: "SIEMENS-3RU21", brand: "siemens", name: "SIRIUS 3RU2 Thermal Overload", fn: "fld", free: true, kind: "box", fw: 46, fh: 96, io: null, ch: 0, w: 0, ebus: 0, ioconn: 2, desc: "Thermal overload relay (mounts under 3RT2), 95/96 NC + 97/98 NO", variants: [{ s: "04", d: "0.1-0.4 A" }, { s: "08", d: "5.5-8 A" }, { s: "25", d: "20-25 A" }, { s: "40", d: "32-40 A" }] },
  { id: "SIEMENS-3RB30", brand: "siemens", name: "SIRIUS 3RB3 Electronic Overload", fn: "fld", free: true, kind: "box", fw: 46, fh: 96, io: null, ch: 0, w: 0, ebus: 0, ioconn: 2, desc: "Solid-state overload relay, wide setting range, aux contacts" },
  { id: "SIEMENS-3RV2011", brand: "siemens", name: "SIRIUS 3RV2 Motor Protector S00", fn: "distb", free: true, kind: "breaker", fw: 46, fh: 108, io: null, ch: 3, w: 0, ebus: 0, poles: 3, desc: "Motor-protective circuit breaker, size S00", variants: [{ s: "04", d: "2.8-4 A" }, { s: "10", d: "7-10 A" }, { s: "16", d: "11-16 A" }] },
  { id: "SIEMENS-3RV2031", brand: "siemens", name: "SIRIUS 3RV2 Motor Protector S2", fn: "distb", free: true, kind: "breaker", fw: 56, fh: 116, io: null, ch: 3, w: 0, ebus: 0, poles: 3, desc: "Motor-protective circuit breaker, size S2", variants: [{ s: "32", d: "22-32 A" }, { s: "40", d: "30-40 A" }, { s: "50", d: "38-50 A" }] },
  { id: "SIEMENS-5SL6", brand: "siemens", name: "SENTRON 5SL Miniature CB", fn: "distb", free: true, kind: "breaker", fw: 40, fh: 108, io: null, ch: 1, w: 0, ebus: 0, poles: 1, desc: "Miniature circuit breaker, C-curve, 6 kA", variants: [{ s: "1", d: "1-pole" }, { s: "2", d: "2-pole" }, { s: "3", d: "3-pole" }] },
  { id: "SIEMENS-5SY6", brand: "siemens", name: "SENTRON 5SY Miniature CB", fn: "distb", free: true, kind: "breaker", fw: 40, fh: 108, io: null, ch: 1, w: 0, ebus: 0, poles: 1, desc: "Miniature circuit breaker, B/C/D-curve, 10 kA" },
  { id: "SIEMENS-3KD", brand: "siemens", name: "SENTRON 3KD Switch Disconnector", fn: "distb", free: true, kind: "disconnect", fw: 84, fh: 116, io: null, ch: 3, w: 0, ebus: 0, desc: "Load-break switch disconnector, 3-pole" },
  { id: "SIEMENS-3NP", brand: "siemens", name: "SENTRON 3NP Fuse Switch Disc.", fn: "distb", free: true, kind: "disconnect", fw: 92, fh: 120, io: null, ch: 3, w: 0, ebus: 0, desc: "Fused switch-disconnector, 3-pole" },
  { id: "SIEMENS-3RP25", brand: "siemens", name: "SIRIUS 3RP2 Timing Relay", fn: "fld", free: true, kind: "relay", fw: 44, fh: 96, io: null, ch: 1, w: 0, ebus: 0, desc: "Multifunction timing relay, 24 V DC/AC" },
  { id: "SIEMENS-3RQ3", brand: "siemens", name: "SIRIUS 3RQ3 Output Coupler", fn: "fld", free: true, kind: "relay", fw: 44, fh: 96, io: null, ch: 1, w: 0, ebus: 0, desc: "Output coupling relay, 24 V DC input" },
  { id: "SIEMENS-3UG4", brand: "siemens", name: "SIRIUS 3UG4 Line Monitor", fn: "fld", free: true, kind: "box", fw: 44, fh: 96, io: null, ch: 0, w: 0, ebus: 0, ioconn: 2, desc: "3-phase line monitoring relay (phase sequence/failure)" },
  { id: "SIEMENS-3UG5", brand: "siemens", name: "SIRIUS 3UG5 Voltage/Current Monitor", fn: "fld", free: true, kind: "box", fw: 44, fh: 96, io: null, ch: 0, w: 0, ebus: 0, ioconn: 2, desc: "Voltage / current monitoring relay" },
  { id: "SIEMENS-3RR2", brand: "siemens", name: "SIRIUS 3RR2 Current Monitor", fn: "fld", free: true, kind: "box", fw: 46, fh: 96, io: null, ch: 0, w: 0, ebus: 0, ioconn: 2, desc: "Current monitoring relay (mounts on 3RT2)" },
  { id: "SIEMENS-3RN2", brand: "siemens", name: "SIRIUS 3RN2 Thermistor Relay", fn: "fld", free: true, kind: "box", fw: 44, fh: 96, io: null, ch: 0, w: 0, ebus: 0, ioconn: 2, desc: "Thermistor motor protection relay (PTC)" },
  { id: "SIEMENS-3SK1", brand: "siemens", name: "SIRIUS 3SK1 Safety Relay", fn: "fld", free: true, kind: "box", fw: 44, fh: 108, io: null, ch: 0, w: 0, ebus: 0, safety: true, ioconn: 2, desc: "Compact safety relay, E-stop/guard monitoring, hardwired" },
  { id: "SIEMENS-3SK2", brand: "siemens", name: "SIRIUS 3SK2 Safety Relay", fn: "fld", free: true, kind: "box", fw: 46, fh: 108, io: null, ch: 0, w: 0, ebus: 0, safety: true, ioconn: 2, desc: "Configurable safety relay (free logic), hardwired I/O" },
  { id: "SIEMENS-3SB3-BTN", brand: "siemens", name: "SIRIUS 3SB3 Metal Button", fn: "fld", free: true, kind: "btn", fw: 54, fh: 92, io: null, ch: 0, w: 0, ebus: 0, contacts: ["NO", "NC"], desc: "22 mm metal pushbutton + contact blocks" },
  { id: "SIEMENS-3SU1-SEL", brand: "siemens", name: "SIRIUS 3SU Selector Switch", fn: "fld", free: true, kind: "btn", fw: 54, fh: 92, io: null, ch: 0, w: 0, ebus: 0, contacts: ["NO", "NO"], sel: true, desc: "22 mm selector switch, 2/3-position" },
  { id: "SIEMENS-3SU1-KEY", brand: "siemens", name: "SIRIUS 3SU Key Switch", fn: "fld", free: true, kind: "btn", fw: 54, fh: 92, io: null, ch: 0, w: 0, ebus: 0, contacts: ["NO", "NO"], sel: true, desc: "22 mm key-operated switch" },
  { id: "SIEMENS-3SU1-ILLBTN", brand: "siemens", name: "SIRIUS 3SU Illuminated Button", fn: "fld", free: true, kind: "btn", fw: 54, fh: 92, io: null, ch: 0, w: 0, ebus: 0, contacts: ["NO", "NC"], illum: true, desc: "22 mm illuminated pushbutton, 24 V LED" },
  { id: "SIEMENS-3SU1-TWIN", brand: "siemens", name: "SIRIUS 3SU Twin Button", fn: "fld", free: true, kind: "btn", fw: 54, fh: 92, io: null, ch: 0, w: 0, ebus: 0, contacts: ["NO", "NC"], desc: "22 mm double pushbutton (I/O)" },
  { id: "SIEMENS-8WD44", brand: "siemens", name: "SIRIUS 8WD4 Signal Column", fn: "fld", free: true, kind: "stack", fw: 62, fh: 150, io: null, ch: 3, w: 0, ebus: 0, lights: ["R", "Y", "G"], desc: "Modular signaling column, 24 V DC" },
  { id: "SIEMENS-3SE5-ROLLER", brand: "siemens", name: "SIRIUS 3SE5 Roller Position Switch", fn: "fld", free: true, kind: "limit", fw: 52, fh: 96, io: null, ch: 0, w: 0, ebus: 0, desc: "Roller-lever mechanical position switch" },
  { id: "SIEMENS-3SE5-HINGE", brand: "siemens", name: "SIRIUS 3SE5 Hinge Safety Switch", fn: "fld", free: true, kind: "limit", fw: 52, fh: 96, io: null, ch: 0, w: 0, ebus: 0, safety: true, desc: "Hinge safety position switch for guard doors" },

  // ---- Eaton (Moeller XT / DIL / PKZ / M22) ----
  { id: "EATON-DILM-STD", brand: "eaton", name: "XT/DILM Contactor", fn: "fld", free: true, kind: "contactor", fw: 84, fh: 104, io: null, ch: 3, w: 0, ebus: 0, desc: "IEC motor contactor, 24 V DC coil", variants: [{ s: "7", d: "3 kW / 7 A" }, { s: "12", d: "5.5 kW / 12 A" }, { s: "25", d: "11 kW / 25 A" }, { s: "38", d: "18.5 kW / 38 A" }] },
  { id: "EATON-DILM-BIG", brand: "eaton", name: "XT/DILM Power Contactor", fn: "fld", free: true, kind: "contactor", fw: 104, fh: 128, io: null, ch: 3, w: 0, ebus: 0, desc: "Larger IEC contactor, 24 V DC coil", variants: [{ s: "65", d: "30 kW / 65 A" }, { s: "95", d: "45 kW / 95 A" }, { s: "150", d: "75 kW / 150 A" }] },
  { id: "EATON-DILER", brand: "eaton", name: "DILER Control Relay", fn: "fld", free: true, kind: "relay", fw: 46, fh: 88, io: null, ch: 1, w: 0, ebus: 0, desc: "Miniature control relay, 24 V DC coil, aux contacts" },
  { id: "EATON-ZB-OL", brand: "eaton", name: "ZB Thermal Overload", fn: "fld", free: true, kind: "box", fw: 46, fh: 92, io: null, ch: 0, w: 0, ebus: 0, ioconn: 2, desc: "Thermal overload relay for XT/DILM, aux 95-96/97-98", variants: [{ s: "1", d: "0.1-1 A" }, { s: "12", d: "8-12 A" }, { s: "40", d: "24-40 A" }] },
  { id: "EATON-XTOB", brand: "eaton", name: "XTOB Electronic Overload", fn: "fld", free: true, kind: "box", fw: 46, fh: 92, io: null, ch: 0, w: 0, ebus: 0, ioconn: 2, desc: "Solid-state overload relay, wide range" },
  { id: "EATON-PKE", brand: "eaton", name: "PKE Electronic Motor Protector", fn: "distb", free: true, kind: "breaker", fw: 54, fh: 112, io: null, ch: 3, w: 0, ebus: 0, poles: 3, desc: "Electronic motor-protective breaker, adjustable" },
  { id: "EATON-NZM", brand: "eaton", name: "NZM Molded-Case Breaker", fn: "distb", free: true, kind: "breaker", fw: 70, fh: 120, io: null, ch: 3, w: 0, ebus: 0, poles: 3, desc: "Molded-case circuit breaker", variants: [{ s: "1", d: "≤160 A" }, { s: "2", d: "≤300 A" }, { s: "3", d: "≤630 A" }] },
  { id: "EATON-FAZ-B", brand: "eaton", name: "FAZ Miniature CB", fn: "distb", free: true, kind: "breaker", fw: 40, fh: 108, io: null, ch: 1, w: 0, ebus: 0, poles: 1, desc: "Miniature circuit breaker, B/C/D-curve", variants: [{ s: "1", d: "1-pole" }, { s: "2", d: "2-pole" }, { s: "3", d: "3-pole" }] },
  { id: "EATON-T0-DISC", brand: "eaton", name: "T0 Rotary Disconnect", fn: "distb", free: true, kind: "disconnect", fw: 84, fh: 108, io: null, ch: 3, w: 0, ebus: 0, desc: "On-off rotary switch disconnector, 3-pole" },
  { id: "EATON-M22-KEY", brand: "eaton", name: "M22 Key Switch", fn: "fld", free: true, kind: "btn", fw: 54, fh: 92, io: null, ch: 0, w: 0, ebus: 0, contacts: ["NO", "NO"], sel: true, desc: "22 mm key-operated selector" },
  { id: "EATON-M22-TWIN", brand: "eaton", name: "M22 Twin Button", fn: "fld", free: true, kind: "btn", fw: 54, fh: 92, io: null, ch: 0, w: 0, ebus: 0, contacts: ["NO", "NC"], desc: "22 mm double pushbutton (I/O)" },
  { id: "EATON-SL7", brand: "eaton", name: "SL7 Signal Tower", fn: "fld", free: true, kind: "stack", fw: 62, fh: 150, io: null, ch: 3, w: 0, ebus: 0, lights: ["R", "Y", "G"], desc: "Modular signal tower, 24 V DC" },
  { id: "EATON-ESR5", brand: "eaton", name: "ESR5 Safety Relay", fn: "fld", free: true, kind: "box", fw: 46, fh: 108, io: null, ch: 0, w: 0, ebus: 0, safety: true, ioconn: 2, desc: "Safety relay for E-stop / guard monitoring, hardwired" },
  { id: "EATON-LS-TITAN", brand: "eaton", name: "LS-Titan Position Switch", fn: "fld", free: true, kind: "limit", fw: 52, fh: 96, io: null, ch: 0, w: 0, ebus: 0, desc: "Mechanical position/limit switch" },

  // ---- Schneider Electric (TeSys / Harmony / Acti9 / Preventa) ----
  { id: "SCHNEIDER-LC1F", brand: "schneider", name: "TeSys F Power Contactor", fn: "fld", free: true, kind: "contactor", fw: 104, fh: 128, io: null, ch: 3, w: 0, ebus: 0, desc: "TeSys LC1F power contactor, 24 V DC coil", variants: [{ s: "115", d: "55 kW / 115 A" }, { s: "150", d: "75 kW / 150 A" }, { s: "225", d: "110 kW / 225 A" }] },
  { id: "SCHNEIDER-LRD", brand: "schneider", name: "TeSys LRD Thermal Overload", fn: "fld", free: true, kind: "box", fw: 46, fh: 92, io: null, ch: 0, w: 0, ebus: 0, ioconn: 2, desc: "Thermal overload relay for TeSys D", variants: [{ s: "07", d: "1.6-2.5 A" }, { s: "16", d: "9-13 A" }, { s: "32", d: "23-32 A" }] },
  { id: "SCHNEIDER-LR9", brand: "schneider", name: "TeSys LR9 Electronic Overload", fn: "fld", free: true, kind: "box", fw: 46, fh: 92, io: null, ch: 0, w: 0, ebus: 0, ioconn: 2, desc: "Electronic overload relay, wide range" },
  { id: "SCHNEIDER-GV3", brand: "schneider", name: "TeSys GV3 Motor Breaker", fn: "distb", free: true, kind: "breaker", fw: 66, fh: 116, io: null, ch: 3, w: 0, ebus: 0, poles: 3, desc: "Motor-protective circuit breaker, ≤65 A" },
  { id: "SCHNEIDER-NSX", brand: "schneider", name: "ComPact NSX Breaker", fn: "distb", free: true, kind: "breaker", fw: 70, fh: 120, io: null, ch: 3, w: 0, ebus: 0, poles: 3, desc: "Molded-case circuit breaker", variants: [{ s: "100", d: "≤100 A" }, { s: "250", d: "≤250 A" }, { s: "630", d: "≤630 A" }] },
  { id: "SCHNEIDER-C60", brand: "schneider", name: "Acti9 iC60 Miniature CB", fn: "distb", free: true, kind: "breaker", fw: 40, fh: 108, io: null, ch: 1, w: 0, ebus: 0, poles: 1, desc: "Miniature circuit breaker, B/C/D-curve", variants: [{ s: "1", d: "1-pole" }, { s: "2", d: "2-pole" }, { s: "3", d: "3-pole" }, { s: "4", d: "4-pole" }] },
  { id: "SCHNEIDER-LADN", brand: "schneider", name: "TeSys LADN Aux Contact", fn: "fld", free: true, kind: "relay", fw: 46, fh: 88, io: null, ch: 1, w: 0, ebus: 0, desc: "Auxiliary contact block / control relay, 24 V DC" },
  { id: "SCHNEIDER-RXM", brand: "schneider", name: "Harmony RXM Interface Relay", fn: "fld", free: true, kind: "relay", fw: 44, fh: 88, io: null, ch: 1, w: 0, ebus: 0, desc: "Plug-in interface relay, 24 V DC coil" },
  { id: "SCHNEIDER-RE", brand: "schneider", name: "Zelio RE Timing Relay", fn: "fld", free: true, kind: "relay", fw: 44, fh: 96, io: null, ch: 1, w: 0, ebus: 0, desc: "Multifunction timing relay, 24 V DC/AC" },
  { id: "SCHNEIDER-XB4", brand: "schneider", name: "Harmony XB4 Metal Button", fn: "fld", free: true, kind: "btn", fw: 54, fh: 92, io: null, ch: 0, w: 0, ebus: 0, contacts: ["NO", "NC"], desc: "22 mm metal pushbutton + contact blocks" },
  { id: "SCHNEIDER-XB5-SEL", brand: "schneider", name: "Harmony Selector Switch", fn: "fld", free: true, kind: "btn", fw: 54, fh: 92, io: null, ch: 0, w: 0, ebus: 0, contacts: ["NO", "NO"], sel: true, desc: "22 mm selector switch, 2/3-position" },
  { id: "SCHNEIDER-XB5-PILOT", brand: "schneider", name: "Harmony Pilot Light", fn: "fld", free: true, kind: "btn", fw: 54, fh: 80, io: null, ch: 0, w: 0, ebus: 0, contacts: [], illum: true, desc: "22 mm LED indicator, 24 V" },
  { id: "SCHNEIDER-XVR", brand: "schneider", name: "Harmony XVR Beacon", fn: "fld", free: true, kind: "stack", fw: 62, fh: 150, io: null, ch: 3, w: 0, ebus: 0, lights: ["R", "Y", "G"], desc: "Modular tower light, 24 V DC" },
  { id: "SCHNEIDER-XPS", brand: "schneider", name: "Preventa XPS Safety Relay", fn: "fld", free: true, kind: "box", fw: 46, fh: 108, io: null, ch: 0, w: 0, ebus: 0, safety: true, ioconn: 2, desc: "Safety relay for E-stop / guard, hardwired" },
  { id: "SCHNEIDER-XCK", brand: "schneider", name: "OsiSense XCK Limit Switch", fn: "fld", free: true, kind: "limit", fw: 52, fh: 96, io: null, ch: 0, w: 0, ebus: 0, desc: "Mechanical position/limit switch" },
  { id: "SCHNEIDER-ATS", brand: "schneider", name: "Altistart ATS Soft Starter", fn: "fld", free: true, kind: "contactor", fw: 70, fh: 140, io: null, ch: 3, w: 0, ebus: 0, desc: "Soft starter for 3-phase motors, 24 V control" },

  // ---- Omron ----
  { id: "OMRON-J7KN", brand: "omron", name: "J7KN Contactor", fn: "fld", free: true, kind: "contactor", fw: 74, fh: 100, io: null, ch: 3, w: 0, ebus: 0, desc: "IEC mini/standard contactor, 24 V DC coil", variants: [{ s: "10", d: "4 kW / 10 A" }, { s: "24", d: "11 kW / 24 A" }, { s: "50", d: "22 kW / 50 A" }] },
  { id: "OMRON-J7TKN", brand: "omron", name: "J7TKN Thermal Overload", fn: "fld", free: true, kind: "box", fw: 46, fh: 92, io: null, ch: 0, w: 0, ebus: 0, ioconn: 2, desc: "Thermal overload relay for J7KN" },
  { id: "OMRON-MY", brand: "omron", name: "MY Miniature Relay", fn: "fld", free: true, kind: "relay", fw: 44, fh: 84, io: null, ch: 1, w: 0, ebus: 0, desc: "Plug-in miniature power relay, 24 V DC" },
  { id: "OMRON-LY", brand: "omron", name: "LY Power Relay", fn: "fld", free: true, kind: "relay", fw: 46, fh: 88, io: null, ch: 1, w: 0, ebus: 0, desc: "Plug-in bi-power relay, 24 V DC" },
  { id: "OMRON-H3", brand: "omron", name: "H3 Timing Relay", fn: "fld", free: true, kind: "relay", fw: 44, fh: 96, io: null, ch: 1, w: 0, ebus: 0, desc: "Solid-state timer, 24 V DC/AC" },
  { id: "OMRON-A22-BTN", brand: "omron", name: "A22 Push Button", fn: "fld", free: true, kind: "btn", fw: 54, fh: 92, io: null, ch: 0, w: 0, ebus: 0, contacts: ["NO", "NC"], desc: "22 mm pushbutton + contact blocks" },
  { id: "OMRON-A22E-ESTOP", brand: "omron", name: "A22E Emergency Stop", fn: "fld", free: true, kind: "estop", fw: 58, fh: 96, io: null, ch: 0, w: 0, ebus: 0, contacts: ["NC", "NC"], safety: true, desc: "22 mm twist-release E-stop, 2 NC" },
  { id: "OMRON-A165-SEL", brand: "omron", name: "A165 Selector Switch", fn: "fld", free: true, kind: "btn", fw: 54, fh: 92, io: null, ch: 0, w: 0, ebus: 0, contacts: ["NO", "NO"], sel: true, desc: "16/22 mm selector switch" },
  { id: "OMRON-M2S-PILOT", brand: "omron", name: "M2S Pilot Light", fn: "fld", free: true, kind: "btn", fw: 54, fh: 80, io: null, ch: 0, w: 0, ebus: 0, contacts: [], illum: true, desc: "22 mm LED indicator, 24 V" },
  { id: "OMRON-G9SE", brand: "omron", name: "G9SE Safety Relay", fn: "fld", free: true, kind: "box", fw: 44, fh: 108, io: null, ch: 0, w: 0, ebus: 0, safety: true, ioconn: 2, desc: "Compact safety relay unit, hardwired" },
  { id: "OMRON-D4N", brand: "omron", name: "D4N Limit Switch", fn: "fld", free: true, kind: "limit", fw: 52, fh: 96, io: null, ch: 0, w: 0, ebus: 0, desc: "Mechanical safety limit switch" },
  { id: "OMRON-K8", brand: "omron", name: "K8 Monitoring Relay", fn: "fld", free: true, kind: "box", fw: 44, fh: 96, io: null, ch: 0, w: 0, ebus: 0, ioconn: 2, desc: "Voltage / phase / temperature monitoring relay" },

  // ---- Phoenix Contact ----
  { id: "PHOENIX-RIF", brand: "phoenix", name: "RIF Interface Relay", fn: "fld", free: true, kind: "relay", fw: 44, fh: 88, io: null, ch: 1, w: 0, ebus: 0, desc: "Plug-in interface relay, 24 V DC" },
  { id: "PHOENIX-PLC-RPT", brand: "phoenix", name: "PLC-RPT Relay Module", fn: "fld", free: true, kind: "relay", fw: 22, fh: 88, io: null, ch: 1, w: 0, ebus: 0, desc: "6.2 mm relay module, 24 V DC" },
  { id: "PHOENIX-EMD", brand: "phoenix", name: "EMD Monitoring Relay", fn: "fld", free: true, kind: "box", fw: 44, fh: 96, io: null, ch: 0, w: 0, ebus: 0, ioconn: 2, desc: "Voltage / current monitoring relay" },
  { id: "PHOENIX-CB-TM1", brand: "phoenix", name: "CB TM1 Thermal CB", fn: "distb", free: true, kind: "breaker", fw: 40, fh: 100, io: null, ch: 1, w: 0, ebus: 0, poles: 1, desc: "Thermal device circuit breaker, single-pole" },
  { id: "PHOENIX-ELR", brand: "phoenix", name: "ELR Hybrid Motor Starter", fn: "fld", free: true, kind: "contactor", fw: 40, fh: 104, io: null, ch: 3, w: 0, ebus: 0, desc: "Hybrid motor starter (solid-state + relay), 24 V control" },
  { id: "PHOENIX-PSRMINI", brand: "phoenix", name: "PSRmini Safety Relay", fn: "fld", free: true, kind: "box", fw: 22, fh: 108, io: null, ch: 0, w: 0, ebus: 0, safety: true, ioconn: 2, desc: "Narrow safety relay, E-stop/guard, hardwired" },

  // ---- WAGO ----
  { id: "WAGO-857-RELAY", brand: "wago", name: "857 Relay Module", fn: "fld", free: true, kind: "relay", fw: 22, fh: 88, io: null, ch: 1, w: 0, ebus: 0, desc: "Pluggable relay/optocoupler module, 24 V DC" },
  { id: "WAGO-787-CB", brand: "wago", name: "787 Electronic CB", fn: "distb", free: true, kind: "breaker", fw: 22, fh: 100, io: null, ch: 1, w: 0, ebus: 0, poles: 1, desc: "Electronic circuit breaker, 24 V DC branch protection" },
  { id: "WAGO-857-TIMER", brand: "wago", name: "857 Timer Relay", fn: "fld", free: true, kind: "relay", fw: 22, fh: 88, io: null, ch: 1, w: 0, ebus: 0, desc: "Timing relay module, 24 V DC" },

  // ---- Weidmüller ----
  { id: "WEIDMULLER-RCL", brand: "weidmuller", name: "RCL Interface Relay", fn: "fld", free: true, kind: "relay", fw: 22, fh: 88, io: null, ch: 1, w: 0, ebus: 0, desc: "TERMSERIES relay module, 24 V DC" },
  { id: "WEIDMULLER-TRP", brand: "weidmuller", name: "TRP Timing Relay", fn: "fld", free: true, kind: "relay", fw: 44, fh: 96, io: null, ch: 1, w: 0, ebus: 0, desc: "Multifunction timing relay, 24 V DC/AC" },
  { id: "WEIDMULLER-AMG", brand: "weidmuller", name: "AMG Safety Relay", fn: "fld", free: true, kind: "box", fw: 44, fh: 108, io: null, ch: 0, w: 0, ebus: 0, safety: true, ioconn: 2, desc: "Safety relay for E-stop / guard, hardwired" },
  { id: "WEIDMULLER-EGW", brand: "weidmuller", name: "EG Monitoring Relay", fn: "fld", free: true, kind: "box", fw: 44, fh: 96, io: null, ch: 0, w: 0, ebus: 0, ioconn: 2, desc: "Voltage / current monitoring relay" },

  // ---- AutomationDirect ----
  { id: "ADC-FUJI-SC", brand: "adc", name: "Fuji SC Contactor", fn: "fld", free: true, kind: "contactor", fw: 74, fh: 100, io: null, ch: 3, w: 0, ebus: 0, desc: "Fuji SC-E IEC contactor, 24 V DC coil", variants: [{ s: "09", d: "4 kW / 9 A" }, { s: "18", d: "7.5 kW / 18 A" }, { s: "32", d: "15 kW / 32 A" }] },
  { id: "ADC-FUJI-TR", brand: "adc", name: "Fuji TR Thermal Overload", fn: "fld", free: true, kind: "box", fw: 46, fh: 92, io: null, ch: 0, w: 0, ebus: 0, ioconn: 2, desc: "Thermal overload relay for SC contactors" },
  { id: "ADC-BUTTON", brand: "adc", name: "22 mm Push Button", fn: "fld", free: true, kind: "btn", fw: 54, fh: 92, io: null, ch: 0, w: 0, ebus: 0, contacts: ["NO", "NC"], desc: "22 mm pushbutton + contact blocks" },
  { id: "ADC-SELECTOR", brand: "adc", name: "22 mm Selector Switch", fn: "fld", free: true, kind: "btn", fw: 54, fh: 92, io: null, ch: 0, w: 0, ebus: 0, contacts: ["NO", "NO"], sel: true, desc: "22 mm selector switch" },
  { id: "ADC-PILOT", brand: "adc", name: "22 mm Pilot Light", fn: "fld", free: true, kind: "btn", fw: 54, fh: 80, io: null, ch: 0, w: 0, ebus: 0, contacts: [], illum: true, desc: "22 mm LED indicator, 24 V" },
  { id: "ADC-ESTOP", brand: "adc", name: "22 mm Emergency Stop", fn: "fld", free: true, kind: "estop", fw: 58, fh: 96, io: null, ch: 0, w: 0, ebus: 0, contacts: ["NC", "NC"], safety: true, desc: "22 mm twist-release E-stop, 2 NC" },
  { id: "ADC-RELAY", brand: "adc", name: "ProSense Relay Module", fn: "fld", free: true, kind: "relay", fw: 44, fh: 88, io: null, ch: 1, w: 0, ebus: 0, desc: "Plug-in interface relay, 24 V DC" },
  { id: "ADC-MCB", brand: "adc", name: "Miniature Circuit Breaker", fn: "distb", free: true, kind: "breaker", fw: 40, fh: 108, io: null, ch: 1, w: 0, ebus: 0, poles: 1, desc: "DIN-rail miniature circuit breaker", variants: [{ s: "1", d: "1-pole" }, { s: "2", d: "2-pole" }, { s: "3", d: "3-pole" }] },
  { id: "ADC-DISC", brand: "adc", name: "Rotary Disconnect Switch", fn: "distb", free: true, kind: "disconnect", fw: 84, fh: 108, io: null, ch: 3, w: 0, ebus: 0, desc: "Load-break rotary disconnect, 3-pole" },

  // ---- Murr Elektronik ----
  { id: "MURR-RELAY", brand: "murr", name: "MIRO Relay Module", fn: "fld", free: true, kind: "relay", fw: 22, fh: 88, io: null, ch: 1, w: 0, ebus: 0, desc: "Narrow interface relay module, 24 V DC" },
  { id: "MURR-MIRO-SAFE", brand: "murr", name: "MIRO SAFE+ Safety Relay", fn: "fld", free: true, kind: "box", fw: 44, fh: 108, io: null, ch: 0, w: 0, ebus: 0, safety: true, ioconn: 2, desc: "Safety relay for E-stop / guard, hardwired" },

  // bulk expansion (power sources, KL / WAGO 750 terminals, deeper vendor lines)
  ...MORE,
  ...EXTRA,
  // EtherCAT Technology Group product directory (generated — see scripts/gen-etg.py)
  ...ETG,
];
// the last missed parts (new faces / feeds), built from the base parts above
CATALOG.push(...moreFaces(Object.fromEntries(CATALOG.map((d) => [d.id, d]))));
CATALOG.push(...ELXM); // ELX (Ex i) and ELM (metal housing) families
// clamp assignments from the Infosys pass, for parts without a hand-checked
// pinout; HD_FIX parts are 16-point housings the catalog had drawn with 8
CATALOG.forEach((d) => {
  const p = PINOUTS[d.id];
  if (!p || d.pinout || d.pins) return;
  if (HD_FIX.includes(d.id)) d.hd = true;
  d.pinout = p;
  const note = "clamps from Infosys (connection table)";
  d.desc = d.desc ? d.desc.replace("Pinout not yet verified", note) : note;
  if (!/Infosys/.test(d.desc)) d.desc += `; ${note}`;
});

// ED push-in parts with no Infosys manual yet: borrow the clamp table of
// the EL counterpart (or an ED sibling) where the clamp count matches.
// Flagged in desc; the ED layout is assumed to follow the reference.
const bridge = (two) => {
  const n = (i) => ({ t: "n.c. · not connected" });
  const ch = (c, s) => [
    { r: "ai", ch: c, t: `Ch${c} UBridge${s} · input bridge voltage${s}` },
    { t: `Ch${c} USense${s} · input reference voltage${s}` },
    { t: `Ch${c} UExc${s} · output sensor power supply${s}` },
  ];
  const side = (s) => {
    const c1 = ch(1, s); if (s === "−") delete c1[0].r, delete c1[0].ch;
    const c2 = two ? ch(2, s).reverse() : [n(), n(), n()];
    if (two && s === "−") { delete c2[2].r; delete c2[2].ch; }
    return [n(), ...c1, ...c2, n()];
  };
  return [...side("+"), ...side("−")];
};
const ED_REF = {
  ED1808: "EL1808", ED2032: "EL2032", ED2034: "EL2034", ED2808: "EL2808",
  ED2838: "EL2838", ED3174: "EL3174",
  ED3361: ["ED3361-0100", bridge(false)], ED3362: ["ED3362-0100", bridge(true)],
  ED3172: ["EL3172", "x2"], ED5002: ["EL5002", "x2"],
  // no own table: the nearest sibling with the same housing and channel count
  "EL7041-0052": "EL7041", EL4172: "EL4072", ED4172: "ED4072", ED4174: "ED4074", "ED8601-8411": "EL8601-8411",
};
// 8 EL clamps → 16 ED clamps: each clamp twice, columns kept (EL 1-4 → ED
// 1-8, EL 5-8 → ED 9-16); the second of each pair carries no role
const x2 = (pins) => pins.flatMap((q) => [{ ...q }, { t: `${q.t || "clamp"} (2nd clamp)` }]);
{
  const byId = Object.fromEntries(CATALOG.map((d) => [d.id, d]));
  const npts = (d) => (d.blk === "hd2x16" || d.blk === "ed2x16" ? 32 : d.hd || d.blk === "el2x8" ? 16 : 8);
  Object.entries(ED_REF).forEach(([id, ref]) => {
    const d = byId[id];
    if (!d || d.pinout || d.pins) return;
    let [src, pins] = Array.isArray(ref) ? ref : [ref, byId[ref]?.pinout];
    const dbl = pins === "x2";
    if (dbl) pins = byId[src]?.pinout?.length === 8 ? x2(byId[src].pinout) : null;
    if (!pins || pins.length !== npts(d)) return;
    d.pinout = pins.map((q) => ({ ...q }));
    d.desc += dbl
      ? `; clamps from the ${src} Infosys table, each doubled for the 16-point ED housing (no ${id} manual yet; layout assumed)`
      : `; clamps from the ${src} Infosys table (no ${id} table found; same clamp layout assumed)`;
  });
}

// EL6201 AS-i master: Infosys lists the clamps in pairs ("1 and 5 | SCM")
{
  const d = CATALOG.find((x) => x.id === "EL6201");
  if (d && !d.pinout) {
    const t = ["SCM · configuration mode (bridge 1 and 5 briefly)", "ASi+ · AS-i + (brown), 2 and 6 connected internally",
      "ASi− · AS-i − (blue), 3 and 7 connected internally", "SPM · protected mode (bridge 4 and 8 briefly)"];
    d.pinout = [...t, ...t].map((x) => ({ t: x }));
    d.desc = (d.desc || "").replace("Pinout not yet verified", "clamps from Infosys (AS interface connection table)");
  }
}

// Dummy terminals: no field wiring, but they are EtherCAT slaves and draw
// E-bus current (EL6071 license key, EL6685 / -0010 reference clocks)
["EL6071", "EL6685", "EL6685-0010"].forEach((id) => {
  const d = CATALOG.find((x) => x.id === id);
  if (!d || d.pinout) return;
  d.pinout = Array.from({ length: 8 }, () => ({ t: "no field connection (dummy terminal)" }));
  d.desc = d.desc.replace("Pinout not yet verified", "dummy terminal: no field clamps used; an EtherCAT slave that draws E-bus current");
});

// every catalog entry carries a manufacturer; unset → Beckhoff
CATALOG.forEach((d) => { if (!d.brand) d.brand = "beckhoff"; });

export const GROUPS = [
  { key: "cplr", title: "Beckhoff · Couplers & Junctions", ids: ["EK1100", "EK1101", "EK1101-0010", "EK1101-0080", "EK1000", "EK1300", "EK1400", "EK1501", "EK1501-0010", "EK1501-0100", "EK1541", "EK1814", "EK1818", "EK1828", "EK1828-0010", "EK1914", "EK1960", "EK1110", "EK1310", "EK1122", "EK1122-0080", "EK1121-0010", "EK1322", "EK1521", "EK1521-0010", "EK1561"] },
  { key: "epc",  title: "Beckhoff · Embedded PCs (rail)", ids: ["CX7000", "CX7031", "CX7050", "CX7051", "CX7080", "CX7291", "CX7293", "CX8010", "CX8030", "CX8031", "CX8050", "CX8051", "CX8080", "CX8090", "CX8091", "CX8093", "CX8095", "CX8110", "CX8180", "CX8190", "CX8191", "CX8200", "CX8210", "CX8280", "CX8290", "CX9020", "CX9240", "CX5120", "CX5130", "CX5140", "CX5230", "CX5240", "CX5330", "CX5340", "CX5620", "CX5630", "CX2033", "CX2043", "CX2042", "CX2062", "CX2072", "CX2100-0004", "CX2100-0014", "CX2100-0022", "CX2100-0024", "CX2100-0904", "CX2100-0914", "CX2500-0030", "CX2500-0031", "CX2500-0060", "CX2500-0061", "CX2500-0062", "CX2500-0070", "CX2500-1060", "CX2500-1061", "CX2500-B310", "CX2500-B510", "CX2500-M310", "CX2500-M510", "CX2500-0021", "CX2550-0010", "CX2550-0020", "CX2550-0179", "CX2550-0279"] },
  { key: "pc",   title: "Beckhoff · Industrial PCs", ids: ["C6015", "C6017", "C6025", "C6030", "C6032", "C6040", "C6650", "C6670", "C6920", "C7015"] },
  { key: "pnl",  title: "Beckhoff · Panels & Panel PCs", ids: ["CP2907", "CP2912", "CP2915", "CP6606", "CP2216"] },
  { key: "drv",  title: "Beckhoff · Drives & Motors", ids: ["AX5103", "AX5203", "AX8100", "AX8108", "AX8206", "AM8031"] },
  { key: "iobox", title: "IP67 I/O Boxes & IO-Link", ids: ["EP1008-0001", "EP1018-0001", "EP2008-0002", "EP2338-0001", "EP2809-0021", "EP3174-0002", "EP3182-1002", "EP4174-0002", "EP5151-0002", "EP6224-2022", "EP7041-0002", "EP7211-0034", "EP7402-0057", "EPP2334-0061", "EQ2339-0022", "MURR-MVK", "MURR-CUBE67", "BALLUFF-BNI", "FESTO-CPX-AP", "TURCK-TBEN", "IFM-AL1350"] },
  { key: "sens", title: "Sensors", ids: ["BANNER-QS18", "BANNER-Q4X", "BANNER-DF", "BALLUFF-BES", "BALLUFF-BOS", "BALLUFF-BIS", "BALLUFF-BMF", "BALLUFF-BTL", "BALLUFF-BNS", "SMC-ISE30", "FESTO-SDE", "LEUZE-HRT", "LEUZE-DCR", "SICK-W4", "SICK-WTB", "SICK-DT35", "SICK-UM30", "SICK-CLV", "SICK-DFS60", "TURCK-BI", "TURCK-NI", "TURCK-PS", "TURCK-RU", "IFM-IG", "IFM-PN", "IFM-SM", "IFM-OGD", "IFM-TN", "OMRON-E3Z", "ADC-PROSENSE-PROX", "ADC-PROSENSE-TMP"] },
  { key: "hmi",  title: "Operators & Signaling", ids: ["BANNER-TL50", "BANNER-K50", "BANNER-WLS15", "EATON-M22-BTN", "EATON-M22-ESTOP", "EATON-M22-SEL", "EATON-M22-PILOT", "SIEMENS-3SU-BTN", "SIEMENS-3SB-ESTOP", "SIEMENS-3SU-PILOT", "SCHNEIDER-XB5-BTN", "SCHNEIDER-XVB"] },
  { key: "safe", title: "Safety Devices", ids: ["BANNER-LX", "LEUZE-MLC", "LEUZE-CML", "LEUZE-RSL", "SICK-MICROSCAN3", "PILZ-PNOZ", "PILZ-PSEN", "SIEMENS-3SK"] },
  { key: "sw",   title: "Switching & Protection", ids: ["EATON-DILM", "EATON-DILA", "EATON-FAZ", "EATON-PKZ", "EATON-P1", "SIEMENS-3RT", "SIEMENS-3RV", "SIEMENS-3LD", "SCHNEIDER-LC1D", "SCHNEIDER-GV2", "SCHNEIDER-VCF", "PHOENIX-CONTACTRON", "ADC-FUJI-CONT", "ADC-MERCURY-DISC", "WAGO-2857-534", "WAGO-2042-DO", "MURR-MIRO", "PHOENIX-PLC-RSC", "MURR-MICO", "OMRON-G7Z"] },
  { key: "psu",  title: "Beckhoff · Power Supplies", ids: ["PS1011-2401", "PS1011-2405", "PS1011-2410", "PS1021-2420", "PS2001-4810", "PS3011-2410", "PS3021-2420", "PS3021-2440"] },
  { key: "pwr",  title: "Power & Distribution", ids: ["CU8110-0120", "CU8130-0120", "C9900-U330", "CX2900-0192", "SIEMENS-SITOP", "PHOENIX-QUINT", "PHOENIX-QUINT-UPS", "PHOENIX-TRIO", "MURR-EMPARRO", "MURR-REDBOX", "WAGO-787-2861", "WEIDMULLER-PRO", "ADC-RHINO-PSU", "WAGO-2016-DIST", "WAGO-221-DIST", "WAGO-2006-PE", "PHOENIX-TERM", "WEIDMULLER-TERM"] },
  { key: "pneu", title: "Pneumatics", ids: ["SMC-EX600", "SMC-SY", "SMC-ZK2", "SMC-ITV", "FESTO-VTUG", "FESTO-MPA", "FESTO-VUVG"] },
  { key: "drv3", title: "Drives & Motors (3rd-party)", ids: ["KOLLMORGEN-AKD", "KOLLMORGEN-AKM", "OMRON-1S", "SIEMENS-1FK2", "ADC-SURESTEP-MOT", "IGUS-DRYLIN-E"] },
  { key: "net",  title: "Infrastructure", ids: ["CU2008", "CU2005", "CU1128", "CU2508", "CU1521", "CU8210-M001", "ADC-STRIDE-SW"] },
  { key: "sys",  title: "System & Power",     ids: ["EL9410", "EL9100", "EL9110", "EL9200", "EL9210", "EL9520", "EL9150", "EL9160", "EL9190", "EL9221", "EL9222", "EL9227", "EL9501", "EL9505", "EL9508", "EL9510", "EL9512", "EL9515", "EL9560", "EL9180", "EL9185", "EL9185-0010", "EL9186", "EL9187", "EL9184", "EL9188", "EL9189", "EL9181", "EL9182", "EL9183", "EL9070", "EL9195", "EL9540", "EL9550", "EL9570", "EL9576", "EL9930", "EL9080", "EL9011", "EL9012"] },
  { key: "di",   title: "Digital Input",      ids: ["EL1002", "EL1004", "EL1008", "EL1012", "EL1014", "EL1018", "EL1024", "EL1084", "EL1088", "EL1094", "EL1098", "EL1104", "EL1114", "EL1124", "EL1134", "EL1144", "EL1202", "EL1252", "EL1262", "EL1502", "EL1512", "EL1804", "EL1808", "EL1809", "EL1814", "EL1819", "EL1859", "EL1889"] },
  { key: "do",   title: "Digital Output",     ids: ["EL2002", "EL2004", "EL2008", "EL2022", "EL2024", "EL2032", "EL2042", "EL2084", "EL2088", "EL2124", "EL2202", "EL2262", "EL2502", "EL2521", "EL2522", "EL2535", "EL2564", "EL2595", "EL2602", "EL2612", "EL2622", "EL2624", "EL2634", "EL2652", "EL2712", "EL2722", "EL2798", "EL2808", "EL2809", "EL2819", "EL2828", "EL2889"] },
  { key: "ai",   title: "Analog Input",       ids: ["EL3001", "EL3002", "EL3004", "EL3008", "EL3021", "EL3042", "EL3044", "EL3048", "EL3052", "EL3054", "EL3058", "EL3061", "EL3062", "EL3064", "EL3068", "EL3101", "EL3102", "EL3104", "EL3121", "EL3124", "EL3142", "EL3144", "EL3152", "EL3154", "EL3162", "EL3164", "EL3174", "EL3201", "EL3202", "EL3204", "EL3208", "EL3214", "EL3218", "EL3255", "EL3311", "EL3312", "EL3314", "EL3318", "EL3351", "EL3356", "EL3403", "EL3443", "EL3453", "EL3602", "EL3612", "EL3632", "EL3681", "EL3702", "EL3742", "EL3751"] },
  { key: "ao",   title: "Analog Output",      ids: ["EL4001", "EL4002", "EL4004", "EL4008", "EL4011", "EL4012", "EL4014", "EL4018", "EL4021", "EL4022", "EL4024", "EL4028", "EL4031", "EL4032", "EL4034", "EL4038", "EL4102", "EL4104", "EL4112", "EL4114", "EL4122", "EL4124", "EL4134", "EL4712", "EL4732"] },
  { key: "pos",  title: "Position / Encoder", ids: ["EL5001", "EL5002", "EL5021", "EL5032", "EL5042", "EL5072", "EL5101", "EL5102", "EL5112", "EL5131", "EL5151", "EL5152", "ED5002", "ED5112"] },
  { key: "com",  title: "Communication",      ids: ["EL6001", "EL6002", "EL6021", "EL6022", "EL6070", "EL6080", "EL6090", "EL6224", "EL6601", "EL6614", "EL6631", "EL6652", "EL6688", "EL6692", "EL6695", "EL6731", "EL6751", "EL6752", "ED6001-0009", "ED6002-0009", "ED6011", "ED6012", "ED6060", "ED6224", "ED6781"] },
  { key: "mot",  title: "Motion / Drives",    ids: ["EL7031", "EL7037", "EL7041", "EL7047", "EL7201", "EL7211", "EL7211-0010", "EL7332", "EL7342", "EL7411", "ED7062", "ED7211-0010"] },
  { key: "ed",   title: "ED series (push-in)", ids: ["ED1008", "ED1808", "ED1809", "ED1819", "ED1829", "ED1839", "ED1859", "ED1889", "ED2008", "ED2032", "ED2034", "ED2808", "ED2809", "ED2828", "ED2838", "ED2889", "ED3072", "ED3074", "ED3078", "ED3172", "ED3174", "ED4072", "ED4074", "ED4078", "ED4172", "ED4174"] },
  { key: "saf",  title: "TwinSAFE",           ids: ["EL1904", "EL1918", "EL2904", "EL2911", "EL2912", "EL6910", "EL6930"] },
  { key: "src",   title: "Power Sources & Feeds", ids: [] },
  { key: "klbus", title: "Beckhoff KL Bus Terminals (K-bus)", ids: [] },
  { key: "w750",  title: "WAGO 750 I/O (fieldbus)", ids: [] },
];

/* Any catalog part not explicitly listed above is auto-filed into the
 * right palette group from its kind/fn, so adding parts never leaves
 * them stranded (the integrity test asserts zero orphans). */
const KIND_GROUP = {
  epbox: "iobox", iol: "iobox", iolhub: "iobox",
  sensor: "sens", encf: "sens", loop2: "sens",
  btn: "hmi", estop: "hmi", stack: "hmi",
  curtain: "safe", scanner: "safe",
  contactor: "sw", breaker: "sw", disconnect: "sw", relay: "sw", fusebox: "sw", limit: "sw",
  supplybox: "pwr", busbar: "pwr", wago: "pwr", source: "src",
  valvebank: "pneu", valve: "pneu",
  switch8: "net", conv: "net",
  ipc: "pc", panel: "pnl",
};
// parts from catalog-more.js whose palette group is not their fn
GROUPS.forEach((g) => { if (MORE_GROUPS[g.key]) g.ids.push(...MORE_GROUPS[g.key]); });
{
  const at = GROUPS.findIndex((g) => g.key === "saf") + 1;
  GROUPS.splice(at, 0,
    { key: "elx", title: "ELX · intrinsically safe (Ex i)", ids: ELXM_GROUPS.elx },
    { key: "elm", title: "ELM · measurement & servo (metal)", ids: ELXM_GROUPS.elm });
}
GROUPS.forEach((g) => { if (FACE_GROUPS[g.key]) g.ids.push(...FACE_GROUPS[g.key]); });
{
  const listed = new Set(GROUPS.flatMap((g) => g.ids));
  const byKey = Object.fromEntries(GROUPS.map((g) => [g.key, g]));
  CATALOG.forEach((d) => {
    if (listed.has(d.id)) return;
    let key;
    if (["motor", "drive", "linaxis"].includes(d.kind)) key = d.brand === "beckhoff" ? "drv" : "drv3";
    // a generic box is switchgear unless it says otherwise — safety devices and
    // network kit (gateways, media converters, interface cards) file properly
    else if (d.kind === "box") key = d.safety ? "safe" : d.fn === "net" ? "net" : "sw";
    else key = KIND_GROUP[d.kind] || (d.free ? "sens" : d.fn);
    (byKey[key] || byKey.sens).ids.push(d.id);
  });
}
