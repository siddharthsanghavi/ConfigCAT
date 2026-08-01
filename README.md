# Sid's EtherCAT Configurator

A single-file, offline web app for visually laying out Beckhoff EtherCAT
stations and multi-vendor control panels — place devices, wire them with
automatic cable selection, validate the design, and export a bill of
materials, a wiring diagram, and a TwinCAT-style device list.

No install, no server, no account. Open one HTML file in a browser.

---

## Quick start

**Just want to use it?** Download **`Sids-EtherCAT-Configurator.html`**
from this repo and double-click it. It runs fully offline in any modern
browser (Chrome, Edge, Firefox, Safari). Your work autosaves in the
browser; use **Save/Load** to keep project files.

**Want to develop it?**

```bash
npm install
npm run dev      # dev server with hot reload
npm run build    # bundles everything into dist/index.html (self-contained)
```

The build inlines all JS/CSS into one HTML file
(`vite-plugin-singlefile`), which is what makes the standalone file work
from a `file://` URL. After building, copy it to the repo root:

```bash
cp dist/index.html Sids-EtherCAT-Configurator.html
```

## Features

- **~660-part catalog** across 21 manufacturers, all connectable —
  couplers, embedded/industrial PCs, panels, drives & motors, the full
  Beckhoff EL/EP terminal families, plus representative sensors,
  operators, contactors/breakers, disconnects, power supplies,
  distribution, safety devices, pneumatics, IP67 I/O and IO-Link masters.
- **Manufacturer filter** and searchable, collapsible palette.
- **Smart wiring** — press two connection points and the correct cable is
  chosen automatically from what they are; incompatible pairs are blocked.
- **Cable highlighting** — EtherCAT cables glow, Safety-over-EtherCAT
  (FSoE) blinks yellow, IO-Link blinks blue.
- **Validation** — rail structure, E-bus & power-contact budgets,
  potential groups, PSU sizing, Hot-Connect IDs, and wiring faults.
- **Motion animation** — motors/drives/axes move once wired to power+data.
- **Device variants** — inspector dropdown (e.g. `EP6224-0002 / -0092`).
- **Exports** — Excel BOM (spreadsheet), PDF wiring diagram, PNG of the
  panel, and a TwinCAT-style XML device list.

See **[FEATURES.md](FEATURES.md)** for the full list and roadmap.

## Repository layout

```
Sids-EtherCAT-Configurator.html   prebuilt standalone app (the deliverable)
index.html                        Vite entry
src/
  App.jsx                         UI, geometry, faces, wiring, exports
  catalog.js                      core parts + palette groups
  catalog-extended.js             bulk catalog expansion
  validate.js                     station & wiring validation
  main.jsx
package.json  vite.config.js
FEATURES.md   HANDOFF.md   CLAUDE.md    docs
```

`HANDOFF.md` is the developer's deep-dive (architecture, data model, and
the gotchas that have already caused bugs). `CLAUDE.md` mirrors the key
conventions.

## Tech

Vite + React (single-file build), jsPDF for the diagram PDF. Everything
renders as original SVG. No backend.

## Status & accuracy

This is a design-aid and learning tool, **not** an engineering or
procurement system.

- **Beckhoff** data is the most accurate; several values were checked
  against Beckhoff's public documentation.
- **Third-party** parts are *representative* real model families with
  **approximate** electrical specs — verify against the manufacturer's
  datasheet before using any of it for real design or ordering.
- Component drawings are original **stylized** SVG, not renders of
  specific products.

## Trademarks & disclaimer

This project is an independent, non-commercial tool and is **not
affiliated with, authorized, endorsed by, or sponsored by** Beckhoff or
any other company named in the catalog.

All company names, product names, and part numbers (Beckhoff, EtherCAT®,
TwinCAT, TwinSAFE, WAGO, Murr Elektronik, Banner, Eaton, Balluff, SMC,
Festo, igus, Leuze, Siemens, Phoenix Contact, SICK, Turck, ifm, Pilz,
Schneider Electric, Kollmorgen, Omron, AutomationDirect, Weidmüller, and
others) are **trademarks or registered trademarks of their respective
owners**, used here **for identification and interoperability reference
only**. EtherCAT® is a registered trademark and patented technology
licensed by Beckhoff Automation GmbH.

No company logos or product photographs are reproduced. Manufacturer
"badges" in the app are plain name-in-color wordmarks for identification.
Part numbers and specifications are representative and may be inaccurate.

Use at your own risk. See [LICENSE](LICENSE) (MIT) for the terms covering
the original code and artwork.
