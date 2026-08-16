import React from 'react';
import {
  Paper, Typography, Grid, TextField, MenuItem, InputAdornment,
  Divider, Chip, Stack, Alert, Box,
} from '@mui/material';
import { CONCRETE_GRADES, STEEL_GRADES } from '../utils/materials';

function NumField({ label, value, onChange, unit, step = 1 }) {
  return (
    <TextField
      fullWidth size="small" type="number"
      label={label} value={value}
      onChange={e => onChange(e.target.value)}
      inputProps={{ step }}
      InputProps={{ endAdornment: <InputAdornment position="end">{unit}</InputAdornment> }}
    />
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <TextField fullWidth size="small" select label={label} value={value}
      onChange={e => onChange(e.target.value)}>
      {options.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
    </TextField>
  );
}

// ★ 钢筋直径改为 AS/NZS 4671 标准直径系列（10–40 mm）
// ★ Bar diameters updated to the AS/NZS 4671 standard series (10–40 mm)
const BAR_DIAS  = [10, 12, 16, 20, 24, 28, 32, 36, 40];
const STIR_DIAS = [10, 12, 16];
const LEGS = [
  { value: 2, label: '2 legs' },
  { value: 4, label: '4 legs' },
  { value: 6, label: '6 legs' },
  { value: 8, label: '8 legs' },
];

export default function ColumnInputs({ params, setParam, summary, warnings }) {
  // 混凝土等级取自 materials.js 的数值 key（如 20/25/30…），显示为 "30 MPa"
  // Concrete grade keys are numeric (e.g. 20/25/30…), displayed as "30 MPa"
  const concreteOptions = Object.keys(CONCRETE_GRADES).map(g => ({ value: g, label: `${g} MPa` }));
  const steelOptions    = Object.keys(STEEL_GRADES).map(g => ({ value: g, label: g }));

  return (
    <Paper sx={{ p: 2, height: '100%' }}>
      <Typography variant="h6" gutterBottom>Design Parameters</Typography>

      <Grid container spacing={1.5}>
        {/* ---- 截面与材料 / Section & materials ---- */}
        <Grid item xs={12}>
          <Typography variant="subtitle2" color="text.secondary">— Section &amp; Materials —</Typography>
        </Grid>
        <Grid item xs={6}>
          <NumField label="Width b" value={params.b} unit="mm" onChange={v => setParam('b', v)} />
        </Grid>
        <Grid item xs={6}>
          <NumField label="Depth h" value={params.h} unit="mm" onChange={v => setParam('h', v)} />
        </Grid>
        <Grid item xs={6}>
          <NumField label="Cover c" value={params.cover} unit="mm" onChange={v => setParam('cover', v)} />
        </Grid>
        <Grid item xs={6}>
          <SelectField label="Concrete strength f'c" value={params.concreteGrade}
            options={concreteOptions} onChange={v => setParam('concreteGrade', v)} />
        </Grid>
        {/* ★ 纵筋与箍筋强度分开 / longitudinal & stirrup grades kept separate */}
        <Grid item xs={6}>
          <SelectField label="Longitudinal bar grade" value={params.steelGradeLong}
            options={steelOptions} onChange={v => setParam('steelGradeLong', v)} />
        </Grid>
        <Grid item xs={6}>
          <SelectField label="Stirrup (tie) grade" value={params.steelGradeStirrup}
            options={steelOptions} onChange={v => setParam('steelGradeStirrup', v)} />
        </Grid>

        {/* ---- 纵向钢筋 / Longitudinal reinforcement ---- */}
        <Grid item xs={12}>
          <Typography variant="subtitle2" color="text.secondary">— Longitudinal Reinforcement —</Typography>
        </Grid>
        <Grid item xs={6}>
          <SelectField label="Corner bar diameter" value={params.dCorner}
            options={BAR_DIAS.map(d => ({ value: d, label: `D${d}` }))}
            onChange={v => setParam('dCorner', Number(v))} />
        </Grid>
        {/* ★ X 向中部筋：布置在上、下边（沿 b 边） / X-direction side bars: top/bottom edges (along b) */}
        <Grid item xs={6}>
          <NumField label="X-dir. side bars / edge" value={params.nSideX} unit="bars"
            onChange={v => setParam('nSideX', v)} />
        </Grid>
        <Grid item xs={6}>
          <SelectField label="X-dir. side bar diameter" value={params.dSideX}
            options={BAR_DIAS.map(d => ({ value: d, label: `D${d}` }))}
            onChange={v => setParam('dSideX', Number(v))} />
        </Grid>
        {/* ★ Y 向中部筋：布置在左、右边（沿 h 边） / Y-direction side bars: left/right edges (along h) */}
        <Grid item xs={6}>
          <NumField label="Y-dir. side bars / edge" value={params.nSideY} unit="bars"
            onChange={v => setParam('nSideY', v)} />
        </Grid>
        <Grid item xs={6}>
          <SelectField label="Y-dir. side bar diameter" value={params.dSideY}
            options={BAR_DIAS.map(d => ({ value: d, label: `D${d}` }))}
            onChange={v => setParam('dSideY', Number(v))} />
        </Grid>
        <Grid item xs={12}>
          <Typography variant="caption" color="text.secondary">
            X-direction side bars sit on the top/bottom edges (along b); Y-direction side bars sit on the left/right edges (along h).
          </Typography>
        </Grid>

        {/* ---- 箍筋 / Stirrups (ties) ---- */}
        <Grid item xs={12}>
          <Typography variant="subtitle2" color="text.secondary">— Stirrups (Ties) —</Typography>
        </Grid>
        {/* ★ 肢数按 X / Y 两个方向分别设置 / leg counts set separately per direction */}
        <Grid item xs={6}>
          <SelectField label="X-dir. legs (vertical)" value={params.legsX} options={LEGS}
            onChange={v => setParam('legsX', Number(v))} />
        </Grid>
        <Grid item xs={6}>
          <SelectField label="Y-dir. legs (horizontal)" value={params.legsY} options={LEGS}
            onChange={v => setParam('legsY', Number(v))} />
        </Grid>
        <Grid item xs={6}>
          <SelectField label="Stirrup diameter" value={params.dStirrup}
            options={STIR_DIAS.map(d => ({ value: d, label: `D${d}` }))}
            onChange={v => setParam('dStirrup', Number(v))} />
        </Grid>
        <Grid item xs={6}>
          <NumField label="Stirrup spacing" value={params.sStirrup} unit="mm"
            onChange={v => setParam('sStirrup', v)} />
        </Grid>
      </Grid>

      <Divider sx={{ my: 1.5 }} />
      <Typography variant="subtitle2" gutterBottom>Section Summary</Typography>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <Chip size="small" label={`${summary.nBars} bars`} />
        <Chip size="small" label={`As = ${summary.As} mm²`} />
        <Chip size="small" color={summary.rhoNum > 8 ? 'error' : 'primary'}
          label={`ρ = ${summary.rho}%`} />
      </Stack>

      <Box sx={{ mt: 0.5 }}>
        {warnings.map((w, i) => (
          <Alert key={i} severity="warning" sx={{ mt: 1, py: 0 }}>{w}</Alert>
        ))}
      </Box>
    </Paper>
  );
}
