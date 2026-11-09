/* The last 106 parts from the 2026-11-08 missed-parts check (see
 * docs/MISSING-PARTS.md): the ones that needed a new face, a port kind or
 * feed modelling. Widths, channels and E-bus currents come from each
 * beckhoff.com product page; faces follow the product pictures.
 *
 * face: another catalog id whose face tables (C24 / FEED12 / PIN_TABS /
 * PIN_LEDS) this part reuses — same housing, same connectors or clamps.
 * Anything not on the page or the picture is flagged in desc.
 *
 * moreFaces(byId) copies pins / flags from the base parts, so it runs after
 * CATALOG is built (catalog.js pushes the result).
 */
const BC = "beckhoff.com";
const ebNote = (v) => `E-bus not listed, ${v} value`;

// EL-24 comm terminals that share a face with a part already drawn
const C24_ALIAS = [
  ["EL6631-0010", "EL6631", "PROFINET RT Device", -400, "2-port PROFINET RT device (slave)"],
  ["EL6632", "EL6631", "PROFINET IRT Controller", -400, "2-port PROFINET IRT controller"],
  ["EL6633", "EL6631", "PROFINET RT Controller / I-Device", -400, "2-port PROFINET RT controller / I-Device"],
  ["EL6633-0010", "EL6631", "PROFINET RT Device", -400, "2-port PROFINET RT device"],
  ["EL6634", "EL6631", "PROFINET IRT Controller", -400, "2-port PROFINET IRT controller"],
  ["EL6652-0010", "EL6652", "EtherNet/IP Adapter", -400, "2-port EtherNet/IP adapter (slave)"],
  ["EL6653", "EL6652", "EtherNet/IP Scanner", -400, "2-port EtherNet/IP scanner"],
  ["EL6653-0010", "EL6652", "EtherNet/IP Adapter", -400, "2-port EtherNet/IP adapter"],
  ["EL6731-0010", "EL6731", "PROFIBUS Slave", -200, "PROFIBUS slave, D-sub 9 socket"],
  ["EL6733", "EL6731", "PROFIBUS Master/Slave", -200, `PROFIBUS master / slave, D-sub 9 socket; ${ebNote("EL6731")}`],
  ["EL6733-0010", "EL6731", "PROFIBUS Slave", -200, `PROFIBUS slave, D-sub 9 socket; ${ebNote("EL6731")}`],
  ["EL6751-0010", "EL6751", "CANopen Slave", -230, "CANopen slave, D-sub 9 plug"],
  ["EL6753", "EL6751", "CANopen Master/Slave", -230, `CANopen master / slave, D-sub 9 plug; ${ebNote("EL6751")}`],
  ["EL6753-0010", "EL6751", "CANopen Slave", -230, `CANopen slave, D-sub 9 plug; ${ebNote("EL6751")}`],
  ["EL6752-0010", "EL6752", "DeviceNet Slave", -260, "DeviceNet slave, 5-pin open-style plug"],
  ["EL6754", "EL6752", "DeviceNet Master", -260, `DeviceNet master, 5-pin open-style plug; ${ebNote("EL6752")}`],
  ["EL6754-0010", "EL6752", "DeviceNet Slave", -260, `DeviceNet slave, 5-pin open-style plug; ${ebNote("EL6752")}`],
].map(([id, face, name, ebus, t]) => ({ id, name, fn: "sys", io: null, ch: 1, w: 24, ebus, c24: true, face,
  desc: `${BC}: ${t}; EL-24 housing, drawn on the ${face} face (same connectors; LED names from the ${face} picture)` }));

