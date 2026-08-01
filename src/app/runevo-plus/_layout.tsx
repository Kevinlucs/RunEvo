import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function RunEvoPlusLayout(): JSX.Element {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.neon,
        headerTitleStyle: { color: colors.textPrimary },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'RunEvo+' }} />
      <Stack.Screen name="resources" options={{ title: 'Meus recursos' }} />
    </Stack>
  );
}
