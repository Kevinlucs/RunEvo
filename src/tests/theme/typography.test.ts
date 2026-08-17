import { fontWeight, FONT_FAMILY_BY_WEIGHT } from '@/theme/typography';

/**
 * No Android, `fontWeight` numérico faz fallback para Roboto se passado junto
 * de uma custom font — só a família exata por peso deve ser fornecida.
 */
describe('fontWeight', () => {
  it('retorna a família exata do peso', () => {
    expect(fontWeight('800')).toEqual({ fontFamily: 'Poppins_800ExtraBold' });
  });

  it('cobre todos os pesos carregados no _layout raiz', () => {
    for (const weight of Object.keys(FONT_FAMILY_BY_WEIGHT) as (keyof typeof FONT_FAMILY_BY_WEIGHT)[]) {
      expect(fontWeight(weight).fontFamily).toBe(FONT_FAMILY_BY_WEIGHT[weight]);
    }
  });
});
