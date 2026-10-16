import { ApiGraphNode, ApiGraphNodeStatus } from '../../api/models';
import { GraphLayout, LayoutNode } from './graph-layout';

export const EXPORT_FORMATS = ['svg', 'png', 'jpeg'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];
export const EXPORT_BACKGROUNDS = ['light', 'dark', 'transparent'] as const;
export type ExportBackground = (typeof EXPORT_BACKGROUNDS)[number];
/** Size of raster images relative to the graph. */
export const EXPORT_RESOLUTIONS = [1, 2, 3] as const;
export type ExportResolution = (typeof EXPORT_RESOLUTIONS)[number];

export type ExportOptions = {
  format: ExportFormat;
  background: ExportBackground;
  dots: boolean;
  showStatus: boolean;
  resolution: ExportResolution;
};

export type SvgContent = {
  /** The image of each node, usually a data URL so the SVG is self-contained. */
  images: ReadonlyMap<string, string>;
  /** Text of the label on the title being watched. */
  watchingLabel: string;
  /** The full title of a node, shown by SVG viewers on hover. */
  title: (node: ApiGraphNode) => string;
};

type Palette = {
  canvas?: string;
  dot: string;
  surface: string;
  edge: string;
} & Record<Exclude<ApiGraphNodeStatus, 'unwatched'>, string>;

// The app's theme colors (see styles.css) as hex, because not every SVG viewer supports oklch.
const PALETTES: Record<ExportBackground, Palette> = {
  light: {
    canvas: '#f6f7fa',
    dot: '#cbced4',
    surface: '#ffffff',
    edge: '#93a4f7',
    watched: '#20b561',
    watching: '#226cff',
    ignored: '#84868c',
  },
  dark: {
    canvas: '#0d0f15',
    dot: '#2b2e36',
    surface: '#1f212a',
    edge: '#4b5698',
    watched: '#3ec873',
    watching: '#3a82ff',
    ignored: '#7e8086',
  },
  // Works on light and dark backgrounds.
  transparent: {
    dot: '#7e808680',
    surface: '#ffffff',
    edge: '#717adf',
    watched: '#20b561',
    watching: '#226cff',
    ignored: '#84868c',
  },
};

// Material Design Icons (24×24), the same ones the app shows.
const ICONS: Record<Exclude<ApiGraphNodeStatus, 'unwatched'>, string> = {
  watched: 'm9 20.42l-6.21-6.21l2.83-2.83L9 14.77l9.88-9.89l2.83 2.83z',
  watching: 'M8 5.14v14l11-7z',
  ignored: 'M16 18h2V6h-2M6 18l8.5-6L6 6z',
};

const PADDING = 20;
const DOT_SPACING = 28;
const RADIUS = 10;
const BADGE_SIZE = 26;
const BAND_HEIGHT = 18;
const BAND_ICON = 11;
/** Widths the server can scale posters to. */
const POSTER_WIDTHS = [200, 400, 800] as const;

export type CanvasLimits = { maxPixels: number; maxSide: number };
/** iOS Safari can't create canvases larger than 16.7 megapixels. */
const IOS_LIMITS: CanvasLimits = { maxPixels: 16_000_000, maxSide: 16_384 };
/** Other browsers allow more, but very large canvases need a lot of memory (4 bytes per pixel). */
const DEFAULT_LIMITS: CanvasLimits = { maxPixels: 120_000_000, maxSide: 32_000 };

export function canvasLimits(): CanvasLimits {
  const isIos =
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return isIos ? IOS_LIMITS : DEFAULT_LIMITS;
}

/**
 * Builds a self-contained SVG image of the graph, styled like the app when zoomed in.
 * `scale` sets the size the image is shown at, so browsers rasterize it at that resolution.
 */
