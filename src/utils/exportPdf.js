// =====================================================================
// 前端 PDF 导出（jsPDF + jspdf-autotable），不使用截屏
// Front-end PDF export (jsPDF + jspdf-autotable), no screenshot capture
//  1) 参数 / 控制点：矢量文字 + autoTable / Parameters & control points: vector text + autoTable
//  2) 截面配筋图：jsPDF 绘图指令直接矢量绘制（含 X/Y 向箍筋肢与中部筋）
//     Section drawing: drawn directly with jsPDF vector primitives (incl. X/Y
//     stirrup legs and side bars)
//  3) 三维图：Plotly.toImage(format:'png', scale:2) 高清位图
//     3D chart: high-resolution raster image via Plotly.toImage(format:'png')
//
// ★ 修订说明 / Revision notes:
//   · 报告内容已全部翻译为英文，并改用新西兰规范（NZS 3101:2006）的术语与
//     公式说明。Report content fully translated to English, using NZS 3101:2006
//     terminology and formula references.
//   · 原代码为显示中文而加载外部中文字体（本地优先，失败则回退到一个第三方
//     CDN 上的 SimHei.ttf），存在两个问题：(a) 依赖一个非官方 CDN 镜像，
//     加载失败/被墙时报告仍可继续但会丢失中文；(b) 增加了不必要的网络请求与
//     复杂度。既然报告文字已全部为英文，不再需要中文字体，已将该逻辑整体移除，
//     直接使用 jsPDF 内置的 helvetica 字体，更快、更可靠。若未来需要在报告中
//     重新加入中文（例如中英双语报告），建议改为将字体文件随项目一起打包在
//     public/fonts/ 下本地引用，不要依赖第三方 CDN。
//     The original code fetched an external Chinese font (local file first,
//     falling back to a third-party CDN copy of SimHei.ttf) purely so Chinese
//     text could render. This had two issues: (a) it depended on an
//     unofficial CDN mirror — if that request failed or was blocked, the
//     report would silently lose its Chinese text; (b) it added avoidable
//     network calls and complexity. Since the report is now entirely in
//     English this logic has been removed and the built-in jsPDF Helvetica
//     font is used directly — faster and more reliable. If bilingual output
//     is needed again, bundle the font file locally under public/fonts/
//     rather than depending on a third-party CDN.
//   · 控制点表新增设计强度列 φN/φMx/φMy（φ=0.85），与网页端一致。
//     Added design (factored) strength columns φN/φMx/φMy (φ = 0.85) to the
//     control-point table, consistent with the web UI.
// =====================================================================
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import Plotly from 'plotly.js-dist-min';

const FONT = 'helvetica';

/* =====================================================================
   ★ 截面配筋图矢量绘制（支持 X/Y 向中部筋与分方向箍筋肢）
   ★ Vector drawing of the section reinforcement (supports X/Y side bars and
     per-direction stirrup legs)
   ===================================================================== */
