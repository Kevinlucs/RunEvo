import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Screen, AppText } from '@/components/ui';
import { spacing } from '@/theme';

export function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <Screen>
      <View style={styles.wrap}>
        <AppText variant="heading">{title}</AppText>
        <AppText variant="muted" style={styles.note}>
          {note}
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', gap: spacing.sm },
  note: { lineHeight: 20 },
});
