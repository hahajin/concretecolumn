// =====================================================================
// 截面几何与 N-M 交互曲线计算（形心为原点，x 沿 b，y 沿 h，单位 mm）
// Section geometry & N-M interaction curve computation
// (origin at centroid, x along b, y along h, units in mm)
//
// ★ 修订说明 / Revision notes（详见文件末尾"发现的问题与修复"）：
//   · 计算方法本身（平截面假定 + 等效矩形应力图 + 数值积分求 N-M 曲线）与规范
//     无关，NZS 3101 与 GB 50010 采用相同原理，故算法结构保持不变；仅将材料
//     侧输入换成 NZS 3101 的 f'c / α1 / β1 / εcu（见 materials.js）。
//     The calculation method itself (plane-sections assumption + equivalent
//     rectangular stress block + numerical N-M curve tracing) is code-agnostic —
//     NZS 3101 and GB 50010 share the same underlying mechanics — so the
//     algorithm is unchanged; only the material inputs now come from NZS 3101
//     (f'c / α1 / β1 / εcu, see materials.js).
//   · 已修复轴心受压承载力 N0 的截面面积取值 bug：原代码用 fc·b·h（混凝土
//     毛截面），未扣除钢筋所占面积，导致 N0 偏大。已改为 fc·(Ag−As)+fy·As，
//     与 NZS 3101 §10.3.4.2 Nn,max 的定义一致（净混凝土面积）。
//     Fixed a bug in the axial compression capacity N0: the original code used
//     fc·b·h (gross concrete area) without deducting the steel area, which
//     over-estimates N0. Changed to fc·(Ag−As)+fy·As, consistent with the
//     NZS 3101 §10.3.4.2 definition of Nn,max (net concrete area).
// =====================================================================
import { ES } from './materials';

export const barArea = d => Math.PI * d * d / 4;

/**
 * 生成纵筋坐标列表 / Generate longitudinal bar coordinate list
 * @param dCorner/nSideX/dSideX  角筋直径；X向中部筋（上、下边，沿 b 边分布）根数/直径
 *                                Corner bar diameter; X-direction side bars (top/bottom
 *                                edges, distributed along the b edge): count/diameter
 * @param nSideY/dSideY          Y向中部筋（左、右边，沿 h 边分布）根数/直径
 *                                Y-direction side bars (left/right edges, distributed
 *                                along the h edge): count/diameter
 * @returns [{x, y, d, A, type:'corner'|'sideX'|'sideY'}]
 */
export function buildBars(b, h, cover, dStirrup, dCorner, nSideX, dSideX, nSideY, dSideY) {
  // 各类钢筋中心到混凝土边缘的距离 = 保护层 + 箍筋直径 + 自身半径
  // Distance from bar centre to concrete edge = cover + stirrup diameter + bar radius
  const offCorner = cover + dStirrup + dCorner / 2;
  const offX = cover + dStirrup + dSideX / 2;
  const offY = cover + dStirrup + dSideY / 2;
  const cx = Math.max(b / 2 - offCorner, 0); // 角筋 x 坐标绝对值 / corner bar |x|
  const cy = Math.max(h / 2 - offCorner, 0); // 角筋 y 坐标绝对值 / corner bar |y|

  const mk = (x, y, d, type) => ({ x, y, d, A: barArea(d), type });
  // ---- 4 根角筋 / 4 corner bars ----
  const bars = [
    mk(-cx, -cy, dCorner, 'corner'),
    mk( cx, -cy, dCorner, 'corner'),
    mk( cx,  cy, dCorner, 'corner'),
    mk(-cx,  cy, dCorner, 'corner'),
  ];

  // ---- X 向中部筋：上、下两边，沿 b 边在角筋之间均匀分布 ----
  // X-direction side bars: top/bottom edges, evenly spaced along b between corners
  if (nSideX > 0) {
    const yy = Math.max(h / 2 - offX, 0);
    for (let i = 1; i <= nSideX; i++) {
      const tx = -cx + (2 * cx) * i / (nSideX + 1);
      bars.push(mk(tx, -yy, dSideX, 'sideX')); // 下边 / bottom edge
      bars.push(mk(tx,  yy, dSideX, 'sideX')); // 上边 / top edge
    }
  }

  // ---- Y 向中部筋：左、右两边，沿 h 边在角筋之间均匀分布 ----
  // Y-direction side bars: left/right edges, evenly spaced along h between corners
  if (nSideY > 0) {
    const xx = Math.max(b / 2 - offY, 0);
    for (let i = 1; i <= nSideY; i++) {
      const ty = -cy + (2 * cy) * i / (nSideY + 1);
      bars.push(mk(-xx, ty, dSideY, 'sideY')); // 左边 / left edge
      bars.push(mk( xx, ty, dSideY, 'sideY')); // 右边 / right edge
    }
  }
  return bars;
}

