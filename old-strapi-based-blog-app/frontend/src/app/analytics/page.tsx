'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { AnalyticsData } from '@/types';
import AuthGuard from '@/components/auth/AuthGuard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, Heart, MessageSquare, FileText, Hash, TrendingUp } from 'lucide-react';

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ data: AnalyticsData }>('/blogger/analytics')
      .then((res) => setData(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <AuthGuard allowedRoles={['blogger', 'admin']}>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-2xl font-bold mb-8 flex items-center gap-2">
          <TrendingUp className="h-6 w-6" /> My Analytics
        </h1>

        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
            </div>
            <Skeleton className="h-64 rounded-lg" />
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Overview stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Published Articles', value: data.overview.totalArticles, icon: FileText, color: 'text-blue-600' },
                { label: 'Total Views', value: data.overview.totalViews, icon: Eye, color: 'text-green-600' },
                { label: 'Reactions', value: data.overview.totalReactions, icon: Heart, color: 'text-rose-500' },
                { label: 'Comments', value: data.overview.totalComments, icon: MessageSquare, color: 'text-purple-600' },
              ].map(({ label, value, icon: Icon, color }) => (
                <Card key={label}>
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className={`text-3xl font-bold mt-0.5 ${color}`}>{value.toLocaleString()}</p>
                      </div>
                      <Icon className={`h-8 w-8 opacity-20 ${color}`} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Top articles */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Performing Articles</CardTitle>
              </CardHeader>
              <CardContent>
                {data.topArticles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No published articles yet.</p>
                ) : (
                  <div className="space-y-3">
                    {data.topArticles.map((article, index) => (
                      <div key={article.documentId} className="flex items-center gap-3">
                        <span className="text-lg font-bold text-muted-foreground w-6 text-center">
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/articles/${article.slug}`}
                            className="text-sm font-medium hover:text-primary transition-colors truncate block"
                          >
                            {article.title}
                          </Link>
                          <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                            <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{article.viewCount}</span>
                            <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{article.reactionCount}</span>
                          </div>
                        </div>
                        <div className="hidden sm:flex gap-1 flex-wrap justify-end max-w-32">
                          {article.tags.slice(0, 2).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">#{tag}</Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Popular tags */}
            {data.popularTags.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Hash className="h-4 w-4" /> Your Most Used Tags
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {data.popularTags.map(({ name, count }) => (
                      <Link key={name} href={`/tags/${name}`}>
                        <Badge variant="outline" className="cursor-pointer hover:bg-muted transition-colors">
                          #{name} <span className="ml-1 text-muted-foreground">({count})</span>
                        </Badge>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground">Could not load analytics.</p>
        )}
      </div>
    </AuthGuard>
  );
}
