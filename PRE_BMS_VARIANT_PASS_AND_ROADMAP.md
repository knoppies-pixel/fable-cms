# Pre-BMS Variant Pass — Proposal & Rationale

## The problem, stated precisely

Two pilots (Fynbos & Fern, Mulkern) both came out structurally similar despite
different tokens — different paint, same shape. Your instinct that "just
different colors and fonts" isn't good enough is correct, and it needs solving
before Brand Management Solutions, not after.

## Why "4-6 variants across 12 categories, before BMS" is the wrong-sized fix

That proposal is **48-72 new sections** — each needing a design pass,
Claude Code implementation, dual-state check, suite entry, and Lighthouse gate.
Roughly 5-10x the total component-build work done from Phase 0 through Phase 6
combined. Three problems with doing this now, specifically:

1. **It's the wrong lever.** More variants sitting unused doesn't fix
   similarity — the design-direction step already had 3-4 hero variants and
   basically didn't exercise the choice meaningfully across two pilots. A
   bigger shelf that gets shopped from the same lazy way just delays the same
   problem, at 10x the cost.
2. **It breaks a commitment you made deliberately.** Phase 8 was explicitly
   sequenced *after* the BMS milestone, gated on real client demand rather
   than speculative building — that was your call, for good reasons (a
   registry built on guesses tends to have the wrong 40 sections). Reversing
   it now, right before the finish line, re-opens exactly the scope-creep
   risk you were guarding against.
3. **It delays real signal.** BMS is the first real-world test of the whole
   system. Every week spent building unvalidated variants is a week BMS
   *isn't* teaching you what the registry actually needs — which was the
   entire point of sequencing it before Phase 8 in the first place.

## The actual mechanism, and why it's higher leverage

Similarity came from **selection, not inventory**. The Phase 8 doc already
designed the fix — "brief-aware selection" — but scoped it as a Phase 8 item,
i.e. deferred. Pulling *that one piece* forward, without pulling forward the
rest of Phase 8, is cheap and directly addresses the actual complaint:

- Force the design-direction step to explicitly choose and justify a variant
  for every section, every time — no silent defaults.
