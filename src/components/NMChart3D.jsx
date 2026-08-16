import React, { useMemo } from 'react';
import Plotly from 'plotly.js-dist-min';
import createPlotlyComponent from 'react-plotly.js/factory';
import { Paper, Typography, Box } from '@mui/material';

const Plot = createPlotlyComponent(Plotly);

/**
 * 三维 N-M 交互图 / 3D N-M interaction chart
 * 说明：新增 onGdReady(graphDiv) 回调 —— 把 Plotly 的 DOM 节点传给 App，
 *       PDF 导出时用 Plotly.toImage(format:'png') 生成高清位图
 * Note: onGdReady(graphDiv) callback passes the Plotly DOM node up to App
 *       so the PDF export step can rasterise it via Plotly.toImage().
 */
export default function NMChart3D({ surface, curveX, curveY, controlPoints, onGdReady }) {
  const data = useMemo(() => {
    const traces = [];

    // 1) 双向承载力曲面 / biaxial capacity surface
    traces.push({
      type: 'surface',
      x: surface.X, y: surface.Y, z: surface.Z,
      colorscale: 'Viridis', opacity: 0.7,
      contours: { z: { show: true, usecolormap: true, highlightwidth: 2 } },
      colorbar: { title: 'N (kN)', len: 0.75 },
      showlegend: false, name: 'Biaxial capacity surface',
    });

    // 2) 单向 Mx-N 曲线 / uniaxial Mx-N curve
    traces.push({
      type: 'scatter3d', mode: 'lines', name: 'Uniaxial Mx-N',
      x: curveX.map(p => p.M), y: curveX.map(() => 0), z: curveX.map(p => p.N),
      line: { color: '#d32f2f', width: 5 },
    });

    // 3) 单向 My-N 曲线 / uniaxial My-N curve
    traces.push({
      type: 'scatter3d', mode: 'lines', name: 'Uniaxial My-N',
      x: curveY.map(() => 0), y: curveY.map(p => p.M), z: curveY.map(p => p.N),
      line: { color: '#1565c0', width: 5 },
    });

    // 4) 控制点 / control points
    traces.push({
      type: 'scatter3d', mode: 'markers+text', name: 'Control points',
      x: controlPoints.map(p => p.Mx),
      y: controlPoints.map(p => p.My),
      z: controlPoints.map(p => p.N),
      text: controlPoints.map(p => p.short),
      textposition: 'top center',
      marker: { size: 5, color: '#ff6f00', symbol: 'diamond' },
      hovertemplate: controlPoints.map(p =>
        `<b>${p.name}</b><br>N = %{z:.1f} kN<br>Mx = %{x:.1f} kN·m<br>My = %{y:.1f} kN·m<extra></extra>`),
    });

    return traces;
  }, [surface, curveX, curveY, controlPoints]);

  const layout = useMemo(() => ({
    autosize: true, height: 580,
    margin: { l: 0, r: 0, t: 10, b: 0 },
    scene: {
      xaxis: { title: 'Mx (kN·m)' },
      yaxis: { title: 'My (kN·m)' },
      zaxis: { title: 'N (kN)' },
      camera: { eye: { x: 1.6, y: -1.6, z: 0.9 } },
    },
    legend: { x: 0, y: 1.05, orientation: 'h' },
  }), []);

  return (
    <Paper sx={{ p: 1.5, height: '100%' }}>
      <Typography variant="h6">3D N-M Interaction Surface (Biaxial Bending)</Typography>
      <Typography variant="caption" color="text.secondary">
        Surface approximated by the linear contour Mx/Mux + My/Muy = 1 at each axial load level (conservative)
      </Typography>
      <Box sx={{ width: '100%' }}>
        <Plot data={data} layout={layout} useResize
          style={{ width: '100%' }}
          config={{ responsive: true, displaylogo: false }}
          /* ★ 初始化与更新时都把 graph div 传给父组件，供 PDF 导出使用 */
          /* ★ Pass the graph div up to the parent on both init and update, for PDF export */
          onInitialized={(fig, gd) => onGdReady && onGdReady(gd)}
          onUpdate={(fig, gd) => onGdReady && onGdReady(gd)} />
      </Box>
    </Paper>
  );
}
