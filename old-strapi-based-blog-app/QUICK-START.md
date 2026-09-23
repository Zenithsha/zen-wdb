# 🚀 StackXLookup Backend - Quick Start Guide

## What You Have

You now have a **complete Strapi v5 backend configuration** for StackXLookup with:

✅ **5 Content Types** (Article, Tag, Comment, Reaction, Subscription)  
✅ **User Extension** (Profile fields, bio, social links)  
✅ **3 Controllers** (Article, Admin, Blogger)  
✅ **3 Policies** (Admin, Blogger, Owner authorization)  
✅ **Custom Routes** (Approval workflow, dashboards)  
✅ **Complete API** (50+ endpoints)  

---

## 📦 Files Included

```
stackxlookup-strapi-config/
├── README.md                    # Main documentation
├── SETUP-INSTRUCTIONS.md        # Step-by-step setup guide
├── API-REFERENCE.md            # Complete API documentation
├── QUICK-START.md              # This file
│
├── Content Type Schemas (6 files):
│   ├── article-schema.json
│   ├── tag-schema.json
│   ├── comment-schema.json
│   ├── reaction-schema.json
│   ├── subscription-schema.json
│   └── user-extension-schema.json
│
├── Controllers (3 files):
│   ├── article-controller.js
│   ├── admin-controller.js
│   └── blogger-controller.js
│
├── Policies (3 files):
│   ├── admin-policy.js
│   ├── is-blogger-policy.js
│   └── is-owner-policy.js
│
└── Routes:
    └── custom-routes.json
```

---

## 🎯 Your Next Steps

### Step 1: Read the Documentation (5 minutes)
1. Open **README.md** - Overview of what's included
2. Scan **SETUP-INSTRUCTIONS.md** - Detailed implementation guide
3. Bookmark **API-REFERENCE.md** - For frontend development

### Step 2: Implement Content Types (30 minutes)
1. Open your Strapi Admin Panel
2. Go to Content-Type Builder
3. Create each content type using the schema files:
   - Article
   - Tag
   - Comment
   - Reaction
   - Subscription
4. Extend User model with custom fields

**OR** copy schema files directly to your Strapi project structure.

### Step 3: Add Controllers & Policies (20 minutes)
1. Copy controller files to your Strapi project:
   ```
   src/api/article/controllers/article.js
   src/api/admin/controllers/admin.js
   src/api/blogger/controllers/blogger.js
   ```

2. Copy policy files:
   ```
   src/policies/admin.js
   src/policies/is-blogger.js
   src/policies/is-owner.js
   ```

3. Add custom routes to each API directory

### Step 4: Configure Roles & Permissions (15 minutes)
1. Create three roles in Strapi Admin:
   - **Admin** - Full access
   - **Blogger** - Can create articles, needs approval
   - **Viewer** - Can read, comment, react

2. Set permissions for each role (detailed in SETUP-INSTRUCTIONS.md)

### Step 5: Create Admin User (5 minutes)
1. Create initial admin account via Strapi UI
2. OR use seed script (provided in setup instructions)

### Step 6: Test the API (15 minutes)
1. Use Postman/curl to test endpoints
2. Follow test examples in API-REFERENCE.md:
   - Admin login
   - Create blogger
   - Create article
   - Submit for review
   - Approve article

---

## 🔑 Core Workflow

```
1. ADMIN creates blogger account
   POST /api/admin/users/blogger

2. BLOGGER logs in and creates article
   POST /api/articles
   Status: draft

3. BLOGGER submits article for review
   POST /api/articles/:id/submit
   Status: pending

4. ADMIN reviews pending articles
   GET /api/articles/pending

5. ADMIN approves article
   POST /api/articles/:id/approve
   Status: published ✅

6. Article goes LIVE on website
   GET /api/articles (public)

7. VIEWERS can read, comment, react
   POST /api/comments
   POST /api/reactions
```

---

## 🎨 What to Build Next

### Frontend (Next.js)

**Week 1-2: Authentication & Layout**
- Login/Register pages
- Protected routes
- Header/Footer components
- Role-based navigation

**Week 3-4: Dashboards**
- Admin dashboard (stats, pending articles)
- Blogger dashboard (my articles, analytics)
- Article management tables

**Week 5-6: Article System**
- Rich text editor (TipTap)
- Article listing page
- Single article page
- Tag pages

**Week 7-8: Engagement**
- Comment section
- Reaction buttons
- Search functionality
- Subscription forms

---

## 📚 Important Files to Reference

**During Development:**
- `API-REFERENCE.md` - Every endpoint with examples
- `article-controller.js` - Approval workflow logic
- `SETUP-INSTRUCTIONS.md` - Troubleshooting

**For Team Members:**
- `README.md` - Project overview
- `QUICK-START.md` - This file

---

## 🧪 Testing Checklist

After setup, verify:

- [ ] Admin can login
- [ ] Admin can create blogger accounts
- [ ] Blogger can login
- [ ] Blogger can create articles (status: draft)
- [ ] Blogger can submit articles (status: pending)
- [ ] Admin sees pending articles
- [ ] Admin can approve articles
- [ ] Admin can reject articles
- [ ] Approved articles appear in public API
- [ ] Viewers can register
- [ ] Viewers can comment on articles
- [ ] Viewers can react to articles

---

## 🐛 Common Issues & Solutions

**Issue:** Can't login with admin account  
**Fix:** Make sure admin role exists and user is assigned to it

**Issue:** Blogger can't submit article  
**Fix:** Check article status (must be draft or rejected)

**Issue:** Routes not working  
**Fix:** Restart Strapi after adding custom routes

**Issue:** Permission denied errors  
**Fix:** Check role permissions in Settings → Roles

**Issue:** Content types not showing  
**Fix:** Clear cache: `npm run strapi build` and restart

---

## 📞 Need Help?

1. Check `SETUP-INSTRUCTIONS.md` for detailed steps
2. Review `API-REFERENCE.md` for endpoint documentation
3. Verify file locations match the structure in README.md
4. Check Strapi console for error messages
5. Ensure PostgreSQL is running and connected

---

## 🎯 Success Criteria

You're ready to move forward when:

✅ All content types created  
✅ All controllers and policies implemented  
✅ Custom routes working  
✅ Three roles configured with permissions  
✅ Admin account created  
✅ Test API calls working  
✅ Can complete full workflow (create → submit → approve)  

---

## 📈 Project Timeline

**Backend (Strapi):**
- Setup & Configuration: 2-3 hours ✅ (Using this package)
- Testing & Debugging: 1-2 hours
- Email integration: 2-3 hours (future)

**Frontend (Next.js):**
- Week 1-2: Setup, Auth, Layout
- Week 3-4: Dashboards
- Week 5-6: Articles
- Week 7-8: Comments, Reactions
- Week 9-10: Polish, Testing
- Week 11-12: Deployment

---

## 🚀 Ready to Build!

Start with:
1. Open **SETUP-INSTRUCTIONS.md**
2. Follow steps 1-10
3. Test everything works
4. Begin Next.js frontend

**Good luck with StackXLookup!** 🎉

---

**Questions?** Review the documentation files:
- README.md - Overview
- SETUP-INSTRUCTIONS.md - Detailed setup
- API-REFERENCE.md - All endpoints
- This file - Quick reference
