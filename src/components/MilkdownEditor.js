"use client";

import React, { useEffect } from 'react';
import { Editor, rootCtx, defaultValueCtx, editorViewOptionsCtx } from '@milkdown/core';
import { 
  commonmark, 
  strongAttr, strongSchema, strongInputRule, strongKeymap, toggleStrongCommand,
  emphasisAttr, emphasisSchema, emphasisStarInputRule, emphasisUnderscoreInputRule, emphasisKeymap, toggleEmphasisCommand,
  bulletListAttr, bulletListSchema, wrapInBulletListInputRule, bulletListKeymap, wrapInBulletListCommand,
  orderedListAttr, orderedListSchema, wrapInOrderedListInputRule, orderedListKeymap, wrapInOrderedListCommand,
  listItemAttr, listItemSchema, listItemKeymap, splitListItemCommand, sinkListItemCommand, liftListItemCommand, liftFirstListItemCommand
} from '@milkdown/preset-commonmark';
import { 
  gfm, 
  extendListItemSchemaForTask, wrapInTaskListInputRule
} from '@milkdown/preset-gfm';
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

const taskListKey = new PluginKey('customTaskList');

const taskListMilkdownPlugin = $prose(() => new Plugin({
  key: taskListKey,
  state: {
    init(_, { doc }) {
      return { decos: buildTaskDecorations(doc, null, false), isFocusedView: false };
    },
    apply(tr, old, oldState, newState) {
      let isFocusedView = old.isFocusedView;
      const meta = tr.getMeta(taskListKey);
      if (meta !== undefined) {
        isFocusedView = meta;
      }
      return {
        decos: buildTaskDecorations(newState.doc, newState.selection, isFocusedView),
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
        view.dispatch(view.state.tr.setMeta(taskListKey, true));
        return false;
      },
      blur: (view) => {
        view.dispatch(view.state.tr.setMeta(taskListKey, false));
        return false;
      },
      mousedown: (view, event) => {
        if (event.target.classList.contains('custom-task-checkbox')) {
          event.preventDefault();
          const pos = Number(event.target.getAttribute('data-pos'));
          const matchText = event.target.getAttribute('data-match');
          const wasChecked = event.target.getAttribute('data-checked') === 'true';
          
          const newText = wasChecked 
            ? matchText.replace(/\[[xX]\]/, '[ ]') 
            : matchText.replace(/\[ \]/, '[x]');
            
          view.dispatch(view.state.tr.replaceWith(pos, pos + matchText.length, view.state.schema.text(newText)));
          return true;
        }
        return false;
      }
    }
  }
}));

const bulletListKey = new PluginKey('customBulletList');

const bulletListMilkdownPlugin = $prose(() => new Plugin({
  key: bulletListKey,
  state: {
    init(_, { doc }) {
      return { decos: buildBulletDecorations(doc, null, false), isFocusedView: false };
    },
    apply(tr, old, oldState, newState) {
      let isFocusedView = old.isFocusedView;
      const meta = tr.getMeta(bulletListKey);
      if (meta !== undefined) {
        isFocusedView = meta;
      }
      return {
        decos: buildBulletDecorations(newState.doc, newState.selection, isFocusedView),
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
        view.dispatch(view.state.tr.setMeta(bulletListKey, true));
        return false;
      },
      blur: (view) => {
        view.dispatch(view.state.tr.setMeta(bulletListKey, false));
        return false;
      }
    }
  }
}));

