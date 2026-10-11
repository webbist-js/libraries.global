"use client"

import { Icon } from "@iconify/react"
import type { Editor } from "@tiptap/core"
import { EditorContent, useEditor, useEditorState } from "@tiptap/react"
import { useTranslations as useUiTranslations } from "next-intl"
import { useEffect, useId, useRef, useState } from "react"

import { T } from "@/lib/design-tokens"

import { ARTICLE_KIND_META, type ArticleKind } from "./article.types"
import { CALLOUT_KINDS, type TiptapDoc } from "./articleBlocks"
import { articleExtensions } from "./extensions"

export type UploadedImage = { id: number; url: string; alt?: string | null }

type ToolButtonProps = {
  icon?: string
  label: string
  text?: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
}

function ToolButton({
  icon,
  label,
  text,
  active,
  disabled,
  onClick,
}: ToolButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="inline-flex h-9 min-w-9 items-center justify-center rounded-[10px] px-2 text-[13px] font-bold transition-colors hover:bg-(--t-bg-muted-2) disabled:cursor-not-allowed disabled:opacity-40"
      style={{
        background: active ? T.accent.chip : "transparent",
        color: active ? T.accent.primary : T.ink.base,
        border: "none",
        cursor: "pointer",
        fontFamily: T.font.sans,
      }}
    >
      {icon ? <Icon icon={icon} width={18} aria-hidden="true" /> : text}
    </button>
  )
}

function Divider() {
  return (
    <span
      aria-hidden="true"
      className="mx-1 inline-block h-6 w-px self-center"
      style={{ background: T.border.line }}
    />
  )
}

const smallInput: React.CSSProperties = {
  height: 36,
  padding: "0 12px",
  borderRadius: 10,
  border: `1px solid ${T.border.hi}`,
  background: T.bg.deep,
  color: T.ink.base,
  fontFamily: T.font.sans,
  fontSize: 14,
  minWidth: 0,
}

const smallPill =
  "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-colors"

