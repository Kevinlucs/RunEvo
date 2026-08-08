# Fase 7.5 — Brief de Execução: Histórico, Comparação e Evolução entre Ciclos

> **Para o Claude Code executar.** Branch: `feat/fase-7-5-historico-evolucao` (a partir de `main`, após merge da Fase 7).
> Referências: enunciado §31 (Estatísticas), §34 (Free/Plus). Decisões de produto nas notas abaixo.
>
> **Objetivo:** dar alma ao RunEvo+. O gate de entitlement já está amarrado (Fase 7), mas a feature
> por trás — memória e evolução do atleta entre provas — nunca foi construída. Esta fase constrói o
> **carro-chefe da conversão**: o atleta vê seus ciclos anteriores, compara dois deles e enxerga sua
> evolução em gráficos. É o "assine e veja como você melhorou".

---

## 0. Guardrails da fase

1. **`src/domain/motor-evo/` está fechado.** As métricas de evolução vêm de dados **já produzidos e salvos** em cada plano (`blueprint`, `validation.summary`, `quality`, zonas, aderência real dos treinos). **Nada de recalcular treino** nem inventar métrica no cliente. Se precisar de um número que não existe salvo, pare e me avise — não fabrique.
2. **Entitlement no serviço.** Free vê a lista dos próprios ciclos; Plus vê comparação + gráficos de evolução. Todo gate lê `useEntitlement()` → `subscriptionService` (entitlement `RunEvo+`). Nunca decidir na UI.
3. **Persistência via repositories** (offline-first). Histórico funciona offline a partir do cache.
4. **Elegante com 1 ciclo só.** A maioria dos usuários terá poucos planos arquivados no começo. A feature não pode parecer "quebrada" com um ciclo — precisa de estados vazios bem pensados ("complete mais um ciclo para ver sua evolução").
5. **Gates verdes antes de cada commit:** typecheck 0, lint 0/0, testes ≥433.

---

## Modelo de acesso (decisão fechada)

- **Free:** vê a **lista** dos próprios ciclos (a "estante de troféus") — cada ciclo com seu resumo. É valor real e gratuito: o atleta vê sua própria história.
- **Plus:** **comparação entre ciclos** + **gráficos de evolução** (a análise profunda). É o que se paga.

O gate fica na transição: tocar num ciclo para ver o detalhe/resumo é Free; abrir "comparar" ou "evolução" leva ao conteúdo Plus (ou ao paywall, se Free).

---

## Grupo 1 — Fundação: listar planos arquivados (a peça que faltou)

`trainingPlanRepository` hoje só tem `getActive`. Adicione:

- `listArchived(userId)` → todos os planos com `status = 'archived'`, ordenados por `race_date` desc (mais recente primeiro). Offline-first (lê do cache SQLite).
- `getById(planId)` → um plano específico com seus workouts (para o detalhe/resumo de um ciclo antigo).
- Garanta que a **adoção** (Fase 3) já vinha arquivando corretamente o plano anterior (`status = 'archived'`, nunca delete) — confirme e, se houver furo, corrija. Este é o dado que alimenta tudo aqui.

**Métricas de um ciclo** — função pura `services/history/cycle-summary.ts` (ou dentro de um serviço, **não** no domínio do motor) que extrai de um plano salvo, **sem recalcular nada**:
- prova (nome, distância, data), nº de semanas, dias/semana
- volume de pico, maior longão (de `validation.summary`)
- quality score e risco (de `quality`/`validation.summary`)
- zonas / pace-alvo (do `blueprint`)
- **aderência real:** treinos concluídos ÷ planejados, e km realizado ÷ planejado (dos `plan_workouts` daquele plano — status e `completed_km`)
- se completou a prova (o treino da prova foi concluído?)

**Teste:** `listArchived` retorna só arquivados ordenados; `cycleSummary` extrai as métricas de um plano fixture sem tocar no motor; um usuário com 0 arquivados retorna lista vazia (não erro).

### ⏸ PARADA 1 — reporte
Resumo `X/Y verdes` + divergências. Confirme que a adoção arquiva corretamente (é a base de tudo). Se verde, siga.

---

## Grupo 2 — Tela de Histórico (a lista — Free)

Rota `src/app/history/index.tsx` (acesso a partir de Estatísticas e/ou Perfil).

