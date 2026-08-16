import { createTheme } from '@mui/material/styles';

// 全局 MUI 主题：主色蓝（纵筋/界面），辅色橙（箍筋/控制点）
// Global MUI theme: primary blue (longitudinal steel / UI chrome),
// secondary orange (stirrups / control points)
const theme = createTheme({
  palette: {
    primary: { main: '#1565c0' },
    secondary: { main: '#ef6c00' },
  },
  typography: {
    // ★ 内容已全部改为英文，字体列表移除中文字体后备（Microsoft YaHei），
    //   改用标准西文字体栈即可；如需同时显示中文注释界面可自行加回。
    // ★ All UI content is now English; removed the Chinese font fallback
    //   (Microsoft YaHei) from the stack — add it back if a Chinese UI is
    //   needed again.
    fontFamily: '"Roboto","Helvetica","Arial",sans-serif',
  },
});

export default theme;
