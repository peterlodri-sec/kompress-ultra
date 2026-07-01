import { describe, it, expect } from "bun:test";
import { compressMessage, CompressionLevel } from "../src/rewriter.js";

describe("rewriter", () => {
  describe("compressMessage", () => {
    it("returns content unchanged at Verbatim", () => {
      const input = "This is a test message with some content.";
      expect(compressMessage(input, CompressionLevel.Verbatim)).toBe(input);
    });

    it("preserves code fences at all levels", () => {
      const input = "Before ```js\nconst x = 1;\n``` After";
      const lite = compressMessage(input, CompressionLevel.Lite);
      const ultra = compressMessage(input, CompressionLevel.Ultra);
      expect(lite).toContain("```js\nconst x = 1;\n```");
      expect(ultra).toContain("```js\nconst x = 1;\n```");
    });

    it("preserves error messages", () => {
      const input = "Error: ENOENT: no such file or directory";
      const lite = compressMessage(input, CompressionLevel.Lite);
      const ultra = compressMessage(input, CompressionLevel.Ultra);
      expect(lite).toContain("Error: ENOENT");
      expect(ultra).toContain("Error: ENOENT");
    });

    it("Ultra compression is more aggressive than Lite", () => {
      const input = "The system implementation should really basically support all the tests and things that we need to build.";
      const lite = compressMessage(input, CompressionLevel.Lite);
      const ultra = compressMessage(input, CompressionLevel.Ultra);
      expect(ultra.length).toBeLessThanOrEqual(lite.length);
    });

    it("handles empty string", () => {
      expect(compressMessage("", CompressionLevel.Ultra)).toBe("");
    });

    it("handles single word", () => {
      expect(compressMessage("hello", CompressionLevel.Ultra)).toContain("hello");
    });

    it("Ultra drops filler words", () => {
      const input = "I would be happy to help you with that. Sure! Great! Here is the result.";
      const ultra = compressMessage(input, CompressionLevel.Ultra);
      expect(ultra).not.toContain("happy to help");
      expect(ultra).not.toContain("Sure!");
    });

    it("preserves inline code spans at all levels", () => {
      const input = "Edit the `AGENTS.md` file and check `.gitignore` for the `src/main.rs` path.";
      const lite = compressMessage(input, CompressionLevel.Lite);
      const ultra = compressMessage(input, CompressionLevel.Ultra);
      expect(lite).toContain("`AGENTS.md`");
      expect(lite).toContain("`.gitignore`");
      expect(ultra).toContain("`AGENTS.md`");
      expect(ultra).toContain("`.gitignore`");
      expect(ultra).toContain("`src/main.rs`");
    });

    it("preserves both fenced blocks and inline code together", () => {
      const input = "Run `cargo build` then fix the ```rust\nfn main() {}\n``` block.";
      const ultra = compressMessage(input, CompressionLevel.Ultra);
      expect(ultra).toContain("`cargo build`");
      expect(ultra).toContain("```rust\nfn main() {}\n```");
    });

    it("preserves URLs at Ultra level (does not split on dots)", () => {
      const input = "Check https://www.space.com/astronomy/article for details.";
      const lite = compressMessage(input, CompressionLevel.Lite);
      const ultra = compressMessage(input, CompressionLevel.Ultra);
      expect(lite).toContain("https://www.space.com/astronomy/article");
      expect(ultra).toContain("https://www.space.com/astronomy/article");
      expect(ultra).not.toMatch(/space\. com/);
    });

    it("preserves multiple URLs in prose", () => {
      const input = "See https://example.com/path and also https://youtube.com/watch?v=abc for more.";
      const ultra = compressMessage(input, CompressionLevel.Ultra);
      expect(ultra).toContain("https://example.com/path");
      expect(ultra).toContain("https://youtube.com/watch?v=abc");
    });
  });
});
