import { bootstrapApplication } from '@angular/platform-browser';
import { setAutoFreeze } from 'immer';

import { appConfig } from './app/app.config';
import { AppComponent } from './app/components/app/app.component';

setAutoFreeze(false);

// eslint-disable-next-line no-console
bootstrapApplication(AppComponent, appConfig).catch(err => console.error(err));
