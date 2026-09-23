# xBlog — Multi-Tenant PRD (Solo vs Organization)

> **Core principle:** Solo blogs and Organization blogs are **completely separate spaces.**
> They never share a feed, an admin, members, or content. The only shared layer is the
> global account system (one email = one login) and the root marketing/directory site.

---

## 1. Vision

xBlog becomes a blogging platform you can adopt in **two independent ways**:

1. **Solo blog** — an individual publishes directly to their own space, no approvals.
2. **Organization blog** — a team publishes under one brand; admins review every post.

A visitor reads either kind of space at its own URL. Behind the scenes both are
"tenants", but the product treats them as two distinct experiences that never blend.

---

## 2. Personas

| Persona | Belongs to | Can do |
|---|---|---|
| **Visitor** (anonymous) | nothing | Read any public space, browse the global directory |
| **Reader** | global account | Read, react, comment, mention — on any space |
| **Solo owner** | exactly **one** solo space | Everything an admin+writer can do, but only inside their own solo space. Publishes directly. |
| **Org admin** | one or more orgs | Approve/reject posts, manage members, edit org branding — scoped to that org |
| **Org writer** | one or more orgs | Write posts that go to that org's admin review queue |

A single login can hold several memberships (e.g. own a solo blog **and** be a writer at one org),
but each membership is isolated to its own space.

---

## 3. Hard separation rules (non-negotiable)

1. A **solo space** shows only its owner's articles. Never any org content.
2. An **org space** shows only that org's articles. Never solo content, never another org's content.
3. A **solo owner** cannot invite members. Solo = exactly one person.
4. An **org** must have ≥1 admin; can have many writers.
5. Approvals exist **only** in org spaces. Solo publishing is always instant.
6. Admin panel of org A can never see org B or any solo space.
7. Comments / reactions / notifications are scoped to the space their article lives in.

---

## 4. URL & tenancy model

```
Production
  xblog.com                → global landing + directory + signup
  aniket.xblog.com         → Aniket's SOLO space
  acme.xblog.com           → Acme's ORG space

Development (no real subdomains on localhost)
  localhost:3000           → landing
  localhost:3000/s/aniket  → solo space   (prefix /s/ = solo)
  localhost:3000/o/acme    → org space    (prefix /o/ = org)
```

The `/s/` vs `/o/` prefix (or subdomain naming convention) makes the **kind explicit in the
URL itself**, reinforcing separation. A Next.js middleware resolves the space + kind and
passes `X-Space-Slug` + `X-Space-Kind` headers to Strapi, which scopes every query.

---

## 5. Top-level flow chart

```
                         ┌────────────────────────┐
                         │   Visit xblog.com       │
                         └───────────┬────────────┘
                                     │
                       ┌─────────────┴─────────────┐
                       │       Choose intent        │
                       └──┬───────────┬──────────┬──┘
                          │           │          │
                  "Just read"   "Start a      "Create an
                          │       solo blog"   organization"
                          ▼           ▼          ▼
                  ┌───────────┐ ┌──────────┐ ┌──────────────┐
                  │  Reader   │ │  Solo    │ │ Organization │
                  │  signup   │ │  signup  │ │   signup     │
                  └─────┬─────┘ └────┬─────┘ └──────┬───────┘
                        │            │              │
                        ▼            ▼              ▼
              global reader   create solo     create org space
              account only    space + owner    + founding admin
                        │            │              │
                        ▼            ▼              ▼
              browse any space  redirect to     redirect to
                              aniket.xblog.com  acme.xblog.com
                                    │              │
                                    ▼              ▼
                            ┌──────────────┐ ┌───────────────────┐
                            │ SOLO FLOW    │ │   ORG FLOW         │
                            │ (section 6)  │ │  (section 7)       │
                            └──────────────┘ └───────────────────┘
```

---

## 6. SOLO space flow

