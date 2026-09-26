import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const CACHE = resolve(ROOT, ".doreumi");
const DIST = resolve(ROOT, "dist");
// The only files the preview page may write, with their size caps (the check enforces the real limits).
const SAVE = new Map([["item.glb", 4 * 1024 * 1024], ["preview.webp", 1024 * 1024]]);
const SERVE = new Map([["model.glb", ["doreumi-master.glb", "model/gltf-binary"]], ["face-skin.webp", ["face-skin.webp", "image/webp"]], ["face-neutral.webp", ["face-neutral.webp", "image/webp"]]]);

/** Serves the cached model to the preview and lets the "저장" button write into dist/. Local only. */
function doreumiKit() {
  return {
    name: "doreumi-kit",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const kitRoute = url.pathname.startsWith("/__doreumi/") || url.pathname === "/__kit/save";
        // Only this computer's own address may use these routes (blocks DNS rebinding from other sites).
        const hostName = (() => { try { return new URL(`http://${req.headers.host ?? ""}`).hostname; } catch { return ""; } })();
        if (kitRoute && !["127.0.0.1", "localhost", "[::1]"].includes(hostName)) { res.statusCode = 403; res.end(); return; }
        if (req.method === "GET" && url.pathname.startsWith("/__doreumi/")) {
          const entry = SERVE.get(url.pathname.slice("/__doreumi/".length));
          const file = entry && resolve(CACHE, entry[0]);
          if (!file || !existsSync(file)) { res.statusCode = 404; res.end(); return; }
          res.setHeader("Content-Type", entry[1]); res.setHeader("Cache-Control", "no-store");
          res.end(readFileSync(file)); return;
        }
        if (url.pathname === "/__kit/save") {
          const host = req.headers.host;
          let originHost = "";
          try { originHost = new URL(req.headers.origin ?? "").host; } catch { /* missing or "null" origin */ }
          const name = url.searchParams.get("file") ?? "";
          if (req.method !== "POST" || !originHost || originHost !== host || !SAVE.has(name)) { res.statusCode = 403; res.end(); return; }
          const limit = SAVE.get(name);
          const chunks = []; let size = 0, tooBig = false;
          req.on("data", (chunk) => { size += chunk.length; if (size > limit) { if (!tooBig) { tooBig = true; res.statusCode = 413; res.end(); req.destroy(); } } else chunks.push(chunk); });
          req.on("end", () => {
            if (tooBig) return;
            mkdirSync(DIST, { recursive: true });
            const target = resolve(DIST, name), temp = `${target}.part`;
            writeFileSync(temp, Buffer.concat(chunks)); renameSync(temp, target);
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true, file: `dist/${name}`, bytes: size }));
          });
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [doreumiKit()],
  // Opens the browser so the teacher can look. Set DOREUMI_NO_OPEN=1 to skip (for example on a server).
  server: { host: "127.0.0.1", port: 5230, strictPort: false, open: !process.env.DOREUMI_NO_OPEN && !process.env.CI },
  clearScreen: false,
  logLevel: "info",
});
