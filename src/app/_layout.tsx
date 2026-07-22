import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '@/theme';
import { queryClient } from '@/store/query-client';
import { useAuthStore } from '@/store/auth.store';
import { useSync } from '@/hooks/useSync';
import { athleteProfileRepository } from '@/repositories';

/** `undefined` = ainda carregando; `null` = perfil não sincronizado ainda. */
function useOnboardingSeen(userId: string | null): boolean | undefined {
  const query = useQuery({
    queryKey: ['onboarding-seen', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<boolean | null> => {
      if (!userId) return null;
      const result = await athleteProfileRepository.findById(userId);
      return result.ok ? (result.value?.onboarding_seen ?? null) : null;
    },
  });
  if (!userId) return undefined;
  if (query.data === null || query.data === undefined) return undefined;
  return query.data;
}

/**
 * Layout raiz. Faz o bootstrap da sessão, aciona o sync e implementa o guard
 * de rota: sem sessão → grupo (auth); com sessão e tutorial não visto →
 * /onboarding (docs/fase-3-brief.md §Grupo 5); com sessão e tutorial visto →
 * grupo (tabs).
 */
function RootNavigator(): JSX.Element {
  const { session, initializing, bootstrap } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const onboardingSeen = useOnboardingSeen(session?.user.id ?? null);
  useSync();

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (initializing) return;
    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
      return;
    }
    if (session && inAuthGroup) {
      router.replace('/(tabs)');
      return;
    }
    // Perfil ainda não sincronizado localmente (onboardingSeen === undefined):
    // não redireciona para não "piscar" a tela de tutorial por engano.
    if (session && onboardingSeen === false && !inOnboarding) {
      router.replace('/onboarding');
    }
  }, [session, initializing, onboardingSeen, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000' } }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="plan" />
    </Stack>
  );
}

export default function RootLayout(): JSX.Element {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <RootNavigator />
        </QueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
