import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatDistanceToNow, format } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function timeAgo(date: string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function fullDate(date: string): string {
  return format(new Date(date), 'MMMM d, yyyy');
}

export function readingTimeLabel(minutes?: number): string {
  if (!minutes) return '';
  return `${minutes} min read`;
}

export function calculateReadingTime(html: string): number {
  const text = html.replace(/<[^>]*>/g, '');
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 200));
}

export const REACTION_EMOJIS: Record<string, string> = {
  like: '👍',
  love: '❤️',
  fire: '🔥',
  insightful: '💡',
};

export const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending: 'bg-yellow-100 text-yellow-700',
  published: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};
