# Phase 8 — Curated Shortlist (Free Sources)

Everything below is free, commercially-licensed, and mapped to a real gap or
backlog item already identified. This is a **staging shortlist**, not an
activation list — per Phase 8's two-tier model, all of this gets mechanically
converted first; only a handful per category ever gets activated into the live
registry. Nothing here is a commitment, just the shopping list to work from
whenever Phase 8 actually starts.

Sources used: **Magic UI** (free), **React Bits** (free tier, reactbits.dev),
**shadcn/ui** (free). Motion Primitives / Cult UI intentionally left for a
second pass once the studio has a specific "Magic UI reads too generic" moment
to solve — no strong candidates identified yet.

---

## New sections (Blocks) — closes real registry gaps

These map directly onto categories your registry doesn't have yet, or onto
items already sitting on the Phase 8 backlog list.

| Candidate | Source | Backlog match | Notes |
|---|---|---|---|
| Number Ticker | Magic UI | Stats / counter block | Animated count-up, near-ready implementation of an already-wanted section |
| Animated Beam | Magic UI | Process / "how it works" steps | Connecting-line visual, exactly the backlog's ask |
| Bento Grid | Magic UI | New `feature_grid` variant | Visually distinct grid layout, good for services/portfolio content |
| Comparison Slider | React Bits (free) | Before/after image slider | Direct backlog match |
| Marquee (testimonials/logo variant) | Magic UI | Deferred Phase 4.5 showpiece concept — still to be built | No marquee exists in the registry yet; this would be its first implementation, usable for logos and testimonials alike |

**Still not covered by free sources — remains a real gap for later:**
- Pricing table / comparison table
- Team / people grid
- Video hero variant
- Map / location block
- Booking / calendar embed
(These are the strongest case for eventually revisiting React Bits Pro, once
demand is proven — see Phase 8's trigger model.)

---

## Text animation presets → `lib/animations/staged/`

Pick 1-2 genuinely distinct ones per source, not near-duplicates across both —
you already have `fadeUp`, `staggerReveal`, `pinnedFade`; these add variety
within the "small handful, reused everywhere" cap.

| Candidate | Source |
|---|---|
| BlurText | React Bits (free) |
| SplitText | React Bits (free) |
| Text Reveal | Magic UI |
| Word Rotate | Magic UI |
| Hyper Text | Magic UI |

**Recommendation:** stage all five, activate at most 1-2 beyond what you
already have. Redundant text-reveal presets are pure clutter — same governance
logic as the background cap.

---

## Backgrounds → `SectionShell` ground options (extremely capped, ~3-5 ever)

Most of React Bits' background category is shader/3D-heavy (Aurora,
Iridescence, LiquidChrome — all OGL/Three.js) and a real Lighthouse risk,
consistent with the earlier caution about this whole category. **Recommend
skipping background staging from these sources almost entirely** — if
anything, one subtle grain/texture-only option is defensible; nothing
animated/GPU-heavy. This category should stay dominated by your own
hand-tuned tokens (paper/mist/ink/etc.), not external sourcing.

---

## Shared primitives → `packages/sections/src/lib/staged/`

| Candidate | Source | Use |
|---|---|---|
| Avatar Circles | Magic UI | Team/testimonial attribution clusters |
| Border Beam / Shine Border | Magic UI | Subtle card-highlight treatment, low performance cost (CSS-based, not shader) |

Low priority — nice-to-have polish, not gap-filling. Stage opportunistically.

---

## Explicitly skipped categories

- **Cursor effects** (React Bits) — irrelevant, client base is mobile-first.
- **3D & shader backgrounds/components** (both sources) — showpiece-only if
  ever, always with a Lighthouse check first; not part of a routine staging
  pass.
- **Whole page templates** — neither free tier includes these (Pro-only on
  both React Bits and Magic UI); not relevant until/unless a paid tier is
  purchased.

---

## shadcn/ui — foundation layer, not marketing sections

No specific components curated here — shadcn stays scoped to the admin panel
(forms, dialogs, tables, inputs) per the original plan. Pull individual
primitives as the admin panel needs them, not as a batch.

---

## Suggested first activation wave (once Phase 8 actually starts)

Ranked by "closest match to an already-named gap":

1. Number Ticker → Stats section
2. Animated Beam → How It Works section
3. Bento Grid → new feature-grid variant
4. Comparison Slider → Before/After section
5. One text-reveal preset (pick one of BlurText / Text Reveal / Word Rotate)

Five real, free, gap-filling additions — a legitimate first wave without
spending anything. Revisit React Bits Pro only if real client demand later
proves the pricing/comparison/team-grid gaps are recurring, not hypothetical.
