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
      <Stack.Screen name="index" options={{ title: 'Perfil', headerShown: false }} />
      <Stack.Screen
        name="edit"
        options={{
          title: 'Editar perfil',
          headerTitleAlign: 'center',
          headerBackTitle: '',
        }}
      />
      <Stack.Screen
        name="connected-apps"
        options={{
          title: 'Aplicativos e dispositivos\nconectados',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: colors.bg },
          headerTitleStyle: {
            color: colors.textPrimary,
            fontSize: 20,
          },
        }}
      />
      <Stack.Screen name="watches/index" options={{ title: 'Conectar relógio' }} />
      <Stack.Screen name="watches/garmin" options={{ title: 'Garmin Connect' }} />
      <Stack.Screen name="shoes/index" options={{ title: 'Meus tênis' }} />
      <Stack.Screen name="shoes/[id]" options={{ title: 'Tênis' }} />
    </Stack>
  );
}
