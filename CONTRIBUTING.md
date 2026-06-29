# Contributing to kompress-ultra

Thanks for your interest in contributing! This guide will help you get started.

## Development Setup

```bash
# Clone the repo
git clone https://github.com/peterlodri-sec/kompress-ultra.git
cd kompress-ultra

# Install dependencies (requires Bun)
bun install

# Run tests
bun test

# Type check
bun run typecheck

# Build
bun run build
```

## Project Structure

- `src/types.ts` — All interfaces and type definitions
- `src/scoring.ts` — Message scoring logic (relevance, recency, structural)
- `src/rewriter.ts` — Compression levels and message rewriting
- `src/compression.ts` — Density computation and adaptive thresholds
- `src/circulator.ts` — Memory enqueueing and message classification
- `src/embedding.ts` — Milvus integration and vector similarity
- `src/brain.ts` — Brain state management
- `src/token-budget.ts` — Per-agent token budgets
- `src/circuit-breaker.ts` — Failure detection and fallback

## Code Style

- TypeScript strict mode
- No external dependencies (Bun stdlib only)
- Functional style where possible
- JSDoc comments for public APIs

## Testing

We use Bun's built-in test runner:

```bash
bun test              # Run all tests
bun test --watch      # Watch mode
```

Tests should cover:
- Edge cases (empty input, max length, Unicode)
- Safety floor guarantees (critical tokens never pruned)
- Circuit breaker state transitions
- Adaptive threshold calculations

## Pull Requests

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Add tests for new functionality
4. Ensure all tests pass (`bun test`)
5. Ensure type check passes (`bun run typecheck`)
6. Submit a PR with a clear description

## Issues

- Use the bug report template for bugs
- Use the feature request template for proposals
- Include reproduction steps for bugs
- Include benchmark data if relevant

## Research Context

This package implements the compression strategy from [Asymmetric Loss Modulation Resolves the Voting Ensemble Paradox](https://kompress.vaked.dev/paper/main.pdf). If your change affects the scoring or compression logic, please:

1. Reference the relevant section of the paper
2. Include before/after benchmark numbers
3. Explain any tradeoffs

## License

By contributing, you agree that your contributions will be licensed under the Apache 2.0 License.