/** The toolbar's context row: link, quote, code and callout details. */
function ContextRow({ editor }: { editor: Editor }) {
  const tUi = useUiTranslations("ui")

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      link: e.isActive("link"),
      href: (e.getAttributes("link").href as string | undefined) ?? "",
      quote: e.isActive("blockquote"),
      attribution:
        (e.getAttributes("blockquote").attribution as string | null) ?? "",
      source: (e.getAttributes("blockquote").source as string | null) ?? "",
      code: e.isActive("codeBlock"),
      language: (e.getAttributes("codeBlock").language as string | null) ?? "",
      callout: e.isActive("callout"),
      calloutKind: (e.getAttributes("callout").kind as string) ?? "note",
      calloutTitle: (e.getAttributes("callout").title as string | null) ?? "",
      image: e.isActive("image"),
      caption: (e.getAttributes("image").caption as string | null) ?? "",
      alt: (e.getAttributes("image").alt as string | null) ?? "",
    }),
  })
  if (!state) return null
  const rows: React.ReactNode[] = []
  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: T.ink.dim,
    whiteSpace: "nowrap",
  }

  if (state.link)
    rows.push(
      <div key="link" className="flex flex-wrap items-center gap-2">
        <span style={labelStyle}>{tUi("link")}</span>
        <input
          aria-label={tUi("link_url")}
          value={state.href}
          onChange={(e) =>
            editor
              .chain()
              .extendMarkRange("link")
              .setLink({ href: e.target.value })
              .run()
          }
          style={{ ...smallInput, flex: 1 }}
          placeholder="https://"
        />
        <button
          type="button"
          className={smallPill}
          style={{
            border: `1px solid ${T.border.hi}`,
            background: T.bg.deep,
            color: T.ink.base,
            cursor: "pointer",
          }}
          onClick={() => editor.chain().focus().unsetLink().run()}
        >
          {tUi("remove_link")}{" "}
        </button>
      </div>
    )
  if (state.quote)
    rows.push(
      <div key="quote" className="flex flex-wrap items-center gap-2">
        <span style={labelStyle}>{tUi("quote")}</span>
        <input
          aria-label={tUi("attribution")}
          value={state.attribution}
          placeholder={tUi("who_said_it")}
          onChange={(e) =>
            editor.commands.updateAttributes("blockquote", {
              attribution: e.target.value || null,
            })
          }
          style={{ ...smallInput, flex: 1 }}
        />
        <input
          aria-label={tUi("source")}
          value={state.source}
          placeholder={tUi("source_e_g_a_book_or_page")}
          onChange={(e) =>
            editor.commands.updateAttributes("blockquote", {
              source: e.target.value || null,
            })
          }
          style={{ ...smallInput, flex: 1 }}
        />
      </div>
    )
  if (state.code)
    rows.push(
      <div key="code" className="flex flex-wrap items-center gap-2">
        <span style={labelStyle}>{tUi("code")}</span>
        <input
          aria-label={tUi("language")}
          value={state.language}
          placeholder={tUi("language_e_g_bash")}
          onChange={(e) =>
            editor.commands.updateAttributes("codeBlock", {
              language: e.target.value || null,
            })
          }
          style={{ ...smallInput, width: 200 }}
        />
      </div>
    )
  if (state.callout)
    rows.push(
      <div key="callout" className="flex flex-wrap items-center gap-2">
        <span style={labelStyle}>{tUi("callout")}</span>
        <select
          aria-label={tUi("callout_kind")}
          value={state.calloutKind}
          onChange={(e) =>
            editor.commands.setCalloutKind(
              e.target.value as (typeof CALLOUT_KINDS)[number]
            )
          }
          style={{ ...smallInput, width: 140 }}
        >
          {CALLOUT_KINDS.map((k) => (
            <option key={k} value={k}>
              {k[0]!.toUpperCase() + k.slice(1)}
            </option>
          ))}
        </select>
        <input
          aria-label={tUi("callout_title")}
          value={state.calloutTitle}
          placeholder={tUi("title_optional")}
          onChange={(e) =>
            editor.commands.updateAttributes("callout", {
              title: e.target.value || null,
            })
          }
          style={{ ...smallInput, flex: 1 }}
        />
      </div>
    )
  if (state.image)
    rows.push(
      <div key="image" className="flex flex-wrap items-center gap-2">
        <span style={labelStyle}>{tUi("image")}</span>
        <input
          aria-label={tUi("alt_text")}
          value={state.alt}
          placeholder={tUi("describe_the_image_for_screen_readers")}
          onChange={(e) =>
            editor.commands.updateAttributes("image", {
              alt: e.target.value || null,
            })
          }
          style={{ ...smallInput, flex: 1 }}
        />
        <input
          aria-label={tUi("caption")}
          value={state.caption}
          placeholder={tUi("caption_optional")}
          onChange={(e) =>
            editor.commands.updateAttributes("image", {
              caption: e.target.value || null,
            })
          }
          style={{ ...smallInput, flex: 1 }}
        />
      </div>
    )
  if (rows.length === 0) return null

  return (
    <div
      className="flex flex-col gap-2 px-4 py-2.5"
      style={{
        borderBottom: `1px solid ${T.border.line}`,
        background: T.bg.surface,
      }}
    >
      {rows}
    </div>
  )
}

function Toolbar({
  editor,
  onPickImage,
  uploading,
}: {
  editor: Editor
  onPickImage: () => void
  uploading: boolean
}) {
  const tUi = useUiTranslations("ui")

  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      p: e.isActive("paragraph"),
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      link: e.isActive("link"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      code: e.isActive("codeBlock"),
      callout: e.isActive("callout"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  })
  if (!s) return null
  const c = () => editor.chain().focus()

  return (
    <div
      role="toolbar"
      aria-label={tUi("formatting")}
      className="flex flex-wrap items-center gap-0.5 px-3 py-2"
      style={{
        borderBottom: `1px solid ${T.border.line}`,
        background: T.bg.surface,
        borderRadius: "24px 24px 0 0",
      }}
    >
      <ToolButton
        text="H2"
        label={tUi("heading_2")}
        active={s.h2}
        onClick={() => c().toggleHeading({ level: 2 }).run()}
      />
      <ToolButton
        text="H3"
        label={tUi("heading_3")}
        active={s.h3}
        onClick={() => c().toggleHeading({ level: 3 }).run()}
      />
      <ToolButton
        icon="mdi:format-paragraph"
        label={tUi("paragraph")}
        active={s.p && !s.quote && !s.callout}
        onClick={() => c().setParagraph().run()}
      />
      <Divider />
      <ToolButton
        icon="mdi:format-bold"
        label={tUi("bold")}
        active={s.bold}
        onClick={() => c().toggleBold().run()}
      />
      <ToolButton
        icon="mdi:format-italic"
        label={tUi("italic")}
        active={s.italic}
        onClick={() => c().toggleItalic().run()}
      />
      <ToolButton
        icon="mdi:link-variant"
        label={s.link ? tUi("edit_link") : tUi("add_link")}
        active={s.link}
        onClick={() => {
          if (s.link) editor.chain().focus().extendMarkRange("link").run()
          else c().setLink({ href: "https://" }).run()
        }}
      />
      <Divider />
      <ToolButton
        icon="mdi:format-list-bulleted"
        label={tUi("bulleted_list")}
        active={s.bullet}
        onClick={() => c().toggleBulletList().run()}
      />
      <ToolButton
        icon="mdi:format-list-numbered"
        label={tUi("numbered_list")}
        active={s.ordered}
        onClick={() => c().toggleOrderedList().run()}
      />
      <ToolButton
        icon="mdi:format-quote-close"
        label={tUi("quote")}
        active={s.quote}
        onClick={() => c().toggleBlockquote().run()}
      />
      <ToolButton
        icon="mdi:code-tags"
        label={tUi("code_block")}
        active={s.code}
        onClick={() => c().toggleCodeBlock().run()}
      />
      <ToolButton
        icon="mdi:information-outline"
        label={tUi("callout")}
        active={s.callout}
        onClick={() => c().toggleCallout().run()}
      />
      <Divider />
      <ToolButton
        icon={uploading ? "mdi:loading" : "mdi:image-outline"}
        label={tUi("insert_image")}
        disabled={uploading}
        onClick={onPickImage}
      />
      <Divider />
      <ToolButton
        icon="mdi:undo"
        label={tUi("undo")}
        disabled={!s.canUndo}
        onClick={() => c().undo().run()}
      />
      <ToolButton
        icon="mdi:redo"
        label={tUi("redo")}
        disabled={!s.canRedo}
        onClick={() => c().redo().run()}
      />
    </div>
  )
}

