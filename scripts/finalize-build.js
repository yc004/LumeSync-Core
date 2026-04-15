const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const browserSrc = path.join(repoRoot, 'src', 'browser');
const browserDst = path.join(repoRoot, 'dist', 'browser');

function copyDir(src, dst) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDir(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

copyDir(browserSrc, browserDst);

fs.writeFileSync(path.join(repoRoot, 'dist', 'cjs', 'package.json'), JSON.stringify({ type: 'commonjs' }, null, 2));
fs.writeFileSync(path.join(repoRoot, 'dist', 'esm', 'package.json'), JSON.stringify({ type: 'module' }, null, 2));

const esmRenderEngine = path.join(repoRoot, 'dist', 'esm', 'node', 'render-engine.js');
if (fs.existsSync(esmRenderEngine)) {
  const source = fs.readFileSync(esmRenderEngine, 'utf8');
  fs.writeFileSync(
    esmRenderEngine,
    source.replace(
      "import path from 'path';",
      "import path from 'path';\nimport { fileURLToPath } from 'url';\nconst __dirname = path.dirname(fileURLToPath(import.meta.url));"
    ),
    'utf8'
  );
}

console.log('[core-build] wrote dist/cjs, dist/esm, dist/types, dist/browser');
