# Fase 7 — Brief de Execução: Pagamento (RevenueCat) + Exportação PDF/Excel

> **Para o Claude Code executar.** Branch: `feat/fase-7-billing-export` (a partir de `main` atualizado).
> Referências: enunciado **§34** (Free/Plus/paywall), **§35** (exportação). Decisões: billing via
> **RevenueCat**; produtos **Mensal + Anual (anual com desconto)**; usuário tem Google Play, Apple em criação.
>
> **Objetivo:** ligar o cofre. O paywall da Fase 6 passa a **cobrar de verdade** (RevenueCat sobre
> Google Play / App Store), e a exportação (PDF liberado no Free, Excel no Plus) gera **arquivos reais**
> que abrem em Excel/Sheets/OnlyOffice e leitores de PDF.

---

## 0. Guardrails da fase

1. **Entitlement continua no serviço.** O `SubscriptionService` (Fase 6) é a fronteira única. RevenueCat vira a **fonte** que alimenta o entitlement — a UI não fala com RevenueCat direto, fala com o serviço.
2. **A verdade do entitlement é o servidor, não o cliente.** RevenueCat valida a compra e, via webhook, atualiza `subscriptions` no Supabase. O cliente lê `subscriptions` (como já faz). Isso impede burla local de "virar Plus" editando o app.
3. **Nada de arquivo falso.** O §35 é explícito: o Excel deve abrir em Excel/Google Sheets/OnlyOffice (OOXML real), o PDF deve ser um PDF real. Proibido HTML disfarçado de XLSX.
4. **Copyright/segurança:** o PDF/Excel contém só dados do próprio atleta. Sem bibliotecas que fabriquem formato inválido.
5. **Gates verdes antes de cada commit:** typecheck 0, lint 0/0, testes ≥358.
6. **Requer dev build** (RevenueCat tem código nativo — não roda no Expo Go). O usuário roda o build; documente o comando.

---

## Pré-requisitos do usuário (fora do código — documente no PR o que falta)

- Conta **Google Play Console** (✅ o usuário tem). Criar os produtos de assinatura: `runevo_plus_monthly` e `runevo_plus_annual` (IDs sugeridos — confirme com o usuário), com preços; anual com desconto.
- Conta **Apple Developer** (⏳ em criação). Criar os mesmos produtos em App Store Connect quando sair.
- Conta **RevenueCat** (gratuita): criar projeto, conectar Google Play (service account) e depois Apple, criar uma **entitlement** chamada `plus` e um **offering** com os dois pacotes.
- Chaves públicas do RevenueCat (Android e iOS) — vão no app como config pública (são SDK keys públicas, não segredo de servidor). A **secret** do RevenueCat (webhook) fica só no Supabase.

> O código deve funcionar em **modo Google primeiro**; iOS entra quando a conta Apple e os produtos existirem. Não bloqueie a fase esperando a Apple.

---

## Grupo 1 — Integração RevenueCat + entitlement pelo servidor

### 1.1 SDK e config
- Instale `react-native-purchases` (SDK do RevenueCat).
- Config das chaves públicas por plataforma via `app.config.ts` (`extra`), como já fazemos com o Supabase. Nada de secret no bundle.
- Inicialize o SDK no boot, associando o `appUserID` ao **user id do Supabase** (para casar a compra com a conta).

### 1.2 Implementar o `SubscriptionService` real (era stub)
Preencha os métodos que estavam como `not_implemented`:
- `getOfferings()` → pacotes disponíveis (mensal/anual) com preços localizados vindos da loja.
- `purchase(packageId)` → fluxo de compra nativo do RevenueCat.
- `restore()` → restaurar compras.
- `getEntitlement()` → **lê de `subscriptions` (Supabase), não do cache do RevenueCat como verdade final**. O RevenueCat informa a UI na hora da compra (resposta otimista), mas a fonte de verdade persistida é `subscriptions`, atualizada por webhook.

### 1.3 Webhook RevenueCat → Supabase (a verdade do servidor)
Edge Function `supabase/functions/revenuecat-webhook/index.ts`:
- Recebe eventos do RevenueCat (compra, renovação, cancelamento, expiração, reembolso).
- **Valida a assinatura do webhook** (secret do RevenueCat em `Deno.env`).
- Faz upsert em `subscriptions` (status, `product_id`, `platform`, `current_period_end`, `raw_payload`) via service_role (por isso `subscriptions` é escrita só pelo servidor — RLS já garante que o cliente não escreve).
- Idempotente (o mesmo evento pode chegar duas vezes).

**Teste (headless):** webhook de compra → `subscriptions.status = 'active'`, entitlement vira `plus`; webhook de expiração → volta a `free`; evento duplicado não duplica efeito; assinatura inválida → 401.

