// Controller runtime: compile (download), scan cycle, mode handling, watchdog.
//
// Scan cycle, as on a real controller:
//   1. input image update   (I/O sim -> input tags)
//   2. logic execution      (main routine, JSR into others)
//   3. output image update  (output tags -> I/O sim)
// plus a simulated execution-time model derived from the device profile.

import { evalRung, verifyRung, countElements, walkNodes } from './ladder.js';
import { STProgram } from './st.js';
import { evalNetwork, verifyNetwork, fbdBlockCount } from './fbd.js';
import { evalSfc, compileSfc, verifySfc, sfcElementCount } from './sfc.js';
import { ioPoints } from './devices.js';

export const MODE = { PROGRAM: 'PROGRAM', RUN: 'RUN', FAULT: 'FAULT' };

export class Controller {
  constructor(project, onEvent) {
    this.project = project;
    this.onEvent = onEvent || (() => {});
    this.mode = MODE.PROGRAM;
    this.compiled = null;
    this.state = {};             // per-element scratch (edge memories)
    this.power = new Map();      // element id -> energised, for online display
    this.scanMs = 0;
    this.scanCount = 0;
    this.loadPct = 0;
    this.memUsed = 0;
    this.fault = null;
    this.timer = null;
    this.lastTick = 0;
    this.overruns = 0;
    this.io = { inputs: new Map(), outputs: new Map() }; // address -> value
    // An EtherCAT master only drives outputs in OP; SAFEOP still reads inputs;
    // INIT/PREOP exchange no process data at all.
    this.outputsEnabled = true;
    this.inputsEnabled = true;
    this.initIo();
  }

  initIo() {
    this.io.inputs.clear(); this.io.outputs.clear();
    for (const p of ioPoints(this.project.device)) {
      (p.dir === 'in' ? this.io.inputs : this.io.outputs).set(p.address, p.analog ? 0 : false);
    }
  }

  // ------------------------------------------------------------- compile --
  download() {
    const { project } = this;
    const errors = [];
    const compiled = { routines: new Map(), main: null };
    let elements = 0;

    const routineNames = project.routines.map((r) => r.name);

    for (const r of project.routines) {
      if (r.lang === 'LD') {
        r.rungs.forEach((rung, i) => {
          for (const e of verifyRung(project.tags, rung, i)) {
            errors.push({ routine: r.name, ...e });
          }
          elements += countElements(rung);
        });
        compiled.routines.set(r.name, { kind: 'LD', rungs: r.rungs });
      } else if (r.lang === 'FBD') {
        for (const e of verifyNetwork(project.tags, r)) errors.push({ routine: r.name, ...e });
        elements += fbdBlockCount(r);
        compiled.routines.set(r.name, { kind: 'FBD', routine: r });
      } else if (r.lang === 'SFC') {
        for (const e of verifySfc(project.tags, r, routineNames)) errors.push({ routine: r.name, ...e });
        const c = compileSfc(r);
        for (const e of c.errors) errors.push({ routine: r.name, ...e });
        elements += sfcElementCount(r);
        compiled.routines.set(r.name, { kind: 'SFC', routine: r, sfc: c });
      } else {
        try {
          const prog = new STProgram(r.code || '');
          elements += Math.max(1, (r.code || '').split(';').length - 1);
          compiled.routines.set(r.name, { kind: 'ST', prog });
        } catch (err) {
          errors.push({ routine: r.name, msg: err.message, line: err.stLine });
        }
      }
    }

    compiled.main = project.mainRoutine && compiled.routines.has(project.mainRoutine)
      ? project.mainRoutine
      : project.routines[0]?.name;
    if (!compiled.main) errors.push({ routine: '-', msg: 'project contains no routines' });

    const dev = project.device;
    this.memUsed = elements * (dev.memPerElement ?? 96)
      + project.tags.list().length * (dev.memPerTag ?? 40);
    if (this.memUsed > dev.memBytes) {
      // must go into `errors` — it is what the UI reports
      errors.push({
        routine: '-',
        msg: `logic memory exceeded: ${fmtBytes(this.memUsed)} of ${fmtBytes(dev.memBytes)} on ${dev.name}`,
      });
    }
    const hard = errors.filter((e) => !e.warn);

    if (hard.length) {
      this.compiled = null;
      this.onEvent('download', { ok: false, errors });
      return { ok: false, errors };
    }
    this.compiled = compiled;
    this.elementCount = elements;
    this.stop();
    this.state = {};
    this.power.clear();
    project.tags.resetNonRetentive();
    this.onEvent('download', { ok: true, errors, elements });
    return { ok: true, errors };
  }

