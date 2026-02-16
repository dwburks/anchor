/**
 * Convert Quill Delta JSON to Markdown.
 *
 * Supports: bold, italic, underline, strikethrough, headers (1-6),
 * ordered lists, bullet lists, checklists, blockquotes, code blocks, links.
 */

interface QuillOp {
  insert?: unknown;
  delete?: number;
  retain?: number;
  attributes?: Record<string, unknown>;
}

interface QuillDelta {
  ops: QuillOp[];
}

interface Line {
  segments: { text: string; attributes?: Record<string, unknown> }[];
  lineAttributes?: Record<string, unknown>;
}

function parseDelta(content: string | null): QuillDelta | null {
  if (!content) return null;
  try {
    const parsed = JSON.parse(content);
    if (parsed && Array.isArray(parsed.ops)) {
      return parsed as QuillDelta;
    }
  } catch {
    // invalid JSON
  }
  return null;
}

/**
 * Split ops into lines, each with inline segments and line-level attributes.
 */
function deltaToLines(ops: QuillOp[]): Line[] {
  const lines: Line[] = [];
  let currentSegments: Line['segments'] = [];

  for (const op of ops) {
    if (typeof op.insert !== 'string') continue;

    const parts = op.insert.split('\n');
    for (let i = 0; i < parts.length; i++) {
      if (parts[i]) {
        currentSegments.push({
          text: parts[i],
          attributes: op.attributes,
        });
      }
      if (i < parts.length - 1) {
        // Newline — finalize line. Line-level attributes come from the
        // newline op's attributes (Quill puts them on the \n character).
        lines.push({
          segments: currentSegments,
          lineAttributes: op.attributes,
        });
        currentSegments = [];
      }
    }
  }

  // Remaining content (shouldn't happen with well-formed deltas)
  if (currentSegments.length > 0) {
    lines.push({ segments: currentSegments });
  }

  return lines;
}

/**
 * Wrap inline text with markdown formatting.
 */
function formatInline(text: string, attrs?: Record<string, unknown>): string {
  if (!attrs) return text;

  let result = text;

  if (attrs.link) {
    result = `[${result}](${attrs.link})`;
    return result; // links don't get further wrapping
  }
  if (attrs.bold) result = `**${result}**`;
  if (attrs.italic) result = `*${result}*`;
  if (attrs.strike) result = `~~${result}~~`;
  // Underline has no standard markdown, use HTML
  if (attrs.underline) result = `<u>${result}</u>`;

  return result;
}

/**
 * Convert a parsed Quill Delta to a Markdown string.
 */
function deltaToMarkdown(delta: QuillDelta): string {
  const lines = deltaToLines(delta.ops);
  const mdLines: string[] = [];
  let orderedListIndex = 0;
  let inCodeBlock = false;

  for (const line of lines) {
    const attrs = line.lineAttributes || {};
    const inlineText = line.segments
      .map((s) => formatInline(s.text, s.attributes))
      .join('');

    // Code block
    if (attrs['code-block']) {
      if (!inCodeBlock) {
        mdLines.push('```');
        inCodeBlock = true;
      }
      // Inside code blocks, use raw text (no inline formatting)
      const rawText = line.segments.map((s) => s.text).join('');
      mdLines.push(rawText);
      continue;
    } else if (inCodeBlock) {
      mdLines.push('```');
      inCodeBlock = false;
    }

    // Header
    if (attrs.header) {
      const level = Math.min(Number(attrs.header) || 1, 6);
      const prefix = '#'.repeat(level);
      mdLines.push(`${prefix} ${inlineText}`);
      orderedListIndex = 0;
      continue;
    }

    // Blockquote
    if (attrs.blockquote) {
      mdLines.push(`> ${inlineText}`);
      orderedListIndex = 0;
      continue;
    }

    // Lists
    if (attrs.list) {
      const listType = attrs.list as string;

      if (listType === 'ordered') {
        orderedListIndex++;
        mdLines.push(`${orderedListIndex}. ${inlineText}`);
      } else if (listType === 'bullet') {
        mdLines.push(`- ${inlineText}`);
        orderedListIndex = 0;
      } else if (listType === 'checked') {
        mdLines.push(`- [x] ${inlineText}`);
        orderedListIndex = 0;
      } else if (listType === 'unchecked') {
        mdLines.push(`- [ ] ${inlineText}`);
        orderedListIndex = 0;
      }
      continue;
    }

    // Reset ordered list counter when not in an ordered list
    orderedListIndex = 0;

    // Plain line
    mdLines.push(inlineText);
  }

  // Close any open code block
  if (inCodeBlock) {
    mdLines.push('```');
  }

  return mdLines.join('\n');
}

/**
 * Convert a stored Quill Delta JSON string to Markdown.
 * Returns empty string if content is null/empty/invalid.
 */
export function quillDeltaToMarkdown(content: string | null): string {
  const delta = parseDelta(content);
  if (!delta) return '';
  return deltaToMarkdown(delta);
}