### ⏸ PARADA 1 — reporte
Resumo `X/Y verdes` + divergências. **Diga claramente o que depende de config externa** (produtos nas lojas, projeto RevenueCat) para o usuário providenciar antes do teste real. Se verde, siga para o Grupo 2.

---

## Grupo 2 — Paywall cobrando de verdade (§34)

- O botão "Assinar" (hoje "Em breve") passa a abrir o **fluxo de compra** do RevenueCat.
- Mostrar os preços **reais** vindos da loja (localizados), não hard-coded — mensal e anual, com o desconto do anual em destaque ("economize X%").
- "Restaurar compra" chama `restore()`.
- Após compra bem-sucedida: entitlement atualiza (otimista via RevenueCat + confirmação via webhook/refresh), o paywall fecha, os recursos Plus desbloqueiam.
- Estados de erro tratados: compra cancelada pelo usuário, falha de rede, produto indisponível — mensagens claras, sem travar.

**Teste:** com produto de teste (sandbox), compra libera Plus; cancelamento não libera; restore reativa. (Sandbox exige dev build + conta de teste da loja — documente para o usuário.)

---

## Grupo 3 — Exportação PDF (Free + Plus) (§35)

`services/export/pdf-exporter.ts`. Use `expo-print` (gera PDF real a partir de template HTML renderizado nativamente) + `expo-sharing` para compartilhar/salvar.

**Conteúdo do PDF (§35):** capa · atleta · objetivo · datas · zonas · resumo · semanas · treinos · progresso · rodapé RunEvo.

- **Free:** PDF da planilha **ativa**.
- **Plus:** PDF **avançado** (mais seções: auditoria, evolução) — o gate decide qual template via `useEntitlement()`.
- Layout limpo, identidade RunEvo (logo, cores). Datas reais dos treinos.

**Teste:** gera um PDF que abre em leitor de PDF; contém todas as seções; Free vê versão base, Plus a avançada.

---

## Grupo 4 — Exportação Excel real (Plus) (§35)

`services/export/excel-exporter.ts`. **OOXML real** — use uma lib que gere `.xlsx` válido (ex.: `xlsx`/SheetJS, que roda em RN). **Proibido HTML disfarçado.**

- Mesma organização do PDF (§35): abas/seções coerentes — resumo, semanas, treinos, zonas.
- Nome e ícone lado a lado, descrição em largura completa (§35).
- Deve abrir em **Microsoft Excel, Google Sheets e OnlyOffice** — teste de abertura real.
- **Gate:** Excel é **Plus**. Para Free, o card aparece bloqueado/escurecido com o CTA único (paywall), sem gerar arquivo.

**Teste:** gera `.xlsx` que abre nos três apps; Free encontra o paywall ao tentar; Plus gera de verdade. Escreva um teste que valide a estrutura OOXML (lê de volta o arquivo gerado e confere as abas/células), não só que "um arquivo foi criado".

---

## Grupo 5 — Amarração de entitlement em todos os pontos Plus

Agora que o pagamento é real, confirme que **todos** os gates da Fase 6 leem o entitlement atualizado por webhook:
- histórico/evolução nas Estatísticas;
- comparação de planos;
- Excel na exportação;
- gate do 2º ciclo (histórico bloqueado no Free).

Teste de ponta a ponta: usuário Free → compra → vira Plus → todos os recursos desbloqueiam sem reiniciar o app (refresh do entitlement após a compra). Cancelamento/expiração → volta a Free no próximo refresh.

---

## ⏸ PARADA 2 — fechamento

Traga **apenas**:
1. resumo `X/Y verdes` + divergências;
2. bloco §41 do PR;
3. **lista clara do que o usuário precisa configurar** nas lojas/RevenueCat para o teste real de compra (produtos, IDs, chaves, sandbox);
4. teste: exportação PDF e Excel gerando arquivos reais que abrem; e, se as contas de teste já existirem, uma compra sandbox liberando Plus. Se ainda não der para testar a compra real (Apple pendente, produtos não criados), diga isso honestamente — não simule sucesso de compra.

Depois abra o PR de `feat/fase-7-billing-export` para `main`.

---

## Disciplina de tokens

- Não reimprima teste que passa — só falhas + resumo.
- Um commit por grupo.
- Só interrompa fora das paradas se: tocar no motor, faltar config externa que impeça avançar, ou algo exigir mudar comportamento.

**Entitlement pela verdade do servidor (webhook → subscriptions), nunca só pelo cliente. Arquivos de exportação reais (OOXML/PDF válidos), nunca falsos. Não simule compra bem-sucedida. Não simplifique o Motor RunEvo.**