function drawSectionPdf(doc, model, font, originX, originY) {
  const {
    b, h, cover, bars, dStirrup, legsX, legsY, sStirrup,
    dCorner, dSideX, dSideY, nSideX, nSideY,
    concrete, steelLong, steelStirrup, As, rho,
  } = model;

  const maxW = 44, maxH = 74;
  const s = Math.min(maxW / b, maxH / h);
  const x0 = originX + 8, y0 = originY + 10;
  const W = b * s, H = h * s;
  const px = x => x0 + (x + b / 2) * s;
  const py = y => y0 + (h / 2 - y) * s;

  const INK = [55, 71, 79], AUX = [144, 164, 174], STIR = [239, 108, 0];

  // 形心轴线 / centroidal axes
  doc.setDrawColor(...AUX); doc.setLineWidth(0.15);
  doc.setLineDashPattern([2.5, 1, 0.6, 1], 0);
  doc.line(px(-b / 2) - 2, py(0), px(b / 2) + 2, py(0));
  doc.line(px(0), py(h / 2) - 2, px(0), py(-h / 2) + 2);
  doc.setLineDashPattern([], 0);

  // 混凝土轮廓 / concrete outline
  doc.setDrawColor(...INK); doc.setLineWidth(0.5);
  doc.setFillColor(236, 239, 241);
  doc.rect(x0, y0, W, H, 'FD');

  // ---- 箍筋：外箍 + X向附加竖向肢 + Y向附加横向肢 ----
  // ---- Stirrups: outer perimeter + extra X-direction vertical legs + extra Y-direction horizontal legs ----
  doc.setDrawColor(...STIR);
  doc.setLineWidth(Math.max(dStirrup * s, 0.35));
  doc.rect(px(-b / 2 + cover), py(h / 2 - cover),
    (b - 2 * cover) * s, (h - 2 * cover) * s, 'S');
  const extraV = Math.max(0, legsX - 2);
  for (let i = 1; i <= extraV; i++) {
    const x = -b / 2 + cover + (b - 2 * cover) * i / (extraV + 1);
    doc.line(px(x), py(h / 2 - cover), px(x), py(-h / 2 + cover));
  }
  const extraH = Math.max(0, legsY - 2);
  for (let i = 1; i <= extraH; i++) {
    const y = -h / 2 + cover + (h - 2 * cover) * i / (extraH + 1);
    doc.line(px(-b / 2 + cover), py(y), px(b / 2 - cover), py(y));
  }

  // ---- 纵筋（角筋红 / X向蓝 / Y向绿） ----
  // ---- Longitudinal bars (corner = red / X-dir = blue / Y-dir = green) ----
  bars.forEach(bar => {
    const r = Math.max(bar.d / 2 * s, 0.5);
    doc.setFillColor(...(bar.type === 'corner' ? [198, 40, 40]
      : bar.type === 'sideX' ? [21, 101, 192] : [46, 125, 50]));
    doc.circle(px(bar.x), py(bar.y), r, 'F');
    doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.1);
    doc.circle(px(bar.x), py(bar.y), r, 'S');
  });

  // ---- 尺寸 / dimensions ----
  doc.setDrawColor(...AUX); doc.setLineWidth(0.15);
  doc.setLineDashPattern([1.2, 0.9], 0);
  doc.line(x0, y0, x0, y0 - 6);
  doc.line(x0 + W, y0, x0 + W, y0 - 6);
  doc.line(x0, y0, x0 - 6, y0);
  doc.line(x0, y0 + H, x0 - 6, y0 + H);
  doc.setLineDashPattern([], 0);

  const dimH = (xa, xb, y, label) => {
    doc.setDrawColor(...INK); doc.setLineWidth(0.2);
    doc.line(xa, y, xb, y);
    doc.line(xa - 1, y + 1, xa + 1, y - 1);
    doc.line(xb - 1, y + 1, xb + 1, y - 1);
    doc.setFont(font, 'normal'); doc.setFontSize(7.5); doc.setTextColor(...INK);
    doc.text(label, (xa + xb) / 2, y - 1.2, { align: 'center' });
  };
  const dimV = (ya, yb, x, label) => {
    doc.setDrawColor(...INK); doc.setLineWidth(0.2);
    doc.line(x, ya, x, yb);
    doc.line(x - 1, ya + 1, x + 1, ya - 1);
    doc.line(x - 1, yb + 1, x + 1, yb - 1);
    doc.setFont(font, 'normal'); doc.setFontSize(7.5); doc.setTextColor(...INK);
    doc.text(label, x - 1.5, (ya + yb) / 2, { align: 'center', angle: 90 });
  };
  dimH(x0, x0 + W, y0 - 5, `b = ${b}`);
  dimV(y0, y0 + H, x0 - 5, `h = ${h}`);

  // ---- 右侧引线注释 / right-hand leader annotations ----
  const noteX = x0 + W + 4, textX = noteX + 1.5;
  const leader = (fx, fy, ty) => {
    doc.setDrawColor(96, 125, 139); doc.setLineWidth(0.15);
    doc.line(fx, fy, noteX, ty);
    doc.setFillColor(96, 125, 139);
    doc.circle(fx, fy, 0.4, 'F');
  };
  doc.setFont(font, 'normal'); doc.setFontSize(6.8); doc.setTextColor(38, 50, 56);

  const cb = bars.find(p => p.type === 'corner' && p.x > 0 && p.y > 0);
  if (cb) { leader(px(cb.x), py(cb.y), y0 + 2); doc.text(`Corner bars 4D${dCorner}`, textX, y0 + 2.8); }
  const bx = bars.find(p => p.type === 'sideX' && p.y > 0);
  if (bx && nSideX > 0) { leader(px(bx.x), py(bx.y), y0 + 8); doc.text(`X-dir. side bars ${nSideX}D${dSideX}/edge`, textX, y0 + 8.8); }
  const by = bars.find(p => p.type === 'sideY' && p.x > 0);
  if (by && nSideY > 0) { leader(px(by.x), py(by.y), y0 + 14); doc.text(`Y-dir. side bars ${nSideY}D${dSideY}/edge`, textX, y0 + 14.8); }
  const stirTY = Math.max(py(0), y0 + 20);
  leader(px(b / 2 - cover), py(0), stirTY);
  doc.text(`Stirrups D${dStirrup}@${sStirrup} (${legsX}×${legsY} legs)`, textX, stirTY + 0.8);

  // ---- 材料信息（纵筋、箍筋强度分开） / material info (longitudinal & stirrup grades shown separately) ----
  doc.setFontSize(6.8); doc.setTextColor(38, 50, 56);
  const infoY = y0 + H + 5;
  doc.text(`Concrete: f'c = ${concrete.fc} MPa (${concrete.grade} MPa grade)`, x0 - 6, infoY);
  doc.text(`Longitudinal: Grade ${steelLong.grade} (fy=${steelLong.fy} MPa); Stirrups: Grade ${steelStirrup.grade} (fy=${steelStirrup.fy} MPa)`, x0 - 6, infoY + 4);
  doc.text(`As = ${As.toFixed(0)} mm², rho = ${rho.toFixed(2)}%, c = ${cover} mm`, x0 - 6, infoY + 8);

  doc.setLineDashPattern([], 0);
  doc.setTextColor(0, 0, 0); doc.setDrawColor(0, 0, 0);
  return infoY + 8;
}

