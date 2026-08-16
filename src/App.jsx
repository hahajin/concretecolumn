import React, { useMemo, useState, useCallback, useRef } from 'react';
import {
  AppBar, Toolbar, Typography, Container, Grid, Box,
  Button, CircularProgress,
} from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ColumnInputs from './components/ColumnInputs';
import SectionSVG from './components/SectionSVG';
import NMChart3D from './components/NMChart3D';
import ControlPointsTable from './components/ControlPointsTable';
import { getConcreteParams, STEEL_GRADES, ES, PHI_FLEXURE_AXIAL } from './utils/materials';
import { buildBars, computeUniaxial, buildBiaxialSurface } from './utils/section';
import { exportColumnPdf } from './utils/exportPdf';

// ★ 新默认参数：纵筋/箍筋强度分开；X、Y 向中部筋与肢数分开
// ★ New default parameters: longitudinal/stirrup grades separated; X/Y side
//   bar counts and stirrup leg counts separated per direction.
//
// ★ 已修订为新西兰常用配置 / REVISED to typical New Zealand practice:
//   concreteGrade '30' → f'c = 30 MPa (NZS 3104 standard grade)
//   steelGradeLong/Stirrup '500E' → AS/NZS 4671 Grade 500E, the grade most
//   commonly stocked in New Zealand.
const DEFAULTS = {
  b: '400', h: '600', cover: '40', // 保护层默认改为 40mm，符合 NZS 3101 表 3.6 常见暴露等级 B1/B2 的典型取值（用户仍可按实际耐久性等级调整）
                                     // cover default changed to 40mm, a typical
                                     // value for NZS 3101 Table 3.6 exposure
                                     // classifications B1/B2 (adjust per actual
                                     // durability requirements)
  concreteGrade: '30',
  steelGradeLong: '500E',     // 纵向钢筋强度等级 / longitudinal reinforcement grade
  steelGradeStirrup: '500E',  // 箍筋强度等级 / stirrup (tie) grade
  dCorner: 20,
  nSideX: '2', dSideX: 16,      // X 向中部筋（上、下边） / X-direction side bars (top/bottom)
  nSideY: '2', dSideY: 16,      // Y 向中部筋（左、右边） / Y-direction side bars (left/right)
  dStirrup: 10, sStirrup: '150',
  legsX: 4, legsY: 4,           // 箍筋肢数分方向 / stirrup leg counts per direction
};

