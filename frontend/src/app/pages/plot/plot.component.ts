import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideBarChart2, LucideTrendingUp, LucideAlertCircle, LucideLoader2
} from '@lucide/angular';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { ApiService, DatasetOut, ComputeOut, PlotOut } from '../../core/api.service';

@Component({
  selector: 'app-plot',
  standalone: true,
  imports: [
    CommonModule, FormsModule, NavbarComponent, NgxEchartsDirective,
    LucideBarChart2, LucideTrendingUp, LucideAlertCircle, LucideLoader2,
  ],
  template: `
    <app-navbar></app-navbar>

    <main class="page-container">
      <h1 class="page-title">Visualise</h1>
      <p class="page-subtitle">Compute statistics and plot two columns from any dataset</p>

      <!-- Selectors -->
      <div class="card mb-6">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label class="form-label">Dataset</label>
            <select class="form-input" [(ngModel)]="selectedDatasetId" (ngModelChange)="onDatasetChange($event)">
              <option [ngValue]="null" disabled>Select a dataset…</option>
              @for (ds of datasets; track ds.id) {
                <option [ngValue]="ds.id">{{ ds.name }}</option>
              }
            </select>
          </div>
          <div>
            <label class="form-label">X Axis (Column 1)</label>
            <select class="form-input" [(ngModel)]="col1" [disabled]="!columns.length">
              <option value="" disabled>Select column…</option>
              @for (c of columns; track c) { <option [value]="c">{{ c }}</option> }
            </select>
          </div>
          <div>
            <label class="form-label">Y Axis (Column 2)</label>
            <select class="form-input" [(ngModel)]="col2" [disabled]="!columns.length">
              <option value="" disabled>Select column…</option>
              @for (c of columns; track c) { <option [value]="c">{{ c }}</option> }
            </select>
          </div>
          <div>
            <label class="form-label">Chart Type</label>
            <select class="form-input" [(ngModel)]="chartType">
              <option value="scatter">Scatter</option>
              <option value="line">Line</option>
              <option value="bar">Bar</option>
            </select>
          </div>
        </div>
        <div class="flex gap-3 mt-4">
          <button class="btn-primary" (click)="loadChart()" [disabled]="!canPlot || plotLoading">
            <svg *ngIf="plotLoading" lucideLoader2 class="w-4 h-4 animate-spin"></svg>
            <svg *ngIf="!plotLoading" lucideBarChart2 class="w-4 h-4"></svg>
            {{ plotLoading ? 'Loading…' : 'Plot Chart' }}
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">

        <!-- Stat Panel -->
        <div class="lg:col-span-1">
          <div class="card h-fit">
            <h2 class="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg lucideTrendingUp class="w-4 h-4 text-primary-600"></svg>
              Compute Statistic
            </h2>
            <div class="space-y-3">
              <div>
                <label class="form-label">Column</label>
                <select class="form-input" [(ngModel)]="computeCol" [disabled]="!columns.length">
                  <option value="" disabled>Select column…</option>
                  @for (c of columns; track c) { <option [value]="c">{{ c }}</option> }
                </select>
              </div>
              <div>
                <label class="form-label">Operation</label>
                <div class="grid grid-cols-3 gap-1">
                  @for (op of operations; track op.value) {
                    <button (click)="computeOp = op.value" [class]="computeOp === op.value ? opActive : opInactive">{{ op.label }}</button>
                  }
                </div>
              </div>
              <button class="btn-primary w-full justify-center" (click)="computeStat()"
                      [disabled]="!selectedDatasetId || !computeCol || computeLoading">
                <svg *ngIf="computeLoading" lucideLoader2 class="w-4 h-4 animate-spin"></svg>
                {{ computeLoading ? 'Computing…' : 'Compute' }}
              </button>

              <div *ngIf="computeResult" class="mt-2 p-3 rounded-xl border text-sm"
                   [class]="computeResult.error ? 'bg-red-50 border-red-200' : 'bg-primary-50 border-primary-100'">
                <p class="text-xs text-gray-500 mb-1">{{ computeResult.operation | uppercase }} of <strong>{{ computeResult.column }}</strong></p>
                <p *ngIf="computeResult.result !== null && !computeResult.error" class="text-2xl font-bold text-primary-700">
                  {{ computeResult.result | number:'1.0-4' }}
                </p>
                <p *ngIf="computeResult.message" class="text-gray-500 italic text-xs">{{ computeResult.message }}</p>
                <p *ngIf="computeResult.error" class="text-red-600 text-xs">{{ computeResult.error }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Chart -->
        <div class="lg:col-span-3">
          <div class="card p-0 overflow-hidden">
            <div *ngIf="!chartOption && !plotError" class="flex flex-col items-center justify-center h-96 text-gray-300">
              <svg lucideBarChart2 class="w-16 h-16 mb-3"></svg>
              <p class="text-sm font-medium text-gray-400">Select a dataset and columns, then click Plot</p>
            </div>
            <div *ngIf="plotError" class="flex flex-col items-center justify-center h-96 text-red-400 gap-2">
              <svg lucideAlertCircle class="w-10 h-10"></svg>
              <p class="text-sm">{{ plotError }}</p>
            </div>
            <div *ngIf="chartOption && !plotError" echarts [options]="chartOption" class="w-full h-96"></div>
          </div>
        </div>
      </div>
    </main>
  `,
})
export class PlotComponent implements OnInit {
  private api = inject(ApiService);

