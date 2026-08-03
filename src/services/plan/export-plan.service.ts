import type { AthleteProfile, TrainingPlan, Workout } from '@/domain/entities';
import type { ValidationReport } from '@/domain/motor-evo/validation';

/**
 * docs/fase-7-brief.md Grupo 3 — geração do HTML impresso em PDF real via
 * expo-print (export-plan.io.ts). Free exporta a planilha ativa; Plus (aqui,
 * `advanced`) soma execução (km feito/esforço/dor/feedback) e a auditoria da
 * IA (`plan.validation`, mesmos campos já lidos em src/app/plan/preview.tsx
 * e src/services/plan/plan-cycle.service.ts — nunca inventados aqui).
 * `advanced` só decide o CONTEÚDO; quem decide se o usuário pode pedir a
 * versão avançada é sempre `useEntitlement()`, fora deste arquivo.
 */
export interface PlanExportInput {
  plan: TrainingPlan;
  workouts: Workout[];
  athlete: AthleteProfile | null;
  advanced: boolean;
}

const STATUS_LABEL: Record<Workout['status'], string> = {
  pending: 'Pendente',
  completed: 'Concluído',
  skipped: 'Pulado',
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtKm(km: number | null | undefined): string {
  return km === null || km === undefined ? '-' : `${km.toFixed(1)} km`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

export function buildPlanExportFileName(plan: TrainingPlan): string {
  const base = plan.plan_name || plan.race_name || 'planilha-runevo';
  const slug = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
  return slug || 'planilha-runevo';
}

function buildWorkoutRows(workouts: Workout[], advanced: boolean): string {
  const sorted = [...workouts].sort((a, b) =>
    a.week_number !== b.week_number ? a.week_number - b.week_number : a.week_index - b.week_index,
  );
  return sorted
    .map((w) => {
      const baseCells = `
        <td>${w.week_number}</td>
        <td>${fmtDate(w.workout_date)}</td>
        <td>${escapeHtml(w.day_type ?? '-')}</td>
        <td>${escapeHtml(w.title ?? '-')}</td>
        <td>${fmtKm(w.planned_km)}</td>
        <td>${escapeHtml(w.planned_pace ?? '-')}</td>
        <td>${STATUS_LABEL[w.status]}</td>`;
      const advancedCells = advanced
        ? `
        <td>${fmtKm(w.completed_km)}</td>
        <td>${w.perceived_effort ?? '-'}</td>
        <td>${w.pain === true ? 'Sim' : w.pain === false ? 'Não' : '-'}</td>
        <td>${w.feedback ? escapeHtml(w.feedback) : '-'}</td>`
        : '';
      return `<tr>${baseCells}${advancedCells}</tr>`;
    })
    .join('\n');
}

function buildAuditSection(plan: TrainingPlan): string {
  const validation = plan.validation as unknown as ValidationReport | undefined;
  const summary = validation?.summary;
  const quality = validation?.quality;
  if (!summary && !quality) return '';

  const rows: string[] = [];
  if (summary?.qualityScore !== undefined) {
    rows.push(`<tr><th>Quality Score</th><td>${summary.qualityScore}/10 (${escapeHtml(summary.qualityStatus ?? '-')})</td></tr>`);
  }
  if (summary?.riskLevel) {
    rows.push(`<tr><th>Risco técnico</th><td>${escapeHtml(summary.riskLevel)}</td></tr>`);
  }
  if (summary?.riskReasons?.length) {
    rows.push(`<tr><th>Motivos do risco</th><td>${summary.riskReasons.map(escapeHtml).join('; ')}</td></tr>`);
  }
  if (summary?.totalKm !== undefined) {
    rows.push(`<tr><th>Km total planejado</th><td>${fmtKm(summary.totalKm)}</td></tr>`);
  }
  const peakKm = summary?.peakWeeklyKm ?? summary?.peakWeekKm;
  if (peakKm !== undefined) {
    rows.push(`<tr><th>Pico semanal</th><td>${fmtKm(peakKm)}</td></tr>`);
  }
  if (quality?.adoptionAdvice) {
    rows.push(`<tr><th>Recomendação da IA</th><td>${escapeHtml(quality.adoptionAdvice)}</td></tr>`);
  }
  if (!rows.length && !quality?.insights?.length) return '';

  const insights = quality?.insights?.length
    ? `<ul>${quality.insights.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`
    : '';
  return `<h2>Auditoria avançada (RunEvo+)</h2><table class="kv"><tbody>${rows.join('\n')}</tbody></table>${insights}`;
}

export function buildPlanExportHtml({ plan, workouts, athlete, advanced }: PlanExportInput): string {
  const advancedHeaderCells = advanced
    ? '<th>Executado</th><th>Esforço</th><th>Dor</th><th>Feedback</th>'
    : '';
  const athleteLine = athlete?.display_name ? `<p>Atleta: ${escapeHtml(athlete.display_name)}</p>` : '';
  const auditSection = advanced ? buildAuditSection(plan) : '';

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #111; padding: 24px; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  h2 { font-size: 16px; margin-top: 28px; }
  p { color: #444; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 11px; }
  th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; }
  thead th { background: #f0f0f0; }
  table.kv th { width: 180px; background: #f6f6f6; }
  ul { font-size: 11px; }
</style>
</head>
<body>
  <h1>${escapeHtml(plan.plan_name)}</h1>
  ${athleteLine}
  <p>Prova: ${escapeHtml(plan.race_name ?? '-')} · Distância: ${fmtKm(plan.race_distance_km)} · Data: ${fmtDate(plan.race_date)}</p>
  <table>
    <thead>
      <tr>
        <th>Semana</th><th>Data</th><th>Tipo</th><th>Treino</th><th>Km previstos</th><th>Ritmo</th><th>Status</th>${advancedHeaderCells}
      </tr>
    </thead>
    <tbody>
      ${buildWorkoutRows(workouts, advanced)}
    </tbody>
  </table>
  ${auditSection}
</body>
</html>`;
}
