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
    PostgrestVersion: "14.18"
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
      audit_events: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          id: number
          new_data: Json | null
          old_data: Json | null
          organization_id: string
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          organization_id: string
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          organization_id?: string
          record_id?: string | null
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          alt_phone: string | null
          archived_at: string | null
          created_at: string
          created_by: string | null
          email: string | null
          emergency_contact: string | null
          first_name: string
          home_location_id: string | null
          id: string
          last_name: string
          notes: string | null
          organization_id: string
          phone: string | null
          preferred_contact:
            | Database["public"]["Enums"]["contact_method"]
            | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          alt_phone?: string | null
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          emergency_contact?: string | null
          first_name: string
          home_location_id?: string | null
          id?: string
          last_name?: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          preferred_contact?:
            | Database["public"]["Enums"]["contact_method"]
            | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          alt_phone?: string | null
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          emergency_contact?: string | null
          first_name?: string
          home_location_id?: string | null
          id?: string
          last_name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          preferred_contact?:
            | Database["public"]["Enums"]["contact_method"]
            | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_organization_id_home_location_id_fkey"
            columns: ["organization_id", "home_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      grooming_visits: {
        Row: {
          behavior: Database["public"]["Enums"]["visit_behavior"] | null
          correction_reason: string | null
          corrects_visit_id: string | null
          created_at: string
          created_by: string | null
          cut_details: string | null
          groomer_member_id: string | null
          id: string
          location_id: string
          notes: string | null
          organization_id: string
          pet_id: string
          pet_size: Database["public"]["Enums"]["pet_size"] | null
          services: string | null
          visited_on: string
          voided: boolean
          weight_lbs: number | null
        }
        Insert: {
          behavior?: Database["public"]["Enums"]["visit_behavior"] | null
          correction_reason?: string | null
          corrects_visit_id?: string | null
          created_at?: string
          created_by?: string | null
          cut_details?: string | null
          groomer_member_id?: string | null
          id?: string
          location_id: string
          notes?: string | null
          organization_id: string
          pet_id: string
          pet_size?: Database["public"]["Enums"]["pet_size"] | null
          services?: string | null
          visited_on: string
          voided?: boolean
          weight_lbs?: number | null
        }
        Update: {
          behavior?: Database["public"]["Enums"]["visit_behavior"] | null
          correction_reason?: string | null
          corrects_visit_id?: string | null
          created_at?: string
          created_by?: string | null
          cut_details?: string | null
          groomer_member_id?: string | null
          id?: string
          location_id?: string
          notes?: string | null
          organization_id?: string
          pet_id?: string
          pet_size?: Database["public"]["Enums"]["pet_size"] | null
          services?: string | null
          visited_on?: string
          voided?: boolean
          weight_lbs?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "grooming_visits_organization_id_corrects_visit_id_fkey"
            columns: ["organization_id", "corrects_visit_id"]
            isOneToOne: false
            referencedRelation: "grooming_visits"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "grooming_visits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grooming_visits_organization_id_groomer_member_id_fkey"
            columns: ["organization_id", "groomer_member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "grooming_visits_organization_id_location_id_fkey"
            columns: ["organization_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "grooming_visits_organization_id_pet_id_fkey"
            columns: ["organization_id", "pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      invitation_locations: {
        Row: {
          invitation_id: string
          location_id: string
          organization_id: string
        }
        Insert: {
          invitation_id: string
          location_id: string
          organization_id: string
        }
        Update: {
          invitation_id?: string
          location_id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitation_locations_organization_id_invitation_id_fkey"
            columns: ["organization_id", "invitation_id"]
            isOneToOne: false
            referencedRelation: "invitations"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "invitation_locations_organization_id_location_id_fkey"
            columns: ["organization_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          all_locations: boolean
          created_at: string
          declined_at: string | null
          display_name: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          organization_id: string
          revoked_at: string | null
          role: Database["public"]["Enums"]["member_role"]
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          all_locations?: boolean
          created_at?: string
          declined_at?: string | null
          display_name?: string | null
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id: string
          revoked_at?: string | null
          role: Database["public"]["Enums"]["member_role"]
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          all_locations?: boolean
          created_at?: string
          declined_at?: string | null
          display_name?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          archived_at: string | null
          created_at: string
          id: string
          name: string
          organization_id: string
          phone: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          archived_at?: string | null
          created_at?: string
          id?: string
          name: string
          organization_id: string
          phone?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          archived_at?: string | null
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          phone?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      member_locations: {
        Row: {
          created_at: string
          created_by: string | null
          location_id: string
          member_id: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          location_id: string
          member_id: string
          organization_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          location_id?: string
          member_id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_locations_organization_id_location_id_fkey"
            columns: ["organization_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "member_locations_organization_id_member_id_fkey"
            columns: ["organization_id", "member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      organization_members: {
        Row: {
          all_locations: boolean
          created_at: string
          deactivated_at: string | null
          display_name: string | null
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["member_role"]
          status: Database["public"]["Enums"]["member_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          all_locations?: boolean
          created_at?: string
          deactivated_at?: string | null
          display_name?: string | null
          id?: string
          organization_id: string
          role: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          all_locations?: boolean
          created_at?: string
          deactivated_at?: string | null
          display_name?: string | null
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      pet_vaccinations: {
        Row: {
          created_at: string
          created_by: string | null
          expires_on: string
          given_on: string | null
          id: string
          notes: string | null
          organization_id: string
          pet_id: string
          removed_at: string | null
          updated_at: string
          vaccine: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_on: string
          given_on?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          pet_id: string
          removed_at?: string | null
          updated_at?: string
          vaccine: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_on?: string
          given_on?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          pet_id?: string
          removed_at?: string | null
          updated_at?: string
          vaccine?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "pet_vaccinations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_vaccinations_organization_id_pet_id_fkey"
            columns: ["organization_id", "pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      pets: {
        Row: {
          allergies: string | null
          archived_at: string | null
          birth_date: string | null
          breed: string | null
          client_id: string
          coat: string | null
          color: string | null
          created_at: string
          created_by: string | null
          fixed: boolean | null
          grooming_instructions: string | null
          handle_with_care: boolean
          id: string
          medical_notes: string | null
          name: string
          organization_id: string
          sex: Database["public"]["Enums"]["pet_sex"]
          species: Database["public"]["Enums"]["pet_species"]
          temperament: string | null
          updated_at: string
          weight_lbs: number | null
        }
        Insert: {
          allergies?: string | null
          archived_at?: string | null
          birth_date?: string | null
          breed?: string | null
          client_id: string
          coat?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          fixed?: boolean | null
          grooming_instructions?: string | null
          handle_with_care?: boolean
          id?: string
          medical_notes?: string | null
          name: string
          organization_id: string
          sex?: Database["public"]["Enums"]["pet_sex"]
          species?: Database["public"]["Enums"]["pet_species"]
          temperament?: string | null
          updated_at?: string
          weight_lbs?: number | null
        }
        Update: {
          allergies?: string | null
          archived_at?: string | null
          birth_date?: string | null
          breed?: string | null
          client_id?: string
          coat?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          fixed?: boolean | null
          grooming_instructions?: string | null
          handle_with_care?: boolean
          id?: string
          medical_notes?: string | null
          name?: string
          organization_id?: string
          sex?: Database["public"]["Enums"]["pet_sex"]
          species?: Database["public"]["Enums"]["pet_species"]
          temperament?: string | null
          updated_at?: string
          weight_lbs?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pets_organization_id_client_id_fkey"
            columns: ["organization_id", "client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "pets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      service_breed_prices: {
        Row: {
          breed: string
          created_at: string
          id: string
          organization_id: string
          price_cents: number
          service_id: string
          updated_at: string
        }
        Insert: {
          breed: string
          created_at?: string
          id?: string
          organization_id: string
          price_cents: number
          service_id: string
          updated_at?: string
        }
        Update: {
          breed?: string
          created_at?: string
          id?: string
          organization_id?: string
          price_cents?: number
          service_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_breed_prices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_breed_prices_organization_id_service_id_fkey"
            columns: ["organization_id", "service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      services: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          large_price_cents: number | null
          medium_price_cents: number | null
          name: string
          organization_id: string
          price_cents: number | null
          pricing: Database["public"]["Enums"]["service_pricing"]
          retired_at: string | null
          small_price_cents: number | null
          updated_at: string
          xlarge_price_cents: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          large_price_cents?: number | null
          medium_price_cents?: number | null
          name: string
          organization_id: string
          price_cents?: number | null
          pricing?: Database["public"]["Enums"]["service_pricing"]
          retired_at?: string | null
          small_price_cents?: number | null
          updated_at?: string
          xlarge_price_cents?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          large_price_cents?: number | null
          medium_price_cents?: number | null
          name?: string
          organization_id?: string
          price_cents?: number | null
          pricing?: Database["public"]["Enums"]["service_pricing"]
          retired_at?: string | null
          small_price_cents?: number | null
          updated_at?: string
          xlarge_price_cents?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vaccination_documents: {
        Row: {
          content_type: string
          created_at: string
          file_name: string
          id: string
          organization_id: string
          pet_id: string
          removed_at: string | null
          size_bytes: number
          storage_path: string
          uploaded_by: string | null
          vaccination_id: string | null
        }
        Insert: {
          content_type: string
          created_at?: string
          file_name: string
          id?: string
          organization_id: string
          pet_id: string
          removed_at?: string | null
          size_bytes: number
          storage_path: string
          uploaded_by?: string | null
          vaccination_id?: string | null
        }
        Update: {
          content_type?: string
          created_at?: string
          file_name?: string
          id?: string
          organization_id?: string
          pet_id?: string
          removed_at?: string | null
          size_bytes?: number
          storage_path?: string
          uploaded_by?: string | null
          vaccination_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vaccination_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccination_documents_organization_id_pet_id_fkey"
            columns: ["organization_id", "pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "vaccination_documents_organization_id_vaccination_id_fkey"
            columns: ["organization_id", "vaccination_id"]
            isOneToOne: false
            referencedRelation: "pet_vaccinations"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      visit_photos: {
        Row: {
          content_type: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["visit_photo_kind"]
          organization_id: string
          pet_id: string
          removed_at: string | null
          size_bytes: number
          storage_path: string
          uploaded_by: string | null
          visit_id: string
        }
        Insert: {
          content_type: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["visit_photo_kind"]
          organization_id: string
          pet_id: string
          removed_at?: string | null
          size_bytes: number
          storage_path: string
          uploaded_by?: string | null
          visit_id: string
        }
        Update: {
          content_type?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["visit_photo_kind"]
          organization_id?: string
          pet_id?: string
          removed_at?: string | null
          size_bytes?: number
          storage_path?: string
          uploaded_by?: string | null
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_photos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_photos_organization_id_pet_id_fkey"
            columns: ["organization_id", "pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "visit_photos_organization_id_visit_id_fkey"
            columns: ["organization_id", "visit_id"]
            isOneToOne: false
            referencedRelation: "grooming_visits"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      visit_services: {
        Row: {
          created_at: string
          id: string
          list_price_cents: number | null
          name: string
          organization_id: string
          position: number
          price_cents: number
          service_id: string | null
          visit_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          list_price_cents?: number | null
          name: string
          organization_id: string
          position?: number
          price_cents: number
          service_id?: string | null
          visit_id: string
        }
        Update: {
          created_at?: string
          id?: string
          list_price_cents?: number | null
          name?: string
          organization_id?: string
          position?: number
          price_cents?: number
          service_id?: string | null
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_services_organization_id_service_id_fkey"
            columns: ["organization_id", "service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "visit_services_organization_id_visit_id_fkey"
            columns: ["organization_id", "visit_id"]
            isOneToOne: false
            referencedRelation: "grooming_visits"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { p_invitation_id: string }; Returns: string }
      create_organization: {
        Args: {
          p_display_name?: string
          p_location_name: string
          p_name: string
          p_timezone?: string
        }
        Returns: string
      }
      decline_invitation: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      invite_member: {
        Args: {
          p_all_locations?: boolean
          p_display_name?: string
          p_email: string
          p_location_ids?: string[]
          p_organization_id: string
          p_role: Database["public"]["Enums"]["member_role"]
        }
        Returns: string
      }
      my_invitations: {
        Args: never
        Returns: {
          expires_at: string
          id: string
          invited_by_name: string
          organization_id: string
          organization_name: string
          role: Database["public"]["Enums"]["member_role"]
        }[]
      }
      record_visit: {
        Args: {
          p_behavior?: Database["public"]["Enums"]["visit_behavior"]
          p_correction_reason?: string
          p_corrects_visit_id?: string
          p_cut_details?: string
          p_groomer_member_id?: string
          p_lines?: Json
          p_location_id: string
          p_notes?: string
          p_organization_id: string
          p_pet_id: string
          p_pet_size?: Database["public"]["Enums"]["pet_size"]
          p_services?: string
          p_visited_on: string
          p_voided?: boolean
          p_weight_lbs?: number
        }
        Returns: string
      }
      revoke_invitation: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      search_clients: {
        Args: {
          p_include_archived?: boolean
          p_organization_id: string
          p_query?: string
        }
        Returns: {
          archived_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          pets: Json
          phone: string
        }[]
      }
      set_client_archived: {
        Args: { p_archived: boolean; p_client_id: string }
        Returns: undefined
      }
      set_member_active: {
        Args: { p_active: boolean; p_member_id: string }
        Returns: undefined
      }
      set_pet_archived: {
        Args: { p_archived: boolean; p_pet_id: string }
        Returns: undefined
      }
      set_service_breed_prices: {
        Args: { p_prices: Json; p_service_id: string }
        Returns: undefined
      }
      team_directory: {
        Args: { p_organization_id: string }
        Returns: {
          all_locations: boolean
          display_name: string
          email: string
          joined_at: string
          location_ids: string[]
          member_id: string
          role: Database["public"]["Enums"]["member_role"]
          status: Database["public"]["Enums"]["member_status"]
          user_id: string
        }[]
      }
      update_member: {
        Args: {
          p_all_locations?: boolean
          p_location_ids?: string[]
          p_member_id: string
          p_role: Database["public"]["Enums"]["member_role"]
        }
        Returns: undefined
      }
      vaccines_due: {
        Args: { p_organization_id: string; p_within_days?: number }
        Returns: {
          client_first_name: string
          client_id: string
          client_last_name: string
          expires_on: string
          pet_id: string
          pet_name: string
          vaccine: string
        }[]
      }
    }
    Enums: {
      contact_method: "call" | "text" | "email"
      member_role:
        | "owner"
        | "admin"
        | "manager"
        | "groomer"
        | "bather"
        | "front_desk"
      member_status: "active" | "deactivated"
      pet_sex: "female" | "male" | "unknown"
      pet_size: "small" | "medium" | "large" | "xlarge"
      pet_species: "dog" | "cat" | "other"
      service_pricing: "flat" | "by_size"
      visit_behavior: "great" | "good" | "some_trouble" | "difficult"
      visit_photo_kind: "before" | "after" | "other"
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
    Enums: {
      contact_method: ["call", "text", "email"],
      member_role: [
        "owner",
        "admin",
        "manager",
        "groomer",
        "bather",
        "front_desk",
      ],
      member_status: ["active", "deactivated"],
      pet_sex: ["female", "male", "unknown"],
      pet_size: ["small", "medium", "large", "xlarge"],
      pet_species: ["dog", "cat", "other"],
      service_pricing: ["flat", "by_size"],
      visit_behavior: ["great", "good", "some_trouble", "difficult"],
      visit_photo_kind: ["before", "after", "other"],
    },
  },
} as const
