import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { useAthleteProfile } from '@/hooks/useAthleteProfile';
import { useAuth } from '@/hooks/useAuth';
import { updateAthleteProfile } from '@/services/profile/edit-profile.service';
import { colors, fontSizes, fontWeight, radii, spacing } from '@/theme';
import type { AthleteProfile } from '@/domain/entities';

type FieldKey = 'name' | 'birthDate' | 'gender' | 'weight' | 'height';
type Gender = NonNullable<AthleteProfile['gender']>;

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'masculino', label: 'Homem' },
  { value: 'feminino', label: 'Mulher' },
  { value: 'nao-binario', label: 'Não binário' },
  { value: 'prefiro-nao-dizer', label: 'Prefiro não informar' },
];

function formatBirthDate(value: string | null | undefined): string {
  if (!value) return 'Adicionar';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

function toIsoDate(value: string): string | null {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const parsed = new Date(`${year}-${month}-${day}T12:00:00`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== Number(year) ||
    parsed.getMonth() !== Number(month) - 1 ||
    parsed.getDate() !== Number(day)
  ) {
    return null;
  }
  return `${year}-${month}-${day}`;
}

function genderLabel(value: AthleteProfile['gender']): string {
  return GENDER_OPTIONS.find((option) => option.value === value)?.label ?? 'Adicionar';
}

interface ProfileFieldProps {
  label: string;
  value: string;
  onPress: () => void;
  disabled?: boolean;
}

function ProfileField({ label, value, onPress, disabled = false }: ProfileFieldProps): JSX.Element {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Editar ${label.toLowerCase()}`}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [styles.field, pressed && !disabled && styles.fieldPressed]}
      >
        <Text
          style={[
            styles.fieldValue,
            !value || value === 'Adicionar' ? styles.fieldPlaceholder : undefined,
          ]}
        >
          {value || 'Adicionar'}
        </Text>
        <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

/** Dados básicos do atleta em cards compactos, salvos no repositório offline-first. */
export default function EditProfile(): JSX.Element {
  const { user } = useAuth();
  const { profile, isLoading, invalidate } = useAthleteProfile(user?.id);
  const [displayName, setDisplayName] = useState('');
  const [birthDate, setBirthDate] = useState<string | null>(null);
  const [gender, setGender] = useState<AthleteProfile['gender']>(null);
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [editing, setEditing] = useState<FieldKey | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name ?? '');
    setBirthDate(profile.birth_date);
    setGender(profile.gender);
      setWeight(profile.current_weight_kg ? String(profile.current_weight_kg) : '');
      setHeight(profile.height_cm ? String(profile.height_cm) : '');
  }, [profile]);

  const email = user?.email ?? 'E-mail não disponível';
  const name = displayName || user?.user_metadata?.display_name || email.split('@')[0] || 'Atleta';
  const initial = name.charAt(0).toUpperCase();
  const modalTitle = useMemo(() => {
    if (editing === 'name') return 'Nome';
    if (editing === 'birthDate') return 'Data de nascimento';
    return 'Gênero';
  }, [editing]);

  const openEditor = (field: FieldKey): void => {
    setEditing(field);
    setDraft(
      field === 'name'
        ? displayName
        : field === 'birthDate'
          ? formatBirthDate(birthDate)
          : (gender ?? ''),
    );
  };

  const closeEditor = (): void => {
    if (!saving) setEditing(null);
  };

  const save = async (): Promise<void> => {
    if (!user?.id || !editing) return;

    let nextName = displayName;
    let nextBirthDate = birthDate;
    let nextGender = gender;
    let nextWeight = weight;
    let nextHeight = height;

    if (editing === 'name') {
      nextName = draft.trim();
      if (!nextName) {
        Alert.alert('Informe seu nome', 'Use um nome para identificar seu perfil.');
        return;
      }
    }

    if (editing === 'birthDate') {
      nextBirthDate = toIsoDate(draft);
      if (!nextBirthDate) {
        Alert.alert('Data inválida', 'Use o formato DD/MM/AAAA.');
        return;
      }
    }

    if (editing === 'gender') {
      nextGender = draft as Gender;
      if (!GENDER_OPTIONS.some((option) => option.value === nextGender)) return;
    }

    if (editing === 'weight') {
      if (draft && isNaN(Number(draft))) { Alert.alert('Valor inválido', 'Insira um peso numérico.'); return; }
      nextWeight = draft;
    }

    if (editing === 'height') {
      if (draft && isNaN(Number(draft))) { Alert.alert('Valor inválido', 'Insira uma altura numérica.'); return; }
      nextHeight = draft;
    }

    setSaving(true);
    const result = await updateAthleteProfile({
      id: user.id,
      displayName: nextName || null,
      birthDate: nextBirthDate,
      gender: nextGender,
      currentWeightKg: nextWeight ? Number(nextWeight) : null,
      heightCm: nextHeight ? Number(nextHeight) : null,
      preferredUnit: profile?.preferred_unit ?? 'km',
      language: profile?.language ?? 'pt-BR',
      theme: profile?.theme ?? 'dark',
    });
    setSaving(false);

    if (!result.ok) {
      Alert.alert('Não foi possível salvar', 'Tente novamente em alguns instantes.');
      return;
    }

    setDisplayName(nextName);
    setBirthDate(nextBirthDate);
    setGender(nextGender);
    setWeight(nextWeight);
    setHeight(nextHeight);
    invalidate();
    setEditing(null);
  };

  return (
    <Screen>
      <Stack.Screen options={{ headerTitleAlign: 'center', title: 'Editar perfil' }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Alterar foto de perfil"
            onPress={() =>
              Alert.alert('Foto de perfil', 'A personalização da foto estará disponível em breve.')
            }
            style={styles.editAvatarButton}
          >
            <Ionicons name="pencil" size={16} color={colors.card} />
          </Pressable>
        </View>

        {isLoading ? (
          <Text style={styles.loading}>Carregando perfil…</Text>
        ) : (
          <View style={styles.fields}>
            <ProfileField label="Nome" value={name} onPress={() => openEditor('name')} />
            <ProfileField label="E-mail" value={email} onPress={() => undefined} disabled />
            <ProfileField
              label="Data de nascimento"
              value={formatBirthDate(birthDate)}
              onPress={() => openEditor('birthDate')}
            />
            <ProfileField label="Gênero" value={genderLabel(gender)} onPress={() => openEditor('gender')} />
            <ProfileField label="Altura (cm)" value={height ? height + ' cm' : 'Adicionar'} onPress={() => openEditor('height')} />
            <ProfileField label="Peso (kg)" value={weight ? weight + ' kg' : 'Adicionar'} onPress={() => openEditor('weight')} />
          </View>
        )}
      </ScrollView>

      <Modal
        transparent
        visible={editing !== null}
        animationType="fade"
        onRequestClose={closeEditor}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{modalTitle}</Text>
            {editing === 'gender' ? (
              <View style={styles.options}>
                {GENDER_OPTIONS.map((option) => {
                  const selected = draft === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      onPress={() => setDraft(option.value)}
                      style={[styles.option, selected && styles.optionSelected]}
                    >
                      <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                        {option.label}
                      </Text>
                      {selected ? <Ionicons name="checkmark" size={20} color={colors.bg} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <TextInput
                autoFocus
                value={draft}
                onChangeText={setDraft}
                placeholder={editing === 'birthDate' ? 'DD/MM/AAAA' : 'Seu nome'}
                placeholderTextColor={colors.textMuted}
                keyboardType={editing === 'birthDate' ? 'numbers-and-punctuation' : (editing === 'weight' || editing === 'height') ? 'numeric' : 'default'}
                autoCapitalize={editing === 'name' ? 'words' : 'none'}
                maxLength={editing === 'birthDate' ? 10 : (editing === 'weight' || editing === 'height') ? 5 : 80}
                style={styles.modalInput}
              />
            )}
            <View style={styles.modalActions}>
              <Pressable disabled={saving} onPress={closeEditor} style={styles.cancelButton}>
                <Text style={styles.cancelLabel}>Cancelar</Text>
              </Pressable>
              <Pressable disabled={saving} onPress={() => void save()} style={styles.saveButton}>
                <Text style={styles.saveLabel}>{saving ? 'Salvando…' : 'Salvar'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingTop: spacing.xxxl, paddingBottom: spacing.xxxl },
  avatarWrap: { alignSelf: 'center', width: 96, height: 96, marginBottom: spacing.xxxl },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: radii.pill,
    backgroundColor: colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: colors.neon, fontSize: fontSizes.title, ...fontWeight('900') },
  editAvatarButton: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.textPrimary,
    borderWidth: 3,
    borderColor: colors.bg,
  },
  loading: { color: colors.textSecondary, textAlign: 'center', fontSize: fontSizes.body },
  fields: { gap: spacing.xl },
  fieldWrap: { gap: spacing.sm },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    ...fontWeight('700'),
    textTransform: 'uppercase',
  },
  field: {
    minHeight: 64,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.cardElevated,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldPressed: { opacity: 0.76 },
  fieldValue: {
    color: colors.textPrimary,
    fontSize: fontSizes.base,
    flex: 1,
    marginRight: spacing.md,
  },
  fieldPlaceholder: { color: colors.textMuted },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radii.lg,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
  },
  modalTitle: { color: colors.textPrimary, fontSize: fontSizes.lg, ...fontWeight('800') },
  modalInput: {
    height: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    color: colors.textPrimary,
    fontSize: fontSizes.base,
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  options: { marginTop: spacing.lg, gap: spacing.sm },
  option: {
    minHeight: 48,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionSelected: { backgroundColor: colors.neon },
  optionLabel: { color: colors.textPrimary, fontSize: fontSizes.body },
  optionLabelSelected: { color: colors.bg, ...fontWeight('700') },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  cancelButton: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  cancelLabel: { color: colors.textSecondary, ...fontWeight('700') },
  saveButton: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.neon,
  },
  saveLabel: { color: colors.bg, ...fontWeight('800') },
});
