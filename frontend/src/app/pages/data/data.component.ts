import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideUpload, LucideFileText, LucideDatabase, LucideEye,
  LucideTrash2, LucideCheckCircle2, LucideAlertCircle,
  LucideLoader2, LucideX, LucideChevronLeft, LucideChevronRight
} from '@lucide/angular';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { ApiService, DatasetOut, DatasetListOut, PreviewOut } from '../../core/api.service';

@Component({
  selector: 'app-data',
  standalone: true,
  imports: [
    CommonModule, FormsModule, NavbarComponent,
    LucideUpload, LucideFileText, LucideDatabase, LucideEye,
    LucideTrash2, LucideCheckCircle2, LucideAlertCircle,
    LucideLoader2, LucideX, LucideChevronLeft, LucideChevronRight,
  ],
  template: `
    <app-navbar></app-navbar>

    <main class="page-container">
      <h1 class="page-title">Datasets</h1>
      <p class="page-subtitle">Upload CSV files and manage your datasets</p>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <!-- ── Upload Card ── -->
        <div class="lg:col-span-1">
          <div class="card">
            <h2 class="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg lucideUpload class="w-4 h-4 text-primary-600"></svg>
              Upload Dataset
            </h2>
            <div class="space-y-4">
              <div>
                <label class="form-label">Dataset Name</label>
                <input type="text" [(ngModel)]="uploadName" class="form-input" placeholder="e.g. Employee Records 2024">
              </div>
              <div>
                <label class="form-label">CSV File</label>
                <div class="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-primary-400 transition-colors cursor-pointer"
                     (click)="fileInput.click()" (dragover)="$event.preventDefault()" (drop)="onDrop($event)">
                  <svg lucideFileText class="w-8 h-8 text-gray-300 mx-auto mb-2"></svg>
                  <p class="text-sm text-gray-500">{{ selectedFile ? selectedFile.name : 'Click or drag a .csv file here' }}</p>
                  <p *ngIf="selectedFile" class="text-xs text-gray-400 mt-1">{{ (selectedFile.size / 1024).toFixed(1) }} KB</p>
                </div>
                <input #fileInput type="file" accept=".csv" class="hidden" (change)="onFileSelect($event)">
              </div>
              <p *ngIf="uploadError" class="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2">
                <svg lucideAlertCircle class="w-4 h-4 shrink-0"></svg> {{ uploadError }}
              </p>
              <p *ngIf="uploadSuccess" class="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center gap-2">
                <svg lucideCheckCircle2 class="w-4 h-4 shrink-0"></svg> Dataset uploaded successfully!
              </p>
              <button (click)="upload()" class="btn-primary w-full justify-center" [disabled]="uploading || !selectedFile || !uploadName.trim()">
                <svg *ngIf="uploading" lucideLoader2 class="w-4 h-4 animate-spin"></svg>
                {{ uploading ? 'Uploading…' : 'Upload' }}
              </button>
            </div>
          </div>
        </div>

        <!-- ── Dataset List ── -->
        <div class="lg:col-span-2">
          <div class="card p-0 overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 class="text-base font-semibold text-gray-900">Your Datasets</h2>
              <span *ngIf="listData" class="badge-primary">{{ listData.total }} total</span>
            </div>

            <div *ngIf="loading" class="p-12 text-center text-gray-400">
              <svg lucideLoader2 class="w-6 h-6 animate-spin mx-auto mb-2"></svg>
              <p class="text-sm">Loading datasets…</p>
            </div>

            <div *ngIf="!loading && listData?.datasets?.length === 0" class="p-12 text-center text-gray-400">
              <svg lucideDatabase class="w-10 h-10 mx-auto mb-3 text-gray-200"></svg>
              <p class="font-medium text-gray-500">No datasets yet</p>
              <p class="text-sm mt-1">Upload a CSV file to get started</p>
            </div>

            <div *ngIf="!loading && listData && listData.datasets.length > 0" class="overflow-x-auto">
              <table class="data-table">
                <thead>
                  <tr><th>Name</th><th>Rows</th><th>Uploaded</th><th class="text-right">Actions</th></tr>
                </thead>
                <tbody>
                  @for (ds of listData.datasets; track ds.id) {
                    <tr>
                      <td class="font-medium text-gray-900">{{ ds.name }}</td>
                      <td><span class="badge-primary">{{ ds.row_count.toLocaleString() }} rows</span></td>
                      <td class="text-gray-500 text-xs">{{ ds.created_at | date:'dd MMM y, HH:mm' }}</td>
                      <td class="text-right">
                        <div class="flex items-center justify-end gap-1">
                          <button (click)="openPreview(ds)" class="btn-ghost px-2 py-1 text-xs">
                            <svg lucideEye class="w-3.5 h-3.5"></svg> Preview
                          </button>
                          <button (click)="confirmDelete(ds)" class="btn px-2 py-1 text-xs text-red-500 hover:bg-red-50">
                            <svg lucideTrash2 class="w-3.5 h-3.5"></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <div *ngIf="listData && listData.total_pages > 1" class="px-6 py-3 border-t border-gray-100 flex items-center justify-between">
              <p class="text-xs text-gray-500">Page {{ listData.page }} of {{ listData.total_pages }}</p>
              <div class="flex gap-2">
                <button class="btn-secondary px-3 py-1 text-xs" [disabled]="currentPage <= 1" (click)="changePage(currentPage - 1)">
                  <svg lucideChevronLeft class="w-3.5 h-3.5"></svg> Prev
                </button>
                <button class="btn-secondary px-3 py-1 text-xs" [disabled]="currentPage >= listData.total_pages" (click)="changePage(currentPage + 1)">
                  Next <svg lucideChevronRight class="w-3.5 h-3.5"></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Preview Modal -->
    <div *ngIf="previewOpen" class="fixed inset-0 z-50 flex items-center justify-center px-4" (click)="closePreview()">
      <div class="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
      <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[80vh] flex flex-col" (click)="$event.stopPropagation()">
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 class="font-semibold text-gray-900">Preview: {{ previewDataset?.name }}</h3>
            <p class="text-xs text-gray-500 mt-0.5">First 25 rows</p>
          </div>
          <button (click)="closePreview()" class="btn-ghost p-2"><svg lucideX class="w-4 h-4"></svg></button>
        </div>
        <div class="overflow-auto flex-1 p-1">
          <div *ngIf="previewLoading" class="p-12 text-center text-gray-400">
            <svg lucideLoader2 class="w-6 h-6 animate-spin mx-auto mb-2"></svg>
            <p class="text-sm">Loading preview…</p>
          </div>
          <table *ngIf="!previewLoading && preview" class="data-table w-full text-xs">
            <thead><tr><th *ngFor="let col of preview.columns">{{ col }}</th></tr></thead>
            <tbody>
              <tr *ngFor="let row of preview.rows">
                <td *ngFor="let col of preview.columns">{{ row[col] ?? '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Delete Modal -->
    <div *ngIf="deleteTarget" class="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" (click)="deleteTarget = null"></div>
      <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div class="flex items-start gap-3 mb-4">
          <div class="p-2 bg-red-100 rounded-lg"><svg lucideTrash2 class="w-5 h-5 text-red-600"></svg></div>
          <div>
            <h3 class="font-semibold text-gray-900">Delete Dataset?</h3>
            <p class="text-sm text-gray-500 mt-1"><strong>{{ deleteTarget.name }}</strong> and all its rows will be permanently removed.</p>
          </div>
        </div>
        <div class="flex gap-3 justify-end">
          <button (click)="deleteTarget = null" class="btn-secondary">Cancel</button>
          <button (click)="doDelete()" class="btn-danger" [disabled]="deleting">
            <svg *ngIf="deleting" lucideLoader2 class="w-4 h-4 animate-spin"></svg>
            {{ deleting ? 'Deleting…' : 'Delete' }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class DataComponent implements OnInit {
  private api = inject(ApiService);

  uploadName = ''; selectedFile: File | null = null;
  uploading = false; uploadError = ''; uploadSuccess = false;
  loading = false; listData: DatasetListOut | null = null;
  currentPage = 1; readonly pageSize = 10;
  previewOpen = false; previewLoading = false;
  previewDataset: DatasetOut | null = null; preview: PreviewOut | null = null;
  deleteTarget: DatasetOut | null = null; deleting = false;

  ngOnInit() { this.loadDatasets(); }

  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) this.selectedFile = input.files[0];
  }
  onDrop(event: DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (file?.name.endsWith('.csv')) this.selectedFile = file;
  }
  upload() {
    if (!this.selectedFile || !this.uploadName.trim()) return;
    this.uploading = true; this.uploadError = ''; this.uploadSuccess = false;
    this.api.uploadDataset(this.uploadName.trim(), this.selectedFile).subscribe({
      next: () => { this.uploading = false; this.uploadSuccess = true; this.uploadName = ''; this.selectedFile = null; this.currentPage = 1; this.loadDatasets(); setTimeout(() => this.uploadSuccess = false, 4000); },
      error: err => { this.uploading = false; this.uploadError = err.error?.detail ?? 'Upload failed.'; },
    });
  }
  loadDatasets() {
    this.loading = true;
    this.api.listDatasets(this.currentPage, this.pageSize).subscribe({
      next: data => { this.listData = data; this.loading = false; },
      error: () => this.loading = false,
    });
  }
  changePage(page: number) { this.currentPage = page; this.loadDatasets(); }
  openPreview(ds: DatasetOut) {
    this.previewDataset = ds; this.previewOpen = true; this.previewLoading = true; this.preview = null;
    this.api.previewDataset(ds.id).subscribe({ next: data => { this.preview = data; this.previewLoading = false; }, error: () => this.previewLoading = false });
  }
  closePreview() { this.previewOpen = false; this.preview = null; }
  confirmDelete(ds: DatasetOut) { this.deleteTarget = ds; }
  doDelete() {
    if (!this.deleteTarget) return;
    this.deleting = true;
    this.api.deleteDataset(this.deleteTarget.id).subscribe({
      next: () => { this.deleting = false; this.deleteTarget = null; if (this.listData?.datasets.length === 1 && this.currentPage > 1) this.currentPage--; this.loadDatasets(); },
      error: () => { this.deleting = false; this.deleteTarget = null; },
    });
  }
}
