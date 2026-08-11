# Generates src/catalog-etg.js from the ETG product-directory CSV.
# Only placeable hardware is imported; every entry reuses an existing `kind`
# so it renders with a real face and real connection points.
import csv, io, re, json, collections, pathlib

#   python scripts/gen-etg.py      (from the repo root; rewrites src/catalog-etg.js)
REPO = pathlib.Path(__file__).resolve().parent.parent
CSV = REPO / "scripts" / "ethercat_products.csv"
OUT = REPO / "src" / "catalog-etg.js"

# ---- Type -> how the part is modelled ------------------------------------
# kind must already have a freeGeom + FreeCompG case, or it draws as a
# dashed placeholder (HANDOFF gotcha 2).
# `short` is the plain-language device type kept on the part, so searching
# "servo" or "gateway" still finds it now that the palette groups by vendor.
TYPES = {
  "Drive Technology - Servo Drives":        dict(kind="drive",     fn="drv",  short="Servo drive",        fw=92,  fh=210, motion=True, ch=1),
  "Drive Technology - Stepper":             dict(kind="drive",     fn="drv",  short="Stepper drive",      fw=80,  fh=200, motion=True, ch=1),
  "Drive Technology - Inverter, VFD, VSD":  dict(kind="drive",     fn="drv",  short="Inverter / VFD",     fw=104, fh=210, motion=True, ch=1),
  "Drive Technology":                       dict(kind="drive",     fn="drv",  short="Drive",              fw=92,  fh=210, motion=True, ch=1),
  "Mechatronic Components":                 dict(kind="linaxis",   fn="drv",  short="Mechatronic axis",   fw=190, fh=60,  motion=True),
  "I/O Systems":                            dict(kind="epbox",     fn="fld",  short="I/O system",         fw=84,  fh=150, ioconn=8),
  "Device":                                 dict(kind="epbox",     fn="fld",  short="EtherCAT P device",  fw=84,  fh=150, ioconn=8, etherP=True),
  "Sensors":                                dict(kind="sensor",    fn="fld",  short="Sensor",             fw=44,  fh=112, ch=1),
  "Gateways":                               dict(kind="box",       fn="net",  short="Gateway",            fw=90,  fh=110, ioconn=4),
  "Interface Cards":                        dict(kind="box",       fn="net",  short="Interface card",     fw=110, fh=80,  ioconn=2),
  "Media Converters":                       dict(kind="box",       fn="net",  short="Media converter",    fw=80,  fh=90,  ioconn=2),
  "Topology Components":                    dict(kind="switch8",   fn="net",  short="Topology component", fw=160, fh=90),
  "Switches":                               dict(kind="switch8",   fn="net",  short="Switch",             fw=160, fh=90),
  "Infrastructure Component":               dict(kind="box",       fn="net",  short="Infrastructure",     fw=90,  fh=100, ioconn=3),
  "FSoE SubInstance":                       dict(kind="box",       fn="safe", short="FSoE safety device", fw=90,  fh=110, ioconn=4, safety=True),
  "FSoE MainInstance":                      dict(kind="box",       fn="safe", short="FSoE safety master", fw=96,  fh=118, ioconn=4, safety=True),
  "Hydraulic and Pneumatic Valve Systems":  dict(kind="valvebank", fn="fld",  short="Valve manifold",     fw=150, fh=96, ch=8, netport=True),
  "Operator Interfaces":                    dict(kind="panel",     fn="pnl",  short="Operator interface", fw=150, fh=112, usb=1, video=["DP"]),
  "Semiconductor Industry":                 dict(kind="box",       fn="fld",  short="Semiconductor eqpt", fw=90,  fh=110, ioconn=4),
}
# deliberately not imported: passive connectors (the wire tool picks cables),
# and the dev/tooling rows that have no connection points at all.
SKIP_TYPES = {"Cables and Connectors", "Development"}
KEEP_CATS = {"SubDevices", "EtherCAT P", "Components", "Functional Safety"}

