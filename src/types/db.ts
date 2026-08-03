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
  public: {
    Tables: {
      brackets: {
        Row: {
          active: boolean
          basic_price: number
          display_order: number
          id: string
          is_enterprise: boolean
          label: string
          ordinal: number
          premium_price: number
          pro_price: number
          service_slug: string
        }
        Insert: {
          active?: boolean
          basic_price: number
          display_order?: number
          id?: string
          is_enterprise?: boolean
          label: string
          ordinal: number
          premium_price: number
          pro_price: number
          service_slug: string
        }
        Update: {
          active?: boolean
          basic_price?: number
          display_order?: number
          id?: string
          is_enterprise?: boolean
          label?: string
          ordinal?: number
          premium_price?: number
          pro_price?: number
          service_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "brackets_service_slug_fkey"
            columns: ["service_slug"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["slug"]
          },
        ]
      }
      client_org_members: {
        Row: {
          client_org_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          client_org_id: string
          created_at?: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          client_org_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_org_members_client_org_id_fkey"
            columns: ["client_org_id"]
            isOneToOne: false
            referencedRelation: "client_orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      client_orgs: {
        Row: {
          address: string | null
          business_reg_no: string | null
          client_type: string
          coida_no: string | null
          created_at: string
          display_name: string
          drive_folder_id: string | null
          drive_folder_url: string | null
          id: string
          income_tax_no: string | null
          karbon_client_id: string | null
          legal_name: string | null
          notes: string | null
          paye_no: string | null
          primary_contact_email: string
          primary_contact_name: string | null
          slug: string
          status: string
          uif_no: string | null
          updated_at: string
          vat_no: string | null
          xero_connected_at: string | null
          xero_refresh_token_encrypted: string | null
          xero_tenant_id: string | null
        }
        Insert: {
          address?: string | null
          business_reg_no?: string | null
          client_type?: string
          coida_no?: string | null
          created_at?: string
          display_name: string
          drive_folder_id?: string | null
          drive_folder_url?: string | null
          id?: string
          income_tax_no?: string | null
          karbon_client_id?: string | null
          legal_name?: string | null
          notes?: string | null
          paye_no?: string | null
          primary_contact_email: string
          primary_contact_name?: string | null
          slug: string
          status?: string
          uif_no?: string | null
          updated_at?: string
          vat_no?: string | null
          xero_connected_at?: string | null
          xero_refresh_token_encrypted?: string | null
          xero_tenant_id?: string | null
        }
        Update: {
          address?: string | null
          business_reg_no?: string | null
          client_type?: string
          coida_no?: string | null
          created_at?: string
          display_name?: string
          drive_folder_id?: string | null
          drive_folder_url?: string | null
          id?: string
          income_tax_no?: string | null
          karbon_client_id?: string | null
          legal_name?: string | null
          notes?: string | null
          paye_no?: string | null
          primary_contact_email?: string
          primary_contact_name?: string | null
          slug?: string
          status?: string
          uif_no?: string | null
          updated_at?: string
          vat_no?: string | null
          xero_connected_at?: string | null
          xero_refresh_token_encrypted?: string | null
          xero_tenant_id?: string | null
        }
        Relationships: []
      }
      data_requests: {
        Row: {
          confirmed_at: string | null
          consent_language: string
          consent_version: string
          created_at: string
          email: string
          id: string
          ip_address: string | null
          notes: string | null
          processed_at: string | null
          request_type: string
          status: string
          token: string
          token_expires_at: string
          user_agent: string | null
        }
        Insert: {
          confirmed_at?: string | null
          consent_language?: string
          consent_version?: string
          created_at?: string
          email: string
          id?: string
          ip_address?: string | null
          notes?: string | null
          processed_at?: string | null
          request_type: string
          status?: string
          token: string
          token_expires_at: string
          user_agent?: string | null
        }
        Update: {
          confirmed_at?: string | null
          consent_language?: string
          consent_version?: string
          created_at?: string
          email?: string
          id?: string
          ip_address?: string | null
          notes?: string | null
          processed_at?: string | null
          request_type?: string
          status?: string
          token?: string
          token_expires_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      internal_users: {
        Row: {
          active: boolean
          created_at: string
          email: string
          full_name: string | null
          role: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          full_name?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          full_name?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount_zar: number
          client_org_id: string | null
          created_at: string
          id: string
          paid_at: string | null
          paystack_reference: string | null
          period_end: string | null
          period_start: string | null
          status: string
          subscription_id: string
        }
        Insert: {
          amount_zar: number
          client_org_id?: string | null
          created_at?: string
          id?: string
          paid_at?: string | null
          paystack_reference?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string
          subscription_id: string
        }
        Update: {
          amount_zar?: number
          client_org_id?: string | null
          created_at?: string
          id?: string
          paid_at?: string | null
          paystack_reference?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_org_id_fkey"
            columns: ["client_org_id"]
            isOneToOne: false
            referencedRelation: "client_orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      karbon_tasks_cache: {
        Row: {
          assignee: string | null
          client_org_id: string
          created_at: string
          deep_link_url: string | null
          due_date: string | null
          id: string
          karbon_work_item_id: string
          raw_payload: Json | null
          status: string | null
          synced_at: string
          title: string
        }
        Insert: {
          assignee?: string | null
          client_org_id: string
          created_at?: string
          deep_link_url?: string | null
          due_date?: string | null
          id?: string
          karbon_work_item_id: string
          raw_payload?: Json | null
          status?: string | null
          synced_at?: string
          title: string
        }
        Update: {
          assignee?: string | null
          client_org_id?: string
          created_at?: string
          deep_link_url?: string | null
          due_date?: string | null
          id?: string
          karbon_work_item_id?: string
          raw_payload?: Json | null
          status?: string | null
          synced_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "karbon_tasks_cache_client_org_id_fkey"
            columns: ["client_org_id"]
            isOneToOne: false
            referencedRelation: "client_orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          business: string | null
          config: Json | null
          consent_given: boolean
          consent_language: string
          consent_timestamp: string | null
          consent_version: string
          created_at: string
          email: string
          id: string
          message: string | null
          name: string
          phone: string | null
          source: string
          status: string
        }
        Insert: {
          business?: string | null
          config?: Json | null
          consent_given?: boolean
          consent_language?: string
          consent_timestamp?: string | null
          consent_version?: string
          created_at?: string
          email: string
          id?: string
          message?: string | null
          name: string
          phone?: string | null
          source: string
          status?: string
        }
        Update: {
          business?: string | null
          config?: Json | null
          consent_given?: boolean
          consent_language?: string
          consent_timestamp?: string | null
          consent_version?: string
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          name?: string
          phone?: string | null
          source?: string
          status?: string
        }
        Relationships: []
      }
      proposal_ref_counters: {
        Row: {
          last_seq: number
          period: string
        }
        Insert: {
          last_seq?: number
          period: string
        }
        Update: {
          last_seq?: number
          period?: string
        }
        Relationships: []
      }
      proposals: {
        Row: {
          addons: Json
          brackets: Json
          business_name: string
          client_org_id: string | null
          consent_language: string
          consent_version: string
          created_at: string
          discount_pct: number | null
          email: string
          expires_at: string | null
          first_name: string
          id: string
          ip_address: string | null
          last_name: string
          lead_id: string | null
          monthly_total_zar: number
          payment_provider: string | null
          payment_ref: string | null
          pending_signature_image: string | null
          pending_signature_ip: string | null
          pending_signature_method: string | null
          pending_signature_name: string | null
          proposal_pdf_drive_id: string | null
          ref_number: string | null
          sent_at: string
          services: string[]
          sign_confirm_expires_at: string | null
          sign_confirm_token: string | null
          signature_image: string | null
          signature_ip: string | null
          signature_method: string | null
          signature_name: string | null
          signed_at: string | null
          signed_email_sent_at: string | null
          status: string
          superseded_by_id: string | null
          supersedes_id: string | null
          tier_slug: string
          token: string
          total_charge_zar: number
          user_agent: string | null
          vat_zar: number
          version: number
          viewed_at: string | null
        }
        Insert: {
          addons?: Json
          brackets: Json
          business_name: string
          client_org_id?: string | null
          consent_language?: string
          consent_version?: string
          created_at?: string
          discount_pct?: number | null
          email: string
          expires_at?: string | null
          first_name: string
          id?: string
          ip_address?: string | null
          last_name: string
          lead_id?: string | null
          monthly_total_zar: number
          payment_provider?: string | null
          payment_ref?: string | null
          pending_signature_image?: string | null
          pending_signature_ip?: string | null
          pending_signature_method?: string | null
          pending_signature_name?: string | null
          proposal_pdf_drive_id?: string | null
          ref_number?: string | null
          sent_at?: string
          services: string[]
          sign_confirm_expires_at?: string | null
          sign_confirm_token?: string | null
          signature_image?: string | null
          signature_ip?: string | null
          signature_method?: string | null
          signature_name?: string | null
          signed_at?: string | null
          signed_email_sent_at?: string | null
          status?: string
          superseded_by_id?: string | null
          supersedes_id?: string | null
          tier_slug: string
          token: string
          total_charge_zar: number
          user_agent?: string | null
          vat_zar: number
          version?: number
          viewed_at?: string | null
        }
        Update: {
          addons?: Json
          brackets?: Json
          business_name?: string
          client_org_id?: string | null
          consent_language?: string
          consent_version?: string
          created_at?: string
          discount_pct?: number | null
          email?: string
          expires_at?: string | null
          first_name?: string
          id?: string
          ip_address?: string | null
          last_name?: string
          lead_id?: string | null
          monthly_total_zar?: number
          payment_provider?: string | null
          payment_ref?: string | null
          pending_signature_image?: string | null
          pending_signature_ip?: string | null
          pending_signature_method?: string | null
          pending_signature_name?: string | null
          proposal_pdf_drive_id?: string | null
          ref_number?: string | null
          sent_at?: string
          services?: string[]
          sign_confirm_expires_at?: string | null
          sign_confirm_token?: string | null
          signature_image?: string | null
          signature_ip?: string | null
          signature_method?: string | null
          signature_name?: string | null
          signed_at?: string | null
          signed_email_sent_at?: string | null
          status?: string
          superseded_by_id?: string | null
          supersedes_id?: string | null
          tier_slug?: string
          token?: string
          total_charge_zar?: number
          user_agent?: string | null
          vat_zar?: number
          version?: number
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_client_org_id_fkey"
            columns: ["client_org_id"]
            isOneToOne: false
            referencedRelation: "client_orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_superseded_by_id_fkey"
            columns: ["superseded_by_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          bracket_unit_label: string
          created_at: string
          description: string | null
          display_order: number
          id: string
          name: string
          slug: string
        }
        Insert: {
          active?: boolean
          bracket_unit_label: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name: string
          slug: string
        }
        Update: {
          active?: boolean
          bracket_unit_label?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      shop_orders: {
        Row: {
          amount_zar: number
          client_org_id: string
          created_at: string
          id: string
          paid_at: string | null
          paystack_reference: string | null
          product_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_zar: number
          client_org_id: string
          created_at?: string
          id?: string
          paid_at?: string | null
          paystack_reference?: string | null
          product_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount_zar?: number
          client_org_id?: string
          created_at?: string
          id?: string
          paid_at?: string | null
          paystack_reference?: string | null
          product_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_orders_client_org_id_fkey"
            columns: ["client_org_id"]
            isOneToOne: false
            referencedRelation: "client_orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "shop_products"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_products: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          display_order: number
          id: string
          name: string
          price_zar: number
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name: string
          price_zar: number
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name?: string
          price_zar?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          brackets: Json
          business: string | null
          client_org_id: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          email: string
          full_name: string
          id: string
          monthly_total_zar: number
          paystack_authorization_url: string | null
          paystack_customer_code: string | null
          paystack_reference: string | null
          paystack_subscription_code: string | null
          plan_label: string | null
          services: string[]
          status: string
          tier_slug: string
          total_charge_zar: number
          updated_at: string
          vat_zar: number
        }
        Insert: {
          brackets: Json
          business?: string | null
          client_org_id?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          email: string
          full_name: string
          id?: string
          monthly_total_zar: number
          paystack_authorization_url?: string | null
          paystack_customer_code?: string | null
          paystack_reference?: string | null
          paystack_subscription_code?: string | null
          plan_label?: string | null
          services: string[]
          status?: string
          tier_slug: string
          total_charge_zar: number
          updated_at?: string
          vat_zar: number
        }
        Update: {
          brackets?: Json
          business?: string | null
          client_org_id?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          email?: string
          full_name?: string
          id?: string
          monthly_total_zar?: number
          paystack_authorization_url?: string | null
          paystack_customer_code?: string | null
          paystack_reference?: string | null
          paystack_subscription_code?: string | null
          plan_label?: string | null
          services?: string[]
          status?: string
          tier_slug?: string
          total_charge_zar?: number
          updated_at?: string
          vat_zar?: number
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_client_org_id_fkey"
            columns: ["client_org_id"]
            isOneToOne: false
            referencedRelation: "client_orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonials: {
        Row: {
          active: boolean
          avatar_url: string | null
          business: string | null
          created_at: string
          display_order: number
          id: string
          name: string
          quote: string
          role: string | null
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          business?: string | null
          created_at?: string
          display_order?: number
          id?: string
          name: string
          quote: string
          role?: string | null
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          business?: string | null
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          quote?: string
          role?: string | null
        }
        Relationships: []
      }
      tier_inclusions: {
        Row: {
          display_order: number
          id: string
          inclusion: string
          service_slug: string
          tier_slug: string
        }
        Insert: {
          display_order?: number
          id?: string
          inclusion: string
          service_slug: string
          tier_slug: string
        }
        Update: {
          display_order?: number
          id?: string
          inclusion?: string
          service_slug?: string
          tier_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "tier_inclusions_service_slug_fkey"
            columns: ["service_slug"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "tier_inclusions_tier_slug_fkey"
            columns: ["tier_slug"]
            isOneToOne: false
            referencedRelation: "tiers"
            referencedColumns: ["slug"]
          },
        ]
      }
      tiers: {
        Row: {
          active: boolean
          display_order: number
          id: string
          multiplier: number
          name: string
          slug: string
          tagline: string | null
        }
        Insert: {
          active?: boolean
          display_order?: number
          id?: string
          multiplier: number
          name: string
          slug: string
          tagline?: string | null
        }
        Update: {
          active?: boolean
          display_order?: number
          id?: string
          multiplier?: number
          name?: string
          slug?: string
          tagline?: string | null
        }
        Relationships: []
      }
      xero_snapshot_cache: {
        Row: {
          as_of_date: string
          client_org_id: string
          snapshot: Json
          synced_at: string
          updated_at: string
        }
        Insert: {
          as_of_date: string
          client_org_id: string
          snapshot: Json
          synced_at?: string
          updated_at?: string
        }
        Update: {
          as_of_date?: string
          client_org_id?: string
          snapshot?: Json
          synced_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "xero_snapshot_cache_client_org_id_fkey"
            columns: ["client_org_id"]
            isOneToOne: true
            referencedRelation: "client_orgs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_internal: { Args: { uid: string }; Returns: boolean }
      is_internal_admin: { Args: { uid: string }; Returns: boolean }
      is_org_member: { Args: { org_id: string }; Returns: boolean }
      next_proposal_ref: { Args: never; Returns: string }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
