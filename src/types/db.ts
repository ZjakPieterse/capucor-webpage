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
      audit_events: {
        Row: {
          action: string
          actor_email: string | null
          actor_kind: string
          client_org_id: string | null
          created_at: string
          detail: Json | null
          entity_id: string | null
          id: string
          occurred_at: string
          subject_id: string | null
          subject_table: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_kind?: string
          client_org_id?: string | null
          created_at?: string
          detail?: Json | null
          entity_id?: string | null
          id?: string
          occurred_at?: string
          subject_id?: string | null
          subject_table: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_kind?: string
          client_org_id?: string | null
          created_at?: string
          detail?: Json | null
          entity_id?: string | null
          id?: string
          occurred_at?: string
          subject_id?: string | null
          subject_table?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_client_org_id_fkey"
            columns: ["client_org_id"]
            isOneToOne: false
            referencedRelation: "client_orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
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
      contacts: {
        Row: {
          active: boolean
          client_org_id: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_primary: boolean
          notes: string | null
          phone: string | null
          receives_requests: boolean
          role_label: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          client_org_id: string
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_primary?: boolean
          notes?: string | null
          phone?: string | null
          receives_requests?: boolean
          role_label?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          client_org_id?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_primary?: boolean
          notes?: string | null
          phone?: string | null
          receives_requests?: boolean
          role_label?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_client_org_id_fkey"
            columns: ["client_org_id"]
            isOneToOne: false
            referencedRelation: "client_orgs"
            referencedColumns: ["id"]
          },
        ]
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
      email_deliveries: {
        Row: {
          accepted_at: string | null
          attempt_count: number
          created_at: string
          event_type: string
          failed_at: string | null
          id: string
          idempotency_key: string
          last_attempt_at: string | null
          last_error_code: string | null
          last_error_message: string | null
          lease_expires_at: string | null
          lease_token: string | null
          next_attempt_at: string
          provider_id: string | null
          recipient: string
          source_id: string
          source_type: string
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          attempt_count?: number
          created_at?: string
          event_type: string
          failed_at?: string | null
          id?: string
          idempotency_key: string
          last_attempt_at?: string | null
          last_error_code?: string | null
          last_error_message?: string | null
          lease_expires_at?: string | null
          lease_token?: string | null
          next_attempt_at?: string
          provider_id?: string | null
          recipient: string
          source_id: string
          source_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          attempt_count?: number
          created_at?: string
          event_type?: string
          failed_at?: string | null
          id?: string
          idempotency_key?: string
          last_attempt_at?: string | null
          last_error_code?: string | null
          last_error_message?: string | null
          lease_expires_at?: string | null
          lease_token?: string | null
          next_attempt_at?: string
          provider_id?: string | null
          recipient?: string
          source_id?: string
          source_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      entities: {
        Row: {
          cipc_ar_required: boolean
          client_org_id: string
          client_ref: string | null
          coida_no: string | null
          coida_registered: boolean
          created_at: string
          display_name: string
          drive_folder_id: string | null
          drive_folder_url: string | null
          entity_type: string
          financial_year_end_day: number | null
          financial_year_end_month: number | null
          id: string
          income_tax_no: string | null
          incorporation_date: string | null
          is_primary: boolean
          legal_name: string | null
          notes: string | null
          paye_no: string | null
          payroll_registered: boolean
          provisional_taxpayer: boolean
          registration_no: string | null
          status: string
          statutory_effective_from: string | null
          uif_no: string | null
          updated_at: string
          vat_category: string | null
          vat_no: string | null
          vat_registered: boolean
        }
        Insert: {
          cipc_ar_required?: boolean
          client_org_id: string
          client_ref?: string | null
          coida_no?: string | null
          coida_registered?: boolean
          created_at?: string
          display_name: string
          drive_folder_id?: string | null
          drive_folder_url?: string | null
          entity_type?: string
          financial_year_end_day?: number | null
          financial_year_end_month?: number | null
          id?: string
          income_tax_no?: string | null
          incorporation_date?: string | null
          is_primary?: boolean
          legal_name?: string | null
          notes?: string | null
          paye_no?: string | null
          payroll_registered?: boolean
          provisional_taxpayer?: boolean
          registration_no?: string | null
          status?: string
          statutory_effective_from?: string | null
          uif_no?: string | null
          updated_at?: string
          vat_category?: string | null
          vat_no?: string | null
          vat_registered?: boolean
        }
        Update: {
          cipc_ar_required?: boolean
          client_org_id?: string
          client_ref?: string | null
          coida_no?: string | null
          coida_registered?: boolean
          created_at?: string
          display_name?: string
          drive_folder_id?: string | null
          drive_folder_url?: string | null
          entity_type?: string
          financial_year_end_day?: number | null
          financial_year_end_month?: number | null
          id?: string
          income_tax_no?: string | null
          incorporation_date?: string | null
          is_primary?: boolean
          legal_name?: string | null
          notes?: string | null
          paye_no?: string | null
          payroll_registered?: boolean
          provisional_taxpayer?: boolean
          registration_no?: string | null
          status?: string
          statutory_effective_from?: string | null
          uif_no?: string | null
          updated_at?: string
          vat_category?: string | null
          vat_no?: string | null
          vat_registered?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "entities_client_org_id_fkey"
            columns: ["client_org_id"]
            isOneToOne: false
            referencedRelation: "client_orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_contacts: {
        Row: {
          client_org_id: string
          contact_id: string
          created_at: string
          entity_id: string
          id: string
          relationship: string
        }
        Insert: {
          client_org_id: string
          contact_id: string
          created_at?: string
          entity_id: string
          id?: string
          relationship?: string
        }
        Update: {
          client_org_id?: string
          contact_id?: string
          created_at?: string
          entity_id?: string
          id?: string
          relationship?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_contacts_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_ref_counters: {
        Row: {
          last_seq: number
          series: string
        }
        Insert: {
          last_seq?: number
          series: string
        }
        Update: {
          last_seq?: number
          series?: string
        }
        Relationships: []
      }
      entity_statutory_periods: {
        Row: {
          cipc_ar_required: boolean
          client_org_id: string
          coida_registered: boolean
          created_at: string
          effective_from: string
          effective_to: string | null
          entity_id: string
          financial_year_end_day: number | null
          financial_year_end_month: number | null
          id: string
          origin: string
          payroll_registered: boolean
          provisional_taxpayer: boolean
          updated_at: string
          vat_category: string | null
          vat_registered: boolean
        }
        Insert: {
          cipc_ar_required?: boolean
          client_org_id: string
          coida_registered?: boolean
          created_at?: string
          effective_from: string
          effective_to?: string | null
          entity_id: string
          financial_year_end_day?: number | null
          financial_year_end_month?: number | null
          id?: string
          origin?: string
          payroll_registered?: boolean
          provisional_taxpayer?: boolean
          updated_at?: string
          vat_category?: string | null
          vat_registered?: boolean
        }
        Update: {
          cipc_ar_required?: boolean
          client_org_id?: string
          coida_registered?: boolean
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          entity_id?: string
          financial_year_end_day?: number | null
          financial_year_end_month?: number | null
          id?: string
          origin?: string
          payroll_registered?: boolean
          provisional_taxpayer?: boolean
          updated_at?: string
          vat_category?: string | null
          vat_registered?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "entity_statutory_periods_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_accounts: {
        Row: {
          account_kind: string
          account_last4: string | null
          active: boolean
          active_from: string | null
          active_to: string | null
          client_org_id: string
          created_at: string
          entity_id: string
          id: string
          institution: string
          label: string
          notes: string | null
          requires_statement: boolean
          statement_cadence: string
          updated_at: string
        }
        Insert: {
          account_kind?: string
          account_last4?: string | null
          active?: boolean
          active_from?: string | null
          active_to?: string | null
          client_org_id: string
          created_at?: string
          entity_id: string
          id?: string
          institution: string
          label: string
          notes?: string | null
          requires_statement?: boolean
          statement_cadence?: string
          updated_at?: string
        }
        Update: {
          account_kind?: string
          account_last4?: string | null
          active?: boolean
          active_from?: string | null
          active_to?: string | null
          client_org_id?: string
          created_at?: string
          entity_id?: string
          id?: string
          institution?: string
          label?: string
          notes?: string | null
          requires_statement?: boolean
          statement_cadence?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_accounts_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_users: {
        Row: {
          active: boolean
          created_at: string
          email: string
          full_name: string | null
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          role?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_users_role_fkey"
            columns: ["role"]
            isOneToOne: false
            referencedRelation: "staff_roles"
            referencedColumns: ["code"]
          },
        ]
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
      practice_services: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string | null
          display_order: number
          name: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description?: string | null
          display_order?: number
          name: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string | null
          display_order?: number
          name?: string
        }
        Relationships: []
      }
      proposal_fulfilment: {
        Row: {
          client_email_accepted_at: string | null
          client_email_attempt_count: number
          client_email_delivery_id: string | null
          client_email_status: string
          completed_at: string | null
          created_at: string
          last_error_code: string | null
          last_error_message: string | null
          last_error_stage: string | null
          lease_expires_at: string | null
          lease_token: string | null
          next_attempt_at: string
          owner_email_accepted_at: string | null
          owner_email_attempt_count: number
          owner_email_delivery_id: string | null
          owner_email_status: string
          pdf_attempt_count: number
          pdf_completed_at: string | null
          pdf_status: string
          portal_attempt_count: number
          portal_completed_at: string | null
          portal_status: string
          proposal_id: string
          updated_at: string
        }
        Insert: {
          client_email_accepted_at?: string | null
          client_email_attempt_count?: number
          client_email_delivery_id?: string | null
          client_email_status?: string
          completed_at?: string | null
          created_at?: string
          last_error_code?: string | null
          last_error_message?: string | null
          last_error_stage?: string | null
          lease_expires_at?: string | null
          lease_token?: string | null
          next_attempt_at?: string
          owner_email_accepted_at?: string | null
          owner_email_attempt_count?: number
          owner_email_delivery_id?: string | null
          owner_email_status?: string
          pdf_attempt_count?: number
          pdf_completed_at?: string | null
          pdf_status?: string
          portal_attempt_count?: number
          portal_completed_at?: string | null
          portal_status?: string
          proposal_id: string
          updated_at?: string
        }
        Update: {
          client_email_accepted_at?: string | null
          client_email_attempt_count?: number
          client_email_delivery_id?: string | null
          client_email_status?: string
          completed_at?: string | null
          created_at?: string
          last_error_code?: string | null
          last_error_message?: string | null
          last_error_stage?: string | null
          lease_expires_at?: string | null
          lease_token?: string | null
          next_attempt_at?: string
          owner_email_accepted_at?: string | null
          owner_email_attempt_count?: number
          owner_email_delivery_id?: string | null
          owner_email_status?: string
          pdf_attempt_count?: number
          pdf_completed_at?: string | null
          pdf_status?: string
          portal_attempt_count?: number
          portal_completed_at?: string | null
          portal_status?: string
          proposal_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_fulfilment_client_email_delivery_id_fkey"
            columns: ["client_email_delivery_id"]
            isOneToOne: false
            referencedRelation: "email_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_fulfilment_owner_email_delivery_id_fkey"
            columns: ["owner_email_delivery_id"]
            isOneToOne: false
            referencedRelation: "email_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_fulfilment_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: true
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
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
      service_assignments: {
        Row: {
          client_org_id: string
          created_at: string
          ended_on: string | null
          entity_id: string
          frequency: string
          id: string
          notes: string | null
          service_code: string
          started_on: string | null
          status: string
          updated_at: string
        }
        Insert: {
          client_org_id: string
          created_at?: string
          ended_on?: string | null
          entity_id: string
          frequency?: string
          id?: string
          notes?: string | null
          service_code: string
          started_on?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          client_org_id?: string
          created_at?: string
          ended_on?: string | null
          entity_id?: string
          frequency?: string
          id?: string
          notes?: string | null
          service_code?: string
          started_on?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_assignments_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_assignments_service_code_fkey"
            columns: ["service_code"]
            isOneToOne: false
            referencedRelation: "practice_services"
            referencedColumns: ["code"]
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
      staff_capabilities: {
        Row: {
          code: string
          created_at: string
          description: string | null
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          label: string
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      staff_client_grants: {
        Row: {
          all_clients: boolean
          client_org_id: string | null
          created_at: string
          granted_at: string
          granted_by: string | null
          id: string
          note: string | null
          staff_user_id: string
        }
        Insert: {
          all_clients?: boolean
          client_org_id?: string | null
          created_at?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          note?: string | null
          staff_user_id: string
        }
        Update: {
          all_clients?: boolean
          client_org_id?: string | null
          created_at?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          note?: string | null
          staff_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_client_grants_client_org_id_fkey"
            columns: ["client_org_id"]
            isOneToOne: false
            referencedRelation: "client_orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_client_grants_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "internal_users"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_role_capabilities: {
        Row: {
          capability_code: string
          role_code: string
        }
        Insert: {
          capability_code: string
          role_code: string
        }
        Update: {
          capability_code?: string
          role_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_role_capabilities_capability_code_fkey"
            columns: ["capability_code"]
            isOneToOne: false
            referencedRelation: "staff_capabilities"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "staff_role_capabilities_role_code_fkey"
            columns: ["role_code"]
            isOneToOne: false
            referencedRelation: "staff_roles"
            referencedColumns: ["code"]
          },
        ]
      }
      staff_roles: {
        Row: {
          code: string
          created_at: string
          description: string | null
          label: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          label: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          label?: string
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
      claim_proposal_fulfilment_stage: {
        Args: {
          p_lease_expires_at: string
          p_lease_token: string
          p_proposal_id: string
        }
        Returns: {
          attempt_count: number
          proposal_id: string
          stage: string
        }[]
      }
      commit_proposal_signature: {
        Args: {
          p_confirm_token: string
          p_proposal_id: string
          p_signed_at: string
        }
        Returns: {
          proposal_id: string
        }[]
      }
      create_proposal_amendment: {
        Args: {
          p_addons: Json
          p_brackets: Json
          p_business_name: string
          p_email: string
          p_expires_at: string
          p_first_name: string
          p_last_name: string
          p_monthly_total_zar: number
          p_original_id: string
          p_sent_at: string
          p_services: string[]
          p_tier_slug: string
          p_token: string
          p_total_charge_zar: number
          p_vat_zar: number
        }
        Returns: {
          proposal_business_name: string
          proposal_email: string
          proposal_first_name: string
          proposal_id: string
          proposal_monthly_total_zar: number
          proposal_ref_number: string
          proposal_token: string
          proposal_version: number
          reused: boolean
        }[]
      }
      entity_statutory_captured: {
        Args: {
          p_cipc_ar_required: boolean
          p_coida_registered: boolean
          p_financial_year_end_day: number
          p_financial_year_end_month: number
          p_payroll_registered: boolean
          p_provisional_taxpayer: boolean
          p_vat_category: string
          p_vat_registered: boolean
        }
        Returns: boolean
      }
      finish_proposal_fulfilment_stage: {
        Args: {
          p_delivery_id?: string
          p_error_code?: string
          p_error_message?: string
          p_finished_at: string
          p_lease_token: string
          p_next_attempt_at?: string
          p_outcome: string
          p_proposal_id: string
          p_stage: string
        }
        Returns: boolean
      }
      has_capability: { Args: { cap: string; uid: string }; Returns: boolean }
      has_client_access: {
        Args: { org_id: string; uid: string }
        Returns: boolean
      }
      is_internal: { Args: { uid: string }; Returns: boolean }
      is_internal_admin: { Args: { uid: string }; Returns: boolean }
      is_org_member: { Args: { org_id: string }; Returns: boolean }
      next_entity_ref: { Args: never; Returns: string }
      next_proposal_ref: { Args: never; Returns: string }
      provision_from_signed_proposal: {
        Args: { p_org_slug: string; p_proposal_id: string; p_user_id: string }
        Returns: {
          already_provisioned: boolean
          membership_created: boolean
          membership_id: string
          org_created: boolean
          org_id: string
          proposal_id: string
          subscription_created: boolean
          subscription_id: string
          user_id: string
        }[]
      }
      start_proposal_resend: {
        Args: {
          p_expires_at: string
          p_proposal_id: string
          p_sent_at: string
          p_token: string
        }
        Returns: {
          delivery_id: string
          delivery_idempotency_key: string
          proposal_business_name: string
          proposal_email: string
          proposal_first_name: string
          proposal_id: string
          proposal_monthly_total_zar: number
          proposal_ref_number: string
          proposal_token: string
          reused: boolean
        }[]
      }
      sync_proposal_fulfilment_email: {
        Args: { p_delivery_id: string }
        Returns: boolean
      }
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
