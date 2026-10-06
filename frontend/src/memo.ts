/** Max characters shown in a memo's thought-bubble headline. */
export const HEADLINE_MAX = 40;

/**
 * Plain-text headline for a markdown memo: the first line that still has
 * text once markdown syntax is stripped, truncated with an ellipsis.
 * Returns '' when nothing remains (empty memo, only rules/empty bullets).
 */
export function extractHeadline(memo: string, max = HEADLINE_MAX): string {
  for (const raw of memo.split(/\r?\n/)) {
    const line = stripLine(raw);
    if (!line) continue;
    const chars = Array.from(line);
    if (chars.length <= max) return line;
    return chars.slice(0, max - 1).join('').trimEnd() + '…';
  }
  return '';
}

function stripLine(raw: string): string {
  let s = raw.trim();
  // Thematic breaks (---, ***, ___) carry no text.
  if (/^([-*_])(\s*\1){2,}$/.test(s)) return '';
  s = s
    .replace(/^(>\s*)+/, '') // blockquote
    .replace(/^#{1,6}\s+/, '') // heading
    .replace(/^([-*+]|\d+[.)])\s+/, '') // list marker
    .replace(/^\[[ xX]?\]\s*/, '') // task checkbox
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // image → alt
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // link → text
    .replace(/\*\*(.+?)\*\*/g, '$1') // bold
    .replace(/(^|\W)__(.+?)__(?=\W|$)/g, '$1$2')
    .replace(/\*(.+?)\*/g, '$1') // italic
    .replace(/(^|\W)_(.+?)_(?=\W|$)/g, '$1$2') // _x_ but not snake_case
    .replace(/~~(.+?)~~/g, '$1') // strikethrough
    .replace(/`([^`]*)`/g, '$1') // inline code
    .replace(/^[-*+]$/, ''); // lone bullet left over
  return s.replace(/\s+/g, ' ').trim();
}
