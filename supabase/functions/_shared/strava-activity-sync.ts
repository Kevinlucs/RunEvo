import { createClient } from 'npm:@supabase/supabase-js@2';
import { decryptIntegrationToken, encryptIntegrationToken } from './integration-crypto.ts';
import { integrationFlags } from './integration-flags.ts';
import {
  isSameCanonicalActivity,
  loadMatchedWorkout,
  localActivityDate,
  matchAndCompleteCanonicalActivity,
  type CanonicalActivity,
  type MatchedWorkout,
} from './activity-sync-core.ts';

type SupabaseClient = ReturnType<typeof createClient>;

type StoredStravaToken = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
};

type StravaBestEffort = {
  name?: string;
  distance?: number;
  moving_time?: number;
  elapsed_time?: number;
};

type StravaActivity = {
  id: number;
  name?: string;
  type?: string;
  sport_type?: string;
  start_date?: string;
  distance?: number;
  moving_time?: number;
  elapsed_time?: number;
  external_id?: string;
  best_efforts?: StravaBestEffort[];
};

type StravaActivitySummary = Pick<
  StravaActivity,
  'id' | 'type' | 'sport_type' | 'distance' | 'moving_time'
>;

type Account = {
  id: string;
  user_id: string;
  provider_user_id: string | null;
  scopes?: string[] | null;
  token_ciphertext: string | null;
  token_expires_at: string | null;
  settings: { activity_enrichment?: boolean } | null;
};

type StravaHistoryState = {
  account_id: string;
  discovery_page: number | null;
  discovery_completed_at: string | null;
  total_activities: number;
  processed_activities: number;
  next_sync_at: string | null;
};

type StravaHistoryItem = {
  id: string;
  external_activity_id: string;
  status: 'pending' | 'processed' | 'failed';
};

type QueuedEvent = {
  id: string;
  user_id: string | null;
  event_type: string;
  external_object_id: string;
  payload: { owner_id?: number; updates?: Record<string, unknown> } | null;
  attempts: number;
};

type ActivityRow = CanonicalActivity;

const STRAVA_SOURCE_PRIORITY = 4;
const RETRY_LIMIT = 5;
const HISTORY_DISCOVERY_PAGE_SIZE = 200;
const HISTORY_DETAIL_BATCH_SIZE = 40;
const HISTORY_BATCH_DELAY_MS = 4 * 60_000;
const START_TOLERANCE_S = 120;

function requiredEnvironment(): { clientId: string; clientSecret: string } {
  const clientId = Deno.env.get('STRAVA_CLIENT_ID');
  const clientSecret = Deno.env.get('STRAVA_CLIENT_SECRET');
  if (!clientId || !clientSecret) throw new Error('Configuração do Strava indisponível.');
  return { clientId, clientSecret };
}

function normalizedSport(activity: StravaActivity): string {
  const raw = `${activity.sport_type ?? activity.type ?? ''}`.trim().toLowerCase();
  return raw.includes('run') ? 'run' : raw || 'other';
}

function isValidActivity(activity: StravaActivity): activity is StravaActivity & {
  id: number;
  start_date: string;
  distance: number;
  moving_time: number;
} {
  return (
    Number.isFinite(activity.id) &&
    typeof activity.start_date === 'string' &&
    Number.isFinite(activity.distance) &&
    activity.distance >= 0 &&
    Number.isFinite(activity.moving_time) &&
    activity.moving_time >= 0
  );
}

function activityUrl(id: string): string {
  return `https://www.strava.com/activities/${id}`;
}

function compactActivityPayload(activity: StravaActivity): Record<string, unknown> {
  return {
    id: activity.id,
    name: activity.name ?? null,
    type: activity.type ?? null,
    sport_type: activity.sport_type ?? null,
    start_date: activity.start_date ?? null,
    distance: activity.distance ?? null,
    moving_time: activity.moving_time ?? null,
    elapsed_time: activity.elapsed_time ?? null,
    external_id: activity.external_id ?? null,
  };
}

