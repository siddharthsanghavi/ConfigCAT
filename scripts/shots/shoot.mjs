#!/usr/bin/env node
/* README screenshots, generated from the real app.
 *
 *   npm run shots                          every scene -> docs/images/
 *   npm run shots -- --only hero,topology  just those scenes
 *   npm run shots -- --labels hero         list the points a scene's devices expose
 *   npm run shots -- --headed --scale 1    watch it run
 *
 * A scene (scenes.mjs) is plain data: a design and an optional project
 * library seeded into localStorage before the app boots, then steps that
 * drive the REAL interface -- the wire tool, header buttons, palette search
 * and filters, device selection -- and shots that crop to a region. It runs
 * against the built Sids-EtherCAT-Configurator.html, so the images show
 * exactly what people download.
 *
 * Wires are made with the app's own wire tool, which picks the cable itself;
 * every one a scene asks for must succeed, so a scene that stops matching the
 * app fails loudly instead of quietly photographing a broken screen.
 */
import { chromium } from "playwright-core";
import { mkdir, writeFile, stat, readdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { SCENES } from "./scenes.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const APP = pathToFileURL(path.join(ROOT, "Sids-EtherCAT-Configurator.html")).href;
const DOC_KEY = "beckhoff-configurator-v1";
const LIB_KEY = "beckhoff-configurator-library-v1";

// ---- command line ---------------------------------------------------------
const argv = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return dflt;
  const v = argv[i + 1];
  return v && !v.startsWith("--") ? v : true;
};
const OUT = path.resolve(ROOT, opt("out", "docs/images"));
const SCALE = Number(opt("scale", 2));           // 2 = retina-sharp text and lines
const ONLY = opt("only", null);
const LABELS = opt("labels", null);
const HEADED = !!opt("headed", false);
const CHANNEL = opt("browser", "msedge");         // drives an installed browser

// ---- regions a shot can crop to ---------------------------------------------
const REGION = {
  header: "header",
  palette: "aside >> nth=0",
  canvas: "main",
  inspector: "aside >> nth=1",
  // the topmost modal card (its parent is the fixed-position backdrop)
  modal: 'div[style*="position: fixed"] > div >> nth=-1',
};

// ---- page helpers -----------------------------------------------------------
const readDoc = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "{}"), DOC_KEY);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// "24V", "24V#2" (second point with that label), or a numeric index
async function point(page, uid, ref) {
  const dev = `main [data-uid="${uid}"]`;
  if (typeof ref === "number") return page.locator(`${dev} [data-pt="${ref}"]`).first();
  const [label, nth] = String(ref).split("#");
  const loc = page.locator(`${dev} [data-label=${JSON.stringify(label)}]`);
  if (!(await loc.count())) throw new Error(`no point "${label}" on ${uid} -- run with --labels <scene> to list them`);
  return loc.nth((Number(nth) || 1) - 1);
}

async function setWireMode(page, on) {
  const isOn = (await page.getByRole("button", { name: "✕ Exit wire tool" }).count()) > 0;
  if (on !== isOn) await page.getByRole("button", { name: on ? "⚡ Wire tool" : "✕ Exit wire tool" }).click();
}

// drive the real wire tool: press A, then press B (the app's click-click flow).
// Events go straight to the point's own element, so a wire already ending on
// that point can't swallow the press.
async function wire(page, [ua, pa], [ub, pb]) {
  await setWireMode(page, true);
  const before = ((await readDoc(page)).wires || []).length;
  await (await point(page, ua, pa)).dispatchEvent("pointerdown");
  await (await point(page, ub, pb)).dispatchEvent("pointerdown");
  await page.waitForTimeout(60);
  const after = ((await readDoc(page)).wires || []).length;
  if (after !== before + 1) {
    const flash = await page.getByText(/no compatible cable/).first().textContent().catch(() => null);
    throw new Error(`wire ${ua}:${pa} -> ${ub}:${pb} was not made${flash ? ` (${flash.trim()})` : ""}`);
  }
}

async function selectDevice(page, uid) {
  await setWireMode(page, false);
  await page.locator(`main [data-uid="${uid}"]`).first().dispatchEvent("click");
}

async function pickSelect(page, firstOption, value) {
  await page.locator("select").filter({ has: page.locator(`option:text-is(${JSON.stringify(firstOption)})`) })
    .first().selectOption(value);
}

