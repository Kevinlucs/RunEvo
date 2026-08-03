import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { ok, err, AppError, toAppError, type Result } from '@/utils/result';

/**
 * docs/fase-7-brief.md Grupo 3/4 — único ponto que toca `expo-print`/
 * `expo-sharing` (e, no Grupo 4, o arquivo Excel gerado). Mantém o resto do
 * app livre de módulos nativos de arquivo, mesmo padrão de isolamento de
 * `purchases.client.ts` para o RevenueCat.
 */
export async function generatePdfFile(html: string): Promise<Result<{ uri: string }>> {
  try {
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    return ok({ uri });
  } catch (e) {
    return err(toAppError(e, 'unknown'));
  }
}

export async function shareFile(uri: string, options: { mimeType: string; dialogTitle: string }): Promise<Result<void>> {
  try {
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      return err(new AppError('not_implemented', 'Compartilhamento de arquivos não está disponível neste dispositivo.'));
    }
    await Sharing.shareAsync(uri, options);
    return ok(undefined);
  } catch (e) {
    return err(toAppError(e, 'unknown'));
  }
}
