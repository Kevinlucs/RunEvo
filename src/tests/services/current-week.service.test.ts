import { computeCurrentWeekNumber } from '@/services/plan/current-week.service';

describe('computeCurrentWeekNumber', () => {
  it('no dia de início (segunda) → semana 1', () => {
    expect(computeCurrentWeekNumber('2026-01-05', new Date('2026-01-05T12:00:00'))).toBe(1);
  });

  it('no domingo da primeira semana → ainda semana 1 (virada é segunda)', () => {
    expect(computeCurrentWeekNumber('2026-01-05', new Date('2026-01-11T12:00:00'))).toBe(1);
  });

  it('na segunda seguinte → vira semana 2 (virada de semana domingo→segunda)', () => {
    expect(computeCurrentWeekNumber('2026-01-05', new Date('2026-01-12T12:00:00'))).toBe(2);
  });

  it('início no meio da semana (primeira semana parcial) alinha por segunda mesmo assim', () => {
    // 2026-01-07 é quarta; a semana 1 "virtual" começa na segunda (05/01).
    expect(computeCurrentWeekNumber('2026-01-07', new Date('2026-01-07T12:00:00'))).toBe(1);
    expect(computeCurrentWeekNumber('2026-01-07', new Date('2026-01-12T12:00:00'))).toBe(2);
  });

  it('antes do início do plano não retorna semana menor que 1', () => {
    expect(computeCurrentWeekNumber('2026-01-05', new Date('2025-12-01T12:00:00'))).toBe(1);
  });
});
