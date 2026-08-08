import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function HistoryLayout(): JSX.Element {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.neon,
        headerTitleStyle: { color: colors.textPrimary },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Histórico de ciclos' }} />
      <Stack.Screen name="[planId]" options={{ title: 'Ciclo' }} />
      <Stack.Screen name="compare" options={{ title: 'Comparar ciclos' }} />
      <Stack.Screen name="evolution" options={{ title: 'Evolução' }} />
    </Stack>
  );
}
