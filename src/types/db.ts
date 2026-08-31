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
      approvals: {
        Row: {
          addressee_staff_user_id: string
          client_org_id: string
          decided_at: string | null
          decided_by: string | null
          decision: string | null
          decision_channel: string
          id: string
          reason_code: string
          requested_at: string
          requested_by: string
          work_item_id: string
        }
        Insert: {
          addressee_staff_user_id: string
          client_org_id: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          decision_channel?: string
          id?: string
          reason_code: string
          requested_at?: string
          requested_by: string
          work_item_id: string
        }
        Update: {
          addressee_staff_user_id?: string
          client_org_id?: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          decision_channel?: string
          id?: string
          reason_code?: string
          requested_at?: string
          requested_by?: string
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_addressee_staff_user_id_fkey"
            columns: ["addressee_staff_user_id"]
            isOneToOne: false
            referencedRelation: "internal_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_client_org_id_fkey"
            columns: ["client_org_id"]
            isOneToOne: false
            referencedRelation: "client_orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "internal_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_work_item_client_org_fkey"
            columns: ["work_item_id", "client_org_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id", "client_org_id"]
          },
        ]
      }
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
      change_records: {
        Row: {
          actor_email: string | null
          actor_kind: string
          client_org_id: string | null
          created_at: string
          effective_from: string | null
          entity_id: string | null
          field: string
          id: string
          new_value: string | null
          occurred_at: string
          previous_value: string | null
          source: string
          subject_id: string | null
          subject_table: string
        }
        Insert: {
          actor_email?: string | null
          actor_kind?: string
          client_org_id?: string | null
          created_at?: string
          effective_from?: string | null
          entity_id?: string | null
          field: string
          id?: string
          new_value?: string | null
          occurred_at?: string
          previous_value?: string | null
          source?: string
          subject_id?: string | null
          subject_table: string
        }
        Update: {
          actor_email?: string | null
          actor_kind?: string
          client_org_id?: string | null
          created_at?: string
          effective_from?: string | null
          entity_id?: string | null
          field?: string
          id?: string
          new_value?: string | null
          occurred_at?: string
          previous_value?: string | null
          source?: string
          subject_id?: string | null
          subject_table?: string
        }
        Relationships: [
          {
            foreignKeyName: "change_records_client_org_id_fkey"
            columns: ["client_org_id"]
            isOneToOne: false
            referencedRelation: "client_orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_records_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      client_entitlements: {
        Row: {
          client_org_id: string
          commercial_basis: string
          created_at: string
          ended_on: string | null
          entity_id: string
          frequency: string
          id: string
          service_code: string
          started_on: string
          updated_at: string
        }
        Insert: {
          client_org_id: string
          commercial_basis: string
          created_at?: string
          ended_on?: string | null
          entity_id: string
          frequency: string
          id?: string
          service_code: string
          started_on: string
          updated_at?: string
        }
        Update: {
          client_org_id?: string
          commercial_basis?: string
          created_at?: string
          ended_on?: string | null
          entity_id?: string
          frequency?: string
          id?: string
          service_code?: string
          started_on?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_entitlements_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_entitlements_service_code_fkey"
            columns: ["service_code"]
            isOneToOne: false
            referencedRelation: "practice_services"
            referencedColumns: ["code"]
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
      contact_email_org_claims: {
        Row: {
          client_org_id: string
          contact_email_id: string
          created_at: string
          email: string
          person_id: string
        }
        Insert: {
          client_org_id: string
          contact_email_id: string
          created_at?: string
          email: string
          person_id: string
        }
        Update: {
          client_org_id?: string
          contact_email_id?: string
          created_at?: string
          email?: string
          person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_email_org_claims_client_org_id_fkey"
            columns: ["client_org_id"]
            isOneToOne: false
            referencedRelation: "client_orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_email_org_claims_contact_email_id_fkey"
            columns: ["contact_email_id"]
            isOneToOne: false
            referencedRelation: "contact_emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_email_org_claims_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          is_primary: boolean
          label: string | null
          person_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_primary?: boolean
          label?: string | null
          person_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_primary?: boolean
          label?: string | null
          person_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_emails_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_phones: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          label: string | null
          person_id: string
          phone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          label?: string | null
          person_id: string
          phone: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          label?: string | null
          person_id?: string
          phone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_phones_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          active: boolean
          client_org_id: string
          created_at: string
          full_name: string
          id: string
          is_primary: boolean
          notes: string | null
          person_id: string | null
          receives_requests: boolean
          role_label: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          client_org_id: string
          created_at?: string
          full_name: string
          id?: string
          is_primary?: boolean
          notes?: string | null
          person_id?: string | null
          receives_requests?: boolean
          role_label?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          client_org_id?: string
          created_at?: string
          full_name?: string
          id?: string
          is_primary?: boolean
          notes?: string | null
          person_id?: string | null
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
          {
            foreignKeyName: "contacts_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
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
          drive_folder_inheritance_mode: string
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
          drive_folder_inheritance_mode?: string
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
          drive_folder_inheritance_mode?: string
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
      gmail_sync_state: {
        Row: {
          history_id: string | null
          last_error_code: string | null
          last_recovery_at: string | null
          last_synced_at: string | null
          mailbox: string
          updated_at: string
        }
        Insert: {
          history_id?: string | null
          last_error_code?: string | null
          last_recovery_at?: string | null
          last_synced_at?: string | null
          mailbox: string
          updated_at?: string
        }
        Update: {
          history_id?: string | null
          last_error_code?: string | null
          last_recovery_at?: string | null
          last_synced_at?: string | null
          mailbox?: string
          updated_at?: string
        }
        Relationships: []
      }
      inbound_documents: {
        Row: {
          byte_size: number
          client_org_id: string | null
          created_at: string
          drive_file_id: string | null
          filed_at: string | null
          filename: string
          filing_status: string
          gmail_attachment_id: string
          id: string
          inbound_message_id: string
          mime_type: string
          sha256: string
        }
        Insert: {
          byte_size: number
          client_org_id?: string | null
          created_at?: string
          drive_file_id?: string | null
          filed_at?: string | null
          filename: string
          filing_status?: string
          gmail_attachment_id: string
          id?: string
          inbound_message_id: string
          mime_type: string
          sha256: string
        }
        Update: {
          byte_size?: number
          client_org_id?: string | null
          created_at?: string
          drive_file_id?: string | null
          filed_at?: string | null
          filename?: string
          filing_status?: string
          gmail_attachment_id?: string
          id?: string
          inbound_message_id?: string
          mime_type?: string
          sha256?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbound_documents_client_org_id_fkey"
            columns: ["client_org_id"]
            isOneToOne: false
            referencedRelation: "client_orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_documents_inbound_message_id_fkey"
            columns: ["inbound_message_id"]
            isOneToOne: false
            referencedRelation: "inbound_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_messages: {
        Row: {
          client_org_id: string | null
          created_at: string
          delivered_to: string
          gmail_history_id: string | null
          gmail_message_id: string
          gmail_thread_id: string
          id: string
          received_at: string
          reply_to_cycle_id: string | null
          sender_email: string
        }
        Insert: {
          client_org_id?: string | null
          created_at?: string
          delivered_to: string
          gmail_history_id?: string | null
          gmail_message_id: string
          gmail_thread_id: string
          id?: string
          received_at: string
          reply_to_cycle_id?: string | null
          sender_email: string
        }
        Update: {
          client_org_id?: string | null
          created_at?: string
          delivered_to?: string
          gmail_history_id?: string | null
          gmail_message_id?: string
          gmail_thread_id?: string
          id?: string
          received_at?: string
          reply_to_cycle_id?: string | null
          sender_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbound_messages_client_org_id_fkey"
            columns: ["client_org_id"]
            isOneToOne: false
            referencedRelation: "client_orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_messages_reply_to_cycle_id_fkey"
            columns: ["reply_to_cycle_id"]
            isOneToOne: false
            referencedRelation: "request_cycles"
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
      jobs: {
        Row: {
          client_org_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          due_date: string
          due_date_source: string
          entity_id: string
          id: string
          job_type: string
          notes: string | null
          period_end: string
          period_label: string
          period_start: string
          service_code: string
          status: string
          updated_at: string
        }
        Insert: {
          client_org_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          due_date: string
          due_date_source?: string
          entity_id: string
          id?: string
          job_type: string
          notes?: string | null
          period_end: string
          period_label: string
          period_start: string
          service_code: string
          status?: string
          updated_at?: string
        }
        Update: {
          client_org_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          due_date?: string
          due_date_source?: string
          entity_id?: string
          id?: string
          job_type?: string
          notes?: string | null
          period_end?: string
          period_label?: string
          period_start?: string
          service_code?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_service_code_fkey"
            columns: ["service_code"]
            isOneToOne: false
            referencedRelation: "practice_services"
            referencedColumns: ["code"]
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
      outbound_request_emails: {
        Row: {
          accepted_at: string | null
          client_org_id: string
          created_at: string
          delivery_id: string | null
          id: string
          recipient: string
          request_cycle_id: string
          sent_by: string
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          client_org_id: string
          created_at?: string
          delivery_id?: string | null
          id?: string
          recipient: string
          request_cycle_id: string
          sent_by: string
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          client_org_id?: string
          created_at?: string
          delivery_id?: string | null
          id?: string
          recipient?: string
          request_cycle_id?: string
          sent_by?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbound_request_emails_client_org_id_fkey"
            columns: ["client_org_id"]
            isOneToOne: false
            referencedRelation: "client_orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_request_emails_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "email_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_request_emails_request_cycle_id_fkey"
            columns: ["request_cycle_id"]
            isOneToOne: false
            referencedRelation: "request_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          created_at: string
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          updated_at?: string
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
      request_cycles: {
        Row: {
          client_org_id: string
          created_at: string
          created_by: string
          entity_id: string
          id: string
          job_id: string
          period_end: string
          request_kind: string
          status: string
          updated_at: string
          workflow_owner_email: string
        }
        Insert: {
          client_org_id: string
          created_at?: string
          created_by: string
          entity_id: string
          id?: string
          job_id: string
          period_end: string
          request_kind: string
          status?: string
          updated_at?: string
          workflow_owner_email: string
        }
        Update: {
          client_org_id?: string
          created_at?: string
          created_by?: string
          entity_id?: string
          id?: string
          job_id?: string
          period_end?: string
          request_kind?: string
          status?: string
          updated_at?: string
          workflow_owner_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_cycles_client_org_id_fkey"
            columns: ["client_org_id"]
            isOneToOne: false
            referencedRelation: "client_orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_cycles_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_cycles_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      request_item_matches: {
        Row: {
          client_org_id: string
          confidence: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision: string
          evidence: Json
          id: string
          inbound_document_id: string
          matcher_version: string
          request_item_id: string
        }
        Insert: {
          client_org_id: string
          confidence: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision: string
          evidence: Json
          id?: string
          inbound_document_id: string
          matcher_version: string
          request_item_id: string
        }
        Update: {
          client_org_id?: string
          confidence?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: string
          evidence?: Json
          id?: string
          inbound_document_id?: string
          matcher_version?: string
          request_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_item_matches_client_org_id_fkey"
            columns: ["client_org_id"]
            isOneToOne: false
            referencedRelation: "client_orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_item_matches_inbound_document_id_fkey"
            columns: ["inbound_document_id"]
            isOneToOne: false
            referencedRelation: "inbound_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_item_matches_request_item_id_fkey"
            columns: ["request_item_id"]
            isOneToOne: false
            referencedRelation: "request_items"
            referencedColumns: ["id"]
          },
        ]
      }
      request_items: {
        Row: {
          account_label: string
          account_last4: string | null
          client_org_id: string
          created_at: string
          financial_account_id: string
          id: string
          item_kind: string
          request_cycle_id: string
          status: string
          updated_at: string
        }
        Insert: {
          account_label: string
          account_last4?: string | null
          client_org_id: string
          created_at?: string
          financial_account_id: string
          id?: string
          item_kind: string
          request_cycle_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          account_label?: string
          account_last4?: string | null
          client_org_id?: string
          created_at?: string
          financial_account_id?: string
          id?: string
          item_kind?: string
          request_cycle_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_items_client_org_id_fkey"
            columns: ["client_org_id"]
            isOneToOne: false
            referencedRelation: "client_orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_items_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_items_request_cycle_id_fkey"
            columns: ["request_cycle_id"]
            isOneToOne: false
            referencedRelation: "request_cycles"
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
      service_slug_map: {
        Row: {
          active: boolean
          created_at: string
          id: string
          marketing_slug: string
          service_code: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          marketing_slug: string
          service_code: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          marketing_slug?: string
          service_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_slug_map_service_code_fkey"
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
      work_events: {
        Row: {
          actor_email: string | null
          actor_kind: string
          client_org_id: string
          detail: Json
          entity_id: string | null
          event_type: string
          id: string
          occurred_at: string
          work_item_id: string | null
        }
        Insert: {
          actor_email?: string | null
          actor_kind?: string
          client_org_id: string
          detail?: Json
          entity_id?: string | null
          event_type: string
          id?: string
          occurred_at?: string
          work_item_id?: string | null
        }
        Update: {
          actor_email?: string | null
          actor_kind?: string
          client_org_id?: string
          detail?: Json
          entity_id?: string | null
          event_type?: string
          id?: string
          occurred_at?: string
          work_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_events_client_org_id_fkey"
            columns: ["client_org_id"]
            isOneToOne: false
            referencedRelation: "client_orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_events_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_events_work_item_client_org_fkey"
            columns: ["work_item_id", "client_org_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id", "client_org_id"]
          },
        ]
      }
      work_items: {
        Row: {
          client_org_id: string
          created_at: string
          entity_id: string
          id: string
          open_approval_count: number
          period_key: string
          status: string
          updated_at: string
          work_ref: string | null
          workflow_key: string
          workflow_version: string | null
        }
        Insert: {
          client_org_id: string
          created_at?: string
          entity_id: string
          id?: string
          open_approval_count?: number
          period_key: string
          status?: string
          updated_at?: string
          work_ref?: string | null
          workflow_key: string
          workflow_version?: string | null
        }
        Update: {
          client_org_id?: string
          created_at?: string
          entity_id?: string
          id?: string
          open_approval_count?: number
          period_key?: string
          status?: string
          updated_at?: string
          work_ref?: string | null
          workflow_key?: string
          workflow_version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_items_client_org_id_fkey"
            columns: ["client_org_id"]
            isOneToOne: false
            referencedRelation: "client_orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      work_tasks: {
        Row: {
          client_org_id: string
          created_at: string
          id: string
          status: string
          task_key: string
          updated_at: string
          work_item_id: string
        }
        Insert: {
          client_org_id: string
          created_at?: string
          id?: string
          status?: string
          task_key: string
          updated_at?: string
          work_item_id: string
        }
        Update: {
          client_org_id?: string
          created_at?: string
          id?: string
          status?: string
          task_key?: string
          updated_at?: string
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_tasks_work_item_id_client_org_id_fkey"
            columns: ["work_item_id", "client_org_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id", "client_org_id"]
          },
        ]
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
      active_staff_managers: { Args: { p_excluding: string }; Returns: number }
      add_staff_member: {
        Args: {
          p_actor_email: string
          p_actor_kind: string
          p_all_clients: boolean
          p_client_org_ids?: string[]
          p_email: string
          p_full_name?: string
          p_note?: string
          p_role: string
          p_source: string
        }
        Returns: {
          grants_created: number
          new_staff_id: string
        }[]
      }
      bulk_add_service_assignments: {
        Args: {
          p_actor_email: string
          p_actor_kind: string
          p_rows: Json
          p_source: string
        }
        Returns: number
      }
      bulk_update_entities: {
        Args: {
          p_actor_email: string
          p_actor_kind: string
          p_rows: Json
          p_source: string
        }
        Returns: number
      }
      change_context: {
        Args: { p_default: string; p_name: string }
        Returns: string
      }
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
      complete_work_item: {
        Args: {
          p_actor_email: string
          p_client_org_id: string
          p_work_item_id: string
        }
        Returns: {
          work_event_id: string
          work_item_id: string
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
      decide_request_item_match: {
        Args: { p_actor_email?: string; p_decision: string; p_match_id: string }
        Returns: boolean
      }
      decide_work_item_approval: {
        Args: {
          p_approval_id: string
          p_client_org_id: string
          p_decided_by: string
          p_decision: string
        }
        Returns: {
          approval_id: string
          work_item_id: string
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
      grant_client_access: {
        Args: {
          p_actor_email: string
          p_actor_kind: string
          p_all_clients: boolean
          p_client_org_id?: string
          p_note?: string
          p_source: string
          p_staff_user_id: string
        }
        Returns: {
          grant_id: string
        }[]
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
      next_work_ref: { Args: never; Returns: string }
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
      request_work_item_approval: {
        Args: {
          p_actor_email: string
          p_addressee_staff_user_id: string
          p_client_org_id: string
          p_reason_code: string
          p_requested_by: string
          p_work_item_id: string
        }
        Returns: {
          approval_id: string
          work_event_id: string
        }[]
      }
      revoke_client_access: {
        Args: {
          p_actor_email: string
          p_actor_kind: string
          p_grant_id: string
          p_source: string
          p_staff_user_id: string
        }
        Returns: {
          revoked_all_clients: boolean
          revoked_org_id: string
        }[]
      }
      save_entity_change: {
        Args: {
          p_actor_email: string
          p_actor_kind: string
          p_cipc_ar_required: boolean
          p_coida_no?: string
          p_coida_registered: boolean
          p_display_name: string
          p_drive_folder_id?: string
          p_drive_folder_inheritance_mode?: string
          p_drive_folder_url?: string
          p_entity_id: string
          p_entity_type: string
          p_financial_year_end_day?: number
          p_financial_year_end_month?: number
          p_income_tax_no?: string
          p_incorporation_date?: string
          p_legal_name?: string
          p_notes?: string
          p_paye_no?: string
          p_payroll_registered: boolean
          p_provisional_taxpayer: boolean
          p_registration_no?: string
          p_source: string
          p_status: string
          p_statutory_effective_from?: string
          p_uif_no?: string
          p_vat_category?: string
          p_vat_no?: string
          p_vat_registered: boolean
        }
        Returns: {
          client_org_id: string
          client_ref: string
          id: string
        }[]
      }
      set_service_assignments: {
        Args: {
          p_actor_email: string
          p_actor_kind: string
          p_entity_id: string
          p_rows: Json
          p_source: string
        }
        Returns: number
      }
      set_staff_active: {
        Args: {
          p_active: boolean
          p_actor_email: string
          p_actor_kind: string
          p_source: string
          p_staff_user_id: string
        }
        Returns: {
          staff_active: boolean
          staff_email: string
          staff_id: string
          staff_role: string
        }[]
      }
      set_staff_role: {
        Args: {
          p_actor_email: string
          p_actor_kind: string
          p_role: string
          p_source: string
          p_staff_user_id: string
        }
        Returns: {
          staff_active: boolean
          staff_email: string
          staff_id: string
          staff_role: string
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
      work_event_detail_is_valid: { Args: { p_detail: Json }; Returns: boolean }
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
