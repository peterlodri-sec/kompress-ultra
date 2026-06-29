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
  });
});
