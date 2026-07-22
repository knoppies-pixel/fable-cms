# Fable CMS — The Complete Beginner's Guide

*Written for someone with zero coding or web knowledge. If you can follow a recipe, you can follow this.*

---

## Part 1: What is this thing?

### The problem it solves

Businesses need websites. Most small-business websites are built with a tool called
**WordPress** — it's been around since 2003, and it works, but it's slow, it breaks a lot,
it needs constant updates, and it's easy for clients to accidentally wreck their own site.

We are building a **replacement**: our own private system for creating and managing
websites. Think of it as a **website factory** that we own.

### The idea in one picture

```
The client types their          Our system stores it        The website shows it,
new text into a simple    ──▶   safely in a database   ──▶  beautifully, within
editing screen                                              seconds — worldwide
```

That's the whole product. Everything else is detail.

### The three pieces

**1. The Admin Panel** — a private website where clients log in and edit their content.
They can change text, swap photos, reorder parts of a page. They *cannot* break the
design — we decided exactly which knobs they're allowed to turn.

**2. The Database** — a big, secure filing cabinet (a service called Supabase) that
stores every piece of content: headlines, paragraphs, photos, page settings. Each
client only ever sees their own drawer. This separation is enforced by the database
itself, not by trust.

**3. The Website** — the actual site visitors see. It's built with modern technology
(Next.js, the same family of tools used by Netflix and Nike) and hosted on a service
called Vercel. It reads content from the database and displays it using our library
of pre-designed building blocks.

### The building blocks ("sections")

We don't design every website from a blank page. We built a shelf of **10 polished,
reusable blocks**: a big banner (hero), text blocks, photo galleries, customer
testimonials, FAQs, contact forms, and so on.

A web page = a stack of blocks, in an order, filled with a client's content, painted
in the client's colors. Like LEGO: same bricks, endless different builds.

### Why this beats WordPress

| | WordPress | Our system |
|---|---|---|
| Speed | Often slow (plugins pile up) | Near-perfect scores (99/100) |
| Breaking | Clients can wreck layouts | Clients can only edit safe fields |
| Security | Constant plugin patching | Almost nothing to attack |
| Updates | Weekly maintenance | Nothing to update |
| Who owns it | Often trapped with the agency | The client owns everything |

### Who does what

- **The studio (us)** designs sites, builds new blocks, and manages everything.
- **Clients** log in and edit their own words and pictures.
- **An AI assistant (Claude Code)** does most of the actual programming — we describe
  what to build, review its work, and approve it. Think of it as an extremely fast
  junior developer that never gets tired but must always show its homework.

---

## Part 2: How we're building it — step by step

The build is split into **phases**, like levels in a game. Each level must be
completed and *proven to work* before the next one starts. "Proven" means running
real tests and seeing them pass — never just trusting that it's probably fine.

### Phase 0 — The empty workshop ✅
Set up the project's folder structure, the tools, and the local database.
Nothing works yet, but everything has a place.
**Done when:** the project builds without errors and the database starts.

### Phase 1 — The filing cabinet ✅
Create the database tables (sites, pages, sections, images, users) and — most
importantly — the **security rules**: which kind of user may see and change what.
Example rule: a client editor can change a section's *content* but can never change
what *type* of section it is.
**Done when:** 22 automated security tests pass, including proof that one client
cannot see another client's data.

### Phase 2 — The LEGO bricks ✅
Build the 10 content blocks and the machinery that turns database rows into a real,
visible website. Also: the image pipeline (photos get automatically resized and
compressed so pages load fast).
**Done when:** a demo website ("Demo Plumbing Co") renders with near-perfect speed
scores, and broken content shows helpful errors in preview but hides cleanly in
production.

### Phase 3 — The editing screens ✅
Build the admin panel: login, page lists, and editing forms. Clever part: the forms
**generate themselves** from each block's rules, so adding a new block type
automatically creates its editing screen. Plus a photo library for uploads.
**Done when:** a robot browser logs in, creates a page, edits every block type
through the real interface, uploads a photo — and every change is confirmed.

