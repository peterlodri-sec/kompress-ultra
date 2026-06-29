export interface CircuitBreakerState {
  failures: number;
  openUntil: number;
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  cooldownMs?: number;
}

export class CircuitBreaker {
  private failures = 0;
  private openUntil = 0;
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 3;
    this.cooldownMs = options.cooldownMs ?? 60_000;
  }

  isOpen(): boolean {
    return Date.now() < this.openUntil;
  }

  recordSuccess(): void {
    this.failures = 0;
  }

  recordFailure(): void {
    this.failures++;
    if (this.failures >= this.failureThreshold) {
      this.openUntil = Date.now() + this.cooldownMs;
    }
  }

  getState(): CircuitBreakerState {
    return { failures: this.failures, openUntil: this.openUntil };
  }

  reset(): void {
    this.failures = 0;
    this.openUntil = 0;
  }
}

// Default singleton for backward compatibility
const defaultBreaker = new CircuitBreaker();

export function isCircuitOpen(): boolean {
  return defaultBreaker.isOpen();
}

export function recordSuccess(): void {
  defaultBreaker.recordSuccess();
}

export function recordFailure(): void {
  defaultBreaker.recordFailure();
}

export function getCircuitState(): { failures: number; openUntil: number } {
  return defaultBreaker.getState();
}

export function createCircuitBreaker(options?: CircuitBreakerOptions): CircuitBreaker {
  return new CircuitBreaker(options);
}
