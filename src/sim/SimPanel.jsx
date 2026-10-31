/* Docked panel shown while Simulate is on: runtime, EtherCAT state, the ST
 * program, live I/O with forcing, and what the simulator noticed. */

import { useState } from "react";
import { MASTERS, FAMILY_LABEL } from "../plcsim/masters.js";

const C = { ink: "#1C2126", muted: "#69727C", line: "#D9DDE1", panel: "#FFFFFF", bg: "#F6F7F8", brand: "#D71920", ok: "#1F7A4D", warn: "#9A6A00" };
const mono = "ui-monospace,Menlo,Consolas,monospace";
const btn = { border: `1px solid ${C.line}`, background: C.panel, color: C.ink, padding: "4px 10px", borderRadius: 7, fontSize: 12, cursor: "pointer", fontWeight: 500 };
const on = { background: C.ink, color: "#fff", border: `1px solid ${C.ink}` };
const head = { fontSize: 10.5, fontWeight: 700, color: C.muted, letterSpacing: 0.4, margin: "0 0 6px" };

export default function SimPanel({ sim, code, setCode, runtimeId, setRuntime, onReset }) {
  const [tab, setTab] = useState("io");
  const { station, view, errors } = sim;
  if (!station) return null;
  const mode = view?.plcMode || "STOP";
  const modeColor = mode === "RUN" ? C.ok : mode === "FAULT" ? C.brand : C.muted;
  const chans = station.chans.filter((c) => c.address);
  const issues = view?.issues || [];
  const nErr = issues.filter((i) => i.level === "error").length + errors.length;

  return (
    <div style={{ height: "min(300px, 42vh)", flex: "0 0 auto", borderTop: `1px solid ${C.line}`, background: C.panel, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: `1px solid ${C.line}`, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", background: modeColor, borderRadius: 5, padding: "3px 8px" }}>PLC {mode}</span>
        <select value={station.runtime.id} onChange={(e) => setRuntime(e.target.value)}
          title="EtherCAT master runtime — only controllers that master EtherCAT natively"
          style={{ ...btn, padding: "4px 6px", maxWidth: 300 }}>
          {Object.keys(FAMILY_LABEL).map((fam) => (
            <optgroup key={fam} label={FAMILY_LABEL[fam]}>
              {MASTERS.filter((m) => m.family === fam).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </optgroup>
          ))}
        </select>
        {runtimeId && <button style={btn} onClick={() => setRuntime(null)} title="Use the runtime of the master placed in the drawing">auto</button>}
        <span style={{ width: 1, height: 20, background: C.line }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: C.muted }}>EtherCAT</span>
        {["INIT", "PREOP", "SAFEOP", "OP"].map((s) => (
          <button key={s} style={{ ...btn, padding: "4px 8px", ...(sim.esm === s ? on : null) }} onClick={() => sim.setEsm(s)}
            title={s === "OP" ? "Inputs and outputs exchanged" : s === "SAFEOP" ? "Inputs only — outputs held off" : "No process data"}>{s}</button>
        ))}
        <span style={{ width: 1, height: 20, background: C.line }} />
        <button style={{ ...btn, ...(sim.plcRun ? on : null) }} onClick={() => sim.setPlcRun(!sim.plcRun)}>{sim.plcRun ? "■ Stop PLC" : "▶ Run PLC"}</button>
        {mode === "FAULT" && <button style={btn} onClick={sim.clearFault}>Clear fault</button>}
        <button style={{ ...btn, ...(sim.dirty ? { borderColor: C.brand, color: C.brand, fontWeight: 700 } : null) }} onClick={sim.download}
          title="Compile the program and load it into the simulated controller">
          {sim.dirty ? "Download changes" : "Download"}
        </button>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: C.muted, fontFamily: mono }}>
          {station.slaves.length} slaves · WKC {view?.wkc ?? 0}/{view?.expectWkc ?? 0} · cycle {station.runtime.periodMs} ms · scan {(view?.scanMs || 0).toFixed(3)} ms
        </span>
      </div>

      <div style={{ display: "flex", gap: 4, padding: "6px 12px 0" }}>
        {[["io", `I/O (${chans.length})`], ["prog", "Program (ST)"], ["msg", `Messages${nErr ? ` · ${nErr}` : ""}`]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ ...btn, borderRadius: "7px 7px 0 0", borderBottom: "none", ...(tab === k ? { background: C.bg, fontWeight: 700 } : { color: C.muted }) }}>{l}</button>
        ))}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: C.muted, alignSelf: "center" }}>
          Click push-buttons, switches and sensors on the canvas to operate them.
        </span>
      </div>

      <div style={{ flex: 1, minHeight: 0, background: C.bg, borderTop: `1px solid ${C.line}`, overflow: "auto" }} className="scroll">
        {tab === "io" && <IoTable chans={chans} station={station} view={view} sim={sim} />}
        {tab === "prog" && (
          <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
            <textarea value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false}
              onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); sim.download(); } }}
              style={{ flex: 1, resize: "none", border: "none", outline: "none", padding: "10px 12px", fontFamily: mono, fontSize: 12.5, lineHeight: 1.5, background: "#FCFCFD", color: C.ink, tabSize: 4 }} />
            <div style={{ width: 260, borderLeft: `1px solid ${C.line}`, padding: 10, overflow: "auto", fontSize: 12 }} className="scroll">
              <div style={head}>COMPILE</div>
              {errors.length ? errors.map((e, i) => (
                <div key={i} style={{ color: C.brand, marginBottom: 6 }}>{e.line ? `Line ${e.line}: ` : ""}{e.msg}</div>
              )) : <div style={{ color: C.ok }}>{sim.dirty ? "Edited — Download (Ctrl+Enter) to load it." : "Loaded and running."}</div>}
              <div style={{ ...head, marginTop: 12 }}>PROGRAM</div>
              <button style={btn} onClick={onReset} title="Replace the program with an I/O-check program for this station">Reset to I/O check</button>
              <div style={{ color: C.muted, marginTop: 10, lineHeight: 1.45 }}>
                Structured Text, IEC 61131-3. Timers (TON / TOF / TP), counters (CTU / CTD), R_TRIG / F_TRIG, RS / SR, IF / CASE / FOR / WHILE.
              </div>
            </div>
          </div>
        )}
        {tab === "msg" && (
          <div style={{ padding: 10, fontSize: 12.5 }}>
            {!issues.length && !errors.length && <div style={{ color: C.ok }}>Nothing to report — the station is running.</div>}
            {errors.map((e, i) => <Msg key={`e${i}`} level="error" msg={`Program${e.line ? `, line ${e.line}` : ""}: ${e.msg}`} />)}
            {issues.map((m, i) => <Msg key={i} {...m} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function Msg({ level, msg }) {
  const col = level === "error" ? C.brand : level === "warn" ? C.warn : C.muted;
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 6, lineHeight: 1.4 }}>
      <span style={{ color: col, fontWeight: 800, width: 14 }}>{level === "error" ? "✕" : level === "warn" ? "!" : "i"}</span>
      <span>{msg}</span>
    </div>
  );
}

function IoTable({ chans, station, view, sim }) {
  const part = Object.fromEntries(station.slaves.map((s) => [s.position, s.part]));
  if (!chans.length) return <div style={{ padding: 12, fontSize: 12.5, color: C.muted }}>No process data on the bus yet — add I/O terminals behind a coupler, or check the Messages tab.</div>;
  const cell = { padding: "4px 10px", borderBottom: `1px solid ${C.line}`, fontSize: 12, whiteSpace: "nowrap" };
  return (
    <table style={{ borderCollapse: "collapse", width: "100%" }}>
      <thead>
        <tr style={{ position: "sticky", top: 0, background: C.bg, textAlign: "left" }}>
          {["Variable", "Address", "Device", "Dir", "Value", "Force"].map((h) => <th key={h} style={{ ...cell, fontSize: 10.5, color: C.muted, fontWeight: 700 }}>{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {chans.map((c) => {
          const v = view?.io?.[c.key];
          const f = sim.forces[c.key];
          const digital = c.r === "di" || c.r === "do";
          return (
            <tr key={c.key} style={{ background: f !== undefined ? "#FFF6E0" : undefined }}>
              <td style={{ ...cell, fontFamily: mono, fontWeight: 600 }}>{c.tag}</td>
              <td style={{ ...cell, fontFamily: mono, color: C.muted }}>{c.address}</td>
              <td style={{ ...cell, color: C.muted }}>{c.name.split("_")[0]} · {part[c.slave]}</td>
              <td style={{ ...cell, color: C.muted }}>{c.r === "di" || c.r === "ai" ? "in" : "out"}</td>
              <td style={cell}>
                {digital ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: mono, fontWeight: 700, color: v ? C.ok : C.muted }}>
                    <span style={{ width: 9, height: 9, borderRadius: 5, background: v ? "#3DD16B" : "#C9CDD2", boxShadow: v ? "0 0 6px #3DD16B" : "none" }} />
                    {v ? "TRUE" : "FALSE"}
                    {c.r === "do" && v && view && !view.driven?.[c.key] && (
                      <span style={{ fontWeight: 500, color: C.warn }} title="Commanded, but the terminal is not putting out 24 V — see Messages (not in OP, no Up supply, or tripped)">· not driven</span>
                    )}
                  </span>
                ) : <span style={{ fontFamily: mono, fontWeight: 700 }}>{Number(v || 0)}</span>}
              </td>
              <td style={cell}>
                {digital ? (
                  <select value={f === undefined ? "" : f ? "1" : "0"} style={{ ...btn, padding: "2px 4px", fontSize: 11.5 }}
                    onChange={(e) => sim.setForce(c.key, e.target.value === "" ? null : e.target.value === "1")}>
                    <option value="">—</option><option value="1">TRUE</option><option value="0">FALSE</option>
                  </select>
                ) : (
                  <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                    <input type="range" min="0" max="32767" step="1" value={f ?? 0} style={{ width: 110 }}
                      onChange={(e) => sim.setForce(c.key, Number(e.target.value))} />
                    {f !== undefined && <button style={{ ...btn, padding: "1px 6px" }} onClick={() => sim.setForce(c.key, null)}>✕</button>}
                  </span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
