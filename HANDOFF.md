# HANDOFF — Sid's EtherCAT Configurator

**Read this first in a fresh session.** It records where the project
stands, how to build it, and the traps that have already bitten us.

Last updated: 2026-07-24

---

## What this is
A single-file, offline web app for laying out Beckhoff EtherCAT stations
plus multi-vendor control panels: place devices, wire them with automatic
cable selection, validate the design, and export BOM/diagram/XML.

- **Deliverable (what the user actually uses):**
  `beckhoff/Sids-EtherCAT-Configurator.html` — ~1.1 MB, self-contained,
  double-click to run. No server, works offline.
- **Source:** repo root — the project was flattened (`src/`, `index.html`,
  `package.json`, `vite.config.js` now live at the top level; no more
  nested `beckhoff-configurator/beckhoff-configurator/`).
- **Feature list:** `beckhoff/FEATURES.md` (also has the roadmap)

## Build & run (IMPORTANT)
**Node.js is NOT installed on this machine.** A portable Node lives in the
session scratchpad and disappears when the session ends. In a fresh
session you must re-download it, or the user must install Node.

```bash
# if Node IS installed:  npm install && npm run build
# otherwise (portable node), from the repo root:
export PATH="<scratchpad>/node-v22.12.0-win-x64:$PATH"
node node_modules/vite/bin/vite.js build     # builds dist/index.html
cp dist/index.html Sids-EtherCAT-Configurator.html
```
- `npm` does **not** work via the portable dist here (npm.cmd missing /
  npm-cli.js misbehaves). Install deps only if `node_modules` is missing.
- As of 2026-08-10 this repo has **no `node_modules` of its own** — it is a
  directory junction to `Documents\Claude\Beckhoff\node_modules` (same
  dependency set, gitignored), created with
  `cmd /c mklink /J <repo>\node_modules <that path>`. Recreate it if the
  build cannot find vite. A surviving portable Node from an earlier session
  was at `…\bb0d9880-…\scratchpad\node-v22.12.0-win-x64\node.exe`.
- Dev server: `.claude/launch.json` points at the portable node + vite.
  Its `runtimeExecutable` path contains the **session-specific scratchpad
  id** — it will be stale in a new session and must be updated. The entry
  actually used by the preview tool lives in the **primary working
  directory's** `.claude/launch.json`, not this repo's.
- `vite-plugin-singlefile` inlines everything; `base: "./"` so `file://`
  works.

## Source map
| File | Contains |
|---|---|
| `src/catalog.js` | core parts + `GROUPS` (palette sections) + auto-group assignment; imports & spreads `EXTRA` |
| `src/catalog-extended.js` | `EXTRA` — bulk expansion (power sources, KL / WAGO 750, deeper vendor lines) |
| `src/App.jsx` | Everything else: geometry, faces, wiring, validation UI, exports, diagram |
| `src/validate.js` | `validateStation` / `validateWires` / `classifyPoint` |
| `CLAUDE.md` | Architecture + conventions (project-level guidance) |

### App.jsx landmarks
- `C`, `M`, `FN`, `BRANDS`, `WIRES`, `ROLE_COLOR` — constants near the top.
- `pointGeom(d)` — rail-terminal clamp points. **Must stay in lockstep
  with the face renderers** (`ElFace`, `CouplerFace`, `PsuFace`, `CxFace`,
  `RjTermFace`).
- `freeGeom(d)` — connection points for free-placed components, switched
  on `d.kind`.
- `TerminalG` — rail terminals. `FreeCompG` — free components (faces
  switched on `d.kind`, brand badge, role-colored points, motion anim).
- `DiagramModal` — device-to-device overview + PDF export (jsPDF).
- Exports: `exportXlsx` (SpreadsheetML), `exportXml`, `exportPng`,
  `saveProject` / `loadProject`.

