/**
 * Recorde pessoal do atleta, manual ou importado do Strava.
 * `key` corresponde a `PersonalRecord.key` em
 * `services/gamification/constants.ts` ('1k', '5k', 'half', 'marathon', ...).
 * Persistido em `personal_records` e sincronizado com o Supabase.
 */
export type PersonalRecordSource = 'manual' | 'strava';

export interface PersonalRecordEntry {
  /** ID único do marco (para deleção individual). */
  id: string;
  key: string;
  /** "HH:MM:SS" ou "MM:SS" */
  time: string;
  /** ISO date opcional (quando o recorde foi obtido). */
  date?: string;
  source: PersonalRecordSource;
  /** Deep link Strava (source === 'strava'). */
  externalUrl?: string;
  updatedAt: string;
}
