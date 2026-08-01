import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function ProfileLayout(): JSX.Element {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.neon,
        headerTitleStyle: { color: colors.textPrimary },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Perfil' }} />
      <Stack.Screen name="shoes/index" options={{ title: 'Meus tênis' }} />
      <Stack.Screen name="shoes/[id]" options={{ title: 'Tênis' }} />
    </Stack>
  );
}
