import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { AppHeader } from '@/components/ui/AppHeader';
import { RecordHexagon } from '@/components/gamification';
import { computeRecords } from '@/services/gamification/compute';
import { usePersonalRecords } from '@/hooks/usePersonalRecords';
import { colors, spacing, fontSizes, fontWeight, radii } from '@/theme';

/**
 * Recordes pessoais (1k, 5k, 10k, Meia, Maratona, etc.).
 * Cada distância é um hexágono colorido; tap navega para a tela de detalhe
 * onde o atleta vê marcos, adiciona novos registros e remove antigos.
 * Integrações de atividades (futuras) popularão os tempos automaticamente.
 */
export default function RecordsScreen(): JSX.Element {
  const router = useRouter();
  const { overrides } = usePersonalRecords();

  const records = computeRecords(overrides);

  return (
    <Screen>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Recordes pessoais</Text>
        <Text style={styles.subtitle}>Toque numa distância para ver seus marcos</Text>

        <View style={styles.card}>
          <View style={styles.grid}>
            {records.map((record) => (
              <Pressable
                key={record.key}
                style={styles.gridItem}
                onPress={() => router.push(`/stats/${record.key}`)}
                accessibilityRole="button"
                accessibilityLabel={`Ver recordes de ${record.name}`}
              >
                <RecordHexagon
                  recordKey={record.key}
                  name={record.name}
                  time={record.time}
                  date={record.date}
                  size={104}
                />
              </Pressable>
            ))}
          </View>
        </View>

        <Text style={styles.note}>
          Registre seus melhores tempos manualmente. A sincronização automática com As integrações
          de atividades estarão disponíveis em uma atualização futura.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: spacing.xxxl },
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.title,
    ...fontWeight('800'),
    marginTop: spacing.xs,
    marginBottom: 2,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    marginBottom: spacing.lg,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  gridItem: {
    width: 130,
    alignItems: 'center',
  },
  note: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
    lineHeight: fontSizes.caption * 1.4,
  },
});
