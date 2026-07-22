/**
 * Testes headless do débito completado na Fase 4 (docs/fase-4-brief.md Grupo
 * 1.1): `summarizeWeek` (status/canCheckin) e `getCheckinCandidateWeek`.
 * Não são testes de equivalência (a extensão de status/canCheckin não existe
 * no legado) — verificam a regra descrita no brief e em docs/legacy-audit.md
 * §10.1 (`resolved === total`, candidata = primeira semana sem check-in
 * totalmente resolvida, senão a corrente).
 */
import {
  summarizeWeek,
  getCheckinCandidateWeek,
  type WorkoutResolution,
  type CheckinCandidate,
} from '@/domain/motor-evo/adaptive-training';

function resolution(overrides: Partial<WorkoutResolution> = {}): WorkoutResolution {
  return { km: 5, status: 'pending', ...overrides };
}

describe('summarizeWeek — status/canCheckin', () => {
  it('nenhum treino resolvido → status pending, canCheckin false', () => {
    const summary = summarizeWeek([resolution(), resolution()]);
    expect(summary.status).toBe('pending');
    expect(summary.canCheckin).toBe(false);
  });

  it('parte resolvida → status in_progress, canCheckin false', () => {
    const summary = summarizeWeek([resolution({ status: 'completed', completedKm: 5 }), resolution()]);
    expect(summary.status).toBe('in_progress');
    expect(summary.canCheckin).toBe(false);
  });

  it('tudo resolvido (completed + skipped) → status done, canCheckin true', () => {
    const summary = summarizeWeek([
      resolution({ status: 'completed', completedKm: 5 }),
      resolution({ status: 'skipped' }),
    ]);
    expect(summary.status).toBe('done');
    expect(summary.canCheckin).toBe(true);
  });

  it('semana sem treinos (total 0) → pending, canCheckin false (não confunde vazio com concluído)', () => {
    const summary = summarizeWeek([]);
    expect(summary.total).toBe(0);
    expect(summary.status).toBe('pending');
    expect(summary.canCheckin).toBe(false);
  });
});

describe('getCheckinCandidateWeek', () => {
  function candidate(overrides: Partial<CheckinCandidate> = {}): CheckinCandidate {
    return {
      weekIndex: 0,
      hasCheckin: false,
      summary: summarizeWeek([resolution({ status: 'completed', completedKm: 5 })]),
      ...overrides,
    };
  }

  it('sem nenhuma semana → null', () => {
    expect(getCheckinCandidateWeek([], 2)).toBeNull();
  });

  it('primeira semana sem check-in e totalmente resolvida vence, na ordem recebida', () => {
    const weeks: CheckinCandidate[] = [
      candidate({ weekIndex: 0, hasCheckin: true }), // já tem check-in — pula
      candidate({ weekIndex: 1, hasCheckin: false }), // candidata
      candidate({ weekIndex: 2, hasCheckin: false }),
    ];
    expect(getCheckinCandidateWeek(weeks, 5)).toBe(1);
  });

  it('semana não totalmente resolvida não é candidata mesmo sem check-in', () => {
    const weeks: CheckinCandidate[] = [
      candidate({ weekIndex: 0, hasCheckin: false, summary: summarizeWeek([resolution()]) }), // pending
    ];
    expect(getCheckinCandidateWeek(weeks, 3)).toBe(3); // cai na corrente
  });

  it('nenhuma semana elegível → cai na semana corrente, mesmo sem canCheckin', () => {
    const weeks: CheckinCandidate[] = [candidate({ weekIndex: 0, hasCheckin: true })];
    expect(getCheckinCandidateWeek(weeks, 7)).toBe(7);
  });
});
