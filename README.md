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
- Adicionar exportação em CSV/Excel/PDF.
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
