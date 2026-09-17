import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { personalRecordRepository } from '@/repositories';
import { useAuthStore } from '@/store/auth.store';
import type { PersonalRecordEntry } from '@/domain/entities';

const EMPTY: Record<string, PersonalRecordEntry> = {};

/**
 * Recordes pessoais do atleta (LOCAL-ONLY).
 * Retorna o mapa `key → PersonalRecordEntry` (melhor marca de cada distância)
 * e ações de gravação/limpeza que invalidam a query para refletir na tela imediatamente.
 */
export function usePersonalRecords(): {
  overrides: Record<string, PersonalRecordEntry>;
  isLoading: boolean;
  save: (key: string, input: { time: string; date?: string }) => Promise<void>;
  clear: (key: string) => Promise<void>;
} {
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();
  const queryKey = ['personal-records', userId];

  const query = useQuery({
    queryKey,
    enabled: Boolean(userId),
    queryFn: async (): Promise<Record<string, PersonalRecordEntry>> => {
      if (!userId) return EMPTY;
      const res = await personalRecordRepository.list(userId);
      if (!res.ok) throw res.error;
      return res.value;
    },
  });

  const save = useCallback(
    async (
      key: string,
      input: { time: string; date?: string; source?: 'manual' | 'strava'; externalUrl?: string },
    ): Promise<void> => {
      if (!userId) return;
      const res = await personalRecordRepository.addMilestone(userId, key, input);
      if (!res.ok) throw res.error;
      await queryClient.invalidateQueries({ queryKey });
    },
    [userId, queryClient],
  );

  const clear = useCallback(
    async (key: string): Promise<void> => {
      if (!userId) return;
      const res = await personalRecordRepository.clear(userId, key);
      if (!res.ok) throw res.error;
      await queryClient.invalidateQueries({ queryKey });
    },
    [userId, queryClient],
  );

  return {
    overrides: query.data ?? EMPTY,
    isLoading: query.isLoading,
    save,
    clear,
  };
}

/**
 * Marcos de uma distância específica — até três melhores marcas, da mais
 * rápida à mais lenta.
 * Usado pela tela de detalhe do recorde (`stats/[key]`).
 */
export function usePersonalRecordMilestones(key: string | null): {
  milestones: PersonalRecordEntry[];
  isLoading: boolean;
  add: (input: { time: string; date?: string }) => Promise<void>;
  update: (milestoneId: string, input: { time: string; date: string }) => Promise<void>;
  remove: (milestoneId: string) => Promise<void>;
} {
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();
  const queryKey = ['personal-records', userId];
  const milestoneKey = ['personal-record-milestones', userId, key];

  const query = useQuery({
    queryKey: milestoneKey,
    enabled: Boolean(userId && key),
    queryFn: async (): Promise<PersonalRecordEntry[]> => {
      if (!userId || !key) return [];
      const res = await personalRecordRepository.listMilestones(userId, key);
      if (!res.ok) throw res.error;
      return res.value;
    },
  });

  const add = useCallback(
    async (input: {
      time: string;
      date?: string;
      source?: 'manual' | 'strava';
      externalUrl?: string;
    }): Promise<void> => {
      if (!userId || !key) return;
      const res = await personalRecordRepository.addMilestone(userId, key, input);
      if (!res.ok) throw res.error;
      // Invalida tanto a lista de marcos quanto o mapa de recordes ativos
      await queryClient.invalidateQueries({ queryKey: milestoneKey });
      await queryClient.invalidateQueries({ queryKey });
    },
    [userId, key, queryClient, queryKey, milestoneKey],
  );

  const remove = useCallback(
    async (milestoneId: string): Promise<void> => {
      if (!userId || !key) return;
      const res = await personalRecordRepository.deleteMilestone(userId, key, milestoneId);
      if (!res.ok) throw res.error;
      await queryClient.invalidateQueries({ queryKey: milestoneKey });
      await queryClient.invalidateQueries({ queryKey });
    },
    [userId, key, queryClient, queryKey, milestoneKey],
  );

  const update = useCallback(
    async (milestoneId: string, input: { time: string; date: string }): Promise<void> => {
      if (!userId || !key) return;
      const res = await personalRecordRepository.updateMilestone(userId, key, milestoneId, input);
      if (!res.ok) throw res.error;
      await queryClient.invalidateQueries({ queryKey: milestoneKey });
      await queryClient.invalidateQueries({ queryKey });
    },
    [userId, key, queryClient, queryKey, milestoneKey],
  );

  return {
    milestones: query.data ?? [],
    isLoading: query.isLoading,
    add,
    update,
    remove,
  };
}
