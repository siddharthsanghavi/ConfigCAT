// Function Block Diagram: block catalogue, network model, evaluator and canvas.
//
// A network is a free-form set of blocks on a grid. Every block input is either
// wired to another block's output, or carries a literal / tag reference typed in
// the properties panel. Execution order is a topological sort of the wiring;
// a deliberate feedback loop is allowed and reads the previous scan's value,
// which is how real FBD tools handle it.

import { parseTime } from './types.js';
import { execFB } from './st.js';

export const FBD_BLOCKS = {
  // ---- I/O references ----
  VAR_IN:  { cat: 'Variable', ins: [], outs: ['OUT'], tagOperand: 'read', title: 'Read a tag' },
  VAR_OUT: { cat: 'Variable', ins: ['IN'], outs: [], tagOperand: 'write', title: 'Write a tag' },
  // ---- boolean ----
  AND: { cat: 'Boolean', ins: ['IN1', 'IN2'], outs: ['OUT'], expandable: true, bool: true, title: 'Logical AND' },
  OR:  { cat: 'Boolean', ins: ['IN1', 'IN2'], outs: ['OUT'], expandable: true, bool: true, title: 'Logical OR' },
  XOR: { cat: 'Boolean', ins: ['IN1', 'IN2'], outs: ['OUT'], bool: true, title: 'Exclusive OR' },
  NOT: { cat: 'Boolean', ins: ['IN'], outs: ['OUT'], bool: true, title: 'Negation' },
  // ---- comparison ----
  GT: { cat: 'Compare', ins: ['IN1', 'IN2'], outs: ['OUT'], title: 'Greater than' },
  GE: { cat: 'Compare', ins: ['IN1', 'IN2'], outs: ['OUT'], title: 'Greater or equal' },
  LT: { cat: 'Compare', ins: ['IN1', 'IN2'], outs: ['OUT'], title: 'Less than' },
  LE: { cat: 'Compare', ins: ['IN1', 'IN2'], outs: ['OUT'], title: 'Less or equal' },
  EQ: { cat: 'Compare', ins: ['IN1', 'IN2'], outs: ['OUT'], title: 'Equal' },
  NE: { cat: 'Compare', ins: ['IN1', 'IN2'], outs: ['OUT'], title: 'Not equal' },
  // ---- arithmetic ----
  ADD:   { cat: 'Math', ins: ['IN1', 'IN2'], outs: ['OUT'], expandable: true, title: 'Addition' },
  SUB:   { cat: 'Math', ins: ['IN1', 'IN2'], outs: ['OUT'], title: 'Subtraction' },
  MUL:   { cat: 'Math', ins: ['IN1', 'IN2'], outs: ['OUT'], expandable: true, title: 'Multiplication' },
  DIV:   { cat: 'Math', ins: ['IN1', 'IN2'], outs: ['OUT'], title: 'Division' },
  MOD:   { cat: 'Math', ins: ['IN1', 'IN2'], outs: ['OUT'], title: 'Modulo' },
  ABS:   { cat: 'Math', ins: ['IN'], outs: ['OUT'], title: 'Absolute value' },
  SQRT:  { cat: 'Math', ins: ['IN'], outs: ['OUT'], title: 'Square root' },
  LIMIT: { cat: 'Math', ins: ['MN', 'IN', 'MX'], outs: ['OUT'], title: 'Clamp between MN and MX' },
  SEL:   { cat: 'Math', ins: ['G', 'IN0', 'IN1'], outs: ['OUT'], title: 'Select IN0/IN1 by G' },
  MOVE:  { cat: 'Math', ins: ['IN'], outs: ['OUT'], title: 'Pass through / assign' },
  SCALE: { cat: 'Math', ins: ['IN', 'IMIN', 'IMAX', 'OMIN', 'OMAX'], outs: ['OUT'], title: 'Linear scaling' },
  // ---- function blocks (stateful, need an instance tag) ----
  TON:    { cat: 'Function Block', ins: ['IN', 'PT'], outs: ['Q', 'ET'], fb: 'TON', title: 'On-delay timer' },
  TOF:    { cat: 'Function Block', ins: ['IN', 'PT'], outs: ['Q', 'ET'], fb: 'TOF', title: 'Off-delay timer' },
  TP:     { cat: 'Function Block', ins: ['IN', 'PT'], outs: ['Q', 'ET'], fb: 'TP', title: 'Pulse timer' },
  CTU:    { cat: 'Function Block', ins: ['CU', 'R', 'PV'], outs: ['Q', 'CV'], fb: 'CTU', title: 'Count up' },
  CTD:    { cat: 'Function Block', ins: ['CD', 'LD', 'PV'], outs: ['Q', 'CV'], fb: 'CTD', title: 'Count down' },
  R_TRIG: { cat: 'Function Block', ins: ['CLK'], outs: ['Q'], fb: 'R_TRIG', title: 'Rising edge' },
  F_TRIG: { cat: 'Function Block', ins: ['CLK'], outs: ['Q'], fb: 'F_TRIG', title: 'Falling edge' },
  RS:     { cat: 'Function Block', ins: ['S', 'R1'], outs: ['Q1'], fb: 'RS', title: 'Reset-dominant latch' },
  SR:     { cat: 'Function Block', ins: ['S1', 'R'], outs: ['Q1'], fb: 'SR', title: 'Set-dominant latch' },
};