## Data model
```js
doc = {
  rails: [{ id, items: [{ uid, catId, idNum?, variant?, cbl? }] }],
  free:  [{ uid, catId, x, y, variant?, cbl? }],
  wires: [{ id, a:{uid,pt}, b:{uid,pt}, type, label }],
}
```
- Autosaved to `localStorage["beckhoff-configurator-v1"]`.
- `resolveId(d, inst)` swaps the trailing `-NNNN` variant suffix — use it
  anywhere a part number is displayed or exported.

## Catalog conventions
- Every entry has `brand` (defaults to `beckhoff` via a `forEach` after
  `CATALOG`). `BRANDS` in App.jsx maps brand → wordmark badge + color.
- Rail terminals: `w` (mm), `ebus` (mA, + supplies / − consumes), `io`,
  `ch`, `pinout`, `upA`, plus flags (`coupler`, `feed`, `pcFeed`,
  `pcBreak`, `endcap`, `hd`, `safety`, `idSwitch`…).
- Free components: `free: true`, `kind` (selects geometry + face),
  `fw`/`fh` px, plus `motion`, `iolMaster`, `netport`, `m12io`, `ioconn`.
- `variants: [{ s: "0092", d: "description" }]` → inspector dropdown.
- **Adding a part needs no GROUPS edit** — the auto-assign block at the
  bottom of catalog.js files anything unlisted by `kind`/`fn`.

## Gotchas that already broke things
1. **Every `GROUPS` key must exist in `FN`** (App.jsx) or the palette
   crashes on `FN[g.key].c` — this blanked the whole app once.
2. New `kind` values need BOTH a `freeGeom` case and a `FreeCompG` face
   case, else the part renders as a dashed placeholder.
3. Connection points must sit **inside** the drawn shape. There's a
   containment test (see "Verifying" below) — run it after adding faces.
4. Wire endpoint indexes are positional: **append** new points in
   `pointGeom`/`freeGeom`, never insert, or saved projects re-wire wrong.
5. `sanitizeDoc` drops unknown `catId`s on load — renaming/removing a
   part silently deletes it from saved projects.

## Verifying (do this after catalog/render changes)
Integrity (run with portable node):
```bash
node --input-type=module -e "
import { CATALOG, GROUPS } from './src/catalog.js';
const byId=Object.fromEntries(CATALOG.map(d=>[d.id,d]));
const inG=new Set(GROUPS.flatMap(g=>g.ids));
console.log('total',CATALOG.length,
 '| missing',GROUPS.flatMap(g=>g.ids.filter(i=>!byId[i])),
 '| orphans',CATALOG.filter(d=>!inG.has(d.id)).map(d=>d.id),
 '| badFree',CATALOG.filter(d=>d.free&&(!d.kind||!d.fw||!d.fh)).map(d=>d.id));"
```
Visual/containment: start the preview, add sample parts, then use the
browser JS tool to compare each hit-rect center against the union bbox of
the component's drawn shapes (this pattern is in the session history and
has caught real "ports outside the body" bugs).

