/**
 * Níveis de corrida — 7 estágios do amarelo (iniciante) ao verde-limão (ultra).
 * Cada nível tem cor própria, nome e faixa de km acumulados (lifetime).
 */
export interface RunLevel {
  key: 'amarelo' | 'laranja' | 'verde' | 'azul' | 'roxo' | 'preto' | 'verde-limao';
  name: string;
  minKm: number;
  maxKm: number | null; // null = sem limite superior (último nível)
  color: string;
}

export const RUN_LEVELS: RunLevel[] = [
  { key: 'amarelo', name: 'Amarelo', minKm: 0, maxKm: 49.99, color: '#FFD700' },
  { key: 'laranja', name: 'Laranja', minKm: 50, maxKm: 249.9, color: '#FF8C00' },
  { key: 'verde', name: 'Verde', minKm: 250, maxKm: 999.9, color: '#32CD32' },
  { key: 'azul', name: 'Azul', minKm: 1000, maxKm: 2499.9, color: '#1E90FF' },
  { key: 'roxo', name: 'Roxo', minKm: 2500, maxKm: 4999.9, color: '#9370DB' },
  { key: 'preto', name: 'Preto', minKm: 5000, maxKm: 14999.9, color: '#2F4F4F' },
  { key: 'verde-limao', name: 'Verde-Limão', minKm: 15000, maxKm: null, color: '#32CD32' },
];

/**
 * Categorias de conquistas — agrupam desafios por tema (corridas, distância, planos).
 * Cada categoria tem cor, ícone Lucide e lista de thresholds.
 */
export interface AchievementCategory {
  key: string;
  name: string;
  description: string;
  color: string;
  icon: string; // nome do ícone Lucide (ex.: 'Footprints', 'RouteIcon', 'Trophy')
}

export interface Achievement {
  categoryKey: string;
  key: string;
  name: string;
  description: string;
  threshold: number; // valor a atingir (1ª corrida, 10 corridas, 50 km, etc.)
  unlocked: boolean;
  unlockedAt?: string; // ISO timestamp quando foi conquistada
}

export const ACHIEVEMENT_CATEGORIES: AchievementCategory[] = [
  {
    key: 'workouts-completed',
    name: 'Corridas do plano concluídas',
    description: 'Complete treinos planejados',
    color: '#83d801',
    icon: 'Footprints',
  },
  {
    key: 'total-distance',
    name: 'Distância total',
    description: 'Acumule quilômetros',
    color: '#1E90FF', // azul
    icon: 'RouteIcon',
  },
  {
    key: 'max-distance',
    name: 'Distâncias por atividade',
    description: 'Complete atividades cada vez mais longas',
    color: '#DC143C', // vermelho
    icon: 'Zap',
  },
  {
    key: 'plans-completed',
    name: 'Planos concluídos',
    description: 'Termine ciclos de treino',
    color: '#9370DB', // roxo
    icon: 'Clipboard',
  },
];

export const ACHIEVEMENT_THRESHOLDS = {
  'workouts-completed': [1, 10, 50, 100, 500, 1000],
  'total-distance': [10, 50, 100, 500, 1000, 5000],
  'max-distance': [5, 10, 21.1, 42.2, 50, 100],
  'plans-completed': [1, 2, 5, 10, 15, 20],
};

/**
 * Recordes pessoais — distâncias-chave para tracking de melhor tempo.
 * Dados de TEMPO virão das integrações de atividades (por ora, renderizamos vazios).
 */
export interface PersonalRecord {
  key: string;
  distance: number; // em km
  distanceLabel: string; // legado — mantido p/ compat (usar shortLabel/name na UI)
  shortLabel: string; // token dentro do hexágono (ex.: "1K", "5K", "21.1", "42.2")
  name: string; // nome descritivo embaixo (ex.: "1 km", "Meia maratona")
  displayName: string; // nome longo para UI (grid + tela de detalhe)
  color: string; // hexágono colorido próprio
  pace?: string; // "5'41/km" ou similar
  time?: string; // "00:05:41" ou similar
  date?: string; // ISO date
}

export const PERSONAL_RECORDS: PersonalRecord[] = [
  {
    key: '1k',
    distance: 1,
    distanceLabel: '1k',
    shortLabel: '1K',
    name: '1 km',
    displayName: '1 km',
    color: '#9CA3AF',
  },
  {
    key: '1mi',
    distance: 1.609,
    distanceLabel: '1 mi',
    shortLabel: '1MI',
    name: '1 mi',
    displayName: '1 mi',
    color: '#1F2937',
  },
  {
    key: '2mi',
    distance: 3.219,
    distanceLabel: '2 mi',
    shortLabel: '2MI',
    name: '2 mi',
    displayName: '2 mi',
    color: '#B91C1C',
  },
  {
    key: '5k',
    distance: 5,
    distanceLabel: '5k',
    shortLabel: '5K',
    name: '5 km',
    displayName: '5 km',
    color: '#2563EB',
  },
  {
    key: '5mi',
    distance: 8.047,
    distanceLabel: '5 mi',
    shortLabel: '5MI',
    name: '5 mi',
    displayName: '5 mi',
    color: '#0D9488',
  },
  {
    key: '10k',
    distance: 10,
    distanceLabel: '10k',
    shortLabel: '10K',
    name: '10 km',
    displayName: '10 km',
    color: '#CA8A04',
  },
  {
    key: '10mi',
    distance: 16.093,
    distanceLabel: '10 mi',
    shortLabel: '10MI',
    name: '10 mi',
    displayName: '10 mi',
    color: '#B45309',
  },
  {
    key: 'half',
    distance: 21.0975,
    distanceLabel: 'Meia',
    shortLabel: '21.1',
    name: 'Meia maratona',
    displayName: 'Meia maratona',
    color: '#15803D',
  },
  {
    key: 'marathon',
    distance: 42.195,
    distanceLabel: 'Maratona',
    shortLabel: '42.2',
    name: 'Maratona',
    displayName: 'Maratona',
    color: '#7F1D2D',
  },
  {
    key: '50k',
    distance: 50,
    distanceLabel: '50k',
    shortLabel: '50K',
    name: '50 km',
    displayName: '50 km',
    color: '#3F6212',
  },
  {
    key: '100k',
    distance: 100,
    distanceLabel: '100k',
    shortLabel: '100K',
    name: '100 km',
    displayName: '100 km',
    color: '#6B21A8',
  },
];
