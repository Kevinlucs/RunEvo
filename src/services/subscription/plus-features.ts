import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

type IconName = ComponentProps<typeof Ionicons>['name'];

interface Feature {
  icon: IconName;
  label: string;
}

/**
 * docs/fase-6-brief.md §34 — modelo Free/Plus (kickoff da Fase 6): Free
 * entrega a jornada completa de 1 prova; Plus vende histórico/evolução entre
 * ciclos/comparação/auditoria avançada/Excel. Lista única reusada em
 * Estatísticas (§31), oferta RunEvo+ e "Meus recursos" — evita 3 cópias
 * divergentes do mesmo texto.
 *
 * docs/fase-8-brief.md Grupo 4 — reordenada (não Free→Plus, só a ordem):
 * lidera com o que o INICIANTE quer resolver primeiro (plano completo
 * desbloqueado, viabilidade, adaptação) — histórico/gráficos, que só fazem
 * sentido depois de já ter ciclos concluídos, vêm por último. RunEvo+ vende
 * um treinador que leva até a prova, não um dashboard.
 */
export const PLUS_FEATURES: readonly Feature[] = [
  { icon: 'lock-open-outline', label: 'Plano completo, sem limite de semanas' },
  { icon: 'analytics-outline', label: 'Análise de viabilidade aprofundada a cada ciclo' },
  { icon: 'sync-outline', label: 'Adaptação inteligente do plano inteiro' },
  { icon: 'trending-up-outline', label: 'Evolução entre ciclos' },
  { icon: 'git-compare-outline', label: 'Comparação entre planilhas' },
  { icon: 'walk-outline', label: 'Progressão dos longões' },
  { icon: 'pulse-outline', label: 'Esforço percebido ao longo do tempo' },
  { icon: 'shield-checkmark-outline', label: 'Auditoria avançada da IA' },
  { icon: 'time-outline', label: 'Histórico completo de planilhas' },
  { icon: 'download-outline', label: 'Exportação em Excel' },
] as const;

/** Tênis ilimitados e IA valem para todos — só entram aqui os itens Free. */
export const FREE_FEATURES: readonly Feature[] = [
  { icon: 'flag-outline', label: 'Jornada completa de 1 prova' },
  { icon: 'footsteps-outline', label: 'Tênis ilimitados' },
  { icon: 'sparkles-outline', label: 'Planilha gerada por IA' },
  { icon: 'checkmark-done-outline', label: 'Check-in semanal adaptativo' },
] as const;