function buildBulletDecorations(doc, selection, isFocusedView) {
  const decorations = [];
  
  doc.descendants((node, pos) => {
    if (node.isTextblock) {
      const text = node.textContent;
      
      const match = text.match(/^(\u200B?[ \t]*)([-*]\s)/);
      if (match) {
        if (text.match(/^(\u200B?[ \t]*)([-*]\s)\[( |x|X)\]\s/)) return;

        const spacesLen = match[1].length;
        const startPos = pos + 1 + spacesLen;
        const matchText = match[2];
        const matchLen = matchText.length;
        
        const isFocused = isFocusedView && selection && 
          ((selection.from >= startPos && selection.from <= startPos + matchLen - 1) || 
           (selection.to >= startPos && selection.to <= startPos + matchLen - 1));
           
        if (!isFocused) {
          decorations.push(Decoration.inline(startPos, startPos + matchLen - 1, { class: 'bullet-markdown-hidden' }));
          
          const widget = document.createElement('span');
          widget.className = 'custom-bullet-widget';
          decorations.push(Decoration.widget(startPos, widget));
          
          decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: 'bullet-list-paragraph' }));
        }
      }
    }
  });
  
  return DecorationSet.create(doc, decorations);
}

function buildTaskDecorations(doc, selection, isFocusedView) {
  const decorations = [];
  
  doc.descendants((node, pos) => {
    if (node.isTextblock) {
      const text = node.textContent;
      const match = text.match(/^(\u200B?[ \t]*)([-*]\s)?\[( |x|X)\]\s/);
      
      if (match) {
        const spacesLen = match[1].length;
        const startPos = pos + 1 + spacesLen;
        const matchText = match[0].substring(spacesLen);
        const matchLen = matchText.length;
        const isChecked = match[3] === 'x' || match[3] === 'X';
        
        const isFocused = isFocusedView && selection && 
          ((selection.from >= startPos && selection.from <= startPos + matchLen - 1) || 
           (selection.to >= startPos && selection.to <= startPos + matchLen - 1));
           
        if (!isFocused) {
          decorations.push(Decoration.inline(startPos, startPos + matchLen - 1, { class: 'task-markdown-hidden' }));
          
          const widget = document.createElement('input');
          widget.type = 'checkbox';
          widget.checked = isChecked;
          widget.className = 'custom-task-checkbox';
          widget.setAttribute('data-pos', startPos);
          widget.setAttribute('data-match', matchText);
          widget.setAttribute('data-checked', isChecked ? 'true' : 'false');
          
          decorations.push(Decoration.widget(startPos, widget));
          
          if (isChecked && node.nodeSize > matchLen + spacesLen + 1) {
             decorations.push(Decoration.inline(startPos + matchLen, pos + node.nodeSize - 1, { class: 'task-done-strikethrough' }));
          }
          
          decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: 'task-list-paragraph' }));
        }
      }
    }
  });
  
  return DecorationSet.create(doc, decorations);
}

const wikiLinkKey = new PluginKey('wikiLinkHideShow');

