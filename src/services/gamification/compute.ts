import {
  RUN_LEVELS,
  ACHIEVEMENT_THRESHOLDS,
  PERSONAL_RECORDS,
  type RunLevel,
  type Achievement,
  type PersonalRecord,
} from './constants';

/**
 * Calcula qual nível o atleta pertence com base no km total lifetime.
 * O nível é o primeiro (na ordem RUN_LEVELS) cujo range contém o km total.
 */
export function computeLevel(totalKm: number): RunLevel {
  const level = RUN_LEVELS.find((l) => totalKm >= l.minKm && (!l.maxKm || totalKm <= l.maxKm));
  // Se nenhum nível encontrado (exceção: totalKm fora de range), retorna o primeiro
  return level ?? RUN_LEVELS[0]!;
}

/**
 * Calcula km restante para atingir o próximo nível.
 * Se já está no último nível, retorna 0.
 */
export function computeKmToNextLevel(totalKm: number): number {
  const currentLevel = computeLevel(totalKm);
  const currentIndex = RUN_LEVELS.findIndex((l) => l.key === currentLevel.key);
  if (currentIndex === -1 || currentIndex === RUN_LEVELS.length - 1) {
    // Já está no último nível
    return 0;
  }
  const nextLevel = RUN_LEVELS[currentIndex + 1];
  if (!nextLevel) return 0; // Safety check
  return Math.max(0, nextLevel.minKm - totalKm);
}

/**
 * Calcula quais conquistas foram desbloqueadas com base em métricas do atleta.
 * Retorna array de Achievement com unlocked = true/false.
 *
 * @param totalKm km lifetime acumulado
 * @param completedWorkouts total de treinos concluídos (lifetime)
 * @param completedPlans total de planos terminados
 * @param maxSingleWorkoutKm km máximo numa única atividade
 */
export function computeAchievements(
  totalKm: number,
  completedWorkouts: number,
  completedPlans: number,
  maxSingleWorkoutKm: number,
): Achievement[] {
  const achievements: Achievement[] = [];

  // Categoria: Corridas do plano concluídas
  for (const threshold of ACHIEVEMENT_THRESHOLDS['workouts-completed']) {
    achievements.push({
      categoryKey: 'workouts-completed',
      key: `workouts-${threshold}`,
      name: threshold === 1 ? '1ª corrida' : `${threshold} corridas`,
      description: `Complete ${threshold} treino${threshold > 1 ? 's' : ''}`,
      threshold,
      unlocked: completedWorkouts >= threshold,
    });
  }

  // Categoria: Distância total
  for (const threshold of ACHIEVEMENT_THRESHOLDS['total-distance']) {
    achievements.push({
      categoryKey: 'total-distance',
      key: `distance-${threshold}`,
      name: `${threshold} km`,
      description: `Acumule ${threshold} km`,
      threshold,
      unlocked: totalKm >= threshold,
    });
  }

  // Categoria: Distância máxima numa atividade
  for (const threshold of ACHIEVEMENT_THRESHOLDS['max-distance']) {
    const label =
      threshold === 21.1
        ? 'Meia'
        : threshold === 42.2
          ? 'Maratona'
          : threshold === 5
            ? '5 km'
            : threshold === 10
              ? '10 km'
              : threshold === 50
                ? '50 km'
                : threshold === 100
                  ? '100 km'
                  : `${threshold} km`;
    achievements.push({
      categoryKey: 'max-distance',
      key: `max-${threshold}`,
      name: label,
      description: `Complete uma atividade de ${label}`,
      threshold,
      unlocked: maxSingleWorkoutKm >= threshold,
    });
  }

  // Categoria: Planos concluídos
  for (const threshold of ACHIEVEMENT_THRESHOLDS['plans-completed']) {
    achievements.push({
      categoryKey: 'plans-completed',
      key: `plans-${threshold}`,
      name: threshold === 1 ? '1º plano' : `${threshold} planos`,
      description: `Complete ${threshold} plano${threshold > 1 ? 's' : ''}`,
      threshold,
      unlocked: completedPlans >= threshold,
    });
  }

  return achievements;
}

/**
 * Retorna recordes pessoais mesclando a lista-base (`PERSONAL_RECORDS`) com
 * os recordes editados manualmente pelo atleta (`overrides`, indexados por
 * `key`). Distâncias sem override ficam vazias ("-") — dados de TEMPO virão
 * das integrações de atividades no futuro.
 *
 * @param overrides mapa `key → { time, date? }` vindo de `personalRecordRepository.list`.
 */
export function computeRecords(
  overrides: Record<string, { time: string; date?: string }> = {},
): PersonalRecord[] {
  return PERSONAL_RECORDS.map((record) => {
    const override = overrides[record.key];
    return {
      ...record,
      pace: computePace(override?.time, record.distance),
      time: override?.time,
      date: override?.date,
    };
  });
}

/**
 * Deriva o pace ("m'ss/km") a partir do tempo total ("HH:MM:SS"/"MM:SS") e da
 * distância em km. Retorna undefined se o tempo for inválido ou vazio.
 */
export function computePace(time: string | undefined, distanceKm: number): string | undefined {
  if (!time || distanceKm <= 0) return undefined;
  const totalSeconds = parseTimeToSeconds(time);
  if (totalSeconds === null || totalSeconds <= 0) return undefined;
  const paceSeconds = Math.round(totalSeconds / distanceKm);
  const min = Math.floor(paceSeconds / 60);
  const sec = paceSeconds % 60;
  return `${min}'${String(sec).padStart(2, '0')}/km`;
}

/** "HH:MM:SS" ou "MM:SS" → segundos. Null se inválido. */
export function parseTimeToSeconds(time: string): number | null {
  const parts = time.split(':').map((p) => Number(p));
  if (parts.some((n) => Number.isNaN(n) || n < 0)) return null;
  if (parts.length === 3) {
    const [h, m, s] = parts as [number, number, number];
    if (m >= 60 || s >= 60) return null;
    return h * 3600 + m * 60 + s;
  }
  if (parts.length === 2) {
    const [m, s] = parts as [number, number];
    if (s >= 60) return null;
    return m * 60 + s;
  }
  return null;
}
