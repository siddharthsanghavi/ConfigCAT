# Sid's EtherCAT Configurator

Single-file offline web app for building Beckhoff EtherCAT stations and
multi-vendor control panels: place devices, wire with automatic cable
selection, validate, and export BOM / diagram / XML.

**➡ Read `HANDOFF.md` first** — build instructions, gotchas, and current
state. `FEATURES.md` lists every feature plus the roadmap.

## Deliverable
`Sids-EtherCAT-Configurator.html` (in `beckhoff/`) — ~1.1 MB,
self-contained, double-click to run offline. Rebuild after any change:
```bash
node node_modules/vite/bin/vite.js build
cp dist/index.html Sids-EtherCAT-Configurator.html
```
**Node is not installed system-wide** — see HANDOFF.md. `npm` does not
work via the portable dist; call vite through `node` directly.

## Architecture
- `src/catalog.js` — ~490 parts across 21 brands + `GROUPS`. Every entry
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
  specs — say so when reporting results.
- Cable colors are the user's preference, not IEC: **red = +24 V,
  black = 0 V**, blue = 24 V signal, orange = AC, GN/YE = PE, gray =
  shielded analog/encoder.
- No non-electrical parts — every catalog item has connection points.

## Hard-won gotchas
1. Every `GROUPS` key must also exist in `FN` (App.jsx) or the palette
   crashes on `FN[g.key].c` and the whole app renders blank.
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
