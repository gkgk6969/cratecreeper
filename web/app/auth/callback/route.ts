import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// Only accept simple internal paths as post-login destinations. Anything else
// (protocol-relative //evil.com, backslashes, encoded @, off-domain URLs) is
// rejected so ?next= can't be used as a same-origin phishing hop.
function safeNext(value: string | null): string {
  if (!value) return '/dashboard';
  if (!/^\/[A-Za-z0-9/_\-?=&.]*$/.test(value)) return '/dashboard';
  if (value.startsWith('//')) return '/dashboard';
  return value;
}

// OTP / OAuth callback. Supabase redirects here with a `code` to exchange for a
// session cookie, then we forward to the requested next path (allowlisted).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
