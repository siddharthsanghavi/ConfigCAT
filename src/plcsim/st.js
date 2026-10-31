// Structured Text: tokenizer, parser and interpreter for a practical subset of
// IEC 61131-3 ST — assignments, IF/CASE/FOR/WHILE/REPEAT, standard functions and
// function-block instance calls (inst(IN := x, PT := T#2s); ... inst.Q).

import { parseTime, coerce } from './types.js';

// ------------------------------------------------------------------ lexer --
const KEYWORDS = new Set([
  'IF', 'THEN', 'ELSIF', 'ELSE', 'END_IF', 'CASE', 'OF', 'END_CASE',
  'FOR', 'TO', 'BY', 'DO', 'END_FOR', 'WHILE', 'END_WHILE',
  'REPEAT', 'UNTIL', 'END_REPEAT', 'EXIT', 'RETURN',
  'AND', 'OR', 'XOR', 'NOT', 'MOD', 'TRUE', 'FALSE',
]);

export function tokenize(src) {
  const out = [];
  let i = 0, line = 1;
  const push = (type, value) => out.push({ type, value, line });
  while (i < src.length) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (/\s/.test(c)) { i++; continue; }
    // comments: (* *) and //
    if (c === '(' && src[i + 1] === '*') {
      const end = src.indexOf('*)', i + 2);
      if (end < 0) throw stErr(line, 'unterminated comment');
      for (let k = i; k < end; k++) if (src[k] === '\n') line++;
      i = end + 2; continue;
    }
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    // time literal
    const tm = /^(TIME|T)#[0-9smhd_.]+/i.exec(src.slice(i));
    if (tm) { push('num', parseTime(tm[0])); i += tm[0].length; continue; }
    // based literal 16#FF / 2#1010
    const based = /^(\d+)#([0-9a-fA-F_]+)/.exec(src.slice(i));
    if (based) {
      push('num', parseInt(based[2].replace(/_/g, ''), parseInt(based[1], 10)));
      i += based[0].length; continue;
    }
    if (/[0-9]/.test(c)) {
      const m = /^\d+(\.\d+)?([eE][-+]?\d+)?/.exec(src.slice(i));
      push('num', parseFloat(m[0])); i += m[0].length; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
      const w = m[0];
      push(KEYWORDS.has(w.toUpperCase()) ? w.toUpperCase() : 'ident', w);
      i += w.length; continue;
    }
    if (c === "'" || c === '"') {
      const q = c; let j = i + 1, s = '';
      while (j < src.length && src[j] !== q) { s += src[j]; j++; }
      if (j >= src.length) throw stErr(line, 'unterminated string');
      push('str', s); i = j + 1; continue;
    }
    const three = src.substr(i, 2);
    if (['**', ':=', '<=', '>=', '<>'].includes(three)) { push('op', three); i += 2; continue; }
    if ('+-*/<>=(),;:.[]'.includes(c)) { push('op', c); i++; continue; }
    throw stErr(line, `unexpected character "${c}"`);
  }
  push('eof', null);
  return out;
}

function stErr(line, msg) {
  const e = new Error(`line ${line}: ${msg}`);
  e.stLine = line;
  return e;
}