// Custom keymap for Tab, Shift-Tab, and Backspace
const tabKeymapPlugin = $prose(() => keymap({
  "Enter": (state, dispatch) => {
    const { $from, empty } = state.selection;
    if (!empty) return false;
    
    if ($from.parent.type.isTextblock) {
      const text = $from.parent.textContent;
      const textBeforeCursor = text.substring(0, $from.parentOffset);
      const textAfterCursor = text.substring($from.parentOffset);
      
      const bulletMatch = textBeforeCursor.match(/^(\u200B?[ \t]*)([-*]\s)$/);
      const taskMatch = textBeforeCursor.match(/^(\u200B?[ \t]*)([-*]\s\[(?: |x|X)\]\s)$/);
      const match = taskMatch || bulletMatch;
      
      if (match) {
        if (textAfterCursor.trim().length === 0) {
          if (dispatch) {
            const tr = state.tr;
            tr.delete($from.pos - $from.parentOffset, $from.pos);
            dispatch(tr.scrollIntoView());
          }
          return true;
        }
      }
      
      const anyBulletMatch = textBeforeCursor.match(/^(\u200B?[ \t]*)([-*]\s(?:\[(?: |x|X)\]\s)?)/);
      if (anyBulletMatch) {
         if (dispatch) {
           let prefix = anyBulletMatch[0];
           prefix = prefix.replace(/\[[xX]\]/, '[ ]');
           
           const tr = state.tr;
           tr.split($from.pos);
           const newPos = tr.mapping.map($from.pos);
           tr.insertText(prefix, newPos);
           
           const resolvedNewPos = tr.doc.resolve(newPos + prefix.length);
           tr.setSelection(state.selection.constructor.near(resolvedNewPos));
           dispatch(tr.scrollIntoView());
         }
         return true;
      }
    }
    return false;
  },
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
      
      const processRegex = (regex, customClass, bracketLength) => {
        let match;
        while ((match = regex.exec(text)) !== null) {
          const start = pos + match.index;
          const end = start + match[0].length;
          const isFocused = isFocusedView && selection && 
            ((selection.from >= start && selection.from <= end) || 
             (selection.to >= start && selection.to <= end));
             
          if (!isFocused) {
            decorations.push(Decoration.inline(start, start + bracketLength, { class: 'wiki-bracket-hidden' }));
            decorations.push(Decoration.inline(start + bracketLength, end - bracketLength, { class: customClass }));
            decorations.push(Decoration.inline(end - bracketLength, end, { class: 'wiki-bracket-hidden' }));
          } else {
            decorations.push(Decoration.inline(start + bracketLength, end - bracketLength, { class: customClass }));
          }
        }
      };

      // Match **word** or __word__
      const boldRegex = /(?:\*\*|__)(.*?)(?:\*\*|__)/g;
      processRegex(boldRegex, 'custom-bold', 2);
      
      // Match *word* or _word_ (ensuring we don't match the inside of **word**)
      const italicRegex = /(?<!\*)\*([^*]+)\*(?!\*)|(?<!_)_([^_]+)_(?!_)/g;
      processRegex(italicRegex, 'custom-italic', 1);

      // Match [[target|display]] or [[target]]
      const regex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
      let match;
      while ((match = regex.exec(text)) !== null) {
        const start = pos + match.index;
        const end = start + match[0].length;
        
        const targetText = match[1];
        const displayText = match[2];
        const hasPipe = displayText !== undefined;
        
        const isFocused = isFocusedView && selection && selection.from >= start && selection.to <= end;
        
        if (!isFocused) {
          decorations.push(Decoration.inline(start, start + 2, { class: 'wiki-bracket-hidden' }));
          
          if (hasPipe) {
            const targetStart = start + 2;
            const targetEnd = targetStart + targetText.length + 1;
            decorations.push(Decoration.inline(targetStart, targetEnd, { class: 'wiki-bracket-hidden' }));
            decorations.push(Decoration.inline(targetEnd, end - 2, { class: 'wiki-link-text' }));
          } else {
            decorations.push(Decoration.inline(start + 2, end - 2, { class: 'wiki-link-text' }));
          }
          
          decorations.push(Decoration.inline(end - 2, end, { class: 'wiki-bracket-hidden' }));
        } else {
          decorations.push(Decoration.inline(start + 2, end - 2, { class: 'wiki-link-text' }));
        }
      }
    }
  });

  // Removed second pass block-level mark checking
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

const indentGuideKey = new PluginKey('indentGuide');

const indentGuidePlugin = $prose(() => new Plugin({
  key: indentGuideKey,
  state: {
    init(_, { doc }) {
      return buildIndentDecorations(doc);
    },
    apply(tr, old, oldState, newState) {
      if (!tr.docChanged) return old;
      return buildIndentDecorations(newState.doc);
    }
  },
  props: {
    decorations(state) {
      return this.getState(state);
    }
  }
}));

