import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import type { RunLevel } from '@/services/gamification/constants';

interface LevelShieldProps {
  /** Nível — define qual escudo (arte PNG) renderizar */
  level: RunLevel;
  /** Tamanho (largura) em pontos (ex.: 64 para escudo pequeno, 100 para grande) */
  size: number;
  /** Opacidade (1 = sólido, 0.45 = bloqueado/futuro) */
  opacity?: number;
}

/**
 * Escudo do nível — renderiza a arte PNG correspondente (assets/niveis/Nivel-N.png).
 * Cada nível tem sua própria arte (forma + cor + ícone do corredor).
 * Proporção do escudo ≈ 0.85 (largura/altura).
 */
export function LevelShield({ level, size, opacity = 1 }: LevelShieldProps): JSX.Element {
  const width = size;
  const height = size / 0.85; // mesma proporção da arte
  const styles = createStyles(width, height);

  return (
    <View style={[styles.container, { opacity }]}>
      <Image
        source={SHIELD_BY_KEY[level.key]}
        style={styles.image}
        contentFit="contain"
        alt={`Escudo do nível ${level.name}`}
        accessibilityRole="image"
        accessibilityLabel={`Nível ${level.name}`}
      />
    </View>
  );
}

/**
 * Mapa estático key → arte do escudo.
 * `require` precisa ser literal (Metro não resolve caminho dinâmico).
 * Ordem em RUN_LEVELS: amarelo(1) → laranja(2) → verde(3) → azul(4) → roxo(5) → preto(6) → verde-limao(7).
 */
const SHIELD_BY_KEY: Record<RunLevel['key'], number> = {
  amarelo: require('../../../assets/niveis/Nivel-1.png'),
  laranja: require('../../../assets/niveis/Nivel-2.png'),
  verde: require('../../../assets/niveis/Nivel-3.png'),
  azul: require('../../../assets/niveis/Nivel-4.png'),
  roxo: require('../../../assets/niveis/Nivel-5.png'),
  preto: require('../../../assets/niveis/Nivel-6.png'),
  'verde-limao': require('../../../assets/niveis/Nivel-7.png'),
};

function createStyles(width: number, height: number) {
  return StyleSheet.create({
    container: {
      width,
      height,
      alignItems: 'center',
      justifyContent: 'center',
    },
    image: {
      width: '100%',
      height: '100%',
    },
  });
}