## Current state
- **659 parts**, 21 manufacturers, all branded, zero orphans/dupes.
- Catalog is split: `src/catalog.js` (core) + `src/catalog-extended.js`
  (`EXTRA`, spread into CATALOG). New palette groups need an `FN` entry in
  App.jsx AND a GROUPS entry (gotcha #1): added `src` / `klbus` / `w750`.
- **Power sources** — new free `kind: "source"` (freeGeom + FreeCompG face),
  `st` = "dc"|"1ph"|"3ph", `volt` label. Roles: DC + = p24, − = gnd, AC = ac,
  PE = pe → wireable to contactors/motors/PSUs. `KIND_GROUP.source = "src"`.
  Generic supplies use `brand:"generic"` (BRANDS.generic = "SUPPLY").
- **KL / WAGO 750** — rail terminals with `fn:"klbus"`/`"w750"` (auto-file to
  those groups); couplers BK1120 / 750-354 (`coupler:true`); end terminals
  KL9010 / 750-600 (`endcap:true`). ebus values represent K-bus/750-bus load.
- No non-electrical parts (mechanical-only items were removed).
- 13 entries expose variants; more can be added the same way.
- Build passes; app renders clean with no console errors.
- **FSoE realism (2026-07-24)**: TwinSAFE bus nodes carry `twinsafe: true`
  (EL1904/EL1918/EL2904/EL2911/EL2912/EL6910/EL6930, EK1914/EK1960); logic-
  capable ones also carry `tsLogic: true` (EL6910/EL6930/EK1960). FSoE
  highlight (`fsoeActive` in App.jsx) needs both a `twinsafe` node and a
  `tsLogic` instance, and only paints EtherCAT-capable (`ec`) cables — never
  field wiring. The generic `safety` flag (yellow housing + OSSD field
  device) is now separate from FSoE participation. validate.js warns on safe
  I/O with no logic.
- **Visible backplane (2026-07-24)**: `BackplaneLayer` (App.jsx, above
  `TerminalG`) draws the E-bus bar above the terminals and the power-contact
  potential groups below the rail, in the clear lanes (busY = railY−8,
  pcY = railY+250). Its potential-group logic mirrors validate.js closeGroup.
  Both buses **terminate at the end cover** (`endcap`).
- **Multiple stations per rail (2026-07-24)**: a rail item may carry an
  optional `gap` (mm); `layout` adds `gap*PX_PER_MM` before it, separating a
  new group. `add()` never dangles a device past an end cover — it inserts
  before the trailing cover, except a coupler/CX (or the one-shot `newGroup`
  toggle) which appends a new group with `NEW_GROUP_GAP` (16 mm). Both
  `BackplaneLayer` (via `segBackplane`) and `validate.js` split each rail
  into segments at end covers and render/validate each station independently
  — so a second gapped coupler is a separate station, not an "extra coupler"
  warning or "devices after the end cover" error. Inspector has a "Gap
  before (mm)" field (`setGap`). Note: `sanitizeDoc` keeps the whole item
  object, so `gap` survives save/load with no schema change.
- Style note: toggle buttons must use the `border` shorthand (not
  `borderColor`) so they don't mix with `btnGhost`/`btnMini`'s `border`
  (React dev warns on shorthand/non-shorthand mixing).
- **TwinSAFE master (2026-07-25)**: `tsLogic` now includes **EL1918**
  (integrated logic) — an EL6910 is NOT required. Masters: EL6910/EL6930,
  EK1960, EL1918, or a TwinCAT Safety PLC on any IPC/CX. validate.js also
  softens the "no logic" warning when a `cx` (embedded PC) is on the rail
  (it can host the Safety PLC). Free C-series IPCs are not yet detected as
  hosts (validateRails has no `free`); the message still names IPCs.
- **Wire routing (2026-07-25)**: `ductY` now runs just below the lower of
  the two endpoints (`max(A.y,B.y)+14+stagger`, capped at the old rail-duct
  level), so wires hug their ports instead of dropping to the rail.
- **Powered LEDs (2026-07-25)**: `poweredUids` (App.jsx) = rail items in a
  coupler/CX-fed segment before the end cover; threaded `TerminalG →
  ElFace` as `powered`, which gates `ledStates`. Couplers/PSUs keep their
  own LEDs. Diagram's `TerminalG` uses the `powered=true` default.
- **Two bugs found by testing the above (2026-08-11)**:
  (a) a search auto-expanded every matching company, so a one-letter query
  painted ~1535 palette buttons per keystroke. `palView` now precomputes
  the filtered tree and expansion only happens under `EXPAND_LIMIT` (250)
  matches; past that the companies stay closed with a "N matches in M
  companies" hint. (b) `ecFree` in `TopologyModal` picked field devices by
  `kind`, so imported gateways, switches, FSoE boxes, sensors and valve
  manifolds never appeared on the network view — it now also accepts any
  part with `d.etg`, since everything in the ETG directory is an EtherCAT
  device whatever face it borrows.
- **Palette tree (2026-08-11)**: the palette is company → category → part
  (`palTree` in App.jsx), not the flat `GROUPS` list it used to render.
  `GROUPS` is now the *category source*: whichever group a part is listed
  in (or auto-filed into by kind) becomes its subfolder, relabelled via
  `CAT_LABEL`, canonicalised via `CAT_CANON` (`drv3`→`drv`, `psu`→`pwr`)
  and ordered by `CAT_ORDER`. Companies come from `d.brand`, Beckhoff
  pinned first. `openGroups` now keys both companies (`"beckhoff"`) and
  subfolders (`"beckhoff/cplr"`). A company with a single category renders
  its parts without the extra subfolder click, and a search or
  manufacturer pick force-expands matches. Because curated and imported
  parts share the company folders, `catalog.js` no longer needs per-vendor
  GROUPS entries — that also fixed generic `box` parts with `fn: "net"`
  (gateways, media converters) filing into Switching & Protection.
- **ETG directory import (2026-08-11)**: `src/catalog-etg.js` is generated
  by `scripts/gen-etg.py` from `scripts/ethercat_products.csv` (ETG product
  directory, 1423 rows) — **never hand-edit it**; change the script and
  rerun. 893 parts + 259 vendor wordmarks. The generated data dictates no
  layout at all: `etg` holds the plain-language device type ("Servo
  drive"), which marks the part as a directory import (the **SRC** filter
  is `!d.etg` / `d.etg`) and is matched by the palette search along with
  the manufacturer name. Not imported:
  MainDevices (215), dev tools (214), training (40), passive connectors
  (50), safety dev kits (11) — none have connection points. Every entry
  reuses an existing `kind` (drive / linaxis / epbox / sensor / box /
  switch8 / panel / valvebank) so nothing draws as a placeholder. The CSV
  mixes part numbers with family names; `slug_id` keeps a token with
  letters+digits as the part number, else flags `family: true` and slugs
  the phrase. Fixed alongside: the `drive`, `ipc` and `panel` faces
  hardcoded a **BECKHOFF** wordmark, so every third-party part using them
  (KOLLMORGEN-AKD, OMRON-1S… and now 365 imported drives) was drawn with
  Beckhoff branding — they now use `brand.name` / `brandColor`, lifted
  toward white via `brandOnDark` on dark housings.
- **Project library (2026-08-10)**: `doc.name` is now part of the document
  (`sanitizeDoc` defaults it to `Untitled station`); renaming goes through
  `setDoc`, not `update()`, so it stays out of the undo stack. `LIB_KEY`
  holds a `{id: {id, name, savedAt, doc}}` map of named saves — each entry
  is re-sanitised on read so one corrupt entry cannot take out the list.
  `ProjectsModal` does save / open / update / rename / delete; file Save
  writes `<slug(name)>.json` with `app`/`version`/`name`/`savedAt`, and
  Import reports what `sanitizeDoc` dropped via `droppedBy` (gotcha 5 is
  now visible to the user instead of silent). Note `showFlash` only
  rendered inside the wire bar — there is now a `S.toast` fallback for
  flashes raised outside wire mode.
- **EtherCAT Topology (2026-08-10)**: `TopologyModal` (before `DiagramSvg`)
  — redrawn to match the TwinCAT online topology: one box per slave in a
  single top-down chain, labelled `Term n (ID)` (n = auto-increment
  position), ports A in / B out / C branch drawn only on devices with real
  RJ45 sockets (`coupler`/`cx`/`ext`/`junction`). Links are port-to-port
  verticals — blue inside a station (E-bus), green between stations (RJ45
  hop). Coupler-headed segments (split at end covers) become dashed
  station frames; free EtherCAT devices (epbox/iol/iolhub/drive/linaxis)
  drop off the last junction's port C into a second column, or off the
  master (dashed) if there is no junction. Node colour = `FN[d.fn].c`.
  Exports PNG via the SVG-serialise pattern.
  *Was:* one horizontal row per station — the station→station link used a
  non-existent `row.y`, so the hop rendered as a `NaN` path (invisible).
  **E-bus continuity (same day):** a link is drawn only where the terminals
  physically touch. The chain breaks at an end cover, at `inst.gap > 0`
  (gapped groups are not in contact), at a `psu` device (a PSU brick has no
  E-bus contacts) and at the next coupler/CX. Anything outside a
  coupler-headed run — including devices stranded behind a PSU or a gap, and
  junctions like EK1122 which cannot head a station — is listed unlinked in
  a red-dashed **“Not on the E-bus”** block instead of being drawn into the
  chain (previously such devices were silently omitted).
  ⚠ `validate.js` does not yet agree: it splits stations at end covers only,
  filters PSUs out of `ebusItems` as if they were transparent, and ignores
  `gap`. So the topology can show a device off-network while the validator
  stays quiet. Align `validateStation` when you next touch it.
- **New parts (2026-07-25)**: CU8110-0120 / CU8130-0120 (UPS, kind
  supplybox), C9900-U330 (external UPS), CX2900-0192 (battery, kind box),
  CU8210-M001 (dome, kind box) — filed into pwr/net GROUPS explicitly.
  Plus CX8110, CX5140 (epc, auto-filed) and C6027, C6905 (ipc, auto).
  CX2100-0914 (CX system power supply + UPS, rail `psu:true`, auto-filed to
  the psu group) pairs with the CX2900-0192 battery.
- **Control-gear expansion (2026-07-25)**: ~100 hardwired contactors /
  overloads / breakers / disconnects / relays / monitoring / safety relays /
  22 mm command+signaling / towers / limit switches across Siemens, Eaton,
  Schneider, Omron, Phoenix, WAGO, Weidmüller, AutomationDirect, Murr — all
  reuse existing free `kind`s (contactor/breaker/disconnect/relay/box/btn/
  estop/stack/limit) so they auto-file (control gear→sw, operators→hmi,
  safety box→safe) and need no GROUPS or geometry edits. NO PROFINET/
  PROFIBUS (SIMOCODE excluded).
- **freeGeom fix (2026-07-25)**: the `relay` and `contactor` point positions
  now scale with `d.fw` (were hardcoded to x≤55 / x≤70), so compact modules
  keep their points inside the body. This also fixed the pre-existing narrow
  `EATON-EMS`. Containment re-verified (64 pts, 0 violations). 603 parts;
  integrity one-liner still clean.

## Next steps (see FEATURES.md roadmap for the full list)
1. **Catalog depth** — biggest open item. The user wants near-complete
   vendor catalogs (1000+ parts each). Hand-writing that is impractical;
   the realistic path is a generated `catalog.json` from a scraper
   (`scripts/scrape-catalog.mjs`, respecting robots.txt) plus expanded
   `variants` for series. Beckhoff via beckhoff.com/infosys first.
2. **True `.xlsx`** — currently SpreadsheetML `.xls` (opens fine, Excel
   may show a format notice). Bundle SheetJS to remove it.
3. **Photo-accurate faces** — current SVGs are original stylized art.
4. Obstacle-avoiding wire routing; IO-Link topology rules; cable-length
   estimation.

## Honest limitations to keep stating
- Third-party part numbers are **representative real models**; electrical
  specs are approximate. Beckhoff part numbers/behaviour are the most
  accurate (several verified against infosys).
- Component drawings are **stylized representations**, not renders of
  specific products.
- Brand badges are name-in-color wordmarks, deliberately **not** the
  companies' actual logo artwork (copyright).
