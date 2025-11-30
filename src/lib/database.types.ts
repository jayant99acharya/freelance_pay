export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          wallet_address: string | null
          role: 'freelancer' | 'client'
          full_name: string
          email: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          wallet_address?: string | null
          role: 'freelancer' | 'client'
          full_name: string
          email: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          wallet_address?: string | null
          role?: 'freelancer' | 'client'
          full_name?: string
          email?: string
          created_at?: string
          updated_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          title: string
          description: string
          client_id: string
          freelancer_id: string | null
          total_amount: number
          token_address: string | null
          token_symbol: string
          escrow_contract_address: string | null
          status: 'draft' | 'active' | 'completed' | 'cancelled'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description: string
          client_id: string
          freelancer_id?: string | null
          total_amount?: number
          token_address?: string | null
          token_symbol?: string
          escrow_contract_address?: string | null
          status?: 'draft' | 'active' | 'completed' | 'cancelled'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string
          client_id?: string
          freelancer_id?: string | null
          total_amount?: number
          token_address?: string | null
          token_symbol?: string
          escrow_contract_address?: string | null
          status?: 'draft' | 'active' | 'completed' | 'cancelled'
          created_at?: string
          updated_at?: string
        }
      }
      milestones: {
        Row: {
          id: string
          project_id: string
          title: string
          description: string
          amount: number
          verification_type: 'github' | 'figma' | 'manual'
          verification_config: Json
          status: 'pending' | 'in_progress' | 'submitted' | 'verified' | 'paid'
          submitted_at: string | null
          verified_at: string | null
          paid_at: string | null
          order_index: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          title: string
          description: string
          amount?: number
          verification_type: 'github' | 'figma' | 'manual'
          verification_config?: Json
          status?: 'pending' | 'in_progress' | 'submitted' | 'verified' | 'paid'
          submitted_at?: string | null
          verified_at?: string | null
          paid_at?: string | null
          order_index?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          title?: string
          description?: string
          amount?: number
          verification_type?: 'github' | 'figma' | 'manual'
          verification_config?: Json
          status?: 'pending' | 'in_progress' | 'submitted' | 'verified' | 'paid'
          submitted_at?: string | null
          verified_at?: string | null
          paid_at?: string | null
          order_index?: number
          created_at?: string
          updated_at?: string
        }
      }
      verification_logs: {
        Row: {
          id: string
          milestone_id: string
          verification_type: string
          oracle_response: Json
          status: 'pending' | 'success' | 'failed'
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          milestone_id: string
          verification_type: string
          oracle_response?: Json
          status?: 'pending' | 'success' | 'failed'
          error_message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          milestone_id?: string
          verification_type?: string
          oracle_response?: Json
          status?: 'pending' | 'success' | 'failed'
          error_message?: string | null
          created_at?: string
        }
      }
      transactions: {
        Row: {
          id: string
          project_id: string
          milestone_id: string | null
          transaction_hash: string
          transaction_type: 'escrow_deposit' | 'milestone_payment' | 'refund'
          amount: number
          from_address: string
          to_address: string
          status: 'pending' | 'confirmed' | 'failed'
          block_number: number | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          milestone_id?: string | null
          transaction_hash: string
          transaction_type: 'escrow_deposit' | 'milestone_payment' | 'refund'
          amount?: number
          from_address: string
          to_address: string
          status?: 'pending' | 'confirmed' | 'failed'
          block_number?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          milestone_id?: string | null
          transaction_hash?: string
          transaction_type?: 'escrow_deposit' | 'milestone_payment' | 'refund'
          amount?: number
          from_address?: string
          to_address?: string
          status?: 'pending' | 'confirmed' | 'failed'
          block_number?: number | null
          created_at?: string
        }
      }
      project_tokens: {
        Row: {
          id: string
          project_id: string
          token_address: string
          token_name: string
          token_symbol: string
          total_supply: number
          decimals: number
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          token_address: string
          token_name: string
          token_symbol: string
          total_supply?: number
          decimals?: number
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          token_address?: string
          token_name?: string
          token_symbol?: string
          total_supply?: number
          decimals?: number
          created_at?: string
        }
      }
    }
  }
}
