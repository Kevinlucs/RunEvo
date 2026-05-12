# 🏃‍♂️ PLAN RUN

O **PLAN RUN** é um Progressive Web App (PWA) para gerar, organizar e acompanhar planos de treino de corrida. A arquitetura atual usa um modelo híbrido: a IA atua como gestora estratégica e o motor local do app monta a planilha completa com semanas, treinos, volumes, paces e datas.

## ✨ Principais Funcionalidades

- **🧠 IA como gestora estratégica:** o Gemini gera um blueprint pequeno com estratégia, zonas de pace, progressão e fases do plano.
- **⚙️ Motor próprio de treino:** o JavaScript gera todas as semanas localmente, inclusive planos longos de 20, 30+ semanas, sem depender de JSON gigante da IA.
- **🛡️ Validation Engine:** valida e corrige automaticamente estrutura do plano, quantidade de semanas, treinos por semana, longão no final, semana da prova, fases, tipos de treino, volumes e campos obrigatórios.
- **🔐 Sistema de Login:** acesso controlado por usuários configurados no `config.js`.
- **📊 Acompanhamento:** contagem regressiva para a prova, progresso de quilometragem e controle dos treinos realizados.
- **✏️ Customização:** edição manual de treinos, descrições e paces.
- **📱 PWA Responsivo:** tema escuro, otimizado para celular e instalável na tela inicial.

## 🚀 Como Executar Localmente

1. Clone o repositório:
```bash
git clone https://github.com/Kevinlucs/PlanRun.git
cd PlanRun
```

2. Configure suas credenciais:
- Copie o arquivo de exemplo: `cp config/config.js.example config/config.js`
- Edite o `config/config.js` e configure os usuários desejados.
- Configure a variável `GEMINI_API_KEY` na Vercel para usar o endpoint `/api/generate-plan`.

3. Execute um servidor local na pasta do projeto:
```bash
npx serve .
# ou
python -m http.server 8000
```

4. Acesse no navegador:
```txt
http://localhost:3000
# ou
http://localhost:8000
```

## 🛠️ Tecnologias Utilizadas

- **Frontend:** Vanilla JavaScript, HTML5, CSS3.
- **Armazenamento:** `localStorage`.
- **IA:** Google Gemini API.
- **Deploy:** Vercel.
- **PWA:** Service Worker + Manifest.

## 🧩 Arquitetura do Plano

```txt
Formulário do atleta
↓
Cálculos locais: IMC, semanas, distância, paces base
↓
IA gera blueprint estratégico pequeno
↓
Plan Engine gera semanas e treinos localmente
↓
Validation Engine corrige e valida o plano
↓
Plano é salvo no localStorage
```

## 🔜 Próximos Passos

- Criar tela de revisão técnica do plano.
- Adicionar exportação em PDF/Excel/PDF.
- Criar check-in semanal para replanejamento adaptativo.
- Futuramente migrar para Supabase/PostgreSQL quando houver mais usuários e necessidade de sincronização entre dispositivos.


## Plan Review Engine

A camada de revisão técnica exibe ao usuário o resultado do Validation Engine antes da adoção do plano:

- status da validação;
- quantidade de ajustes aplicados;
- detalhes de cada ajuste por semana;
- volume inicial, volume pico e maior longão;
- semanas de recuperação, polimento e semana da prova.

Isso torna a geração mais transparente: quando o sistema informa “1 ajuste”, o atleta consegue ver exatamente o que foi corrigido.

## Adaptive Training Engine

Esta versão adiciona acompanhamento ativo do atleta após a geração da planilha.

### Recursos adicionados

- Status por treino: pendente, concluído, parcial ou pulado.
- Registro de km realizado, pace realizado, esforço percebido e observações.
- Check-in semanal liberado quando todos os treinos da semana forem registrados.
- Adjustment Engine local para ajustar semanas futuras com base no feedback.
- Redução automática da próxima semana quando houver dor, esforço alto ou baixa aderência.
- Aumento conservador quando a semana for completa e muito leve.
- Histórico de check-ins e ajustes salvo no localStorage por usuário.

### Fluxo atual

