# Phase 8 — Library Expansion (post-launch initiative)

*Starts once Phase 7 (hardening) is done and the system has shipped at least one
real client site. Not urgent, not blocking — this is how the registry grows once
the studio is running, not before.*

---

## Why this waits until after Phase 7

Growing the library before the system is fully hardened just means hardening a
bigger surface area later. Ten well-tested sections beat thirty half-tested ones.
Phase 7 (backups, error monitoring, Lighthouse CI, activity log) is what makes
adding sections *safe to do quickly* — CI catches regressions automatically instead
of you manually re-running Lighthouse on every addition like during Phase 4.5.

---

## The goal

Grow from 10 sections to a genuinely deep library — the point where almost any
client brief can be built from existing pieces, and new-section work becomes the
exception, not the rule. Target: **~30-40 sections within the first year** of
running real client work, added a few at a time, driven by actual need rather than
speculative building.

---

## Sourcing pipeline

Five sources, roughly in order of how often you'll reach for them:

1. **Magic UI** — default first stop for animation-forward sections and treatments.
   Free/open-source, removes licensing friction.
2. **React Bits Pro** (pro.reactbits.dev) — deep, purchased library: 350+ assets
   spanning components, 21 block categories (pricing, comparison, stats,
   how-it-works, FAQ, 404, waitlist, etc.), plus full templates. Ships with an
   AI-agent-oriented registry/skill, one-time license. Best source for categories
   the studio registry doesn't have yet (see Two-tier pipeline below — this
   library is large enough that it gets its own staging process, not a
   pick-one-at-a-time browse).
3. **Motion Primitives / Cult UI** — second stop when Magic UI's output reads too
   generic-SaaS for a client's brand.
4. **Client-driven necessity** — a real client brief needs something the registry
   doesn't have. This is actually the *best* source, because it's demand-tested
   before you build it (see Trigger Model below).
5. **Aceternity** (occasional) — reserved for genuine showpiece moments, always
   paired with a performance budget check before it's greenlit. Heavy on
   WebGL/3D/shader effects — treat as showpiece-only, same caution applies to
   React Bits Pro's 3D & Shaders category.

Always browse for inspiration, never copy-paste source directly into the live
registry. Everything gets refactored against the registry contract (see Pipeline
below) — for large purchased libraries, via the two-tier staging process.

---

## Two-tier pipeline for large libraries (React Bits Pro and similar)

Buying a 350-asset library does not mean 350 new registry sections. It means a deep
shelf to convert from, activated a handful at a time. Two distinct stages, kept
physically separate in the repo:

```
vendor/reactbits-pro/          raw, as purchased — untouched, not built from directly
packages/sections-staged/      mechanically converted, contract-shaped, NOT wired into registry.ts
packages/sections/             the live, curated registry — what Claude Code composes sites from
```

