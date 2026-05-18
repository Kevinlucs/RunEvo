# RunEvo

O **RunEvo** é um Progressive Web App (PWA) para gerar, organizar e acompanhar planos de treino de corrida. A arquitetura atual usa um modelo híbrido: a IA atua como gestora estratégica e o motor local do app monta a planilha completa com semanas, treinos, volumes, paces e datas.

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
git clone https://github.com/Kevinlucs/RunEvo.git
cd RunEvo
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

Após publicar, limpe o Service Worker/cache do navegador para carregar o `runevo-v13`.


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
4. O RunEvo aplica guardrails locais para impedir aumentos quando houver dor, esforço extremo ou baixa aderência.
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
- Cache atualizado para `runevo-v22`.


## Lapidação de responsividade e UX - v24

- Cards de fase na aba Stats agora exibem semanas na vertical, preenchendo melhor o espaço no navegador.
- Círculo de aderência do Performance Center centralizado.
- Formulário IA Coach reorganizado em grids mais limpos no desktop.
- Datepicker nativo com botão de calendário.
- Máscara automática para campos de tempo, sem precisar digitar `:`.
- Resultado do plano gerado mostra a revisão primeiro e deixa as semanas recolhidas em “Exibir todas as semanas”.
- Após adotar o plano, o app redireciona para o Início.
- Tela de treino ganhou botão “Voltar ao início”.
- Cache atualizado para `runevo-v24`.


## Ajustes de Stats e Adaptive Training - v25

- Removido o bloco antigo "Progresso por Fase" da aba Stats.
- Feedbacks e ajustes do Adaptive Training agora têm rolagem para preservar altura em telas menores.
- Regras do check-in ajustadas: semana 100% concluída, leve e sem dor não reduz a próxima semana automaticamente.
- A IA foi orientada a não cortar carga apenas porque a próxima semana planejada é maior que a semana recém-concluída.
- Modal de feedback do check-in agora tem altura controlada e scroll interno.
- Cache atualizado para `runevo-v25`.


## Ajustes de longões e datepicker - v26

- Card "Evolução dos longões" agora usa barras horizontais por semana.
- Campo extra de distância para Ultra/Personalizado ficou mais responsivo no desktop.
- Corrigido `openNativeDatePicker is not defined`.
- Ícone nativo preto do datepicker foi ocultado; fica somente o botão colorido do app.
- Cache atualizado para `runevo-v26`.


## Responsividade do campo de distância e datepicker - v27

- Campo "Distância da Prova" ocupa melhor a linha quando Ultra/Personalizado não está ativo.
- Ao selecionar Ultra/Personalizado, a distância em km aparece em duas colunas proporcionais.
- Removido `style="display:none"` do campo de distância customizada; agora o controle é por classe.
- Removido clique no input date para evitar disparo duplo do datepicker.
- Ícone nativo preto do datepicker ocultado com regras adicionais.
- Cache atualizado para `runevo-v27`.


## Storage Service - v28

- Adicionado `assets/js/storage-service.js` como camada central de persistência.
- Plano, adoção, progresso, customizações, feedbacks, check-ins e ajustes agora passam por uma API única.
- Dados passaram a ser salvos por usuário com fallback de leitura para chaves antigas.
- Backup/importação usa snapshot centralizado do usuário.
- Preparação para futura migração para Supabase/Firebase sem reescrever o app inteiro.
- Cache atualizado para `runevo-v28`.


## Lapidação final do campo de distância - v29

- Para 5K, 10K, 21K e 42K, o campo “Distância da Prova” ocupa a largura útil do card.
- Para Ultra/Personalizado, o campo “Distância (km)” aparece ao lado no desktop e empilha corretamente no mobile.
- Regras CSS reforçadas com responsividade web/mobile.
- Cache atualizado para `runevo-v29`.


## User/Profile Manager - v30

