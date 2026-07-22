# Fable CMS — Intern Handbook

Welcome. This document assumes you know nothing about this system yet. Read it top to
bottom before touching anything. Keep it open in a tab — you'll refer back to it.

---

## 1. What this is

Fable CMS is our studio's own website platform. We build client marketing websites on
it instead of WordPress. It has three parts:

1. **The Admin Panel** — where we (and clients) log in to edit website content: text,
   photos, page structure. Lives at a URL we'll give you, or `localhost:3000` locally.
2. **The Database** — Supabase (a hosted Postgres database). Stores every page, every
   section of content, every uploaded image, for every client site, all in one place.
3. **Client websites** — each client has their own live website (hosted on Vercel),
   built from our shared library of design components ("sections"). The website reads
   its content from the database and renders it.

**The mental model:** a website = a stack of "sections" (hero banner, testimonials,
FAQ, contact form, etc.) in an order, filled with a client's content. We don't build
each site from scratch — we compose it from a library of ~10-20 pre-built,
pre-designed sections, then fill in that client's words, photos, and colors.

**Why it exists:** it's faster, safer (clients can't break the design), and much
better for site performance and Google ranking than WordPress. Every site we build
this way scores 95-100 out of 100 on Google's speed/SEO grading (Lighthouse).

---

## 2. Your two logins

You'll be given:

- **Studio admin** login — full access: create pages, add/remove sections, publish,
  manage all client sites.
- Later, once you're comfortable, you may also get access to **specific client
  sites** as needed.

Never share admin credentials. Never enable "studio_admin" access for a client login —
clients get the more limited "client_editor" role, which lets them edit their own
content but not restructure their pages or see other clients' data.

---

## 3. Day-to-day tasks you'll likely do

### Editing content for a client

1. Log into the admin panel.
2. Use the **site switcher** (top bar) to select the client's site.
3. Click into the page that needs changing (Home, About, Services, etc.).
4. Find the section — sections are listed top to bottom in the order they appear on
   the live page.
5. Click a section to open its editor. The form is auto-generated from what that
   section allows editing — just fill it in like any web form.
6. Use the **live preview pane** beside the editor to see your change before it's
   public.
7. Hit **Save**. If the page/section is already published, your change goes live
   within seconds automatically — no extra step needed.
8. If it's a *new* page or section, it starts as a **draft**. Toggle **Publish** when
   the client has approved it.

**Never** edit content by going into the code or the database directly. Everything
goes through the admin panel — that's what keeps client sites safe from accidental
breakage.

### Reordering sections on a page

- Open the page, grab the drag handle on the left of a section row, drag it to the
  new position. Keyboard alternative: focus the drag handle (Tab to it), press
  **Space** to pick the section up, move it with the **arrow keys**, press Space
  again to drop. It saves automatically.

### Uploading and using an image

1. In any image field, click to open the **media picker**.
2. Either pick an existing uploaded image, or use **Upload New** to add one.
3. Always add descriptive **alt text** when uploading — it matters for accessibility
   and Google.
4. Images are automatically resized and compressed for every device — you don't need
   to resize anything yourself before uploading. Just don't upload huge unnecessary
   files (a well-sized original, e.g. under 5MB, is fine).

### Undoing a bad edit (revision history)

Every time a section's content is saved, the previous version is kept (the last 20
saves per section). In the section editor, open the **History** panel below the
form and hit **Restore** on the version you want back. Restoring is itself saved to
history, so you can't make things worse by trying. This covers *edits* — a
*deleted* section is a different story (see §5).

### Checking form submissions (leads!)

Each site has a **Submissions** tab: every contact-form entry lands there, even
when email notifications fail — so this tab is the source of truth for leads.
Entries flagged **"likely spam"** were caught by the spam filters but kept anyway;
skim them occasionally, because a real customer occasionally trips a filter. If a
client says "someone told me they filled in the form and we never heard," check
here first.

### Seeing who changed what (activity feed)

Each site also has an **Activity** tab — a log of every edit, publish, upload and
deletion, with who did it and when. If something on a site looks unexpectedly
different, check here before assuming a bug.

### Checking a change before it's public (preview mode)

Every site has a preview link that shows draft content and unpublished changes.
Ask a senior team member for the current preview URL/secret for a given site if you
need it — never share this link outside the studio or with the client until they're
meant to see drafts.

### Creating a brand-new page

1. In the client's site, go to **Pages** → **New Page**.
2. Give it a title and URL slug (e.g. `/services/drain-cleaning`).
3. It starts empty and as a draft. Add sections via the **Add Section** button,
   choosing from the library, in the order you want them to appear.
4. Fill in each section's content, then get it reviewed before publishing.

**Note:** as an editor-level user, you may not have permission to create new pages
or change what *type* a section is (e.g. turning a hero into a gallery) — that's
intentional. Ask a senior team member if you hit a wall you think you shouldn't.

---

## 4. Creating a brand-new website for a client

This is a bigger task than editing content — usually something you'll do once
you're trusted with a full project, not on day one. Walk through it with a senior
team member the first couple of times. Here's the full sequence so you know what to
expect.

### Step 1 — Get the brief

Every new site starts with a **brief**: what the business does, what pages they
need, their brand colors/fonts if they have them, key selling points, and any
example sites they like. If a brief doesn't exist yet or feels incomplete, that's a
"stop and ask" moment, not a "guess and proceed" moment — a bad brief means the
whole site gets built in the wrong direction.

### Step 2 — Design direction

