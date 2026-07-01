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

// Daily cap on Claude extractions per user (free beta).
export const DAILY_EXTRACT_LIMIT = 10;