**Stage 1 — Conversion (batchable, cheap, no design review required).** Have
Claude Code mechanically convert a batch of raw assets into contract shape: Zod
`schema`, `meta`, presentational component, motion ported to `lib/animations/`
presets, images through `CmsImage`. This is pattern-matching work, safe to run at
volume ("convert the 15 Pricing blocks and the 9 How It Works blocks into staged
sections"). Staged sections are inert — never read by the site renderer, never
seen by a brief-to-site build session, don't bloat build context.

**Stage 2 — Activation (gated, one at a time, the expensive part).** Promoting a
staged section into `packages/sections` runs the **full pipeline**: design
consistency pass against the current studio system, dual-state check, seed/suite
entry, Lighthouse gate, your sign-off. This is the only stage that touches the live
site or a client build.

Because Stage 1 already did the structural work, promotion is fast — closer to
"drag it into sections and run the gate" than a from-scratch build. This is what
makes it safe to convert broadly but activate narrowly.

**Not everything in a large library is a section-in-waiting.** React Bits Pro (and
similar libraries) ship both **Blocks** (full sections — hero, pricing, FAQ) and
**Components** (smaller pieces — text effects, backgrounds, cursor effects, cards).
Only Blocks map cleanly onto `packages/sections-staged/`. Components route
elsewhere, and get a *tighter* cap than sections because they're structural, not
content — a proliferation of backgrounds or card styles breaks system coherence
(e.g. Refined Coastal's band-rhythm rule) faster than a proliferation of sections
does. Route by category:

| Component category | Routes to | Activation cap |
|---|---|---|
| Text effects | New `lib/animations/` preset, or a schema variant on an existing section (like Hero's `headingAccent`) | Small — a handful of presets total, reused everywhere |
| Backgrounds | New `SectionShell` background/ground option, alongside `paper`/`mist`/`ink` | Very small (~3-5 total, ever) — this is a closed system tied to the band-rhythm rule, not a per-category-of-4 situation |
| 3D & Shaders | A `depth move`-style treatment on a specific showpiece section, never general-purpose | Rare, case-by-case, always with a Lighthouse check before activation |
| Cursor effects | Usually skip — irrelevant on mobile, and the client base here is overwhelmingly mobile-viewed local-service sites | Stage only if a specific client's audience is desktop-first |
| UI & Cards (badges, stat tiles, styled cards) | Shared primitive in `packages/sections/src/lib/`, alongside `CmsImage`/`RichText`/`SectionShell` — used *inside* multiple sections, not a section itself | As needed, low risk since these are small and composable |

**Staging shape differs by destination — not everything is schema+meta+Component.**
The two-tier model (convert broadly, activate narrowly) applies across all rows in
the table above, but "staged" means something different depending on where an item
is headed:

| Destination | Staged form | "Drag it in" (activation) means |
|---|---|---|
| Section (Block) | `packages/sections-staged/{name}/` — full schema+meta+Component | Move folder to `packages/sections/`, register in `registry.ts`, run full gate |
| Animation preset (Text effects) | `lib/animations/staged/{name}.ts` — converted GSAP function, same signature as live presets (reduced-motion respected, `gsap.context().revert()` cleanup) | Move file to `lib/animations/`, add as an enum option on whichever sections' animation fields should offer it |
| Background/ground | `theme/staged-grounds.json` or similar — converted token set, not yet a `SectionShell` option | Add to `SectionShell`'s `background` enum AND re-verify the band-rhythm rule still holds with it in play — this one is a design call, not just a technical move |
| Shared primitive (UI & Cards) | `packages/sections/src/lib/staged/{name}.tsx` | Move into `packages/sections/src/lib/`, wire into whichever sections use it |

Conversion (Stage 1) is what makes bulk-processing safe for all four rows — GSAP
porting, reduced-motion compliance, token-based styling all happen once, up front,
mechanically. Activation (Stage 2) stays the gated, human-judgment step in every
case, and for grounds specifically it's *never* purely mechanical — adding a
background always needs a fresh check against the band-rhythm rule, since that's
the one row where a "small" addition can quietly break page-level coherence.

**Governance rule — cap activation per category, not conversion.** Don't activate
every variant of a category. If a source library has 24 hero blocks or 15 pricing
tables, stage as many as useful, but activate a small number (rule of thumb: **~4
per category**, fewer if they're not meaningfully different) that cover genuinely
distinct use cases. A registry with 15 near-identical pricing tables isn't more
capable than one with 3 good ones — it's harder to choose from, harder to keep
token-consistent, and it's the WordPress-plugin-sprawl outcome this whole system
was built to avoid. If a client's brief needs the 5th variant of something for a
genuinely different reason, promote one more staged section for that job — cheap,
because it was already converted.

---

## Trigger model — how a new section gets born

Two legitimate ways a section enters the backlog. Don't build speculatively beyond
these:

**A. Client-driven.** A real brief needs something the library doesn't have (a
before/after slider, a booking calendar block, an interactive pricing calculator).
Build it for that client, generic enough to reuse, and it joins the shared library
automatically — same principle as your GSAP client work before this system existed.

**B. Studio-driven, capped.** Occasionally, browse the sourcing libraries and pick
1-2 sections per quarter that would clearly help multiple upcoming clients (e.g. a
stats/counter section, a horizontal-scroll gallery, a comparison table). Cap this
at a small, deliberate number — this is exactly the kind of "nice to have"
work that expands forever if left unbounded.

---

## The pipeline — every new section, every time

This is Phase 4.5's process, made routine instead of a one-time event:

1. **Source or concept.** Find a reference (external library) or start from a
   client's specific ask.
2. **Triage.** Decide: new registry section / new `SectionShell` capability
   (background, edge) / new `lib/animations/` preset. (Per the earlier
   category discussion — don't let effects become sections, or vice versa.)
3. **Design pass.** For anything visually non-trivial: a quick Claude Design pass
   using the studio's current design system, reviewed with the same art-director
   rigor as Phase 4.5 — reject generic, push specific notes.
4. **Build against the contract.** Claude Code implements: Zod `schema` (props a
   client can actually edit), `meta` with sane `defaults`, presentational server
   component, motion via existing or new `lib/animations/` presets (never raw
   external animation code), images via `CmsImage` only.
5. **Dual-state check.** Renders acceptably with `meta.defaults` AND with all
   optional fields empty — non-negotiable, same rule as day one.
6. **Regression suite entry.** Add it to the seed, extend the pinning script
   (Zod-to-form generator), confirm idempotency still holds.
7. **Lighthouse gate.** Production build, ≥95/100/≥95 on any page using it. This is
   where heavier effects (particle backgrounds, 3D transforms) get vetoed or scoped
   down before they ever reach a client site.
8. **Ship into the shared library.** Available to every site from that point on;
   existing sites are unaffected until they opt in (additive schema rule, as
   always).

---

## Governance — keeping the shelf coherent, not a junk drawer

- **One person (you, initially) owns registry taste.** A new section needs the same
  art-director sign-off as any design work — "would we proudly reuse this on the
  next five clients?" Not every clever effect earns a permanent spot.
- **Retire, don't just add.** If two sections end up doing near-identical jobs
  (e.g. two slightly different stats blocks), consolidate. A growing registry needs
  occasional pruning or it becomes as confusing as the WordPress plugin sprawl this
  whole system exists to avoid.
- **Categorize as you go.** Keep the `meta.category` taxonomy (headers, marketing,
  content, media, forms, etc. — already established) current; add new categories
  deliberately rather than letting sections pile into "misc."
- **Document each addition** the same way Phase 4.5's elevation briefs did: a short
  note on what it is, what a client can edit, what it's *for* — future you (or an
  intern) shouldn't have to read component source to know when to reach for it.

---

---

## Brief-aware selection — closing the "used, not just available" gap

A deep shelf only helps if it's actually shopped from per client, not defaulted past.
Once React Bits Pro (or any large library) is staged, add an explicit selection step
to the design-direction/build process:

**What it does.** Given a client's brief, the selection step reviews (a) the full
*active* registry — every section, every variant, every background/animation
option — and (b) the *staged* catalog (`CATALOG.md` or equivalent index), then
produces two distinct outputs:

1. **A composition plan drawn only from the active registry** — which section,
   which variant, which background/animation, per page/block, with a one-line
   reason per choice ("split hero chosen — brief mentions a strong product photo").
   This is what the actual build uses. Never composes a live site from staged
   (unactivated) items — staged means untested, unreviewed, not Lighthouse-gated.
2. **A short list of staged-but-unactivated candidates that would fit this brief
   better than anything active** — e.g. "the brief wants a pricing comparison; we
   have no active pricing section; React Bits Pro's `PricingTable-B` (staged) is a
   strong match." This is a *recommendation*, not an action.

**Why this is actually the best Phase 8 trigger mechanism.** Output (2) turns "a
real client needs something we don't have" from something you notice by accident
into something the system surfaces automatically, every time, from real briefs —
exactly the demand-driven activation the trigger model already calls for, just
made systematic instead of relying on you catching the gap manually.

**The gate stays human.** A flagged candidate doesn't auto-activate. You (or
whoever owns registry taste) review it, and if approved, it goes through the real
activation pipeline (design consistency pass, dual-state check, suite entry,
Lighthouse gate) before the *next* build can use it live. The client whose brief
surfaced the gap may still ship without it (using the closest active alternative)
if there's no time to activate mid-project — the flag banks the demand signal for
next time either way.

**Where this lives technically.** Extends the existing design-direction step
(§8.2) and the CLAUDE.md brief-to-site conventions from Phase 5 — not a new
subsystem, just an explicit two-output contract added to a step that already
exists. As of the pre-BMS variant pass, the composition-plan half of this
(output 1, the reasoned `section-plan.md` per site) is pulled forward and made
mandatory for every build — see GAME_PLAN_POST_PHASE_7.md Stage 1. The
staged-candidate half (output 2) activates once a staged catalog exists.

## Rough first-wave candidates (not commitments — a starting backlog)

Pick from these once Phase 8 actually starts, prioritized by what real briefs are
likely to need soonest:

- Stats / counter block (animated number count-up)
- Pricing table (2-4 tiers, feature comparison)
- Before/after image slider
- Team / people grid
- Process / "how it works" steps (good animated-beam candidate)
- Horizontal-scroll gallery (already flagged as deferred from Phase 4.5)
- Marquee for testimonials/logos (a deferred Phase 4.5 showpiece concept — never
  built; would be the registry's first marquee)
- Video hero variant
- Map/location block (useful for every local-service client)
- Booking/calendar embed section

---

## Cadence

Not a sprint, not a backlog to clear — a steady trickle. A realistic rhythm once
real client work is flowing: **one new section roughly every 2-3 weeks**, mostly
client-driven, occasionally studio-driven, always through the full pipeline above.
Faster than that risks skipping steps; slower means the library stops compounding.