export default function App() {
  const [params, setParams] = useState(DEFAULTS);
  const setParam = useCallback((k, v) => setParams(p => ({ ...p, [k]: v })), []);

  const [exporting, setExporting] = useState(false);
  const svgRef = useRef(null);
  const plotGdRef = useRef(null);

  // ======================= 核心计算 / Core calculation =======================
  const model = useMemo(() => {
    const num = (v, d) => { const x = parseFloat(v); return Number.isFinite(x) ? x : d; };
    const clamp = (x, a, c) => Math.min(Math.max(x, a), c);

    const b = clamp(num(params.b, 400), 100, 3000);
    const h = clamp(num(params.h, 600), 100, 3000);
    const cover = clamp(num(params.cover, 40), 10, 120);
    const nSideX = Math.round(clamp(num(params.nSideX, 0), 0, 10));
    const nSideY = Math.round(clamp(num(params.nSideY, 0), 0, 10));
    const sStirrup = clamp(num(params.sStirrup, 150), 20, 500);
    const { dCorner, dSideX, dSideY, dStirrup, legsX, legsY } = params;

    // ---- 材料：混凝土 + 纵筋 + 箍筋（强度分开） ----
    // ---- Materials: concrete + longitudinal steel + stirrup steel (grades kept separate) ----
    const concrete = { grade: params.concreteGrade, ...getConcreteParams(params.concreteGrade) };
    const steelLong = { grade: params.steelGradeLong, fy: STEEL_GRADES[params.steelGradeLong].fy, Es: ES };
    const steelStirrup = { grade: params.steelGradeStirrup, fy: STEEL_GRADES[params.steelGradeStirrup].fy };

    // ---- 配筋布置（N-M 计算只用纵筋强度；箍筋强度仅用于展示） ----
    // ---- Bar layout (only longitudinal steel strength feeds the N-M calc; stirrup grade is for display only) ----
    const bars = buildBars(b, h, cover, dStirrup, dCorner, nSideX, dSideX, nSideY, dSideY);
    const As = bars.reduce((acc, br) => acc + br.A, 0);
    const rho = As / (b * h) * 100;

    // ---- 两个方向的单向 N-M 曲线（名义强度 Sn，未乘 φ） ----
    // ---- Uniaxial N-M curves in both directions (nominal strength Sn, not factored by φ) ----
    const rawX = computeUniaxial({ b, h, bars, concrete, steel: steelLong }, 'x');
    const rawY = computeUniaxial({ b, h, bars, concrete, steel: steelLong }, 'y');

    const toK = pts => pts.map(p => ({ N: p.N / 1e3, M: p.M / 1e6 }));
    const ptsX = toK(rawX.points).concat([{ N: rawX.N0 / 1e3, M: 0 }]);
    const ptsY = toK(rawY.points).concat([{ N: rawY.N0 / 1e3, M: 0 }]);
    const N0 = rawX.N0 / 1e3;

    const surface = buildBiaxialSurface(ptsX, ptsY, N0);

    const K_N = 1e-3, K_M = 1e-6;
    // 控制点：名义强度 Sn；同时给出 φ·Sn 设计强度（NZS 3101 §2.3.2.2，压弯 φ=0.85）
    // Control points: nominal strength Sn, plus the design strength φ·Sn
    // (NZS 3101 §2.3.2.2, φ = 0.85 for flexure with/without axial load)
    const PHI = PHI_FLEXURE_AXIAL;
    const controlPoints = [
      { name: 'Pure axial compression', N: N0, Mx: 0, My: 0, short: 'N0',
        desc: "N0 = α1·f'c·(Ag−As) + fy·As (nominal Sn; not yet multiplied by φ)" },
      { name: 'Balanced failure (x-axis)', N: rawX.balanced.N * K_N, Mx: rawX.balanced.M * K_M, My: 0,
        short: 'Bal.(x)', desc: 'Tension steel yields simultaneously with concrete reaching εcu = 0.003' },
      { name: 'Balanced failure (y-axis)', N: rawY.balanced.N * K_N, Mx: 0, My: rawY.balanced.M * K_M,
        short: 'Bal.(y)', desc: 'Same as above, about the y-axis' },
      { name: 'Peak moment (x-axis)', N: rawX.maxMoment.N * K_N, Mx: rawX.maxMoment.M * K_M, My: 0,
        short: 'Mmax(x)', desc: 'Peak uniaxial flexural capacity' },
      { name: 'Peak moment (y-axis)', N: rawY.maxMoment.N * K_N, Mx: 0, My: rawY.maxMoment.M * K_M,
        short: 'Mmax(y)', desc: 'Same as above, about the y-axis' },
      { name: 'Pure bending (x-axis)', N: 0, Mx: rawX.pureBending.M * K_M, My: 0,
        short: 'Flex.(x)', desc: 'Flexural capacity at N = 0' },
      { name: 'Pure bending (y-axis)', N: 0, Mx: 0, My: rawY.pureBending.M * K_M,
        short: 'Flex.(y)', desc: 'Same as above, about the y-axis' },
      { name: 'Pure axial tension', N: rawX.tension.N * K_N, Mx: 0, My: 0,
        short: 'Tension', desc: 'Nt = −fy·As' },
    ].map(p => ({ ...p, phiN: p.N * PHI, phiMx: p.Mx * PHI, phiMy: p.My * PHI }));

    // ---- 警告（分方向检查净距）—— 已改为 NZS 3101 限值 ----
    // ---- Warnings (spacing checked per direction) — thresholds updated to NZS 3101 ----
    const warnings = [];
    if (2 * (cover + dStirrup + dCorner) >= Math.min(b, h))
      warnings.push('Section is too small for the specified bar layout — increase the section size or reduce cover.');
    // NZS 3101 §10.3.8.1: column longitudinal reinforcement ratio 0.8% ≤ ρ ≤ 8%
    // (max often limited to 4% in practice at lap-splice regions).
    if (rho > 8)
      warnings.push(`Reinforcement ratio ρ = ${rho.toFixed(2)}% exceeds the NZS 3101 §10.3.8.1 maximum of 8%.`);
    else if (rho > 4)
      warnings.push(`Reinforcement ratio ρ = ${rho.toFixed(2)}% exceeds 4% — check bar congestion at lap splices (NZS 3101 §10.3.8.1 commentary).`);
    if (rho < 0.8)
      warnings.push(`Reinforcement ratio ρ = ${rho.toFixed(2)}% is below the NZS 3101 §10.3.8.1 minimum of 0.8% for columns.`);
    // NZS 3101 §8.3.2: clear spacing between parallel bars ≥ bar diameter and
    // ≥ 25 mm (also ≥ 1.4× max aggregate size, not checked here).
    if (nSideX > 0) {
      const gap = (b - 2 * cover - 2 * dStirrup - dCorner) / (nSideX + 1) - (dCorner + dSideX) / 2;
      if (gap < 25) warnings.push(`Clear spacing of longitudinal bars along the b edge (X-direction) is approx. ${Math.max(gap, 0).toFixed(0)} mm < 25 mm (NZS 3101 §8.3.2) — adjust layout.`);
    }
    if (nSideY > 0) {
      const gap = (h - 2 * cover - 2 * dStirrup - dCorner) / (nSideY + 1) - (dCorner + dSideY) / 2;
      if (gap < 25) warnings.push(`Clear spacing of longitudinal bars along the h edge (Y-direction) is approx. ${Math.max(gap, 0).toFixed(0)} mm < 25 mm (NZS 3101 §8.3.2) — adjust layout.`);
    }

    return {
      b, h, cover, bars, nSideX, nSideY, dCorner, dSideX, dSideY,
      dStirrup, legsX, legsY, sStirrup,
      concrete, steelLong, steelStirrup, As, rho, phi: PHI,
      ptsX, ptsY, surface, controlPoints, warnings,
      summary: { nBars: bars.length, As: As.toFixed(0), rho: rho.toFixed(2), rhoNum: rho },
    };
  }, [params]);

  // ======================= PDF 导出 / PDF export =======================
  const handleExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await exportColumnPdf({ model, plotDiv: plotGdRef.current });
    } catch (e) {
      console.error(e);
      alert('PDF generation failed: ' + e.message);
    } finally {
      setExporting(false);
    }
  }, [exporting, model]);

  const handleGdReady = useCallback(gd => { plotGdRef.current = gd; }, []);

  // ======================= 布局 / Layout =======================
  return (
    <Box sx={{ bgcolor: '#f5f6fa', minHeight: '100vh', pb: 4 }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Reinforced Concrete Column Section Design — N-M Interaction Analysis
          </Typography>
          <Typography variant="body2" sx={{ mr: 3, opacity: 0.8 }}>
            NZS 3101:2006 · Material UI · SVG · Plotly.js
          </Typography>
          <Button color="inherit" variant="outlined"
            startIcon={exporting ? <CircularProgress size={16} color="inherit" /> : <PictureAsPdfIcon />}
            onClick={handleExport} disabled={exporting}>
            {exporting ? 'Generating…' : 'Export PDF'}
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <ColumnInputs params={params} setParam={setParam}
              summary={model.summary} warnings={model.warnings} />
          </Grid>

          <Grid item xs={12} md={4}>
            <SectionSVG
              svgRef={svgRef}
              b={model.b} h={model.h} cover={model.cover} bars={model.bars}
              dStirrup={model.dStirrup} legsX={model.legsX} legsY={model.legsY}
              sStirrup={model.sStirrup}
              dCorner={model.dCorner} dSideX={model.dSideX} dSideY={model.dSideY}
              nSideX={model.nSideX} nSideY={model.nSideY}
              concreteGrade={model.concrete.grade} fc={model.concrete.fc}
              steelLongGrade={model.steelLong.grade} fyLong={model.steelLong.fy}
              steelStirGrade={model.steelStirrup.grade} fyStir={model.steelStirrup.fy}
              As={model.As.toFixed(0)} rho={model.rho.toFixed(2)} />
          </Grid>

          <Grid item xs={12} md={5}>
            <NMChart3D surface={model.surface}
              curveX={model.ptsX} curveY={model.ptsY}
              controlPoints={model.controlPoints}
              onGdReady={handleGdReady} />
          </Grid>

          <Grid item xs={12}>
            <ControlPointsTable controlPoints={model.controlPoints} phi={model.phi} />
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
