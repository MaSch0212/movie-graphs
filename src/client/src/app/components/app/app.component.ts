import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';

import { environment } from '../../environments/environment';

@Component({
  selector: 'app-root',
  imports: [CommonModule, ConfirmDialogModule, RouterOutlet, ToastModule],
  providers: [ConfirmationService, MessageService],
  templateUrl: './app.component.html',
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
export class AppComponent {
  protected version = environment.version;
}
