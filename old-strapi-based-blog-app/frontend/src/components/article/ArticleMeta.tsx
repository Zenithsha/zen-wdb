import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getStrapiMediaUrl } from '@/lib/api';
import { timeAgo, fullDate, readingTimeLabel } from '@/lib/utils';
import type { Article } from '@/types';
import { Clock } from 'lucide-react';

interface Props {
  article: Article;
  showDate?: boolean;
}

export default function ArticleMeta({ article, showDate = true }: Props) {
  const author = article.author;
  const displayName = author?.displayName || author?.username || 'Unknown';

  return (
    // SINGLE-line meta layout — avatar + author + date + reading time +
    // view count all on one row. Author name truncates if too long;
    // every other chip is fixed-width nowrap, so the row stays one line
    // and every card aligns identically.
    <div className="flex items-center gap-2 text-[11px] text-muted-foreground min-w-0 overflow-hidden">
      {author && (
        <Link
          href={`/profile/${author.username}`}
          // `title` shows the full author name as a native browser tooltip
          // on hover when the chip is too narrow to display it in full.
          title={displayName}
          className="flex items-center gap-1 hover:text-foreground transition-colors min-w-0"
        >
          <Avatar className="h-5 w-5 flex-shrink-0">
            <AvatarImage src={getStrapiMediaUrl(author.profilePicture?.url)} alt={displayName} />
            <AvatarFallback className="text-[10px]">
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium text-foreground/80 truncate">{displayName}</span>
        </Link>
      )}

      {showDate && article.createdAt && (
        <>
          <span aria-hidden className="text-slate-300 flex-shrink-0">·</span>
          <span
            title={fullDate(article.createdAt)}
            className="whitespace-nowrap flex-shrink-0"
          >
            {timeAgo(article.createdAt)}
          </span>
        </>
      )}

      <span aria-hidden className="text-slate-300 flex-shrink-0">·</span>
      <span className="inline-flex items-center gap-0.5 whitespace-nowrap flex-shrink-0">
        <Clock className="h-3 w-3" />
        {article.readingTime ? readingTimeLabel(article.readingTime) : '—'}
      </span>
    </div>
  );
}
