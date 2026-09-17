import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, radii, spacing, fontSizes, fontWeight } from '@/theme';
import { Ionicons } from '@expo/vector-icons';
import { NeonButton } from './NeonButton';

type AlertModalProps = {
  visible: boolean;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'info';
  primaryActionLabel?: string;
  primaryAction?: () => void;
  secondaryActionLabel?: string;
  secondaryAction?: () => void;
};

export function AlertModal({ 
  visible, 
  title, 
  message, 
  type = 'info',
  primaryActionLabel = 'OK',
  primaryAction,
  secondaryActionLabel,
  secondaryAction 
}: AlertModalProps): JSX.Element {
  const getIcon = () => {
    switch (type) {
      case 'success': return 'checkmark-circle-outline';
      case 'error': return 'close-circle-outline';
      default: return 'information-circle-outline';
    }
  };

  const getIconColor = () => {
    switch (type) {
      case 'success': return colors.neon;
      case 'error': return '#ff4444';
      default: return '#007CC3';
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={primaryAction}>
      <Pressable style={styles.overlay} onPress={primaryAction}>
        <Pressable style={styles.container} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Ionicons name={getIcon()} size={32} color={getIconColor()} style={{ marginBottom: spacing.sm }} />
            <Text style={styles.title}>{title}</Text>
          </View>
          <View style={styles.content}>
            <Text style={styles.message}>{message}</Text>
          </View>
          <View style={styles.footer}>
            {secondaryActionLabel && secondaryAction && (
              <View style={{ flex: 1, marginRight: spacing.sm }}>
                <NeonButton variant="secondary" label={secondaryActionLabel} onPress={secondaryAction} />
              </View>
            )}
            <View style={{ flex: 1, marginLeft: secondaryActionLabel ? spacing.sm : 0 }}>
              <NeonButton label={primaryActionLabel} onPress={primaryAction!} />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '85%',
    maxWidth: 340,
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSizes.lg,
    ...fontWeight('700'),
    color: colors.textPrimary,
    textAlign: 'center',
  },
  content: {
    marginBottom: spacing.xl,
  },
  message: {
    fontSize: fontSizes.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  footer: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
  },
});
