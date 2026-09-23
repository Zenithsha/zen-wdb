export interface Role {
  id: number;
  name: string;
  type: 'admin' | 'blogger' | 'authenticated' | 'public';
}

export interface StrapiMedia {
  id: number;
  url: string;
  alternativeText?: string;
  width?: number;
  height?: number;
  formats?: {
    thumbnail?: MediaFormat;
    small?: MediaFormat;
    medium?: MediaFormat;
    large?: MediaFormat;
  };
}

export interface MediaFormat {
  url: string;
  width: number;
  height: number;
}

export interface User {
  id: number;
  documentId: string;
  username: string;
  email: string;
  displayName?: string;
  bio?: string;
  profilePicture?: StrapiMedia;
  socialLinks?: Record<string, string>;
  mustChangePassword?: boolean;
  role?: Role;
  confirmed: boolean;
  blocked: boolean;
  createdAt?: string;
}

export interface Tag {
  id: number;
  documentId: string;
  name: string;
  slug: string;
  description?: string;
  color?: string;
}

export interface Article {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  coverImage?: StrapiMedia;
  status: 'draft' | 'pending' | 'published' | 'rejected';
  viewCount: number;
  adminFeedback?: string;
  rejectionReason?: string;
  readingTime?: number;
  author?: User;
  tags?: Tag[];
  comments?: Comment[];
  reactions?: Reaction[];
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: number;
  documentId: string;
  content: string;
  isEdited: boolean;
  user?: User;
  article?: Article;
  parentComment?: Comment;
  replies?: Comment[];
  likesCount?: number;
  // Only sent from backend when `populate=likedBy` is used, or from client-side derivation.
  likedBy?: Pick<User, 'id'>[];
  createdAt: string;
  updatedAt: string;
}

export interface Reaction {
  id: number;
  documentId: string;
  type: 'like' | 'love' | 'fire' | 'insightful';
  user?: User;
  article?: Article;
}

export interface AuthResponse {
  jwt: string;
  user: User;
}

export interface StrapiListResponse<T> {
  data: T[];
  meta: {
    pagination: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}

export interface StrapiSingleResponse<T> {
  data: T;
  meta: Record<string, unknown>;
}

export interface BloggerDashboardData {
  stats: {
    draft: number;
    pending: number;
    published: number;
    rejected: number;
    total: number;
    totalViews: number;
  };
  recentArticles: Article[];
}

export interface AdminDashboardData {
  stats: {
    articles: {
      total: number;
      draft: number;
      pending: number;
      published: number;
      rejected: number;
    };
    users: { total?: number; bloggers: number; viewers?: number; blocked?: number };
    totalComments: number;
    totalReactions: number;
  };
  recentPending: Article[];
  recentPublished: Article[];
}

export interface AnalyticsData {
  overview: {
    totalArticles: number;
    totalViews: number;
    totalReactions: number;
    totalComments: number;
  };
  topArticles: {
    documentId: string;
    title: string;
    slug: string;
    viewCount: number;
    reactionCount: number;
    tags: string[];
  }[];
  popularTags: { name: string; count: number }[];
}
