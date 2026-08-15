/**
 * Design tokens do RunEvo (enunciado §36). Fonte única de verdade visual.
 * Nada de cores/tamanhos hard-coded fora daqui.
 * Paleta extraída dos mockups (docs/fase-qa-polimento-brief.md).
 */
export const colors = {
  neon: '#CCFF00',
  neonLight: '#D9FF4D',
  neonMuted: 'rgba(204, 255, 0, 0.15)',
  bg: '#000000',
  card: '#171A1A',
  cardElevated: '#1E2222',
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0A0',
  textMuted: '#666666',
  border: '#2A2A2A',
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#FF4444',
  glow: 'rgba(204, 255, 0, 0.30)',
  tabInactive: '#666666',
  tabActive: '#CCFF00',
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
