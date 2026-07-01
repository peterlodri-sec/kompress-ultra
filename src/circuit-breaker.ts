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
    this.openUntil = 0;
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

/**
 * Default singleton for backward compatibility.
 * @deprecated Use `createCircuitBreaker()` + class API for isolated instances.
 * Singletons share state across modules and tests. Prefer new CircuitBreaker().
 */
const defaultBreaker = new CircuitBreaker();

/** @deprecated Use `breaker.isOpen()` on a class instance. */
export function isCircuitOpen(): boolean {
  return defaultBreaker.isOpen();
}

/** @deprecated Use `breaker.recordSuccess()` on a class instance. */
export function recordSuccess(): void {
  defaultBreaker.recordSuccess();
}

/** @deprecated Use `breaker.recordFailure()` on a class instance. */
export function recordFailure(): void {
  defaultBreaker.recordFailure();
}

/** @deprecated Use `breaker.getState()` on a class instance. */
export function getCircuitState(): { failures: number; openUntil: number } {
  return defaultBreaker.getState();
}

export function createCircuitBreaker(options?: CircuitBreakerOptions): CircuitBreaker {
  return new CircuitBreaker(options);
}
