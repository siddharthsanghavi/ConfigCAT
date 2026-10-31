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

## Suggested order
M0 → M1 → M2 multimeter → M3 → M2 scope → M4 Tier 1. Doing the multimeter
before the PLC proves the electrical model on static circuits, before the
scan loop makes everything move.
