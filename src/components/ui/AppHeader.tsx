import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEntitlement } from '@/hooks/useEntitlement';
import { useAuth } from '@/hooks/useAuth';
import { colors, spacing, fontWeight } from '@/theme';

// Proporção própria por variante — os dois arquivos não têm o mesmo aspect
// ratio entre si (marca vs. marca+selo "plus"), então um único valor
// compartilhado deixaria uma das duas com espaço vazio nas laterais.
const LOGO_ASPECT_RATIO = 1849 / 1491;
const LOGO_PLUS_ASPECT_RATIO = 1930 / 789;
// Altura normalizada — ajustada para proporção visual idêntica ao mockup.
const LOGO_HEIGHT = 52;
const AVATAR_SIZE = 40;

/**
 * Header padrão das abas (docs/fase-4-brief.md Grupo 2.1, débito da Fase 1):
 * logo RunEvo à esquerda (RunEvo+ para assinante — lido do serviço de
 * entitlement, nunca decidido aqui) e avatar com aro neon à direita, abrindo
 * o Perfil. Usar dentro de <Screen> — a safe area de topo já vem de lá.
 * Linha neon horizontal fina embaixo (mockup referência).
 */
export function AppHeader(): JSX.Element {
  const { isPlus } = useEntitlement();
  const { user } = useAuth();
  const initial = user?.email?.charAt(0).toUpperCase() || 'R';

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Image
          source={isPlus ? require('../../../assets/logo-runevo-plus.png') : require('../../../assets/logo-runevo.png')}
          style={[styles.logo, { width: LOGO_HEIGHT * (isPlus ? LOGO_PLUS_ASPECT_RATIO : LOGO_ASPECT_RATIO) }]}
          contentFit="contain"
          accessibilityRole="image"
          accessibilityLabel={isPlus ? 'RunEvo+' : 'RunEvo'}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Abrir perfil"
          onPress={() => router.push('/profile')}
          style={styles.avatar}
          hitSlop={8}
        >
          <Text style={styles.avatarText}>{initial}</Text>
        </Pressable>
      </View>
      <View style={styles.divider} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  logo: { height: LOGO_HEIGHT, alignSelf: 'center' },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.cardElevated,
    borderWidth: 2,
    borderColor: colors.neon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.neon, ...fontWeight('900'), fontSize: 16 },
  divider: {
    height: 1,
    backgroundColor: colors.neon,
    opacity: 0.3,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
});
