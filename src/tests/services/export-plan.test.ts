/**
 * Testes headless de export-plan.ts (docs/fase-7-brief.md Grupo 3) —
 * orquestração: monta HTML → gera PDF → compartilha. build/io mockados.
 */
/* eslint-disable import/first */
const buildPlanExportHtmlMock = jest.fn();
const buildPlanExportFileNameMock = jest.fn();
const generatePdfFileMock = jest.fn();
const shareFileMock = jest.fn();
const buildPlanExportWorkbookMock = jest.fn();
const workbookToBase64Mock = jest.fn();
const writeBase64FileMock = jest.fn();

jest.mock('@/services/plan/export-plan.service', () => ({
  buildPlanExportHtml: buildPlanExportHtmlMock,
  buildPlanExportFileName: buildPlanExportFileNameMock,
}));
jest.mock('@/services/plan/export-plan-excel.service', () => ({
  buildPlanExportWorkbook: buildPlanExportWorkbookMock,
  workbookToBase64: workbookToBase64Mock,
}));
jest.mock('@/services/plan/export-plan.io', () => ({
  generatePdfFile: generatePdfFileMock,
  writeBase64File: writeBase64FileMock,
  shareFile: shareFileMock,
}));

import { exportPlanAsPdf, exportPlanAsExcel } from '@/services/plan/export-plan';
import { ok, err, AppError } from '@/utils/result';
import type { PlanExportInput } from '@/services/plan/export-plan.service';
/* eslint-enable import/first */

const input = { plan: { plan_name: 'Plano X' }, workouts: [], athlete: null, advanced: false } as unknown as PlanExportInput;

beforeEach(() => {
  jest.clearAllMocks();
  buildPlanExportHtmlMock.mockReturnValue('<html></html>');
  buildPlanExportFileNameMock.mockReturnValue('plano-x');
});

describe('exportPlanAsPdf', () => {
  it('monta o html, gera o pdf e compartilha com o nome do arquivo', async () => {
    generatePdfFileMock.mockResolvedValue(ok({ uri: 'file:///tmp/x.pdf' }));
    shareFileMock.mockResolvedValue(ok(undefined));

    const result = await exportPlanAsPdf(input);

    expect(buildPlanExportHtmlMock).toHaveBeenCalledWith(input);
    expect(generatePdfFileMock).toHaveBeenCalledWith('<html></html>');
    expect(shareFileMock).toHaveBeenCalledWith('file:///tmp/x.pdf', { mimeType: 'application/pdf', dialogTitle: 'plano-x.pdf' });
    expect(result.ok).toBe(true);
  });

  it('falha ao gerar o PDF → propaga o erro e nunca chama shareFile', async () => {
    generatePdfFileMock.mockResolvedValue(err(new AppError('unknown', 'falha nativa')));

    const result = await exportPlanAsPdf(input);

    expect(result.ok).toBe(false);
    expect(shareFileMock).not.toHaveBeenCalled();
  });

  it('falha ao compartilhar → propaga o erro', async () => {
    generatePdfFileMock.mockResolvedValue(ok({ uri: 'file:///tmp/x.pdf' }));
    shareFileMock.mockResolvedValue(err(new AppError('not_implemented', 'sem compartilhamento')));

    const result = await exportPlanAsPdf(input);

    expect(result.ok).toBe(false);
  });
});

describe('exportPlanAsExcel', () => {
  beforeEach(() => {
    buildPlanExportWorkbookMock.mockReturnValue({ SheetNames: [] });
    workbookToBase64Mock.mockReturnValue('QkFTRTY0');
  });

  it('monta o workbook, escreve o .xlsx e compartilha com o nome do arquivo', async () => {
    writeBase64FileMock.mockResolvedValue(ok({ uri: 'file:///tmp/plano-x.xlsx' }));
    shareFileMock.mockResolvedValue(ok(undefined));

    const result = await exportPlanAsExcel(input);

    expect(buildPlanExportWorkbookMock).toHaveBeenCalledWith(input);
    expect(workbookToBase64Mock).toHaveBeenCalledWith({ SheetNames: [] });
    expect(writeBase64FileMock).toHaveBeenCalledWith('QkFTRTY0', 'plano-x.xlsx');
    expect(shareFileMock).toHaveBeenCalledWith('file:///tmp/plano-x.xlsx', {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'plano-x.xlsx',
    });
    expect(result.ok).toBe(true);
  });

  it('falha ao gravar o arquivo → propaga o erro e nunca chama shareFile', async () => {
    writeBase64FileMock.mockResolvedValue(err(new AppError('unknown', 'falha ao gravar')));

    const result = await exportPlanAsExcel(input);

    expect(result.ok).toBe(false);
    expect(shareFileMock).not.toHaveBeenCalled();
  });

  it('falha ao compartilhar → propaga o erro', async () => {
    writeBase64FileMock.mockResolvedValue(ok({ uri: 'file:///tmp/plano-x.xlsx' }));
    shareFileMock.mockResolvedValue(err(new AppError('not_implemented', 'sem compartilhamento')));

    const result = await exportPlanAsExcel(input);

    expect(result.ok).toBe(false);
  });
});
