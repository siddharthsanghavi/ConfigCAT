/* The PLC side: PLCSIM's controller running a Structured Text program over
 * the station's process image.
 *
 * The program is written the way TwinCAT and CODESYS present it — an optional
 * PROGRAM header and VAR … END_VAR blocks — and those declarations become tags.
 * `name AT %IX0.3 : BOOL;` links a variable to a process-image address, which
 * is how TwinCAT maps I/O. Every channel also gets an automatic I/O variable
 * (Term3_In1, Term4_Out2, …) so a program works without declaring anything. */

import { Controller } from "../plcsim/runtime.js";
import { TagDB, ELEMENTARY, isFbType, parseTime } from "../plcsim/types.js";
import { ioPoints } from "../plcsim/devices.js";

// blank out a matched span but keep its newlines, so ST error lines still match the editor
const blank = (s) => s.replace(/[^\n]/g, " ");

export function parseProgram(code) {
  const decls = [], errors = [];
  let body = String(code || "");
  body = body.replace(/^\s*(PROGRAM\s+\w+|END_PROGRAM)\b.*$/gim, blank);
  body = body.replace(/\bVAR(?:_GLOBAL|_INPUT|_OUTPUT|_IN_OUT)?\b([\s\S]*?)\bEND_VAR\b/gi, (m, inner, offset) => {
    const startLine = body.slice(0, offset).split("\n").length;
    // strip comments inside the block before splitting declarations
    const clean = inner.replace(/\(\*[\s\S]*?\*\)/g, blank).replace(/\/\/.*$/gm, blank);
    let line = startLine;
    for (const raw of clean.split(";")) {
      const lineHere = line;
      line += (raw.match(/\n/g) || []).length;
      const s = raw.trim();
      if (!s) continue;
      const mm = /^([A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*)\s*(?:AT\s+(%[IQM][XBWD]?[\d.]+|%[IQ]\*))?\s*:\s*([A-Za-z_]\w*)\s*(?::=\s*(.+))?$/is.exec(s);
      if (!mm) { errors.push({ line: lineHere + 1, msg: `can't read declaration "${s.replace(/\s+/g, " ")}"` }); continue; }
      const type = mm[3].toUpperCase();
      if (!ELEMENTARY.includes(type) && !isFbType(type)) { errors.push({ line: lineHere + 1, msg: `unknown type ${mm[3]}` }); continue; }
      const at = mm[2] && !mm[2].includes("*") ? mm[2].toUpperCase() : null;
      for (const name of mm[1].split(",").map((x) => x.trim())) decls.push({ name, type, at, init: mm[4]?.trim(), line: lineHere + 1 });
    }
    return blank(m);
  });
  return { body, decls, errors };
}

const literal = (type, s) => {
  if (s == null) return undefined;
  if (type === "BOOL") return /^(TRUE|1)$/i.test(s);
  if (type === "TIME") return parseTime(s);
  if (type === "STRING") return s.replace(/^'|'$/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};

/** Build a controller for this station and program. Returns { ctrl, project, errors, io }. */
export function createPlc(station, code) {
  const tags = new TagDB();
  const io = ioPoints(station.device);
  for (const p of io) {
    const type = p.analog ? "INT" : "BOOL";
    tags.add(p.tag, type, { address: p.address, dir: p.dir, comment: `${p.mod.catalog} ${p.address}` });
  }
  const { body, decls, errors } = parseProgram(code);
  for (const d of decls) {
    try {
      if (tags.has(d.name)) { errors.push({ line: d.line, msg: `"${d.name}" is already an I/O variable — pick another name` }); continue; }
      const dir = d.at ? (d.at.startsWith("%I") ? "in" : d.at.startsWith("%Q") ? "out" : "mem") : "mem";
      const t = tags.add(d.name, d.type, { address: d.at || "", dir });
      const v = literal(d.type, d.init);
      if (v !== undefined) t.value = v;
    } catch (e) { errors.push({ line: d.line, msg: e.message }); }
  }
  const project = {
    name: station.network.name, device: station.device, tags,
    routines: [{ name: "MAIN", lang: "ST", code: body }], mainRoutine: "MAIN",
    taskPeriodMs: station.runtime.periodMs,
  };
  const ctrl = new Controller(project);
  if (!errors.length) {
    const r = ctrl.download();
    // the ST engine prefixes its own "line N:" — the panel prints the line already
    if (!r.ok) errors.push(...r.errors.map((e) => ({ line: e.line, msg: String(e.msg).replace(/^line \d+:\s*/i, "") })));
  }
  return { ctrl, project, errors, io };
}

/** A first program for a fresh station: each output terminal follows the input
 * terminal nearest before it on the bus, channel for channel — so a sensor on
 * EL1809 input 1 lights whatever hangs off the next EL2809's output 1. */
export function starterProgram(station) {
  const bySlave = (r) => {
    const m = new Map();
    for (const c of station.chans) if (c.r === r && c.tag) (m.get(c.slave) || m.set(c.slave, []).get(c.slave)).push(c);
    return m;
  };
  const ins = bySlave("di"), outs = bySlave("do");
  const lines = [
    "PROGRAM MAIN",
    "(* Runs every task cycle on the simulated EtherCAT master.",
    "   I/O variables come from the process image: TermN_InX, TermN_OutX,",
    "   TermN_AIX, TermN_AOX (N = EtherCAT position). Declare your own below,",
    "   or link one to an address:  Start AT %IX0.0 : BOOL; *)",
    "VAR",
    "    Blink    : TON;",
    "    BlinkOn  : BOOL;",
    "END_VAR",
    "",
    "Blink(IN := NOT Blink.Q, PT := T#500ms);",
    "IF Blink.Q THEN BlinkOn := NOT BlinkOn; END_IF;",
  ];
  if (!outs.size) lines.push("", ins.size ? "// No digital outputs on the bus — inputs show in the I/O list." : "// This station has no digital I/O on the bus yet.");
  for (const [pos, list] of outs) {
    const src = [...ins.keys()].filter((k) => k < pos).pop();
    const from = src !== undefined ? ins.get(src) : null;
    lines.push("", from
      ? `// I/O check: Term${pos} outputs follow Term${src} inputs`
      : `// I/O check: Term${pos} has no input terminal before it — output 1 blinks`);
    list.forEach((o, i) => {
      if (from?.[i]) lines.push(`${o.tag} := ${from[i].tag};`);
      else if (!from && i === 0) lines.push(`${o.tag} := BlinkOn;`);
    });
  }
  lines.push("END_PROGRAM");
  return lines.join("\n");
}
