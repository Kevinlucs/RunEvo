import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '@/theme';

/** Splash/gate. A navegação real é decidida no _layout raiz. */
export default function Index(): JSX.Element {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.neon} size="large" />
    </View>
  );
}
const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
});
