export class KompressError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "KompressError";
  }
}

export class CompressionError extends KompressError {
  constructor(message: string) {
    super(message, "COMPRESSION_ERROR");
    this.name = "CompressionError";
  }
}

export class EmbeddingError extends KompressError {
  constructor(message: string) {
    super(message, "EMBEDDING_ERROR");
    this.name = "EmbeddingError";
  }
}

export class ConfigError extends KompressError {
  constructor(message: string) {
    super(message, "CONFIG_ERROR");
    this.name = "ConfigError";
  }
}

export class CircuitOpenError extends KompressError {
  constructor() {
    super("Circuit breaker is open; external service unavailable", "CIRCUIT_OPEN");
    this.name = "CircuitOpenError";
  }
}
