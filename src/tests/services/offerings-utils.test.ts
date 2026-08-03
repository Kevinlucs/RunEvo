import { annualDiscountPercent } from '@/services/subscription/offerings-utils';
import type { SubscriptionPackage } from '@/domain/entities';

function mkPkg(overrides: Partial<SubscriptionPackage>): SubscriptionPackage {
  return {
    identifier: '$rc_monthly',
    productId: 'runevo_plus_monthly',
    period: 'monthly',
    priceString: 'R$ 19,90',
    priceAmount: 19.9,
    currencyCode: 'BRL',
    title: 'Mensal',
    ...overrides,
  };
}

describe('annualDiscountPercent', () => {
  it('calcula o desconto real do anual contra 12x o mensal', () => {
    const monthly = mkPkg({ priceAmount: 19.9 });
    const annual = mkPkg({ identifier: '$rc_annual', period: 'annual', priceAmount: 149.9 });

    expect(annualDiscountPercent(monthly, annual)).toBe(37);
  });

  it('sem um dos dois pacotes → null (nunca inventa desconto)', () => {
    expect(annualDiscountPercent(undefined, mkPkg({ period: 'annual' }))).toBeNull();
    expect(annualDiscountPercent(mkPkg({}), undefined)).toBeNull();
  });

  it('anual mais caro que 12x o mensal → null (sem "desconto negativo")', () => {
    const monthly = mkPkg({ priceAmount: 19.9 });
    const annual = mkPkg({ identifier: '$rc_annual', period: 'annual', priceAmount: 999 });

    expect(annualDiscountPercent(monthly, annual)).toBeNull();
  });

  it('mensal com preço zero → null (evita divisão por zero)', () => {
    const monthly = mkPkg({ priceAmount: 0 });
    const annual = mkPkg({ identifier: '$rc_annual', period: 'annual', priceAmount: 10 });

    expect(annualDiscountPercent(monthly, annual)).toBeNull();
  });
});
