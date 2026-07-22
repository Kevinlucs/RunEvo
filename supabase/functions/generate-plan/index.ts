// Edge Function `generate-plan` (Deno) — porte de `legacy/api/generate-plan.js`
// (backend serverless Vercel do legado). Contrato preservado: `POST { prompt: string }`.
//
// Preservado do legado: lista de modelos com fallback, retry com backoff em
// 429/5xx, generationConfig (temperature/topP/topK/maxOutputTokens/
// responseMimeType). Acrescentado nesta fase (docs/fase-3-brief.md §2.1,
// o legado não tinha): exigência de JWT, timeout ~25s (AbortController),
// chave só em variável de ambiente da função, logs sem dados sensíveis (§38).
//
// A chave de IA NUNCA fica no app — só aqui (`Deno.env.get('GEMINI_API_KEY')`,
// configurada via `supabase secrets set GEMINI_API_KEY=...`).
import { createClient } from 'npm:@supabase/supabase-js@2';

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

interface GeminiCandidate {
  content?: { parts?: Array<{ text?: string }> };
}
interface GeminiResponseBody {
  candidates?: GeminiCandidate[];
}

/** ai-coach.js legado (api/generate-plan.js:6-41) — mesmo backoff (2000ms * tentativa), 1500ms entre tentativas de fetch. */
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

      // Erros de cota ou servidor temporário
      if (response.status === 429 || response.status >= 500) {
        const waitTime = 2000 * (attempt + 1);
        console.warn(`Retry ${attempt + 1}/${retries} em ${waitTime}ms (status ${response.status})`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        continue;
      }

      // Outros erros (400, 403, etc.) — mesmo comportamento do legado: o throw
      // aqui é capturado pelo catch abaixo, então ainda entra na lógica de retry.
      throw new Error(`Gemini API error (${response.status})`);
    } catch (error) {
      if (attempt === retries - 1) throw error;
      console.warn(`Fetch attempt ${attempt + 1} failed`);
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  if (lastResponse) {
    throw new Error(`Todos os retries falharam. Último status: ${lastResponse.status}.`);
  }
  throw new Error('Todos os retries falharam sem resposta do servidor.');
}

/** api/generate-plan.js:43-97 */
async function tryModels(prompt: string, apiKey: string, signal: AbortSignal): Promise<{ model: string; text: string }> {
  let lastError: unknown = null;

  for (const model of MODELS) {
    try {
      console.log(`Tentando modelo: ${model}`);
      const response = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2, // Reduzido para maior precisão no JSON
              topP: 0.95,
              topK: 40,
              maxOutputTokens: 8192,
              responseMimeType: 'application/json', // Força resposta JSON pura
            },
          }),
        },
        2,
        signal,
      );

      const data = (await response.json()) as GeminiResponseBody;

      if (!data.candidates || data.candidates.length === 0) {
        console.error(`Modelo ${model} retornou sem candidatos.`);
        throw new Error(`Modelo ${model} não retornou nenhuma resposta válida (candidatos vazios).`);
      }

      const content = data.candidates[0]?.content;
      if (!content?.parts || content.parts.length === 0) {
        console.error(`Modelo ${model} retornou conteúdo vazio.`);
        throw new Error(`Modelo ${model} retornou conteúdo vazio ou bloqueado.`);
      }

      const text = content.parts[0]?.text;
      if (!text) {
        throw new Error(`Modelo ${model} retornou texto vazio.`);
      }

      return { model, text };
    } catch (error) {
      console.error(`Falha no modelo ${model}:`, error instanceof Error ? error.message : 'erro desconhecido');
      lastError = error;
      // Continua para o próximo modelo
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Nenhum modelo disponível conseguiu processar a requisição.');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  // Exige JWT — só usuário autenticado invoca (docs/fase-3-brief.md §2.1).
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'Não autenticado.' }, 401);
  }

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
  if (userError || !userData?.user) {
    return jsonResponse({ error: 'Sessão inválida.' }, 401);
  }

  let prompt: unknown;
  try {
    const body = await req.json();
    prompt = body?.prompt;
  } catch {
    return jsonResponse({ error: 'Corpo da requisição inválido.' }, 400);
  }

  if (!prompt || typeof prompt !== 'string') {
    return jsonResponse({ error: 'Prompt obrigatório' }, 400);
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    console.error('ERRO: GEMINI_API_KEY não configurada nas variáveis de ambiente da função.');
    return jsonResponse(
      { error: 'Configuração incompleta', details: 'A chave da API (GEMINI_API_KEY) não foi configurada.' },
      500,
    );
  }

  // Timeout ~25s (docs/fase-3-brief.md §2.1) — o app não pode ficar pendurado.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const result = await tryModels(prompt, apiKey, controller.signal);
    return jsonResponse({ success: true, model: result.model, text: result.text });
  } catch (error) {
    if (controller.signal.aborted) {
      console.error('Timeout ao chamar a IA.');
      return jsonResponse({ error: 'Tempo limite excedido ao gerar resposta com a IA.' }, 504);
    }

    // Log sem dados sensíveis (§38): não loga o prompt (dados do atleta) nem o
    // objeto de erro inteiro, só a mensagem.
    console.error('ERRO NO SERVIDOR:', error instanceof Error ? error.message : 'erro desconhecido');
    return jsonResponse(
      { error: 'Erro ao gerar resposta com Gemini', details: error instanceof Error ? error.message : undefined },
      500,
    );
  } finally {
    clearTimeout(timeout);
  }
});