/**
 * 单向偏心受压 N-M 曲线（平截面假定 + 等效矩形应力图），纵筋取各自 fy
 * Uniaxial N-M interaction curve (plane-sections assumption + NZS 3101
 * §7.4.2.7 equivalent rectangular stress block); each bar uses its own fy.
 * 返回值为"名义强度"Sn（未乘 φ），与 NZS 3101 术语一致。
 * Returned values are NOMINAL strengths Sn (not multiplied by φ), consistent
 * with NZS 3101 terminology.
 */
export function computeUniaxial({ b, h, bars, concrete, steel }, axis) {
  const { fc, alpha1, beta1, epsCu } = concrete; // fc here = f'c (specified strength)
  const { fy } = steel;                        // 纵向钢筋屈服强度 / longitudinal steel fy
  const width = axis === 'x' ? b : h;          // 受压区宽度 / compression zone width
  const half  = axis === 'x' ? h / 2 : b / 2;  // 受压方向半高 / half-depth in bending direction
  const coord = bar => axis === 'x' ? bar.y : bar.x;

  const evalAt = xn => {
    const a  = Math.min(beta1 * xn, 2 * half);
    const Cc = alpha1 * fc * width * a;
    let N = Cc;
    let M = Cc * (half - a / 2);
    for (const bar of bars) {
      const d   = half - coord(bar);
      const eps = epsCu * (xn - d) / xn;
      const sig = Math.max(-fy, Math.min(fy, ES * eps));
      N += sig * bar.A;
      M += sig * bar.A * coord(bar);
    }
    return { N, M };
  };

  const minC  = Math.min(...bars.map(coord));
  const dMax  = half - minC;
  const xnBal = epsCu / (epsCu + fy / ES) * dMax;

  // 中和轴对数采样 + 界限点加密 / log-spaced sampling of neutral-axis depth,
  // densified near the balanced-failure point
  const xs = [];
  const nPts = 100;
  const x0 = 0.04 * dMax, x1 = 3.0 * dMax;
  for (let i = 0; i < nPts; i++) xs.push(x0 * Math.pow(x1 / x0, i / (nPts - 1)));
  xs.push(xnBal * 0.99, xnBal, xnBal * 1.01);
  xs.sort((p, q) => p - q);
  const points = xs.map(xn => ({ xn, ...evalAt(xn) }));

  const AsTotal  = bars.reduce((s, br) => s + br.A, 0);
  // 轴心受压名义强度 N0（净混凝土面积，已扣除钢筋面积）：
  // Nominal axial (pure) compression strength N0, using NET concrete area
  // (gross area minus steel area) — see NZS 3101 §10.3.4.2, Nn,max definition:
  //   N0 = α1·f'c·(Ag − As) + fy·As
  const Ag = b * h;
  const N0 = alpha1 * fc * (Ag - AsTotal) + fy * AsTotal;
  const balanced = { xn: xnBal, ...evalAt(xnBal) };

  // 纯弯点（N=0 内插） / pure-bending point (interpolated at N = 0)
  let pureBending = { N: 0, M: 0 };
  for (let i = 0; i < points.length - 1; i++) {
    const p = points[i], q = points[i + 1];
    if (p.N <= 0 && q.N >= 0 && p.N !== q.N) {
      const t = (0 - p.N) / (q.N - p.N);
      pureBending = { N: 0, M: p.M + t * (q.M - p.M) };
      break;
    }
  }
  const maxMoment = points.reduce((m, p) => (p.M > m.M ? p : m), points[0]);

  return {
    points, N0, balanced, pureBending, maxMoment, dMax, xnBal,
    tension: { N: -fy * AsTotal, M: 0 },
  };
}

