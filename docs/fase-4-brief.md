# Fase 4 — Brief de Execução: Home, Treinos e Detalhe do Treino

> **Para o Claude Code executar.** Branch: `feat/fase-4-home-treinos` (a partir de `main` atualizado).
> Referências do enunciado: **§26** (navegação/header), **§27** (Home), **§28** (detalhe do treino),
> **§29** (Treinos), **§33** (tênis — só a parte de conclusão), **§36** (design system), **§37** (acessibilidade).
> Spec: `docs/motor-evo-specification.md` §18 (Adaptive — só leitura nesta fase).
>
> **Objetivo:** transformar o plano adotado em algo utilizável no dia a dia. O atleta abre o app,
> vê o próximo treino, entende a semana, abre o detalhe, executa e registra (concluir/pular).

---

## 0. Guardrails

1. **`src/domain/motor-evo/` continua fechado.** Se precisar tocar, pare e avise.
2. **Componentes não calculam regra de treino.** Progresso, resumo de semana e liberação de check-in vêm de funções do domínio, não de `useMemo` na tela.
3. **Persistência só via repositories** (offline-first). Concluir/pular precisa funcionar sem rede.
4. **Sem regressão de gate:** `typecheck` 0 erros, `lint` 0/0, `test` ≥211 verdes antes de cada commit. Recém-zerados — não deixe voltar a acumular.
5. **Escopo fechado.** Nesta fase **não** entram: editor manual e check-in semanal de verdade (Fase 5), CRUD de tênis e estatísticas (Fase 6), PDF/Excel e assinatura (Fase 7). Onde encostar nesses limites, deixe o caminho pronto e desabilitado — nunca um mock que finge funcionar.

---

## Grupo 1 — Camada de dados e regras de leitura (headless)

### 1.1 Completar o débito da Fase 2

`getWeekSummary` e `getCheckinCandidateWeek` foram portados parcialmente porque dependiam de repositories. Agora existem. Complete-os em `src/domain/motor-evo/adaptive-training.ts` **mantendo o domínio puro**: as funções recebem os dados como argumento (lista de treinos da semana), não consultam repository. A busca fica em hooks/serviço.

Preserve a regra verificada no legado: **`resolved = completed + skipped`** (`isWorkoutResolved`); não existe estado "parcial".

`summarizeWeek(workouts)` deve devolver: `total`, `resolved`, `completedKm`, `plannedKm`, `averageEffort`, `status` e `canCheckin` (`resolved === total`).

### 1.2 Hooks de leitura (TanStack Query sobre repositories)

Em `src/hooks/`:

- `useActivePlan()` — já existe da Fase 3; reaproveite.
- `usePlanWorkouts(planId)` — todos os treinos, ordenados por `week_number`, `week_index`.
- `useCurrentWeek()` — semana corrente pela **data de hoje** vs `start_date` (use `dates.ts` do motor; respeite a primeira semana parcial e o fuso local).
- `useNextWorkout()` — primeiro treino `pending` com `workout_date >= hoje`; se não houver, o `pending` mais próximo no passado (treino atrasado); se nenhum, `null` (plano concluído).
- `useWeekSummary(weekNumber)` — aplica `summarizeWeek`.
- `usePlanProgress()` — km realizados, km planejados, treinos concluídos, dias restantes até a prova.

**Testes headless obrigatórios** com plano fixture: semana corrente correta na virada de semana (domingo→segunda); próximo treino ignorando `completed`/`skipped`; treino atrasado; `canCheckin` só com todos resolvidos; progresso somando só `completed_km`.

### 1.3 Mutações

`services/workout/complete-workout.service.ts`:

- `completeWorkout({ workoutId, completedKm, shoeId?, perceivedEffort, feedback? })` → status `completed`, `completed_at`, campos de feedback; **se `shoeId` informado, incrementa `current_km` do tênis** (§33) na mesma operação lógica.
- `skipWorkout({ workoutId, reason? })` → status `skipped`, `feedback = reason`. **Não** abre formulário de conclusão.

Tudo via repositories → outbox (funciona offline). Após a mutação, invalide as queries afetadas.

**Teste:** concluir offline enfileira `update` do treino **e** do tênis; pular não grava `completed_km`.

### ⏸ PARADA 1 — reporte
Resumo `X/Y verdes` + divergências, se houver. Se verde, **siga direto** para o Grupo 2.

---

## Grupo 2 — Header (§26) + Home (§27)

### 2.1 Header (débito da Fase 1)

Componente `src/components/ui/AppHeader.tsx`, usado nas abas:

- **Logo RunEvo à esquerda** (`logo-runevo.png`); para assinante, `logo-runevo-plus.png` (leia o entitlement do serviço — não decida na UI; enquanto a Fase 7 não chega, Free é o padrão).
- **Avatar à direita com aro neon**, abrindo o Perfil.
- Safe area correta, **sem vãos pretos exagerados**, sem colisão com o conteúdo.

