'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { api, getStrapiMediaUrl } from '@/lib/api';
import { calculateReadingTime } from '@/lib/utils';
import type { Article } from '@/types';
import CoverImageUpload from '@/components/article/CoverImageUpload';
import TagSelector, { type SelectedTag } from '@/components/article/TagSelector';
import ArticleStatusChip from '@/components/article/ArticleStatusChip';
import AuthGuard from '@/components/auth/AuthGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Save, Send, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

const TipTapEditor = dynamic(() => import('@/components/editor/TipTapEditor'), {
  ssr: false,
  loading: () => <Skeleton className="h-96 w-full rounded-lg" />,
});

// Schema only validates title now — excerpt lives in plain useState so we
// have a guaranteed-correct source of truth regardless of react-hook-form's
// uncontrolled input quirks (`reset()` not propagating, etc.).
const schema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(200),
});

type FormValues = z.infer<typeof schema>;

function slugifyTagName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

/** Mints any staged tag-name strings via POST /tags, returns the final
 *  numeric-id array for the article update. */
async function resolveStagedTags(entries: SelectedTag[]): Promise<number[]> {
  const ids: number[] = [];
  for (const entry of entries) {
    if (typeof entry === 'number') {
      ids.push(entry);
      continue;
    }
    const name = entry.trim();
    if (!name) continue;
    const res = await api.post<{ data: { id: number } }>('/tags', {
      data: { name, slug: slugifyTagName(name) },
    });
    if (res.data?.data?.id) ids.push(res.data.data.id);
  }
  return ids;
}

export default function EditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  // Controlled excerpt — no more relying on rhf to track an uncontrolled
  // textarea. `excerpt` is always in sync with what the user typed.
  const [excerpt, setExcerpt] = useState('');
  // Mixed array: numeric ids for existing tags + strings for staged-new tags.
  // Staged-new tags are minted via `POST /tags` only when Save is clicked.
  const [selectedTags, setSelectedTags] = useState<SelectedTag[]>([]);
  const [coverImageId, setCoverImageId] = useState<number | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inFlightRef = useRef(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    api
      .get<{ data: Article }>(`/articles/${id}?populate[0]=author&populate[1]=tags&populate[2]=coverImage`)
      .then((res) => {
        const a = res.data.data;
        setArticle(a);
        setContent(a.content || '');
        setExcerpt(a.excerpt || '');
        setSelectedTags(a.tags?.map((t) => t.id).filter((x): x is number => typeof x === 'number') || []);
        if (a.coverImage) {
          setCoverImageId(a.coverImage.id);
          setCoverImageUrl(getStrapiMediaUrl(a.coverImage.url));
        }
        reset({ title: a.title });
      })
      .catch(() => toast.error('Failed to load article'))
      .finally(() => setLoading(false));
  }, [id, reset]);

  const updateArticle = async (values: FormValues, submitAfterSave = false) => {
    if (inFlightRef.current) return;
    if (!content || content === '<p></p>') {
      toast.error('Article content cannot be empty');
      return;
    }

    inFlightRef.current = true;
    if (submitAfterSave) setIsSubmitting(true); else setIsSaving(true);

    try {
      const trimmedExcerpt = excerpt.trim();
      // Flush staged tag names to Strapi only when the user actually saves.
      const tagIds = await resolveStagedTags(selectedTags);
      await api.put(`/articles/${id}`, {
        data: {
          title: values.title,
          excerpt: trimmedExcerpt ? trimmedExcerpt : null,
          content,
          tags: tagIds,
          coverImage: coverImageId,
          readingTime: calculateReadingTime(content),
        },
      });

      if (submitAfterSave) {
        await api.post(`/articles/${id}/submit`);
        toast.success('Article submitted for review!');
      } else {
        toast.success('Article updated!');
      }

      // Keep buttons disabled through navigation to avoid duplicate submits
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      toast.error(msg || 'Failed to update article');
      inFlightRef.current = false;
      setIsSaving(false);
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-52 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">
        Article not found.
      </div>
    );
  }

  const canSubmit = ['draft', 'rejected'].includes(article.status);

  return (
    <AuthGuard allowedRoles={['blogger', 'admin']}>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
              <ChevronLeft className="h-4 w-4" /> Dashboard
            </Link>
            <ArticleStatusChip status={article.status} />
          </div>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={isSaving || isSubmitting}
              onClick={handleSubmit((v) => updateArticle(v, false))}
              className="gap-1.5"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
            {canSubmit && (
              <Button
                type="button"
                disabled={isSaving || isSubmitting}
                onClick={handleSubmit((v) => updateArticle(v, true))}
                className="gap-1.5"
              >
                <Send className="h-4 w-4" />
                {isSubmitting ? 'Submitting...' : 'Submit for Review'}
              </Button>
            )}
          </div>
        </div>

        {/* Rejection reason */}
        {article.status === 'rejected' && article.rejectionReason && (
          <div className="mb-5 p-4 border border-destructive/50 bg-destructive/5 rounded-lg">
            <p className="text-sm font-medium text-destructive mb-1">Rejection reason:</p>
            <p className="text-sm">{article.rejectionReason}</p>
            {article.adminFeedback && (
              <p className="text-sm text-muted-foreground mt-1">Feedback: {article.adminFeedback}</p>
            )}
          </div>
        )}

        <div className="space-y-5">
          <div className="space-y-1">
            <Input
              placeholder="Article title..."
              className="text-2xl font-semibold h-12 border-0 border-b rounded-none px-0 focus-visible:ring-0"
              {...register('title')}
            />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <CoverImageUpload
            onUpload={(fileId, url) => { setCoverImageId(fileId); setCoverImageUrl(url); }}
            onClear={() => { setCoverImageId(null); setCoverImageUrl(undefined); }}
            currentUrl={coverImageUrl}
          />

          <div className="space-y-1">
            <label className="text-sm font-medium">
              Excerpt <span className="text-muted-foreground font-normal">({excerpt.length}/300)</span>
            </label>
            <Textarea
              placeholder="Brief description shown in feed cards…"
              rows={2}
              maxLength={300}
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              className="resize-none"
            />
          </div>

          <TagSelector selected={selectedTags} onChange={setSelectedTags} />

          {/* Inline "what will be saved" panel — proves tags + excerpt are
              captured before you click Save. */}
          <div className="rounded-md border border-emerald-200 bg-brand-soft/40 p-3 text-xs text-slate-700 flex flex-wrap gap-x-4 gap-y-1">
            <span>
              Will save:
            </span>
            <span>
              <strong>{selectedTags.length}</strong> tag{selectedTags.length === 1 ? '' : 's'}
            </span>
            <span>
              Excerpt:{' '}
              <strong>
                {excerpt.trim() ? `${excerpt.trim().length} chars` : 'empty'}
              </strong>
            </span>
            <span>
              Cover:{' '}
              <strong>{coverImageId ? `#${coverImageId}` : 'none'}</strong>
            </span>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Content</label>
            <TipTapEditor content={content} onChange={setContent} />
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
