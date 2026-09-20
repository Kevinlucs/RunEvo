import { useCallback, useMemo, useState } from 'react';
import { Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { AlertModal } from '@/components/ui/AlertModal';
import { useConnectedAccounts } from '@/hooks/useConnectedAccounts';
import { startStravaConnection } from '@/services/integrations/connected-accounts.service';
import { colors, fontSizes, fontWeight, radii, spacing } from '@/theme';

interface StravaIntroModalProps {
  visible: boolean;
  connected: boolean;
  connecting: boolean;
  onClose: () => void;
  onConnect: () => void;
}

function StravaIntroModal({
  visible,
  connected,
  connecting,
  onClose,
  onConnect,
}: StravaIntroModalProps): JSX.Element {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.introModal}>
        <Pressable
          onPress={onClose}
          style={styles.closeIntro}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Fechar apresentação do Strava"
        >
          <Ionicons name="close" size={30} color={colors.textPrimary} />
        </Pressable>

        <View style={styles.introModalContent}>
          <Text style={styles.introTitle}>
            Sincronize suas corridas{'\n'}entre o RunEvo e o Strava
          </Text>

          <View style={styles.brandFlow}>
            <View style={styles.runevoLogoWrap}>
              <Image
                source={require('../../../assets/splash-icon.png')}
                style={styles.runevoLogo}
                contentFit="contain"
                accessibilityLabel="RunEvo"
              />
            </View>
            <View style={styles.flowDots} accessibilityElementsHidden>
              <View style={[styles.flowDot, styles.flowDotNeon]} />
              <View style={[styles.flowDot, styles.flowDotSoft]} />
              <View style={[styles.flowDot, styles.flowDotOrangeSoft]} />
              <View style={[styles.flowDot, styles.flowDotOrange]} />
            </View>
            <Image
              source={require('../../../assets/strava.png')}
              style={styles.stravaHeroLogo}
              contentFit="cover"
              accessibilityLabel="Strava"
            />
          </View>

          <View style={styles.benefits}>
            <View style={styles.benefit}>
              <Ionicons name="checkmark" size={21} color={colors.textSecondary} />
              <Text style={styles.benefitText}>
                Suas atividades do Strava chegam automaticamente ao RunEvo.
              </Text>
            </View>
            <View style={styles.benefit}>
              <Ionicons name="checkmark" size={21} color={colors.textSecondary} />
              <Text style={styles.benefitText}>
                Marcas e estatísticas ficam reunidas em um só lugar.
              </Text>
            </View>
            <View style={styles.benefit}>
              <Ionicons name="checkmark" size={21} color={colors.textSecondary} />
              <Text style={styles.benefitText}>
                Acompanhe sua evolução sem registrar a mesma corrida duas vezes.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.introActions}>
          {connected ? (
            <Pressable style={styles.closeIntroButton} onPress={onClose} accessibilityRole="button">
              <Text style={styles.closeIntroButtonText}>Entendi</Text>
            </Pressable>
          ) : (
            <>
              <Pressable
                style={({ pressed }) => [
                  styles.stravaConnectButton,
                  (pressed || connecting) && styles.stravaConnectButtonPressed,
                ]}
                onPress={onConnect}
                disabled={connecting}
                accessibilityRole="button"
              >
                <Text style={styles.stravaConnectButtonText}>
                  {connecting ? 'Abrindo Strava…' : 'Continuar com STRAVA'}
                </Text>
              </Pressable>
              <Pressable style={styles.notNowButton} onPress={onClose} disabled={connecting}>
                <Text style={styles.notNowText}>Agora não</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default function ConnectedAppsScreen(): JSX.Element {
  const { accounts, refresh } = useConnectedAccounts();
  const [showStravaIntro, setShowStravaIntro] = useState(false);
  const [showWatchInfo, setShowWatchInfo] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const strava = useMemo(
    () => accounts.find((account) => account.provider === 'strava'),
    [accounts],
  );
  const stravaConnected = strava?.status === 'connected';

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const connectStrava = async (): Promise<void> => {
    setConnecting(true);
    const result = await startStravaConnection();
    setConnecting(false);
    if (!result.ok) {
      Alert.alert(
        'Conexão indisponível',
        'O Strava ainda não foi configurado no servidor do RunEvo. Tente novamente mais tarde.',
      );
      return;
    }
    try {
      setShowStravaIntro(false);
      await Linking.openURL(result.value.authorizeUrl);
    } catch {
      Alert.alert('Não foi possível abrir o Strava', 'Tente novamente em alguns instantes.');
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          Conecte seus aplicativos favoritos para reunir suas corridas e acompanhar sua evolução em
          um só lugar.
        </Text>

        <Text style={styles.sectionTitle}>Aplicativos</Text>
        <Pressable
          style={({ pressed }) => [styles.connectionRow, pressed && styles.rowPressed]}
          onPress={() => setShowStravaIntro(true)}
          accessibilityRole="button"
          accessibilityLabel="Configurar conexão com Strava"
        >
          <Image
            source={require('../../../assets/strava.png')}
            style={styles.stravaMark}
            contentFit="cover"
            accessibilityLabel="Strava"
          />
          <Text style={styles.connectionLabel}>Strava</Text>
          <Ionicons name="information-circle-outline" size={21} color={colors.textSecondary} />
          {stravaConnected && (
            <View style={styles.connectedDot} accessibilityLabel="Strava conectado" />
          )}
          <Ionicons name="chevron-forward" size={25} color={colors.textMuted} />
        </Pressable>

        <Text style={styles.sectionTitle}>Relógios</Text>
        <View style={[styles.connectionRow, styles.watchComingSoonRow]}>
          <View style={styles.watchIcon}>
            <Ionicons name="watch-outline" size={25} color={colors.textPrimary} />
          </View>
          <View style={styles.watchCopy}>
            <Text style={styles.connectionLabel}>Em breve</Text>
            <Text style={styles.comingSoon}>Integrações com relógios</Text>
          </View>
          <Pressable
            onPress={() => setShowWatchInfo(true)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Saiba mais sobre integrações com relógios"
          >
            <Ionicons name="help-circle-outline" size={24} color={colors.neon} />
          </Pressable>
        </View>
        <Text style={styles.supported}>
          Estamos preparando integrações oficiais com Garmin, COROS, Polar e Amazfit.
        </Text>
      </ScrollView>

      <StravaIntroModal
        visible={showStravaIntro}
        connected={Boolean(stravaConnected)}
        connecting={connecting}
        onClose={() => setShowStravaIntro(false)}
        onConnect={() => void connectStrava()}
      />
      <AlertModal
        visible={showWatchInfo}
        title="Integrações em desenvolvimento"
        message="Estamos trabalhando para disponibilizar integrações oficiais e seguras com Garmin, COROS, Polar e Amazfit nas próximas atualizações do RunEvo."
        type="info"
        primaryAction={() => setShowWatchInfo(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.xxl, paddingBottom: spacing.xxxl },
  intro: {
    color: colors.textSecondary,
    fontSize: fontSizes.base,
    lineHeight: 24,
    marginBottom: spacing.xxxl,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    ...fontWeight('800'),
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginLeft: spacing.xs,
    marginBottom: spacing.sm,
  },
  connectionRow: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderColor: '#3A3E48',
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xxxl,
  },
  rowPressed: { opacity: 0.68 },
  stravaMark: { width: 32, height: 32, borderRadius: 16 },
  watchIcon: { width: 32, alignItems: 'center' },
  connectionLabel: { flex: 1, color: colors.textPrimary, fontSize: fontSizes.lg },
  connectedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  watchComingSoonRow: { marginBottom: spacing.sm },
  watchCopy: { flex: 1, gap: 2 },
  comingSoon: {
    color: colors.neon,
    fontSize: fontSizes.caption,
    ...fontWeight('800'),
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  supported: {
    color: colors.textMuted,
    fontSize: fontSizes.body,
    lineHeight: 21,
    marginTop: -spacing.xxl,
    paddingHorizontal: spacing.xs,
  },

  introModal: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.xl,
    paddingTop: 24,
    paddingBottom: spacing.xl,
  },
  closeIntro: { alignSelf: 'flex-end', padding: spacing.xs },
  introModalContent: { flex: 1, justifyContent: 'center' },
  introTitle: {
    color: colors.textPrimary,
    fontSize: 31,
    lineHeight: 41,
    ...fontWeight('800'),
    textAlign: 'center',
  },
  brandFlow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 52,
    marginBottom: 58,
  },
  runevoLogoWrap: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.cardElevated,
    overflow: 'hidden',
  },
  runevoLogo: { width: '100%', height: '100%' },
  flowDots: { flexDirection: 'row', alignItems: 'center', gap: 7, marginHorizontal: spacing.md },
  flowDot: { width: 12, height: 12, borderRadius: 6 },
  flowDotNeon: { backgroundColor: colors.neon },
  flowDotSoft: { backgroundColor: '#70A941' },
  flowDotOrangeSoft: { backgroundColor: '#B67E32' },
  flowDotOrange: { backgroundColor: colors.strava },
  stravaHeroLogo: { width: 112, height: 112, borderRadius: 56, overflow: 'hidden' },
  benefits: { gap: spacing.xl },
  benefit: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  benefitText: { flex: 1, color: colors.textSecondary, fontSize: fontSizes.base, lineHeight: 24 },
  introActions: { gap: spacing.md, paddingBottom: spacing.sm },
  stravaConnectButton: {
    minHeight: 58,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.strava,
  },
  stravaConnectButtonPressed: { opacity: 0.72 },
  stravaConnectButtonText: { color: '#fff', fontSize: fontSizes.lg, ...fontWeight('800') },
  notNowButton: { alignItems: 'center', paddingVertical: spacing.md },
  notNowText: { color: colors.textPrimary, fontSize: fontSizes.base, ...fontWeight('700') },
  closeIntroButton: {
    minHeight: 54,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIntroButtonText: {
    color: colors.textPrimary,
    fontSize: fontSizes.base,
    ...fontWeight('700'),
  },
});
