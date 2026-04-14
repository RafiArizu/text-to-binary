import { NgModule }                       from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path:       '',
    redirectTo: 'home',
    pathMatch:  'full',
  },
  {
    path:         'home',
    loadChildren: () =>
      import('./home/home.module').then(m => m.HomePageModule),
  },
  {
    path:         'morse',
    loadChildren: () =>
      import('./morse/morse.module').then(m => m.MorsePageModule),
  },
  // Settings diaktifkan setelah modul siap
  {
    path:         'settings',
    loadChildren: () =>
      import('./settings/settings.module').then(m => m.SettingsPageModule),
  },
  {
    path:       '**',
    redirectTo: 'home',
  },
];

@NgModule({
  imports:  [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports:  [RouterModule],
})
export class AppRoutingModule {}
