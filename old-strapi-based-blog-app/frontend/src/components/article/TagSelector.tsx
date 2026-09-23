'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Tag } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * A `selected` entry is either:
 *   - a `number` → existing tag id (already in Strapi)
 *   - a `string` → a brand-new tag NAME the user typed in; it'll be
 *     created via `POST /tags` only when the parent saves.
 *
 * The parent (write/edit page) flushes pending strings on save by
 * minting them via `POST /tags` and swapping the string for the real id
 * just before sending the article create/update.
 */
export type SelectedTag = number | string;

interface Props {
  selected: SelectedTag[];
  onChange: (next: SelectedTag[]) => void;
}

/**
 * Inline tag picker — Enter STAGES a tag locally, it doesn't hit Strapi.
 * Tags only persist when the parent form is saved (the parent is
 * responsible for resolving the staged strings into real ids).
 */
export default function TagSelector({ selected, onChange }: Props) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api
      .get<{ data: Tag[] }>('/tags?sort=name:asc&pagination[pageSize]=200')
      .then((res) => setAllTags(res.data.data || []))
      .catch(() => {});
  }, []);

  const trimmedSearch = search.trim();
  const lowerSearch = trimmedSearch.toLowerCase();

  const filtered = allTags.filter(
    (tag) =>
      tag.name.toLowerCase().includes(lowerSearch) &&
      !selected.includes(tag.id)
  );

  const exactExisting = allTags.find((t) => t.name.toLowerCase() === lowerSearch);

  // Pending strings already staged (case-insensitive match prevents dupes).
  const pendingStrings = selected.filter((s): s is string => typeof s === 'string');
  const alreadyPending = pendingStrings.some((p) => p.toLowerCase() === lowerSearch);

  // Resolved Tag objects for the numeric ids in `selected`.
  const selectedTagsExisting = allTags.filter(
    (t) => selected.includes(t.id)
  );

  const addExisting = (tag: Tag) => {
    if (selected.length >= 5) {
      toast.error('Max 5 tags');
      return;
    }
    if (selected.includes(tag.id)) return;
    onChange([...selected, tag.id]);
    setSearch('');
  };

  const stagePending = (name: string) => {
    if (selected.length >= 5) {
      toast.error('Max 5 tags');
      return;
    }
    if (!name) return;
    if (alreadyPending) return;
    onChange([...selected, name]);
    setSearch('');
  };

  const removeAt = (entry: SelectedTag) => {
    onChange(selected.filter((x) => x !== entry));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (exactExisting) {
        addExisting(exactExisting);
      } else if (filtered.length > 0) {
        addExisting(filtered[0]);
      } else if (trimmedSearch) {
        stagePending(trimmedSearch);
      }
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">
        Tags <span className="text-muted-foreground font-normal">(up to 5)</span>
      </label>

      {/* Selected chips — existing tags first, then staged-new */}
      {(selectedTagsExisting.length > 0 || pendingStrings.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {selectedTagsExisting.map((tag) => (
            <Badge key={`existing-${tag.id}`} variant="default" className="gap-1 pr-1.5">
              #{tag.name}
              <button
                type="button"
                onClick={() => removeAt(tag.id)}
                className="ml-0.5 rounded-full hover:bg-primary-foreground/20 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {pendingStrings.map((name) => (
            <Badge
              key={`pending-${name}`}
              variant="outline"
              className="gap-1 pr-1.5 border-dashed border-emerald-400 text-emerald-800 bg-brand-soft"
              title="Will be created on Save"
            >
              #{name}
              <span className="text-[9px] ml-1 opacity-70">new</span>
              <button
                type="button"
                onClick={() => removeAt(name)}
                className="ml-0.5 rounded-full hover:bg-emerald-200/40 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {pendingStrings.length > 0 && (
        <p className="text-[11px] text-emerald-700">
          {pendingStrings.length} new tag{pendingStrings.length === 1 ? '' : 's'} staged — saved to Strapi when you click <strong>Save</strong>.
        </p>
      )}

      {selected.length < 5 && (
        <div className="relative">
          <Input
            placeholder="Type a tag and press Enter to stage it…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={onKeyDown}
            className="h-9"
          />

          {trimmedSearch && (
            <div className="absolute top-full left-0 right-0 z-10 mt-1 border rounded-lg bg-background shadow-md max-h-56 overflow-auto">
              {filtered.slice(0, 8).map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => addExisting(tag)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-brand-soft transition-colors flex items-center gap-2"
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: tag.color || 'hsl(var(--brand))' }}
                  />
                  #{tag.name}
                </button>
              ))}

              {!exactExisting && !alreadyPending && (
                <button
                  type="button"
                  onClick={() => stagePending(trimmedSearch)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-brand-soft transition-colors flex items-center gap-2 border-t border-slate-100 text-emerald-800 font-medium"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Stage <span className="text-emerald-900">#{trimmedSearch}</span>
                  <span className="ml-auto text-[10px] text-emerald-700 opacity-80">creates on save</span>
                </button>
              )}
              {alreadyPending && (
                <p className="px-3 py-2 text-xs text-slate-500 border-t border-slate-100">
                  &ldquo;{trimmedSearch}&rdquo; is already staged.
                </p>
              )}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-1">
            Press <kbd className="rounded border border-slate-200 bg-slate-50 px-1 font-mono text-[10px]">Enter</kbd> to stage. Tags are written to Strapi only when you save.
          </p>
        </div>
      )}
    </div>
  );
}
