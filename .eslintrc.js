module.exports = {
  root: true,
  extends: ['expo', 'prettier'],
  plugins: ['import'],
  // supabase/functions/** roda em Deno (runtime/resolução de módulos diferente
  // do Node/Expo do resto do projeto — import "npm:pkg@versão", globals Deno.*).
  // Fora do alcance do eslint deste projeto; `deno lint`/`deno check` cobrem lá.
  ignorePatterns: ['supabase/functions/**'],
  rules: {
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    '@typescript-eslint/no-explicit-any': 'error',
    // Regra de fronteira: o domínio (Motor RunEvo) não pode importar React Native
    // nem camadas externas. Reforça funções puras e testáveis.
    'import/no-restricted-paths': [
      'error',
      {
        zones: [
          {
            target: './src/domain',
            from: './src/app',
            message: 'domain não pode importar de app (UI).',
          },
          {
            target: './src/domain',
            from: './node_modules/react-native',
            message: 'domain não pode importar react-native (deve ser puro).',
          },
          {
            target: './src/domain',
            from: './src/services',
            message: 'domain não pode importar services.',
          },
        ],
      },
    ],
  },
};
