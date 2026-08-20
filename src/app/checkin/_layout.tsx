import { Stack } from 'expo-router';

export default function CheckinLayout(): JSX.Element {
  return <Stack screenOptions={{ headerShown: false, presentation: 'transparentModal', animation: 'fade' }} />;
}
