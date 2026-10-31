// Ladder instruction catalogue.
//
// Every instruction declares:
//   cat      grouping for the palette
//   kind     'contact' | 'coil' | 'box'   (drives rendering + placement rules)
//   output   true if it terminates a rung path (coils, block outputs)
//   ops      operand descriptors: {name, role:'tag'|'const'|'any', types:[...]}
//   eval(ctx, el, power) -> power out
//
// ctx = { db, dt, scanMs, now }

import { coerce, parseTime, isFbType } from './types.js';

const num = (ctx, op) => {
  if (op === undefined || op === '') return 0;
  const s = String(op).trim();
  if (/^(TIME|T)#/i.test(s)) return parseTime(s);
  if (/^-?\d+(\.\d+)?(e-?\d+)?$/i.test(s)) return parseFloat(s);
  if (/^(TRUE|FALSE)$/i.test(s)) return s.toUpperCase() === 'TRUE' ? 1 : 0;
  const v = ctx.db.read(s);
  if (v === undefined) throw new Error(`unknown tag "${s}"`);
  return typeof v === 'boolean' ? (v ? 1 : 0) : Number(v) || 0;
};

const bit = (ctx, op) => {
  const s = String(op ?? '').trim();
  if (/^(TRUE|1)$/i.test(s)) return true;
  if (/^(FALSE|0)$/i.test(s)) return false;
  const v = ctx.db.read(s);
  if (v === undefined) throw new Error(`unknown tag "${s}"`);
  return typeof v === 'boolean' ? v : Number(v) !== 0;
};

const put = (ctx, op, v) => {
  if (!ctx.db.write(String(op).trim(), v)) throw new Error(`cannot write "${op}"`);
};

/** Per-element scratch state (edge memories, accumulators) keyed by element id. */
const st = (ctx, el) => (ctx.state[el.id] ||= {});

const TAG = (name, types) => ({ name, role: 'tag', types });
const ANY = (name) => ({ name, role: 'any', types: ['INT', 'DINT', 'REAL', 'TIME'] });

export const INSTRUCTIONS = {
  // ------------------------------------------------------------- contacts --
  XIC: {
    cat: 'Bit', kind: 'contact', label: '] [', title: 'Examine If Closed (NO contact)',
    ops: [TAG('operand', ['BOOL'])],
    eval: (c, el, p) => p && bit(c, el.ops[0]),
  },
  XIO: {
    cat: 'Bit', kind: 'contact', label: ']/[', title: 'Examine If Open (NC contact)',
    ops: [TAG('operand', ['BOOL'])],
    eval: (c, el, p) => p && !bit(c, el.ops[0]),
  },
  ONS: {
    cat: 'Bit', kind: 'contact', label: '[P]', title: 'Rising edge (one shot)',
    ops: [TAG('storage', ['BOOL'])],
    eval: (c, el, p) => {
      const s = st(c, el); const prev = !!s.m; s.m = p;
      return p && !prev;
    },
  },
  ONF: {
    cat: 'Bit', kind: 'contact', label: '[N]', title: 'Falling edge',
    ops: [TAG('storage', ['BOOL'])],
    eval: (c, el, p) => {
      const s = st(c, el); const prev = !!s.m; s.m = p;
      return !p && prev ? true : false;
    },
  },

  // ---------------------------------------------------------------- coils --
  OTE: {
    cat: 'Bit', kind: 'coil', label: '( )', title: 'Output Energize', output: true,
    ops: [TAG('operand', ['BOOL'])],
    eval: (c, el, p) => { put(c, el.ops[0], p); return p; },
  },
  OTL: {
    cat: 'Bit', kind: 'coil', label: '(L)', title: 'Output Latch (set)', output: true,
    ops: [TAG('operand', ['BOOL'])],
    eval: (c, el, p) => { if (p) put(c, el.ops[0], true); return p; },
  },
  OTU: {
    cat: 'Bit', kind: 'coil', label: '(U)', title: 'Output Unlatch (reset)', output: true,
    ops: [TAG('operand', ['BOOL'])],
    eval: (c, el, p) => { if (p) put(c, el.ops[0], false); return p; },
  },

  // --------------------------------------------------------------- timers --
  TON: {
    cat: 'Timer/Counter', kind: 'box', title: 'On-delay timer', output: true,
    ops: [TAG('instance', ['TON']), ANY('PT')],
    fbType: 'TON',
    eval: (c, el, p) => {
      const inst = c.db.read(el.ops[0]);
      if (!inst || inst.__fb !== 'TON') throw new Error(`"${el.ops[0]}" is not a TON instance`);
      const PT = num(c, el.ops[1]);
      inst.PT = PT; inst.IN = p;
      if (!p) { inst.ET = 0; inst.Q = false; }
      else { inst.ET = Math.min(PT, inst.ET + c.dt); inst.Q = inst.ET >= PT; }
      return inst.Q;
    },
  },
  TOF: {
    cat: 'Timer/Counter', kind: 'box', title: 'Off-delay timer', output: true,
    ops: [TAG('instance', ['TOF']), ANY('PT')],
    fbType: 'TOF',
    eval: (c, el, p) => {
      const inst = c.db.read(el.ops[0]);
      if (!inst || inst.__fb !== 'TOF') throw new Error(`"${el.ops[0]}" is not a TOF instance`);
      const PT = num(c, el.ops[1]);
      inst.PT = PT; inst.IN = p;
      if (p) { inst.ET = 0; inst.Q = true; }
      else if (inst.Q) { inst.ET = Math.min(PT, inst.ET + c.dt); if (inst.ET >= PT) inst.Q = false; }
      return inst.Q;
    },
  },
  TP: {
    cat: 'Timer/Counter', kind: 'box', title: 'Pulse timer', output: true,
    ops: [TAG('instance', ['TP']), ANY('PT')],
    fbType: 'TP',
    eval: (c, el, p) => {
      const inst = c.db.read(el.ops[0]);
      if (!inst || inst.__fb !== 'TP') throw new Error(`"${el.ops[0]}" is not a TP instance`);
      const PT = num(c, el.ops[1]); inst.PT = PT;
      if (p && !inst.IN && !inst.Q && inst.ET === 0) { inst.Q = true; inst.ET = 0; }
      if (inst.Q) { inst.ET = Math.min(PT, inst.ET + c.dt); if (inst.ET >= PT) inst.Q = false; }
      if (!p && !inst.Q) inst.ET = 0;
      inst.IN = p;
      return inst.Q;
    },
  },

  // ------------------------------------------------------------- counters --
  CTU: {
    cat: 'Timer/Counter', kind: 'box', title: 'Count up', output: true,
    ops: [TAG('instance', ['CTU']), ANY('PV'), TAG('reset', ['BOOL'])],
    fbType: 'CTU',
    eval: (c, el, p) => {
      const inst = c.db.read(el.ops[0]);
      if (!inst || inst.__fb !== 'CTU') throw new Error(`"${el.ops[0]}" is not a CTU instance`);
      inst.PV = num(c, el.ops[1]);
      const R = el.ops[2] ? bit(c, el.ops[2]) : false;
      if (R) inst.CV = 0;
      else if (p && !inst.prevCU) inst.CV = coerce('INT', inst.CV + 1);
      inst.prevCU = p; inst.CU = p;
      inst.Q = inst.CV >= inst.PV;
      return inst.Q;
    },
  },
  CTD: {
    cat: 'Timer/Counter', kind: 'box', title: 'Count down', output: true,
    ops: [TAG('instance', ['CTD']), ANY('PV'), TAG('load', ['BOOL'])],
    fbType: 'CTD',
    eval: (c, el, p) => {
      const inst = c.db.read(el.ops[0]);
      if (!inst || inst.__fb !== 'CTD') throw new Error(`"${el.ops[0]}" is not a CTD instance`);
      inst.PV = num(c, el.ops[1]);
      const LD = el.ops[2] ? bit(c, el.ops[2]) : false;
      if (LD) inst.CV = inst.PV;
      else if (p && !inst.prevCD) inst.CV = coerce('INT', inst.CV - 1);
      inst.prevCD = p; inst.CD = p;
      inst.Q = inst.CV <= 0;
      return inst.Q;
    },
  },

  // ------------------------------------------------------------ compares --
  EQU: { cat: 'Compare', kind: 'box', title: 'Equal', ops: [ANY('A'), ANY('B')],
         eval: (c, e, p) => p && num(c, e.ops[0]) === num(c, e.ops[1]) },
  NEQ: { cat: 'Compare', kind: 'box', title: 'Not equal', ops: [ANY('A'), ANY('B')],
         eval: (c, e, p) => p && num(c, e.ops[0]) !== num(c, e.ops[1]) },
  GRT: { cat: 'Compare', kind: 'box', title: 'Greater than', ops: [ANY('A'), ANY('B')],
         eval: (c, e, p) => p && num(c, e.ops[0]) > num(c, e.ops[1]) },
  GEQ: { cat: 'Compare', kind: 'box', title: 'Greater or equal', ops: [ANY('A'), ANY('B')],
         eval: (c, e, p) => p && num(c, e.ops[0]) >= num(c, e.ops[1]) },
  LES: { cat: 'Compare', kind: 'box', title: 'Less than', ops: [ANY('A'), ANY('B')],
         eval: (c, e, p) => p && num(c, e.ops[0]) < num(c, e.ops[1]) },
  LEQ: { cat: 'Compare', kind: 'box', title: 'Less or equal', ops: [ANY('A'), ANY('B')],
         eval: (c, e, p) => p && num(c, e.ops[0]) <= num(c, e.ops[1]) },
  LIM: { cat: 'Compare', kind: 'box', title: 'Limit test (LO <= TEST <= HI)',
         ops: [ANY('LO'), ANY('TEST'), ANY('HI')],
         eval: (c, e, p) => p && num(c, e.ops[1]) >= num(c, e.ops[0]) && num(c, e.ops[1]) <= num(c, e.ops[2]) },

  // ------------------------------------------------------------- compute --
  MOV: { cat: 'Compute', kind: 'box', title: 'Move', output: true,
         ops: [ANY('source'), TAG('dest')],
         eval: (c, e, p) => { if (p) put(c, e.ops[1], num(c, e.ops[0])); return p; } },
  ADD: { cat: 'Compute', kind: 'box', title: 'Add', output: true,
         ops: [ANY('A'), ANY('B'), TAG('dest')],
         eval: (c, e, p) => { if (p) put(c, e.ops[2], num(c, e.ops[0]) + num(c, e.ops[1])); return p; } },
  SUB: { cat: 'Compute', kind: 'box', title: 'Subtract', output: true,
         ops: [ANY('A'), ANY('B'), TAG('dest')],
         eval: (c, e, p) => { if (p) put(c, e.ops[2], num(c, e.ops[0]) - num(c, e.ops[1])); return p; } },
  MUL: { cat: 'Compute', kind: 'box', title: 'Multiply', output: true,
         ops: [ANY('A'), ANY('B'), TAG('dest')],
         eval: (c, e, p) => { if (p) put(c, e.ops[2], num(c, e.ops[0]) * num(c, e.ops[1])); return p; } },
  DIV: { cat: 'Compute', kind: 'box', title: 'Divide', output: true,
         ops: [ANY('A'), ANY('B'), TAG('dest')],
         eval: (c, e, p) => {
           if (!p) return p;
           const b = num(c, e.ops[1]);
           if (b === 0) throw new Error('divide by zero');
           put(c, e.ops[2], num(c, e.ops[0]) / b);
           return p;
         } },
  MOD: { cat: 'Compute', kind: 'box', title: 'Modulo', output: true,
         ops: [ANY('A'), ANY('B'), TAG('dest')],
         eval: (c, e, p) => {
           if (!p) return p;
           const b = num(c, e.ops[1]);
           if (b === 0) throw new Error('modulo by zero');
           put(c, e.ops[2], num(c, e.ops[0]) % b);
           return p;
         } },
  SCL: { cat: 'Compute', kind: 'box', title: 'Scale raw -> engineering units', output: true,
         ops: [ANY('input'), ANY('inMin'), ANY('inMax'), ANY('outMin'), ANY('outMax'), TAG('dest')],
         eval: (c, e, p) => {
           if (!p) return p;
           const [x, i0, i1, o0, o1] = e.ops.slice(0, 5).map((o) => num(c, o));
           const span = i1 - i0;
           put(c, e.ops[5], span === 0 ? o0 : o0 + ((x - i0) * (o1 - o0)) / span);
           return p;
         } },

  // ---------------------------------------------------------- prog control --
  JMP: { cat: 'Program Control', kind: 'coil', label: '(JMP)', title: 'Jump to label', output: true,
         ops: [{ name: 'label', role: 'const' }],
         eval: (c, e, p) => { if (p) c.jumpTo = String(e.ops[0]).trim(); return p; } },
  LBL: { cat: 'Program Control', kind: 'box', title: 'Label (jump target)',
         ops: [{ name: 'label', role: 'const' }], eval: (c, e, p) => p },
  RET: { cat: 'Program Control', kind: 'coil', label: '(RET)', title: 'Return from routine', output: true,
         ops: [], eval: (c, e, p) => { if (p) c.returning = true; return p; } },
  JSR: { cat: 'Program Control', kind: 'coil', label: '(JSR)', title: 'Jump to subroutine', output: true,
         ops: [{ name: 'routine', role: 'const' }],
         eval: (c, e, p) => { if (p) c.callRoutine(String(e.ops[0]).trim()); return p; } },
};

export const instrDef = (op) => INSTRUCTIONS[op];
export const isOutput = (op) => !!INSTRUCTIONS[op]?.output;

export function paletteGroups() {
  const g = new Map();
  for (const [op, def] of Object.entries(INSTRUCTIONS)) {
    if (!g.has(def.cat)) g.set(def.cat, []);
    g.get(def.cat).push({ op, ...def });
  }
  return g;
}

/** FB instance type an instruction needs for operand 0, if any. */
export const requiredFbType = (op) => INSTRUCTIONS[op]?.fbType;

export { num as readNum, bit as readBit, isFbType };
