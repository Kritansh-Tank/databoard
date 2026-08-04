import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import {
  LucideActivity, LucideHouse, LucideDatabase,
  LucideBarChart2, LucideLogOut
} from '@lucide/angular';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, LucideActivity, LucideHouse, LucideDatabase, LucideBarChart2, LucideLogOut],
  template: `
    <header class="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">

          <a routerLink="/" class="flex items-center gap-2 text-primary-600 font-bold text-lg tracking-tight hover:text-primary-700 transition-colors">
            <svg lucideActivity class="w-5 h-5"></svg>
            DataBoard
          </a>

          <nav class="hidden sm:flex items-center gap-1">
            <a routerLink="/" routerLinkActive="nav-active" [routerLinkActiveOptions]="{exact:true}" class="nav-link">
              <svg lucideHouse class="w-4 h-4"></svg> Home
            </a>
            <a routerLink="/data" routerLinkActive="nav-active" class="nav-link">
              <svg lucideDatabase class="w-4 h-4"></svg> Data
            </a>
            <a routerLink="/plot" routerLinkActive="nav-active" class="nav-link">
              <svg lucideBarChart2 class="w-4 h-4"></svg> Plot
            </a>
          </nav>

          <button (click)="logout()" class="btn-ghost text-sm">
            <svg lucideLogOut class="w-4 h-4"></svg> Logout
          </button>
        </div>
      </div>
    </header>
  `,
  styles: [`
    .nav-link { @apply flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all duration-150; }
    :host ::ng-deep .nav-active { @apply text-primary-600 bg-primary-50 hover:bg-primary-100 hover:text-primary-700; }
  `]
})
export class NavbarComponent {
  private auth = inject(AuthService);
  logout() { this.auth.logout(); }
}
