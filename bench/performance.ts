import {
  hashEmbedding,
  cosineSimilarity,
  compressMessage,
} from "../src/index.js";

function makeMessage(i: number): string {
  return (
    `Message ${i}: This is basically just a representative context ` +
    `message with some filler words, implementation details, ` +
    `constraints, errors, and useful information.`
  );
}

function bench(
  name: string,
  sizes: number[],
  fn: (messages: string[]) => void,
): void {
  console.log(`\n${name}`);
  console.log(
    "messages".padStart(10),
    "time ms".padStart(12),
    "µs/msg".padStart(12),
  );

  for (const n of sizes) {
    const messages = Array.from(
      { length: n },
      (_, i) => makeMessage(i),
    );

    // Warm-up
    fn(messages.slice(0, Math.min(n, 1000)));

    const start = performance.now();

    fn(messages);

    const elapsed = performance.now() - start;
    const usPerMessage = (elapsed * 1000) / n;

    console.log(
      n.toString().padStart(10),
      elapsed.toFixed(3).padStart(12),
      usPerMessage.toFixed(3).padStart(12),
    );
  }
}

const sizes = [100, 1_000, 10_000, 100_000];

const goal =
  "implementation constraints errors and useful information";

const goalEmbedding = hashEmbedding(goal);

bench(
  "hashEmbedding",
  sizes,
  (messages) => {
    for (const message of messages) {
      hashEmbedding(message);
    }
  },
);

bench(
  "embedding + cosine",
  sizes,
  (messages) => {
    for (const message of messages) {
      const embedding = hashEmbedding(message);
      cosineSimilarity(embedding, goalEmbedding);
    }
  },
);

bench(
  "rewriter",
  sizes,
  (messages) => {
    for (const message of messages) {
      compressMessage(message, "ultra");
    }
  },
);