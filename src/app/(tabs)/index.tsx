import { Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/EmptyState';
import { useActivePlan } from '@/hooks/useActivePlan';
import { colors, spacing, fontSizes } from '@/theme';

export default function Home(): JSX.Element {
  const { plan, isLoading } = useActivePlan();

  return (
    <Screen>
      <Text style={styles.h1}>Início</Text>
      {!isLoading && !plan ? (
        <EmptyState
          title="Você ainda não tem uma planilha"
          message="Gere sua planilha personalizada com a IA Evo para começar a treinar."
          ctaLabel="Criar minha planilha"
          onPressCta={() => router.push('/(tabs)/ai-evo')}
        />
      ) : (
        <Text style={styles.note}>Home completa entra na Fase 4 (próximo treino, objetivo, semana, Adaptive Training).</Text>
      )}
    </Screen>
  );
}
const styles = StyleSheet.create({
  h1: { color: colors.textPrimary, fontSize: fontSizes.title, fontWeight: '800', marginTop: spacing.xl },
  note: { color: colors.textSecondary, fontSize: fontSizes.body, marginTop: spacing.sm },
});
