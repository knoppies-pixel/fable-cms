# Studio CMS — Getting Started Checklist (Claude Code)

Work top to bottom. Don't skip verification steps.

---

## A. Prerequisites

- [ ] **A1. Check Node.js** — open PowerShell, run `node --version`. Need v18+ (ideally v20/v22 LTS).
- [ ] **A2. If missing/old** — install the **LTS** from [nodejs.org](https://nodejs.org) with defaults,
      then **close and reopen the terminal** (PATH refreshes only in a new window) and re-check.
- [ ] **A3. Check Git** — `git --version`. If missing, install **Git for Windows** from
      [git-scm.com](https://git-scm.com) with defaults. Without Git for Windows, Claude Code falls
      back to PowerShell as its shell — the Git Bash setup behaves better.
- [ ] **A4. Install pnpm** — `npm install -g pnpm` → verify `pnpm --version` (expect 9.x/10.x).
- [ ] **A5. Install Docker Desktop** — from [docker.com](https://docker.com). Accept the WSL 2
      backend if prompted, restart if asked, **launch it**, wait for "running", then verify:
      `docker run hello-world` prints a success message. Docker runs your local Supabase —
      it must be running whenever you develop.
- [ ] **A6. Supabase CLI** — do nothing now. It gets added as a dev dependency inside the repo
      during Phase 0 (`pnpm add -D supabase`) to keep versions consistent.
- [ ] **A7. Accounts** — can log in to: **GitHub**, **supabase.com** (create free account),
      **vercel.com** (create free account — sign up with GitHub for easy repo linking).
      Do **not** create any projects yet.

## B. Install Claude Code

- [ ] **B1.** `npm install -g @anthropic-ai/claude-code`
- [ ] **B2.** New terminal → `claude --version`. Version number = success.
      "Command not found" = reopen terminal again.
- [ ] **B3.** Run `claude` from any folder. Browser opens → sign in with your **Claude
      subscription** account (not an API key) so usage comes out of your plan.
- [ ] **B4.** Inside Claude Code run `/doctor` — expect all green checkmarks. Then `exit`.

## C. Project setup

- [ ] **C1.** Create the project folder:
      ```
      mkdir C:\dev\studio-cms
      cd C:\dev\studio-cms
      git init
      ```
- [ ] **C2.** Copy `CMS_SYSTEM_SPEC.md` into the folder root.
- [ ] **C3.** Copy `CLAUDE.md` into the root too (temporary — it moves to
      `apps/site-template/` during Phase 0 scaffolding; Claude handles the move).
- [ ] **C4.** Create `.gitignore` containing at least:
      ```
      node_modules
      .env*
      .next
      dist
      ```
      Never let the first commit happen without it.
- [ ] **C5.** Create a **private** GitHub repo `studio-cms`, then:
      ```
      git add .
      git commit -m "seed: system spec and conventions"
      git remote add origin https://github.com/YOUR_USERNAME/studio-cms.git
      git push -u origin main
      ```

## D. First build session (Phase 0)

- [ ] **D1.** Docker Desktop is running.
- [ ] **D2.** `cd C:\dev\studio-cms` → run `claude`
- [ ] **D3.** Paste this prompt:

      > Read CMS_SYSTEM_SPEC.md fully before doing anything. We build this system phase by
      > phase, strictly in order. Start Phase 0 only: pnpm monorepo scaffold (apps/admin,
      > apps/site-template, packages/sections, packages/db, packages/config), add supabase
      > as a dev dependency and get local Supabase running, create the CI stub, and move
      > CLAUDE.md into apps/site-template. Do not start Phase 1. When you believe Phase 0
      > is done, verify the acceptance criteria yourself — both dev servers start,
      > `pnpm build` passes clean — and show me the actual output before we commit.

- [ ] **D4.** Approve permission prompts as they appear — read each one before approving.
- [ ] **D5.** When it claims done: check the build output yourself, then tell Claude:
      *"Commit Phase 0 with message 'phase 0: monorepo scaffold' and push."*

## E. Standing rhythm (every phase)

- [ ] Docker running → `claude` → `/clear` →
      *"Read CMS_SYSTEM_SPEC.md. Phase N is complete and committed. Begin Phase N+1 only."*
- [ ] Phase declared done → demand acceptance-criteria evidence (build output, test results,
      working URL).
- [ ] Verify one thing **yourself** in the browser — don't outsource all trust.
- [ ] Commit + push → only then start the next phase.
- [ ] **Phase 1 note:** you create the Supabase cloud project and paste keys into
      `.env.local` **yourself** — then immediately check `git status` shows no env files staged.

---

## Known trouble spots

- **A5 / Docker + WSL 2** is the step most likely to eat an hour. If `docker run hello-world`
  fails, it's fixable — don't push on to Phase 0 until it passes.
- **Phase 0 micro-decisions** (exact Next.js version, ESLint config): let Claude pick the
  simpler option and log it in `DECISIONS.md` rather than stalling.
