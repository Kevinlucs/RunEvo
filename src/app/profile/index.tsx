import { useState, type ComponentProps } from 'react';
import { ScrollView, View, Text, Pressable, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { Screen } from '@/components/ui/Screen';
import { NeonButton } from '@/components/ui/NeonButton';
import { useAuth } from '@/hooks/useAuth';
import { useAthleteProfile } from '@/hooks/useAthleteProfile';
import { useEntitlement } from '@/hooks/useEntitlement';
import { classifyImc } from '@/services/stats/stats.service';
import { formatMonthYear } from '@/utils/time';
import { colors, radii, spacing, fontSizes, fontWeight } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

function ComingSoon(feature: string): void {
  Alert.alert('Em breve', `${feature} ainda não está disponível nesta versão.`);
}

interface RowProps {
  icon: IconName;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

function ProfileRow({ icon, label, onPress, destructive = false }: RowProps): JSX.Element {
  return (
    <Pressable onPress={onPress} style={styles.row} accessibilityRole="button">
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={20} color={destructive ? colors.error : colors.textSecondary} />
        <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

function SectionLabel({ children }: { children: string }): JSX.Element {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

/**
 * docs/fase-6-brief.md Grupo 4 (§32, mockup 14). Foto de perfil não entra
 * (exigiria expo-image-picker + bucket de Storage — infra que não existe no
 * projeto hoje). Unidade/idioma/tema (editados em profile/edit.tsx) só
 * gravam preferência: sem efeito visível ainda, divergência reportada.
 * Termos/Privacidade/Suporte/Geral/Dispositivos/Meus Recursos ficam "Em
 * breve" — não há domínio de landing publicado para linkar (não simulamos
 * URL) nem telas de configurações/suporte especificadas neste grupo.
 */
export default function Profile(): JSX.Element {
  const { session, user, signOut, deleteAccount } = useAuth();
  const { profile } = useAthleteProfile(user?.id);
  const { isPlus } = useEntitlement();

  const [deleting, setDeleting] = useState(false);

  const name = profile?.display_name || session?.user.email?.split('@')[0] || 'Atleta';
  const initial = name.charAt(0).toUpperCase();
  const joinedAt = formatMonthYear(user?.created_at ?? null);
  const imcLabel = classifyImc(profile?.imc ?? null);
  const planLabel = isPlus ? 'RunEvo+' : 'Livre';

  const handleDeleteAccount = (): void => {
    Alert.alert(
      'Excluir conta',
      'Essa ação é irreversível: todos os seus dados, planilhas e histórico serão apagados. Deseja continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Confirmar exclusão',
              'Esta é a confirmação final. Não é possível desfazer esta ação.',
              [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Excluir minha conta',
                  style: 'destructive',
                  onPress: () => {
                    void (async () => {
                      setDeleting(true);
                      const res = await deleteAccount();
                      setDeleting(false);
                      if (!res.ok) {
                        Alert.alert('Erro', 'Não foi possível excluir a conta. Tente novamente.');
                      }
                    })();
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  return (
    <Screen>
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarLetter}>{initial}</Text>
        </View>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.joined}>Entrou em {joinedAt}</Text>
        <View style={styles.editButton}>
          <NeonButton label="Editar perfil" onPress={() => router.push('/profile/edit')} />
        </View>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>PESO</Text>
        <Text style={styles.infoValue}>{profile?.current_weight_kg ? `${profile.current_weight_kg} kg` : '-'}</Text>
      </View>
      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>IMC</Text>
        <Text style={styles.infoValue}>{profile?.imc ? `${profile.imc.toFixed(1)} · ${imcLabel}` : '-'}</Text>
      </View>
      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>PLANO</Text>
        <Text style={styles.infoValue}>{planLabel}</Text>
      </View>

      <SectionLabel>Meus itens</SectionLabel>
      <View style={styles.group}>
        <ProfileRow icon="apps-outline" label="Aplicativos e dispositivos conectados" onPress={() => ComingSoon('Aplicativos e dispositivos conectados')} />
        <ProfileRow icon="footsteps-outline" label="Tênis" onPress={() => router.push('/profile/shoes')} />
      </View>

      <SectionLabel>Assinatura e recursos</SectionLabel>
      <View style={styles.group}>
        <ProfileRow icon="flash-outline" label="RunEvo+" onPress={() => router.push('/runevo-plus')} />
        <ProfileRow icon="grid-outline" label="Meus recursos" onPress={() => router.push('/runevo-plus/resources')} />
      </View>

      <SectionLabel>Minhas preferências</SectionLabel>
      <View style={styles.group}>
        <ProfileRow icon="settings-outline" label="Geral" onPress={() => ComingSoon('Configurações gerais')} />
        <ProfileRow icon="help-circle-outline" label="Suporte" onPress={() => ComingSoon('Suporte')} />
      </View>

      <SectionLabel>Conta</SectionLabel>
      <View style={styles.group}>
        <ProfileRow icon="trash-outline" label="Excluir conta" onPress={handleDeleteAccount} destructive />
      </View>

      <View style={styles.signOutButton}>
        <NeonButton label={deleting ? 'Excluindo…' : 'Sair'} variant="secondary" onPress={() => void signOut()} disabled={deleting} />
      </View>

      <View style={styles.legal}>
        <Text style={styles.legalLink} onPress={() => ComingSoon('Termos e condições')}>Termos e condições</Text>
        <Text style={styles.legalLink} onPress={() => ComingSoon('Política de privacidade')}>Política de privacidade</Text>
        <Text style={styles.version}>versão RunEvo v{Constants.expoConfig?.version ?? '-'}</Text>
      </View>
    </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  avatarSection: { alignItems: 'center', marginBottom: spacing.xl },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 999,
    backgroundColor: colors.cardElevated,
    borderWidth: 2,
    borderColor: colors.neon,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarLetter: { color: colors.neon, fontSize: fontSizes.title, ...fontWeight('900') },
  name: { color: colors.textPrimary, fontSize: fontSizes.xl, ...fontWeight('800') },
  joined: { color: colors.textSecondary, fontSize: fontSizes.body, marginTop: spacing.xs, marginBottom: spacing.lg },
  editButton: { minWidth: 180 },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  infoLabel: { color: colors.textMuted, fontSize: fontSizes.caption, ...fontWeight('700'), letterSpacing: 0.5, marginBottom: spacing.xs },
  infoValue: { color: colors.textPrimary, fontSize: fontSizes.lg, ...fontWeight('800') },
  sectionLabel: {
    color: colors.neon,
    fontSize: fontSizes.caption,
    ...fontWeight('800'),
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  group: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexShrink: 1 },
  rowLabel: { color: colors.textPrimary, fontSize: fontSizes.body, flexShrink: 1 },
  rowLabelDestructive: { color: colors.error },
  signOutButton: { marginTop: spacing.xl },
  legal: { alignItems: 'center', marginTop: spacing.xl, gap: spacing.sm },
  legalLink: { color: colors.textSecondary, fontSize: fontSizes.caption, ...fontWeight('700'), letterSpacing: 0.5 },
  version: { color: colors.textMuted, fontSize: fontSizes.caption, marginTop: spacing.sm },
});
