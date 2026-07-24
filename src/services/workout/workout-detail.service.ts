import type { TrainingPlan, Workout } from '@/domain/entities';
import type { PlanBlueprint } from '@/domain/motor-evo/blueprint';
import type { TrainingZones } from '@/domain/motor-evo/types';

/**
 * docs/fase-4-brief.md Grupo 4 (§28) — zonas Z1-Z5 do blueprint do plano,
 * com o método/âncora usado. `TrainingPlanRepository` já desserializa
 * `blueprint` (jsonColumns do BaseRepository) — aqui só o cast de tipo.
 */
export function readTrainingZones(plan: TrainingPlan): TrainingZones | null {
  const blueprint = plan.blueprint as unknown as PlanBlueprint | undefined;
  return blueprint?.paceZones?.trainingZones ?? null;
}

/**
 * Formata a prescrição do motor (`workout.description`, texto com linhas tipo
 * "1km em Z1") para exibição em lista — só formata, não recategoriza em
 * blocos nomeados: o motor não marca aquecimento/bloco principal/
 * desaquecimento como campos separados (workout-prescription.ts produz um
 * texto único zona a zona).
 */
export function splitWorkoutDescription(desc: string | null | undefined): string[] {
  return String(desc ?? '')
    .replace(/\\n/g, '\n')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * `validation.ts` (§ construção do plano) atribui este título fixo ao último
 * treino da última semana — sinal confiável de que este é o treino da prova
 * (docs/fase-4-brief.md Grupo 4: "não pode ser editado nem removido; concluir
 * é permitido").
 */
export function isRaceWorkout(workout: Workout): boolean {
  return workout.title === 'Prova alvo';
}
