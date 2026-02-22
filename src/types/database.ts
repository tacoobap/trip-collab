export type Database = {
  public: {
    Tables: {
      trips: {
        Row: Trip
        Insert: Omit<Trip, 'id' | 'created_at'>
        Update: Partial<Omit<Trip, 'id' | 'created_at'>>
      }
      days: {
        Row: Day
        Insert: Omit<Day, 'id'>
        Update: Partial<Omit<Day, 'id'>>
      }
      slots: {
        Row: Slot
        Insert: Omit<Slot, 'id'>
        Update: Partial<Omit<Slot, 'id'>>
      }
      proposals: {
        Row: Proposal
        Insert: Omit<Proposal, 'id' | 'created_at'>
        Update: Partial<Omit<Proposal, 'id' | 'created_at'>>
      }
    }
  }
}

export type VibeTag = {
  label: string
  subtitle: string
}

export type Trip = {
  id: string
  name: string
  slug: string
  destinations: string[]
  start_date: string | null
  end_date: string | null
  created_at: string
  image_url: string | null
  tagline: string | null
  vibe_tags: VibeTag[] | null
}

export type Day = {
  id: string
  trip_id: string
  date: string | null
  label: string
  city: string
  day_number: number
  image_url: string | null
  image_attribution: string | null  // "Photo by Name on Unsplash"
  narrative_title: string | null    // LLM-generated, e.g. "Arrive & Settle In"
}

export type Slot = {
  id: string
  day_id: string
  time_label: string
  category: 'food' | 'activity' | 'travel' | 'accommodation' | 'vibe'
  icon: string | null   // custom emoji; falls back to category default when null
  status: 'open' | 'proposed' | 'locked'
  locked_proposal_id: string | null
  sort_order: number
}

export type Proposal = {
  id: string
  slot_id: string
  proposer_name: string
  title: string
  note: string | null
  url: string | null
  votes: string[]
  created_at: string
  exact_time: string | null          // e.g. "7:30 PM" — used for itinerary ordering
  // LLM-generated editorial copy
  editorial_caption: string | null   // e.g. "Spanish moss, oak canopies, morning light"
  narrative_time: string | null      // LLM-suggested clock time, e.g. "9:30 AM" — fallback when exact_time not manually set
  // legacy booking fields — kept optional for existing documents
  booking_status?: string | null
  confirmation_number?: string | null
  confirmation_url?: string | null
  assigned_to?: string | null
}

export type Stay = {
  id: string
  trip_id: string
  name: string
  city: string
  check_in: string
  check_out: string
  proposed_by: string
  created_at: string
  // legacy fields — may exist on older documents
  url?: string | null
  notes?: string | null
  status?: 'considering' | 'booked'
}

export type TripNote = {
  id: string
  trip_id: string
  text: string
  author_name: string
  created_at: string
}

export type SlotWithProposals = Slot & {
  proposals: Proposal[]
  locked_proposal?: Proposal | null
}

export type DayWithSlots = Day & {
  slots: SlotWithProposals[]
}
