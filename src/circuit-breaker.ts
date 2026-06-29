const circuitBreaker = { failures: 0, open_until: 0 };

export function isCircuitOpen(): boolean {
  return Date.now() < circuitBreaker.open_until;
}

export function recordSuccess(): void {
  circuitBreaker.failures = 0;
}

export function recordFailure(): void {
  circuitBreaker.failures++;
  if (circuitBreaker.failures >= 3) {
    circuitBreaker.open_until = Date.now() + 60_000;
  }
}

export function getCircuitState(): { failures: number; openUntil: number } {
  return { failures: circuitBreaker.failures, openUntil: circuitBreaker.open_until };
}
