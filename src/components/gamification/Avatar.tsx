import { View, Text, StyleSheet } from 'react-native';
import { colors, fontWeight } from '@/theme';

interface AvatarProps {
  /** Tamanho do avatar em pontos (40, 88, etc.) */
  size: number;
  /** Letra inicial ou abreviação a exibir */
  initial: string;
  /** Se ativada, mostra anel colorido do nível ao redor do avatar */
  levelFrameEnabled?: boolean;
  /** Cor do nível (ex.: '#FFD700' para Amarelo) */
  levelColor?: string;
  /** Número do nível (1-7) para exibir no badge */
  levelNumber?: number;
}

/**
 * Avatar reutilizável — círculo com inicial, opcionalmente com moldura de nível.
 * Uso: AppHeader (size 40, sem moldura), Profile (size 88, moldura opcional).
 *
 * Quando levelFrameEnabled=true:
 * - desenha anel SVG colorido ao redor
 * - badge com número do nível no canto inferior direito
 */
export function Avatar({ size, initial, levelFrameEnabled, levelColor, levelNumber }: AvatarProps): JSX.Element {
  const styles = createStyles(size);
  const frameWidth = size * 0.08; // Anel ~8% da dimensão
  const badgeSize = size * 0.28; // Badge ~28% da dimensão

  return (
    <View style={{ width: size, height: size }}>
      {/* Anel de nível (SVG) — background do avatar aparece de trás */}
      {levelFrameEnabled && levelColor && (
        <View
          style={[
            {
              position: 'absolute',
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: frameWidth,
              borderColor: levelColor,
              opacity: 0.8,
              zIndex: 0,
            },
          ]}
        />
      )}

      {/* Círculo do avatar (centro) */}
      <View style={styles.container}>
        <Text style={styles.text}>{initial}</Text>
      </View>

      {/* Badge com número do nível (canto inferior direito) */}
      {levelFrameEnabled && levelNumber !== undefined && (
        <View
          style={[
            styles.badge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
              backgroundColor: levelColor,
            },
          ]}
        >
          <Text style={styles.badgeText}>{levelNumber}</Text>
        </View>
      )}
    </View>
  );
}

function createStyles(size: number) {
  return StyleSheet.create({
    container: {
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: colors.cardElevated,
      borderWidth: 2,
      borderColor: colors.neon,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1,
    },
    text: {
      color: colors.neon,
      ...fontWeight('900'),
      fontSize: size * 0.4,
      lineHeight: size * 0.4 * 1.2,
    },
    badge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.bg,
      zIndex: 2,
    },
    badgeText: {
      color: colors.bg,
      ...fontWeight('900'),
      fontSize: size * 0.16,
      lineHeight: size * 0.16 * 1.1,
    },
  });
}
