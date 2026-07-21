import * as SecureStore from 'expo-secure-store';

// Adapter de storage do Supabase Auth: tokens de sessão ficam no SecureStore
// (Keychain/Keystore), nunca em AsyncStorage/localStorage.
export const secureStorage = {
  getItem: (key: string): Promise<string | null> => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string): Promise<void> => SecureStore.setItemAsync(key, value),
  removeItem: (key: string): Promise<void> => SecureStore.deleteItemAsync(key),
};
