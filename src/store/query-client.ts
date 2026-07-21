import { QueryClient } from '@tanstack/react-query';

/** Cache remoto/derivado. Dados locais vêm dos repositórios (SQLite). */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 30_000, refetchOnWindowFocus: false },
  },
});
