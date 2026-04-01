import { createClient } from '@supabase/supabase-js';

// Lazy admin client — initialized on first call, not at import time.
// Required because ES module imports are hoisted before dotenv.config() runs
// in index.js, so process.env vars are undefined at module load time.
let adminClient;

function getAdminClient() {
  if (!adminClient) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
    adminClient = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return adminClient;
}

// Proxy object — callers use supabaseAdmin.from(...) / supabaseAdmin.auth.getUser(...)
// exactly as before, but the real client is created on first access.
const supabaseAdmin = new Proxy({}, {
  get(_, prop) {
    return getAdminClient()[prop];
  },
});

export default supabaseAdmin;
