// =====================================================================
// 材料参数 —— 已修订为符合新西兰规范
// Material parameters — REVISED to comply with New Zealand standards:
//   · NZS 3101:2006 (Inc A1–A3) "Concrete Structures Standard"
//   · AS/NZS 4671:2019 "Steel Reinforcing Materials"
//   · NZS 3104:2003 "Specification for Concrete Production" (standard f'c grades)
//
// ★ 修订说明 / Revision notes:
//   1. 原代码使用中国 GB 50010-2010 的混凝土强度设计值 fc（已经过材料分项系数
//      折减）与等效矩形应力图系数 α1/β1。已替换为 NZS 3101 的做法：直接使用
//      混凝土规定抗压强度 f'c（未折减的特征强度），配合 NZS 3101 §7.4.2.7 给出
//      的 α1、β1 系数计算"名义强度"Sn；抗力上的折减改为强度折减系数 φ（见
//      NZS 3101 §2.3.2.2），而不是像 GB 那样把材料分项系数放进 fc 里。
//      Previously the code used GB 50010 design-value fc (already divided by a
//      material partial factor) with GB stress-block coefficients. This has been
//      replaced with the NZS 3101 approach: the UNFACTORED specified compressive
//      strength f'c is used directly with the NZS 3101 §7.4.2.7 stress-block
//      factors α1/β1 to compute the NOMINAL strength Sn; the safety margin is
//      applied afterwards through the strength-reduction factor φ = 0.85 (NZS 3101
//      §2.3.2.2), not baked into the concrete strength itself. See exportPdf.js /
//      App.jsx for where φ is applied to obtain the design strength φSn.
//   2. 钢筋牌号由中国 HRB/HPB 系列改为新西兰/澳大利亚通用的 AS/NZS 4671 牌号
//      300E / 500E（E = 抗震延性等级，New Zealand practice predominantly uses
//      500E）。弹性模量 Es 统一取 200,000 MPa（NZS 3101 §5.3.2 建议值，与原
//      2.0×10^5 N/mm² 数值一致，无需改动）。
//      Reinforcing steel grades changed from the Chinese HRB/HPB series to the
//      AS/NZS 4671 Grade 300E / 500E designations used in New Zealand (500E is the
//      grade predominantly stocked in NZ). Es = 200,000 MPa per NZS 3101 §5.3.2
//      (same numeric value as before, no change required).
//   3. 混凝土等级列表改为新西兰常见商品混凝土等级（NZS 3104 附表），单位仍为
//      MPa，但不再冠以 "C" 前缀（新西兰习惯直接写 f'c 数值，如 "30" 表示
//      f'c = 30 MPa）。
//      Concrete grade list changed to the standard ready-mix grades available in
//      New Zealand (per NZS 3104). No "C" prefix — NZ practice quotes f'c directly
//      (e.g. "30" denotes f'c = 30 MPa).
// =====================================================================

// 混凝土规定抗压强度 f'c（MPa，28 天，特征值，未折减）
// Concrete specified (characteristic, 28-day) compressive strength f'c, MPa —
// this is NOT a design value; α1/β1 are applied to it directly in the stress
// block, and the member strength is reduced afterwards by φ.
export const CONCRETE_GRADES = {
  20:  { fpc: 20 },
  25:  { fpc: 25 },
  30:  { fpc: 30 },
  35:  { fpc: 35 },
  40:  { fpc: 40 },
  45:  { fpc: 45 },
  50:  { fpc: 50 },
  60:  { fpc: 60 },
  70:  { fpc: 70 },
  80:  { fpc: 80 },
  100: { fpc: 100 },
};

// 钢筋下限特征屈服强度 fy（MPa）—— AS/NZS 4671 抗震延性 E 级牌号
// Reinforcement lower-characteristic yield strength fy (MPa) — AS/NZS 4671
// seismic ductility Grade E bars (New Zealand standard practice).
export const STEEL_GRADES = {
  '300E': { fy: 300 },
  '500E': { fy: 500 }, // 新西兰目前最常用的牌号 / most commonly stocked grade in NZ
};

export const ES = 200000; // 钢筋弹性模量 Es（MPa）——NZS 3101 §5.3.2

// 强度折减系数 φ（NZS 3101 §2.3.2.2(c)）：受弯、压弯（有或无轴力）构件取 0.85。
// 本工具计算得到的是"名义强度"Sn；设计强度 = φ·Sn，需由使用者在校核
// S* ≤ φ·Sn 时自行乘上，见 App.jsx / exportPdf.js 中 PHI 的使用。
// Strength-reduction factor φ (NZS 3101 §2.3.2.2(c)): flexure with or without
// axial tension/compression → φ = 0.85. All N-M values computed by this tool are
// NOMINAL strengths Sn; the design strength is φ·Sn. This φ is exposed so the UI
// and PDF report can show both nominal and design (factored) values.
export const PHI_FLEXURE_AXIAL = 0.85;

/**
 * 按混凝土等级返回 f'c 以及 NZS 3101 §7.4.2.7 等效矩形应力图参数：
 * Returns f'c and the NZS 3101 §7.4.2.7 equivalent rectangular stress-block
 * parameters for a given grade:
 *
 *   α1 = 0.85                              , f'c ≤ 55 MPa
 *   α1 = max(0.75, 0.85 − 0.004(f'c − 55)) , f'c > 55 MPa
 *
 *   β1 = 0.85                              , f'c ≤ 30 MPa
 *   β1 = max(0.65, 0.85 − 0.008(f'c − 30)) , f'c > 30 MPa
 *
 *   εcu = 0.003 （混凝土极限压应变，NZS 3101 §7.4.2.7 规定的定值，不随强度
 *                 等级变化 —— 这与 GB 50010 随强度插值的 εcu 不同）
 *   εcu = 0.003 (constant ultimate concrete compressive strain per
 *                NZS 3101 §7.4.2.7 — unlike GB 50010 this does NOT vary with
 *                concrete grade)
 */
export function getConcreteParams(grade) {
  const g = CONCRETE_GRADES[grade];
  const fpc = g.fpc;

  const alpha1 = fpc <= 55 ? 0.85 : Math.max(0.75, 0.85 - 0.004 * (fpc - 55));
  const beta1  = fpc <= 30 ? 0.85 : Math.max(0.65, 0.85 - 0.008 * (fpc - 30));
  const epsCu  = 0.003;

  // 混凝土抗拉强度下限特征值 ft（NZS 3101 式 5-2，常重混凝土 λ=1）：
  // ft = 0.38·λ·√f'c —— 本工具目前不使用 ft 参与正截面承载力计算（与原代码
  // 一致，拉区混凝土强度按规范惯例忽略），仅保留供界面展示/后续扩展使用。
  // Lower-characteristic concrete tensile strength ft (NZS 3101 Eq 5-2, normal
  // density concrete λ=1): ft = 0.38·λ·√f'c. Not used in the flexural strength
  // calculation (concrete tension is conventionally ignored), kept only for
  // display / future use.
  const ft = 0.38 * Math.sqrt(fpc);

  return { fc: fpc, ft, alpha1, beta1, epsCu };
}
