# StackXLookup Strapi v5 Setup Instructions

## Overview
This guide will help you implement all the content types, controllers, and policies for the StackXLookup blogging platform in your existing Strapi v5 + PostgreSQL setup.

---

## Step 1: Create Content Types

### 1.1 Create Article Content Type

1. Open Strapi Admin Panel (usually `http://localhost:1337/admin`)
2. Go to **Content-Type Builder**
3. Click **Create new collection type**
4. Name it: `article`
5. Add fields manually OR use the JSON schema:

**Option A: Manual Creation**
- Add each field from `article-schema.json` manually through UI

**Option B: Using Schema File**
- Navigate to: `src/api/article/content-types/article/schema.json`
- Replace content with `article-schema.json`
- Restart Strapi

### 1.2 Create Tag Content Type
- Same process as above using `tag-schema.json`
- Location: `src/api/tag/content-types/tag/schema.json`

### 1.3 Create Comment Content Type
- Use `comment-schema.json`
- Location: `src/api/comment/content-types/comment/schema.json`

### 1.4 Create Reaction Content Type
- Use `reaction-schema.json`
- Location: `src/api/reaction/content-types/reaction/schema.json`

### 1.5 Create Subscription Content Type
- Use `subscription-schema.json`
- Location: `src/api/subscription/content-types/subscription/schema.json`

### 1.6 Extend User Model
- Navigate to: `src/extensions/users-permissions/content-types/user/schema.json`
- Add the custom fields from `user-extension-schema.json` to the existing schema
- **Important**: Don't replace the entire file, just merge the custom fields

---

## Step 2: Create Custom Roles

1. Go to **Settings** → **Users & Permissions Plugin** → **Roles**
2. Create three roles:

### Admin Role
- Type: `admin`
- Description: "Platform administrator with full access"
- Permissions: Check ALL permissions

### Blogger Role
- Type: `blogger`
- Description: "Content creator who can write articles"
- Permissions:
  - Article: `create`, `update`, `find`, `findOne` (own articles only)
  - Comment: `create`, `update`, `delete` (own comments only)
  - Tag: `find`, `findOne`
  - User: `me` (own profile)

### Viewer Role (Authenticated)
- Type: `viewer` (or modify the default "Authenticated" role)
- Description: "Regular users who can read and comment"
- Permissions:
  - Article: `find`, `findOne` (published only)
  - Comment: `create`, `update`, `delete` (own comments only)
  - Reaction: `create`, `update`, `delete` (own reactions only)
  - Tag: `find`, `findOne`
  - Subscription: `create`, `update`, `delete` (own subscriptions only)
  - User: `me` (own profile)

---

## Step 3: Implement Custom Controllers

### 3.1 Article Controller
1. Navigate to: `src/api/article/controllers/article.js`
2. Replace content with `article-controller.js`
3. This adds methods for:
   - Finding pending articles
   - Approving articles
   - Rejecting articles
   - Submitting articles for review
   - Incrementing view counts

### 3.2 Create Admin Controller
1. Create directory: `src/api/admin/controllers/`
2. Create file: `src/api/admin/controllers/admin.js`
3. Copy content from `admin-controller.js`
4. This provides:
   - Dashboard statistics
   - Blogger account creation

### 3.3 Create Blogger Controller
1. Create directory: `src/api/blogger/controllers/`
2. Create file: `src/api/blogger/controllers/blogger.js`
3. Copy content from `blogger-controller.js`
4. This provides:
   - Blogger dashboard
   - Analytics

---

## Step 4: Implement Custom Policies

### 4.1 Admin Policy
1. Create directory: `src/policies/`
2. Create file: `src/policies/admin.js`
3. Copy content from `admin-policy.js`

### 4.2 Blogger Policy
1. Create file: `src/policies/is-blogger.js`
2. Copy content from `is-blogger-policy.js`

### 4.3 Owner Policy
1. Create file: `src/policies/is-owner.js`
2. Copy content from `is-owner-policy.js`

---

## Step 5: Add Custom Routes

### 5.1 Article Custom Routes
1. Navigate to: `src/api/article/routes/`
2. Create file: `custom-article.js`
3. Add this content:

