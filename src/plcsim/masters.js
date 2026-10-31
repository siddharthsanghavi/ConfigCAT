// EtherCAT master runtimes the simulator can stand in for.
//
// Scope is deliberate: inside ConfigCAT the PLC is always the EtherCAT master
// of the station being drawn, so only controllers that master EtherCAT
// natively are offered — Beckhoff TwinCAT 3, CODESYS Control with the
// EtherCAT Master SL, and Omron Sysmac (built-in EtherCAT port). Controllers
// that need a fieldbus card for EtherCAT, or speak another fieldbus
// (POWERLINK, PROFINET, CC-Link…), are out until someone verifies them.
//
// Performance classes are copied from PLCSIM's devices.js so the same program
// scans at the same speed in both apps.

const KB = 1024;
const MB = 1024 * 1024;

const PERF = {
  ipc:    { overheadUs: 25,  usPerElement: 0.12, memPerElement: 96, memPerTag: 40 },
  fast:   { overheadUs: 60,  usPerElement: 0.28, memPerElement: 96, memPerTag: 40 },
  quick:  { overheadUs: 110, usPerElement: 0.5,  memPerElement: 96, memPerTag: 40 },
  modest: { overheadUs: 300, usPerElement: 1.8,  memPerElement: 32, memPerTag: 16 },
  slow:   { overheadUs: 480, usPerElement: 3.0,  memPerElement: 12, memPerTag: 6 },
};

// [id, name, family, perf, memBytes, task period ms, ConfigCAT part numbers it stands for]
const ROWS = [
  // Beckhoff — TwinCAT 3. Embedded PCs master their own E-bus; IPCs master
  // EtherCAT from an Ethernet port into an EK1100.
  ['tc-cx7000', 'Beckhoff CX7000 · TwinCAT 3', 'twincat', 'modest', 512 * KB, 10, ['CX7000', 'CX7080']],
  ['tc-cx8190', 'Beckhoff CX8190 · TwinCAT 3', 'twincat', 'modest', 1 * MB, 10, ['CX8190', 'CX8110']],
  ['tc-cx9020', 'Beckhoff CX9020 · TwinCAT 3', 'twincat', 'quick', 2 * MB, 10, ['CX9020']],
  ['tc-cx9240', 'Beckhoff CX9240 · TwinCAT 3', 'twincat', 'quick', 4 * MB, 5, ['CX9240']],
  ['tc-cx5130', 'Beckhoff CX5130 · TwinCAT 3', 'twincat', 'fast', 12 * MB, 2, ['CX5130', 'CX5120']],
  ['tc-cx5140', 'Beckhoff CX5140 · TwinCAT 3', 'twincat', 'fast', 16 * MB, 2, ['CX5140', 'CX5230']],
  ['tc-cx2033', 'Beckhoff CX2033 · TwinCAT 3', 'twincat', 'ipc', 32 * MB, 1, ['CX2033', 'CX2020', 'CX2042', 'CX2062']],
  ['tc-c6015', 'Beckhoff C6015 · TwinCAT 3', 'twincat', 'fast', 16 * MB, 2, ['C6015', 'C6017', 'C6025', 'C7015']],
  ['tc-c6030', 'Beckhoff C6030 · TwinCAT 3', 'twincat', 'ipc', 64 * MB, 1, ['C6030', 'C6027', 'C6032', 'C6040']],
  ['tc-c6920', 'Beckhoff C69xx cabinet IPC · TwinCAT 3', 'twincat', 'ipc', 64 * MB, 1, ['C6920', 'C6650', 'C6930', 'C6950']],
  ['tc-um', 'TwinCAT 3 on the engineering PC (user mode)', 'twincat', 'fast', 64 * MB, 2, []],
  // CODESYS Control + EtherCAT Master SL (the master is a licensed add-on)
  ['cds-win', 'CODESYS Control Win SL · EtherCAT Master SL', 'codesys', 'fast', 64 * MB, 2, []],
  ['cds-rte', 'CODESYS Control RTE SL · EtherCAT Master SL', 'codesys', 'ipc', 64 * MB, 1, []],
  ['cds-linux', 'CODESYS Control for Linux SL · EtherCAT Master SL', 'codesys', 'fast', 64 * MB, 2, []],
  ['cds-arm64', 'CODESYS Control for Linux ARM64 SL · EtherCAT Master SL', 'codesys', 'quick', 16 * MB, 4, []],
  ['cds-pi', 'CODESYS Control for Raspberry Pi SL · EtherCAT Master SL', 'codesys', 'slow', 8 * MB, 10, []],
  // Omron Sysmac — built-in EtherCAT port on every model
  ['om-nx1p2', 'Omron NX1P2 · Sysmac Studio', 'sysmac', 'modest', 1500 * KB, 4, []],
  ['om-nx102', 'Omron NX102 · Sysmac Studio', 'sysmac', 'quick', 5 * MB, 2, []],
  ['om-nx502', 'Omron NX502 · Sysmac Studio', 'sysmac', 'fast', 10 * MB, 1, []],
  ['om-nx701', 'Omron NX701 · Sysmac Studio', 'sysmac', 'fast', 80 * MB, 1, []],
  ['om-nj501', 'Omron NJ501 · Sysmac Studio', 'sysmac', 'fast', 20 * MB, 1, []],
  ['om-ny512', 'Omron NY512 industrial PC · Sysmac Studio', 'sysmac', 'ipc', 32 * MB, 1, []],
];

export const FAMILY_LABEL = { twincat: 'Beckhoff TwinCAT 3', codesys: 'CODESYS', sysmac: 'Omron Sysmac' };

export const MASTERS = ROWS.map(([id, name, family, perf, memBytes, periodMs, parts]) => ({
  id, name, family, memBytes, periodMs, parts, ...PERF[perf],
}));

export const getMaster = (id) => MASTERS.find((m) => m.id === id) || null;

/** The runtime profile a placed master device stands for, if any. */
export const masterForPart = (partId) => MASTERS.find((m) => m.parts.includes(partId)) || null;