// EL-24 terminals with their own C24 entry in App.jsx
const C24_OWN = [
  { id: "EL6251", name: "Modbus TCP Client/Server 1-Port", ch: 1, ebus: -200, t: "1-port Modbus TCP client / server, RJ45. LED names inferred (no picture checked)" },
  { id: "EL6254", name: "Modbus TCP Client/Server 4-Port", ch: 4, ebus: -250, t: "4-port Modbus TCP client / server, 4 × RJ45. LED names inferred (no picture checked)" },
  { id: "EL6689", name: "GNSS Receiver", ch: 1, ebus: -310, t: "GNSS receiver for time synchronisation, SMA antenna socket X1 (picture)" },
  { id: "EL6711-0010", name: "CC-Link Slave", ch: 1, ebus: -150, t: `CC-Link slave, 5-pin plug X1 (picture; pin functions not verified); E-bus typ. 150 mA (Infosys)` },
  { id: "EL6720", name: "Lightbus Master", ch: 1, ebus: -240, t: "Lightbus master, duplex fibre X1 (picture)" },
  { id: "EL6740-0010", name: "INTERBUS Slave", ch: 1, ebus: -450, t: "INTERBUS slave: X1 D-sub plug (in), X2 D-sub socket (out) (picture)" },
  { id: "EL6761", name: "ISO 15118 Charge Controller", ch: 1, ebus: -420, t: "ISO 15118 powerline charge controller, 4-pin plug PP / CP / ⏚ / n.c. (picture)" },
  { id: "EL6861", name: "BACnet MS/TP RS485", ch: 1, ebus: -170, t: "BACnet MS/TP, RS485, D-sub 9 socket X1 (picture)" },
  { id: "EL1262-0010", name: "2-Ch DI + 2-Ch DO 5V RS422 D-sub", ch: 4, ebus: -540, t: "2 DI + 2 DO, 5 V DC, RS422, 2 × D-sub 9 sockets (female, Infosys); E-bus typ. 540 mA (Infosys)" },
  { id: "EL3008-0003", name: "8-Ch AI ±3V 16bit cascaded", ch: 8, ebus: -190, t: "8 AI ±3 V, 10-pin plug X1 (picture; clamp functions not verified)" },
  { id: "EL3008-0005", name: "8-Ch AI ±5V 16bit cascaded", ch: 8, ebus: -190, t: "8 AI ±5 V, 10-pin plug X1 (picture; clamp functions not verified)" },
  { id: "EL3475", name: "12-Ch AI 4-port multi-function 333mV", ch: 12, ebus: -150, t: "12 AI on 4 RJ45-type sensor ports X1–X4 (not Ethernet; picture). E-bus typ. 150 mA (Infosys). Sensor cabling not modelled" },
  { id: "EL3475-0200", name: "12-Ch AI 4-port multi-function 333mV", ch: 12, ebus: -320, face: "EL3475", t: "as EL3475, ordering variant; 4 sensor ports X1–X4" },
  { id: "EM3701", name: "1-Ch AI Diff. Pressure ±100 hPa", ch: 1, ebus: -70, t: "differential pressure, 2 pneumatic fittings (picture; + / − marking inferred)" },
  { id: "EM3702", name: "2-Ch AI Rel. Pressure 0…7.5 bar", ch: 2, ebus: -60, t: "relative pressure, pneumatic fittings X1 / X2 (picture)" },
  { id: "EM3712", name: "2-Ch AI Rel. Pressure ±1 bar", ch: 2, ebus: -70, t: "relative pressure, pneumatic fittings X1 / X2 (picture)" },
  { id: "EM2042", name: "16-Ch DO 24V 0.5A D-sub", ch: 16, ebus: -115, w: 26.5, t: "16 DO on a D-sub 25 socket X1, 24 V / 0 V supply plug X2 (Infosys); E-bus typ. 115 mA. The D-sub outputs are not wirable yet" },
  { id: "ED6011-0009", name: "Serial RS232/422/485 D-sub", ch: 1, ebus: -190, ed: true, t: `ED-24 housing, D-sub 9 X1 (picture); ${ebNote("ED6011")}` },
  { id: "ED6012-0009", name: "2-Ch Serial RS232/422/485 D-sub", ch: 2, ebus: -190, ed: true, t: `ED-24 housing, 2 × D-sub 9 (picture); ${ebNote("ED6012")}` },
].map(({ id, name, ch, ebus, t, w = 24, ed, face }) => {
  const dg = id[2], ai = id.startsWith("EL3") || id.startsWith("EM3");
  const fn = ai ? "ai" : dg === "2" && id.startsWith("EM2") ? "do" : id.startsWith("EL1") ? "di" : "sys";
  return { id, name, fn, io: null, ch, w, ebus, c24: true, ...(ed ? { ed: true } : {}), ...(face ? { face } : {}), desc: `${BC}: ${t}` };
});

