// Build step (npm run build, run by Vercel): copies shared/ to public/shared/ so the browser's
// schema and retry modules are served by the CDN like the rest of the front end. Locally the
// server serves /shared/ straight from shared/, so this is only needed for deployments.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const from = path.join(root, "shared");
const to = path.join(root, "public", "shared");

fs.rmSync(to, { recursive: true, force: true });
fs.mkdirSync(to, { recursive: true });
for (const name of fs.readdirSync(from).filter((n) => n.endsWith(".js"))) {
  fs.copyFileSync(path.join(from, name), path.join(to, name));
}
console.log(`Copied ${fs.readdirSync(to).length} shared modules to public/shared/`);
