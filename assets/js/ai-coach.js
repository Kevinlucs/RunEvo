// ===== AI COACH MODULE =====
// Integração com Google Gemini API para geração de planilha de treino personalizada

const AICoach = (() => {
  function getPlanKey() { return `${localStorage.getItem('planebsb_current_user')}_planebsb_ai_plan`; }
  function getAdoptedKey() { return `${localStorage.getItem('planebsb_current_user')}_planebsb_ai_adopted`; }

  // ===== API CALL CONFIG =====
  // Agora usamos a nossa própria API na Vercel para mascarar a chave
  const API_ENDPOINT = '/api/generate-plan';

  // ===== PROFILE =====
  function saveProfile(data) {
    // Intencionalmente vazio para não armazenar cache do formulário
  }

  function loadProfile() {
    return null; // Sempre retorna null para forçar formulário limpo
  }

  // Helper para converter "YYYY-MM-DD" local evitando bug de timezone (UTC -3)
  function parseLocalDate(dateStr) {
    if (!dateStr) return new Date();
    const [y, m, d] = dateStr.split('-');
    return new Date(y, m - 1, d);
  }

  // ===== PROMPT ENGINEERING =====
  function buildPrompt(userData) {
    const distLabels = {
      '5': '5 km',
      '10': '10 km',
      '21': 'Meia Maratona (21.1 km)',
      '42': 'Maratona (42.2 km)',
      'ultra': 'Ultramaratona',
    };

    let distLabel = distLabels[userData.targetDistance] || `${userData.customDistance} km`;
    if (userData.targetDistance === 'ultra' && userData.customDistance) {
      distLabel = `Ultramaratona (${userData.customDistance} km)`;
    }

    let temposAnteriores = '';
    if (userData.time5k) temposAnteriores += `- Melhor tempo 5K: ${userData.time5k}\n`;
    if (userData.time10k) temposAnteriores += `- Melhor tempo 10K: ${userData.time10k}\n`;
    if (userData.time21k) temposAnteriores += `- Melhor tempo 21K: ${userData.time21k}\n`;
    if (userData.time42k) temposAnteriores += `- Melhor tempo 42K: ${userData.time42k}\n`;
    if (!temposAnteriores) temposAnteriores = '- Nenhum tempo anterior informado\n';

    const totalWeeks = calculateWeeks(userData.startDate, userData.raceDate);

    const startD = parseLocalDate(userData.startDate);
    const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const startDOW = diasSemana[startD.getDay()];

    let imcText = '';
    if (userData.imc) {
      imcText = `\n- IMC Atual: ${userData.imc} (Forneça uma recomendação nutricional e de ritmo adequada a este IMC)`;
    }

    let test3kmText = '';
    if (userData.test3kmTime || userData.test3kmPace) {
      test3kmText = `\nTESTE DE 3KM E FISIOLOGIA:\n- Tempo no Teste de 3km: ${userData.test3kmTime || 'N/A'}\n- Pace no Teste de 3km: ${userData.test3kmPace || 'N/A'}\nINSTRUÇÃO ESPECIAL: Utilize este resultado do teste de 3km para prescrever os paces de todos os treinos de forma matematicamente precisa.`;
    }

    return `Você é um treinador profissional de corrida de rua com 20+ anos de experiência. Crie uma planilha de treino COMPLETA e PERSONALIZADA.

DADOS DO ATLETA:
- Nome: ${userData.name || 'Atleta'}
- Idade: ${userData.age} anos
- Altura: ${userData.height} cm
- Peso: ${userData.weight} kg${imcText}
- Nível: ${userData.level.toUpperCase()}
- Distância Alvo: ${distLabel}
- Dias de treino por semana: ${userData.daysPerWeek} dias
- Data de Início: ${userData.startDate} (${startDOW})
- Data da Prova: ${userData.raceDate}${test3kmText}

TEMPOS ANTERIORES:
${temposAnteriores}

REGRAS OBRIGATÓRIAS:
1. Divida o plano em fases: Base, Resistência, Pico e Polimento (Taper)
2. Inclua semanas de descanso/off a cada 3-4 semanas
3. Respeite a periodização: volume crescente na Base, intensidade na Resistência, pico de volume no Pico, e redução no Polimento
4. O primeiro treino da semana DEVE OBRIGATORIAMENTE ser no dia: ${startDOW} (Data de Início). Distribua os outros dias ao longo da semana.
5. Inclua variedade: treinos leves, intervalados, tempo run, longão, subidas
6. O longão (maior distância) deve ser sempre no último dia da semana de treino
7. Adapte as distâncias e paces ao nível do atleta
8. A última semana deve terminar com a prova
9. Use exatamente ${totalWeeks} semanas no total

FORMATO DE RESPOSTA — RETORNE APENAS O JSON, sem texto adicional:
{
  "planName": "Plano [distância] - [nível]",
  "totalWeeks": ${totalWeeks},
  "raceName": "${distLabel}",
  "raceDistance": "${distLabel}",
  "raceDate": "${userData.raceDate}",
  "daysPerWeek": ${userData.daysPerWeek},
  "weeks": [
    {
      "week": "S1",
      "phase": "Base",
      "off": false,
      "workouts": [
        {
          "dayOfWeek": "${startDOW}",
          "dayType": "Qualidade",
          "title": "8km Forte/Pace",
          "desc": "Descrição detalhada do treino com instruções claras",
          "km": 8,
          "pace": "6:30/km",
          "nutrition": {
            "water": "500ml 2h antes",
            "pre": "Banana e aveia",
            "intra": "Gel a cada 45m",
            "post": "Proteína e carbo"
          }
        }
      ]
    }
  ]
}

IMPORTANTE:
- VOCÊ DEVE GERAR EXATAMENTE ${totalWeeks} SEMANAS. A última semana do JSON deve ser a semana da prova.
- dayOfWeek deve usar os nomes em português: "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"
- dayType deve ser um de: "Qualidade", "Base", "Longão", "Recuperação", "Intervalado"
- Cada semana deve ter exatamente ${userData.daysPerWeek} treinos
- "off" = true para semanas de descanso/recuperação
- A fase deve ser: "Base", "Resistência", "Pico" ou "Polimento"
- Mantenha a descrição (desc) muito curta (máximo 1 frase) para economizar texto.
- O campo nutrition deve ser um OBJETO com as chaves "water", "pre", "intra" e "post".
- ATENÇÃO NA NUTRIÇÃO: Seja direto, humano e EXTREMAMENTE prático, pensando em atletas do dia a dia. Forneça comidas reais e quantidades exatas (ex: "500ml 1h antes", "1 banana com aveia", "1 gel a cada 45m ou no km 10", "Pão com ovo e café"). MÁXIMO ABSOLUTO de 10 palavras por chave para economizar tokens!
- Retorne APENAS o JSON, sem markdown, sem explicação, sem \`\`\``;
  }

  function calculateWeeks(startDateStr, raceDateStr) {
    const race = parseLocalDate(raceDateStr);
    const start = parseLocalDate(startDateStr);
    start.setHours(0, 0, 0, 0);
    race.setHours(0, 0, 0, 0);

    // Find Monday of the start week
    const startDay = start.getDay() === 0 ? 6 : start.getDay() - 1;
    const startMonday = new Date(start);
    startMonday.setDate(start.getDate() - startDay);

    // Find Sunday of the race week
    const raceDay = race.getDay() === 0 ? 0 : 7 - race.getDay();
    const raceSunday = new Date(race);
    raceSunday.setDate(race.getDate() + raceDay);

    const diffMs = raceSunday - startMonday;
    const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));

    return Math.max(4, Math.min(52, diffWeeks));
  }

  // ===== API CALL =====
  async function callGeminiAPI(prompt, attempt = 1) {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('Erro completo da API:', data);

      const errMsg =
        data.details ||
        data.error?.message ||
        data.error ||
        `Erro na API (${response.status})`;

      // Tratamento de Rate Limit
      if (response.status === 429 && attempt <= 2) {
        const waitTime = attempt * 10000;
        console.log(`Rate limited. Tentativa ${attempt}/2. Aguardando ${waitTime / 1000}s...`);
        await new Promise(r => setTimeout(r, waitTime));
        return callGeminiAPI(prompt, attempt + 1);
      }

      // Erro de configuração específico
      if (response.status === 500 && (errMsg.includes('API Key not configured') || errMsg.includes('Configuração incompleta'))) {
        throw new Error('Erro de configuração: A chave da IA não foi configurada no servidor Vercel.');
      }

      throw new Error(errMsg);
    }

    return data;
  }

  async function generatePlan(userData) {
    const prompt = buildPrompt(userData);
    const data = await callGeminiAPI(prompt);
    const text = data.text;

    if (!text) {
      console.error('Empty response. Full response:', data);
      throw new Error('Resposta vazia da IA. Tente novamente.');
    }

    return parsePlanResponse(text, userData);
  }

  // ===== PARSE RESPONSE =====
  function parsePlanResponse(text, userData) {
    // Clean up: remove markdown code fences if present
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    let plan;
    try {
      plan = JSON.parse(cleaned);
    } catch (e) {
      // Try to find JSON in the text
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          plan = JSON.parse(jsonMatch[0]);
        } catch {
          throw new Error('Não foi possível interpretar a resposta da IA. Tente novamente.');
        }
      } else {
        throw new Error('Resposta da IA não contém JSON válido. Tente novamente.');
      }
    }

    // Validate structure
    if (!plan.weeks || !Array.isArray(plan.weeks) || plan.weeks.length === 0) {
      throw new Error('Plano gerado está incompleto. Tente novamente.');
    }

    // Ensure each week has required fields
    plan.weeks.forEach((week, i) => {
      if (!week.week) week.week = `S${i + 1}`;
      if (!week.phase) week.phase = 'Base';
      if (typeof week.off !== 'boolean') week.off = false;
      if (!week.workouts || !Array.isArray(week.workouts)) week.workouts = [];

      week.workouts.forEach(w => {
        if (!w.dayOfWeek) w.dayOfWeek = 'Terça';
        if (!w.dayType) w.dayType = 'Base';
        if (!w.title) w.title = 'Treino';
        if (!w.desc) w.desc = '';
        if (typeof w.km !== 'number') w.km = 0;
        if (!w.pace) w.pace = '-';
        if (!w.nutrition || typeof w.nutrition === 'string') {
          w.nutrition = {
            water: '500ml 2h antes',
            pre: w.km > 15 ? 'Carboidratos 2h antes' : '1 banana 45min antes',
            intra: w.km > 15 ? 'Gel a cada 45min' : 'Água conforme a sede',
            post: 'Proteína e frutas'
          };
        }
      });
    });

    // Attach generation metadata
    plan.generatedAt = new Date().toISOString();
    plan.userData = userData;

    return plan;
  }

  // ===== CONVERT AI PLAN TO APP FORMAT =====
  function convertToWeeksData(plan) {
    if (!plan || !plan.weeks) return null;

    const raceDate = parseLocalDate(plan.raceDate);
    const startDate = parseLocalDate(plan.userData.startDate);
    startDate.setHours(0, 0, 0, 0);

    // Find the Monday of the starting week to use as the base for day offsets
    const startDayOfWeek = startDate.getDay();
    const jsDayToMondayIndexed = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
    const week1Monday = new Date(startDate);
    week1Monday.setDate(startDate.getDate() - jsDayToMondayIndexed);

    const dayMap = {
      'Segunda': 0, 'Terça': 1, 'Quarta': 2, 'Quinta': 3,
      'Sexta': 4, 'Sábado': 5, 'Domingo': 6
    };

    const weeksData = plan.weeks.map((week, weekIndex) => {
      const weekStart = new Date(week1Monday);
      weekStart.setDate(weekStart.getDate() + weekIndex * 7);

      const workouts = week.workouts.map(w => {
        const dayOffset = dayMap[w.dayOfWeek] || 0;
        const workoutDate = new Date(weekStart);
        workoutDate.setDate(workoutDate.getDate() + dayOffset);

        return {
          dayOfWeek: w.dayOfWeek,
          dayType: w.dayType,
          title: w.title,
          desc: w.desc,
          km: w.km,
          pace: w.pace,
          nutrition: w.nutrition,
          date: workoutDate
        };
      });

      return {
        week: week.week,
        phase: week.phase,
        off: week.off,
        weekIndex,
        workouts,
        totalKm: workouts.reduce((s, w) => s + w.km, 0)
      };
    });

    return {
      startDate: startDate.toISOString(),
      raceDate: raceDate.toISOString(),
      raceName: plan.raceName || 'Prova',
      raceDistance: (plan.userData.targetDistance === 'custom' || plan.userData.targetDistance === 'ultra') ? parseInt(plan.userData.customDistance) : parseInt(plan.userData.targetDistance) || 42,
      planName: plan.planName || 'Plano Personalizado',
      daysPerWeek: plan.daysPerWeek || 3,
      totalWeeks: weeksData.length,
      weeks: weeksData,
      generatedAt: plan.generatedAt,
      userData: plan.userData
    };
  }

  // ===== PERSISTENCE =====
  function savePlan(plan) {
    const converted = convertToWeeksData(plan);
    localStorage.setItem(getPlanKey(), JSON.stringify(converted));
    return converted;
  }

  function loadPlan() {
    try {
      return JSON.parse(localStorage.getItem(getPlanKey()) || 'null');
    } catch { return null; }
  }

  function clearPlan() {
    localStorage.removeItem(getPlanKey());
    localStorage.removeItem(getAdoptedKey());
  }

  function adoptPlan() {
    const plan = loadPlan();
    if (!plan) return false;
    localStorage.setItem(getAdoptedKey(), 'true');
    return true;
  }

  function unadoptPlan() {
    localStorage.removeItem(getAdoptedKey());
  }

  function isPlanAdopted() {
    return localStorage.getItem(getAdoptedKey()) === 'true';
  }

  // ===== CONVERT ADOPTED PLAN TO allWorkouts FORMAT =====
  function getAdoptedWorkouts() {
    if (!isPlanAdopted()) return null;
    const plan = loadPlan();
    if (!plan) return null;

    const allWorkouts = [];
    const startDate = new Date(plan.startDate);

    plan.weeks.forEach((week, weekIndex) => {
      week.workouts.forEach((w, wi) => {
        const d = new Date(w.date);
        const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        const dateBR = `${dias[d.getDay()]}, ${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;

        allWorkouts.push({
          id: `${week.week}-${wi}`,
          week: week.week,
          weekIndex,
          phase: week.phase,
          off: week.off,
          day: dias[d.getDay()],
          dayType: w.dayType,
          date: d,
          dateStr: d.toISOString().split('T')[0],
          dateBR,
          title: w.title,
          desc: w.desc,
          km: w.km,
          pace: w.pace,
          nutrition: w.nutrition,
        });
      });
    });

    return {
      workouts: allWorkouts,
      raceDate: new Date(plan.raceDate),
      raceName: plan.raceName,
      raceDistance: plan.raceDistance,
      planName: plan.planName,
      startDate
    };
  }

  // ===== PUBLIC API =====
  return {
    saveProfile,
    loadProfile,
    generatePlan,
    savePlan,
    loadPlan,
    clearPlan,
    adoptPlan,
    unadoptPlan,
    isPlanAdopted,
    getAdoptedWorkouts,
    calculateWeeks
  };
})();
