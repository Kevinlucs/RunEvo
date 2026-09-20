export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activity_sources: {
        Row: {
          activity_id: string
          created_at: string
          external_activity_id: string
          id: string
          payload: Json
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_id: string
          created_at?: string
          external_activity_id: string
          id?: string
          payload?: Json
          provider: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_id?: string
          created_at?: string
          external_activity_id?: string
          id?: string
          payload?: Json
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_sources_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "athlete_activities"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_activities: {
        Row: {
          created_at: string
          distance_m: number
          duration_s: number
          external_url: string | null
          id: string
          match_score: number | null
          match_type: string | null
          matched_workout_id: string | null
          source_priority: number
          sport_type: string
          start_at: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          distance_m: number
          duration_s: number
          external_url?: string | null
          id?: string
          match_score?: number | null
          match_type?: string | null
          matched_workout_id?: string | null
          source_priority?: number
          sport_type?: string
          start_at: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          distance_m?: number
          duration_s?: number
          external_url?: string | null
          id?: string
          match_score?: number | null
          match_type?: string | null
          matched_workout_id?: string | null
          source_priority?: number
          sport_type?: string
          start_at?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_activities_matched_workout_id_fkey"
            columns: ["matched_workout_id"]
            isOneToOne: false
            referencedRelation: "plan_workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_profiles: {
        Row: {
          avatar_url: string | null
          birth_date: string | null
          created_at: string
          current_weight_kg: number | null
          display_name: string | null
          gender: string | null
          height_cm: number | null
          id: string
          imc: number | null
          language: string
          onboarding_seen: boolean
          preferred_unit: string
          theme: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string
          current_weight_kg?: number | null
          display_name?: string | null
          gender?: string | null
          height_cm?: number | null
          id: string
          imc?: number | null
          language?: string
          onboarding_seen?: boolean
          preferred_unit?: string
          theme?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string
          current_weight_kg?: number | null
          display_name?: string | null
          gender?: string | null
          height_cm?: number | null
          id?: string
          imc?: number | null
          language?: string
          onboarding_seen?: boolean
          preferred_unit?: string
          theme?: string
          updated_at?: string
        }
        Relationships: []
      }
      connected_accounts: {
        Row: {
          connected_at: string | null
          created_at: string
          id: string
          last_error: string | null
          last_sync_at: string | null
          provider: string
          provider_user_id: string | null
          scopes: string[]
          settings: Json
          status: string
          token_ciphertext: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          connected_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          provider: string
          provider_user_id?: string | null
          scopes?: string[]
          settings?: Json
          status?: string
          token_ciphertext?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          connected_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          provider?: string
          provider_user_id?: string | null
          scopes?: string[]
          settings?: Json
          status?: string
          token_ciphertext?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      integration_events: {
        Row: {
          attempts: number
          created_at: string
          event_time: string | null
          event_type: string
          external_object_id: string
          id: string
          last_error: string | null
          payload: Json
          processed_at: string | null
          provider: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          event_time?: string | null
          event_type: string
          external_object_id: string
          id?: string
          last_error?: string | null
          payload?: Json
          processed_at?: string | null
          provider: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          event_time?: string | null
          event_type?: string
          external_object_id?: string
          id?: string
          last_error?: string | null
          payload?: Json
          processed_at?: string | null
          provider?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      integration_oauth_states: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          provider: string
          state_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          provider: string
          state_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          provider?: string
          state_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      personal_records: {
        Row: {
          date_iso: string | null
          external_url: string | null
          id: string
          record_key: string
          source: string
          time_str: string
          updated_at: string
          user_id: string
        }
        Insert: {
          date_iso?: string | null
          external_url?: string | null
          id: string
          record_key: string
          source?: string
          time_str: string
          updated_at?: string
          user_id: string
        }
        Update: {
          date_iso?: string | null
          external_url?: string | null
          id?: string
          record_key?: string
          source?: string
          time_str?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      plan_workouts: {
        Row: {
          check_in_status: string
          completed_at: string | null
          completed_km: number | null
          completion_activity_id: string | null
          completion_match_score: number | null
          completion_match_type: string | null
          completion_source: string | null
          created_at: string
          day_label: string | null
          day_type: string | null
          description: string | null
          feedback: string | null
          feeling: string | null
          id: string
          pain: boolean | null
          perceived_effort: number | null
          phase: string | null
          plan_id: string
          planned_km: number | null
          planned_pace: string | null
          shoe_id: string | null
          status: string
          title: string | null
          updated_at: string
          user_id: string
          week_index: number
          week_number: number
          workout_date: string | null
        }
        Insert: {
          check_in_status?: string
          completed_at?: string | null
          completed_km?: number | null
          completion_activity_id?: string | null
          completion_match_score?: number | null
          completion_match_type?: string | null
          completion_source?: string | null
          created_at?: string
          day_label?: string | null
          day_type?: string | null
          description?: string | null
          feedback?: string | null
          feeling?: string | null
          id?: string
          pain?: boolean | null
          perceived_effort?: number | null
          phase?: string | null
          plan_id: string
          planned_km?: number | null
          planned_pace?: string | null
          shoe_id?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          user_id: string
          week_index?: number
          week_number: number
          workout_date?: string | null
        }
        Update: {
          check_in_status?: string
          completed_at?: string | null
          completed_km?: number | null
          completion_activity_id?: string | null
          completion_match_score?: number | null
          completion_match_type?: string | null
          completion_source?: string | null
          created_at?: string
          day_label?: string | null
          day_type?: string | null
          description?: string | null
          feedback?: string | null
          feeling?: string | null
          id?: string
          pain?: boolean | null
          perceived_effort?: number | null
          phase?: string | null
          plan_id?: string
          planned_km?: number | null
          planned_pace?: string | null
          shoe_id?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          user_id?: string
          week_index?: number
          week_number?: number
          workout_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_workouts_completion_activity_id_fkey"
            columns: ["completion_activity_id"]
            isOneToOne: false
            referencedRelation: "athlete_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_workouts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_workouts_shoe_id_fkey"
            columns: ["shoe_id"]
            isOneToOne: false
            referencedRelation: "running_shoes"
            referencedColumns: ["id"]
          },
        ]
      }
      running_shoes: {
        Row: {
          brand: string | null
          created_at: string
          current_km: number
          id: string
          initial_km: number
          is_active: boolean
          max_km: number
          model: string
          nickname: string | null
          retired_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          current_km?: number
          id?: string
          initial_km?: number
          is_active?: boolean
          max_km?: number
          model: string
          nickname?: string | null
          retired_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          current_km?: number
          id?: string
          initial_km?: number
          is_active?: boolean
          max_km?: number
          model?: string
          nickname?: string | null
          retired_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      strava_history_sync_items: {
        Row: {
          account_id: string
          created_at: string
          external_activity_id: string
          id: string
          last_error: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          external_activity_id: string
          id?: string
          last_error?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          external_activity_id?: string
          id?: string
          last_error?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "strava_history_sync_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "connected_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      strava_history_sync_states: {
        Row: {
          account_id: string
          completed_at: string | null
          created_at: string
          discovery_completed_at: string | null
          discovery_page: number | null
          imported_activities: number
          last_error: string | null
          next_page: number
          next_sync_at: string | null
          processed_activities: number
          scanned_activities: number
          total_activities: number
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          completed_at?: string | null
          created_at?: string
          discovery_completed_at?: string | null
          discovery_page?: number | null
          imported_activities?: number
          last_error?: string | null
          next_page?: number
          next_sync_at?: string | null
          processed_activities?: number
          scanned_activities?: number
          total_activities?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          completed_at?: string | null
          created_at?: string
          discovery_completed_at?: string | null
          discovery_page?: number | null
          imported_activities?: number
          last_error?: string | null
          next_page?: number
          next_sync_at?: string | null
          processed_activities?: number
          scanned_activities?: number
          total_activities?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "strava_history_sync_states_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "connected_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          platform: string
          product_id: string | null
          raw_payload: Json
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          platform: string
          product_id?: string | null
          raw_payload?: Json
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          platform?: string
          product_id?: string | null
          raw_payload?: Json
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      system_flags: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      training_plans: {
        Row: {
          blueprint: Json
          created_at: string
          days_per_week: number | null
          id: string
          objective: string | null
          plan_name: string
          quality: Json
          race_date: string | null
          race_distance_km: number | null
          race_name: string | null
          risk: Json
          start_date: string | null
          status: string
          terrain: string | null
          total_weeks: number | null
          updated_at: string
          user_data: Json
          user_id: string
          validation: Json
        }
        Insert: {
          blueprint?: Json
          created_at?: string
          days_per_week?: number | null
          id?: string
          objective?: string | null
          plan_name: string
          quality?: Json
          race_date?: string | null
          race_distance_km?: number | null
          race_name?: string | null
          risk?: Json
          start_date?: string | null
          status?: string
          terrain?: string | null
          total_weeks?: number | null
          updated_at?: string
          user_data?: Json
          user_id: string
          validation?: Json
        }
        Update: {
          blueprint?: Json
          created_at?: string
          days_per_week?: number | null
          id?: string
          objective?: string | null
          plan_name?: string
          quality?: Json
          race_date?: string | null
          race_distance_km?: number | null
          race_name?: string | null
          risk?: Json
          start_date?: string | null
          status?: string
          terrain?: string | null
          total_weeks?: number | null
          updated_at?: string
          user_data?: Json
          user_id?: string
          validation?: Json
        }
        Relationships: []
      }
      weekly_checkins: {
        Row: {
          adjustment: Json
          ai_analysis: Json
          created_at: string
          current_weight_kg: number | null
          fatigue_level: number | null
          feeling: string | null
          id: string
          invalidated: boolean
          invalidated_reason: string | null
          notes: string | null
          pain_level: number | null
          plan_id: string
          updated_at: string
          user_id: string
          week_number: number
        }
        Insert: {
          adjustment?: Json
          ai_analysis?: Json
          created_at?: string
          current_weight_kg?: number | null
          fatigue_level?: number | null
          feeling?: string | null
          id?: string
          invalidated?: boolean
          invalidated_reason?: string | null
          notes?: string | null
          pain_level?: number | null
          plan_id: string
          updated_at?: string
          user_id: string
          week_number: number
        }
        Update: {
          adjustment?: Json
          ai_analysis?: Json
          created_at?: string
          current_weight_kg?: number | null
          fatigue_level?: number | null
          feeling?: string | null
          id?: string
          invalidated?: boolean
          invalidated_reason?: string | null
          notes?: string | null
          pain_level?: number | null
          plan_id?: string
          updated_at?: string
          user_id?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "weekly_checkins_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_own_account: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
