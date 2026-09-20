import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  processPendingStravaEvents,
  syncStravaHistoryPage,
} from '../_shared/strava-activity-sync.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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

function disconnected(): Record<string, unknown> {
  return {
    provider: 'strava',
    status: 'disconnected',
    connectedAt: null,
    lastSyncAt: null,
    activityEnrichment: false,
    lastError: null,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ ok: false, error: 'Método não permitido.' }, 405);

  const environment = configured();
  if (!environment)
    return json({ ok: false, error: 'Serviço de integrações não configurado.' }, 503);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ ok: false, error: 'Sessão inválida.' }, 401);

  const userClient = createClient(environment.url, environment.anon, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ ok: false, error: 'Sessão inválida.' }, 401);

  let body: { action?: string; enabled?: boolean };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'Solicitação inválida.' }, 400);
  }

  const db = createClient(environment.url, environment.service);
  const userId = userData.user.id;

  // ============ STRAVA STATUS ==========
  if (body.action === 'status') {
    const { data, error } = await db
      .from('connected_accounts')
      .select('id,provider,status,connected_at,last_sync_at,settings,last_error')
      .eq('user_id', userId)
      .eq('provider', 'strava');
    if (error) return json({ ok: false, error: 'Não foi possível carregar as integrações.' }, 500);
    const accounts = (data ?? []).map(summary);
    if (!accounts.some((account) => account.provider === 'strava')) accounts.push(disconnected());
    return json({ ok: true, data: accounts });
  }

  // ============ STRAVA SETTINGS ==========
  if (body.action === 'set_activity_enrichment') {
    if (typeof body.enabled !== 'boolean')
      return json({ ok: false, error: 'Preferência inválida.' }, 400);
    const { data: existing, error: readError } = await db
      .from('connected_accounts')
      .select('provider,status,scopes')
      .eq('user_id', userId)
      .eq('provider', 'strava')
      .maybeSingle();
    if (readError || !existing || existing.status !== 'connected')
      return json({ ok: false, error: 'Conecte o Strava primeiro.' }, 409);
    if (body.enabled && !(existing.scopes as string[] | null)?.includes('activity:write')) {
      return json({ ok: false, error: 'Reconecte o Strava para autorizar.' }, 409);
    }
    const { error } = await db
      .from('connected_accounts')
      .update({ settings: { activity_enrichment: body.enabled } })
      .eq('user_id', userId)
      .eq('provider', 'strava');
    if (error) return json({ ok: false, error: 'Não foi possível salvar.' }, 500);
    return json({
      ok: true,
      data: summary({
        ...existing,
        settings: { activity_enrichment: body.enabled },
        last_error: null,
      }),
    });
  }

  // ============ STRAVA SYNC ==========
  if (body.action === 'sync_strava_activities') {
    const { data: account, error: accountError } = await db
      .from('connected_accounts')
      .select('id,user_id,provider_user_id,scopes,token_ciphertext,token_expires_at,settings')
      .eq('user_id', userId)
      .eq('provider', 'strava')
      .eq('status', 'connected')
      .maybeSingle();
    if (accountError || !account)
      return json({ ok: false, error: 'Conecte o Strava primeiro.' }, 409);
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
    await db.from('connected_accounts').upsert(
      {
        user_id: userId,
        provider: 'strava',
        status: 'disconnected',
        provider_user_id: null,
        scopes: [],
        token_ciphertext: null,
        token_expires_at: null,
        connected_at: null,
        last_sync_at: null,
        last_error: null,
        settings: { activity_enrichment: false },
      },
      { onConflict: 'user_id,provider' },
    );
    return json({ ok: true, data: null });
  }

  return json({ ok: false, error: 'Ação desconhecida.' }, 400);
});
