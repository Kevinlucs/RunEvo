import * as XLSX from 'xlsx';
import type { AthleteProfile, TrainingPlan, Workout } from '@/domain/entities';
import type { ValidationReport } from '@/domain/motor-evo/validation';
import type { PlanExportInput } from './export-plan.service';

/**
 * docs/fase-7-brief.md Grupo 4 — Excel OOXML real via SheetJS (proibido HTML
 * disfarçado). `XLSX.write`/`XLSX.utils.*` são JS puro (sem código nativo),
 * então esta geração é testável direto — inclusive o round-trip
 * escrever→ler o próprio .xlsx (ver export-plan-excel.service.test.ts).
 * Célula numérica fica numérica (km, esforço) — não formatada como texto —
 * pra ser somável/filtrável de verdade no Excel/Sheets.
 */
const STATUS_LABEL: Record<Workout['status'], string> = {
  pending: 'Pendente',
  completed: 'Concluído',
  skipped: 'Pulado',
};

function buildPlanoSheet(plan: TrainingPlan, athlete: AthleteProfile | null): XLSX.WorkSheet {
  const rows: (string | number)[][] = [
    ['Plano', plan.plan_name],
    ['Atleta', athlete?.display_name ?? ''],
    ['Prova', plan.race_name ?? ''],
    ['Distância (km)', plan.race_distance_km ?? ''],
    ['Data da prova', plan.race_date ?? ''],
    ['Semanas', plan.total_weeks ?? ''],
    ['Dias por semana', plan.days_per_week ?? ''],
  ];
  return XLSX.utils.aoa_to_sheet(rows);
}

function buildTreinosSheet(workouts: Workout[], advanced: boolean): XLSX.WorkSheet {
  const sorted = [...workouts].sort((a, b) =>
    a.week_number !== b.week_number ? a.week_number - b.week_number : a.week_index - b.week_index,
  );
  const header = ['Semana', 'Data', 'Tipo', 'Treino', 'Km previstos', 'Ritmo', 'Status'];
  if (advanced) header.push('Km executado', 'Esforço', 'Dor', 'Feedback');

  const rows: (string | number)[][] = [header];
  for (const w of sorted) {
    const row: (string | number)[] = [
      w.week_number,
      w.workout_date ?? '',
      w.day_type ?? '',
      w.title ?? '',
      w.planned_km ?? '',
      w.planned_pace ?? '',
      STATUS_LABEL[w.status],
    ];
    if (advanced) {
      row.push(
        w.completed_km ?? '',
        w.perceived_effort ?? '',
        w.pain === true ? 'Sim' : w.pain === false ? 'Não' : '',
        w.feedback ?? '',
      );
    }
    rows.push(row);
  }
  return XLSX.utils.aoa_to_sheet(rows);
}

function buildAuditoriaSheet(plan: TrainingPlan): XLSX.WorkSheet | null {
  const validation = plan.validation as unknown as ValidationReport | undefined;
  const summary = validation?.summary;
  const quality = validation?.quality;
  const rows: (string | number)[][] = [];

  if (summary?.qualityScore !== undefined) rows.push(['Quality Score', summary.qualityScore]);
  if (summary?.qualityStatus) rows.push(['Status de qualidade', summary.qualityStatus]);
  if (summary?.riskLevel) rows.push(['Risco técnico', summary.riskLevel]);
  if (summary?.riskReasons?.length) rows.push(['Motivos do risco', summary.riskReasons.join('; ')]);
  if (summary?.totalKm !== undefined) rows.push(['Km total planejado', summary.totalKm]);
  const peakKm = summary?.peakWeeklyKm ?? summary?.peakWeekKm;
  if (peakKm !== undefined) rows.push(['Pico semanal (km)', peakKm]);
  if (quality?.adoptionAdvice) rows.push(['Recomendação da IA', quality.adoptionAdvice]);
  quality?.insights?.forEach((insight, i) => rows.push([`Insight ${i + 1}`, insight]));

  if (!rows.length) return null;
  return XLSX.utils.aoa_to_sheet(rows);
}

export function buildPlanExportWorkbook({ plan, workouts, athlete, advanced }: PlanExportInput): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildPlanoSheet(plan, athlete), 'Plano');
  XLSX.utils.book_append_sheet(wb, buildTreinosSheet(workouts, advanced), 'Treinos');
  if (advanced) {
    const auditoria = buildAuditoriaSheet(plan);
    if (auditoria) XLSX.utils.book_append_sheet(wb, auditoria, 'Auditoria');
  }
  return wb;
}

/** RN-safe: sem `fs`/Buffer, só a string base64 pra `export-plan.io.ts` escrever em disco. */
export function workbookToBase64(wb: XLSX.WorkBook): string {
  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) as string;
}