/** Editor styles: the article's own type on paper, no chrome inside the text. */
const EDITOR_CSS = `
.ae-editor .ProseMirror { outline: none; min-height: 320px; font-family: var(--ae-sans); font-size: 17px; line-height: 1.7; color: var(--t-ink-base); }
.ae-editor .ProseMirror > * + * { margin-top: 0.9em; }
.ae-editor .ProseMirror h2 { font-family: var(--ae-serif); font-size: 30px; font-weight: 500; letter-spacing: -0.01em; line-height: 1.15; margin-top: 1.4em; }
.ae-editor .ProseMirror h3 { font-family: var(--ae-serif); font-size: 23px; font-weight: 500; line-height: 1.2; margin-top: 1.2em; }
.ae-editor .ProseMirror p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: var(--t-ink-faint); float: left; height: 0; pointer-events: none; }
.ae-editor .ProseMirror a { color: var(--t-accent-primary); text-decoration: underline; text-underline-offset: 3px; }
.ae-editor .ProseMirror ul, .ae-editor .ProseMirror ol { padding-left: 1.5em; }
.ae-editor .ProseMirror ul { list-style: disc; } .ae-editor .ProseMirror ol { list-style: decimal; }
.ae-editor .ProseMirror li + li { margin-top: 0.3em; }
.ae-editor .ProseMirror blockquote { border-left: 2px solid var(--t-accent-primary); padding-left: 1.2em; font-style: italic; color: var(--t-ink-dim); }
.ae-editor .ProseMirror pre { background: var(--t-bg-surface); border: 1px solid var(--t-border-line); border-radius: 14px; padding: 16px 18px; font-family: var(--ae-mono); font-size: 14px; line-height: 1.6; overflow-x: auto; }
.ae-editor .ProseMirror code { font-family: var(--ae-mono); font-size: 0.92em; background: var(--t-bg-surface); border: 1px solid var(--t-border-line); border-radius: 6px; padding: 1px 5px; }
.ae-editor .ProseMirror pre code { background: none; border: 0; padding: 0; }
.ae-editor .ProseMirror aside.ae-callout { border: 1px solid var(--t-border-line); border-left: 3px solid var(--t-accent-primary); border-radius: 14px; padding: 14px 18px; background: var(--t-bg-surface); }
.ae-editor .ProseMirror aside.ae-callout::before { content: attr(data-kind); display: block; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--t-accent-primary); margin-bottom: 4px; }
.ae-editor .ProseMirror aside.ae-callout[data-title]::before { content: attr(data-kind) " · " attr(data-title); }
.ae-editor .ProseMirror img { max-width: 100%; height: auto; border-radius: 16px; display: block; }
.ae-editor .ProseMirror img.ProseMirror-selectednode { outline: 3px solid var(--t-accent-primary); outline-offset: 3px; }
.ae-editor .ProseMirror ::selection { background: var(--t-accent-chip); }
`

