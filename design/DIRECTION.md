# Design direction — Refined Coastal (approved)

Studio-approved direction for Phase 4.5. Sheet: https://claude.ai/code/artifact/cd3f7ca9-5e30-41ba-907a-ac07e8b8fb69
(v0.1 proposed 2026-07-21 → v0.2 redlines addressed → approved 2026-07-21).
Implementation must follow this document; visual invention beyond it goes back to the art director.

## Palette (tokens.json `colors`)

| Token | Value | Role |
|---|---|---|
| surface | `#FAF7F2` | Paper — default band ground (was pure white) |
| surfaceAlt | `#E9F1F1` | Sea Mist — alternate light ground |
| surfaceInk | `#0C272E` | Ink — dark band ground, NEW ("depth chord") |
| primary | `#132F37` | Text on light grounds |
| muted | `#51686F` | Secondary text on light grounds |
| onInk | `#C2D2D6` | Body text on ink bands, NEW (headings on ink use surface) |
| accent | `#0D7789` | Deep Teal — links, buttons, labels. Deepened from #0F7E92 in v0.2 to clear body AA |
| accentContrast | `#ffffff` | Text on accent |
| accentSoft | `#6FC3D6` | Aqua — accent duty on ink grounds only, NEW |
| accentWarm | `#B77A2E` | Amber — ORNAMENT ONLY, NEW. Never sets type, never a text ground, never fills buttons |

Contrast (WCAG 2.1, measured): primary/paper 13.19:1 · primary/mist 12.30 · muted/paper 5.52 ·
muted/mist 5.15 · accent/paper 4.89 · accent/mist 4.56 · white/accent 5.23 · paper/ink 14.61 ·
onInk/ink 10.02 · aqua/ink 7.77 — all AA for their roles. Amber vs any text: fails (3.60–3.92) — hence ornament-only.

## Shape (tokens.json `radius`)

- card `0.875rem` · btn `999px` (pill — actions only) · field `0.5rem` (NEW — form fields never go pill)

## Type — Pairing A (approved)

- **Display:** Fraunces 600 (+ its 600 italic as THE accent voice — max one italic accent phrase per band).
- **Text:** Albert Sans 400/600. Body 1.04rem/1.7.
- Self-hosted latin woff2 subsets via `next/font/local` in the site template (`--font-fraunces`,
  `--font-albert-sans`); Tailwind `--font-display` and `--font-sans` resolve from them. ≈62KB total.
- Scale: display-xl clamp(3rem→5.25rem)/1.0 · display clamp(1.9→2.8rem)/1.1 · title 1.3rem ·
  body 1.04rem/1.7 · label 0.72rem caps +0.12em.

## Band rhythm (rules)

1. No two adjacent bands share a ground.
2. Ink appears once or twice per page — a chord, not wallpaper. Accent-CTA counts as dark for adjacency.
3. Testimonials, stats, final CTAs are the natural ink tenants.
4. `SectionShell` gains `background: "ink"`; on-ink text colors are a shell concern (tokens), not per-section forks.

## Edge system (SectionShell `edge` prop)

Enum `none · tide · swell · shore · foam`, default `none`. The edge is the section's BOTTOM;
inline SVG filled with the NEXT band's ground; zero images, zero JS. Rules: max two edge styles
per page; tide+foam is the house pairing; swell reserved for entries into ink; first section never
takes a top edge; edges never animate.

## Depth moves (max one per band)

- **escape** — a portrait/media block crosses its color-field boundary by 2–4rem (Testimonials, ImageTextSplit).
- **float** — paper card floating on full-bleed media (heroes, CTA banners).
- **foam dots** — dot-grid ornament clusters, amber or teal at 12–20% opacity, corners only, mask-faded.
- People get circular crops. Ornaments never overlap type.

## Motion (lib/animations presets — strict casting)

- `fadeUp`: headings, single blocks, quote cards — 24px rise, 0.6s, ease-out, once.
- `staggerReveal`: FeatureGrid/Gallery/Testimonials/LogoStrip items — fadeUp × 80ms, max 8 items.
- `pinnedFade`: showpiece heroes only, one per page, 100dvh pin, transform/opacity only.
- Content visible pre-JS and under `prefers-reduced-motion`; triggers cleaned up on unmount; edges never animate.

## Reference provenance

`design/references/` — Little Clay Land (float hero, circular crops, ornament restraint),
The Hudson Kitchen (band rhythm, script-accent-in-heading, escape move, dot ornaments),
Altius CPA (brand geometry as system), micromercial.com (wave edges, collage hero, dark stat cards).
Note: `nepheshpilates.com/` currently holds a misfiled duplicate of the Altius capture.
