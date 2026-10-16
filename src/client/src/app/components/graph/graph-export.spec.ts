import { ApiGraphNodeStatus } from '../../api/models';
import { buildGraphSvg, ExportOptions, posterWidth, rasterScale } from './graph-export';
import { GraphLayout } from './graph-layout';

const node = (id: string, status: ApiGraphNodeStatus, x: number) => ({
  id,
  data: {
    id,
    name: `Title <${id}> & "more"`,
    type: 'movie' as const,
    imageUrl: `images/${id}`,
    status,
  },
  position: { x, y: 0 },
  dimension: { width: 90, height: 135 },
});

const layout: GraphLayout = {
  nodes: [node('a', 'watched', 0), node('b', 'watching', 150), node('c', 'unwatched', 300)],
  edges: [{ id: 'a->b', path: 'M94,67 L135,67', arrow: 'M146,67 L135,72 L135,62 Z' }],
  bounds: { x: 0, y: 0, width: 390, height: 135 },
};

const options: ExportOptions = {
  format: 'svg',
  background: 'dark',
  dots: true,
  showStatus: true,
  resolution: 2,
};

const content = {
  images: new Map([['a', 'data:image/jpeg;base64,AAAA']]),
  watchingLabel: 'Watching',
  title: (node: { name: string }) => node.name,
};

const parse = (svg: string) => new DOMParser().parseFromString(svg, 'image/svg+xml');

describe('buildGraphSvg', () => {
  it('creates valid SVG with padding around the graph and escaped titles', () => {
    const doc = parse(buildGraphSvg(layout, options, content));
    expect(doc.querySelector('parsererror')).toBeNull();
    const svg = doc.documentElement;
    expect(svg.getAttribute('width')).toBe('430');
    expect(svg.getAttribute('height')).toBe('175');
    expect([...doc.querySelectorAll('title')].map(t => t.textContent)).toContain(
      'Title <a> & "more"'
    );
  });

  it('can be sized for a higher resolution, keeping its coordinates', () => {
    const svg = parse(buildGraphSvg(layout, options, content, 2.5)).documentElement;
    expect(svg.getAttribute('width')).toBe('1075');
    expect(svg.getAttribute('height')).toBe('437');
    expect(svg.getAttribute('viewBox')).toBe('0 0 430 175');
  });

  it('embeds only the posters that could be loaded', () => {
    const doc = parse(buildGraphSvg(layout, options, content));
    const images = doc.querySelectorAll('image');
    expect(images.length).toBe(1);
    expect(images[0].getAttribute('href')).toBe('data:image/jpeg;base64,AAAA');
  });

  it('draws background and dots depending on the options', () => {
    const fills = (o: ExportOptions) =>
      [...parse(buildGraphSvg(layout, o, content)).querySelectorAll('svg > rect')].map(r =>
        r.getAttribute('fill')
      );
    expect(fills(options)).toEqual(['#0d0f15', 'url(#dots)']);
    expect(fills({ ...options, background: 'light', dots: false })).toEqual(['#f6f7fa']);
    expect(fills({ ...options, background: 'transparent', dots: false })).toEqual([]);
  });

  it('shows the status only when asked to', () => {
    const badges = (svg: string) => parse(svg).querySelectorAll('g > circle').length;
    const withStatus = buildGraphSvg(layout, options, content);
    expect(withStatus).toContain('WATCHING');
    expect(badges(withStatus)).toBe(1);
    const withoutStatus = buildGraphSvg(layout, { ...options, showStatus: false }, content);
    expect(withoutStatus).not.toContain('WATCHING');
    expect(badges(withoutStatus)).toBe(0);
    expect(withoutStatus).not.toContain('opacity="0.7"');
  });
});

describe('rasterScale', () => {
  const desktop = { maxPixels: 120_000_000, maxSide: 32_000 };
  const ios = { maxPixels: 16_000_000, maxSide: 16_384 };

  it('uses the chosen resolution when possible', () => {
    expect(rasterScale(1000, 500, 3, desktop)).toBe(3);
    expect(rasterScale(1000, 500, 1, ios)).toBe(1);
  });

  it('stays within the canvas limits of the browser', () => {
    const scale = rasterScale(10_520, 1420, 3, desktop);
    expect(scale).toBeLessThan(3);
    expect(10_520 * scale * 1420 * scale).toBeLessThanOrEqual(120_000_001);
    expect(
      rasterScale(10_520, 1420, 2, ios) * 10_520 * rasterScale(10_520, 1420, 2, ios) * 1420
    ).toBeLessThanOrEqual(16_000_001);
    expect(rasterScale(30_000, 100, 3, ios) * 30_000).toBeLessThanOrEqual(16_384);
  });
});

describe('posterWidth', () => {
  it('picks the smallest poster size that is sharp at the scale', () => {
    expect(posterWidth(90, 1)).toBe(200);
    expect(posterWidth(90, 2)).toBe(200);
    expect(posterWidth(90, 3)).toBe(400);
    expect(posterWidth(90, 10)).toBe(800);
  });
});
