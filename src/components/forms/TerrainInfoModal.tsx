import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Route, Waves, TrendingUp, MountainSnow } from 'lucide-react-native';
import { colors, spacing, radii, fontSizes, fontWeight } from '@/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const TERRAINS = [
  {
    icon: <Route size={20} color={colors.neon} />,
    title: 'Plano',
    desc: 'Nenhum treino com subidas como parte do seu treinamento. Recomendado se você tiver menos de 5 m/km de ganho de elevação para a sua prova.',
  },
  {
    icon: <Waves size={20} color={colors.neon} />,
    title: 'Ondulado',
    desc: 'Alguns treinos com subidas como parte do seu treinamento. Recomendado se você tiver entre 5 m/km e 10 m/km de ganho de elevação para a sua prova.',
  },
  {
    icon: <TrendingUp size={20} color={colors.neon} />,
    title: 'Moderado',
    desc: 'Mais treinos com subidas como parte do seu treinamento. Recomendado se você tiver entre 10 m/km e 20 m/km de ganho de elevação para a sua prova.',
  },
  {
    icon: <MountainSnow size={20} color={colors.neon} />,
    title: 'Montanhoso',
    desc: 'Muitos treinos com subidas como parte do seu treinamento. Recomendado se você tiver mais de 20 m/km de ganho de elevação para a sua prova.',
  },
];

export function TerrainInfoModal({ visible, onClose }: Props): JSX.Element {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>Tipos de terreno</Text>
            <Text style={styles.subtitle}>Escolha com base no ganho de elevação da sua prova</Text>

            {TERRAINS.map((terrain) => (
              <View key={terrain.title} style={styles.terrainRow}>
                <View style={styles.iconCircle}>{terrain.icon}</View>
                <View style={styles.terrainContent}>
                  <Text style={styles.terrainTitle}>{terrain.title}</Text>
                  <Text style={styles.terrainDesc}>{terrain.desc}</Text>
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
  terrainRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.lg },
  iconCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(204,255,0,0.1)',
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.md,
  },
  terrainContent: { flex: 1 },
  terrainTitle: { color: colors.neon, fontSize: 16, ...fontWeight('700'), marginBottom: 4 },
  terrainDesc: { color: colors.textSecondary, fontSize: 13, lineHeight: 18 },
  closeBtn: { height: 52, backgroundColor: '#2A2A2A', borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg },
  closeBtnText: { color: colors.textPrimary, fontSize: fontSizes.base, ...fontWeight('600') },
});