async function accessToken(db: SupabaseClient, account: Account): Promise<string> {
  if (!account.token_ciphertext) throw new Error('A conexão com Strava precisa ser refeita.');
  const token = await decryptIntegrationToken<StoredStravaToken>(account.token_ciphertext);
  if (token.expires_at * 1000 > Date.now() + 60_000) return token.access_token;

  const env = requiredEnvironment();
  const response = await fetch('https://www.strava.com/api/v3/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.clientId,
      client_secret: env.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: token.refresh_token,
    }),
  });
  if (!response.ok) {
    await db
      .from('connected_accounts')
      .update({
        status: 'reauth_required',
        last_error: 'A autorização do Strava expirou. Conecte novamente.',
      })
      .eq('id', account.id);
    throw new Error('A autorização do Strava expirou.');
  }

  const refreshed = (await response.json()) as StoredStravaToken;
  if (
    !refreshed.access_token ||
    !refreshed.refresh_token ||
    !Number.isFinite(refreshed.expires_at)
  ) {
    throw new Error('A resposta de atualização de token do Strava é inválida.');
  }
  const { error } = await db
    .from('connected_accounts')
    .update({
      token_ciphertext: await encryptIntegrationToken(refreshed),
      token_expires_at: new Date(refreshed.expires_at * 1000).toISOString(),
      status: 'connected',
      last_error: null,
    })
    .eq('id', account.id);
  if (error) throw new Error('Não foi possível atualizar a conexão com Strava.');
  return refreshed.access_token;
}

async function loadActivityWithToken(token: string, externalId: string): Promise<StravaActivity> {
  const response = await fetch(
    `https://www.strava.com/api/v3/activities/${encodeURIComponent(externalId)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!response.ok)
    throw new Error(`O Strava não disponibilizou a atividade (${response.status}).`);
  return (await response.json()) as StravaActivity;
}

async function loadActivity(
  db: SupabaseClient,
  account: Account,
  externalId: string,
): Promise<StravaActivity> {
  return loadActivityWithToken(await accessToken(db, account), externalId);
}

async function loadActivityPage(token: string, page: number): Promise<StravaActivitySummary[]> {
  const url = new URL('https://www.strava.com/api/v3/athlete/activities');
  url.searchParams.set('page', String(page));
  url.searchParams.set('per_page', String(HISTORY_DISCOVERY_PAGE_SIZE));
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    if (response.status === 429) {
      throw new Error(
        'O Strava limitou temporariamente a leitura do histórico. Tente novamente em alguns minutos.',
      );
    }
    throw new Error(`O Strava não disponibilizou o histórico de atividades (${response.status}).`);
  }
  const data = await response.json();
  return Array.isArray(data) ? (data as StravaActivitySummary[]) : [];
}

function recordKey(effort: StravaBestEffort): string | null {
  const name = (effort.name ?? '').toLowerCase().replace(/[\s_-]/g, '');
  const distance = Number(effort.distance ?? 0);
  if (name === '1k' || Math.abs(distance - 1000) <= 25) return '1k';
  if (name === '1mile' || name === '1mi' || Math.abs(distance - 1609.34) <= 30) return '1mi';
  if (name === '2mile' || name === '2mi' || Math.abs(distance - 3218.69) <= 35) return '2mi';
  if (name === '5k' || Math.abs(distance - 5000) <= 35) return '5k';
  if (name === '5mile' || name === '5mi' || Math.abs(distance - 8046.72) <= 45) return '5mi';
  if (name === '10k' || Math.abs(distance - 10000) <= 40) return '10k';
  if (name === '10mile' || name === '10mi' || Math.abs(distance - 16093.44) <= 60) return '10mi';
  if (name.includes('halfmarathon') || Math.abs(distance - 21097.5) <= 100) return 'half';
  if (name.includes('marathon') || Math.abs(distance - 42195) <= 120) return 'marathon';
  if (name === '50k' || Math.abs(distance - 50000) <= 150) return '50k';
  if (name === '100k' || Math.abs(distance - 100000) <= 250) return '100k';
  return null;
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = total % 60;
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
}

async function upsertStravaRecords(
  db: SupabaseClient,
  userId: string,
  activity: StravaActivity,
): Promise<void> {
  if (normalizedSport(activity) !== 'run' || !activity.start_date) return;
  const records = (activity.best_efforts ?? [])
    .map((effort) => ({
      key: recordKey(effort),
      seconds: Number(effort.moving_time ?? effort.elapsed_time ?? 0),
    }))
    .filter(
      (effort): effort is { key: string; seconds: number } =>
        Boolean(effort.key) && effort.seconds > 0,
    )
    .map((effort) => ({
      id: `strava:${activity.id}:${effort.key}`,
      user_id: userId,
      record_key: effort.key,
      time_str: formatDuration(effort.seconds),
      date_iso: localActivityDate(activity.start_date as string),
      source: 'strava',
      external_url: activityUrl(String(activity.id)),
      updated_at: new Date().toISOString(),
    }));

  if (!records.length) return;
  const { error } = await db.from('personal_records').upsert(records, { onConflict: 'id' });
  if (error) throw new Error('Não foi possível atualizar os recordes importados.');
}

function activityEnrichmentAllowed(account: Account): boolean {
  return Boolean(
    integrationFlags.stravaActivityEnrichment() &&
    account.settings?.activity_enrichment &&
    account.scopes?.includes('activity:write'),
  );
}

function buildStravaDescription(workout: MatchedWorkout): string {
  const details = (workout.description ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
  const planContext = [
    workout.phase ? `Fase ${workout.phase}` : null,
    workout.week_number ? `Semana ${workout.week_number}` : null,
  ]
    .filter(Boolean)
    .join(' • ');
  return [workout.title ?? 'Treino RunEvo', details, planContext, 'Treino realizado com RunEvo']
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 10_000);
}

/**
 * O Strava só é enriquecido uma vez, quando já há um auto match inequívoco.
 * Uma falha aqui nunca invalida a importação ou a conclusão do treino.
 */
async function enrichStravaActivity(
  db: SupabaseClient,
  account: Account,
  externalId: string,
  workout: MatchedWorkout,
): Promise<boolean> {
  if (!activityEnrichmentAllowed(account)) return false;
  try {
    const response = await fetch(
      `https://www.strava.com/api/v3/activities/${encodeURIComponent(externalId)}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${await accessToken(db, account)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          name: `${workout.title ?? 'Treino'} | RunEvo`.slice(0, 255),
          description: buildStravaDescription(workout),
        }),
      },
    );
    if (!response.ok) {
      console.warn('[STRAVA_ACTIVITY_ENRICHMENT_SKIPPED]', {
        status: response.status,
        activityId: externalId,
      });
      return false;
    }
    console.info('[STRAVA_ACTIVITY_ENRICHED]', { activityId: externalId, workoutId: workout.id });
    return true;
  } catch (error) {
    console.warn('[STRAVA_ACTIVITY_ENRICHMENT_SKIPPED]', {
      activityId: externalId,
      reason: error instanceof Error ? error.message : 'erro desconhecido',
    });
    return false;
  }
}

