import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { colors, spacing, fontWeight, fontSizes } from '@/theme';
import { formatDuration, formatLongDate } from '@/utils/time';
import { parseTimeToSeconds } from '@/services/gamification/compute';

interface RecordHexagonProps {
  /** Chave do recorde — seleciona a arte PNG (assets/rp/RP-N.png) */
  recordKey: string;
  /** Nome descritivo embaixo (ex.: "5 km", "Meia maratona") */
  name: string;
  /** Tempo do recorde ("MM:SS"/"HH:MM:SS") — undefined = estado vazio */
  time?: string;
  /** Data do recorde (ISO "YYYY-MM-DD") */
  date?: string;
  /** Tamanho do hexágono em pontos (default 96) */
  size?: number;
}

/**
 * Hexágono de recorde pessoal — arte 3D/brilhante (PNG em assets/rp).
 * A arte é SEMPRE renderizada — sem tempo ela aparece opaca (40%) para
 * indicar que ainda não foi conquistada, mas mantém a identidade visual.
 * Abaixo: nome, tempo amigável e data.
 */
export function RecordHexagon({
  recordKey,
  name,
  time,
  date,
  size = 96,
}: RecordHexagonProps): JSX.Element {
  const styles = createStyles(size);
  const hasRecord = Boolean(time);

  const art = ART_BY_KEY[recordKey];
  const friendlyTime = hasRecord ? formatDuration(parseTimeToSeconds(time!)) : null;
  const longDate = date ? formatLongDate(date) : null;

  return (
    <View style={styles.container}>
      <Image
        source={art}
        style={[styles.image, !hasRecord && styles.imageLocked]}
        contentFit="contain"
        alt={`Recorde de ${name}`}
        accessibilityRole="image"
        accessibilityLabel={`Recorde de ${name}${hasRecord ? '' : ' — não registrado'}`}
      />

      {/* Legenda embaixo */}
      <Text style={[styles.name, !hasRecord && styles.nameLocked]} numberOfLines={1}>
        {name}
      </Text>
      {hasRecord && <Text style={styles.time}>{friendlyTime}</Text>}
      {longDate && <Text style={styles.date}>{longDate}</Text>}
    </View>
  );
}

/**
 * Mapa estático key → arte PNG do recorde.
 * `require` precisa ser literal (Metro não resolve caminho dinâmico).
 * Ordem em PERSONAL_RECORDS: 1k(1) → 1mi(2) → 2mi(3) → 5k(4) → 5mi(5) →
 * 10k(6) → 10mi(7) → half(8) → marathon(9) → 50k(10) → 100k(11).
 */
export const ART_BY_KEY: Record<string, number> = {
  '1k': require('../../../assets/rp/RP-1.png'),
  '1mi': require('../../../assets/rp/RP-2.png'),
  '2mi': require('../../../assets/rp/RP-3.png'),
  '5k': require('../../../assets/rp/RP-4.png'),
  '5mi': require('../../../assets/rp/RP-5.png'),
  '10k': require('../../../assets/rp/RP-6.png'),
  '10mi': require('../../../assets/rp/RP-7.png'),
  half: require('../../../assets/rp/RP-8.png'),
  marathon: require('../../../assets/rp/RP-9.png'),
  '50k': require('../../../assets/rp/RP-10.png'),
  '100k': require('../../../assets/rp/RP-11.png'),
};

function createStyles(size: number) {
  return StyleSheet.create({
    container: {
      alignItems: 'center',
    },
    image: {
      width: size,
      height: size,
    },
    /** Sem recorde: arte visível, mas desaturada/escurecida via opacidade */
    imageLocked: {
      opacity: 0.4,
    },
    name: {
      color: colors.textPrimary,
      ...fontWeight('700'),
      fontSize: fontSizes.caption,
      marginTop: spacing.sm,
    },
    nameLocked: {
      color: colors.textMuted,
    },
    time: {
      color: colors.textSecondary,
      ...fontWeight('600'),
      fontSize: fontSizes.caption,
      marginTop: 2,
    },
    date: {
      color: colors.textMuted,
      ...fontWeight('400'),
      fontSize: fontSizes.caption - 1,
      marginTop: 1,
    },
  });
}
