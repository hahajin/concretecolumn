import React from 'react';
import {
  Paper, Typography, Table, TableHead, TableBody,
  TableRow, TableCell, TableContainer,
} from '@mui/material';

/**
 * 控制点数据表：名称 / N / Mx / My / 说明
 * Control-point data table: name / N / Mx / My / description
 *
 * ★ 新增：设计强度列 φN, φMx, φMy（φ = 0.85，NZS 3101 §2.3.2.2）
 * ★ Added: design (factored) strength columns φN, φMx, φMy
 *   (φ = 0.85 per NZS 3101 §2.3.2.2 for flexure with/without axial load).
 *   原表只列出"名义强度"，容易被误用于直接和设计荷载 S* 比较；NZS 3101 的
 *   校核公式为 S* ≤ φ·Sn，因此补充设计值列，避免使用者遗漏 φ 折减。
 *   The original table only listed nominal strength, which risks being
 *   compared directly against design actions S*. NZS 3101 requires
 *   S* ≤ φ·Sn, so the factored columns are added to avoid users forgetting φ.
 */
export default function ControlPointsTable({ controlPoints, phi }) {
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>Control Point Data</Typography>
      <Typography variant="caption" color="text.secondary">
        Sn = nominal strength; φSn = design strength (φ = {phi ?? 0.85}, NZS 3101 §2.3.2.2). Design check: S* ≤ φSn.
      </Typography>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Control point</TableCell>
              <TableCell align="right">N (kN)</TableCell>
              <TableCell align="right">Mx (kN·m)</TableCell>
              <TableCell align="right">My (kN·m)</TableCell>
              <TableCell align="right">φN (kN)</TableCell>
              <TableCell align="right">φMx (kN·m)</TableCell>
              <TableCell align="right">φMy (kN·m)</TableCell>
              <TableCell>Description</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {controlPoints.map((p, i) => (
              <TableRow key={i} hover>
                <TableCell>{p.name}</TableCell>
                <TableCell align="right">{p.N.toFixed(1)}</TableCell>
                <TableCell align="right">{p.Mx.toFixed(1)}</TableCell>
                <TableCell align="right">{p.My.toFixed(1)}</TableCell>
                <TableCell align="right">{(p.phiN ?? p.N * (phi ?? 0.85)).toFixed(1)}</TableCell>
                <TableCell align="right">{(p.phiMx ?? p.Mx * (phi ?? 0.85)).toFixed(1)}</TableCell>
                <TableCell align="right">{(p.phiMy ?? p.My * (phi ?? 0.85)).toFixed(1)}</TableCell>
                <TableCell>{p.desc}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
