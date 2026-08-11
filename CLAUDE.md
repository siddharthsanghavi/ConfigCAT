# Sid's EtherCAT Configurator

Single-file offline web app for building Beckhoff EtherCAT stations and
multi-vendor control panels: place devices, wire with automatic cable
selection, validate, and export BOM / diagram / XML.

**➡ Read `HANDOFF.md` first** — build instructions, gotchas, and current
state. `FEATURES.md` lists every feature plus the roadmap.

## Deliverable
`Sids-EtherCAT-Configurator.html` (repo root) — ~1.65 MB,
self-contained, double-click to run offline. Rebuild after any change:
```bash
node node_modules/vite/bin/vite.js build
cp dist/index.html Sids-EtherCAT-Configurator.html
```
**Node is not installed system-wide** — see HANDOFF.md. `npm` does not
work via the portable dist; call vite through `node` directly.

## Architecture
- `src/catalog-etg.js` — **generated, do not hand-edit.** 893 devices from
  the EtherCAT Technology Group product directory (`scripts/gen-etg.py`
  + `scripts/ethercat_products.csv`; rerun `python scripts/gen-etg.py`).
  Placeable hardware only; the directory has no electrical data, so
  geometry / channels / pinouts are **representative defaults per product
  type**, flagged in the UI. `etg` = device type (searchable, and the flag
  the SRC filter uses), `family` = the row was a product family rather
  than an orderable part number, `url` = ETG page.
- `src/catalog.js` — ~490 hand-curated parts across 21 brands + `GROUPS`. Every entry
  has `brand` (defaults to beckhoff). Rail terminals carry `w` (mm),
  `ebus` (mA, + supplies / − consumes), `io`, `ch`, `pinout`, `upA` and
  behaviour flags (`coupler`, `feed`, `pcFeed`, `pcBreak`, `endcap`,
  `hd`, `safety`, `idSwitch`…). Free components carry `free: true`,
  `kind`, `fw`/`fh` px, and optional `motion` / `iolMaster` / `variants`.
  An auto-assign block at the end files any unlisted part into the right
  palette group, so adding parts needs no GROUPS edit.
- `src/validate.js` — `validateStation`, `validateWires`, `classifyPoint`.
- `src/App.jsx` — everything else:
  - `pointGeom(d)` (rail clamp points) **must stay in lockstep with the
    face renderers**; `freeGeom(d)` does the same for free components.
  - `TerminalG` / `FreeCompG` render devices; faces switch on `d.kind`.
  - `DiagramModal` — device overview + PDF export (jsPDF).
  - Wiring: `autoWireType` + `NET_FEASIBLE` choose the cable; infeasible
    pairs are blocked. `resolveId(d, inst)` applies variant suffixes and
    must be used wherever a part number is shown or exported.

## Conventions
- Do NOT embed vendor photos or logo artwork (copyright). Faces are
  original stylized SVG; brand badges are name-in-color wordmarks.
- Beckhoff data is the most accurate (several values verified against
  infosys). Third-party parts are representative models with approximate
  specs — say so when reporting results. The ETG-directory import is the
  loosest of all: vendor, name, certification and link are real; every
  number is a per-type default.
- Cable colors are the user's preference, not IEC: **red = +24 V,
  black = 0 V**, blue = 24 V signal, orange = AC, GN/YE = PE, gray =
  shielded analog/encoder.
- No non-electrical parts — every catalog item has connection points.

## Hard-won gotchas
1. Every `GROUPS` key must also exist in `FN` (App.jsx) or the palette
   crashes on `FN[key].c` and the whole app renders blank. `GROUPS` no
   longer draws the palette directly — it supplies each part's **category
   subfolder** under its company (see `CAT_LABEL` / `CAT_ORDER`), so a new
   group key needs an `FN` entry *and* a `CAT_LABEL` + `CAT_ORDER` entry
   or it shows up as a raw key at the end.
2. A new `kind` needs both a `freeGeom` case and a `FreeCompG` face case,
   otherwise the part draws as a dashed placeholder.
3. Connection points must sit inside the drawn shape — run the
   containment check in HANDOFF.md after touching faces.
4. Append new points in `pointGeom`/`freeGeom`; never insert — wire
   endpoints are positional indexes and saved projects would re-wire.
5. `sanitizeDoc` silently drops unknown `catId`s when loading a project,
   so renaming/removing a part deletes it from saved projects.

## Testing
No test framework yet. Verify by: (a) the catalog integrity one-liner in
HANDOFF.md, (b) `vite build`, (c) preview + the browser containment check.
Add Vitest for `pointGeom`, `validate.js`, E-bus math and BOM generation
when touching that logic.
