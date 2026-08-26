import vscodeAppIcon192 from '../../../assets/vscode-app-icon-192.png?inline';
import type { ShareCardModel, ShareCardTone } from './shareCard';

export interface ShareCardPalette {
  readonly editorBackground: string;
  readonly lineNumber: string;
  readonly titleText: string;
  readonly tones: Readonly<Record<ShareCardTone, string>>;
  readonly watermarkText: string;
}

const DEFAULT_PALETTE: ShareCardPalette = {
  editorBackground: '#1e1e1e',
  lineNumber: '#6e7681',
  titleText: '#cccccc',
  tones: {
    annotation: '#dcdcaa',
    comment: '#6a9955',
    constant: '#4fc1ff',
    declaration: '#569cd6',
    heading: '#dcdcaa',
    keyword: '#c586c0',
    link: '#4fc1ff',
    media: '#b5cea8',
    method: '#dcdcaa',
    plain: '#d4d4d4',
    punctuation: '#d4d4d4',
    quote: '#6a9955',
    string: '#ce9178',
    variable: '#9cdcfe',
  },
  watermarkText: '#9d9d9d',
};

const TONE_TOKEN_VARIABLES: Readonly<Partial<Record<ShareCardTone, string>>> = {
  annotation: '--docode-color-token-title',
  comment: '--docode-color-token-comment',
  constant: '--docode-color-token-constant',
  declaration: '--docode-color-token-declaration',
  heading: '--docode-color-token-title',
  keyword: '--docode-color-token-keyword',
  link: '--docode-color-token-constant',
  media: '--docode-color-token-count',
  method: '--docode-color-token-title',
  plain: '--docode-color-token-plain',
  punctuation: '--docode-color-token-plain',
  quote: '--docode-color-token-comment',
  string: '--docode-color-token-string',
  variable: '--docode-color-token-participant',
};

export function readShareCardPalette(workbenchRoot: HTMLElement | null): ShareCardPalette {
  if (!workbenchRoot?.ownerDocument.defaultView) return DEFAULT_PALETTE;
  const styles = workbenchRoot.ownerDocument.defaultView.getComputedStyle(workbenchRoot);
  const read = (variable: string, fallback: string): string => {
    const value = styles.getPropertyValue(variable).trim();
    return value === '' ? fallback : value;
  };
  const tones = Object.fromEntries(
    Object.entries(DEFAULT_PALETTE.tones).map(([tone, fallback]) => {
      const variable = TONE_TOKEN_VARIABLES[tone as ShareCardTone];
      return [tone, variable ? read(variable, fallback) : fallback];
    }),
  ) as Record<ShareCardTone, string>;
  return {
    editorBackground: read('--docode-color-editor-background', DEFAULT_PALETTE.editorBackground),
    lineNumber: read('--docode-color-editor-line-number', DEFAULT_PALETTE.lineNumber),
    titleText: DEFAULT_PALETTE.titleText,
    tones,
    watermarkText: DEFAULT_PALETTE.watermarkText,
  };
}

const SCALE = 2;
const CODE_FONT = '13px Menlo, Monaco, "SF Mono", "Courier New", monospace';
const UI_FONT = '12px -apple-system, "Segoe UI", system-ui, sans-serif';
const UI_FONT_BOLD = '600 12.5px -apple-system, "Segoe UI", system-ui, sans-serif';
const LINE_HEIGHT = 20;
const INDENT_WIDTH = 16;
const OUTER_PADDING = 32;
const CARD_RADIUS = 12;
const TITLEBAR_HEIGHT = 40;
const CODE_PADDING_X = 20;
const CODE_PADDING_TOP = 14;
const CODE_PADDING_BOTTOM = 10;
const FOOTER_HEIGHT = 42;
const GUTTER_GAP = 18;
const MAX_CODE_WIDTH = 720;
const MIN_CARD_WIDTH = 520;

