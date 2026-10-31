// Sequential Function Chart: steps, actions, transitions and the token engine.
//
// Model: a set of steps, each with actions and outgoing transitions. Exactly one
// step is active at a time (a single token); alternative branches fall out of a
// step having several outgoing transitions, evaluated top to bottom, first true
// wins. Transition conditions are ST expressions.
//
// Action qualifiers:
//   N  non-stored — target is TRUE while the step is active, FALSE when it exits
//   S  set        — target latched TRUE on step entry
//   R  reset      — target forced FALSE on step entry
//   P  pulse      — target TRUE for exactly one scan on entry
//   C  call       — target names a routine, executed every scan while active

import { STExpression } from './st.js';

export const QUALIFIERS = ['N', 'S', 'R', 'P', 'C'];

let sid = 1;
export const newSfcId = () => `s${sid++}`;
export function seedSfcIds(routines) {
  let max = 0;
  for (const r of routines) {
    if (r.lang !== 'SFC') continue;
    for (const x of [...(r.steps || []), ...(r.transitions || [])]) {
      const m = /^s(\d+)$/.exec(x.id || '');
      if (m) max = Math.max(max, +m[1]);
    }
  }
  sid = Math.max(sid, max + 1);
}

export function makeStep(name, initial = false) {
  return { id: newSfcId(), name, initial, actions: [] };
}

export function makeTransition(from, to, cond = 'TRUE') {
  return { id: newSfcId(), from, to, cond };
}

export function makeSfcRoutine(name) {
  const s0 = makeStep('Init', true);
  const s1 = makeStep('Step_1');
  return {
    name, lang: 'SFC',
    steps: [s0, s1],
    transitions: [makeTransition(s0.id, s1.id, 'TRUE'), makeTransition(s1.id, s0.id, 'FALSE')],
  };
}

export const stepById = (r, id) => r.steps.find((s) => s.id === id);
export const outgoing = (r, stepId) => r.transitions.filter((t) => t.from === stepId);

export function deleteStep(r, id) {
  r.steps = r.steps.filter((s) => s.id !== id);
  r.transitions = r.transitions.filter((t) => t.from !== id && t.to !== id);
}

/** Vertical layout: initial step first, then targets in discovery order. */
export function chartOrder(r) {
  const order = [];
  const seen = new Set();
  const push = (s) => { if (s && !seen.has(s.id)) { seen.add(s.id); order.push(s); } };
  push(r.steps.find((s) => s.initial) || r.steps[0]);
  for (let i = 0; i < order.length; i++) {
    for (const t of outgoing(r, order[i].id)) push(stepById(r, t.to));
  }
  for (const s of r.steps) push(s); // unreachable steps still get drawn
  return order;
}

// -------------------------------------------------------------- compilation --
export function compileSfc(routine) {
  const conds = new Map();
  const errors = [];
  for (const t of routine.transitions) {
    try {
      conds.set(t.id, new STExpression(t.cond || 'FALSE'));
    } catch (err) {
      errors.push({ element: t.id, msg: `transition condition: ${err.message}` });
    }
  }
  return { conds, errors };
}

export function verifySfc(db, routine, routineNames) {
  const errs = [];
  const initials = routine.steps.filter((s) => s.initial);
  if (initials.length === 0) errs.push({ element: null, msg: 'chart has no initial step' });
  if (initials.length > 1) errs.push({ element: null, msg: 'chart has more than one initial step' });

  const ids = new Set(routine.steps.map((s) => s.id));
  for (const t of routine.transitions) {
    if (!ids.has(t.from) || !ids.has(t.to)) {
      errs.push({ element: t.id, msg: 'transition references a deleted step' });
    }
    try { new STExpression(t.cond || 'FALSE'); }
    catch (err) { errs.push({ element: t.id, msg: `transition condition: ${err.message}` }); }
  }
  for (const s of routine.steps) {
    if (!outgoing(routine, s.id).length) {
      errs.push({ element: s.id, warn: true, msg: `step "${s.name}" has no outgoing transition (dead end)` });
    }
    for (const a of s.actions) {
      if (!a.target) { errs.push({ element: s.id, msg: `step "${s.name}": action has no target` }); continue; }
      if (a.q === 'C') {
        if (!routineNames.includes(a.target)) {
          errs.push({ element: s.id, msg: `step "${s.name}": no routine named "${a.target}"` });
        }
      } else if (db.typeOf(a.target) === undefined) {
        errs.push({ element: s.id, msg: `step "${s.name}": undefined tag "${a.target}"` });
      } else if (db.typeOf(a.target) !== 'BOOL') {
        errs.push({ element: s.id, msg: `step "${s.name}": "${a.target}" is not BOOL` });
      }
    }
  }
  return errs;
}

// --------------------------------------------------------------- execution --
/**
 * Execute one scan of a chart.
 * ctx = { db, dt, state, power:Map, callRoutine(name) }
 */
export function evalSfc(ctx, routine, compiled) {
  const store = (ctx.state.__sfc ||= {});
  const s = (store[routine.name] ||= { active: null, entered: true, elapsed: 0 });

  if (!s.active || !stepById(routine, s.active)) {
    const init = routine.steps.find((x) => x.initial) || routine.steps[0];
    if (!init) return;
    s.active = init.id; s.entered = true; s.elapsed = 0;
  }

  const step = stepById(routine, s.active);
  ctx.executed += 2;

  // --- entry actions -------------------------------------------------------
  if (s.entered) {
    for (const a of step.actions) {
      if (a.q === 'S') ctx.db.write(a.target, true);
      else if (a.q === 'R') ctx.db.write(a.target, false);
    }
  }

  // --- actions active this scan -------------------------------------------
  for (const a of step.actions) {
    if (a.q === 'N') ctx.db.write(a.target, true);
    else if (a.q === 'P') ctx.db.write(a.target, s.entered);
    else if (a.q === 'C') ctx.callRoutine(a.target);
  }

  s.elapsed += ctx.dt;
  ctx.power.set(step.id, true);
  for (const other of routine.steps) if (other.id !== step.id) ctx.power.set(other.id, false);
  ctx.db.write('__StepTime', s.elapsed); // harmless if the tag does not exist

  // --- transitions ---------------------------------------------------------
  let fired = null;
  for (const t of outgoing(routine, step.id)) {
    const expr = compiled.conds.get(t.id);
    let v = false;
    if (expr) {
      try { v = expr.evalBool({ db: ctx.db, dt: ctx.dt }); }
      catch (err) { err.elementId = t.id; throw err; }
    }
    ctx.power.set(t.id, v);
    if (v && !fired) fired = t;
  }
  s.entered = false;

  if (fired) {
    // leaving the step: non-stored actions drop out, pulses end
    for (const a of step.actions) {
      if (a.q === 'N' || a.q === 'P') ctx.db.write(a.target, false);
    }
    s.active = fired.to;
    s.entered = true;
    s.elapsed = 0;
  }
}

/** Currently active step id, for the editor's online display. */
export function activeStep(state, routineName) {
  return state.__sfc?.[routineName]?.active || null;
}

export function stepElapsed(state, routineName) {
  return state.__sfc?.[routineName]?.elapsed || 0;
}

export function sfcElementCount(r) {
  return r.steps.length + r.transitions.length
    + r.steps.reduce((a, s) => a + s.actions.length, 0);
}
