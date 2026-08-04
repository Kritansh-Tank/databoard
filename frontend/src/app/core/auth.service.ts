import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';

const TOKEN_KEY = 'databoard_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _isLoggedIn = signal(this.hasToken());

  readonly isLoggedIn = this._isLoggedIn.asReadonly();

  constructor(private router: Router) {}

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  hasToken(): boolean {
    return !!this.getToken();
  }

  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
    this._isLoggedIn.set(true);
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    this._isLoggedIn.set(false);
    this.router.navigate(['/login']);
  }
}
