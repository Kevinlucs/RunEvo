import { createClient } from 'npm:@supabase/supabase-js@2';
import { integrationFlags } from '../_shared/integration-flags.ts';
import { processPendingStravaEvents } from '../_shared/strava-activity-sync.ts';

declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void };

type StravaEvent = {
  object_type?: 'activity' | 'athlete';
  aspect_type?: 'create' | 'update' | 'delete';
  object_id?: number;
  owner_id?: number;
  event_time?: number;
  subscription_id?: number;
  updates?: Record<string, unknown>;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function config(): { url: string; service: string; verifyToken: string } | null {
  const url = Deno.env.get('SUPABASE_URL');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const verifyToken = Deno.env.get('STRAVA_WEBHOOK_VERIFY_TOKEN');
  return url && service && verifyToken ? { url, service, verifyToken } : null;
}

Deno.serve(async (req) => {
  const env = config();
  if (!env) {
    console.error('[STRAVA_WEBHOOK_CONFIG_MISSING]');
    return json({ error: 'Configuração indisponível.' }, 503);
  }

  if (req.method === 'GET') {
    const url = new URL(req.url);
    const verifyToken = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    if (url.searchParams.get('hub.mode') !== 'subscribe' || !challenge || verifyToken !== env.verifyToken) {
      return json({ error: 'Validação inválida.' }, 403);
    }
    return json({ 'hub.challenge': challenge });
  }

  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
  if (!integrationFlags.stravaIntegration()) return json({ received: true, ignored: true });

  let event: StravaEvent;
  try {
    event = await req.json();
  } catch {
    return json({ error: 'Payload inválido.' }, 400);
  }
  if (
    !event.object_type ||
    !event.aspect_type ||
    !Number.isFinite(event.object_id) ||
    !Number.isFinite(event.owner_id) ||
    !Number.isFinite(event.event_time)
  ) {
    return json({ error: 'Evento fora do contrato.' }, 400);
  }

  // A resposta ao Strava precisa voltar rapidamente. A fila preserva o evento
  // e o processador assíncrono buscará os detalhes da atividade depois.
  const db = createClient(env.url, env.service);
  const { data: account, error: accountError } = await db
    .from('connected_accounts')
    .select('user_id')
    .eq('provider', 'strava')
    .eq('provider_user_id', String(event.owner_id))
    .maybeSingle();
  if (accountError) {
    console.error('[STRAVA_WEBHOOK_ACCOUNT_LOOKUP_FAILED]', accountError.message);
    return json({ error: 'Erro temporário.' }, 500);
  }

  const eventType = `${event.object_type}.${event.aspect_type}`;
  const { data: queuedEvent, error } = await db
    .from('integration_events')
    .upsert(
    {
      user_id: account?.user_id ?? null,
      provider: 'strava',
      event_type: eventType,
      external_object_id: String(event.object_id),
      event_time: new Date(event.event_time * 1000).toISOString(),
      payload: {
        object_type: event.object_type,
        aspect_type: event.aspect_type,
        owner_id: event.owner_id,
        subscription_id: event.subscription_id ?? null,
        updates: event.updates ?? {},
      },
      status: 'pending',
    },
    { onConflict: 'provider,event_type,external_object_id,event_time', ignoreDuplicates: true },
    )
    .select('id');
  if (error) {
    console.error('[STRAVA_EVENT_QUEUE_FAILED]', error.message);
    return json({ error: 'Erro temporário.' }, 500);
  }
  // Processa fora do ciclo de resposta do webhook. A fila continua sendo a
  // fonte de verdade: se houver uma indisponibilidade, o atleta pode tentar
  // novamente em "Sincronizar agora" sem perder o evento.
  if (queuedEvent?.[0]?.id) {
    EdgeRuntime.waitUntil(
      processPendingStravaEvents(db, { userId: account?.user_id ?? undefined, limit: 10 }).catch((processingError) => {
        console.error(
          '[STRAVA_BACKGROUND_SYNC_FAILED]',
          processingError instanceof Error ? processingError.message : 'erro desconhecido',
        );
      }),
    );
  }
  console.info('[STRAVA_EVENT_RECEIVED]');
  return json({ received: true });
});
