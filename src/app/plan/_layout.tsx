import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function PlanLayout(): JSX.Element {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.neon,
        headerTitleStyle: { color: colors.textPrimary },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="generating" options={{ title: 'Gerando planilha', headerBackVisible: false }} />
      <Stack.Screen name="preview" options={{ title: 'Prévia da planilha' }} />
      <Stack.Screen name="phase/[phase]" options={{ title: 'Detalhe da fase' }} />
      <Stack.Screen name="checkin/[week]" options={{ title: 'Check-in' }} />
    </Stack>
  );
}
