/**
 * Testes de equivalência do Adaptive Training (Fase 2, Grupo F) — TS novo vs.
 * `legacy/app.js`, via `legacy-adaptive-harness.ts` (extração por linha +
 * stubs para os globais fora do fechamento autorizado — ver o harness).
 *
 * Cobertura: todos os branches de guardrail citados na spec §18 — dor nunca
 * aumenta; esforço ≥9/"muito_pesado" nunca aumenta; aderência <60% reduz;
 * aumento adicional clamped 1-3%; semana perfeita+leve mantém; redistribuição
 * de pulados 30-50% do skip limitada a ~12% da semana seguinte; nunca mexe na
 * semana da prova; `applyAdjustment` só semanas futuras, nunca a prova.
 */
import { loadLegacyAdaptive } from './legacy-adaptive-harness';
import {
  recommendAdjustment,
  normalizeAICheckinRecommendation,
  redistributeSkipped,
  applyAdjustment,
  type AdjustmentAction,
  type Feeling,
} from '../../domain/motor-evo/adaptive-training';
import type { Week } from '../../domain/motor-evo/types';

const legacy = loadLegacyAdaptive();

describe('adaptive-training — recommendAdjustment vs. getLocalAdjustmentRecommendation', () => {
  const cases: {
    label: string;
    pain: boolean;
    effort: number;
    feeling: Feeling;
    skipped: number;
    completionRate: number;
  }[] = [
    { label: 'dor → recovery', pain: true, effort: 3, feeling: 'leve', skipped: 0, completionRate: 1 },
    { label: 'skip com aderência ok → maintain (redistribui)', pain: false, effort: 6, feeling: 'normal', skipped: 1, completionRate: 0.8 },
    { label: 'aderência < 60% → reduce', pain: false, effort: 6, feeling: 'normal', skipped: 0, completionRate: 0.5 },
    { label: 'aderência exatamente 60% → não reduz por aderência', pain: false, effort: 6, feeling: 'normal', skipped: 0, completionRate: 0.6 },
    { label: 'esforço ≥9 → reduce', pain: false, effort: 9, feeling: 'normal', skipped: 0, completionRate: 1 },
    { label: 'sensação muito_pesado → reduce', pain: false, effort: 6, feeling: 'muito_pesado', skipped: 0, completionRate: 1 },
    { label: 'semana perfeita + leve → maintain', pain: false, effort: 5, feeling: 'leve', skipped: 0, completionRate: 1 },
    { label: 'default → maintain', pain: false, effort: 4, feeling: 'normal', skipped: 0, completionRate: 1 },
  ];

  it.each(cases)('$label', ({ pain, effort, feeling, skipped, completionRate }) => {
    const feedback = { pain, effort, feeling };
    const summary = { skipped, completionRate };
    const newRec = recommendAdjustment(feedback, summary);
    const legacyRec = legacy.getLocalAdjustmentRecommendation(0, {
      ...feedback,
      summary: { ...summary, averageEffort: effort },
    });
    expect(newRec).toEqual(legacyRec);
  });
});