// ----------------------------------------------------------------- parser --
export function parse(src) {
  const ts = tokenize(src);
  let p = 0;
  const peek = (k = 0) => ts[p + k];
  const at = (type, value) => peek().type === type && (value === undefined || peek().value === value);
  const next = () => ts[p++];
  const eat = (type, value) => {
    if (!at(type, value)) throw stErr(peek().line, `expected ${value ?? type}, found "${peek().value ?? 'end of file'}"`);
    return next();
  };
  const atKw = (k) => peek().type === k;

  function statements(stops, stopIf) {
    const list = [];
    while (!at('eof') && !stops.includes(peek().type) && !(stopIf && stopIf())) list.push(statement());
    return list;
  }

  /** True when the parser is sitting on the start of the next CASE label list. */
  function atCaseLabel() {
    if (peek().type === 'num') return true;                       // 3: / 3, 4:
    if (peek().type === 'ident') {                                // Named: constants
      const n = ts[p + 1];
      return n && n.type === 'op' && (n.value === ':' || n.value === ',');
    }
    return false;
  }

  function statement() {
    const tok = peek();
    switch (tok.type) {
      case 'IF': return ifStmt();
      case 'CASE': return caseStmt();
      case 'FOR': return forStmt();
      case 'WHILE': return whileStmt();
      case 'REPEAT': return repeatStmt();
      case 'EXIT': next(); eat('op', ';'); return { k: 'exit', line: tok.line };
      case 'RETURN': next(); eat('op', ';'); return { k: 'return', line: tok.line };
      case 'ident': {
        const target = reference();
        if (at('op', ':=')) {
          next();
          const value = expr();
          eat('op', ';');
          return { k: 'assign', target, value, line: tok.line };
        }
        if (at('op', '(')) { // FB / procedure call statement
          const call = callArgs(target);
          eat('op', ';');
          return { k: 'call', call, line: tok.line };
        }
        throw stErr(tok.line, 'expected := or ( after identifier');
      }
      case 'op':
        if (tok.value === ';') { next(); return { k: 'nop', line: tok.line }; }
        break;
    }
    throw stErr(tok.line, `unexpected "${tok.value}"`);
  }

  function reference() {
    const base = eat('ident').value;
    let path = base;
    while (at('op', '.')) { next(); path += '.' + eat('ident').value; }
    return { k: 'ref', path, line: peek().line };
  }

  function callArgs(target) {
    eat('op', '(');
    const named = [], pos = [];
    if (!at('op', ')')) {
      do {
        if (peek().type === 'ident' && ts[p + 1]?.type === 'op' && ts[p + 1].value === ':=') {
          const n = next().value; next();
          named.push({ name: n, value: expr() });
        } else pos.push(expr());
      } while (at('op', ',') && next());
    }
    eat('op', ')');
    return { name: target.path, named, pos, line: target.line };
  }

  function ifStmt() {
    const line = eat('IF').line;
    const branches = [];
    let cond = expr();
    eat('THEN');
    branches.push({ cond, body: statements(['ELSIF', 'ELSE', 'END_IF']) });
    while (atKw('ELSIF')) {
      next(); cond = expr(); eat('THEN');
      branches.push({ cond, body: statements(['ELSIF', 'ELSE', 'END_IF']) });
    }
    let alt = null;
    if (atKw('ELSE')) { next(); alt = statements(['END_IF']); }
    eat('END_IF'); if (at('op', ';')) next();
    return { k: 'if', branches, alt, line };
  }

  function caseStmt() {
    const line = eat('CASE').line;
    const subject = expr();
    eat('OF');
    const cases = [];
    let alt = null;
    while (!atKw('END_CASE') && !atKw('ELSE')) {
      const labels = [];
      do {
        const lo = expr();
        if (at('op', '.')) { // range  1..5  (lexed as '.' '.')
          next(); eat('op', '.');
          labels.push({ lo, hi: expr() });
        } else labels.push({ lo });
      } while (at('op', ',') && next());
      eat('op', ':');
      cases.push({ labels, body: statements(['END_CASE', 'ELSE'], atCaseLabel) });
      if (at('eof')) throw stErr(peek().line, 'missing END_CASE');
    }
    if (atKw('ELSE')) { next(); alt = statements(['END_CASE']); }
    eat('END_CASE'); if (at('op', ';')) next();
    return { k: 'case', subject, cases, alt, line };
  }

  function forStmt() {
    const line = eat('FOR').line;
    const v = reference();
    eat('op', ':=');
    const from = expr(); eat('TO'); const to = expr();
    let by = null;
    if (atKw('BY')) { next(); by = expr(); }
    eat('DO');
    const body = statements(['END_FOR']);
    eat('END_FOR'); if (at('op', ';')) next();
    return { k: 'for', v, from, to, by, body, line };
  }

  function whileStmt() {
    const line = eat('WHILE').line;
    const cond = expr(); eat('DO');
    const body = statements(['END_WHILE']);
    eat('END_WHILE'); if (at('op', ';')) next();
    return { k: 'while', cond, body, line };
  }

  function repeatStmt() {
    const line = eat('REPEAT').line;
    const body = statements(['UNTIL']);
    eat('UNTIL');
    const cond = expr();
    eat('END_REPEAT'); if (at('op', ';')) next();
    return { k: 'repeat', body, cond, line };
  }

  // expression precedence (lowest first): OR, XOR, AND, compare, +-, */MOD, **, unary
  const bin = (k, sub, ops) => () => {
    let left = sub();
    for (;;) {
      const t = peek();
      const match = ops.find((o) => (t.type === 'op' && t.value === o) || t.type === o);
      if (!match) return left;
      next();
      left = { k: 'bin', op: match, left, right: sub(), line: t.line };
    }
  };
  const unary = () => {
    const t = peek();
    if (t.type === 'NOT' || (t.type === 'op' && (t.value === '-' || t.value === '+'))) {
      next();
      return { k: 'un', op: t.type === 'NOT' ? 'NOT' : t.value, arg: unary(), line: t.line };
    }
    return power();
  };
  function power() {
    let b = primary();
    if (at('op', '**')) { next(); return { k: 'bin', op: '**', left: b, right: unary() }; }
    return b;
  }
  function primary() {
    const t = peek();
    if (t.type === 'num') { next(); return { k: 'lit', v: t.value }; }
    if (t.type === 'str') { next(); return { k: 'lit', v: t.value }; }
    if (t.type === 'TRUE') { next(); return { k: 'lit', v: true }; }
    if (t.type === 'FALSE') { next(); return { k: 'lit', v: false }; }
    if (t.type === 'op' && t.value === '(') { next(); const e = expr(); eat('op', ')'); return e; }
    if (t.type === 'ident') {
      const r = reference();
      if (at('op', '(')) return { k: 'callexpr', call: callArgs(r), line: t.line };
      return r;
    }
    throw stErr(t.line, `unexpected "${t.value ?? 'end of file'}" in expression`);
  }
  const mul = bin('mul', unary, ['*', '/', 'MOD']);
  const add = bin('add', mul, ['+', '-']);
  const cmp = bin('cmp', add, ['<', '>', '<=', '>=', '=', '<>']);
  const and = bin('and', cmp, ['AND']);
  const xor = bin('xor', and, ['XOR']);
  const expr = bin('or', xor, ['OR']);

  const prog = statements([]);
  eat('eof');
  return prog;
}

