import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Sprout, Activity, Flame, Crown } from 'lucide-react-native';
import { colors, spacing, radii, fontSizes, fontWeight } from '@/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const LEVELS = [
  {
    icon: <Sprout size={20} color={colors.neon} />,
    title: 'Iniciante',
    desc: 'Você consegue concluir uma corrida de 5 km sem parar, em menos de 60 minutos',
  },
  {
    icon: <Activity size={20} color={colors.neon} />,
    title: 'Intermediário',
    desc: 'Você corre pelo menos 5 km regularmente, mas não estrutura seu treinamento nem elabora um plano',
  },
  {
    icon: <Flame size={20} color={colors.neon} />,
    title: 'Avançado',
    desc: 'Você corre pelo menos 10 km regularmente e realiza alguns treinos estruturados, como os de intervalos',
  },
  {
    icon: <Crown size={20} color={colors.neon} />,
    title: 'Elite',
    desc: 'Você corre meias maratonas ou mais regularmente e tem experiência com treinamento estruturado, como os de intervalos',
  },
];

export function LevelInfoModal({ visible, onClose }: Props): JSX.Element {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>Níveis de experiência</Text>
            <Text style={styles.subtitle}>Escolha o nível que mais se aproxima do seu momento atual</Text>

            {LEVELS.map((level) => (
              <View key={level.title} style={styles.levelRow}>
                <View style={styles.iconCircle}>{level.icon}</View>
                <View style={styles.levelContent}>
                  <Text style={styles.levelTitle}>{level.title}</Text>
                  <Text style={styles.levelDesc}>{level.desc}</Text>
                </View>
              </View>
            ))}
          </ScrollView>

          <Pressable style={styles.closeBtn} onPress={onClose} accessibilityRole="button">
            <Text style={styles.closeBtnText}>Entendi</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 },
  sheet: { backgroundColor: colors.card, borderRadius: 20, padding: spacing.xl, width: '100%', maxHeight: '80%' },
  title: { color: colors.textPrimary, fontSize: 20, ...fontWeight('800'), textAlign: 'center', marginBottom: spacing.xs },
  subtitle: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: spacing.xl },
  levelRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.lg },
  iconCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(204,255,0,0.1)',
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.md,
  },
  levelContent: { flex: 1 },
  levelTitle: { color: colors.neon, fontSize: 16, ...fontWeight('700'), marginBottom: 4 },
  levelDesc: { color: colors.textSecondary, fontSize: 13, lineHeight: 18 },
  closeBtn: { height: 52, backgroundColor: '#2A2A2A', borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg },
  closeBtnText: { color: colors.textPrimary, fontSize: fontSizes.base, ...fontWeight('600') },
});