let fid = 1;
export const newFbdId = () => `f${fid++}`;
export function seedFbdIds(routines) {
  let max = 0;
  for (const r of routines) {
    if (r.lang !== 'FBD') continue;
    for (const b of r.blocks || []) {
      const m = /^f(\d+)$/.exec(b.id || '');
      if (m) max = Math.max(max, +m[1]);
    }
  }
  fid = Math.max(fid, max + 1);
}

export function makeBlock(type, x, y) {
  const def = FBD_BLOCKS[type];
  if (!def) throw new Error(`Unknown FBD block ${type}`);
  const b = { id: newFbdId(), type, x: Math.round(x), y: Math.round(y), tag: '', ins: {} };
  for (const p of def.ins) b.ins[p] = { src: null, lit: '', inv: false };
  return b;
}

/** Input pins of a block — extensible blocks (AND/OR/ADD/MUL) may carry extras. */
export function insOf(b) {
  return b.pins || FBD_BLOCKS[b.type].ins;
}
export const outsOf = (b) => FBD_BLOCKS[b.type].outs;

/** Add one more input to an extensible block (AND3, ADD4, ...). */
export function addInput(b) {
  const def = FBD_BLOCKS[b.type];
  if (!def.expandable) return false;
  const pins = insOf(b).slice();
  const next = `IN${pins.length + 1}`;
  pins.push(next);
  b.pins = pins;
  b.ins[next] = { src: null, lit: def.bool ? 'TRUE' : '0', inv: false };
  return true;
}

export const blockHeight = (b) => {
  const rows = Math.max(insOf(b).length, outsOf(b).length, 1);
  return 24 + rows * 18 + 8;
};
export const blockWidth = (b) => {
  const def = FBD_BLOCKS[b.type];
  if (def.tagOperand) return Math.max(96, (b.tag || 'tag').length * 7 + 26);
  const inW = Math.max(0, ...insOf(b).map((p) => p.length));
  const outW = Math.max(0, ...outsOf(b).map((p) => p.length));
  return Math.max(78, 30 + (inW + outW) * 7, (b.tag || b.type).length * 7 + 20);
};

export const pinY = (b, i) => b.y + 24 + i * 18 + 9;

export function inPinPos(b, pin) {
  return { x: b.x, y: pinY(b, insOf(b).indexOf(pin)) };
}
export function outPinPos(b, pin) {
  return { x: b.x + blockWidth(b), y: pinY(b, outsOf(b).indexOf(pin)) };
}

