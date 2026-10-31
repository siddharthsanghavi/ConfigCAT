/* Scenes for scripts/shots/shoot.mjs -- see that file for the step vocabulary.
 *
 * Point labels come from the app itself; list them for any scene with
 *   npm run shots -- --labels <scene>
 * Coordinates for free-placed devices are canvas pixels.
 */

const M = "−"; // the app labels negative/0 V points with a real minus sign

const rail = (id, catIds, uidPrefix, start = 1) => ({
  id,
  items: catIds.map((catId, i) => ({ uid: `${uidPrefix}${start + i}`, catId })),
});

// ---- a realistic two-station pick-and-place cell ---------------------------------
// Station 1 carries the I/O and the TwinSAFE group (EL1904 / EL2904 with an EL6910
// logic, so FSoE is complete); EK1110 hands the EtherCAT line to station 2, which
// continues through the servo drive, an IP67 box and a valve terminal. Field
// devices sit in the free band right of rail 2, bottom-aligned on its DIN rail.
export const CELL = {
  name: "Line 3 · Pick & place cell",
  rails: [
    rail("r1", ["EK1100", "EL1008", "EL1008", "EL2008", "EL3004", "EL4004", "EL9410",
      "EL1904", "EL2904", "EL6910", "EK1110", "EL9011"], "u", 1),
    rail("r2", ["EK1101-0010", "EL1809", "EL2809", "EL9011"], "u", 20),
  ],
  free: [
    { uid: "f1", catId: "SOURCE-DC24", x: 392, y: 610 },
    { uid: "f2", catId: "AX5103", x: 486, y: 480 },
    { uid: "f3", catId: "AM8031", x: 592, y: 594 },
    { uid: "f4", catId: "BANNER-QS18", x: 724, y: 578 },
    { uid: "f6", catId: "EATON-M22-ESTOP", x: 780, y: 594 },
    { uid: "f7", catId: "BANNER-TL50", x: 854, y: 540 },
    { uid: "f8", catId: "EP2338-0001", x: 934, y: 540 },
    { uid: "f9", catId: "SMC-EX600", x: 840, y: 60 },          // above, right of rail 1
  ],
  wires: [],
};

// every one of these goes through the app's own wire tool, which picks the cable
const CELL_WIRES = [
  [["f1", "+"], ["u1", "24V"]],          // 24 V feed to both couplers
  [["f1", M], ["u1", "0V"]],
  [["f1", "+"], ["u20", "24V"]],
  [["f1", M], ["u20", "0V"]],
  [["u11", "OUT"], ["u20", "X1"]],       // EtherCAT: station 1 -> station 2 ->
  [["u20", "X2"], ["f2", "X1"]],         //   servo drive -> IP67 box -> valve terminal
  [["f2", "X2"], ["f8", "X1"]],
  [["f8", "X2"], ["f9", "X1"]],
  [["f2", "OCT"], ["f3", "OCT"]],        // one-cable motor connection
  [["f4", "BK"], ["u21", "1"]],          // sensor -> digital input
  [["u22", "1"], ["f7", "R"]],           // digital outputs -> stack light
  [["u22", "2"], ["f7", "Y"]],
  [["u22", "3"], ["f7", "G"]],
  [["f6", "11"], ["u8", "1"]],           // e-stop -> TwinSAFE input
  [["f6", "21"], ["u8", "2"]],
];

// ---- topology: every rule the network view knows ---------------------------------
const TOPO = {
  name: "Topology walkthrough",
  rails: [
    rail("r1", ["EK1100", "EL1008", "EL2008", "EK1122", "EL9410", "EK1110", "EL9011"], "t", 1),
    rail("r2", ["EK1101-0010", "EL1904", "EL2904", "EL6910", "EL9011"], "t", 20),
    rail("r3", ["PS1011-2410", "EL1008", "EL9011"], "t", 30),   // no coupler: off the network
  ],
  free: [
    { uid: "g1", catId: "ABB-ACS355", x: 60, y: 900 },
    { uid: "g2", catId: "BALLUFF-IO-Link-Master", x: 200, y: 900 },
    { uid: "g3", catId: "EP2338-0001", x: 330, y: 900 },
  ],
  wires: [],
};

// ---- validation: three distinct problems whose messages all fit the panel's ---------
// 190 px issue list (the stranded-terminal and TwinSAFE messages run ~6 lines each)
const BROKEN = {
  name: "Station with problems",
  rails: [
    // a terminal placed after the EK1110 extension
    rail("r1", ["EK1100", "EL2008", "EK1110", "EL3004", "EL9011"], "b", 1),
    // a condition-monitoring station drawing 2050 mA from a 2000 mA coupler
    rail("r2", ["EK1100", "EL1008", "EL1008", "EL2008", "EL2008", "EL3174", "EL3174", "EL3174",
      "EL3174", "EL3632", "EL3632", "EL3681", "EL6614", "EL9011"], "b", 20),
    // a station with no end cover
    rail("r3", ["EK1100", "EL1008"], "b", 40),
  ],
  free: [],
  wires: [],
};

// ---- a small design for showing an ETG-directory part in the inspector -------------
const ETG_PART = {
  name: "Directory part",
  rails: [rail("r1", ["EK1100", "EL1008", "EL9011"], "e", 1)],
  free: [{ uid: "e10", catId: "ABB-ACS355", x: 300, y: 380 }],
  wires: [],
};

// ---- earlier saves for the library dialog (the cell itself is saved live) ----------
const day = (d, h) => new Date(Date.UTC(2026, 9, d, h, 15)).toISOString();
const saved = (id, name, savedAt, rails, free = []) =>
  [id, { id, name, savedAt, doc: { name, rails, free, wires: [] } }];
