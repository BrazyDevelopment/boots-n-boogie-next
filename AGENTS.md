# Agent instructions — Boots N Boogie

## Always finish with a GitHub push

**Every update that changes project files must end with a commit and push to GitHub.** Do not leave local-only changes.

Workflow at the end of each task:

1. Build / publish to here.now if the live site should update (`npm run build` then `node publish.mjs`).
2. Stage relevant source changes (respect `.gitignore` — never commit secrets, `out/`, `node_modules/`).
3. Commit with a clear message describing what changed.
4. **Push to `origin/main`** on `BrazyDevelopment/boots-n-boogie-next`:
   ```bash
   git push origin main
   ```
5. Confirm the push succeeded and mention the repo URL in the reply:
   https://github.com/BrazyDevelopment/boots-n-boogie-next

If Git/gh are not on PATH, use portable installs when available:

- Git: `C:\Users\Brazi\AppData\Local\PortableGit\cmd`
- gh: `C:\Users\Brazi\AppData\Local\gh`

## Site

- Live: https://vowful-pumice-vab4.here.now/
- Publish script: `publish.mjs` (slug `vowful-pumice-vab4`)
- Static export: Next.js `output: "export"` → `out/`
