import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { LucideActivity, LucideAlertCircle, LucideLoader2 } from '@lucide/angular';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideActivity, LucideAlertCircle, LucideLoader2],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-gray-50 to-primary-50 flex items-center justify-center px-4">
      <div class="w-full max-w-md">

        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-14 h-14 bg-primary-600 rounded-2xl mb-4 shadow-lg">
            <svg lucideActivity class="w-7 h-7 text-white"></svg>
          </div>
          <h1 class="text-3xl font-bold text-gray-900">DataBoard</h1>
          <p class="text-gray-500 mt-1 text-sm">Your data analytics workspace</p>
        </div>

        <div class="card shadow-lg">
          <!-- Tabs -->
          <div class="flex rounded-lg bg-gray-100 p-1 mb-6">
            <button (click)="mode='login'"    [class]="mode==='login'    ? tabActive : tabInactive">Sign In</button>
            <button (click)="mode='register'" [class]="mode==='register' ? tabActive : tabInactive">Create Account</button>
          </div>

          <!-- Error -->
          <div *ngIf="errorMsg" class="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 flex items-center gap-2">
            <svg lucideAlertCircle class="w-4 h-4 shrink-0"></svg>
            {{ errorMsg }}
          </div>

          <!-- LOGIN -->
          <form *ngIf="mode==='login'" [formGroup]="loginForm" (ngSubmit)="doLogin()" class="space-y-4">
            <div>
              <label class="form-label">Email</label>
              <input type="email" formControlName="email" class="form-input" placeholder="you@example.com">
              <p *ngIf="loginForm.get('email')?.touched && loginForm.get('email')?.invalid" class="form-error">Valid email is required</p>
            </div>
            <div>
              <label class="form-label">Password</label>
              <input type="password" formControlName="password" class="form-input" placeholder="••••••••">
              <p *ngIf="loginForm.get('password')?.touched && loginForm.get('password')?.invalid" class="form-error">Password is required</p>
            </div>
            <button type="submit" class="btn-primary w-full justify-center py-2.5" [disabled]="loading">
              <svg *ngIf="loading" lucideLoader2 class="w-4 h-4 animate-spin"></svg>
              {{ loading ? 'Signing in…' : 'Sign In' }}
            </button>
          </form>

          <!-- REGISTER -->
          <form *ngIf="mode==='register'" [formGroup]="registerForm" (ngSubmit)="doRegister()" class="space-y-4">
            <div>
              <label class="form-label">Email</label>
              <input type="email" formControlName="email" class="form-input" placeholder="you@example.com">
              <p *ngIf="registerForm.get('email')?.touched && registerForm.get('email')?.invalid" class="form-error">Valid email is required</p>
            </div>
            <div>
              <label class="form-label">Password</label>
              <input type="password" formControlName="password" class="form-input" placeholder="At least 8 characters">
              <p *ngIf="registerForm.get('password')?.touched && registerForm.get('password')?.hasError('minlength')" class="form-error">Minimum 8 characters</p>
            </div>
            <button type="submit" class="btn-primary w-full justify-center py-2.5" [disabled]="loading">
              <svg *ngIf="loading" lucideLoader2 class="w-4 h-4 animate-spin"></svg>
              {{ loading ? 'Creating account…' : 'Create Account' }}
            </button>
          </form>
        </div>
      </div>
    </div>
  `,
})
export class LoginComponent implements OnInit {
  private fb = inject(FormBuilder); private api = inject(ApiService);
  private auth = inject(AuthService); private router = inject(Router);

  mode: 'login' | 'register' = 'login';
  loading = false; errorMsg = '';
  readonly tabActive   = 'flex-1 py-1.5 text-sm font-medium rounded-md bg-white text-gray-900 shadow-sm transition-all';
  readonly tabInactive = 'flex-1 py-1.5 text-sm font-medium rounded-md text-gray-500 hover:text-gray-700 transition-all';
  loginForm!: FormGroup; registerForm!: FormGroup;

  ngOnInit() {
    if (this.auth.hasToken()) { this.router.navigate(['/']); return; }
    this.loginForm    = this.fb.group({ email: ['', [Validators.required, Validators.email]], password: ['', Validators.required] });
    this.registerForm = this.fb.group({ email: ['', [Validators.required, Validators.email]], password: ['', [Validators.required, Validators.minLength(8)]] });
  }

  doLogin() {
    if (this.loginForm.invalid) { this.loginForm.markAllAsTouched(); return; }
    this.loading = true; this.errorMsg = '';
    const { email, password } = this.loginForm.value;
    this.api.login(email, password).subscribe({
      next: res => { this.auth.setToken(res.access_token); this.router.navigate(['/']); },
      error: err => { this.errorMsg = err.error?.detail ?? 'Login failed.'; this.loading = false; },
    });
  }

  doRegister() {
    if (this.registerForm.invalid) { this.registerForm.markAllAsTouched(); return; }
    this.loading = true; this.errorMsg = '';
    const { email, password } = this.registerForm.value;
    this.api.register(email, password).subscribe({
      next: res => { this.auth.setToken(res.access_token); this.router.navigate(['/']); },
      error: err => { this.errorMsg = err.error?.detail ?? 'Registration failed.'; this.loading = false; },
    });
  }
}
