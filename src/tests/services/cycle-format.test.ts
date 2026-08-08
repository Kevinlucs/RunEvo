import {
  formatPercent,
  formatGoalPace,
  formatRaceCompleted,
  formatKm,
  formatCycleDate,
  formatSignedPercent,
  formatSignedNumber,
  formatPaceDelta,
  formatPointsDelta,
} from '@/services/history/cycle-format';

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

describe('formatSignedPercent', () => {
  it('adiciona sinal explícito no positivo, mantém no negativo', () => {
    expect(formatSignedPercent(40)).toBe('+40%');
    expect(formatSignedPercent(-12)).toBe('-12%');
    expect(formatSignedPercent(0)).toBe('0%');
  });

  it('null vira "-"', () => {
    expect(formatSignedPercent(null)).toBe('-');
  });
});

describe('formatSignedNumber', () => {
  it('arredonda nas casas decimais pedidas com sinal', () => {
    expect(formatSignedNumber(1.44, 1)).toBe('+1.4');
    expect(formatSignedNumber(-1, 0)).toBe('-1');
  });

  it('null vira "-"', () => {
    expect(formatSignedNumber(null)).toBe('-');
  });
});

describe('formatPaceDelta', () => {
  it('negativo é o ciclo b mais rápido; positivo é mais lento', () => {
    expect(formatPaceDelta(-18)).toBe('18s/km mais rápido');
    expect(formatPaceDelta(18)).toBe('18s/km mais lento');
  });

  it('zero vira "igual", não "-"', () => {
    expect(formatPaceDelta(0)).toBe('igual');
  });

  it('null (pace não salvo em um dos ciclos) vira "-"', () => {
    expect(formatPaceDelta(null)).toBe('-');
  });
});

describe('formatPointsDelta', () => {
  it('converte delta 0..1 em pontos percentuais com sinal', () => {
    expect(formatPointsDelta(0.13)).toBe('+13pp');
    expect(formatPointsDelta(-0.05)).toBe('-5pp');
  });

  it('null vira "-"', () => {
    expect(formatPointsDelta(null)).toBe('-');
  });
});
