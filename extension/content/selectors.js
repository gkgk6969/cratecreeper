// Single source of truth for Beatport DOM selectors.
// Update this file when Beatport changes their markup.
// Selector strings can be comma-separated (CSS multi-selector) - first match wins.

window.CRATE_DIGGER_SELECTORS = {
  // Container holding the search results list
  resultsContainer: [
    '[data-testid="search-tracks-list"]',
    '[data-testid="tracks-table"]',
    'main [class*="ReactVirtualized__Grid"]',
    'main [class*="TracksTable"]',
    'main [class*="search"]',
  ].join(', '),

  // Individual result row / card
  resultRow: [
    '[data-testid="track-card"]',
    '[data-testid="tracks-list-item"]',
    'div[class*="TrackCard"]',
    'div[class*="track-row"]',
    'div[class*="TracksList-row"]',
    'div[class*="TracksTable-row"]',
    'div[class*="ReleaseCard"]',
    'tr[class*="track"]',
  ].join(', '),

  // Title text within a result row
  resultTitle: [
    '[data-testid="track-title"]',
    '[class*="trackTitle"]',
    '[class*="TrackTitle"]',
    'a[href*="/track/"]',
  ].join(', '),

  // Artist text within a result row
  resultArtists: [
    '[data-testid="track-artists"]',
    '[class*="trackArtists"]',
    '[class*="ArtistNames"]',
    'a[href*="/artist/"]',
  ].join(', '),

  // Mix-name / version text (e.g. "Original Mix")
  resultMix: [
    '[data-testid="mix-name"]',
    '[class*="mixName"]',
    '[class*="MixName"]',
    '[class*="trackVersion"]',
  ].join(', '),

  // Track-page link inside the row
  resultLink: 'a[href*="/track/"]',

  // Per-row play button (loads the track into the bottom player)
  playButton: [
    'button[aria-label^="Play" i]',
    'button[aria-label*="play track" i]',
    'button[data-testid*="play" i]',
    '[class*="PlayButton"] button',
    'a[class*="CardButton"]',
  ].join(', '),

  // The persistent bottom player wrapper (used to EXCLUDE its buttons from
  // inline-row matching — its cart button has the same aria-label as a row's).
  bottomPlayer: [
    '#bp-player',
    '[class*="PlayerWrapper"]',
    '[class*="Player-style__Player"]',
  ].join(', '),

  // Inline per-row cart button. Beatport's aria-label is explicit:
  //   "Add track 'TITLE' (MIX) by ARTIST to cart. Price: AU$X.XX"
  // Same selector matches the bottom player's cart button - we filter by
  // `closest('#bp-player')` in code to scope to the row variant.
  inlineTrackCartButton: 'button[aria-label^="Add track" i][aria-label*="to cart" i]',

  // Once a track is added, the inline button's aria-label flips to:
  //   "Track 'TITLE' is already in your cart"
  inlineTrackInCart: 'button[aria-label^="Track " i][aria-label*="already in your cart" i]',

  // Companion "Choose a cart" dropdown button — adjacent to cart button. Avoid
  // clicking this by accident.
  chooseCartButton: 'button[aria-label*="Choose a cart" i]',

  // Legacy per-row cart button (kept as fallback)
  addToCartButton: [
    'button[data-testid="add-to-cart"]',
    'button[data-testid="cart-button"]',
    'button[aria-label*="add to cart" i]',
    'button[aria-label*="cart" i]',
    'button[title*="cart" i]',
  ].join(', '),

  // Indicator that a track is already in cart (legacy)
  inCartIndicator: [
    '[data-testid="in-cart"]',
    '[data-testid="cart-button"][aria-pressed="true"]',
    '[aria-label*="in cart" i]',
    '[aria-label*="remove from cart" i]',
  ].join(', '),

  // Cloudflare / Turnstile / hCaptcha challenge surfaces
  captchaSurfaces: [
    'iframe[src*="challenges.cloudflare.com"]',
    'iframe[src*="hcaptcha.com"]',
    'iframe[src*="recaptcha"]',
    '[id*="challenge"]',
    '[class*="Turnstile"]',
  ].join(', '),
};

window.CRATE_DIGGER_CONFIG = {
  // Max ms to wait for results to render
  resultsTimeoutMs: 8000,
  // Max ms to wait for bottom player to load after play click
  bottomPlayerTimeoutMs: 5000,
  // Max ms to wait for in-cart confirmation after cart click. The aria-label
  // flip happens after Beatport's POST /v4/my/carts/.../items/ round-trip
  // returns and React re-renders, so leave generous slack for slow networks.
  cartConfirmTimeoutMs: 14000,
  // Random "reading time" before clicking play (ms range)
  preClickDelayMs: [400, 1000],
  // Random delay between play-click and cart-click (ms range)
  prePurchaseDelayMs: [800, 1800],

  // --- Best-match selection ---
  // Minimum combined score (0-1) for a result to be considered a real match.
  // Below this, the track is reported "notfound" rather than carting a guess.
  matchMinScore: 0.5,
  // If the top two candidates are within this score gap (and both above the
  // minimum), the match is "ambiguous" - we add nothing and flag for review.
  matchAmbiguousGap: 0.08,
  // Minimum artist similarity (0-1) required to cart. Stops a strong title
  // match with the wrong artist (e.g. "Princess Di" vs "Prince") slipping
  // through on combined score alone; below this we flag "ambiguous".
  matchMinArtistSim: 0.4,
  // Weights for the combined score (should sum to ~1). Title matters most;
  // mix/version gets its own term so two results with the same title (e.g.
  // "Supadrug" Original vs Underground Mix) are distinguished by version.
  titleWeight: 0.55,
  artistWeight: 0.25,
  mixWeight: 0.2,
};
