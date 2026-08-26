import type { NativePostContent } from '../../linuxdo/topicAdapter';
import {
  countNativeElementLines,
  getNativeBlockLineElements,
  isGitHubHref,
  nativeElementLineTexts,
  nativeLineText,
  normalizeNativeLineText,
  readNativeContentLineKind,
  readNativeLineIndent,
  readOneboxHref,
  type NativeContentLineSummary,
} from './nativeContentLines';

export const REPLY_CONTENT_FOLD_LIMIT = 6;

export type ReplyContentStyle = 'comment' | 'single' | 'text-block';
export type ReplyCodeAssetKind = 'github' | 'image' | 'link';

export interface ReplyCodeAssetPlan {
  readonly element: HTMLElement;
  readonly kind: ReplyCodeAssetKind;
}

interface ReplyCodeTextLine {
  readonly element: HTMLElement;
  readonly lineCount: number;
}

export interface ReplyCodePlan {
  readonly assets: readonly ReplyCodeAssetPlan[];
  readonly foldable: boolean;
  readonly style: ReplyContentStyle;
  readonly textBlocks: readonly HTMLElement[];
  readonly textLineCount: number;
  readonly textLines: readonly ReplyCodeTextLine[];
}

export interface ReplyCodeRegion {
  readonly contentCallLine: boolean;
  readonly declCloseInline: boolean;
  readonly declOpenInline: boolean;
  readonly foldBoundary: HTMLElement | null;
  readonly hiddenTextElements: readonly HTMLElement[];
  readonly lineCount: number;
  readonly visibleTextLines: readonly ReplyCodeTextLine[];
}

const DECL_INLINE_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p']);

export function resolveReplyContentStyle(postId: number, textLineCount: number): ReplyContentStyle {
  if (textLineCount <= 1) return 'single';
  return (Math.imul(postId, 2654435761) >>> 0) % 10 < 7 ? 'text-block' : 'comment';
}

export function createReplyCodePlan(
  content: NativePostContent | null,
  postId: number,
): ReplyCodePlan | null {
  if (!content) return null;
  const assets: ReplyCodeAssetPlan[] = [];
  const textBlocks: HTMLElement[] = [];
  const textLines: ReplyCodeTextLine[] = [];
  content.blocks.forEach(({ element }) => {
    const assetKind = classifyAssetBlock(element);
    if (assetKind) {
      assets.push({ element, kind: assetKind });
      return;
    }
    textBlocks.push(element);
    getNativeBlockLineElements(element).forEach((lineElement) => {
      textLines.push({ element: lineElement, lineCount: countNativeElementLines(lineElement) });
    });
  });
  const textLineCount = textLines.reduce((count, { lineCount }) => count + lineCount, 0);
  return {
    assets,
    foldable:
      textLineCount > REPLY_CONTENT_FOLD_LIMIT &&
      foldVisibleLines(textLines).length < textLines.length,
    style: resolveReplyContentStyle(postId, textLineCount),
    textBlocks,
    textLineCount,
    textLines,
  };
}

export function resolveReplyCodeRegion(plan: ReplyCodePlan, expanded: boolean): ReplyCodeRegion {
  const folded = plan.foldable && !expanded;
  const visibleTextLines = folded ? foldVisibleLines(plan.textLines) : [...plan.textLines];
  const hiddenTextElements = folded
    ? plan.textLines.slice(visibleTextLines.length).map(({ element }) => element)
    : [];
  const visibleLineTotal = visibleTextLines.reduce((count, { lineCount }) => count + lineCount, 0);
  const firstElement = visibleTextLines[0]?.element ?? null;
  const lastElement = visibleTextLines.at(-1)?.element ?? null;
  const declOpenInline = plan.style === 'text-block' && isDeclInlineElement(firstElement);
  const declCloseInline = plan.style === 'text-block' && isDeclInlineElement(lastElement);
  const contentCallLine = plan.style === 'text-block' && plan.textLineCount > 0;
  const wrapperLines =
    plan.style === 'comment'
      ? 2
      : plan.style === 'text-block'
        ? (declOpenInline ? 0 : 1) + (declCloseInline ? 0 : 1)
        : 0;
  return {
    contentCallLine,
    declCloseInline,
    declOpenInline,
    foldBoundary: plan.foldable ? lastElement : null,
    hiddenTextElements,
    lineCount: visibleLineTotal + wrapperLines + 1 + plan.assets.length + (contentCallLine ? 1 : 0),
    visibleTextLines,
  };
}

