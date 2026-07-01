# Gatekeep — The Golden Business Model

> One-line pitch: **Screenshot any tracklist, and we assemble it into a cart across the DJ stores — cheapest first — while you just check out.**

This doc is the north star for how Gatekeep (parent brand) and its first tool, cratecreep, make money. It is deliberately honest about what is realistic, what conflicts, and what to avoid.

---

## 1. What we are (and are NOT)

**We ARE** a funnel / aggregator layer that sits on top of existing music stores.

- The user always buys from the real store (Beatport, Juno, Bandcamp, Traxsource, etc.).
- We never hold inventory, licenses, or rights. We never process the music sale itself.
- Our value: turn a screenshot into a filled cart, find every track, and (later) find the cheapest source.

**We are NOT** a music marketplace or distributor.

- No licensing deals, no payouts to labels, no rights management.
- That path (Tier 3 below) is a different company — avoid it for now.

---

## 2. The two ways we take a clip

There are exactly two realistic revenue streams. We use both, per store.

### A. Subscription (primary, already live)

- Users pay a flat monthly fee ($10/mo, 7-day trial) for the tool.
- Cleanest possible "clip": no store's permission needed, no tracking required, predictable recurring revenue.
- This is the moat. Even with zero affiliate income, the product stands on this.

### B. Affiliate commission (secondary, where allowed)

- Affiliate = the store pays us a percentage for sending them a sale.
- Paid only when the sale is **attributed** to us — i.e. the buyer arrived through our tracked referral link and the store's cookie credited us.

---

## 3. The core tension (the thing we must design around)

> **Silent automation and affiliate attribution fight each other.**

- Our magic feature = the extension silently adds tracks to the user's already-logged-in cart.
- Affiliate payout = requires a tracked click-through to the store.
- Silent carting bypasses the referral click → no attribution → no commission.

**Resolution: choose the monetisation per store.**

| Store behaviour | How we monetise |
|-----------------|------------------|
| Silent auto-fill of the cart | Subscription (stream A) |
| Routed through a tracked affiliate link / assisted checkout | Affiliate commission (stream B) |

We do not try to force one model onto every store. Some stores are "subscription-funded silent", others are "commission-funded assisted".

---

## 4. The product ladder

### Tier 1 — Get ALL the tracks (next build)

- Expand beyond Beatport to other DJ stores (Juno, Bandcamp, Traxsource).
- Each store = its own content script + selectors (the page-reading logic).
- More coverage = more of the tracklist found. Incremental, same architecture we already have.

### Tier 2 — Cheapest across stores (the ambitious, differentiated product)

- Search each store, compare prices, pick the lowest per track.
- Output: "All 18 tracks found. Cheapest total $46 across 3 stores."
- Hard parts: each store's pages differ (more scrapers to maintain), prices vary by format (MP3 / WAV / lossless), each store's cart is separate.
- This price-comparison insight is the thing people happily pay a subscription for.

### Tier 3 — Our own marketplace (AVOID for now)

- Becomes a storefront: licensing, payments, payouts, rights = a music-distribution company.
- Huge legal/business leap, not a code leap. Someday-pivot only, needs capital and label relationships.

---

## 5. Risks to respect

- **Store Terms of Service**: many stores forbid automation/bots. Silent carting may already breach Beatport's terms; doing it at scale across stores raises ban risk (user accounts and ours).
- **Affiliate terms** frequently ban bot-driven traffic — silent automation can get an affiliate account terminated.
- **Page changes**: stores change their HTML; our scrapers break until updated. More stores = more maintenance.
- **Attribution leakage**: if we automate where we meant to use affiliate links, we lose the commission silently.

Design implication: lean on the **subscription** as the dependable clip; treat affiliate as upside where the store's rules and tracking genuinely allow it.

---

## 6. The golden model, in one paragraph

Gatekeep is a **price-comparison and cart-assembly layer across DJ stores**, monetised primarily by a **monthly subscription** and secondarily by **affiliate commission where stores permit tracked referrals**. We never touch rights, inventory, or payouts — we are the funnel that saves DJs hours of manual track-hunting and finds them the cheapest source. The subscription is the moat; affiliate is the upside; the marketplace is a deliberate non-goal until there's a reason and the money to do it properly.

---

## 7. Near-term priorities (before scaling the model)

1. Stabilise the existing Beatport flow (no frozen queues, no wrong-cart matches).
2. Get the extension installable by real users (Chrome Web Store).
3. Wire real Stripe billing so the subscription clip actually collects.
4. Then expand to a second store (Tier 1) and prototype cheapest-finder (Tier 2).
