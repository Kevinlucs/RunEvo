# Fase 6 — Brief de Execução: Estatísticas, Perfil, Tênis e RunEvo+

> **Para o Claude Code executar.** Branch: `feat/fase-6-stats-perfil-plus` (a partir de `main` atualizado).
> Referências: enunciado **§31** (Estatísticas), **§32** (Perfil), **§33** (Tênis), **§34** (Free/RunEvo+),
> **§36/§37** (design/acessibilidade). Mockups: `design-reference/13. TELA ESTATISTICAS.png`,
> `design-reference/14. TELA PERFIL.png`.
>
> **Objetivo:** fechar as telas principais e dar corpo ao **entitlement Free/RunEvo+**. Paywall completo
> (visual + lógica de acesso), com o pagamento real ficando para a Fase 7 — botão "Assinar" desabilitado
> com rótulo "em breve".

---

## 0. Guardrails da fase

1. **`src/domain/motor-evo/` está fechado.** Métricas de estatística usam dados já produzidos pelo motor (km, fases, score, aderência); nenhuma regra nova de treino na UI.
2. **Entitlement é decidido no SERVIÇO, nunca na UI.** Este é o ponto central da fase. A UI só reflete o que o `SubscriptionService` responde. `subscriptions` é somente-leitura no cliente (RLS já garante).
3. **Nada de mock que finge pagar.** O botão "Assinar" fica **desabilitado com rótulo "em breve"** — o pagamento é a Fase 7. Mas o entitlement e o paywall são reais e funcionais agora.
4. **Persistência só via repositories** (offline-first). Tênis e perfil funcionam offline.
5. **Gates verdes antes de cada commit:** typecheck 0, lint 0/0, testes ≥316.

---

## Modelo de negócio (fechado com o usuário)

**Princípio:** o Free entrega a **jornada completa de uma prova**. O gatilho de conversão é o **2º ciclo** — quando o atleta termina a primeira planilha e quer continuar sua evolução.

### Free
- **1 planilha ativa** gerada por IA, do início à prova (índice único já garante 1 ativa)
- Home, Treinos, concluir, pular, **editor manual**
- Check-in semanal com adaptação (IA + guardrails)
- **Estatísticas da planilha atual**
- **Tênis ilimitados** (todos têm — não é recurso premium)
- **Exportar PDF** da planilha ativa

### RunEvo+ (profundidade, memória e projeção)
- **Histórico completo** de planilhas + **evolução entre ciclos** (comparar métricas entre provas)
- **Comparar planilhas** lado a lado antes de adotar
- **Auditoria técnica avançada** (quality score detalhado, insights, risco explicado)
- **Análise de IA aprofundada** no check-in (relatórios mais ricos)
- **Exportação Excel** + PDF avançado
- **Backup e relatórios** de longo prazo

> Exportação (PDF/Excel de verdade) é da **Fase 7**. Nesta fase, os cards de exportação aparecem com o gate correto (PDF liberado no Free, Excel bloqueado no Free), conteúdo escurecido e CTA — mas o gerador de arquivo real vem depois.

---

## Grupo 1 — SubscriptionService + entitlement (fundação, headless)

`src/services/subscription/subscription.service.ts` — a fronteira única de entitlement:

```ts
interface SubscriptionService {
  getEntitlement(): Promise<Entitlement>;   // { plan: 'free'|'plus', status, periodEnd }
  refresh(): Promise<Entitlement>;
  // purchase()/restore() → stubs que lançam 'not_implemented' até a Fase 7
}
```

- Lê `subscriptions` (via repository/cache) para determinar `plan`.
- **Gate do "2º ciclo":** exponha `useCanAccessHistory()` / `useEntitlement()` que combinam:
  - `plan === 'plus'` → acesso total;
  - `plan === 'free'` → acesso só à planilha ativa; histórico/comparação/Excel/auditoria avançada bloqueados.
- **Regra do trial implícito:** o Free vive a 1ª planilha inteira sem fricção. O paywall só aparece quando o atleta tenta acessar um recurso Plus (ver histórico, comparar, adotar 2ª planilha mantendo a 1ª, exportar Excel). Conte planilhas arquivadas do usuário para saber se ele está no 2º ciclo — **lógica no serviço**, não na UI.

`hooks/useEntitlement.ts` — hook que a UI consome. **Nenhum componente decide Free/Plus por conta própria.**

**Teste (headless):** usuário free → histórico bloqueado, ativa liberada; plus → tudo liberado; `purchase()` lança `not_implemented`; entitlement resolve offline a partir do cache.

### ⏸ PARADA 1 — reporte
Resumo `X/Y verdes` + divergências. Se verde, siga para o Grupo 2.

---

## Grupo 2 — Estatísticas (§31)

Tela `src/app/(tabs)/stats.tsx`. Mockup: `design-reference/13`.

**Sem vão preto abaixo do header** (§31 — era problema no legado). Conteúdo começa colado.

**Cards de topo (Free — planilha atual):** distância total · treinos concluídos · restantes · semanas seguidas · IMC.

**Depois (visualizações):** evolução, planejado × realizado, volume semanal, longões, aderência, esforço, ajustes, histórico.

