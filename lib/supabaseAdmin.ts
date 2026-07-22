import { createClient } from "@supabase/supabase-js";

export const PTM_ACCOUNT_ID =
  "10000000-0000-0000-0000-000000000001";

export function createSupabaseAdmin() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const secretKey =
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "Falta NEXT_PUBLIC_SUPABASE_URL en .env.local."
    );
  }

  if (!secretKey) {
    throw new Error(
      "Falta SUPABASE_SECRET_KEY o SUPABASE_SERVICE_ROLE_KEY en .env.local."
    );
  }

  return createClient(
    supabaseUrl,
    secretKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }
  );
}