// M8 versions of the couplers (two round M8 sockets instead of RJ45)
const M8 = [
  { id: "EK1100-0008", name: "EtherCAT Coupler M8", fn: "cplr", io: null, ch: 0, w: 44, ebus: +2000, coupler: true, m8: true, desc: `${BC}: EK1100 with M8 connection, X1 IN / X2 OUT M8 sockets (picture)` },
  { id: "EK1101-0008", name: "EtherCAT Coupler w/ ID M8", fn: "cplr", io: null, ch: 0, w: 44, ebus: +2000, coupler: true, idSwitch: true, m8: true, desc: `${BC}: EK1101 with M8 connection and ID switch (drawn from the EK1100-0008 picture)` },
  { id: "EK1110-0008", name: "EtherCAT Extension M8", fn: "sys", io: null, ch: 0, w: 44, ebus: -130, ext: true, extM7: true, m8: true, desc: `${BC}: EK1110 with an M8 OUT socket (drawn from the EK1110 / EK1100-0008 pictures)` },
  { id: "EK1122-0008", name: "2-Port EtherCAT Junction M8", fn: "sys", io: null, ch: 0, w: 24, ebus: -220, junction: true, jM7: true, m8: true, desc: `${BC}: X1 OUT / X2 OUT M8 sockets, Run and L/A LEDs (picture)` },
];

// EJ couplers, push-in couplers, K-bus couplers
const CPLR = [
  { id: "EK1110-0043", name: "EtherCAT EJ Coupler", fn: "sys", io: null, ch: 0, w: 44, ebus: -50, ext: true, extM7: true, ejPorts: 0, desc: `${BC}: connects EL terminals to an EJ / CX system through the rear connector; no RJ45 (picture). The EJ side is not modelled` },
  { id: "EK1110-0044", name: "EtherCAT EJ Coupler + Junction", fn: "sys", io: null, ch: 0, w: 44, ebus: -140, ext: true, extM7: true, desc: `${BC}: as EK1110-0043 with an EtherCAT junction RJ45 (picture). The EJ side is not modelled` },
  { id: "EC1100", name: "EtherCAT Coupler push-in", fn: "cplr", io: null, ch: 0, w: 40, ebus: +2000, coupler: true, ec: true, desc: `${BC}: new push-in coupler, angled RJ45 X1 / X2, 2 A E-bus. Face after the product picture (angled port slots, push-in clamps); hovering a port shows the ports face-on with what is plugged in` },
  { id: "EC1110", name: "EtherCAT Extension push-in", fn: "sys", io: null, ch: 0, w: 42, ebus: -130, ext: true, extM7: true, ec: true, desc: `${BC}: push-in extension, one angled RJ45. Drawn on the EK1110 face with an angled port slot; hovering it shows the port face-on with what is plugged in` },
  { id: "BK1150", name: "EtherCAT Bus Coupler Compact (K-bus)", fn: "klbus", io: null, ch: 0, w: 44, ebus: +1750, coupler: true, desc: `${BC}: couples KL Bus Terminals (K-bus, 1750 mA) to EtherCAT, X1 IN / X2 OUT` },
  { id: "BK1250", name: "E-bus to K-bus Interface", fn: "klbus", io: null, ch: 0, w: 12, ebus: 0, feed: true, pcFeed: true, face: "EL9410", desc: `${BC}: puts KL terminals (K-bus, 500 mA) behind EL terminals in one station. Drawn on the EL9410 face (KL housing in reality; clamps follow the EL9410 layout, not verified); E-bus draw not listed` },
  { id: "EKM1101", name: "EtherCAT Coupler w/ ID + diag", fn: "cplr", io: null, ch: 0, w: 30, ebus: +2000, coupler: true, idSwitch: true, ekm: true, desc: `${BC}: RJ45 X1 IN / X2 OUT, ID switch, 10-pin X3 plug: Us +, +, −, −; Up +, +, −, −; shield, shield (picture). Power contacts 2 A out` },
];