export function buildGraphSvg(
  layout: GraphLayout,
  options: ExportOptions,
  content: SvgContent,
  scale = 1
) {
  const palette = PALETTES[options.background];
  const { width, height } = svgSize(layout);
  const offset = (value: number) => round(value + PADDING);
  const parts: string[] = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.floor(width * scale)}" ` +
      `height="${Math.floor(height * scale)}" viewBox="0 0 ${width} ${height}">`,
    '<defs>',
    '<filter id="grayscale"><feColorMatrix type="saturate" values="0"/></filter>',
    '<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter>',
    `<pattern id="dots" width="${DOT_SPACING}" height="${DOT_SPACING}" patternUnits="userSpaceOnUse">` +
      `<circle cx="${DOT_SPACING / 2}" cy="${DOT_SPACING / 2}" r="1.1" fill="${palette.dot}"/></pattern>`,
    ...layout.nodes.map(
      (node, i) =>
        `<clipPath id="poster-${i}"><rect x="${offset(node.position.x)}" y="${offset(node.position.y)}" ` +
        `width="${node.dimension.width}" height="${node.dimension.height}" rx="${RADIUS}"/></clipPath>`
    ),
    '</defs>'
  );

  if (palette.canvas) {
    parts.push(`<rect width="100%" height="100%" fill="${palette.canvas}"/>`);
  }
  if (options.dots) {
    parts.push('<rect width="100%" height="100%" fill="url(#dots)"/>');
  }

  parts.push(`<g transform="translate(${PADDING} ${PADDING})">`);
  for (const edge of layout.edges) {
    parts.push(
      `<path d="${edge.path}" fill="none" stroke="${palette.edge}" stroke-width="2.5" stroke-linecap="round"/>`,
      `<path d="${edge.arrow}" fill="${palette.edge}" stroke-linejoin="round"/>`
    );
  }
  parts.push('</g>');

  layout.nodes.forEach((node, i) => {
    parts.push(nodeSvg(node, `poster-${i}`, offset, palette, options.showStatus, content));
  });

  parts.push('</svg>');
  return parts.join('');
}

function nodeSvg(
  node: LayoutNode,
  clipId: string,
  offset: (value: number) => number,
  palette: Palette,
  showStatus: boolean,
  content: SvgContent
) {
  const x = offset(node.position.x);
  const y = offset(node.position.y);
  const { width, height } = node.dimension;
  const status = node.data.status;
  const parts: string[] = [`<g><title>${escapeXml(content.title(node.data))}</title>`];

  // Glow behind the title being watched.
  if (showStatus && status === 'watching') {
    parts.push(
      `<rect x="${x - 5}" y="${y - 5}" width="${width + 10}" height="${height + 10}" rx="${RADIUS + 5}" ` +
        `fill="${palette.watching}" opacity="0.6" filter="url(#glow)"/>`
    );
  }

  const posterStyle =
    !showStatus || status === 'unwatched' || status === 'watching'
      ? ''
      : status === 'watched'
        ? ' opacity="0.7"'
        : ' opacity="0.3" filter="url(#grayscale)"';
  parts.push(
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${RADIUS}" fill="${palette.surface}"/>`
  );
  const image = content.images.get(node.id);
  if (image) {
    parts.push(
      `<image href="${escapeXml(image)}" x="${x}" y="${y}" width="${width}" height="${height}" ` +
        `preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"${posterStyle}/>`
    );
  }

  if (showStatus && status !== 'unwatched') {
    const color = palette[status];
    const ring = status === 'watching' ? 5 : 3;
    // A frame around the poster, like the box shadow in the app.
    parts.push(
      `<rect x="${x - ring / 2}" y="${y - ring / 2}" width="${width + ring}" height="${height + ring}" ` +
        `rx="${RADIUS + ring / 2}" fill="none" stroke="${color}" stroke-width="${ring}"` +
        `${status === 'ignored' ? ` stroke-dasharray="${ring * 2} ${ring * 1.5}"` : ''}/>`
    );

    if (status === 'watching') {
      // Play icon and label, centered together.
      const bandY = y + height - BAND_HEIGHT;
      const labelWidth = textWidth(content.watchingLabel);
      const start = x + (width - BAND_ICON - 2 - labelWidth) / 2;
      parts.push(
        `<rect x="${x}" y="${bandY}" width="${width}" height="${BAND_HEIGHT}" fill="${color}" clip-path="url(#${clipId})"/>`,
        icon(ICONS.watching, start + BAND_ICON / 2, bandY + BAND_HEIGHT / 2, BAND_ICON),
        `<text x="${round(start + BAND_ICON + 2 + labelWidth / 2)}" y="${bandY + BAND_HEIGHT / 2}" fill="#fff" ` +
          `font-family="Inter, system-ui, sans-serif" font-size="10" font-weight="700" letter-spacing="0.2" ` +
          `text-anchor="middle" dominant-baseline="central">${escapeXml(content.watchingLabel.toUpperCase())}</text>`
      );
    } else {
      const cx = x + width - 4 - BADGE_SIZE / 2;
      const cy = y + 4 + BADGE_SIZE / 2;
      parts.push(
        `<circle cx="${cx}" cy="${cy}" r="${BADGE_SIZE / 2 - 1}" fill="${color}" stroke="${palette.surface}" stroke-width="2"/>`,
        icon(ICONS[status], cx, cy, 14)
      );
    }
  }

  parts.push('</g>');
  return parts.join('');
}