// ------------------------------------------------------------ interpreter --
const EXIT = Symbol('exit');
const RETURN = Symbol('return');
const MAX_ITER = 100000;

const FUNCS = {
  ABS: (a) => Math.abs(a), SQRT: (a) => Math.sqrt(a), LN: (a) => Math.log(a),
  LOG: (a) => Math.log10(a), EXP: (a) => Math.exp(a),
  SIN: (a) => Math.sin(a), COS: (a) => Math.cos(a), TAN: (a) => Math.tan(a),
  ASIN: (a) => Math.asin(a), ACOS: (a) => Math.acos(a), ATAN: (a) => Math.atan(a),
  MIN: (...a) => Math.min(...a), MAX: (...a) => Math.max(...a),
  LIMIT: (mn, x, mx) => Math.min(mx, Math.max(mn, x)),
  SEL: (g, a, b) => (g ? b : a),
  MUX: (k, ...a) => a[Math.trunc(k)] ?? 0,
  TRUNC: (a) => Math.trunc(a), ROUND: (a) => Math.round(a),
  INT_TO_REAL: (a) => Number(a), REAL_TO_INT: (a) => Math.round(a),
  BOOL_TO_INT: (a) => (a ? 1 : 0), INT_TO_BOOL: (a) => a !== 0,
  TIME_TO_INT: (a) => Math.trunc(a), INT_TO_TIME: (a) => Math.trunc(a),
  SHL: (a, n) => a << n, SHR: (a, n) => a >>> n,
};

export class STProgram {
  constructor(source) {
    this.source = source;
    this.ast = parse(source);
  }

  /** ctx: { db, dt, locals } */
  run(ctx) {
    this.ctx = ctx;
    ctx.locals ||= new Map();
    try {
      this.block(this.ast);
    } catch (e) {
      if (e === EXIT || e === RETURN) return;
      throw e;
    }
  }

  block(list) { for (const s of list) this.exec(s); }