- Adicionada camada `assets/js/user-profile-service.js`.
- Usuários agora têm perfil com nome, papel, objetivo e avatar.
- Header mostra o atleta logado no desktop e mobile.
- Adicionado botão de sair.
- Modal de perfil mostra plano, semanas, treinos, check-ins e ajustes do usuário atual.
- Login passou a validar pelo `UserProfileService`, mantendo compatibilidade com `CONFIG.ALLOWED_USERS`.
- `config/config.js` agora suporta `USER_PROFILES`.
- Cache atualizado para `runevo-v30`.


## Correção do header no desktop - v31

- Corrigido desalinhamento do perfil do usuário na versão desktop.
- Header agora usa flex layout consistente para perfil, km total e botão sair.
- Mobile preservado com avatar compacto.
- Cache atualizado para `runevo-v31`.


## Settings Page - v32

- Adicionada aba “Ajustes”.
- Nova tela “Atleta & Plano” com perfil logado, resumo do plano e preferências base.
- Permite editar nome, objetivo, dias por semana e data da prova nos metadados do plano.
- Adicionada ação para limpar dados locais somente do usuário logado.
- Bottom navigation ajustada para 5 itens.
- Cache atualizado para `runevo-v32`.


## Ajustes: perfil sem alterar planilha - v33

- A aba Ajustes agora edita apenas dados básicos do atleta.
- Removida edição de dias por semana e data da prova nessa tela.
- Objetivo e quantidade de treinos ficaram somente como leitura/resumo.
- Adicionado upload/remover foto do atleta, salvo localmente por usuário.
- Dados do perfil ajudam a preencher o IA Coach, mas não recalculam a planilha ativa.
- Cache atualizado para `runevo-v33`.


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
- Cache atualizado para `runevo-v34`.


## Polimento perfil, modal e navegação - v35

- Modal de concluir treino agora usa “Concluir”, “Salvar parcial” ou “Registrar” no botão principal.
- Nome da página alterado para “Perfil do Atleta”.
- Texto da página adaptado para explicar que só foto/nome são editáveis e peso vem do check-in.
- Peso travado na aba Perfil; somente leitura.
- Card da foto ocupa melhor o grid esquerdo no desktop.
- Navegação reordenada: Início | Treinos | IA Coach | Estatísticas | Perfil.
- “Stats” virou “Estatísticas”; “Ajustes” virou “Perfil”.
- Cache atualizado para `runevo-v35`.


## Polimento final da aba Perfil - v36

- Removida redundância do título superior da página Perfil do Atleta.
- Clique no chip/avatar do header agora redireciona para a aba Perfil em vez de abrir modal.
- Modal antigo de perfil foi desativado.
- Card de foto centralizado para ocupar melhor o espaço do grid esquerdo.
- Label/campo de nome alinhado ao padrão dos demais cards no desktop e mobile.
- Cache atualizado para `runevo-v36`.


## Perfil final - v37

- Título da aba alterado de “Perfil do Atleta” para “Perfil”.
- Dados pessoais agora aparecem antes da Planilha atual.
- Planilha atual foi movida para baixo.
- Campo “Nome do atleta” alinhado visualmente com os demais cards.
- Ajuste responsivo aplicado para web e mobile.
- Cache atualizado para `runevo-v37`.


## Treinos Hub + Exportação - v38

- Aba Treinos virou um hub mais organizado.
- Fases Base, Resistência, Pico e Polimento agora ficam em cards compactos.
- Exportação e Backup foram movidos da aba Estatísticas para Treinos.
- Aba Estatísticas ficou focada apenas em análise/performance.
- Cards de fase mostram treinos concluídos e km realizado/planejado.
- Layout responsivo para web e mobile.
- Cache atualizado para `runevo-v38`.


## Rebrand - v39

- Nome do app atualizado para `RunEvo`.
- Slogan atualizado para `evolua sua corrida com inteligência`.
- Título, manifesto, service worker, relatórios, exportações, backups e textos visíveis foram atualizados.
- Cache atualizado para `runevo-v39`.


## Foto mobile + tour de primeiro login - v40

- Corrigido upload de foto no mobile com redimensionamento/compressão antes de salvar.
- Adicionado status visual ao selecionar foto.
- Adicionado tour de primeiro login por usuário.
- Tour apresenta: Início, IA Coach, Treinos, Estatísticas e Perfil.
- O tour roda apenas uma vez por usuário e fica salvo no StorageService.
- Cache atualizado para `runevo-v40`.


