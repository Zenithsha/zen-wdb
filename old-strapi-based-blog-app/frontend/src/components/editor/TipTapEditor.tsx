'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import ImageExtension from '@tiptap/extension-image';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import Link from '@tiptap/extension-link';
import { createLowlight } from 'lowlight';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import css from 'highlight.js/lib/languages/css';
import python from 'highlight.js/lib/languages/python';
import bash from 'highlight.js/lib/languages/bash';
import SlashCommand from './slash-command';
import { Bold, Italic, Strikethrough, Code, Link2 } from 'lucide-react';
import 'tippy.js/dist/tippy.css';
import 'tippy.js/themes/light.css';
import './notion-editor.css';

const lowlight = createLowlight();
lowlight.register('javascript', javascript);
lowlight.register('js', javascript);
lowlight.register('typescript', typescript);
lowlight.register('ts', typescript);
lowlight.register('css', css);
lowlight.register('python', python);
lowlight.register('bash', bash);
lowlight.register('sh', bash);

interface Props {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
}

export default function TipTapEditor({ content, onChange, placeholder, minHeight = '500px' }: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      ImageExtension.configure({ allowBase64: false, inline: false }),
      CodeBlockLowlight.configure({ lowlight, defaultLanguage: 'javascript' }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === 'heading') return `Heading ${node.attrs.level}`;
          return placeholder || "Type  '/'  for commands, or just start writing...";
        },
        includeChildren: true,
      }),
      CharacterCount,
      Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true }),
      SlashCommand,
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'notion-editor prose prose-slate max-w-none focus:outline-none',
      },
    },
  });

  if (!editor) {
    return (
      <div className="rounded-lg" style={{ minHeight }}>
        <div className="p-6 text-muted-foreground text-sm">Loading editor...</div>
      </div>
    );
  }

  const wordCount = editor.storage.characterCount.words();
  const charCount = editor.storage.characterCount.characters();

  const promptLink = () => {
    const current = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Paste link URL', current || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  };

  // Clicking anywhere in the editor wrapper — including the surrounding
  // padding — focuses the editor and places the cursor at the end of the
  // document. Clicks landing INSIDE the actual prose content keep TipTap's
  // default behaviour (cursor lands where the user clicked).
  const onWrapperClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.ProseMirror')) {
      editor.chain().focus('end').run();
    }
  };

  return (
    <div className="relative">
      <div onClick={onWrapperClick} className="cursor-text">
        <EditorContent
          editor={editor}
          style={{ minHeight }}
          className="py-8 px-2"
        />
      </div>

      {editor && (
        <BubbleMenu
          editor={editor}
          options={{ placement: 'top' }}
          className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
        >
          <BubbleButton active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} label="Bold">
            <Bold className="h-4 w-4" />
          </BubbleButton>
          <BubbleButton active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} label="Italic">
            <Italic className="h-4 w-4" />
          </BubbleButton>
          <BubbleButton active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} label="Strike">
            <Strikethrough className="h-4 w-4" />
          </BubbleButton>
          <BubbleButton active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()} label="Inline code">
            <Code className="h-4 w-4" />
          </BubbleButton>
          <div className="w-px h-5 bg-slate-200 mx-1" />
          <BubbleButton active={editor.isActive('link')} onClick={promptLink} label="Link">
            <Link2 className="h-4 w-4" />
          </BubbleButton>
          <div className="w-px h-5 bg-slate-200 mx-1" />
          <TextStyleDropdown editor={editor} />
        </BubbleMenu>
      )}

      <div className="flex justify-end gap-4 px-2 pt-3 pb-1 text-xs text-muted-foreground border-t border-slate-100 mt-4">
        <span>{wordCount} words</span>
        <span>{charCount} characters</span>
        <span>~{Math.max(1, Math.ceil(wordCount / 200))} min read</span>
      </div>
    </div>
  );
}



function BubbleButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={`h-7 w-7 inline-flex items-center justify-center rounded-md transition-colors ${
        active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  );
}

function TextStyleDropdown({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;
  const current =
    editor.isActive('heading', { level: 1 }) ? 'H1' :
    editor.isActive('heading', { level: 2 }) ? 'H2' :
    editor.isActive('heading', { level: 3 }) ? 'H3' :
    editor.isActive('bulletList') ? '• List' :
    editor.isActive('orderedList') ? '1. List' :
    editor.isActive('blockquote') ? 'Quote' :
    'Text';

  return (
    <select
      value={current}
      onChange={(e) => {
        const v = e.target.value;
        const chain = editor.chain().focus();
        if (v === 'Text') chain.setParagraph().run();
        else if (v === 'H1') chain.toggleHeading({ level: 1 }).run();
        else if (v === 'H2') chain.toggleHeading({ level: 2 }).run();
        else if (v === 'H3') chain.toggleHeading({ level: 3 }).run();
        else if (v === '• List') chain.toggleBulletList().run();
        else if (v === '1. List') chain.toggleOrderedList().run();
        else if (v === 'Quote') chain.toggleBlockquote().run();
      }}
      className="text-xs bg-transparent text-slate-700 rounded-md px-1.5 py-1 hover:bg-slate-100 outline-none cursor-pointer"
    >
      <option>Text</option>
      <option>H1</option>
      <option>H2</option>
      <option>H3</option>
      <option>• List</option>
      <option>1. List</option>
      <option>Quote</option>
    </select>
  );
}