async function importLoadedActivity(
  db: SupabaseClient,
  account: Account,
  externalId: string,
  activity: StravaActivity,
): Promise<void> {
  const { data: existingSource, error: sourceError } = await db
    .from('activity_sources')
    .select('activity_id,payload')
    .eq('provider', 'strava')
    .eq('external_activity_id', externalId)
    .maybeSingle();
  if (sourceError) throw new Error('Não foi possível verificar a atividade já importada.');

  if (!isValidActivity(activity))
    throw new Error('A atividade recebida do Strava está incompleta.');

  const incoming: ActivityRow = {
    id: existingSource?.activity_id ?? '',
    user_id: account.user_id,
    sport_type: normalizedSport(activity),
    start_at: activity.start_date,
    distance_m: activity.distance,
    duration_s: activity.moving_time,
    source_priority: STRAVA_SOURCE_PRIORITY,
  };

  let canonical: ActivityRow | null = null;
  if (existingSource?.activity_id) {
    const { data, error } = await db
      .from('athlete_activities')
      .select(
        'id,user_id,sport_type,start_at,distance_m,duration_s,source_priority,matched_workout_id,match_type,match_score',
      )
      .eq('id', existingSource.activity_id)
      .maybeSingle();
    if (error) throw new Error('Não foi possível recuperar a atividade importada.');
    canonical = data as ActivityRow | null;
  }

  if (!canonical) {
    const start = new Date(Date.parse(incoming.start_at) - START_TOLERANCE_S * 1000).toISOString();
    const end = new Date(Date.parse(incoming.start_at) + START_TOLERANCE_S * 1000).toISOString();
    const { data: nearby, error } = await db
      .from('athlete_activities')
      .select(
        'id,user_id,sport_type,start_at,distance_m,duration_s,source_priority,matched_workout_id,match_type,match_score',
      )
      .eq('user_id', account.user_id)
      .eq('sport_type', incoming.sport_type)
      .gte('start_at', start)
      .lte('start_at', end);
    if (error) throw new Error('Não foi possível procurar atividades duplicadas.');
    canonical =
      ((nearby ?? []) as ActivityRow[]).find((candidate) =>
        isSameCanonicalActivity(incoming, candidate),
      ) ?? null;
  }

  if (!canonical) {
    const { data, error } = await db
      .from('athlete_activities')
      .insert({
        user_id: incoming.user_id,
        sport_type: incoming.sport_type,
        start_at: incoming.start_at,
        distance_m: incoming.distance_m,
        duration_s: incoming.duration_s,
        title: activity.name ?? null,
        external_url: activityUrl(externalId),
        source_priority: STRAVA_SOURCE_PRIORITY,
      })
      .select(
        'id,user_id,sport_type,start_at,distance_m,duration_s,source_priority,matched_workout_id,match_type,match_score',
      )
      .single();
    if (error || !data) throw new Error('Não foi possível salvar a atividade do Strava.');
    canonical = data as ActivityRow;
  } else if (canonical.source_priority >= STRAVA_SOURCE_PRIORITY) {
    const { error } = await db
      .from('athlete_activities')
      .update({
        sport_type: incoming.sport_type,
        start_at: incoming.start_at,
        distance_m: incoming.distance_m,
        duration_s: incoming.duration_s,
        title: activity.name ?? null,
        external_url: activityUrl(externalId),
        source_priority: STRAVA_SOURCE_PRIORITY,
      })
      .eq('id', canonical.id);
    if (error) throw new Error('Não foi possível atualizar a atividade do Strava.');
    canonical = { ...canonical, ...incoming, id: canonical.id };
  }

  const previousPayload =
    existingSource?.payload && typeof existingSource.payload === 'object'
      ? (existingSource.payload as Record<string, unknown>)
      : {};
  let sourcePayload: Record<string, unknown> = {
    ...compactActivityPayload(activity),
    ...(typeof previousPayload.strava_enriched_at === 'string'
      ? { strava_enriched_at: previousPayload.strava_enriched_at }
      : {}),
  };

  const { error: sourceUpsertError } = await db.from('activity_sources').upsert(
    {
      activity_id: canonical.id,
      user_id: account.user_id,
      provider: 'strava',
      external_activity_id: externalId,
      payload: sourcePayload,
    },
    { onConflict: 'provider,external_activity_id' },
  );
  if (sourceUpsertError) throw new Error('Não foi possível registrar a origem da atividade.');

  let matchedWorkout: MatchedWorkout | null = null;
  if (canonical.matched_workout_id) {
    matchedWorkout = await loadMatchedWorkout(
      db,
      account.user_id,
      canonical.matched_workout_id,
    );
  } else {
    const match = await matchAndCompleteCanonicalActivity(db, canonical, {
      completionSource: 'strava_auto_match',
    });
    matchedWorkout =
      match.type === 'auto_match' || match.type === 'direct_provider_match'
        ? match.workout
        : null;
  }
  if (
    matchedWorkout &&
    typeof previousPayload.strava_enriched_at !== 'string' &&
    (await enrichStravaActivity(db, account, externalId, matchedWorkout))
  ) {
    sourcePayload = { ...sourcePayload, strava_enriched_at: new Date().toISOString() };
    const { error: enrichedSourceError } = await db
      .from('activity_sources')
      .update({ payload: sourcePayload })
      .eq('provider', 'strava')
      .eq('external_activity_id', externalId);
    if (enrichedSourceError) {
      console.warn('[STRAVA_ACTIVITY_ENRICHMENT_MARK_FAILED]', { activityId: externalId });
    }
  }
  await upsertStravaRecords(db, account.user_id, activity);
  const { error: syncError } = await db
    .from('connected_accounts')
    .update({ last_sync_at: new Date().toISOString(), last_error: null, status: 'connected' })
    .eq('id', account.id);
  if (syncError) throw new Error('Não foi possível atualizar o status da sincronização.');
}