## Logos/PWA + tour + navegação - v41

- Gerados novos ícones oficiais a partir da logo atual:
  - favicon.ico
  - favicon.png
  - apple-touch-icon.png
  - runevo-icon-192.png
  - runevo-icon-512.png
- `index.html` e `manifest.json` atualizados para usar os novos ícones.
- Service Worker atualizado para `runevo-v41`.
- Texto do tour da IA Coach atualizado com explicação mais profissional sobre personalização por métricas.
- Ícones da bottom navigation centralizados para mobile e desktop.


## Correção de logout - v42

- Corrigido bug visual em que a tela de login aparecia por cima do app após sair.
- Tela de login agora tem fundo opaco e z-index isolado.
- Logout agora oculta o app de forma explícita e reseta navegação para Início.
- Login limpa o display inline e restaura o app corretamente.
- Cache atualizado para `runevo-v42`.


## Botão de tour recorrente - v43

- Removido contador de KM do header na versão web.
- Adicionado botão `?` no header desktop para rever o tour.
- Adicionado botão `?` ao lado do ícone Perfil na bottom nav mobile.
- O tour agora pode ser revisitado a qualquer momento, não apenas no primeiro login.
- Texto do Perfil no tour ajustado para explicar peso/IMC e análise da IA.
- Cache atualizado para `runevo-v43`.


## Ajuste do botão de tour - v44

- No mobile, o botão `?` agora segue o padrão da web e fica no header ao lado do perfil.
- Removido o botão `?` da bottom navigation mobile.
- Corrigido fluxo do botão “Rever tour” para abrir a apresentação corretamente após confirmação.
- Botões do modal do tour agora são resetados antes de cada etapa.
- Cache atualizado para `runevo-v44`.


## Correção definitiva do replay do tour - v45

- Corrigido botão “Rever tour” que abria confirmação, mas não iniciava o tour.
- O botão agora usa `data-action="start-tour"` e listener em captura para evitar conflito com handlers antigos do modal.
- O modal de confirmação é fechado antes de abrir o primeiro passo do tour.
- Botões do modal limpam ações antigas antes de cada etapa.
- Cache atualizado para `runevo-v45`.


## Correção do tour após remover KM do header - v46

- Corrigido erro ao iniciar/rever tour causado pela remoção do elemento `#total-km`.
- `renderHome()` agora verifica se `#total-km` existe antes de tentar atualizar.
- O botão `?` continua substituindo o contador de KM no header.
- Cache atualizado para `runevo-v46`.


## IA Coach polish para testes - v47

- Adicionado card de confiança explicando o Motor RunEvo.
- Loading da IA agora mostra etapas: Perfil, Estratégia, Validação e Planilha.
- Validação dos campos obrigatórios ficou mais clara e destaca o campo com erro.
- Mensagens de erro da IA ficaram mais profissionais e orientadas à ação.
- Adicionado resumo prévio durante a geração: prova, semanas, treinos por semana, nível e objetivo.
- Cache atualizado para `runevo-v47`.


## Correção crítica: adotar planilha - v48

- Corrigido bug em `handleAdoptPlan()` causado por variáveis antigas de modal de treino (`isComplete`/`isPartial`).
- Botão de confirmação agora mostra “Adotar planilha”.
- Adição de validação para garantir que existe uma planilha salva antes de adotar.
- Adotação agora trata erro e exibe feedback ao usuário.
- Cache atualizado para `runevo-v48`.


## Cache guard - v49

- Adicionado marcador `RunEvo_BUILD_VERSION = v49-cache-guard` no console.
- Service Worker atualizado para `runevo-v49`.
- Registro do service worker agora chama `registration.update()`.
- Confirmado que o bug antigo `isComplete/isPartial` não existe mais no `handleAdoptPlan()`.
- Esta versão serve para evitar confusão com cache antigo do navegador/PWA.


## Correção: showToast não definido - v50

