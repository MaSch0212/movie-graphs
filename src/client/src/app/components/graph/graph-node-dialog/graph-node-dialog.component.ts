import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { AutoComplete, AutoCompleteCompleteEvent, AutoCompleteModule } from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { FloatLabelModule } from 'primeng/floatlabel';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';

import { ApiGraph, ApiGraphEdge, ApiGraphNode, ApiGraphNodeStatus } from '../../../api/models';
import { GraphsService } from '../../../api/services';
import { imageFileValidator } from '../../../utils/image-file-validator';
import { Logger } from '../../../utils/logger';

export type NodeChangeEvent = {
  node: ApiGraphNode;
  edges: { added: ApiGraphEdge[]; removed: ApiGraphEdge[] };
  kind: 'create' | 'update' | 'delete';
};

function fromTimeSpan(timeSpan: string): Date {
  return new Date(`2000-01-01T${timeSpan}`);
}

function toTimeSpan(date: Date): string {
  return date.toTimeString().slice(0, 8);
}

@Component({
  selector: 'app-graph-node-dialog',
  imports: [
    AutoCompleteModule,
    ButtonModule,
    CheckboxModule,
    DatePickerModule,
    DialogModule,
    FloatLabelModule,
    InputTextModule,
    MessageModule,
    MultiSelectModule,
    ReactiveFormsModule,
    SelectModule,
  ],
  templateUrl: './graph-node-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GraphNodeDialogComponent {
  private readonly cd = inject(ChangeDetectorRef);
  private readonly _graphsService = inject(GraphsService);
  private readonly _confirmationService = inject(ConfirmationService);

  private readonly _whereToWatch = viewChild(AutoComplete);

  public readonly graph = input.required<ApiGraph>();

  public readonly nodeChange = output<NodeChangeEvent>();

  private readonly _allUsedWhereToWatch = computed(() =>
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
    imageFile: new FormControl<File | String | null>(null, {
      validators: [Validators.required, imageFileValidator],
    }),
    dependsOn: new FormControl<ApiGraphNode[]>([]),
    status: new FormControl<ApiGraphNodeStatus>('unwatched'),
    duration: new FormControl<Date | undefined>(undefined),
    whereToWatch: new FormControl<string>(''),
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
  protected readonly defaultDuration = new Date('2000-01-01T00:00:00');
  protected readonly statusOptions: ApiGraphNodeStatus[] = [
    'unwatched',
    'watching',
    'watched',
    'ignored',
  ];
  protected readonly whereToWatchSuggestions = signal<string[]>([]);

  public open(nodeToUpdate?: ApiGraphNode): void {
    this.nodeToUpdate.set(nodeToUpdate);
    this.form.reset({
      name: nodeToUpdate?.name ?? '',
      imageFile: nodeToUpdate?.imageUrl ?? null,
      dependsOn: nodeToUpdate ? this.determineDependsOn(nodeToUpdate) : [],
      status: nodeToUpdate?.status ?? 'unwatched',
      duration: nodeToUpdate?.duration ? fromTimeSpan(nodeToUpdate.duration) : undefined,
      whereToWatch: nodeToUpdate?.whereToWatch ?? '',
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

  protected searchWhereToWatch(event: AutoCompleteCompleteEvent) {
    this.whereToWatchSuggestions.set(
      this._allUsedWhereToWatch().filter(whereToWatch =>
        whereToWatch.toLowerCase().includes(event.query.toLowerCase())
      )
    );
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
              status: this.form.value.status,
              duration: this.form.value.duration ? toTimeSpan(this.form.value.duration) : null,
              whereToWatch: this.form.value.whereToWatch,
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
