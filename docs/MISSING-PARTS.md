# Parts on beckhoff.com that are not in the catalog yet

Checked 2026-11-08 against the beckhoff.com EtherCAT Terminals tabular product overview (631 parts) and the Infosys EtherCAT Terminals manual list. 358 of the 631 are not in `src/catalog.js`. Embedded PCs were checked separately: all 64 are in (board 07).

**Update 2 (same day): all 358 are now in the app** except the ELX (32) and ELM (58) families listed at the bottom, which are a separate housing. The last 106 are in `src/catalog-more-faces.js` (board 08): new faces for the fieldbus couplers, M8 couplers, EKM1101, flat-ribbon terminals, the EL6072 key slot, the EM7004 module and new EL-24 connectors (SMA, duplex fibre, pneumatic fittings, sensor ports, D-sub 25, spring plugs); the EL922x ordering codes, EL95xx variants, ED9xxx feeds and ED918x distribution reuse the base parts' faces (`face:` alias). What is inferred is in each part's description; EL6233 and ED3274 use a placeholder E-bus current because their pages list none. The fieldbus couplers' networks are not simulated yet (ROADMAP-v0.2).

**Update 1 (same day):** 162 of these are now in the app, in `src/catalog-more.js`. Their channels, width, E-bus current and housing come from each product page, and their faces use the existing 8-point, HD 16-point, 2 × 16, 2 × 8 and ED housings. They have no pinouts yet, so their clamps show numbers. Validation and Simulate assume clamp n = channel n only where the clamp count matches the channel count (`noSig` marks the others). Still to do (106):
- Couplers: EK1100-0008, EK1101-0008, EK1110-0008/-0043/-0044, EK1122-0008, EKM1101, EC1100, EC1110, BK1150, BK1250, EK9000/9020/9160/9300/9320/9500/9520, EK3100.
- Housings the app does not draw yet: flat-ribbon (EL1852, EL1862(-0010), EL1872(-0010), EL2872(-0010), EL2878-0005); D-sub (EL1262-0010, EM2042, ED6011-0009, ED6012-0009); EL-24 comm and measurement (EL6251, EL6254, EL6632–6634, EL6653, EL6689, EL6711-0010, EL6720, EL6733, EL6740-0010, EL6753, EL6754, EL6761, EL6861, the -0010 slaves, EL3008-0003/-0005, EL3475(-0200), EM3701/3702/3712); EL6072.
- Need feed or fuse modelling: the EL922x ordering codes, EL9540-0010, EL9550-0010/-0012, EL9561, EL9562(-0015), ED9100/9110/9183/9184/9186/9188/9189/9410.
- Others: EL7201-9014, EL7211-9014, EL7221-9014, EL8601-8411, ED8601-8411, EM7004. EL6233 and ED3274 are held back because their pages list no E-bus current.

A part goes in only when its pinout can be verified (Infosys, the manual or the product picture), so this is a to-do list, not a promise. The **Priority** groups are the standard base parts. The variant groups mostly reuse an existing face and need only a catalog row once verified.

## Infosys pinout pass (2026-11-08)

Checked the 341 EL / ED parts that had no pinout against the connection tables in Infosys (144 EtherCAT Terminal manuals, 967 pages read). The clamp tables are in `src/catalog-pinouts.js`; each clamp keeps the manual's name and description as hover text, and gets a role only where the table states it (power contacts, PE, "Input n" / "Output n", analog signal ground).

- **187 parts: full pinout with channel roles.**
- **89 parts: every clamp named, but no channel roles**, because the manual's names are not "Input n" / "Output n" or the count differs from the catalog's channels. This covers RTD, thermocouple, bridge, power-measurement, relay and counter terminals. Their clamps no longer guess "clamp n = channel n".
- **Housing corrected to 16 points** (12): EL2522, EL2595, EL2798, EL3174, EL3214, EL3255, EL5032, EL5042, EL5072, EL5112, EL5131, EL6224. The catalog drew them with 8 clamps. Wires saved on these parts keep their clamp numbers but move.
- **Table did not match the housing, left for a manual check** (14): ED4074, EL3453-0020, EL3453-0100, EL3483, EL3483-0060, EL3783, EL3783-0100, EL4074, EL4078, EL5001-0011, EL5001-0012, EL5101-0010, EL5101-0011, EL5101-0090.
- **Pinout only as a picture in Infosys** (29): EL3602, EL3602-0002, EL3602-0010, EL3612, EL3621-0020, EL3632, EL3681, EL3692, EL4172, EL4374, EL5021, EL5151, EL6001, EL6021, EL6021-0021, EL6070, EL6080, EL6201, EL7031, EL7031-0030, EL7037, EL7041-0052, EL7062, EL7201-0010, EL7201-9014, EL7211-9014, EL7221-9014, EL7332, EL8601-8411.
- **No Infosys manual yet** (22, mostly new ED push-in parts): ED1808, ED2032, ED2034, ED2808, ED2838, ED3172, ED3174, ED3274, ED3361, ED3362, ED4172, ED4174, ED5002, ED6011, ED6012, ED6060, ED6781, ED7211-0010, ED8601-8411, EL6071, EL6685, EL6685-0010.
  - **Referenced from a counterpart** (8, `ED_REF` in `src/catalog.js`, flagged in each desc): ED1808 ← EL1808, ED2032 ← EL2032, ED2034 ← EL2034, ED2808 ← EL2808, ED2838 ← EL2838, ED3174 ← EL3174 (same clamp count, EL table copied); ED3361 / ED3362 ← the ED3361-0100 / ED3362-0100 tables (UBridge+ as the channel input).
  - **Doubled from the EL table** (2): ED3172 ← EL3172, ED5002 ← EL5002 (8 EL clamps, each used twice on the 16-point ED housing, columns kept; the second clamp of each pair has no role).
  - **Still open** (7): ED7211-0010 (EL7211-0010: 32 vs 16), ED8601-8411 (EL counterpart has no table either), ED6011, ED6012, ED6060, ED6781, ED3274 (no EL counterpart in the catalog).
  - **Dummy terminals** (3): EL6071, EL6685, EL6685-0010 have no field clamps; they stay EtherCAT slaves with their E-bus current, clamps marked "no field connection".