```javascript
module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/articles/pending',
      handler: 'article.findPending',
      config: {
        policies: ['admin']
      }
    },
    {
      method: 'POST',
      path: '/articles/:id/approve',
      handler: 'article.approve',
      config: {
        policies: ['admin']
      }
    },
    {
      method: 'POST',
      path: '/articles/:id/reject',
      handler: 'article.reject',
      config: {
        policies: ['admin']
      }
    },
    {
      method: 'POST',
      path: '/articles/:id/submit',
      handler: 'article.submit',
      config: {
        policies: ['is-owner']
      }
    },
    {
      method: 'GET',
      path: '/articles/:id/increment-view',
      handler: 'article.incrementView',
      config: {
        auth: false
      }
    }
  ]
};
```

### 5.2 Admin Routes
1. Create directory: `src/api/admin/routes/`
2. Create file: `admin.js`
3. Add:

```javascript
module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/admin/dashboard',
      handler: 'admin.dashboard',
      config: {
        policies: ['admin']
      }
    },
    {
      method: 'POST',
      path: '/admin/users/blogger',
      handler: 'admin.createBlogger',
      config: {
        policies: ['admin']
      }
    }
  ]
};
```

### 5.3 Blogger Routes
1. Create directory: `src/api/blogger/routes/`
2. Create file: `blogger.js`
3. Add:

```javascript
module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/blogger/dashboard',
      handler: 'blogger.dashboard',
      config: {
        policies: ['is-blogger']
      }
    },
    {
      method: 'GET',
      path: '/blogger/analytics',
      handler: 'blogger.analytics',
      config: {
        policies: ['is-blogger']
      }
    }
  ]
};
```

---

## Step 6: Configure Permissions in Admin Panel

After creating all the content types, roles, and custom routes:

1. Go to **Settings** → **Roles**
2. For each role (Admin, Blogger, Viewer), configure permissions:

### Admin Permissions
- Enable ALL endpoints for all content types
- Enable custom routes: `/admin/*`, `/articles/pending`, `/articles/:id/approve`, `/articles/:id/reject`

### Blogger Permissions
- Articles: `create`, `update`, `find`, `findOne`, `submit`
- Comments: `create`, `update`, `delete` (own only)
- Tags: `find`, `findOne`
- Enable custom routes: `/blogger/*`, `/articles/:id/submit`

### Viewer Permissions
- Articles: `find`, `findOne` (published only)
- Comments: `create`, `update`, `delete` (own only)
- Reactions: `create`, `update`, `delete`
- Tags: `find`, `findOne`
- Subscriptions: `create`, `update`, `delete`

---

## Step 7: Create Initial Admin User

Run this command in Strapi terminal or create via UI:

```bash
# Via Strapi Admin Panel:
# 1. Go to Settings → Users
# 2. Create new user with admin role
# Or run this script in Node.js console
```

Or create a seed script:

```javascript
// scripts/seed-admin.js
module.exports = async () => {
  const params = {
    username: 'admin',
    email: 'admin@stackxlookup.com',
    password: 'Admin@123',
    displayName: 'Admin',
    confirmed: true,
    blocked: false,
  };

  const adminRole = await strapi
    .query('plugin::users-permissions.role')
    .findOne({ where: { type: 'admin' } });

  params.role = adminRole.id;

  await strapi.plugins['users-permissions'].services.user.add(params);
  console.log('Admin user created');
};
```

---

## Step 8: Test the Setup

### 8.1 Test API Endpoints

Using Postman or curl:

**1. Login as Admin:**
```bash
POST http://localhost:1337/api/auth/local
Body: {
  "identifier": "admin@stackxlookup.com",
  "password": "Admin@123"
}
```

Save the JWT token from response.

**2. Create Blogger Account:**
```bash
POST http://localhost:1337/api/admin/users/blogger
Headers: {
  "Authorization": "Bearer YOUR_JWT_TOKEN"
}
Body: {
  "email": "blogger1@example.com",
  "username": "blogger1",
  "displayName": "John Blogger",
  "password": "Temp@123"
}
```

**3. Login as Blogger:**
```bash
POST http://localhost:1337/api/auth/local
Body: {
  "identifier": "blogger1@example.com",
  "password": "Temp@123"
}
```

