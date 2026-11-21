/**
 * The only module that knows Supabase exists.
 *
 * Uses the secret key, which bypasses RLS, so this must never be imported from
 * client-side code. Every table has RLS enabled with no anon policy, so a
 * leaked publishable key still cannot read review data.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });

let cached: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SECRET_KEY. Copy .env.example to .env.local and fill it in.',
    );
  }

  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}
