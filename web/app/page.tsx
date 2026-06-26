import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-16">
      <header className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <a
            href="https://gatekeep.app"
            target="_blank"
            rel="noreferrer"
            className="text-accent text-sm font-bold uppercase tracking-[0.3em]"
          >
            Gatekeep
          </a>
          <span className="text-muted text-xs uppercase tracking-wider">
            Crate Digger
          </span>
        </div>
        <Link
          href="/login"
          className="text-muted hover:text-fg text-xs uppercase tracking-wider"
        >
          Sign in
        </Link>
      </header>

      <section className="mt-24 flex flex-col gap-6">
        <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
          Spend your Sunday DJing,
          <br />
          not data-entering tracklists.
        </h1>
        <p className="text-muted max-w-xl text-lg leading-relaxed">
          Screenshot any tracklist — a set, a playlist, a story. Crate Digger
          reads every track and fills your Beatport cart automatically. You just
          check out.
        </p>
        <div className="mt-4 flex gap-3">
          <Link
            href="/login"
            className="bg-accent text-accent-fg px-6 py-3 text-sm font-bold uppercase tracking-wider"
          >
            Start free trial
          </Link>
          <a
            href="#how"
            className="border-border text-muted hover:text-fg border px-6 py-3 text-sm uppercase tracking-wider"
          >
            How it works
          </a>
        </div>
      </section>

      <section id="how" className="mt-28 grid gap-8 sm:grid-cols-3">
        {[
          {
            n: '01',
            t: 'Screenshot',
            d: 'Drop a tracklist image. Claude reads artist, title and mix for every track.',
          },
          {
            n: '02',
            t: 'Auto-cart',
            d: 'Our Chrome extension walks your logged-in Beatport tab and adds each track to your cart.',
          },
          {
            n: '03',
            t: 'Check out',
            d: 'You review the cart and buy. Your downloads are ready for Rekordbox.',
          },
        ].map((s) => (
          <div key={s.n} className="border-border border-t pt-4">
            <div className="text-accent font-mono text-xs">{s.n}</div>
            <div className="mt-2 font-bold uppercase tracking-wider">{s.t}</div>
            <p className="text-muted mt-2 text-sm leading-relaxed">{s.d}</p>
          </div>
        ))}
      </section>

      <section className="mt-28">
        <div className="border-border bg-panel border p-8">
          <div className="text-3xl font-bold">
            $10<span className="text-muted text-base font-normal">/month</span>
          </div>
          <p className="text-muted mt-2 text-sm">
            Unlimited tracklists. 7-day free trial. Cancel anytime.
          </p>
          <Link
            href="/login"
            className="bg-accent text-accent-fg mt-6 inline-block px-6 py-3 text-sm font-bold uppercase tracking-wider"
          >
            Get started
          </Link>
        </div>
      </section>

      <footer className="text-muted mt-auto pt-24 text-xs">
        Crate Digger is a{' '}
        <a
          href="https://gatekeep.app"
          target="_blank"
          rel="noreferrer"
          className="text-accent hover:underline"
        >
          Gatekeep
        </a>{' '}
        tool. It is independent and not affiliated with Beatport. You complete
        every purchase yourself.
      </footer>
    </main>
  );
}
