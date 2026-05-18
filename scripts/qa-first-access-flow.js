const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'assets/js/app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ ${message}`);
  }
}

const tourBlock = app.match(/const RunEvo_TOUR_STEPS = \[([\s\S]*?)\];/);
assert(Boolean(tourBlock), 'Tour steps declarados');
const steps = tourBlock ? (tourBlock[1].match(/title:/g) || []).length : 0;
assert(steps === 7, 'Tour possui 7 passos');
assert(app.includes('Agora gere sua planilha'), 'Último passo direciona para gerar planilha');
assert(app.includes('function finishOnboardingTour()') && app.includes('goToMandatoryPlanSetup();'), 'Final do tour força IA Evo quando não há planilha');
assert(app.includes('function maybeStartOnboardingTour()') && app.includes('StorageService.hasSeenOnboardingTour'), 'Primeiro acesso valida tour visto/não visto');
assert(app.includes('setTimeout(() => goToMandatoryPlanSetup(), 250)'), 'Usuário que já viu tour mas não adotou plano volta para IA Evo');
assert(app.includes('function requirePlanBeforeMainNavigation'), 'Navegação principal protegida sem planilha adotada');
assert(app.includes("new Set(['home', 'phases', 'stats'])"), 'Home, Treinos e Estatísticas bloqueados antes da adoção');
assert(app.includes("showPage('home');") && app.includes('Planilha adotada com sucesso'), 'Após adoção, fluxo retorna para Início');
assert(html.includes('Adotar esta Planilha'), 'Botão Adotar esta Planilha existe na prévia');
assert(html.includes('Gerar outra Planilha'), 'Botão Gerar outra Planilha existe na prévia');

if (process.exitCode) process.exit(1);
console.log('\nFluxo validado: Login/Tour → IA Evo obrigatória → Prévia → Adoção → Início.');
