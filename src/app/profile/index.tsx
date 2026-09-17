import { useMemo, useState, type ComponentProps } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { Screen } from '@/components/ui/Screen';
import { LevelShield } from '@/components/gamification';
import { useAuth } from '@/hooks/useAuth';
import { useAthleteProfile } from '@/hooks/useAthleteProfile';
import { useLifetimeStats } from '@/hooks/useLifetimeStats';
import { computeLevel } from '@/services/gamification/compute';
import { RUN_LEVELS } from '@/services/gamification/constants';
import { formatMonthYear } from '@/utils/time';
import { colors, fontSizes, fontWeight, radii, spacing } from '@/theme';

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
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={22} color={destructive ? colors.error : colors.textPrimary} />
        <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
    </Pressable>
  );
}

function SectionLabel({ children }: { children: string }): JSX.Element {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

/** Central de conta: itens, preferências e progresso de nível do atleta. */
export default function Profile(): JSX.Element {
  const { session, user, signOut, deleteAccount } = useAuth();
  const { profile } = useAthleteProfile(user?.id);
  const { stats: lifetimeStats } = useLifetimeStats();
  const [deleting, setDeleting] = useState(false);

  const name = profile?.display_name || session?.user.email?.split('@')[0] || 'Atleta';
  const initial = name.charAt(0).toUpperCase();
  const joinedAt = formatMonthYear(user?.created_at ?? null);
  const currentLevel = computeLevel(lifetimeStats.totalKm);
  const levelIndex = RUN_LEVELS.findIndex((level) => level.key === currentLevel.key);
  const levelPreview = useMemo(() => {
    const start = Math.min(Math.max(0, levelIndex - 1), RUN_LEVELS.length - 3);
    return RUN_LEVELS.slice(start, start + 3);
  }, [levelIndex]);

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
                      const result = await deleteAccount();
                      setDeleting(false);
                      if (!result.ok) {
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Editar perfil"
            onPress={() => router.push('/profile/edit')}
            style={({ pressed }) => [styles.editButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.editButtonLabel}>EDITAR PERFIL</Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Abrir níveis"
          onPress={() => router.push('/stats/levels')}
          style={({ pressed }) => [styles.levelCard, pressed && styles.rowPressed]}
        >
          <View style={styles.shields}>
            {levelPreview.map((level, index) => (
              <View
                key={level.key}
                style={[
                  styles.shield,
                  index === 1 && styles.shieldMiddle,
                  index === 2 && styles.shieldLast,
                ]}
              >
                <LevelShield
                  level={level}
                  size={58}
                  opacity={index === levelPreview.length - 1 ? 0.74 : 1}
                />
              </View>
            ))}
          </View>
          <View style={styles.levelContent}>
            <Text style={styles.levelTitle}>Níveis</Text>
            <Text style={styles.levelDescription}>Ganhe pontos. Alcance suas metas.</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
        </Pressable>

        <SectionLabel>Meus itens</SectionLabel>
        <View style={styles.group}>
          <ProfileRow
            icon="apps-outline"
            label="Aplicativos e dispositivos conectados"
            onPress={() => router.push('/profile/connected-apps')}
          />
          <ProfileRow
            icon="footsteps-outline"
            label="Tênis"
            onPress={() => router.push('/profile/shoes')}
          />
          <ProfileRow
            icon="lock-closed-outline"
            label="RUNEVO+"
            onPress={() => router.push('/runevo-plus')}
          />
        </View>

        <SectionLabel>Minhas preferências</SectionLabel>
        <View style={styles.group}>
          <ProfileRow
            icon="notifications-outline"
            label="Notificações"
            onPress={() => ComingSoon('Notificações')}
          />
          <ProfileRow
            icon="heart-outline"
            label="Zonas de frequência cardíaca"
            onPress={() => ComingSoon('Zonas de frequência cardíaca')}
          />
          <ProfileRow icon="ticket-outline" label="Suporte" onPress={() => ComingSoon('Suporte')} />
        </View>

        <SectionLabel>Conta</SectionLabel>
        <View style={styles.group}>
          <ProfileRow
            icon="trash-outline"
            label="Excluir conta"
            onPress={handleDeleteAccount}
            destructive
          />
        </View>

        <View style={styles.divider} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sair da conta"
          disabled={deleting}
          onPress={() => void signOut()}
          style={({ pressed }) => [
            styles.signOutButton,
            pressed && styles.buttonPressed,
            deleting && styles.disabled,
          ]}
        >
          <Ionicons name="log-out-outline" size={28} color={colors.cardElevated} />
          <Text style={styles.signOutLabel}>{deleting ? 'EXCLUINDO…' : 'SAIR'}</Text>
        </Pressable>
        <View style={styles.divider} />

        <View style={styles.legal}>
          <Text style={styles.legalLink} onPress={() => ComingSoon('Termos e condições')}>
            TERMOS E CONDIÇÕES
          </Text>
          <Text style={styles.legalLink} onPress={() => ComingSoon('Política de privacidade')}>
            POLÍTICA DE PRIVACIDADE
          </Text>
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
    borderRadius: radii.pill,
    backgroundColor: colors.cardElevated,
    borderWidth: 2,
    borderColor: colors.neon,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarLetter: { color: colors.neon, fontSize: fontSizes.title, ...fontWeight('900') },
  name: { color: colors.textPrimary, fontSize: fontSizes.xl, ...fontWeight('800') },
  joined: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  editButton: {
    minHeight: 46,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.pill,
    justifyContent: 'center',
    backgroundColor: '#E6ECF5',
  },
  editButtonLabel: {
    color: colors.cardElevated,
    fontSize: fontSizes.caption,
    ...fontWeight('800'),
  },
  levelCard: {
    minHeight: 106,
    backgroundColor: colors.cardElevated,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: '#3A4353',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  shields: { width: 112, height: 72, justifyContent: 'center' },
  shield: { position: 'absolute', left: 0 },
  shieldMiddle: { left: 27, zIndex: 1 },
  shieldLast: { left: 54, zIndex: 2 },
  levelContent: { flex: 1, paddingLeft: spacing.xs },
  levelTitle: { color: colors.textPrimary, fontSize: fontSizes.xl, ...fontWeight('800') },
  levelDescription: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    marginTop: spacing.xs,
    lineHeight: 17,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    ...fontWeight('700'),
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    marginLeft: spacing.md,
  },
  group: {
    backgroundColor: colors.cardElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#3A4353',
    overflow: 'hidden',
    marginBottom: spacing.xl,
  },
  row: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#343B47',
  },
  rowPressed: { opacity: 0.74 },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
    marginRight: spacing.sm,
  },
  rowLabel: { color: colors.textPrimary, fontSize: fontSizes.base, flexShrink: 1 },
  rowLabelDestructive: { color: colors.error },
  divider: { height: 1, backgroundColor: '#3A4353', marginVertical: spacing.xl },
  signOutButton: {
    minHeight: 64,
    borderRadius: radii.pill,
    backgroundColor: '#E6ECF5',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  signOutLabel: { color: colors.cardElevated, fontSize: fontSizes.lg, ...fontWeight('800') },
  buttonPressed: { opacity: 0.78 },
  disabled: { opacity: 0.5 },
  legal: { alignItems: 'center', gap: spacing.xl, paddingBottom: spacing.xl },
  legalLink: { color: '#E6ECF5', fontSize: fontSizes.base, ...fontWeight('800') },
  version: {
    color: '#657087',
    fontSize: fontSizes.body,
    ...fontWeight('700'),
    marginTop: spacing.sm,
  },
});