- **Second parser pass (2026-11-09):** the parser now reads number-first tables ("1 | TxD | …"), ranges ("1 - 8"), primed second blocks (1'–16'), side-by-side blocks (EL3783), one manual typo (EL4074 "Ch3 output | 2") and more channel names (Ch1 output, Ch1 U+, +R1, +TC1, I1, Relay 1, L1–L3). Result: 273 parts with channel roles (was 187), 37 named only (was 89). Of the 29 "picture only" parts, 26 now have tables (EL5151, EL5021, EL6021 were on pages the first crawl missed). EL3453 corrected to 24 mm 2 × 8. EL7037 corrected to 16 points. Sibling tables (flagged): EL7041-0052 ← EL7041, EL4172 ← EL4072, ED4172 ← ED4072, ED4174 ← ED4074.
  - **Still without a table:** EL4374, EL7041 page (picture only); EL6201 (hand-entered: "1 and 5" style table); EL3483 (4 clamps listed for an 8-point housing), EL5001-0012 and EL7031-0030 (8-clamp table for a 16-point housing), EL3314-0092 (manual lists -TC3 twice).
- **KL Bus Terminals (2026-11-09):** the 10 KL I/O parts (KL1104, KL1408, KL1418, KL2134, KL2408, KL2612, KL3054, KL3204, KL4004, KL4404) now carry the clamp tables from the Infosys KL manuals (page cited in each desc). KL4404 corrected to 0…10 V, K-bus 20 mA (the catalog had 0–20 mA, which is KL4414).

## Priority: standard base parts

| Group | Missing |
|---|---|
| Couplers | EK1100-0008, EK1101-0008, EK1110-0008, EK1110-0043, EK1110-0044, EK1122-0008, EKM1101, EC1100, EC1110 (new push-in), BK1150, BK1250, EK9000, EK9020 (Modbus), EK9160 (IoT), EK9300, EK9320 (PROFINET), EK9500, EK9520 (EtherNet/IP), EK3100 (PROFIBUS) |
| Digital in | EL1034, EL1052, EL1054 (NAMUR), EL1254, EL1258, EL1258-0010, EL1259, EL1264, EL1382 (thermistor), EL1409, EL1417, EL1429, EL1489, EL1702, EL1702-0020, EL1712, EL1712-0020, EL1722, EL1852, EL1862, EL1862-0010, EL1872, EL1872-0010, EL1899 |
| Digital out | EL2014, EL2034, EL2044, EL2068, EL2407, EL2409, EL2489, EL2212, EL2252, EL2258, EL2784, EL2788, EL2794, EL2838, EL2869, EL2872, EL2872-0010, EL2642, EL2574, EL2596, EL2596-0010, EM2042 |
| Analog in | EL3011, EL3012, EL3014, EL3022, EL3024, EL3041, EL3051, EL3072, EL3074, EL3078, EL3111, EL3112, EL3114, EL3122, EL3141, EL3151, EL3161, EL3172, EL3182, EL3184, EL3423, EL3444, EL3446, EL3475, EL3483, EL3692, EL3773, EL3783, EM3701, EM3702, EM3712 |
| Analog out | EL4072, EL4074, EL4078, EL4132, EL4172, EL4374 |
| Encoder | EL5122 |
| Communication | EL6071, EL6072 (licence keys), EL6184 (HART), EL6201 (AS-i), EL6233 (Ethernet-APL), EL6251, EL6254 (Modbus TCP), EL6632, EL6633, EL6634 (PROFINET), EL6653, EL6685, EL6689, EL6720, EL6733, EL6753, EL6754, EL6761, EL6821 (DALI-2), EL6851, EL6861 (BACnet MS/TP) |
| Motion | EL7062, EM7004 |
| Multi-function | EL8601-8411, ED8601-8411 |
| System | EL9561, EL9562, EL9562-0015 |
| ED push-in | ED1837, ED1897, ED2504, ED2807, ED2887, ED3274, ED3361, ED3362, ED6011-0009, ED6012-0009, ED9100, ED9110, ED9183, ED9184, ED9186, ED9188, ED9189, ED9410 |

