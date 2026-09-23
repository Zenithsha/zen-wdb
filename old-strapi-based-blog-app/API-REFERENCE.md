# StackXLookup API Reference

Complete API documentation for the StackXLookup backend.

Base URL: `http://localhost:1337/api`

---

## 📝 Table of Contents

1. [Authentication](#authentication)
2. [Admin Endpoints](#admin-endpoints)
3. [Blogger Endpoints](#blogger-endpoints)
4. [Article Endpoints](#article-endpoints)
5. [Comment Endpoints](#comment-endpoints)
6. [Reaction Endpoints](#reaction-endpoints)
7. [Tag Endpoints](#tag-endpoints)
8. [Subscription Endpoints](#subscription-endpoints)
9. [User Endpoints](#user-endpoints)

---

## 🔐 Authentication

All authenticated endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

### Register (Viewer)
```http
POST /api/auth/local/register
```

**Body:**
```json
{
  "username": "viewer1",
  "email": "viewer1@example.com",
  "password": "Password123!",
  "displayName": "John Viewer"
}
```

**Response:**
```json
{
  "jwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "viewer1",
    "email": "viewer1@example.com",
    "displayName": "John Viewer",
    "role": {
      "name": "Viewer",
      "type": "viewer"
    }
  }
}
```

### Login
```http
POST /api/auth/local
```

**Body:**
```json
{
  "identifier": "admin@example.com",
  "password": "Admin123!"
}
```

**Response:**
```json
{
  "jwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "displayName": "Admin User",
    "role": {
      "name": "Admin",
      "type": "admin"
    }
  }
}
```

### Forgot Password
```http
POST /api/auth/forgot-password
```

**Body:**
```json
{
  "email": "user@example.com"
}
```

### Reset Password
```http
POST /api/auth/reset-password
```

**Body:**
```json
{
  "code": "reset-token-from-email",
  "password": "NewPassword123!",
  "passwordConfirmation": "NewPassword123!"
}
```

---

## 👨‍💼 Admin Endpoints

### Get Dashboard Stats
```http
GET /api/admin/dashboard
```

**Auth:** Required (Admin only)

**Response:**
```json
{
  "data": {
    "stats": {
      "articles": {
        "draft": 5,
        "pending": 3,
        "published": 20,
        "rejected": 2,
        "total": 30
      },
      "users": {
        "bloggers": 5,
        "viewers": 50,
        "total": 55
      },
      "todayComments": 12
    },
    "pendingArticles": [...],
    "recentPublished": [...],
    "recentComments": [...]
  }
}
```

### Create Blogger Account
```http
POST /api/admin/users/blogger
```

**Auth:** Required (Admin only)

**Body:**
```json
{
  "email": "blogger1@example.com",
  "username": "blogger1",
  "displayName": "John Blogger",
  "password": "TempPassword123!"
}
```

**Response:**
```json
{
  "data": {
    "id": 2,
    "username": "blogger1",
    "email": "blogger1@example.com",
    "displayName": "John Blogger",
    "role": {
      "name": "Blogger",
      "type": "blogger"
    },
    "mustChangePassword": true
  },
  "message": "Blogger account created successfully"
}
```

### Get All Users
```http
GET /api/users
```

**Auth:** Required (Admin only)

**Query Parameters:**
- `filters[role][type][$eq]=blogger` - Filter by role
- `pagination[page]=1` - Page number
- `pagination[pageSize]=10` - Items per page

---

## ✍️ Blogger Endpoints

### Get Blogger Dashboard
```http
GET /api/blogger/dashboard
```

**Auth:** Required (Blogger only)

**Response:**
```json
{
  "data": {
    "stats": {
      "articles": {
        "draft": 2,
        "pending": 1,
        "published": 10,
        "rejected": 0,
        "total": 13
      },
      "totalViews": 1500,
      "totalComments": 45,
      "totalReactions": 120
    },
    "myArticles": [...]
  }
}
```

### Get Blogger Analytics
```http
GET /api/blogger/analytics
```

**Auth:** Required (Blogger only)

**Response:**
```json
{
  "data": {
    "overview": {
      "totalArticles": 10,
      "totalViews": 1500,
      "totalComments": 45,
      "totalReactions": 120,
      "engagementRate": 11.0
    },
    "articlesWithMetrics": [...],
    "topArticles": [...],
    "popularTags": [...],
    "viewsTrend": {...}
  }
}
```

---

## 📰 Article Endpoints

### List Articles (Public)
```http
GET /api/articles
```

**Auth:** Optional

**Query Parameters:**
- `filters[status][$eq]=published` - Filter by status
- `filters[author][id][$eq]=1` - Filter by author
- `filters[tags][slug][$eq]=javascript` - Filter by tag
- `pagination[page]=1` - Page number
- `pagination[pageSize]=12` - Items per page
- `sort=publishedAt:desc` - Sort order
- `populate=author,tags` - Include relations

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "title": "Getting Started with React",
      "slug": "getting-started-with-react",
      "excerpt": "Learn the basics of React...",
      "coverImage": {...},
      "readingTime": 5,
      "status": "published",
      "viewCount": 150,
      "publishedAt": "2026-02-01T10:00:00.000Z",
      "author": {
        "id": 1,
        "username": "blogger1",
        "displayName": "John Blogger",
        "profilePicture": {...}
      },
      "tags": [
        {
          "id": 1,
          "name": "React",
          "slug": "react"
        }
      ],
      "createdAt": "2026-01-30T10:00:00.000Z",
      "updatedAt": "2026-02-01T10:00:00.000Z"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 12,
      "pageCount": 3,
      "total": 35
    }
  }
}
```

### Get Single Article
```http
GET /api/articles/:id
```

**Auth:** Optional (required for non-published articles)

**Response:**
```json
{
  "data": {
    "id": 1,
    "title": "Getting Started with React",
    "slug": "getting-started-with-react",
    "content": "Full article content here...",
    "excerpt": "Learn the basics of React...",
    "coverImage": {...},
    "readingTime": 5,
    "status": "published",
    "viewCount": 150,
    "publishedAt": "2026-02-01T10:00:00.000Z",
    "author": {...},
    "tags": [...],
    "comments": [...],
    "reactions": [...]
  }
}
```

### Create Article (Blogger)
```http
POST /api/articles
```

**Auth:** Required (Blogger or Admin)

**Body:**
```json
{
  "data": {
    "title": "My New Article",
    "content": "Article content here...",
    "excerpt": "Short description",
    "tags": [1, 2],
    "coverImage": 1
  }
}
```

**Response:**
```json
{
  "data": {
    "id": 15,
    "title": "My New Article",
    "slug": "my-new-article",
    "status": "draft",
    "readingTime": 3,
    ...
  }
}
```

### Update Article
```http
PUT /api/articles/:id
```

**Auth:** Required (Owner or Admin)

**Body:**
```json
{
  "data": {
    "title": "Updated Title",
    "content": "Updated content..."
  }
}
```

### Delete Article
```http
DELETE /api/articles/:id
```

**Auth:** Required (Owner or Admin)

### Get Pending Articles (Admin)
```http
GET /api/articles/pending
```

**Auth:** Required (Admin only)

**Response:**
```json
{
  "data": [
    {
      "id": 10,
      "title": "Article Pending Review",
      "status": "pending",
      "author": {
        "username": "blogger1",
        "displayName": "John Blogger"
      },
      "createdAt": "2026-02-03T10:00:00.000Z"
    }
  ]
}
```

### Submit Article for Review (Blogger)
```http
POST /api/articles/:id/submit
```

**Auth:** Required (Owner)

**Response:**
```json
{
  "data": {
    "id": 10,
    "status": "pending",
    ...
  },
  "message": "Article submitted for review"
}
```

### Approve Article (Admin)
```http
POST /api/articles/:id/approve
```

**Auth:** Required (Admin only)

**Body:**
```json
{
  "adminFeedback": "Great article! Well written."
}
```

**Response:**
```json
{
  "data": {
    "id": 10,
    "status": "published",
    "publishedAt": "2026-02-04T10:00:00.000Z",
    "adminFeedback": "Great article! Well written.",
    ...
  },
  "message": "Article approved successfully"
}
```

### Reject Article (Admin)
```http
POST /api/articles/:id/reject
```

**Auth:** Required (Admin only)

**Body:**
```json
{
  "rejectionReason": "Please add more code examples and fix grammar issues."
}
```

**Response:**
```json
{
  "data": {
    "id": 10,
    "status": "rejected",
    "rejectionReason": "Please add more code examples and fix grammar issues.",
    ...
  },
  "message": "Article rejected"
}
```

### Increment View Count
```http
GET /api/articles/:id/increment-view
```

**Auth:** Not required

**Response:**
```json
{
  "success": true
}
```

---

## 💬 Comment Endpoints

### Get Article Comments
```http
GET /api/comments
```

**Query Parameters:**
- `filters[article][id][$eq]=1` - Filter by article
- `populate=user,parentComment,replies` - Include relations
- `sort=createdAt:desc` - Sort order

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "content": "Great article!",
      "isEdited": false,
      "createdAt": "2026-02-04T10:00:00.000Z",
      "user": {
        "username": "viewer1",
        "displayName": "John Viewer",
        "profilePicture": {...}
      },
      "parentComment": null,
      "replies": []
    }
  ]
}
```

### Create Comment
```http
POST /api/comments
```

**Auth:** Required

**Body:**
```json
{
  "data": {
    "content": "This is a great article!",
    "article": 1,
    "parentComment": null
  }
}
```

### Update Comment
```http
PUT /api/comments/:id
```

**Auth:** Required (Owner only)

**Body:**
```json
{
  "data": {
    "content": "Updated comment text",
    "isEdited": true
  }
}
```

### Delete Comment
```http
DELETE /api/comments/:id
```

**Auth:** Required (Owner, Article Author, or Admin)

---

## 👍 Reaction Endpoints

### Get Article Reactions
```http
GET /api/reactions
```

**Query Parameters:**
- `filters[article][id][$eq]=1` - Filter by article
- `populate=user` - Include user info

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "type": "love",
      "user": {
        "username": "viewer1",
        "displayName": "John Viewer"
      },
      "createdAt": "2026-02-04T10:00:00.000Z"
    }
  ]
}
```

### Add/Update Reaction
```http
POST /api/reactions
```

**Auth:** Required

**Body:**
```json
{
  "data": {
    "type": "love",
    "article": 1
  }
}
```

**Note:** If user already has a reaction on this article, it will be updated.

### Remove Reaction
```http
DELETE /api/reactions/:id
```

**Auth:** Required (Owner only)

---

## 🏷️ Tag Endpoints

### List All Tags
```http
GET /api/tags
```

**Query Parameters:**
- `sort=articleCount:desc` - Sort by popularity
- `pagination[page]=1`
- `pagination[pageSize]=20`

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "name": "JavaScript",
      "slug": "javascript",
      "description": "JavaScript programming language",
      "color": "#F7DF1E",
      "articleCount": 25
    }
  ]
}
```

### Get Single Tag
```http
GET /api/tags/:id
```

### Get Tag with Articles
```http
GET /api/tags/:id?populate=articles
```

---

## 📧 Subscription Endpoints

### Create Subscription
```http
POST /api/subscriptions
```

**Auth:** Required

**Body:**
```json
{
  "data": {
    "subscriptionType": "weekly_digest",
    "isActive": true
  }
}
```

OR subscribe to specific tag:
```json
{
  "data": {
    "subscriptionType": "tag",
    "tag": 1,
    "isActive": true
  }
}
```

### Get My Subscriptions
```http
GET /api/subscriptions
```

**Auth:** Required

**Query Parameters:**
- `filters[user][id][$eq]=1` - Current user's subscriptions

### Update Subscription
```http
PUT /api/subscriptions/:id
```

**Auth:** Required (Owner only)

**Body:**
```json
{
  "data": {
    "isActive": false
  }
}
```

### Delete Subscription
```http
DELETE /api/subscriptions/:id
```

**Auth:** Required (Owner only)

---

## 👤 User Endpoints

### Get Current User
```http
GET /api/users/me
```

**Auth:** Required

**Response:**
```json
{
  "id": 1,
  "username": "blogger1",
  "email": "blogger1@example.com",
  "displayName": "John Blogger",
  "profilePicture": {...},
  "bio": "Tech blogger and developer",
  "socialLinks": {
    "github": "https://github.com/blogger1",
    "twitter": "https://twitter.com/blogger1",
    "linkedin": "",
    "website": "https://johnblogger.com"
  },
  "role": {
    "name": "Blogger",
    "type": "blogger"
  }
}
```

### Update User Profile
```http
PUT /api/users/:id
```

**Auth:** Required (Owner or Admin)

**Body:**
```json
{
  "displayName": "John Updated",
  "bio": "Updated bio text",
  "socialLinks": {
    "github": "https://github.com/newusername",
    "twitter": "https://twitter.com/newusername"
  }
}
```

### Get User by Username
```http
GET /api/users?filters[username][$eq]=blogger1
```

---

## 📊 Common Query Parameters

### Pagination
```
pagination[page]=1
pagination[pageSize]=10
```

### Filtering
```
filters[status][$eq]=published
filters[author][username][$eq]=blogger1
filters[viewCount][$gte]=100
```

### Sorting
```
sort=createdAt:desc
sort[0]=viewCount:desc&sort[1]=createdAt:desc
```

### Population
```
populate=author,tags
populate[author][fields][0]=username
populate[tags][fields][0]=name
```

---

## 🚨 Error Responses

### 400 Bad Request
```json
{
  "error": {
    "status": 400,
    "name": "BadRequestError",
    "message": "Rejection reason is required"
  }
}
```

### 401 Unauthorized
```json
{
  "error": {
    "status": 401,
    "name": "UnauthorizedError",
    "message": "Missing or invalid credentials"
  }
}
```

### 403 Forbidden
```json
{
  "error": {
    "status": 403,
    "name": "ForbiddenError",
    "message": "You do not have permission to access this resource"
  }
}
```

### 404 Not Found
```json
{
  "error": {
    "status": 404,
    "name": "NotFoundError",
    "message": "Article not found"
  }
}
```

### 500 Server Error
```json
{
  "error": {
    "status": 500,
    "name": "InternalServerError",
    "message": "An internal server error occurred"
  }
}
```

---

## 📝 Notes

- All dates are in ISO 8601 format (UTC)
- File uploads use multipart/form-data
- JWT tokens expire after 30 days (configurable)
- Rate limiting may apply to certain endpoints
- CORS is enabled for development (configure for production)

---

## 🔗 Useful Links

- Strapi API Documentation: https://docs.strapi.io/dev-docs/api/rest
- Query Parameters Guide: https://docs.strapi.io/dev-docs/api/rest/parameters
- Authentication: https://docs.strapi.io/dev-docs/plugins/users-permissions

---

**Ready to integrate!** Use these endpoints to build your Next.js frontend. 🚀
