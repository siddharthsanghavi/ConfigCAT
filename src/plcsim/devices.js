// EtherCAT-only stand-in for PLCSIM's devices.js.
//
// PLCSIM's original carries 241 controller profiles across 28 toolchains. Inside
// ConfigCAT the controller is always an EtherCAT master, and its I/O always
// comes from a process image the master packs — so only the 'ecat' addressing
// branch is needed. The runtime imports `ioPoints` from here unchanged.

import { pdoAddress, variableName } from './ecat/model.js';

export function pointAddress(dev, mod, i) {
  const v = mod.vars?.[i];
  return v ? pdoAddress(v) : '%IX0.0';
}

export function pointTagName(dev, mod, i) {
  if (mod.vars?.[i]) return variableName(mod.vars[i]);
  return `${mod.type}_${mod.slot}_${i}`;
}

/** Flatten a device's modules into a list of I/O point descriptors. */
export function ioPoints(dev) {
  const out = [];
  for (const mod of dev.modules) {
    for (let i = 0; i < mod.points; i++) {
      out.push({
        mod,
        index: i,
        dir: mod.type === 'DI' || mod.type === 'AI' ? 'in' : 'out',
        analog: mod.type === 'AI' || mod.type === 'AO',
        address: pointAddress(dev, mod, i),
        tag: pointTagName(dev, mod, i),
      });
    }
  }
  return out;
}