- A composition plan that states its reasoning ("split hero chosen — brief
  mentions a strong product photo") is auditable. You can catch "it picked
  the same thing again" *before* a site ships, not after noticing three
  pilots look alike.

This is a process change, not a build. It costs a prompt/convention update,
not 48 new sections.

## The recommended pass — revised: time is not the constraint, visual distinctness is non-negotiable

**Decision recorded:** the person building this system explicitly chose to
prioritize visual distinctness over build speed for this pass, specifically
because a BMS site resembling Fynbos & Fern or Mulkern is unacceptable. This
section supersedes the smaller "6-8 sections" version below it in an earlier
draft of this doc — kept only as a discarded alternative for the record.

**A. Mandatory explicit variant selection (process, unchanged, still step one)**
This does not become optional just because more variants are being built. A
larger shelf that still gets shopped from lazily produces the same failure at
higher cost. Update the design-direction step (§8.2) and CLAUDE.md
conventions: every section placed on a page must record which variant was
chosen and why, reviewed before a pilot is accepted.

**B. A substantial variant build — real depth on identity-carrying categories**

| Category | Target variant count | Why this depth |
|---|---|---|
| Hero | 4-5 | Sets the whole page's first impression — highest-leverage category |
| Features | 3-4 | High page real estate, most repeated section across any site |
| Social Proof | 3-4 | Testimonials/logos/reviews — where "personality" often lives |
| CTA | 3 | Small individually, but appears multiple times per site |
| About | 3-4 | Where distinctive storytelling (Wisr/Upstate-style) lives |
| Gallery | 3 | Portfolio-style clients (like BMS, a printer) lean on this heavily |
| How It Works | 2-3 | Good animated-beam candidate, currently thin |

Categories intentionally left at current depth (1-2 variants) — genuinely
lower distinctiveness value:

| Category | Why left thin |
|---|---|
| Contact | Utilitarian; visitors don't judge site identity by contact form design |
| Comparison | Structural, not personality-driven |
| FAQ | Accordion pattern is expected/standard; low variety payoff |
| Pricing | Not yet needed by any real client; premature to deepen |
| Stats | Small, supporting element rather than identity-carrying |

**Rough total: ~22-28 new sections** across the seven identity-carrying
categories — a real, substantial build, well short of the full 48-72 (every
category deep) but meaningfully deeper than the original 6-8 minimal pass.

**Exit criteria for this pass, unchanged in spirit:** one more disposable
pilot, a different vertical again (ideally something print/portfolio-adjacent,
closer to BMS's actual business, to stress-test the categories BMS will lean
on hardest — Gallery and About especially), built through the *updated,
explicit-selection* process. Reviewed against Fynbos & Fern and Mulkern side
by side. If it doesn't read as genuinely distinct, the fix is more likely
still in the selection process, not the variant count — don't default to
building yet more.



## Why this is the right size

- Costs days, not weeks — nowhere near full Phase 8's scope.
- Fixes the actual reported problem (selection), not a proxy for it
  (inventory).
- Keeps Phase 8 itself intact and still properly gated on real BMS-driven
  demand, per your own stated scope discipline.
- Produces a concrete, testable exit criterion (one more pilot, visibly
  distinct, reasoning logged) rather than an open-ended "add more variants
  until it feels right."

---

# Roadmap — Resuming After Phase 7

## 0. Phase 7 — ✅ complete
Exit criteria met as written ("would we trust this system with a real business's
only website and a family member's goodwill") — every mechanism proven against
real failure, CI green on GitHub. See DECISIONS.md §Phase 7 and the archived
roadmap for the evidence.

## 1. Pre-BMS variant pass (this doc, revised — depth over speed)
- [ ] Update §8.2 design-direction step + CLAUDE.md: mandatory explicit
      variant selection with logged reasoning, per section, every build —
      non-negotiable regardless of shelf size.
- [ ] Build the substantial variant set: Hero (4-5), Features (3-4), Social
      Proof (3-4), CTA (3), About (3-4), Gallery (3), How It Works (2-3) —
      roughly 22-28 sections, full pipeline each (design pass, dual-state
      check, suite entry, Lighthouse gate).
- [ ] Run one more disposable pilot — a print/portfolio-adjacent vertical,
      close to BMS's actual business — through the updated process end to
      end, to stress-test the categories BMS will lean on hardest.
- [ ] Your review: side-by-side against Fynbos & Fern and Mulkern — genuinely
      distinct, not just re-tokened? Is the selection-reasoning log
      meaningful, not rubber-stamped?
- [ ] Exit: pilot passes the eye test, reasoning log holds up. If not, treat
      it as a selection-process problem first, not a "build more" problem.

## 2. Brand Management Solutions — first real client milestone
As previously scoped: pull/curate Facebook photos (can start anytime, no
dependency on the above), write `brief.md`, run the real design-direction
session, build via the standard pipeline, internal review, client review with
an explicit "try to break this" ask, publish, hand over access. The real test:
does he use the admin panel without calling you.

## 3. Phase 8 — library expansion (ongoing, properly gated)
Starts for real once BMS surfaces actual gaps — now informed by both BMS's
real brief *and* whatever the pre-BMS pilot's selection-reasoning logs
revealed about where the registry is thin. Curated free-source shortlist
(Number Ticker, Animated Beam, Bento Grid, Comparison Slider, text presets)
is ready to draw from whenever real demand confirms it's worth staging.
React Bits Pro purchase decision revisited only if recurring real demand
points at the categories it uniquely covers (pricing, comparison, team grid).

## 4. Business questions
Pricing model, positioning, next client — answered with real operator
feedback from BMS in hand, not guessed at in parallel with building.
