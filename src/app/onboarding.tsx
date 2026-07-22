import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { NeonButton } from '@/components/ui/NeonButton';
import { athleteProfileRepository } from '@/repositories';
import { useAuthStore } from '@/store/auth.store';
import { colors, spacing, fontSizes } from '@/theme';

/**
 * Tutorial centralizado de primeiro acesso (docs/fase-3-brief.md §Grupo 5).
 * Uma tela única — não um wizard paginado. Marca `onboarding_seen` no perfil
 * e segue direto para a IA Evo, como o fluxo do brief descreve.
 */
export default function Onboarding(): JSX.Element {
  const userId = useAuthStore((s) => s.userId);
  const [loading, setLoading] = useState(false);

  const onStart = async (): Promise<void> => {
    if (!userId) return;
    setLoading(true);
    await athleteProfileRepository.upsert({ id: userId, onboarding_seen: true });
    setLoading(false);
    router.replace('/(tabs)/ai-evo');
  };

  return (
    <Screen>
      <View style={styles.center}>
        <Text style={styles.title}>Bem-vindo ao RunEvo</Text>
        <Text style={styles.paragraph}>
          O RunEvo monta sua planilha de treino com uma IA que analisa seu perfil, objetivo e histórico —
          e sempre com um motor local de segurança, caso a IA fique indisponível.
        </Text>
        <Text style={styles.paragraph}>
          Em seguida você vai preencher alguns dados sobre você e sua prova. Leva menos de 3 minutos.
        </Text>
        <NeonButton label="Começar" onPress={() => void onStart()} loading={loading} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, paddingHorizontal: spacing.xl },
  title: { color: colors.neon, fontSize: fontSizes.title, fontWeight: '800', textAlign: 'center' },
  paragraph: { color: colors.textSecondary, fontSize: fontSizes.body, textAlign: 'center', lineHeight: 20 },
});
