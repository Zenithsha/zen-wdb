import { cn, STATUS_COLORS } from '@/lib/utils';

interface Props {
  status: 'draft' | 'pending' | 'published' | 'rejected';
  className?: string;
}

const LABELS: Record<string, string> = {
  draft: 'Draft',
  pending: 'Under Review',
  published: 'Published',
  rejected: 'Rejected',
};

export default function ArticleStatusChip({ status, className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        STATUS_COLORS[status],
        className
      )}
    >
      {LABELS[status]}
    </span>
  );
}
