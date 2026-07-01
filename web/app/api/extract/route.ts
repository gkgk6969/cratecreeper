import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { extractWithClaude, parseImageDataUrl } from '@/lib/claude';
import { DAILY_EXTRACT_LIMIT } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Parse + validate the upload before spending a Claude call.
  let image: { base64: string; mediaType: string };
  try {
    const body = await request.json();
    image = parseImageDataUrl(body?.image);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Invalid request' },
      { status: 400 }
    );
  }

  // Rate limit: count this user's extractions in the last 24h (service role,
  // since extract_log has no client INSERT path).
  const admin = createSupabaseAdminClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from('extract_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', since);

  const used = count ?? 0;
  if (used >= DAILY_EXTRACT_LIMIT) {
    return NextResponse.json(
      {
        error: `Daily limit reached (${DAILY_EXTRACT_LIMIT} screenshots). Try again tomorrow.`,
      },
      { status: 429 }
    );
  }

  let tracks;
  try {
    tracks = await extractWithClaude(image.base64, image.mediaType);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Extraction failed' },
      { status: 502 }
    );
  }

  if (tracks.length === 0) {
    return NextResponse.json(
      { error: 'No tracks found in this screenshot. Try a clearer image.' },
      { status: 422 }
    );
  }

  await admin.from('extract_log').insert({ user_id: user.id });

  return NextResponse.json({
    tracks,
    source: 'claude',
    extractsRemaining: Math.max(0, DAILY_EXTRACT_LIMIT - used - 1),
  });
}
