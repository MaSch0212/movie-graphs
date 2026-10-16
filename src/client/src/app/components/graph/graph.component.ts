import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  resource,
  signal,
  untracked,
  viewChild,
  WritableSignal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { produce } from 'immer';

import { ApiGraphNode } from '../../api/models';
import { GraphsService } from '../../api/services';
import { TranslateService } from '../../i18n/translate.service';
import { episodeInfo, fullTitle, shortTitle } from '../../utils/node-title';
import { forgetRecentGraph, rememberRecentGraph } from '../../utils/recent-graphs';
import { ConfirmService } from '../ui/confirm-dialog/confirm.service';
import {
  currentLanguageName,
  LanguageOptionsComponent,
} from '../ui/language-switcher/language-options.component';
import { MenuComponent } from '../ui/menu/menu.component';
import { CopyGraphDialogComponent } from './copy-graph-dialog/copy-graph-dialog.component';
import { ExportImageDialogComponent } from './export-image-dialog/export-image-dialog.component';
import { computeGraphLayout, EMPTY_LAYOUT, GraphLayout, LayoutNode } from './graph-layout';
import {
  GraphNodeDialogComponent,
  NodeChangeEvent,
} from './graph-node-dialog/graph-node-dialog.component';
import { bindPanZoom, PanZoomController, Size, ViewTransform } from './pan-zoom';

const MIN_ZOOM = 0.03;
const MAX_ZOOM = 4;
const FIT_PADDING = 32;
/** The scale the view starts with (and is reset to), around the title to watch next. */
const READABLE_ZOOM = 0.6;
const DOT_SPACING = 28;
/** Screen pixels of the graph that have to stay visible when panning towards an edge. */
const VISIBLE_MARGIN = 96;
/** Width of the poster thumbnails requested from the server. */
const THUMBNAIL_WIDTH = 400;
/**
 * On touch devices the document gets a small scroll offset. Without it, iOS doesn't lay out the
 * page across the whole screen (behind the status bar / home indicator) when it runs as a home
 * screen app. The graph itself is fixed, so the offset is not visible.
 */
const EDGE_TO_EDGE_SCROLL_OFFSET = 62;
/**
 * Below these scales the posters are too small to be recognized, so their status is shown as big
 * stamps that grow (in world units) when zooming out further. Only crossing a threshold restyles
 * the canvas, so zooming stays smooth.
 */
const SHOW_TITLES_KEY = 'movie-graphs.show-titles';
const SHOW_STATUS_KEY = 'movie-graphs.show-status';

const ZOOM_LEVELS = [
  { level: 'far', below: 0.18 },
  { level: 'mid', below: 0.4 },
] as const;

