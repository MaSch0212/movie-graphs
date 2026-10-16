import { Routes } from '@angular/router';

import { startPage } from './utils/last-page';

export const routes: Routes = [
  {
    // The start URL of the home screen app.
    path: '',
    pathMatch: 'full',
    redirectTo: () => startPage(),
  },
  {
    path: 'home',
    loadComponent: () => import('./components/home/home.component').then(m => m.HomeComponent),
  },
  {
    path: 'graph/:id',
    loadComponent: () => import('./components/graph/graph.component').then(m => m.GraphComponent),
  },
  {
    path: '**',
    pathMatch: 'full',
    redirectTo: '/home',
  },
];
