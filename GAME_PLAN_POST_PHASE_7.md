# Fable CMS — Game Plan: Post-Phase 7 → BMS Live

*Phase 7 closed with CI green on GitHub, backup drill proven, exporter proven.
The system meets its own bar: "would we trust it with a real business's only
website and a family member's goodwill." What remains is making sites visually
distinct, then the real client. Work in order.*

---

## Stage 1 — Part A: The selection-process fix (do this first, it's small)

**Goal:** the AI must *choose* variants deliberately, not default. Fixes the
real cause of Fynbos/Mulkern looking alike.

- [ ] A1. Kick off in Claude Code: update the §8.2 design-direction step and
      the CLAUDE.md brief-to-site conventions so that every section placed on
      a page records: which variant was chosen, and a one-line reason tied to
      the brief. Output artifact: `section-plan.md` per site in its kb folder
      (alongside tokens.json and DIRECTION.md), listing every
      section → variant → reason.
- [ ] A2. The build must refuse silent defaults: if a section has multiple
      variants and no reasoned choice is recorded, that's an error, not a
      fallback.
- [ ] A3. Quick verification: re-run the composition step against the
      existing Fynbos brief (no rebuild needed — just the plan output) and
      read the reasoning log. Is it meaningful, or rubber-stamped filler?
      Iterate on the convention wording until the reasoning is real.

**Exit:** a section-plan with genuine per-choice reasoning exists for at least
one brief, reviewed by you.

---

## Stage 2 — Part B: The variant build (~22-28 sections, the big one)

**Goal:** real depth on the seven identity-carrying categories.

Targets: Hero 4-5 · Features 3-4 · Social Proof 3-4 · CTA 3 · About 3-4 ·
Gallery 3 · How It Works 2-3. (Contact, Comparison, FAQ, Pricing, Stats stay
thin on purpose.)

- [ ] B1. Adopt the new category taxonomy first (one small prerequisite
      commit): meta.category becomes `hero, features, social-proof, contact,
      comparison, cta, faq, pricing, stats, about, how-it-works, gallery` —
      remap existing sections onto it so the admin's add-section drawer and
      the selection step speak the same language as the variant plan.
- [ ] B2. Design pass in Claude Design, category by category — same
      art-director loop as Phase 4.5: generate variant concepts against the
      current studio system, reject generic, approve with specific notes.
      Free-source shortlist (Magic UI Bento Grid / Animated Beam / Number
      Ticker, React Bits Comparison Slider, text presets) feeds concepts
      where it fits.
- [ ] B3. Build in batches per category in Claude Code — full pipeline every
      section: Zod schema, meta + defaults, presentational component, motion
      via lib/animations presets, CmsImage, dual-state check, suite/pinning
      entry, Lighthouse gate. Section-by-section review checkpoints on the
      observation deck, same cadence as Phase 4.5 — no big-bang dumps.
- [ ] B4. Commit per category batch; CI (now real, from Phase 7) gates every
      push automatically.

**Exit:** all seven categories at target depth, suites green, CI green,
every new section reviewed by your eye against its approved design reference.

---

## Stage 3 — The dress rehearsal pilot (proves A+B actually worked)

**Goal:** one more disposable pilot, built through the updated process, that
does NOT look like Fynbos or Mulkern.

- [ ] C1. Invent a print/portfolio-adjacent fictional business — close to
      BMS's real vertical, so Gallery and About (the categories BMS will lean
      on hardest) get stress-tested for real.
- [ ] C2. Full standard flow: brief → design-direction (real, distinct
      tokens + type) → section-plan with reasoning → create-site → seed →
      build → review.
- [ ] C3. The judgment: side-by-side, this pilot vs Fynbos vs Mulkern, desktop
      and mobile. Genuinely distinct at a glance — different layout choices,
      not just different paint? Reasoning log meaningful?
- [ ] C4. If it still reads samey: treat it as a selection problem first
      (tighten A), not a "build more variants" problem. Iterate here — this
      is the cheap place to be wrong; BMS is the expensive place.

**Exit:** you look at three sites and see three different websites. Your eye
is the gate.

---

## Stage 4 — Brand Management Solutions (the real one)

**Prep (can start anytime, even during Stages 1-3):**
- [ ] D1. Pull and curate photos from their Facebook — pick the good ones,
      note what's missing (this is manual, and it's yours).
- [ ] D2. Gather brief inputs: services list, what makes them different,
      contact details, any competitor/reference sites they rate.

**The build:**
- [ ] D3. Write `brief.md` properly — same contract as every pilot.
- [ ] D4. Design-direction session for their actual brand — real art
      direction, their identity, not a re-skin of anything prior.
- [ ] D5. Standard pipeline: create-site → section-plan (reasoned) → seed →
      build → internal review at desktop/mobile/reduced-motion.
- [ ] D6. First real Vercel deployment — which also finally resolves the
      carried-forward item: re-verify Lighthouse on the real deployment
      (HTTP/2) to settle the local-94 question for good.
- [ ] D7. Client review with the explicit ask: "try to break it, tell me
      what's annoying" — honest friction wanted, not politeness.
- [ ] D8. Publish, connect domain, hand over a client_editor login.

**The actual test (the whole point):**
- [ ] D9. Does he edit content without calling you? Watch what confuses him —
      every confusion is a real finding.
- [ ] D10. Do contact-form leads arrive (Submissions tab + email)? This is
      the pipeline Phase 7 fixed — confirm it in the wild.

---

## Stage 5 — After BMS: harvest and decide

- [ ] E1. Write down every gap BMS surfaced — sections wanted, admin
      confusions, content-pipeline friction. That list is Phase 8's real
      backlog, finally demand-fed as designed.
- [ ] E2. Phase 8 begins properly: ongoing cadence (~1 section per 2-3
      weeks), free-source shortlist first, React Bits Pro revisited only if
      recurring demand points at its unique categories.
- [ ] E3. Business questions, now with real signal: what to charge (build fee
      + monthly admin access), who's next (which existing WordPress client
      migrates first — the migration tool is ready), and what the product's
      actually called.

---

## Standing rules that carry through every stage

- Prove it, don't claim it — evidence per gate, same as Phases 0-7.
- Your eye is the design gate; no section ships without your review.
- mulkern-demo never deploys publicly (third-party content).
- Scope holds: nothing gets added mid-stage that isn't on this plan without a
  deliberate decision to change the plan.