- Adicionada função global `showToast()`.
- Corrigido erro ao adotar planilha após confirmação.
- O fluxo de adoção agora pode exibir feedback de sucesso sem quebrar.
- A função também atende check-ins que já chamavam `showToast`.
- Adicionado CSS do toast.
- Cache atualizado para `runevo-v50`.


## Descrições profissionais dos treinos - v51

- Motor de treinos agora gera descrições técnicas e executáveis.
- Fartlek deixou de ser vago: inclui aquecimento, alternância por blocos, recuperação e desaquecimento.
- Intervalados agora indicam repetições, distância dos tiros, recuperação e controle de esforço.
- Ritmo de prova/tempo run agora traz bloco principal sustentado.
- Longões agora orientam distribuição por intensidade e progressão segura.
- Validação foi ajustada para substituir descrições curtas/vagas por descrições profissionais.
- Limite de descrição ampliado de 120 para 650 caracteres.
- Prompt da IA reforçado para estratégia com linguagem de treinador.
- Cache atualizado para `runevo-v51`.


## UI da descrição do treino - v52

- Descrição do treino deixou de aparecer como parágrafo único.
- Criado layout estruturado por etapas: estrutura, aquecimento, bloco principal, recuperação, desaquecimento e controle.
- Distâncias, paces e repetições agora recebem destaque visual.
- Layout responsivo em grid no desktop e empilhado no mobile.
- Semana de recuperação ganhou alerta visual próprio.
- Cache atualizado para `runevo-v52`.


## Reset de lançamento para testes - v53

- Adicionado reset automático de dados locais do RunEvo na primeira abertura desta versão.
- O reset remove dados de todas as contas salvas neste navegador:
  - login atual
  - planos gerados/adotados
  - progresso de treinos
  - check-ins
  - feedbacks
  - perfil/foto/peso
  - dados legados `planebsb`
- O reset roda apenas uma vez por navegador usando `runevo_release_reset_v53_done`.
- Adicionada função `StorageService.resetAllRunEvoLocalData()` para reset manual futuro.
- Service Worker atualizado para `runevo-v53`.


## Agenda da primeira semana + editor centralizado + ações simplificadas - v54

- Corrigida distribuição de treinos quando o início cai no fim da semana.
- Exemplo: início sábado com 3 treinos/semana agora gera sábado, segunda e quarta, em vez de treinos colados ou datas anteriores.
- Datas da primeira semana agora rolam para frente quando o dia calculado ficaria antes da data de início.
- Card de edição manual removido da tela de detalhe do treino.
- Nova central “Modificações da planilha” adicionada na aba Treinos, acima das fases.
- Pela aba Treinos agora é possível selecionar semana/treino para editar, adicionar ou remover.
- Botão “Fiz parcial” removido do detalhe do treino.
- Mantidos apenas “Concluir treino” e “Pulei”.
- Treinos pulados continuam liberando check-in e são enviados para a IA como skippedWorkouts/skippedDetails.
- Prompt do check-in reforçado para a IA entender treino pulado e sugerir redistribuição prudente.
- Cache atualizado para `runevo-v54`.


## Check-in consistente + treino mobile limpo - v55

- Ao desmarcar/alterar treino de uma semana que já tinha check-in, a análise semanal é removida automaticamente.
- A invalidação remove também o ajuste daquela semana no histórico adaptativo.
- Botão de editar descrição saiu da tela do treino; edição fica centralizada na aba Treinos.
- Pace planejado deixou de ser clicável dentro do treino.
- Ação “Fiz parcial” removida da tela do treino.
- Check-in considera apenas treinos concluídos ou pulados como resolvidos.
- Treino pulado continua entrando na análise do check-in para redistribuição segura da carga.
- Responsividade mobile da tela do treino refinada: cards, textos, botões e descrição.
- Cache atualizado para `runevo-v55`.


## Zonas de treinamento pelo teste de 3km - v56

