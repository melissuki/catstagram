# Catstagram

A soft, Instagram-inspired social app for cats — now backed by **Supabase** for real multi-user auth, global feed, photo uploads, and live chat.

Stack: **Vite + React + TypeScript**, **Tailwind CSS**, **Supabase** (Auth, Postgres, Storage, Realtime), Context API.

---

## Quick start (local)

```bash
npm install
cp .env.example .env
# fill VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm run dev
```

```bash
npm run build
npm run preview
```

---

## Step-by-step: go from mockup → live multi-user

### 1) Create a Supabase project

1. Go to [https://supabase.com](https://supabase.com) → **New project**
2. Wait until the database is ready
3. Open **Project Settings → API**
4. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`

### 2) Add environment variables

**Local** — create `.env` in the project root:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

**Vercel** — Project → Settings → Environment Variables → add the same two keys for Production / Preview, then redeploy.

### 3) Run the database + storage schema

1. In Supabase → **SQL Editor** → New query
2. Paste the full contents of [`supabase/schema.sql`](./supabase/schema.sql)
3. Click **Run**

This creates:

| Resource | Purpose |
| --- | --- |
| `profiles` | Cat profiles linked to `auth.users` |
| `posts` / `likes` / `comments` | Global feed |
| `follows` | Friendship / follow graph |
| `messages` (`sender_id`, `receiver_id`, `content`) | Direct messages |
| Storage bucket `cat-photos` | Profile + post image uploads |
| RLS policies | Secure per-user access |
| Realtime publication | Live messages + feed updates |

If you already had the older conversation-based DMs schema, also run [`supabase/migrations/refactor_messages_dm.sql`](./supabase/migrations/refactor_messages_dm.sql) in the SQL Editor.

If a Realtime `alter publication` line errors because a table is already added, you can ignore that specific error.

### 4) Auth settings (email verify + password reset)

Supabase → **Authentication → Providers → Email**:

- Enable Email provider
- Keep **Confirm email** ON so friends verify before entering the app

Supabase → **Authentication → URL Configuration**:

- **Site URL:** your Vercel domain (e.g. `https://YOUR-APP.vercel.app`)
- **Redirect URLs** allow list (add all that apply):
  - `http://localhost:5173/**`
  - `https://YOUR-APP.vercel.app/**`
  - `https://YOUR-APP.vercel.app/auth`
  - `https://YOUR-APP.vercel.app/reset-password`

App env:

```env
VITE_APP_URL=https://YOUR-APP.vercel.app
```

(Locally you can omit it — the app falls back to `window.location.origin`.)

### 5) Invite friends

1. Deploy / open the app
2. Each friend **Signs up** with email + password + **unique username** + cat profile
3. Use **Search** to find cats by `@username`, then **Follow** them
4. Home feed shows posts from accounts you follow (plus your own)
5. **Message** a friend → realtime chat via Supabase Realtime

### Existing projects: migrations

If you already ran an older schema, run these in the Supabase SQL Editor as needed:

- [`supabase/migrations/add_username.sql`](./supabase/migrations/add_username.sql) — unique `@username` handles
- [`supabase/migrations/add_stories.sql`](./supabase/migrations/add_stories.sql) — Instagram-like stories table + RLS
- [`supabase/migrations/add_food_streak.sql`](./supabase/migrations/add_food_streak.sql) — legacy (optional; replaced by Treat Catcher)
- [`supabase/migrations/add_game_and_notifications.sql`](./supabase/migrations/add_game_and_notifications.sql) — `game_high_score` + `notifications` table/triggers
- [`supabase/migrations/add_message_notifications.sql`](./supabase/migrations/add_message_notifications.sql) — DM notification type + preview `body`
- [`supabase/migrations/fix_notifications_user_id.sql`](./supabase/migrations/fix_notifications_user_id.sql) — **required** rename `recipient_id` → `user_id` + RLS (fixes empty notification panel)

Stories upload to the public `cat-photos` bucket under the `stories/` prefix (same bucket policies as other uploads).

**Profile isolation:** own settings live at `/profile`; other cats at `/profile/:userId` (legacy `/u/:username` redirects).

**Treat Catcher:** 30s mini-game from the navbar / profile; high score stored on `profiles.game_high_score`.

**Notifications:** DB triggers create like/comment/follow rows (no self-actions); heart badge in the header marks them read when opened.

---

## Theme & language

- **Light / Dark** toggle in the navbar (`ThemeProvider` + Tailwind `dark:` classes). Preference is stored in `localStorage`.
- **EN / TR** language toggle beside it (`src/i18n/translations.ts`).

Palette: soft sunset pastels in light mode; midnight velvet + purple glow borders in dark mode.

---

## What changed architecturally

### File uploads

- `ImageUpload` uses `<input type="file" accept="image/*" />`
- Instant preview via `URL.createObjectURL(file)`
- Upload path: public Storage bucket `cat-photos` (`profiles/…`, `posts/…`) → public URL saved on profile/post rows

### API / state

- Mock `localStorage` auth + seed arrays removed (Mama Streak + language stay local)
- `AppContext` syncs with Supabase session + Postgres
- Service layer under `src/services/`:
  - `supabaseClient.ts` — **central** `createClient` using `VITE_SUPABASE_*` env vars
  - `auth.ts` — signup / login / logout
  - `posts.ts` — global discovery feed, create post, likes, comments
  - `messages.ts` — peer-based DMs (`sender_id` / `receiver_id`) + Realtime listeners
  - `profiles.ts` — profile CRUD, username search, follows
  - `storage.ts` — image uploads to the `cat-photos` bucket
  - `api.ts` — facade re-exports
  - `ThemeContext` — light/dark mode

### Realtime

- Active chat subscribes to `messages` inserts for the open peer thread
- Inbox + Toastify listen for all DMs involving the current user
- Feed refreshes on `posts` / `likes` / `comments` changes

---

## Routes

| Path | Page |
| --- | --- |
| `/auth` | Sign up / Sign in (username required) |
| `/` | Global discovery feed + stories + create post |
| `/search` | Live username / name search |
| `/profile` | Own editable profile + Treat Catcher entry |
| `/profile/:userId` | Isolated public profile + high score + follow |
| `/u/:username` | Redirects to `/profile/:userId` |
| `/messages` | Live DM split pane |

---

## Project structure

```
src/
  components/   # UI (ImageUpload, CreatePost, chat, feed, layout)
  context/      # AppProvider synced to Supabase
  services/     # Auth, posts, messages, profiles, storage
  lib/          # supabase client
  pages/
  i18n/
  types/
supabase/
  schema.sql    # run once in Supabase SQL Editor
```

---

## Deploy checklist (Vercel)

1. Push repo to GitHub
2. Import in Vercel (framework: Vite, output: `dist`)
3. Set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
4. Confirm `vercel.json` SPA rewrite is present
5. Redeploy after env changes

---

## Mobile migration note

Keep domain logic in `services/`, `context/`, `types/`, and `lib/`. A future React Native / Expo app can reuse the same Supabase project and swap only the UI layer.