// open palette folders by visible title, e.g. ["BECKHOFF", "Drives & Motors"];
// a leading "!" closes one instead ("!Couplers & Junctions")
async function expand(page, titles) {
  for (const raw of [].concat(titles)) {
    const close = raw.startsWith("!"), t = close ? raw.slice(1) : raw;
    const btn = page.locator("aside >> nth=0").locator("button")
      .filter({ hasText: new RegExp(`^${escapeRe(t)}\\d+ [▸▾]$`) }).first();
    const isOpen = (await btn.textContent()).trim().endsWith("▾");
    if (isOpen === close) await btn.click();
  }
}

// freeze the scene: no transient toast, no hover states, glowing/blinking
// cables stopped on a chosen frame, and two painted frames before the capture.
// (A toast is a fixed-position div holding bare text; modals hold elements.)
async function steady(page, frame) {
  await page.waitForFunction(() => ![...document.querySelectorAll('div[style*="position: fixed"]')]
    .some((d) => !d.children.length && d.textContent.trim()), null, { timeout: 5000 });
  await page.mouse.move(2, 2);
  await page.evaluate((t) => {
    document.querySelectorAll("svg").forEach((s) => { try { s.pauseAnimations(); s.setCurrentTime(t); } catch {} });
  }, frame);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

async function shoot(page, spec, scene, results) {
  await steady(page, spec.frame ?? 0.4);
  const file = path.join(OUT, `${spec.name}.png`);
  const vp = page.viewportSize();
  let clip = spec.clip;
  if (!clip && spec.region === "stage") {
    // palette + canvas from just under the header: the wire-tool bar spans the
    // page between header and canvas, and its prompt starts at the left edge
    const head = await page.locator("header").boundingBox();
    const main = await page.locator("main").boundingBox();
    const y = head.y + head.height;
    clip = { x: 0, y, width: main.x + main.width, height: Math.min(vp.height, spec.maxHeight ? y + spec.maxHeight : Infinity) - y };
  }
  if (!clip && spec.region && spec.region !== "viewport") {
    const box = await page.locator(REGION[spec.region] || spec.region).first().boundingBox();
    if (!box) throw new Error(`region "${spec.region}" not on screen`);
    const pad = spec.pad ?? 0;
    const x = Math.max(0, box.x - pad), y = Math.max(0, box.y - pad);
    const bottom = Math.min(vp.height, box.y + box.height + pad, spec.maxHeight ? y + spec.maxHeight : Infinity);
    clip = { x, y, width: Math.min(vp.width, box.x + box.width + pad) - x, height: bottom - y };
  }
  await page.screenshot({ path: file, clip, animations: "disabled", scale: "device" });
  const { size } = await stat(file);
  results.push({
    scene: scene.name,
    file: path.relative(ROOT, file).replace(/\\/g, "/"),
    width: Math.round((clip?.width ?? vp.width) * SCALE),
    height: Math.round((clip?.height ?? vp.height) * SCALE),
    kb: Math.round(size / 1024),
    caption: spec.caption || "",
  });
}

async function runStep(page, step, scene, results) {
  const [op, arg] = Object.entries(step)[0];
  switch (op) {
    case "wire": return wire(page, arg[0], arg[1]);
    case "wires": for (const w of arg) await wire(page, w[0], w[1]); return;
    case "wireMode": return setWireMode(page, arg);
    case "pending": // leave a wire half-made, so the shot shows the tool mid-use
      await setWireMode(page, true);
      return (await point(page, arg[0], arg[1])).dispatchEvent("pointerdown");
    case "select": return selectDevice(page, arg);
    // operate a push-button, switch or sensor while Simulate is on
    case "actuate": return page.locator(`main [data-uid="${arg}"]`).first().dispatchEvent("pointerdown");
    // by the start of the label, so "Projects" still finds "Projects (4)"
    case "press": return page.getByRole("button", { name: new RegExp(`^${escapeRe(arg)}`) }).first().click();
    case "search": return page.getByPlaceholder(/Search catalog/).fill(arg);
    case "mfr": return pickSelect(page, "All manufacturers", arg);
    case "src": return pickSelect(page, "All parts", arg);
    case "expand": return expand(page, arg);
    case "scroll":
      return page.locator(REGION[arg.region] || arg.region).first()
        .evaluate((el, a) => el.scrollTo(a.x || 0, a.y || 0), arg);
    case "wait": return page.waitForTimeout(arg);
    case "expect": {
      const doc = await readDoc(page);
      const n = (doc.wires || []).length;
      if (arg.wires != null && n !== arg.wires) throw new Error(`expected ${arg.wires} wires, found ${n}`);
      if (arg.text) await page.getByText(arg.text).first().waitFor({ timeout: 3000 });
      return;
    }
    case "shot": return shoot(page, arg, scene, results);
    default: throw new Error(`unknown step "${op}"`);
  }
}

async function openScene(browser, scene) {
  const context = await browser.newContext({
    viewport: scene.viewport || { width: 1600, height: 1000 },
    deviceScaleFactor: SCALE,
    colorScheme: "light",
  });
  // seed before the app reads storage on boot; one navigation per scene
  await context.addInitScript(([dk, doc, lk, lib]) => {
    localStorage.clear();
    if (doc) localStorage.setItem(dk, doc);
    if (lib) localStorage.setItem(lk, lib);
  }, [DOC_KEY, scene.doc && JSON.stringify(scene.doc), LIB_KEY, scene.library && JSON.stringify(scene.library)]);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(APP);
  await page.locator("header").waitFor();
  await page.waitForTimeout(250);
  return { context, page, errors };
}

// ---- --labels: what can a scene address? -----------------------------------------
async function listLabels(browser, scene) {
  const { context, page } = await openScene(browser, scene);
  const rows = await page.evaluate(() => [...document.querySelectorAll("main [data-uid]")].map((g) => ({
    uid: g.getAttribute("data-uid"),
    pts: [...g.querySelectorAll("[data-pt]")].map((p) => `${p.getAttribute("data-pt")}:${p.getAttribute("data-label")}`),
  })));
  const ids = Object.fromEntries([...(scene.doc?.rails || []).flatMap((r) => r.items), ...(scene.doc?.free || [])]
    .map((x) => [x.uid, x.catId]));
  for (const r of rows) console.log(`${r.uid.padEnd(5)} ${(ids[r.uid] || "?").padEnd(22)} ${r.pts.join("  ")}`);
  await context.close();
}

// ---- main ---------------------------------------------------------------------------
// the shots come from the built file, so a build older than src/ would quietly
// photograph yesterday's app
{
  const built = (await stat(path.join(ROOT, "Sids-EtherCAT-Configurator.html"))).mtimeMs;
  const src = path.join(ROOT, "src");
  const newest = Math.max(...await Promise.all((await readdir(src)).map(async (f) => (await stat(path.join(src, f))).mtimeMs)));
  if (newest > built && !opt("stale-ok", false)) {
    console.error("Sids-EtherCAT-Configurator.html is older than src/ -- rebuild first:\n" +
      "  npm run build && cp dist/index.html Sids-EtherCAT-Configurator.html\n(or pass --stale-ok)");
    process.exit(2);
  }
}
const browser = await chromium.launch({ channel: CHANNEL, headless: !HEADED });
try {
  if (LABELS) {
    const scene = SCENES.find((s) => s.name === LABELS);
    if (!scene) throw new Error(`no scene "${LABELS}"`);
    await listLabels(browser, scene);
  } else {
    await mkdir(OUT, { recursive: true });
    const pick = ONLY ? new Set(String(ONLY).split(",")) : null;
    const results = [], failures = [];
    for (const scene of SCENES.filter((s) => !pick || pick.has(s.name))) {
      const t0 = Date.now();
      const { context, page, errors } = await openScene(browser, scene);
      try {
        for (const step of scene.steps) await runStep(page, step, scene, results);
        if (errors.length) throw new Error(`page error: ${errors[0]}`);
        console.log(`  ok    ${scene.name.padEnd(14)} ${Date.now() - t0} ms`);
      } catch (e) {
        failures.push(scene.name);
        console.log(`  FAIL  ${scene.name.padEnd(14)} ${e.message}`);
      } finally {
        await context.close();
      }
    }
    // the manifest describes the full set, so only a full run rewrites it
    if (!pick) await writeFile(path.join(OUT, "shots.json"), JSON.stringify({ scale: SCALE, shots: results }, null, 2) + "\n");
    console.log("");
    for (const r of results) {
      console.log(`  ${r.file.padEnd(38)} ${String(r.width).padStart(5)} x ${String(r.height).padEnd(5)} ${String(r.kb).padStart(5)} KB`);
    }
    const total = results.reduce((n, r) => n + r.kb, 0);
    console.log(`\n  ${results.length} images, ${(total / 1024).toFixed(1)} MB${failures.length ? `, FAILED: ${failures.join(", ")}` : ""}`);
    process.exitCode = failures.length ? 1 : 0;
  }
} finally {
  await browser.close();
}
