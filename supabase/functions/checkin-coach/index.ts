// Edge Function `checkin-coach` (Deno) — IA do Adaptive Training (docs/fase-5-brief.md
// Grupo 1). Função SEPARADA de `generate-plan` (decisão do usuário: melhor
// manutenção/segurança; cada função valida seu próprio contrato).
//
// Diferença de contrato para `generate-plan`: aquela recebe/retorna texto cru
// (o parse+Zod fica no cliente); esta recebe e devolve JSON estruturado,
// validado com Zod NOS DOIS LADOS aqui dentro — o prompt é montado a partir da
// entrada validada, e a resposta do Gemini só sai da função depois de passar
// pelo schema de saída. O cliente nunca lida com texto cru do modelo.
//
// A IA aqui SUGERE. Os guardrails da spec §18 (`normalizeAICheckinRecommendation`,
// src/domain/motor-evo/adaptive-training.ts) SEMPRE reconciliam esta resposta
// antes de virar ajuste — isso acontece no cliente, não aqui; esta função só
// entrega uma sugestão já validada estruturalmente.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@^3';

const MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
const REQUEST_TIMEOUT_MS = 25_000;

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

// ---- Contrato de entrada (Zod) — resumo da semana que o cliente já calculou
// localmente (summarizeWeek, domínio puro) + o feedback coletado no check-in. ----
const summarySchema = z.object({
  total: z.number().int().nonnegative(),
  resolved: z.number().int().nonnegative(),
  completedKm: z.number().nonnegative(),
  plannedKm: z.number().nonnegative(),
  averageEffort: z.number().nonnegative(),
  completionRate: z.number().nonnegative(),
});

const feedbackSchema = z.object({
  effort: z.number().int().min(1).max(10),
  feeling: z.enum(['leve', 'normal', 'pesado', 'muito_pesado']),
  pain: z.boolean(),
  notes: z.string().nullable().optional().default(''),
});

const planContextSchema = z.object({
  raceType: z.string(),
  phase: z.string(),
  weeksToRace: z.number().int(),
});

const requestSchema = z.object({
  weekNumber: z.number().int().nonnegative(),
  summary: summarySchema,
  feedback: feedbackSchema,
  planContext: planContextSchema,
});
type CheckinCoachRequest = z.infer<typeof requestSchema>;

// ---- Contrato de saída (Zod) — o formato que `normalizeAICheckinRecommendation`
// espera de `ai` (src/domain/motor-evo/adaptive-training.ts `AISuggestion`).
// `.passthrough()` tolera campos extras; tipos estritos nos campos usados. ----
const recommendationSchema = z
  .object({
    action: z.enum(['maintain', 'reduce', 'recovery', 'slight_increase']),
    adjustmentPercent: z.number(),
    weeksToAdjust: z.number().int(),
    reason: z.string(),
    coachTip: z.string().default(''),
    messageToUser: z.string(),
    confidence: z.enum(['baixa', 'média', 'alta']),
  })
  .passthrough();

/** Porte da intenção de `callAICheckinCoach`/`buildAICheckinPrompt` (legacy/app.js:4877). */
function buildPrompt(input: CheckinCoachRequest): string {
  return `
Você é o IA Evo do RunEvo. Analise o check-in semanal e recomende um ajuste prudente para a próxima semana.

DADOS DO CHECK-IN:
${JSON.stringify(input, null, 2)}

REGRAS DE SEGURANÇA:
- Se feedback.pain=true, use action "recovery" ou "reduce". Nunca aumente carga.
- Se summary.averageEffort >= 9 ou feedback.effort >= 9, nunca aumente carga.
- Se summary.completionRate < 0.6, nunca aumente carga.
- Se summary.resolved < summary.total (treino pulado), explique que houve treino pulado e recomende redistribuição prudente da carga, sem compensar tudo de uma vez.
- Se houver treino pulado mas sem dor e com esforço controlado, prefira manter ou redistribuir no máximo 30% a 50% da carga perdida na próxima semana.
- Nunca transforme treino pulado em punição; o objetivo é continuidade segura.
- Aumento adicional máximo permitido: 3%.
- Não compare rigidamente o volume da próxima semana já planejada com o volume realizado da semana atual para forçar redução.
- Se a semana foi 100% concluída, com esforço <= 5, sensação leve e sem dor, prefira "maintain"; não recomende "reduce" apenas porque a próxima semana do plano é maior.
- Redução padrão: 10% a 20%.
- A prova (planContext) nunca é alterada — isso é decidido fora da IA.
- Seja conservador. Priorize consistência e prevenção de lesão.
- Retorne somente JSON válido, sem markdown, sem texto fora do JSON.

FORMATO EXATO:
{
  "action": "maintain | reduce | recovery | slight_increase",
  "adjustmentPercent": 0,
  "weeksToAdjust": 1,
  "confidence": "baixa | média | alta",
  "reason": "motivo técnico curto",
  "messageToUser": "mensagem curta e humana para o atleta",
  "coachTip": "uma dica prática para a próxima semana"
}
`;
}

