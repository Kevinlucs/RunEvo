# Fase 5 — Brief de Execução: Adaptive Training (check-in) + Editor Manual

> **Para o Claude Code executar.** Branch: `feat/fase-5-adaptive-editor` (a partir de `main` atualizado).
> Referências: enunciado **§21** (Adaptive), **§22** (edição manual), **§28** (detalhe do treino).
> Spec: `docs/motor-evo-specification.md` §18 (regras de adaptação — já portadas na Fase 2) e §19 (edição).
> Legado: `legacy/app.js` (contrato do coach de check-in), `legacy/ai-coach.js` (regras).
>
> **Objetivo:** fechar o ciclo vivo do app. O atleta executa a semana, faz o **check-in semanal**,
> e o plano se **adapta** para as semanas futuras — com IA real (Gemini) sugerindo e os guardrails
> de segurança decidindo. Mais o **editor manual** para ajustes finos, que invalida o check-in afetado.

---

## 0. Guardrails da fase (inegociáveis)

1. **`src/domain/motor-evo/` está fechado.** As regras de adaptação (`recommendAdjustment`, `redistributeSkipped`, `applyAdjustment`, `normalizeAICheckinRecommendation`) já foram portadas e testadas na Fase 2. Esta fase **consome** o domínio, não o reescreve. Se precisar tocar, pare e avise.
2. **A IA sugere; o código decide.** A resposta do Gemini passa **obrigatoriamente** por `normalizeAICheckinRecommendation` (guardrails §18) antes de virar ajuste. Nenhum caminho aplica a resposta bruta da IA. Se a IA falhar/exceder/alucinar, usa a recomendação local. **O atleta nunca fica sem check-in por falha de IA.**
3. **Guardrails §18 são lei:** dor → nunca aumenta (vira `recovery`); esforço ≥9 ou adesão <60% → nunca aumenta; aumento máx +3%; redução 10–20%; recuperação 15–30%; semana perfeita+leve → mantém; redistribuição de pulado 30–50% com teto ~12% da semana seguinte; ajusta **só semanas futuras**; **nunca altera a prova**.
4. **Persistência só via repositories** (offline-first). Check-in e edições funcionam offline; a chamada de IA é a única parte que exige rede (com fallback local).
5. **Gates verdes antes de cada commit:** typecheck 0, lint 0/0, testes ≥280.

---

## Grupo 1 — Edge Function `checkin-coach` (IA real, separada)

Crie `supabase/functions/checkin-coach/index.ts` — **função separada** de `generate-plan` (decisão do usuário: melhor manutenção/segurança; cada função valida seu próprio contrato).

- Reutilize a infra da `generate-plan`: retry 429/5xx, timeout ~25s (`AbortController`), `temperature: 0.2`, `responseMimeType: application/json`, **JWT obrigatório**, `GEMINI_API_KEY` de `Deno.env` (já configurada).
- **Entrada (Zod):** resumo da semana — `{ weekNumber, summary: { total, resolved, completedKm, plannedKm, averageEffort, completionRate }, feedback: { effort, feeling, pain, notes }, planContext: { raceType, phase, weeksToRace } }`.
- **Saída (Zod):** o formato que `normalizeAICheckinRecommendation` espera — `{ action: 'maintain'|'reduce'|'recovery'|'slight_increase', adjustmentPercent, weeksToAdjust, reason, coachTip, messageToUser, confidence }`. Campos extras tolerados; tipos estritos.
- **Prompt:** porte a intenção de `callAICheckinCoach` (`legacy/app.js:4877`). O prompt instrui a IA a agir como treinador conservador e devolver **só** o JSON de recomendação — nunca a planilha. Deixe explícito no prompt que dor/esforço alto exigem cautela (mesmo que o guardrail local reforce depois).

**Deploy:** o usuário roda `npx supabase functions deploy checkin-coach`. Documente isso no PR.

**Teste (headless):** IA válida → recomendação normalizada; IA com JSON inválido → cai na recomendação local; IA com `slight_increase` + `pain:true` → guardrail força `recovery`. Nenhum caso lança.

---

## Grupo 2 — Fluxo de check-in (domínio → serviço → estado)

### 2.1 Liberação (§21)

`useCheckinAvailability(weekNumber)`: usa `summarizeWeek` (já no domínio) — check-in libera **só** quando `resolved === total` (todos concluídos/pulados). Estados: `Feito` · `Liberado` · `Aguardando treinos`. Exibe treinos resolvidos/total, km realizado/planejado, esforço médio.

### 2.2 Coleta (§21)

Formulário de check-in: esforço percebido (1–10), sensação (`leve|normal|pesado|muito_pesado`), dor (sim/não), observações, contexto da semana. **Peso obrigatório** quando `(weekIndex+1) % 4 === 0` (e ciclos definidos) — bloqueia envio sem peso nesses casos; opcional nos demais.

### 2.3 Recomendação e aplicação

`services/checkin/submit-checkin.service.ts`:

1. Monta o `summary` + `feedback`.
2. `recommendAdjustment` local (domínio) — sempre, é a base.
3. Chama `checkin-coach` (IA). **Qualquer** falha → segue só com a local.
4. `normalizeAICheckinRecommendation(ai, feedback, local)` — **aqui os guardrails decidem**.
5. `redistributeSkipped` se houver treinos pulados na semana.
6. `applyAdjustment` — reescala **só semanas futuras**, nunca a prova; `recovery` marca semana como leve.
7. Persiste: `weekly_checkins` (com `ai_analysis` e `adjustment`) + os `plan_workouts` reescalados, via repositories → outbox.
8. Registra `source: 'ai' | 'local'` na origem do ajuste, e mostra ao atleta qual foi.

