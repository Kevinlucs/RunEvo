import { Stack } from 'expo-router';

/**
 * Layout das sub-rotas de Estatísticas (níveis, conquistas, recordes).
 * Header padrão — cada tela pode customizar via <Stack.Screen>.
 */
export default function StatsLayout(): JSX.Element {
  return <Stack screenOptions={{ headerShown: false }} />;
}
