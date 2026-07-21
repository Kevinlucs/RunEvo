// Tokens de cor do RunEvo (enunciado §36). Fonte única de verdade de cor.
export const colors = {
  neon: '#CCFF00',
  neonLight: '#D9FF4D',
  background: '#000000',
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

export type ColorToken = keyof typeof colors;