// Fieldbus couplers: EL terminals behind Modbus TCP / PROFINET / EtherNet/IP /
// PROFIBUS / IoT. They head a station like an EtherCAT coupler, but their
// network is not modelled yet (docs/ROADMAP-v0.2.md)
const ETH2 = [["rj45", 92, "X001"], ["rj45", 168, "X002"]];
const FB = [
  ["EK9000", "Modbus TCP/UDP", 64, ["RUN", "WD", "ERR"], ETH2, "Modbus TCP"],
  ["EK9020", "Modbus TCP/UDP", 64, ["RUN", "WD", "ERR"], ETH2, "Modbus TCP"],
  ["EK9300", "PROFINET RT", 64, ["RUN", "PN", "DIAG"], ETH2, "PROFINET"],
  ["EK9320", "PROFINET RT", 64, ["RUN", "PN", "DIAG"], ETH2, "PROFINET"],
  ["EK9500", "EtherNet/IP", 64, ["RUN", "EIP State", "NET State"], ETH2, "EtherNet/IP"],
  ["EK9520", "EtherNet/IP", 64, ["RUN", "EIP State", "NET State"], ETH2, "EtherNet/IP"],
  ["EK9160", "IoT (MQTT / OPC UA)", 71, ["RUN", "WD", "ERR"], ETH2, "IoT"],
  ["EK3100", "PROFIBUS", 64, ["RUN", "BF", "DIA"], [["dsub", 140, "X001", true]], "PROFIBUS"],
].map(([id, bus, w, leds, ports, logo]) => ({
  id, name: `Bus Coupler ${bus}`, fn: "cplr", io: null, ch: 0, w, ebus: +2000, coupler: true,
  fbc: { bus, leds, ports, logo, sw: id === "EK3100" ? "rot" : "dip" },
  desc: `${BC}: ${bus} bus coupler for EL terminals, 2 A E-bus, ${ports.length > 1 ? "2 × RJ45 (switched)" : "D-sub 9 socket"}, power block 24 V / 0 V, + / −, PE (picture${/EK9020|EK9320|EK9520/.test(id) ? "; drawn from the EK9x00 picture" : ""}). Its ${bus} network is not simulated yet — the station is drawn and powered, but not on the EtherCAT bus`,
}));