describe('adaptive-training — normalizeAICheckinRecommendation guardrails vs. legado', () => {
  // `local` é recomputado por caso, a partir do MESMO feedback passado a
  // `normalizeAICheckinRecommendation` — é assim que o caller real
  // (submit-checkin.service.ts) sempre chama as duas funções. Um `local`
  // hoisted/desacoplado (como antes) não é uma entrada válida para o guardrail
  // de piso positivo (Fase 7.5): o piso só protege de verdade se refletir a
  // recomendação local para o MESMO check-in, não para um feedback diferente.
  const cases: { label: string; ai: Record<string, unknown> | null; feedback: Record<string, unknown> }[] = [
    {
      label: 'dor + IA sugere slight_increase → força recovery',
      ai: { action: 'slight_increase', adjustmentPercent: 5 },
      feedback: { pain: true, effort: 6, feeling: 'normal', summary: { averageEffort: 6, completionRate: 1 } },
    },
    {
      label: 'esforço ≥9 + IA sugere slight_increase → nunca aumenta',
      ai: { action: 'slight_increase', adjustmentPercent: 5 },
      feedback: { pain: false, effort: 9, feeling: 'normal', summary: { averageEffort: 9, completionRate: 1 } },
    },
    {
      label: 'aderência <60% + IA sugere slight_increase → nunca aumenta',
      ai: { action: 'slight_increase', adjustmentPercent: 5 },
      feedback: { pain: false, effort: 5, feeling: 'normal', summary: { averageEffort: 5, completionRate: 0.5 } },
    },
    {
      label: 'semana perfeita+leve + IA sugere reduce → mantém',
      ai: { action: 'reduce', adjustmentPercent: 15 },
      feedback: { pain: false, effort: 4, feeling: 'leve', summary: { averageEffort: 4, completionRate: 1 } },
    },
    {
      label: 'recovery clamped 15-30%',
      ai: { action: 'recovery', adjustmentPercent: 40 },
      feedback: { pain: false, effort: 4, feeling: 'normal', summary: { averageEffort: 4, completionRate: 1 } },
    },
    {
      label: 'reduce clamped 5-20%',
      ai: { action: 'reduce', adjustmentPercent: 2 },
      feedback: { pain: false, effort: 6, feeling: 'normal', summary: { averageEffort: 6, completionRate: 0.8 } },
    },
    {
      label: 'slight_increase clamped 1-3% (aumento adicional máx +3%)',
      ai: { action: 'slight_increase' },
      feedback: { pain: false, effort: 3, feeling: 'normal', summary: { averageEffort: 3, completionRate: 1 } },
    },
    {
      label: 'ação inválida da IA cai pra recomendação local',
      ai: { action: 'bogus_action', adjustmentPercent: 5 },
      feedback: { pain: false, effort: 6, feeling: 'normal', summary: { averageEffort: 6, completionRate: 1 } },
    },
    {
      label: 'ai null usa recomendação local como base',
      ai: null,
      feedback: { pain: false, effort: 6, feeling: 'normal', summary: { averageEffort: 6, completionRate: 1 } },
    },
    {
      label: 'weeksToAdjust clamped 1-2; coachTip/reason/confidence repassados',
      ai: { action: 'recovery', adjustmentPercent: 50, weeksToAdjust: 5, coachTip: 'beba agua', reason: 'x', messageToUser: 'y', confidence: 'alta' },
      feedback: { pain: false, effort: 6, feeling: 'normal', summary: { averageEffort: 6, completionRate: 1 } },
    },
  ];

  it.each(cases)('$label', ({ ai, feedback }) => {
    const fb = feedback as { pain: boolean; effort: number; feeling: Feeling; summary: { completionRate: number } };
    const local = recommendAdjustment(
      { pain: fb.pain, effort: fb.effort, feeling: fb.feeling },
      { skipped: 0, completionRate: fb.summary.completionRate },
    );
    const newRec = normalizeAICheckinRecommendation(ai as never, feedback as never, local);
    const legacyRec = legacy.normalizeAICheckinRecommendation(ai, feedback, local as never);
    expect(newRec).toEqual(legacyRec);
  });
});

describe('adaptive-training — normalizeAICheckinRecommendation piso positivo (Fase 7.5, desvio consciente do legado)', () => {
  // Achado do teste ao vivo obrigatório (dev build, Gemini real): pain=true +
  // effort=9 + IA sugeriu "maintain" (não "slight_increase") → o guardrail
  // antigo (lista de casos proibidos, só via `action === 'slight_increase'`)
  // deixava passar direto, aplicando "Plano mantido" a um atleta com dor
  // reportada. O legado tinha o mesmo furo (mesma checagem literal) — corrigido
  // aqui por segurança do atleta, com a lacuna documentada em
  // docs/motor-equivalence-report.md.
  it('(a) caso do teste ao vivo: dor + esforço 9 + IA=maintain, local=recovery → recovery', () => {
    const feedback = { pain: true, effort: 9, feeling: 'normal' as Feeling, summary: { averageEffort: 9, completionRate: 1 } };
    const local = recommendAdjustment(
      { pain: feedback.pain, effort: feedback.effort, feeling: feedback.feeling },
      { skipped: 0, completionRate: feedback.summary.completionRate },
    );
    expect(local.action).toBe('recovery');

    const result = normalizeAICheckinRecommendation({ action: 'maintain', adjustmentPercent: 0 }, feedback, local);
    expect(result.action).toBe('recovery');

    // Confirma que o legado (e o port antes desta correção) ficava preso em
    // "maintain" para esta mesma entrada — a lacuna real que motivou o desvio.
    const legacyRec = legacy.normalizeAICheckinRecommendation({ action: 'maintain', adjustmentPercent: 0 }, feedback, local as never) as {
      action: string;
    };
    expect(legacyRec.action).toBe('maintain');
  });

  it('(b) dor + IA=slight_increase → recovery (caso antigo continua passando)', () => {
    const feedback = { pain: true, effort: 6, feeling: 'normal' as Feeling, summary: { averageEffort: 6, completionRate: 1 } };
    const local = recommendAdjustment(
      { pain: feedback.pain, effort: feedback.effort, feeling: feedback.feeling },
      { skipped: 0, completionRate: feedback.summary.completionRate },
    );
    const result = normalizeAICheckinRecommendation({ action: 'slight_increase', adjustmentPercent: 5 }, feedback, local);
    expect(result.action).toBe('recovery');
  });

  it('(c) aderência <60% + IA=maintain, local=reduce → reduce', () => {
    const feedback = { pain: false, effort: 5, feeling: 'normal' as Feeling, summary: { averageEffort: 5, completionRate: 0.5 } };
    const local = recommendAdjustment(
      { pain: feedback.pain, effort: feedback.effort, feeling: feedback.feeling },
      { skipped: 0, completionRate: feedback.summary.completionRate },
    );
    expect(local.action).toBe('reduce');

    const result = normalizeAICheckinRecommendation({ action: 'maintain', adjustmentPercent: 0 }, feedback, local);
    expect(result.action).toBe('reduce');
  });

  it('(d) semana boa sem sinais de risco + IA=slight_increase → permanece slight_increase', () => {
    const feedback = { pain: false, effort: 4, feeling: 'normal' as Feeling, summary: { averageEffort: 4, completionRate: 1 } };
    const local = recommendAdjustment(
      { pain: feedback.pain, effort: feedback.effort, feeling: feedback.feeling },
      { skipped: 0, completionRate: feedback.summary.completionRate },
    );
    const result = normalizeAICheckinRecommendation({ action: 'slight_increase', adjustmentPercent: 3 }, feedback, local);
    expect(result.action).toBe('slight_increase');
  });
});