**4. Create Article (as Blogger):**
```bash
POST http://localhost:1337/api/articles
Headers: {
  "Authorization": "Bearer BLOGGER_JWT_TOKEN"
}
Body: {
  "data": {
    "title": "My First Article",
    "content": "Article content here...",
    "excerpt": "Short description"
  }
}
```

**5. Submit Article for Review:**
```bash
POST http://localhost:1337/api/articles/:id/submit
Headers: {
  "Authorization": "Bearer BLOGGER_JWT_TOKEN"
}
```

**6. Get Pending Articles (as Admin):**
```bash
GET http://localhost:1337/api/articles/pending
Headers: {
  "Authorization": "Bearer ADMIN_JWT_TOKEN"
}
```

**7. Approve Article (as Admin):**
```bash
POST http://localhost:1337/api/articles/:id/approve
Headers: {
  "Authorization": "Bearer ADMIN_JWT_TOKEN"
}
Body: {
  "adminFeedback": "Great article!"
}
```

---

## Step 9: Database Verification

Check your PostgreSQL database to ensure all tables are created:

```sql
\dt

-- You should see tables like:
-- articles
-- tags
-- comments
-- reactions
-- subscriptions
-- article_tags (junction table)
-- up_users (users)
-- up_roles (roles)
```

---

## Step 10: Next Steps - Frontend Integration

Once Strapi is fully configured, you can:

1. Start building the Next.js frontend
2. Connect to Strapi API endpoints
3. Implement authentication flow
4. Build dashboards
5. Create article editor
6. Implement comment and reaction systems

---

## Troubleshooting

### Common Issues:

**1. Policy not found error:**
- Make sure policy files are in `src/policies/` directory
- Restart Strapi after adding policies

**2. Route not working:**
- Check if custom route files are in correct API directory
- Ensure route handler matches controller method name
- Restart Strapi

**3. Permission denied:**
- Verify role permissions in Admin Panel
- Check JWT token is valid and not expired
- Ensure user has correct role assigned

**4. Database connection error:**
- Verify PostgreSQL is running
- Check database credentials in `config/database.js`
- Ensure database exists

**5. Content type not appearing:**
- Clear Strapi cache: `npm run strapi build`
- Restart Strapi
- Check for syntax errors in schema.json files

---

## File Structure Summary

```
your-strapi-project/
├── src/
│   ├── api/
│   │   ├── article/
│   │   │   ├── content-types/article/schema.json
│   │   │   ├── controllers/article.js
│   │   │   └── routes/
│   │   │       ├── article.js
│   │   │       └── custom-article.js
│   │   ├── tag/
│   │   │   ├── content-types/tag/schema.json
│   │   │   └── controllers/tag.js
│   │   ├── comment/
│   │   │   ├── content-types/comment/schema.json
│   │   │   └── controllers/comment.js
│   │   ├── reaction/
│   │   │   ├── content-types/reaction/schema.json
│   │   │   └── controllers/reaction.js
│   │   ├── subscription/
│   │   │   ├── content-types/subscription/schema.json
│   │   │   └── controllers/subscription.js
│   │   ├── admin/
│   │   │   ├── controllers/admin.js
│   │   │   └── routes/admin.js
│   │   └── blogger/
│   │       ├── controllers/blogger.js
│   │       └── routes/blogger.js
│   ├── extensions/
│   │   └── users-permissions/
│   │       └── content-types/user/schema.json
│   └── policies/
│       ├── admin.js
│       ├── is-blogger.js
│       └── is-owner.js
└── config/
    └── database.js
```

---

## Additional Notes

- Always restart Strapi after modifying schemas, routes, or policies
- Use Strapi CLI for generating content types: `npm run strapi generate`
- Enable CORS in `config/middlewares.js` for frontend development
- Consider adding rate limiting for production
- Implement proper error handling and logging
- Add input validation and sanitization
- Setup email service for notifications (Sendgrid, AWS SES, etc.)

---

## Support Resources

- Strapi Documentation: https://docs.strapi.io/dev-docs/intro
- Strapi Discord: https://discord.strapi.io/
- PostgreSQL Docs: https://www.postgresql.org/docs/

---

**Ready to build!** Follow these steps carefully and you'll have a fully functional StackXLookup backend. Good luck! 🚀