function buildIndentDecorations(doc) {
  const decorations = [];
  doc.descendants((node, pos) => {
    if (node.isTextblock) {
      const text = node.textContent;
      const match = text.match(/^\u200B([ \t]+)/);
      if (match) {
        const spaceCount = match[1].replace(/\t/g, '    ').length;
        const level = Math.floor(spaceCount / 2); // 2 spaces per level, assuming standard Obsidian behavior
        
        // Hide the zero-width space and actual spaces so they don't break the layout
        decorations.push(Decoration.inline(pos + 1, pos + 1 + match[0].length, {
          class: 'hidden-indent'
        }));
        
        // Add padding to the paragraph to provide visual indentation
        decorations.push(Decoration.node(pos, pos + node.nodeSize, {
          style: `padding-left: ${level * 1.5}rem;`,
          class: 'space-indented-paragraph'
        }));
        
        // Add vertical lines
        for (let i = 1; i <= level; i++) {
          const widget = document.createElement('span');
          widget.className = 'indent-guide-line';
          widget.style.left = `${(i - 0.5) * 1.5}rem`; // Center the line in the padding step
          decorations.push(Decoration.widget(pos + 1, widget));
        }
      }
    }
  });
  return DecorationSet.create(doc, decorations);
}

const selectionBroadcastKey = new PluginKey('selectionBroadcast');
let onSelectionChangeRef = null;

const selectionBroadcastPlugin = $prose(() => new Plugin({
  key: selectionBroadcastKey,
  view() {
    return {
      update(view, prevState) {
        if (prevState && !prevState.selection.eq(view.state.selection)) {
          if (view.hasFocus() && onSelectionChangeRef) {
            onSelectionChangeRef({
              from: view.state.selection.from,
              to: view.state.selection.to
            });
          }
        }
      }
    };
  },
  props: {
    handleDOMEvents: {
      blur(view) {
        if (onSelectionChangeRef) {
          onSelectionChangeRef(null);
        }
        return false;
      },
      focus(view) {
        if (onSelectionChangeRef) {
          onSelectionChangeRef({
            from: view.state.selection.from,
            to: view.state.selection.to
          });
        }
        return false;
      }
    }
  }
}));

function preserveIndentationAndSyntax(markdown) {
  if (!markdown) return markdown;
  let lines = markdown.split('\n');
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    const match = line.match(/^([ \t]+)(.*)/);
    if (match) {
      const spaces = match[1].replace(/\t/g, '    ');
      line = '\u200B' + spaces + match[2];
    }
    
    let newLine = '';
    for (let j = 0; j < line.length; j++) {
      if ((line[j] === '*' || line[j] === '_') && (line[j+1] === ' ' || line[j+1] === '\t')) {
        const prefix = line.slice(0, j);
        if (prefix.trim() === '' || prefix.trim() === '\u200B') {
          newLine += line[j];
          continue;
        }
      }
      
      if (line[j] === '*' || line[j] === '_') {
        newLine += '\\' + line[j];
      } else {
        newLine += line[j];
      }
    }
    lines[i] = newLine;
    
    const listMatch = lines[i].match(/^(\u200B?[ \t]*)([-*])\s(.*)/);
    if (listMatch) {
       lines[i] = `${listMatch[1]}\\${listMatch[2]} ${listMatch[3]}`;
       
       if (i > 0 && lines[i-1].trim() !== '') {
          lines.splice(i, 0, '');
          i++; // Skip the newly inserted blank line
       }
    }
  }
  return lines.join('\n');
}

function preserveSoftBreaks(markdown) {
  if (!markdown) return markdown;
  const lines = markdown.split('\n');
  let inCodeBlock = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    
    if (!inCodeBlock) {
      // If line is not empty and doesn't already have a valid Markdown hard break
      if (line.length > 0 && !line.endsWith('  ') && !line.endsWith('<br>') && !line.endsWith('\\')) {
        if (i + 1 < lines.length) {
          const nextTrimmed = lines[i + 1].trim();
          // If next line is a paragraph continuation (not empty, not a list item, etc.)
          if (nextTrimmed.length > 0 && 
              !nextTrimmed.startsWith('- ') && 
              !nextTrimmed.startsWith('* ') && 
              !nextTrimmed.match(/^\d+\.\s/)) {
            lines[i] = line + '  ';
          }
        }
      }
    }
  }
  return lines.join('\n');
}

