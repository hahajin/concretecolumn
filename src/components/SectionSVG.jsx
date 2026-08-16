import React from 'react';
import { Paper, Typography } from '@mui/material';

/* =====================================================================
   SVG 柱截面配筋图 / SVG column section reinforcement drawing
   - 角筋（红）/ X向中部筋（蓝，上下边）/ Y向中部筋（绿，左右边）
   - Corner bars (red) / X-direction side bars (blue, top+bottom) /
     Y-direction side bars (green, left+right)
   - 箍筋：外箍 + X向附加竖向肢(legsX-2) + Y向附加横向肢(legsY-2)
   - Stirrups: outer perimeter tie + extra X-direction vertical legs
     (legsX-2) + extra Y-direction horizontal legs (legsY-2)
   ===================================================================== */

function DimH({ x1, x2, y, label, extY }) {
  return (
    <g>
      {extY !== undefined && (
        <>
          <line x1={x1} y1={extY} x2={x1} y2={y} stroke="#90a4ae" strokeWidth="1" strokeDasharray="4 3" />
          <line x1={x2} y1={extY} x2={x2} y2={y} stroke="#90a4ae" strokeWidth="1" strokeDasharray="4 3" />
        </>
      )}
      <line x1={x1} y1={y} x2={x2} y2={y} stroke="#37474f" strokeWidth="1.2" />
      <line x1={x1 - 4} y1={y + 4} x2={x1 + 4} y2={y - 4} stroke="#37474f" strokeWidth="1.5" />
      <line x1={x2 - 4} y1={y + 4} x2={x2 + 4} y2={y - 4} stroke="#37474f" strokeWidth="1.5" />
      <text x={(x1 + x2) / 2} y={y - 8} textAnchor="middle" fontSize="14" fill="#263238">{label}</text>
    </g>
  );
}

function DimV({ y1, y2, x, label, extX }) {
  const mid = (y1 + y2) / 2;
  return (
    <g>
      {extX !== undefined && (
        <>
          <line x1={extX} y1={y1} x2={x} y2={y1} stroke="#90a4ae" strokeWidth="1" strokeDasharray="4 3" />
          <line x1={extX} y1={y2} x2={x} y2={y2} stroke="#90a4ae" strokeWidth="1" strokeDasharray="4 3" />
        </>
      )}
      <line x1={x} y1={y1} x2={x} y2={y2} stroke="#37474f" strokeWidth="1.2" />
      <line x1={x - 4} y1={y1 + 4} x2={x + 4} y2={y1 - 4} stroke="#37474f" strokeWidth="1.5" />
      <line x1={x - 4} y1={y2 + 4} x2={x + 4} y2={y2 - 4} stroke="#37474f" strokeWidth="1.5" />
      <text x={x - 10} y={mid} textAnchor="middle" fontSize="14" fill="#263238"
        transform={`rotate(-90 ${x - 10} ${mid})`}>{label}</text>
    </g>
  );
}

function Leader({ x1, y1, x2, y2, text, anchor = 'start' }) {
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#607d8b" strokeWidth="1" />
      <circle cx={x1} cy={y1} r="2" fill="#607d8b" />
      <text x={x2 + (anchor === 'start' ? 4 : -4)} y={y2 + 4} fontSize="13"
        fill="#263238" textAnchor={anchor}>{text}</text>
    </g>
  );
}

