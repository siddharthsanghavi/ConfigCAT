# Sid's EtherCAT Configurator — Feature Documentation

A single-file, offline web app for visually building Beckhoff EtherCAT
stations and multi-vendor control panels, wiring them, validating them,
and exporting documentation. Deliverable: **`Sids-EtherCAT-Configurator.html`**
— double-click to open in any browser, no server or install needed.

---

## 1. Canvas & layout
- **DIN-rail terminal strips**: couplers/embedded PCs + EL terminals drawn
  to scale (4.4 px/mm), positioned by cumulative width.
- **Multiple rails**, add/remove, per-rail E-bus budget readout.
- **Free-placed components** (PCs, panels, drives, motors, field devices,
  IP67 boxes, power/distribution, safety, pneumatics): dragged anywhere,
  canvas auto-expands and scrolls in all directions.
- **Silver rail-latch nubs** between terminals.
- **Multiple stations per rail**: a single DIN rail can carry several
  separate groups. Devices are never added dangling past an end cover —
  a normal add slots in before the trailing cover. To start a *separate*
  station on the same rail, arm **＋ new group** (a one-shot toggle in the
  ADD TO row) and add a coupler: it's placed after the end cover with a
  visible gap. Any rail terminal also has a **Gap before (mm)** field in
  the inspector to set the separation manually.
- **Visible backplane buses**: the two buses that are made by clipping
  terminals together — not by any drawn cable — are shown in the clear
  lanes around each rail. A teal **E-BUS** bar above the terminals spans
  the EtherCAT-communication backplane (and shows the **FSoE** black-
  channel span when a safety loop is active); **POWER CONTACTS (Up)**
  bars below the rail show each potential group coloured by voltage
  (green 24 V, orange 230 V, grey = no feed) and labelled with its source
  terminal. Drawn **per station** and terminated at each end cover, so a
  second gapped group gets its own buses and nothing shows past a cover.
  Makes "what's connected to what" legible without wiring.

## 2. Catalog (~660 parts, 21 manufacturers, all branded)
- **Power sources / feeds**: incoming-supply blocks — **DC 12/24/48 V** and
  **1-phase 120/240/300 V** and **3-phase 208/240/400/480/600 V AC** — with
  the right terminals (DC +/−/PE, AC L·N·PE or L1·L2·L3·N·PE). Wireable to
  contactors, motors, PSUs and 24 V devices.
- **Beckhoff KL Bus Terminals (K-bus)** behind a **BK1120** coupler, and the
  **WAGO 750 I/O** system behind a **750-354** EtherCAT coupler. (The
  terminals are K-bus / 750-bus, not native EtherCAT — bridged by the coupler.)
- Bulk expansion parts live in **`src/catalog-extended.js`** (spread into the
  catalog at load) so the core `catalog.js` stays lean.
- **Large control-gear expansion**: contactors, soft starters &
  solid-state contactors, thermal/electronic overload relays, motor
  protectors, MCB/MCCB, switch-disconnectors, control/timing/interface
  relays, monitoring relays, hardwired safety relays, 22 mm command &
  signaling (buttons, selectors, key switches, pilot lights, E-stops),
  signal towers, and position/limit switches — across **Siemens SIRIUS/
  SENTRON, Eaton, Schneider, Omron, Phoenix Contact, WAGO, Weidmüller,
  AutomationDirect and Murr**. Everything is **hardwired (digital) or
  EtherCAT — no PROFINET/PROFIBUS bus devices** (e.g. SIMOCODE is
  deliberately excluded). Rating ranges are modelled with variants.
- Includes IPC accessories: **UPS modules** (CU8110 capacitive, CU8130
  battery, C9900-U330 external), the **CX2100-0914 system power supply +
  UPS** with its matching **battery pack** (CX2900-0192), and the
  **cabinet dome** (CU8210-M001 WLAN/mobile antenna). Embedded-PC (CX) and
  Industrial-PC (C-series) coverage expanded (CX8110, CX5140, C6027, C6905).
