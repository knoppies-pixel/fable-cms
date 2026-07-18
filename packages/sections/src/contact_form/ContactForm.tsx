"use client";

import { useState, type FormEvent } from "react";
import { SectionShell } from "../lib/SectionShell";
import type { ContactFormProps } from ".";

const inputClasses =
  "w-full rounded-btn border border-muted/40 bg-surface px-4 py-2.5 outline-none transition-colors focus:border-accent";

/**
 * The one interactive section (client component). Posts JSON to the site's
 * /api/contact route handler; the hidden "website" field is a honeypot —
 * the handler drops submissions that fill it.
 */
export function ContactForm({
  heading,
  intro,
  showPhone,
  submitLabel,
  successMessage,
}: ContactFormProps) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error(`status ${response.status}`);
      form.reset();
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  return (
    <SectionShell width="narrow">
      {heading && (
        <h2 className="text-center text-3xl font-bold tracking-tight">{heading}</h2>
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
    </SectionShell>
  );
}