const MilkdownEditorContent = ({ initialContent, onChange, isEditable, onSelectionChange, remoteCursor }) => {
  useEffect(() => {
    onSelectionChangeRef = onSelectionChange;
  }, [onSelectionChange]);

  const { get, editor } = useEditor((root) => {
    console.log("Commonmark plugins:", commonmark.map(p => p.id || (p.meta && p.meta.id) || p.name || typeof p));
    return Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, preserveSoftBreaks(preserveIndentationAndSyntax(initialContent)));
        
        ctx.set(editorViewOptionsCtx, {
          editable: () => isEditable,
          attributes: { spellcheck: 'false' },
          transformPastedHTML: (html) => {
            try {
              const parser = new DOMParser();
              const doc = parser.parseFromString(html, 'text/html');
              
              const replaceNode = (node, prefix, suffix) => {
                const textNode = doc.createTextNode(prefix + node.textContent + suffix);
                node.parentNode.replaceChild(textNode, node);
              };

              const bolds = Array.from(doc.querySelectorAll('strong, b, .cm-strong'));
              bolds.forEach(node => replaceNode(node, '**', '**'));

              const italics = Array.from(doc.querySelectorAll('em, i, .cm-em'));
              italics.forEach(node => replaceNode(node, '*', '*'));

              const links = Array.from(doc.querySelectorAll('a, .internal-link, .cm-hmd-internal-link'));
              links.forEach(node => {
                if (node.tagName.toLowerCase() === 'a') {
                  const href = node.getAttribute('href');
                  if (node.classList.contains('internal-link') || (href && !href.startsWith('http') && !href.startsWith('mailto:'))) {
                     const displayText = node.textContent;
                     let target = href ? decodeURIComponent(href).replace(/^\//, '') : displayText;
                     if (target.startsWith('app://')) target = displayText;
                     
                     if (target === displayText) {
                       replaceNode(node, '[[', ']]');
                     } else {
                       replaceNode(node, `[[${target}|`, ']]');
                     }
                  }
                } else if (node.tagName.toLowerCase() === 'span') {
                  // It's a CodeMirror span from Obsidian Edit Mode, just let its text content flow through
                  // But we can strip the span itself
                  const fragment = document.createDocumentFragment();
                  while (node.firstChild) {
                    fragment.appendChild(node.firstChild);
                  }
                  node.parentNode.replaceChild(fragment, node);
                }
              });

              return doc.body.innerHTML;
            } catch (e) {
              return html;
            }
          }
        });

        ctx.get(listenerCtx).markdownUpdated((ctx, markdown, prevMarkdown) => {
          if (markdown !== prevMarkdown && onChange) {
            let cleanMarkdown = markdown.replace(/^\u200B/gm, '');
            cleanMarkdown = cleanMarkdown.replace(/\\\*/g, '*').replace(/\\_/g, '_');
            onChange(cleanMarkdown);
          }
        });
      })
      .use(commonmark.filter(plugin => {
        return plugin !== strongAttr && plugin !== strongSchema && plugin !== strongInputRule && plugin !== strongKeymap && plugin !== toggleStrongCommand &&
               plugin !== emphasisAttr && plugin !== emphasisSchema && plugin !== emphasisStarInputRule && plugin !== emphasisUnderscoreInputRule && plugin !== emphasisKeymap && plugin !== toggleEmphasisCommand &&
               plugin !== wrapInBulletListInputRule &&
               plugin !== wrapInOrderedListInputRule;
      }))
      .use(gfm.filter(plugin => {
        return plugin !== wrapInTaskListInputRule;
      }))
      .use(history)
      .use(listener)
      .use(tabKeymapPlugin)
      .use(wikiLinkMilkdownPlugin)
      .use(bulletListMilkdownPlugin)
      .use(taskListMilkdownPlugin)
      .use(remoteCursorMilkdownPlugin)
      .use(indentGuidePlugin)
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
