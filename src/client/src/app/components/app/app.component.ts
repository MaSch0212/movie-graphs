import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ConfirmDialogComponent } from '../ui/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-root',
  imports: [ConfirmDialogComponent, RouterOutlet],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-full' },
})
export class AppComponent {}
