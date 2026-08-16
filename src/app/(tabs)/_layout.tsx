import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSizes, fontWeight } from '@/theme';

type TabIconProps = { color: string; size: number };

/**
 * Bottom navigation (enunciado §26): Início · Treinos · IA Evo · Estatísticas.
 * Header nativo desligado — cada tela renderiza <AppHeader /> (logo + avatar,
 * docs/fase-4-brief.md Grupo 2.1) como primeiro bloco do próprio conteúdo,
 * dentro do <Screen> (que já cuida da safe area de topo).
 */
export default function TabsLayout(): JSX.Element {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarLabelStyle: { fontSize: fontSizes.caption, ...fontWeight('500') },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color, size }: TabIconProps) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: 'Treinos',
          tabBarIcon: ({ color, size }: TabIconProps) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ai-evo"
        options={{
          title: 'IA Evo',
          tabBarIcon: ({ color, size }: TabIconProps) => (
            <Ionicons name="sparkles-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Estatísticas',
          tabBarIcon: ({ color, size }: TabIconProps) => (
            <Ionicons name="stats-chart-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
