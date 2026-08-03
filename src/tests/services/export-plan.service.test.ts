/**
 * Testes headless de export-plan.service.ts (docs/fase-7-brief.md Grupo 3) —
 * geração de HTML é lógica pura, sem tocar expo-print/expo-sharing (isso é
 * export-plan.io.ts). Free vs. Plus (`advanced`) decide o CONTEÚDO; quem
 * decide se o usuário pode pedir `advanced` é useEntitlement(), fora daqui.
 */
import { buildPlanExportHtml, buildPlanExportFileName, escapeHtml } from '@/services/plan/export-plan.service';
import type { AthleteProfile, TrainingPlan, Workout } from '@/domain/entities';

function mkPlan(overrides: Partial<TrainingPlan> = {}): TrainingPlan {
  return {
    id: 'plan-1',
    user_id: 'user-1',
    plan_name: 'Maratona de SP',
    race_name: 'Maratona Internacional de São Paulo',
    race_distance_km: 42.2,
    start_date: '2026-01-01',
    race_date: '2026-06-01',
    total_weeks: 16,
    days_per_week: 5,
    objective: 'completar',
    terrain: 'misto',
    status: 'active',
    user_data: {},
    blueprint: {},
    validation: {},
    quality: {},
    risk: {},
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function mkWorkout(overrides: Partial<Workout> = {}): Workout {
  return {
    id: 'w-1',
    plan_id: 'plan-1',
    user_id: 'user-1',
    week_number: 1,
    week_index: 0,
    phase: 'Base',
    workout_date: '2026-01-05',
    day_label: 'Segunda',
    day_type: 'Base',
    title: 'Corrida leve',
    description: null,
    planned_km: 8,
    planned_pace: '5:30',
    status: 'completed',
    completed_km: 8.2,
    perceived_effort: 6,
    feeling: 'bem',
    pain: false,
    feedback: 'Tranquilo',
    shoe_id: null,
    completed_at: '2026-01-05T12:00:00.000Z',
    updated_at: '2026-01-05T12:00:00.000Z',
    ...overrides,
  };
}

const athlete: AthleteProfile = {
  id: 'user-1',
  display_name: 'Kevin',
  avatar_url: null,
  birth_date: null,
  height_cm: 175,
  current_weight_kg: 70,
  imc: 22.9,
  preferred_unit: 'km',
  language: 'pt-BR',
  theme: 'dark',
  onboarding_seen: true,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

describe('buildPlanExportHtml', () => {
  it('inclui nome do plano, atleta e treinos na versão Free', () => {
    const html = buildPlanExportHtml({ plan: mkPlan(), workouts: [mkWorkout()], athlete, advanced: false });

    expect(html).toContain('Maratona de SP');
    expect(html).toContain('Atleta: Kevin');
    expect(html).toContain('Corrida leve');
    expect(html).toContain('8.0 km');
  });

  it('versão Free não inclui colunas de execução nem auditoria', () => {
    const html = buildPlanExportHtml({ plan: mkPlan(), workouts: [mkWorkout()], athlete, advanced: false });

    expect(html).not.toContain('Auditoria avançada');
    expect(html).not.toContain('Esforço');
  });

  it('versão advanced (Plus) inclui execução (km feito/esforço/feedback)', () => {
    const html = buildPlanExportHtml({ plan: mkPlan(), workouts: [mkWorkout()], athlete, advanced: true });

    expect(html).toContain('Esforço');
    expect(html).toContain('8.2 km');
    expect(html).toContain('Tranquilo');
  });

  it('versão advanced inclui auditoria da IA quando plan.validation tem summary/quality', () => {
    const plan = mkPlan({
      validation: {
        status: 'ok',
        checkedAt: '2026-01-01T00:00:00.000Z',
        issues: [],
        fixed: [],
        warnings: [],
        summary: { totalIssues: 0, totalFixes: 0, totalWarnings: 0, qualityScore: 8.5, qualityStatus: 'boa', riskLevel: 'baixo', riskReasons: ['nada a reportar'] },
        quality: { version: '1', overall: 8.5, status: 'boa', adoptionAdvice: 'Pode adotar com confiança.', metrics: {} as never, details: {} as never, insights: ['Progressão de volume consistente'] },
      } as unknown as TrainingPlan['validation'],
    });
    const html = buildPlanExportHtml({ plan, workouts: [mkWorkout()], athlete, advanced: true });

    expect(html).toContain('Auditoria avançada (RunEvo+)');
    expect(html).toContain('8.5/10');
    expect(html).toContain('baixo');
    expect(html).toContain('Pode adotar com confiança.');
    expect(html).toContain('Progressão de volume consistente');
  });

  it('sem plan.validation preenchido → não injeta seção de auditoria vazia', () => {
    const html = buildPlanExportHtml({ plan: mkPlan(), workouts: [mkWorkout()], athlete, advanced: true });

    expect(html).not.toContain('Auditoria avançada');
  });

  it('escapa HTML de campos livres do usuário (feedback/título) — nunca injeta markup', () => {
    const workout = mkWorkout({ title: '<script>alert(1)</script>', feedback: 'ótimo & "rápido"' });
    const html = buildPlanExportHtml({ plan: mkPlan(), workouts: [workout], athlete, advanced: true });

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
    expect(html).toContain('&quot;');
  });

  it('sem athlete (null) → não quebra e omite a linha de atleta', () => {
    const html = buildPlanExportHtml({ plan: mkPlan(), workouts: [mkWorkout()], athlete: null, advanced: false });

    expect(html).not.toContain('Atleta:');
  });
});

describe('escapeHtml', () => {
  it('escapa os cinco caracteres especiais de HTML', () => {
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
  });
});

describe('buildPlanExportFileName', () => {
  it('normaliza acentos/espaços/caixa pro nome do arquivo', () => {
    expect(buildPlanExportFileName(mkPlan({ plan_name: 'Maratona de São Paulo!' }))).toBe('maratona-de-sao-paulo');
  });

  it('sem plan_name, usa race_name; sem nenhum, usa fallback fixo', () => {
    expect(buildPlanExportFileName(mkPlan({ plan_name: '', race_name: 'Prova X' }))).toBe('prova-x');
    expect(buildPlanExportFileName(mkPlan({ plan_name: '', race_name: null }))).toBe('planilha-runevo');
  });
});
