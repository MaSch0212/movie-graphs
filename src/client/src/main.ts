import { bootstrapApplication } from '@angular/platform-browser';
import { setAutoFreeze } from 'immer';

import { appConfig } from './app/app.config';
import { AppComponent } from './app/components/app/app.component';

setAutoFreeze(false);

// iOS ignores `user-scalable=no` and lets users pinch-zoom the page (e.g. inside dialogs), which
// conflicts with the graph's own zooming. Cancelling Safari's gesture events prevents that; the
// graph listens to pointer events, so it is not affected.
for (const type of ['gesturestart', 'gesturechange']) {
  document.addEventListener(type, event => event.preventDefault(), { passive: false });
}

// oxlint-disable-next-line no-console
bootstrapApplication(AppComponent, appConfig).catch(err => console.error(err));
