# FASE — Estatísticas: refino do topo + gráficos (v2, lapidação ponto a ponto)

> App RunEvo (Expo/React Native + TypeScript, offline-first). Alvo: `src/app/(tabs)/stats.tsx`.
> A gameficação (LevelCard, tela de Níveis, Conquistas, Recordes, moldura) JÁ está feita e correta.
> ESTE PROMPT trata só do que ficou pendente no corpo da aba Estatísticas. Não mexer nas telas
> de gamificação já entregues (stats/levels, stats/achievements, stats/records).

## Estado atual (o que está na tela hoje — ver stats.tsx)
- LevelCard + 3 atalhos (Níveis/Conquistas/Recordes) → OK, manter.
- `StatCard large` "Distância total" (linha ~99) → DUPLICA o km que já aparece no LevelCard.
- Grade 2×2: Concluídos / Restantes / Semanas seguidas / IMC (linhas ~102-114) → poluída.
- 3 `<Card>` com BarChart empilhados: "Planejado × Realizado", "Volume semanal", "Aderência"
  (linhas ~116-126) → repetitivos, ocupam a tela toda, dados quase iguais.
- Ícones = `Ionicons` (linhas 99-113, 178) → o design pede `lucide-react-native`.
- Seções "Ciclos anteriores" / "Recursos RunEvo+" com HistoryRow → manter como está.

## Contexto de dados (não recriar)
- `useAthleteStats()` → stats { totalKm, completedWorkouts, remainingWorkouts, weeksStreak, imc,
  weeklyStats }. Cada item de `weeklyStats`: { label, completedKm, plannedKm, completionRate }.
  ⚠️ NÃO existe pace/duração real por atividade (virá do Strava numa fase futura).
- `useLifetimeStats()` → lifetimeStats.totalKm (usado pelo LevelCard).
- `classifyImc(imc)`, `computeLevel(totalKm)` já existem.
- `BarChart` (src/components/stats/BarChart.tsx) já aceita: data[{label,value,secondaryValue?}],
  unit, primaryLabel, secondaryLabel. REUTILIZAR — não criar outro gráfico.
- Theme completo disponível (colors.neon '#CCFF00', etc). Ícones novos: `lucide-react-native`.

===============================================================
## MUDANÇA 1 — Remover card duplicado e criar RESUMO POR PERÍODO
===============================================================
Remover o `StatCard large` "Distância total" (o total já está no LevelCard).
No lugar, criar um bloco de RESUMO com seletor de período no topo:
- Seletor segmentado (chips) com 4 opções: **Semana · Mês · Ano · Tudo**. Estado local
  `period` (default 'week'). Estilo dos chips no padrão do app (ChoiceField/segmented existente
  se houver; senão Pressables com o chip ativo em neon).
- Abaixo do seletor: **km grande do período selecionado** (não o total geral) + label "no período".
  - Para Semana/Mês/Ano, somar completedKm dos weeklyStats correspondentes. Se ainda não houver
    granularidade por mês/ano no hook, usar o que der (weeklyStats agregado) e deixar TODO comentado
    para refinar a agregação por período no service.
- Linha limpa de 3 métricas com ícones lucide:
  - **Corridas** (Footprints) = completedWorkouts do período.
  - **Pace médio** (Gauge) = "—" + nota discreta "Conecte o Strava" (não há tempo real; NÃO
    derivar de planned_pace).
  - **Duração** (Timer) = "—" + mesma nota.
- Tudo FREE. Bloco enxuto, sem repetir o total do LevelCard.

===============================================================
## MUDANÇA 2 — Enxugar a grade 2×2
===============================================================
- Manter apenas 3 stats em uma LINHA compacta: **Concluídos** (CheckCircle),
  **Restantes** (ClipboardList), **Semanas seguidas** (Flame). Ícones lucide.
- **IMC** sai da grade principal → vira uma linha secundária discreta (menor, cor textSecondary),
  ex.: "IMC 21.0 · Normal" logo abaixo, ou um StatCard menor destacado à parte. É dado de saúde,
  não de treino — não deve ter o mesmo peso visual dos stats de corrida.
- Não usar grade 2×2. Preferir 3 colunas iguais ou lista horizontal compacta.

===============================================================
## MUDANÇA 3 — Unificar os 3 gráficos em 1 com toggle de métrica
===============================================================
Substituir os 3 `<Card>` (Planejado×Realizado, Volume semanal, Aderência) por UM único card
"Desempenho semanal" com um seletor de métrica no topo:
- Toggle/segmented com 3 opções: **Volume · Plan × Real · Aderência**. Estado local `metric`.
- Um só `<BarChart>` que muda conforme `metric`:
  - Volume → data = weeklyStats.map(w => { label, value: w.completedKm }), unit 'km'.
  - Plan × Real → data com value: completedKm, secondaryValue: plannedKm, unit 'km',
    primaryLabel 'Realizado', secondaryLabel 'Planejado'.
  - Aderência → data value: Math.round(w.completionRate*100), unit '%'.
- Um bloco em vez de três → muito menos scroll, mesma informação sob demanda.
- Título do card pode seguir o padrão neon centralizado atual (mantido por decisão do Kevin).

===============================================================
## MUDANÇA 4 — Trocar Ionicons por lucide-react-native
===============================================================
- Substituir todos os `Ionicons` de stats.tsx por equivalentes `lucide-react-native`:
  speedometer→Gauge, checkmark-circle→CheckCircle, clipboard→ClipboardList, flame→Flame,
  scale→Scale, time→History, git-compare→GitCompareArrows, trending-up→TrendingUp,
  chevron-forward→ChevronRight. Ajustar StatCard/HistoryRow para receberem componentes de ícone
  lucide (ou um wrapper) em vez de string do glyphMap.
- Verificar se StatCard hoje só aceita `icon: keyof Ionicons.glyphMap`; se sim, evoluir a prop
  para aceitar um ícone lucide (ex.: `icon?: LucideIcon`) mantendo retrocompatibilidade onde
  StatCard é usado em outras telas (ou migrar esses usos também se forem poucos).

===============================================================
## MANTER (não mexer)
===============================================================
- LevelCard + atalhos Níveis/Conquistas/Recordes.
- Seções "Ciclos anteriores" (Histórico) e "Recursos RunEvo+" (gate Plus com LockedSection).
- Telas de gamificação já entregues.
- Títulos de seção em neon centralizado (decisão de identidade — manter).

===============================================================
## VERIFICAÇÃO
===============================================================
```
cd "/home/kevin/Documentos/PROJETOS PESSOAIS/RunEvo - App"
npx tsc --noEmit --pretty 2>&1 | head -40
npx eslint "src/app/(tabs)/stats.tsx" --max-warnings=20 2>&1 | tail -15
```
No emulador: topo sem card duplicado; seletor Semana/Mês/Ano/Tudo funcionando; Corridas com nº real,
Pace/Duração com "—" + nota Strava; 3 stats + IMC discreto; UM gráfico com toggle Volume/Plan×Real/
Aderência alternando; todos os ícones em lucide; seções de ciclos e Plus intactas.

===============================================================
## GUARDRAILS
===============================================================
- NÃO inventar pace/duração real; ausência = "—" + "Conecte o Strava".
- Reutilizar BarChart, StatCard, Card, useAthleteStats, theme. Zero cores hardcoded (usar theme).
- Não tocar nas telas/componentes de gamificação já entregues.
- Migrations não são necessárias aqui (só UI + estado local de period/metric).
- Manter offline-first; nada de novas dependências além de lucide-react-native (já usado no projeto).
