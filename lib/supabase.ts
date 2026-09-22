import { createClient } from '@supabase/supabase-js'

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseUrl = (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) 
  ? rawUrl 
  : 'https://placeholder.supabase.co'

// دعم كلا الاسمين (ANON_KEY أو PUBLISHABLE_KEY) لضمان العمل تحت أي مسمى
const supabaseAnonKey = 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
  'placeholder-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
