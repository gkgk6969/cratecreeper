import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
export const runtime = 'nodejs';

type IncomingTrack = {
  artist?: unknown;
  title?: unknown;
  mix?: unknown;
};

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let tracks: IncomingTrack[];
  try {
    const body = await request.json();
    tracks = Array.isArray(body?.tracks) ? body.tracks : [];
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const clean = tracks
    .map((t) => ({
      artist: typeof t.artist === 'string' ? t.artist.trim() : '',
      title: typeof t.title === 'string' ? t.title.trim() : '',
      mix: typeof t.mix === 'string' && t.mix.trim() ? t.mix.trim() : null,
    }))
    .filter((t) => t.artist && t.title)
    .slice(0, 200);

  if (clean.length === 0) {
    return NextResponse.json({ error: 'No valid tracks' }, { status: 400 });
  }

  // All inserts via service role. user_id comes from the auth context only —
  // never from the request body (prevents writing into another user's queue).
  const admin = createSupabaseAdminClient();

  const { data: session, error: sessionErr } = await admin
    .from('sessions')
    .insert({ user_id: user.id })
    .select('id')
    .single();

  if (sessionErr || !session) {
    return NextResponse.json(
      { error: 'Could not create session' },
      { status: 500 }
    );
  }

  const rows = clean.map((t, idx) => ({
    session_id: session.id,
    user_id: user.id,
    idx,
    artist: t.artist,
    title: t.title,
    mix: t.mix,
    state: 'pending',
  }));

  const { error: itemsErr } = await admin.from('queue_items').insert(rows);
  if (itemsErr) {
    return NextResponse.json(
      { error: 'Could not create queue' },
      { status: 500 }
    );
  }

  return NextResponse.json({ sessionId: session.id, count: rows.length });
}
