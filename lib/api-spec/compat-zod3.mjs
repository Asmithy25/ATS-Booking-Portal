import { readFile, writeFile } from "node:fs/promises";

const target = new URL("../api-zod/src/generated/api.ts", import.meta.url);
let source = await readFile(target, "utf8");
source = source
  .replaceAll("zod.int()", "zod.number().int()")
  .replaceAll("zod.email()", "zod.string().email()");
await writeFile(target, source);