### 2.2 Home — ordem exata dos blocos (§27)

1. Header.
2. Cápsula **"PRÓXIMO TREINO"**.
3. **Card do próximo treino:** fase · semana · título · dia · data · distância · pace · seta. Visual: **degradê verde muito sutil**; **sem círculo verde sólido**. Toque abre o detalhe.
4. **Objetivo da prova:** bandeira · nome da prova · distância · dias restantes · km feitos · km total · barra de progresso.
5. **Semana Atual:** calendário da semana · por treino: título, dia, tipo, status, km.
6. **Adaptive Training (só leitura nesta fase):** semana · status · treinos resolvidos/total · km realizado/planejado · esforço médio · orientação curta · **CTA visível apenas quando liberado** (`canCheckin`). Como o check-in é da Fase 5, o CTA fica **desabilitado com rótulo honesto** (ex.: "Disponível em breve") — nunca um botão que finge abrir algo.

**Estado vazio** (sem plano ativo): compacto, com CTA único para a IA Evo. **Não deixe grandes áreas pretas vazias** — este é um requisito explícito e foi problema no legado.

---

## Grupo 3 — Treinos / Ciclo (§29)

Tela `src/app/(tabs)/plan.tsx` — **somente leitura** nesta fase.

Mostrar: ciclo completo · fases (Base/Resistência/Pico/Polimento) com suas semanas · semanas com total de km e nº de treinos · treinos por semana · progresso geral. Semana atual destacada; semanas de recuperação e taper identificáveis; **semana da prova com destaque próprio**.

Rota de detalhe de fase: `src/app/plan/phase/[phase].tsx`.

**Performance (importante):** um plano pode ter 52 semanas × até 6 treinos (~300 itens). Use `FlatList`/`SectionList` com `keyExtractor` estável e itens memoizados — **nunca** `ScrollView` com `.map()` sobre tudo.

Entradas de **editor manual** (Fase 5), **exportação** (Fase 7) e **histórico Plus** (Fase 6): renderize com **estado desabilitado claro** (§29), sem ação.

---

## Grupo 4 — Detalhe do treino (§28)

Rota `src/app/workout/[id].tsx`.

**Exibir:** fase · semana · título · data · distância · pace planejado · **zonas Z1–Z5** (do blueprint do plano, com o método/âncora usado) · **"Como executar"** · **blocos do treino** (aquecimento, bloco principal, recuperação, desaquecimento — a prescrição já vem pronta do motor; apenas formate) · botões **Concluir** e **Pular**.

**Concluir** → só ao tocar, abre o formulário (§28):
- km realizado (pré-preenchido com o planejado)
- tênis (seletor)
- esforço 1 a 10
- observação
- ações: **Cancelar** e **Concluir**

> **Tênis:** o CRUD é da Fase 6. Se não houver tênis cadastrado, mostre estado vazio no seletor e permita concluir **sem** tênis (campo opcional). Não bloqueie a conclusão.

**Pular** → confirmação + motivo opcional. **Não abre** o formulário de conclusão.

Após qualquer das ações: atualizar Home e Treinos (invalidar queries) e voltar.

Treino da **prova** é evento final: não pode ser editado nem removido; concluir é permitido.

---

## Requisitos transversais

- **Design (§36):** tokens de `src/theme` — zero cor/tamanho hard-coded. Cards compactos, labels legíveis sem quebras ruins, degradês suaves, ícones vetoriais consistentes.
- **Acessibilidade (§37):** touch target ≥44; contraste; `accessibilityLabel`/`accessibilityRole` nos elementos interativos; teclado não cobre campos no formulário de conclusão; safe areas; **nada atrás da bottom nav**; portrait-first; conteúdo não cortado em 360px.
- **Teste em Pixel 7 e num aparelho estreito (360px)** antes da Parada 2 — a Fase 3 provou que emulador pega o que teste headless não pega.

---

## ⏸ PARADA 2 — fechamento

Traga **apenas**:
1. resumo `X/Y verdes` + divergências;
2. bloco §41 do PR (Objetivo · Decisões · Arquivos criados/modificados/removidos · Comandos · Testes · Resultado esperado · **Pendências reais**);
3. decisões que tomou sozinho e quer validar;
4. confirmação do teste visual (o que foi verificado no emulador).

Depois abra o PR de `feat/fase-4-home-treinos` para `main`.

---

## Disciplina de tokens

- Não reimprima saída de teste que passa — só falhas e a linha de resumo.
- Um commit por grupo (`feat(home): grupo N — ...`).
- Só interrompa fora das paradas se: (a) precisar tocar em `src/domain/motor-evo/`, (b) faltar arquivo/asset, ou (c) algo exigir mudar comportamento em vez de só implementar.

**Não simplifique o Motor RunEvo. Não afirme que algo foi implementado sem o código correspondente. Nada de mock que finge funcionar — funcionalidade de fase futura fica desabilitada e honesta.**
