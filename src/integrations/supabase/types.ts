export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      attendance: {
        Row: {
          absent_reason: string | null;
          created_at: string;
          date: string;
          id: string;
          player_id: string;
          recorded_by: string | null;
          status: string;
          team_id: string;
          updated_at: string;
        };
        Insert: {
          absent_reason?: string | null;
          created_at?: string;
          date: string;
          id?: string;
          player_id: string;
          recorded_by?: string | null;
          status: string;
          team_id: string;
          updated_at?: string;
        };
        Update: {
          absent_reason?: string | null;
          created_at?: string;
          date?: string;
          id?: string;
          player_id?: string;
          recorded_by?: string | null;
          status?: string;
          team_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_channels: {
        Row: {
          channel_key: string;
          created_at: string;
          enabled: boolean;
          id: string;
          kind: string;
          status: string;
          team_id: string | null;
          updated_at: string;
        };
        Insert: {
          channel_key: string;
          created_at?: string;
          enabled?: boolean;
          id?: string;
          kind: string;
          status?: string;
          team_id?: string | null;
          updated_at?: string;
        };
        Update: {
          channel_key?: string;
          created_at?: string;
          enabled?: boolean;
          id?: string;
          kind?: string;
          status?: string;
          team_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_channels_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      club_events: {
        Row: {
          created_at: string;
          description: string | null;
          event_date: string;
          id: string;
          kind: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          event_date: string;
          id?: string;
          kind?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          event_date?: string;
          id?: string;
          kind?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      coach_teams: {
        Row: {
          created_at: string;
          id: string;
          team_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          team_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          team_id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      families_meta: {
        Row: {
          adult_pin: string | null;
          created_at: string;
          head_email: string | null;
          head_profile_id: string | null;
          id: string;
          reference_code: string | null;
          updated_at: string;
        };
        Insert: {
          adult_pin?: string | null;
          created_at?: string;
          head_email?: string | null;
          head_profile_id?: string | null;
          id?: string;
          reference_code?: string | null;
          updated_at?: string;
        };
        Update: {
          adult_pin?: string | null;
          created_at?: string;
          head_email?: string | null;
          head_profile_id?: string | null;
          id?: string;
          reference_code?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "families_meta_head_profile_id_fkey";
            columns: ["head_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      players: {
        Row: {
          avatar_url: string | null;
          birth_date: string | null;
          created_at: string;
          family_id: string | null;
          federativa_pdf_url: string | null;
          full_name: string;
          id: string;
          id_document_number: string | null;
          id_document_type: string | null;
          id_document_url: string | null;
          photo_url: string | null;
          team_id: string | null;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          birth_date?: string | null;
          created_at?: string;
          family_id?: string | null;
          federativa_pdf_url?: string | null;
          full_name: string;
          id?: string;
          id_document_number?: string | null;
          id_document_type?: string | null;
          id_document_url?: string | null;
          photo_url?: string | null;
          team_id?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          birth_date?: string | null;
          created_at?: string;
          family_id?: string | null;
          federativa_pdf_url?: string | null;
          full_name?: string;
          id?: string;
          id_document_number?: string | null;
          id_document_type?: string | null;
          id_document_url?: string | null;
          photo_url?: string | null;
          team_id?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "players_family_id_fkey";
            columns: ["family_id"];
            isOneToOne: false;
            referencedRelation: "families_meta";
            referencedColumns: ["id"];
          },
        ];
      };
      player_teams: {
        Row: {
          created_at: string;
          dorsal: number | null;
          id: string;
          player_id: string;
          team_id: string;
        };
        Insert: {
          created_at?: string;
          dorsal?: number | null;
          id?: string;
          player_id: string;
          team_id: string;
        };
        Update: {
          created_at?: string;
          dorsal?: number | null;
          id?: string;
          player_id?: string;
          team_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_teams_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_teams_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      convocatorias: {
        Row: {
          created_at: string;
          created_by: string | null;
          date: string;
          id: string;
          location: string | null;
          min_players: number | null;
          notes: string | null;
          team_id: string | null;
          time: string | null;
          type: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          date: string;
          id?: string;
          location?: string | null;
          min_players?: number | null;
          notes?: string | null;
          team_id?: string | null;
          time?: string | null;
          type?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          date?: string;
          id?: string;
          location?: string | null;
          min_players?: number | null;
          notes?: string | null;
          team_id?: string | null;
          time?: string | null;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "convocatorias_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      convocatoria_responses: {
        Row: {
          convocatoria_id: string;
          created_at: string;
          id: string;
          notes: string | null;
          player_id: string | null;
          problem_type: string | null;
          status: string;
        };
        Insert: {
          convocatoria_id: string;
          created_at?: string;
          id?: string;
          notes?: string | null;
          player_id?: string | null;
          problem_type?: string | null;
          status?: string;
        };
        Update: {
          convocatoria_id?: string;
          created_at?: string;
          id?: string;
          notes?: string | null;
          player_id?: string | null;
          problem_type?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "convocatoria_responses_convocatoria_id_fkey";
            columns: ["convocatoria_id"];
            isOneToOne: false;
            referencedRelation: "convocatorias";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "convocatoria_responses_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
        ];
      };
      convocatoria_extra_players: {
        Row: {
          convocatoria_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          player_id: string;
        };
        Insert: {
          convocatoria_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          player_id: string;
        };
        Update: {
          convocatoria_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          player_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "convocatoria_extra_players_convocatoria_id_fkey";
            columns: ["convocatoria_id"];
            isOneToOne: false;
            referencedRelation: "convocatorias";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "convocatoria_extra_players_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
        ];
      };
      equipment_sizes: {
        Row: {
          backpack_size: string | null;
          hoodie_size: string | null;
          player_id: string;
          polo_size: string | null;
          reversible_size: string | null;
          tracksuit_size: string | null;
          updated_at: string;
        };
        Insert: {
          backpack_size?: string | null;
          hoodie_size?: string | null;
          player_id: string;
          polo_size?: string | null;
          reversible_size?: string | null;
          tracksuit_size?: string | null;
          updated_at?: string;
        };
        Update: {
          backpack_size?: string | null;
          hoodie_size?: string | null;
          player_id?: string;
          polo_size?: string | null;
          reversible_size?: string | null;
          tracksuit_size?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "equipment_sizes_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: true;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          amount: number;
          created_at: string;
          family_id: string | null;
          id: string;
          paid_at: string | null;
          period: string;
          player_id: string | null;
          player_name: string | null;
          receipt_url: string | null;
          status: string;
        };
        Insert: {
          amount?: number;
          created_at?: string;
          family_id?: string | null;
          id?: string;
          paid_at?: string | null;
          period?: string;
          player_id?: string | null;
          player_name?: string | null;
          receipt_url?: string | null;
          status?: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          family_id?: string | null;
          id?: string;
          paid_at?: string | null;
          period?: string;
          player_id?: string | null;
          player_name?: string | null;
          receipt_url?: string | null;
          status?: string;
        };
        Relationships: [];
      };
      registrations: {
        Row: {
          auth_data_sharing: boolean | null;
          auth_image: boolean | null;
          auth_medical: boolean | null;
          auth_travel: boolean | null;
          birth_date: string | null;
          created_at: string;
          dni_back_status: string | null;
          dni_back_url: string | null;
          dni_front_status: string | null;
          dni_front_url: string | null;
          doc_number: string | null;
          doc_status: string | null;
          doc_type: string | null;
          email: string | null;
          family_id: string | null;
          federativa_pdf_url: string | null;
          federativa_status: string | null;
          full_name: string | null;
          id: string;
          parent_registration_id: string | null;
          phone: string | null;
          photo_status: string | null;
          photo_url: string | null;
          reject_reason: string | null;
          signature_status: string | null;
          signature_url: string | null;
          type: string;
          user_id: string | null;
        };
        Insert: {
          auth_data_sharing?: boolean | null;
          auth_image?: boolean | null;
          auth_medical?: boolean | null;
          auth_travel?: boolean | null;
          birth_date?: string | null;
          created_at?: string;
          dni_back_status?: string | null;
          dni_back_url?: string | null;
          dni_front_status?: string | null;
          dni_front_url?: string | null;
          doc_number?: string | null;
          doc_status?: string | null;
          doc_type?: string | null;
          email?: string | null;
          family_id?: string | null;
          federativa_pdf_url?: string | null;
          federativa_status?: string | null;
          full_name?: string | null;
          id?: string;
          parent_registration_id?: string | null;
          phone?: string | null;
          photo_status?: string | null;
          photo_url?: string | null;
          reject_reason?: string | null;
          signature_status?: string | null;
          signature_url?: string | null;
          type: string;
          user_id?: string | null;
        };
        Update: {
          auth_data_sharing?: boolean | null;
          auth_image?: boolean | null;
          auth_medical?: boolean | null;
          auth_travel?: boolean | null;
          birth_date?: string | null;
          created_at?: string;
          dni_back_status?: string | null;
          dni_back_url?: string | null;
          dni_front_status?: string | null;
          dni_front_url?: string | null;
          doc_number?: string | null;
          doc_status?: string | null;
          doc_type?: string | null;
          email?: string | null;
          family_id?: string | null;
          federativa_pdf_url?: string | null;
          federativa_status?: string | null;
          full_name?: string | null;
          id?: string;
          parent_registration_id?: string | null;
          phone?: string | null;
          photo_status?: string | null;
          photo_url?: string | null;
          reject_reason?: string | null;
          signature_status?: string | null;
          signature_url?: string | null;
          type?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      private_messages: {
        Row: {
          created_at: string;
          id: string;
          is_read: boolean;
          message_text: string;
          receiver_family_id: string;
          sender_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_read?: boolean;
          message_text: string;
          receiver_family_id: string;
          sender_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_read?: boolean;
          message_text?: string;
          receiver_family_id?: string;
          sender_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "private_messages_receiver_family_id_fkey";
            columns: ["receiver_family_id"];
            isOneToOne: false;
            referencedRelation: "families_meta";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string;
          full_name: string | null;
          id: string;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email: string;
          full_name?: string | null;
          id: string;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string;
          full_name?: string | null;
          id?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      standings: {
        Row: {
          id: string;
          losses: number;
          opponent_name: string;
          points: number;
          position: number;
          team_id: string;
          updated_at: string;
          wins: number;
        };
        Insert: {
          id?: string;
          losses?: number;
          opponent_name: string;
          points?: number;
          position?: number;
          team_id: string;
          updated_at?: string;
          wins?: number;
        };
        Update: {
          id?: string;
          losses?: number;
          opponent_name?: string;
          points?: number;
          position?: number;
          team_id?: string;
          updated_at?: string;
          wins?: number;
        };
        Relationships: [
          {
            foreignKeyName: "standings_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      team_messages: {
        Row: {
          channel_type: string;
          created_at: string;
          id: string;
          message_text: string;
          sender_id: string;
          sender_name: string;
          team_id: string | null;
        };
        Insert: {
          channel_type: string;
          created_at?: string;
          id?: string;
          message_text: string;
          sender_id: string;
          sender_name: string;
          team_id?: string | null;
        };
        Update: {
          channel_type?: string;
          created_at?: string;
          id?: string;
          message_text?: string;
          sender_id?: string;
          sender_name?: string;
          team_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "team_messages_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      teams: {
        Row: {
          age_category: string | null;
          category: string;
          created_at: string;
          id: string;
          name: string;
          travels: boolean;
          updated_at: string;
        };
        Insert: {
          age_category?: string | null;
          category: string;
          created_at?: string;
          id?: string;
          name: string;
          travels?: boolean;
          updated_at?: string;
        };
        Update: {
          age_category?: string | null;
          category?: string;
          created_at?: string;
          id?: string;
          name?: string;
          travels?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      compute_family_reference_code: {
        Args: { _family_id: string };
        Returns: string;
      };
      derive_age_category: { Args: { _category: string }; Returns: string };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      user_can_access_team_channel: {
        Args: { _channel: string; _team_id: string; _user_id: string };
        Returns: boolean;
      };
      set_self_registration_role: {
        Args: { _role: string };
        Returns: undefined;
      };
      set_player_dorsal: {
        Args: { _player_id: string; _team_id: string; _dorsal: number };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: "admin" | "coach" | "parent" | "player" | "family" | "senior" | "staff";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "coach", "parent", "player", "family", "senior", "staff"],
    },
  },
} as const;
