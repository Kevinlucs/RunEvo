import {
  calculateTrialWeeks,
  isWeekAccessible,
  shouldShowTrialEndingNotice,
  canGenerateNewPlan,
} from '@/services/plan/plan-trial.service';

describe('calculateTrialWeeks', () => {
  it('plano normal (>=16 semanas): teto de 8', () => {
    expect(calculateTrialWeeks(20)).toBe(8);
    expect(calculateTrialWeeks(16)).toBe(8);
  });

  it('plano curto (6 semanas): gate na metade (3)', () => {
    expect(calculateTrialWeeks(6)).toBe(3);
  });

  it('plano bem curto (4 semanas, mínimo do motor): metade (2)', () => {
    expect(calculateTrialWeeks(4)).toBe(2);
  });
});

describe('isWeekAccessible', () => {
  it('Free vê semanas 1-8 num plano normal', () => {
    for (let week = 1; week <= 8; week++) {
      expect(isWeekAccessible({ weekNumber: week, currentWeekNumber: 1, totalWeeks: 20, isPlus: false })).toBe(true);
    }
  });

  it('Free NÃO vê semana 9+ (a não ser que seja a semana atual)', () => {
    expect(isWeekAccessible({ weekNumber: 9, currentWeekNumber: 1, totalWeeks: 20, isPlus: false })).toBe(false);
    expect(isWeekAccessible({ weekNumber: 12, currentWeekNumber: 1, totalWeeks: 20, isPlus: false })).toBe(false);
  });

  it('a semana atual sempre é acessível, mesmo além do trial', () => {
    expect(isWeekAccessible({ weekNumber: 10, currentWeekNumber: 10, totalWeeks: 20, isPlus: false })).toBe(true);
  });

  it('plano de 6 semanas: gate cai na semana 3 (metade)', () => {
    expect(isWeekAccessible({ weekNumber: 3, currentWeekNumber: 1, totalWeeks: 6, isPlus: false })).toBe(true);
    expect(isWeekAccessible({ weekNumber: 4, currentWeekNumber: 1, totalWeeks: 6, isPlus: false })).toBe(false);
  });

  it('Plus vê todas as semanas', () => {
    expect(isWeekAccessible({ weekNumber: 20, currentWeekNumber: 1, totalWeeks: 20, isPlus: true })).toBe(true);
  });
});

describe('shouldShowTrialEndingNotice', () => {
  it('dispara a ~2 semanas do fim do trial (plano normal, trial=8)', () => {
    expect(shouldShowTrialEndingNotice({ currentWeekNumber: 6, totalWeeks: 20, isPlus: false })).toBe(true);
    expect(shouldShowTrialEndingNotice({ currentWeekNumber: 7, totalWeeks: 20, isPlus: false })).toBe(true);
    expect(shouldShowTrialEndingNotice({ currentWeekNumber: 8, totalWeeks: 20, isPlus: false })).toBe(true);
  });

  it('não dispara longe do fim do trial', () => {
    expect(shouldShowTrialEndingNotice({ currentWeekNumber: 1, totalWeeks: 20, isPlus: false })).toBe(false);
  });

  it('não dispara depois que o trial já acabou (a tela bloqueada já comunica)', () => {
    expect(shouldShowTrialEndingNotice({ currentWeekNumber: 9, totalWeeks: 20, isPlus: false })).toBe(false);
  });

  it('nunca dispara para Plus', () => {
    expect(shouldShowTrialEndingNotice({ currentWeekNumber: 8, totalWeeks: 20, isPlus: true })).toBe(false);
  });
});

describe('canGenerateNewPlan', () => {
  it('Free sem planilha existente: permite (vive a 1ª)', () => {
    expect(canGenerateNewPlan({ hasExistingPlan: false, isPlus: false })).toBe(true);
  });

  it('Free com planilha existente: bloqueia', () => {
    expect(canGenerateNewPlan({ hasExistingPlan: true, isPlus: false })).toBe(false);
  });

  it('Plus sempre permite', () => {
    expect(canGenerateNewPlan({ hasExistingPlan: true, isPlus: true })).toBe(true);
  });
});
