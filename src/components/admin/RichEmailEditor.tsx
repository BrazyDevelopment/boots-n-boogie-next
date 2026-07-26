"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code2,
  Heading1,
  Heading2,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Underline,
  Video,
  Type,
} from "lucide-react";
import { fileToDataUrl } from "@/lib/images";
import { markdownToHtml } from "@/lib/mailing";
import { inputCls } from "@/components/admin/AdminChrome";

type Mode = "visual" | "html" | "markdown";

export type EmailAttachmentDraft = {
  id: string;
  filename: string;
  contentType: string;
  /** raw base64 */
  content: string;
  size: number;
};

type Props = {
  html: string;
  onChange: (html: string) => void;
  attachments: EmailAttachmentDraft[];
  onAttachmentsChange: (files: EmailAttachmentDraft[]) => void;
};

function btnCls(active?: boolean) {
  return `inline-flex h-8 w-8 items-center justify-center rounded-md border text-xs ${
    active
      ? "border-accent bg-accent/20 text-accent"
      : "border-line bg-white/5 text-cream hover:bg-white/10"
  }`;
}

export function RichEmailEditor({ html, onChange, attachments, onAttachmentsChange }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>("visual");
  const [htmlSource, setHtmlSource] = useState(html);
  const [mdSource, setMdSource] = useState("");
  const [fontName, setFontName] = useState("Arial");
  const [fontSize, setFontSize] = useState("3");
  const [foreColor, setForeColor] = useState("#faf6f0");
  const [hilite, setHilite] = useState("#e8a017");
  const syncing = useRef(false);

  // Keep visual editor in sync when html prop changes externally
  useEffect(() => {
    if (mode !== "visual") {
      setHtmlSource(html);
      return;
    }
    const el = editorRef.current;
    if (!el || syncing.current) return;
    if (el.innerHTML !== html) {
      el.innerHTML = html || "<p><br/></p>";
    }
  }, [html, mode]);

  const emitFromVisual = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    syncing.current = true;
    onChange(el.innerHTML);
    setHtmlSource(el.innerHTML);
    queueMicrotask(() => {
      syncing.current = false;
    });
  }, [onChange]);

  function exec(cmd: string, value?: string) {
    editorRef.current?.focus();
    try {
      document.execCommand(cmd, false, value);
    } catch {
      /* ignore */
    }
    emitFromVisual();
  }

  function insertHtml(snippet: string) {
    editorRef.current?.focus();
    try {
      document.execCommand("insertHTML", false, snippet);
    } catch {
      const el = editorRef.current;
      if (el) el.innerHTML += snippet;
    }
    emitFromVisual();
  }

  async function onInsertImage(file: File | null) {
    if (!file) return;
    try {
      const url = await fileToDataUrl(file, { maxWidth: 900, maxBytes: 10000 });
      insertHtml(
        `<p><img src="${url}" alt="" style="max-width:100%;height:auto;border-radius:8px;" /></p>`
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not insert image");
    }
  }

  function onInsertVideo() {
    const url = window.prompt("Video URL (YouTube, Vimeo, or direct .mp4 link)");
    if (!url?.trim()) return;
    const u = url.trim();
    // YouTube embed
    const yt =
      u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/)?.[1] ||
      u.match(/youtube\.com\/embed\/([\w-]+)/)?.[1];
    if (yt) {
      insertHtml(
        `<p><a href="https://www.youtube.com/watch?v=${yt}">▶ Watch video on YouTube</a></p>
         <p><iframe width="560" height="315" src="https://www.youtube.com/embed/${yt}" style="max-width:100%;border:0;border-radius:8px;" allowfullscreen></iframe></p>`
      );
      return;
    }
    if (/\.mp4(\?|$)/i.test(u)) {
      insertHtml(
        `<p><video controls src="${u}" style="max-width:100%;border-radius:8px;"></video></p>
         <p><a href="${u}">Open video</a></p>`
      );
      return;
    }
    insertHtml(`<p><a href="${u}">▶ Watch video</a></p>`);
  }

  function onInsertLink() {
    const url = window.prompt("Link URL");
    if (!url?.trim()) return;
    exec("createLink", url.trim());
  }

  async function onAddAttachment(file: File | null) {
    if (!file) return;
    if (file.size > 4.5 * 1024 * 1024) {
      alert("Attachment max ~4.5MB per file (email provider limit).");
      return;
    }
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const content = btoa(binary);
    onAttachmentsChange([
      ...attachments,
      {
        id: `${Date.now()}-${file.name}`,
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        content,
        size: file.size,
      },
    ]);
  }

  function switchMode(next: Mode) {
    if (mode === "visual" && editorRef.current) {
      const h = editorRef.current.innerHTML;
      onChange(h);
      setHtmlSource(h);
    }
    if (mode === "html") {
      onChange(htmlSource);
    }
    if (mode === "markdown") {
      const h = markdownToHtml(mdSource);
      onChange(h);
      setHtmlSource(h);
    }
    setMode(next);
    if (next === "html") setHtmlSource(html || htmlSource);
    if (next === "markdown" && !mdSource) setMdSource("");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["visual", "Design"],
            ["html", "HTML"],
            ["markdown", "Markdown"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
              mode === id ? "bg-accent text-bg" : "border border-line text-muted"
            }`}
            onClick={() => switchMode(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "visual" && (
        <>
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-line bg-bg/60 p-2">
            <button type="button" className={btnCls()} title="Bold" onClick={() => exec("bold")}>
              <Bold size={14} />
            </button>
            <button type="button" className={btnCls()} title="Italic" onClick={() => exec("italic")}>
              <Italic size={14} />
            </button>
            <button
              type="button"
              className={btnCls()}
              title="Underline"
              onClick={() => exec("underline")}
            >
              <Underline size={14} />
            </button>
            <span className="mx-1 h-5 w-px bg-line" />
            <button
              type="button"
              className={btnCls()}
              title="Heading 1"
              onClick={() => exec("formatBlock", "h1")}
            >
              <Heading1 size={14} />
            </button>
            <button
              type="button"
              className={btnCls()}
              title="Heading 2"
              onClick={() => exec("formatBlock", "h2")}
            >
              <Heading2 size={14} />
            </button>
            <button
              type="button"
              className={btnCls()}
              title="Paragraph"
              onClick={() => exec("formatBlock", "p")}
            >
              <Type size={14} />
            </button>
            <span className="mx-1 h-5 w-px bg-line" />
            <button
              type="button"
              className={btnCls()}
              title="Bullet list"
              onClick={() => exec("insertUnorderedList")}
            >
              <List size={14} />
            </button>
            <button
              type="button"
              className={btnCls()}
              title="Numbered list"
              onClick={() => exec("insertOrderedList")}
            >
              <ListOrdered size={14} />
            </button>
            <span className="mx-1 h-5 w-px bg-line" />
            <button type="button" className={btnCls()} title="Align left" onClick={() => exec("justifyLeft")}>
              <AlignLeft size={14} />
            </button>
            <button
              type="button"
              className={btnCls()}
              title="Align center"
              onClick={() => exec("justifyCenter")}
            >
              <AlignCenter size={14} />
            </button>
            <button
              type="button"
              className={btnCls()}
              title="Align right"
              onClick={() => exec("justifyRight")}
            >
              <AlignRight size={14} />
            </button>
            <span className="mx-1 h-5 w-px bg-line" />
            <button type="button" className={btnCls()} title="Link" onClick={onInsertLink}>
              <Link2 size={14} />
            </button>
            <label className={`${btnCls()} cursor-pointer`} title="Insert image">
              <ImageIcon size={14} />
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => onInsertImage(e.target.files?.[0] || null)}
              />
            </label>
            <button type="button" className={btnCls()} title="Insert video" onClick={onInsertVideo}>
              <Video size={14} />
            </button>
            <span className="mx-1 h-5 w-px bg-line" />
            <select
              className="h-8 rounded-md border border-line bg-bg px-2 text-xs text-cream"
              value={fontName}
              onChange={(e) => {
                setFontName(e.target.value);
                exec("fontName", e.target.value);
              }}
              title="Font"
            >
              {["Arial", "Georgia", "Times New Roman", "Verdana", "Tahoma", "Courier New", "Trebuchet MS"].map(
                (f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                )
              )}
            </select>
            <select
              className="h-8 rounded-md border border-line bg-bg px-2 text-xs text-cream"
              value={fontSize}
              onChange={(e) => {
                setFontSize(e.target.value);
                exec("fontSize", e.target.value);
              }}
              title="Size"
            >
              <option value="1">XS</option>
              <option value="2">S</option>
              <option value="3">M</option>
              <option value="4">L</option>
              <option value="5">XL</option>
              <option value="6">2XL</option>
              <option value="7">3XL</option>
            </select>
            <label className="inline-flex items-center gap-1 text-[10px] text-muted" title="Text colour">
              Text
              <input
                type="color"
                value={foreColor}
                onChange={(e) => {
                  setForeColor(e.target.value);
                  exec("foreColor", e.target.value);
                }}
                className="h-7 w-8 cursor-pointer rounded border border-line bg-transparent"
              />
            </label>
            <label className="inline-flex items-center gap-1 text-[10px] text-muted" title="Highlight">
              HL
              <input
                type="color"
                value={hilite}
                onChange={(e) => {
                  setHilite(e.target.value);
                  exec("hiliteColor", e.target.value);
                }}
                className="h-7 w-8 cursor-pointer rounded border border-line bg-transparent"
              />
            </label>
          </div>

          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={emitFromVisual}
            onBlur={emitFromVisual}
            className="min-h-[280px] rounded-xl border border-line bg-[#14100c] px-4 py-3 text-[15px] leading-relaxed text-cream outline-none focus:ring-2 focus:ring-accent/30 prose-bnb"
            style={{ whiteSpace: "pre-wrap" }}
          />
        </>
      )}

      {mode === "html" && (
        <div className="space-y-2">
          <p className="flex items-center gap-1 text-xs text-muted">
            <Code2 size={12} /> Raw HTML body (wrapped in BnB template on send)
          </p>
          <textarea
            value={htmlSource}
            onChange={(e) => {
              setHtmlSource(e.target.value);
              onChange(e.target.value);
            }}
            rows={16}
            className={`${inputCls} font-mono text-xs`}
            spellCheck={false}
          />
        </div>
      )}

      {mode === "markdown" && (
        <div className="space-y-2">
          <p className="text-xs text-muted">
            Write Markdown, then switch to Design or click Apply to convert.
          </p>
          <textarea
            value={mdSource}
            onChange={(e) => setMdSource(e.target.value)}
            rows={14}
            className={`${inputCls} font-mono text-sm`}
            placeholder={"# Title\n\nHello **world**\n\n- item one\n- item two"}
          />
          <button
            type="button"
            className="btn-secondary !py-2 text-sm"
            onClick={() => {
              const h = markdownToHtml(mdSource);
              onChange(h);
              setHtmlSource(h);
              setMode("visual");
            }}
          >
            Apply Markdown → Design
          </button>
        </div>
      )}

      <div className="rounded-xl border border-line bg-bg/40 p-3">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">Attachments</p>
        <p className="mt-1 text-[11px] text-muted">
          PDFs, images, docs (keep under ~4.5MB each). Videos work best as links in the body.
        </p>
        <label className="btn-secondary mt-2 inline-flex !cursor-pointer !py-1.5 text-xs">
          Add attachment
          <input
            type="file"
            className="sr-only"
            onChange={(e) => onAddAttachment(e.target.files?.[0] || null)}
          />
        </label>
        {attachments.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs text-cream">
            {attachments.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {a.filename}{" "}
                  <span className="text-muted">({Math.round(a.size / 1024)} KB)</span>
                </span>
                <button
                  type="button"
                  className="font-bold text-red-400"
                  onClick={() => onAttachmentsChange(attachments.filter((x) => x.id !== a.id))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
