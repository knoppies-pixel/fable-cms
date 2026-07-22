# Phase 4.5 — Design Elevation Playbook

The detailed version of the six steps. Phases 0–4: Claude built, you audited.
This phase inverts it: **you create, Claude implements.**

---

## Step 1 — Verify Phase 4 (10 min)

- [ ] Both servers up (`pnpm dev:admin` :3000, `pnpm dev:site` :3001), Docker running.
- [ ] Log in as **admin@studio.local** → open the demo site's Home page.
- [ ] Drag two sections into a new order. Also try it with the keyboard (Space + arrows).
- [ ] Edit the hero heading to something you'll recognize ("PHASE 4 TEST").
- [ ] Hit **Publish**, switch to the 3001 tab, refresh, count the seconds. (Report said 0.3s.)
- [ ] Check the amber-warning path once: stop the site server, save something in admin,
      confirm you get a warning — not a failed save. Restart the site server.
- [ ] Quick pass as **editor@demo.local**: confirm the publish button gives the friendly
      permission error, not a crash.
- [ ] In the Claude session: confirm clean tree, committed, pushed. GitHub glance.
- [ ] Paste the updated `CMS_SYSTEM_SPEC.md` (with §Phase 4.5) into the repo root, commit:
      `spec: add phase 4.5 design elevation`.

**Gate:** you personally watched a publish land on 3001 in seconds. ✅ → Step 2 is done
(spec already written), go to Step 3.

---

## Step 3 — The Claude Design session (the real work)

Budget 1–3 hours total. Fine to split across days — quality of judgment beats speed.

### 3a. Prepare what you'll feed it (15 min, before opening Claude Design)

Collect into a folder on your desktop:

- Screenshots of the current demo site — full-page captures of Home and About at
  desktop width, plus the hero/testimonials/gallery at mobile width. These show the
  "before" and the section vocabulary.
- The current `theme/tokens.json` and one or two representative section source files
  (hero, feature_grid) — so it knows the token names and component structure it must
  respect.
- 3–5 reference sites you rate (award-level marketing sites, past work you're proud of,
  competitors doing it right). Screenshots or URLs. This calibrates "WOW" to *your*
  taste, not its defaults.

### 3b. Session opener

Open claude.ai/design, start a project, upload the folder, and open with something like:

> This is my custom CMS's section library and default theme — currently functional but
> visually basic. I'm a designer; treat me as art director. We're going to (1) redesign
> the default look, (2) elevate the existing 10 sections, (3) concept 5–10 new showpiece
> sections. Constraints that always apply: sections are self-contained horizontal bands
> composed vertically; colors/type come from design tokens (I'll extract them after);
> performance is sacred — no heavy embeds; animations will be scroll-triggered GSAP
> presets (fade-up, staggered reveal, pinned fade) and must degrade gracefully.
> The reference sites show the quality bar I'm aiming at.

### 3c. Work in this order

1. **Whole-homepage directions first (context beats isolation).** Ask for **3 distinct
   homepage directions** for the demo plumbing business using the section vocabulary —
   e.g. one bold/typographic, one warm/photographic, one minimal/premium. Judge them
   as full pages. Pick a lead direction (steal details from the losers freely).
2. **Default look.** From the winning direction, extract the *system*: type pairing and
   scale, spacing rhythm, color roles, radius/shadow language. Push it until the
   *unthemed default* looks designed, because that's the floor every future site
   inherits.
3. **Elevate the existing 10** in the lead direction. You're not changing what the
   sections *do* (schemas are frozen, additive-only) — you're changing how they look
   at rest and in motion.
4. **Showpiece concepts.** Target list (edit to taste): scroll-driven hero,
   horizontal-scroll gallery, stats counter, marquee/ticker, split-screen story,
   sticky side-by-side steps, oversized-type statement, before/after slider.
   For each: desktop + mobile mockup, and be explicit about the motion
   ("cards fade up staggered", "pins for 150dvh while items reveal").

### 3d. Art-direct like it's a junior designer

- Reject fast, in batches — the first wave will be competent-generic; that's normal.
- Direct with adjectives + specifics: "warmer", "more contrast in the type scale",
  "less symmetrical", "the hero image should bleed off-canvas", "halve the border radius".
- Watch for the AI tells: everything centered, everything even, timid type sizes,
  gradient-on-card habits. Push against them deliberately.
- Keep a scratch note of decisions as you go — it becomes the notes in Step 4.

**Exit criteria for the session:** an approved default look, approved reference for
each existing section you're changing (skip any you're happy leaving), and 5–10
approved showpiece references with motion described. Everything else stays rejected.

