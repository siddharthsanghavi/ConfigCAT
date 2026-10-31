// EtherCAT network model.
//
// A network is an ordered chain of slaves (ring order = physical order on the
// wire). Each slave contributes RxPDOs (master -> slave, i.e. outputs) and
// TxPDOs (slave -> master, i.e. inputs). The master packs those PDO entries into
// a single process image; the byte.bit offsets a program actually addresses fall
// out of that packing, which is why inserting one terminal shifts everything
// downstream — the single most common way to break a working EtherCAT program.
//
// Bit packing rules implemented here (matching how masters lay out the image):
//   * entries are packed in PDO order, bit by bit
//   * each slave starts on a byte boundary
//   * an entry wider than one bit is aligned to a byte boundary
//   * padding entries (index 0) consume bits without producing a variable

export const ESM_STATES = ['INIT', 'PREOP', 'SAFEOP', 'OP'];

/** Legal EtherCAT state-machine transitions (master's view). */
export const ESM_TRANSITIONS = {
  INIT: ['PREOP'],
  PREOP: ['SAFEOP', 'INIT'],
  SAFEOP: ['OP', 'PREOP', 'INIT'],
  OP: ['SAFEOP', 'PREOP', 'INIT'],
};

export const canTransition = (from, to) => (ESM_TRANSITIONS[from] || []).includes(to);

const bitsOf = (e) => e.bitLength || 0;

/** Data type a PDO entry maps onto in the tag database. */
export function entryType(entry) {
  if (entry.type) {
    const t = String(entry.type).toUpperCase();
    if (['BOOL', 'BYTE', 'WORD', 'INT', 'DINT', 'REAL', 'TIME', 'STRING'].includes(t)) return t;
    if (t === 'UINT' || t === 'UINT16') return 'WORD';
    if (t === 'SINT' || t === 'USINT' || t === 'UINT8') return 'BYTE';
    if (t === 'UDINT' || t === 'INT32') return 'DINT';
    if (t === 'FLOAT' || t === 'REAL32' || t === 'LREAL') return 'REAL';
  }
  const n = bitsOf(entry);
  if (n === 1) return 'BOOL';
  if (n <= 8) return 'BYTE';
  if (n <= 16) return 'INT';
  return 'DINT';
}

/**
 * Lay out the process image.
 * Returns { inputs, outputs, inputBytes, outputBytes } where each list holds
 * variables with absolute bit offsets.
 */
export function buildProcessImage(network) {
  const inputs = [];
  const outputs = [];
  let inBit = 0;
  let outBit = 0;

  const pack = (list, startBit, slave, dir) => {
    let bit = startBit;
    // every slave starts on a byte boundary
    if (bit % 8) bit += 8 - (bit % 8);
    const pdos = dir === 'in' ? slave.txPdos : slave.rxPdos;
    for (const pdo of pdos) {
      for (const entry of pdo.entries) {
        const width = bitsOf(entry);
        if (width === 0) continue;
        // padding entries occupy space but produce no variable
        if (!entry.index || entry.index === 0 || /^pad/i.test(entry.name || '')) {
          bit += width;
          continue;
        }
        if (width > 1 && bit % 8) bit += 8 - (bit % 8); // byte-align wide entries
        list.push({
          slave: slave.position,
          slaveName: slave.name,
          pdo: pdo.name || hex(pdo.index),
          pdoIndex: pdo.index,
          name: entry.name || `Entry_${hex(entry.index)}`,
          index: entry.index,
          subindex: entry.subindex ?? 0,
          bitLength: width,
          type: entryType(entry),
          bitOffset: bit,
          byteOffset: Math.floor(bit / 8),
          bitInByte: bit % 8,
          dir,
        });
        bit += width;
      }
    }
    return bit;
  };

  for (const slave of network.slaves) {
    inBit = pack(inputs, inBit, slave, 'in');
    outBit = pack(outputs, outBit, slave, 'out');
  }

  return {
    inputs,
    outputs,
    inputBytes: Math.ceil(inBit / 8),
    outputBytes: Math.ceil(outBit / 8),
  };
}

