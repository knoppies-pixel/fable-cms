# Design direction — Protea Veld (approved)

§8.2 run for the Fynbos & Fern pilot, 2026-07-21. Exploration sheet:
`directions-sheet.html` (rendered capture: `directions-sheet.png`).
v0.1 (three directions) → v0.2 (measured refinements on Direction A) → approved.

> **Pilot provenance:** this run is the Phase 5 proof-of-process on a disposable subject.
> Claude Design (claude.ai/design) was not driven for this run; the exploration sheet is a
> static stand-in produced by the same contract (2–3 named directions → client refinement →
> measured distillation). The artifacts and their acceptance bar are identical either way —
> the tool is swappable, the record below is the deliverable. Studio approval on a real
> client replaces the self-approval recorded here.

## Directions considered

- **A — Protea Veld (chosen):** warm paper + sage mist grounds, deep olive ink chord,
  clay accent, straw ornament. Timber-and-granite geometry (no pills).
- **B — Granite Terrace:** cool stone + fern green. Rejected: reads corporate/irrigation —
  the exact look the brief vetoes.
- **C — Restio Dusk:** shell + dusk mauve. Rejected: requires a dusk photo library the
  client doesn't have; reads floral-boutique.

## Palette (distilled to `../tokens.json`)

| Token | Value | Role |
|---|---|---|
| surface | `#FBF8F1` | Paper — default band ground |
| surfaceAlt | `#EDEFE3` | Sage Mist — alternate light ground |
| surfaceInk | `#22301F` | Olive Ink — dark band ground (the depth chord) |
| primary | `#243018` | Text on light grounds |
| muted | `#57614A` | Secondary text on light grounds |
| onInk | `#C9D2BE` | Body text on ink bands (headings on ink use surface) |
| accent | `#8A4A1F` | Clay — links, buttons, labels. Deepened from v0.1 `#A15A28` |
| accentContrast | `#FFFFFF` | Text on accent |
| accentSoft | `#E4AC7C` | Soft clay — accent duty on ink grounds only |
| accentWarm | `#C79B45` | Straw — **ornament only.** Never sets type on light grounds, never a text ground, never fills buttons |

### Contrast audit (WCAG 2.1, measured 2026-07-21)

primary/paper **13.10** · primary/mist **11.95** · muted/paper **6.16** · muted/mist **5.62** ·
accent/paper **6.43** · accent/mist **5.86** · white/accent **6.82** · paper/ink **13.11** ·
onInk/ink **8.90** · accentSoft/ink **6.94** — all AA for their roles, with margin.
accentWarm vs light-ground text: **2.41** — fails, hence ornament-only. (It measures 5.43 on
ink, but the ornament-only rule is kept unconditionally so the token can't grow a text role
that breaks the moment it's used on paper.)

**v0.1 → v0.2:** clay `#A15A28` measured **4.50** on Sage Mist — exactly the AA floor, zero
margin for inline links — and **5.24** for button text. Deepened to `#8A4A1F`. Straw was
demoted from "small accents" to ornament-only after measuring 2.41 on paper.

## Shape (`radius`)

card `0.75rem` · btn `0.5rem` · field `0.375rem`. Deliberately **not** pill — proves the
radius pipeline retokens against the Refined Coastal default (999px), and matches the
timber/granite brief language.

## Type

House pairing retained: **Fraunces 600** display (italic as the single accent voice per
band — the "belongs here" phrase) + **Albert Sans** text. The template's font-swap path
(replace woff2 files + `next/font/local` variables) stays available; the client approved
the house pairing, keeping the pilot's variable isolated to tokens.

## Band rhythm & moves (per studio system rules)

- Paper/Mist alternation; **Olive Ink once per page** (testimonials), at most twice
  counting a final accent CTA. No two adjacent bands share a ground.
- Edges: `shore` + `tide` as the house pairing; `swell` reserved for entering ink;
  max two edge styles per page.
- Depth: escape-crop circular portraits on ink; straw/clay dot-grids corners-only.
- Motion: `fadeUp` + `staggerReveal` only. No pinned hero — the client's photography
  carries the page; nothing should compete with it.