function buildWeek(workouts: { dayType: string; km: number }[]): Week {
  return {
    week: 'S2',
    phase: 'Base',
    off: false,
    workouts: workouts.map((w) => ({
      dayOfWeek: 'Terça',
      dayType: w.dayType as never,
      title: 't',
      desc: 'x',
      km: w.km,
      pace: '5:00/km',
    })),
  };
}

describe('adaptive-training — redistributeSkipped vs. applySkippedWorkoutRedistribution', () => {
  const cases: {
    label: string;
    effort: number;
    pain: boolean;
    isRace: boolean;
    skippedKm: number[];
    week: Week | null;
  }[] = [
    {
      label: 'esforço moderado (6) → ratio 0.4, distribui por Base+Longão',
      effort: 6,
      pain: false,
      isRace: false,
      skippedKm: [5],
      week: buildWeek([
        { dayType: 'Base', km: 5 },
        { dayType: 'Longão', km: 8 },
      ]),
    },
    { label: 'dor → ratio 0 (nada redistribuído)', effort: 6, pain: true, isRace: false, skippedKm: [5], week: buildWeek([{ dayType: 'Base', km: 5 }, { dayType: 'Longão', km: 8 }]) },
    { label: 'esforço baixo (≤5) → ratio 0.5', effort: 3, pain: false, isRace: false, skippedKm: [6], week: buildWeek([{ dayType: 'Base', km: 5 }, { dayType: 'Qualidade', km: 4 }, { dayType: 'Longão', km: 10 }]) },
    { label: 'esforço alto (>7) → ratio 0.3, múltiplos treinos pulados', effort: 8, pain: false, isRace: false, skippedKm: [4, 3], week: buildWeek([{ dayType: 'Base', km: 5 }, { dayType: 'Longão', km: 8 }]) },
    { label: 'semana seguinte é a semana da prova → nunca mexe no treino final', effort: 6, pain: false, isRace: true, skippedKm: [5], week: buildWeek([{ dayType: 'Base', km: 5 }, { dayType: 'Longão', km: 21 }]) },
    { label: 'nada pulado → não aplica', effort: 6, pain: false, isRace: false, skippedKm: [], week: buildWeek([{ dayType: 'Base', km: 5 }]) },
    { label: 'sem semana seguinte → não aplica', effort: 6, pain: false, isRace: false, skippedKm: [5], week: null },
  ];

  it.each(cases)('$label', ({ effort, pain, isRace, skippedKm, week }) => {
    const newResult = redistributeSkipped(week, isRace, 'S1', skippedKm, effort, effort, pain);

    const statuses: Record<string, string> = {};
    const summaryWorkouts = skippedKm.map((km, idx) => {
      const id = `skip-${idx}`;
      statuses[id] = 'skipped';
      return { id, km };
    });
    legacy.setWorkoutStatuses(statuses);
    const trailingWeek = { week: 'S3', phase: 'Base', off: false, workouts: [] };
    legacy.setTestPlan(
      (week
        ? {
            weeks: isRace
              ? [{ week: 'S1', phase: 'Base', off: false, workouts: [] }, week]
              : [{ week: 'S1', phase: 'Base', off: false, workouts: [] }, week, trailingWeek],
          }
        : null) as never,
    );
    const legacyResult = legacy.applySkippedWorkoutRedistribution(0, {
      effort,
      pain,
      summary: { workouts: summaryWorkouts, averageEffort: effort },
    }) as { applied: boolean; addedKm: number; targetWeek: string | null; skippedKm?: number };

    expect(newResult.applied).toBe(legacyResult.applied);
    expect(newResult.addedKm).toBe(legacyResult.addedKm);
    expect(newResult.targetWeek).toBe(legacyResult.targetWeek);

    if (newResult.applied) {
      expect(newResult.skippedKm).toBe(legacyResult.skippedKm);
      const savedPlan = legacy.getLastSavedPlan() as {
        weeks: { workouts: { km: number; redistributedFromSkipped?: boolean }[] }[];
      } | null;
      const legacyWorkouts = savedPlan?.weeks[1]?.workouts;
      expect(newResult.week?.workouts.map((w) => w.km)).toEqual(legacyWorkouts?.map((w) => w.km));
      expect(newResult.week?.workouts.map((w) => Boolean(w.redistributedFromSkipped))).toEqual(
        legacyWorkouts?.map((w) => Boolean(w.redistributedFromSkipped)),
      );
    }
  });
});

