import { describe, it, expect } from "bun:test";
import {
  KompressError,
  CompressionError,
  EmbeddingError,
  ConfigError,
  CircuitOpenError,
} from "../src/errors.js";

describe("errors", () => {
  it("KompressError has name and code", () => {
    const err = new KompressError("test", "TEST_CODE");
    expect(err.name).toBe("KompressError");
    expect(err.code).toBe("TEST_CODE");
    expect(err.message).toBe("test");
    expect(err instanceof Error).toBe(true);
  });

  it("CompressionError extends KompressError", () => {
    const err = new CompressionError("compression failed");
    expect(err.name).toBe("CompressionError");
    expect(err.code).toBe("COMPRESSION_ERROR");
    expect(err instanceof KompressError).toBe(true);
    expect(err instanceof Error).toBe(true);
  });

  it("EmbeddingError extends KompressError", () => {
    const err = new EmbeddingError("embedding failed");
    expect(err.name).toBe("EmbeddingError");
    expect(err.code).toBe("EMBEDDING_ERROR");
    expect(err instanceof KompressError).toBe(true);
  });

  it("ConfigError extends KompressError", () => {
    const err = new ConfigError("bad config");
    expect(err.name).toBe("ConfigError");
    expect(err.code).toBe("CONFIG_ERROR");
    expect(err instanceof KompressError).toBe(true);
  });

  it("CircuitOpenError has default message and code", () => {
    const err = new CircuitOpenError();
    expect(err.name).toBe("CircuitOpenError");
    expect(err.code).toBe("CIRCUIT_OPEN");
    expect(err.message).toContain("Circuit breaker is open");
    expect(err instanceof KompressError).toBe(true);
  });

  it("instanceof works across hierarchy", () => {
    const err = new ConfigError("test");
    expect(err instanceof KompressError).toBe(true);
    expect(err instanceof Error).toBe(true);
    expect(err instanceof CompressionError).toBe(false);
  });
});
