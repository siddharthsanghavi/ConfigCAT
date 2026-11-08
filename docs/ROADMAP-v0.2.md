# v0.2 plan — from configurator to bench

v0.1 draws a station and checks it. v0.2 makes the station **run**: power it
up, program it, measure it, break it, and hand it to TwinCAT.

Branch: `v0.2-dev` (cut from `main` at v0.1, `573856d`). Merge back to `main`
when the milestones marked **v0.2 scope** are done; everything else rolls to
v0.3.

## Where the ideas come from

**CodePLC Labs** (codeplc.com) is the nearest comparison: a browser lab
with trainer benches, a multimeter bench, 13 machines with prints,
lockout / prove-dead work orders, a built-in IEC 61131-3 PLC (ST + LD),
an optional Windows "Connector" that bridges a real PLC over Modbus TCP,
and scored checkpoints. What it does **not** have, and ConfigCAT does: real
part numbers, EtherCAT topology and E-bus maths, a BOM, and a free-form
build canvas. CodePLC teaches on machines someone else built; ConfigCAT
lets you build the machine. v0.2 adds the half CodePLC has and we don't:
a running, measurable, breakable circuit.

**PLCSIM** (`../PLCSIM`, 9 local commits) already provides the PLC: four
IEC languages, a scan-cycle `Controller`, 241 controller profiles, IDE skins,
and an EtherCAT edition that imports ConfigCAT project files and builds a
real process image (`fromConfigCat → buildProcessImage → networkToDevice`).
The engine is headless and has no DOM dependency. Its UI is vanilla DOM with
a handful of `getElementById` / `querySelector` calls, so mounting it is a small
refactor, not a rewrite.

> ⚠ PLCSIM's GitHub repo is **empty**. The local `main` tracks
> `origin/main`, which no longer exists, so none of the 9 commits have been
> pushed. PLCSIM also has no LICENSE file. Both need fixing before ConfigCAT
> can depend on it.

---

## Milestones

### M0 · Foundations — v0.2 scope
Everything below depends on a model of "what is electrically connected to
what". Build that once, test it, and fix known disagreements first.

- **Vitest** for `pointGeom`, `validate.js`, E-bus maths, BOM, and the new
  net solver. (CLAUDE.md already asks for this.)
