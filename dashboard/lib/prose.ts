/**
 * The long-form research fields are Markdown. They were being rendered as text.
 *
 * `uncertainty` and `declaredVsObserved` are five- to eleven-kilobyte documents
 * written with headings, lists and emphasis, and every actor page was printing
 * them into a single paragraph with the syntax showing — "## Least defensible
 * parameters carried forward" as a literal line, every newline collapsed. The
 * most reviewer-useful prose in the repository was also the least readable thing
 * on the site.
 *
 * This parses only what those documents actually contain: h2 headings, blank-
 * line paragraphs, dash bullets, and inline bold, italic and code. No links
 * appear in any of them, so none are handled — a parser that covers syntax the
 * corpus does not use is untested code that looks tested.
 */

export type ProseBlock =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] };

/** Split a document into blocks, preserving order. */
export function parseProse(source: string): ProseBlock[] {
  const blocks: ProseBlock[] = [];
  let paragraph: string[] = [];
  let items: string[] = [];

  const flushParagraph = (): void => {
    if (paragraph.length === 0) return;
    blocks.push({ kind: "paragraph", text: paragraph.join(" ").trim() });
    paragraph = [];
  };
  const flushList = (): void => {
    if (items.length === 0) return;
    blocks.push({ kind: "list", items });
    items = [];
  };

  for (const raw of source.split("\n")) {
    const line = raw.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ kind: "heading", text: heading[1]!.trim() });
      continue;
    }

    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      flushParagraph();
      items.push(bullet[1]!.trim());
      continue;
    }

    // A wrapped continuation of the bullet above, not a new paragraph.
    if (items.length > 0) {
      items[items.length - 1] = `${items[items.length - 1]} ${line}`;
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}

export type ProseSpan =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "italic"; text: string }
  | { kind: "code"; text: string };

/**
 * Split one line into styled spans.
 *
 * Bold is matched before italic in the alternation, so `**not**` reads as bold
 * rather than as an italic wrapping a stray asterisk. Anything that does not
 * close — a lone asterisk mid-sentence — falls through as ordinary text instead
 * of swallowing the rest of the line, which is the failure mode that makes a
 * hand-rolled inline parser worse than no parser at all.
 */
export function parseSpans(line: string): ProseSpan[] {
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*)/g;
  const spans: ProseSpan[] = [];
  let index = 0;

  for (const match of line.matchAll(pattern)) {
    const at = match.index;
    if (at > index) {
      spans.push({ kind: "text", text: line.slice(index, at) });
    }
    const token = match[0];
    if (token.startsWith("**")) {
      spans.push({ kind: "bold", text: token.slice(2, -2) });
    } else if (token.startsWith("`")) {
      spans.push({ kind: "code", text: token.slice(1, -1) });
    } else {
      spans.push({ kind: "italic", text: token.slice(1, -1) });
    }
    index = at + token.length;
  }

  if (index < line.length) {
    spans.push({ kind: "text", text: line.slice(index) });
  }
  return spans;
}
