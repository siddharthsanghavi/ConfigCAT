/* Station validation — MX-System-Designer-style consistency checks.
 * Sources: infosys EtherCAT system documentation (E-bus supply, power
 * contacts ≤ 10 A, potential groups via EL9100/EL9110/EL9150/EL9410,
 * separation via EL9080, termination via EL9011/EL9012, EK1110 placement).
 * Returns [{ level: "error"|"warn", rail: index|null, msg }].
 */

// classify a clamp point for wiring checks.
// roles: p24 (+24 V), gnd (0 V), pe (earth), ac (120..230 V AC), di, do, null (unknown)
export function classifyPoint(d, label) {
  if (!d || label == null) return null;
  if (d.psu) {
    if (label === "+") return "p24";
    if (label === "−") return "gnd";
    if (label === "L" || label === "N") return "ac";
    if (label === "⏚") return "pe";
    return null;
  }
  if ((d.coupler || d.cx) && d.pinout) return pinRole(d, Number(label)); // EK18xx / EK1914 / EK1960 / CX70xx
  if (d.feed && (label === "NC" || label === "B" || label === "X")) return null; // not used / free bridge
  if (d.feed && d.efuse && label[0] === "I") return null;          // EL922x switch inputs
  if (d.feed && d.efuse && label[0] === "O") return "do";          // EL922x protected outputs
  if (d.feed && label === "S+") return "p24";                      // EL9550 system supply
  if (d.feed && label === "S−") return "gnd";
  if (d.feed && d.anyV) return label === "⏚" ? "pe" : null;         // EL9190: any voltage
  if (d.feed && d.ac) return label === "⏚" ? "pe" : "ac";
  if (d.feed && d.uOut && d.uOut !== 24 && label === "+") return null; // U0 output, not 24 V
  if (d.coupler || d.feed || d.cx || d.cxk === "psu") {
    if (label === "24V" || label === "+") return "p24";
    if (label === "0V" || label === "−") return "gnd";
    return "pe"; // ⏚
  }
  if (d.pins) {
    const p = d.pins[Number(label) - 1];
    return p === "p24" || p === "gnd" || p === "pe" ? p : null; // bridges, any-voltage: unknown
  }
  if (d.dist) return d.dist === "24V" ? "p24" : "gnd";
  const n = Number(label);
  if (!Number.isFinite(n)) return null;
  if (d.pinout) return pinRole(d, n);
  // no verified pinout — only classify all-signal cases we are sure about
  if (d.noSig) return null; // clamp count differs from the channel count
  if (d.io === "di" && n <= d.ch && d.ch >= 8) return "di";
  if (d.io === "do" && !d.relay && n <= d.ch && d.ch >= 8) return "do";
  return null;
}

// wiring role of clamp n from a verified pinout: supplies collapse to p24 /
// gnd, a TwinSAFE clock output stays "clk", a linked clamp takes its target's
function pinRole(d, n) {
  const q = d.pinout[n - 1];
  if (!q || !q.r) return null;
  if (q.r === "link") return pinRole(d, q.to);
  if (q.r === "us24" || q.r === "up24" || q.r === "usup") return "p24";
  if (q.r === "us0" || q.r === "up0") return "gnd";
  return q.r;
}

// pairs of point roles that indicate a wiring fault
const WIRE_RULES = [
  { a: "p24", b: "gnd", level: "error", msg: "short circuit: +24 V wired directly to 0 V" },
  { a: "do", b: "p24", level: "error", msg: "output wired to +24 V — back-feed / short when output switches" },
  { a: "do", b: "gnd", level: "error", msg: "output wired to 0 V — short circuit when output switches on" },
  { a: "do", b: "do", level: "warn", msg: "two outputs tied together — outputs may drive against each other" },
  { a: "di", b: "di", level: "warn", msg: "input wired to input — circuit has no source" },
  { a: "ac", b: "p24", level: "error", msg: "230 V AC wired to a 24 V DC point" },
  { a: "ac", b: "gnd", level: "error", msg: "230 V AC wired to a 0 V point" },
  { a: "ac", b: "di", level: "error", msg: "230 V AC wired to a 24 V input" },
  { a: "ac", b: "do", level: "error", msg: "230 V AC wired to a 24 V output" },
  { a: "pe", b: "p24", level: "error", msg: "protective earth tied to +24 V" },
  { a: "pe", b: "gnd", level: "warn", msg: "protective earth tied to 0 V — grounding scheme should be intentional" },
  { a: "pe", b: "do", level: "error", msg: "protective earth tied to an output" },
  { a: "pe", b: "ac", level: "error", msg: "protective earth tied to AC line" },
  // TwinSAFE clock outputs (test pulses that feed safe inputs)
  { a: "clk", b: "gnd", level: "error", msg: "clock output wired to 0 V — short circuit" },
  { a: "clk", b: "p24", level: "warn", msg: "clock output wired to +24 V — the safe input reports an external supply" },
  { a: "clk", b: "do", level: "error", msg: "clock output wired to an output" },
  { a: "clk", b: "clk", level: "warn", msg: "two clock outputs tied together — reported as a cross-circuit" },
  { a: "clk", b: "pe", level: "error", msg: "clock output tied to protective earth" },
  { a: "clk", b: "ac", level: "error", msg: "230 V AC wired to a clock output" },
  // analog roles (ai / ao / agnd from verified pinouts)
  { a: "ao", b: "ao", level: "warn", msg: "two analog outputs tied together" },
  { a: "ao", b: "p24", level: "error", msg: "+24 V forced into an analog output" },
  { a: "ao", b: "do", level: "error", msg: "24 V digital output wired into an analog output" },
  { a: "ai", b: "do", level: "warn", msg: "24 V digital output into an analog input — check the input range (±10 V)" },
  { a: "agnd", b: "p24", level: "error", msg: "+24 V wired to analog ground" },
  { a: "ac", b: "ai", level: "error", msg: "230 V AC wired to an analog input" },
  { a: "ac", b: "ao", level: "error", msg: "230 V AC wired to an analog output" },
  { a: "ac", b: "agnd", level: "error", msg: "230 V AC wired to analog ground" },
];