  datasets: DatasetOut[] = [];
  selectedDatasetId: number | null = null;
  columns: string[] = [];
  col1 = ''; col2 = ''; chartType: 'scatter' | 'line' | 'bar' = 'scatter';

  computeCol = ''; computeOp = 'min';
  computeLoading = false; computeResult: ComputeOut | null = null;
  readonly operations = [{ value: 'min', label: 'Min' }, { value: 'max', label: 'Max' }, { value: 'sum', label: 'Sum' }];
  readonly opActive   = 'px-2 py-1.5 text-xs font-semibold rounded-lg bg-primary-600 text-white transition-all';
  readonly opInactive = 'px-2 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-all';

  plotLoading = false; plotError = ''; chartOption: EChartsOption | null = null;
  get canPlot() { return this.selectedDatasetId && this.col1 && this.col2; }

  ngOnInit() { this.loadDatasetList(); }

  loadDatasetList() { this.api.listDatasets(1, 100).subscribe({ next: res => this.datasets = res.datasets }); }

  onDatasetChange(id: number) {
    this.columns = []; this.col1 = ''; this.col2 = ''; this.computeCol = '';
    this.chartOption = null; this.plotError = ''; this.computeResult = null;
    this.api.previewDataset(id).subscribe({
      next: data => {
        this.columns = data.columns;
        if (this.columns.length >= 1) this.col1 = this.columns[0];
        if (this.columns.length >= 2) this.col2 = this.columns[1];
        this.computeCol = this.columns[0] ?? '';
      },
    });
  }

  loadChart() {
    if (!this.selectedDatasetId || !this.col1 || !this.col2) return;
    this.plotLoading = true; this.plotError = ''; this.chartOption = null;
    this.api.plotData(this.selectedDatasetId, this.col1, this.col2).subscribe({
      next: data => { this.buildChart(data); this.plotLoading = false; },
      error: err => { this.plotError = err.error?.detail ?? 'Failed to load plot data.'; this.plotLoading = false; },
    });
  }

  buildChart(data: PlotOut) {
    const xData = data.data.map(d => d['col1']);
    const yData = data.data.map(d => d['col2']);
    const scatterData = data.data.map(d => [d['col1'], d['col2']]);
    this.chartOption = {
      backgroundColor: '#fff',
      grid: { left: 60, right: 30, top: 50, bottom: 60 },
      tooltip: { trigger: this.chartType === 'scatter' ? 'item' : 'axis' },
      xAxis: {
        type: this.chartType === 'scatter' ? 'value' : 'category',
        data: this.chartType !== 'scatter' ? xData : undefined,
        name: data.col1, nameLocation: 'middle', nameGap: 40,
        axisLine: { lineStyle: { color: '#e5e7eb' } },
        axisLabel: { color: '#6b7280', fontSize: 11 },
        splitLine: { lineStyle: { color: '#f3f4f6' } },
      },
      yAxis: {
        type: 'value', name: data.col2, nameLocation: 'middle', nameGap: 50,
        axisLine: { lineStyle: { color: '#e5e7eb' } },
        axisLabel: { color: '#6b7280', fontSize: 11 },
        splitLine: { lineStyle: { color: '#f3f4f6' } },
      },
      series: [{
        name: `${data.col2} vs ${data.col1}`,
        type: this.chartType,
        data: this.chartType === 'scatter' ? scatterData : yData,
        itemStyle: { color: '#4f46e5' },
        ...(this.chartType === 'line' ? { smooth: true, lineStyle: { width: 2 } } : {}),
        ...(this.chartType === 'bar'  ? { barMaxWidth: 40 } : {}),
      }],
    };
  }

  computeStat() {
    if (!this.selectedDatasetId || !this.computeCol) return;
    this.computeLoading = true; this.computeResult = null;
    this.api.computeStat(this.selectedDatasetId, this.computeCol, this.computeOp).subscribe({
      next: res => { this.computeResult = res; this.computeLoading = false; },
      error: err => { this.computeResult = { column: this.computeCol, operation: this.computeOp, result: null, error: err.error?.detail ?? 'Compute failed.' }; this.computeLoading = false; },
    });
  }
}
