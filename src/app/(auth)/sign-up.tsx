import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { NeonButton } from '@/components/ui/NeonButton';
import { TextField } from '@/components/ui/TextField';
import { authService } from '@/services/auth/auth.service';
import { colors, spacing, fontSizes, fontWeight } from '@/theme';

export default function SignUp(): JSX.Element {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onSubmit = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    const res = await authService.signUpWithEmail(email.trim(), password, name.trim());
    setLoading(false);
    if (!res.ok) setError(res.error.message);
    else setDone(true);
  };

  return (
    <Screen>
      <Text style={styles.title}>Criar conta</Text>
      {done ? (
        <Text style={styles.info}>Enviamos um e-mail de confirmação. Confirme para entrar.</Text>
      ) : (
        <>
          <TextField label="Nome" value={name} onChangeText={setName} autoCapitalize="sentences" />
          <TextField label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" />
          <TextField label="Senha" value={password} onChangeText={setPassword} secureTextEntry error={error ?? undefined} />
          <NeonButton label="Cadastrar" onPress={() => void onSubmit()} loading={loading} />
        </>
      )}
      <View style={styles.row}>
        <NeonButton label="Voltar" variant="secondary" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.textPrimary, fontSize: fontSizes.title, ...fontWeight('800'), marginTop: spacing.xxxl, marginBottom: spacing.xl },
  info: { color: colors.textSecondary, fontSize: fontSizes.base, marginBottom: spacing.xl },
  row: { marginTop: spacing.lg },
});
