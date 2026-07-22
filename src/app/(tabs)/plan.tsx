import { Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { AppHeader } from '@/components/ui/AppHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { useActivePlan } from '@/hooks/useActivePlan';
import { colors, spacing, fontSizes } from '@/theme';

export default function Plan(): JSX.Element {
  const { plan, isLoading } = useActivePlan();

  return (
    <Screen>
      <AppHeader />
      <Text style={styles.h1}>Treinos</Text>
      {!isLoading && !plan ? (
        <EmptyState
          title="Nenhuma planilha ativa"
          message="Gere sua planilha com a IA Evo para ver seus treinos aqui."
          ctaLabel="Criar minha planilha"
          onPressCta={() => router.push('/(tabs)/ai-evo')}
        />
      ) : (
        <Text style={styles.note}>Ciclo, fases, editor manual e exportação entram nas Fases 4–7.</Text>
      )}
    </Screen>
  );
}
const styles = StyleSheet.create({
  h1: { color: colors.textPrimary, fontSize: fontSizes.title, fontWeight: '800', marginTop: spacing.xl },
  note: { color: colors.textSecondary, fontSize: fontSizes.body, marginTop: spacing.sm },
});
