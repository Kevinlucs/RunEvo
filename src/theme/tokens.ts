/**
 * Design tokens do RunEvo (enunciado §36). Fonte única de verdade visual.
 * Nada de cores/tamanhos hard-coded fora daqui.
 */
export const colors = {
  neon: '#CCFF00',
  neonLight: '#D9FF4D',
  bg: '#000000',
  card: '#171A1A',
  cardElevated: '#1F2424',
  textPrimary: '#F5F5F5',
  textSecondary: '#999999',
  textMuted: '#666666',
  border: '#2A2A2A',
  success: '#4CD964',
  error: '#FF3B30',
  glow: 'rgba(204,255,0,0.30)',
} as const;

export const radii = {
  sm: 10,
  md: 16,
  lg: 20,
  xl: 24,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const fonts = {
  family: 'Outfit',
  weights: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
    black: '900',
  },
} as const;

export const fontSizes = {
  caption: 12,
  body: 14,
  base: 16,
  lg: 18,
  xl: 22,
  title: 28,
  display: 34,
} as const;

/** Alvo mínimo de toque (acessibilidade, enunciado §37). */
export const MIN_TOUCH_TARGET = 44;

export type Colors = typeof colors;
