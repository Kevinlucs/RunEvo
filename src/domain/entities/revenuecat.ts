/**
 * docs/fase-7-brief.md Grupo 1. Identificador da entitlement no RevenueCat —
 * imutável no dashboard, comparado como string EXATA (com o "+"). Usar
 * `plus` aqui seria um bug silencioso: o entitlement nunca bateria e o
 * usuário pagante nunca veria os recursos Plus desbloqueados.
 *
 * Zero imports de propósito neste arquivo: ele é importado tanto pelo app
 * (via `@/domain/entities`) quanto pela Edge Function Deno
 * (`supabase/functions/revenuecat-webhook/mapping.ts`, caminho relativo) —
 * uma única fonte de verdade. Um `import` de terceiro (ex. `zod`) aqui faria
 * o Deno falhar ao resolver o specifier sem import map.
 */
export const REVENUECAT_ENTITLEMENT_ID = 'RunEvo+';
