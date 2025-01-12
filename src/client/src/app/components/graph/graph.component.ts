import { CommonModule } from '@angular/common';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  NgxGraphModule,
  Node,
  Edge,
  GraphComponent as NgxGraphComponent,
} from '@swimlane/ngx-graph';
import * as shape from 'd3-shape';
import { produce } from 'immer';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';

import {
  GraphNodeDialogComponent,
  NodeChangeEvent,
} from './graph-node-dialog/graph-node-dialog.component';
import { GraphsService } from '../../api/services';

@Component({
  selector: 'app-graph',
  imports: [
    ButtonModule,
    CommonModule,
    GraphNodeDialogComponent,
    MessageModule,
    NgxGraphModule,
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
  protected readonly shape = shape;

  private readonly _graphView = viewChild(NgxGraphComponent);
  private readonly _graphId = computed(() => String(this._routeParams()?.['id'] ?? ''));

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
  protected readonly nodes = computed(
    () =>
      this.graph.value()?.graph.nodes.map(
        node =>
          ({
            id: node.id,
            label: node.name,
            data: node,
          }) satisfies Node
      ) ?? []
  );
  protected readonly links = computed(
    () =>
      this.graph.value()?.graph.edges.map(
        edge =>
          ({
            source: edge.sourceNodeId,
            target: edge.targetNodeId,
          }) satisfies Edge
      ) ?? []
  );

  constructor() {
    const graphIdLoaded = computed(() => this.graph.value()?.graph.id);
    afterRenderEffect(() => {
      const graphView = this._graphView();
      const graph = graphIdLoaded();
      if (graphView && graph) {
        setTimeout(() => {
          graphView.zoomToFit({ autoCenter: true });
        }, 10);
      }
    });
  }

  protected zoomCenter(zoomFactor: number) {
    const graph = this._graphView();
    if (!graph) return;

    const svg = graph['el'].nativeElement.querySelector('svg');
    const svgGroup = svg.querySelector('g.chart');
    const point = svg.createSVGPoint();
    point.x = svg.clientWidth / 2;
    point.y = svg.clientHeight / 2;
    const svgPoint = point.matrixTransform(svgGroup.getScreenCTM().inverse());

    graph.pan(svgPoint.x, svgPoint.y, true);
    graph.zoom(zoomFactor);
    graph.pan(-svgPoint.x, -svgPoint.y, true);
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
      this._graphView()?.panToNodeId(event.node.id);
      // setTimeout(() => this._graphView()?.panToNodeId(event.node.id), 100);
    }
  }

  protected copyUrl() {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
  }

  protected navigateToHome() {
    this._router.navigate(['/']);
  }
}
