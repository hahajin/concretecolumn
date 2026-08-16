# Revision notes — RC Column N-M Tool (Chinese GB 50010 → New Zealand NZS 3101)

## What changed

### 1. Language
- All UI text (labels, buttons, headers, legends, chart titles, alerts) translated to English.
- All PDF report text translated to English.
- Chinese comments in the source code were **kept** and English translations were added
  alongside them (not replaced), per your request.

### 2. Code compliance (Chinese GB 50010 → NZ NZS 3101:2006 / AS/NZS 4671)

| Item | Before (GB 50010) | After (NZS 3101:2006 / AS/NZS 4671) |
|---|---|---|
| Concrete grades | C20–C80 (design value fc, already divided by material factor) | f'c = 20/25/30/35/40/45/50/60/70/80/100 MPa (specified/characteristic strength, NZS 3104 standard grades) |
| Stress block | α1, β1 interpolated between C50 and C80; εcu interpolated 0.0033→0.0030 | NZS 3101 §7.4.2.7: α1 = 0.85 (f'c≤55) or 0.85−0.004(f'c−55)≥0.75; β1 = 0.85 (f'c≤30) or 0.85−0.008(f'c−30)≥0.65; εcu = 0.003 (constant) |
| Reinforcing steel | HPB300 / HRB335 / HRB400 / HRBF400 / RRB400 / HRB500 | AS/NZS 4671 Grade 300E (fy=300 MPa) and Grade 500E (fy=500 MPa) — 500E is the grade predominantly used in NZ |
| Es | 2.0×10⁵ N/mm² | 200,000 MPa (same value, NZS 3101 §5.3.2) |
| Strength reduction φ | Not modelled (GB stability/0.9φ noted only as an omission) | φ = 0.85 for flexure w/ or w/o axial load (NZS 3101 §2.3.2.2) — now explicitly computed and shown as φN/φMx/φMy alongside nominal Sn |
| Bar diameters | 12–32 mm (Chinese series) | AS/NZS 4671 series: 10, 12, 16, 20, 24, 28, 32, 36, 40 mm |
| Min/max column reinforcement ratio | 0.55% / 5% (GB 50010) | 0.8% / 8% (NZS 3101 §10.3.8.1), with an extra note above 4% about lap-splice congestion |
| Min bar clear spacing check | 30 mm (GB) | 25 mm (NZS 3101 §8.3.2, bar diameter or 25 mm, whichever governs) |
| Default cover | 30 mm | 40 mm (typical NZS 3101 Table 3.6 B1/B2 exposure value — user-adjustable) |

## Issues found in the original code, and how they were fixed

1. **Bug — axial capacity N0 used gross concrete area.**
   `N0 = fc·A + fy·As` used the *gross* section area `b·h` without deducting the
   steel area, slightly over-stating the pure axial compression capacity.
   **Fixed** to `N0 = α1·f'c·(Ag − As) + fy·As`, matching the NZS 3101 §10.3.4.2
   definition of `Nn,max` (net concrete area). See `section.js`.

2. **Missing strength-reduction factor φ.** The original tool only reported
   "nominal" values and explicitly noted that the 0.9φ stability factor from
   GB 50010 was *not* applied — but nothing was shown to remind the user to
   apply it. Under NZS 3101, the correct check is `S* ≤ φ·Sn` with φ = 0.85 for
   flexure/axial. **Added**: every control point in the web UI and PDF now also
   shows the factored design values `φN`, `φMx`, `φMy` next to the nominal `Sn`
   values, so the φ step can't be silently forgotten.

3. **Reinforcement ratio limits were GB-specific and no longer correct** for a
   NZ design (0.55%/5%) — **updated** to NZS 3101 §10.3.8.1 limits (0.8%/8%,
   with a secondary note at 4% about splice congestion).

4. **PDF font pipeline had a silent-failure risk.** The original code fetched a
   Chinese font from a third-party CDN (`cdn.jsdelivr.net/.../SimHei.ttf`) as a
   fallback if the local font file was missing; if both failed, Chinese text
   would silently render blank/garbled with only a console warning. Since the
   report is now English-only, this entire font-fetching mechanism was
   **removed** in favour of jsPDF's built-in Helvetica font — simpler, faster,
   and with no external dependency to fail.

5. **Suggestion (not changed, flagged in code comments):** the biaxial
   interaction surface is still approximated by a linear Bresler-type contour
   `Mx/Mux + My/Muy = 1` at each axial load level. This is a conservative but
   approximate method — for governing load cases in a final design, verify
   against a full section integration at the actual neutral-axis angle.

6. **Suggestion (not changed, flagged in code comments):** stirrups/ties are
   only used for the drawing — the tool does **not** check shear strength
   (NZS 3101 §7.5 / §10.3.10) or ductile detailing (hoop spacing, confinement,
   NZS 3101 §10.4). This tool is strictly an N-M flexure/axial capacity
   calculator; shear and seismic detailing must be checked separately.

## Files changed
- `src/utils/materials.js` — NZ concrete/steel grades, NZS 3101 stress-block formulas, φ constant
- `src/utils/section.js` — N0 bug fix, updated comments/docs
- `src/App.jsx` — NZ defaults, English UI, updated warning thresholds, φ-factored control points
- `src/components/ColumnInputs.jsx` — English labels, NZ bar sizes/grades
- `src/components/ControlPointsTable.jsx` — English headers, added φN/φMx/φMy columns
- `src/components/NMChart3D.jsx` — English titles/legends
- `src/components/SectionSVG.jsx` — English labels/legend
- `src/utils/exportPdf.js` — English report, NZS 3101 references, simplified font handling, φ columns
- `src/theme.js`, `src/index.js` — comment translations only

## Verified
- `npm install && npm run build` completes with **"Compiled successfully"** (no errors).
- Spot-checked the NZS 3101 stress-block formulas and the N0 fix numerically (see commit notes) —
  values are consistent with hand-calculation expectations (e.g. a 400×600 mm column at
  f'c = 30 MPa with ~1% steel gives φN0 ≈ 6,200 kN, a sensible order of magnitude).

## Not covered by this tool (do not rely on it for these)
- Shear design, ductility/capacity-design detailing, slenderness/second-order effects,
  durability cover selection, and seismic design coefficients are all outside this
  tool's scope and must be checked separately against the full NZS 3101 standard.
