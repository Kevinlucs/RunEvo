import type { TextStyle } from 'react-native';

/**
 * Família Poppins — Design System tipográfico do RunEvo.
 *
 * No Android, `fontWeight` numérico é ignorado quando a fonte é customizada —
 * o peso certo só aparece se a família exata (Poppins_XXXWeight) for aplicada.
 * `fontWeight()` abaixo retorna tanto `fontFamily` quanto `fontWeight` juntos.
 *
 * Carregamento: `_layout.tsx` raiz via `useFonts` + SplashScreen.
 */

// ─── Font Family Map ──────────────────────────────────────────────────────────

export const FONT_FAMILY_BY_WEIGHT = {
  '300': 'Poppins_300Light',
  '400': 'Poppins_400Regular',
  '500': 'Poppins_500Medium',
  '600': 'Poppins_600SemiBold',
  '700': 'Poppins_700Bold',
  '800': 'Poppins_800ExtraBold',
  '900': 'Poppins_900Black',
} as const;

export type OutfitWeight = keyof typeof FONT_FAMILY_BY_WEIGHT;

/** `{ fontFamily, fontWeight }` para um peso — usar via spread: `...fontWeight('800')`. */
export function fontWeight(weight: OutfitWeight): Pick<TextStyle, 'fontFamily' | 'fontWeight'> {
  return { fontFamily: FONT_FAMILY_BY_WEIGHT[weight], fontWeight: weight };
}

// ─── Semantic Font Families ───────────────────────────────────────────────────

export const fontFamily = {
  light: FONT_FAMILY_BY_WEIGHT['300'],
  regular: FONT_FAMILY_BY_WEIGHT['400'],
  medium: FONT_FAMILY_BY_WEIGHT['500'],
  semibold: FONT_FAMILY_BY_WEIGHT['600'],
  bold: FONT_FAMILY_BY_WEIGHT['700'],
  extrabold: FONT_FAMILY_BY_WEIGHT['800'],
  black: FONT_FAMILY_BY_WEIGHT['900'],
} as const;

// ─── Typography Tokens ────────────────────────────────────────────────────────
//
// Hierarquia oficial do RunEvo (referência: PWA original + mockups).
// Cada token = { fontFamily, fontSize, lineHeight, letterSpacing? }
// Uso: ...typography.heading1 em StyleSheet.

export const typography = {
  // ── Display (splash, hero) ──
  displayLarge: { fontFamily: fontFamily.black, fontSize: 40, lineHeight: 48 } as TextStyle,
  displayMedium: { fontFamily: fontFamily.extrabold, fontSize: 34, lineHeight: 40 } as TextStyle,

  // ── Headings (títulos de tela) ──
  heading1: { fontFamily: fontFamily.extrabold, fontSize: 28, lineHeight: 34 } as TextStyle,
  heading2: { fontFamily: fontFamily.bold, fontSize: 22, lineHeight: 28 } as TextStyle,
  heading3: { fontFamily: fontFamily.bold, fontSize: 18, lineHeight: 24 } as TextStyle,

  // ── Titles (cards, seções) ──
  titleLarge: { fontFamily: fontFamily.bold, fontSize: 20, lineHeight: 26 } as TextStyle,
  titleMedium: { fontFamily: fontFamily.bold, fontSize: 16, lineHeight: 22 } as TextStyle,
  titleSmall: { fontFamily: fontFamily.semibold, fontSize: 14, lineHeight: 20 } as TextStyle,

  // ── Body (texto corrido) ──
  bodyLarge: { fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 24 } as TextStyle,
  bodyMedium: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20 } as TextStyle,
  bodySmall: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 16 } as TextStyle,

  // ── Labels (chips, badges, info) ──
  labelLarge: { fontFamily: fontFamily.semibold, fontSize: 14, lineHeight: 18, letterSpacing: 0.5 } as TextStyle,
  labelMedium: { fontFamily: fontFamily.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.5 } as TextStyle,
  labelSmall: { fontFamily: fontFamily.medium, fontSize: 11, lineHeight: 14, letterSpacing: 0.3 } as TextStyle,

  // ── Metrics (números grandes, KPIs) ──
  metricLarge: { fontFamily: fontFamily.black, fontSize: 32, lineHeight: 38 } as TextStyle,
  metricMedium: { fontFamily: fontFamily.black, fontSize: 22, lineHeight: 28 } as TextStyle,
  metricSmall: { fontFamily: fontFamily.extrabold, fontSize: 18, lineHeight: 22 } as TextStyle,

  // ── Button ──
  button: { fontFamily: fontFamily.semibold, fontSize: 16, lineHeight: 20, letterSpacing: 0.3 } as TextStyle,

  // ── Caption ──
  caption: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 16 } as TextStyle,

  // ── Tab Bar ──
  tabLabel: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 14 } as TextStyle,

  // ── Section Labels (PRÓXIMO TREINO, SEMANA ATUAL, etc.) ──
  sectionLabel: { fontFamily: fontFamily.extrabold, fontSize: 14, lineHeight: 18, letterSpacing: 1.5 } as TextStyle,
} as const;
