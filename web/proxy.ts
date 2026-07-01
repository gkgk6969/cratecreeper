import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PROTECTED_PAGES = ['/dashboard', '/account'];
const PAID_APIS = ['/api/extract', '/api/queue'];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // Refreshes the session cookie if needed and returns the current user.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Page gating: redirect unauthenticated users to login.
  if (PROTECTED_PAGES.some((p) => pathname.startsWith(p)) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Auth-only API gating (handlers re-check). Free during beta — login required.
  if (PAID_APIS.some((p) => pathname.startsWith(p))) {
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
  }

  return response;
}

export const config = {
  matcher: ['/dashboard/:path*', '/account/:path*', '/api/extract', '/api/queue'],
};
