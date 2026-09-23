import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://amqyttpcezmbsylsdgzd.supabase.co'
const supabaseAnonKey = 'sb_publishable_Gn4ywDpWxxEtLPdtQVxxBA_yPNoEVgx'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

