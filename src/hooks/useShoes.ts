import { useQuery } from '@tanstack/react-query';
import { shoeRepository } from '@/repositories';
import type { Shoe } from '@/domain/entities';

/**
 * Tênis do usuário (docs/fase-4-brief.md Grupo 4, §28/§33) — CRUD é da Fase
 * 6; aqui só leitura para o seletor opcional do formulário de conclusão.
 */
export function useShoes(userId: string | null | undefined) {
  const query = useQuery({
    queryKey: ['shoes', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Shoe[]> => {
      if (!userId) return [];
      const result = await shoeRepository.listByUser(userId);
      return result.ok ? result.value : [];
    },
  });

  return { shoes: query.data ?? [], isLoading: query.isLoading };
}