**Gate Free/Plus:**
- **Free:** visão básica da **planilha atual** — os cards de topo + gráficos essenciais (planejado×realizado, volume semanal, aderência).
- **Plus:** recursos avançados — **evolução entre ciclos** (só faz sentido com histórico), comparação, relatórios. Estes cards, para Free, aparecem **visíveis porém escurecidos** com **um** CTA de assinatura (não repetir botão em cada card — §34).

Gráficos: use uma lib compatível com RN (ex.: `react-native-svg` + componentes próprios, ou `victory-native`/`react-native-gifted-charts` — escolha uma, sem peso excessivo). Dados vêm dos hooks de progresso (Fase 4) e do histórico (Plus). **Nada de cálculo de regra de treino na tela.**

---

## Grupo 3 — Tênis (§33)

Telas: lista `src/app/profile/shoes/index.tsx` e formulário `shoes/[id].tsx`. CRUD completo (a conclusão de treino da Fase 4 já consome tênis; agora vem o gerenciamento).

Campos: marca, modelo, apelido, km inicial, km atual, limite (`max_km`), ativo/aposentado. Ações: adicionar, editar, aposentar, reativar. **Km atualiza automaticamente** ao concluir treino (já implementado na Fase 4 — confirme a integração).

**Tênis ilimitados para todos** (Free e Plus). Alerta visual quando `current_km` se aproxima de `max_km` (ex.: barra que fica âmbar/vermelha) — ajuda o atleta a trocar o tênis antes de lesão.

**Teste:** criar/editar/aposentar tênis persiste offline; km incrementa ao concluir treino com aquele tênis.

---

## Grupo 4 — Perfil (§32)

Tela `src/app/profile/index.tsx` (hoje mínima) + subtelas. Mockup: `design-reference/14`.

Exibir/permitir: foto, nome, data de entrada, editar perfil, peso, IMC, plano atual (Free/RunEvo+), dispositivos, tênis (atalho), RunEvo+ (atalho), recursos, geral (configurações), suporte, privacidade, termos, **excluir conta** (RPC `delete_own_account` já existe), **sair**, versão do app.

- **Editar perfil:** nome, foto (avatar), peso, unidade, idioma, tema — via `athlete-profile.repository`.
- **Excluir conta:** confirmação dupla (ação destrutiva e irreversível) antes de chamar a RPC.
- Privacidade/Termos: links para a landing (WebView ou browser externo).

**Header §26 do Perfil:** logo à esquerda; badge RunEvo+ se assinante.

---

## Grupo 5 — RunEvo+ / Paywall (§34)

Telas: `src/app/runevo-plus/index.tsx` (oferta) e `runevo-plus/resources.tsx` ("meus recursos").

**Paywall (§34) — regras visuais estritas:**
- Conteúdo premium **visível, porém escurecido** (o atleta vê o que ganha).
- **Apenas UM CTA principal** — "Assinar RunEvo+". **Não** repita botão "RECURSO RUNEVO+" em cada card (era problema explícito no legado).
- Planos: **Mensal** e **Anual** (anual com desconto — destaque "economize X%").
- "Restaurar compra" e "Termos" presentes.
- **Botão "Assinar" DESABILITADO com rótulo "Em breve"** — o pagamento real é a Fase 7. Deixe o layout pronto para receber os botões de compra reais depois. **Não** simule uma compra.

**Mensagem de conversão** (o gatilho do 2º ciclo): quando o atleta termina a 1ª planilha ou tenta acessar um recurso Plus, a oferta aparece com a proposta certa — ex.: *"Você concluiu seu primeiro ciclo. Acompanhe sua evolução, compare estratégias e leve seu histórico — RunEvo+."*

**Meus recursos:** lista o que o plano atual libera, com o que o Plus adicionaria (para Free).

**Entitlement em ação:** cada ponto de bloqueio (histórico nas Estatísticas, comparação de planos, Excel na exportação, adotar 2ª planilha mantendo histórico) chama `useEntitlement()` e, se Free, leva ao paywall. **Nunca** decida na UI.

**Teste:** Free vê paywall ao tentar recurso Plus; Plus acessa direto; botão "Assinar" está desabilitado; entitlement lido do serviço em todos os pontos.

---

## ⏸ PARADA 2 — fechamento

Traga **apenas**:
1. resumo `X/Y verdes` + divergências;
2. bloco §41 do PR;
3. decisões tomadas sozinho;
4. teste no emulador (Pixel 7 **e** 360dp): navegar Estatísticas → Perfil → Tênis (criar um) → RunEvo+ (ver paywall); confirmar que um usuário Free encontra os bloqueios corretos e o botão "Assinar" está "em breve"; divergências mockup×spec (§31/§32).

Depois abra o PR de `feat/fase-6-stats-perfil-plus` para `main`.

---

## Disciplina de tokens

- Não reimprima teste que passa — só falhas + resumo.
- Um commit por grupo.
- Só interrompa fora das paradas se: tocar no motor, faltar mockup/asset, ou algo exigir mudar comportamento.

**Entitlement no serviço, nunca na UI. Botão de pagamento é "em breve" — nada de simular compra. Não simplifique o Motor RunEvo. Um só CTA no paywall.**
