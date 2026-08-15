# Fase QA — Brief de Execução: Polimento Visual e Fidelidade aos Mockups

> **Para o Claude Code executar.** Branch: `feat/fase-qa-polimento` (a partir de `main`).
> Referências: `design-reference/` (28 mockups JPG/PNG, fonte de verdade visual).
> Tema: `src/theme/tokens.ts` (source of truth dos tokens). Componentes: `src/components/`.
>
> **Objetivo:** alinhar TODA a UI do app com os mockups de referência. Cada tela, cada componente,
> cada cor, espaçamento, tamanho e posição deve refletir fielmente o `design-reference/`.
> O atleta abre o app e vê exatamente o que os mockups mostram — profissional, polido, final.

---

## 0. Guardrails da fase

1. **`src/domain/motor-evo/` está FECHADO.** Não toque em lógica de negócio, serviços, Motor, entitlement, billing, Edge Functions. Esta fase é 100% visual/UI.
2. **Não altere comportamento funcional.** Se um botão faz X, ele continua fazendo X — só muda como ele se parece.
3. **Mockups são a fonte de verdade.** Quando mockup e código divergem, o mockup vence. Se houver ambiguidade (ex: cor difícil de distinguir no JPG), use os tokens existentes em `src/theme/tokens.ts`.
4. **Tokens consolidados.** Use APENAS `src/theme/tokens.ts` como source of truth de cores, espaçamentos, radii e fontSizes. Se `colors.ts` ou `spacing.ts` tiverem valores diferentes, alinhe-os com `tokens.ts` (ou delete-os se forem duplicatas puras).
5. **Fonte Outfit obrigatória** via helper `fontWeight()` do `@/theme`. Nunca `fontWeight` numérico direto (ignorado no Android).
6. **Gates verdes antes de cada commit:** typecheck 0, lint 0/0, testes existentes passando.
7. **Um commit por grupo.** Conventional commits: `style(home): alinha layout com mockup`.

---

## Paleta de referência (extraída dos mockups)

```
background:      #000000 (preto puro)
card:            #171A1A (cinza escuro)
card-elevated:   #1E2222 (cinza levemente mais claro, para cards em destaque)
neon:            #CCFF00 (verde-limão, cor de destaque/CTA)
neon-muted:      rgba(204, 255, 0, 0.15) (fundo sutil de badges/highlights)
text-primary:    #FFFFFF (branco)
text-secondary:  #A0A0A0 (cinza claro, subtítulos/labels)
text-muted:      #666666 (cinza médio, placeholders)
border-card:     #2A2A2A (borda sutil de cards, quando presente)
success:         #4CAF50 ou neon (check/concluído)
warning:         #FF9800 (laranja, atenção)
danger:          #FF4444 (vermelho, dor/risco)
tab-inactive:    #666666
tab-active:      #CCFF00 (neon)
```

Valide esses valores contra `tokens.ts`. Se divergirem, ajuste `tokens.ts` para bater com o mockup.

---

## Grupo 1 — Header + Tokens + Consolidação base

### 1.1 Consolidar tokens

- Se `src/theme/colors.ts` e `src/theme/spacing.ts` são duplicatas de `tokens.ts`, elimine-os e faça todos os imports apontar para `tokens.ts`.
- Se tiverem valores únicos que `tokens.ts` não tem, mova para `tokens.ts` e delete os arquivos.
- Garantir que `tokens.ts` tem TODA a paleta listada acima.

### 1.2 Header (`AppHeader.tsx`)

