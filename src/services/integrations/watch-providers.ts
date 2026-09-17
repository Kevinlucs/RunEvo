export type WatchProviderId = 'garmin' | 'coros' | 'polar' | 'amazfit';

export interface WatchProvider {
  id: WatchProviderId;
  name: string;
  description: string;
  availability: 'official_api_pending';
}

/**
 * Catálogo independente da implementação de autenticação.
 * Quando cada parceria liberar sua API oficial, o fluxo OAuth e o sincronizador
 * serão associados a este `id`, sem a necessidade de mudar as telas.
 */
export const WATCH_PROVIDERS: readonly WatchProvider[] = [
  {
    id: 'garmin',
    name: 'Garmin Connect',
    description: 'Conecte seus treinos e atividades Garmin ao RunEvo.',
    availability: 'official_api_pending',
  },
  {
    id: 'coros',
    name: 'COROS',
    description: 'Sincronize seus dados de corrida COROS.',
    availability: 'official_api_pending',
  },
  {
    id: 'polar',
    name: 'Polar',
    description: 'Traga suas atividades Polar para o seu plano.',
    availability: 'official_api_pending',
  },
  {
    id: 'amazfit',
    name: 'Amazfit',
    description: 'Acompanhe suas corridas Amazfit no RunEvo.',
    availability: 'official_api_pending',
  },
];

export function getWatchProvider(id: string): WatchProvider | undefined {
  return WATCH_PROVIDERS.find((provider) => provider.id === id);
}
