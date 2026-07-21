import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { NeonButton } from '@/components/ui/NeonButton';
import { TextField } from '@/components/ui/TextField';
import { authService } from '@/services/auth/auth.service';
import { colors, spacing, fontSizes } from '@/theme';

export default function SignIn(): JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    const res = await authService.signInWithEmail(email.trim(), password);
    setLoading(false);
    if (!res.ok) setError(res.error.message);
    // sucesso → guard do _layout redireciona para (tabs)
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>RunEvo</Text>
        <Text style={styles.subtitle}>Entre para continuar sua evolução.</Text>
      </View>
      <TextField label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="voce@email.com" />
      <TextField label="Senha" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" error={error ?? undefined} />
      <NeonButton label="Entrar" onPress={() => void onSubmit()} loading={loading} />
      <View style={styles.row}>
        <Link href="/(auth)/reset-password" style={styles.link}>Esqueci a senha</Link>
        <Link href="/(auth)/sign-up" style={styles.link}>Criar conta</Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: spacing.xxxl, marginBottom: spacing.xxl },
  title: { color: colors.neon, fontSize: fontSizes.display, fontWeight: '900' },
  subtitle: { color: colors.textSecondary, fontSize: fontSizes.base, marginTop: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xl },
  link: { color: colors.textSecondary, fontSize: fontSizes.body },
});