Comparar com mockups (topo de todas as telas):
- Logo RunEvo à esquerda: verificar se é o PNG correto (`1. logo-icon.png` ou `2. logo-runevo.png`). Tamanho: **52px de altura** (usuário pediu explicitamente 52, está em 40 hoje).
- Logo RunEvo+: quando `isPlus`, usar `3. logo-runevo-plus.png` — verificar tamanho e posicionamento.
- Avatar à direita: círculo com borda neon (#CCFF00), foto de perfil ou inicial do nome como fallback. Tamanho ~40px.
- Linha horizontal neon fina embaixo do header (visível nos mockups).

### 1.3 Tab Bar

Comparar com mockups (rodapé de todas as telas):
- 4 abas: Início, Treinos, IA Evo, Estatísticas
- Ícones: quando inativo = cinza (#666), quando ativo = neon (#CCFF00)
- Labels: fonte Outfit, tamanho pequeno
- Fundo da tab bar: preto ou transparente (sem borda superior visível nos mockups — ou borda muito sutil)

### ⏸ PARADA 1 — Tokens + Header + Tab Bar

Reporte: quais tokens mudaram, quais arquivos foram eliminados/consolidados, print do header e tab bar alinhados. Aguarde antes de prosseguir.

---

## Grupo 2 — Tela Home (TELA HOME 1.jpg, TELA HOME 2.jpg)

Componentes envolvidos: `src/app/(tabs)/index.tsx`, `src/components/home/*`

### 2.1 Layout geral
- Fundo preto puro
- Ordem dos elementos (comparar com mockup e ajustar se diferir):
  1. Header (AppHeader)
  2. Saudação "Olá, [nome]!" — texto grande, branco, Outfit bold
  3. Card "Próximo Treino" (NextWorkoutCard)
  4. Card "Objetivo" (RaceObjectiveCard)
  5. Card "Semana Atual" (CurrentWeekCard) — com os treinos listados

### 2.2 NextWorkoutCard
- Verificar gradiente, cores, tamanho do texto, ícone chevron
- Comparar espaçamento interno (padding) com mockup
- Verificar se a informação (tipo, distância, pace, data) bate com o layout do mockup

### 2.3 RaceObjectiveCard
- Layout: ícone/bandeira + nome da prova + dados (distância, prazo)
- Barra de progresso: cor neon, fundo escuro
- Verificar se "128 km no total" está representando a coisa certa (volume do plano vs km da prova — QA item pendente)

### 2.4 CurrentWeekCard
- Lista de treinos da semana com status visual:
  - ✓ verde/neon = concluído
  - ○ cinza = pendente
  - ✗ laranja/vermelho = pulado
- Cada item: dia + tipo + distância numa linha
- Alinhamento e espaçamento entre itens

### ⏸ PARADA 2 — Home

Reporte divergências encontradas vs mockup, o que ajustou, screenshot ou descrição. Aguarde antes de prosseguir.

---

## Grupo 3 — Tela Treinos (TELA TREINOS 1-3.jpg)

Componentes: `src/app/(tabs)/plan.tsx`, `src/components/plan/*`

### 3.1 Lista semanal
- Comparar layout da lista de semanas (S1, S2, S3...) com mockup
- Verificar: card por semana? expandível? indicador de semana atual?
- Indicador visual da semana ativa (neon highlight)

### 3.2 Detalhe por treino
- Cada treino dentro da semana: tipo, distância, dia, status
- Comparar com TELA TREINOS 2 e 3

### 3.3 Descrição do treino (DESCRICAO TREINO 1-2.jpg)
- Tela de detalhe do treino: blocos (aquecimento, repetições, desaquecimento)
- Verificar layout de cada bloco, cores, ícones
- Botões "Concluir" e "Pular" (estilo, cor, posição)

### ⏸ PARADA 3 — Treinos

Reporte. Aguarde antes de prosseguir.

---

## Grupo 4 — Tela IA Evo (TELA IA EVO 1-6.jpg)

Componentes: `src/app/(tabs)/ai-evo.tsx`, formulário de geração

### 4.1 Formulário "Dados do Corredor"
- Campos: Idade, Altura, Peso, Nível de experiência, Distância da prova
- Comparar com IA EVO 2: labels em cima, inputs com fundo card, borda sutil
- Seletor de experiência: 3 botões (Iniciante/Intermediário/Avançado) com borda neon no selecionado

### 4.2 Campos de data/dias/tempos
- Date picker com ícone de calendário (IA EVO 3-4)
- Dropdown "Dias/semana"
- Indicador "X semanas até a prova" (badge com ícone de calendário, fundo neon-muted)
- Campos de tempos anteriores (5K, 10K etc.)

### 4.3 Prévia da planilha (IA EVO 5-6)
- Colapsada por padrão (fix recente — confirmar que funciona visualmente)
- Botão "Detalhar planilha"
- Card de resumo no topo
- Viabilidade (tom e layout do veredito)

### ⏸ PARADA 4 — IA Evo

Reporte. Aguarde antes de prosseguir.

---

## Grupo 5 — Tela Estatísticas (TELA ESTATISTICAS 1-6.jpg)

Componentes: `src/app/(tabs)/stats.tsx`, `src/components/stats/*`

### 5.1 Dashboard de Evolução
- Card "Performance Center" com gradiente esverdeado (mockup 1-2)
- Aderência em anel/donut
- Volume semanal com barras (Planejado vs Realizado)

### 5.2 Gráficos
- Esforço médio, distribuição de tipos, ritmo médio (mockups 3-4)
- Verificar cores das barras, labels, espaçamento

### 5.3 Histórico e Resumo Inteligente (mockups 5-6)
- Cards de Tendência, Próxima Semana, Melhor Aderência, Maior Esforço
- Seção "Últimos Check-ins" e "Ajustes Recentes"
- Ícones de expandir/colapsar

### ⏸ PARADA 5 — Estatísticas

Reporte. Aguarde antes de prosseguir.

---

## Grupo 6 — Tela Perfil (TELA PERFIL 1-3.jpg)

Componentes: `src/app/profile/*`

### 6.1 Dados pessoais
- Nome, foto (circular com borda neon), dados básicos
- Layout conforme mockup PERFIL 1

### 6.2 Seções do perfil
- "Minha Assinatura" (RunEvo+ ou Free)
- "Meus Recursos"
- "Minhas Preferências" → Geral, Suporte
- "Conta" → Excluir conta
- Botão "Sair" (grande, neon, destaque)
- Footer: Termos, Política de Privacidade, versão do app

### 6.3 Paywall RunEvo+ (acessado via Perfil)
- Não mudar funcionalidade
- Ajustar visual se divergir do design system

### ⏸ PARADA 6 — Perfil

Reporte. Aguarde antes de prosseguir.

---

## Grupo 7 — Modais e Overlays

### 7.1 Check-in semanal (CHECK IN SEMANAL.jpg)
- Layout do modal: ícone cérebro, título "Check-in SX"
- Campos: percepção, esforço (slider neon), dor, peso, observações
- Botões: Cancelar (cinza) / Confirmar (neon)

### 7.2 Concluir treino (CONCLUIR TREINO.jpg)
- Modal de conclusão: campos de distância, tempo, esforço

### 7.3 Pular treino (PULAR TREINO.jpg)
- Modal com info de consequência
- Slider de esforço
- Campo de observação
- Botões: Cancelar / Registrar treino pulado (neon)

### 7.4 Popup de trial (fix recente)
- Reformular visual para ficar alinhado ao design system (fundo card, borda neon sutil, texto branco, botão neon)

### ⏸ PARADA 7 — Modais e Overlays

Reporte. Aguarde antes de prosseguir.

---

## Grupo 8 — Login/Cadastro + Splash

### 8.1 Tela de Login (TELA LOGIN.jpg)
- Logo centralizada
- Campos de email/senha com fundo card
- Botão "Entrar" neon
- Link "Criar conta" / "Esqueci senha"

### 8.2 Tela de Cadastro (TELA CADASTRO.jpg)
- Layout similar ao login
- Campos adicionais conforme mockup

### 8.3 Splash/Carregamento (TELA DE CARREGAMENTO.png)
- Logo centralizada, fundo preto
- Validar se bate com o mockup (verificar se splash nativo usa a mesma imagem)

### ⏸ PARADA 8 — Login/Cadastro + Splash (FINAL)

Reporte final:
1. Resumo X/Y verdes + divergências
2. Lista de todos os arquivos modificados
3. Decisões tomadas (se houver ambiguidade nos mockups)
4. Pendências reais (se algo não é possível resolver só com CSS/layout — ex: foto de perfil precisa de `expo-image-picker`)

---

## Disciplina de tokens

- Não reimprima teste que passa — só falhas + resumo.
- Um commit por grupo. Conventional commits: `style(scope): descrição`.
- Só interrompa fora das paradas se: mockup for impossível de interpretar, ou a mudança visual quebrar funcionalidade.
- **Compare visualmente** cada componente com o mockup correspondente ANTES de reportar que está pronto.
- Abra os mockups (`design-reference/*.jpg`) e use-os como referência direta.

**Esta fase é puramente visual. Não altere lógica, serviços, Motor, billing, entitlement ou fluxo funcional. Só aparência.**
