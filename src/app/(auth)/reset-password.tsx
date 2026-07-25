import { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { NeonButton } from '@/components/ui/NeonButton';
import { TextField } from '@/components/ui/TextField';
import { authService } from '@/services/auth/auth.service';
import { colors, spacing, fontSizes, fontWeight } from '@/theme';

export default function ResetPassword(): JSX.Element {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (): Promise<void> => {
    setLoading(true);
    await authService.sendPasswordReset(email.trim());
    setLoading(false);
    setSent(true);
  };

  return (
    <Screen>
      <Text style={styles.title}>Recuperar senha</Text>
      {sent ? (
        <Text style={styles.info}>Se o e-mail existir, enviamos um link de recuperação.</Text>
      ) : (
        <>
          <TextField label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" />
          <NeonButton label="Enviar link" onPress={() => void onSubmit()} loading={loading} />
        </>
      )}
      <NeonButton label="Voltar" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.textPrimary, fontSize: fontSizes.title, ...fontWeight('800'), marginTop: spacing.xxxl, marginBottom: spacing.xl },
  info: { color: colors.textSecondary, fontSize: fontSizes.base, marginBottom: spacing.xl },
});