async function importActivity(
  db: SupabaseClient,
  account: Account,
  externalId: string,
): Promise<void> {
  await importLoadedActivity(db, account, externalId, await loadActivity(db, account, externalId));
}

export type StravaHistoryProgress = {
  scanned: number;
  imported: number;
  total: number;
  percent: number;
  nextPage: number;
  completed: boolean;
  phase: 'discovering' | 'processing' | 'waiting' | 'completed';
};

/**
 * Lê o histórico já existente no Strava em páginas. Cada corrida é carregada
 * em detalhe para usar os `best_efforts` oficiais do Strava — a única forma
 * precisa de recuperar os recordes de segmento (1 km, 5 km, 10 km, etc.).
 *
 * A posição fica persistida para que perfis grandes possam retomar o processo
 * sem duplicar atividades e sem ultrapassar o limite de requisições do Strava.
 */
export async function syncStravaHistoryPage(
  db: SupabaseClient,
  account: Account,
): Promise<StravaHistoryProgress> {
  const { data: storedState, error: stateError } = await db
    .from('strava_history_sync_states')
    .select(
      'account_id,discovery_page,discovery_completed_at,total_activities,processed_activities,next_sync_at',
    )
    .eq('account_id', account.id)
    .maybeSingle();
  if (stateError)
    throw new Error('Não foi possível preparar a sincronização do histórico do Strava.');

  const state = storedState as StravaHistoryState | null;
  if (state?.discovery_completed_at && state.processed_activities >= state.total_activities) {
    return {
      scanned: state.processed_activities,
      imported: state.processed_activities,
      total: state.total_activities,
      percent: 100,
      nextPage: state.discovery_page ?? 1,
      completed: true,
      phase: 'completed',
    };
  }

  const token = await accessToken(db, account);
  let currentState = state;

  // Primeiro catalogamos todas as corridas do perfil. As listagens são leves
  // e permitem que a porcentagem represente o histórico completo, não uma
  // estimativa baseada apenas na página atual.
  if (!currentState?.discovery_completed_at) {
    let page = Math.max(currentState?.discovery_page ?? 1, 1);
    while (true) {
      const activities = await loadActivityPage(token, page);
      const runningActivities = activities.filter(
        (activity) => normalizedSport(activity) === 'run',
      );
      if (runningActivities.length > 0) {
        const { error: itemError } = await db.from('strava_history_sync_items').upsert(
          runningActivities.map((activity) => ({
            account_id: account.id,
            user_id: account.user_id,
            external_activity_id: String(activity.id),
            status: 'pending',
          })),
          { onConflict: 'account_id,external_activity_id', ignoreDuplicates: true },
        );
        if (itemError) throw new Error('Não foi possível catalogar as atividades do Strava.');
      }

      const isLastPage = activities.length < HISTORY_DISCOVERY_PAGE_SIZE;
      const { error: saveDiscoveryError } = await db.from('strava_history_sync_states').upsert(
        {
          account_id: account.id,
          user_id: account.user_id,
          discovery_page: isLastPage ? page : page + 1,
          discovery_completed_at: isLastPage ? new Date().toISOString() : null,
          next_sync_at: null,
          last_error: null,
        },
        { onConflict: 'account_id' },
      );
      if (saveDiscoveryError) throw new Error('Não foi possível salvar o catálogo do Strava.');
      if (isLastPage) break;
      page += 1;
    }

    const { count, error: countError } = await db
      .from('strava_history_sync_items')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', account.id);
    if (countError) throw new Error('Não foi possível contar as atividades do Strava.');
    currentState = {
      account_id: account.id,
      discovery_page: 1,
      discovery_completed_at: new Date().toISOString(),
      total_activities: count ?? 0,
      processed_activities: 0,
      next_sync_at: null,
    };
    const { error: totalError } = await db
      .from('strava_history_sync_states')
      .update({ total_activities: currentState.total_activities, processed_activities: 0 })
      .eq('account_id', account.id);
    if (totalError) throw new Error('Não foi possível preparar o progresso do histórico.');
  }

  if (!currentState) throw new Error('Não foi possível iniciar o histórico do Strava.');
  const readyState = currentState;
  const total = readyState.total_activities;
  if (total === 0) {
    await db
      .from('strava_history_sync_states')
      .update({ processed_activities: 0, next_sync_at: null })
      .eq('account_id', account.id);
    return {
      scanned: 0,
      imported: 0,
      total: 0,
      percent: 100,
      nextPage: 1,
      completed: true,
      phase: 'completed',
    };
  }

  if (readyState.next_sync_at && Date.parse(readyState.next_sync_at) > Date.now()) {
    const percent = Math.round((readyState.processed_activities / total) * 100);
    return {
      scanned: readyState.processed_activities,
      imported: readyState.processed_activities,
      total,
      percent,
      nextPage: readyState.discovery_page ?? 1,
      completed: false,
      phase: 'waiting',
    };
  }

  const { data: items, error: itemsError } = await db
    .from('strava_history_sync_items')
    .select('id,external_activity_id,status')
    .eq('account_id', account.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(HISTORY_DETAIL_BATCH_SIZE);
  if (itemsError) throw new Error('Não foi possível carregar o próximo lote do Strava.');

  let processedNow = 0;
  for (const item of (items ?? []) as StravaHistoryItem[]) {
    try {
      const activity = await loadActivityWithToken(token, item.external_activity_id);
      if (!isValidActivity(activity))
        throw new Error('A atividade recebida do Strava está incompleta.');
      await importLoadedActivity(db, account, item.external_activity_id, activity);
      await db
        .from('strava_history_sync_items')
        .update({ status: 'processed', last_error: null })
        .eq('id', item.id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Falha desconhecida ao analisar a atividade.';
      if (message.includes('(429)')) throw error;
      // Uma atividade excluída ou indisponível não deve impedir o restante do
      // histórico. Ela conta como analisada e pode ser auditada no backend.
      await db
        .from('strava_history_sync_items')
        .update({ status: 'failed', last_error: message.slice(0, 500) })
        .eq('id', item.id);
    }
    processedNow += 1;
  }

  const { count: processedCount, error: processedCountError } = await db
    .from('strava_history_sync_items')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', account.id)
    .in('status', ['processed', 'failed']);
  if (processedCountError) throw new Error('Não foi possível atualizar o progresso do histórico.');
  const processed = Math.min(
    processedCount ?? readyState.processed_activities + processedNow,
    total,
  );
  const completed = processed >= total || (items ?? []).length === 0;
  const nextSyncAt = completed ? null : new Date(Date.now() + HISTORY_BATCH_DELAY_MS).toISOString();
  const { error: saveProgressError } = await db
    .from('strava_history_sync_states')
    .update({
      processed_activities: processed,
      next_sync_at: nextSyncAt,
      last_error: null,
    })
    .eq('account_id', account.id);
  if (saveProgressError)
    throw new Error('Não foi possível salvar o progresso do histórico do Strava.');

  return {
    scanned: processed,
    imported: processed,
    total,
    percent: completed ? 100 : Math.round((processed / total) * 100),
    nextPage: readyState.discovery_page ?? 1,
    completed,
    phase: completed ? 'completed' : 'processing',
  };
}

async function processDelete(db: SupabaseClient, externalId: string): Promise<void> {
  const { data: source, error } = await db
    .from('activity_sources')
    .select('id,activity_id')
    .eq('provider', 'strava')
    .eq('external_activity_id', externalId)
    .maybeSingle();
  if (error || !source) return;
  const { count, error: countError } = await db
    .from('activity_sources')
    .select('id', { count: 'exact', head: true })
    .eq('activity_id', source.activity_id);
  if (countError) throw new Error('Não foi possível verificar as fontes da atividade removida.');
  const { error: deleteSourceError } = await db
    .from('activity_sources')
    .delete()
    .eq('id', source.id);
  if (deleteSourceError) throw new Error('Não foi possível remover a origem da atividade.');
  if (count === 1) {
    const { error: deleteActivityError } = await db
      .from('athlete_activities')
      .delete()
      .eq('id', source.activity_id);
    if (deleteActivityError)
      throw new Error('Não foi possível remover a atividade excluída no Strava.');
  }
}

async function processDeauthorization(db: SupabaseClient, userId: string): Promise<void> {
  const { error } = await db
    .from('connected_accounts')
    .update({
      status: 'disconnected',
      provider_user_id: null,
      scopes: [],
      token_ciphertext: null,
      token_expires_at: null,
      last_error: 'A autorização do Strava foi removida pelo atleta.',
    })
    .eq('provider', 'strava')
    .eq('user_id', userId);
  if (error) throw new Error('Não foi possível finalizar a desconexão do Strava.');
  console.info('[STRAVA_DEAUTHORIZED]', { userId });
}

async function processEvent(db: SupabaseClient, event: QueuedEvent): Promise<void> {
  if (!event.user_id) return;
  if (
    event.event_type === 'athlete.update' &&
    event.payload?.updates &&
    event.payload.updates.authorized === false
  ) {
    await processDeauthorization(db, event.user_id);
    return;
  }
  if (event.event_type === 'activity.delete') {
    await processDelete(db, event.external_object_id);
    return;
  }
  if (!['activity.create', 'activity.update'].includes(event.event_type)) return;

  const { data: account, error } = await db
    .from('connected_accounts')
    .select('id,user_id,provider_user_id,scopes,token_ciphertext,token_expires_at,settings')
    .eq('provider', 'strava')
    .eq('user_id', event.user_id)
    .eq('status', 'connected')
    .maybeSingle();
  if (error || !account) throw new Error('A conta conectada do Strava não foi encontrada.');
  await importActivity(db, account as Account, event.external_object_id);
}

async function completeEvent(
  db: SupabaseClient,
  id: string,
  status: 'processed' | 'failed',
  error?: unknown,
): Promise<void> {
  const lastError =
    status === 'failed'
      ? error instanceof Error
        ? error.message.slice(0, 500)
        : 'Falha desconhecida ao processar atividade.'
      : null;
  await db
    .from('integration_events')
    .update({
      status,
      last_error: lastError,
      processed_at: status === 'processed' ? new Date().toISOString() : null,
    })
    .eq('id', id);
}

export async function processPendingStravaEvents(
  db: SupabaseClient,
  options: { userId?: string; limit?: number } = {},
): Promise<{ processed: number; failed: number; remaining: number }> {
  const limit = Math.min(Math.max(options.limit ?? 10, 1), 25);
  let query = db
    .from('integration_events')
    .select('id,user_id,event_type,external_object_id,payload,attempts')
    .eq('provider', 'strava')
    .in('status', ['pending', 'failed'])
    .lt('attempts', RETRY_LIMIT)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (options.userId) query = query.eq('user_id', options.userId);
  const { data: events, error } = await query;
  if (error) throw new Error('Não foi possível carregar os eventos pendentes.');

  let processed = 0;
  let failed = 0;
  for (const event of (events ?? []) as QueuedEvent[]) {
    const { data: claimed, error: claimError } = await db
      .from('integration_events')
      .update({ status: 'processing', attempts: event.attempts + 1 })
      .eq('id', event.id)
      .in('status', ['pending', 'failed'])
      .select('id,user_id,event_type,external_object_id,payload,attempts')
      .maybeSingle();
    if (claimError || !claimed) continue;

    try {
      await processEvent(db, claimed as QueuedEvent);
      await completeEvent(db, event.id, 'processed');
      processed += 1;
    } catch (processingError) {
      await completeEvent(db, event.id, 'failed', processingError);
      failed += 1;
      console.error(
        '[STRAVA_ACTIVITY_PROCESSING_FAILED]',
        processingError instanceof Error ? processingError.message : 'erro desconhecido',
      );
    }
  }

  let remainingQuery = db
    .from('integration_events')
    .select('id', { count: 'exact', head: true })
    .eq('provider', 'strava')
    .in('status', ['pending', 'failed'])
    .lt('attempts', RETRY_LIMIT);
  if (options.userId) remainingQuery = remainingQuery.eq('user_id', options.userId);
  const { count } = await remainingQuery;
  return { processed, failed, remaining: count ?? 0 };
}

export function canRetryEvent(attempts: number): boolean {
  return attempts < RETRY_LIMIT;
}
