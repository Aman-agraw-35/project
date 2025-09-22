import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          username: string
          created_at: string
        }
        Insert: {
          id: string
          email: string
          username: string
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          username?: string
          created_at?: string
        }
      }
      game_rooms: {
        Row: {
          id: string
          name: string
          host_id: string
          is_active: boolean
          current_card_id: number | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          host_id: string
          is_active?: boolean
          current_card_id?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          host_id?: string
          is_active?: boolean
          current_card_id?: number | null
          created_at?: string
        }
      }
      flashcards: {
        Row: {
          id: number
          question: string
          answer: string
          category: string
          created_at: string
        }
        Insert: {
          id?: number
          question: string
          answer: string
          category: string
          created_at?: string
        }
        Update: {
          id?: number
          question?: string
          answer?: string
          category?: string
          created_at?: string
        }
      }
      game_players: {
        Row: {
          id: string
          room_id: string
          user_id: string
          score: number
          joined_at: string
        }
        Insert: {
          id?: string
          room_id: string
          user_id: string
          score?: number
          joined_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          user_id?: string
          score?: number
          joined_at?: string
        }
      }
      match_history: {
        Row: {
          id: string
          room_id: string
          card_id: number
          winner_id: string | null
          completed_at: string
        }
        Insert: {
          id?: string
          room_id: string
          card_id: number
          winner_id?: string | null
          completed_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          card_id?: number
          winner_id?: string | null
          completed_at?: string
        }
      }
    }
  }
}