// Crate Digger extension config.
//
// These are PUBLIC values, safe to ship in a client:
//   - SUPABASE_URL and SUPABASE_ANON_KEY are the same ones the web app exposes
//     as NEXT_PUBLIC_*. Row-Level Security protects the data, not these keys.
//
// NEVER put the Supabase service-role key or the Anthropic key here.
//
// Fill these in to match your Supabase project before loading the extension.
self.CRATE_DIGGER_CONFIG = {
  SUPABASE_URL: 'https://pqgecldlbmpmnypqdxvk.supabase.co',
  SUPABASE_ANON_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxZ2VjbGRsYm1wbW55cHFkeHZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMjQ0MzMsImV4cCI6MjA5NzcwMDQzM30.zlMpnTIbSzHvCRDsYTH7ZORgQW_ldyxofEOybAx2R48',
  DASHBOARD_URL: 'https://cratecreeper-kh9c.vercel.app/dashboard',
};