export default function SectionSVG(props) {
  const {
    svgRef, b, h, cover, bars, dStirrup, legsX, legsY, sStirrup,
    dCorner, dSideX, dSideY, nSideX, nSideY,
    concreteGrade, fc,
    steelLongGrade, fyLong,        // 纵筋等级/强度 / longitudinal grade & strength
    steelStirGrade, fyStir,        // 箍筋等级/强度 / stirrup grade & strength
    As, rho,
  } = props;

  // ---- 画布与比例 / canvas & scale ----
  const W = 640, H = 660;
  const MG = { l: 110, r: 180, t: 80, b: 180 };
  const s  = Math.min((W - MG.l - MG.r) / b, (H - MG.t - MG.b) / h);
  const ox = MG.l, oy = MG.t;
  const sx = x => ox + (x + b / 2) * s;
  const sy = y => oy + (h / 2 - y) * s;

  // ---- 箍筋肢：外箍 2 肢/方向，附加肢均匀分布 ----
  // ---- Stirrup legs: outer perimeter = 2 legs/direction, extra legs evenly spaced ----
  const extraV = Math.max(0, legsX - 2); // 附加竖向肢（沿 X 分布）/ extra vertical legs (spaced along X)
  const vLegXs = [];
  for (let i = 1; i <= extraV; i++)
    vLegXs.push(-b / 2 + cover + (b - 2 * cover) * i / (extraV + 1));
  const extraH = Math.max(0, legsY - 2); // 附加横向肢（沿 Y 分布）/ extra horizontal legs (spaced along Y)
  const hLegYs = [];
  for (let i = 1; i <= extraH; i++)
    hLegYs.push(-h / 2 + cover + (h - 2 * cover) * i / (extraH + 1));
  const sw = Math.max(dStirrup * s, 1.5);

  // ---- 引线注释锚点 / leader-line anchor points ----
  const cornerBar = bars.find(p => p.type === 'corner' && p.x > 0 && p.y > 0);
  const barX = bars.find(p => p.type === 'sideX' && p.y > 0); // 上边第一根 X 向筋 / first X-dir bar on top edge
  const barY = bars.find(p => p.type === 'sideY' && p.x > 0); // 右边第一根 Y 向筋 / first Y-dir bar on right edge
  const noteX = W - 175;
  const stirY = Math.max(sy(0), oy + 104);

  const fillColor = t => t === 'corner' ? '#c62828' : t === 'sideX' ? '#1565c0' : '#2e7d32';

  return (
    <Paper sx={{ p: 1.5, height: '100%' }}>
      <Typography variant="h6">Section Reinforcement Drawing (SVG)</Typography>
      <Typography variant="caption" color="text.secondary">
        b × h = {b} × {h} mm, cover {cover} mm, stirrups {legsX}×{legsY} legs
      </Typography>

      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}>
        {/* 形心定位轴线 / centroidal axes */}
        <line x1={sx(-b / 2) - 10} y1={sy(0)} x2={sx(b / 2) + 10} y2={sy(0)}
          stroke="#b0bec5" strokeWidth="1" strokeDasharray="10 4 2 4" />
        <line x1={sx(0)} y1={sy(h / 2) - 10} x2={sx(0)} y2={sy(-h / 2) + 10}
          stroke="#b0bec5" strokeWidth="1" strokeDasharray="10 4 2 4" />

        {/* 混凝土轮廓 / concrete outline */}
        <rect x={sx(-b / 2)} y={sy(h / 2)} width={b * s} height={h * s}
          fill="#eceff1" stroke="#37474f" strokeWidth="2" />

        {/* 外圈箍筋 / outer perimeter stirrup */}
        <rect x={sx(-b / 2 + cover)} y={sy(h / 2 - cover)}
          width={(b - 2 * cover) * s} height={(h - 2 * cover) * s}
          fill="none" stroke="#ef6c00" strokeWidth={sw} />

        {/* X 向附加竖向肢 / extra X-direction vertical legs */}
        {vLegXs.map((x, i) => (
          <line key={`v${i}`} x1={sx(x)} y1={sy(h / 2 - cover)} x2={sx(x)} y2={sy(-h / 2 + cover)}
            stroke="#ef6c00" strokeWidth={sw} />
        ))}
        {/* Y 向附加横向肢 / extra Y-direction horizontal legs */}
        {hLegYs.map((y, i) => (
          <line key={`h${i}`} x1={sx(-b / 2 + cover)} y1={sy(y)} x2={sx(b / 2 - cover)} y2={sy(y)}
            stroke="#ef6c00" strokeWidth={sw} />
        ))}

        {/* 纵向钢筋 / longitudinal bars */}
        {bars.map((bar, i) => (
          <circle key={i} cx={sx(bar.x)} cy={sy(bar.y)}
            r={Math.max(bar.d / 2 * s, 2.5)}
            fill={fillColor(bar.type)} stroke="#000" strokeWidth="0.5" />
        ))}

        {/* 尺寸标注 / dimensions */}
        <DimH x1={sx(-b / 2)} x2={sx(b / 2)} y={oy - 35} label={`b = ${b}`} extY={oy} />
        <DimV y1={sy(h / 2)} y2={sy(-h / 2)} x={ox - 35} label={`h = ${h}`} extX={ox} />
        <DimH x1={sx(-b / 2)} x2={sx(-b / 2 + cover)} y={sy(-h / 2) + 26}
          label={`c=${cover}`} extY={sy(-h / 2)} />

        {/* 引线注释 / leader annotations */}
        {cornerBar && (
          <Leader x1={sx(cornerBar.x)} y1={sy(cornerBar.y)} x2={noteX - 4} y2={oy + 26}
            text={`Corner bars 4D${dCorner}`} />
        )}
        {barX && nSideX > 0 && (
          <Leader x1={sx(barX.x)} y1={sy(barX.y)} x2={noteX - 4} y2={oy + 52}
            text={`X-dir. side bars ${nSideX}D${dSideX}/edge`} />
        )}
        {barY && nSideY > 0 && (
          <Leader x1={sx(barY.x)} y1={sy(barY.y)} x2={noteX - 4} y2={oy + 78}
            text={`Y-dir. side bars ${nSideY}D${dSideY}/edge`} />
        )}
        <Leader x1={sx(b / 2 - cover)} y1={sy(0)} x2={noteX - 4} y2={stirY}
          text={`Stirrups D${dStirrup}@${sStirrup} (${legsX}×${legsY} legs)`} />

        {/* 材料与配筋信息（纵筋、箍筋强度分开标注） */}
        {/* Material & reinforcement info (longitudinal / stirrup grades shown separately) */}
        <text x={ox} y={H - 140} fontSize="13.5" fill="#263238">
          Concrete: f&apos;c = {fc} MPa ({concreteGrade} MPa grade)
        </text>
        <text x={ox} y={H - 118} fontSize="13.5" fill="#263238">
          Longitudinal bars: Grade {steelLongGrade} (fy = {fyLong} MPa)
        </text>
        <text x={ox} y={H - 96} fontSize="13.5" fill="#263238">
          Stirrups: Grade {steelStirGrade} (fy = {fyStir} MPa)
        </text>
        <text x={ox} y={H - 74} fontSize="13.5" fill="#263238">
          Longitudinal steel: As = {As} mm², ρ = {rho}%
        </text>

        {/* 图例 / legend */}
        <g transform={`translate(${ox}, ${H - 36})`} fontSize="13" fill="#263238">
          <circle cx="0" cy="0" r="6" fill="#c62828" /><text x="12" y="4">Corner bars</text>
          <circle cx="110" cy="0" r="6" fill="#1565c0" /><text x="122" y="4">X-dir. side bars</text>
          <circle cx="240" cy="0" r="6" fill="#2e7d32" /><text x="252" y="4">Y-dir. side bars</text>
          <line x1="370" y1="0" x2="398" y2="0" stroke="#ef6c00" strokeWidth="3" />
          <text x="404" y="4">Stirrups</text>
        </g>
      </svg>
    </Paper>
  );
}
