'use client';

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import type { Editor, Range } from '@tiptap/react';
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code2,
  Minus,
  Type,
  CheckSquare,
} from 'lucide-react';

export interface SlashItem {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  command: (ctx: { editor: Editor; range: Range }) => void;
  keywords?: string[];
}

export const SLASH_ITEMS: SlashItem[] = [
  {
    title: 'Text',
    description: 'Plain paragraph',
    icon: Type,
    keywords: ['p', 'paragraph', 'text'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode('paragraph').run(),
  },
  {
    title: 'Heading 1',
    description: 'Big section heading',
    icon: Heading1,
    keywords: ['h1', 'title'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run(),
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    icon: Heading2,
    keywords: ['h2', 'subtitle'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run(),
  },
  {
    title: 'Heading 3',
    description: 'Small section heading',
    icon: Heading3,
    keywords: ['h3'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run(),
  },
  {
    title: 'Bullet List',
    description: 'Create a simple bullet list',
    icon: List,
    keywords: ['ul', 'bullet', 'list'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: 'Numbered List',
    description: 'Ordered 1-2-3 list',
    icon: ListOrdered,
    keywords: ['ol', 'ordered', 'numbered'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: 'Task List',
    description: 'Checkable todo items',
    icon: CheckSquare,
    keywords: ['todo', 'task', 'check'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleTaskList?.().run(),
  },
  {
    title: 'Quote',
    description: 'Capture a quote',
    icon: Quote,
    keywords: ['blockquote', 'quote'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    title: 'Code Block',
    description: 'Syntax-highlighted code',
    icon: Code2,
    keywords: ['code', 'snippet', 'pre'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    title: 'Divider',
    description: 'Horizontal rule',
    icon: Minus,
    keywords: ['hr', 'divider', 'rule', 'separator'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
];

export interface SlashMenuListHandle {
  onKeyDown: (e: KeyboardEvent) => boolean;
}

interface Props {
  items: SlashItem[];
  command: (item: SlashItem) => void;
}

const SlashMenuList = forwardRef<SlashMenuListHandle, Props>(({ items, command }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => setSelectedIndex(0), [items]);

  const select = (index: number) => {
    const item = items[index];
    if (item) command(item);
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((i) => (i + items.length - 1) % items.length);
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((i) => (i + 1) % items.length);
        return true;
      }
      if (event.key === 'Enter') {
        select(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div className="w-72 rounded-lg border border-slate-200 bg-white shadow-lg p-3 text-sm text-muted-foreground">
        No results
      </div>
    );
  }

  return (
    <div className="w-72 max-h-80 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg p-1">
      {items.map((item, i) => {
        const Icon = item.icon;
        const active = i === selectedIndex;
        return (
          <button
            key={item.title}
            type="button"
            onMouseEnter={() => setSelectedIndex(i)}
            onClick={() => select(i)}
            className={`w-full flex items-start gap-3 px-2 py-1.5 text-left rounded-md transition-colors ${
              active ? 'bg-brand-soft' : 'hover:bg-slate-50'
            }`}
          >
            <div className="h-8 w-8 flex items-center justify-center rounded-md border border-slate-200 bg-white flex-shrink-0">
              <Icon className="h-4 w-4 text-slate-700" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium leading-tight text-slate-900">{item.title}</div>
              <div className="text-xs text-slate-500 truncate">{item.description}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
});

SlashMenuList.displayName = 'SlashMenuList';
export default SlashMenuList;
