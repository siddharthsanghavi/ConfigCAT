// IEC 61131-3 elementary data types, function-block instance types, and the
// tag database that both the ladder engine and the ST interpreter read/write.

export const ELEMENTARY = ['BOOL', 'BYTE', 'WORD', 'INT', 'DINT', 'REAL', 'TIME', 'STRING'];

/** Function block types that can be declared as a tag (instance data). */
export const FB_TYPES = {
  TON:  { members: { IN: 'BOOL', PT: 'TIME', Q: 'BOOL', ET: 'TIME' }, hidden: { start: 0 } },
  TOF:  { members: { IN: 'BOOL', PT: 'TIME', Q: 'BOOL', ET: 'TIME' }, hidden: { start: 0 } },
  TP:   { members: { IN: 'BOOL', PT: 'TIME', Q: 'BOOL', ET: 'TIME' }, hidden: { start: 0 } },
  CTU:  { members: { CU: 'BOOL', R: 'BOOL', PV: 'INT', Q: 'BOOL', CV: 'INT' }, hidden: { prevCU: false } },
  CTD:  { members: { CD: 'BOOL', LD: 'BOOL', PV: 'INT', Q: 'BOOL', CV: 'INT' }, hidden: { prevCD: false } },
  R_TRIG: { members: { CLK: 'BOOL', Q: 'BOOL' }, hidden: { M: false } },
  F_TRIG: { members: { CLK: 'BOOL', Q: 'BOOL' }, hidden: { M: false } },
  RS:   { members: { S: 'BOOL', R1: 'BOOL', Q1: 'BOOL' }, hidden: {} },
  SR:   { members: { S1: 'BOOL', R: 'BOOL', Q1: 'BOOL' }, hidden: {} },
};

export const isFbType = (t) => Object.prototype.hasOwnProperty.call(FB_TYPES, t);

export const RANGES = {
  BYTE: [0, 255], WORD: [0, 65535],
  INT: [-32768, 32767], DINT: [-2147483648, 2147483647],
};

export function defaultValue(type) {
  if (isFbType(type)) {
    const d = { __fb: type };
    for (const [m, mt] of Object.entries(FB_TYPES[type].members)) d[m] = defaultValue(mt);
    Object.assign(d, structuredClone(FB_TYPES[type].hidden));
    return d;
  }
  switch (type) {
    case 'BOOL': return false;
    case 'REAL': return 0.0;
    case 'STRING': return '';
    default: return 0; // BYTE/WORD/INT/DINT/TIME(ms)
  }
}

/** Clamp/convert a JS value into the representation of `type`. */
export function coerce(type, v) {
  if (type === 'BOOL') return !!v && v !== 0;
  if (type === 'STRING') return String(v ?? '');
  if (type === 'REAL') { const n = Number(v); return Number.isFinite(n) ? n : 0; }
  let n = Math.trunc(Number(v) || 0);
  const r = RANGES[type];
  if (r) { // wrap like a real controller rather than saturating
    const span = r[1] - r[0] + 1;
    n = ((((n - r[0]) % span) + span) % span) + r[0];
  }
  if (type === 'TIME') n = Math.max(0, n);
  return n;
}

/** Parse IEC duration literals: T#1s, T#500ms, T#1m30s, TIME#2h. -> milliseconds */
export function parseTime(text) {
  const s = String(text).trim().replace(/^(TIME|T)#/i, '');
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(parseFloat(s)); // bare ms
  const re = /(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)/gi;
  let ms = 0, m, matched = false;
  const mult = { ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000 };
  while ((m = re.exec(s))) { matched = true; ms += parseFloat(m[1]) * mult[m[2].toLowerCase()]; }
  return matched ? Math.round(ms) : 0;
}

export function formatTime(ms) {
  if (ms < 1000) return `T#${ms}ms`;
  if (ms % 1000 === 0 && ms < 60000) return `T#${ms / 1000}s`;
  return `T#${(ms / 1000).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}s`;
}

// --------------------------------------------------------------------------
// Tag database
// --------------------------------------------------------------------------
export class TagDB {
  constructor() { this.tags = new Map(); }

  add(name, type, opts = {}) {
    name = name.trim();
    if (!name) throw new Error('Tag name required');
    if (this.tags.has(name)) throw new Error(`Tag "${name}" already exists`);
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error(`Illegal tag name "${name}"`);
    const t = {
      name, type,
      value: defaultValue(type),
      address: opts.address || '',   // linked I/O point, '' = internal memory
      dir: opts.dir || 'mem',        // 'in' | 'out' | 'mem'
      comment: opts.comment || '',
      retain: !!opts.retain,
    };
    this.tags.set(name, t);
    return t;
  }

  rename(oldName, newName) {
    const t = this.tags.get(oldName);
    if (!t) return;
    if (this.tags.has(newName)) throw new Error(`Tag "${newName}" already exists`);
    this.tags.delete(oldName);
    t.name = newName;
    this.tags.set(newName, t);
  }

  remove(name) { this.tags.delete(name); }
  get(name) { return this.tags.get(name); }
  has(name) { return this.tags.has(name); }
  list() { return [...this.tags.values()]; }

  /** Read "Tag" or "Instance.Member". Returns undefined if unresolvable. */
  read(path) {
    const [base, member] = String(path).split('.');
    const t = this.tags.get(base);
    if (!t) return undefined;
    if (member === undefined) return t.value;
    return t.value && typeof t.value === 'object' ? t.value[member] : undefined;
  }

  write(path, v) {
    const [base, member] = String(path).split('.');
    const t = this.tags.get(base);
    if (!t) return false;
    if (member === undefined) { t.value = coerce(t.type, v); return true; }
    if (t.value && typeof t.value === 'object') {
      const mt = FB_TYPES[t.type]?.members[member];
      t.value[member] = mt ? coerce(mt, v) : v;
      return true;
    }
    return false;
  }

  /** Type of a tag path, or undefined. */
  typeOf(path) {
    const [base, member] = String(path).split('.');
    const t = this.tags.get(base);
    if (!t) return undefined;
    if (member === undefined) return t.type;
    return FB_TYPES[t.type]?.members[member];
  }

  resetNonRetentive() {
    for (const t of this.tags.values()) if (!t.retain) t.value = defaultValue(t.type);
  }

  toJSON() {
    return this.list().map((t) => ({
      name: t.name, type: t.type, address: t.address, dir: t.dir,
      comment: t.comment, retain: t.retain,
    }));
  }

  static fromJSON(arr) {
    const db = new TagDB();
    for (const t of arr) db.add(t.name, t.type, t);
    return db;
  }
}
