import { formatMonthYear } from '@/utils/time';

describe('formatMonthYear (docs/fase-6-brief.md §32 — "Entrou em jul. de 2026")', () => {
  it('formata timestamp ISO como "mês. de ano"', () => {
    expect(formatMonthYear('2026-07-15T12:00:00.000Z')).toBe('jul. de 2026');
  });

  it('null/undefined → "-"', () => {
    expect(formatMonthYear(null)).toBe('-');
    expect(formatMonthYear(undefined)).toBe('-');
  });

  it('string inválida → "-"', () => {
    expect(formatMonthYear('not-a-date')).toBe('-');
  });
});