- Teste de 3km agora é obrigatório no IA Coach.
- O pace médio do teste de 3km passa a ser a referência da Z3.
- Motor calcula Z1 a Z5 por percentuais de velocidade derivados da Z3.
- Cada treino passa a usar zonas na descrição: Z1, Z2, Z3, Z4 e Z5.
- Tela de detalhe do treino ganhou card com tabela de zonas do atleta.
- A tabela mostra pace e velocidade de esteira em km/h.
- Descrições ficam mais limpas e profissionais, usando zona em vez de excesso de pace.
- Cache atualizado para `runevo-v56`.


## Zonas simplificadas + redistribuição de treino pulado - v57

- Removido destaque visual da Z3 no card de zonas.
- Card de zonas agora usa título simples “Zonas do atleta”.
- Descrições dos treinos foram simplificadas em blocos objetivos, no estilo:
  - 5min Z1
  - 25min Z2
  - 5min Z1
- Fartlek, intervalado, tempo run, longão, recuperação e polimento usam prescrições curtas por zona.
- Treino pulado agora aplica redistribuição prudente para a próxima semana no check-in.
- Redistribuição usa parte da carga pulada, limitada por segurança, sem compensação agressiva.
- Modal de concluir/pular treino ficou mais profissional.
- Ao concluir ou pular, o app redireciona para o Início.
- Feedback de conclusão/pulo foi melhorado.
- Cache atualizado para `runevo-v57`.


## Descrição em prescrição limpa - v58

- Removidos blocos visuais de Estrutura, Aquecimento e múltiplos Bloco Principal.
- Descrição do treino agora aparece como prescrição limpa, com apenas “Bloco principal”.
- Removidos destaques visuais em KM, pace e zonas dentro da descrição.
- Motor passou a gerar descrições por distância e zona, ex:
  - 1,5KM EM Z1
  - 3X (500M EM Z3/Z4 + 500M EM Z1)
  - 1KM EM Z1
- Descrições antigas verbosas são simplificadas na renderização.
- Cache atualizado para `runevo-v58`.


## Fluxo semanal e prescrição legível - v59

- Semana atual agora avança quando os treinos estão resolvidos e o check-in já foi feito, mesmo com treinos pulados.
- `getNextWorkout()` passou a considerar treino pulado como resolvido.
- Tela de detalhe removeu os cards redundantes de Tipo/Base e Semana.
- Pace planejado usa zonas únicas por padrão, evitando Z2-Z3 em treinos simples.
- Prescrições deixaram de aparecer em caixa alta.
- Fartlek passou a seguir formato mais claro: aquecimento + blocos completos + desaquecimento.
- Exemplo: 1km em Z1 / 3x (1km em Z3 + 1km em Z1) / 1km em Z1.
- Cache atualizado para `runevo-v59`.


## Prescrição quebrada por linha + pace planejado calculado - v60

- Descrição do treino agora quebra linha sempre que inicia novo bloco de distância/zona.
- Observações de check-in aparecem como linha `OBS:` separada.
- Card de tipo/Base foi removido do hero/treino em destaque.
- Pace planejado deixou de mostrar zona; agora calcula o pace médio estimado com base:
  - na prescrição do treino;
  - nas zonas do atleta;
  - na distância de cada bloco.
- Exemplo: `5km em Z2` usa o pace representativo da Z2 para estimar o pace planejado final.
- Cache atualizado para `runevo-v60`.


## Correção de quebra de linha na prescrição - v61

- Corrigido bug visual em que `\n` aparecia literalmente na descrição do treino.
- Prescrição agora renderiza cada bloco em uma linha real.
- Descrições antigas que já foram salvas com `\n` literal são corrigidas na renderização.
- Mantido formato:
  - 1km em Z1
  - 3x (1km em Z3 + 1km em Z1)
  - 500m em Z2
  - 1km em Z1
- Cache atualizado para `runevo-v61`.


## Pace planejado pelo meio termo da zona - v62

- Pace planejado agora usa o meio termo da faixa de cada zona.
- Exemplo: se Z1 for 5:16/km até 6:40/km, o pace planejado para blocos em Z1 será ~5:58/km.
- O app agora prioriza o cálculo pela prescrição do treino antes de usar pace salvo antigo.
- Isso evita que o atleta seja condicionado a correr sempre na ponta mais rápida da zona.
- Cache atualizado para `runevo-v62`.