### Phase 4 — The magic publish button ✅
Drag-and-drop reordering of blocks, a live preview beside the editor, draft/publish
switches, and instant publishing: hit publish, and the live site updates within
seconds — no technical steps.
**Done when:** reorder blocks → edit a headline → publish → see it live in under
10 seconds. *(Measured at well under a second locally.)*

### Phase 4.5 — The design glow-up ✅
A dedicated design pass: new fonts, colors, motion, and polish across all ten
blocks, so the demo site looks like something we'd proudly show a client — not a
developer's placeholder.
**Done when:** the studio looks at the demo site and signs off: "we'd demo this."

### Phase 5 — The first real website ✅
Create the "new client" process: one command sets up their site, their colors and
fonts come from an approved design, and their content gets loaded from a written
brief. Then build one actual pilot website end to end.
**Done when:** a realistic pilot site (Fynbos & Fern, a garden design business) is
built entirely through the system, no manual shortcuts.

### Phase 6 — The rescue tool ✅
A tool that reads an old WordPress website, extracts its text and images, and
rebuilds it inside our system — with a human checking the plan before anything runs.
This lets us upgrade our existing clients.
**Done when:** one existing WordPress site is successfully migrated to a preview.
*(Done with a real 8-page WordPress business site.)*

### Phase 7 — Bulletproofing ✅
Backups, edit history, activity logs, contact-form protection, error alarms,
automated quality checks on every change, and an export tool so a client could
leave with all their data (they won't want to — but being *able to leave* is why
they trust us).
**Done when:** every safety mechanism is proven against real failure, not just
built — the database was deliberately destroyed and restored from backup, a site
was deleted and brought back identical from its export, and the quality checks now
run automatically on every code change.

**All build phases are complete.** What remains before the first real client is a
design-variety pass (see `GAME_PLAN_POST_PHASE_7.md`) — making sure two sites
built on the same blocks don't *look* like the same site.

---

## Part 3: A day in the life (once it's finished)

**A client's Tuesday:** Sarah from the plumbing company gets a new certification.
She logs into the admin panel on her phone, edits the "About" text, taps Publish.
Eleven seconds later it's live. She never called us. Nothing broke.

**Our Tuesday:** A new client signed yesterday. We feed their brief to the AI, which
proposes three homepage designs. Client picks one. We run the site-creation command,
the AI fills the pages from the brief, we review, polish two sections, and send a
preview link. Total time: hours, not weeks. The client pays a monthly fee to use
the admin panel — money that arrives every month, not just at build time.

---

## Part 4: Words you'll hear (cheat sheet)

- **CMS** — Content Management System. Any tool for editing a website without coding. This whole project is us building our own.
- **Next.js** — the modern framework our websites are written in.
- **Supabase** — the database service. The filing cabinet.
- **Vercel** — the hosting service. Where the websites live on the internet.
- **Section / block** — one reusable piece of a page (banner, gallery, FAQ...).
- **Draft vs Published** — draft = saved but hidden; published = live for the world.
- **Preview mode** — a secret view that shows drafts before publishing.
- **Seed** — a script that fills the database with demo content for testing.
- **RLS (Row-Level Security)** — the database rules that keep each client locked to their own data.
- **Claude Code** — the AI developer that writes the code under our direction.
- **Acceptance criteria** — the checklist a phase must pass before we call it done.
- **Lighthouse score** — Google's 0–100 grade for how fast and well-built a page is. We score 99–100. Most WordPress sites don't.

---

## Part 5: The one rule that makes it all work

Every phase ends the same way: **prove it, don't claim it.**

The AI must show real test results. We click through the real screens ourselves.
When something looks wrong — even one broken image — we chase it down, fix it, and
add a permanent automated check so that exact problem can never sneak back in.

That rule is the difference between "an AI generated some code" and
"we built software we'd bet a business on."
