# Prototype — flame

Throwaway. Three variants of the "blue flame that grows as the Beatport cart fills" concept.

The question this prototype is answering:

> Does a persistent blue flame across every screen — sized to cart-fill — actually look good and feel right, or does it feel gimmicky? Which shape (ambient / hero / torch) works best?

## Run it

```
pnpm --filter web dev
# open http://localhost:3000/prototype/flame
```

Toggle variants with the bottom pill or `←`/`→` arrow keys. Toggle screens (Dashboard / Account / Login) at the top to see the flame's cross-page presence. Drag the range slider to simulate cart fill, or hit **Play** for autoplay.

## Variants

- **A — Ambient horizon.** Full-width flame licks up from the bottom of every screen, sized by cart-fill.
- **B — Central pyre.** Flame IS the progress bar on the dashboard. A small ember lives in the header on every other screen.
- **C — Left torch.** Tall narrow flame pinned to the left edge, grows taller as the cart fills.

## Verdict

_TODO — fill in which variant won and why, or note that none worked._

## Cleanup

Once picked, delete the losing variants, the switcher, the mock screens, and this README. Fold the winner into the real dashboard route (and root layout if it's global). Rewrite properly — the variant code has no tests and no error handling.