```
Solo owner signs in at aniket.xblog.com/login
        │
        ▼
   Sees their dashboard (only their content)
        │
        ▼
   Click "Write"
        │
        ▼
   Compose article  ──[ Save draft ]──► status: draft
        │
        └────────────[ Publish now ]──► status: published   (NO review)
        │
        ▼
   Article appears instantly on aniket.xblog.com feed
        │
        ▼
   Readers react / comment / mention  ──► owner gets notifications
```

**Solo owner = admin + writer of one space.** No invites, no review queue, no other members.

---

## 7. ORGANIZATION space flow

```
Org founder signs up → becomes ADMIN of acme.xblog.com
        │
        ▼
   Admin invites teammates (email link)
        │
        ▼
   Teammate accepts → becomes ORG WRITER of acme
        │
        ▼
   Writer composes article
        │
        ├──[ Save draft ]──► status: draft
        │
        └──[ Submit for review ]──► status: pending
                                        │
                                        ▼
                            Admin sees it in acme's review queue
                                        │
                          ┌─────────────┴──────────────┐
                          ▼                             ▼
                   [ Approve ]                    [ Reject + reason ]
                          │                             │
                          ▼                             ▼
                  status: published            status: rejected
                          │                             │
                          ▼                             ▼
              shows on acme.xblog.com      writer notified, can edit
                                           and resubmit
```

**Org admins** also: manage members (promote/remove), edit org branding, unpublish/delete any
org article. **Everything scoped to acme** — invisible to other orgs and to solo spaces.

---

## 8. Sign-in & space resolution

```
User submits email + password (works on any URL)
        │
        ▼
   JWT issued  → GET /auth/me  + GET /me/memberships
        │
        ▼
   Frontend reads current URL's space slug + kind
        │
        ▼
   Find the membership matching this space:
        │
        ├─ match found  → apply that membership's role
        │                 (solo-owner | org-admin | org-writer)
        │
        └─ no match     → treated as a global READER in this space
```

One login, many spaces, role resolved per space. A user is never "an admin everywhere" —
they're an admin **of a specific org**.

---

## 9. Data model

```
Space (tenant)                      Membership (join)              User (global)
─────────────                       ───────────────                ────────────
id, documentId                      id                             id, documentId
name                                user        → User             username (unique)
slug         (subdomain/prefix)     space       → Space            email    (unique)
kind: 'solo' | 'org'                role: owner|admin|writer        (no global role —
logo, coverImage, brandColor        invitedBy   → User              role lives in
description                         status: active|invited          Membership)
owner        → User                 joinedAt
createdAt

Article                             Invite (org only)
───────                             ────────────────
... existing fields                 id
space        → Space   (NEW)        space   → Space
status: draft|pending|              email
        published|rejected          token   (signed, expiring)
                                    role: writer|admin
                                    createdBy → User
```

- **Solo space** → exactly one Membership with `role: owner`. No Invites.
- **Org space** → one Membership `role: admin` (founder) + N writer/admin memberships.
- **Article.space** is required and auto-stamped from the current URL context.

---

## 10. Access-control matrix

| Action | Visitor | Reader | Solo owner (own space) | Org admin (own org) | Org writer (own org) |
|---|---|---|---|---|---|
| Read articles in space | ✅ | ✅ | ✅ | ✅ | ✅ |
| React / comment / mention | ❌ | ✅ | ✅ | ✅ | ✅ |
| Write article | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Publish directly** | ❌ | ❌ | ✅ | ✅ | ❌ (submit→review) |
| Submit for review | ❌ | ❌ | n/a | n/a | ✅ |
| Approve / reject | ❌ | ❌ | n/a | ✅ | ❌ |
| Invite members | ❌ | ❌ | ❌ (solo = 1 person) | ✅ | ❌ |
| Edit space branding | ❌ | ❌ | ✅ | ✅ | ❌ |
| Delete any article in space | ❌ | ❌ | ✅ (own) | ✅ (any in org) | ✅ (own) |

