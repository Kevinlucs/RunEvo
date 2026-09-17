import {
  LockOpen,
  ChartColumn,
  RefreshCw,
  TrendingUp,
  GitCompareArrows,
  Route,
  Activity,
  ShieldCheck,
  History,
  Download,
  Flag,
  Footprints,
  Sparkles,
  CheckCheck,
  type LucideIcon,
} from 'lucide-react-native';

interface Feature {
  icon: LucideIcon;
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
  { icon: LockOpen, label: 'Plano completo, sem limite de semanas' },
  { icon: ChartColumn, label: 'Análise de viabilidade aprofundada a cada ciclo' },
  { icon: RefreshCw, label: 'Adaptação inteligente do plano inteiro' },
  { icon: TrendingUp, label: 'Evolução entre ciclos' },
  { icon: GitCompareArrows, label: 'Comparação entre planilhas' },
  { icon: Route, label: 'Progressão dos longões' },
  { icon: Activity, label: 'Esforço percebido ao longo do tempo' },
  { icon: ShieldCheck, label: 'Auditoria avançada da IA' },
  { icon: History, label: 'Histórico completo de planilhas' },
  { icon: Download, label: 'Exportação em Excel' },
] as const;

/** Tênis ilimitados e IA valem para todos — só entram aqui os itens Free. */
export const FREE_FEATURES: readonly Feature[] = [
  { icon: Flag, label: 'Jornada completa de 1 prova' },
  { icon: Footprints, label: 'Tênis ilimitados' },
  { icon: Sparkles, label: 'Planilha gerada por IA' },
  { icon: CheckCheck, label: 'Check-in semanal adaptativo' },
] as const;
