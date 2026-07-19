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
| `conversations` / `conversation_members` / `messages` | DMs |
| Storage bucket `cat-photos` | Profile + post image uploads |
| RLS policies | Secure per-user access |
| Realtime publication | Live messages + feed updates |
| `create_conversation_with()` | Safe 1:1 chat bootstrap under RLS |

If a Realtime `alter publication` line errors because a table is already added, you can ignore that specific error.

### 4) Auth settings (recommended for friends)

Supabase → **Authentication → Providers → Email**:

- Enable Email provider
- For a private friends app, turn **off** “Confirm email” so signup works immediately  
  (or keep it on and use the confirmation link)

### 5) Invite friends

1. Deploy / open the app
2. Each friend **Signs up** with email + password + cat profile + optional photo
3. They appear in **Suggested friends**
4. Anyone can **Share a moment** → photo uploads to Storage → appears in everyone’s feed
5. **Message** a friend → realtime chat via Supabase Realtime

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
  - `posts.ts` — global feed, create post, likes, comments
  - `messages.ts` — conversations + Realtime `channel()` listeners
  - `profiles.ts` — profile CRUD + follows
  - `storage.ts` — image uploads to the `cat-photos` bucket
  - `api.ts` — facade re-exports

### Realtime

- Active chat subscribes to `messages` inserts for that conversation
- Feed refreshes on `posts` / `likes` / `comments` changes

---

## Routes

| Path | Page |
| --- | --- |
| `/auth` | Sign up / Sign in |
| `/` | Global feed + create post + Mama Streak |
| `/profile` | Edit profile + photo + grid |
| `/messages` | Live DM split pane |
| `/dashboard` | Mama Streak (device-local) |

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
