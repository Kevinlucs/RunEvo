import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { NeonButton } from '@/components/ui/NeonButton';
import { AlertModal } from '@/components/ui/AlertModal';
import { colors, fontSizes, fontWeight, radii, spacing } from '@/theme';
import {
  disconnectGarmin,
  getGarminStatus,
  startGarminConnection,
  type GarminConnectionStatus,
} from '@/services/integrations/connected-accounts.service';

export default function GarminScreen(): JSX.Element {
  const [status, setStatus] = useState<GarminConnectionStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'info' as 'success' | 'error' | 'info',
  });

  const refreshStatus = useCallback(async (): Promise<void> => {
    setChecking(true);
    const result = await getGarminStatus();
    if (result.ok) setStatus(result.value);
    else setStatus({ connected: false, status: 'disconnected', lastError: null, devices: [] });
    setChecking(false);
  }, []);

  useEffect(() => { void refreshStatus(); }, [refreshStatus]);
  // Ao retornar do browser protegido do gateway, consulta novamente o backend.
  useFocusEffect(useCallback(() => { void refreshStatus(); }, [refreshStatus]));

  const closeAlert = (): void => setAlertConfig((previous) => ({ ...previous, visible: false }));

  const handleConnect = async (): Promise<void> => {
    setLoading(true);
    const result = await startGarminConnection();
    setLoading(false);
    if (!result.ok) {
      setAlertConfig({
        visible: true,
        title: 'Conexão indisponível',
        message: result.error.message,
        type: 'error',
      });
      return;
    }
    try {
      await Linking.openURL(result.value.connectUrl);
    } catch {
      setAlertConfig({
        visible: true,
        title: 'Não foi possível abrir a conexão',
        message: 'Tente novamente em alguns instantes.',
        type: 'error',
      });
    }
  };

  const handleDisconnect = async (): Promise<void> => {
    setLoading(true);
    const result = await disconnectGarmin();
    setLoading(false);
    if (!result.ok) {
      setAlertConfig({ visible: true, title: 'Não foi possível desconectar', message: result.error.message, type: 'error' });
      return;
    }
    setStatus({ connected: false, status: 'disconnected', lastError: null, devices: [] });
    setAlertConfig({
      visible: true,
      title: 'Relógio desconectado',
      message: 'A conexão com o Garmin foi removida deste dispositivo.',
      type: 'success',
    });
  };

  if (checking && !status) {
    return <Screen><View style={styles.center}><ActivityIndicator size="large" color={colors.neon} /></View></Screen>;
  }

  const connected = Boolean(status?.connected);
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.heroIcon}><Ionicons name="watch-outline" size={32} color={colors.neon} /></View>
        <Text style={styles.title}>Garmin Connect</Text>
        <Text style={styles.subtitle}>
          Envie os treinos estruturados do RunEvo para o Garmin Connect e seu relógio.
        </Text>

        {connected ? (
          <View style={styles.card}>
            <View style={styles.statusRow}>
              <View style={styles.successIcon}><Ionicons name="checkmark" size={28} color={colors.neon} /></View>
              <View style={styles.statusCopy}>
                <Text style={styles.connectedTitle}>Conta conectada</Text>
                <Text style={styles.connectedSubtitle}>Pronta para receber seus treinos.</Text>
              </View>
            </View>

            {status?.devices.length ? (
              <View style={styles.devices}>
                <Text style={styles.devicesTitle}>DISPOSITIVOS CONECTADOS</Text>
                {status.devices.map((device) => (
                  <View key={device.id} style={styles.deviceRow}>
                    <Ionicons name="watch-outline" size={22} color={colors.textPrimary} />
                    <View style={styles.deviceCopy}>
                      <Text style={styles.deviceName}>{device.name}</Text>
                      <Text style={styles.deviceMeta}>{device.type}</Text>
                    </View>
                    <View style={styles.connectedDot} accessibilityLabel="Dispositivo conectado" />
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.noDevice}>Nenhum dispositivo Garmin elegível foi encontrado nesta conta.</Text>
            )}
            <NeonButton label={loading ? 'Desconectando...' : 'Desconectar'} onPress={handleDisconnect} disabled={loading} variant="secondary" />
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Conecte seu Garmin</Text>
            <Text style={styles.cardText}>
              A autenticação será aberta em uma página segura. Seu e-mail, senha e tokens Garmin não passam pelo app.
            </Text>
            <NeonButton label={loading ? 'Abrindo...' : 'Conectar Garmin'} onPress={handleConnect} disabled={loading} variant="garmin" />
          </View>
        )}
      </ScrollView>
      <AlertModal visible={alertConfig.visible} title={alertConfig.title} message={alertConfig.message} type={alertConfig.type} primaryAction={closeAlert} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { paddingTop: spacing.xl, paddingBottom: spacing.xxxl },
  heroIcon: { width: 72, height: 72, borderRadius: radii.xl, backgroundColor: colors.neonMuted, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: spacing.lg },
  title: { color: colors.textPrimary, fontSize: fontSizes.title, ...fontWeight('800'), textAlign: 'center' },
  subtitle: { color: colors.textSecondary, fontSize: fontSizes.body, lineHeight: 22, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.xl, paddingHorizontal: spacing.md },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.lg },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  successIcon: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.neonMuted, alignItems: 'center', justifyContent: 'center' },
  statusCopy: { flex: 1 },
  connectedTitle: { color: colors.neon, fontSize: fontSizes.lg, ...fontWeight('800') },
  connectedSubtitle: { color: colors.textSecondary, fontSize: fontSizes.caption, marginTop: 2 },
  devices: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md, gap: spacing.sm },
  devicesTitle: { color: colors.textMuted, fontSize: 11, letterSpacing: .8, ...fontWeight('800') },
  deviceRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.cardElevated, paddingHorizontal: spacing.md, borderRadius: radii.md },
  deviceCopy: { flex: 1 },
  deviceName: { color: colors.textPrimary, fontSize: fontSizes.body, ...fontWeight('700') },
  deviceMeta: { color: colors.textMuted, fontSize: fontSizes.caption },
  connectedDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.success },
  noDevice: { color: colors.textMuted, lineHeight: 20, fontSize: fontSizes.caption },
  cardTitle: { color: colors.textPrimary, fontSize: fontSizes.lg, ...fontWeight('800') },
  cardText: { color: colors.textSecondary, fontSize: fontSizes.body, lineHeight: 22 },
});


