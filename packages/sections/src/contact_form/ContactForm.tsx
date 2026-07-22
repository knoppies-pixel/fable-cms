"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { SectionShell } from "../lib/SectionShell";
import { Reveal } from "../lib/animations/Reveal";
import type { ContactFormProps } from ".";

const inputClasses =
  "w-full rounded-field border border-muted/40 bg-surface px-4 py-2.5 outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/25";

/* On ink the whole form floats as a paper card (the float move). The card is a
 * light island: it resets the four remapped text tokens from their -base
 * copies, which only ever hold the :root values. */
const islandVars = {
  "--color-primary": "var(--color-primary-base)",
  "--color-muted": "var(--color-muted-base)",
  "--color-accent": "var(--color-accent-base)",
  "--color-accent-contrast": "var(--color-accent-contrast-base)",
} as CSSProperties;

/**
 * The one interactive section (client component). Posts JSON to the site's
 * /api/contact route handler. Spam defence in depth: the hidden "website"
 * field is a honeypot, and a server-issued interaction token (fetched on
 * mount) proves the page was actually loaded — its age separates humans from
 * scripts that POST instantly or never render the form at all.
 */
export function ContactForm({
  heading,
  intro,
  showPhone,
  submitLabel,
  successMessage,
  background,
  edge,
}: ContactFormProps) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/contact/token")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { token?: string } | null) => {
        if (!cancelled && data?.token) tokenRef.current = data.token;
      })
      .catch(() => undefined); // route may be unconfigured; submit retries once
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      if (!tokenRef.current) {
        // Mount-time fetch failed (flaky network) — one more try before send.
        const retry = await fetch("/api/contact/token").catch(() => null);
        if (retry?.ok) {
          const body = (await retry.json()) as { token?: string };
          if (body.token) tokenRef.current = body.token;
        }
      }
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...data,
          formToken: tokenRef.current ?? undefined,
          pageSlug:
            typeof window !== "undefined" ? window.location.pathname : undefined,
        }),
      });
      if (!response.ok) throw new Error(`status ${response.status}`);
      form.reset();
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  const ink = background === "ink";
  return (
    <SectionShell background={background} width="narrow" edge={edge}>
      <Reveal
        className={ink ? "rounded-card bg-surface p-6 shadow-2xl sm:p-10" : ""}
        style={ink ? islandVars : undefined}
      >
        {heading && (
          <h2 className="text-center font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {heading}
          </h2>
        )}
        {intro && <p className="mt-4 text-center text-muted">{intro}</p>}
        <form onSubmit={handleSubmit} className="mt-10 space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Name</span>
            <input name="name" required maxLength={120} className={inputClasses} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Email</span>
            <input
              name="email"
              type="email"
              required
              maxLength={200}
              className={inputClasses}
            />
          </label>
        </div>
        {showPhone && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Phone</span>
            <input name="phone" type="tel" maxLength={40} className={inputClasses} />
          </label>
        )}
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Message</span>
          <textarea
            name="message"
            required
            rows={5}
            maxLength={4000}
            className={inputClasses}
          />
        </label>
        {/* Honeypot: hidden from real users, tempting to bots. */}
        <div className="hidden" aria-hidden="true">
          <label>
            Website
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        <button
          type="submit"
          disabled={status === "sending"}
          className="rounded-btn bg-accent px-6 py-3 font-semibold text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {status === "sending" ? "Sending…" : submitLabel}
        </button>
        <p role="status" aria-live="polite" className="min-h-6">
          {status === "sent" && <span className="font-medium">{successMessage}</span>}
          {status === "error" && (
            <span className="font-medium">
              Something went wrong — please try again.
            </span>
          )}
        </p>
        </form>
      </Reveal>
    </SectionShell>
  );
}