// flat-ribbon terminals: 16 LEDs, a shrouded ribbon header, 2 supply clamps
const FRC = [
  ["EL1852", "8-Ch DI + 8-Ch DO 24V flat-ribbon", "mix", 16, -100, "8 DI + 8 DO, 24 V DC, 3 ms, 0.5 A"],
  ["EL1862", "16-Ch DI 24V flat-ribbon", "di", 16, -100, "16 DI, 24 V DC, 3 ms"],
  ["EL1862-0010", "16-Ch DI 24V gnd-sw. flat-ribbon", "di", 16, -100, "16 DI, 24 V DC, 3 ms, ground switching"],
  ["EL1872", "16-Ch DI 24V 10µs flat-ribbon", "di", 16, -100, "16 DI, 24 V DC, 10 µs"],
  ["EL1872-0010", "16-Ch DI 24V 10µs gnd-sw. flat-ribbon", "di", 16, -100, "16 DI, 24 V DC, 10 µs, ground switching"],
  ["EL2872", "16-Ch DO 24V 0.5A flat-ribbon", "do", 16, -130, "16 DO, 24 V DC, 0.5 A"],
  ["EL2872-0010", "16-Ch DO 24V 0.5A gnd-sw. flat-ribbon", "do", 16, -130, "16 DO, 24 V DC, 0.5 A, ground switching"],
  ["EL2878-0005", "8-Ch DO 24V 0.5A flat-ribbon diag", "do", 8, -100, "8 DO, 24 V DC, 0.5 A, with diagnostics"],
].map(([id, name, io, ch, ebus, t]) => ({ id, name, fn: io === "do" ? "do" : "di", io, ch, w: 12, ebus, frc: true, noSig: true,
  desc: `${BC}: ${t}, flat-ribbon connector (picture). The signals run on the ribbon cable, which is not modelled; the 2 supply clamps' roles are not verified` }));

// EL922x ordering codes (the base EL9221 / EL9222 / EL9227 ids are not sold
// under those names). Clamps verified for -5000 / -5500; the others assumed equal
const EFUSE = [
  ["EL9221-4030", "3 A"], ["EL9221-5000", "10 A adj."], ["EL9221-5090", "10 A"], ["EL9221-6000", "4 A adj."], ["EL9221-6040", "4 A"], ["EL9221-9060", "6 A"], ["EL9221-9080", "8 A"],
  ["EL9222-4433", "3 A/3 A"], ["EL9222-5500", "10 A adj."], ["EL9222-6600", "4 A adj."], ["EL9222-6644", "4 A/4 A"], ["EL9222-9482", "8 A/2 A"], ["EL9222-9664", "6 A/4 A"],
  ["EL9227-0000", "4 A adj. Class 2"], ["EL9227-4433", "3 A/3 A"], ["EL9227-5500", "10 A adj."], ["EL9227-6600", "4 A adj."], ["EL9227-6644", "4 A/4 A"], ["EL9227-9482", "8 A/2 A"], ["EL9227-9664", "6 A/4 A"],
].map(([id, a]) => {
  const base = id.slice(0, 6), two = base !== "EL9221", ext = base === "EL9227";
  const ok = /-(5000|5500)$/.test(id);
  return { id, name: `Overcurrent Protection ${two ? 2 : 1}-Ch ${a}${ext ? " ext." : ""}`, fn: "sys", io: null, ch: two ? 2 : 1, w: 12, ebus: -80, feed: true, pcFeed: true, efuse: true, face: base,
    desc: `${BC}: ${two ? 2 : 1}-channel electronic fuse, 24 V DC, ${a}${ext ? ", extended diagnostics" : ""}. ${ok ? "Clamps as the " + base + " (verified)" : "Clamps assumed as " + base + "-" + (two ? "5500" : "5000") + " (not verified for this code)"}` };
});

