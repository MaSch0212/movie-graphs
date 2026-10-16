import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';

import { TranslateService } from '../../../i18n/translate.service';
import { DialogComponent } from '../../ui/dialog/dialog.component';
import {
  buildGraphSvg,
  EXPORT_BACKGROUNDS,
  EXPORT_FORMATS,
  EXPORT_RESOLUTIONS,
  ExportBackground,
  ExportFormat,
  ExportOptions,
  ExportResolution,
  loadPosters,
  posterWidth,
  rasterScale,
  renderGraphImage,
  svgSize,
} from '../graph-export';
import { GraphLayout, NODE_WIDTH } from '../graph-layout';

/** SVGs scale freely, so their posters get a fixed quality that stays sharp when zooming in. */
const SVG_POSTER_SCALE = 4;

/** Downloads the graph as an SVG, PNG or JPEG image. */
@Component({
  selector: 'app-export-image-dialog',
  imports: [DialogComponent],
  templateUrl: './export-image-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExportImageDialogComponent {
  protected readonly translate = inject(TranslateService);

  public readonly layout = input.required<GraphLayout>();
  public readonly graphName = input.required<string>();

  protected readonly formats = EXPORT_FORMATS;
  protected readonly backgrounds = EXPORT_BACKGROUNDS;
  protected readonly resolutions = EXPORT_RESOLUTIONS;
  protected readonly backgroundIcons: Record<ExportBackground, string> = {
    light: 'icon-[mdi--white-balance-sunny]',
    dark: 'icon-[mdi--weather-night]',
    transparent: 'icon-[mdi--checkerboard]',
  };

  protected readonly visible = signal(false);
  protected readonly format = signal<ExportFormat>('png');
  protected readonly background = signal<ExportBackground>('dark');
  protected readonly dots = signal(true);
  protected readonly showStatus = signal(true);
  protected readonly resolution = signal<ExportResolution>(2);
  protected readonly isExporting = signal(false);
  protected readonly hasFailed = signal(false);

  protected readonly options = computed<ExportOptions>(() => ({
    format: this.format(),
    background: this.background(),
    dots: this.dots(),
    showStatus: this.showStatus(),
    resolution: this.resolution(),
  }));

  /** Scale of the graph in raster images (SVGs are always 1, they scale freely). */
  private readonly _scale = computed(() => {
    if (this.format() === 'svg') return 1;
    const { width, height } = svgSize(this.layout());
    return rasterScale(width, height, this.resolution());
  });
  /** Whether the image is smaller than the chosen resolution, because the browser can't do more. */
  protected readonly isResolutionLimited = computed(
    () => this.format() !== 'svg' && this._scale() < this.resolution()
  );
  /** Size of the downloaded image in pixels. */
  protected readonly imageSize = computed(() => {
    const { width, height } = svgSize(this.layout());
    const scale = this._scale();
    return { width: Math.floor(width * scale), height: Math.floor(height * scale) };
  });

  /** The posters as data URLs, in the quality needed for the chosen resolution. */
  private readonly _posterWidth = computed(() =>
    posterWidth(NODE_WIDTH, this.format() === 'svg' ? SVG_POSTER_SCALE : this._scale())
  );
  private readonly _posters = signal<
    { layout: GraphLayout; width: number; images: ReadonlyMap<string, string> } | undefined
  >(undefined);
  private _posterCache = new Map<number, Promise<ReadonlyMap<string, string>>>();
  private _posterCacheLayout?: GraphLayout;
  protected readonly isLoadingPosters = computed(() => {
    const posters = this._posters();
    return posters?.layout !== this.layout() || posters.width !== this._posterWidth();
  });

  /**
   * The image as SVG at its natural size. While sharper posters load, the preview keeps showing
   * the ones that are already there.
   */
  protected readonly svg = computed(() => {
    const posters = this._posters();
    if (!posters || posters.layout !== this.layout()) return undefined;
    return buildGraphSvg(this.layout(), this.options(), {
      images: posters.images,
      watchingLabel: this.translate.translations.status_watching(),
    });
  });

  protected readonly previewUrl = signal<string | undefined>(undefined);

  constructor() {
    effect(() => {
      if (this.visible()) this.loadPosters(this.layout(), this._posterWidth());
    });

    // The preview shows the same image that is downloaded, just smaller.
    effect(onCleanup => {
      const svg = this.visible() ? this.svg() : undefined;
      if (!svg) {
        this.previewUrl.set(undefined);
        return;
      }
      const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      this.previewUrl.set(url);
      onCleanup(() => URL.revokeObjectURL(url));
    });
  }

  public open() {
    this.hasFailed.set(false);
    this.visible.set(true);
  }

  protected setFormat(format: ExportFormat) {
    this.format.set(format);
    if (format === 'jpeg' && this.background() === 'transparent') this.background.set('light');
  }

  protected async download() {
    const posters = this._posters();
    if (!posters || this.isLoadingPosters() || this.isExporting()) return;
    this.isExporting.set(true);
    this.hasFailed.set(false);
    try {
      // Raster images are rendered from an SVG of their final size, so everything stays sharp.
      const svg = buildGraphSvg(
        this.layout(),
        this.options(),
        { images: posters.images, watchingLabel: this.translate.translations.status_watching() },
        this._scale()
      );
      const blob = await renderGraphImage(svg, this.options());
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${fileName(this.graphName())}.${this.format() === 'jpeg' ? 'jpg' : this.format()}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      this.visible.set(false);
    } catch {
      this.hasFailed.set(true);
    } finally {
      this.isExporting.set(false);
    }
  }

  private loadPosters(layout: GraphLayout, width: number) {
    if (this._posterCacheLayout !== layout) {
      this._posterCacheLayout = layout;
      this._posterCache = new Map();
    }
    let request = this._posterCache.get(width);
    if (!request) {
      request = loadPosters(layout.nodes, node => posterUrl(node.data.imageUrl, width));
      this._posterCache.set(width, request);
    }
    request.then(images => {
      // Only show them if they are still the ones needed.
      if (this.layout() === layout && this._posterWidth() === width) {
        this._posters.set({ layout, width, images });
      }
    });
  }
}

const posterUrl = (url: string, width: number) =>
  `${url}${url.includes('?') ? '&' : '?'}w=${width}`;

/** The graph's name without characters that are not allowed in file names. */
const fileName = (name: string) => name.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'graph';
