import { inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';

const STORAGE_KEY = 'movie-graphs.last-page';
const DEFAULT_PAGE = '/home';

/** Whether the app runs from the home screen, not in a browser tab. */
export function isHomeScreenApp() {
  return (
    matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Remembers the page that is shown, so the home screen app can return to it when started. */
export function rememberLastPage() {
  const router = inject(Router);
  router.events.subscribe(event => {
    if (!(event instanceof NavigationEnd)) return;
    try {
      localStorage.setItem(STORAGE_KEY, event.urlAfterRedirects);
    } catch {
      // Not remembered, e.g. in private mode.
    }
  });
}

/**
 * Where the start URL leads: the home screen app opens the start URL whenever it was closed, so it
 * returns to the last page. In the browser it is the home page.
 */
export function startPage() {
  if (!isHomeScreenApp()) return DEFAULT_PAGE;
  try {
    const page = localStorage.getItem(STORAGE_KEY);
    // Only pages of this app.
    return page?.startsWith('/') && !page.startsWith('//') ? page : DEFAULT_PAGE;
  } catch {
    return DEFAULT_PAGE;
  }
}
