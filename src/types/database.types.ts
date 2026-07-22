// @generated — derivado manualmente de supabase/migrations/*.sql (fonte de
// verdade do schema), NÃO do CLI, porque este ambiente não tem
// SUPABASE_ACCESS_TOKEN/login para chamar `supabase gen types`.
// Regenerar com `npm run db:types` assim que houver credencial — isso
// substitui este arquivo inteiro pela versão oficial do projeto.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      athlete_profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          birth_date: string | null;
          height_cm: number | null;
          current_weight_kg: number | null;
          imc: number | null;
          preferred_unit: string;
          language: string;
          theme: string;
          onboarding_seen: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          birth_date?: string | null;
          height_cm?: number | null;
          current_weight_kg?: number | null;
          imc?: number | null;
          preferred_unit?: string;
          language?: string;
          theme?: string;
          onboarding_seen?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['athlete_profiles']['Insert']>;
        Relationships: [];
      };
      training_plans: {
        Row: {
          id: string;
          user_id: string;
          plan_name: string;
          race_name: string | null;
          race_distance_km: number | null;
          start_date: string | null;
          race_date: string | null;
          total_weeks: number | null;
          days_per_week: number | null;
          objective: string | null;
          terrain: string | null;
          status: string;
          user_data: Json;
          blueprint: Json;
          validation: Json;
          quality: Json;
          risk: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan_name: string;
          race_name?: string | null;
          race_distance_km?: number | null;
          start_date?: string | null;
          race_date?: string | null;
          total_weeks?: number | null;
          days_per_week?: number | null;
          objective?: string | null;
          terrain?: string | null;
          status?: string;
          user_data?: Json;
          blueprint?: Json;
          validation?: Json;
          quality?: Json;
          risk?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['training_plans']['Insert']>;
        Relationships: [];
      };
      plan_workouts: {
        Row: {
          id: string;
          plan_id: string;
          user_id: string;
          week_number: number;
          week_index: number;
          phase: string | null;
          workout_date: string | null;
          day_label: string | null;
          day_type: string | null;
          title: string | null;
          description: string | null;
          planned_km: number | null;
          planned_pace: string | null;
          status: string;
          completed_km: number | null;
          perceived_effort: number | null;
          feeling: string | null;
          pain: boolean | null;
          feedback: string | null;
          shoe_id: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          plan_id: string;
          user_id: string;
          week_number: number;
          week_index?: number;
          phase?: string | null;
          workout_date?: string | null;
          day_label?: string | null;
          day_type?: string | null;
          title?: string | null;
          description?: string | null;
          planned_km?: number | null;
          planned_pace?: string | null;
          status?: string;
          completed_km?: number | null;
          perceived_effort?: number | null;
          feeling?: string | null;
          pain?: boolean | null;
          feedback?: string | null;
          shoe_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['plan_workouts']['Insert']>;
        Relationships: [];
      };
      weekly_checkins: {
        Row: {
          id: string;
          plan_id: string;
          user_id: string;
          week_number: number;
          current_weight_kg: number | null;
          fatigue_level: number | null;
          pain_level: number | null;
          feeling: string | null;
          notes: string | null;
          ai_analysis: Json;
          adjustment: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          plan_id: string;
          user_id: string;
          week_number: number;
          current_weight_kg?: number | null;
          fatigue_level?: number | null;
          pain_level?: number | null;
          feeling?: string | null;
          notes?: string | null;
          ai_analysis?: Json;
          adjustment?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['weekly_checkins']['Insert']>;
        Relationships: [];
      };
      running_shoes: {
        Row: {
          id: string;
          user_id: string;
          brand: string | null;
          model: string;
          nickname: string | null;
          initial_km: number;
          current_km: number;
          max_km: number;
          is_active: boolean;
          created_at: string;
          retired_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          brand?: string | null;
          model: string;
          nickname?: string | null;
          initial_km?: number;
          current_km?: number;
          max_km?: number;
          is_active?: boolean;
          created_at?: string;
          retired_at?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['running_shoes']['Insert']>;
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          platform: string;
          product_id: string | null;
          status: string;
          current_period_end: string | null;
          raw_payload: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          platform: string;
          product_id?: string | null;
          status?: string;
          current_period_end?: string | null;
          raw_payload?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['subscriptions']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      delete_own_account: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type PublicSchema = Database['public'];

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row'];
export type TablesInsert<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Update'];
