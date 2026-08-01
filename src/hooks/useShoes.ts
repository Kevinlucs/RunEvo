import { useQuery, useQueryClient } from '@tanstack/react-query';
import { shoeRepository } from '@/repositories';
import type { Shoe } from '@/domain/entities';

/**
 * Tênis do usuário (docs/fase-4-brief.md Grupo 4, §28; CRUD real docs/fase-6-brief.md
 * §33) — leitura via repository (offline-first). Usado tanto pelo seletor
 * opcional do formulário de conclusão de treino quanto pela tela de gerenciamento.
 */
export function useShoes(userId: string | null | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['shoes', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Shoe[]> => {
      if (!userId) return [];
      const result = await shoeRepository.listByUser(userId);
      return result.ok ? result.value : [];
    },
  });

  const shoes = query.data ?? [];
  return {
    shoes,
    activeShoes: shoes.filter((s) => s.is_active),
    retiredShoes: shoes.filter((s) => !s.is_active),
    isLoading: query.isLoading,
    invalidate: () => queryClient.invalidateQueries({ queryKey: ['shoes', userId] }),
  };
}

export function useShoe(id: string | undefined) {
  const query = useQuery({
    queryKey: ['shoe', id],
    enabled: Boolean(id),
    queryFn: async (): Promise<Shoe | null> => {
      if (!id) return null;
      const result = await shoeRepository.findById(id);
      return result.ok ? result.value : null;
    },
  });

  return { shoe: query.data ?? null, isLoading: query.isLoading };
}