export function ArticleEditor({
  kind,
  title,
  summary,
  doc,
  docKey,
  readOnly = false,
  onTitleChange,
  onSummaryChange,
  onDocChange,
  uploadImage,
}: {
  readonly kind: ArticleKind
  readonly title: string
  readonly summary: string
  readonly doc: TiptapDoc
  /** Changes when the document is replaced from outside (a resumed draft, another language). */
  readonly docKey: string
  /** Locks the editor, e.g. once the draft has been sent for review. */
  readonly readOnly?: boolean
  readonly onTitleChange: (v: string) => void
  readonly onSummaryChange: (v: string) => void
  readonly onDocChange: (doc: TiptapDoc) => void
  readonly uploadImage: (file: File) => Promise<UploadedImage | null>
}) {
  const tUi = useUiTranslations("ui")
  const tEditor = useUiTranslations("articleEditor")

  const meta = ARTICLE_KIND_META[kind]
  const fileInputId = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const titleRef = useRef<HTMLTextAreaElement>(null)

  const editor = useEditor({
    extensions: articleExtensions(tUi("start_writing")),
    content: doc,
    immediatelyRender: false,
    editorProps: {
      attributes: { "aria-label": tUi("article_body"), spellcheck: "true" },
    },
    onUpdate: ({ editor: e }) => onDocChange(e.getJSON() as TiptapDoc),
  })

  // Replace the content only when the outside world swaps documents.
  const lastKey = useRef(docKey)
  useEffect(() => {
    if (!editor || lastKey.current === docKey) return
    lastKey.current = docKey
    editor.commands.setContent(doc, { emitUpdate: false })
  }, [editor, doc, docKey])

  useEffect(() => {
    editor?.setEditable(!readOnly)
  }, [editor, readOnly])

  // Auto-grow the title.
  useEffect(() => {
    const el = titleRef.current
    if (!el) return
    el.style.height = "0px"
    el.style.height = `${el.scrollHeight}px`
  }, [title])

  async function handleFile(file: File | undefined) {
    if (!file || !editor) return
    setUploading(true)
    try {
      const uploaded = await uploadImage(file)
      if (uploaded)
        editor
          .chain()
          .focus()
          .setImage({ src: uploaded.url, alt: uploaded.alt ?? file.name })
          .updateAttributes("image", { imageId: uploaded.id })
          .run()
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  return (
    <div
      className="ae-editor overflow-hidden rounded-[24px]"
      style={
        {
          background: T.bg.deep,
          border: `1px solid ${T.border.line}`,
          "--ae-sans": T.font.sans,
          "--ae-serif": T.font.serif,
          "--ae-mono": T.font.mono,
        } as React.CSSProperties
      }
    >
      <style>{EDITOR_CSS}</style>
      {editor ? (
        <>
          <Toolbar
            editor={editor}
            uploading={uploading}
            onPickImage={() => fileRef.current?.click()}
          />
          <ContextRow editor={editor} />
        </>
      ) : null}
      <input
        ref={fileRef}
        id={fileInputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label={tUi("choose_an_image_to_insert")}
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      <div className="px-6 pt-8 pb-10 sm:px-10">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold"
          style={{ background: meta.tintBg, color: meta.tintFg }}
        >
          {tEditor(kind === "knowledge" ? "kindKnowledge" : "kindJournal")}
        </span>
        <label htmlFor="article-title" className="sr-only">
          {tUi("title")}{" "}
        </label>
        <textarea
          id="article-title"
          ref={titleRef}
          rows={1}
          value={title}
          readOnly={readOnly}
          onChange={(e) => onTitleChange(e.target.value.replaceAll("\n", " "))}
          placeholder={tUi("title")}
          maxLength={200}
          className="mt-4 block w-full resize-none border-0 bg-transparent p-0 outline-none"
          style={{
            fontFamily: T.font.serif,
            fontSize: "clamp(34px,4vw,48px)",
            fontWeight: 500,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            color: T.ink.base,
          }}
        />
        <label htmlFor="article-summary" className="sr-only">
          {tUi("summary")}{" "}
        </label>
        <textarea
          id="article-summary"
          rows={2}
          value={summary}
          readOnly={readOnly}
          onChange={(e) => onSummaryChange(e.target.value)}
          placeholder={tUi("one_or_two_sentences_shown_in_search_and_on_cards")}
          maxLength={600}
          className="mt-5 block w-full resize-none border-0 bg-transparent p-0 outline-none"
          style={{
            fontFamily: T.font.sans,
            fontSize: "19px",
            lineHeight: 1.55,
            color: T.ink.dim,
          }}
        />
        <hr
          className="my-7 border-0"
          style={{ height: 1, background: T.border.divider }}
        />
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