export async function renderShareCard(
  model: ShareCardModel,
  palette: ShareCardPalette,
  targetDocument: Document = document,
): Promise<HTMLCanvasElement> {
  const [icon, avatar] = await Promise.all([
    loadIcon(targetDocument),
    loadAvatar(model.avatarUrl, targetDocument),
  ]);
  const canvas = targetDocument.createElement('canvas');
  const measure = canvas.getContext('2d');
  if (!measure) throw new Error('Canvas 2D rendering is unavailable.');

  measure.font = CODE_FONT;
  const gutterWidth = Math.max(
    ...model.lines.map((line) => measure.measureText(String(line.number)).width),
  );
  let codeWidth = 0;
  for (const line of model.lines) {
    const indentWidth = line.indent * INDENT_WIDTH;
    const textWidth = line.segments.reduce(
      (total, part) => total + measure.measureText(part.text).width,
      0,
    );
    codeWidth = Math.max(codeWidth, indentWidth + textWidth);
  }
  codeWidth = Math.min(codeWidth, MAX_CODE_WIDTH);

  const cardWidth = Math.max(
    MIN_CARD_WIDTH,
    Math.ceil(CODE_PADDING_X + gutterWidth + GUTTER_GAP + codeWidth + CODE_PADDING_X),
  );
  const cardHeight =
    TITLEBAR_HEIGHT +
    CODE_PADDING_TOP +
    model.lines.length * LINE_HEIGHT +
    CODE_PADDING_BOTTOM +
    FOOTER_HEIGHT;
  const width = cardWidth + OUTER_PADDING * 2;
  const height = cardHeight + OUTER_PADDING * 2;

  canvas.width = width * SCALE;
  canvas.height = height * SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D rendering is unavailable.');
  ctx.scale(SCALE, SCALE);

  const cardX = OUTER_PADDING;
  const cardY = OUTER_PADDING;
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 14;
  roundedRect(ctx, cardX, cardY, cardWidth, cardHeight, CARD_RADIUS);
  ctx.fillStyle = palette.editorBackground;
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundedRect(ctx, cardX, cardY, cardWidth, cardHeight, CARD_RADIUS);
  ctx.clip();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.fillRect(cardX, cardY, cardWidth, TITLEBAR_HEIGHT);
  const lightY = cardY + TITLEBAR_HEIGHT / 2;
  for (const [index, color] of ['#ff5f57', '#febc2e', '#28c840'].entries()) {
    ctx.beginPath();
    ctx.arc(cardX + 20 + index * 20, lightY, 6, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
  ctx.font = UI_FONT;
  ctx.fillStyle = palette.titleText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(model.fileName, cardX + cardWidth / 2, lightY, cardWidth - 180);
  ctx.textAlign = 'left';

  if (avatar) {
    const codeAreaTop = cardY + TITLEBAR_HEIGHT;
    const codeAreaHeight = cardHeight - TITLEBAR_HEIGHT - FOOTER_HEIGHT;
    const ghostSize = Math.min(Math.round(codeAreaHeight * 0.86), 210);
    if (ghostSize >= 56) {
      const ghost = createAvatarGhost(avatar, ghostSize, targetDocument);
      if (ghost) {
        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.globalCompositeOperation = isLightColor(palette.editorBackground)
          ? 'multiply'
          : 'screen';
        ctx.drawImage(
          ghost,
          cardX + cardWidth - ghostSize - 26,
          codeAreaTop + (codeAreaHeight - ghostSize) / 2,
          ghostSize,
          ghostSize,
        );
        ctx.restore();
      }
    }
  }

  ctx.font = CODE_FONT;
  const codeLeft = cardX + CODE_PADDING_X + gutterWidth + GUTTER_GAP;
  const maxTextRight = cardX + cardWidth - CODE_PADDING_X;
  model.lines.forEach((line, index) => {
    const y = cardY + TITLEBAR_HEIGHT + CODE_PADDING_TOP + index * LINE_HEIGHT + LINE_HEIGHT / 2;
    ctx.textAlign = 'right';
    ctx.fillStyle = palette.lineNumber;
    ctx.fillText(String(line.number), cardX + CODE_PADDING_X + gutterWidth, y);
    ctx.textAlign = 'left';
    let x = codeLeft + line.indent * INDENT_WIDTH;
    for (const part of line.segments) {
      if (x >= maxTextRight - 8) break;
      const text = clipText(ctx, part.text, maxTextRight - x);
      ctx.fillStyle = palette.tones[part.tone];
      ctx.fillText(text, x, y);
      x += ctx.measureText(text).width;
      if (text !== part.text) break;
    }
  });

  const footerTop = cardY + cardHeight - FOOTER_HEIGHT;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cardX + CODE_PADDING_X, footerTop + 0.5);
  ctx.lineTo(cardX + cardWidth - CODE_PADDING_X, footerTop + 0.5);
  ctx.stroke();

  const footerY = footerTop + FOOTER_HEIGHT / 2;
  const iconSize = 16;
  ctx.drawImage(icon, cardX + CODE_PADDING_X, footerY - iconSize / 2, iconSize, iconSize);
  ctx.font = UI_FONT_BOLD;
  ctx.fillStyle = palette.titleText;
  const brandX = cardX + CODE_PADDING_X + iconSize + 8;
  ctx.fillText('DOCode', brandX, footerY);
  const brandWidth = ctx.measureText('DOCode').width;
  ctx.font = UI_FONT;
  ctx.fillStyle = palette.watermarkText;
  ctx.fillText(' · VS Code your Linux DO', brandX + brandWidth, footerY);
  ctx.textAlign = 'right';
  ctx.fillText(
    clipText(ctx, model.permalinkLabel, cardWidth / 2),
    cardX + cardWidth - CODE_PADDING_X,
    footerY,
  );
  ctx.textAlign = 'left';
  ctx.restore();

  return canvas;
}

function clipText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let clipped = text;
  while (clipped.length > 1 && ctx.measureText(`${clipped}…`).width > maxWidth) {
    clipped = clipped.slice(0, -Math.max(1, Math.ceil(clipped.length * 0.06)));
  }
  return `${clipped}…`;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function createAvatarGhost(
  avatar: HTMLImageElement,
  size: number,
  targetDocument: Document,
): HTMLCanvasElement | null {
  const ghost = targetDocument.createElement('canvas');
  ghost.width = size;
  ghost.height = size;
  const ghostCtx = ghost.getContext('2d');
  if (!ghostCtx) return null;
  const radius = Math.round(size * 0.14);
  roundedRect(ghostCtx, 0, 0, size, size, radius);
  ghostCtx.clip();
  const cover = Math.max(
    size / (avatar.naturalWidth || size),
    size / (avatar.naturalHeight || size),
  );
  const drawWidth = (avatar.naturalWidth || size) * cover;
  const drawHeight = (avatar.naturalHeight || size) * cover;
  ghostCtx.drawImage(
    avatar,
    (size - drawWidth) / 2,
    (size - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
  const fade = ghostCtx.createLinearGradient(0, 0, size, 0);
  fade.addColorStop(0, 'rgba(0, 0, 0, 0)');
  fade.addColorStop(0.45, 'rgba(0, 0, 0, 1)');
  fade.addColorStop(1, 'rgba(0, 0, 0, 1)');
  ghostCtx.globalCompositeOperation = 'destination-in';
  ghostCtx.fillStyle = fade;
  ghostCtx.fillRect(0, 0, size, size);
  return ghost;
}

function isLightColor(color: string): boolean {
  const match = /^#([0-9a-f]{6})$/iu.exec(color.trim());
  if (!match?.[1]) return false;
  const value = Number.parseInt(match[1], 16);
  const luminance =
    0.2126 * ((value >> 16) & 0xff) + 0.7152 * ((value >> 8) & 0xff) + 0.0722 * (value & 0xff);
  return luminance > 128;
}

const AVATAR_SIZE_SEGMENT_PATTERN = /\/(\d{2,3})\//u;
const AVATAR_LOAD_TIMEOUT_MS = 3_000;

function loadAvatar(
  avatarUrl: string | null,
  targetDocument: Document,
): Promise<HTMLImageElement | null> {
  if (!avatarUrl) return Promise.resolve(null);
  const upscaled = avatarUrl.includes('/user_avatar/')
    ? avatarUrl.replace(AVATAR_SIZE_SEGMENT_PATTERN, '/288/')
    : avatarUrl;
  const attempt = (source: string): Promise<HTMLImageElement | null> =>
    new Promise((resolve) => {
      const image = targetDocument.createElement('img');
      const timer = setTimeout(() => {
        resolve(null);
      }, AVATAR_LOAD_TIMEOUT_MS);
      image.crossOrigin = 'anonymous';
      image.onload = () => {
        clearTimeout(timer);
        resolve(image);
      };
      image.onerror = () => {
        clearTimeout(timer);
        resolve(null);
      };
      image.src = source;
    });
  return attempt(upscaled).then(
    (image) => image ?? (upscaled === avatarUrl ? null : attempt(avatarUrl)),
  );
}

function loadIcon(targetDocument: Document): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = targetDocument.createElement('img');
    image.onload = () => {
      resolve(image);
    };
    image.onerror = () => {
      reject(new Error('Unable to load the DOCode watermark icon.'));
    };
    image.src = vscodeAppIcon192;
  });
}
