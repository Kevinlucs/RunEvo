import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { PostWorkoutCheckinModal } from '@/components/home/PostWorkoutCheckinModal';
import { useWorkout } from '@/hooks/useWorkout';
import { colors, fontSizes, fontWeight } from '@/theme';

/**
 * Rota do deep link `runevo://workout-checkin?id={id}`.
 * O modal é compartilhado com a Home; assim uma notificação e o card interno
 * abrem exatamente o mesmo fluxo e o estado continua pendente até finalizar.
 */
export default function WorkoutCheckinRoute(): JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { workout, isLoading } = useWorkout(id);

  useEffect(() => {
    if (!isLoading && !workout) router.replace('/(tabs)');
  }, [isLoading, workout]);

  if (isLoading || !workout) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={colors.neon} />
        <Text style={styles.loading}>Abrindo check-in…</Text>
      </View>
    );
  }

  return (
    <View style={styles.center}>
      <Stack.Screen options={{ headerShown: false }} />
      <PostWorkoutCheckinModal
        visible
        workout={workout}
        onClose={() => router.back()}
        onCompleted={() => router.replace('/(tabs)')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  loading: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    ...fontWeight('500'),
    marginTop: 12,
  },
});
