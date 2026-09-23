# xBlog

A modern, full-featured blogging platform for developers and small teams — built with **Next.js 14** on the frontend and **Strapi v5** on the backend.

xBlog gives you a polished writer's editor, a delightful reader experience, threaded comments, live reactions, @mentions, in-app notifications, and an admin review workflow — all wrapped in a cohesive brand-green theme with smooth, cinematic animations.

---

## ✨ Highlights

### For readers
- **Editorial-style article view** with magazine-grade typography, drop-cap first paragraph, syntax-highlighted code blocks, and a brand-tinted pull-quote.
- **Reading progress bar** at the top of every article — section tick marks, a glowing comet head that follows your scroll position, and floating *Now reading / Up next* chips.
- **Auto-generated table of contents** that highlights the section you're currently in.
- **Article cards** with hover-glow, lift animation, brand-green halo, and equal-height grid layout.
- **Reactions** — like, love, fire, insightful — toggle on/off with a single click.
- **Threaded comments** with nested replies, edit, delete, and @mentions.

### For writers
- **Distraction-free TipTap editor** with slash commands, bubble menu, headings, lists, quotes, code blocks, and a built-in tag selector that lets you stage new tags inline.
- **Live word count, reading-time estimate, and target progress ring** in the sidebar.
- **Cover image upload**, excerpt with character counter, and a "Feed preview" card showing how your post will look in the homepage feed.
- **Full-screen editor mode** (80 % viewport) toggled from the corner.
- **Save draft / submit for review / publish** flows that adapt to your role.

### For admins
- **Admin panel** at `/admin` with overview dashboard, pending review queue, all-articles management, user management (block / unblock / role change), comments moderation, and announcements.
- **Approval workflow** — review submitted articles, approve or reject with feedback, all wired to the notification system.
- **Promote users to bloggers**, create new blogger accounts directly.

### Personal & social
- **User profiles** at `/profile/<username>` — animated spotlight avatar, breathing brand halo, animated stat orbs (articles / total reads / reading time), and an in-profile search across that author's posts.
- **Edit profile modal** with avatar upload, bio, GitHub / Twitter / LinkedIn / website links.
- **Brand-tinted notification system** — bell icon in the navbar, unread badge with shake animation on new arrivals, full notifications page with filters (All / Unread / Mentions / Reactions / Comments / Approvals), time grouping (Today / Yesterday / This week / Older), delete and clear-all.

### Sitewide
- **Cinematic Dynamic-Island welcome / goodbye toast** with a paper-plane animation on sign-in and sign-out.
- **Ambient brand-green aurora background** that drifts behind every page, with a soft cursor-following glow.
- **Advanced command-palette search** in the homepage feed: live results across articles + tags, scope tabs, recent searches, ⌘K shortcut, keyboard navigation.
- **Announcements** posted by admins appear in the homepage hero card; a curated motivational quote rotates daily when no announcement is active.
- **Popular tags** in the sidebar, ranked by published-article usage.

---

## 🛠 Tech stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui |
| Editor | TipTap (rich text + slash commands) |
| Backend | Strapi v5 (headless CMS), Node.js |
| Database | PostgreSQL (SQLite fallback for zero-setup dev) |
| Auth | JWT (users-permissions plugin) |
| Media | Local uploads via Strapi (swap to S3 / Cloudinary in production) |

---

## 🚀 Local setup

### Prerequisites
- **Node.js** 18 or 20
- **PostgreSQL** running locally (or use SQLite by changing `DATABASE_CLIENT`)

### 1. Backend — Strapi

```bash
cd strapi/xBlog

# copy the env template + fill in real values
cp .env.example .env

npm install
npm run develop
```

Strapi boots at **http://localhost:1337/admin**. Create your first admin account through the panel.

### 2. Frontend — Next.js

```bash
cd frontend

cp .env.example .env.local

npm install
npm run dev
```

The app is live at **http://localhost:3000**.

---

## 🎨 Brand & theme

xBlog ships with a vibrant **emerald-green** identity (`hsl(145 80% 39%)`) running through every component — buttons, links, focus rings, badges, hover glows, charts, even the cursor spotlight. All design tokens are defined as HSL variables in `frontend/src/app/globals.css`, so rebranding is a one-file edit.

---

## 📚 Further reading

- `PRD-MULTI-TENANT.md` — future direction: Solo blog vs Organization blog mode with full per-tenant isolation.
- `API-REFERENCE.md` — list of REST endpoints exposed by Strapi.
- `SETUP-INSTRUCTIONS.md` — deeper setup walk-through.
- `QUICK-START.md` — short version of getting started.

---

**xBlog** — a writer's playground and a reader's delight.
