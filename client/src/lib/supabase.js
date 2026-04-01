import { createClient } from '@supabase/supabase-js';

// Anon client — uses publishable key, respects RLS.
// Safe to use in the browser.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
