/**
 * Testes headless de export-plan.io.ts (docs/fase-7-brief.md Grupo 3) — único
 * arquivo que importa expo-print/expo-sharing (nativos, exigem dev build).
 * Mockados por completo, mesmo padrão de purchases.client.test.ts.
 */
/* eslint-disable import/first */
const printToFileAsyncMock = jest.fn();
const isAvailableAsyncMock = jest.fn();
const shareAsyncMock = jest.fn();

jest.mock('expo-print', () => ({ printToFileAsync: printToFileAsyncMock }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: isAvailableAsyncMock, shareAsync: shareAsyncMock }));

import { generatePdfFile, shareFile } from '@/services/plan/export-plan.io';
/* eslint-enable import/first */

beforeEach(() => {
  jest.clearAllMocks();
});

describe('generatePdfFile', () => {
  it('gera o PDF via expo-print e devolve a uri', async () => {
    printToFileAsyncMock.mockResolvedValue({ uri: 'file:///tmp/plano.pdf' });

    const result = await generatePdfFile('<html></html>');

    expect(printToFileAsyncMock).toHaveBeenCalledWith({ html: '<html></html>', base64: false });
    expect(result).toEqual({ ok: true, value: { uri: 'file:///tmp/plano.pdf' } });
  });

  it('erro do expo-print propaga (nunca finge ter gerado o arquivo)', async () => {
    printToFileAsyncMock.mockRejectedValue(new Error('falha nativa'));

    const result = await generatePdfFile('<html></html>');

    expect(result.ok).toBe(false);
  });
});

describe('shareFile', () => {
  it('compartilhamento disponível → chama Sharing.shareAsync com as opções', async () => {
    isAvailableAsyncMock.mockResolvedValue(true);
    shareAsyncMock.mockResolvedValue(undefined);

    const result = await shareFile('file:///tmp/plano.pdf', { mimeType: 'application/pdf', dialogTitle: 'plano.pdf' });

    expect(shareAsyncMock).toHaveBeenCalledWith('file:///tmp/plano.pdf', { mimeType: 'application/pdf', dialogTitle: 'plano.pdf' });
    expect(result.ok).toBe(true);
  });

  it('compartilhamento indisponível no dispositivo → erro not_implemented, nunca finge sucesso', async () => {
    isAvailableAsyncMock.mockResolvedValue(false);

    const result = await shareFile('file:///tmp/plano.pdf', { mimeType: 'application/pdf', dialogTitle: 'plano.pdf' });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('not_implemented');
    expect(shareAsyncMock).not.toHaveBeenCalled();
  });

  it('erro do Sharing.shareAsync propaga', async () => {
    isAvailableAsyncMock.mockResolvedValue(true);
    shareAsyncMock.mockRejectedValue(new Error('cancelado pelo usuário'));

    const result = await shareFile('file:///tmp/plano.pdf', { mimeType: 'application/pdf', dialogTitle: 'plano.pdf' });

    expect(result.ok).toBe(false);
  });
});
