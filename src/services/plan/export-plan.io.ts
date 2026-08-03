import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
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

export async function writeBase64File(base64: string, fileName: string): Promise<Result<{ uri: string }>> {
  try {
    const uri = `${FileSystem.cacheDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
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