- **Beckhoff**: couplers/junctions (EK), embedded PCs (CX), industrial
  PCs (C6/C7), panels (CP), servo drives/motors (AX/AM), power supplies
  (PS 1-/3-phase), full EL terminal families (DI/DO/AI/AO/encoder/comm/
  motion/system), TwinSAFE, and **EtherCAT Box IP67** (EP/EPP/EQ).
- **Third-party** (representative real part numbers, approximate specs):
  WAGO, Murr, Banner, Eaton, Balluff, SMC, Festo, igus, Leuze, Siemens,
  Phoenix Contact, SICK, Turck, ifm, Pilz, Schneider, Kollmorgen, Omron,
  AutomationDirect, Weidmüller.
- **Component types**: sensors (inductive/photo/ultrasonic/pressure/temp/
  flow/RFID/barcode/encoder), operators (buttons, E-stops, selectors,
  pilot lights, stack lights), switching/protection (contactors, circuit
  breakers, **main disconnect switches / power shutoffs**, relays,
  electronic fuses), power & distribution (supplies, UPS, busbars),
  safety (light curtains, laser scanners, safety relays, door switches),
  pneumatics (valve manifolds, valves, regulators), IP67 I/O & IO-Link
  masters, 3rd-party EtherCAT drives & motors.
- **No non-electrical parts** — every catalog item has electrical
  connection points.
- **Variants**: devices expose a variant dropdown in the inspector
  (e.g. EP6224 → -0002 / -0022 / -0042 / -0092 / -2022). The resolved
  part number flows through the BOM, on-screen label, and XML export.
  Series that differ only by rating (PSU amperage, contactor size) are
  modelled as one entry + variants rather than many near-duplicates.
- **Adding parts is low-friction**: new catalog entries are auto-filed
  into the correct palette group from their `kind`/`fn`, so no GROUPS
  edit is needed.

## 3. Palette
- **Collapsible groups** by function, with counts.
- **Search** by part number or name.
- **Manufacturer filter** dropdown (All + every brand present).

## 4. Wiring
- **Smart auto-cable**: press a point, click/drag-release on the target —
  the correct cable is chosen from what the two points are, matched to
  Beckhoff's ZB/ZK cable program plus USB/HDMI/DP/DVI.
- **Feasibility enforced**: incompatible pairs (port↔clamp, RJ45↔fiber)
  are blocked; the inspector's "change cable" list shows only cables
  that physically fit.
- **Cable color convention**: red = +24 V, black = 0 V, blue = 24 V
  signal, orange = AC, GN/YE = PE, gray = shielded analog/encoder.
- **Highlighting**:
  - EtherCAT-capable cables get a green glow.
  - **Safety over EtherCAT (FSoE)** rides the EtherCAT cabling and the
    E-bus backplane — never the field wiring. It blinks **yellow** only
    when the station has both TwinSAFE safe I/O *and* a TwinSAFE Logic
    (EL6910/EL6930/EK1960 or a TwinCAT Safety PLC) to act as FSoE master.
    Hardwired safety devices (E-stops, safety relays, curtains) no longer
    false-trigger it, and 24 V field wires to a safe terminal are never
    mislabelled as FSoE.
  - **IO-Link** segments (any wire touching a C/Q port) blink **blue**.
- **Clean routing**: wires run just below the lower of the two connection
  points (not down to the rail), so they hug their ports and cover as
  little of the devices as possible; staggered lanes keep parallel runs
  readable; live preview while dragging; wires track a component in real
  time as it's moved.
- **Role-colored connection points**: every terminal has a colored halo
  (red/black/green/amber/…) so its purpose is obvious at a glance.

## 5. Validation (MX-System-Designer style)
- Rail structure, **per station** (each coupler…end-cover segment on a
  rail is validated independently: must start with coupler/CX; end-cover
  reminder; EK1110 placement; devices stranded past a cover flagged).
