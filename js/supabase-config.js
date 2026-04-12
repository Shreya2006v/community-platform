// Import Supabase client
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// Your Supabase credentials (replace with yours!)
const SUPABASE_URL = 'https://crrikctrqzogewwflsuk.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_eJBLy2mE6KWjs-i0yHePBQ_MbCXaCZB'

// Create Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

console.log('✅ Supabase initialized!')