// Shared types across the web app and (mirrored loosely) the extension.

export type TrackState =
  | 'pending'
  | 'searching'
  | 'added'
  | 'unconfirmed'
  | 'notfound'
  | 'ambiguous'
  | 'error'
  | 'captcha';

export type QueueItem = {
  id: string;
  session_id: string;
  user_id: string;
  idx: number;
  artist: string;
  title: string;
  mix: string | null;
  state: TrackState;
  detail: string | null;
  product_url: string | null;
  updated_at: string;
};

// The daily cap on paid Claude extractions, per user.
export const DAILY_EXTRACT_LIMIT = 30;