// -------------------------------------------------------------- evaluation --
function litValue(db, s) {
  const t = String(s ?? '').trim();
  if (t === '') return 0;
  if (/^(TRUE)$/i.test(t)) return true;
  if (/^(FALSE)$/i.test(t)) return false;
  if (/^(TIME|T)#/i.test(t)) return parseTime(t);
  if (/^-?\d+(\.\d+)?$/.test(t)) return parseFloat(t);
  const v = db.read(t);
  if (v === undefined) throw new Error(`unknown tag "${t}"`);
  return v;
}

const bool = (v) => (typeof v === 'boolean' ? v : Number(v) !== 0);
const nnum = (v) => (typeof v === 'boolean' ? (v ? 1 : 0) : Number(v) || 0);

/**
 * Execute one FBD network.
 * ctx = { db, dt, state, power:Map (blockId#pin -> value) }
 */
export function evalNetwork(ctx, routine) {
  const blocks = new Map(routine.blocks.map((b) => [b.id, b]));
  const done = new Set();
  const active = new Set();
  const prev = (ctx.state.__fbd ||= {});   // last-scan values, used to break loops
  const out = {};

  const valueOf = (b, pin) => out[`${b.id}#${pin}`];

  const input = (b, pin) => {
    const wire = b.ins[pin];
    let v;
    if (wire?.src) {
      const srcBlock = blocks.get(wire.src.b);
      if (!srcBlock) throw new Error(`${b.type}: dangling wire on ${pin}`);
      if (!done.has(srcBlock.id)) {
        if (active.has(srcBlock.id)) v = prev[`${wire.src.b}#${wire.src.p}`] ?? false; // feedback
        else { evalBlock(srcBlock); v = valueOf(srcBlock, wire.src.p); }
      } else v = valueOf(srcBlock, wire.src.p);
      if (v === undefined) v = prev[`${wire.src.b}#${wire.src.p}`] ?? false;
    } else {
      v = litValue(ctx.db, wire?.lit);
    }
    return wire?.inv ? !bool(v) : v;
  };

  function evalBlock(b) {
    if (done.has(b.id)) return;
    active.add(b.id);
    const def = FBD_BLOCKS[b.type];
    const set = (pin, v) => { out[`${b.id}#${pin}`] = v; ctx.power.set(`${b.id}#${pin}`, v); };
    ctx.executed++;

    try {
      if (b.type === 'VAR_IN') {
        if (!b.tag) throw new Error('VAR_IN has no tag');
        const v = ctx.db.read(b.tag);
        if (v === undefined) throw new Error(`unknown tag "${b.tag}"`);
        set('OUT', v);
      } else if (b.type === 'VAR_OUT') {
        if (!b.tag) throw new Error('VAR_OUT has no tag');
        const v = input(b, 'IN');
        if (!ctx.db.write(b.tag, v)) throw new Error(`cannot write "${b.tag}"`);
        ctx.power.set(`${b.id}#IN`, v);
      } else if (def.fb) {
        if (!b.tag) throw new Error(`${b.type} needs an instance tag`);
        const inst = ctx.db.read(b.tag);
        if (!inst || inst.__fb !== def.fb) throw new Error(`"${b.tag}" is not a ${def.fb} instance`);
        const args = {};
        for (const p of insOf(b)) args[p] = input(b, p);
        execFB(inst, args, ctx.dt);
        for (const p of outsOf(b)) set(p, inst[p]);
      } else {
        const v = applyFunction(b, def, (p) => input(b, p));
        set('OUT', v);
      }
    } catch (err) {
      err.elementId = b.id;
      throw err;
    }

    active.delete(b.id);
    done.add(b.id);
  }

  // Outputs and writes are the roots; evaluate them, then anything left over.
  for (const b of routine.blocks) if (b.type === 'VAR_OUT') evalBlock(b);
  for (const b of routine.blocks) evalBlock(b);

  Object.assign(prev, out);
  return out;
}

function applyFunction(b, def, get) {
  const ins = insOf(b);
  const A = () => ins.map(get);
  switch (b.type) {
    case 'AND': return A().every(bool);
    case 'OR':  return A().some(bool);
    case 'XOR': return bool(get('IN1')) !== bool(get('IN2'));
    case 'NOT': return !bool(get('IN'));
    case 'GT': return nnum(get('IN1')) > nnum(get('IN2'));
    case 'GE': return nnum(get('IN1')) >= nnum(get('IN2'));
    case 'LT': return nnum(get('IN1')) < nnum(get('IN2'));
    case 'LE': return nnum(get('IN1')) <= nnum(get('IN2'));
    case 'EQ': return nnum(get('IN1')) === nnum(get('IN2'));
    case 'NE': return nnum(get('IN1')) !== nnum(get('IN2'));
    case 'ADD': return A().reduce((a, v) => a + nnum(v), 0);
    case 'MUL': return A().reduce((a, v) => a * nnum(v), 1);
    case 'SUB': return nnum(get('IN1')) - nnum(get('IN2'));
    case 'DIV': {
      const d = nnum(get('IN2'));
      if (d === 0) throw new Error('divide by zero');
      return nnum(get('IN1')) / d;
    }
    case 'MOD': {
      const d = nnum(get('IN2'));
      if (d === 0) throw new Error('modulo by zero');
      return Math.trunc(nnum(get('IN1'))) % Math.trunc(d);
    }
    case 'ABS': return Math.abs(nnum(get('IN')));
    case 'SQRT': return Math.sqrt(nnum(get('IN')));
    case 'LIMIT': return Math.min(nnum(get('MX')), Math.max(nnum(get('MN')), nnum(get('IN'))));
    case 'SEL': return bool(get('G')) ? get('IN1') : get('IN0');
    case 'MOVE': return get('IN');
    case 'SCALE': {
      const span = nnum(get('IMAX')) - nnum(get('IMIN'));
      if (span === 0) return nnum(get('OMIN'));
      return nnum(get('OMIN')) + ((nnum(get('IN')) - nnum(get('IMIN'))) * (nnum(get('OMAX')) - nnum(get('OMIN')))) / span;
    }
    default: throw new Error(`unsupported block ${b.type}`);
  }
}

/** Static verification, mirroring verifyRung. */
export function verifyNetwork(db, routine) {
  const errs = [];
  const ids = new Set(routine.blocks.map((b) => b.id));
  for (const b of routine.blocks) {
    const def = FBD_BLOCKS[b.type];
    if (!def) { errs.push({ element: b.id, msg: `unknown block ${b.type}` }); continue; }
    if (def.tagOperand || def.fb) {
      if (!b.tag) errs.push({ element: b.id, msg: `${b.type}: no ${def.fb ? 'instance' : 'tag'} assigned` });
      else if (db.typeOf(b.tag) === undefined) errs.push({ element: b.id, msg: `${b.type}: undefined tag "${b.tag}"` });
      else if (def.fb && db.typeOf(b.tag) !== def.fb) {
        errs.push({ element: b.id, msg: `${b.type}: "${b.tag}" is ${db.typeOf(b.tag)}, expected ${def.fb}` });
      }
    }
    for (const p of insOf(b)) {
      const w = b.ins[p];
      if (w?.src && !ids.has(w.src.b)) errs.push({ element: b.id, msg: `${b.type}.${p}: wire points at a deleted block` });
      if (!w?.src && String(w?.lit ?? '').trim() === '') {
        errs.push({ element: b.id, msg: `${b.type}: input ${p} is neither wired nor given a value` });
      } else if (!w.src) {
        const t = String(w.lit).trim();
        const literal = /^-?\d/.test(t) || /^(TIME|T)#/i.test(t) || /^(TRUE|FALSE)$/i.test(t);
        if (!literal && db.typeOf(t) === undefined) {
          errs.push({ element: b.id, msg: `${b.type}.${p}: undefined tag "${t}"` });
        }
      }
    }
  }
  if (!routine.blocks.some((b) => b.type === 'VAR_OUT' || FBD_BLOCKS[b.type]?.fb)) {
    errs.push({ element: null, warn: true, msg: 'network writes no tags' });
  }
  return errs;
}

/** Remove wires that point at a block being deleted. */
export function deleteBlock(routine, id) {
  routine.blocks = routine.blocks.filter((b) => b.id !== id);
  for (const b of routine.blocks) {
    for (const w of Object.values(b.ins)) if (w.src?.b === id) { w.src = null; }
  }
}

export function connect(routine, from, to) {
  const target = routine.blocks.find((b) => b.id === to.b);
  if (!target) return false;
  target.ins[to.p] = { ...(target.ins[to.p] || {}), src: { b: from.b, p: from.p } };
  return true;
}

export function fbdBlockCount(routine) { return routine.blocks.length; }
