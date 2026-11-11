import { writeFile } from "node:fs/promises";
import { securityHeaders } from "../security-headers.mjs";
await writeFile(
  new URL("../public/_headers", import.meta.url),
  "/*\n" +
    securityHeaders()
      .map((h) => `  ${h.key}: ${h.value}`)
      .join("\n") +
    "\n",
);
