import { supabase } from '@/lib/supabase';
import { AppError, err, ok, type Result } from '@/utils/result';

export type IntegrationProvider = 'strava';
export type IntegrationStatus =
  'connected' | 'expired' | 'reauth_required' | 'disconnected' | 'error';

export interface ConnectedAccountSummary {
  provider: IntegrationProvider;
  status: IntegrationStatus;
  connectedAt: string | null;
  lastSyncAt: string | null;
  activityEnrichment: boolean;
  lastError: string | null;
  history?: {
    scanned: number;
    total: number;
    percent: number;
    completed: boolean;
    phase: 'discovering' | 'processing' | 'waiting' | 'completed';
  };
}

interface IntegrationResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function callIntegrationApi<T>(
  action: string,
  input: Record<string, unknown> = {},
): Promise<Result<T>> {
  try {
    const { data, error } = await supabase.functions.invoke<IntegrationResponse<T>>(
      'integration-status',
      {
        body: { action, ...input },
      },
    );
    if (error)
      return err(
        new AppError('network', 'Não foi possível falar com o serviço de integrações.', error),
      );
    if (!data?.ok || data.data === undefined) {
      return err(new AppError('unknown', data?.error ?? 'Não foi possível concluir a operação.'));
    }
    return ok(data.data);
  } catch (error) {
    return err(
      new AppError('network', 'Não foi possível falar com o serviço de integrações.', error),
    );
  }
}

export async function listConnectedAccounts(): Promise<Result<ConnectedAccountSummary[]>> {
  return callIntegrationApi<ConnectedAccountSummary[]>('status');
}

export async function startStravaConnection(): Promise<Result<{ authorizeUrl: string }>> {
  try {
    const { data, error } = await supabase.functions.invoke<
      IntegrationResponse<{ authorizeUrl: string }>
    >('strava-oauth', { body: {} });
    if (error)
      return err(new AppError('network', 'Não foi possível iniciar a conexão com Strava.', error));
    if (!data?.ok || !data.data) {
      return err(
        new AppError('unknown', data?.error ?? 'Não foi possível iniciar a conexão com Strava.'),
      );
    }
    return ok(data.data);
  } catch (error) {
    return err(new AppError('network', 'Não foi possível iniciar a conexão com Strava.', error));
  }
}

export async function updateActivityEnrichment(
  enabled: boolean,
): Promise<Result<ConnectedAccountSummary>> {
  return callIntegrationApi<ConnectedAccountSummary>('set_activity_enrichment', { enabled });
}

export interface StravaSyncResult {
  processed: number;
  failed: number;
  remaining: number;
  history?: {
    scanned: number;
    imported: number;
    total: number;
    percent: number;
    nextPage: number;
    completed: boolean;
    phase: 'discovering' | 'processing' | 'waiting' | 'completed';
  };
}

export async function syncStravaActivities(): Promise<Result<StravaSyncResult>> {
  return callIntegrationApi<StravaSyncResult>('sync_strava_activities');
}

export async function disconnectStrava(): Promise<Result<void>> {
  return callIntegrationApi<void>('disconnect_strava');
}
