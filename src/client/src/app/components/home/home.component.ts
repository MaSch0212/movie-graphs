import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { FloatLabelModule } from 'primeng/floatlabel';
import { InputTextModule } from 'primeng/inputtext';

import { GraphsService } from '../../api/services';

@Component({
  selector: 'app-home',
  imports: [ButtonModule, CommonModule, FloatLabelModule, InputTextModule],
  templateUrl: './home.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }
    `,
  ],
})
export class HomeComponent {
  private readonly _router = inject(Router);
  private readonly _graphsService = inject(GraphsService);

  protected async newGraph(name: string): Promise<void> {
    const response = await this._graphsService.createGraph({ body: { name } });
    if (response.ok && response.body?.graph) {
      this.navigateToGraph(response.body.graph.id);
    }
  }

  protected navigateToGraph(graphId: string): void {
    this._router.navigate(['/graph', graphId]);
    navigator.clipboard.writeText(graphId);
  }
}
