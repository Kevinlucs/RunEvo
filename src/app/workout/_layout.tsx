import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function WorkoutLayout(): JSX.Element {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.neon,
        headerTitleStyle: { color: colors.textPrimary },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="[id]" options={{ title: 'Treino' }} />
    </Stack>
  );
}
