import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, appendFileSync } from "fs";
import { createHash } from "crypto";
import { join, relative, extname } from "path";
import { execSync } from "child_process";

const ROOT = "C:\\Users\\Brazi\\Documents\\boots-n-boogie-next";
const TARGET = join(ROOT, "out");
const LOG = join(ROOT, "publish-debug.log");
const log = (m) => {
  console.log(m);
  appendFileSync(LOG, m + "\n");
};

writeFileSync(LOG, "");
const apiKey = readFileSync(join(process.env.USERPROFILE, ".herenow", "credentials"), "utf8").trim();
const CT = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

function walk(dir, base = dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const f = join(dir, e.name);
    // Include .herenow/data.json (Site Data) and .herenow/proxy.json — required for accounts
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".git") continue;
      out.push(...walk(f, base));
      continue;
    }
    if (!e.isFile()) continue;
    if (e.name.endsWith(".log") || e.name.startsWith("_body") || e.name.startsWith("_fin")) continue;
    // Never publish local claim/state cache if present under out
    if (e.name === "state.json") continue;
    out.push(relative(base, f).replace(/\\/g, "/"));
  }
  return out;
}

// Ensure Site Data manifest is valid UTF-8 JSON with no BOM (PowerShell rewrites often inject EF BB BF).
const dataJsonPath = join(TARGET, ".herenow", "data.json");
try {
  const raw = readFileSync(dataJsonPath);
  const text = raw.toString("utf8").replace(/^\uFEFF/, "");
  const parsed = JSON.parse(text);
  const clean = Buffer.from(JSON.stringify(parsed, null, 2) + "\n", "utf8");
  writeFileSync(dataJsonPath, clean);
  log(`Site Data manifest cleaned: ${clean.length} bytes, no BOM`);
} catch (e) {
  log(`WARNING: could not clean .herenow/data.json: ${e.message}`);
}

const paths = walk(TARGET);
const fileMap = new Map();
const files = paths.map((p) => {
  const full = join(TARGET, p);
  fileMap.set(p, full);
  return {
    path: p,
    size: statSync(full).size,
    contentType: CT[extname(full).toLowerCase()] || "application/octet-stream",
    hash: createHash("sha256").update(readFileSync(full)).digest("hex"),
  };
});

log(`Files: ${files.length}`);
const bodyPath = join(TARGET, "_body.json");
writeFileSync(
  bodyPath,
  JSON.stringify({
    files,
    spaMode: true,
    displayName: "Boots N Boogie",
    displayDescription:
      "Production redesign of Boots N Boogie line dancing — classes, socials & community in Rugby.",
  })
);

const SLUG = process.env.HERENOW_SLUG || "vowful-pumice-vab4";
function curlJson(cmd, label) {
  let lastErr;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const raw = execSync(cmd, { maxBuffer: 20 * 1024 * 1024 }).toString();
      log(`${label} attempt ${attempt}: ${raw.slice(0, 500)}`);
      if (!raw.trim()) throw new Error("Empty response");
      const json = JSON.parse(raw);
      if (json.error) throw new Error(typeof json.error === "string" ? json.error : JSON.stringify(json));
      return json;
    } catch (e) {
      lastErr = e;
      log(`${label} attempt ${attempt} failed: ${e.message || e}`);
      if (attempt < 5) execSync("timeout /t 5 /nobreak >nul", { shell: "cmd.exe" });
    }
  }
  throw lastErr;
}

const createCmd = SLUG
  ? `curl.exe -sS -X PUT "https://here.now/api/v1/publish/${SLUG}" -H "authorization: Bearer ${apiKey}" -H "content-type: application/json" -H "x-herenow-client: grok/publish-mjs" -d "@${bodyPath}"`
  : `curl.exe -sS -X POST "https://here.now/api/v1/publish" -H "authorization: Bearer ${apiKey}" -H "content-type: application/json" -H "x-herenow-client: grok/publish-mjs" -d "@${bodyPath}"`;
const resp = curlJson(createCmd, "Create/update");
log(`Slug: ${resp.slug}`);
log(`Site: ${resp.siteUrl}`);

let i = 0;
const uploads = resp.upload?.uploads || [];
for (const u of uploads) {
  const local = fileMap.get(u.path);
  if (!local) throw new Error(`Missing local file for ${u.path}`);
  const ct = u.headers?.["Content-Type"] || "";
  const ctArg = ct ? `-H "Content-Type: ${ct}"` : "";
  execSync(`curl.exe -sS -X PUT ${ctArg} --data-binary "@${local}" "${u.url}"`, {
    maxBuffer: 50 * 1024 * 1024,
  });
  i++;
  if (i % 15 === 0 || i === uploads.length) log(`Uploaded ${i}/${uploads.length}`);
}

log("Finalizing...");
const finPath = join(TARGET, "_fin.json");
writeFileSync(finPath, JSON.stringify({ versionId: resp.upload.versionId }));
let finRaw = "";
let fin = null;
for (let attempt = 1; attempt <= 4; attempt++) {
  try {
    finRaw = execSync(
      `curl.exe -sS -X POST "${resp.upload.finalizeUrl}" -H "authorization: Bearer ${apiKey}" -H "content-type: application/json" -d "@${finPath}"`,
      { maxBuffer: 10 * 1024 * 1024 }
    ).toString();
    log(`Finalize attempt ${attempt}: ${finRaw.slice(0, 2000)}`);
    if (!finRaw.trim()) {
      throw new Error("Empty finalize response");
    }
    fin = JSON.parse(finRaw);
    if (fin.error) {
      throw new Error(typeof fin.error === "string" ? fin.error : JSON.stringify(fin));
    }
    break;
  } catch (e) {
    log(`Finalize attempt ${attempt} failed: ${e.message || e}`);
    if (attempt === 4) throw e;
    execSync("timeout /t 3 /nobreak >nul", { shell: "cmd.exe" });
  }
}

log(`DONE: ${resp.siteUrl}`);
log(`publish_result.auth_mode=authenticated`);
log(`publish_result.site_url=${resp.siteUrl}`);
log(`publish_result.slug=${resp.slug}`);
mkdirSync(join(ROOT, ".herenow"), { recursive: true });
writeFileSync(
  join(ROOT, ".herenow", "state.json"),
  JSON.stringify({ publishes: { [resp.slug]: { siteUrl: resp.siteUrl } } }, null, 2)
);
console.log(resp.siteUrl);
