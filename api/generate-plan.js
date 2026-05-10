const MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite'
];

async function fetchWithRetry(url, options, retries = 3) {
  let lastResponse;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, options);
      lastResponse = response;

      if (response.ok) {
        return response;
      }

      // Erros de cota ou servidor temporário
      if (response.status === 429 || response.status >= 500) {
        const waitTime = 2000 * (attempt + 1);
        console.warn(`Retry ${attempt + 1}/${retries} em ${waitTime}ms para status ${response.status}`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      // Outros erros (400, 403, etc) - não tenta de novo pois são definitivos
      const errorText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errorText}`);

    } catch (error) {
      if (attempt === retries - 1) throw error;
      console.warn(`Fetch attempt ${attempt + 1} failed: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }

  if (lastResponse) {
    const text = await lastResponse.text();
    throw new Error(`Todos os retries falharam. Último status: ${lastResponse.status}. Resposta: ${text}`);
  }
  throw new Error('Todos os retries falharam sem resposta do servidor.');
}

async function tryModels(prompt, apiKey) {
  let lastError = null;

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
              responseMimeType: 'application/json' // Força resposta JSON pura
            }
          })
        },
        2
      );

      const data = await response.json();

      // Validação profunda da resposta
      if (!data.candidates || data.candidates.length === 0) {
        console.error(`Modelo ${model} retornou sem candidatos:`, JSON.stringify(data));
        throw new Error(`Modelo ${model} não retornou nenhuma resposta válida (candidatos vazios).`);
      }

      const content = data.candidates[0].content;
      if (!content || !content.parts || content.parts.length === 0) {
        console.error(`Modelo ${model} retornou conteúdo vazio:`, JSON.stringify(data));
        throw new Error(`Modelo ${model} retornou conteúdo vazio ou bloqueado.`);
      }

      const text = content.parts[0].text;
      if (!text) {
        throw new Error(`Modelo ${model} retornou texto vazio.`);
      }

      return { model, text };

    } catch (error) {
      console.error(`Falha no modelo ${model}:`, error.message);
      lastError = error;
      // Continua para o próximo modelo
    }
  }

  throw lastError || new Error('Nenhum modelo disponível conseguiu processar a requisição.');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt obrigatório' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('ERRO: GEMINI_API_KEY não encontrada nas variáveis de ambiente da Vercel.');
      return res.status(500).json({
        error: 'Configuração incompleta',
        details: 'A chave da API (GEMINI_API_KEY) não foi configurada no painel da Vercel.'
      });
    }

    const result = await tryModels(prompt, apiKey);

    return res.status(200).json({
      success: true,
      model: result.model,
      text: result.text
    });

  } catch (error) {
    console.error('ERRO NO SERVIDOR:', error);
    return res.status(500).json({
      error: 'Erro ao gerar resposta com Gemini',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}