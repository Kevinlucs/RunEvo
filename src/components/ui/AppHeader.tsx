import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEntitlement } from '@/hooks/useEntitlement';
import { useAuth } from '@/hooks/useAuth';
import { colors, spacing, fontWeight } from '@/theme';

// Proporção própria por variante — os dois arquivos não têm o mesmo aspect
// ratio entre si (marca vs. marca+selo "plus"), então um único valor
// compartilhado deixaria uma das duas com espaço vazio nas laterais.
const LOGO_ASPECT_RATIO = 2000 / 1000;
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
          style={{ height: LOGO_HEIGHT, width: LOGO_HEIGHT * LOGO_ASPECT_RATIO, alignSelf: 'center' }}
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
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  logo: { height: LOGO_HEIGHT, alignSelf: 'center', marginBottom: -20 },
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
  avatarText: { color: colors.neon, ...fontWeight('900'), fontSize: 18, lineHeight: 40 },
  divider: {
    height: 0.8,
    backgroundColor: colors.neon,
    opacity: 0.2,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
});
