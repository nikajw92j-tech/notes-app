import sanitizeHtml from "sanitize-html";

/** Images may only point at our own authenticated file route or https URLs. */
export function isAllowedImageSrc(src: string | undefined): boolean {
  if (!src) return false;
  if (/^\/api\/files\/(note-images|avatars)\/[0-9a-f-]{36}\/[\w.-]+$/i.test(src)) return true;
  return /^https:\/\//i.test(src);
}

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "hr", "h1", "h2", "h3",
    "strong", "b", "em", "i", "u", "s", "mark", "code", "pre", "blockquote",
    "ul", "ol", "li", "a", "img",
    "table", "colgroup", "col", "thead", "tbody", "tr", "th", "td",
    "label", "input", "div", "span",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"],
    ul: ["data-type"],
    ol: ["start"],
    li: ["data-type", "data-checked"],
    input: ["type", "checked", "disabled"],
    code: ["class"],
    th: ["colspan", "rowspan", "colwidth"],
    td: ["colspan", "rowspan", "colwidth"],
    col: ["span"],
  },
  allowedClasses: { code: [/^language-[\w-]+$/] },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["https"] },
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        target: "_blank",
        rel: "noopener noreferrer nofollow",
      },
    }),
    input: (tagName, attribs) =>
      attribs.type === "checkbox"
        ? { tagName, attribs: { type: "checkbox", ...(attribs.checked !== undefined ? { checked: "checked" } : {}) } }
        : { tagName: "span", attribs: {} },
  },
  exclusiveFilter: (frame) => frame.tag === "img" && !isAllowedImageSrc(frame.attribs.src),
};

/** Sanitize editor HTML before it is stored. */
export function sanitizeNoteHtml(html: string): string {
  return sanitizeHtml(html, OPTIONS);
}

/** Plain-text projection for search and excerpts. */
export function htmlToText(html: string): string {
  const spaced = html.replace(/<(\/(p|h[1-6]|li|blockquote|pre|tr|td|th|div)|br\s*\/?|hr\s*\/?)>/gi, " $&");
  return sanitizeHtml(spaced, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
