# NCL Arena

Collaborative team workspace for practicing National Cyber League challenges. Real-time shared notes (Tiptap + Yjs), per-user answer voting with a team-confidence bar, strike votes for wrong answers, per-question discussion threads, and live presence. Up to **7 collaborators per room**.

**Production:** https://j4den.com/NCLtest
**Stack:** Next.js 14 (App Router) · Supabase (Postgres + Realtime + RLS) · Tiptap + Yjs (via y-supabase) · jose JWT · argon2id token hashing · Tailwind · shadcn/ui primitives · Vercel.

---

## What you (the human) have to do by hand

I wired up everything that can be automated from code. The rest lives on external dashboards, so you have to run these once.

### 1. Supabase project

1. Go to https://supabase.com/dashboard and create a new project. Pick a region close to you.
2. Once it boots, open **Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **`anon` public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **`service_role` secret** → `SUPABASE_SERVICE_ROLE_KEY` (server-only, never ship to the browser)
3. Still on the API page, open **JWT Settings** and copy the **JWT Secret** → `SUPABASE_JWT_SECRET`.
   - This is the critical one — our app signs its own session JWT with this secret so Supabase RLS policies can read our custom room claims via `auth.jwt()`.
4. Open **SQL Editor → New query**, paste the contents of `supabase/migrations/0001_init.sql`, run.
5. Repeat for the rest of `supabase/migrations/` in order (`0002_rls.sql`, `0003_fix_view_security_invoker.sql`, `0004_read_only_client_grants.sql`, ...).
6. Open **Database → Replication → supabase_realtime** — the migration already enabled realtime on the right tables, but double-check that these tables are toggled on: `sections`, `questions`, `answer_submissions`, `answer_strikes`, `discussion_messages`, `activity_events`, `room_members`.
7. (Optional) **Database → Jobs** — schedule the cleanup: `select cleanup_rate_limits();` every hour, or ignore it and a row-count task will do it lazily.

### 2. Local dev

```bash
cd ncloutline
bun install
cp .env.example .env.local
# paste the Supabase values from step 1 above
bun dev
# http://localhost:3000
```

Leave `NEXT_PUBLIC_BASE_PATH` empty for local; the app will run at `/` on port 3000.

### 3. GitHub repo

```bash
# from the project dir
git add -A
git commit -m "initial NCL Arena scaffold"
gh repo create ncloutline --private --source=. --push   # or --public
```

### 4. Vercel project

