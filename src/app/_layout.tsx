import { useCallback, useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useFonts,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
  Outfit_900Black,
} from '@expo-google-fonts/outfit';
import { ThemeProvider } from '@/theme';
import { queryClient } from '@/store/query-client';
import { useAuthStore } from '@/store/auth.store';
import { useSync } from '@/hooks/useSync';
import { athleteProfileRepository } from '@/repositories';
import { deriveOnboardingState, type OnboardingState } from '@/services/auth/onboarding-state';

// Segura o splash nativo até a fonte Outfit carregar (useFonts, abaixo).
// `.catch` porque Fast Refresh pode chamar de novo com o splash já escondido.
SplashScreen.preventAutoHideAsync().catch(() => {});

const ONBOARDING_KEY = '@runevo:onboarding_seen';

function useOnboardingSeen(userId: string | null, initialSyncDone: boolean): OnboardingState {
  const query = useQuery({
    queryKey: ['onboarding-seen', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<boolean | null> => {
      if (!userId) return null;

      // AsyncStorage como cache monotônico: uma vez true, nunca volta a false
      // (sobrevive a resets de SQLite e sync que sobrescreve com valor antigo).
      const cached = await AsyncStorage.getItem(ONBOARDING_KEY);
      if (cached === 'true') {
        if (typeof __DEV__ !== 'undefined' && __DEV__) console.log('[ONBOARDING] AsyncStorage cache hit: seen=true');
        return true;
      }

      const result = await athleteProfileRepository.findById(userId);
      const value = result.ok ? (result.value?.onboarding_seen ?? null) : null;
      if (typeof __DEV__ !== 'undefined' && __DEV__) console.log('[ONBOARDING] SQLite:', value, '| syncDone:', initialSyncDone);

      // Se SQLite diz true, persiste no AsyncStorage para resiliência.
      if (value === true) {
        await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      }
      return value;
    },
  });
  return deriveOnboardingState(query.data, initialSyncDone);
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
  const { initialSyncDone } = useSync();
  const onboardingState = useOnboardingSeen(session?.user.id ?? null, initialSyncDone);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (initializing) return;
    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';

    if (!session) {
      if (!inAuthGroup) router.replace('/(auth)/sign-in');
      return;
    }

    // Sessão presente: só decide destino quando soubermos loading/seen/unseen
    // — nunca mais que o timeout do 1º sync (evita spinner infinito).
    if (onboardingState === 'loading') return;

    if (onboardingState === 'unseen') {
      if (!inOnboarding) router.replace('/onboarding');
      return;
    }

    // onboardingState === 'seen': autenticado e onboarded — sai do grupo
    // (auth)/onboarding E da rota raiz "/" (reabertura do app com sessão já
    // válida cai aqui direto, sem passar por (auth)). Outras rotas
    // autenticadas (workout/plan/profile) não são tocadas. `useSegments()` é
    // tipado como sempre não-vazio, mas na raiz "/" é `[]` em runtime — daí
    // o cast só para esta checagem.
    const atRoot = (segments as readonly string[]).length === 0;
    if (inAuthGroup || inOnboarding || atRoot) router.replace('/(tabs)');
  }, [session, initializing, onboardingState, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000' } }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="plan" />
      <Stack.Screen name="workout" />
      <Stack.Screen name="history" />
    </Stack>
  );
}

/**
 * Segura o splash nativo até a fonte Outfit terminar de carregar (ou falhar
 * — nunca prende o app esperando para sempre). Enquanto isso, `RootLayout`
 * retorna `null`: o splash nativo continua cobrindo a tela.
 */
export default function RootLayout(): JSX.Element | null {
  const [fontsLoaded, fontError] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
    Outfit_900Black,
  });
  const fontsReady = fontsLoaded || Boolean(fontError);

  const hideSplash = useCallback(async () => {
    if (fontsReady) await SplashScreen.hideAsync();
  }, [fontsReady]);

  useEffect(() => {
    void hideSplash();
  }, [hideSplash]);

  if (!fontsReady) return null;

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