interface GeminiCandidate {
  content?: { parts?: Array<{ text?: string }> };
}
interface GeminiResponseBody {
  candidates?: GeminiCandidate[];
}

/** Mesmo backoff de `generate-plan` (2000ms * tentativa em 429/5xx, 1500ms entre tentativas de fetch). */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries: number,
  signal: AbortSignal,
): Promise<Response> {
  let lastResponse: Response | undefined;

  for (let attempt = 0; attempt < retries; attempt++) {
    if (signal.aborted) throw new Error('Tempo limite excedido.');

    try {
      const response = await fetch(url, { ...options, signal });
      lastResponse = response;

      if (response.ok) return response;

      if (response.status === 429 || response.status >= 500) {
        const waitTime = 2000 * (attempt + 1);
        console.warn(`Retry ${attempt + 1}/${retries} em ${waitTime}ms (status ${response.status})`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        continue;
      }

      throw new Error(`Gemini API error (${response.status})`);
    } catch (error) {
      if (attempt === retries - 1) throw error;
      console.warn(`Fetch attempt ${attempt + 1} failed`);
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  if (lastResponse) throw new Error(`Todos os retries falharam. Último status: ${lastResponse.status}.`);
  throw new Error('Todos os retries falharam sem resposta do servidor.');
}

/** ai-coach.js:836-853 (`parseJSONResponse`) — limpa cercas de markdown e extrai o objeto JSON. */
function parseJSONResponse(text: string): unknown {
  let cleaned = String(text || '').trim();
  cleaned = cleaned
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) cleaned = cleaned.slice(firstBrace, lastBrace + 1);

  return JSON.parse(cleaned);
}

async function tryModels(prompt: string, apiKey: string, signal: AbortSignal): Promise<unknown> {
  let lastError: unknown = null;

  for (const model of MODELS) {
    try {
      const response = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              topP: 0.95,
              topK: 40,
              maxOutputTokens: 1024,
              responseMimeType: 'application/json',
            },
          }),
        },
        2,
        signal,
      );

      const data = (await response.json()) as GeminiResponseBody;
      const content = data.candidates?.[0]?.content;
      const text = content?.parts?.[0]?.text;
      if (!text) throw new Error(`Modelo ${model} retornou conteúdo vazio ou bloqueado.`);

      return parseJSONResponse(text);
    } catch (error) {
      console.error(`Falha no modelo ${model}:`, error instanceof Error ? error.message : 'erro desconhecido');
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Nenhum modelo disponível conseguiu processar a requisição.');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ error: 'Não autenticado.' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Configuração incompleta: SUPABASE_URL/SUPABASE_ANON_KEY ausentes.');
    return jsonResponse({ error: 'Configuração incompleta' }, 500);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) return jsonResponse({ error: 'Sessão inválida.' }, 401);

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return jsonResponse({ error: 'Corpo da requisição inválido.' }, 400);
  }

  const parsedInput = requestSchema.safeParse(rawBody);
  if (!parsedInput.success) {
    return jsonResponse({ error: 'Entrada inválida.', details: parsedInput.error.flatten() }, 400);
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    console.error('ERRO: GEMINI_API_KEY não configurada nas variáveis de ambiente da função.');
    return jsonResponse(
      { error: 'Configuração incompleta', details: 'A chave da API (GEMINI_API_KEY) não foi configurada.' },
      500,
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const prompt = buildPrompt(parsedInput.data);
    const rawRecommendation = await tryModels(prompt, apiKey, controller.signal);
    const parsedOutput = recommendationSchema.safeParse(rawRecommendation);

    if (!parsedOutput.success) {
      console.error('Resposta da IA fora do contrato:', parsedOutput.error.message);
      return jsonResponse({ error: 'Resposta da IA fora do contrato esperado.' }, 502);
    }

    return jsonResponse({ success: true, recommendation: parsedOutput.data });
  } catch (error) {
    if (controller.signal.aborted) {
      console.error('Timeout ao chamar a IA.');
      return jsonResponse({ error: 'Tempo limite excedido ao gerar resposta com a IA.' }, 504);
    }

    // Log sem dados sensíveis (§38): só a mensagem, nunca o payload do atleta.
    console.error('ERRO NO SERVIDOR:', error instanceof Error ? error.message : 'erro desconhecido');
    return jsonResponse(
      { error: 'Erro ao gerar resposta com Gemini', details: error instanceof Error ? error.message : undefined },
      500,
    );
  } finally {
    clearTimeout(timeout);
  }
});
