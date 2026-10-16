import { provideHttpClient, withXhr } from '@angular/common/http';
import { ApplicationConfig, inject, provideAppInitializer } from '@angular/core';
import { provideRouter } from '@angular/router';

import { provideApi } from './api/services';
import { routes } from './app.routes';
import { ThemeService } from './theme/theme.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withXhr()),
    provideApi({ rootUrl: '' }),
    // Keeps the browser's bar color in sync with the chosen theme on every page.
    provideAppInitializer(() => void inject(ThemeService)),
  ],
};