---

## Step 4 — Export decisions into the repo (30–45 min)

Create this structure in the monorepo root and commit it:

```
design/
  README.md                  # 5 lines: what this folder is, "approved = build it"
  tokens-proposed.json       # the new default tokens (or annotated screenshots if
                             # you'd rather have Claude Code derive exact values)
  direction/
    home-desktop.png         # the approved homepage direction, full page
    home-mobile.png
    notes.md                 # the vibe in words: 5-10 bullets of the system decisions
  sections/
    hero/                    # one folder per section being changed or created
      desktop.png
      mobile.png             # mobile is mandatory for showpieces, recommended for all
      notes.md
    scroll_hero/
      desktop.png
      mobile.png
      notes.md
    ...
```

Every `sections/*/notes.md` uses this template (5 minutes each, keep it terse):

```md
# scroll_hero
STATUS: new            # new | redesign
WHAT: Full-viewport hero; headline reveals word-by-word on scroll, image pinned behind.
CLIENT EDITS: heading, subheading, cta (label+href), background image, variant (light/dark).
MOTION: pinnedFade preset, 150dvh pin; reduced-motion = static layout, all content visible.
NOTES: Type must hit the oversized scale from direction/notes.md. No parallax on mobile.
```

- [ ] Commit: `design: phase 4.5 approved references`. Push. This folder is the contract.

---

## Step 5 — Fire the 4.5 build (Claude Code)

Fresh session, `/clear`, then:

> Read CMS_SYSTEM_SPEC.md and the design/ folder in full — every notes.md and every
> reference image. Phases 0–4 are complete and committed. Begin Phase 4.5 only, per the
> spec: apply tokens-proposed.json as the new default theme; rebuild the existing
> sections that have design/sections entries to match their references (schemas frozen,
> additive changes only); implement each approved showpiece section per the §5 registry
> contract with its CLIENT EDITS as the schema and its MOTION via lib/animations/
> presets; rebuild the demo seed to showcase the elevated set. Work section by section
> — after each one, tell me it's ready for visual review before moving to the next, so
> I can check it against the reference on the live preview. Acceptance per the spec,
> including Lighthouse ≥95/100/≥95 on production builds and the pinning script covering
> every new schema. Where a reference is ambiguous, ask me — do not invent visual
> direction.

Note the cadence change: **section-by-section review**, not one big-bang report.
Design fidelity drifts silently; catch it per-section while the reference is fresh.

### Your review loop per section (observation deck, :3001)

- [ ] Reference image on one screen, live section on the other. Squint test first.
- [ ] Then the designer pass: spacing vs mockup, type scale drift, color roles right,
      image treatment right.
- [ ] Motion pass: does the ease feel right, does it fire at a sensible scroll point,
      does it re-trigger cleanly? Check at 375px. Check with reduced motion enabled
      (DevTools → Rendering → prefers-reduced-motion) — content must be fully visible.
- [ ] Give notes in the session in your own language ("ease is too springy, tighten to
      something like power2.out; the stagger should be ~80ms not 200"). Iterate until
      it matches, then let it move on.

---

## Step 6 — Before/after judgment

- [ ] Full production build + Lighthouse on every page — the bar holds or it isn't done.
- [ ] All suites green (including new pinning-script entries + seed idempotency).
- [ ] Walk the rebuilt demo site start to finish, desktop and phone, as if a prospect
      sent you this link. The only question: **would you proudly show this to a client
      — does it sell?**
- [ ] Yes → sign-off entry in DECISIONS.md, commit, tag it (`git tag v0.5-elevated`) —
      this is the before/after you'll reference forever.
- [ ] No → the gap goes back to Step 3 or Step 5 depending on whether it's a design
      problem or a fidelity problem. Both are normal; the gate exists to be used.

---

## Timebox summary

| Step | Time | Who leads |
|------|------|-----------|
| 1. Verify Phase 4 | 10 min | You |
| 3. Claude Design session | 1–3 h (splittable) | You |
| 4. Export design/ folder | 30–45 min | You |
| 5. Implementation + reviews | 1–2 sessions | Claude Code, you reviewing |
| 6. Judgment + sign-off | 30 min | You |
