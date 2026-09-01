import { createBrowserClient } from '@supabase/ssr';

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!url || !key) {
  console.warn(
    '[Stewdio] Supabase env vars not set.\n' +
    'Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local\n' +
    'then restart the dev server.',
  );
}

export const isConfigured = Boolean(url && key);

/** Browser-aware client (handles cookie-based sessions in the browser) */
let browserClient: ReturnType<typeof createBrowserClient> | null = null;
export const createBrowserSupabase = () => {
  if (!browserClient) {
    browserClient = createBrowserClient(
      url || 'https://placeholder.supabase.co',
      key || 'placeholder',
    );
  }
  return browserClient;
};
