# 🏃‍♂️ PLANE BSB

<p align="center">
  <img src="image.png" alt="PLANE BSB - Mapa da prova" width="300">
</p>

> Mini projeto de gestão de treinos para acompanhar meu progresso até a data do meu objetivo: uma ultra maratona de **61km em Brasília**.

## 📋 Sobre o Projeto

O **PLANE BSB** é um Progressive Web App (PWA) simples e funcional, criado para organizar e acompanhar meu plano de treino de corrida ao longo de **24 semanas**, dividido em 3 fases:

| Fase | Semanas | Foco |
|------|---------|------|
| 🏗️ **Base** | S1 a S8 | Construção de volume e resistência aeróbica |
| 💪 **Resistência** | S9 a S16 | Longões crescentes e trabalho de pace de prova |
| ⚡ **Pico** | S17 a S24 | Simulados, polimento e preparação final |

### Funcionalidades

- 📅 **Próximo treino**: ao abrir o app, mostra automaticamente o próximo treino com base na data atual
- ✅ **Marcar treinos concluídos**: controle de quais treinos já foram realizados
- 📏 **Soma automática de km**: totaliza a distância percorrida até o dia da prova
- ✏️ **Edição de pace e descrição**: personalize cada treino com suas anotações
- 🏁 **Countdown**: contagem regressiva para o dia da prova
- 📊 **Estatísticas**: progresso por fase, treinos concluídos, sequência de semanas
- 📱 **Instalável como app**: funciona offline no celular via PWA

## 🛠️ Stacks Utilizadas

| Tecnologia | Uso |
|------------|-----|
| **HTML5** | Estrutura e semântica do app |
| **CSS3** | Estilização com design mobile-first, paleta inspirada no Strava (preto + laranja) |
| **JavaScript (Vanilla)** | Toda a lógica do app, sem frameworks |
| **PWA (Service Worker)** | Cache offline e instalação como app nativo |
| **Web App Manifest** | Configuração de ícone, nome e modo standalone |
| **LocalStorage** | Persistência dos treinos concluídos e personalizações |
| **GitHub Pages** | Hospedagem gratuita e estática |
| **Google Fonts (Outfit)** | Tipografia moderna |

> **Zero dependências externas.** Nenhum framework, nenhum bundler, nenhum `node_modules`. Apenas HTML, CSS e JS puro.

## 🚀 Como Usar

### Acessar Online
Acesse diretamente pelo navegador: **[kevinlucs.github.io/planeBsb](https://kevinlucs.github.io/planeBsb/)**

### Instalar no Celular (Android)
1. Abra o link acima no **Chrome**
2. Toque nos **⋮** (menu) → **"Instalar app"**
3. O app será adicionado à sua tela inicial com ícone próprio

### Rodar Localmente
```bash
git clone https://github.com/Kevinlucs/planeBsb.git
cd planeBsb
python3 -m http.server 8080
# Acesse http://localhost:8080
```

## 🔧 Como Adaptar para Seus Treinos

Quer usar este app para o **seu próprio plano de treino**? É simples:

### 1. Faça um fork do repositório

### 2. Edite o arquivo `app.js`

Localize o array `WEEKS_DATA` (logo no início do arquivo) e altere os treinos conforme sua planilha:

```javascript
const WEEKS_DATA = [
  {
    week: 'S1',          // Número da semana
    phase: 'Base',       // Fase: 'Base', 'Resistência' ou 'Pico'
    off: false,          // true = semana de recuperação
    ter: {               // Treino de Terça (Qualidade)
      title: '8km Forte/Pace',
      desc: '1km forte / 1km pace 6:30',
      km: 8,
      pace: '6:30/km alternado'
    },
    qui: {               // Treino de Quinta (Base)
      title: '6km Leve',
      desc: 'Corrida leve e contínua',
      km: 6,
      pace: '6:30-7:00/km'
    },
    sab: {               // Treino de Sábado (Longão)
      title: '15km Progressivo',
      desc: 'Longão progressivo',
      km: 15,
      pace: 'Progressivo'
    }
  },
  // ... continue para cada semana
];
```

### 3. Ajuste as datas

No topo do `app.js`, altere a data de início e da prova:

```javascript
const RACE_DATE = new Date(2026, 9, 17);  // Mês é 0-indexed (9 = Outubro)
const START_DATE = new Date(2026, 4, 5);  // 5 de Maio de 2026
```

### 4. Personalize o visual

No `styles.css`, as cores estão nas variáveis CSS no `:root`:

```css
:root {
  --accent: #FC4C02;        /* Cor principal (laranja Strava) */
  --accent-light: #FF6B2B;  /* Cor de destaque */
  --bg: #000000;            /* Fundo */
  --bg-card: #1a1a1a;       /* Fundo dos cards */
}
```

### 5. Troque o ícone

Substitua os arquivos `icon-192.png` e `icon-512.png` pelo ícone do seu evento/prova.

### 6. Deploy

Ative o **GitHub Pages** em Settings → Pages → Branch: `main` → Save. Pronto!

## 📁 Estrutura do Projeto

```
planeBsb/
├── index.html        # Página principal do app
├── styles.css        # Estilização completa
├── app.js            # Lógica, dados dos treinos e navegação
├── sw.js             # Service Worker para cache offline
├── manifest.json     # Configuração PWA (nome, ícones, cores)
├── icon-192.png      # Ícone 192x192
├── icon-512.png      # Ícone 512x512
├── image.png         # Imagem original do mapa da prova
└── README.md         # Este arquivo
```

## 📄 Licença

Este projeto é livre para uso e adaptação. Use como base para organizar seus próprios treinos! 🏃‍♂️

---

<p align="center">
  Feito com 🧡 para a comunidade de corrida de Brasília
</p>
