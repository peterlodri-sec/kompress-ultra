import { compressMessage, CompressionLevel } from "../src/index.js";
import { readFileSync, writeFileSync } from "node:fs";

const input = readFileSync(process.argv[2], "utf8");
const out = compressMessage(input, CompressionLevel.Ultra);
writeFileSync(process.argv[3], out);
console.log("ultra done");