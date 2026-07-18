"use client";

import { EditorContent, useEditor, type Editor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

/**
 * Tiptap editor for richTextDoc fields (spec §3: Tiptap JSON stored,
 * rendered server-side). The toolbar covers the node set the site renderer
 * supports: headings, bold/italic, lists, blockquote, links.
 */

function ToolbarButton({
  onClick,
  active,
  children,
  title,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(event) => event.preventDefault()} // keep editor focus
      onClick={onClick}
      className={
        active
          ? "rounded bg-accent px-2 py-1 text-xs font-semibold text-accent-contrast"
          : "rounded px-2 py-1 text-xs font-semibold text-muted hover:bg-surface-alt hover:text-primary"
      }
    >
      {children}
    </button>
  );
}

function setLink(editor: Editor) {
  const previous = editor.getAttributes("link").href as string | undefined;
  const href = window.prompt("Link URL", previous ?? "https://");
  if (href === null) return;
  if (href === "") {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }
  editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
}

export function RichTextField({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (doc: JSONContent) => void;
}) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } })],
    content: (value as JSONContent) ?? { type: "doc", content: [] },
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
    editorProps: {
      attributes: {
        class:
          "min-h-36 rounded-b-btn bg-surface px-3 py-2 text-sm outline-none [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-bold [&_h3]:text-lg [&_h3]:font-semibold [&_h4]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:border-black/20 [&_blockquote]:pl-3 [&_blockquote]:italic [&_a]:text-accent [&_a]:underline [&_p]:my-1",
      },
    },
  });

  if (!editor) {
    return (
      <div className="min-h-44 animate-pulse rounded-btn border border-black/10 bg-surface-alt" />
    );
  }

  const hasLink = Boolean(editor.schema.marks.link);

  return (
    <div className="rounded-btn border border-black/10 focus-within:border-accent">
      <div className="flex flex-wrap gap-0.5 rounded-t-btn border-b border-black/10 bg-surface-alt px-1 py-1">
        <ToolbarButton
          title="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          B
        </ToolbarButton>
        <ToolbarButton
          title="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <span className="italic">I</span>
        </ToolbarButton>
        {([2, 3] as const).map((level) => (
          <ToolbarButton
            key={level}
            title={`Heading ${level}`}
            active={editor.isActive("heading", { level })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level }).run()
            }
          >
            H{level}
          </ToolbarButton>
        ))}
        <ToolbarButton
          title="Bullet list"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          ••
        </ToolbarButton>
        <ToolbarButton
          title="Numbered list"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1.
        </ToolbarButton>
        <ToolbarButton
          title="Quote"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          ”
        </ToolbarButton>
        {hasLink && (
          <ToolbarButton
            title="Link"
            active={editor.isActive("link")}
            onClick={() => setLink(editor)}
          >
            🔗
          </ToolbarButton>
        )}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
