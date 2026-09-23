interface Props {
  content: string;
}

/**
 * Renders article HTML with Tailwind Typography (`prose`) and explicit
 * overrides that fix two readability bugs:
 *   - `prose-pre:bg-muted` previously made code blocks near-invisible
 *     (muted is light grey on a light grey ambient backdrop).
 *   - `prose-code` for inline code had no foreground colour set, so the
 *     text inherited the prose body colour over a near-white background.
 *
 * Now: code blocks are dark slate with light text + brand-tinted left rail;
 * inline code is brand-soft with bold dark-emerald text.
 */
export default function ArticleContent({ content }: Props) {
  return (
    <div
      className="prose prose-slate prose-lg max-w-none dark:prose-invert
        prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-slate-900
        prose-p:text-slate-700 prose-p:leading-relaxed
        prose-li:text-slate-700
        prose-strong:text-slate-900
        prose-a:text-brand prose-a:no-underline prose-a:font-medium hover:prose-a:underline
        prose-blockquote:border-l-brand prose-blockquote:bg-brand-soft/40 prose-blockquote:px-5 prose-blockquote:py-1 prose-blockquote:rounded-r-md prose-blockquote:not-italic prose-blockquote:text-slate-700

        /* Inline code: brand-soft pill with strong contrast */
        prose-code:bg-brand-soft prose-code:text-emerald-900 prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:font-medium prose-code:before:hidden prose-code:after:hidden

        /* Code blocks: dark terminal-style with brand left rail */
        prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:rounded-xl prose-pre:border prose-pre:border-slate-800 prose-pre:shadow-lg prose-pre:p-5 prose-pre:overflow-x-auto prose-pre:border-l-4 prose-pre:border-l-brand
        [&_pre_code]:bg-transparent [&_pre_code]:text-slate-100 [&_pre_code]:p-0 [&_pre_code]:text-sm [&_pre_code]:font-mono

        prose-img:rounded-xl prose-img:shadow-md prose-img:border prose-img:border-slate-200

        prose-hr:border-slate-200
      "
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
