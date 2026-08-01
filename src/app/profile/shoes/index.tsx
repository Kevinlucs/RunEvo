import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/EmptyState';
import { NeonButton } from '@/components/ui/NeonButton';
import { ShoeCard } from '@/components/shoes/ShoeCard';
import { useShoes } from '@/hooks/useShoes';
import { useAuthStore } from '@/store/auth.store';
import { colors, spacing, fontSizes, fontWeight } from '@/theme';

/** docs/fase-6-brief.md §33 — CRUD de tênis, ilimitados para Free e Plus. */
export default function ShoesList(): JSX.Element {
  const userId = useAuthStore((s) => s.userId);
  const { activeShoes, retiredShoes, isLoading } = useShoes(userId);

  const hasShoes = activeShoes.length > 0 || retiredShoes.length > 0;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {!isLoading && !hasShoes ? (
          <EmptyState
            title="Nenhum tênis cadastrado"
            message="Cadastre seus tênis para acompanhar a quilometragem e saber a hora certa de trocar."
            ctaLabel="Adicionar tênis"
            onPressCta={() => router.push('/profile/shoes/new')}
          />
        ) : (
          <>
            {activeShoes.map((shoe) => (
              <ShoeCard key={shoe.id} shoe={shoe} onPress={() => router.push(`/profile/shoes/${shoe.id}`)} />
            ))}

            {retiredShoes.length > 0 && (
              <View style={styles.retiredSection}>
                <Text style={styles.retiredTitle}>Aposentados</Text>
                {retiredShoes.map((shoe) => (
                  <ShoeCard key={shoe.id} shoe={shoe} onPress={() => router.push(`/profile/shoes/${shoe.id}`)} />
                ))}
              </View>
            )}

            <View style={styles.addButton}>
              <NeonButton label="Adicionar tênis" onPress={() => router.push('/profile/shoes/new')} />
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingTop: spacing.xl, paddingBottom: spacing.xxxl },
  retiredSection: { marginTop: spacing.md },
  retiredTitle: { color: colors.textSecondary, fontSize: fontSizes.body, ...fontWeight('700'), marginBottom: spacing.md },
  addButton: { marginTop: spacing.md },
});