## Variants of parts already in the app

Most of these share a face with a part we have.

- **Calibrated (-0020 / -0030) and functional-isolation variants:** EL1004-0020, EL3062-0030, EL3172-0020, EL3443-0020, EL3453-0020, EL3621-0020, ELM3104-0020, ELM3704-0020, EL3751-0024.
- **TwinSAFE SC (-0090):** EL3124-0090, EL3174-0090, EL3214-0090, EL3314-0090, EL3314-0092, EL3356-0090, EL5001-0090, EL5021-0090, EL5032-0090, EL5101-0090, EL5151-0090, EL6224-0090.
- **Other -00xx variants:** EL1252-0010/-0050/-0060, EL1262-0010/-0050, EL2024-0010, EL2202-0100, EL2502-0010, EL2521-0024/-0025/-0124, EL2535-0002/-0005/-0050/-0100/-0103, EL2564-0010, EL2602-0010, EL2622-0010, EL2878-0005, EL3008-0003/-0005, EL3112-0011, EL3142-0010, EL3174-0002/-0032/-0042, EL3201-0010, EL3202-0010, EL3204-0162/-0200, EL3208-0010, EL3314-0002/-0010, EL3356-0010, EL3443-0010/-0011/-0013, EL3446-0011, EL3453-0100, EL3475-0200, EL3483-0060, EL3602-0002/-0010, EL3702-0015, EL3751-0004, EL3783-0100, EL4112-0010, EL5001-0011/-0012, EL5031-0011, EL5101-0010/-0011, EL5151-0021, EL6021-0021, EL6631-0010, EL6633-0010, EL6652-0010, EL6653-0010, EL6685-0010, EL6711-0010, EL6731-0010, EL6733-0010, EL6740-0010, EL6751-0010, EL6752-0010, EL6753-0010, EL6754-0010, EL6851-0010, ED3361-0100, ED3362-0100, EL7031-0030, EL7041-0052, EL7201-0010, EL7201-9014, EL7211-9014, EL7221-9014, EL9540-0010, EL9550-0010, EL9550-0012.
- **EL922x electronic fuses, by current rating:** EL9221-4030/-5000/-5090/-6000/-6040/-9060/-9080, EL9222-4433/-5500/-6600/-6644/-9482/-9664, EL9227-0000/-4433/-5500/-6600/-6644/-9482/-9664. The base EL9221 / EL9222 / EL9227 ids in the catalog are not sold under those names. They should become these ordering codes.

## Separate housings (own family, later)

- **Update 2026-11-09: the ELX and ELM families are now in the app** (`src/catalog-elxm.js`, generated from the beckhoff.com technical data; palette groups "ELX" and "ELM"). ELX = the EL / EL-24 housing in blue (ELX9560 48 mm Ex i supply with its own face, ELX9410, ELX9012); clamp layouts not verified (Infosys has no ELX manuals), flagged per part. ELM = a 30 mm metal housing drawn from the pictures: push-in plugs X1…X4 (channels split over columns, e.g. ELM3148 4 × 2 × 6), 4 mm sockets, BNC, LEMO, mini-TC sockets, the ELM72xx servo plugs; 2-pin AI plugs take pin 1 as + (assumed), other pin functions not verified. ELM9410 / ELX9410 E-bus supplies, ELM9012 / ELX9012 end covers.
- **ELX, intrinsically safe (Ex i), blue housing, 32 parts:** ELX1052, ELX1054, ELX1058, ELX2002, ELX2008, ELX2792, ELX3152, ELX3158, ELX3181, ELX3184, ELX3202, ELX3204, ELX3252, ELX3312, ELX3314, ELX3351, ELX3632, ELX4154, ELX4181, ELX4184, ELX5151, ELX6233, ELX9012, ELX9410, ELX9560, and their -0090 variants.
- **ELM measurement and servo, 58 parts:** ELM3002/3004, ELM3102/3104, ELM3142–3148, ELM3244/3246, ELM3344/3348, ELM3502/3504, ELM3542/3544, ELM3602/3604, ELM3702/3704 with their variants, ELM2642/2644/2742/2744 multiplexers, ELM7211/7212/7221/7222/7231 servo drives (-0010, -9016, -9018), ELM9012 and ELM9410.

## In the catalog but not on that page

EK1914, EK1960, EL1904, EL1918, EL2904, EL2911, EL2912, EL6910 and EL6930 are TwinSAFE parts, listed on the TwinSAFE pages instead. ED1808, EL9221, EL9222 and EL9227 are not listed under those exact ids (see the EL922x note above).