## Profile hub redesign - v63

- Aba Perfil removida da navegação inferior.
- Perfil agora abre ao clicar no avatar/foto do header.
- Tela Perfil redesenhada em estilo hub:
  - avatar grande
  - nome do atleta
  - data de entrada
  - botão Editar perfil
  - métricas rápidas
  - Meus itens
  - Preferências
  - Conta
  - Sair
  - Termos e Política
- Não foram incluídos cards riscados nas referências: premium, níveis, produtos, eventos, redes sociais etc.
- Edição de foto/nome mantida em painel simples dentro do perfil.
- Cache atualizado para `runevo-v63`.


## Perfil: Tênis e Geral - v64

- Item Tênis agora abre uma tela própria.
- Criada tela de empty state para adicionar o primeiro tênis.
- Criada tela de cadastro/edição de tênis com:
  - marca
  - modelo
  - cor
  - apelido
  - distância atual
  - meta de distância
- Ao concluir treino, se houver tênis cadastrados, o atleta pode selecionar o tênis usado.
- Ao concluir, os km realizados são somados automaticamente ao tênis selecionado.
- Criada tela Geral com:
  - Unidades
  - Idioma
  - Tema
  - Notificações
  - Privacidade
- Itens riscados nas referências não foram incluídos.
- Aplicativos conectados permanece como placeholder para futura integração Strava/calendário/relógios.
- Cache atualizado para `runevo-v64`.


## Rebrand RunEvo - v65

- Nome do app alterado de RUINNA para RunEvo.
- Slogan alterado para: “evolua sua corrida com inteligência”.
- Paleta atualizada:
  - Primary: #CCFF00
  - Secondary: #0A0E1A
  - Tertiary: #00D1FF
  - Neutral: #F8F9FA
- Logo e ícones atualizados para a nova marca RunEvo.
- Manifest, favicon, apple-touch-icon e ícones PWA atualizados.
- Cabeçalho/brand com “Evo” em #CCFF00.
- Cache atualizado para `runevo-v65`.


### v66
- Correção da marca: logo principal e ícones regenerados usando a imagem correta enviada pelo usuário.


## RunEvo mobile polish - v67

- Splash corrigido com slogan oficial: “evolua sua corrida com inteligência”.
- Login removido do slogan, deixando apenas o nome do app.
- Fundo do app/splash/login forçado em preto para evitar fundo azul no mobile.
- Gradientes coloridos removidos dos botões e cards principais.
- Header ajustado com “Evo” em #CCFF00.
- Ícone de ajuda e avatar tiveram a ordem invertida.
- Card “Validação do plano” agora ocupa a linha toda no Motor RunEvo.
- Campo Nome removido do formulário IA Coach.
- Tempos anteriores deixam de ser opcionais:
  - usuário informa o tempo ou marca que ainda não correu aquela distância.
- Teste de 3km agora aceita somente o tempo total.
- Objetivo agora é obrigatório e reforçado no motor RunEvo.
- Botão de geração ficou “Gerar Planilha”, sem robô e sem degradê.
- Cache atualizado para `runevo-v67`.


## Plan Preview Page - v68

- Resultado da geração de planilha saiu debaixo do botão do IA Coach.
- Após gerar, a planilha abre em uma tela própria: Prévia da planilha.
- A tela mantém os detalhes técnicos, validação, ajustes e semanas geradas.
- Botões preservados na tela:
  - Adotar esta Planilha
  - Gerar outra Planilha
- Ao adotar a planilha, o app redireciona para Início.
- Ao gerar outra planilha, o app volta para IA Coach com o formulário zerado.
- Cache atualizado para `runevo-v68`.


## IA Coach active plan guard - v69

- Corrigido botão Remover na planilha ativa dentro do IA Coach.
- Remoção agora exibe alerta informando perda de:
  - estatísticas
  - check-ins
  - avaliações
  - ajustes adaptativos
  - progresso da jornada
