/**
 * Testes headless de export-plan-excel.service.ts (docs/fase-7-brief.md
 * Grupo 4) — "proibido HTML disfarçado": estes testes escrevem o .xlsx de
 * verdade (via SheetJS) e leem de volta com o mesmo parser OOXML, conferindo
 * abas e células — não bastaria a string conter "xlsx" no nome.
 */
import * as XLSX from 'xlsx';
import { buildPlanExportWorkbook, workbookToBase64 } from '@/services/plan/export-plan-excel.service';
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

describe('buildPlanExportWorkbook — Free', () => {
  it('gera um .xlsx real: abre com o parser OOXML e as abas/células batem', () => {
    const wb = buildPlanExportWorkbook({ plan: mkPlan(), workouts: [mkWorkout()], athlete, advanced: false });
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    const readBack = XLSX.read(buffer, { type: 'buffer' });

    expect(readBack.SheetNames).toEqual(['Plano', 'Treinos']);
    const plano = XLSX.utils.sheet_to_json<string[]>(readBack.Sheets.Plano!, { header: 1 });
    expect(plano[0]).toEqual(['Plano', 'Maratona de SP']);
    const treinos = XLSX.utils.sheet_to_json<(string | number)[]>(readBack.Sheets.Treinos!, { header: 1 });
    expect(treinos[0]).toEqual(['Semana', 'Data', 'Tipo', 'Treino', 'Km previstos', 'Ritmo', 'Status']);
    expect(treinos[1]).toEqual([1, '2026-01-05', 'Base', 'Corrida leve', 8, '5:30', 'Concluído']);
  });

  it('Free não inclui aba de Auditoria nem colunas de execução', () => {
    const wb = buildPlanExportWorkbook({ plan: mkPlan(), workouts: [mkWorkout()], athlete, advanced: false });
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    const readBack = XLSX.read(buffer, { type: 'buffer' });

    expect(readBack.SheetNames).not.toContain('Auditoria');
    const treinos = XLSX.utils.sheet_to_json<string[]>(readBack.Sheets.Treinos!, { header: 1 });
    expect(treinos[0]).not.toContain('Esforço');
  });
});

describe('buildPlanExportWorkbook — advanced (Plus)', () => {
  it('inclui execução (km executado/esforço/dor/feedback) como células reais', () => {
    const wb = buildPlanExportWorkbook({ plan: mkPlan(), workouts: [mkWorkout()], athlete, advanced: true });
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    const readBack = XLSX.read(buffer, { type: 'buffer' });

    const treinos = XLSX.utils.sheet_to_json<(string | number)[]>(readBack.Sheets.Treinos!, { header: 1 });
    expect(treinos[0]).toEqual(['Semana', 'Data', 'Tipo', 'Treino', 'Km previstos', 'Ritmo', 'Status', 'Km executado', 'Esforço', 'Dor', 'Feedback']);
    expect(treinos[1]).toEqual([1, '2026-01-05', 'Base', 'Corrida leve', 8, '5:30', 'Concluído', 8.2, 6, 'Não', 'Tranquilo']);
  });

  it('inclui aba de Auditoria quando plan.validation tem summary/quality', () => {
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
    const wb = buildPlanExportWorkbook({ plan, workouts: [mkWorkout()], athlete, advanced: true });
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    const readBack = XLSX.read(buffer, { type: 'buffer' });

    expect(readBack.SheetNames).toContain('Auditoria');
    const auditoria = XLSX.utils.sheet_to_json<(string | number)[]>(readBack.Sheets.Auditoria!, { header: 1 });
    expect(auditoria).toContainEqual(['Quality Score', 8.5]);
    expect(auditoria).toContainEqual(['Risco técnico', 'baixo']);
    expect(auditoria).toContainEqual(['Insight 1', 'Progressão de volume consistente']);
  });

  it('sem plan.validation preenchido → não cria aba de Auditoria vazia', () => {
    const wb = buildPlanExportWorkbook({ plan: mkPlan(), workouts: [mkWorkout()], athlete, advanced: true });
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    const readBack = XLSX.read(buffer, { type: 'buffer' });

    expect(readBack.SheetNames).not.toContain('Auditoria');
  });
});

describe('workbookToBase64', () => {
  it('produz uma string base64 que, decodificada, é um .xlsx OOXML válido', () => {
    const wb = buildPlanExportWorkbook({ plan: mkPlan(), workouts: [mkWorkout()], athlete, advanced: false });

    const base64 = workbookToBase64(wb);
    const buffer = Buffer.from(base64, 'base64');
    const readBack = XLSX.read(buffer, { type: 'buffer' });

    expect(readBack.SheetNames).toEqual(['Plano', 'Treinos']);
  });
});
