import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { FloatLabelModule } from 'primeng/floatlabel';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { MultiSelectModule } from 'primeng/multiselect';

import { ApiGraph, ApiGraphEdge, ApiGraphNode } from '../../../api/models';
import { GraphsService } from '../../../api/services';
import { imageFileValidator } from '../../../utils/image-file-validator';
import { Logger } from '../../../utils/logger';

export type NodeChangeEvent = {
  node: ApiGraphNode;
  edges: { added: ApiGraphEdge[]; removed: ApiGraphEdge[] };
  kind: 'create' | 'update' | 'delete';
};

@Component({
  selector: 'app-graph-node-dialog',
  imports: [
    ButtonModule,
    CheckboxModule,
    DialogModule,
    FloatLabelModule,
    InputTextModule,
    MessageModule,
    MultiSelectModule,
    ReactiveFormsModule,
  ],
  templateUrl: './graph-node-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GraphNodeDialogComponent {
  private readonly cd = inject(ChangeDetectorRef);
  private readonly _graphsService = inject(GraphsService);
  private readonly _confirmationService = inject(ConfirmationService);

  public readonly graph = input.required<ApiGraph>();

  public readonly nodeChange = output<NodeChangeEvent>();

  protected readonly form = new FormGroup({
    name: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    imageFile: new FormControl<File | String | null>(null, {
      validators: [Validators.required, imageFileValidator],
    }),
    dependsOn: new FormControl<ApiGraphNode[]>([]),
    watched: new FormControl<boolean>(false),
  });
  protected readonly nodeToUpdate = signal<ApiGraphNode | undefined>(undefined);
  protected readonly visible = signal(false);
  protected readonly isLoading = signal(false);
  protected readonly hasFailed = signal(false);
  protected readonly imageSource = signal<string | null>(null);
  protected readonly otherNodes = computed(() =>
    this.graph()
      .nodes.filter(node => node.id !== this.nodeToUpdate()?.id)
      .sort((a, b) => a.name.localeCompare(b.name))
  );

  public open(nodeToUpdate?: ApiGraphNode): void {
    this.nodeToUpdate.set(nodeToUpdate);
    this.form.reset({
      name: nodeToUpdate?.name ?? '',
      imageFile: nodeToUpdate?.imageUrl ?? null,
      dependsOn: nodeToUpdate ? this.determineDependsOn(nodeToUpdate) : [],
      watched: nodeToUpdate?.watched ?? false,
    });
    this.imageSource.set(nodeToUpdate?.imageUrl ?? null);
    this.visible.set(true);
  }

  public close(): void {
    this.visible.set(false);
  }

  protected onImageFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.form.controls.imageFile.setValue(file ?? null);

    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        this.imageSource.set(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      this.imageSource.set(null);
    }

    this.cd.markForCheck();
  }

  protected async submit() {
    if (!this.form.valid) {
      this.form.markAsDirty();
      return;
    }

    this.isLoading.set(true);
    try {
      const nodeToUpdate = this.nodeToUpdate();
      const response = nodeToUpdate
        ? await this._graphsService.updateGraphNode({
            graphNodeId: nodeToUpdate.id,
            body: {
              name: this.form.value.name as string,
              image:
                this.form.value.imageFile instanceof File ? this.form.value.imageFile : undefined,
              watched: this.form.value.watched,
            },
          })
        : await this._graphsService.createGraphNode({
            graphId: this.graph().id,
            body: {
              name: this.form.value.name as string,
              image: this.form.value.imageFile as File,
            },
          });

      if (response.ok && response.body) {
        this.nodeChange.emit({
          node: response.body.node,
          kind: nodeToUpdate ? 'update' : 'create',
          edges: await this.postMissingEdges(response.body.node, this.form.value.dependsOn ?? []),
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

    this._confirmationService.confirm({
      message: `Are you sure you want to delete the node "${nodeToDelete.name}"?`,
      accept: async () => {
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
                removed: this.graph().edges.filter(edge => edge.targetNodeId === nodeToDelete.id),
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
      },
    });
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
