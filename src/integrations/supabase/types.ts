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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          is_published: boolean | null
          organization_id: string
          priority: string | null
          published_at: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_published?: boolean | null
          organization_id: string
          priority?: string | null
          published_at?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_published?: boolean | null
          organization_id?: string
          priority?: string | null
          published_at?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      apartments: {
        Row: {
          apartment_code: string
          apartment_type: string | null
          created_at: string | null
          eb_meter_number: string | null
          end_date: string | null
          floor_number: number | null
          gender_allowed: string | null
          id: string
          organization_id: string
          owner_id: string | null
          ownership_doc_url: string | null
          property_id: string
          property_tax_amount: number | null
          property_tax_frequency: string | null
          property_tax_id: string | null
          signing_date: string | null
          size_sqft: number | null
          start_date: string | null
          status: Database["public"]["Enums"]["entity_status"] | null
          water_tax_amount: number | null
          water_tax_frequency: string | null
          water_tax_id: string | null
        }
        Insert: {
          apartment_code: string
          apartment_type?: string | null
          created_at?: string | null
          eb_meter_number?: string | null
          end_date?: string | null
          floor_number?: number | null
          gender_allowed?: string | null
          id?: string
          organization_id: string
          owner_id?: string | null
          ownership_doc_url?: string | null
          property_id: string
          property_tax_amount?: number | null
          property_tax_frequency?: string | null
          property_tax_id?: string | null
          signing_date?: string | null
          size_sqft?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["entity_status"] | null
          water_tax_amount?: number | null
          water_tax_frequency?: string | null
          water_tax_id?: string | null
        }
        Update: {
          apartment_code?: string
          apartment_type?: string | null
          created_at?: string | null
          eb_meter_number?: string | null
          end_date?: string | null
          floor_number?: number | null
          gender_allowed?: string | null
          id?: string
          organization_id?: string
          owner_id?: string | null
          ownership_doc_url?: string | null
          property_id?: string
          property_tax_amount?: number | null
          property_tax_frequency?: string | null
          property_tax_id?: string | null
          signing_date?: string | null
          size_sqft?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["entity_status"] | null
          water_tax_amount?: number | null
          water_tax_frequency?: string | null
          water_tax_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "apartments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apartments_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apartments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_allocations: {
        Row: {
          allocated_by: string | null
          allocated_date: string | null
          allocation_type: string
          apartment_id: string | null
          asset_id: string
          bed_id: string | null
          created_at: string | null
          id: string
          organization_id: string
          property_id: string | null
        }
        Insert: {
          allocated_by?: string | null
          allocated_date?: string | null
          allocation_type: string
          apartment_id?: string | null
          asset_id: string
          bed_id?: string | null
          created_at?: string | null
          id?: string
          organization_id: string
          property_id?: string | null
        }
        Update: {
          allocated_by?: string | null
          allocated_date?: string | null
          allocation_type?: string
          apartment_id?: string | null
          asset_id?: string
          bed_id?: string | null
          created_at?: string | null
          id?: string
          organization_id?: string
          property_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_allocations_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_allocations_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_allocations_bed_id_fkey"
            columns: ["bed_id"]
            isOneToOne: false
            referencedRelation: "beds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_allocations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_allocations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_brands: {
        Row: {
          created_at: string | null
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_brands_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_categories: {
        Row: {
          created_at: string | null
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_depreciation: {
        Row: {
          asset_id: string
          current_book_value: number | null
          id: string
          last_calculated: string | null
          purchase_price: number | null
          residual_value: number | null
          useful_life_years: number | null
          yearly_depreciation: number | null
        }
        Insert: {
          asset_id: string
          current_book_value?: number | null
          id?: string
          last_calculated?: string | null
          purchase_price?: number | null
          residual_value?: number | null
          useful_life_years?: number | null
          yearly_depreciation?: number | null
        }
        Update: {
          asset_id?: string
          current_book_value?: number | null
          id?: string
          last_calculated?: string | null
          purchase_price?: number | null
          residual_value?: number | null
          useful_life_years?: number | null
          yearly_depreciation?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_depreciation_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_maintenance_logs: {
        Row: {
          asset_id: string
          created_at: string | null
          id: string
          issue: string | null
          maintenance_date: string | null
          maintenance_type: string
          next_service_due: string | null
          organization_id: string
          repair_cost: number | null
          vendor: string | null
        }
        Insert: {
          asset_id: string
          created_at?: string | null
          id?: string
          issue?: string | null
          maintenance_date?: string | null
          maintenance_type: string
          next_service_due?: string | null
          organization_id: string
          repair_cost?: number | null
          vendor?: string | null
        }
        Update: {
          asset_id?: string
          created_at?: string | null
          id?: string
          issue?: string | null
          maintenance_date?: string | null
          maintenance_type?: string
          next_service_due?: string | null
          organization_id?: string
          repair_cost?: number | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_maintenance_logs_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_maintenance_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_movements: {
        Row: {
          asset_id: string
          created_at: string | null
          from_location: string | null
          id: string
          move_date: string | null
          moved_by: string | null
          organization_id: string
          reason: string | null
          to_location: string | null
        }
        Insert: {
          asset_id: string
          created_at?: string | null
          from_location?: string | null
          id?: string
          move_date?: string | null
          moved_by?: string | null
          organization_id: string
          reason?: string | null
          to_location?: string | null
        }
        Update: {
          asset_id?: string
          created_at?: string | null
          from_location?: string | null
          id?: string
          move_date?: string | null
          moved_by?: string | null
          organization_id?: string
          reason?: string | null
          to_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_movements_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_types: {
        Row: {
          category_id: string
          created_at: string | null
          depreciation_method: string | null
          depreciation_years: number | null
          expected_life_months: number | null
          id: string
          maintenance_cycle_months: number | null
          name: string
          organization_id: string
          replacement_cost_estimate: number | null
        }
        Insert: {
          category_id: string
          created_at?: string | null
          depreciation_method?: string | null
          depreciation_years?: number | null
          expected_life_months?: number | null
          id?: string
          maintenance_cycle_months?: number | null
          name: string
          organization_id: string
          replacement_cost_estimate?: number | null
        }
        Update: {
          category_id?: string
          created_at?: string | null
          depreciation_method?: string | null
          depreciation_years?: number | null
          expected_life_months?: number | null
          id?: string
          maintenance_cycle_months?: number | null
          name?: string
          organization_id?: string
          replacement_cost_estimate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_types_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "asset_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          apartment_id: string | null
          asset_code: string
          asset_type_id: string
          bed_id: number[] | null
          brand: string | null
          capacity_unit: string | null
          capacity_value: number | null
          condition: string | null
          created_at: string | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          invoice_url: string | null
          model: string | null
          notes: string | null
          organization_id: string
          product_photo_url: string | null
          purchase_date: string | null
          purchase_price: number | null
          qr_code: string | null
          serial_number: string | null
          status: string | null
          supplier_id: string | null
          vendor_name_manual: string | null
          warranty_expiry: string | null
          warranty_months: number | null
        }
        Insert: {
          apartment_id?: string | null
          asset_code: string
          asset_type_id: string
          bed_id?: number[] | null
          brand?: string | null
          capacity_unit?: string | null
          capacity_value?: number | null
          condition?: string | null
          created_at?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          invoice_url?: string | null
          model?: string | null
          notes?: string | null
          organization_id: string
          product_photo_url?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          qr_code?: string | null
          serial_number?: string | null
          status?: string | null
          supplier_id?: string | null
          vendor_name_manual?: string | null
          warranty_expiry?: string | null
          warranty_months?: number | null
        }
        Update: {
          apartment_id?: string | null
          asset_code?: string
          asset_type_id?: string
          bed_id?: number[] | null
          brand?: string | null
          capacity_unit?: string | null
          capacity_value?: number | null
          condition?: string | null
          created_at?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          invoice_url?: string | null
          model?: string | null
          notes?: string | null
          organization_id?: string
          product_photo_url?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          qr_code?: string | null
          serial_number?: string | null
          status?: string | null
          supplier_id?: string | null
          vendor_name_manual?: string | null
          warranty_expiry?: string | null
          warranty_months?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_asset_type_id_fkey"
            columns: ["asset_type_id"]
            isOneToOne: false
            referencedRelation: "asset_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_assets_apartment"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          changes: Json | null
          id: string
          organization_id: string
          performed_at: string
          performed_by: string | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          changes?: Json | null
          id?: string
          organization_id: string
          performed_at?: string
          performed_by?: string | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          changes?: Json | null
          id?: string
          organization_id?: string
          performed_at?: string
          performed_by?: string | null
          record_id?: string
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bed_rates: {
        Row: {
          bed_type: Database["public"]["Enums"]["bed_type"]
          created_at: string | null
          from_date: string
          id: string
          monthly_rate: number
          organization_id: string
          property_id: string | null
          to_date: string | null
          toilet_type: Database["public"]["Enums"]["toilet_type"]
        }
        Insert: {
          bed_type: Database["public"]["Enums"]["bed_type"]
          created_at?: string | null
          from_date: string
          id?: string
          monthly_rate: number
          organization_id: string
          property_id?: string | null
          to_date?: string | null
          toilet_type: Database["public"]["Enums"]["toilet_type"]
        }
        Update: {
          bed_type?: Database["public"]["Enums"]["bed_type"]
          created_at?: string | null
          from_date?: string
          id?: string
          monthly_rate?: number
          organization_id?: string
          property_id?: string | null
          to_date?: string | null
          toilet_type?: Database["public"]["Enums"]["toilet_type"]
        }
        Relationships: [
          {
            foreignKeyName: "bed_rates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bed_rates_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      bed_status_history: {
        Row: {
          bed_id: string
          created_at: string | null
          from_date: string
          id: string
          notes: string | null
          organization_id: string
          status: string
          to_date: string | null
        }
        Insert: {
          bed_id: string
          created_at?: string | null
          from_date: string
          id?: string
          notes?: string | null
          organization_id: string
          status: string
          to_date?: string | null
        }
        Update: {
          bed_id?: string
          created_at?: string | null
          from_date?: string
          id?: string
          notes?: string | null
          organization_id?: string
          status?: string
          to_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bed_status_history_bed_id_fkey"
            columns: ["bed_id"]
            isOneToOne: false
            referencedRelation: "beds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bed_status_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bed_type_config: {
        Row: {
          created_at: string | null
          id: string
          name: string
          organization_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          organization_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          organization_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "bed_type_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      beds: {
        Row: {
          apartment_id: string
          bed_code: string
          bed_lifecycle_status: string | null
          bed_type: Database["public"]["Enums"]["bed_type"]
          created_at: string | null
          id: string
          organization_id: string
          status: Database["public"]["Enums"]["entity_status"] | null
          toilet_type: Database["public"]["Enums"]["toilet_type"]
        }
        Insert: {
          apartment_id: string
          bed_code: string
          bed_lifecycle_status?: string | null
          bed_type: Database["public"]["Enums"]["bed_type"]
          created_at?: string | null
          id?: string
          organization_id: string
          status?: Database["public"]["Enums"]["entity_status"] | null
          toilet_type?: Database["public"]["Enums"]["toilet_type"]
        }
        Update: {
          apartment_id?: string
          bed_code?: string
          bed_lifecycle_status?: string | null
          bed_type?: Database["public"]["Enums"]["bed_type"]
          created_at?: string | null
          id?: string
          organization_id?: string
          status?: Database["public"]["Enums"]["entity_status"] | null
          toilet_type?: Database["public"]["Enums"]["toilet_type"]
        }
        Relationships: [
          {
            foreignKeyName: "beds_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beds_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_estimate_approvers: {
        Row: {
          approver_user_id: string
          created_at: string | null
          id: string
          issue_type_id: string | null
          organization_id: string
          property_id: string | null
          scope_type: string
        }
        Insert: {
          approver_user_id: string
          created_at?: string | null
          id?: string
          issue_type_id?: string | null
          organization_id: string
          property_id?: string | null
          scope_type?: string
        }
        Update: {
          approver_user_id?: string
          created_at?: string | null
          id?: string
          issue_type_id?: string | null
          organization_id?: string
          property_id?: string | null
          scope_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_estimate_approvers_issue_type_id_fkey"
            columns: ["issue_type_id"]
            isOneToOne: false
            referencedRelation: "issue_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_estimate_approvers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_estimate_approvers_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      deposit_settlements: {
        Row: {
          allotment_id: string | null
          created_at: string | null
          damages: number | null
          deposit_amount: number
          id: string
          notes: string | null
          organization_id: string
          other_deductions: number | null
          pending_eb: number | null
          pending_late_fees: number | null
          pending_rent: number | null
          refund_amount: number | null
          settlement_date: string | null
          status: string | null
          tenant_id: string
          total_deductions: number | null
        }
        Insert: {
          allotment_id?: string | null
          created_at?: string | null
          damages?: number | null
          deposit_amount?: number
          id?: string
          notes?: string | null
          organization_id: string
          other_deductions?: number | null
          pending_eb?: number | null
          pending_late_fees?: number | null
          pending_rent?: number | null
          refund_amount?: number | null
          settlement_date?: string | null
          status?: string | null
          tenant_id: string
          total_deductions?: number | null
        }
        Update: {
          allotment_id?: string | null
          created_at?: string | null
          damages?: number | null
          deposit_amount?: number
          id?: string
          notes?: string | null
          organization_id?: string
          other_deductions?: number | null
          pending_eb?: number | null
          pending_late_fees?: number | null
          pending_rent?: number | null
          refund_amount?: number | null
          settlement_date?: string | null
          status?: string | null
          tenant_id?: string
          total_deductions?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deposit_settlements_allotment_id_fkey"
            columns: ["allotment_id"]
            isOneToOne: false
            referencedRelation: "tenant_allotments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_settlements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_settlements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_sessions: {
        Row: {
          ai_diagnosis: Json | null
          completed_at: string | null
          created_at: string | null
          employee_override: Json | null
          id: string
          issue_type_id: string | null
          organization_id: string
          performed_by: string | null
          questions_answers: Json | null
          status: string
          ticket_id: string
        }
        Insert: {
          ai_diagnosis?: Json | null
          completed_at?: string | null
          created_at?: string | null
          employee_override?: Json | null
          id?: string
          issue_type_id?: string | null
          organization_id: string
          performed_by?: string | null
          questions_answers?: Json | null
          status?: string
          ticket_id: string
        }
        Update: {
          ai_diagnosis?: Json | null
          completed_at?: string | null
          created_at?: string | null
          employee_override?: Json | null
          id?: string
          issue_type_id?: string | null
          organization_id?: string
          performed_by?: string | null
          questions_answers?: Json | null
          status?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_sessions_issue_type_id_fkey"
            columns: ["issue_type_id"]
            isOneToOne: false
            referencedRelation: "issue_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_sessions_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "maintenance_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      eb_rates: {
        Row: {
          created_at: string | null
          from_date: string
          id: string
          organization_id: string
          property_id: string | null
          to_date: string | null
          unit_cost: number
        }
        Insert: {
          created_at?: string | null
          from_date: string
          id?: string
          organization_id: string
          property_id?: string | null
          to_date?: string | null
          unit_cost: number
        }
        Update: {
          created_at?: string | null
          from_date?: string
          id?: string
          organization_id?: string
          property_id?: string | null
          to_date?: string | null
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "eb_rates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eb_rates_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      eb_tenant_shares: {
        Row: {
          apartment_id: string | null
          billing_month: string
          created_at: string | null
          id: string
          invoice_id: string
          per_day_rate: number | null
          tenant_eb_charge: number | null
          tenant_stay_days: number | null
          total_apartment_bill: number | null
          total_tenant_days: number | null
          total_units: number | null
          unit_cost: number | null
        }
        Insert: {
          apartment_id?: string | null
          billing_month: string
          created_at?: string | null
          id?: string
          invoice_id: string
          per_day_rate?: number | null
          tenant_eb_charge?: number | null
          tenant_stay_days?: number | null
          total_apartment_bill?: number | null
          total_tenant_days?: number | null
          total_units?: number | null
          unit_cost?: number | null
        }
        Update: {
          apartment_id?: string | null
          billing_month?: string
          created_at?: string | null
          id?: string
          invoice_id?: string
          per_day_rate?: number | null
          tenant_eb_charge?: number | null
          tenant_stay_days?: number | null
          total_apartment_bill?: number | null
          total_tenant_days?: number | null
          total_units?: number | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "eb_tenant_shares_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eb_tenant_shares_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      electricity_readings: {
        Row: {
          apartment_id: string
          billing_month: string
          created_at: string | null
          id: string
          is_locked: boolean
          locked_by: string | null
          meter_photo_url: string | null
          organization_id: string
          property_id: string
          reading_end: number
          reading_start: number
          unit_cost: number
          units_consumed: number | null
        }
        Insert: {
          apartment_id: string
          billing_month: string
          created_at?: string | null
          id?: string
          is_locked?: boolean
          locked_by?: string | null
          meter_photo_url?: string | null
          organization_id: string
          property_id: string
          reading_end: number
          reading_start: number
          unit_cost: number
          units_consumed?: number | null
        }
        Update: {
          apartment_id?: string
          billing_month?: string
          created_at?: string | null
          id?: string
          is_locked?: boolean
          locked_by?: string | null
          meter_photo_url?: string | null
          organization_id?: string
          property_id?: string
          reading_end?: number
          reading_start?: number
          unit_cost?: number
          units_consumed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "electricity_readings_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "electricity_readings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "electricity_readings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      electricity_shares: {
        Row: {
          cost_share: number | null
          created_at: string | null
          electricity_reading_id: string
          id: string
          tenant_id: string
          units_allocated: number | null
        }
        Insert: {
          cost_share?: number | null
          created_at?: string | null
          electricity_reading_id: string
          id?: string
          tenant_id: string
          units_allocated?: number | null
        }
        Update: {
          cost_share?: number | null
          created_at?: string | null
          electricity_reading_id?: string
          id?: string
          tenant_id?: string
          units_allocated?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "electricity_shares_electricity_reading_id_fkey"
            columns: ["electricity_reading_id"]
            isOneToOne: false
            referencedRelation: "electricity_readings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "electricity_shares_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_specialties: {
        Row: {
          created_at: string | null
          id: string
          specialty: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          specialty: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          specialty?: string
          user_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          apartment_id: string | null
          bed_id: string | null
          billing_month: string | null
          category: string
          created_at: string | null
          description: string | null
          expense_date: string
          id: string
          organization_id: string
          property_id: string | null
          receipt_url: string | null
          vendor: string | null
        }
        Insert: {
          amount?: number
          apartment_id?: string | null
          bed_id?: string | null
          billing_month?: string | null
          category: string
          created_at?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          organization_id: string
          property_id?: string | null
          receipt_url?: string | null
          vendor?: string | null
        }
        Update: {
          amount?: number
          apartment_id?: string | null
          bed_id?: string | null
          billing_month?: string | null
          category?: string
          created_at?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          organization_id?: string
          property_id?: string | null
          receipt_url?: string | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_bed_id_fkey"
            columns: ["bed_id"]
            isOneToOne: false
            referencedRelation: "beds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          id: string
          invoice_id: string
          line_type: string
          metadata: Json | null
        }
        Insert: {
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          invoice_id: string
          line_type: string
          metadata?: Json | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          invoice_id?: string
          line_type?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          allotment_id: string | null
          amount_paid: number | null
          apartment_id: string | null
          balance: number | null
          bed_id: string | null
          billing_month: string | null
          created_at: string | null
          due_date: string | null
          electricity_amount: number | null
          estimated_eb: number | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          late_fee: number | null
          locked: boolean | null
          organization_id: string
          other_charges: number | null
          property_id: string
          rent_amount: number | null
          status: string | null
          tenant_id: string
          total_amount: number | null
        }
        Insert: {
          allotment_id?: string | null
          amount_paid?: number | null
          apartment_id?: string | null
          balance?: number | null
          bed_id?: string | null
          billing_month?: string | null
          created_at?: string | null
          due_date?: string | null
          electricity_amount?: number | null
          estimated_eb?: number | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          late_fee?: number | null
          locked?: boolean | null
          organization_id: string
          other_charges?: number | null
          property_id: string
          rent_amount?: number | null
          status?: string | null
          tenant_id: string
          total_amount?: number | null
        }
        Update: {
          allotment_id?: string | null
          amount_paid?: number | null
          apartment_id?: string | null
          balance?: number | null
          bed_id?: string | null
          billing_month?: string | null
          created_at?: string | null
          due_date?: string | null
          electricity_amount?: number | null
          estimated_eb?: number | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          late_fee?: number | null
          locked?: boolean | null
          organization_id?: string
          other_charges?: number | null
          property_id?: string
          rent_amount?: number | null
          status?: string | null
          tenant_id?: string
          total_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_allotment_id_fkey"
            columns: ["allotment_id"]
            isOneToOne: false
            referencedRelation: "tenant_allotments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_bed_id_fkey"
            columns: ["bed_id"]
            isOneToOne: false
            referencedRelation: "beds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_sub_types: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string
          id: string
          issue_type_id: string
          name: string
          organization_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string
          id?: string
          issue_type_id: string
          name: string
          organization_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string
          id?: string
          issue_type_id?: string
          name?: string
          organization_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "issue_sub_types_issue_type_id_fkey"
            columns: ["issue_type_id"]
            isOneToOne: false
            referencedRelation: "issue_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_sub_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_types: {
        Row: {
          created_at: string | null
          icon: string | null
          id: string
          name: string
          organization_id: string
          priority: string | null
          sla_hours: number | null
        }
        Insert: {
          created_at?: string | null
          icon?: string | null
          id?: string
          name: string
          organization_id: string
          priority?: string | null
          sla_hours?: number | null
        }
        Update: {
          created_at?: string | null
          icon?: string | null
          id?: string
          name?: string
          organization_id?: string
          priority?: string | null
          sla_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "issue_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lifecycle_config: {
        Row: {
          advance_ratio: number
          booking_fee: number
          created_at: string | null
          exit_fee_under_1yr: number
          from_date: string
          id: string
          key_loss_fee: number
          notice_period_days: number
          onboarding_fee: number
          organization_id: string
          refund_deadline_days: number
          to_date: string | null
        }
        Insert: {
          advance_ratio?: number
          booking_fee?: number
          created_at?: string | null
          exit_fee_under_1yr?: number
          from_date: string
          id?: string
          key_loss_fee?: number
          notice_period_days?: number
          onboarding_fee?: number
          organization_id: string
          refund_deadline_days?: number
          to_date?: string | null
        }
        Update: {
          advance_ratio?: number
          booking_fee?: number
          created_at?: string | null
          exit_fee_under_1yr?: number
          from_date?: string
          id?: string
          key_loss_fee?: number
          notice_period_days?: number
          onboarding_fee?: number
          organization_id?: string
          refund_deadline_days?: number
          to_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lifecycle_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_tickets: {
        Row: {
          apartment_id: string | null
          assigned_to: string | null
          bed_id: string | null
          closed_at: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          diagnostic_data: Json | null
          id: string
          issue_type_id: string
          organization_id: string
          photo_urls: string[] | null
          priority: string | null
          property_id: string | null
          resolved_at: string | null
          sla_deadline: string | null
          status: string | null
          tenant_approved: boolean | null
          tenant_id: string | null
          tenant_name: string | null
          tenant_phone: string | null
          tenant_rejection_reason: string | null
          ticket_number: string
          updated_at: string | null
        }
        Insert: {
          apartment_id?: string | null
          assigned_to?: string | null
          bed_id?: string | null
          closed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          diagnostic_data?: Json | null
          id?: string
          issue_type_id: string
          organization_id: string
          photo_urls?: string[] | null
          priority?: string | null
          property_id?: string | null
          resolved_at?: string | null
          sla_deadline?: string | null
          status?: string | null
          tenant_approved?: boolean | null
          tenant_id?: string | null
          tenant_name?: string | null
          tenant_phone?: string | null
          tenant_rejection_reason?: string | null
          ticket_number: string
          updated_at?: string | null
        }
        Update: {
          apartment_id?: string | null
          assigned_to?: string | null
          bed_id?: string | null
          closed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          diagnostic_data?: Json | null
          id?: string
          issue_type_id?: string
          organization_id?: string
          photo_urls?: string[] | null
          priority?: string | null
          property_id?: string | null
          resolved_at?: string | null
          sla_deadline?: string | null
          status?: string | null
          tenant_approved?: boolean | null
          tenant_id?: string | null
          tenant_name?: string | null
          tenant_phone?: string | null
          tenant_rejection_reason?: string | null
          ticket_number?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_tickets_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tickets_bed_id_fkey"
            columns: ["bed_id"]
            isOneToOne: false
            referencedRelation: "beds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tickets_issue_type_id_fkey"
            columns: ["issue_type_id"]
            isOneToOne: false
            referencedRelation: "issue_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tickets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tickets_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_bank_accounts: {
        Row: {
          account_name: string | null
          account_number: string
          account_type: string | null
          bank_name: string
          branch: string | null
          created_at: string | null
          id: string
          ifsc_code: string | null
          is_primary: boolean | null
          notes: string | null
          organization_id: string
          status: string | null
          swift_code: string | null
          upi_id: string | null
        }
        Insert: {
          account_name?: string | null
          account_number: string
          account_type?: string | null
          bank_name: string
          branch?: string | null
          created_at?: string | null
          id?: string
          ifsc_code?: string | null
          is_primary?: boolean | null
          notes?: string | null
          organization_id: string
          status?: string | null
          swift_code?: string | null
          upi_id?: string | null
        }
        Update: {
          account_name?: string | null
          account_number?: string
          account_type?: string | null
          bank_name?: string
          branch?: string | null
          created_at?: string | null
          id?: string
          ifsc_code?: string | null
          is_primary?: boolean | null
          notes?: string | null
          organization_id?: string
          status?: string | null
          swift_code?: string | null
          upi_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_bank_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          gst_number: string | null
          id: string
          organization_name: string
          subscription_plan: string | null
        }
        Insert: {
          created_at?: string | null
          gst_number?: string | null
          id?: string
          organization_name: string
          subscription_plan?: string | null
        }
        Update: {
          created_at?: string | null
          gst_number?: string | null
          id?: string
          organization_name?: string
          subscription_plan?: string | null
        }
        Relationships: []
      }
      otp_codes: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          otp_code: string
          phone: string
          verified: boolean | null
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          otp_code: string
          phone: string
          verified?: boolean | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          otp_code?: string
          phone?: string
          verified?: boolean | null
        }
        Relationships: []
      }
      owner_contracts: {
        Row: {
          agreement_url: string | null
          apartment_id: string | null
          contract_type: string
          created_at: string | null
          end_date: string | null
          escalation_interval_months: number | null
          escalation_percentage: number | null
          id: string
          lock_in_months: number | null
          monthly_rent: number | null
          notes: string | null
          organization_id: string
          owner_id: string
          ownership_doc_url: string | null
          payment_due_day: number | null
          payment_schedule: string | null
          property_id: string | null
          property_tax_amount: number | null
          property_tax_frequency: string | null
          property_tax_id: string | null
          renewal_date: string | null
          renewal_periods: number | null
          rent_paid_in_advance: boolean | null
          revenue_share_percentage: number | null
          security_deposit: number | null
          start_date: string | null
          status: string | null
          water_tax_amount: number | null
          water_tax_details: string | null
          water_tax_frequency: string | null
          water_tax_id: string | null
        }
        Insert: {
          agreement_url?: string | null
          apartment_id?: string | null
          contract_type?: string
          created_at?: string | null
          end_date?: string | null
          escalation_interval_months?: number | null
          escalation_percentage?: number | null
          id?: string
          lock_in_months?: number | null
          monthly_rent?: number | null
          notes?: string | null
          organization_id: string
          owner_id: string
          ownership_doc_url?: string | null
          payment_due_day?: number | null
          payment_schedule?: string | null
          property_id?: string | null
          property_tax_amount?: number | null
          property_tax_frequency?: string | null
          property_tax_id?: string | null
          renewal_date?: string | null
          renewal_periods?: number | null
          rent_paid_in_advance?: boolean | null
          revenue_share_percentage?: number | null
          security_deposit?: number | null
          start_date?: string | null
          status?: string | null
          water_tax_amount?: number | null
          water_tax_details?: string | null
          water_tax_frequency?: string | null
          water_tax_id?: string | null
        }
        Update: {
          agreement_url?: string | null
          apartment_id?: string | null
          contract_type?: string
          created_at?: string | null
          end_date?: string | null
          escalation_interval_months?: number | null
          escalation_percentage?: number | null
          id?: string
          lock_in_months?: number | null
          monthly_rent?: number | null
          notes?: string | null
          organization_id?: string
          owner_id?: string
          ownership_doc_url?: string | null
          payment_due_day?: number | null
          payment_schedule?: string | null
          property_id?: string | null
          property_tax_amount?: number | null
          property_tax_frequency?: string | null
          property_tax_id?: string | null
          renewal_date?: string | null
          renewal_periods?: number | null
          rent_paid_in_advance?: boolean | null
          revenue_share_percentage?: number | null
          security_deposit?: number | null
          start_date?: string | null
          status?: string | null
          water_tax_amount?: number | null
          water_tax_details?: string | null
          water_tax_frequency?: string | null
          water_tax_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "owner_contracts_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_contracts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_contracts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_contracts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_payments: {
        Row: {
          actual_due_date: string | null
          apartment_id: string | null
          base_amount: number
          bill_date: string | null
          contract_id: string
          created_at: string | null
          due_date: string
          escalated_amount: number
          id: string
          notes: string | null
          organization_id: string
          owner_id: string
          paid_date: string | null
          payment_mode: string | null
          payment_month: string
          reference_number: string | null
          status: string
        }
        Insert: {
          actual_due_date?: string | null
          apartment_id?: string | null
          base_amount?: number
          bill_date?: string | null
          contract_id: string
          created_at?: string | null
          due_date: string
          escalated_amount?: number
          id?: string
          notes?: string | null
          organization_id: string
          owner_id: string
          paid_date?: string | null
          payment_mode?: string | null
          payment_month: string
          reference_number?: string | null
          status?: string
        }
        Update: {
          actual_due_date?: string | null
          apartment_id?: string | null
          base_amount?: number
          bill_date?: string | null
          contract_id?: string
          created_at?: string | null
          due_date?: string
          escalated_amount?: number
          id?: string
          notes?: string | null
          organization_id?: string
          owner_id?: string
          paid_date?: string | null
          payment_mode?: string | null
          payment_month?: string
          reference_number?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_payments_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "owner_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_payments_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
        ]
      }
      owners: {
        Row: {
          aadhar_number: string | null
          address: string | null
          bank_account_number: string | null
          bank_ifsc: string | null
          bank_name: string | null
          city: string | null
          created_at: string | null
          email: string | null
          full_name: string
          gst_number: string | null
          id: string
          id_proof_url: string | null
          notes: string | null
          organization_id: string
          pan_number: string | null
          phone: string | null
          photo_url: string | null
          pincode: string | null
          state: string | null
          status: string | null
        }
        Insert: {
          aadhar_number?: string | null
          address?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          city?: string | null
          created_at?: string | null
          email?: string | null
          full_name: string
          gst_number?: string | null
          id?: string
          id_proof_url?: string | null
          notes?: string | null
          organization_id: string
          pan_number?: string | null
          phone?: string | null
          photo_url?: string | null
          pincode?: string | null
          state?: string | null
          status?: string | null
        }
        Update: {
          aadhar_number?: string | null
          address?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          city?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string
          gst_number?: string | null
          id?: string
          id_proof_url?: string | null
          notes?: string | null
          organization_id?: string
          pan_number?: string | null
          phone?: string | null
          photo_url?: string | null
          pincode?: string | null
          state?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "owners_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          organization_id: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          organization_id?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          organization_id?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address: string | null
          city: string | null
          code: string | null
          created_at: string | null
          gps_latitude: number | null
          gps_longitude: number | null
          id: string
          organization_id: string
          photo_urls: string[] | null
          pincode: string | null
          property_name: string
          start_date: string | null
          state: string | null
          status: Database["public"]["Enums"]["entity_status"] | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          code?: string | null
          created_at?: string | null
          gps_latitude?: number | null
          gps_longitude?: number | null
          id?: string
          organization_id: string
          photo_urls?: string[] | null
          pincode?: string | null
          property_name: string
          start_date?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["entity_status"] | null
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string | null
          created_at?: string | null
          gps_latitude?: number | null
          gps_longitude?: number | null
          id?: string
          organization_id?: string
          photo_urls?: string[] | null
          pincode?: string | null
          property_name?: string
          start_date?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["entity_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_items: {
        Row: {
          asset_type_id: string
          created_at: string | null
          id: string
          purchase_order_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          asset_type_id: string
          created_at?: string | null
          id?: string
          purchase_order_id: string
          quantity: number
          unit_price: number
        }
        Update: {
          asset_type_id?: string
          created_at?: string | null
          id?: string
          purchase_order_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_asset_type_id_fkey"
            columns: ["asset_type_id"]
            isOneToOne: false
            referencedRelation: "asset_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string | null
          id: string
          invoice_number: string | null
          order_date: string | null
          organization_id: string
          status: string | null
          total_cost: number | null
          vendor_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          invoice_number?: string | null
          order_date?: string | null
          organization_id: string
          status?: string | null
          total_cost?: number | null
          vendor_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          invoice_number?: string | null
          order_date?: string | null
          organization_id?: string
          status?: string | null
          total_cost?: number | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          amount_paid: number
          bank_account_id: string | null
          base_amount: number | null
          created_at: string | null
          id: string
          organization_id: string
          payment_date: string | null
          payment_mode: string | null
          processing_fee: number | null
          receipt_number: string | null
          receipt_type: string | null
          reference_number: string | null
          tenant_allotment_id: string | null
          tenant_id: string | null
        }
        Insert: {
          amount_paid: number
          bank_account_id?: string | null
          base_amount?: number | null
          created_at?: string | null
          id?: string
          organization_id: string
          payment_date?: string | null
          payment_mode?: string | null
          processing_fee?: number | null
          receipt_number?: string | null
          receipt_type?: string | null
          reference_number?: string | null
          tenant_allotment_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          amount_paid?: number
          bank_account_id?: string | null
          base_amount?: number | null
          created_at?: string | null
          id?: string
          organization_id?: string
          payment_date?: string | null
          payment_mode?: string | null
          processing_fee?: number | null
          receipt_number?: string | null
          receipt_type?: string | null
          reference_number?: string | null
          tenant_allotment_id?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipts_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "organization_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_tenant_allotment_id_fkey"
            columns: ["tenant_allotment_id"]
            isOneToOne: false
            referencedRelation: "tenant_allotments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      regular_maintenance_rules: {
        Row: {
          apartment_id: string | null
          asset_type_id: string | null
          auto_assign: boolean
          created_at: string | null
          created_by: string | null
          frequency: string
          id: string
          is_active: boolean
          issue_type_id: string
          last_run_at: string | null
          maintenance_type: string
          next_run_at: string | null
          organization_id: string
          property_id: string | null
          start_date: string
        }
        Insert: {
          apartment_id?: string | null
          asset_type_id?: string | null
          auto_assign?: boolean
          created_at?: string | null
          created_by?: string | null
          frequency: string
          id?: string
          is_active?: boolean
          issue_type_id: string
          last_run_at?: string | null
          maintenance_type: string
          next_run_at?: string | null
          organization_id: string
          property_id?: string | null
          start_date: string
        }
        Update: {
          apartment_id?: string | null
          asset_type_id?: string | null
          auto_assign?: boolean
          created_at?: string | null
          created_by?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          issue_type_id?: string
          last_run_at?: string | null
          maintenance_type?: string
          next_run_at?: string | null
          organization_id?: string
          property_id?: string | null
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "regular_maintenance_rules_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regular_maintenance_rules_asset_type_id_fkey"
            columns: ["asset_type_id"]
            isOneToOne: false
            referencedRelation: "asset_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regular_maintenance_rules_issue_type_id_fkey"
            columns: ["issue_type_id"]
            isOneToOne: false
            referencedRelation: "issue_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regular_maintenance_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regular_maintenance_rules_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      replacement_forecasts: {
        Row: {
          asset_id: string
          created_at: string | null
          expected_replacement_date: string | null
          id: string
          replacement_cost: number | null
          urgency_level: string | null
        }
        Insert: {
          asset_id: string
          created_at?: string | null
          expected_replacement_date?: string | null
          id?: string
          replacement_cost?: number | null
          urgency_level?: string | null
        }
        Update: {
          asset_id?: string
          created_at?: string | null
          expected_replacement_date?: string | null
          id?: string
          replacement_cost?: number | null
          urgency_level?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "replacement_forecasts_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_read: boolean
          can_update: boolean
          created_at: string | null
          id: string
          module: string
          organization_id: string
          role: string
          updated_at: string | null
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_read?: boolean
          can_update?: boolean
          created_at?: string | null
          id?: string
          module: string
          organization_id: string
          role: string
          updated_at?: string | null
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_read?: boolean
          can_update?: boolean
          created_at?: string | null
          id?: string
          module?: string
          organization_id?: string
          role?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      room_switches: {
        Row: {
          adjustment_type: string | null
          allotment_id: string
          created_at: string | null
          effective_date: string | null
          id: string
          new_bed_id: string
          notes: string | null
          old_bed_id: string
          organization_id: string
          rent_difference: number | null
          status: string | null
          switch_date: string
          switch_type: string
          tenant_id: string
        }
        Insert: {
          adjustment_type?: string | null
          allotment_id: string
          created_at?: string | null
          effective_date?: string | null
          id?: string
          new_bed_id: string
          notes?: string | null
          old_bed_id: string
          organization_id: string
          rent_difference?: number | null
          status?: string | null
          switch_date?: string
          switch_type?: string
          tenant_id: string
        }
        Update: {
          adjustment_type?: string | null
          allotment_id?: string
          created_at?: string | null
          effective_date?: string | null
          id?: string
          new_bed_id?: string
          notes?: string | null
          old_bed_id?: string
          organization_id?: string
          rent_difference?: number | null
          status?: string | null
          switch_date?: string
          switch_type?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_switches_allotment_id_fkey"
            columns: ["allotment_id"]
            isOneToOne: false
            referencedRelation: "tenant_allotments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_switches_new_bed_id_fkey"
            columns: ["new_bed_id"]
            isOneToOne: false
            referencedRelation: "beds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_switches_old_bed_id_fkey"
            columns: ["old_bed_id"]
            isOneToOne: false
            referencedRelation: "beds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_switches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_switches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      running_bed_maintenance_details: {
        Row: {
          actual_cost: number | null
          apartment_id: string | null
          bed_id: string | null
          billing_month: string | null
          cost_scope: string | null
          created_at: string | null
          diagnosis_summary: string | null
          distributed_amount: number | null
          distributed_beds: Json | null
          id: string
          item_name: string | null
          maintenance_type: string | null
          notes: string | null
          organization_id: string
          parts_details: Json | null
          property_id: string | null
          purchase_id: string | null
          quantity: number | null
          tenant_id: string | null
          ticket_id: string | null
          unit_price: number | null
          vendor_name: string | null
        }
        Insert: {
          actual_cost?: number | null
          apartment_id?: string | null
          bed_id?: string | null
          billing_month?: string | null
          cost_scope?: string | null
          created_at?: string | null
          diagnosis_summary?: string | null
          distributed_amount?: number | null
          distributed_beds?: Json | null
          id?: string
          item_name?: string | null
          maintenance_type?: string | null
          notes?: string | null
          organization_id: string
          parts_details?: Json | null
          property_id?: string | null
          purchase_id?: string | null
          quantity?: number | null
          tenant_id?: string | null
          ticket_id?: string | null
          unit_price?: number | null
          vendor_name?: string | null
        }
        Update: {
          actual_cost?: number | null
          apartment_id?: string | null
          bed_id?: string | null
          billing_month?: string | null
          cost_scope?: string | null
          created_at?: string | null
          diagnosis_summary?: string | null
          distributed_amount?: number | null
          distributed_beds?: Json | null
          id?: string
          item_name?: string | null
          maintenance_type?: string | null
          notes?: string | null
          organization_id?: string
          parts_details?: Json | null
          property_id?: string | null
          purchase_id?: string | null
          quantity?: number | null
          tenant_id?: string | null
          ticket_id?: string | null
          unit_price?: number | null
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "running_bed_maintenance_details_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "running_bed_maintenance_details_bed_id_fkey"
            columns: ["bed_id"]
            isOneToOne: false
            referencedRelation: "beds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "running_bed_maintenance_details_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "running_bed_maintenance_details_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "running_bed_maintenance_details_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "running_bed_maintenance_details_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "maintenance_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tab_permissions: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_read: boolean
          can_update: boolean
          created_at: string | null
          id: string
          is_visible: boolean
          module: string
          organization_id: string
          role: string
          tab_key: string
          updated_at: string | null
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_read?: boolean
          can_update?: boolean
          created_at?: string | null
          id?: string
          is_visible?: boolean
          module: string
          organization_id: string
          role: string
          tab_key: string
          updated_at?: string | null
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_read?: boolean
          can_update?: boolean
          created_at?: string | null
          id?: string
          is_visible?: boolean
          module?: string
          organization_id?: string
          role?: string
          tab_key?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tab_permissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      team_attendance: {
        Row: {
          check_in: string | null
          check_out: string | null
          created_at: string | null
          date: string
          id: string
          notes: string | null
          organization_id: string
          status: string
          team_member_id: string
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string | null
          date: string
          id?: string
          notes?: string | null
          organization_id: string
          status?: string
          team_member_id: string
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string | null
          date?: string
          id?: string
          notes?: string | null
          organization_id?: string
          status?: string
          team_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_attendance_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_attendance_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          aadhar_number: string | null
          address: string | null
          bank_account_number: string | null
          bank_ifsc: string | null
          bank_name: string | null
          city: string | null
          created_at: string | null
          date_of_birth: string | null
          department: string | null
          designation: string | null
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          first_name: string
          gender: string | null
          id: string
          id_proof_number: string | null
          id_proof_type: string | null
          id_proof_url: string | null
          joining_date: string | null
          last_name: string
          organization_id: string
          pan_number: string | null
          phone: string
          photo_url: string | null
          pincode: string | null
          salary_amount: number | null
          state: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          aadhar_number?: string | null
          address?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          city?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          department?: string | null
          designation?: string | null
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name: string
          gender?: string | null
          id?: string
          id_proof_number?: string | null
          id_proof_type?: string | null
          id_proof_url?: string | null
          joining_date?: string | null
          last_name: string
          organization_id: string
          pan_number?: string | null
          phone: string
          photo_url?: string | null
          pincode?: string | null
          salary_amount?: number | null
          state?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          aadhar_number?: string | null
          address?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          city?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          department?: string | null
          designation?: string | null
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          id_proof_number?: string | null
          id_proof_type?: string | null
          id_proof_url?: string | null
          joining_date?: string | null
          last_name?: string
          organization_id?: string
          pan_number?: string | null
          phone?: string
          photo_url?: string | null
          pincode?: string | null
          salary_amount?: number | null
          state?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      team_payments: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          notes: string | null
          organization_id: string
          payment_date: string | null
          payment_mode: string | null
          payment_month: string | null
          payment_type: string
          team_member_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          payment_date?: string | null
          payment_mode?: string | null
          payment_month?: string | null
          payment_type?: string
          team_member_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          payment_date?: string | null
          payment_mode?: string | null
          payment_month?: string | null
          payment_type?: string
          team_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_payments_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_absence_records: {
        Row: {
          allotment_id: string | null
          created_at: string | null
          created_by: string | null
          from_date: string
          id: string
          organization_id: string
          reason: string | null
          tenant_id: string
          to_date: string
        }
        Insert: {
          allotment_id?: string | null
          created_at?: string | null
          created_by?: string | null
          from_date: string
          id?: string
          organization_id: string
          reason?: string | null
          tenant_id: string
          to_date: string
        }
        Update: {
          allotment_id?: string | null
          created_at?: string | null
          created_by?: string | null
          from_date?: string
          id?: string
          organization_id?: string
          reason?: string | null
          tenant_id?: string
          to_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_absence_records_allotment_id_fkey"
            columns: ["allotment_id"]
            isOneToOne: false
            referencedRelation: "tenant_allotments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_absence_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_absence_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_adjustments: {
        Row: {
          adjustment_date: string
          adjustment_type: string
          allotment_id: string | null
          amount: number
          apartment_id: string | null
          bed_id: string | null
          billing_month: string | null
          created_at: string | null
          created_by: string | null
          id: string
          organization_id: string
          property_id: string | null
          reason: string | null
          reference_number: string | null
          tenant_id: string
        }
        Insert: {
          adjustment_date?: string
          adjustment_type: string
          allotment_id?: string | null
          amount?: number
          apartment_id?: string | null
          bed_id?: string | null
          billing_month?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          organization_id: string
          property_id?: string | null
          reason?: string | null
          reference_number?: string | null
          tenant_id: string
        }
        Update: {
          adjustment_date?: string
          adjustment_type?: string
          allotment_id?: string | null
          amount?: number
          apartment_id?: string | null
          bed_id?: string | null
          billing_month?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          organization_id?: string
          property_id?: string | null
          reason?: string | null
          reference_number?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_adjustments_allotment_id_fkey"
            columns: ["allotment_id"]
            isOneToOne: false
            referencedRelation: "tenant_allotments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_adjustments_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_adjustments_bed_id_fkey"
            columns: ["bed_id"]
            isOneToOne: false
            referencedRelation: "beds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_adjustments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_adjustments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_adjustments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_allotments: {
        Row: {
          actual_exit_date: string | null
          apartment_id: string
          balance_due: number | null
          bed_id: string
          booking_date: string | null
          created_at: string | null
          deposit_paid: number | null
          discount: number | null
          estimated_exit_date: string | null
          expected_payment_date: string | null
          expected_stay_days: number | null
          id: string
          kyc_back_url: string | null
          kyc_front_url: string | null
          monthly_rental: number | null
          notice_date: string | null
          onboarding_charges: number | null
          onboarding_date: string | null
          organization_id: string
          paid_amount: number | null
          payment_status: string | null
          premium: number | null
          processing_fee: number | null
          property_id: string
          prorated_rent: number | null
          staying_status: Database["public"]["Enums"]["staying_status"] | null
          tenant_id: string
          total_due: number | null
        }
        Insert: {
          actual_exit_date?: string | null
          apartment_id: string
          balance_due?: number | null
          bed_id: string
          booking_date?: string | null
          created_at?: string | null
          deposit_paid?: number | null
          discount?: number | null
          estimated_exit_date?: string | null
          expected_payment_date?: string | null
          expected_stay_days?: number | null
          id?: string
          kyc_back_url?: string | null
          kyc_front_url?: string | null
          monthly_rental?: number | null
          notice_date?: string | null
          onboarding_charges?: number | null
          onboarding_date?: string | null
          organization_id: string
          paid_amount?: number | null
          payment_status?: string | null
          premium?: number | null
          processing_fee?: number | null
          property_id: string
          prorated_rent?: number | null
          staying_status?: Database["public"]["Enums"]["staying_status"] | null
          tenant_id: string
          total_due?: number | null
        }
        Update: {
          actual_exit_date?: string | null
          apartment_id?: string
          balance_due?: number | null
          bed_id?: string
          booking_date?: string | null
          created_at?: string | null
          deposit_paid?: number | null
          discount?: number | null
          estimated_exit_date?: string | null
          expected_payment_date?: string | null
          expected_stay_days?: number | null
          id?: string
          kyc_back_url?: string | null
          kyc_front_url?: string | null
          monthly_rental?: number | null
          notice_date?: string | null
          onboarding_charges?: number | null
          onboarding_date?: string | null
          organization_id?: string
          paid_amount?: number | null
          payment_status?: string | null
          premium?: number | null
          processing_fee?: number | null
          property_id?: string
          prorated_rent?: number | null
          staying_status?: Database["public"]["Enums"]["staying_status"] | null
          tenant_id?: string
          total_due?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_allotments_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_allotments_bed_id_fkey"
            columns: ["bed_id"]
            isOneToOne: false
            referencedRelation: "beds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_allotments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_allotments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_allotments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_exits: {
        Row: {
          advance_held: number | null
          allotment_id: string
          bed_id: string
          created_at: string | null
          damage_charges: number | null
          eb_charges: number | null
          exit_charges: number | null
          exit_date: string
          has_notice: boolean | null
          id: string
          key_loss_fee: number | null
          key_returned: boolean | null
          notes: string | null
          organization_id: string
          pending_rent: number | null
          refund_date: string | null
          refund_due: number | null
          refund_status: string | null
          room_inspection: boolean | null
          tenant_id: string
          total_deductions: number | null
        }
        Insert: {
          advance_held?: number | null
          allotment_id: string
          bed_id: string
          created_at?: string | null
          damage_charges?: number | null
          eb_charges?: number | null
          exit_charges?: number | null
          exit_date?: string
          has_notice?: boolean | null
          id?: string
          key_loss_fee?: number | null
          key_returned?: boolean | null
          notes?: string | null
          organization_id: string
          pending_rent?: number | null
          refund_date?: string | null
          refund_due?: number | null
          refund_status?: string | null
          room_inspection?: boolean | null
          tenant_id: string
          total_deductions?: number | null
        }
        Update: {
          advance_held?: number | null
          allotment_id?: string
          bed_id?: string
          created_at?: string | null
          damage_charges?: number | null
          eb_charges?: number | null
          exit_charges?: number | null
          exit_date?: string
          has_notice?: boolean | null
          id?: string
          key_loss_fee?: number | null
          key_returned?: boolean | null
          notes?: string | null
          organization_id?: string
          pending_rent?: number | null
          refund_date?: string | null
          refund_due?: number | null
          refund_status?: string | null
          room_inspection?: boolean | null
          tenant_id?: string
          total_deductions?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_exits_allotment_id_fkey"
            columns: ["allotment_id"]
            isOneToOne: false
            referencedRelation: "tenant_allotments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_exits_bed_id_fkey"
            columns: ["bed_id"]
            isOneToOne: false
            referencedRelation: "beds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_exits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_exits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_notices: {
        Row: {
          actual_exit_date: string | null
          allotment_id: string
          bed_id: string
          created_at: string | null
          exit_date: string
          id: string
          notes: string | null
          notice_date: string
          organization_id: string
          status: string | null
          tenant_id: string
        }
        Insert: {
          actual_exit_date?: string | null
          allotment_id: string
          bed_id: string
          created_at?: string | null
          exit_date: string
          id?: string
          notes?: string | null
          notice_date?: string
          organization_id: string
          status?: string | null
          tenant_id: string
        }
        Update: {
          actual_exit_date?: string | null
          allotment_id?: string
          bed_id?: string
          created_at?: string | null
          exit_date?: string
          id?: string
          notes?: string | null
          notice_date?: string
          organization_id?: string
          status?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_notices_allotment_id_fkey"
            columns: ["allotment_id"]
            isOneToOne: false
            referencedRelation: "tenant_allotments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_notices_bed_id_fkey"
            columns: ["bed_id"]
            isOneToOne: false
            referencedRelation: "beds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_notices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_notices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          aadhar_image_url: string | null
          aadhar_number: string | null
          address: string | null
          age: number | null
          bank_account_holder: string | null
          bank_account_number: string | null
          bank_branch: string | null
          bank_ifsc: string | null
          bank_name: string | null
          city: string | null
          company_address: string | null
          company_city: string | null
          company_name: string | null
          company_pincode: string | null
          company_state: string | null
          course: string | null
          created_at: string | null
          date_of_birth: string | null
          date_of_joining: string | null
          designation: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relation: string | null
          emergency_contact_relationship: string | null
          first_name: string
          food_preference: string | null
          full_name: string
          gender: string | null
          gst_name: string | null
          gst_number: string | null
          id: string
          id_card_url: string | null
          id_proof_number: string | null
          id_proof_type: string | null
          id_proof_url: string | null
          kyc_completed: boolean | null
          last_name: string | null
          organization_id: string
          pan_number: string | null
          permanent_address: string | null
          phone: string
          photo_url: string | null
          pincode: string | null
          profession: string | null
          relation_name: string | null
          relation_type: string | null
          state: string | null
          staying_status: string | null
          user_id: string | null
        }
        Insert: {
          aadhar_image_url?: string | null
          aadhar_number?: string | null
          address?: string | null
          age?: number | null
          bank_account_holder?: string | null
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          city?: string | null
          company_address?: string | null
          company_city?: string | null
          company_name?: string | null
          company_pincode?: string | null
          company_state?: string | null
          course?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          date_of_joining?: string | null
          designation?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          emergency_contact_relationship?: string | null
          first_name?: string
          food_preference?: string | null
          full_name: string
          gender?: string | null
          gst_name?: string | null
          gst_number?: string | null
          id?: string
          id_card_url?: string | null
          id_proof_number?: string | null
          id_proof_type?: string | null
          id_proof_url?: string | null
          kyc_completed?: boolean | null
          last_name?: string | null
          organization_id: string
          pan_number?: string | null
          permanent_address?: string | null
          phone: string
          photo_url?: string | null
          pincode?: string | null
          profession?: string | null
          relation_name?: string | null
          relation_type?: string | null
          state?: string | null
          staying_status?: string | null
          user_id?: string | null
        }
        Update: {
          aadhar_image_url?: string | null
          aadhar_number?: string | null
          address?: string | null
          age?: number | null
          bank_account_holder?: string | null
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          city?: string | null
          company_address?: string | null
          company_city?: string | null
          company_name?: string | null
          company_pincode?: string | null
          company_state?: string | null
          course?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          date_of_joining?: string | null
          designation?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          emergency_contact_relationship?: string | null
          first_name?: string
          food_preference?: string | null
          full_name?: string
          gender?: string | null
          gst_name?: string | null
          gst_number?: string | null
          id?: string
          id_card_url?: string | null
          id_proof_number?: string | null
          id_proof_type?: string | null
          id_proof_url?: string | null
          kyc_completed?: boolean | null
          last_name?: string | null
          organization_id?: string
          pan_number?: string | null
          permanent_address?: string | null
          phone?: string
          photo_url?: string | null
          pincode?: string | null
          profession?: string | null
          relation_name?: string | null
          relation_type?: string | null
          state?: string | null
          staying_status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_assignment_rules: {
        Row: {
          apartment_code: string | null
          assigned_employee_id: string
          created_at: string | null
          id: string
          issue_type_id: string | null
          organization_id: string | null
          priority: number | null
          rule_type: string
        }
        Insert: {
          apartment_code?: string | null
          assigned_employee_id: string
          created_at?: string | null
          id?: string
          issue_type_id?: string | null
          organization_id?: string | null
          priority?: number | null
          rule_type?: string
        }
        Update: {
          apartment_code?: string | null
          assigned_employee_id?: string
          created_at?: string | null
          id?: string
          issue_type_id?: string | null
          organization_id?: string | null
          priority?: number | null
          rule_type?: string
        }
        Relationships: []
      }
      ticket_cost_estimates: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          cost_type: string
          created_at: string | null
          decline_reason: string | null
          id: string
          item_name: string
          item_type: string | null
          organization_id: string
          price: number | null
          quantity: number
          status: string
          submitted_by: string | null
          ticket_id: string
          total: number
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          cost_type?: string
          created_at?: string | null
          decline_reason?: string | null
          id?: string
          item_name: string
          item_type?: string | null
          organization_id: string
          price?: number | null
          quantity?: number
          status?: string
          submitted_by?: string | null
          ticket_id: string
          total?: number
          unit_price?: number
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          cost_type?: string
          created_at?: string | null
          decline_reason?: string | null
          id?: string
          item_name?: string
          item_type?: string | null
          organization_id?: string
          price?: number | null
          quantity?: number
          status?: string
          submitted_by?: string | null
          ticket_id?: string
          total?: number
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_cost_estimates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_cost_estimates_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "maintenance_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_logs: {
        Row: {
          action: string
          created_at: string | null
          created_by: string | null
          id: string
          new_status: string | null
          notes: string | null
          old_status: string | null
          ticket_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          new_status?: string | null
          notes?: string | null
          old_status?: string | null
          ticket_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          new_status?: string | null
          notes?: string | null
          old_status?: string | null
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_logs_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "maintenance_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_purchases: {
        Row: {
          actual_cost: number
          cost_estimate_id: string | null
          created_at: string | null
          estimated_cost: number | null
          id: string
          invoice_url: string | null
          item_name: string | null
          organization_id: string | null
          purchase_date: string | null
          purchased_by: string | null
          quantity: number
          ticket_id: string
          updated_at: string | null
          vendor_id: string | null
          vendor_name_manual: string | null
        }
        Insert: {
          actual_cost?: number
          cost_estimate_id?: string | null
          created_at?: string | null
          estimated_cost?: number | null
          id?: string
          invoice_url?: string | null
          item_name?: string | null
          organization_id?: string | null
          purchase_date?: string | null
          purchased_by?: string | null
          quantity?: number
          ticket_id: string
          updated_at?: string | null
          vendor_id?: string | null
          vendor_name_manual?: string | null
        }
        Update: {
          actual_cost?: number
          cost_estimate_id?: string | null
          created_at?: string | null
          estimated_cost?: number | null
          id?: string
          invoice_url?: string | null
          item_name?: string | null
          organization_id?: string | null
          purchase_date?: string | null
          purchased_by?: string | null
          quantity?: number
          ticket_id?: string
          updated_at?: string | null
          vendor_id?: string | null
          vendor_name_manual?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ticket"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "maintenance_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_vendor"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_purchases_cost_estimate_id_fkey"
            columns: ["cost_estimate_id"]
            isOneToOne: false
            referencedRelation: "ticket_cost_estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_purchases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_purchases_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "maintenance_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_purchases_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          apartment_id: string | null
          approval_status: string | null
          assigned_employee_id: string | null
          bed_id: string | null
          created_at: string | null
          created_by: string | null
          description: string
          id: string
          issue_type_id: string | null
          organization_id: string | null
          priority: string | null
          property_id: string | null
          sla_deadline: string | null
          status: string | null
          tenant_id: string | null
          ticket_number: string | null
          total_cost: number | null
          updated_at: string | null
        }
        Insert: {
          apartment_id?: string | null
          approval_status?: string | null
          assigned_employee_id?: string | null
          bed_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description: string
          id?: string
          issue_type_id?: string | null
          organization_id?: string | null
          priority?: string | null
          property_id?: string | null
          sla_deadline?: string | null
          status?: string | null
          tenant_id?: string | null
          ticket_number?: string | null
          total_cost?: number | null
          updated_at?: string | null
        }
        Update: {
          apartment_id?: string | null
          approval_status?: string | null
          assigned_employee_id?: string | null
          bed_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string
          id?: string
          issue_type_id?: string | null
          organization_id?: string | null
          priority?: string | null
          property_id?: string | null
          sla_deadline?: string | null
          status?: string | null
          tenant_id?: string | null
          ticket_number?: string | null
          total_cost?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendors: {
        Row: {
          address: string | null
          bank_account_number: string | null
          bank_ifsc: string | null
          bank_name: string | null
          contact_person: string | null
          created_at: string | null
          email: string | null
          gst_number: string | null
          id: string
          id_proof_url: string | null
          notes: string | null
          organization_id: string
          pan_number: string | null
          phone: string | null
          status: string | null
          vendor_name: string
        }
        Insert: {
          address?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          gst_number?: string | null
          id?: string
          id_proof_url?: string | null
          notes?: string | null
          organization_id: string
          pan_number?: string | null
          phone?: string | null
          status?: string | null
          vendor_name: string
        }
        Update: {
          address?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          gst_number?: string | null
          id?: string
          id_proof_url?: string | null
          notes?: string | null
          organization_id?: string
          pan_number?: string | null
          phone?: string | null
          status?: string | null
          vendor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_next_run_date: {
        Args: { p_frequency: string; p_from_date: string }
        Returns: string
      }
      cleanup_expired_otps: { Args: never; Returns: undefined }
      get_eligible_assignees: {
        Args: { _exclude_user_id?: string }
        Returns: {
          display_name: string
          resolved_user_id: string
          role: string
          team_member_id: string
        }[]
      }
      get_user_org_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_user: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "org_admin"
        | "property_manager"
        | "technician"
        | "tenant"
        | "employee"
        | "accounts"
      bed_type: "Executive" | "Single" | "Double" | "Triple" | "Quad"
      entity_status:
        | "Live"
        | "In-Progress"
        | "Not-Active"
        | "Exited"
        | "Signed"
        | "Not-Ready"
        | "In-Active"
      staying_status:
        | "Booked"
        | "On-Notice"
        | "Staying"
        | "Exited"
        | "Cancelled"
      toilet_type: "Attached" | "Common"
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
    Enums: {
      app_role: [
        "super_admin",
        "org_admin",
        "property_manager",
        "technician",
        "tenant",
        "employee",
        "accounts",
      ],
      bed_type: ["Executive", "Single", "Double", "Triple", "Quad"],
      entity_status: [
        "Live",
        "In-Progress",
        "Not-Active",
        "Exited",
        "Signed",
        "Not-Ready",
        "In-Active",
      ],
      staying_status: ["Booked", "On-Notice", "Staying", "Exited", "Cancelled"],
      toilet_type: ["Attached", "Common"],
    },
  },
} as const
