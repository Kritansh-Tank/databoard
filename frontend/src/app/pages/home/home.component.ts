import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { LucideActivity, LucideUpload, LucideBarChart2 } from '@lucide/angular';
import { NavbarComponent } from '../../shared/navbar/navbar.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, NavbarComponent, LucideActivity, LucideUpload, LucideBarChart2],
  template: `
    <app-navbar></app-navbar>
    <main class="page-container">

      <!-- Hero -->
      <section class="text-center py-14 max-w-2xl mx-auto">
        <span class="inline-flex items-center gap-2 bg-primary-50 text-primary-700 px-4 py-1.5 rounded-full text-sm font-medium mb-5">
          <svg lucideActivity class="w-3.5 h-3.5"></svg>
          DataBoard Analytics
        </span>
        <h1 class="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight mb-4">
          From raw data to<br>
          <span class="text-primary-600">clear insights</span>
        </h1>
        <p class="text-lg text-gray-500 mb-8 leading-relaxed">
          Upload CSV files, explore your data, compute statistics, and create
          beautiful visualisations — all in one place.
        </p>
        <div class="flex items-center justify-center gap-3 flex-wrap">
          <a routerLink="/data" class="btn-primary px-6 py-2.5 text-base">
            <svg lucideUpload class="w-4 h-4"></svg>
            Upload a Dataset
          </a>
          <a routerLink="/plot" class="btn-secondary px-6 py-2.5 text-base">
            <svg lucideBarChart2 class="w-4 h-4"></svg>
            Explore Charts
          </a>
        </div>
      </section>

      <div class="border-t border-gray-200 max-w-sm mx-auto my-2"></div>

      <!-- Feature Cards -->
      <section class="mt-10">
        <p class="text-center text-xs font-semibold text-gray-400 uppercase tracking-widest mb-8">What you can do</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          @for (f of features; track f.title) {
            <div class="card text-center group cursor-default">
              <div class="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-primary-50 text-primary-600 mb-4 group-hover:bg-primary-100 transition-colors" [innerHTML]="f.svgIcon"></div>
              <h3 class="font-semibold text-gray-900 mb-1.5 text-sm">{{ f.title }}</h3>
              <p class="text-sm text-gray-500 leading-relaxed">{{ f.desc }}</p>
            </div>
          }
        </div>
      </section>

    </main>
  `,
})
export class HomeComponent {
  private sanitizer = inject(DomSanitizer);

  features: { svgIcon: SafeHtml; title: string; desc: string }[] = [
    { svgIcon: this.s('<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>'), title: 'Upload Datasets', desc: 'Import any CSV file and name it for easy reference.' },
    { svgIcon: this.s('<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>'), title: 'Preview Data', desc: 'Instantly preview the first 25 rows of any dataset.' },
    { svgIcon: this.s('<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>'), title: 'Compute Statistics', desc: 'Calculate min, max, or sum on any numeric column.' },
    { svgIcon: this.s('<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg>'), title: 'Visualise', desc: 'Plot two columns as scatter, line, or bar charts.' },
  ];

  private s(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}