- **Net graph** `src/sim/nets.js`: union-find over wires, plus each device's
  *internal* links (rail power contacts carrying Up/Us along the rail,
  EL9410/EL91xx feeds, `pcBreak`, a coupler's 24 V/0 V terminals to the
  contacts, a lamp's two terminals through its load). The output is nets with
  members and a role (24 V, 0 V, PE, signal, analog, EtherCAT).
- **Align `validate.js` with the topology rules.** Today validation splits
  E-bus segments only at end covers and treats PSUs as transparent. Topology
  also breaks at gaps, PSUs and the next coupler. One shared
  `ebusSegments()` should feed both.
- **Doc schema version** (`doc.v = 2`) and a migration in `sanitizeDoc`, so
  sim state (faults, meter probes, PLC program) can be saved with a project
  without breaking v0.1 files.
- **Split `App.jsx`** (3,800 lines): move new code into `src/sim/`,
  `src/instruments/`, `src/plc/`, `src/twincat/` rather than growing the
  monolith.

*Done when* every wire in the hero scene resolves to the expected net in a
unit test, and validation and topology agree on all three BROKEN-scene
stations.

### M1 · Electrical simulation core — v0.2 scope
A quasi-static DC/AC model, not SPICE. It answers "what voltage is on this
point, is this load on, and which way does current flow", updated every
sim tick.

- **Sources:** each PSU sets its output nets to nominal (24 V DC; AC mains
  for supply inputs). There is an on/off state per supply, and a **main
  disconnect** device that can be locked.
- **Device behaviour models** keyed by `kind`/`fn`: pushbutton and E-stop
  (contacts), sensors (PNP/NPN output from a target state), lamp/stack light
  (lit when it sees ≥ 19 V across it), contactor/relay (coil → contacts),
  valve coil, motor (follows its drive's enable/velocity), DI channel (reads
  the IEC 61131-2 type 1/3 thresholds: ON ≥ 11 V, OFF ≤ 5 V), DO channel
  (sources Up when commanded and Up is present), AI/AO (0–10 V / 4–20 mA
  values). Anything unmodelled is *passive* and labelled as such.
- **Load currents** summed per net and per supply. This closes the 24 V
  budget (roadmap #12) with real switching states instead of the worst case.
- **Fault injection:** open wire, high-resistance joint, short to 0 V,
  short to PE, blown fuse / tripped breaker, failed sensor (stuck on/off),
  swapped wires, missing Up feed, E-bus break, slave stuck in SAFEOP. Faults
  are hidden from the canvas by default, which makes them a puzzle.
- **Sim clock** `src/sim/clock.js`: one tick per PLC cycle (default 1 ms,
  from the task cycle). A ring buffer of sampled values feeds the scope.

### M2 · Instruments — v0.2 scope
Both instruments float over the canvas as panels. Their probes clip onto
connection points with the same picking as wire mode, using the existing
`data-pt` targets.

**Multimeter**
- Modes: V DC, V AC, Ω, continuity (beeps under ~10 Ω), mA DC, diode.
- Red/black probes go on any two points. The reading is the potential
  difference between their nets. A floating net reads a few volts of drift,
  not a clean 0, so that "dead" has to be proven, not assumed.
- **Ω on a live circuit** shows a warning and a nonsense reading, as a real
  meter would. Ω works properly only when the circuit is isolated.
- **Current is series-only.** Choose mA mode, then pick a wire to "break
  in"; the meter is inserted into that wire. Probing two nets in mA mode
  across a supply "blows the meter fuse" (a teaching moment, recoverable).
- **Prove dead:** a live-dead-live test sequence (check the meter on a known
  source, test, check again) logged for the LOTO exercise in M5.

**Oscilloscope**
- 2 or 4 channels. A source is either a **point** (voltage against a chosen
  reference net, default 0 V) or a **tag** (any PLC variable or
  process-image entry), so you can put "DO 3 commanded" next to "DO 3 terminal
  voltage" and see the cycle delay.
- Timebase 100 µs – 10 s/div; volts/div; trigger edge/level, auto / normal /
  single; two cursors with Δt / Δv; run/stop; CSV export of the buffer.
- What it is good for here: output timing versus PLC cycle, a pushbutton
  debouncing in logic, PWM terminals (EL25xx), encoder A/B from motor speed
  (EL51xx), 4–20 mA ramps, the delay on an E-stop chain, and an
  **EtherCAT view** showing frame cycles and working-counter errors when a
  fault is injected.
- It is a logic/quasi-static scope sampled at the sim tick, and the UI says
  so. Ringing and analog edges are not simulated.

*Done when* the hero cell can be powered, a pushbutton probed at 24 V/0 V,
an E-stop opened and measured with the meter, and a DO toggled by the PLC
captured on the scope with a one-cycle delay.

### M3 · PLCSIM inside ConfigCAT — v0.2 scope
**Run** mode in the header turns the design into a live station driven by
PLCSIM's engine.

**Controller scope (decided): EtherCAT masters only.** That means Beckhoff
TwinCAT (CX / C6 / user mode), CODESYS EtherCAT Master SL, and Omron
Sysmac (NX/NJ/NY). PLCSIM's Rockwell, Siemens and other non-EtherCAT
profiles are not carried over.

**Status (on `v0.2-dev`):** first slice built. It includes ▶ Simulate, the
engine vendored into `src/plcsim/` (copy of PLCSIM @ 4e9dba6, chosen until
the submodule/merge decision below), the ST editor with VAR/AT, the INIT→OP
state machine, forcing, the electrical solver (pulled forward from M1), and
live LEDs on every face. Still to do from this section: the LD/FBD/SFC
editors, right-click forcing on the canvas, inspector tag values, and the
schema v2 bump.

- **Data path, with no file round-trip:** `fromConfigCat(doc)` →
  `buildProcessImage` → `networkToDevice` → `new Controller(project)`. In
  process, PLCSIM reads ConfigCAT's catalog directly, so its bundled 162 KB
  `configcat-catalog.json` is not needed. Encoder, comms and drive terminals,
  which PLCSIM imports as passive today, get their PDO shapes from catalog
  fields we add (see M4 ESI).
- **Scan loop:** each tick, DI channel voltages from M1 → `controller.io.inputs`
  → scan → `controller.io.outputs` → DO channels → M1 loads. The EtherCAT
  state machine gates it: outputs drive only in OP, as PLCSIM already models.
- **Editor:** mount PLCSIM's existing LD/FBD/SFC/ST UI in a docked panel or
  tab. That means refactoring its `app.js` to take a root element instead of
  global ids, and namespacing its CSS. IDE skins come along for free;
  TwinCAT XAE becomes the default skin when the master is a CX/C6.
- **Online on the canvas:** energised wires glow, channel LEDs on terminal
  faces follow the process image, motors and lamps animate (most of these
  visuals already exist, driven by placeholders today), and tag values show
  in the inspector for the selected terminal.
- **Forcing:** right-click a channel → force on/off/value, shown in a
  forced-I/O list, as on a real controller.
- The project file carries the program: `doc.plc = { project }` (schema v2).

**How to combine the repos** (decision needed, recommendation first):

1. **Git submodule** `vendor/PLCSIM`, imported by Vite and bundled into the
   single HTML file. Both repos stay independently runnable; PLCSIM's own
   editions keep working. Needs PLCSIM pushed first. ← *recommended*
2. Merge PLCSIM into this repo (`packages/plcsim`) and archive the old repo.
   This is the simplest build, but one repo then has two apps and two build
   styles.
3. Keep them separate and talk over `postMessage` between two tabs. It
   isn't really combined, offers no shared catalog, and makes timing awkward.

### M4 · TwinCAT connector — split across v0.2 / v0.3
Three tiers, from safest to most powerful.

**Tier 1 — files (v0.2 scope)**
- **ENI import** (ETG.2100 `EtherCATConfig` XML, from TwinCAT's *Export
  EtherCAT configuration*): slaves in ring order with vendor ID, product
  code, revision, and full PDO mapping with bit offsets. This becomes a
  design (rails rebuilt from consecutive E-bus slaves) **and** an exact
  process image for PLCSIM, which ends the "inferred PDO" guesswork.
- **Scan compare** (roadmap #22): import that same file and diff it against
  the design to show missing, extra, wrong-revision and wrong-order slaves,
  highlighted on the canvas and in topology.
- **Fix the existing XML export:** today it is a home-made `<EtherCATConfig>`
  device list. Emit vendor ID / product code / revision so TwinCAT and PLCSIM
  can match parts exactly. Beckhoff codes follow a pattern
  (`EL1809` → `0x07113052`) but must be checked against ESI files, not
  assumed.

**Tier 2 — TwinCAT project skeleton (v0.3)**
- Generate a `.tsproj` / `.xti` I/O tree (EtherCAT master → boxes in
  order) plus a GVL with `AT %I*` / `%Q*` variables named from the design's
  device tags, so the design opens in XAE with I/O already declared and
  linkable.
- Read an existing `.tsproj` back into a design.
- **Needs a real sample project from you.** The XAE file schema is not
  publicly documented well enough to write it from memory, and a wrong
  `.tsproj` that XAE refuses to open is worse than none.

**Tier 3 — live ADS bridge (v0.3)**
- A small optional Node tool (`tools/ads-bridge`, using the MIT-licensed
  `ads-client` library) that runs on the PC with TwinCAT (XAR or the
  user-mode runtime) and serves a WebSocket on `localhost`. This is the
  same role as CodePLC's Connector, but over ADS instead of Modbus.
- It reads the EtherCAT master's slave states and working counter, PLC
  symbols and process image. ConfigCAT can then show the **real** station's
  state on the designed one, and the multimeter/scope tag sources can point
  at real TwinCAT variables.
- It is read-only by default; writes (forcing) require an explicit toggle.
  The HTML file stays offline-only: the bridge is a separate, opt-in
  program, and nothing in the HTML phones out.

### M5 · Bench and training layer — v0.3
CodePLC-style practice built on M1–M4.

- **Work orders:** a scenario file holds a design, hidden faults, a
  symptom ("Conveyor won't start, stack light red") and a success
  condition. They can be authored in-app and saved like projects.
- **LOTO mode:** isolate (disconnect + PSU off), lock, prove dead with the
  meter (live-dead-live), repair, restore. Steps are logged and scored, and
  measuring Ω live or opening a terminal without proving dead is flagged.
- **Signal trace** ("trace a field device to the PLC"): click a sensor and
  highlight its whole net through to the channel, process-image address and
  tag.
- **I/O checkout / commissioning sheet:** walk every channel (force each
  output, actuate each input), record pass/fail, print as a commissioning
  record. This is real commissioning practice and useful outside training.
- **Starter benches** (roadmap #29): trainer-bench templates — a single
  station with lamps and buttons, a conveyor cell, a safety cell — to start
  from.
- **Simple HMI panel:** buttons, lamps and numeric displays bound to tags,
  docked beside the canvas.
- **Machine animation:** a 2D conveyor/cylinder bound to motor/valve outputs
  and sensor inputs, so the program has something to move.

---

### M6 · Enclosures, panel layout and glands — v0.2 scope
Build the cabinet the station lives in. Devices go **inside** a Rittal or
SCE enclosure, on the mounting plate or on the door, and every cable that
leaves the enclosure goes through a gland.

**How CodePLC does it** (from their public screenshots): each machine has a
**Machine** view and a **Panel CP-x** view. The panel is a real enclosure:
a backplate with DIN rails, wire duct and terminal blocks; a door with the
operators (START, STOP, E-STOP, RUN/FAULT lamps, RESET) and the
disconnect handle; and cables leaving the bottom to the field devices. The
door's operators also appear as a strip under the machine view. A panel
has states the learner works through: *Energised*, *DS1 off*, *locked and
tagged*, *door open*, *close-up*. In ConfigCAT you build the panel
yourself instead of only troubleshooting someone else's.

**The scale problem this has to solve first.** Today's canvas is
schematic, not physical. Rail terminals are drawn at 4.4 px/mm, but free
devices are stylised: an AX5103 is 92 px wide (real 92 mm), while an
EP2338 is 84 px wide (real 30 mm). An enclosure can't be drawn to scale
around that. So:

- **A separate Panel view per enclosure** (recommended), drawn to scale in
  mm. The current canvas stays the wiring view, like CodePLC's Machine /
  Panel tabs and EPLAN's schematic vs Pro Panel. Every device gets a
  location: `field`, or `{ encl, face: "plate" | "door" }`. Rails belong to
  an enclosure, and their length is cut to fit.
- Alternative: draw enclosure frames around devices on the existing
  canvas. It's quicker, but nothing would be to scale, so fit, depth and
  gland checks would be guesses.

**Catalog (new `fn: "encl"` family, real dimensions):**
- **Rittal AX** compact (steel, IP66, NEMA 4, gland plate included). For
  example 1060.000 is 600×600×210, 1054.000 is 600×600×250, 1058.000 is
  600×800×250 and 1360.000 is 600×600×350 mm (verify each against
  Rittal's catalogue as it is added). Also **KX** small terminal boxes and
  **VX25** floor-standing bays, with mounting plates.
- **SCE (Saginaw Control & Engineering)**, NEMA 1 / 4 / 12 / 4X
  wall-mount in inches (e.g. SCE-24N2008LP is 24×20×8 in, NEMA 1), with
  matching back panels (SCE-24P20 is steel, 21×17 in usable). Show both
  mm and inches.
- **Wire duct** (40×60 / 60×80 slotted), **DIN rail** (TS35, cut to
  length) and **end stops**.
- **Cable glands:** Lapp SKINTOP MS-M (brass) and ST-M (plastic), M12 to
  M40. Each has its clamping range, for example the MS-M M20×1.5
  (53112020) clamps 7–13 mm. **Split cable entries** (icotek / Murrplastik
  style) are for pre-terminated M12 and RJ45 cables whose connectors don't
  fit a gland. **Bulkhead connectors** (M12 / RJ45 feed-throughs) cover the
  rest.
- **Door items:** 22 mm operators, which already exist as field devices
  and become placeable on a door; HMI panels with their cutout size; the
  disconnect handle; fan and filter units.
- **Real mm sizes (W×H×D) on every part.** Beckhoff terminals already
  have W, and H×D are known (100×68). Other parts get per-kind defaults,
  flagged as approximate like the ETG parts.

**Panel view:**
- *Plate*: devices are dragged onto the plate, snapping to rails and duct.
  "Auto-layout" makes a first pass: one row per rail, duct above and
  below, PSUs and drives beside them.
- *Door*: operators and HMIs placed on the door. Their depth behind the
  door must clear what is on the plate.
- *Gland plate* (bottom or top): ConfigCAT fills it automatically. Every
  wire whose two ends are in different places (inside and field, or two
  enclosures) is a cable crossing. Each one gets a gland sized from the
  cable's outer diameter (a new `od` field on each cable type). A
  pre-terminated cable gets a split entry instead. You can override any
  pick.

**Checks** (in the Validation panel):
- Fit: nothing overlaps, everything is inside the usable plate area.
- Depth: plate device depth + rail stand-off + door device depth ≤
  enclosure depth.
- Gland plate: enough room, wrench clearance between glands, every
  crossing has an entry.
- IP rating: the enclosure is only as tight as its weakest gland or entry.
- Heat: power loss inside vs the enclosure's surface area, as a ΔT
  estimate. When it runs hot, suggest a fan and filter.
- Weight and duct fill.

**Exports:**
- Panel layout PDF: front view with dimensions, a door drilling drawing
  and a gland-plate drilling drawing.
- The BOM gains the enclosure, mounting plate, rails, duct, glands and
  end stops.

**Simulate (CodePLC-style panel operation), ties into M1/M2/M3:**
- The disconnect on the door kills everything downstream.
- Lock-out / tag-out: the disconnect is off and padlocked, so the panel
  reads as *Off, locked and tagged*.
- Door interlock: the door can't open while the disconnect is on.
- The panel name (CP-1…) and its door strip of operators show on the
  wiring view, like CodePLC's machine view.

*Done when* the hero cell can be put into a Rittal AX 600×600 with its two
rails, PSU and drive on the plate, the E-stop and a stack light on the door,
and auto-filled glands for the sensor, motor and EP-box cables. It should
pass the fit and depth checks and export a panel PDF.

### M7 · Beckhoff face redesign — v0.2 scope
The device faces are rough. Redraw every Beckhoff part from scratch so it
looks like the real product, one family at a time, with each family's
first part confirmed on the design canvas before the rest are drawn.
Other brands come after Beckhoff.

**Per part:** draw it on the canvas from Beckhoff's product picture and
pinout → the user confirms or marks it up → port it to the app (face
renderer and `pointGeom` together, so wires still land) → check an app
screenshot against the reference.

**Status:** EL1002 pilot confirmed and ported. All 12 mm EL terminals (not
HD, distribution or TwinSAFE) now use the new face; tab colours come from
the pinout, so parts without one show grey clamp numbers until their pinout
is verified. EL1002 gained its pinout from the reference.

**HD status:** EL1859 pilot confirmed and ported. Every HD I/O terminal
(not the EL918x distribution parts) uses the new face: 2 × 8 LED window,
eight push-in rows, brand print between rows 3 and 4. EL1859 is in the
catalog as the first mixed terminal (`io: "mix"`, channels from its pinout).
The user confirmed the 8- and 16-point faces as the basis for the rest of
the EL range. EL marker labels now follow the same signal-type colours
(checked against the product finder pictures: EL1008 yellow, EL2008 red,
EL3004 green, EL4004 blue; `elMark(d)`), clamp tabs unchanged.

**EL9 feeds and end covers:** ported on the 12 mm face (`FEED12` table,
`feed12` branch): EL9410, EL9100 / EL9110, EL9150 / EL9160 / EL9190, and
the EL9011 / EL9012 end covers (`EndCoverFace`). Pinouts and LEDs from
Infosys; marker colours and LED positions checked against the product
finder pictures (grey markers on the EL9410, orange on the EL91x0 feeds,
one Power LED top right). Fixes: EL91x0 clamps 1 / 5 are "not used" (they
were 24V / 0V tied to the power contacts), the EL9150 point layout was a
guess (now L on 2 / 6, N on 3 / 7), and the EL9410's clamps 1 / 5 feed the
E-bus only. Still on the old face: EL918x distribution, EL9080, EL92xx fused
feeds (6 clamps), EL95xx supplies.

**ED series:** ED1008 / ED1859 faces confirmed and ported (`d.ed`,
`EdFace`): Data Matrix code, marker labels coloured by signal type
(inputs yellow, outputs red, analog in green, analog out blue, from
Beckhoff's ED pictures), light-green LED window, orange push buttons over
square push-in openings on raised blocks, print bottom-left. 26 ED parts
in the catalog (12 mm, 8- and 16-point, from beckhoff.com). Still to add:
24 mm, D-sub and special ED parts (with family 6) and ED9xxx (with family 3).

**The pilot settles, once for every family:**
- Proportions: housing 336 px (was 292) plus latch hooks, about 352 px in
  all, closer to the real 12 × 100 mm terminal. `TH` and the rail stripe
  move with it; other faces stretch with `TH` until their family is redrawn.
- Colour-coded tabs from the pinout: red `+`, blue `−`, green-yellow `⏚`,
  and signal-type labels (I1/I2…) instead of grey 1–8 tabs.
- A 4×2 LED window, a release button over a round wire entry for each
  clamp, small clamp numbers, a horizontal `EL1002 / BECKHOFF` print, and
  latch hooks top and bottom.
- Data: every terminal needs a verified pinout (9 have one today).
- Still open: tab colours for outputs and analog parts (yellow for now,
  as on the DI reference) and what the top marker labels show (blank).

**Families, in order (319 Beckhoff parts):**

| # | Family | Parts | Examples |
|---|---|---|---|
| 1 | 12 mm EL terminals (pilot: EL1002) | 158 | EL1004, EL1008, EL2008, EL3004, EL4004 |
| 2 | HD 16-point EL | 14 | EL1809, EL1819, EL2809, EL1889 |
| 3 | Feed, distribution, end covers (EL9) | 34 | EL9100, EL9410, EL9150, EL9187, EL9011 |
| 4 | Couplers and junctions | 26 | EK1100, EK1101-0010, EK1501, EK1110, EK1122 |
| 5 | TwinSAFE | 7 | EL1904, EL2904, EL6910, EL1918, EL2911 |
| 6 | Wide and special EL | 2 + connector faces | EL6614, EL7222 |
| 7 | Embedded PCs (CX) | 12 | CX7000, CX8190, CX9020, CX5140, CX2033 |
| 8 | Power supplies | 8 | PS1011-2410, PS2001-4810, PS3021-2440 |
| 9 | EtherCAT Box IP67 | 14 | EP1008-0001, EP2338-0001, EP3174-0002 |
| 10 | Drives and motors | 6 | AX5103, AX5203, AX8100, AX8206, AM8031 |
| 11 | IPCs, panels, switches | 25 | C6015, C6030, C6920, CP2915, CU2008 |
| 12 | K-bus (legacy) | 13 | BK1120, KL1104, KL2408, KL3054, KL9100 |

The faces stay original drawings that resemble the product. No Beckhoff
photos or logo artwork go into the app (see CLAUDE.md conventions).

## Also worth doing in v0.2 (small, from the existing roadmap)
- #23 **Cable schedule** CSV (from–to list): the net graph makes it nearly
  free.
- #14 **One-click power-feed insert** for the existing EL9410 warnings.
- #25 **Spare-capacity report.**
- #17 **Bandwidth / cycle-time estimate:** PLCSIM's `frameStats` already
  computes this; show it in topology.

## Out of scope
Accounts, cloud sync, instructor dashboards and certificates (CodePLC's
paid tiers) are out of scope; ConfigCAT stays a single offline file. So is
true SPICE-level analog simulation, and vendor photos (see CLAUDE.md
conventions).

## Open decisions
1. How to combine with PLCSIM: submodule (recommended), merge, or separate.
2. Push PLCSIM's 9 local commits and add a LICENSE (MIT, to match ConfigCAT?).
3. A sample TwinCAT project (`.tsproj` + ENI export) to build Tier 1/2
   against.
4. Instrument placement: floating panels (planned) or a bottom dock.
5. Enclosures: a separate to-scale Panel view (recommended), or frames on
   the existing canvas.
6. First enclosure brands: Rittal (AX / KX / VX25) and SCE. Add nVent
   Hoffman too?
7. Gland picks: fully automatic with overrides (recommended), or manual
   only.

## Suggested order
M0 → M1 → M2 multimeter → M3 → M2 scope → M4 Tier 1. M6 (enclosures) can
run alongside from M0 onward: its catalog and Panel view don't depend on
the simulator, and only its LOTO / door interlock part needs M1. Doing the multimeter
before the PLC proves the electrical model on static circuits, before the
scan loop makes everything move.