  exec(s) {
    const c = this.ctx;
    switch (s.k) {
      case 'nop': return;
      case 'assign': {
        const v = this.eval(s.value);
        this.store(s.target.path, v, s.line);
        return;
      }
      case 'call': this.call(s.call); return;
      case 'if': {
        for (const b of s.branches) if (truthy(this.eval(b.cond))) return this.block(b.body);
        if (s.alt) this.block(s.alt);
        return;
      }
      case 'case': {
        const v = this.eval(s.subject);
        for (const cs of s.cases) {
          for (const l of cs.labels) {
            const lo = this.eval(l.lo);
            const hit = l.hi !== undefined ? v >= lo && v <= this.eval(l.hi) : v === lo;
            if (hit) return this.block(cs.body);
          }
        }
        if (s.alt) this.block(s.alt);
        return;
      }
      case 'for': {
        const from = this.eval(s.from), to = this.eval(s.to);
        const by = s.by ? this.eval(s.by) : 1;
        if (by === 0) throw stErr(s.line, 'FOR step is 0');
        let n = 0;
        for (let i = from; by > 0 ? i <= to : i >= to; i += by) {
          this.store(s.v.path, i, s.line);
          if (++n > MAX_ITER) throw stErr(s.line, 'FOR loop exceeded iteration limit (watchdog)');
          try { this.block(s.body); } catch (e) { if (e === EXIT) break; throw e; }
        }
        return;
      }
      case 'while': {
        let n = 0;
        while (truthy(this.eval(s.cond))) {
          if (++n > MAX_ITER) throw stErr(s.line, 'WHILE loop exceeded iteration limit (watchdog)');
          try { this.block(s.body); } catch (e) { if (e === EXIT) break; throw e; }
        }
        return;
      }
      case 'repeat': {
        let n = 0;
        do {
          if (++n > MAX_ITER) throw stErr(s.line, 'REPEAT loop exceeded iteration limit (watchdog)');
          try { this.block(s.body); } catch (e) { if (e === EXIT) break; throw e; }
        } while (!truthy(this.eval(s.cond)));
        return;
      }
      case 'exit': throw EXIT;
      case 'return': throw RETURN;
      default: throw stErr(s.line, `cannot execute ${s.k}`);
    }
    void c;
  }

  eval(n) {
    switch (n.k) {
      case 'lit': return n.v;
      case 'ref': {
        const v = this.load(n.path, n.line);
        return v;
      }
      case 'un': {
        const a = this.eval(n.arg);
        if (n.op === 'NOT') return typeof a === 'boolean' ? !a : ~Math.trunc(a);
        return n.op === '-' ? -a : +a;
      }
      case 'bin': return binop(n.op, this.eval(n.left), this.eval(n.right), n.line);
      case 'callexpr': return this.call(n.call);
      default: throw stErr(n.line, `cannot evaluate ${n.k}`);
    }
  }

  load(path, line) {
    const db = this.ctx.db;
    if (db.typeOf(path) !== undefined || db.read(path) !== undefined) {
      const v = db.read(path);
      if (v !== undefined) return v;
    }
    if (this.ctx.locals.has(path)) return this.ctx.locals.get(path);
    throw stErr(line, `undeclared identifier "${path}"`);
  }

  store(path, v, line) {
    const db = this.ctx.db;
    if (db.typeOf(path) !== undefined) { db.write(path, v); return; }
    if (!path.includes('.')) { this.ctx.locals.set(path, v); return; }
    throw stErr(line, `cannot assign to "${path}" — no such tag`);
  }

  /** Function call OR function-block instance invocation. */
  call(c) {
    const upper = c.name.toUpperCase();
    if (FUNCS[upper] && !this.ctx.db.has(c.name)) {
      const args = c.pos.map((a) => this.eval(a));
      return FUNCS[upper](...args);
    }
    const inst = this.ctx.db.read(c.name);
    if (inst && typeof inst === 'object' && inst.__fb) {
      const args = {};
      for (const a of c.named) args[a.name.toUpperCase()] = this.eval(a.value);
      // positional args map onto the FB's input pins in declared order
      const pins = FB_INPUTS[inst.__fb] || [];
      c.pos.forEach((a, i) => { if (pins[i]) args[pins[i]] = this.eval(a); });
      execFB(inst, args, this.ctx.dt);
      return inst.Q ?? inst.Q1 ?? false;
    }
    throw stErr(c.line, `unknown function or function block "${c.name}"`);
  }
}

/**
 * A single ST expression, compiled once and evaluated per scan.
 * Used for SFC transition conditions and anywhere a boolean condition is typed
 * into the UI rather than written as a statement.
 */
export class STExpression {
  constructor(src) {
    this.source = src;
    const stmts = parse(`__expr := ${src};`);
    this.node = stmts[0].value;
  }

  eval(ctx) {
    const host = Object.create(STProgram.prototype);
    host.ctx = { ...ctx, locals: ctx.locals || new Map() };
    return host.eval(this.node);
  }

  evalBool(ctx) {
    return truthy(this.eval(ctx));
  }
}

