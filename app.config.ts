import type { ExpoConfig } from 'expo/config';

/**
 * Configuracao do app. Segredos NUNCA ficam aqui -- apenas a URL publica do
 * Supabase e a anon key (que e publica por design e protegida por RLS).
 * A chave da IA vive so no backend/Edge Function.
 */
const config: ExpoConfig = {
  name: 'RunEvo',
  slug: 'runevo',
  owner: 'keviinlucs',
  // 'runevo' e o scheme do app; 'rc-45ca7bf701' e o scheme de deep-link do
  // RevenueCat (magic links de restauracao/gestao de assinatura enviados
  // por e-mail) -- registrado aqui para o SO rotear de volta pro app.
  scheme: ['runevo', 'rc-45ca7bf701'],
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    backgroundColor: '#000000',
    resizeMode: 'contain',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'br.com.runevo.app',
  },
  android: {
    package: 'br.com.runevo.app',
    gradleProperties: {
      "org.gradle.jvmargs": "-Xmx4096m",
    },
    versionCode: 1,
    adaptiveIcon: { backgroundColor: '#000000' },
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-sqlite',
    'expo-font',
    '@react-native-community/datetimepicker',
    [
      'expo-build-properties',
      {
        android: {
          kotlinVersion: '1.9.25',
        },
      },
    ],
  ],
  experiments: { typedRoutes: true },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    // Chave publica do SDK RevenueCat (Android) -- nao e segredo, a validacao
    // real da compra acontece no servidor via webhook (docs/fase-7-brief.md).
    revenueCatApiKeyAndroid: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID,
    eas: {
      projectId: 'a82f93f1-98a9-4887-ab95-bc4b5779500e',
    },
  },
};

export default config;