const FEEDS = [
  { id: "EL9540-0010", name: "Surge Filter Field Supply w/ diag", fn: "sys", io: null, ch: 0, w: 12, ebus: -40, feed: true, pcFeed: true, face: "EL9540", desc: `${BC}: surge filter, field supply, 5 A, with diagnostics; clamps as the EL9540 (not verified for -0010)` },
  { id: "EL9550-0010", name: "Surge Filter w/ diag", fn: "sys", io: null, ch: 0, w: 12, ebus: -40, feed: true, pcFeed: true, sysFilter: true, face: "EL9550", desc: `${BC}: surge filter, system and field supply, Σ 10 A, with diagnostics; clamps as the EL9550 (not verified for -0010)` },
  { id: "EL9550-0012", name: "Surge Filter 10A/10A", fn: "sys", io: null, ch: 0, w: 12, ebus: 0, feed: true, pcFeed: true, sysFilter: true, face: "EL9550", desc: `${BC}: surge filter, system and field supply, 10 A / 10 A; clamps as the EL9550 (not verified); E-bus not listed (no diagnostics)` },
  { id: "EL9561", name: "Power Supply 0…20V isolated", fn: "sys", io: null, ch: 0, w: 12, ebus: -80, feed: true, isoOut: true, desc: `${BC}: adjustable 0…20 V DC / 2 A output, isolated. Rows U₀ U₀, + +, − −, GND GND (picture); + / − taken as the 24 V input from the power contacts (inferred), U₀ / GND the output` },
  { id: "EL9562", name: "Power Supply 2 × 24V isolated", fn: "sys", io: null, ch: 0, w: 12, ebus: -60, feed: true, isoOut: true, desc: `${BC}: 2 × 24 V DC / 0.2 A outputs, isolated. Clamps 1 / 5 output 1 24 V / 0 V, 2 / 6 24 V, 3 / 7 0 V, 4 / 8 output 2 24 V / 0 V; LEDs Run, Output 1, Input, Output 2 (Infosys, verified)` },
  { id: "EL9562-0015", name: "Power Supply 2 × 24V 0.3A isolated", fn: "sys", io: null, ch: 0, w: 12, ebus: -60, feed: true, isoOut: true, face: "EL9562", desc: `${BC}: as EL9562 with 0.3 A outputs` },
  { id: "ED9100", name: "Potential Supply 24V push-in", fn: "sys", io: null, ch: 0, w: 12, ebus: 0, feed: true, pcFeed: true, face: "EL9100", desc: `${BC}: ED push-in potential supply, 10 A; rows NC, + +, − −, ⏚ ⏚ (picture). Drawn on the EL9100 face` },
  { id: "ED9110", name: "Potential Supply 24V push-in w/ diag", fn: "sys", io: null, ch: 0, w: 12, ebus: -60, feed: true, pcFeed: true, face: "EL9110", desc: `${BC}: as ED9100 with diagnostics. Drawn on the EL9110 face` },
  { id: "ED9410", name: "E-Bus Power Supply push-in", fn: "sys", io: null, ch: 0, w: 12, ebus: +2000, feed: true, pcFeed: true, face: "EL9410", desc: `${BC}: ED push-in E-bus supply, 2 A; rows 24 V 0 V, + +, − −, ⏚ ⏚ (picture). Drawn on the EL9410 face` },
];

