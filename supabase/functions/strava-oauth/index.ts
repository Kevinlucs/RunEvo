import { createClient } from 'npm:@supabase/supabase-js@2';
import { encryptIntegrationToken } from '../_shared/integration-crypto.ts';
import { integrationFlags } from '../_shared/integration-flags.ts';
import {
  syncStravaHistoryPage,
  type StravaHistoryProgress,
} from '../_shared/strava-activity-sync.ts';

declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void };

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const REQUIRED_SCOPE = 'activity:read_all';
const REQUESTED_SCOPES = ['activity:read_all', 'activity:write'];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function environment(): {
  url: string;
  anon: string;
  service: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} | null {
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const clientId = Deno.env.get('STRAVA_CLIENT_ID');
  const clientSecret = Deno.env.get('STRAVA_CLIENT_SECRET');
  const redirectUri = Deno.env.get('STRAVA_REDIRECT_URI');
  return url && anon && service && clientId && clientSecret && redirectUri
    ? { url, anon, service, clientId, clientSecret, redirectUri }
    : null;
}

async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function redirectToApp(status: 'connected' | 'error'): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: `runevo://profile/connected-apps?strava=${status}` },
  });
}

function normalizedScopes(value: string): string[] {
  return value
    .split(/[,\s]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

async function callback(
  req: Request,
  env: NonNullable<ReturnType<typeof environment>>,
): Promise<Response> {
  const url = new URL(req.url);
  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  const rejected = url.searchParams.get('error');
  if (!state || rejected || !code) return redirectToApp('error');

  const db = createClient(env.url, env.service);
  const stateHash = await sha256(state);
  const { data: stateRow, error: stateError } = await db
    .from('integration_oauth_states')
    .select('id,user_id,expires_at')
    .eq('provider', 'strava')
    .eq('state_hash', stateHash)
    .maybeSingle();
  if (stateError || !stateRow || Date.parse(stateRow.expires_at) < Date.now()) {
    return redirectToApp('error');
  }
  await db.from('integration_oauth_states').delete().eq('id', stateRow.id);

  try {
    const response = await fetch('https://www.strava.com/api/v3/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.clientId,
        client_secret: env.clientSecret,
        code,
        grant_type: 'authorization_code',
      }),
    });
    if (!response.ok) {
      console.error('[STRAVA_OAUTH_EXCHANGE_FAILED]', response.status);
      return redirectToApp('error');
    }
    const token = (await response.json()) as {
      access_token: string;
      refresh_token: string;
      expires_at: number;
      athlete?: { id?: number };
    };
    const scopes = normalizedScopes(url.searchParams.get('scope') ?? '');
    if (!scopes.includes(REQUIRED_SCOPE) || !token.athlete?.id) {
      await db.from('connected_accounts').upsert(
        {
          user_id: stateRow.user_id,
          provider: 'strava',
          status: 'reauth_required',
          scopes,
          token_ciphertext: null,
          token_expires_at: null,
          last_error: 'A permissão para ler suas atividades não foi concedida.',
        },
        { onConflict: 'user_id,provider' },
      );
      return redirectToApp('error');
    }

    const tokenCiphertext = await encryptIntegrationToken(token);
    const { data: connectedAccount, error: upsertError } = await db
      .from('connected_accounts')
      .upsert(
        {
          user_id: stateRow.user_id,
          provider: 'strava',
          provider_user_id: String(token.athlete.id),
          status: 'connected',
          scopes,
          token_ciphertext: tokenCiphertext,
          token_expires_at: new Date(token.expires_at * 1000).toISOString(),
          connected_at: new Date().toISOString(),
          last_sync_at: null,
          last_error: null,
        },
        { onConflict: 'user_id,provider' },
      )
      .select('id')
      .single();
    if (upsertError || !connectedAccount) {
      console.error('[STRAVA_ACCOUNT_SAVE_FAILED]', upsertError?.message ?? 'conta não retornada');
      return redirectToApp('error');
    }
    await db.from('strava_history_sync_items').delete().eq('account_id', connectedAccount.id);
    await db.from('strava_history_sync_states').upsert(
      {
        account_id: connectedAccount.id,
        user_id: stateRow.user_id,
        discovery_page: 1,
        discovery_completed_at: null,
        total_activities: 0,
        processed_activities: 0,
        next_sync_at: null,
        last_error: null,
      },
      { onConflict: 'account_id' },
    );
    const historyAccount = {
      id: connectedAccount.id,
      user_id: stateRow.user_id,
      provider_user_id: String(token.athlete.id),
      scopes,
      token_ciphertext: tokenCiphertext,
      token_expires_at: new Date(token.expires_at * 1000).toISOString(),
      settings: null,
    };
    EdgeRuntime.waitUntil(
      syncStravaHistoryPage(db, historyAccount)
        .then((progress: StravaHistoryProgress) =>
          console.info('[STRAVA_HISTORY_STARTED]', progress.percent),
        )
        .catch((historyError) =>
          console.error(
            '[STRAVA_HISTORY_BACKGROUND_FAILED]',
            historyError instanceof Error ? historyError.message : 'erro desconhecido',
          ),
        ),
    );
    console.info('[STRAVA_CONNECTED]');
    return redirectToApp('connected');
  } catch (error) {
    console.error(
      '[STRAVA_OAUTH_FAILED]',
      error instanceof Error ? error.message : 'erro desconhecido',
    );
    return redirectToApp('error');
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  const env = environment();
  if (!env) {
    console.error('[STRAVA_CONFIG_MISSING]');
    return req.method === 'GET'
      ? redirectToApp('error')
      : json({ ok: false, error: 'Strava não configurado.' }, 503);
  }
  if (req.method === 'GET') return callback(req, env);
  if (req.method !== 'POST') return json({ ok: false, error: 'Método não permitido.' }, 405);
  if (!integrationFlags.stravaIntegration()) {
    return json(
      { ok: false, error: 'A integração com Strava não está liberada neste momento.' },
      503,
    );
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ ok: false, error: 'Sessão inválida.' }, 401);
  const userClient = createClient(env.url, env.anon, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ ok: false, error: 'Sessão inválida.' }, 401);

  const state = crypto.randomUUID();
  const db = createClient(env.url, env.service);
  await db
    .from('integration_oauth_states')
    .delete()
    .eq('user_id', userData.user.id)
    .eq('provider', 'strava');
  const { error } = await db.from('integration_oauth_states').insert({
    user_id: userData.user.id,
    provider: 'strava',
    state_hash: await sha256(state),
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
  });
  if (error) {
    console.error('[STRAVA_OAUTH_STATE_FAILED]', error.message);
    return json({ ok: false, error: 'Não foi possível iniciar a conexão com Strava.' }, 500);
  }

  const authorizeUrl = new URL('https://www.strava.com/oauth/mobile/authorize');
  authorizeUrl.searchParams.set('client_id', env.clientId);
  authorizeUrl.searchParams.set('redirect_uri', env.redirectUri);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('approval_prompt', 'auto');
  authorizeUrl.searchParams.set('scope', REQUESTED_SCOPES.join(','));
  authorizeUrl.searchParams.set('state', state);
  return json({ ok: true, data: { authorizeUrl: authorizeUrl.toString() } });
});
