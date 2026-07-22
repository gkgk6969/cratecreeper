(function () {
  const SEL = window.CRATE_DIGGER_SELECTORS;
  const CFG = window.CRATE_DIGGER_CONFIG;

  if (!SEL) {
    console.warn('[crate-digger] selectors not loaded');
    return;
  }

  let processedKey = null;
  window.__crateDigger = {
    lastFirstHit: null,
    lastConfirmLabel: null,
    lastResult: null,
    lastTrack: null,
  };

  function debug(...args) {
    if (window.__crateDiggerDebug) console.log('[crate-digger]', ...args);
  }
  function warn(...args) {
    console.warn('[crate-digger]', ...args);
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rand = (a, b) => a + Math.random() * (b - a);

  function isSearchPage() {
    return /\/search/.test(location.pathname);
  }
  function getSearchKey() {
    return new URLSearchParams(location.search).get('q') || '';
  }

  // Poll a predicate until it returns truthy or we time out. Uses setTimeout
  // (not requestAnimationFrame): the Beatport tab runs in the BACKGROUND, where
  // Chrome pauses rAF entirely — an rAF loop would hang forever. Background
  // setTimeout is throttled to ~1s minimum, which is fine for our timeouts.
  function waitFor(predicate, timeoutMs, pollMs = 250) {
    return new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        let result = null;
        try {
          result = predicate();
        } catch {}
        if (result) return resolve(result);
        if (Date.now() - start > timeoutMs) return resolve(null);
        setTimeout(tick, pollMs);
      };
      tick();
    });
  }

  function detectCaptcha() {
    return !!document.querySelector(SEL.captchaSurfaces);
  }

  // Mimic a human pointer interaction. A bare `dispatchEvent('click')` from a
  // content script's isolated world is the suspicious pattern Beatport's
  // React + Quantum Metric pipeline silently drops. The full pointer-down/up/
  // click sequence with realistic clientX/Y matches what a real user produces
  // and reliably fires the React onClick.
  function fireMouseSequence(el) {
    if (!el || !el.isConnected) return false;
    try {
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
    } catch {}
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    const x = r.left + r.width / 2 + (Math.random() * 6 - 3);
    const y = r.top + r.height / 2 + (Math.random() * 6 - 3);
    const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y };
    const events = [
      ['pointermove', PointerEvent],
      ['pointerover', PointerEvent],
      ['pointerenter', PointerEvent],
      ['mouseover', MouseEvent],
      ['mouseenter', MouseEvent],
      ['pointerdown', PointerEvent],
      ['mousedown', MouseEvent],
      ['pointerup', PointerEvent],
      ['mouseup', MouseEvent],
      ['click', MouseEvent],
    ];
    for (const [name, Ctor] of events) {
      try {
        el.dispatchEvent(new Ctor(name, opts));
      } catch {
        try { el.dispatchEvent(new MouseEvent(name, opts)); } catch {}
      }
    }
    return true;
  }

  // aria-label formats observed on Beatport:
  //   add:      "Add track 'TITLE' (MIX) by ARTIST to cart. Price: AU$X.XX"
  //   in cart:  "Track 'TITLE' is already in your cart"
  // Titles may legitimately contain apostrophes (e.g. "Women's Day"), so we
  // capture the title lazily up to the closing quote that's followed by a
  // recognised tail (` (`, ` by`, or ` is already`) instead of using a
  // negated character class that breaks on inner apostrophes.
  function parseCartLabel(label) {
    if (!label) return null;
    const addMatch = label.match(
      /Add track\s+['"\u2018\u2019\u201C\u201D](.+?)['"\u2018\u2019\u201C\u201D]\s*(?:\(([^)]+)\))?\s*by\s+(.+?)\s+to cart/i
    );
    if (addMatch) {
      const priceMatch = label.match(/Price:\s*([A-Z]{0,3}\$?[\d.,]+)/i);
      return {
        state: 'available',
        title: addMatch[1] || '',
        mix: addMatch[2] || '',
        artist: addMatch[3] || '',
        price: priceMatch ? priceMatch[1] : null,
      };
    }
    const inCartMatch = label.match(
      /Track\s+['"\u2018\u2019\u201C\u201D](.+?)['"\u2018\u2019\u201C\u201D]\s+is already in your cart/i
    );
    if (inCartMatch) {
      return { state: 'inCart', title: inCartMatch[1] || '' };
    }
    return null;
  }

  // First /track/ anchor outside the bottom player — used only for productUrl.
  function findFirstTrackAnchor() {
    const anchors = document.querySelectorAll('a[href*="/track/"]');
    for (const a of anchors) {
      if (a.closest && a.closest('#bp-player')) continue;
      return a;
    }
    return null;
  }

  // All inline cart buttons (available + already-in-cart) outside the bottom
  // player, parsed into { btn, label, parsed }. These are the candidate
  // results we score against the requested track.
  function collectInlineCartButtons() {
    const buttons = document.querySelectorAll(
      `${SEL.inlineTrackCartButton}, ${SEL.inlineTrackInCart}`
    );
    const out = [];
    for (const btn of buttons) {
      if (btn.closest && btn.closest('#bp-player')) continue;
      const label = btn.getAttribute('aria-label') || '';
      const parsed = parseCartLabel(label);
      if (!parsed) continue;
      out.push({ btn, label, parsed });
    }
    return out;
  }

  // Normalise a string for fuzzy comparison: lowercase, drop noise tokens that
  // Beatport adds but a screenshot usually omits, normalise separators, and
  // strip punctuation so "Sean Eric's 2WFU (Dub)" ~ "sean erics 2wfu dub".
  function normForMatch(s) {
    if (!s) return '';
    return String(s)
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/\b(feat|ft|featuring|with)\b\.?/g, ' ')
      .replace(/\b(original|extended|radio|club|vocal|instrumental)\s+mix\b/g, ' ')
      .replace(/\bmix\b/g, ' ')
      .replace(/\bremix\b/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Canonicalise a version/mix string for comparison. An absent mix and the
  // generic "Original"/"Extended" versions all collapse to "original" — so a
  // requested track with no version prefers Beatport's "Original Mix". Anything
  // distinctive (e.g. "Underground", "U&I Remix") keeps its words.
  function canonMix(s) {
    const n = normForMatch(s); // also strips the literal word "mix"/"remix"
    if (!n || n === 'original' || n === 'extended') return 'original';
    return n;
  }

  // Score a parsed candidate against the requested track across three terms:
  // title core, artist, and version/mix (see CFG.titleWeight / artistWeight /
  // mixWeight). Splitting the mix into its own term means two results with the
  // same title (e.g. Supadrug Original vs Underground) are told apart instead
  // of both scoring a perfect title match.
  function scoreCandidate(track, parsed) {
    const sim = window.CRATE_DIGGER_SIM;
    if (!sim) return { score: 0, titleSim: 0, artistSim: 0, mixSim: 0 };
    const titleSim = sim.compareTwoStrings(
      normForMatch(track.title),
      normForMatch(parsed.title)
    );
    const artistSim = sim.compareTwoStrings(
      normForMatch(track.artist),
      normForMatch(parsed.artist || '')
    );
    const wantMix = canonMix(track.mix);
    const candMix = canonMix(parsed.mix);
    const mixSim =
      wantMix === candMix ? 1 : sim.compareTwoStrings(wantMix, candMix);
    const score =
      CFG.titleWeight * titleSim +
      CFG.artistWeight * artistSim +
      CFG.mixWeight * mixSim;
    return { score, titleSim, artistSim, mixSim };
  }

  // Score every candidate and return the best plus the runner-up score, so the
  // caller can apply the min-score and ambiguity-gap rules.
  //
  // Beatport frequently renders the SAME track twice on a results page (row +
  // release card + "also bought" panel). Left un-deduped, two identical
  // candidates both score 1.00 and the ambiguity guard falsely bails on a
  // perfect match. Dedupe by product URL first (falls back to a normalised
  // artist/title/mix key when a button has no reachable /track/ link).
  function findBestMatch(track) {
    const candidates = collectInlineCartButtons();
    if (candidates.length === 0) return null;
    const seen = new Set();
    const unique = [];
    for (const c of candidates) {
      const url = trackAnchorFor(c.btn)?.href || '';
      const key =
        url ||
        `${normForMatch(c.parsed.artist)}|${normForMatch(c.parsed.title)}|${canonMix(c.parsed.mix)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(c);
    }
    const scored = unique
      .map((c) => ({ ...c, ...scoreCandidate(track, c.parsed) }))
      .sort((a, b) => b.score - a.score);
    return {
      best: scored[0],
      secondScore: scored[1] ? scored[1].score : 0,
      count: scored.length,
    };
  }

  function isInCartLabel(el) {
    const lbl = (el && el.getAttribute('aria-label')) || '';
    return /already in your cart/i.test(lbl);
  }

  // Count inline (non-bottom-player) "already in your cart" buttons currently
  // in the DOM. Used as a pre-click baseline so we can detect the count rising.
  function countInlineInCart() {
    let n = 0;
    const all = document.querySelectorAll(SEL.inlineTrackInCart);
    for (const c of all) {
      if (c.closest && c.closest('#bp-player')) continue;
      n++;
    }
    return n;
  }

  // Confirm a cart add via several independent signals (any one wins). The old
  // logic only scanned for an in-cart button matching the title, which missed
  // legitimate adds when Beatport's confirm was slow or the row was recycled
  // (React virtualisation) before the poll saw it. We now also watch the exact
  // button we clicked and the overall in-cart count.
  function awaitCartConfirm(clickedBtn, expectedTitle, baselineCount, timeoutMs) {
    const expected = (expectedTitle || '').toLowerCase();
    return waitFor(() => {
      // 1. The exact button we clicked flipped to in-cart (authoritative,
      //    survives the row staying mounted).
      if (isInCartLabel(clickedBtn)) {
        window.__crateDigger.lastConfirmLabel = clickedBtn.getAttribute('aria-label');
        return { via: 'clicked-button' };
      }
      // 2. An inline in-cart button matching the expected title appeared
      //    (handles the clicked node being remounted as a fresh element).
      const all = document.querySelectorAll(SEL.inlineTrackInCart);
      let live = 0;
      for (const c of all) {
        if (c.closest && c.closest('#bp-player')) continue;
        live++;
        const lbl = (c.getAttribute('aria-label') || '').toLowerCase();
        if (expected && (lbl.includes(`'${expected}'`) || lbl.includes(expected))) {
          window.__crateDigger.lastConfirmLabel = c.getAttribute('aria-label');
          return { via: 'title-match' };
        }
      }
      // 3. The number of inline in-cart buttons rose above the pre-click
      //    baseline (fallback when the title text differs from what we parsed).
      if (live > baselineCount) {
        return { via: 'count-increase' };
      }
      return null;
    }, timeoutMs);
  }

  // Product URL for a specific cart button: climb to its row container and
  // find the /track/ link inside. Falls back to the first track anchor.
  function trackAnchorFor(btn) {
    let node = btn;
    for (let i = 0; i < 6 && node; i++) {
      node = node.parentElement;
      if (!node) break;
      const a = node.querySelector && node.querySelector('a[href*="/track/"]');
      if (a) return a;
    }
    return findFirstTrackAnchor();
  }

  function fmtScore(n) {
    return (Math.round(n * 100) / 100).toFixed(2);
  }

  async function addBestMatchToCart(track) {
    // Wait for at least one scored candidate to render.
    const initial = await waitFor(() => findBestMatch(track), CFG.resultsTimeoutMs);
    if (!initial) {
      if (detectCaptcha()) {
        return { state: 'captcha', detail: 'captcha challenge detected on page' };
      }
      return {
        state: 'notfound',
        detail: 'no track cart buttons found in search results',
      };
    }

    const { best, secondScore } = initial;
    const parsed = best.parsed;
    const productUrl = trackAnchorFor(best.btn)?.href || null;
    const matchedStr = `${parsed.artist || ''}${parsed.artist ? ' - ' : ''}${
      parsed.title
    }${parsed.mix ? ` (${parsed.mix})` : ''}`;
    window.__crateDigger.lastFirstHit = {
      label: best.label,
      parsed,
      score: best.score,
      secondScore,
      url: productUrl,
    };
    debug('best match', window.__crateDigger.lastFirstHit);

    // No confident match: skip rather than cart a wrong guess.
    if (best.score < CFG.matchMinScore) {
      return {
        state: 'notfound',
        detail: `no confident match (best "${matchedStr}" scored ${fmtScore(
          best.score
        )})`,
        productUrl,
      };
    }

    // Strong title but wrong artist is the classic false positive (e.g.
    // "Princess Di - What's My Name" matching "Prince - What's My Name").
    // A high combined score can hide a near-zero artist match, so guard the
    // artist term directly and flag for review rather than carting it.
    if (best.artistSim < CFG.matchMinArtistSim) {
      return {
        state: 'notfound',
        detail: `wrong artist (best result was "${
          parsed.artist || '?'
        }", not "${track.artist}")`,
        productUrl,
      };
    }

    // Perfect exact match on all three terms: no ambiguity is possible even
    // if a duplicate row scored equally, so short-circuit and cart it.
    const isPerfect =
      best.titleSim >= 0.99 &&
      best.artistSim >= 0.99 &&
      best.mixSim >= 0.99;

    // Two near-equal candidates above the threshold: flag for manual review.
    if (
      !isPerfect &&
      secondScore >= CFG.matchMinScore &&
      best.score - secondScore < CFG.matchAmbiguousGap
    ) {
      return {
        state: 'ambiguous',
        detail: `two close matches (best "${matchedStr}" ${fmtScore(
          best.score
        )} vs ${fmtScore(secondScore)}) - review on Beatport`,
        productUrl,
      };
    }

    // Best match already in the cart.
    if (parsed.state === 'inCart') {
      return {
        state: 'added',
        detail: `${parsed.title} (was already in your cart)`,
        productUrl,
      };
    }
    if (parsed.state !== 'available') {
      return {
        state: 'error',
        detail: `unrecognised cart-button label: ${best.label.slice(0, 120)}`,
        productUrl,
      };
    }

    // Humanised pre-click delay, then RE-SCORE the live DOM instead of trusting
    // the cached button — Beatport's React virtualises rows and frequently
    // unmounts/remounts them during this gap, leaving the cached node detached.
    await sleep(rand(CFG.preClickDelayMs[0], CFG.preClickDelayMs[1]));
    const live = await waitFor(() => findBestMatch(track), 3000);
    if (!live || !live.best) {
      if (detectCaptcha()) {
        return { state: 'captcha', detail: 'captcha appeared during pre-click pause', productUrl };
      }
      return { state: 'error', detail: 'tracks list empty after pre-click pause', productUrl };
    }
    const liveBest = live.best;

    // Baseline in-cart count BEFORE the click, so a rise confirms the add even
    // when the flipped label's text differs from what we parsed.
    const baselineInCart = countInlineInCart();

    const fired = fireMouseSequence(liveBest.btn);
    if (!fired) {
      return { state: 'error', detail: 'cart button had zero size or was disconnected', productUrl };
    }
    debug('inline cart click sequence dispatched, waiting for confirmation');

    const confirmed = await awaitCartConfirm(
      liveBest.btn,
      liveBest.parsed.title,
      baselineInCart,
      CFG.cartConfirmTimeoutMs
    );
    if (confirmed) {
      debug('cart confirmed via', confirmed.via);
      return {
        state: 'added',
        detail: `${matchedStr} (match ${fmtScore(best.score)})`,
        productUrl,
      };
    }

    if (detectCaptcha()) {
      return { state: 'captcha', detail: 'captcha appeared during cart click', productUrl };
    }

    // Click fired but no confirmation signal within the window. The add usually
    // DID succeed (Beatport was just slow / the row recycled), so surface a soft
    // "unconfirmed" state instead of a hard error - the user can verify in cart.
    return {
      state: 'unconfirmed',
      detail: `${matchedStr} - clicked but could not auto-confirm; check your Beatport cart`,
      productUrl,
    };
  }

  async function processSearchPage(track) {
    debug('processing track', track);
    window.__crateDigger.lastTrack = track;

    if (detectCaptcha()) {
      const result = { state: 'captcha', detail: 'captcha challenge detected on page' };
      window.__crateDigger.lastResult = result;
      return result;
    }

    const result = await addBestMatchToCart(track);
    window.__crateDigger.lastResult = result;
    return result;
  }

  async function run() {
    if (!isSearchPage()) return;
    const key = getSearchKey();
    if (!key || key === processedKey) return;
    processedKey = key;

    let res;
    try {
      res = await chrome.runtime.sendMessage({ type: 'requestCurrentTrack' });
    } catch (e) {
      warn('failed to request current track', e.message);
      return;
    }
    if (!res || !res.track) {
      debug('no current track for this page (key=' + key + ')');
      return;
    }
    window.__crateDiggerDebug = !!res.debug;

    // Always produce a result. If processing throws, report an error rather
    // than silently bailing - otherwise the background never hears back and the
    // whole queue freezes on this track.
    let result;
    try {
      result = await processSearchPage(res.track);
    } catch (e) {
      result = { state: 'error', detail: 'page error: ' + (e?.message || e) };
      window.__crateDigger.lastResult = result;
    }
    debug('final result', result);
    chrome.runtime.sendMessage({ type: 'trackResult', ...result }).catch(() => {});
  }

  run();
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      processedKey = null;
      setTimeout(run, 800);
    }
  }, 500);
})();