const OTHER = [
  { id: "EL6072", name: "License Key Terminal 2nd gen. w/ RTC", fn: "sys", io: null, ch: 0, w: 12, ebus: -120, keyslot: true, desc: `${BC}: TwinCAT 3.1 licence key, 2nd generation, real-time clock; key slot with Presence (A) and Battery check (B) LEDs, no clamps (picture)` },
  { id: "EL7201-9014", name: "Servo 48V 2.8A OCT STO", fn: "mot", io: null, ch: 1, w: 12, ebus: -120, hd: true, noSig: true, desc: `${BC}: servo, 48 V DC, 2.8 A, OCT, suitable for STO; EL-12 16-point housing. Pinout not yet verified` },
  { id: "EL7211-9014", name: "Servo 48V 4.5A OCT STO", fn: "mot", io: null, ch: 1, w: 24, ebus: -120, blk: "hd2x16", noSig: true, desc: `${BC}: servo, 48 V DC, 4.5 A, OCT, suitable for STO; EL-24 2 × 16 housing. Pinout not yet verified` },
  { id: "EL7221-9014", name: "Servo 48V 8A OCT STO", fn: "mot", io: null, ch: 1, w: 24, ebus: -120, blk: "hd2x16", noSig: true, desc: `${BC}: servo, 48 V DC, 8 A, OCT, suitable for STO; EL-24 2 × 16 housing. Pinout not yet verified` },
  { id: "EL8601-8411", name: "Multi-Interface 8DI 4DO CNT PWM AI AO", fn: "sys", io: null, ch: 12, w: 12, ebus: -100, hd: true, noSig: true, desc: `${BC}: 8 DI, 1 counter, 4 DO, 2 PWM, 1 AI, 1 AO; EL-12 16-point housing. Pinout not yet verified` },
  { id: "ED8601-8411", name: "Multi-Interface 8DI 4DO CNT PWM AI AO push-in", fn: "sys", io: null, ch: 12, w: 12, ebus: -85, ed: true, hd: true, noSig: true, desc: `${BC}: as EL8601-8411 in the ED push-in housing. Pinout not yet verified` },
  { id: "EM7004", name: "4-Axis Servo Module", fn: "mot", io: null, ch: 4, w: 147, ebus: -280, emod: true, desc: `${BC}: 4-channel motion module, axis / servo drive interface, 24 V DC; spring plugs X0 / X1 (IN), X2 / X3 (OUT), X4–X7 and the orange X8 24 V / 0 V plug (picture). Only X8 is wirable; the axis plugs are drawn, not modelled` },
  { id: "EL6233", name: "Ethernet-APL 2-Ch", fn: "sys", io: null, ch: 2, w: 12, ebus: -60, desc: `${BC}: 2-channel Ethernet-APL (SPCX), 12 mm aligned (23 mm body), 8 clamps. E-bus typ. 60 mA; clamps from Infosys (contact assignment)`, pinout: [{ t: "APL+01 · signal channel 1" }, { t: "S1 · screen channel 1" }, { t: "not used" }, { t: "APL+02 · signal channel 2" }, { t: "APL−01 · signal channel 1" }, { t: "not used" }, { t: "S2 · screen channel 2" }, { t: "APL−02 · signal channel 2" }] },
  { id: "ED3274", name: "4-Ch AI RTD/TC push-in", fn: "ai", io: "ai", ch: 4, w: 12, ebus: -140, ed: true, hd: true, noSig: true, desc: `${BC}: 4 AI, RTD / thermocouple, push-in; ED 16-point housing. E-bus not listed — EL3214 value used as a placeholder. Pinout not yet verified` },
];
export function moreFaces(byId) {
  // ED918x potential distribution: same clamps as the EL918x (picture)
  const ED_DIST = [["ED9183", "EL9183"], ["ED9184", "EL9184"], ["ED9186", "EL9186"], ["ED9188", "EL9188"], ["ED9189", "EL9189"]].map(([id, b]) => {
    const s = byId[b] || {};
    const o = { id, name: `${s.name || "Potential Distribution"} push-in`.replace(" HD push-in", " push-in"), fn: "sys", io: null, ch: s.ch, w: 12, ebus: 0, ed: true, pins: s.pins,
      desc: `${BC}: ED push-in potential distribution, clamps as the ${b} (picture)` };
    if (s.ch === 16) o.hd = true;
    if (s.dist) o.dist = s.dist;
    return o;
  });
  return [...C24_ALIAS, ...C24_OWN, ...M8, ...CPLR, ...FB, ...FRC, ...EFUSE, ...FEEDS, ...ED_DIST, ...OTHER];
}

// palette groups that are not the part's fn
export const FACE_GROUPS = {
  cplr: [...M8, ...CPLR, ...FB].filter((d) => d.fn === "cplr" || /^EK|^EC/.test(d.id)).map((d) => d.id),
  com: [...C24_ALIAS, ...C24_OWN].filter((d) => d.fn === "sys").map((d) => d.id).concat(["EL6072", "EL6233"]),
  ed: ["ED6011-0009", "ED6012-0009", "ED9100", "ED9110", "ED9410", "ED9183", "ED9184", "ED9186", "ED9188", "ED9189", "ED8601-8411", "ED3274"],
  sys: [...EFUSE, ...FEEDS].filter((d) => !d.id.startsWith("ED")).map((d) => d.id),
};