const LIBRARY = Object.fromEntries([
  saved("p2", "Palletiser safety upgrade", day(26, 10),
    [rail("r1", ["EK1100", "EL1904", "EL2904", "EL6910", "EL9011"], "s", 1)]),
  saved("p3", "Conveyor 4 · remote I/O", day(24, 14),
    [rail("r1", ["EK1101-0010", "EL1809", "EL2809", "EL9011"], "c", 1)],
    [{ uid: "c10", catId: "EP2338-0001", x: 300, y: 380 }]),
  saved("p4", "Test bench (spare)", day(19, 9),
    [rail("r1", ["EK1100", "EL3004", "EL4004", "EL9011"], "x", 1)]),
]);

// ---- the scenes ------------------------------------------------------------------------
export const SCENES = [
  {
    name: "hero",
    doc: CELL,
    // the canvas grows to the rightmost device + 90 px; 1680 lets all of it show
    viewport: { width: 1680, height: 1000 },
    steps: [
      { wires: CELL_WIRES },
      { expect: { wires: CELL_WIRES.length } },
      { select: "f2" },
      { shot: { name: "hero", region: "viewport",
        caption: "A wired two-station cell: TwinSAFE group, EtherCAT chained through a servo drive, IP67 box and valve terminal" } },
    ],
  },
  {
    name: "wiring",
    doc: CELL,
    viewport: { width: 1680, height: 490 },            // short: just rail 2 and its devices
    steps: [
      { wires: CELL_WIRES.slice(0, 13) },
      { pending: ["u22", "4"] },                       // half-made: tool shows its prompt
      { scroll: { region: "canvas", y: 420 } },         // bring rail 2 under the tool bar
      { expect: { text: /^From EL2809/ } },
      { shot: { name: "wiring", region: "stage",
        caption: "Wire tool mid-connection — press two points and the right cable is chosen for you" } },
    ],
  },
  {
    name: "topology",
    doc: TOPO,
    viewport: { width: 900, height: 1400 },             // narrow: the modal hugs the drawing
    steps: [
      { press: "Topology" },
      { expect: { text: "Not on the E-bus" } },
      { shot: { name: "topology", region: "modal",
        caption: "EtherCAT topology in the style of TwinCAT: E-bus and RJ45 links, a junction drop line, and devices that are not on the network" } },
    ],
  },
  {
    name: "diagram",
    doc: CELL,
    viewport: { width: 2400, height: 1000 },            // wide: the whole diagram, no scrolling
    steps: [
      { wires: CELL_WIRES },
      { wireMode: false },
      { press: "Diagram" },
      { expect: { text: "Device-to-device overview" } },
      { shot: { name: "diagram", region: "modal",
        caption: "Electrical connection diagram, exportable as PDF with a cable schedule" } },
    ],
  },
  {
    name: "simulate",
    doc: CELL,
    viewport: { width: 1680, height: 1260 },            // tall: the sim panel docks under the canvas
    steps: [
      { wires: CELL_WIRES },
      { wire: [["f1", "+"], ["u20", "+"]] },          // the cell feeds only Us; outputs switch Up
      { wire: [["f1", M], ["u20", M]] },
      { wire: [["f7", "C"], ["f1", M]] },             // the stack light's common, or no lamp can light
      { wireMode: false },
      { press: "▶ Simulate" },
      { expect: { text: "PLC RUN" } },
      { actuate: "f4" },                                // the sensor sees its target
      { wait: 400 },
      { shot: { name: "simulate", region: "viewport",
        caption: "Simulate: a TwinCAT master runs the I/O check program; the sensor lights its input LED, the stack light follows the output" } },
    ],
  },
  {
    name: "palette",
    doc: CELL,
    steps: [
      { expand: ["!Couplers & Junctions", "Panels & HMI"] },
      { shot: { name: "palette", region: "palette", maxHeight: 720,
        caption: "Palette by company, then category" } },
    ],
  },
  {
    name: "search",
    doc: CELL,
    steps: [
      { search: "AX8" },
      { expect: { text: "BECKHOFF-AX8000" } },
      { shot: { name: "search", region: "palette", maxHeight: 520,
        caption: "One company folder holds curated parts and ETG-directory parts side by side" } },
    ],
  },
  {
    name: "etg-part",
    doc: ETG_PART,
    steps: [
      { select: "e10" },
      { expect: { text: "ETG directory entry" } },
      { shot: { name: "etg-part", region: "inspector", maxHeight: 700,
        caption: "Every ETG-directory part says what is real (vendor, listing, link) and what is a representative default" } },
    ],
  },
  {
    name: "validation",
    doc: BROKEN,
    steps: [
      { expect: { text: "2 errors · 1 warning" } },
      { expect: { text: "E-bus over budget at EL6614" } },
      { shot: { name: "validation", region: "inspector", maxHeight: 516,
        caption: "Validation catches rail-structure and E-bus budget problems as you build, and says how to fix them" } },
    ],
  },
  {
    name: "projects",
    doc: CELL,
    library: LIBRARY,
    steps: [
      { wires: CELL_WIRES },
      { wireMode: false },
      { press: "Projects" },                // save the wired cell through the real dialog,
      { press: "Save current" },            // then reopen it to show the library
      { press: "Projects" },
      { expect: { text: "15 wire(s)" } },
      { shot: { name: "projects", region: "modal",
        caption: "Named projects saved in the browser, plus JSON save and import" } },
    ],
  },
  {
    name: "about",
    doc: CELL,
    steps: [
      { press: "About" },
      { shot: { name: "about", region: "modal",
        caption: "The About dialog ships the licence, trademark and data-source notices inside the app" } },
    ],
  },
];
