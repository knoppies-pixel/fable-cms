# kb/ — client knowledge repos

Each `kb/{client}` folder is a client knowledge repo (spec §2): the studio-side source of
truth for **who the client is and what was approved** — brief, brand, design direction,
assets. It feeds AI-assisted builds; it is never a runtime dependency of any site.

> In production each `kb/{client}` becomes its own private GitHub repo. Inside this
> monorepo they live as folders so the whole pipeline can be exercised locally.

## Layout

```
kb/{client}/
  brief.md          # THE spec for the build: sitemap, sections per page, CTAs,
                    # keywords, tone of voice. Written from client intake.
  tokens.json       # Approved design tokens — same shape as the site template's
                    # theme/tokens.json (colors + radius). Distilled from the
                    # approved design direction, never invented during the build.
  design/
    DIRECTION.md    # Record of the design-direction run: directions considered,
                    # what was chosen and why, refinements, measured contrast audit.
    *.html / *.png  # Direction sheets and reference screenshots backing DIRECTION.md.
  assets/           # Brand assets to seed as site media (jpeg/png). Filenames are
                    # referenced from the site's scripts/seed-content.ts.
```

## The design-direction step (spec §8.2) — run this before any seeding

Run once per client, at project start. Claude Design (claude.ai/design) is the preferred
exploration tool when available; the artifacts below are the contract, the tool is not.

1. **Input:** `brief.md` + any brand assets the client supplied.
2. **Explore:** produce 2–3 named homepage directions — each with a palette, type
   pairing, band-rhythm sketch and hero concept. Save the sheet(s) to `design/`.
3. **Refine:** iterate the chosen direction with the client until approved.
4. **Distill:** write the approved direction into `tokens.json` (all color + radius keys
   the template's `theme/tokens.json` carries), and record the run in
   `design/DIRECTION.md` — including a **measured WCAG contrast audit** of every
   text/ground pairing the tokens imply. A token that fails AA for its role either gets
   darkened or gets an explicit ornament-only rule, before it is committed.
5. Only then does the build flow start (`create-site.ts` → seed from brief; see the
   site template's `CLAUDE.md` §"Building a site from a brief").

**Hard rule:** the build implements what `tokens.json` + `DIRECTION.md` approve.
Visual invention beyond them goes back through this step, not into section code.

## Building the site

```
pnpm create-site --slug {client} --name "{Client Name}"     # registers + clones
cd sites/{client}                                            # then follow its CLAUDE.md
```
