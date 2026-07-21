# Motor RunEvo — Relatório de Equivalência (Fase 2)

> Rastreia `src/tests/motor-evo/fixtures.ts` (f01..f10) contra os 10 cenários
> oficiais do enunciado §39 (não presente em `docs/*.md` deste repo — ver nota
> em `fixtures.ts`). Atualizado a cada parada de report combinada com o time.

## Mapa de cobertura

| # oficial (§39) | Cenário | Fixture | Como instancia |
|---|---|---|---|
| 1 | Iniciante 5K, plano, 3d | `f01` | `targetDistance:'5'`, `level:'iniciante'`, `terrain:'plano'`, `daysPerWeek:3`, sem objetivo |
| 2 | Intermediário 10K, sub 50 | `f02` | `targetDistance:'10'`, objetivo `"sub 50"` → padrão 4 de `parseTimeGoalFromObjective` |
| 3 | Intermediário 21K, 1h45 | `f03` | `targetDistance:'21'`, `time21k:'1:45:00'` como melhor tempo anterior + objetivo de recorde (heurística de PR × fator 0.98, não meta direta de 1h45 — ver nota abaixo) |
| 4 | Maratona sub 4h | `f04` | `targetDistance:'42'`, objetivo `"em 4 horas"` → heurística `a:b:0→horas` (≥21K) |
| 5 | Ultra 61K, conservadora, elevado, 3d | `f05` | `targetDistance:'ultra'`, `customDistance:61`, `terrain:'elevado'`, `daysPerWeek:3`, objetivo explícito de tempo conservador |
| 6 | IMC alto | `f06` | `weight:95`/`height:165` → IMC≈34.9; demais campos neutros (10K, plano, sem objetivo) para isolar o fator de risco |
| 7 | Prazo curto | `f07` | `targetDistance:'21'`, `calculateWeeks=10` (<12 semanas para ≥21K) |
| 8 | Terreno elevado | `f08` | `targetDistance:'10'`, `terrain:'elevado'`, `daysPerWeek:4` |
| 9 | IA indisponível → `blueprint.source === 'local'` | `f09` | Não é input-dependente: **todas** as fixtures passam pelo caminho local (harness rejeita `fetch` de propósito). `f09` é a referência designada; qualquer fixture golden já tem `blueprint.source === 'local'` hoje — falta o **motor novo** produzir esse campo (Grupo C/D) |
| 10 | Plano idêntico → `arePlansIdentical === true` | `f10` | Não é input-dependente: gerar o plano de `f10` duas vezes e comparar fingerprints deve dar idêntico. `f10` é a referência designada por ser o caso mais simples (2 dias/semana, sem objetivo) |

**Nota sobre f03 vs. cenário oficial 3:** o enunciado diz "inter 21K 1h45"; interpretamos
como "1h45 é o melhor tempo **anterior** do atleta, objetivo é bater esse recorde"
(heurística `previous_pr` × fator 0.98), não "1h45 é a meta direta da prova" (que
usaria a heurística de tempo-final `parseTimeGoalFromObjective`, dando um pace-alvo
diferente). Ambas as leituras são válidas para o texto "21K 1h45" isolado; ficamos
com PR porque é o cenário que a §39 parece querer testar (heurística de recorde ×
fator de melhora), já coberto separadamente por f04 (tempo-final direto) e f09
(PR em distância mais longa, contraste de estratégia de zona). Se a intenção
original era meta direta, sinalizar para ajustarmos.

**f09 e f10 continuam também como fixtures de robustez adicionais** (contraste
PR 21K×42K pelo limiar de 60s; distância customizada + 2 dias/semana) — não
deixam de servir a esse propósito só por também serem a referência dos
cenários 9/10.

## Bugs de Fase 1 corrigidos (fora do histórico do motor)

Isolados como commits próprios, sem misturar com o port do Motor RunEvo:

- `94d9c45` — `eslint-config-prettier` ausente de `package.json` (quebrava `npm run lint`).
- `8ee671e` — reexport duplicado/quebrado em `src/services/auth/index.ts` (`supabaseAuthService` nunca existiu; só `authService`).

Ambos já eram commits separados dos commits de domínio (`feat(motor-evo): ...`)
antes desta nota — não foi necessário reescrever histórico.

## Status por grupo

| Grupo | Módulos | Status |
|---|---|---|
| A | types, utils/math, dates, pace | ✅ portado, 100% equivalente (função a função) |
| B | objective, terrain, zones | ✅ portado, 100% equivalente (função a função) |
| C | profile (calculateIMC), phases, blueprint (local), weekly-targets | em andamento |
| D | workout-library, workout-prescription, plan-generator | em andamento |
| E | (reservado — validação parcial, se necessário) | — |
| F | validation, quality-score, risk, fingerprint | pendente |

_Próxima atualização: Parada 1 (pós-Grupo D) — suíte de equivalência completa
nos 10 golden com tabela de divergências, se houver._
