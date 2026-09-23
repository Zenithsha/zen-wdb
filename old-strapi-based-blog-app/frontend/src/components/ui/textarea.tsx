import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Textarea — forwards its ref to the underlying `<textarea>` element so
 * callers can read `selectionStart`, call `focus()`, etc. Previously this
 * was a plain function component that swallowed refs, which silently
 * broke any feature relying on direct DOM access (e.g. the comment
 * @mention picker couldn't insert because `textareaRef.current` was
 * always null).
 */
const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        data-slot="textarea"
        className={cn(
          "flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
          className
        )}
        {...props}
      />
    )
  }
);

export { Textarea }
