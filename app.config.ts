import type { ExpoConfig } from 'expo/config';

/**
 * Configuração do app. Segredos NUNCA ficam aqui — apenas a URL pública do
 * Supabase e a anon key (que é pública por design e protegida por RLS).
 * A chave da IA vive só no backend/Edge Function.
 */
const config: ExpoConfig = {
  name: 'RunEvo',
  slug: 'runevo',
  scheme: 'runevo',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  newArchEnabled: true,
  splash: {
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
  },
};

export default config;