```txt
IA gera blueprint estratégico
↓
Plan Engine gera a planilha completa
↓
Validation Engine corrige e valida
↓
Plan Review Engine mostra o laudo técnico
↓
Adaptive Training Engine acompanha treinos e ajusta o plano
```

O banco de dados ainda não é obrigatório nesta etapa. O MVP continua usando `localStorage` por usuário.


## Evolution & Responsive Layer

Esta versão adiciona o histórico de evolução dentro da tela de estatísticas. O app passa a exibir aderência geral, km planejado x realizado, check-ins, ajustes aplicados e uma linha do tempo das semanas recentes.

Também foi aplicado um ajuste responsivo para desktop: as telas agora usam largura máxima centralizada, evitando que o layout fique esticado em monitores grandes, sem prejudicar a experiência mobile.

## Export & Backup Engine

Esta versão adiciona a camada de exportação e backup local:

- Exportação Excel profissional (.xls) com capa, resumo do plano, resumo semanal e planilha detalhada estilizada.
- Exportação PDF organizada com cabeçalho de resumo, separador compatível com Excel e dados completos da planilha ativa.
- Backup JSON completo com plano, progresso, check-ins, ajustes adaptativos e customizações.
- Importação de backup JSON para restaurar o plano e o histórico no navegador.
- Mantém a estratégia sem banco de dados para o MVP fechado com poucos usuários.

Após publicar, limpe o Service Worker/cache do navegador para carregar o `planrun-v13`.


## Atualização v14

- Removida a exportação CSV da interface.
- Mantida a exportação Excel profissional (.xls).
- Adicionada exportação PDF profissional via janela de impressão do navegador, com layout visual, resumo do plano, KPIs, ajustes recentes e planilha detalhada por semana.

## IA Coach Strategy 2.0

A IA agora atua como gestora estratégica do plano. Em vez de gerar a planilha inteira, ela devolve um blueprint compacto com análise do atleta, risco do objetivo, viabilidade, pontos fortes, pontos de atenção, zonas de pace, alertas e calibração do motor de treino.

O motor local continua responsável por montar todas as semanas, validar a estrutura e manter o plano exportável em XLS/PDF.

### Campos principais do blueprint

- `athleteAnalysis`: análise técnica do atleta, nível detectado, risco, viabilidade, foco e resumo do coach.
- `strategy`: volume inicial, volume pico, longão inicial, longão máximo, frequência de recuperação e polimento.
- `paceZones`: zonas de ritmo usadas pelo motor.
- `warnings`: alertas práticos do plano.
- `engineCalibration`: estilo de progressão, prioridade de recuperação e viés de intensidade.


## Check-in com IA

Nesta versão, o Adaptive Training Engine passou a consultar o Coach IA no fechamento semanal. O fluxo agora é:

1. O usuário registra todos os treinos da semana.
2. O check-in envia um resumo compacto para a IA: aderência, km planejado, km realizado, esforço, dor/incômodo e próxima semana.
3. A IA recomenda manter, reduzir, aplicar recuperação ou aumentar levemente a carga.
4. O PlanRun aplica guardrails locais para impedir aumentos quando houver dor, esforço extremo ou baixa aderência.
5. Se a IA falhar, o motor local continua funcionando normalmente.

A IA não reescreve a planilha inteira; ela apenas interpreta o check-in e justifica o ajuste semanal.

### Check-in Feedback Instantâneo

Após o atleta responder o check-in semanal, o app agora exibe imediatamente um feedback do Coach IA ou da regra local, com aderência, km realizado, esforço, sensação, dor/incômodo e ajuste aplicado. A análise completa permanece na aba Stats.

## Manual Plan Editor

A camada Manual Plan Editor permite editar treinos individuais do plano ativo sem regenerar a planilha. O atleta pode alterar título, data, tipo, distância, pace e descrição. As alterações são refletidas no app, nos relatórios PDF/XLS e no backup JSON.

## Manual Plan Editor 2.0

O editor manual agora permite adicionar e remover treinos dentro de uma semana do plano ativo, além de editar treinos existentes. As alterações são persistidas no plano salvo, aparecem no app, nos relatórios PDF/XLS e no backup JSON.

Regras aplicadas:

- A prova não pode ser removida pelo editor manual.
- Uma semana precisa manter pelo menos um treino.
- Ao adicionar/remover treino em uma semana já fechada, o check-in daquela semana é reaberto para manter os cálculos corretos.
- Progresso e feedback de treino removido são apagados para evitar dados órfãos.
- Treinos adicionados recebem ID interno estável para preservar status, exports e backups.


## Dashboard de Evolução 2.0

A aba de Estatísticas agora possui um painel visual de performance com:

- km planejado x km realizado por semana;
- aderência semanal;
- esforço médio registrado;
- evolução dos longões;
- timeline compacta dos ajustes do Adaptive Training/Coach IA.

O dashboard usa os dados reais do plano ativo, status dos treinos, feedbacks e check-ins salvos no localStorage do usuário.


## Dashboard Refinement

- Remove a redundância entre gráficos e histórico.
- A parte inferior agora mostra leitura inteligente do ciclo, últimos check-ins e ajustes recentes.
- Cache atualizado para `planrun-v22`.


## Lapidação de responsividade e UX - v24

- Cards de fase na aba Stats agora exibem semanas na vertical, preenchendo melhor o espaço no navegador.
- Círculo de aderência do Performance Center centralizado.
- Formulário IA Coach reorganizado em grids mais limpos no desktop.
- Datepicker nativo com botão de calendário.
- Máscara automática para campos de tempo, sem precisar digitar `:`.
- Resultado do plano gerado mostra a revisão primeiro e deixa as semanas recolhidas em “Exibir todas as semanas”.
- Após adotar o plano, o app redireciona para o Início.
- Tela de treino ganhou botão “Voltar ao início”.
- Cache atualizado para `planrun-v24`.


## Ajustes de Stats e Adaptive Training - v25

- Removido o bloco antigo "Progresso por Fase" da aba Stats.
- Feedbacks e ajustes do Adaptive Training agora têm rolagem para preservar altura em telas menores.
- Regras do check-in ajustadas: semana 100% concluída, leve e sem dor não reduz a próxima semana automaticamente.
- A IA foi orientada a não cortar carga apenas porque a próxima semana planejada é maior que a semana recém-concluída.
- Modal de feedback do check-in agora tem altura controlada e scroll interno.
- Cache atualizado para `planrun-v25`.


## Ajustes de longões e datepicker - v26

- Card "Evolução dos longões" agora usa barras horizontais por semana.
- Campo extra de distância para Ultra/Personalizado ficou mais responsivo no desktop.
- Corrigido `openNativeDatePicker is not defined`.
- Ícone nativo preto do datepicker foi ocultado; fica somente o botão colorido do app.
- Cache atualizado para `planrun-v26`.


## Responsividade do campo de distância e datepicker - v27

- Campo "Distância da Prova" ocupa melhor a linha quando Ultra/Personalizado não está ativo.
- Ao selecionar Ultra/Personalizado, a distância em km aparece em duas colunas proporcionais.
- Removido `style="display:none"` do campo de distância customizada; agora o controle é por classe.
- Removido clique no input date para evitar disparo duplo do datepicker.
- Ícone nativo preto do datepicker ocultado com regras adicionais.
- Cache atualizado para `planrun-v27`.


## Storage Service - v28

- Adicionado `assets/js/storage-service.js` como camada central de persistência.
- Plano, adoção, progresso, customizações, feedbacks, check-ins e ajustes agora passam por uma API única.
- Dados passaram a ser salvos por usuário com fallback de leitura para chaves antigas.
- Backup/importação usa snapshot centralizado do usuário.
- Preparação para futura migração para Supabase/Firebase sem reescrever o app inteiro.
- Cache atualizado para `planrun-v28`.


## Lapidação final do campo de distância - v29

- Para 5K, 10K, 21K e 42K, o campo “Distância da Prova” ocupa a largura útil do card.
- Para Ultra/Personalizado, o campo “Distância (km)” aparece ao lado no desktop e empilha corretamente no mobile.
- Regras CSS reforçadas com responsividade web/mobile.
- Cache atualizado para `planrun-v29`.


## User/Profile Manager - v30