const FB_INPUTS = {
  TON: ['IN', 'PT'], TOF: ['IN', 'PT'], TP: ['IN', 'PT'],
  CTU: ['CU', 'R', 'PV'], CTD: ['CD', 'LD', 'PV'],
  R_TRIG: ['CLK'], F_TRIG: ['CLK'], RS: ['S', 'R1'], SR: ['S1', 'R'],
};

/** Execute one call of a function-block instance with `dt` ms elapsed. */
export function execFB(inst, args, dt) {
  const A = (k, d) => (args[k] !== undefined ? args[k] : d);
  switch (inst.__fb) {
    case 'TON': {
      inst.IN = truthy(A('IN', inst.IN)); inst.PT = A('PT', inst.PT);
      if (!inst.IN) { inst.ET = 0; inst.Q = false; }
      else { inst.ET = Math.min(inst.PT, inst.ET + dt); inst.Q = inst.ET >= inst.PT; }
      break;
    }
    case 'TOF': {
      inst.IN = truthy(A('IN', inst.IN)); inst.PT = A('PT', inst.PT);
      if (inst.IN) { inst.ET = 0; inst.Q = true; }
      else if (inst.Q) { inst.ET = Math.min(inst.PT, inst.ET + dt); if (inst.ET >= inst.PT) inst.Q = false; }
      break;
    }
    case 'TP': {
      const IN = truthy(A('IN', inst.IN)); inst.PT = A('PT', inst.PT);
      if (IN && !inst.IN && !inst.Q) { inst.Q = true; inst.ET = 0; }
      if (inst.Q) { inst.ET = Math.min(inst.PT, inst.ET + dt); if (inst.ET >= inst.PT) inst.Q = false; }
      if (!IN && !inst.Q) inst.ET = 0;
      inst.IN = IN;
      break;
    }
    case 'CTU': {
      const CU = truthy(A('CU', false));
      inst.PV = A('PV', inst.PV);
      if (truthy(A('R', false))) inst.CV = 0;
      else if (CU && !inst.prevCU) inst.CV = coerce('INT', inst.CV + 1);
      inst.prevCU = CU; inst.Q = inst.CV >= inst.PV;
      break;
    }
    case 'CTD': {
      const CD = truthy(A('CD', false));
      inst.PV = A('PV', inst.PV);
      if (truthy(A('LD', false))) inst.CV = inst.PV;
      else if (CD && !inst.prevCD) inst.CV = coerce('INT', inst.CV - 1);
      inst.prevCD = CD; inst.Q = inst.CV <= 0;
      break;
    }
    case 'R_TRIG': {
      const CLK = truthy(A('CLK', false));
      inst.Q = CLK && !inst.M; inst.M = CLK; inst.CLK = CLK;
      break;
    }
    case 'F_TRIG': {
      const CLK = truthy(A('CLK', false));
      inst.Q = !CLK && inst.M; inst.M = CLK; inst.CLK = CLK;
      break;
    }
    case 'RS': { // reset dominant
      if (truthy(A('S', false))) inst.Q1 = true;
      if (truthy(A('R1', false))) inst.Q1 = false;
      break;
    }
    case 'SR': { // set dominant
      if (truthy(A('R', false))) inst.Q1 = false;
      if (truthy(A('S1', false))) inst.Q1 = true;
      break;
    }
    default: throw new Error(`unsupported function block ${inst.__fb}`);
  }
}

const truthy = (v) => (typeof v === 'boolean' ? v : Number(v) !== 0);

function binop(op, a, b, line) {
  switch (op) {
    case '+': return typeof a === 'string' || typeof b === 'string' ? String(a) + String(b) : a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/':
      if (Number(b) === 0) throw stErr(line, 'division by zero');
      return a / b;
    case 'MOD':
      if (Number(b) === 0) throw stErr(line, 'MOD by zero');
      return Math.trunc(a) % Math.trunc(b);
    case '**': return a ** b;
    case '<': return a < b; case '>': return a > b;
    case '<=': return a <= b; case '>=': return a >= b;
    case '=': return a === b || Number(a) === Number(b);
    case '<>': return !(a === b || Number(a) === Number(b));
    case 'AND': return typeof a === 'boolean' || typeof b === 'boolean' ? truthy(a) && truthy(b) : a & b;
    case 'OR': return typeof a === 'boolean' || typeof b === 'boolean' ? truthy(a) || truthy(b) : a | b;
    case 'XOR': return typeof a === 'boolean' || typeof b === 'boolean' ? truthy(a) !== truthy(b) : a ^ b;
    default: throw stErr(line, `unknown operator ${op}`);
  }
}
