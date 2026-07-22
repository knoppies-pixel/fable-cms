# Fable CMS — Roadmap: Phase 4.5 Close-out → Real Client Test

Plan as agreed: build Phases 1–7 robust and client-agnostic throughout. No phase
gets shaped around a specific client. Once 7 is done, run Brand Management
Solutions (father-in-law's printing business) through the finished system as its
first real-world operator test — not as a design input to any phase.

---

## 0. Close out Phase 4.5 — ✅ COMPLETE (commit b44860e)

- [x] Above-fold animation-skip fix confirmed working — H1 no longer the LCP
      element, verified via trace; above-fold content renders motion-free on load.
- [x] Suite drift resolved — home section order, hero marker split, Phase 4
      reorder target all updated to match the approved seed (test drift, not
      product bugs).
- [x] Full gate green: Phase 1 22/22 · Phase 2 23/23 · Phase 3 27/27 · Phase 4
      16/16 · seed idempotency clean · additive-schema guarantee 10/10.
- [x] Lighthouse: About 99/100/100. Home 100/100 (a11y/SEO), performance 94 —
      isolated via controlled desktop-preset comparison to local HTTP/1.1 loopback
      contention under Lighthouse's mobile throttle, not a shipped defect.
      **Flagged in DECISIONS.md for re-verification against a real Vercel preview
      (HTTP/2) before treating 94 as the true production number.**
- [x] Studio sign-off recorded in DECISIONS.md.

**Deferred, re-homed to Phase 8:** showpiece section concepting from the original
elevation briefs. Not built speculatively — held for real client demand per the
Phase 8 trigger model, most likely surfaced by the Brand Management Solutions
milestone.

**Exit criteria:** all acceptance suites green, Lighthouse ≥95/100/≥95 on every
seeded page, ten elevated sections live, commit clean. **Met**, with one flagged
follow-up (production Lighthouse re-check) carried forward as an open item, not a
blocker.

---

## Phase 5 — First real site pipeline (built generic, not client-shaped) — ✅ COMPLETE (commits 40a4ae7, 2eef2c8, 362df81)

Deliverable is the *pipeline itself*, reusable for any future client:

- [x] Run the design-direction step (§8.2) once, end-to-end, as a proof of process
      — pilot subject can be another disposable demo, doesn't need to be a real
      client. *(Fynbos & Fern pilot: three named directions, measured WCAG audit,
      approved Protea Veld distilled to `kb/fynbos-fern/tokens.json`; generic
      runbook + artifact contract pinned in `kb/README.md`.)*
- [x] Build `create-site.ts`: registers site row + API key, clones template, writes
      site env, outputs Vercel setup steps. *(Key shown once/hash stored, delivery
      secrets, media bucket, memberships, per-clone port pair; refuses existing
      slug/dir.)*
- [x] Write the `CLAUDE.md` brief-to-site conventions into the template repo (brief
      → pages → registry sections → typed seeding helper). *(`seed-lib.ts`:
      compile-time `z.input` typing per section type + runtime schema validation,
      idempotent media/page semantics.)*
- [x] Acceptance: one real-or-realistic pilot site built end-to-end from a brief,
      through the actual pipeline, no manual shortcuts. *(3 pages / 15 sections /
      16 assets; suites 1–4 re-run green + new `pnpm test:phase5`, 67 checks;
      Lighthouse a11y/SEO 100 everywhere, perf 96/95, home 93 = the known local
      Lantern artifact — desktop control 100.)*

**Exit criteria:** a second person (or future-you, cold) could run `create-site.ts`
against a fresh brief and get a working site without you hand-holding every step.
**Met** — the printed handoff plus template `CLAUDE.md` + `kb/README.md` carry the
whole flow; details in DECISIONS.md §Phase 5. Carried forward with the 4.5 open
item: re-verify home-page Lighthouse (demo *and* pilot) on a real Vercel preview.

---

## Phase 6 — WordPress/Elementor migration tool — ✅ COMPLETE (commits ed70f5e, b7b2501 + acceptance commit)

- [x] *(pre-work)* Additive `seo.title` on pages per the Phase 5 DECISIONS flag:
      nav label and SEO title decoupled (site metadata verbatim override, admin
      page-SEO panel, seed-lib typing) — so migrated content doesn't inherit
      awkward titles into the nav.
- [x] CLI: crawl an existing site or parse a WP export XML, extract pages,
      headings, copy, images. *(`pnpm migrate-wp extract` — nav+sitemap crawl
      incl. Elementor rendered HTML, lazy-src/size-suffix/chrome handling; WXR
      mode parses wpautop, Yoast postmeta and an `_elementor_data` subset.)*
- [x] Propose a mapping into registry sections as a reviewable JSON plan.
      *(`plan` — 9 section-type heuristics, low-confidence mappings marked
      `review` with warnings, props dry-validated against live schemas.)*
- [x] Human-in-the-loop by design — plan is reviewed/edited before import runs.
      *(Enforced, not conventional: `import` refuses until `approved: true` +
      `reviewNotes`; proven by the phase 6 suite and the real run.)*
- [x] On approval: download media into Storage, insert rows. *(Full-size download
      with rendered-size fallback; rows via the Phase 5 typed seeding helper —
      runtime schema validation, wholesale page replacement.)*
- [x] Acceptance: migrate one existing WordPress client site to a preview
      deployment. *(mulkernlandscaping.com — real WP+Elementor business — →
      `sites/mulkern-demo` production preview: 8 pages / 55 sections / 45 media,
      every page rendering with migrated seo.titles; demo-only, never deploy.)*

**Relevance check for BMS later:** their current site has "no content" — likely
means this tool isn't needed for them (nothing worth extracting), but build it
generically anyway since most of your other real clients are on WordPress today.

**Exit criteria:** one real migration completed to a working preview, plan-review
step proven to catch at least one thing worth a human override. **Met** — the
review caught a portfolio page hiding behind an `/elementor-1932` kit slug and
two Elementor demo pages (Vermont copy + lorem ipsum on a Hawaii business) that
a blind import would have shipped; overrides recorded in the committed
`migrations/mulkern-demo/plan.json`. Gate: suites 1–5 re-run green + new
`pnpm test:phase6` (39 checks); details in DECISIONS.md §Phase 6. Carried
forward: the Vercel-preview Lighthouse re-check from 4.5/5.

---

## Phase 7 — Hardening & polish (the real finish line) — ✅ COMPLETE

- [x] Props snapshots — lightweight revision history on section saves.
      *(Trigger-captured BEFORE-images, 20/section, RLS-scoped; History panel
      + restore in the section editor — restores are themselves snapshotted,
      and the editor remounts on server-side prop changes so stale form state
      can't clobber a restore.)*
- [x] Activity log — who changed what, when. *(Append-only, forgery-blocked
      intent-level events from every admin action incl. browser media ops;
      deleted sections leave a rescue copy in the event detail; Activity tab.)*
- [x] Site exporter — client offboarding, proves the "you can always leave"
      promise is real, not marketing. *(`pnpm export-site` / `import-site`:
      all rows + files + schema + a standalone bundle. Tested against the
      actual pilot site: destroy → restore = byte-identical content API; the
      standalone copy installed + built + served OUTSIDE the monorepo with no
      CMS/Supabase at all.)*
- [x] Lighthouse CI + link checker wired into the template's GitHub Actions.
      *(`pnpm quality` on a registry-defaults fixture in snapshot mode —
      a11y ≥95, SEO 100, perf error-line 90 (documented local/CI artifact vs
      the ≥95 production bar), zero broken internal links. In root CI (fixed
      from permanently red) and the template's own workflow for client repos.
      The link checker caught a real fixture gap on its first run.)*
- [x] Form spam protection review — honeypot alone was NOT sufficient: the
      bigger hole was submissions vanishing into console.log. *(Now: honeypot
      + signed interaction token + link heuristic + DB-backed rate limits;
      persisted to `form_submissions`, admin Submissions inbox, optional
      Resend notify; flagged-not-dropped so a false positive never loses a
      lead.)*
- [x] Error monitoring (Sentry) wired into both admin and site-template.
      *(DSN-optional; captures on the lead-loss paths; `pnpm sentry:smoke`
      proved a real envelope reaches an ingest server, no account needed.)*
- [x] Backup strategy for Supabase — documented and tested with a real
      restore drill. *(BACKUPS.md + `pnpm backup` / `restore-backup` /
      `backup:drill`; live drill 2026-07-22: database destroyed and restored,
      3 sites byte-identical, logins restored, 10/10 — and it surfaced +
      fixed a real kong-after-reset quirk.)*

**Exit criteria:** you'd trust this system with a real business's only website and
your family's goodwill. This is the actual gate before Brand Management Solutions.
**Met** — every mechanism above was exercised against real failure (destroyed
databases, deleted sites, bot submissions, thrown server errors), not just
implemented. Gate: suites 1–6 re-run green + `pnpm test:phase7` (79 checks) +
sentry smoke (5) + backup drill (10); details in DECISIONS.md §Phase 7. Still
carried forward (unchanged, needs a real deployment): the Vercel-preview
Lighthouse re-check from 4.5/5/6.

---

## Milestone — Brand Management Solutions (first real client, not a phase)

Runs the *finished* system as a normal operator would — this is where the system
gets tested, not extended.

- [ ] Pull and curate photos from their Facebook (can start anytime, no dependency
      on any phase above — pure manual prep work).
- [ ] Write `brief.md`: services, pages, tone, keywords, any reference sites they
      like.
- [ ] Design-direction session in Claude Design, aimed at their actual brand.
- [ ] Run `create-site.ts`, build via the standard brief-to-site flow — no special
      handling, no phase adjustments.
- [ ] Internal review, then client review with an explicit ask: "try to break this,
      tell me what's annoying" — optimize for honest friction reports, not
      politeness.
- [ ] Publish, connect their domain, hand over admin access.
- [ ] **The actual test:** does he use the admin panel without calling you? Does
      anything in the real (messy, unstructured Facebook-photo) content pipeline
      break in a way the test suites didn't predict?

**This milestone's outcome decides what comes after** — Phase 8 (library
expansion) properly starts once this real usage surfaces real gaps, and the
business-model questions (pricing, positioning, which clients to pursue next) get
answered with real signal instead of guesses.

---

## After the milestone

- **Phase 8 — Library expansion** (ongoing, not a phase to finish) — now
  legitimately driven by what BMS's real brief needed but the registry didn't have,
  rather than speculative building.
- **Business questions** (pricing model, positioning, next client) — answered with
  real operator feedback in hand rather than hypothetically.
