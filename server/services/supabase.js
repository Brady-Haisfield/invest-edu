import { createClient } from '@supabase/supabase-js';

// Admin client — uses service key, bypasses RLS.
// Only used server-side. Never expose SUPABASE_SERVICE_KEY to the client.
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export default supabaseAdmin;
