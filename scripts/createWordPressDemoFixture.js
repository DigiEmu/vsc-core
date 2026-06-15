#!/usr/bin/env node
/**
 * createWordPressDemoFixture.js
 *
 * Creates (or resets) the test-wp/ demo fixture used by the VSC WordPress MVP demo.
 * Idempotent: safe to run multiple times — only missing files are written.
 *
 * Usage:  npm run demo:fixture
 */

import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, "..");
const DEST      = path.join(ROOT, "test-wp");

// ── Helpers ──────────────────────────────────────────────────────────────────

function ensure(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function write(filePath, content, { overwrite = false } = {}) {
  if (!overwrite && fs.existsSync(filePath)) {
    console.log(`  skip  ${path.relative(ROOT, filePath)}`);
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
  console.log(`  write ${path.relative(ROOT, filePath)}`);
}

// ── File contents ─────────────────────────────────────────────────────────────

const files = {
  "index.php": `<?php
// VSC demo WordPress index
echo "VSC demo site";
`,

  "readme.html": `<!DOCTYPE html>
<html><head><title>VSC Demo</title></head>
<body><p>VSC WordPress-style demo fixture v1.7</p></body>
</html>
`,

  "wp-config.php": `<?php
// VSC demo wp-config
define('DB_NAME',     'vsc_demo');
define('DB_USER',     'root');
define('DB_PASSWORD', '');
define('DB_HOST',     'localhost');
define('ABSPATH', __DIR__ . '/');
`,

  "database.sql": `-- VSC demo database export
-- Version: 1 (base)
CREATE TABLE wp_options (option_id INT, option_name VARCHAR(191), option_value LONGTEXT);
INSERT INTO wp_options VALUES (1, 'siteurl', 'http://localhost/vsc-demo');
INSERT INTO wp_options VALUES (2, 'blogname', 'VSC Demo Site');
`,

  "wp-includes/functions.php": `<?php
// VSC demo wp-includes/functions.php
function vsc_demo_helper() {
    return 'VSC demo helper v1';
}
`,

  "wp-content/plugins/vsc-demo-plugin/vsc-demo-plugin.php": `<?php
/*
 * Plugin Name: VSC Demo Plugin
 * Version:     1.0
 * Description: Demo plugin for VSC WordPress backup proof-of-concept.
 */
function vsc_demo_plugin_init() {
    // base version
}
add_action('init', 'vsc_demo_plugin_init');
`,

  "wp-content/uploads/2026/06/vsc-demo-upload.txt": `VSC demo upload file
Created: 2026-06-01
Purpose: representative upload artifact for VSC demo fixture
`,
};

// ── Deterministic payload generator ──────────────────────────────────────────
// Produces repeating, label-seeded text content to simulate realistic file sizes.
// Output is deterministic: same label + targetBytes always produces the same bytes.

function createDeterministicPayload(label, targetBytes) {
  const header = `/* VSC demo generated payload — ${label} */\n`;
  const unit = `/* ${label.padEnd(40, "-")} ${label.split("").reverse().join("").padEnd(28, "-")} */\n`;
  const chunks = [];
  let total = header.length;
  chunks.push(header);
  while (total < targetBytes) {
    const remaining = targetBytes - total;
    const piece = remaining < unit.length ? unit.slice(0, remaining) : unit;
    chunks.push(piece);
    total += piece.length;
  }
  return chunks.join("");
}

// ── Theme: copy real aikido-class or create deterministic fallback ─────────────

const THEME_SRC  = path.join(ROOT, "aikido-class", "aikido-class");
const THEME_DEST = path.join(DEST, "wp-content", "themes", "aikido-class");
const UPLOADS    = path.join(DEST, "wp-content", "uploads", "2026", "06");

function installAikidoTheme() {
  if (!fs.existsSync(THEME_SRC)) {
    console.log("  theme aikido-class not found — generating deterministic fallback theme");

    // style.css ~250 KB
    write(path.join(THEME_DEST, "style.css"),
      `/*\nTheme Name: VSC Demo Fallback Theme\nVersion: 1.0\n*/\n` +
      createDeterministicPayload("theme-style-css", 250 * 1024)
    );

    // functions.php ~20 KB
    write(path.join(THEME_DEST, "functions.php"),
      `<?php\n// VSC demo fallback theme functions.php\n` +
      createDeterministicPayload("theme-functions-php", 20 * 1024)
    );

    // templates/home.php ~80 KB
    write(path.join(THEME_DEST, "templates", "home.php"),
      `<?php\n// VSC demo fallback theme template: home\n` +
      createDeterministicPayload("theme-template-home", 80 * 1024)
    );

    // templates/page.php ~30 KB
    write(path.join(THEME_DEST, "templates", "page.php"),
      `<?php\n// VSC demo fallback theme template: page\n` +
      createDeterministicPayload("theme-template-page", 30 * 1024)
    );

    // assets/css/components.css ~80 KB
    write(path.join(THEME_DEST, "assets", "css", "components.css"),
      createDeterministicPayload("theme-assets-css-components", 80 * 1024)
    );

    // assets/js/main.js ~40 KB
    write(path.join(THEME_DEST, "assets", "js", "main.js"),
      createDeterministicPayload("theme-assets-js-main", 40 * 1024)
    );

    // uploads/demo-media-placeholder.txt ~500 KB
    write(path.join(UPLOADS, "demo-media-placeholder.txt"),
      `VSC demo media placeholder\nPurpose: simulate uploaded media for realistic base size.\n` +
      createDeterministicPayload("uploads-media-placeholder", 500 * 1024)
    );

    // uploads/demo-document-placeholder.txt ~250 KB
    write(path.join(UPLOADS, "demo-document-placeholder.txt"),
      `VSC demo document placeholder\nPurpose: simulate uploaded document for realistic base size.\n` +
      createDeterministicPayload("uploads-document-placeholder", 250 * 1024)
    );

    return;
  }

  // ── Real aikido-class theme present: copy selected files ──────────────────
  const SKIP = new Set(["node_modules", "dist", "package-lock.json", ".git"]);
  function copyDir(src, dest) {
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      if (SKIP.has(entry.name)) continue;
      const srcPath  = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        copyDir(srcPath, destPath);
      } else {
        if (!fs.existsSync(destPath)) {
          fs.mkdirSync(path.dirname(destPath), { recursive: true });
          fs.copyFileSync(srcPath, destPath);
          console.log(`  copy  ${path.relative(ROOT, destPath)}`);
        } else {
          console.log(`  skip  ${path.relative(ROOT, destPath)}`);
        }
      }
    }
  }
  copyDir(THEME_SRC, THEME_DEST);
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log("\nVSC DEMO FIXTURE");
console.log("----------------");
console.log(`Target: ${DEST}\n`);

ensure(DEST);

for (const [rel, content] of Object.entries(files)) {
  write(path.join(DEST, rel), content);
}

installAikidoTheme();

console.log("\nFixture ready.");
console.log("Next step: npm run encode-folder test-wp");
console.log("");