- Ao remover a planilha, o app limpa o progresso e libera geração de uma nova.
- IA Coach bloqueia geração de outra planilha enquanto houver uma planilha adotada.
- Fundo global/mobile reforçado como preto para evitar fundo azulado no celular.
- Cards do Motor RunEvo centralizados/alinhados para melhor acabamento visual.
- Cache atualizado para `runevo-v69`.


## RunEvo v70 - IA Evo, Motor Evo e terreno

- IA Coach renomeado para IA Evo.
- Motor RunEvo renomeado para Motor Evo.
- Ajustado tamanho do nome/logo textual RunEvo no header mobile.
- Corrigido espaçamento excessivo no topo da IA Evo no mobile.
- Adicionado campo “Terreno principal dos treinos” em Dados do Corredor:
  - Plano: até 5 m/km
  - Misto: 5 a 15 m/km
  - Elevado: acima de 15 m/km
- Terreno entra no formulário, no perfil salvo e na análise do Motor Evo.
- O Motor Evo passa a tratar terreno como fator técnico para volume, longões, recuperação e orientação por zona.
- Cache atualizado para `runevo-v70`.


## RunEvo v71 - Mobile layout fix e suporte

- Corrigido problema de tela preta/offset alto ao abrir IA Evo no celular.
- Corrigido o mesmo problema na tela Perfil.
- Navegação inferior reduzida para ocupar menos altura no mobile.
- Adicionada nova categoria “Suporte” no Perfil.
- Dentro de Suporte foi adicionada a opção “Tour pelo app”, reaproveitando o ícone/fluxo do tutorial.
- Cache atualizado para `runevo-v71`.


## RunEvo v72 - fluxo correto de suporte

- Removido o ícone “?” do header/nav superior.
- “Suporte” agora fica dentro de Perfil > Minhas preferências.
- Ao tocar em Suporte, abre uma tela própria de suporte.
- Dentro de Suporte foi criada a categoria “Aplicativo”.
- Dentro de Aplicativo fica a opção “Tour pelo app”.
- Cache atualizado para `runevo-v72`.


## RunEvo v73 - correção definitiva do espaço preto mobile

- Corrigido o espaço preto persistente nas telas IA Evo e Perfil.
- No mobile, páginas ativas agora ocupam uma área fixa entre o header e a bottom nav.
- O scroll do body foi isolado para evitar que páginas abram deslocadas para baixo.
- O reset de scroll agora também zera o scroll interno da página ativa.
- Bottom nav ficou um pouco mais compacta.
- Cache atualizado para `runevo-v73`.


## RunEvo v74 - tour obrigatório para IA Evo e prova dinâmica

- Inclui o fluxo do v72: Perfil > Minhas preferências > Suporte > Aplicativo > Tour pelo app.
- Após o primeiro tour, se o atleta ainda não tiver planilha adotada, ele é direcionado obrigatoriamente para IA Evo.
- Se o usuário já viu o tour mas ainda não tem planilha, o app também abre IA Evo ao entrar.
- Após adotar a planilha, o fluxo continua direcionando para Início.
- O card Prova da tela Início não concatena mais distância duplicada como “5 KM - 5KM”.
- O contador de dias usa a data atual até a data da prova, diminuindo com o passar dos dias.
- Cache atualizado para `runevo-v74`.


## RunEvo v75 - suporte dentro de Minhas Preferências

- Corrigida a hierarquia do Perfil:
  - Minhas preferências
    - Geral
    - Suporte
      - Aplicativo
        - Tour pelo app
- Removida a categoria Suporte solta no Perfil.
- Removido/ocultado o ícone “?” do header.
- Mantidas as melhorias do v74.
- Cache atualizado para `runevo-v75`.


## RunEvo v76 - correção visual do suporte

- Ao entrar em Suporte, o título da seção agora é “Aplicativo”.
- O card dentro da seção agora é “Tour pelo app”.
- Removida a tela intermediária desnecessária “Aplicativo”.
- Removido comentário quebrado/visível `<!-- IA EVO PAGE -->` que aparecia em algumas telas.
- Cache atualizado para `runevo-v76`.


