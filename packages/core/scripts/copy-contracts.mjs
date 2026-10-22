import { cpSync } from "node:fs";
cpSync(new URL("../contracts/", import.meta.url), new URL("../dist/contracts/", import.meta.url), { recursive: true });
