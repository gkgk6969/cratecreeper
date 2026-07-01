import type { Metadata } from 'next';
import Link from 'next/link';
import { getGatekeepAppStoreUrl } from '@/lib/gatekeep';

export const metadata: Metadata = {
  title: 'Privacy Policy · Gatekeep cratecreep',
  description: 'How Gatekeep cratecreep collects, uses, and protects your data.',
};

const UPDATED = '26 June 2026';

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-16">
      <header className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <a
            href={getGatekeepAppStoreUrl()}
            target="_blank"
            rel="noreferrer"
            className="text-accent text-sm font-bold uppercase tracking-[0.3em]"
          >
            Gatekeep
          </a>
          <span className="text-muted text-xs uppercase tracking-wider">
            cratecreep
          </span>
        </div>
        <Link
          href="/login"
          className="text-muted hover:text-fg text-xs uppercase tracking-wider"
        >
          Sign in
        </Link>
      </header>

      <article className="mt-16 flex flex-col gap-8 text-sm leading-relaxed">
        <div>
          <h1 className="text-3xl font-bold">Privacy Policy</h1>
          <p className="text-muted mt-2 text-xs">Last updated: {UPDATED}</p>
        </div>

        <Section title="Overview">
          <p>
            Gatekeep cratecreep (&ldquo;cratecreep&rdquo;, &ldquo;we&rdquo;,
            &ldquo;us&rdquo;) is a web app and Chrome extension that helps you
            turn a tracklist screenshot into a Beatport cart. This policy
            describes what data we collect, why we collect it, and your choices.
          </p>
        </Section>

        <Section title="What we collect">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Email address</strong> — when you sign in with a magic link
              (passwordless login via Supabase Auth).
            </li>
            <li>
              <strong>Authentication tokens</strong> — session tokens stored in
              your browser so the web app and Chrome extension stay connected to
              your account.
            </li>
            <li>
              <strong>Tracklist data</strong> — artist, title, and mix names from
              images you upload, plus queue status (added, not found, etc.).
            </li>
            <li>
              <strong>Beatport page content</strong> — the Chrome extension reads
              track names on Beatport search results only while processing your
              queue, to find matches and add them to your cart.
            </li>
            <li>
              <strong>Subscription status</strong> — if you subscribe, Stripe
              handles payment; we store your subscription status (not your card
              number).
            </li>
          </ul>
        </Section>

        <Section title="How we use data">
          <ul className="list-disc space-y-2 pl-5">
            <li>Sign you in and keep your session active.</li>
            <li>Pair the Chrome extension with your dashboard.</li>
            <li>Extract tracks from screenshots and run your Beatport queue.</li>
            <li>Report per-track results back to your dashboard.</li>
            <li>Manage subscriptions and enforce access to paid features.</li>
          </ul>
          <p className="mt-3">
            We do <strong>not</strong> sell your data. We do not use your data
            for advertising, credit decisions, or unrelated purposes.
          </p>
        </Section>

        <Section title="Where data is stored">
          <p>
            Account and queue data is stored in{' '}
            <a
              href="https://supabase.com"
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline"
            >
              Supabase
            </a>{' '}
            (database and authentication). Tracklist images are sent to{' '}
            <a
              href="https://www.anthropic.com"
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline"
            >
              Anthropic
            </a>{' '}
            for text extraction (OCR) on our servers — not inside the extension.
            Payments are processed by{' '}
            <a
              href="https://stripe.com"
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline"
            >
              Stripe
            </a>
            . The extension stores pairing tokens locally in Chrome&apos;s
            storage on your device.
          </p>
        </Section>

        <Section title="Chrome extension">
          <p>
            The Gatekeep cratecreep extension only accesses Beatport while you
            run a queue you started, and Supabase to sync with your account. It
            does not browse other sites, log your general web history, or complete
            purchases for you. You always check out on Beatport yourself.
          </p>
        </Section>

        <Section title="Data retention">
          <p>
            Queue and session data is kept while your account is active so you
            can review past runs. You can clear extension pairing from the
            extension popup or dashboard. To delete your account and associated
            data, contact us (see below).
          </p>
        </Section>

        <Section title="Your choices">
          <ul className="list-disc space-y-2 pl-5">
            <li>Unpair the extension at any time.</li>
            <li>Cancel your subscription from the Account page.</li>
            <li>Request access to or deletion of your data by contacting us.</li>
          </ul>
        </Section>

        <Section title="Contact">
          <p>
            For privacy questions or deletion requests, email the support
            address listed on our Chrome Web Store listing, or sign in and use
            the Account page.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            We may update this policy. The &ldquo;Last updated&rdquo; date at the
            top will change when we do. Continued use after changes means you
            accept the updated policy.
          </p>
        </Section>
      </article>

      <footer className="text-muted mt-auto pt-16 text-xs">
        <Link href="/" className="text-accent hover:underline">
          ← Back to cratecreep
        </Link>
      </footer>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 text-base font-bold uppercase tracking-wider">
        {title}
      </h2>
      <div className="text-muted">{children}</div>
    </section>
  );
}
