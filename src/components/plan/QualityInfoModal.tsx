import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { colors, spacing, radii, fontSizes, fontWeight } from '@/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

/**
 * Explica a diferença entre Quality Score (qualidade da CONSTRUÇÃO do plano) e
 * Risco técnico (exigência do desafio para o perfil atual) — os dois indicadores
 * do card "Qualidade técnica" da prévia. Sem essa distinção, um Score alto com
 * Risco alto parece contradição.
 */
export function QualityInfoModal({ visible, onClose }: Props): JSX.Element {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>Quality Score e Risco técnico</Text>

            <View style={styles.block}>
              <Text style={styles.blockTitle}>Quality Score</Text>
              <Text style={styles.blockText}>
                Mede a qualidade da construção do plano: se a progressão de volume, as semanas de recuperação e os paces
                estão coerentes entre si. Nota alta significa que o plano foi bem montado.
              </Text>
            </View>

            <View style={styles.block}>
              <Text style={styles.blockTitle}>Risco técnico</Text>
              <Text style={styles.blockText}>
                Mede o quanto o desafio é exigente para o seu perfil atual (prazo, volume, IMC, dias disponíveis). Risco
                alto não quer dizer plano mal feito — quer dizer que exige mais atenção, disciplina e recuperação.
              </Text>
            </View>

            <View style={styles.noteBox}>
              <Text style={styles.noteText}>
                Por isso é possível ter Quality Score alto e Risco técnico alto ao mesmo tempo: o plano está bem
                construído, mas o objetivo é ambicioso para o momento.
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
  block: { marginBottom: spacing.lg },
  blockTitle: { color: colors.neon, fontSize: 16, ...fontWeight('700'), marginBottom: spacing.xs },
  blockText: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  noteBox: {
    backgroundColor: 'rgba(204,255,0,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(204,255,0,0.2)',
    padding: spacing.lg,
  },
  noteText: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
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
