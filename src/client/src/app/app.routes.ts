import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: '/home',
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
