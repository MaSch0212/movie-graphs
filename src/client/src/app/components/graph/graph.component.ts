import { CommonModule } from '@angular/common';
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
import { ActivatedRoute, Router } from '@angular/router';
import { select, Selection } from 'd3-selection';
import { zoom, ZoomBehavior, zoomIdentity, ZoomTransform } from 'd3-zoom';
import { produce } from 'immer';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';

import { computeGraphLayout, EMPTY_LAYOUT, GraphLayout } from './graph-layout';
import {
  GraphNodeDialogComponent,
  NodeChangeEvent,
} from './graph-node-dialog/graph-node-dialog.component';
import { GraphsService } from '../../api/services';

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 4;
const FIT_PADDING = 20;

@Component({
  selector: 'app-graph',
  imports: [
    ButtonModule,
    CommonModule,
    GraphNodeDialogComponent,
    MessageModule,
    ProgressSpinnerModule,
    TooltipModule,
  ],
  templateUrl: './graph.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GraphComponent {
  private readonly _graphsService = inject(GraphsService);
  private readonly _router = inject(Router);
  private readonly _routeParams = toSignal(inject(ActivatedRoute).params);

  private readonly _graphSvg = viewChild<ElementRef<SVGSVGElement>>('graphSvg');
  private readonly _graphId = computed(() => String(this._routeParams()?.['id'] ?? ''));

  private readonly _transform = signal<ZoomTransform>(zoomIdentity);
  private _zoom?: ZoomBehavior<SVGSVGElement, unknown>;
  private _svgSelection?: Selection<SVGSVGElement, unknown, null, undefined>;
  private _layoutGraphId?: string;
  private _fittedGraphId?: string;
  private _pendingPanToNodeId?: string;

  protected readonly graph = resource({
    request: () => this._graphId(),
    loader: async ({ request }) => {
      if (!request) return undefined;
      const response = await this._graphsService.getGraph({ graphId: request });
      if (!response.ok) throw response.error;
      return response.body;
    },
  });

  protected readonly graphName = computed(() => this.graph.value()?.graph.name);
  protected readonly layout = signal<GraphLayout>(EMPTY_LAYOUT);
  protected readonly viewTransform = computed(() => this._transform().toString());
  protected readonly zoomLevel = computed(() => this._transform().k);

  constructor() {
    // Re-run the layout whenever nodes or edges change. The previous layout stays visible until
    // the new one is ready, and results of outdated runs are discarded.
    let layoutRun = 0;
    effect(() => {
      const graph = this.graph.value()?.graph;
      if (!graph) return;
      const run = ++layoutRun;
      computeGraphLayout(graph.nodes, graph.edges).then(layout => {
        if (run !== layoutRun) return;
        this._layoutGraphId = graph.id;
        this.layout.set(layout);
        untracked(() => this.onLayoutChanged());
      });
    });

    // The svg only exists once the graph has loaded, so (re-)attach the zoom behavior to it.
    effect(() => {
      const svg = this._graphSvg()?.nativeElement;
      if (!svg) return;
      untracked(() => this.attachZoom(svg));
    });

    inject(DestroyRef).onDestroy(() => this._svgSelection?.on('.zoom', null));
  }

  protected zoomToFit() {
    const svg = this._graphSvg()?.nativeElement;
    const { bounds } = this.layout();
    if (!svg || !this._zoom || !this._svgSelection || bounds.width === 0) return;

    const width = svg.clientWidth;
    const height = svg.clientHeight;
    const scale = Math.min(
      MAX_ZOOM,
      Math.max(
        MIN_ZOOM,
        Math.min(
          (width - 2 * FIT_PADDING) / bounds.width,
          (height - 2 * FIT_PADDING) / bounds.height
        )
      )
    );
    const transform = zoomIdentity
      .translate(width / 2, height / 2)
      .scale(scale)
      .translate(-(bounds.x + bounds.width / 2), -(bounds.y + bounds.height / 2));
    this._zoom.transform(this._svgSelection, transform);
  }

  protected zoomCenter(zoomFactor: number) {
    if (!this._zoom || !this._svgSelection) return;
    this._zoom.scaleBy(this._svgSelection, zoomFactor);
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

  protected copyUrl() {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
  }

  protected navigateToHome() {
    this._router.navigate(['/']);
  }

  private attachZoom(svg: SVGSVGElement) {
    this._svgSelection?.on('.zoom', null);
    this._zoom = zoom<SVGSVGElement, unknown>()
      .scaleExtent([MIN_ZOOM, MAX_ZOOM])
      .on('zoom', event => this._transform.set(event.transform));
    this._svgSelection = select(svg).call(this._zoom).on('dblclick.zoom', null);
    this._fittedGraphId = undefined;
    this.onLayoutChanged();
  }

  private onLayoutChanged() {
    const graphId = this._layoutGraphId;
    if (!this._zoom || !this._svgSelection || !graphId) return;

    if (this._fittedGraphId !== graphId) {
      this._fittedGraphId = graphId;
      this.zoomToFit();
    }

    const panToNodeId = this._pendingPanToNodeId;
    const node = panToNodeId && this.layout().nodes.find(x => x.id === panToNodeId);
    if (node) {
      this._pendingPanToNodeId = undefined;
      this._zoom.translateTo(
        this._svgSelection,
        node.position.x + node.dimension.width / 2,
        node.position.y + node.dimension.height / 2
      );
    }
  }
}
