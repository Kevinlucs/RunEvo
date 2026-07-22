import { Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/EmptyState';
import { useActivePlan } from '@/hooks/useActivePlan';
import { colors, spacing, fontSizes } from '@/theme';

export default function Stats(): JSX.Element {
  const { plan, isLoading } = useActivePlan();

  return (
    <Screen>
      <Text style={styles.h1}>Estatísticas</Text>
      {!isLoading && !plan ? (
        <EmptyState
          title="Nada para mostrar ainda"
          message="Suas estatísticas aparecem aqui assim que você tiver uma planilha ativa."
          ctaLabel="Criar minha planilha"
          onPressCta={() => router.push('/(tabs)/ai-evo')}
        />
      ) : (
        <Text style={styles.note}>Cards e gráficos entram na Fase 6.</Text>
      )}
    </Screen>
  );
}
const styles = StyleSheet.create({
  h1: { color: colors.textPrimary, fontSize: fontSizes.title, fontWeight: '800', marginTop: spacing.xl },
  note: { color: colors.textSecondary, fontSize: fontSizes.body, marginTop: spacing.sm },
});