1. https://vercel.com/new → Import the `ncloutline` GitHub repo.
2. Framework preset: **Next.js**. Root directory: **./**. Build & output: defaults.
3. Before the first deploy, go to **Project Settings → Environment Variables** and add all five from `.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_JWT_SECRET`
   - `NEXT_PUBLIC_BASE_PATH` = `/NCLtest`  ← important for production
4. Click **Deploy**.
5. Copy your Vercel production URL. It'll look like `https://ncloutline-<hash>.vercel.app` or, if you set a custom one, `https://ncl-arena.vercel.app`. **Remember this URL** — step 5 needs it.
6. Every future `git push origin main` auto-deploys.

### 5. Hook it up to `j4den.com/NCLtest`

j4den.com runs on Cloudflare Pages. The cleanest way to mount NCL Arena under a subpath on that domain is a reverse-proxy rewrite in `_redirects`. I already added the entry for you in this commit, but you need to redeploy j4den.com for it to take effect.

1. Open the j4den site repo's `frontend/public/_redirects` and confirm it now contains a line like:
   ```
   /NCLtest/* https://<YOUR-VERCEL-URL>/NCLtest/:splat 200
   ```
   If the placeholder still says `<YOUR-VERCEL-URL>`, replace it with your actual Vercel URL from step 4.5.
2. Commit and push the j4den repo:
   ```bash
   cd path/to/j4den
   git add frontend/public/index.html frontend/public/_redirects
   git commit -m "add NCL Arena tile"
   git push
   ```
3. Cloudflare Pages auto-deploys on push. Give it ~60s, then visit https://j4den.com/NCLtest — it should load the NCL Arena landing.

That's it. Future iterations: push to `main` on the `ncloutline` repo → Vercel redeploys → j4den.com proxies through automatically, no j4den.com redeploy needed.

---

## How the features map to the code

| Feature                  | Files |
| ------------------------ | ----- |
| Landing (create/join)    | `app/page.tsx`, `components/landing/*`, `app/api/rooms/{create,join}/route.ts` |
| Room workspace layout    | `app/room/[code]/page.tsx`, `components/room/RoomShell.tsx` |
| Section list / add / delete | `components/room/SectionList.tsx`, `app/api/sections/*` |
| Question cards + CRUD    | `components/room/QuestionColumn.tsx`, `components/room/QuestionCard.tsx`, `app/api/questions/*` |
| Tiptap + Yjs collab      | `components/editor/CollabEditor.tsx` (uses `y-supabase` provider) |
| Answer voting + confidence | `components/room/QuestionCard.tsx` (AnswerSection), `app/api/answers/route.ts`, `question_answer_groups` SQL view |
| Strike votes             | `app/api/answers/strike/route.ts` |
| "Lock as final"          | `app/api/answers/lock/route.ts` |
| Discussion threads       | `app/api/discussion/route.ts`, `Discussion` component in QuestionCard |
| Presence + live cursors  | `components/room/PresenceList.tsx`, Tiptap `CollaborationCursor`, `app/api/presence/route.ts` |
| Activity feed            | `components/room/ActivityFeed.tsx`, Postgres Changes subscription |
| Rate limiting            | `lib/ratelimit.ts` + `check_rate_limit()` SQL function (Supabase Postgres, no Upstash) |
| CSRF                     | `lib/auth/csrf.ts` + `middleware.ts` double-submit cookie |
| JWT session              | `lib/auth/jwt.ts` (signed with `SUPABASE_JWT_SECRET` so RLS can read it) |
| CSP + security headers   | `middleware.ts` |

## Design constraints honored

- Deep navy → near-black gradient with 1px 8%-opacity grid overlay
- Cyan `#00E5FF` + terminal green `#00FF88` accents only
- Border radius maxes at 4px (no `rounded-xl` anywhere)
- 6px status dots for presence, not badge pills
- JetBrains Mono for headings/codes, Inter for body (loaded via `next/font`)
- Terminal prompt `$ ncl-arena:~/room/{CODE} >` header on room pages
- Dense dashboard layout, no hero lorem ipsum

## Deviations from the original spec (and why)

- **`@upstash/ratelimit` → Postgres rate limiter.** You asked to drop Upstash. `lib/ratelimit.ts` calls the `check_rate_limit()` SQL function. Fails open on DB error so a blip can't lock everyone out.
- **`argon2-browser` → `@node-rs/argon2`.** Browser argon2 ships a WASM blob via CSP-hostile paths; the Node/Rust binding is faster, server-only (token hashing shouldn't happen in a browser anyway), and works natively on Vercel Fluid Compute.
- **`ydoc_state` is one bytea column per question, not one per field.** The Tiptap `Collaboration` extension supports multiple named fragments in a single Y.Doc. Shared provider per question keeps awareness channels (cursors) unified across prompt / notes. Matches the schema you shipped with (`ydoc_state bytea`).
- **Room cap: 7 users.** Enforced in `app/api/rooms/join/route.ts`. Tiptap `CollaborationCursor` and Supabase Realtime both handle this count comfortably.
- **`flag` field is no longer Tiptap.** It's the final team-agreed answer, written via the "Lock as final" button once team confidence crosses 75%. Per-user drafts are in `answer_submissions`.

## Team confidence algorithm (inside `question_answer_groups` view)

For a given question, group all non-dismissed submissions by normalized value, then:

```
team_confidence = clamp(
  avg_personal_confidence * (agreers / total_submissions)
  + (agreers - 1) * 8,
  0, 100
)
```

A lone vote at 90% scores lower than three people at 70% — the design discourages single-voice lock-ins. "Lock as final" unlocks at `team_confidence ≥ 75`.

## Commands

```bash
bun dev          # dev server at http://localhost:3000
bun build        # production build (run once before first deploy to sanity-check)
bun start        # start a built server locally
bun lint         # ESLint
bun run typecheck # tsc --noEmit
```
