function enabled(name: string): boolean {
  return Deno.env.get(name)?.trim().toLowerCase() === 'true';
}

/** Flags server-side: mudar a disponibilidade não exige publicar um app novo. */
export const integrationFlags = {
  stravaIntegration: () => enabled('STRAVA_INTEGRATION_ENABLED'),
  stravaActivityEnrichment: () => enabled('STRAVA_ACTIVITY_ENRICHMENT_ENABLED'),
} as const;
