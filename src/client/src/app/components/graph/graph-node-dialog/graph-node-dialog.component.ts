import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';

import {
  ApiGraph,
  ApiGraphEdge,
  ApiGraphNode,
  ApiGraphNodeStatus,
  ApiGraphNodeType,
} from '../../../api/models';
import { GraphsService } from '../../../api/services';
import { TranslateService } from '../../../i18n/translate.service';
import { imageFileValidator } from '../../../utils/image-file-validator';
import { Logger } from '../../../utils/logger';
import { fullTitle } from '../../../utils/node-title';
import { fromTimeSpan, toTimeSpan } from '../../../utils/time-span';
import { ConfirmService } from '../../ui/confirm-dialog/confirm.service';
import { DialogComponent } from '../../ui/dialog/dialog.component';
import { MultiSelectComponent } from '../../ui/multi-select/multi-select.component';

export type NodeChangeEvent = {
  node: ApiGraphNode;
  edges: { added: ApiGraphEdge[]; removed: ApiGraphEdge[] };
  kind: 'create' | 'update' | 'delete';
};

@Component({
  selector: 'app-graph-node-dialog',
  imports: [DialogComponent, MultiSelectComponent, ReactiveFormsModule],
  templateUrl: './graph-node-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GraphNodeDialogComponent {
  private readonly _graphsService = inject(GraphsService);
  private readonly _confirmService = inject(ConfirmService);
  protected readonly translate = inject(TranslateService);

  public readonly graph = input.required<ApiGraph>();

  public readonly nodeChange = output<NodeChangeEvent>();

  protected readonly allUsedWhereToWatch = computed(() =>
    Array.from(
      new Set(
        this.graph()
          .nodes.map(node => node.whereToWatch)
          .filter((whereToWatch): whereToWatch is string => !!whereToWatch)
      )
    ).sort()
  );
  protected readonly form = new FormGroup(
    {
      name: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
      shortName: new FormControl<string>('', { nonNullable: true }),
      type: new FormControl<ApiGraphNodeType>('movie', { nonNullable: true }),
      year: new FormControl<number | null>(null, {
        validators: [Validators.min(1800), Validators.max(2200)],
      }),
      season: new FormControl<number | null>(null, { validators: [Validators.min(0)] }),
      episodeFrom: new FormControl<number | null>(null, { validators: [Validators.min(1)] }),
      episodeTo: new FormControl<number | null>(null, { validators: [Validators.min(1)] }),
      imageFile: new FormControl<File | string | null>(null, {
        validators: [Validators.required, imageFileValidator],
      }),
      dependsOn: new FormControl<ApiGraphNode[]>([], { nonNullable: true }),
      status: new FormControl<ApiGraphNodeStatus>('unwatched', { nonNullable: true }),
      durationMinutes: new FormControl<number | null>(null, { validators: [Validators.min(0)] }),
      whereToWatch: new FormControl<string>('', { nonNullable: true }),
    },
    { validators: [episodeRangeValidator] }
  );
  protected readonly nodeToUpdate = signal<ApiGraphNode | undefined>(undefined);
  protected readonly visible = signal(false);
  protected readonly isLoading = signal(false);
  protected readonly hasFailed = signal(false);
  protected readonly submitted = signal(false);
  protected readonly isDraggingFile = signal(false);
  protected readonly imageSource = signal<string | null>(null);
  protected readonly otherNodes = computed(() =>
    this.graph()
      .nodes.filter(node => node.id !== this.nodeToUpdate()?.id)
      // By title, then season and episodes (with numbers in their natural order).
      .sort((a, b) =>
        this.nodeLabel(a).localeCompare(this.nodeLabel(b), undefined, { numeric: true })
      )
  );
  protected readonly statusOptions: { value: ApiGraphNodeStatus; icon: string }[] = [
    { value: 'unwatched', icon: 'icon-[mdi--bookmark-outline]' },
    { value: 'watching', icon: 'icon-[mdi--play]' },
    { value: 'watched', icon: 'icon-[mdi--check]' },
    { value: 'ignored', icon: 'icon-[mdi--eye-off-outline]' },
  ];
  protected readonly typeOptions: { value: ApiGraphNodeType; icon: string }[] = [
    { value: 'movie', icon: 'icon-[mdi--movie-open-outline]' },
    { value: 'series', icon: 'icon-[mdi--television-classic]' },
  ];
  protected readonly nodeLabel = (node: ApiGraphNode) =>
    fullTitle(node, this.translate.translations);
  protected readonly nodeKey = (node: ApiGraphNode) => node.id;

  public open(nodeToUpdate?: ApiGraphNode): void {
    this.nodeToUpdate.set(nodeToUpdate);
    this.form.reset({
      name: nodeToUpdate?.name ?? '',
      shortName: nodeToUpdate?.shortName ?? '',
      type: nodeToUpdate?.type ?? 'movie',
      year: nodeToUpdate?.year ?? null,
      season: nodeToUpdate?.season ?? null,
      episodeFrom: nodeToUpdate?.episodeFrom ?? null,
      episodeTo: nodeToUpdate?.episodeTo ?? null,
      imageFile: nodeToUpdate?.imageUrl ?? null,
      dependsOn: nodeToUpdate ? this.determineDependsOn(nodeToUpdate) : [],
      status: nodeToUpdate?.status ?? 'unwatched',
      durationMinutes: nodeToUpdate?.duration ? fromTimeSpan(nodeToUpdate.duration) : null,
      whereToWatch: nodeToUpdate?.whereToWatch ?? '',
    });
    this.imageSource.set(nodeToUpdate?.imageUrl ?? null);
    this.hasFailed.set(false);
    this.submitted.set(false);
    this.visible.set(true);
  }

  public close(): void {
    this.visible.set(false);
  }

  protected showError(control: keyof typeof this.form.controls) {
    const c = this.form.controls[control];
    return c.invalid && (c.dirty || c.touched || this.submitted());
  }

  protected onImageFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.setImageFile(input.files?.[0]);
  }

  protected onImageDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDraggingFile.set(false);
    this.setImageFile(event.dataTransfer?.files[0]);
  }

  protected async submit() {
    this.submitted.set(true);
    if (!this.form.valid) return;

    const value = this.form.getRawValue();
    const isSeries = value.type === 'series';
    const details = {
      type: value.type,
      year: value.year,
      season: isSeries ? value.season : null,
      episodeFrom: isSeries ? value.episodeFrom : null,
      episodeTo: isSeries ? value.episodeTo : null,
    };
    this.isLoading.set(true);
    this.hasFailed.set(false);
    try {
      const nodeToUpdate = this.nodeToUpdate();
      const response = nodeToUpdate
        ? await this._graphsService.updateGraphNode({
            graphNodeId: nodeToUpdate.id,
            body: {
              name: value.name,
              shortName: value.shortName.trim(),
              type: details.type,
              year: orClear(details.year),
              season: orClear(details.season),
              episodeFrom: orClear(details.episodeFrom),
              episodeTo: orClear(details.episodeTo),
              image: value.imageFile instanceof File ? value.imageFile : undefined,
              status: value.status,
              // Empty values clear the field (null values are not sent at all).
              duration: value.durationMinutes !== null ? toTimeSpan(value.durationMinutes) : '',
              whereToWatch: value.whereToWatch.trim(),
            },
          })
        : await this._graphsService.createGraphNode({
            graphId: this.graph().id,
            body: {
              name: value.name,
              shortName: value.shortName.trim() || undefined,
              type: details.type,
              year: details.year ?? undefined,
              season: details.season ?? undefined,
              episodeFrom: details.episodeFrom ?? undefined,
              episodeTo: details.episodeTo ?? undefined,
              image: value.imageFile as File,
              status: value.status,
              duration:
                value.durationMinutes !== null ? toTimeSpan(value.durationMinutes) : undefined,
              whereToWatch: value.whereToWatch.trim() || undefined,
            },
          });

      if (response.ok && response.body) {
        this.nodeChange.emit({
          node: response.body.node,
          kind: nodeToUpdate ? 'update' : 'create',
          edges: await this.postMissingEdges(response.body.node, value.dependsOn),
        });
        this.close();
      } else {
        Logger.logWarn(
          'GraphNodeDialogComponent',
          "Couldn't create or update the node.",
          response.ok ? 'Body was null' : response.error
        );
        this.hasFailed.set(true);
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  protected async delete() {
    const nodeToDelete = this.nodeToUpdate();
    if (!nodeToDelete) {
      Logger.logWarn('GraphNodeDialogComponent', 'No node to delete');
      return;
    }

    const confirmed = await this._confirmService.confirm({
      title: this.translate.translations.node_deleteConfirmTitle(),
      message: this.translate.translations.node_deleteConfirmMessage({
        name: fullTitle(nodeToDelete, this.translate.translations),
      }),
      confirmLabel: this.translate.translations.common_delete(),
      destructive: true,
    });
    if (!confirmed) return;

    this.isLoading.set(true);
    try {
      const response = await this._graphsService.deleteGraphNode({
        graphNodeId: nodeToDelete.id,
      });
      if (response.ok) {
        this.nodeChange.emit({
          node: nodeToDelete,
          kind: 'delete',
          edges: {
            added: [],
            removed: this.graph().edges.filter(
              edge => edge.targetNodeId === nodeToDelete.id || edge.sourceNodeId === nodeToDelete.id
            ),
          },
        });
        this.close();
      } else {
        Logger.logWarn('GraphNodeDialogComponent', "Couldn't delete the node.", response.error);
        this.hasFailed.set(true);
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  private setImageFile(file: File | undefined) {
    const control = this.form.controls.imageFile;
    control.setValue(file ?? null);
    control.markAsDirty();

    if (file) {
      const reader = new FileReader();
      reader.onload = () => this.imageSource.set(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      this.imageSource.set(null);
    }
  }

  private async postMissingEdges(node: ApiGraphNode, dependsOn: ApiGraphNode[]) {
    const allToNodeEdges = this.graph().edges.filter(edge => edge.targetNodeId === node.id);

    const edgesToAdd = dependsOn
      .filter(dependsOnNode => !allToNodeEdges.some(edge => edge.sourceNodeId === dependsOnNode.id))
      .map(dependsOnNode => ({ sourceNodeId: dependsOnNode.id, targetNodeId: node.id }));
    const edgesToRemove = allToNodeEdges.filter(
      edge => !dependsOn.some(dependsOnNode => edge.sourceNodeId === dependsOnNode.id)
    );

    const addedEdges: ApiGraphEdge[] = [];
    const removedEdges: ApiGraphEdge[] = [];
    await Promise.all([
      ...edgesToAdd.map(async edge => {
        const response = await this._graphsService.createGraphEdge(edge);
        if (response.ok && response.body) {
          addedEdges.push(response.body.edge);
        }
      }),
      ...edgesToRemove.map(async edge => {
        const response = await this._graphsService.deleteGraphEdge(edge);
        if (response.ok) {
          removedEdges.push(edge);
        }
      }),
    ]);
    return { added: addedEdges, removed: removedEdges };
  }

  private determineDependsOn(node: ApiGraphNode): ApiGraphNode[] {
    return this.graph()
      .edges.filter(edge => edge.targetNodeId === node.id)
      .map(edge => this.graph().nodes.find(node => node.id === edge.sourceNodeId))
      .filter((node): node is ApiGraphNode => !!node);
  }
}

/** The last episode must not be before the first one, and needs a first one. */
function episodeRangeValidator(group: AbstractControl): ValidationErrors | null {
  const from = group.get('episodeFrom')?.value as number | null;
  const to = group.get('episodeTo')?.value as number | null;
  if (group.get('type')?.value !== 'series' || to === null) return null;
  return from === null || to < from ? { episodeRange: true } : null;
}

/**
 * Empty values clear a field when updating (null values are not sent at all). The API types
 * don't know about this, hence the cast.
 */
function orClear(value: number | null): number {
  return value ?? ('' as unknown as number);
}
