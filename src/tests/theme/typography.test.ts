import { fontWeight, FONT_FAMILY_BY_WEIGHT } from '@/theme/typography';

/**
 * No Android, `fontWeight` numérico é ignorado quando a fonte é customizada
 * (Poppins) — só a família exata por peso funciona. `fontWeight()` é o único
 * jeito correto de aplicar peso nesta base (ver src/theme/typography.ts).
 */
describe('fontWeight', () => {
  it('retorna a família exata do peso, junto com o próprio peso', () => {
    expect(fontWeight('800')).toEqual({ fontFamily: 'Poppins_800ExtraBold', fontWeight: '800' });
  });

  it('cobre todos os pesos carregados no _layout raiz', () => {
    for (const weight of Object.keys(FONT_FAMILY_BY_WEIGHT) as (keyof typeof FONT_FAMILY_BY_WEIGHT)[]) {
      expect(fontWeight(weight).fontFamily).toBe(FONT_FAMILY_BY_WEIGHT[weight]);
    }
  });
});
