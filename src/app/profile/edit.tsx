import { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { TextField } from '@/components/ui/TextField';
import { ChoiceField } from '@/components/forms/ChoiceField';
import { NeonButton } from '@/components/ui/NeonButton';
import { useAthleteProfile } from '@/hooks/useAthleteProfile';
import { useAuthStore } from '@/store/auth.store';
import { updateAthleteProfile } from '@/services/profile/edit-profile.service';
import { colors, spacing, fontSizes, fontWeight } from '@/theme';

const UNIT_OPTIONS = [
  { value: 'km' as const, label: 'Quilômetros' },
  { value: 'mi' as const, label: 'Milhas' },
];
const LANGUAGE_OPTIONS = [
  { value: 'pt-BR', label: 'Português' },
  { value: 'en', label: 'English' },
];
const THEME_OPTIONS = [
  { value: 'dark' as const, label: 'Escuro' },
  { value: 'light' as const, label: 'Claro' },
  { value: 'system' as const, label: 'Sistema' },
];

/**
 * docs/fase-6-brief.md §32 — editar nome, peso, unidade, idioma, tema.
 * Unidade/idioma/tema só gravam preferência: o app hoje é km/pt-BR/escuro
 * fixo em toda tela (sem i18n nem conversão de unidade implementados), então
 * a mudança não tem efeito visível ainda — divergência reportada na Parada 2.
 * Foto de perfil fica de fora desta tela: exigiria expo-image-picker +
 * bucket de Storage no Supabase, nenhum dos dois existe no projeto hoje.
 */
export default function EditProfile(): JSX.Element {
  const userId = useAuthStore((s) => s.userId);
  const { profile, isLoading, invalidate } = useAthleteProfile(userId);

  const [displayName, setDisplayName] = useState('');
  const [weight, setWeight] = useState('');
  const [unit, setUnit] = useState<'km' | 'mi'>('km');
  const [language, setLanguage] = useState('pt-BR');
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('dark');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name ?? '');
    setWeight(profile.current_weight_kg ? String(profile.current_weight_kg) : '');
    setUnit(profile.preferred_unit);
    setLanguage(profile.language);
    setTheme(profile.theme);
  }, [profile]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>Carregando…</Text>
      </View>
    );
  }

  const handleSave = async (): Promise<void> => {
    if (!userId) return;
    setError(null);
    setSubmitting(true);
    const parsedWeight = weight.trim() ? Number(weight.replace(',', '.')) : null;
    const res = await updateAthleteProfile({
      id: userId,
      displayName: displayName.trim() || null,
      currentWeightKg: Number.isFinite(parsedWeight) ? parsedWeight : null,
      heightCm: profile?.height_cm ?? null,
      preferredUnit: unit,
      language,
      theme,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError('Não foi possível salvar. Tente novamente.');
      return;
    }
    invalidate();
    router.back();
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <TextField label="Nome" value={displayName} onChangeText={setDisplayName} placeholder="Seu nome" autoCapitalize="sentences" error={error ?? undefined} />
      <TextField label="Peso (kg)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="Ex: 70" />
      <ChoiceField label="Unidade de distância" value={unit} onChange={setUnit} options={UNIT_OPTIONS} />
      <ChoiceField label="Idioma" value={language} onChange={setLanguage} options={LANGUAGE_OPTIONS} />
      <ChoiceField label="Tema" value={theme} onChange={setTheme} options={THEME_OPTIONS} />

      <View style={styles.actions}>
        <NeonButton label="Salvar" onPress={() => void handleSave()} loading={submitting} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, paddingBottom: spacing.xxxl, backgroundColor: colors.bg, flexGrow: 1 },
  loading: { color: colors.textSecondary, fontSize: fontSizes.body, ...fontWeight('600') },
  actions: { marginTop: spacing.sm },
});