/** An icon centered on (cx, cy). */
function icon(path: string, cx: number, cy: number, size: number) {
  const scale = size / 24;
  return (
    `<path d="${path}" fill="#fff" ` +
    `transform="translate(${round(cx - size / 2)} ${round(cy - size / 2)}) scale(${round(scale)})"/>`
  );
}

/** Rough width of the uppercase band label, to place the icon in front of it. */
const textWidth = (text: string) => text.length * 6.6;

export function svgSize(layout: GraphLayout) {
  return {
    width: Math.ceil(layout.bounds.width + 2 * PADDING),
    height: Math.ceil(layout.bounds.height + 2 * PADDING),
  };
}

/** Scale for raster images: the chosen resolution, but within the browser's canvas limits. */
export function rasterScale(
  width: number,
  height: number,
  resolution: number,
  limits: CanvasLimits = canvasLimits()
) {
  return Math.min(
    resolution,
    Math.sqrt(limits.maxPixels / (width * height)),
    limits.maxSide / width,
    limits.maxSide / height
  );
}

/** The smallest poster width that is still sharp when the graph is shown at `scale`. */
export function posterWidth(posterSize: number, scale: number) {
  return POSTER_WIDTHS.find(width => width >= posterSize * scale) ?? POSTER_WIDTHS[2];
}

/** Renders the SVG (already sized to the wanted resolution) into the requested format. */
export async function renderGraphImage(svg: string, options: ExportOptions): Promise<Blob> {
  const svgBlob = new Blob([svg], { type: 'image/svg+xml' });
  if (options.format === 'svg') return svgBlob;

  const url = URL.createObjectURL(svgBlob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();

    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is not supported');
    if (options.format === 'jpeg') {
      // JPEG has no transparency.
      context.fillStyle = PALETTES[options.background].canvas ?? '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const type = options.format === 'png' ? 'image/png' : 'image/jpeg';
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        blob => (blob ? resolve(blob) : reject(new Error('Rendering the image failed'))),
        type,
        0.92
      )
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Loads the posters as data URLs, so they can be embedded into the SVG. */
export async function loadPosters(
  nodes: readonly LayoutNode[],
  url: (node: LayoutNode) => string
): Promise<Map<string, string>> {
  const entries = await Promise.all(
    nodes.map(async node => {
      try {
        const response = await fetch(url(node));
        if (!response.ok) return undefined;
        return [node.id, await toDataUrl(await response.blob())] as const;
      } catch {
        // The title is exported without its poster.
        return undefined;
      }
    })
  );
  return new Map(entries.filter(entry => entry !== undefined));
}

function toDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

const escapeXml = (value: string) =>
  value.replace(
    /[<>&"']/g,
    char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char] ?? char
  );

const round = (value: number) => Math.round(value * 100) / 100;
