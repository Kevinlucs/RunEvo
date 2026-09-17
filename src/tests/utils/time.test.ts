import { formatMonthYear, formatDuration, formatLongDate } from '@/utils/time';

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

describe('formatDuration (recordes pessoais — formato dos mockups)', () => {
  it('abaixo de 1h → "MM min SS s"', () => {
    expect(formatDuration(1346)).toBe('22 min 26 s');
    expect(formatDuration(0)).toBe('0 min 0 s');
  });

  it('a partir de 1h → "H h MM min"', () => {
    expect(formatDuration(3900)).toBe('1 h 5 min');
    expect(formatDuration(7325)).toBe('2 h 2 min');
  });

  it('arredonda segundos fracionários', () => {
    expect(formatDuration(1346.6)).toBe('22 min 27 s');
  });

  it('null/undefined/negativo → "-"', () => {
    expect(formatDuration(null)).toBe('-');
    expect(formatDuration(undefined)).toBe('-');
    expect(formatDuration(-5)).toBe('-');
  });
});

describe('formatLongDate (recordes pessoais — "18 de mai. de 2025")', () => {
  it('formata "YYYY-MM-DD" como "D de mês. de ano"', () => {
    expect(formatLongDate('2025-05-18')).toBe('18 de mai. de 2025');
    expect(formatLongDate('2025-01-01')).toBe('1 de jan. de 2025');
  });

  it('vazio/inválido → ""', () => {
    expect(formatLongDate('')).toBe('');
    expect(formatLongDate(undefined)).toBe('');
    expect(formatLongDate('not-a-date')).toBe('');
  });
});