- Adicionada camada `assets/js/user-profile-service.js`.
- Usuários agora têm perfil com nome, papel, objetivo e avatar.
- Header mostra o atleta logado no desktop e mobile.
- Adicionado botão de sair.
- Modal de perfil mostra plano, semanas, treinos, check-ins e ajustes do usuário atual.
- Login passou a validar pelo `UserProfileService`, mantendo compatibilidade com `CONFIG.ALLOWED_USERS`.
- `config/config.js` agora suporta `USER_PROFILES`.
- Cache atualizado para `planrun-v30`.


## Correção do header no desktop - v31

- Corrigido desalinhamento do perfil do usuário na versão desktop.
- Header agora usa flex layout consistente para perfil, km total e botão sair.
- Mobile preservado com avatar compacto.
- Cache atualizado para `planrun-v31`.


## Settings Page - v32

- Adicionada aba “Ajustes”.
- Nova tela “Atleta & Plano” com perfil logado, resumo do plano e preferências base.
- Permite editar nome, objetivo, dias por semana e data da prova nos metadados do plano.
- Adicionada ação para limpar dados locais somente do usuário logado.
- Bottom navigation ajustada para 5 itens.
- Cache atualizado para `planrun-v32`.


## Ajustes: perfil sem alterar planilha - v33

- A aba Ajustes agora edita apenas dados básicos do atleta.
- Removida edição de dias por semana e data da prova nessa tela.
- Objetivo e quantidade de treinos ficaram somente como leitura/resumo.
- Adicionado upload/remover foto do atleta, salvo localmente por usuário.
- Dados do perfil ajudam a preencher o IA Coach, mas não recalculam a planilha ativa.
- Cache atualizado para `planrun-v33`.


## Perfil lapidado + peso no check-in - v34

- Aba Ajustes simplificada.
- Removido card “Perfil logado”.
- “Plano atual” virou “Planilha atual” e ocupa o topo.
- Dados pessoais foram reorganizados.
- Editáveis: foto, nome e peso atual.
- Idade, altura, objetivo e quantidade de treinos ficam somente como leitura.
- Removido botão “Restaurar”.
- A cada 4 semanas concluídas, o check-in exige peso atual.
- Peso do check-in atualiza o perfil, recalcula IMC e alimenta a análise do Coach IA.
- Cache atualizado para `planrun-v34`.


## Polimento perfil, modal e navegação - v35

- Modal de concluir treino agora usa “Concluir”, “Salvar parcial” ou “Registrar” no botão principal.
- Nome da página alterado para “Perfil do Atleta”.
- Texto da página adaptado para explicar que só foto/nome são editáveis e peso vem do check-in.
- Peso travado na aba Perfil; somente leitura.
- Card da foto ocupa melhor o grid esquerdo no desktop.
- Navegação reordenada: Início | Treinos | IA Coach | Estatísticas | Perfil.
- “Stats” virou “Estatísticas”; “Ajustes” virou “Perfil”.
- Cache atualizado para `planrun-v35`.


## Polimento final da aba Perfil - v36

- Removida redundância do título superior da página Perfil do Atleta.
- Clique no chip/avatar do header agora redireciona para a aba Perfil em vez de abrir modal.
- Modal antigo de perfil foi desativado.
- Card de foto centralizado para ocupar melhor o espaço do grid esquerdo.
- Label/campo de nome alinhado ao padrão dos demais cards no desktop e mobile.
- Cache atualizado para `planrun-v36`.


## Perfil final - v37

- Título da aba alterado de “Perfil do Atleta” para “Perfil”.
- Dados pessoais agora aparecem antes da Planilha atual.
- Planilha atual foi movida para baixo.
- Campo “Nome do atleta” alinhado visualmente com os demais cards.
- Ajuste responsivo aplicado para web e mobile.
- Cache atualizado para `planrun-v37`.


## Treinos Hub + Exportação - v38

- Aba Treinos virou um hub mais organizado.
- Fases Base, Resistência, Pico e Polimento agora ficam em cards compactos.
- Exportação e Backup foram movidos da aba Estatísticas para Treinos.
- Aba Estatísticas ficou focada apenas em análise/performance.
- Cards de fase mostram treinos concluídos e km realizado/planejado.
- Layout responsivo para web e mobile.
- Cache atualizado para `planrun-v38`.
