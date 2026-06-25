"use client";

import React, { useEffect } from 'react';
import { Editor, rootCtx, defaultValueCtx, editorViewOptionsCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { gfm } from '@milkdown/preset-gfm';
import { history } from '@milkdown/plugin-history';
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { keymap } from 'prosemirror-keymap';
import { sinkListItem, liftListItem } from 'prosemirror-schema-list';
import { $prose, $remark } from '@milkdown/utils';
import remarkBreaks from 'remark-breaks';
import '@milkdown/theme-nord/style.css'; // Minimal default styling

const wikiLinkKey = new PluginKey('wikiLinkHideShow');

// Custom keymap for Tab, Shift-Tab, and Backspace
const tabKeymapPlugin = $prose(() => keymap({
  "Tab": (state, dispatch) => {
    // First, try to indent the list item if we are inside a list
    const listItemType = state.schema.nodes.listItem || state.schema.nodes.list_item;
    if (listItemType && sinkListItem(listItemType)(state, dispatch)) {
      return true;
    }

    // Otherwise, indent the entire block(s) from the start of the line
    if (dispatch) {
      let tr = state.tr;
      const { from, to } = state.selection;
      
      const blocksToIndent = [];
      state.doc.nodesBetween(from, to, (node, pos) => {
        if (node.isTextblock) {
          blocksToIndent.push({ node, pos });
        }
      });
      
      // Iterate backwards to not invalidate positions
      for (let i = blocksToIndent.length - 1; i >= 0; i--) {
        const { pos } = blocksToIndent[i];
        tr = tr.insertText("    ", pos + 1);
      }
      
      dispatch(tr.scrollIntoView());
    }
    return true; // Prevent default focus shift
  },
  "Shift-Tab": (state, dispatch) => {
    // First, try to outdent the list item if we are inside a nested list
    const listItemType = state.schema.nodes.listItem || state.schema.nodes.list_item;
    if (listItemType && liftListItem(listItemType)(state, dispatch)) {
      return true;
    }

    // Otherwise, outdent the entire block(s) from the start of the line
    if (dispatch) {
      let tr = state.tr;
      const { from, to } = state.selection;
      
      const blocksToOutdent = [];
      state.doc.nodesBetween(from, to, (node, pos) => {
        if (node.isTextblock) {
          blocksToOutdent.push({ node, pos });
        }
      });
      
      for (let i = blocksToOutdent.length - 1; i >= 0; i--) {
        const { node, pos } = blocksToOutdent[i];
        const text = node.textContent;
        const match = text.match(/^( {1,4})/);
        if (match) {
          tr = tr.delete(pos + 1, pos + 1 + match[1].length);
        }
      }
      
      dispatch(tr.scrollIntoView());
    }
    return true; // Prevent default focus shift
  },
  "Backspace": (state, dispatch) => {
    // Delete 4 spaces at once if they are exactly before the cursor
    const { $from, empty } = state.selection;
    if (empty) {
      const textBefore = $from.parent.textBetween(Math.max(0, $from.parentOffset - 4), $from.parentOffset);
      if (textBefore === "    ") {
        if (dispatch) {
          dispatch(state.tr.delete($from.pos - 4, $from.pos).scrollIntoView());
        }
        return true;
      }
    }
    return false; // Let default backspace handle everything else
  }
}));

const wikiLinkMilkdownPlugin = $prose(() => new Plugin({
  key: wikiLinkKey,
  state: {
    init(_, { doc }) {
      return { decos: buildDecorations(doc, null, false), isFocusedView: false };
    },
    apply(tr, old, oldState, newState) {
      let isFocusedView = old.isFocusedView;
      const meta = tr.getMeta(wikiLinkKey);
      if (meta !== undefined) {
        isFocusedView = meta;
      }
      return {
        decos: buildDecorations(newState.doc, newState.selection, isFocusedView),
        isFocusedView
      };
    }
  },
  props: {
    decorations(state) {
      return this.getState(state).decos;
    },
    handleDOMEvents: {
      focus: (view) => {
        view.dispatch(view.state.tr.setMeta(wikiLinkKey, true));
        return false;
      },
      blur: (view) => {
        view.dispatch(view.state.tr.setMeta(wikiLinkKey, false));
        return false;
      }
    }
  }
}));

function buildDecorations(doc, selection, isFocusedView) {
  const decorations = [];
  
  // Find the currently active block node to add a "has-focus" class for heading pseudo-elements
  if (isFocusedView && selection && selection.$from && selection.$from.depth > 0) {
    const $from = selection.$from;
    try {
      // Get the start position of the current block node
      const blockPos = $from.before($from.depth);
      // Add 'has-focus' class to the block node
      decorations.push(Decoration.node(blockPos, blockPos + $from.parent.nodeSize, { class: 'has-focus' }));
    } catch (e) {
      // Ignore if blockPos is invalid (e.g. at the very root)
    }
  }

  doc.descendants((node, pos) => {
    if (node.isText) {
      const text = node.text;
      // Match [[target|display]] or [[target]]
      const regex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
      let match;
      while ((match = regex.exec(text)) !== null) {
        const start = pos + match.index;
        const end = start + match[0].length;
        
        const targetText = match[1];
        const displayText = match[2];
        const hasPipe = displayText !== undefined;
        
        // If the selection is inside this wiki-link AND the editor is actively focused
        const isFocused = isFocusedView && selection && selection.from >= start && selection.to <= end;
        
        if (!isFocused) {
          // Hide [[
          decorations.push(Decoration.inline(start, start + 2, { class: 'wiki-bracket-hidden' }));
          
          if (hasPipe) {
            // Hide the target and the pipe (e.g., 'Jess Silver|')
            const targetStart = start + 2;
            const targetEnd = targetStart + targetText.length + 1; // +1 for the pipe '|'
            decorations.push(Decoration.inline(targetStart, targetEnd, { class: 'wiki-bracket-hidden' }));
            
            // Style the display text
            decorations.push(Decoration.inline(targetEnd, end - 2, { class: 'wiki-link-text' }));
          } else {
            // No pipe, style the whole inside text
            decorations.push(Decoration.inline(start + 2, end - 2, { class: 'wiki-link-text' }));
          }
          
          // Hide ]]
          decorations.push(Decoration.inline(end - 2, end, { class: 'wiki-bracket-hidden' }));
        } else {
          // Focused: Show everything normally
          decorations.push(Decoration.inline(start + 2, end - 2, { class: 'wiki-link-text' }));
        }
      }
    }
  });
  return DecorationSet.create(doc, decorations);
}

const breaksPlugin = $remark('remarkBreaks', () => remarkBreaks);

import { replaceAll } from '@milkdown/utils';
import { editorViewCtx } from '@milkdown/core';

const remoteCursorKey = new PluginKey('remoteCursor');

const remoteCursorMilkdownPlugin = $prose(() => new Plugin({
  key: remoteCursorKey,
  state: {
    init() { return DecorationSet.empty; },
    apply(tr, oldSet, oldState, newState) {
      const cursorData = tr.getMeta(remoteCursorKey);
      if (cursorData === undefined) {
        return oldSet.map(tr.mapping, tr.doc);
      }
      if (cursorData === null) {
        return DecorationSet.empty;
      }
      
      const { from, user } = cursorData;
      // create a widget
      const widget = document.createElement('span');
      widget.className = 'collaborative-cursor';
      widget.setAttribute('data-user', user || 'Owner');
      
      // Ensure the position is valid within the document
      const safeFrom = Math.min(from, newState.doc.content.size);
      
      const deco = Decoration.widget(safeFrom, widget, { side: 1 });
      return DecorationSet.create(newState.doc, [deco]);
    }
  },
  props: {
    decorations(state) {
      return this.getState(state);
    }
  }
}));

const selectionBroadcastKey = new PluginKey('selectionBroadcast');
let onSelectionChangeRef = null;

const selectionBroadcastPlugin = $prose(() => new Plugin({
  key: selectionBroadcastKey,
  view() {
    return {
      update(view, prevState) {
        if (prevState && !prevState.selection.eq(view.state.selection)) {
          if (onSelectionChangeRef) {
            onSelectionChangeRef({
              from: view.state.selection.from,
              to: view.state.selection.to
            });
          }
        }
      }
    };
  }
}));

const MilkdownEditorContent = ({ initialContent, onChange, isEditable, onSelectionChange, remoteCursor }) => {
  useEffect(() => {
    onSelectionChangeRef = onSelectionChange;
  }, [onSelectionChange]);

  const { get, editor } = useEditor((root) => {
    return Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, initialContent);
        
        ctx.set(editorViewOptionsCtx, {
          editable: () => isEditable,
          attributes: { spellcheck: 'false' }
        });

        ctx.get(listenerCtx).markdownUpdated((ctx, markdown, prevMarkdown) => {
          if (markdown !== prevMarkdown && onChange) {
            onChange(markdown);
          }
        });
      })
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(listener)
      .use(breaksPlugin)
      .use(tabKeymapPlugin)
      .use(wikiLinkMilkdownPlugin)
      .use(remoteCursorMilkdownPlugin)
      .use(selectionBroadcastPlugin);
  }, [isEditable]); // Rebuild if isEditable changes

  // Inject remote cursor into the engine dynamically without rebuilding
  useEffect(() => {
    const editorInstance = get();
    if (editorInstance && editorInstance.action) {
      editorInstance.action((ctx) => {
        try {
          const view = ctx.get(editorViewCtx);
          view.dispatch(view.state.tr.setMeta(remoteCursorKey, remoteCursor || null));
        } catch (e) {
          // View might not be ready
        }
      });
    }
  }, [remoteCursor, get]);

  return <Milkdown />;
};

export default function MilkdownEditor({ initialContent, onChange, isEditable = true, onSelectionChange, remoteCursor }) {
  return (
    <div className="prose prose-invert max-w-none w-full outline-none focus:outline-none min-h-[500px] flex-1 flex flex-col milkdown-container">
      <MilkdownProvider>
        <MilkdownEditorContent 
          initialContent={initialContent} 
          onChange={onChange} 
          isEditable={isEditable} 
          onSelectionChange={onSelectionChange}
          remoteCursor={remoteCursor}
        />
      </MilkdownProvider>
    </div>
  );
}