- Lista de ciclos arquivados: cada card com prova, data, distância, nº de semanas, badge de "completou / não completou", aderência %.
- Toque num card → **detalhe do ciclo** (`history/[planId].tsx`): o resumo daquele ciclo (as métricas do `cycleSummary`), read-only. Reaproveite componentes visuais de `plan/preview.tsx` onde fizer sentido.
- **Estado vazio:** se não há arquivados (usuário no 1º ciclo), mensagem elegante — "Seu primeiro ciclo está em andamento. Quando você concluir uma prova e começar outra, seus ciclos aparecerão aqui." Sem área preta vazia (§27/§31).
- Entrada visível para **"Comparar ciclos"** e **"Ver evolução"** — mas essas levam ao conteúdo Plus (Grupo 3/4); para Free, mostram o paywall.

**Teste:** lista renderiza arquivados; detalhe abre read-only; estado vazio aparece com 0 ciclos.

---

## Grupo 3 — Comparação entre ciclos (Plus)

Rota `src/app/history/compare.tsx`.

- O atleta escolhe **dois ciclos** (ex.: "Maratona 2025" vs "Maratona 2026").
- Tela lado a lado comparando as métricas do `cycleSummary`: volume de pico, maior longão, pace-alvo/zonas, quality score, aderência, dias/semana, nº de semanas, completou ou não.
- Destaque visual da **diferença** (setas ↑↓, deltas): "+40% volume de pico", "pace-alvo 18s/km mais rápido", "aderência +13pp".
- **Gate Plus:** Free que chega aqui vê a tela **escurecida** com um CTA único de assinatura (o mesmo padrão do §34). A comparação de verdade só para Plus.
- Faz sentido comparar ciclos de **distâncias diferentes**? Sim, mas deixe claro o contexto (comparar uma 10K com uma maratona não é maçã com maçã) — mostre as provas no topo para o atleta interpretar.

**Teste:** comparação calcula deltas corretos entre dois fixtures; Free vê o gate; Plus vê o conteúdo.

---

## Grupo 4 — Gráficos de evolução (Plus)

Rota `src/app/history/evolution.tsx` (ou seção dentro de Estatísticas para Plus).

Séries temporais ao longo dos ciclos (eixo X = ciclos em ordem cronológica):
- **pace-alvo / pace de limiar** por ciclo (a linha que mais emociona: "você está ficando mais rápido")
- **volume de pico** por ciclo
- **aderência média** por ciclo
- **quality score** por ciclo

Requisitos:
- Biblioteca de gráfico compatível com RN (a mesma escolhida na Fase 6 para Estatísticas — reutilize, não adicione outra).
- **Com 1 ciclo:** não dá para traçar tendência. Mostre o ponto único + mensagem "complete mais um ciclo para ver sua evolução". **Com 2+:** traça a linha.
- **Gate Plus** com paywall para Free, mesmo padrão.
- Uma frase de síntese gerada dos dados (não IA, determinística): ex. "Em 3 ciclos, seu pace-alvo evoluiu de 5:10 para 4:52/km." Só afirme o que os dados mostram.

**Teste:** série com 1 ciclo mostra estado "insuficiente"; com 3 ciclos traça e a frase-síntese bate com os números; Free vê o gate.

---

## Grupo 5 — Amarração e proposta de valor

- Ligue as entradas: Estatísticas (Plus) e Perfil apontam para Histórico/Comparação/Evolução.
- Reforce o **gatilho de conversão**: quando o Free abre Comparar/Evolução, o paywall traz a mensagem certa — "Você concluiu ciclos com o RunEvo. Assine o RunEvo+ e veja sua evolução completa." (a promessa agora é real, não vazia).
- Confirme que **nada** aqui recalcula treino ou toca no motor; tudo lê dados salvos.

---

## ⏸ PARADA 2 — fechamento

Traga **apenas**:
1. resumo `X/Y verdes` + divergências;
2. bloco §41 do PR;
3. decisões tomadas sozinho;
4. teste no emulador (Pixel 7 e 360dp): criar 2 planos, concluir/arquivar, ver histórico, comparar, ver evolução; confirmar que Free encontra o gate e Plus vê o conteúdo; estados vazios (0 e 1 ciclo).

Depois abra o PR de `feat/fase-7-5-historico-evolucao` para `main`.

---

## Disciplina de tokens

- Não reimprima teste que passa — só falhas + resumo.
- Um commit por grupo.
- Só interrompa fora das paradas se: precisar de uma métrica que não está salva (não fabrique), precisar tocar no motor, ou algo exigir mudar comportamento.

**Métricas só de dados já salvos pelo motor — nunca recalcular nem inventar. Entitlement no serviço. Elegante com 1 ciclo. Não simplifique o Motor RunEvo.**
