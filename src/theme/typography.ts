import type { TextStyle } from 'react-native';

/**
 * Família Outfit (enunciado §36), carregada via `useFonts` no `_layout` raiz
 * (`@expo-google-fonts/outfit`). No Android, `fontWeight` numérico é
 * ignorado quando a fonte é customizada — o peso certo só aparece se a
 * família exata for aplicada. `fontWeight` abaixo é o jeito correto de
 * aplicar peso nesta base: usar em vez de `{ fontWeight: '800' }` cru.
 */
export const FONT_FAMILY_BY_WEIGHT = {
  '400': 'Outfit_400Regular',
  '500': 'Outfit_500Medium',
  '600': 'Outfit_600SemiBold',
  '700': 'Outfit_700Bold',
  '800': 'Outfit_800ExtraBold',
  '900': 'Outfit_900Black',
} as const;

export type OutfitWeight = keyof typeof FONT_FAMILY_BY_WEIGHT;

/** `{ fontFamily, fontWeight }` para um peso — usar via spread: `...fontWeight('800')`. */
export function fontWeight(weight: OutfitWeight): Pick<TextStyle, 'fontFamily' | 'fontWeight'> {
  return { fontFamily: FONT_FAMILY_BY_WEIGHT[weight], fontWeight: weight };
}
