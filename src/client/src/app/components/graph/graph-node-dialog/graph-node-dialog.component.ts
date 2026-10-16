import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { ApiGraph, ApiGraphEdge, ApiGraphNode, ApiGraphNodeStatus } from '../../../api/models';
import { GraphsService } from '../../../api/services';
import { imageFileValidator } from '../../../utils/image-file-validator';
import { Logger } from '../../../utils/logger';
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
  protected readonly form = new FormGroup({
    name: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    imageFile: new FormControl<File | string | null>(null, {
      validators: [Validators.required, imageFileValidator],
    }),
    dependsOn: new FormControl<ApiGraphNode[]>([], { nonNullable: true }),
    status: new FormControl<ApiGraphNodeStatus>('unwatched', { nonNullable: true }),
    durationMinutes: new FormControl<number | null>(null, { validators: [Validators.min(0)] }),
    whereToWatch: new FormControl<string>('', { nonNullable: true }),
  });
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
      .sort((a, b) => a.name.localeCompare(b.name))
  );
  protected readonly statusOptions: { value: ApiGraphNodeStatus; label: string; icon: string }[] = [
    { value: 'unwatched', label: 'To watch', icon: 'icon-[mdi--bookmark-outline]' },
    { value: 'watching', label: 'Watching', icon: 'icon-[mdi--play]' },
    { value: 'watched', label: 'Watched', icon: 'icon-[mdi--check]' },
    { value: 'ignored', label: 'Skip', icon: 'icon-[mdi--eye-off-outline]' },
  ];
  protected readonly nodeLabel = (node: ApiGraphNode) => node.name;
  protected readonly nodeKey = (node: ApiGraphNode) => node.id;

  public open(nodeToUpdate?: ApiGraphNode): void {
    this.nodeToUpdate.set(nodeToUpdate);
    this.form.reset({
      name: nodeToUpdate?.name ?? '',
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
    this.isLoading.set(true);
    this.hasFailed.set(false);
    try {
      const nodeToUpdate = this.nodeToUpdate();
      const response = nodeToUpdate
        ? await this._graphsService.updateGraphNode({
            graphNodeId: nodeToUpdate.id,
            body: {
              name: value.name,
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
              image: value.imageFile as File,
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
      title: 'Delete title?',
      message: `"${nodeToDelete.name}" and all of its connections will be removed from the graph.`,
      confirmLabel: 'Delete',
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
