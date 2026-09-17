import type { ImageSourcePropType } from 'react-native';

/**
 * Badge PNG de cada distância.
 * Chave = PersonalRecord.key (ex.: '1k', 'half', 'marathon').
 * Os PNGs já trazem cor e texto embutidos — são a arte final.
 */
export const RECORD_BADGES: Record<string, ImageSourcePropType> = {
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