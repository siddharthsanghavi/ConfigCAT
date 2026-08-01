/* Extended catalog — kept separate from catalog.js so the core stays lean.
 * These entries are spread into CATALOG at load time (see catalog.js). Same
 * shape as catalog.js. Third-party specs are representative/approximate.
 *
 * Contents:
 *   1. Power sources (incoming supply feeds: DC + 1-/3-phase AC)
 *   2. Beckhoff KL Bus Terminals (K-bus) + BK1120 coupler
 *   3. WAGO 750 I/O modules + 750-354 EtherCAT coupler
 *   4. Deeper Siemens automation (hardwired; no PROFINET/PROFIBUS)
 *   5. Additional parts for other already-included brands
 */
export const EXTRA = [
  // ==========================================================================
  // 1. POWER SOURCES — the incoming supply. Terminals (DC +/−/PE, AC L·N·PE or
  // L1·L2·L3·N·PE) are wireable to contactors, motors, PSUs and 24 V devices.
  // st = "dc" | "1ph" | "3ph"; volt = label shown on the face.
  // ==========================================================================
  { id: "SOURCE-DC12", brand: "generic", name: "DC Source 12 V", fn: "src", free: true, kind: "source", st: "dc", volt: "12 V", fw: 74, fh: 80, io: null, ch: 0, w: 0, ebus: 0, desc: "12 V DC supply feed — +, −, PE" },
  { id: "SOURCE-DC24", brand: "generic", name: "DC Source 24 V", fn: "src", free: true, kind: "source", st: "dc", volt: "24 V", fw: 74, fh: 80, io: null, ch: 0, w: 0, ebus: 0, desc: "24 V DC supply feed — +, −, PE. The common control voltage" },
  { id: "SOURCE-DC48", brand: "generic", name: "DC Source 48 V", fn: "src", free: true, kind: "source", st: "dc", volt: "48 V", fw: 74, fh: 80, io: null, ch: 0, w: 0, ebus: 0, desc: "48 V DC supply feed — +, −, PE" },
  { id: "SOURCE-1P120", brand: "generic", name: "1-Phase AC 120 V", fn: "src", free: true, kind: "source", st: "1ph", volt: "120 V", fw: 74, fh: 80, io: null, ch: 0, w: 0, ebus: 0, desc: "Single-phase 120 V AC feed — L, N, PE" },
  { id: "SOURCE-1P240", brand: "generic", name: "1-Phase AC 240 V", fn: "src", free: true, kind: "source", st: "1ph", volt: "240 V", fw: 74, fh: 80, io: null, ch: 0, w: 0, ebus: 0, desc: "Single-phase 230/240 V AC feed — L, N, PE" },
  { id: "SOURCE-1P300", brand: "generic", name: "1-Phase AC 300 V", fn: "src", free: true, kind: "source", st: "1ph", volt: "300 V", fw: 74, fh: 80, io: null, ch: 0, w: 0, ebus: 0, desc: "Single-phase 300 V AC feed — L, N, PE (uncommon)" },
  { id: "SOURCE-3P208", brand: "generic", name: "3-Phase AC 208 V", fn: "src", free: true, kind: "source", st: "3ph", volt: "208 V", fw: 100, fh: 80, io: null, ch: 0, w: 0, ebus: 0, desc: "3-phase 208 V AC feed — L1, L2, L3, N, PE" },
  { id: "SOURCE-3P240", brand: "generic", name: "3-Phase AC 240 V", fn: "src", free: true, kind: "source", st: "3ph", volt: "240 V", fw: 100, fh: 80, io: null, ch: 0, w: 0, ebus: 0, desc: "3-phase 240 V AC feed — L1, L2, L3, N, PE" },
  { id: "SOURCE-3P400", brand: "generic", name: "3-Phase AC 400 V", fn: "src", free: true, kind: "source", st: "3ph", volt: "400 V", fw: 100, fh: 80, io: null, ch: 0, w: 0, ebus: 0, desc: "3-phase 400 V AC feed — L1, L2, L3, N, PE (IEC)" },
  { id: "SOURCE-3P480", brand: "generic", name: "3-Phase AC 480 V", fn: "src", free: true, kind: "source", st: "3ph", volt: "480 V", fw: 100, fh: 80, io: null, ch: 0, w: 0, ebus: 0, desc: "3-phase 480 V AC feed — L1, L2, L3, N, PE (NEC)" },
  { id: "SOURCE-3P600", brand: "generic", name: "3-Phase AC 600 V", fn: "src", free: true, kind: "source", st: "3ph", volt: "600 V", fw: 100, fh: 80, io: null, ch: 0, w: 0, ebus: 0, desc: "3-phase 600 V AC feed — L1, L2, L3, N, PE" },

  // ==========================================================================
  // 2. BECKHOFF KL BUS TERMINALS (K-bus). Not native EtherCAT — they run on the
  // K-bus behind a BK1120 EtherCAT Bus Coupler (which IS on EtherCAT). Modelled
  // as rail terminals; ebus values represent K-bus load (approximate).
  // ==========================================================================
  { id: "BK1120", brand: "beckhoff", name: "EtherCAT Bus Coupler (K-bus)", fn: "klbus", io: null, ch: 0, w: 49, ebus: +2000, coupler: true, desc: "Couples KL Bus Terminals (K-bus) onto an EtherCAT network — X1 IN / X2 OUT" },
  { id: "KL1104", brand: "beckhoff", name: "4-Ch DI 24V 3ms", fn: "klbus", io: "di", ch: 4, w: 12, ebus: -50, desc: "KL digital input, 24 V DC, 2/3-wire" },
  { id: "KL1408", brand: "beckhoff", name: "8-Ch DI 24V 3ms", fn: "klbus", io: "di", ch: 8, w: 12, ebus: -60, desc: "KL digital input, 8-channel, 24 V DC" },
  { id: "KL1418", brand: "beckhoff", name: "8-Ch DI 24V 0.2ms", fn: "klbus", io: "di", ch: 8, w: 12, ebus: -60, desc: "KL fast digital input, 8-channel" },
  { id: "KL2134", brand: "beckhoff", name: "4-Ch DO 24V 0.5A", fn: "klbus", io: "do", ch: 4, w: 12, ebus: -60, upA: 2, desc: "KL digital output, 24 V DC, reverse-voltage protected" },
  { id: "KL2408", brand: "beckhoff", name: "8-Ch DO 24V 0.5A", fn: "klbus", io: "do", ch: 8, w: 12, ebus: -70, upA: 4, desc: "KL digital output, 8-channel, 24 V DC" },
  { id: "KL2612", brand: "beckhoff", name: "2-Ch Relay Output", fn: "klbus", io: "do", ch: 2, w: 12, ebus: -70, relay: true, desc: "KL relay output, 2×NO, 230 V AC / 30 V DC" },
  { id: "KL3054", brand: "beckhoff", name: "4-Ch AI 0-20mA", fn: "klbus", io: "ai", ch: 4, w: 12, ebus: -65, desc: "KL analog input, 0/4-20 mA, single-ended" },
  { id: "KL3204", brand: "beckhoff", name: "4-Ch AI RTD (PT100)", fn: "klbus", io: "ai", ch: 4, w: 12, ebus: -65, desc: "KL analog input, RTD / PT100 temperature" },
  { id: "KL4004", brand: "beckhoff", name: "4-Ch AO 0-10V", fn: "klbus", io: "ao", ch: 4, w: 12, ebus: -100, desc: "KL analog output, 0-10 V" },
  { id: "KL4404", brand: "beckhoff", name: "4-Ch AO 0-20mA", fn: "klbus", io: "ao", ch: 4, w: 12, ebus: -100, desc: "KL analog output, 0/4-20 mA" },
  { id: "KL9100", brand: "beckhoff", name: "Potential Feed 24V", fn: "klbus", io: null, ch: 0, w: 12, ebus: 0, feed: true, pcFeed: true, desc: "KL power feed terminal — refresh 24 V power contacts" },
  { id: "KL9010", brand: "beckhoff", name: "KL Bus End Terminal", fn: "klbus", io: null, ch: 0, w: 12, ebus: 0, endcap: true, desc: "K-bus end terminal — required to close the terminal bus" },

  // ==========================================================================
  // 3. WAGO 750 I/O SYSTEM. Modular I/O on the internal 750 bus behind a
  // 750-354 EtherCAT fieldbus coupler. Modelled as rail terminals.
  // ==========================================================================
  { id: "750-354", brand: "wago", name: "EtherCAT Fieldbus Coupler", fn: "w750", io: null, ch: 0, w: 51, ebus: +2000, coupler: true, desc: "WAGO 750 EtherCAT coupler — hosts 750/753 I/O modules, X1 IN / X2 OUT" },
  { id: "750-430", brand: "wago", name: "8-Ch DI 24V 3ms", fn: "w750", io: "di", ch: 8, w: 12, ebus: -60, desc: "WAGO 750 digital input, 8-channel, 24 V DC" },
  { id: "750-1405", brand: "wago", name: "16-Ch DI 24V", fn: "w750", io: "di", ch: 16, w: 12, ebus: -70, hd: true, desc: "WAGO 750 digital input, 16-channel, 24 V DC" },
  { id: "750-530", brand: "wago", name: "8-Ch DO 24V 0.5A", fn: "w750", io: "do", ch: 8, w: 12, ebus: -70, upA: 4, desc: "WAGO 750 digital output, 8-channel, 24 V DC" },
  { id: "750-1504", brand: "wago", name: "16-Ch DO 24V", fn: "w750", io: "do", ch: 16, w: 12, ebus: -80, hd: true, desc: "WAGO 750 digital output, 16-channel, 24 V DC" },
  { id: "750-517", brand: "wago", name: "2-Ch Relay Output", fn: "w750", io: "do", ch: 2, w: 12, ebus: -70, relay: true, desc: "WAGO 750 relay output, 2×changeover, 230 V AC" },
  { id: "750-455", brand: "wago", name: "4-Ch AI 0-20mA", fn: "w750", io: "ai", ch: 4, w: 12, ebus: -65, desc: "WAGO 750 analog input, 0/4-20 mA" },
  { id: "750-459", brand: "wago", name: "4-Ch AI 0-10V", fn: "w750", io: "ai", ch: 4, w: 12, ebus: -65, desc: "WAGO 750 analog input, 0-10 V" },
  { id: "750-464", brand: "wago", name: "4-Ch AI RTD", fn: "w750", io: "ai", ch: 4, w: 12, ebus: -65, desc: "WAGO 750 analog input, RTD / PT100" },
  { id: "750-559", brand: "wago", name: "4-Ch AO 0-10V", fn: "w750", io: "ao", ch: 4, w: 12, ebus: -100, desc: "WAGO 750 analog output, 0-10 V" },
  { id: "750-602", brand: "wago", name: "Potential Feed 24V", fn: "w750", io: null, ch: 0, w: 12, ebus: 0, feed: true, pcFeed: true, desc: "WAGO 750 power supply module — refresh 24 V field supply" },
  { id: "750-600", brand: "wago", name: "750 End Module", fn: "w750", io: null, ch: 0, w: 12, ebus: 0, endcap: true, desc: "WAGO 750 bus end module — closes the internal I/O bus" },

  // ==========================================================================
  // 4. DEEPER SIEMENS (hardwired — no PROFINET/PROFIBUS; SIMOCODE excluded)
  // ==========================================================================
  { id: "SIEMENS-3NA-FUSE", brand: "siemens", name: "SENTRON 3NA NH Fuse Link", fn: "distb", free: true, kind: "box", fw: 44, fh: 108, io: null, ch: 0, w: 0, ebus: 0, ioconn: 2, desc: "LV HRC (NH) fuse link for fuse bases / switch-disconnectors" },
  { id: "SIEMENS-3NP1-BASE", brand: "siemens", name: "SENTRON 3NP Fuse Base", fn: "distb", free: true, kind: "disconnect", fw: 84, fh: 116, io: null, ch: 3, w: 0, ebus: 0, desc: "In-line fuse switch-disconnector base, 3-pole" },
  { id: "SIEMENS-5SD7-SPD", brand: "siemens", name: "SENTRON 5SD7 Surge Arrester", fn: "distb", free: true, kind: "box", fw: 44, fh: 100, io: null, ch: 0, w: 0, ebus: 0, ioconn: 2, desc: "Type 2 surge protective device (SPD)" },
  { id: "SIEMENS-3RT29-AUX", brand: "siemens", name: "SIRIUS 3RT29 Aux Contact Block", fn: "fld", free: true, kind: "relay", fw: 46, fh: 60, io: null, ch: 1, w: 0, ebus: 0, desc: "Auxiliary contact block for 3RT2 contactors" },
  { id: "SIEMENS-3RA2811", brand: "siemens", name: "SIRIUS 3RA28 Timing Module", fn: "fld", free: true, kind: "relay", fw: 46, fh: 88, io: null, ch: 1, w: 0, ebus: 0, desc: "Solid-state timing relay for star-delta / off-delay" },
  { id: "SIEMENS-3RM1", brand: "siemens", name: "SIRIUS 3RM1 Motor Starter", fn: "fld", free: true, kind: "contactor", fw: 44, fh: 116, io: null, ch: 3, w: 0, ebus: 0, desc: "Compact hybrid failsafe motor starter, 24 V control" },
  { id: "SIEMENS-3TK28", brand: "siemens", name: "SIRIUS 3TK28 Safety Relay", fn: "fld", free: true, kind: "box", fw: 46, fh: 108, io: null, ch: 0, w: 0, ebus: 0, safety: true, ioconn: 2, desc: "Safety relay for E-stop / guard monitoring, hardwired" },
  { id: "SIEMENS-3SU1-MUSH", brand: "siemens", name: "SIRIUS 3SU Mushroom Button", fn: "fld", free: true, kind: "btn", fw: 54, fh: 92, io: null, ch: 0, w: 0, ebus: 0, contacts: ["NO", "NC"], desc: "22 mm mushroom pushbutton (non-latching)" },
  { id: "SIEMENS-3SU1-BUZZER", brand: "siemens", name: "SIRIUS 3SU Buzzer", fn: "fld", free: true, kind: "btn", fw: 54, fh: 80, io: null, ch: 0, w: 0, ebus: 0, contacts: [], illum: true, desc: "22 mm acoustic signaling element, 24 V" },
  { id: "SIEMENS-8WD53-BEACON", brand: "siemens", name: "SIRIUS 8WD53 Beacon", fn: "fld", free: true, kind: "stack", fw: 62, fh: 150, io: null, ch: 3, w: 0, ebus: 0, lights: ["R", "Y", "G"], desc: "Rotating / flashing beacon, 24 V DC" },
  { id: "SIEMENS-3SE28-CABLE", brand: "siemens", name: "SIRIUS 3SE28 Cable-Pull E-Stop", fn: "fld", free: true, kind: "limit", fw: 52, fh: 96, io: null, ch: 0, w: 0, ebus: 0, safety: true, desc: "Cable-operated emergency-stop switch" },
  { id: "SIEMENS-3SE52-SAFE", brand: "siemens", name: "SIRIUS 3SE52 Safety Switch", fn: "fld", free: true, kind: "limit", fw: 52, fh: 96, io: null, ch: 0, w: 0, ebus: 0, safety: true, desc: "Interlock safety switch with separate actuator" },

  // ==========================================================================
  // 5. MORE FOR EXISTING BRANDS (hardwired; no PROFINET/PROFIBUS)
  // ==========================================================================
  { id: "EATON-DILM-AUX", brand: "eaton", name: "DILM Aux Contact Block", fn: "fld", free: true, kind: "relay", fw: 46, fh: 60, io: null, ch: 1, w: 0, ebus: 0, desc: "Auxiliary contact block for DILM contactors" },
  { id: "EATON-M22-MUSH", brand: "eaton", name: "M22 Mushroom Button", fn: "fld", free: true, kind: "btn", fw: 54, fh: 92, io: null, ch: 0, w: 0, ebus: 0, contacts: ["NO", "NC"], desc: "22 mm mushroom pushbutton" },
  { id: "SCHNEIDER-LR2", brand: "schneider", name: "TeSys LR2 Thermal Overload", fn: "fld", free: true, kind: "box", fw: 46, fh: 92, io: null, ch: 0, w: 0, ebus: 0, ioconn: 2, desc: "Thermal overload relay (K-frame contactors)" },
  { id: "SCHNEIDER-XB5-MUSH", brand: "schneider", name: "Harmony Mushroom Button", fn: "fld", free: true, kind: "btn", fw: 54, fh: 92, io: null, ch: 0, w: 0, ebus: 0, contacts: ["NO", "NC"], desc: "22 mm mushroom pushbutton" },
  { id: "OMRON-G3NA", brand: "omron", name: "G3NA Solid-State Relay", fn: "fld", free: true, kind: "relay", fw: 46, fh: 100, io: null, ch: 1, w: 0, ebus: 0, desc: "Panel-mount SSR, DC control / AC load" },
  { id: "OMRON-61F", brand: "omron", name: "61F Level Relay", fn: "fld", free: true, kind: "box", fw: 44, fh: 96, io: null, ch: 0, w: 0, ebus: 0, ioconn: 2, desc: "Conductive-level / float-less monitoring relay" },
  { id: "PHOENIX-TERMITRAB", brand: "phoenix", name: "TERMITRAB Surge Protection", fn: "distb", free: true, kind: "box", fw: 22, fh: 96, io: null, ch: 0, w: 0, ebus: 0, ioconn: 2, desc: "Narrow signal / power surge protection device" },
  { id: "MURR-EMPARRO-DIODE", brand: "murr", name: "Emparro Redundancy Diode", fn: "psu", free: true, kind: "box", fw: 44, fh: 100, io: null, ch: 0, w: 0, ebus: 0, ioconn: 2, desc: "Redundancy / decoupling module for parallel 24 V PSUs" },
];
