"use client"

import { Extension, type JSONContent } from "@tiptap/core"
import { Placeholder } from "@tiptap/extensions"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { EditorContent, useEditor, useEditorState } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { useLocale, useTranslations } from "next-intl"
import { useEffect, useState } from "react"

import styles from "@/components/discussions/DiscussionWritingEditor.module.css"
import { WritingToolbarButton } from "@/components/ds/WritingToolbarButton"
import { cn } from "@/lib/styles"

/** Discussions retain their plain-text API, moderation and revision contract. */
export function discussionDocument(text: string): JSONContent {
  return {
    type: "doc",
    content: text.split("\n").map((line) => ({
      type: "paragraph",
      ...(line ? { content: [{ type: "text", text: line }] } : {}),
    })),
  }
}

const BodyLimit = Extension.create({
  name: "discussionBodyLimit",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("discussionBodyLimit"),
        filterTransaction: (transaction) =>
          !transaction.docChanged ||
          transaction.doc.textBetween(
            0,
            transaction.doc.content.size,
            "\n",
            "\n"
          ).length <= 20000,
      }),
    ]
  },
})

export function DiscussionWritingEditor({
  value,
  onChange,
  disabled,
  describedBy,
  language,
}: {
  readonly value: string
  readonly onChange: (value: string) => void
  readonly disabled: boolean
  readonly describedBy: string
  readonly language?: string
}) {
  const t = useTranslations("discussions")
  const ui = useTranslations("ui")
  const locale = useLocale()
  const [preview, setPreview] = useState(false)
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        bold: false,
        italic: false,
        strike: false,
        underline: false,
        code: false,
        codeBlock: false,
        blockquote: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        listKeymap: false,
        horizontalRule: false,
        link: false,
        trailingNode: false,
      }),
      Placeholder.configure({ placeholder: t("storyMessagePlaceholder") }),
      BodyLimit,
    ],
    content: discussionDocument(value),
    editable: !disabled,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": t("body"),
        "aria-multiline": "true",
        "aria-required": "true",
        "aria-describedby": describedBy,
        lang: language ?? locale,
        spellcheck: "true",
        class: styles.canvas!,
      },
    },
    onUpdate: ({ editor: current }) => {
      const next = current.getText({ blockSeparator: "\n" })
      if (next !== value) onChange(next)
    },
  })
  const history = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      undo: current?.can().undo() ?? false,
      redo: current?.can().redo() ?? false,
    }),
  })
  useEffect(() => {
    editor?.setEditable(!disabled, false)
  }, [editor, disabled])
  useEffect(() => {
    if (editor && editor.getText({ blockSeparator: "\n" }) !== value)
      editor.commands.setContent(discussionDocument(value), {
        emitUpdate: false,
      })
  }, [editor, value])

  return (
    <div className={styles.editor}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-y border-(--t-border-line) py-2">
        <div
          className="flex items-center gap-1"
          role="group"
          aria-label={t("editorMode")}
        >
          {[false, true].map((isPreview) => (
            <button
              key={String(isPreview)}
              type="button"
              aria-pressed={preview === isPreview}
              onClick={() => setPreview(isPreview)}
              className={cn(
                "min-h-11 rounded-lg px-3 text-sm font-semibold",
                preview === isPreview
                  ? "bg-(--t-accent-chip) text-(--t-accent-primary)"
                  : "text-(--t-ink-dim)"
              )}
            >
              {ui(isPreview ? "preview" : "write")}
            </button>
          ))}
        </div>
        <div
          className="flex items-center"
          role="group"
          aria-label={t("editorHistory")}
        >
          <WritingToolbarButton
            icon="mdi:undo"
            label={ui("undo")}
            disabled={disabled || preview || !history?.undo}
            onClick={() => editor?.chain().focus().undo().run()}
          />
          <WritingToolbarButton
            icon="mdi:redo"
            label={ui("redo")}
            disabled={disabled || preview || !history?.redo}
            onClick={() => editor?.chain().focus().redo().run()}
          />
        </div>
      </div>
      <div hidden={preview}>
        <EditorContent editor={editor} />
      </div>
      {preview && (
        <div
          aria-label={ui("preview")}
          lang={language ?? locale}
          className={cn(styles.canvas, "whitespace-pre-wrap")}
        >
          {value || (
            <span className="text-(--t-ink-dim)">
              {ui("write_something_before_sending")}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