  // ---------------------------------------------------------------- mode --
  run() {
    if (!this.compiled) { const r = this.download(); if (!r.ok) return r; }
    this.fault = null;
    this.mode = MODE.RUN;
    this.lastTick = performance.now();
    this.overruns = 0;
    const period = Math.max(1, this.project.taskPeriodMs);
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), period);
    this.onEvent('mode', this.mode);
    return { ok: true };
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
    if (this.mode !== MODE.FAULT) this.mode = MODE.PROGRAM;
    // outputs de-energise when leaving RUN, as they do on a real controller
    for (const k of this.io.outputs.keys()) {
      this.io.outputs.set(k, typeof this.io.outputs.get(k) === 'boolean' ? false : 0);
    }
    this.power.clear();
    this.onEvent('mode', this.mode);
  }

  clearFault() {
    this.fault = null;
    this.mode = MODE.PROGRAM;
    this.onEvent('mode', this.mode);
  }

  tick() {
    const now = performance.now();
    const dt = Math.min(200, Math.max(0, now - this.lastTick)) || this.project.taskPeriodMs;
    this.lastTick = now;
    this.scan(dt);
  }

  /** One complete scan. `dt` = elapsed ms credited to timers. */
  scan(dt = this.project.taskPeriodMs) {
    if (!this.compiled) { const r = this.download(); if (!r.ok) return; }
    const db = this.project.tags;
    const dev = this.project.device;

    this.readInputs(db);

    const ctx = {
      db, dt, state: this.state, power: this.power,
      executed: 0, jumpTo: null, returning: false,
      callRoutine: (name) => this.execRoutine(ctx, name, 1),
    };

    try {
      this.execRoutine(ctx, this.compiled.main, 0);
      this.writeOutputs(db);
      this.scanCount++;
    } catch (err) {
      this.raiseFault(err);
      return;
    }

    // execution-time model
    const us = dev.overheadUs + ctx.executed * dev.usPerElement;
    this.scanMs = us / 1000;
    const period = Math.max(1, this.project.taskPeriodMs);
    this.loadPct = Math.min(999, (this.scanMs / period) * 100);
    if (this.scanMs > period) {
      if (++this.overruns >= 20) {
        this.raiseFault(new Error(
          `Task overrun: scan ${this.scanMs.toFixed(2)} ms exceeds the ${period} ms task period`));
        return;
      }
    } else this.overruns = Math.max(0, this.overruns - 1);

    this.onEvent('scan', this);
  }

  execRoutine(ctx, name, depth) {
    if (depth > 8) throw new Error(`routine nesting too deep at "${name}" (recursive JSR?)`);
    const r = this.compiled.routines.get(name);
    if (!r) throw new Error(`routine "${name}" does not exist`);
    const savedReturn = ctx.returning;
    ctx.returning = false;

    if (r.kind === 'ST') {
      ctx.executed += 4;
      r.prog.run({ db: ctx.db, dt: ctx.dt, locals: (this.stLocals ||= new Map()) });
    } else if (r.kind === 'FBD') {
      evalNetwork(ctx, r.routine);
    } else if (r.kind === 'SFC') {
      evalSfc(ctx, r.routine, r.sfc);
    } else {
      let i = 0;
      let guard = 0;
      while (i < r.rungs.length) {
        if (++guard > r.rungs.length * 50) throw new Error(`JMP loop in routine "${name}"`);
        evalRung(ctx, r.rungs[i]);
        if (ctx.returning) break;
        if (ctx.jumpTo) {
          const target = findLabel(r.rungs, ctx.jumpTo);
          if (target < 0) throw new Error(`LBL "${ctx.jumpTo}" not found in "${name}"`);
          ctx.jumpTo = null;
          i = target;
          continue;
        }
        i++;
      }
    }
    ctx.returning = savedReturn;
    ctx.jumpTo = null;
  }

  raiseFault(err) {
    this.fault = { message: err.message, elementId: err.elementId || null, at: this.scanCount };
    this.mode = MODE.FAULT;
    clearInterval(this.timer); this.timer = null;
    this.onEvent('fault', this.fault);
    this.onEvent('mode', this.mode);
  }

  // ------------------------------------------------------------------ I/O --
  readInputs(db) {
    if (!this.inputsEnabled) return;
    for (const t of db.list()) {
      if (t.dir === 'in' && t.address && this.io.inputs.has(t.address)) {
        db.write(t.name, this.io.inputs.get(t.address));
      }
    }
  }

  writeOutputs(db) {
    if (!this.outputsEnabled) return;
    for (const t of db.list()) {
      if (t.dir === 'out' && t.address && this.io.outputs.has(t.address)) {
        this.io.outputs.set(t.address, t.value);
      }
    }
  }

  forceInput(address, value) { this.io.inputs.set(address, value); }
}

function findLabel(rungs, label) {
  for (let i = 0; i < rungs.length; i++) {
    let hit = false;
    walkNodes(rungs[i].elements, (n) => {
      if (n.type !== 'branch' && n.op === 'LBL' && String(n.ops[0]).trim() === label) hit = true;
    });
    if (hit) return i;
  }
  return -1;
}

export function fmtBytes(b) {
  if (b >= 1048576) return `${(b / 1048576).toFixed(2)} MB`;
  if (b >= 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${b} B`;
}