- E-bus budget with EL9410 placement suggestion.
- Power-contact (Up) 10 A budget & potential-group tracking.
- 230 V/24 V mixing, Hot-Connect ID uniqueness, PSU sizing.
- **TwinSAFE**: safe I/O needs an FSoE master, but that is **not**
  necessarily an EL6910. It can be a TwinSAFE Logic terminal
  (EL6910/EL6930), the EK1960 compact controller, a safe terminal with
  **integrated logic (EL1918)**, or a **TwinCAT Safety PLC** running on
  any Beckhoff IPC/embedded PC. The validator warns only when none of
  these is present (and softens the note when an embedded PC that could
  host the Safety PLC is on the rail).
- Wiring faults: shorts, back-feed, media mismatches, port↔clamp.

## 6. Motion animation & powered indicators
Motors, drives, and linear axes **animate** (spinning rotor / sliding
carriage) once they are wired to a power + data source. Terminal **LEDs
light only when the device actually receives power** — i.e. it sits in a
coupler/embedded-PC-fed segment before the end cover. Terminals stranded
past an end cover (or with no coupler in their segment) stay dark.

## 7. Manufacturer badges
Every free component shows a **wordmark badge** (brand name in the
brand's color) on its right side. Note: these are name-in-color badges,
**not** reproductions of copyrighted logo artwork.

## 8. Detail view & diagram
- **Detail view**: double-click a terminal for a zoomed drawing + full
  point-assignment table + external lookup link.
- **Diagram**: device-to-device overview using the real component
  drawings (assembled rail strips), non-overlapping lanes, with a config
  panel to choose which nodes/pages go into the **PDF export**
  (overview page + cable schedule).
- **EtherCAT Topology**: a network view showing the logical slave order —
  master → coupler → terminals (over the E-bus) → extension → next
  station. Each coupler-headed segment is a station row; free EtherCAT
  field devices (EP boxes, drives) appear as attached nodes. Exports PNG.

## 9. Persistence & export
- **Autosave** to localStorage; **Save/Load** project JSON.
- **Excel (.xls)** BOM export — genuine SpreadsheetML spreadsheet with
  a Bill-of-Materials sheet (Qty, Part Number, Manufacturer, Description,
  Category) and a Cables sheet.
- **PNG** of the station, **PDF** wiring diagram, **XML** TwinCAT-style
  device list (variant-aware).
- **Undo/redo** (Ctrl+Z/Y), duplicate, delete, Escape to cancel.

---

## Recently done
- **FSoE realism fix** — Safety over EtherCAT now models the real black-
  channel behaviour: it rides only EtherCAT cabling + the E-bus backplane,
  requires both safe I/O and a TwinSAFE Logic, and never appears on field
  wiring. New validation warning for safe I/O with no logic.
- **Visible backplane** — E-bus and power-contact potential groups drawn
  as bars in the lanes around each rail (see §1).
- **Multiple stations per rail** — devices can't be added dangling past
  an end cover (they slot in before it); a ＋ new group toggle / inspector
  gap starts a separate, visibly-gapped station on the same rail. Backplane
  and validation both run per station segment.
- **Direct wire routing** — wires hug their ports instead of dropping to
  the rail, greatly reducing overhang/coverage.
- **Powered-only LEDs** — terminal LEDs light only when the device is fed
  by a coupler/embedded PC (dark when stranded).
- **TwinSAFE master rules corrected** — EL1918 integrated logic and the
  TwinCAT Safety PLC count as FSoE masters (an EL6910 is not required).
- **EtherCAT Topology view** (see §8) + IPC accessories in the catalog
  (UPS/battery/dome; see §2).

## Roadmap / not yet done

*Original items:*
1. **Exhaustive catalog & variants** — the catalog is a broad
   representative set, not every SKU. A generated `catalog.json` scraped
   from beckhoff.com/infosys (and vendor sites) would give full family
   coverage and every variant suffix. Third-party specs are approximate.
2. **True `.xlsx`** (Office Open XML) export — currently SpreadsheetML
   `.xls` (opens as a real spreadsheet; Excel may show a format-notice).
   Bundling SheetJS would remove the notice.
3. **Real product imagery** — faces are original stylized SVG. A
   photo-accurate render would need per-part reference art.
4. **Obstacle-avoiding wire routing** with a per-wire duct override.
5. **On-canvas drag-to-reorder** of free components onto rails / groups;
   snapping and alignment guides.
6. **IO-Link topology rules** — enforce one device per master port,
   port class (A/B) compatibility, and process-data width.
7. **Cable length estimation** & wire-duct fill for the BOM.
8. **Multi-rail EtherCAT topology** (junction/branch modelling) and
   automatic frame/bandwidth calculation.
9. **Project templates / library** and shareable links.
10. **Per-part datasheet deep links** for third-party brands.

*Proposed (2026-07-24 review — WAGO Smart Designer gap analysis + realism):*

Electrical accuracy
11. **Analog signal-type per channel** — 0–10 V / 4–20 mA / RTD / TC /
    2-3-4-wire per AI channel; validate against the wired sensor and flag
    missing excitation/feed.
12. **24 V load budget with diversity factor** — roll up sensor + I/O +
    coupler draw with a utilisation factor, per PSU (beyond worst-case).
13. **Heat / power-dissipation estimate** — per-device loss summed for
    cabinet thermal load + climate-control sizing hint.
14. **Power-feed auto-insert (one-click)** — the existing EL9410 /
    EL91xx / EL9080 *warnings* place the terminal at the right index.
15. **Motor↔drive sizing helper** — match AX drive to AM motor
    (current/voltage/OCT compatibility); warn on mismatch.
16. **Redundancy modelling** — EtherCAT cable ring / second master port;
    flag single points of failure.

Network / EtherCAT
17. **Bandwidth + cycle-time estimate** — process-image bytes → frame
    length → minimum cycle time; warn when device count exceeds a target.
18. **Logical topology view** — network graph of couplers/junctions/EP
    boxes showing EtherCAT traversal order (line/star/tree).
19. **Hot-Connect group modelling** — define groups, assign devices,
    validate ID switches per group.
20. **ESI import** — parse Beckhoff/vendor ESI XML to auto-populate
    identity + PDO/process-data (biggest accuracy multiplier).
21. **Firmware / HW revision fields** — per terminal, warn on known
    coupler/terminal incompatibilities.
22. **Scan-compare** — import a real TwinCAT `EtherCAT > Scan` and diff
    against the design (missing / extra / mismatched); closes the loop on
    the existing XML device-list export.

Documentation / export
23. **Cable schedule (from–to list)** — wire#, from device.point, to
    device.point, type, gauge, length → CSV/Excel.
24. **Auto device tags + terminal numbering** — IEC 81346 designations
    and terminal numbers flowing into BOM, marking, and cable schedule.
25. **Spare-capacity report** — free DI/DO/AI/AO channels, spare E-bus
    mA, spare Up amps, spare rail mm, as a "% spare" summary.
26. **BOM enrichment** — group by manufacturer, optional unit price /
    lead-time, subtotals → purchasing-ready.
27. **Print-ready sheet + title block** — A3 layout PDF with a real
    title block (project, author, rev, date).

Layout / workflow
28. **Cabinet / enclosure layout** — place rails, wireways/ducts and
    DIN-rail lengths in a cabinet outline; rail-fill % and duct-fill %.
29. **Starter templates / station library** — droppable pre-built rails
    and reusable sub-assemblies.
30. **Project revisions + change history** — named snapshots with a diff.

WAGO-Smart-Designer parity items still open: terminal-strip modelling
with jumpers/potential-combs, marker-strip printout, parametric part
finder, CAE (EPLAN/WSCAD/Zuken) interchange, CAD/DXF geometry export.
The "no non-electrical parts" rule blocks mechanical accessory
enforcement (end plates / end stops); revisit that rule if that check is
wanted.