// which wire types are media cables (must match WIRES ids in App.jsx)
const NET_WIRE = { cat5e: "eth", cat6a: "eth", ecm12: "eth", ecm12rj: "eth", ecp: "eth", fog: "fo", pofd: "fo", oct: "oct", usb: "usb", hdmi: "hdmi", dp: "dp", cpl4: "dp", dvi: "dvi", fbus: "bus" };
// port kind → media
const PORT_KIND = { rj45: "eth", m12net: "eth", fo: "fo", oct: "oct", usb: "usb", hdmi: "hdmi", dp: "dp", dvi: "dvi", dsub: "bus", dnet: "bus" };
const VIDEO = new Set(["hdmi", "dp", "dvi"]);
const MEDIA_NAME = { eth: "Ethernet/EtherCAT", fo: "fiber-optic", oct: "OCT motor", usb: "USB", hdmi: "HDMI", dp: "DisplayPort", dvi: "DVI", bus: "fieldbus" };

export function validateWires(wires, resolve) {
  const issues = [];
  wires.forEach((w) => {
    const A = resolve(w.a.uid, w.a.pt);
    const B = resolve(w.b.uid, w.b.pt);
    if (!A || !B) return;
    const tag = (msg, level = "error") => issues.push({ level, rail: null, msg: `${A.d.id}·${A.label} → ${B.d.id}·${B.label}: ${msg}` });
    const ma = A.port ? PORT_KIND[A.port] : null;
    const mb = B.port ? PORT_KIND[B.port] : null;
    const net = NET_WIRE[w.type];
    if (ma || mb) {
      if (!ma !== !mb) { tag("media port wired to an electrical clamp point"); return; }
      if (ma !== mb) {
        if (VIDEO.has(ma) && VIDEO.has(mb)) { tag(`${MEDIA_NAME[ma]} to ${MEDIA_NAME[mb]} — adapter/converter needed`, "warn"); return; }
        tag(`incompatible port types (${MEDIA_NAME[ma]} vs ${MEDIA_NAME[mb]})`); return;
      }
      if (!net) { tag(`use a ${MEDIA_NAME[ma]} cable for these ports`, "warn"); return; }
      if (net !== ma) { tag(`${MEDIA_NAME[net]} cable on ${MEDIA_NAME[ma]} ports`, "warn"); }
      return;
    }
    if (net) { tag("media cable used between electrical clamp points — pick a wire type instead", "warn"); return; }
    const ra = A.role || classifyPoint(A.d, A.label);
    const rb = B.role || classifyPoint(B.d, B.label);
    if (!ra || !rb) return;
    const rule = WIRE_RULES.find(
      (r) => (r.a === ra && r.b === rb) || (r.a === rb && r.b === ra)
    );
    if (rule) tag(rule.msg, rule.level);
  });
  return issues;
}

const PC_LIMIT_A = 10; // power contacts rated ≤ 10 A (infosys)