# ---- existing catalog: ids to dedupe against, brands to reuse -------------
src = (REPO / "src" / "catalog.js").read_text(encoding="utf-8") + \
      (REPO / "src" / "catalog-extended.js").read_text(encoding="utf-8")
existing_ids = set(re.findall(r'\{\s*id:\s*"([^"]+)"', src))
app = (REPO / "src" / "App.jsx").read_text(encoding="utf-8")
brands_block = re.search(r"const BRANDS = \{(.*?)\n\};", app, re.S).group(1)
known_brands = dict(re.findall(r'(\w+):\s*\{\s*name:\s*"([^"]+)"', brands_block))  # key -> NAME

NOISE = re.compile(r"\b(gmbh|co|kg|kgaa|ag|inc|llc|ltd|limited|corp|corporation|company|"
                   r"technologies|technology|automation|electronics|electric|electrical|systems|"
                   r"system|group|international|industrial|industries|solutions|s\.?a\.?|b\.?v\.?|"
                   r"n\.?v\.?|oy|ab|as|spa|srl|sas|plc|pte|pvt|the)\b", re.I)
def norm(s):
    s = s.replace("&", " ").replace("(", " ").replace(")", " ")
    s = NOISE.sub(" ", s)
    return re.sub(r"[^a-z0-9]+", "", s.lower())

known_by_norm = {norm(v): k for k, v in known_brands.items()}

def brand_key(company):
    n = norm(company)
    if n in known_by_norm:
        return known_by_norm[n], True
    for kn, kk in known_by_norm.items():          # e.g. "BECKHOFF Automation" -> beckhoff
        if kn and (n.startswith(kn) or kn.startswith(n)) and min(len(kn), len(n)) >= 4:
            return kk, True
    return "etg_" + (re.sub(r"[^a-z0-9]+", "", company.lower())[:20] or "vendor"), False

PARTNO = re.compile(r"^[A-Za-z]{1,8}[-_]?\d{2,}[A-Za-z0-9\-_/.+]*$")
def slug_id(company, product):
    """Return (id_core, is_family). The directory mixes orderable part numbers
    with family/marketing names; only the former become a part number."""
    p = re.sub(r"\s+", " ", product).strip()
    head = re.split(r"\s{2,}|\s+[-–—]\s+|\s*[:|]\s*|\s*\(", p)[0].strip()
    # a token carrying both letters and digits is almost always the part number
    for tok in re.split(r"[\s,]+", head):
        t = tok.strip(".,;")
        if len(t) <= 24 and PARTNO.match(t):
            return re.sub(r"[^A-Za-z0-9.\-_/+]", "", t), False
    # no part number in there — keep enough of the phrase to stay distinguishable
    s = re.sub(r"[^A-Za-z0-9]+", "-", p).strip("-")
    return (s[:34].rstrip("-") or "PART"), True

rows = list(csv.DictReader(io.open(CSV, encoding="utf-8-sig")))
out, brand_names, skipped = [], {}, collections.Counter()
dupes = [0]
families = [0]
seen = set(existing_ids)