function buildPlanWeeks(n: number, kmPerWeek: number): Week[] {
  return Array.from({ length: n }, (_, i) => ({
    week: `S${i + 1}`,
    phase: 'Base',
    off: false,
    workouts: [
      { dayOfWeek: 'Terça', dayType: 'Base' as const, title: 't', desc: 'x', km: kmPerWeek, pace: '5:00/km' },
      { dayOfWeek: 'Sábado', dayType: 'Longão' as const, title: 'l', desc: 'y', km: kmPerWeek * 2, pace: '5:30/km' },
    ],
  }));
}

describe('adaptive-training — applyAdjustment vs. applyAdjustmentToStoredPlan', () => {
  const cases: { label: string; weekIndex: number; factor: number; action: AdjustmentAction; weeksToAdjust: number }[] = [
    { label: 'reduce 1 semana futura', weekIndex: 0, factor: 0.85, action: 'reduce', weeksToAdjust: 1 },
    { label: 'recovery 2 semanas futuras (off=true, phase→Base)', weekIndex: 0, factor: 0.75, action: 'recovery', weeksToAdjust: 2 },
    { label: 'maintain + factor=1 → no-op', weekIndex: 1, factor: 1, action: 'maintain', weeksToAdjust: 1 },
    { label: 'slight_increase', weekIndex: 0, factor: 1.03, action: 'slight_increase', weeksToAdjust: 1 },
    { label: 'sem semanas futuras disponíveis (start > end)', weekIndex: 3, factor: 0.85, action: 'reduce', weeksToAdjust: 1 },
  ];

  it.each(cases)('$label', ({ weekIndex, factor, action, weeksToAdjust }) => {
    const weeks = buildPlanWeeks(4, 10);
    const newResult = applyAdjustment(weeks, weekIndex, factor, action, weeksToAdjust);

    const legacyWeeks = buildPlanWeeks(4, 10);
    legacy.setTestPlan({ weeks: legacyWeeks } as never);
    const legacyApplied = legacy.applyAdjustmentToStoredPlan(weekIndex, factor, action, weeksToAdjust);
    const legacySavedPlan = legacy.getLastSavedPlan() as { weeks: Week[] } | null;

    expect(newResult.applied).toBe(legacyApplied);
    if (newResult.applied) {
      expect(newResult.weeks.map((w) => w.workouts.map((wo) => wo.km))).toEqual(
        legacySavedPlan?.weeks.map((w) => w.workouts.map((wo) => wo.km)),
      );
      expect(newResult.weeks.map((w) => [w.off, w.phase])).toEqual(legacySavedPlan?.weeks.map((w) => [w.off, w.phase]));
      // nunca mexe na semana da prova (última semana, último treino)
      const raceWorkout = newResult.weeks[newResult.weeks.length - 1]?.workouts.slice(-1)[0];
      expect(raceWorkout?.km).toBe(20);
    }
  });
});
