import { buildPlanExportHtml, buildPlanExportFileName, type PlanExportInput } from './export-plan.service';
import { generatePdfFile, shareFile } from './export-plan.io';
import type { Result } from '@/utils/result';

/**
 * docs/fase-7-brief.md Grupo 3 — orquestra a exportação em PDF: monta o HTML
 * (puro, testável), gera o arquivo real via expo-print e abre o compartilha-
 * mento nativo (expo-sharing). `input.advanced` decide o conteúdo (execução +
 * auditoria da IA); a decisão de LIBERAR `advanced` é do chamador
 * (`useEntitlement()` na tela), nunca deste arquivo.
 */
export async function exportPlanAsPdf(input: PlanExportInput): Promise<Result<void>> {
  const html = buildPlanExportHtml(input);
  const pdfResult = await generatePdfFile(html);
  if (!pdfResult.ok) return pdfResult;
  const fileName = buildPlanExportFileName(input.plan);
  return shareFile(pdfResult.value.uri, { mimeType: 'application/pdf', dialogTitle: `${fileName}.pdf` });
}