export function validateRails(rails, byId) {
  const issues = [];
  const err = (rail, msg) => issues.push({ level: "error", rail, msg });
  const warn = (rail, msg) => issues.push({ level: "warn", rail, msg });

  rails.forEach((rail, ri) => {
    const items = rail.items.map((inst) => ({ inst, d: byId[inst.catId] })).filter((x) => x.d);
    if (!items.length) return;

    // CX2500 / CX2550 modules mount left of a CX20xx / CX52x0 / CX53x0 / CX56x0
    items.forEach((x, i) => {
      if (x.d.cxk !== "mod") return;
      let j = i + 1;
      while (items[j]?.d.cxk === "mod") j++;
      const cpu = items[j]?.d;
      if (!cpu || !(cpu.cxk === "c20" || /^CX5[2-6]/.test(cpu.id)))
        warn(ri, `${x.d.id} mounts directly left of a CX20xx, CX52x0, CX53x0 or CX56x0 CPU (or another CX2500 module)`);
    });

    // A rail may carry several separate stations, split by an end cover and a
    // visible gap. Validate each segment as its own station.
    const segments = [];
    let cur = [];
    for (const x of items) { cur.push(x); if (x.d.endcap) { segments.push(cur); cur = []; } }
    if (cur.length) segments.push(cur);
    const multi = segments.length > 1;

    segments.forEach((segAll, si) => {
      const gp = (msg) => (multi ? `group ${si + 1}: ${msg}` : msg);
      const gerr = (msg) => err(ri, gp(msg));
      const gwarn = (msg) => warn(ri, gp(msg));

      // ---- rail structure -----------------------------------------------
      const ebusItems = segAll.filter((x) => !x.d.psu && x.d.cxk !== "mod");
      if (!ebusItems.length) return;
      const firstEbus = ebusItems[0];
      if (firstEbus && !(firstEbus.d.coupler || firstEbus.d.cx)) {
        gerr(`must start with a coupler or embedded PC — first device is ${firstEbus.d.id}. Devices stranded past an end cover are disconnected; move them into a station or start a new group with its own coupler.`);
      }
      // CX20xx: the CX2100 to its right powers the CPU and the E-bus
      if (firstEbus?.d.cxk === "c20" && ebusItems[1]?.d.cxk !== "psu")
        gerr(`${firstEbus.d.id} needs a CX2100 power supply module directly to its right — it powers the CPU and the E-bus`);
      ebusItems.forEach((x, i) => {
        if (x.d.cxk === "psu" && ebusItems[i - 1]?.d.cxk !== "c20") gwarn(`${x.d.id} belongs directly right of a CX20xx CPU`);
      });
      const extraCouplers = ebusItems.slice(1).filter((x) => x.d.coupler || x.d.cx);
      if (extraCouplers.length) {
        gwarn(`${extraCouplers.map((x) => x.d.id).join(", ")} mid-group — a coupler/embedded PC begins one station; separate stations with an end cover + gap`);
      }

      // end cover: last E-bus device should be EL9011/EL9012
      const lastEbus = ebusItems[ebusItems.length - 1];
      if (lastEbus && !lastEbus.d.endcap && ebusItems.length > 1) {
        gwarn("terminate the station with an end cover — EL9011 (E-bus) or EL9012 (power + E-bus contacts)");
      }

      // EK1110 extension must be the last device before the end cover
      const extIdx = ebusItems.findIndex((x) => x.d.ext);
      if (extIdx >= 0) {
        const after = ebusItems.slice(extIdx + 1).filter((x) => !x.d.endcap);
        if (after.length) gerr(`${ebusItems[extIdx].d.id} extension must be the last device before the end cover — ${after.map((x) => x.d.id).join(", ")} placed after it`);
      }

      // ---- E-bus budget with placement suggestion ------------------------
      let supply = 0, consume = 0, flagged = false;
      for (const x of ebusItems) {
        if (x.d.ebus > 0) supply += x.d.ebus;
        else consume += -x.d.ebus;
        if (!flagged && consume > supply && supply > 0) {
          gerr(`E-bus over budget at ${x.d.id} (${consume}/${supply} mA) — insert an EL9410 before it`);
          flagged = true;
        }
      }

      // ---- power-contact (Up) potential groups ---------------------------
      // A group starts at a coupler/CX/feed terminal and ends at the next
      // feed / separation terminal (EL9080) / PSU. 24 V groups are checked
      // against the 10 A power-contact rating using worst-case rated loads.
      let group = null;
      const closeGroup = () => {
        if (!group) return;
        if (group.volt === "24" && group.loadA > PC_LIMIT_A) {
          gwarn(`power contacts after ${group.src}: worst-case rated load ${group.loadA} A exceeds the 10 A contact rating — split with a feed terminal (EL9100/EL9110)`);
        }
        if (!group.volt && group.consumers.length) {
          gwarn(`power contacts unpowered after ${group.src}: ${group.consumers.join(", ")} — add a potential feed terminal`);
        }
        if (group.volt && !["24", "230", "any"].includes(group.volt) && group.dc24.length) {
          gwarn(`power contacts after ${group.src} carry ${group.volt} V, not 24 V: ${group.dc24.join(", ")} — put an EL9100 feed in front of them`);
        }
        if (group.volt === "230" && group.dc24.length) {
          gerr(`${group.dc24.join(", ")} sit in the 230 V AC potential group fed by ${group.src} — 24 V terminals would be destroyed; separate with EL9080 + 24 V feed`);
        }
        group = null;
      };
      for (const x of ebusItems) {
        const d = x.d;
        if (d.endcap) continue;
        if (d.coupler || d.cx) {
          closeGroup();
          group = { volt: "24", src: d.id, loadA: 0, consumers: [], dc24: [] };
        } else if (d.pcFeed) {
          closeGroup();
          group = { volt: d.ac ? "230" : d.anyV ? "any" : d.uOut ? String(d.uOut) : "24", src: d.id, loadA: 0, consumers: [], dc24: [] };
        } else if (d.pcBreak) {
          // EL9080 separation or relay terminals whose power contacts are not looped through
          closeGroup();
          group = { volt: null, src: d.id, loadA: 0, consumers: [], dc24: [] };
        } else if (group) {
          if (d.upA) group.loadA += d.upA;
          if (d.io || d.dist) {
            group.consumers.push(d.id);
            if (!d.relay) group.dc24.push(d.id);
          }
        }
      }
      closeGroup();
    });

    // ---- PSU sizing (only when the rail carries a 24 V PS unit) ----------
    // demand estimate: worst-case rated output load (upA) + ~0.5 A per
    // coupler/CX for E-bus conversion. Sensor and analog loads are ignored.
    const cap24 = items.filter((x) => x.d.psu && x.d.psuV === 24).reduce((s, x) => s + x.d.psuA, 0);
    if (cap24 > 0) {
      const demand = items.reduce((s, x) => s + (x.d.upA || 0) + (x.d.coupler || x.d.cx ? 0.5 : 0), 0);
      if (demand > cap24) {
        warn(ri, `24 V PSU undersized: estimated worst-case demand ${demand.toFixed(1)} A exceeds the ${cap24} A supplied on this rail — pick a larger PS unit`);
      }
    }
  });

  // ---- TwinSAFE: safe I/O needs an FSoE master ---------------------------
  // FSoE is a black-channel protocol — safe terminals (EL1904/EL2904…) do
  // nothing until an FSoE master drives them. A master can be a dedicated
  // TwinSAFE Logic terminal (EL6910/EL6930), the EK1960 compact controller,
  // a safe terminal with integrated logic (EL1918), OR a TwinCAT Safety PLC
  // running on any Beckhoff IPC/embedded PC — so an EL6910 is NOT required.
  const tsNodes = [];
  let tsLogic = false, hasPCHost = false;
  rails.forEach((rail) => rail.items.forEach((inst) => {
    const d = byId[inst.catId];
    if (!d) return;
    if (d.tsLogic) tsLogic = true;
    if (d.cx) hasPCHost = true; // an embedded PC can run the TwinCAT Safety PLC
    if (d.twinsafe && !d.tsLogic && d.io) tsNodes.push(d.id);
  }));
  if (tsNodes.length && !tsLogic) {
    const nodes = [...new Set(tsNodes)].join(", ");
    if (hasPCHost) {
      issues.push({ level: "warn", rail: null, msg: `TwinSAFE I/O (${nodes}) has no hardware TwinSAFE Logic — it must run under a TwinCAT Safety PLC on the embedded PC (confirm the TwinCAT 3 Safety license), or add an EL6910/EL6930/EL1918/EK1960` });
    } else {
      issues.push({ level: "warn", rail: null, msg: `TwinSAFE I/O present (${nodes}) but no FSoE master — add a TwinSAFE Logic (EL6910/EL6930/EL1918/EK1960) or run a TwinCAT Safety PLC on a Beckhoff IPC/embedded PC` });
    }
  }

  // ---- Hot Connect ID uniqueness across all rails ------------------------
  const seen = new Map();
  rails.forEach((rail, ri) => rail.items.forEach((inst) => {
    const d = byId[inst.catId];
    if (!d?.idSwitch) return;
    const key = inst.idNum ?? 1;
    if (seen.has(key)) {
      issues.push({ level: "error", rail: ri, msg: `Hot Connect ID ${key} used by ${d.id} on rail ${ri + 1} and ${seen.get(key)} — IDs must be unique` });
    } else {
      seen.set(key, `${d.id} on rail ${ri + 1}`);
    }
  }));

  return issues;
}

export function validateStation(rails, wires, byId, resolve) {
  const issues = [...validateRails(rails, byId), ...validateWires(wires, resolve)];
  const order = { error: 0, warn: 1 };
  issues.sort((a, b) => order[a.level] - order[b.level]);
  return issues;
}
