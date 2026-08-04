import { formatPercent, formatGoalPace, formatRaceCompleted, formatKm, formatCycleDate } from '@/services/history/cycle-format';

describe('formatCycleDate', () => {
  it('formata com o ano, ao contrário de formatShortDate (ciclos podem ser de anos diferentes)', () => {
    expect(formatCycleDate('2026-03-01')).toBe('1 mar 2026');
  });

  it('null vira "-"', () => {
    expect(formatCycleDate(null)).toBe('-');
  });
});

describe('formatPercent', () => {
  it('formata taxa 0..1 como porcentagem arredondada', () => {
    expect(formatPercent(0.754)).toBe('75%');
    expect(formatPercent(1)).toBe('100%');
    expect(formatPercent(0)).toBe('0%');
  });

  it('null (sem workouts) vira "-", não 0%', () => {
    expect(formatPercent(null)).toBe('-');
  });
});

describe('formatGoalPace', () => {
  it('formata segundos salvos como mm:ss/km', () => {
    expect(formatGoalPace({ goalPaceSeconds: 300 })).toBe('5:00/km');
  });

  it('sem pace-alvo salvo vira "-"', () => {
    expect(formatGoalPace({ goalPaceSeconds: null })).toBe('-');
  });
});

describe('formatRaceCompleted', () => {
  it('true/false viram os rótulos', () => {
    expect(formatRaceCompleted({ raceCompleted: true })).toBe('Concluída');
    expect(formatRaceCompleted({ raceCompleted: false })).toBe('Não concluída');
  });

  it('null (sem treino de prova salvo) vira "-", não "Não concluída"', () => {
    expect(formatRaceCompleted({ raceCompleted: null })).toBe('-');
  });
});

describe('formatKm', () => {
  it('arredonda para 1 casa decimal', () => {
    expect(formatKm(45.649)).toBe('45.6 km');
  });

  it('null vira "-"', () => {
    expect(formatKm(null)).toBe('-');
  });
});
