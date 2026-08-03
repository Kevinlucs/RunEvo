// Edge Function `revenuecat-webhook` (Deno) — docs/fase-7-brief.md Grupo 1.
// A verdade do entitlement é o servidor: RevenueCat chama esta função a cada
// evento de assinatura (compra, renovação, cancelamento, expiração,
// reembolso), e é ela — não o cliente — quem grava `subscriptions`. O app só
// LÊ essa tabela (RLS, migration 0004); a escrita aqui usa `service_role`,
// que ignora RLS de propósito.
//
// Diferente de `checkin-coach`/`generate-plan`: quem chama não é o app com o
// JWT do usuário, é o próprio RevenueCat. Autenticação é o header
// `Authorization` batendo com o secret configurado no dashboard do
// RevenueCat (`REVENUECAT_WEBHOOK_SECRET`), não uma sessão Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@^3';
import { mapRevenueCatEventToRow, isValidWebhookAuth, REVENUECAT_ENTITLEMENT_ID, type RevenueCatEvent } from './mapping.ts';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// Schema permissivo de propósito: só validamos os campos que consumimos.
// RevenueCat pode adicionar campos novos ao payload sem quebrar esta função
// (Zod ignora campos desconhecidos por padrão).
const eventSchema = z.object({
  type: z.string(),
  app_user_id: z.string().min(1),
  product_id: z.string().nullable().optional(),
  store: z.string().optional(),
  period_type: z.string().optional(),
  expiration_at_ms: z.number().nullable().optional(),
  entitlement_ids: z.array(z.string()).optional(),
});
const webhookBodySchema = z.object({
  api_version: z.string().optional(),
  event: eventSchema,
});

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  const expectedSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  if (!isValidWebhookAuth(authHeader, expectedSecret)) {
    return jsonResponse({ error: 'Assinatura do webhook inválida.' }, 401);
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return jsonResponse({ error: 'Corpo da requisição inválido.' }, 400);
  }

  const parsed = webhookBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return jsonResponse({ error: 'Payload fora do contrato esperado.', details: parsed.error.flatten() }, 400);
  }

  const row = mapRevenueCatEventToRow(parsed.data.event as RevenueCatEvent, REVENUECAT_ENTITLEMENT_ID);
  if (!row) {
    // Tipo de evento sem efeito para nós (TEST, entitlement de outro
    // produto, tipo não mapeado) — 200 para o RevenueCat não reenviar.
    return jsonResponse({ received: true, applied: false });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Configuração incompleta: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes.');
    return jsonResponse({ error: 'Configuração incompleta' }, 500);
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Upsert por user_id (migration 0008: índice único em subscriptions.user_id)
  // — reentregas do mesmo evento (ou eventos subsequentes) só reescrevem a
  // mesma linha, nunca duplicam. Uma linha por usuário é o mesmo modelo que
  // `subscriptionRepository.getCurrent` já assume no cliente.
  const { error } = await supabase.from('subscriptions').upsert(row, { onConflict: 'user_id' });
  if (error) {
    console.error('Falha ao gravar subscriptions:', error.message);
    return jsonResponse({ error: 'Falha ao persistir assinatura.' }, 500);
  }

  return jsonResponse({ received: true, applied: true });
});
