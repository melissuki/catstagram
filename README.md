# Catstagram

A soft, Instagram-inspired social web app for cats and their humans — built with **Vite + React + TypeScript**, **Tailwind CSS**, **Axios**, and the **Context API**.

Designed as a production-ready foundation that can later grow into a mobile app (shared domain logic, clean folder boundaries, typed models).

## Features

- Mock authentication & editable cat profiles
- Home feed with stories, likes, comments, tags, and follow actions
- Direct messages with split-pane chat UI
- Mama Streak dashboard (daily feed check-in persisted in `localStorage`)
- Bilingual UI (English / Turkish) without external i18n packages
- Responsive layout: sidebar on desktop, bottom tabs on mobile

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Vite + React 19 + TypeScript |
| Styling | Tailwind CSS v4 |
| Routing | react-router-dom |
| State | Context API (`AppProvider`) |
| Data | Axios + local mock datasets |
| Icons | lucide-react |
| Deploy | Vercel (`vercel.json` SPA rewrite) |

## Getting started

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
npm run preview
```

## Project structure

```
src/
  assets/           # static assets
  components/       # reusable UI (layout, feed, chat, streak, common)
  context/          # global AppProvider (auth, feed, chats, streak, i18n)
  hooks/            # shared hooks (useTranslation)
  i18n/             # EN / TR translation objects
  pages/            # route-level screens
  services/         # Axios instance + mock API + seed data
  types/            # shared TypeScript models
  utils/            # helpers (Mama Streak persistence)
  App.tsx           # providers + routes
  main.tsx          # entry
```

## Routes

| Path | Page |
| --- | --- |
| `/auth` | Mock profile login |
| `/` | Home feed + Mama Streak widget |
| `/profile` | Profile + edit form + post grid |
| `/messages` | DM split pane |
| `/dashboard` | Mama Streak management |

## Deploy on Vercel

1. Push the repo to GitHub
2. Import the project in Vercel
3. Framework preset: **Vite** (build `npm run build`, output `dist`)
4. `vercel.json` already rewrites all routes to `index.html` for client-side routing

## Mobile migration notes

Keep domain logic in `services/`, `context/`, `types/`, and `utils/` so a future React Native / Expo app can reuse the same models and state flows while swapping only the UI layer under `components/` and `pages/`.