/* ---------------- Plotly 高清 PNG / high-resolution PNG ---------------- */
async function getPlotlyPng(plotDiv, width, height, scale = 2) {
  const url = await Plotly.toImage(plotDiv, { format: 'png', width, height, scale });
  if (!url || url.indexOf('data:image/png') !== 0) throw new Error('Plotly PNG export failed');
  return url;
}

/* ============================ 主导出函数 / main export function ============================ */
export async function exportColumnPdf({ model, plotDiv }) {
  if (!plotDiv) throw new Error('Plotly chart is not ready yet');

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const font = FONT;
  doc.setFont(font, 'normal');

  /* ===== 第 1 页 / Page 1 ===== */
  doc.setFontSize(16);
  doc.text('Reinforced Concrete Column Section N-M Interaction Analysis Report', 105, 14, { align: 'center', maxWidth: 180 });
  doc.setFontSize(9); doc.setTextColor(120, 120, 120);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 105, 22, { align: 'center' });
  doc.setFontSize(8);
  doc.text('Design basis: NZS 3101:2006 "Concrete Structures Standard" (Inc Amendments) — AS/NZS 4671 reinforcing steel', 105, 26.5, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  // ---- 输入参数表 / input parameter table ----
  const inputRows = [
    ['Geometry', 'Width b',              `${model.b} mm`],
    ['Geometry', 'Depth h',              `${model.h} mm`],
    ['Geometry', 'Cover c',              `${model.cover} mm`],
    ['Material', "Concrete strength f'c", `${model.concrete.grade} MPa (f'c = ${model.concrete.fc} MPa)`],
    ['Material', 'Longitudinal steel grade', `${model.steelLong.grade} (fy = ${model.steelLong.fy} MPa)`],
    ['Material', 'Stirrup steel grade',   `${model.steelStirrup.grade} (fy = ${model.steelStirrup.fy} MPa)`],
    ['Longit. steel', 'Corner bars',        `4D${model.dCorner}`],
    ['Longit. steel', 'X-dir. side bars',   `${model.nSideX}D${model.dSideX}/edge (${model.nSideX * 2} bars total, along b)`],
    ['Longit. steel', 'Y-dir. side bars',   `${model.nSideY}D${model.dSideY}/edge (${model.nSideY * 2} bars total, along h)`],
    ['Longit. steel', 'Total bar count',    `${model.summary.nBars}`],
    ['Longit. steel', 'Steel area As',      `${model.As.toFixed(0)} mm²`],
    ['Longit. steel', 'Reinforcement ratio ρ', `${model.rho.toFixed(2)} %`],
    ['Stirrups', 'Leg count',            `X-dir. ${model.legsX} legs × Y-dir. ${model.legsY} legs`],
    ['Stirrups', 'Stirrup diameter',     `D${model.dStirrup}`],
    ['Stirrups', 'Stirrup spacing',      `${model.sStirrup} mm`],
  ];
  autoTable(doc, {
    startY: 32,
    head: [['Category', 'Parameter', 'Value']],
    body: inputRows,
    theme: 'grid',
    styles: { font, fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [21, 101, 192], font, fontStyle: 'bold' },
    margin: { left: 14, right: 106 },
    columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 34 } },
  });

  // ---- 截面矢量图 / vector section drawing ----
  const sectionBottom = drawSectionPdf(doc, model, font, 106, 32);
  doc.setFont(font, 'normal'); doc.setFontSize(9); doc.setTextColor(0, 0, 0);
  doc.text('Figure 1  Column section reinforcement (vector drawing)', 151, sectionBottom + 5, { align: 'center' });

  // ---- 控制点表（含设计强度 φN/φMx/φMy）/ control-point table (incl. design strength φN/φMx/φMy) ----
  const phi = model.phi ?? 0.85;
  const cpStartY = Math.max(doc.lastAutoTable.finalY + 8, sectionBottom + 12);
  autoTable(doc, {
    startY: cpStartY,
    head: [['Control point', 'N (kN)', 'Mx (kN·m)', 'My (kN·m)', 'φN (kN)', 'φMx (kN·m)', 'φMy (kN·m)', 'Description']],
    body: model.controlPoints.map(p =>
      [p.name, p.N.toFixed(1), p.Mx.toFixed(1), p.My.toFixed(1),
       (p.phiN ?? p.N * phi).toFixed(1), (p.phiMx ?? p.Mx * phi).toFixed(1), (p.phiMy ?? p.My * phi).toFixed(1),
       p.desc]),
    theme: 'striped',
    styles: { font, fontSize: 7.2, cellPadding: 1.3 },
    headStyles: { fillColor: [21, 101, 192], font, fontStyle: 'bold', fontSize: 7.2 },
    margin: { left: 14, right: 14 },
    columnStyles: {
      1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' },
      4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' },
    },
  });
  doc.setFontSize(7.5); doc.setTextColor(110, 110, 110);
  doc.text('Sn = nominal strength (not factored); phi*Sn = design strength, phi = 0.85 per NZS 3101 Sec. 2.3.2.2. Design check: S* <= phi*Sn.',
    14, (doc.lastAutoTable.finalY || cpStartY) + 4.5);
  doc.setTextColor(0, 0, 0);

  /* ===== 第 2 页：三维图 + 说明 / Page 2: 3D chart + notes ===== */
  doc.addPage();
  doc.setFont(font, 'normal'); doc.setFontSize(14);
  doc.text('3D N-M Interaction Surface (Biaxial Bending)', 105, 16, { align: 'center' });

  const pngUrl = await getPlotlyPng(plotDiv, 900, 580, 2);
  const imgW = 180, imgH = imgW * 580 / 900;
  doc.addImage(pngUrl, 'PNG', 15, 24, imgW, imgH, undefined, 'FAST');
  doc.setFontSize(9);
  doc.text('Figure 2  N-Mx-My capacity interaction surface (rendered via Plotly WebGL, exported as a high-resolution raster image)',
    105, 24 + imgH + 6, { align: 'center', maxWidth: 180 });

  const notes = [
    'Calculation notes:',
    "1. Based on the plane-sections assumption and the NZS 3101:2006 Sec. 7.4.2.7 equivalent rectangular",
    "   stress block: stress = alpha1*f'c over a depth a = beta1*xn, with ultimate concrete strain",
    "   epsilon_cu = 0.003. alpha1 = 0.85 (f'c <= 55 MPa) or 0.85-0.004(f'c-55) >= 0.75 (f'c > 55 MPa);",
    "   beta1 = 0.85 (f'c <= 30 MPa) or 0.85-0.008(f'c-30) >= 0.65 (f'c > 30 MPa).",
    '2. Longitudinal bars use an idealised elastic-perfectly-plastic stress-strain model (yield at fy),',
    '   Es = 200,000 MPa; stirrups are not included in the flexural/axial strength calculation.',
    "3. Pure axial compression N0 = alpha1*f'c*(Ag - As) + fy*As, using the NET concrete area (Ag - As).",
    '4. All values in the tables and charts are NOMINAL strengths Sn (not yet multiplied by the strength',
    '   reduction factor). The design strength is phi*Sn, phi = 0.85 for flexure with or without axial load',
    '   (NZS 3101 Sec. 2.3.2.2); factored values phi*N, phi*Mx, phi*My are listed alongside the nominal',
    '   values in the control-point table for convenience.',
    '5. The biaxial interaction surface is approximated, at each axial load level, by the linear (Bresler-type)',
    '   contour Mx/Mux + My/Muy = 1. This is a conservative approximation, not an exact section integration;',
    '   verify governing load cases against a full biaxial section analysis where required.',
    '6. This tool covers flexure-axial (N-M) capacity only. Shear strength, stirrup/tie spacing and',
    '   confinement detailing, and any capacity design / ductility requirements must be checked separately',
    '   against NZS 3101 Sections 7, 8 and 10 as applicable.',
  ];
  doc.setFontSize(8.3);
  let ny = 24 + imgH + 15;
  notes.forEach(line => {
    doc.text(doc.splitTextToSize(line, 182), 15, ny);
    ny += 4.6;
  });

  /* ===== 页脚 / footer ===== */
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont(font, 'normal'); doc.setFontSize(8); doc.setTextColor(150, 150, 150);
    doc.text(`Page ${i} / ${pages}`, 196, 291, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }

  doc.save(`RC_Column_NM_Report_${model.b}x${model.h}.pdf`);
}
