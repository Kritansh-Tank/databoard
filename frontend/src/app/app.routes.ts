import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: '',
    loadComponent: () =>
      import('./pages/home/home.component').then(m => m.HomeComponent),
    canActivate: [authGuard],
  },
  {
    path: 'data',
    loadComponent: () =>
      import('./pages/data/data.component').then(m => m.DataComponent),
    canActivate: [authGuard],
  },
  {
    path: 'plot',
    loadComponent: () =>
      import('./pages/plot/plot.component').then(m => m.PlotComponent),
    canActivate: [authGuard],
  },
  { path: '**', redirectTo: '' },
];
