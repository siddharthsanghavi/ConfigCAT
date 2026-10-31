// Ladder Diagram model + evaluator.
//
// A rung is a series list of nodes evaluated left-to-right:
//   element : { id, op, ops:[...] }
//   branch  : { id, type:'branch', paths: [ [node,...], [node,...] ] }
//
// Power flow through a branch is the OR of its paths; every path is still
// executed so that outputs inside a branch behave like the real thing.

import { INSTRUCTIONS, instrDef } from './instructions.js';

let uid = 1;
export const newId = () => `e${uid++}`;
export function seedIds(project) { // keep ids unique after loading a file
  let max = 0;
  const walk = (nodes) => nodes.forEach((n) => {
    const m = /^e(\d+)$/.exec(n.id || ''); if (m) max = Math.max(max, +m[1]);
    if (n.type === 'branch') n.paths.forEach(walk);
  });
  for (const r of project.routines) if (r.rungs) r.rungs.forEach((g) => { walk(g.elements); const m = /^e(\d+)$/.exec(g.id || ''); if (m) max = Math.max(max, +m[1]); });
  uid = max + 1;
}

export function makeElement(op) {
  const def = instrDef(op);
  if (!def) throw new Error(`Unknown instruction ${op}`);
  return { id: newId(), op, ops: def.ops.map(() => '') };
}

export const makeBranch = () => ({ id: newId(), type: 'branch', paths: [[], []] });

export const makeRung = (comment = '') => ({ id: newId(), comment, elements: [] });

// ---------------------------------------------------------------- editing --

/** Locate a node's containing array + index. Returns {list,index,parent} | null */
export function locate(rung, id) {
  const search = (list, parent) => {
    for (let i = 0; i < list.length; i++) {
      const n = list[i];
      if (n.id === id) return { list, index: i, parent };
      if (n.type === 'branch') {
        for (const p of n.paths) { const r = search(p, n); if (r) return r; }
      }
    }
    return null;
  };
  return search(rung.elements, null);
}

/** Insert `node` into the list identified by `target` = {listRef, index}. */
export function insertAt(list, index, node) {
  list.splice(Math.max(0, Math.min(index, list.length)), 0, node);
}

export function removeNode(rung, id) {
  const loc = locate(rung, id);
  if (!loc) return false;
  loc.list.splice(loc.index, 1);
  return true;
}

/** Collect every node id in a rung (for state cleanup / stats). */
export function walkNodes(list, fn) {
  for (const n of list) {
    fn(n);
    if (n.type === 'branch') n.paths.forEach((p) => walkNodes(p, fn));
  }
}

export function countElements(rung) {
  let n = 0;
  walkNodes(rung.elements, (x) => { if (x.type !== 'branch') n++; });
  return n;
}

// -------------------------------------------------------------- evaluation --

/**
 * Evaluate one rung.
 * @param ctx  { db, dt, state, power:Map, jumpTo, returning, callRoutine }
 * @returns power at the right rail
 */
export function evalRung(ctx, rung) {
  return evalSeries(ctx, rung.elements, true);
}

function evalSeries(ctx, list, powerIn) {
  let p = powerIn;
  for (const node of list) {
    if (ctx.returning || ctx.jumpTo) {
      // still record de-energised state for anything skipped
      markDead(ctx, [node]);
      continue;
    }
    if (node.type === 'branch') {
      let any = false;
      for (const path of node.paths) {
        const out = path.length ? evalSeries(ctx, path, p) : p; // empty path = short circuit
        any = any || out;
      }
      ctx.power.set(node.id, any);
      p = any;
    } else {
      const def = INSTRUCTIONS[node.op];
      if (!def) throw new Error(`Unknown instruction "${node.op}"`);
      let out;
      try {
        out = !!def.eval(ctx, node, p);
      } catch (err) {
        err.elementId = node.id;
        throw err;
      }
      ctx.power.set(node.id, out);
      ctx.executed++;
      // Outputs never block the rest of the rung (parallel coils on one rung).
      p = def.output ? p : out;
    }
  }
  return p;
}

function markDead(ctx, list) {
  walkNodes(list, (n) => ctx.power.set(n.id, false));
}

/** Static checks run at download time. Returns array of {rung, element, msg}. */
export function verifyRung(db, rung, rungIndex) {
  const errs = [];
  walkNodes(rung.elements, (n) => {
    if (n.type === 'branch') {
      if (n.paths.every((p) => p.length === 0)) {
        errs.push({ rung: rungIndex, element: n.id, msg: 'branch has no instructions' });
      }
      return;
    }
    const def = INSTRUCTIONS[n.op];
    if (!def) { errs.push({ rung: rungIndex, element: n.id, msg: `unknown instruction ${n.op}` }); return; }
    def.ops.forEach((spec, i) => {
      const v = String(n.ops[i] ?? '').trim();
      if (!v) {
        if (spec.name === 'reset' || spec.name === 'load') return; // optional
        errs.push({ rung: rungIndex, element: n.id, msg: `${n.op}: operand "${spec.name}" is empty` });
        return;
      }
      if (spec.role === 'const') return;
      const literal = /^-?\d/.test(v) || /^(TIME|T)#/i.test(v) || /^(TRUE|FALSE)$/i.test(v);
      if (literal) {
        if (spec.role === 'tag') {
          errs.push({ rung: rungIndex, element: n.id, msg: `${n.op}: "${spec.name}" must be a tag, not a literal` });
        }
        return;
      }
      const t = db.typeOf(v);
      if (t === undefined) {
        errs.push({ rung: rungIndex, element: n.id, msg: `${n.op}: undefined tag "${v}"` });
      } else if (spec.types && !spec.types.includes(t)) {
        errs.push({ rung: rungIndex, element: n.id,
          msg: `${n.op}: "${v}" is ${t}, expected ${spec.types.join('/')}` });
      }
    });
  });
  // A rung with instructions but no output does nothing observable.
  const hasOut = (() => { let f = false; walkNodes(rung.elements, (n) => { if (n.type !== 'branch' && INSTRUCTIONS[n.op]?.output) f = true; }); return f; })();
  if (countElements(rung) > 0 && !hasOut) {
    errs.push({ rung: rungIndex, element: null, msg: 'rung has no output instruction', warn: true });
  }
  return errs;
}
