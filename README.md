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