for r in rows:
    cat, typ = r["Category"], r["Type"]
    if cat not in KEEP_CATS:
        skipped["category not placeable: " + cat] += 1; continue
    if typ in SKIP_TYPES:
        skipped["type not placeable: " + typ] += 1; continue
    spec = TYPES.get(typ)
    if not spec:
        skipped["unmapped type: " + typ] += 1; continue

    company = r["Company"].strip()
    bkey, is_known = brand_key(company)
    if not is_known:
        brand_names[bkey] = company

    core, family = slug_id(company, r["Product"])
    if core in existing_ids:                      # already curated by hand
        skipped["already in catalog"] += 1; continue
    prefix = (known_brands.get(bkey) or company).upper()
    prefix = re.sub(r"[^A-Z0-9]+", "", prefix)[:10] or "ETG"
    pid = f"{prefix}-{core}"
    if pid in seen:
        n = 2
        while f"{pid}-{n}" in seen: n += 1
        pid = f"{pid}-{n}"
        dupes[0] += 1
    seen.add(pid)

    full = re.sub(r"\s+", " ", r["Product"]).strip()
    name = full if len(full) <= 58 else full[:57].rstrip() + "…"
    cert = r["Certified"].strip().lower() == "yes"
    desc = f"{typ} · {company}. " + ("ETG-certified device. " if cert else "") + \
           ("PRODUCT FAMILY, not an orderable part number — pick the exact model from the vendor. " if family else "") + \
           "From the EtherCAT Technology Group product directory — representative geometry and pinout, no vendor data sheet applied."

    e = {"id": pid, "brand": bkey, "name": name, "fn": spec["fn"], "free": True,
         "kind": spec["kind"], "fw": spec["fw"], "fh": spec["fh"],
         "io": None, "ch": spec.get("ch", 0), "w": 0, "ebus": 0}
    for k in ("ioconn", "motion", "safety", "netport", "etherP", "usb", "video"):
        if k in spec: e[k] = spec[k]
    if family: e["family"] = True; families[0] += 1
    # `etg` is the plain-language device type: it marks the part as a directory
    # import (for the SRC filter) and is what the palette search matches on
    e["etg"] = spec["short"]
    e["etgCert"] = cert
    e["url"] = r["URL"].strip()
    e["desc"] = desc
    out.append(e)

def js(v):
    if v is None: return "null"
    if v is True: return "true"
    if v is False: return "false"
    if isinstance(v, (int, float)): return str(v)
    if isinstance(v, list): return "[" + ", ".join(js(x) for x in v) + "]"
    return json.dumps(v, ensure_ascii=False)

lines = ['/* EtherCAT Technology Group product directory — generated from',
         ' * ethercat_products.csv (scripts/gen-etg.py). Placeable hardware only:',
         ' * drives, I/O systems, sensors, gateways, FSoE safety devices, valve',
         ' * manifolds, panels. Training, dev tools, soft-PLCs, stacks, evaluation',
         ' * kits and passive connectors are NOT imported — they have no connection',
         ' * points, which every catalog part must have.',
         ' *',
         ' * IMPORTANT: the directory carries no electrical data. Geometry, channel',
         ' * counts and pinouts here are REPRESENTATIVE defaults chosen per product',
         ' * type — they are not the vendor\'s specification. `url` links the ETG',
         ' * product page; check it before trusting anything in a real build.',
         ' *',
         ' * The palette groups by company and then by category, both derived in the',
         ' * app — nothing here dictates layout. `etg` carries the device type, which',
         ' * marks the part as a directory import and is matched by the search box.',
         ' */',
         'export const ETG_BRANDS = {']
for k in sorted(brand_names):
    lines.append(f'  {k}: {{ name: {js(brand_names[k].upper())}, c: "#5A6B7A" }},')
lines.append('};')
lines.append('')

# one palette section per vendor, alphabetical by display name
vendors = {}
for e in out:
    vendors.setdefault(e["brand"], []).append(e)
def vendor_name(bkey):
    return brand_names.get(bkey) or known_brands.get(bkey) or bkey
vkeys = sorted(vendors, key=lambda b: vendor_name(b).upper())

lines.append('export const ETG = [')
out.sort(key=lambda e: (vendor_name(e["brand"]).upper(), e["id"]))
cur = None
for e in out:
    if e["brand"] != cur:
        cur = e["brand"]
        lines.append(f'  // ---- {vendor_name(cur)} ----')
    body = ", ".join(f"{k}: {js(v)}" for k, v in e.items())
    lines.append("  { " + body + " },")
lines.append('];')
OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")

print("imported", len(out), "parts;", len(brand_names), "new vendors")
print("family (no part number):", families[0], "| id collisions suffixed:", dupes[0])
print("vendor sections:", len(vkeys), "| largest:",
      sorted(((len(v), vendor_name(k)) for k, v in vendors.items()), reverse=True)[:5])
print("by type:", collections.Counter(e["etg"] for e in out).most_common(6))
print("skipped:")
for k, n in skipped.most_common(): print(f"   {n:5} {k}")
print("longest id:", max(len(e["id"]) for e in out), "| longest name:", max(len(e["name"]) for e in out))