export const hex = (n, w = 4) =>
  n === undefined || n === null ? '—' : `0x${Number(n).toString(16).toUpperCase().padStart(w, '0')}`;

/** Process-image address in the notation TwinCAT and CODESYS masters print. */
export function pdoAddress(v) {
  const d = v.dir === 'in' ? 'I' : 'Q';
  if (v.bitLength === 1) return `%${d}X${v.byteOffset}.${v.bitInByte}`;
  if (v.bitLength <= 8) return `%${d}B${v.byteOffset}`;
  if (v.bitLength <= 16) return `%${d}W${v.byteOffset}`;
  return `%${d}D${v.byteOffset}`;
}

/** A legal IEC identifier derived from slave + entry names. */
export function variableName(v) {
  const clean = (s) => String(s || '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^(\d)/, '_$1');
  const base = `${clean(v.slaveName)}_${clean(v.name)}`;
  return base.slice(0, 48) || `Var_${v.byteOffset}_${v.bitInByte}`;
}

/**
 * Synthesise the device profile the rest of the simulator expects, so the
 * ladder / FBD / SFC engine, tag database and I/O panel all work unchanged.
 */
export function networkToDevice(network, image) {
  const modules = [];
  for (const slave of network.slaves) {
    const ins = image.inputs.filter((v) => v.slave === slave.position);
    const outs = image.outputs.filter((v) => v.slave === slave.position);
    const digitalIn = ins.filter((v) => v.bitLength === 1);
    const analogIn = ins.filter((v) => v.bitLength > 1);
    const digitalOut = outs.filter((v) => v.bitLength === 1);
    const analogOut = outs.filter((v) => v.bitLength > 1);
    const add = (type, list) => {
      if (!list.length) return;
      modules.push({
        slot: slave.position,
        catalog: slave.name,
        type,
        points: list.length,
        vars: list,
        min: 0,
        max: 32767,
      });
    };
    add('DI', digitalIn);
    add('DO', digitalOut);
    add('AI', analogIn);
    add('AO', analogOut);
  }

  const cycleUs = network.cycleTimeUs || 1000;
  return {
    id: `ecat:${network.name || 'network'}`,
    name: `${network.master || 'EtherCAT master'} — ${network.slaves.length} slaves`,
    kind: 'IPC',
    family: network.ide || 'twincat',
    vendor: network.vendor || 'EtherCAT',
    addressing: 'ecat',
    overheadUs: 20 + network.slaves.length * 4,   // frame handling per slave
    usPerElement: 0.15,
    memPerElement: 96,
    memPerTag: 40,
    memBytes: 64 * 1024 * 1024,
    defaultPeriodMs: Math.max(1, Math.round(cycleUs / 1000)),
    modules,
    ethercat: true,
  };
}

/** Frame/bandwidth estimate for the status bar. */
export function frameStats(network, image) {
  const payload = image.inputBytes + image.outputBytes;
  // 14 B Ethernet header + 2 B EtherCAT header + datagram headers + 4 B FCS
  const frameBytes = 14 + 2 + 10 + payload + 2 + 4;
  const cycleUs = network.cycleTimeUs || 1000;
  const bitsOnWire = (frameBytes + 8 + 12) * 8; // preamble + interframe gap
  return {
    payload,
    frameBytes,
    cycleUs,
    busLoadPct: Math.min(100, (bitsOnWire / (cycleUs * 100)) * 100),
    // 100BASE-TX: 100 bits per microsecond
    frameUs: bitsOnWire / 100,
    wkc: network.slaves.filter((s) => s.txPdos.length || s.rxPdos.length).length,
  };
}

/** Propagation/DC delay estimate per slave, in nanoseconds. */
export function dcDelays(network) {
  let acc = 0;
  return network.slaves.map((s) => {
    acc += 300 + (s.processingNs || 300); // ~300 ns cable + forwarding per hop
    return { position: s.position, name: s.name, delayNs: acc };
  });
}

export function emptyNetwork() {
  return { name: 'Untitled', master: 'EtherCAT master', cycleTimeUs: 1000, dc: true, slaves: [] };
}
