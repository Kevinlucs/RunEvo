import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useEntitlement } from '@/hooks/useEntitlement';
import { colors, spacing, fontWeight } from '@/theme';

const LOGO_ASPECT_RATIO = 1778 / 828;
const LOGO_HEIGHT = 28;

/**
 * Header padrão das abas (docs/fase-4-brief.md Grupo 2.1, débito da Fase 1):
 * logo RunEvo à esquerda (RunEvo+ para assinante — lido do serviço de
 * entitlement, nunca decidido aqui) e avatar com aro neon à direita, abrindo
 * o Perfil. Usar dentro de <Screen> — a safe area de topo já vem de lá.
 */
export function AppHeader(): JSX.Element {
  const { isPlus } = useEntitlement();

  return (
    <View style={styles.row}>
      <Image
        source={isPlus ? require('../../../assets/logo-runevo-plus.png') : require('../../../assets/logo-runevo.png')}
        style={styles.logo}
        resizeMode="contain"
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
        <Text style={styles.avatarText}>R</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  logo: { height: LOGO_HEIGHT, width: LOGO_HEIGHT * LOGO_ASPECT_RATIO },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: colors.cardElevated,
    borderWidth: 2,
    borderColor: colors.neon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.neon, ...fontWeight('900') },
});
