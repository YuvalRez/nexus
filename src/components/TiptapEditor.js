"use client";

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import Focus from '@tiptap/extension-focus';

export default function TiptapEditor({ initialContent, onChange, isEditable = true }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Markdown,
      Focus.configure({
        className: 'has-focus',
        mode: 'all',
      }),
    ],
    content: initialContent,
    editable: isEditable,
    onUpdate: ({ editor }) => {
      if (onChange) {
        const markdown = editor.storage.markdown.getMarkdown();
        onChange(markdown);
      }
    },
    editorProps: {
      attributes: {
        class: 'prose prose-invert lg:prose-lg max-w-none focus:outline-none min-h-[500px]',
      },
    },
  });

  if (!editor) {
    return null;
  }

  return (
    <div className="w-full">
      <EditorContent editor={editor} />
    </div>
  );
}
