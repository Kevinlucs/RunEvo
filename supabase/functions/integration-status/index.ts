import { createClient } from 'npm:@supabase/supabase-js@2';
import { integrationFlags } from '../_shared/integration-flags.ts';
import { processPendingStravaEvents, syncStravaHistoryPage } from '../_shared/strava-activity-sync.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Provider = 'strava' | 'garmin';
type GatewayResponse<T> = { ok: boolean; data?: T; error?: string };
type GarminGatewayConfig = { url: string; hmacSecret: string };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function configured(): { url: string; anon: string; service: string } | null {
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  return url && anon && service ? { url, anon, service } : null;
}

function gatewayConfig(): GarminGatewayConfig | null {
  const url = Deno.env.get('WATCH_GATEWAY_URL')?.replace(/\/$/, '');
  const hmacSecret = Deno.env.get('WATCH_GATEWAY_HMAC_SECRET');
  return url && hmacSecret ? { url, hmacSecret } : null;
}

function summary(row: any): Record<string, unknown> {
  return {
    provider: row.provider,
    status: row.status,
    connectedAt: row.connected_at,
    lastSyncAt: row.last_sync_at,
    activityEnrichment: Boolean(row.settings?.activity_enrichment),
    lastError: row.last_error,
  };
}

function disconnected(provider: Provider): Record<string, unknown> {
  return { provider, status: 'disconnected', connectedAt: null, lastSyncAt: null, activityEnrichment: false, lastError: null };
}

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function sha256(value: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

async function hmacSha256(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return toHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
}

/**
 * Única ponte da Edge Function para o gateway. O app nunca recebe credenciais
 * Garmin, cookies ou tokens. Cada chamada é autenticada por HMAC e nonce.
 */
async function callGarminGateway<T>(
  path: string,
  userId: string,
  payload: Record<string, unknown>,
): Promise<{ response: GatewayResponse<T>; status: number }> {
  const config = gatewayConfig();
  if (!config) return { response: { ok: false, error: 'Gateway Garmin indisponível.' }, status: 503 };

  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomUUID();
  const bodyHash = await sha256(body);
  const canonical = `POST\n${path}\n${timestamp}\n${nonce}\n${userId}\n${bodyHash}`;
  const signature = await hmacSha256(config.hmacSecret, canonical);

  try {
    const response = await fetch(`${config.url}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-RunEvo-Timestamp': timestamp,
        'X-RunEvo-Nonce': nonce,
        'X-RunEvo-User-Id': userId,
        'X-RunEvo-Signature': signature,
      },
      body,
      signal: AbortSignal.timeout(35_000),
    });
    const data = await response.json().catch(() => ({ ok: false, error: 'Resposta inválida do gateway.' })) as GatewayResponse<T>;
    return { response: data, status: response.status };
  } catch {
    return { response: { ok: false, error: 'Gateway Garmin indisponível.' }, status: 503 };
  }
}

function gatewayMessage(status: number, error?: string): string {
  if (status === 401 || status === 403) return 'Sua conexão Garmin precisa ser refeita.';
  if (status === 409) return 'Já existe uma sincronização em andamento para este treino.';
  if (status === 429) return 'O Garmin limitou temporariamente as solicitações. Aguarde alguns minutos.';
  if (status >= 500) return 'O Garmin está indisponível no momento. Tente novamente mais tarde.';
  return error || 'Não foi possível concluir a operação com o Garmin.';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ ok: false, error: 'Método não permitido.' }, 405);

  const environment = configured();
  if (!environment) return json({ ok: false, error: 'Serviço de integrações não configurado.' }, 503);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ ok: false, error: 'Sessão inválida.' }, 401);

  const userClient = createClient(environment.url, environment.anon, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ ok: false, error: 'Sessão inválida.' }, 401);

  let body: { action?: string; enabled?: boolean; workoutId?: string; scheduledDate?: string };
  try { body = await req.json(); } catch { return json({ ok: false, error: 'Solicitação inválida.' }, 400); }

  const db = createClient(environment.url, environment.service);
  const userId = userData.user.id;

  // ============ GARMIN ==========
  if (body.action === 'garmin_status') {
    const { data: account, error: accountError } = await db.from('connected_accounts')
      .select('status,last_error,token_ciphertext')
      .eq('user_id', userId)
      .eq('provider', 'garmin')
      .maybeSingle();

    if (accountError) return json({ ok: false, error: 'Não foi possível consultar a conexão Garmin.' }, 500);

    // Sessões antigas eram cookies/formatos inválidos. Elas não têm permissão
    // de escrita e jamais podem ser interpretadas como uma conexão válida.
    const validGatewayCredential = typeof account?.token_ciphertext === 'string'
      && account.token_ciphertext.startsWith('gateway.v1.');
    if (account?.status === 'connected' && !validGatewayCredential) {
      await db.from('connected_accounts').update({
        status: 'reauth_required',
        token_ciphertext: null,
        token_expires_at: null,
        last_error: 'Reconecte o Garmin para concluir a configuração segura.',
      }).eq('user_id', userId).eq('provider', 'garmin');
    }

    const { data: deviceRows } = await db.from('garmin_devices')
      .select('id,device_name,device_type,battery_level,last_sync_at')
      .eq('user_id', userId)
      .eq('status', 'active');

    return json({
      ok: true,
      data: {
        connected: account?.status === 'connected' && validGatewayCredential,
        status: account?.status === 'connected' && validGatewayCredential ? 'connected' : 'disconnected',
        lastError: account?.status === 'connected' && validGatewayCredential ? account?.last_error ?? null : null,
        devices: (deviceRows ?? []).map((device) => ({
          id: device.id,
          name: device.device_name,
          type: device.device_type ?? 'Garmin',
          batteryLevel: device.battery_level,
          lastSyncAt: device.last_sync_at,
        })),
      },
    });
  }

  if (body.action === 'garmin_connect_start') {
    if (!integrationFlags.garminPrivateApi()) {
      return json({ ok: false, error: 'A integração Garmin está temporariamente indisponível.' }, 503);
    }
    const gateway = await callGarminGateway<{ connectUrl: string }>('/v1/connect/start', userId, {});
    if (!gateway.response.ok || !gateway.response.data?.connectUrl) {
      return json({ ok: false, error: gatewayMessage(gateway.status, gateway.response.error) }, gateway.status);
    }
    return json({ ok: true, data: gateway.response.data });
  }

  if (body.action === 'garmin_disconnect') {
    // Remover localmente é suficiente para revogar o acesso do RunEvo: o
    // gateway só trabalha com credencial criptografada persistida nesta linha.
    const { error } = await db.from('connected_accounts').upsert({
      user_id: userId,
      provider: 'garmin',
      status: 'disconnected',
      provider_user_id: null,
      token_ciphertext: null,
      token_expires_at: null,
      connected_at: null,
      last_sync_at: null,
      last_error: null,
    }, { onConflict: 'user_id,provider' });
    if (error) return json({ ok: false, error: 'Não foi possível desconectar o Garmin.' }, 500);
    await db.from('garmin_devices').update({ status: 'removed' }).eq('user_id', userId);
    return json({ ok: true, data: null });
  }

  if (body.action === 'garmin_send_workout') {
    if (!integrationFlags.garminPrivateApi() || !integrationFlags.garminTrainingSync()) {
      return json({ ok: false, error: 'O envio de treinos para Garmin está temporariamente indisponível.' }, 503);
    }
    const workoutId = body.workoutId;
    const scheduledDate = body.scheduledDate;
    if (!workoutId || !scheduledDate || !/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) {
      return json({ ok: false, error: 'Parâmetros do treino inválidos.' }, 400);
    }

    const { data: account } = await db.from('connected_accounts')
      .select('status,token_ciphertext')
      .eq('user_id', userId).eq('provider', 'garmin').maybeSingle();
    if (account?.status !== 'connected' || !account.token_ciphertext?.startsWith('gateway.v1.')) {
      return json({ ok: false, error: 'Conta Garmin não conectada.' }, 409);
    }

    const { data: workout } = await db.from('plan_workouts')
      .select('id,title,description,planned_km,planned_pace,workout_date')
      .eq('id', workoutId).eq('user_id', userId).maybeSingle();
    if (!workout) return json({ ok: false, error: 'Treino não encontrado.' }, 404);

    const gateway = await callGarminGateway<{
      success: boolean; garminWorkoutId: string | null; status: 'pending' | 'processing' | 'success' | 'failed'; error: string | null;
    }>('/v1/workouts/send', userId, { workout, scheduledDate });
    if (!gateway.response.ok || !gateway.response.data) {
      return json({ ok: false, error: gatewayMessage(gateway.status, gateway.response.error) }, gateway.status);
    }
    return json({ ok: true, data: gateway.response.data });
  }

  if (body.action === 'garmin_workout_status') {
    const { data, error } = await db.from('external_workouts')
      .select('external_workout_id,sync_status,last_error')
      .eq('user_id', userId).eq('planned_workout_id', body.workoutId).eq('provider', 'garmin')
      .order('updated_at', { ascending: false }).limit(1).maybeSingle();
    if (error || !data) return json({ ok: true, data: { garminWorkoutId: null, status: 'pending', error: null } });
    return json({ ok: true, data: {
      garminWorkoutId: data.external_workout_id,
      status: data.sync_status === 'synced' ? 'success' : data.sync_status,
      error: data.last_error,
    } });
  }

  // ============ STRAVA STATUS ==========
  if (body.action === 'status') {
    const { data, error } = await db.from('connected_accounts')
      .select('id,provider,status,connected_at,last_sync_at,settings,last_error')
      .eq('user_id', userId);
    if (error) return json({ ok: false, error: 'Não foi possível carregar as integrações.' }, 500);
    const accounts = (data ?? []).map(summary);
    for (const provider of ['strava', 'garmin'] as const) {
      if (!accounts.some((account) => account.provider === provider)) accounts.push(disconnected(provider));
    }
    return json({ ok: true, data: accounts });
  }

  // ============ STRAVA SETTINGS ==========
  if (body.action === 'set_activity_enrichment') {
    if (typeof body.enabled !== 'boolean') return json({ ok: false, error: 'Preferência inválida.' }, 400);
    const { data: existing, error: readError } = await db.from('connected_accounts')
      .select('provider,status,scopes').eq('user_id', userId).eq('provider', 'strava').maybeSingle();
    if (readError || !existing || existing.status !== 'connected') return json({ ok: false, error: 'Conecte o Strava primeiro.' }, 409);
    if (body.enabled && !(existing.scopes as string[] | null)?.includes('activity:write')) {
      return json({ ok: false, error: 'Reconecte o Strava para autorizar.' }, 409);
    }
    const { error } = await db.from('connected_accounts').update({ settings: { activity_enrichment: body.enabled } })
      .eq('user_id', userId).eq('provider', 'strava');
    if (error) return json({ ok: false, error: 'Não foi possível salvar.' }, 500);
    return json({ ok: true, data: summary({ ...existing, settings: { activity_enrichment: body.enabled }, last_error: null }) });
  }

  // ============ STRAVA SYNC ==========
  if (body.action === 'sync_strava_activities') {
    const { data: account, error: accountError } = await db.from('connected_accounts')
      .select('id,user_id,provider_user_id,scopes,token_ciphertext,token_expires_at,settings')
      .eq('user_id', userId).eq('provider', 'strava').eq('status', 'connected').maybeSingle();
    if (accountError || !account) return json({ ok: false, error: 'Conecte o Strava primeiro.' }, 409);
    try {
      const eventResult = await processPendingStravaEvents(db, { userId, limit: 25 });
      const history = await syncStravaHistoryPage(db, account);
      return json({ ok: true, data: { ...eventResult, history } });
    } catch (error) {
      console.error('[STRAVA_SYNC_FAILED]', error);
      return json({ ok: false, error: 'Não foi possível sincronizar.' }, 500);
    }
  }

  // ============ STRAVA DISCONNECT ==========
  if (body.action === 'disconnect_strava') {
    await db.from('connected_accounts').upsert({
      user_id: userId, provider: 'strava', status: 'disconnected', provider_user_id: null, scopes: [], token_ciphertext: null,
      token_expires_at: null, connected_at: null, last_sync_at: null, last_error: null, settings: { activity_enrichment: false },
    }, { onConflict: 'user_id,provider' });
    return json({ ok: true, data: null });
  }

  return json({ ok: false, error: 'Ação desconhecida.' }, 400);
});
