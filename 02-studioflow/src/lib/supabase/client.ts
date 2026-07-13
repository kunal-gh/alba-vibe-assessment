'use client';

import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function getSupabaseClient() {
  // Placeholder values let the route compile before a real project is linked.
  // StudioDashboard shows a setup state and never queries this client until
  // isSupabaseConfigured is true.
  browserClient ??= createBrowserClient(
    supabaseUrl ?? 'https://placeholder.supabase.co',
    supabaseKey ?? 'placeholder-key',
  );
  return browserClient;
}
