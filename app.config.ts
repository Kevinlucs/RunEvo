import type { ExpoConfig } from 'expo/config';

/**
 * Configuração do app. Segredos NUNCA ficam aqui — apenas a URL pública do
 * Supabase e a anon key (que é pública por design e protegida por RLS).
 * A chave da IA vive só no backend/Edge Function.
 */
const config: ExpoConfig = {
  name: 'RunEvo',
  slug: 'runevo',
  // 'runevo' é o scheme do app; 'rc-45ca7bf701' é o scheme de deep-link do
  // RevenueCat (magic links de restauração/gestão de assinatura enviados
  // por e-mail) — registrado aqui para o SO rotear de volta pro app.
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
    adaptiveIcon: { backgroundColor: '#000000' },
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-sqlite',
    'expo-font',
    '@react-native-community/datetimepicker',
  ],
  experiments: { typedRoutes: true },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    // Chave pública do SDK RevenueCat (Android) — não é segredo, a validação
    // real da compra acontece no servidor via webhook (docs/fase-7-brief.md).
    revenueCatApiKeyAndroid: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID,
  },
};

export default config;