**Teste de integração:** dor + IA sugerindo aumento → aplica `recovery` (guardrail vence a IA); semana perfeita+leve → `maintain` (não reduz); pulado → redistribui dentro do teto ~12%; prova intocada em todos os casos; IA fora do ar → tudo funciona no local.

### ⏸ PARADA 1 — reporte
Resumo `X/Y verdes` + divergências. Confirme com **um teste real** (não headless): faça um check-in no app com a IA ligada e mostre se veio `source: 'ai'` e a recomendação. Se verde, siga para o Grupo 3.

---

## Grupo 3 — UI do Adaptive Training / check-in (§21)

> **Não há mockup desta tela.** Layout especificado abaixo a partir do §21 e do design system §36. Siga a linguagem visual das telas já calibradas (cards compactos, neon só para destaque, degradês sutis).

**Bloco Adaptive na Home** (já existe em leitura desde a Fase 4): agora o CTA fica **ativo** quando `canCheckin`, abrindo a tela de check-in. Quando não liberado, mantém o rótulo honesto ("Conclua os treinos da semana").

**Tela de check-in** `src/app/plan/checkin/[week].tsx`, na ordem:
1. Cabeçalho: "Check-in — Semana N" + fase.
2. **Resumo da semana** (card): treinos resolvidos/total, km realizado/planejado, esforço médio, adesão %.
3. **Formulário:** esforço (seletor 1–10), sensação (4 opções), dor (sim/não), peso (campo — obrigatório e destacado quando for semana de peso), observações.
4. CTA **"Analisar semana"** → loading curto (chamada da IA) → **tela de resultado**.
5. **Resultado do ajuste:** título da ação (Manter / Reduzir / Recuperação / Leve aumento), mensagem do coach, origem (🧠 IA Evo / ⚙️ Ajuste local), o que muda nas próximas semanas (resumo do reescalonamento), e o disclaimer de que não é orientação médica.

**Estados:** loading da IA com fallback visível se demorar; erro de rede não trava (usa local e informa "análise local"). Peso ausente em semana obrigatória → erro inline, não deixa enviar.

Acessibilidade §37: touch target ≥44, teclado não cobre campos, contraste.

---

## Grupo 4 — Editor manual de treinos (§22)

Tela/rotas de edição a partir de Treinos e do detalhe do treino. Ações (§22): editar treino, adicionar, remover, alterar data/título/tipo/km/pace/descrição, reordenar, **recalcular a semana** (totais) após qualquer mudança.

**Regra crítica (§22):** **edição manual invalida o check-in afetado.** Se o atleta edita um treino de uma semana que já teve check-in, marque aquele check-in como invalidado (e o ajuste derivado dele) — o atleta precisa refazer. Persista a invalidação; reflita na Home e em Treinos.

**Proteções:**
- O treino da **prova** não pode ser editado nem removido (evento final).
- Edições respeitam o shape do motor; a conversão para o banco passa pelo mapper (Fase 3) — não grave direto.
- Recalcular a semana usa utilitários do domínio (soma de km etc.), não lógica nova na UI.

**Sincronização (§22):** após editar, Home, Treinos e o detalhe refletem na hora (invalidar queries — o mecanismo de invalidação pós-sync da Fase 4 já existe, reutilize).

**Teste:** editar km de um treino recalcula o total da semana; remover treino reordena; editar semana com check-in existente invalida o check-in; prova é imutável; tudo persiste offline.

---

## Grupo 5 — Robustez do sync para erros permanentes (débito da Fase 1)

Durante as migrations descobrimos que o outbox **descarta** uma entrada após 5 tentativas — mas trata **erro de schema (permanente)** igual a **erro de rede (transitório)**, perdendo dados em silêncio.

Corrija em `src/db/sync.ts`:
- Distinga erro **transitório** (rede/5xx/429 → re-tenta) de **permanente** (4xx de schema/constraint/validação → não adianta re-tentar).
- Erro permanente: **não** descarte em silêncio — marque a entrada do outbox como `failed` (nova coluna/estado) com o motivo, e exponha isso (log + um estado consultável), para não perder o dado calado.
- Erro transitório: mantém o comportamento de re-tentar, mas **não** descarte por esgotar tentativas se for claramente permanente.

**Teste:** entrada com violação de constraint vai para `failed` com motivo, não some; entrada com erro de rede re-tenta.

---

## ⏸ PARADA 2 — fechamento

Traga **apenas**:
1. resumo `X/Y verdes` + divergências;
2. bloco §41 do PR;
3. decisões tomadas sozinho;
4. teste no emulador: check-in completo (com IA real) → ver o ajuste aplicado nas semanas futuras; editar um treino de semana com check-in → confirmar invalidação; Pixel 7 **e** 360dp.

Depois abra o PR de `feat/fase-5-adaptive-editor` para `main`.

---

## Disciplina de tokens

- Não reimprima teste que passa — só falhas + resumo.
- Um commit por grupo.
- Só interrompa fora das paradas se: tocar no motor, faltar arquivo do legado, ou algo exigir mudar comportamento.

**A IA sugere, os guardrails decidem. Nunca aplique a resposta bruta do modelo. Não simplifique o Motor RunEvo. Nada de mock que finge funcionar.**
