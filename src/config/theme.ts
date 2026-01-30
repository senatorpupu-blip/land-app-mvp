// Dark/Loft theme colors
export const theme = {
  colors: {
    // Primary colors
    primary: '#D4A574',
    primaryDark: '#B8956A',
    primaryLight: '#E8C9A8',
    
    // Background colors
    background: '#1A1A1A',
    backgroundSecondary: '#2D2D2D',
    backgroundTertiary: '#3D3D3D',
    
    // Surface colors
    surface: '#252525',
    surfaceLight: '#333333',
    
    // Text colors
    text: '#FFFFFF',
    textSecondary: '#B0B0B0',
    textMuted: '#808080',
    
    // Status colors
    success: '#4CAF50',
    error: '#F44336',
    warning: '#FF9800',
    info: '#2196F3',
    
    // Zone colors
    zoneA: '#4CAF50',
    zoneB: '#FF9800',
    zoneC: '#F44336',
    
    // Border
    border: '#404040',
    borderLight: '#505050',
    
    // Overlay
    overlay: 'rgba(0, 0, 0, 0.7)',
  },
  
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },
  
  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 24,
    xxl: 32,
  },
};

export type Theme = typeof theme;
