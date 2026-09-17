function enabled(name: string): boolean {
  return Deno.env.get(name)?.trim().toLowerCase() === 'true';
}

/** Flags server-side: mudar a disponibilidade não exige publicar um app novo. */
export const integrationFlags = {
  stravaIntegration: () => enabled('STRAVA_INTEGRATION_ENABLED'),
  stravaActivityEnrichment: () => enabled('STRAVA_ACTIVITY_ENRICHMENT_ENABLED'),
  /** Integração temporária via gateway isolado; nunca habilitar sem gateway configurado. */
  garminPrivateApi: () => enabled('GARMIN_PRIVATE_API_ENABLED'),
  /** Protege exclusivamente a criação/agendamento/envio de workouts. */
  garminTrainingSync: () => enabled('GARMIN_TRAINING_SYNC_ENABLED'),
} as const;
