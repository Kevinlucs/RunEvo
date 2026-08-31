import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { colors, spacing, radii, fontSizes, fontWeight } from '@/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function Test3kmInfoModal({ visible, onClose }: Props): JSX.Element {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>Como fazer o teste</Text>

            <View style={styles.stepRow}>
              <Text style={styles.stepNumber}>1.</Text>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Aquecimento</Text>
                <Text style={styles.stepDesc}>Faça um aquecimento leve de 10 a 15 minutos.</Text>
              </View>
            </View>

            <View style={styles.stepRow}>
              <Text style={styles.stepNumber}>2.</Text>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Corra 3 km</Text>
                <Text style={styles.stepDesc}>Em um ritmo forte e sustentável.</Text>
              </View>
            </View>

            <View style={styles.stepRow}>
              <Text style={styles.stepNumber}>3.</Text>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Constância</Text>
                <Text style={styles.stepDesc}>Tente manter o ritmo o mais constante possível.</Text>
              </View>
            </View>

            <View style={styles.stepRow}>
              <Text style={styles.stepNumber}>4.</Text>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Registre</Text>
                <Text style={styles.stepDesc}>Ao terminar, informe o tempo total dos 3 km.</Text>
              </View>
            </View>

            <View style={styles.noteBox}>
              <Text style={styles.noteTitle}>Dica importante</Text>
              <Text style={styles.noteText}>
                Não precisa correr o primeiro quilômetro no limite. O objetivo é terminar os 3 km o mais rápido que conseguir mantendo um esforço controlado.
              </Text>
            </View>
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
  title: { color: colors.neon, fontSize: 20, ...fontWeight('800'), textAlign: 'center', marginBottom: spacing.lg },
  stepRow: { flexDirection: 'row', marginBottom: spacing.md },
  stepNumber: { color: colors.neon, fontSize: 18, ...fontWeight('800'), marginRight: spacing.md, minWidth: 24 },
  stepContent: { flex: 1 },
  stepTitle: { color: colors.textPrimary, fontSize: 16, ...fontWeight('700'), marginBottom: spacing.xs },
  stepDesc: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  noteBox: {
    backgroundColor: 'rgba(204,255,0,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(204,255,0,0.2)',
    padding: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  noteTitle: { color: colors.neon, fontSize: 16, ...fontWeight('700'), marginBottom: spacing.xs },
  noteText: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  closeBtn: {
    height: 52,
    backgroundColor: '#2A2A2A',
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  closeBtnText: { color: colors.textPrimary, fontSize: fontSizes.base, ...fontWeight('600') },
});
