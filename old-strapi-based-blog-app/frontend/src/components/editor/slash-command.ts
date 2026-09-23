/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { Extension, type Range } from '@tiptap/react';
import Suggestion from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import tippy, { type Instance as TippyInstance } from 'tippy.js';
import SlashMenuList, { SLASH_ITEMS, type SlashItem, type SlashMenuListHandle } from './SlashMenuList';

const SlashCommand = Extension.create({
  name: 'slash-command',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        startOfLine: false,
        allowSpaces: false,
        command: ({ editor, range, props }: { editor: any; range: Range; props: SlashItem }) => {
          props.command({ editor, range });
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,

        items: ({ query }: { query: string }) => {
          if (!query) return SLASH_ITEMS;
          const q = query.toLowerCase();
          return SLASH_ITEMS.filter((item) => {
            if (item.title.toLowerCase().includes(q)) return true;
            return item.keywords?.some((kw) => kw.includes(q));
          });
        },

        render: () => {
          let component: ReactRenderer<SlashMenuListHandle> | null = null;
          let popup: TippyInstance[] | null = null;

          return {
            onStart: (props: any) => {
              component = new ReactRenderer(SlashMenuList, {
                props,
                editor: props.editor,
              });

              if (!props.clientRect) return;

              popup = tippy('body', {
                getReferenceClientRect: props.clientRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
                offset: [0, 8],
                // No theme — we strip Tippy's default border/background in
                // globals.css so only our SlashMenuList card is visible.
                arrow: false,
              });
            },

            onUpdate: (props: any) => {
              component?.updateProps(props);
              if (!props.clientRect || !popup) return;
              popup[0].setProps({ getReferenceClientRect: props.clientRect });
            },

            onKeyDown: (props: any) => {
              if (props.event.key === 'Escape') {
                popup?.[0].hide();
                return true;
              }
              return component?.ref?.onKeyDown(props.event) ?? false;
            },

            onExit: () => {
              popup?.[0].destroy();
              component?.destroy();
              popup = null;
              component = null;
            },
          };
        },
      } as any),
    ];
  },
});

export default SlashCommand;
