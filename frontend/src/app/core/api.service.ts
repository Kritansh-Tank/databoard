import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface TokenResponse   { access_token: string; token_type: string; }
export interface DatasetOut      { id: number; name: string; row_count: number; created_at: string; }
export interface DatasetListOut  { datasets: DatasetOut[]; total: number; page: number; limit: number; total_pages: number; }
export interface PreviewOut      { columns: string[]; rows: Record<string, any>[]; }
export interface ComputeOut      { column: string; operation: string; result: number | null; message?: string; error?: string; }
export interface PlotOut         { col1: string; col2: string; data: { col1: any; col2: any }[]; }

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // ── Auth ──────────────────────────────────────────────────────────────────
  register(email: string, password: string): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(`${this.base}/auth/register`, { email, password });
  }

  login(email: string, password: string): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(`${this.base}/auth/login`, { email, password });
  }

  // ── Datasets ──────────────────────────────────────────────────────────────
  uploadDataset(name: string, file: File): Observable<DatasetOut> {
    const form = new FormData();
    form.append('name', name);
    form.append('file', file);
    return this.http.post<DatasetOut>(`${this.base}/dataset`, form);
  }

  listDatasets(page = 1, limit = 10): Observable<DatasetListOut> {
    return this.http.get<DatasetListOut>(`${this.base}/dataset`, { params: { page, limit } });
  }

  previewDataset(id: number): Observable<PreviewOut> {
    return this.http.get<PreviewOut>(`${this.base}/dataset/${id}/preview`);
  }

  deleteDataset(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/dataset/${id}`);
  }

  computeStat(id: number, column: string, operation: string): Observable<ComputeOut> {
    return this.http.post<ComputeOut>(`${this.base}/dataset/${id}/compute`, { column, operation });
  }

  plotData(id: number, col1: string, col2: string): Observable<PlotOut> {
    return this.http.get<PlotOut>(`${this.base}/dataset/${id}/plot`, { params: { col1, col2 } });
  }
}