export function countReplyCodeContentLines(
  content: NativePostContent | null,
  postId: number,
  expanded: boolean,
): number {
  const plan = createReplyCodePlan(content, postId);
  if (!plan) return 1;
  return resolveReplyCodeRegion(plan, expanded).lineCount;
}

export function summarizeReplyCodeLines(
  content: NativePostContent | null,
  postId: number,
  expanded: boolean,
): readonly NativeContentLineSummary[] {
  const plan = createReplyCodePlan(content, postId);
  if (!plan) return [{ indent: 0, kind: 'text', text: 'Content unavailable' }];
  const region = resolveReplyCodeRegion(plan, expanded);
  const scaffold = (text: string): NativeContentLineSummary => ({
    indent: 0,
    kind: 'scaffold',
    text,
  });
  const textSummaries = region.visibleTextLines.flatMap(({ element }) =>
    nativeElementLineTexts(element).map((text): NativeContentLineSummary => ({
      indent: readNativeLineIndent(element),
      kind: readNativeContentLineKind(element),
      text,
    })),
  );
  const assetSummaries = plan.assets.map(({ element, kind }): NativeContentLineSummary => ({
    indent: 0,
    kind: kind === 'image' ? 'media' : 'link',
    text: `reply.${kind === 'image' ? 'image' : kind}(${nativeLineText(element)});`,
  }));
  const newRepliesLine = scaffold('Replies reply = new Replies();');
  if (plan.style === 'single') {
    const single = textSummaries[0];
    return [
      newRepliesLine,
      ...assetSummaries,
      ...(single ? [{ ...single, text: `reply.content("${single.text}");` }] : []),
    ];
  }
  const lines: NativeContentLineSummary[] = [];
  if (plan.style === 'comment') {
    lines.push(
      scaffold('/**'),
      ...textSummaries.map((summary) => ({
        ...summary,
        text: `* ${summary.text}`,
      })),
      scaffold('*/'),
    );
  } else {
    const framed = [...textSummaries];
    const first = framed[0];
    if (region.declOpenInline && first) {
      framed[0] = { ...first, text: `String content = """ ${first.text}` };
    }
    const last = framed.at(-1);
    if (region.declCloseInline && last) {
      framed[framed.length - 1] = { ...last, text: `${last.text} """;` };
    }
    if (!region.declOpenInline) lines.push(scaffold('String content = """'));
    lines.push(...framed);
    if (!region.declCloseInline) lines.push(scaffold('""";'));
  }
  lines.push(newRepliesLine, ...assetSummaries);
  if (region.contentCallLine) lines.push(scaffold('reply.content(content);'));
  return lines;
}

function foldVisibleLines(textLines: readonly ReplyCodeTextLine[]): ReplyCodeTextLine[] {
  const visible: ReplyCodeTextLine[] = [];
  let total = 0;
  for (const line of textLines) {
    if (visible.length > 0 && total + line.lineCount > REPLY_CONTENT_FOLD_LIMIT) break;
    visible.push(line);
    total += line.lineCount;
    if (total >= REPLY_CONTENT_FOLD_LIMIT) break;
  }
  return visible;
}

function isDeclInlineElement(element: HTMLElement | null): boolean {
  return element !== null && DECL_INLINE_TAGS.has(element.tagName.toLowerCase());
}

function classifyAssetBlock(element: HTMLElement): ReplyCodeAssetKind | null {
  if (element.matches('aside.onebox')) {
    const href = readOneboxHref(element);
    return href && isGitHubHref(href) ? 'github' : 'link';
  }
  const lineElements = getNativeBlockLineElements(element);
  if (lineElements.length !== 1 || lineElements[0] !== element) return null;
  if (countNativeElementLines(element) !== 1) return null;
  if (readNativeContentLineKind(element) === 'media') return 'image';
  if (element.tagName.toLowerCase() !== 'p') return null;
  const anchors = element.querySelectorAll<HTMLAnchorElement>('a');
  const anchor = anchors[0];
  if (anchors.length !== 1 || !anchor) return null;
  if (anchor.matches('.mention, .mention-group, .hashtag, .hashtag-cooked, .hashtag-cooked a'))
    return null;
  if (anchor.querySelector('img, video, audio')) return null;
  const href = anchor.getAttribute('href');
  if (!href) return null;
  let url: URL;
  try {
    url = new URL(href, element.ownerDocument.baseURI);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const blockText = normalizeNativeLineText(element.textContent);
  const anchorText = normalizeNativeLineText(anchor.textContent);
  if (!anchorText || blockText !== anchorText) return null;
  return isGitHubHref(url.href) ? 'github' : 'link';
}