Everything above is **scoped to one space**. The same person has zero power in a space they
don't belong to.

---

## 11. Functional requirements

### FR-1 Account & spaces
- FR-1.1 Reader signup creates a global account with **no** space.
- FR-1.2 Solo signup creates: User + Space(kind=solo) + Membership(role=owner). Handle = space slug, must be globally unique across all spaces.
- FR-1.3 Org signup creates: User + Space(kind=org) + Membership(role=admin). Org slug unique across all spaces.
- FR-1.4 Slugs are reserved words protected (`www`, `admin`, `api`, `app`, `xblog`, etc.).

### FR-2 Routing
- FR-2.1 Middleware resolves `{slug, kind}` from subdomain (prod) or `/s/`,`/o/` prefix (dev).
- FR-2.2 Unknown slug → 404 space-not-found page.
- FR-2.3 Root domain → directory + signup, no space context.

### FR-3 Publishing
- FR-3.1 Solo & org-admin: `Publish now` sets status=published instantly.
- FR-3.2 Org-writer: only `Save draft` + `Submit for review` (→ pending). The publish action is hidden/blocked server-side.
- FR-3.3 Approve → published; reject → rejected (+ reason, notifies writer).

### FR-4 Membership management (org only)
- FR-4.1 Admin generates an invite (email + role). Token signed + expiring (e.g. 7 days).
- FR-4.2 Accepting an invite creates/links the user with the invited role.
- FR-4.3 Admin can change a member's role or remove them. Cannot remove the last admin.

### FR-5 Isolation
- FR-5.1 Every article/comment/reaction/notification query is filtered by `space.id`.
- FR-5.2 Mutations auto-stamp the current `space.id`; cross-space writes rejected.
- FR-5.3 Admin panel data is filtered to the admin's current org only.

### FR-6 Notifications (per space)
- FR-6.1 Comment / reaction / mention notifications route to recipients **within that space**.
- FR-6.2 Approval / rejection notifications go to the article's writer.
- FR-6.3 A user's bell aggregates notifications across all their spaces, each labeled with its space.

---

## 12. Non-goals (explicitly out of scope for v1)

- Custom domains (e.g. `blog.mycompany.com` CNAME) — subdomains only.
- Cross-space content syndication / shared feeds — spaces stay isolated by design.
- Billing / paid plans / seat limits.
- Per-space custom themes beyond logo + one brand color.
- Migrating a solo space into an org (or vice-versa).

---

## 13. Rollout phases

| Phase | Deliverable | Est. |
|---|---|---|
| **P1** | Space + Membership schemas; middleware + routing; reader/solo/org signup; data migration of existing content into a default space | ~1 day |
| **P2** | Scope all existing queries/mutations by space; solo direct-publish vs org review-gated publish | ~0.5 day |
| **P3** | Org invites + accept-invite + member management | ~0.5 day |
| **P4** | Per-org admin panel scoping; per-space notifications | ~0.5 day |
| **P5** | Per-space branding (logo, name, brand color); root directory page | ~0.5 day |
| **Total** | | **~3 days** |

### Migration note
All current articles/comments/users belong to no space yet. P1 includes a one-time script that
creates a **default org** (e.g. "xBlog") and assigns every existing record + user-membership to it,
so nothing breaks. Existing users may need to re-login once memberships go live.

---

## 14. Open decisions (need your call before P1)

1. **Dev URL style** — `/s/<slug>` & `/o/<slug>` prefixes (recommended) OR `*.localhost` subdomains?
2. **Solo handle = username?** i.e. should `aniket`'s solo space slug auto-equal their username, or can they pick a different slug?
3. **Can one user own multiple solo spaces**, or strictly one solo space per account? (Recommend: one.)
4. **Default space migration name** — call the catch-all org "xBlog" or something else?
5. **Reader accounts** — global as designed, or also scoped (a reader "of acme")? (Recommend: global.)
