import { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { TextField } from '@/components/ui/TextField';
import { NeonButton } from '@/components/ui/NeonButton';
import { useShoe } from '@/hooks/useShoes';
import { useAuthStore } from '@/store/auth.store';
import { saveShoe, retireShoe, reactivateShoe } from '@/services/shoes/shoes.service';
import { colors, spacing, fontSizes, fontWeight } from '@/theme';

function parseNumber(v: string): number {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/** docs/fase-6-brief.md §33 — criar/editar tênis; aposentar/reativar quando já existe. */
export default function ShoeForm(): JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const userId = useAuthStore((s) => s.userId);
  const { shoe, isLoading } = useShoe(isNew ? undefined : id);

  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [nickname, setNickname] = useState('');
  const [initialKm, setInitialKm] = useState('0');
  const [currentKm, setCurrentKm] = useState('0');
  const [maxKm, setMaxKm] = useState('600');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shoe) return;
    setBrand(shoe.brand ?? '');
    setModel(shoe.model);
    setNickname(shoe.nickname ?? '');
    setInitialKm(String(shoe.initial_km));
    setCurrentKm(String(shoe.current_km));
    setMaxKm(String(shoe.max_km));
  }, [shoe]);

  if (!isNew && isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>Carregando…</Text>
      </View>
    );
  }

  const handleSave = async (): Promise<void> => {
    if (!userId) return;
    if (!model.trim()) {
      setError('Informe o modelo do tênis.');
      return;
    }
    setError(null);
    setSubmitting(true);
    const res = await saveShoe({
      id: isNew ? undefined : id,
      userId,
      brand: brand.trim() || null,
      model: model.trim(),
      nickname: nickname.trim() || null,
      initialKm: parseNumber(initialKm),
      currentKm: parseNumber(currentKm),
      maxKm: parseNumber(maxKm),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError('Não foi possível salvar. Tente novamente.');
      return;
    }
    router.back();
  };

  const handleRetire = async (): Promise<void> => {
    if (isNew) return;
    setSubmitting(true);
    await retireShoe(id);
    setSubmitting(false);
    router.back();
  };

  const handleReactivate = async (): Promise<void> => {
    if (isNew) return;
    setSubmitting(true);
    await reactivateShoe(id);
    setSubmitting(false);
    router.back();
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <TextField label="Marca" value={brand} onChangeText={setBrand} placeholder="Ex: Nike, Asics" autoCapitalize="sentences" />
      <TextField label="Modelo" value={model} onChangeText={setModel} placeholder="Ex: Pegasus 40" autoCapitalize="sentences" error={error ?? undefined} />
      <TextField label="Apelido (opcional)" value={nickname} onChangeText={setNickname} placeholder="Ex: O veterano" autoCapitalize="sentences" />
      <TextField label="Km inicial" value={initialKm} onChangeText={setInitialKm} keyboardType="decimal-pad" />
      <TextField label="Km atual" value={currentKm} onChangeText={setCurrentKm} keyboardType="decimal-pad" />
      <TextField label="Limite recomendado (km)" value={maxKm} onChangeText={setMaxKm} keyboardType="decimal-pad" />

      <View style={styles.actions}>
        <NeonButton label={isNew ? 'Adicionar tênis' : 'Salvar'} onPress={() => void handleSave()} loading={submitting} />
      </View>

      {!isNew && shoe && (
        <View style={styles.actions}>
          {shoe.is_active ? (
            <NeonButton label="Aposentar tênis" variant="secondary" onPress={() => void handleRetire()} disabled={submitting} />
          ) : (
            <NeonButton label="Reativar tênis" variant="secondary" onPress={() => void handleReactivate()} disabled={submitting} />
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, paddingBottom: spacing.xxxl, backgroundColor: colors.bg, flexGrow: 1 },
  loading: { color: colors.textSecondary, fontSize: fontSizes.body, ...fontWeight('600') },
  actions: { marginTop: spacing.sm, marginBottom: spacing.md },
});