## RunEvo v77 - secondary color black fix

- Cor secundária antiga `#0A0E1A` substituída por preto absoluto `#000000`.
- Reforço aplicado em CSS global, mobile, PWA e páginas internas.
- `manifest.json` atualizado com `background_color` e `theme_color` em preto.
- `theme-color` do HTML atualizado para preto.
- Objetivo: remover o fundo azulado que aparecia no mobile.
- Cache atualizado para `runevo-v77`.


## RunEvo v78 - polimento mobile/home/treinos

- Removido campo “Pace realizado” da conclusão de treino.
- Corrigido avatar do header para exibir a foto do atleta quando cadastrada.
- Scroll interno do modal de conclusão ficou invisível.
- Botões principais padronizados: fundo #CCFF00 e texto preto.
- “Próximo treino” e Adaptive Training alinhados na mesma largura dos cards.
- Removido card “Centro de Treinos” da aba Treinos.
- Botão “Editar treino” padronizado no visual RunEvo.
- Exportação/Backup não deixa Excel selecionado por padrão; o destaque verde agora é dinâmico ao clicar.
- Gradientes removidos dos principais botões/cards de ação.
- Cache atualizado para `runevo-v78`.


## RunEvo v79 - prévia e perfil fullscreen

- Botões da tela “Prévia da planilha” deixaram de ficar fixos/flutuando.
- “Adotar esta Planilha” e “Gerar outra Planilha” agora aparecem no final da prévia.
- Corrigida a quebra visual ao exibir/ocultar semanas na prévia.
- “Próximo treino” centralizado e sem bolinha lateral.
- Ao entrar no Perfil e nas telas internas do Perfil, a bottom nav é ocultada.
- A área da tela do Perfil passa a ocupar o espaço inteiro, usando a seta de voltar como navegação.
- Cache atualizado para `runevo-v79`.


## RunEvo v80 - perfil fullscreen real e gestos

- Ao abrir Perfil, o header superior e a bottom nav são ocultados.
- Telas internas do Perfil também ficam sem header/nav:
  - Tênis
  - Adicionar/editar tênis
  - Geral
  - Suporte
  - Aplicativo
  - Privacidade
- Páginas internas do Perfil agora usam a tela inteira e a seta de voltar.
- Botões “Alterar foto” e “Remover foto” padronizados.
- Botão “Adicionar” em Tênis padronizado.
- Adicionado gesto horizontal no mobile/PWA para voltar nas telas do Perfil.
- Cache atualizado para `runevo-v80`.


## RunEvo v81 - IA Evo mais contextual e formulário corrigido

- Prévia da planilha: aumentado o espaçamento entre “Adotar esta Planilha” e “Gerar outra Planilha”.
- Terreno principal não vem mais pré-selecionado; seleção é obrigatória.
- Card de terreno só fica verde quando o atleta selecionar.
- Tempos anteriores de 5K/10K/21K/42K aceitam formato MM:SS ou H:MM:SS.
- Limite máximo dos tempos anteriores ajustado para 8:00:00.
- Validação bloqueia tempos inválidos com minutos/segundos acima de 59.
- Motor Evo agora interpreta melhor objetivo + distância + teste de 3km.
- Se o teste de 3km for forte, mas o objetivo for completar prova longa em pace conservador, o Motor Evo prioriza resistência, Z1/Z2, longões e progressão conservadora.
- Cache atualizado para `runevo-v81`.


## RunEvo v82 - correções de tempo, prévia e alinhamento

- Tempos anteriores não são mais reformatados agressivamente durante a digitação.
- Campos 5K/10K/21K/42K agora normalizam apenas ao sair do campo.
- Mantido limite máximo de 8:00:00.
- Removido cabeçalho repetido “Revisão técnica / Ajustes aplicados” da prévia.
- Removidos chips repetidos de volume inicial, pico, longão e recuperação dentro da análise.
- Ajustado alinhamento dos contadores em “Últimos check-ins” e “Ajustes recentes”.
- Cache atualizado para `runevo-v82`.
