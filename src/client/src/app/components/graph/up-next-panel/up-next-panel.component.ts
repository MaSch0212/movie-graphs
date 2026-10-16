import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';

import { ApiGraph, ApiGraphNode, ApiGraphNodeStatus } from '../../../api/models';
import { GraphsService } from '../../../api/services';
import { TranslateService } from '../../../i18n/translate.service';
import { episodeInfo } from '../../../utils/node-title';
import { LayoutNode } from '../graph-layout';
import { NodeChangeEvent } from '../graph-node-dialog/graph-node-dialog.component';
import { findUpNext } from '../up-next';

const THUMBNAIL_WIDTH = 200;

/**
 * What can be watched next: the titles being watched and the ones whose dependencies are all
 * watched or skipped. A panel next to the graph on larger screens, full screen on small ones.
 */
@Component({
  selector: 'app-up-next-panel',
  imports: [NgTemplateOutlet],
  templateUrl: './up-next-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpNextPanelComponent {
  private readonly _graphsService = inject(GraphsService);
  protected readonly translate = inject(TranslateService);

  public readonly open = model(false);
  public readonly graph = input.required<ApiGraph>();
  /** The laid out nodes, to list the titles in the order of the graph. */
  public readonly nodes = input.required<readonly LayoutNode[]>();

  public readonly nodeChange = output<NodeChangeEvent>();
  /** A title was picked to be shown in the graph. */
  public readonly showNode = output<ApiGraphNode>();

  private readonly _panel = viewChild<ElementRef<HTMLElement>>('panel');

  /** Ids of the nodes whose status is being saved. */
  protected readonly saving = signal<ReadonlySet<string>>(new Set());
  protected readonly hasFailed = signal(false);

  protected readonly upNext = computed(() => {
    const sorted = [...this.nodes()]
      .sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y)
      .map(node => node.data);
    return findUpNext(sorted, this.graph().edges);
  });
  /** Number of titles that can be watched next. */
  public readonly count = computed(
    () => this.upNext().watching.length + this.upNext().ready.length
  );

  /** How much of the graph the panel covers from the left, 0 when it is closed or full screen. */
  public coveredWidth() {
    if (!this.open() || matchMedia('(width < 40rem)').matches) return 0;
    return this._panel()?.nativeElement.getBoundingClientRect().right ?? 0;
  }

  protected details(node: ApiGraphNode) {
    const t = this.translate.translations;
    return [
      node.year,
      node.whereToWatch,
      node.duration ? `${node.duration.slice(0, 5)} ${t.graph_hours()}` : undefined,
    ]
      .filter(Boolean)
      .join(' · ');
  }

  protected episodes(node: ApiGraphNode) {
    return episodeInfo(node, this.translate.translations);
  }

  protected thumbnailUrl(imageUrl: string) {
    return `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}w=${THUMBNAIL_WIDTH}`;
  }

  protected pick(node: ApiGraphNode) {
    // On small screens the panel covers the graph.
    if (matchMedia('(width < 40rem)').matches) this.open.set(false);
    this.showNode.emit(node);
  }

  protected async setStatus(node: ApiGraphNode, status: ApiGraphNodeStatus) {
    if (this.saving().has(node.id)) return;
    this.saving.update(ids => new Set([...ids, node.id]));
    this.hasFailed.set(false);
    try {
      const response = await this._graphsService.updateGraphNode({
        graphNodeId: node.id,
        body: { status },
      });
      if (response.ok && response.body) {
        this.nodeChange.emit({
          kind: 'update',
          node: response.body.node,
          edges: { added: [], removed: [] },
        });
      } else {
        this.hasFailed.set(true);
      }
    } catch {
      this.hasFailed.set(true);
    } finally {
      this.saving.update(ids => new Set([...ids].filter(id => id !== node.id)));
    }
  }
}