Before any content goes into the system, we settle on how the site will *look*:
colors, fonts, spacing feel, which of our special sections (beyond the basics) it
needs. A senior team member will usually run this part using our design tool and
come back with an approved look — your job is often to help gather the reference
material (screenshots of sites the client likes, their logo, existing brand colors)
that feeds into it.

### Step 3 — Register the new site

A senior team member runs a setup script that creates the new site in our system —
this generates the site's private database entry, its unique access key, and a
starting folder of code cloned from our template. **You won't run this yourself
until you've shadowed it a few times** — it needs a few configuration decisions
(site name, domain, which Vercel account it deploys to) that matter to get right the
first time.

### Step 4 — Build the pages

This is where a lot of the actual work happens, and it's very similar to the
content-editing you already know:

1. Go through the brief page by page (Home, About, Services, Contact, etc.).
2. For each page, create it in the admin panel and add sections from our library in
   a sensible order — the design direction from Step 2 tells you which sections fit
   the approved look.
3. Fill in each section with the client's real content: their actual words, their
   actual photos (never placeholder/lorem ipsum text in anything that might go
   live), their actual contact details.
4. Set the page's SEO fields (title, meta description) using any keywords from the
   brief — don't skip this, it's a big part of why we're better than the client's
   old site.
5. Everything stays in **draft** while you build — nothing is visible to the public
   yet.

### Step 5 — Internal review

Before a client ever sees it, someone senior reviews the whole site using
**preview mode** (see §3) — checking every page, every device size (phone and
desktop), and that nothing looks broken or unfinished. Expect notes back. This is
normal, not a sign you did something wrong.

### Step 6 — Client preview and approval

The client gets sent a preview link (never the "go live" link) to review and give
feedback. Rounds of small edits happen the same way as regular content editing
(§3) until they're happy.

### Step 7 — Going live

A senior team member publishes the pages and connects the client's real domain name.
This is also where the client's own hosting account gets set up — remember, clients
own their website's hosting; we just have access to manage it. This step involves
external accounts and DNS settings, so it's always done or closely supervised by a
senior team member.

### What NOT to do in this process

- Don't invent content the client didn't provide — if a page's copy is missing,
  flag it, don't make it up "to keep moving."
- Don't publish anything before the internal review in Step 5 — even if you're sure
  it looks great.
- Don't reuse another client's photos, testimonials, or written content on a new
  site, even as a placeholder.

---

## 5. Things you must NEVER do

- **Never edit the database directly** (even if you're shown how to access Supabase
  Studio for looking things up). All content changes go through the admin panel.
- **Never share a client's admin login with another client**, or give a client
  studio_admin-level access.
- **Never delete a page or section you didn't create** without checking with a
  senior team member first. Section *edits* can be undone via History (§3), and a
  deleted section leaves a recovery copy in the Activity log — but restoring from
  it is a senior-team job, not a self-service undo button.
- **Never commit code changes without running the checks** (see §6) — if you're
  touching the codebase at all, `pnpm typecheck && pnpm build` must pass clean before
  you say something is done.
- **Never assume something works because it looks right.** Click it. Test it. This
  studio's whole workflow is built on "prove it, don't claim it" — screenshots and
  confident descriptions are not evidence; a working link or a passing test is.

---

## 6. Vocabulary you'll hear

| Term | Meaning |
|---|---|
| **Section** | One reusable content block (hero, gallery, testimonials, etc.) |
| **Registry** | The library of all available sections |
| **Page** | A URL on a client site, made of a stack of sections |
| **Draft / Published** | Hidden vs. live-for-the-world |
| **Preview mode** | A special link that shows draft content before it's public |
| **Site** | One client's website — has its own pages, content, and settings |
| **Tokens** | A client's design settings (colors, fonts, spacing) — same sections,
  different look per client |
| **RLS (Row-Level Security)** | The database rule system that keeps each client's
  data walled off from every other client — you'll hear this term but won't need to
  touch it |
| **CMS** | Content Management System — what this whole platform is |
| **Claude Code** | The AI developer tool used to build and extend this system |

---

## 7. If you're asked to touch the code

Some interns will be purely admin-panel users; others will help with development.
If that's you:

- The project lives in a Git repository. Never push directly to `main` without
  review — work on a branch.
- Before saying any change is "done": run `pnpm typecheck && pnpm build` and make
  sure both pass with **no errors**. If either fails, it's not done.
- If you're adding a new content type ("section"), it must follow the existing
  pattern exactly — ask a senior team member to point you at an existing section as
  a template before starting. Don't improvise the structure.
- Every image in a section must use our `CmsImage` component — never a plain `<img>`
  tag.
- If you're unsure whether something is safe to change, ask first. This codebase has
  security rules (who can see/edit what) built into the database itself — a wrong
  change here isn't just a bug, it could expose one client's data to another.

---

## 8. Who to ask

If something looks broken, a page won't load, or you're not sure whether an action
is safe — **stop and ask** rather than guessing. It's always faster to ask a
30-second question than to spend an hour undoing a mistake, and nobody will mind the
question.

Common first troubleshooting steps before asking, if you want to try:

- **Page won't load locally** → check whether the local servers are actually
  running; ask how to start them if you don't know yet.
- **"This site can't be reached"** → almost always means a local server just isn't
  started — not a real outage.
- **Login doesn't work** → double-check you're using the right login for the right
  site (studio vs. client-specific access).
- **Something looks visually broken** → try a hard refresh first (Ctrl+Shift+R)
  before assuming it's a real bug.

Welcome aboard. Go slow, ask questions, and always trust what you click over what
you assume.
