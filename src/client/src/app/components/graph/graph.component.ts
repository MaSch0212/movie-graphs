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
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { produce } from 'immer';

import { GraphsService } from '../../api/services';
import { rememberRecentGraph } from '../../utils/recent-graphs';
import { computeGraphLayout, EMPTY_LAYOUT, GraphLayout, LayoutNode } from './graph-layout';
import {
  GraphNodeDialogComponent,
  NodeChangeEvent,
} from './graph-node-dialog/graph-node-dialog.component';
import { bindPanZoom, PanZoomController, ViewTransform } from './pan-zoom';

const MIN_ZOOM = 0.03;
const MAX_ZOOM = 4;
const FIT_PADDING = 32;
const ZOOM_STEP = 1.5;
const READABLE_ZOOM = 0.6;
const DOT_SPACING = 28;

@Component({
  selector: 'app-graph',
  imports: [GraphNodeDialogComponent, RouterLink],
  templateUrl: './graph.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative block h-dvh w-full overflow-hidden' },
})
export class GraphComponent {
  private readonly _graphsService = inject(GraphsService);
  private readonly _routeParams = toSignal(inject(ActivatedRoute).params);

  private readonly _graphSvg = viewChild<ElementRef<SVGSVGElement>>('graphSvg');
  private readonly _graphId = computed(() => String(this._routeParams()?.['id'] ?? ''));

  private readonly _transform = signal<ViewTransform>({ x: 0, y: 0, k: 1 });
  private readonly _panZoom = new PanZoomController({
    minScale: MIN_ZOOM,
    maxScale: MAX_ZOOM,
    onChange: transform => this._transform.set(transform),
  });
  private _unbindPanZoom?: () => void;
  private _layoutGraphId?: string;
  private _fittedGraphId?: string;
  private _pendingPanToNodeId?: string;

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
  protected readonly linkCopied = signal(false);

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

  protected readonly viewTransform = computed(() => {
    const { x, y, k } = this._transform();
    return `translate(${x} ${y}) scale(${k})`;
  });

  /** The dotted background moves and scales with the canvas, in steps so it never gets too dense. */
  protected readonly dotStyle = computed(() => {
    const { x, y, k } = this._transform();
    let spacing = DOT_SPACING * k;
    while (spacing < DOT_SPACING / 2) spacing *= 2;
    return { size: `${spacing}px ${spacing}px`, position: `${x}px ${y}px` };
  });

  protected readonly tooltip = computed(() => {
    const node = this.hoveredNode();
    if (!node) return undefined;
    const { x, y, k } = this._transform();
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

    // The svg only exists once the graph has loaded, so (re-)attach the gestures to it.
    effect(() => {
      const svg = this._graphSvg()?.nativeElement;
      untracked(() => {
        this._unbindPanZoom?.();
        this._unbindPanZoom = undefined;
        if (!svg) return;
        this._unbindPanZoom = bindPanZoom(svg, this._panZoom);
        this._fittedGraphId = undefined;
        this.onLayoutChanged();
      });
    });

    inject(DestroyRef).onDestroy(() => this._unbindPanZoom?.());
  }

  protected zoomToFit(animate = true) {
    const svg = this._graphSvg()?.nativeElement;
    if (!svg) return;
    this._panZoom.fit(this.layout().bounds, this.viewport(svg), FIT_PADDING, animate);
  }

  protected zoom(factor: number) {
    const svg = this._graphSvg()?.nativeElement;
    if (!svg) return;
    const { width, height } = this.viewport(svg);
    this._panZoom.zoomAt(factor, { x: width / 2, y: height / 2 }, true);
  }

  protected readonly zoomStep = ZOOM_STEP;

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
    await navigator.clipboard.writeText(window.location.href);
    this.linkCopied.set(true);
    setTimeout(() => this.linkCopied.set(false), 1500);
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

  private viewport(svg: SVGSVGElement) {
    return { width: svg.clientWidth, height: svg.clientHeight };
  }

  private onLayoutChanged() {
    const svg = this._graphSvg()?.nativeElement;
    const graphId = this._layoutGraphId;
    if (!svg || !this._unbindPanZoom || !graphId) return;

    if (this._fittedGraphId !== graphId) {
      this._fittedGraphId = graphId;
      this.zoomToFit(false);
      // When the whole graph is too small to recognize anything, start with readable posters
      // around the title currently being watched (or the next one) instead.
      const nextUp = this.findNextUpNode();
      const viewport = this.viewport(svg);
      if (this._panZoom.transform.k < READABLE_ZOOM && nextUp) {
        this._panZoom.zoomAt(READABLE_ZOOM / this._panZoom.transform.k, { x: 0, y: 0 });
        this._panZoom.centerOn(
          {
            x: nextUp.position.x + nextUp.dimension.width / 2,
            y: nextUp.position.y + nextUp.dimension.height / 2,
          },
          viewport
        );
      }
    }

    const panToNodeId = this._pendingPanToNodeId;
    const node = panToNodeId && this.layout().nodes.find(x => x.id === panToNodeId);
    if (node) {
      this._pendingPanToNodeId = undefined;
      this._panZoom.centerOn(
        {
          x: node.position.x + node.dimension.width / 2,
          y: node.position.y + node.dimension.height / 2,
        },
        this.viewport(svg),
        true
      );
    }
  }
}