/** 单向曲线上轴力 Nt 对应的最大弯矩（包络值） */
/** Maximum moment (envelope) on the uniaxial curve at a given axial load Nt */
export function momentAtN(points, Nt) {
  let best = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], p2 = points[i + 1];
    if ((a.N - Nt) * (p2.N - Nt) <= 0 && a.N !== p2.N) {
      const t = (Nt - a.N) / (p2.N - a.N);
      const M = a.M + t * (p2.M - a.M);
      if (M > best) best = M;
    }
  }
  return best;
}

/**
 * 双向偏压曲面：各轴力水平下 Mx/Mux + My/Muy = 1 线性轮廓
 * Biaxial bending capacity surface: at each axial load level, approximated by
 * the linear (Bresler-type) contour Mx/Mux + My/Muy = 1.
 * 注：这是偏于保守的近似（真实双向压弯曲面为外凸曲线），并非精确的截面积分
 * 结果；如需更精确的双向压弯承载力，应逐点对中和轴倾角做完整截面积分。
 * Note: this is a CONSERVATIVE approximation (the true biaxial surface bulges
 * outward/convex relative to this straight line), not an exact section
 * integration; for a precise biaxial capacity, integrate the section for each
 * neutral-axis inclination angle.
 */
export function buildBiaxialSurface(ptsX, ptsY, N0, nLevel = 36, nArc = 25) {
  const X = [], Y = [], Z = [];
  for (let k = 0; k < nLevel; k++) {
    const N  = N0 * k / (nLevel - 1);
    const Mx = momentAtN(ptsX, N);
    const My = momentAtN(ptsY, N);
    const rowX = [], rowY = [], rowZ = [];
    for (let j = 0; j < nArc; j++) {
      const t = j / (nArc - 1);
      rowX.push(Mx * (1 - t));
      rowY.push(My * t);
      rowZ.push(N);
    }
    X.push(rowX); Y.push(rowY); Z.push(rowZ);
  }
  return { X, Y, Z };
}

// =====================================================================
// 发现的问题与修复摘要 / Summary of issues found & fixed in this file:
//
// 1. [已修复 / Fixed] N0（轴心受压名义强度）原用毛截面 fc·b·h，未扣除钢筋
//    面积，偏于不安全（略微高估承载力）。已改为净截面 α1·f'c·(Ag−As)+fy·As。
//    N0 previously used gross area fc·b·h without deducting steel area,
//    slightly un-conservative (over-estimates capacity). Fixed to use net
//    area α1·f'c·(Ag−As)+fy·As.
//
// 2. [建议 / Suggestion — not changed, flagged for awareness] 双向压弯曲面
//    仍采用线性 Bresler 近似（Mx/Mux+My/Muy=1），对于低轴力比或非对称配筋
//    情况可能偏保守或偏不保守，建议在正式设计中以完整截面积分（旋转中和轴）
//    复核关键工况。 The biaxial surface still uses the linear Bresler-type
//    approximation; for low axial-load ratios or asymmetric reinforcement this
//    can be non-conservative or overly conservative. For final design, verify
//    critical load cases with a full section integration (rotating neutral
//    axis) rather than relying solely on this linear interaction surface.
//
// 3. [建议 / Suggestion — not changed] 箍筋（横向钢筋）目前仅用于绘图展示，
//    未参与承载力计算，也未做 NZS 3101 §10.3.10 剪力设计或 §10.4（延性构件）
//    约束箍筋间距/体积配箍率校核。本工具仅为 N-M 压弯承载力工具，箍筋设计
//    （抗剪、约束、抗震延性详图）须按 NZS 3101 第 7、10 章另行校核。
//    Stirrups/ties are currently used for drawing only and are not checked for
//    shear strength (§10.3.10) or ductile detailing (spacing / volumetric
//    ratio, §10.4). This tool only covers flexure–axial (N-M) capacity; shear
//    design and seismic detailing of transverse reinforcement must be verified
//    separately against NZS 3101 Sections 7 and 10.
// =====================================================================
