import { buildPlanExportHtml, buildPlanExportFileName, type PlanExportInput } from './export-plan.service';
import { buildPlanExportWorkbook, workbookToBase64 } from './export-plan-excel.service';
import { generatePdfFile, writeBase64File, shareFile } from './export-plan.io';
import type { Result } from '@/utils/result';

const EXCEL_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

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

/**
 * docs/fase-7-brief.md Grupo 4 — Excel é gate Plus; quem decide se o usuário
 * PODE chamar esta função é a UI (useEntitlement()), este arquivo só monta o
 * .xlsx real (SheetJS) e compartilha, nunca finge sucesso se a escrita falhar.
 */
export async function exportPlanAsExcel(input: PlanExportInput): Promise<Result<void>> {
  const workbook = buildPlanExportWorkbook(input);
  const base64 = workbookToBase64(workbook);
  const fileName = `${buildPlanExportFileName(input.plan)}.xlsx`;
  const fileResult = await writeBase64File(base64, fileName);
  if (!fileResult.ok) return fileResult;
  return shareFile(fileResult.value.uri, { mimeType: EXCEL_MIME_TYPE, dialogTitle: fileName });
}