@Component({
  selector: 'app-graph',
  imports: [
    CopyGraphDialogComponent,
    ExportImageDialogComponent,
    GraphNodeDialogComponent,
    LanguageOptionsComponent,
    MenuComponent,
    RouterLink,
  ],
  templateUrl: './graph.component.html',
  styleUrl: './graph.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class GraphComponent {
  private readonly _graphsService = inject(GraphsService);
  private readonly _document = inject(DOCUMENT);
  private readonly _router = inject(Router);
  private readonly _confirmService = inject(ConfirmService);
  protected readonly translate = inject(TranslateService);
  private readonly _routeParams = toSignal(inject(ActivatedRoute).params);

  private readonly _viewport = viewChild<ElementRef<HTMLElement>>('viewport');
  private readonly _content = viewChild<ElementRef<HTMLElement>>('content');
  private readonly _dots = viewChild<ElementRef<HTMLElement>>('dots');
  private readonly _graphId = computed(() => String(this._routeParams()?.['id'] ?? ''));

  /** Only updated while the tooltip is shown; the canvas itself is moved outside of Angular. */
  private readonly _tooltipTransform = signal<ViewTransform>({ x: 0, y: 0, k: 1 });
  private readonly _panZoom = new PanZoomController({
    minScale: MIN_ZOOM,
    maxScale: MAX_ZOOM,
    onChange: () => this.scheduleRender(),
    getConstraints: () => {
      const viewport = this._viewport()?.nativeElement;
      const { bounds } = this.layout();
      if (!viewport || bounds.width === 0) return undefined;
      return { bounds, viewport: this.visibleViewport(viewport), margin: VISIBLE_MARGIN };
    },
  });
  private _unbindPanZoom?: () => void;
  private _renderFrame?: number;
  private _idleTimer?: ReturnType<typeof setTimeout>;
  private _layoutGraphId?: string;
  private _initializedGraphId?: string;
  private _pendingPanToNodeId?: string;
  private _zoomLevel?: string;

  protected readonly graph = resource({
    params: () => this._graphId(),
    loader: async ({ params }) => {
      if (!params) return undefined;
      const response = await this._graphsService.getGraph({ graphId: params });
      if (!response.ok) throw response.error;
      return response.body;
    },
  });

  protected readonly graphName = computed(() => this.graph.value()?.graph.name);
  protected readonly layout = signal<GraphLayout>(EMPTY_LAYOUT);
  protected readonly hoveredNode = signal<LayoutNode | undefined>(undefined);
  /** A short message shown at the top of the screen. */
  protected readonly notice = signal<{ text: string; error?: boolean } | undefined>(undefined);
  private _noticeTimer?: ReturnType<typeof setTimeout>;
  /** Whether the "More" menu shows the language choices instead of its main items. */
  protected readonly languageMenuShown = signal(false);
  protected readonly currentLanguageName = computed(() => currentLanguageName(this.translate));

  protected readonly stats = computed(() => {
    const nodes = this.graph.value()?.graph.nodes ?? [];
    const relevant = nodes.filter(node => node.status !== 'ignored');
    const watched = relevant.filter(node => node.status === 'watched').length;
    return {
      total: relevant.length,
      watched,
      percent: relevant.length ? Math.round((watched / relevant.length) * 100) : 0,
    };
  });

  /** Everything about the hovered title besides its name, e.g. "Season 1 · 2015 · Disney+". */
  protected readonly tooltipDetails = computed(() => {
    const node = this.hoveredNode()?.data;
    if (!node) return '';
    const t = this.translate.translations;
    return [
      episodeInfo(node, t),
      node.year,
      node.whereToWatch,
      node.duration ? `${node.duration.slice(0, 5)} ${t.graph_hours()}` : undefined,
    ]
      .filter(Boolean)
      .join(' · ');
  });

  // Display options, remembered on this device.
  protected readonly SHOW_TITLES_KEY = SHOW_TITLES_KEY;
  protected readonly SHOW_STATUS_KEY = SHOW_STATUS_KEY;
  /** Whether the titles are shown on the posters. */
  protected readonly showTitles = signal(loadFlag(SHOW_TITLES_KEY, false));
  /** Whether frames, badges and stamps show the watch status of the titles. */
  protected readonly showStatus = signal(loadFlag(SHOW_STATUS_KEY, true));
  /** What the posters show when titles are shown: the (short) title and season / episodes. */
  protected readonly posterTitles = computed(() => {
    const t = this.translate.translations;
    return new Map(
      (this.graph.value()?.graph.nodes ?? []).map(node => [
        node.id,
        { title: shortTitle(node), episodes: episodeInfo(node, t, true) },
      ])
    );
  });

  protected readonly title = (node: ApiGraphNode) => fullTitle(node, this.translate.translations);

  protected showTooltip(node: LayoutNode) {
    // The transform may have changed since the last tooltip was shown.
    this._tooltipTransform.set(this._panZoom.transform);
    this.hoveredNode.set(node);
  }

  protected readonly tooltip = computed(() => {
    const node = this.hoveredNode();
    if (!node) return undefined;
    const { x, y, k } = this._tooltipTransform();
    return {
      node: node.data,
      left: x + (node.position.x + node.dimension.width / 2) * k,
      top: y + node.position.y * k,
    };
  });

  constructor() {
    // Re-run the layout whenever nodes or edges change. The previous layout stays visible until
    // the new one is ready, and results of outdated runs are discarded.
    let layoutRun = 0;
    effect(() => {
      const graph = this.graph.value()?.graph;
      if (!graph) return;
      untracked(() => rememberRecentGraph({ id: graph.id, name: graph.name }));
      const run = ++layoutRun;
      computeGraphLayout(graph.nodes, graph.edges).then(layout => {
        if (run !== layoutRun) return;
        this._layoutGraphId = graph.id;
        this.layout.set(layout);
        untracked(() => this.onLayoutChanged());
      });
    });

    // The canvas only exists once the graph has loaded, so (re-)attach the gestures to it.
    effect(() => {
      const viewport = this._viewport()?.nativeElement;
      untracked(() => {
        this._unbindPanZoom?.();
        this._unbindPanZoom = undefined;
        if (!viewport) return;
        this._unbindPanZoom = bindPanZoom(viewport, this._panZoom);
        this._initializedGraphId = undefined;
        this.onLayoutChanged();
        this.render();
      });
    });

    if (this._document.defaultView?.matchMedia('(pointer: coarse)').matches) {
      const root = this._document.documentElement;
      root.classList.add('edge-to-edge');
      requestAnimationFrame(() =>
        this._document.defaultView?.scrollTo({
          top: EDGE_TO_EDGE_SCROLL_OFFSET,
          behavior: 'instant',
        })
      );
      inject(DestroyRef).onDestroy(() => root.classList.remove('edge-to-edge'));
    }

    inject(DestroyRef).onDestroy(() => {
      this._unbindPanZoom?.();
      if (this._renderFrame !== undefined) cancelAnimationFrame(this._renderFrame);
      clearTimeout(this._idleTimer);
      clearTimeout(this._noticeTimer);
    });
  }

  protected toggle(option: WritableSignal<boolean>, storageKey: string) {
    const value = !option();
    option.set(value);
    try {
      localStorage.setItem(storageKey, String(value));
    } catch {
      // Not remembered, e.g. in private mode.
    }
  }

  protected thumbnailUrl(imageUrl: string) {
    return `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}w=${THUMBNAIL_WIDTH}`;
  }

  /** Back to the start: readable posters around the title to watch next. */
  protected resetView(animate = true) {
    const viewport = this._viewport()?.nativeElement;
    if (!viewport) return;
    const size = this.visibleViewport(viewport);
    const { bounds } = this.layout();
    const fitScale = Math.min(
      (size.width - 2 * FIT_PADDING) / bounds.width,
      (size.height - 2 * FIT_PADDING) / bounds.height
    );
    const nextUp = this.findNextUpNode();
    if (fitScale < READABLE_ZOOM && nextUp) {
      this._panZoom.centerOn(this.center(nextUp), size, animate, READABLE_ZOOM);
    } else {
      // The whole graph is readable at once.
      this._panZoom.fit(bounds, size, FIT_PADDING, animate);
    }
  }

  protected onNodeChange(event: NodeChangeEvent) {
    const graph = this.graph.value();
    if (!graph) return;
    this.graph.set(
      produce(graph, ({ graph }) => {
        if (event.kind === 'create') {
          graph.nodes.push(event.node);
        } else if (event.kind === 'delete') {
          graph.nodes = graph.nodes.filter(node => node.id !== event.node.id);
        } else {
          graph.nodes = [...graph.nodes.filter(node => node.id !== event.node.id), event.node];
        }

        graph.edges = [
          ...graph.edges.filter(
            edge =>
              !event.edges.removed.some(
                removed =>
                  removed.sourceNodeId === edge.sourceNodeId &&
                  removed.targetNodeId === edge.targetNodeId
              )
          ),
          ...event.edges.added,
        ];
      })
    );

    if (event.kind === 'create') {
      // The node only gets a position once the new layout has been computed.
      this._pendingPanToNodeId = event.node.id;
    }
  }

  protected async copyUrl() {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      // The clipboard is only available in secure contexts (HTTPS) and may be denied.
      return;
    }
    this.showNotice({ text: this.translate.translations.graph_linkCopied() });
  }

  protected async deleteGraph() {
    const graph = this.graph.value()?.graph;
    if (!graph) return;
    const t = this.translate.translations;
    const confirmed = await this._confirmService.confirm({
      title: t.graph_deleteConfirmTitle(),
      message: t.graph_deleteConfirmMessage({ name: graph.name }),
      confirmLabel: t.common_delete(),
      destructive: true,
      confirmText: graph.name,
    });
    if (!confirmed) return;

    const response = await this._graphsService.deleteGraph({ graphId: graph.id });
    if (!response.ok) {
      this.showNotice({ text: t.graph_deleteFailed(), error: true }, 4000);
      return;
    }
    forgetRecentGraph(graph.id);
    await this._router.navigate(['/']);
  }

  private showNotice(notice: { text: string; error?: boolean }, duration = 1500) {
    this.notice.set(notice);
    clearTimeout(this._noticeTimer);
    this._noticeTimer = setTimeout(() => this.notice.set(undefined), duration);
  }

  private scheduleRender() {
    this._renderFrame ??= requestAnimationFrame(() => {
      this._renderFrame = undefined;
      this.render();
    });
  }

  /**
   * Moves the canvas. This runs once per frame at most and writes the styles directly, so panning
   * doesn't trigger change detection for every pointer event and the browser only has to move
   * already painted layers.
   */
  private render() {
    const content = this._content()?.nativeElement;
    const dots = this._dots()?.nativeElement;
    if (!content || !dots) return;
    const transform = this._panZoom.transform;
    const { x, y, k } = transform;

    content.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${k})`;
    const zoomLevel = ZOOM_LEVELS.find(level => k < level.below)?.level ?? 'near';
    if (zoomLevel !== this._zoomLevel) {
      this._zoomLevel = zoomLevel;
      content.dataset['zoom'] = zoomLevel;
    }

    // The dots move with the canvas and get spaced out in steps so they never get too dense.
    let spacing = DOT_SPACING * k;
    while (spacing < DOT_SPACING / 2) spacing *= 2;
    // The dots layer is larger than the viewport by 64px (left/right) and 256px (top/bottom).
    const mod = (value: number, offset: number) =>
      (((value + offset) % spacing) + spacing) % spacing;
    dots.style.backgroundSize = `${spacing}px ${spacing}px`;
    dots.style.transform = `translate3d(${mod(x, 64)}px, ${mod(y, 256)}px, 0)`;

    // Hint the browser to keep the canvas on its own layer while it moves, and let it repaint
    // sharply at the new scale once it is idle again.
    content.style.willChange = 'transform';
    clearTimeout(this._idleTimer);
    this._idleTimer = setTimeout(() => {
      if (!this._panZoom.isActive) content.style.willChange = '';
    }, 200);

    if (this.hoveredNode()) this._tooltipTransform.set(transform);
  }

  /**
   * The title currently being watched, otherwise the leftmost unwatched title whose
   * prerequisites are all done.
   */
  private findNextUpNode(): LayoutNode | undefined {
    const { nodes } = this.layout();
    const edges = this.graph.value()?.graph.edges ?? [];
    const byId = new Map(nodes.map(node => [node.id, node]));
    const isDone = (node: LayoutNode | undefined) =>
      !node || node.data.status === 'watched' || node.data.status === 'ignored';
    const byPosition = [...nodes].sort((a, b) => a.position.x - b.position.x);
    return (
      byPosition.find(node => node.data.status === 'watching') ??
      byPosition.find(
        node =>
          node.data.status === 'unwatched' &&
          edges
            .filter(edge => edge.targetNodeId === node.id)
            .every(edge => isDone(byId.get(edge.sourceNodeId)))
      )
    );
  }

  private center(node: LayoutNode) {
    return {
      x: node.position.x + node.dimension.width / 2,
      y: node.position.y + node.dimension.height / 2,
    };
  }

  /**
   * The canvas extends behind the browser's tool bars; centering and fitting should use the
   * part of it that is actually visible.
   */
  private visibleViewport(viewport: HTMLElement): Size {
    const visibleHeight = this._document.defaultView?.visualViewport?.height;
    return {
      width: viewport.clientWidth,
      height: visibleHeight
        ? Math.min(viewport.clientHeight, visibleHeight)
        : viewport.clientHeight,
    };
  }

  private onLayoutChanged() {
    const viewport = this._viewport()?.nativeElement;
    const graphId = this._layoutGraphId;
    if (!viewport || !this._unbindPanZoom || !graphId) return;

    if (this._initializedGraphId !== graphId) {
      this._initializedGraphId = graphId;
      this.resetView(false);
    }

    const panToNodeId = this._pendingPanToNodeId;
    const node = panToNodeId && this.layout().nodes.find(x => x.id === panToNodeId);
    if (node) {
      this._pendingPanToNodeId = undefined;
      this._panZoom.centerOn(this.center(node), this.visibleViewport(viewport), true);
    }
  }
}

function loadFlag(storageKey: string, fallback: boolean) {
  try {
    const stored = localStorage.getItem(storageKey);
    return stored === null ? fallback : stored === 'true';
  } catch {
    return fallback;
  }
}
