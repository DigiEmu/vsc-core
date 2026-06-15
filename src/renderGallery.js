import fs from "fs";
import path from "path";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function shortHash(hash = "", length = 16) {
  return String(hash || "").slice(0, length);
}

function normalizeType(type = "") {
  return String(type || "TOKEN").toUpperCase();
}

function formatBytes(bytes = 0) {
  const n = Number(bytes) || 0;
  if (n === 0) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(2)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatPercent(value = 0) {
  return `${Number(value).toFixed(2)}%`;
}

function calcReduction(fullSize, deltaSize) {
  const f = Number(fullSize) || 0;
  const d = Number(deltaSize) || 0;
  if (f <= 0 || d <= 0 || d >= f) return null;
  return ((f - d) / f) * 100;
}

function getTokenMode(entry) {
  if (entry.mode) return String(entry.mode).toUpperCase();
  const enc = String(entry.encoding || "").toUpperCase();
  if (enc === "BINARY_FOLDER_DELTA") return "FOLDER_DELTA";
  if (enc === "BINARY_FOLDER") return "FOLDER_RECOVERY";
  if (enc === "BINARY") return "RECOVERY";
  return "PROOF";
}

function shortFileName(relPath = "") {
  const parts = String(relPath).replaceAll("\\", "/").split("/");
  return parts[parts.length - 1] || relPath;
}

function loadTokenJson(entry, outputDir = "output") {
  try {
    const p = path.join(outputDir, entry.json);
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, "utf8"));
    }
  } catch {
    // ignore
  }
  return null;
}

// ─── Badge helpers ────────────────────────────────────────────────────────────

function modeBadge(mode) {
  const cls = {
    FOLDER_DELTA:    "badge badge-delta",
    FOLDER_RECOVERY: "badge badge-folder",
    RECOVERY:        "badge badge-recovery",
    PROOF:           "badge badge-proof",
    TEXT:            "badge badge-text",
    ETHIC:           "badge badge-ethic",
    MELODY:          "badge badge-melody",
    DELTA_CHAIN:     "badge badge-chain",
  }[mode] || "badge";
  return `<span class="${cls}">${escapeHtml(mode)}</span>`;
}

// ─── Card section renderers ───────────────────────────────────────────────────

function metaRow(label, value, extraClass = "") {
  return `<div class="meta-row${extraClass ? " " + extraClass : ""}">
    <span class="meta-label">${escapeHtml(label)}</span>
    <span class="meta-value">${value}</span>
  </div>`;
}

function monoSpan(value) {
  return `<span class="mono">${escapeHtml(String(value))}</span>`;
}

function hashSpan(value) {
  return `<span class="hash">${escapeHtml(String(value))}</span>`;
}

function renderDeltaChainSection(entry, token) {
  const summary = token?.summary || entry;
  const proof   = token?.proof   || {};
  const steps   = Array.isArray(token?.steps) ? token.steps : [];

  const baseId   = escapeHtml(token?.baseTokenId  || entry.baseline || "—");
  const latestId = escapeHtml(token?.latestTokenId || entry.id      || "—");

  const stepCount       = summary.stepCount      ?? steps.length;
  const totalDeltaBytes = summary.totalDeltaSizeBytes     ?? Number(entry.fileSizeBytes || entry.messageLength || 0);
  const estFullBytes    = summary.estimatedFullCopyBytes  ?? 0;
  const reductionPct    = summary.estimatedReductionPercent ?? null;
  const totalChunks     = summary.totalDeltaChunks ?? Number(entry.chunkCount || 0);
  const totalAdded      = summary.totalAdded    ?? 0;
  const totalModified   = summary.totalModified ?? 0;
  const totalDeleted    = summary.totalDeleted  ?? 0;

  const chainHashShort  = shortHash(proof.chainHash || entry.payloadHash || "", 16);
  const latestRootShort = shortHash(proof.latestFolderRootHash || "", 16);

  // ── KPI row ──
  // Primary highlight: reduction (if available), else total delta
  const kpis = [];
  if (reductionPct !== null) {
    kpis.push({ value: escapeHtml(formatPercent(reductionPct)), label: "Delta reduction", highlight: true });
  }
  kpis.push({ value: String(stepCount), label: "Steps" });
  kpis.push({ value: escapeHtml(formatBytes(totalDeltaBytes)), label: "Total delta" });
  if (estFullBytes > 0) {
    kpis.push({ value: escapeHtml(formatBytes(estFullBytes)), label: "Full copy est." });
  }
  if (totalChunks > 0) {
    kpis.push({ value: String(totalChunks), label: "Chunks" });
  }

  const kpiHtml = kpis.map(k =>
    `<div class="metric-cell${k.highlight ? " metric-highlight" : ""}">
      <div class="metric-value">${k.value}</div>
      <div class="metric-label">${escapeHtml(k.label)}</div>
    </div>`
  ).join("");

  // ── Timeline steps ──
  const timelineNodes = [];
  timelineNodes.push({ label: "Base snapshot", id: baseId, cls: "tl-node-base" });
  for (let i = 0; i < steps.length; i++) {
    const st = steps[i];
    const isLast = i === steps.length - 1;
    timelineNodes.push({
      label: `Step ${st.index}`,
      id: escapeHtml(String(st.toTokenId || "").slice(0, 12)),
      cls: isLast ? "tl-node-latest" : "tl-node-delta",
      meta: `+${st.addedCount} ~${st.modifiedCount} -${st.deletedCount} · ${escapeHtml(formatBytes(st.deltaSizeBytes || 0))}`,
      rootPrefix: shortHash(st.targetFolderRootHash || "", 12),
    });
  }

  const timelineHtml = `<div class="chain-timeline">
    ${timelineNodes.map((n, i) => `
      <div class="tl-entry">
        <div class="tl-spine">
          <div class="tl-dot ${n.cls}"></div>
          ${i < timelineNodes.length - 1 ? `<div class="tl-line"></div>` : ""}
        </div>
        <div class="tl-body">
          <div class="tl-label">${n.label}</div>
          <div class="tl-id">${n.id}</div>
          ${n.meta ? `<div class="tl-meta">${n.meta}</div>` : ""}
          ${n.rootPrefix ? `<div class="tl-root">root: ${escapeHtml(n.rootPrefix)}…</div>` : ""}
        </div>
      </div>
    `).join("")}
  </div>`;

  // ── Restore model sentence ──
  const restoreNodes = ["Base", ...steps.map(s => `Delta ${s.index}`)].join(" → ") + " → Latest verified state";

  return `
    <div class="card-descriptor">Restore base + ordered deltas to reconstruct latest state</div>

    <div class="delta-bridge">${baseId} <span class="delta-arrow">→</span> ${latestId}</div>

    <div class="delta-metrics">${kpiHtml}</div>

    ${timelineHtml}

    <div class="restore-model">
      <span class="restore-model-label">Restore model</span>
      <span class="restore-model-path">${escapeHtml(restoreNodes)}</span>
    </div>

    <div class="meta-grid" style="margin-top:12px">
      ${chainHashShort  ? metaRow("Chain hash",   hashSpan(chainHashShort),  "meta-row-hash") : ""}
      ${latestRootShort ? metaRow("Latest root",  hashSpan(latestRootShort), "meta-row-hash") : ""}
    </div>

    <div class="delta-stored-label">Verify: latest root hash · ${totalAdded} added · ${totalModified} modified · ${totalDeleted} deleted</div>`;
}

function renderFolderDeltaSection(entry, token) {
  const summary   = token?.summary || {};
  const ops       = Array.isArray(token?.operations) ? token.operations : [];
  const proof     = token?.proof || {};
  const baseId    = escapeHtml(token?.baseTokenId || entry.baseline || "—");
  const targetId  = escapeHtml(entry.id || "—");

  const addedCount    = summary.addedCount    ?? ops.filter(o => o.op === "ADD").length;
  const modifiedCount = summary.modifiedCount ?? ops.filter(o => o.op === "MODIFY").length;
  const deletedCount  = summary.deletedCount  ?? ops.filter(o => o.op === "DELETE").length;
  const changedCount  = summary.changedFileCount ?? (addedCount + modifiedCount + deletedCount);
  const deltaSizeBytes  = summary.deltaSizeBytes  ?? Number(entry.fileSizeBytes || entry.messageLength || 0);
  const deltaChunkCount = summary.deltaChunkCount ?? Number(entry.chunkCount || 0);

  const targetRootShort = shortHash(proof.targetFolderRootHash || entry.payloadHash || "", 16);
  const baseSizeBytes   = entry._baseSizeBytes || 0;
  const reduction       = calcReduction(baseSizeBytes, deltaSizeBytes);

  // ── KPI row: reduction is the hero if we have it ──
  const kpis = [];
  if (reduction !== null) {
    kpis.push({ value: escapeHtml(formatPercent(reduction)), label: "Reduction", highlight: true });
  }
  kpis.push({ value: escapeHtml(formatBytes(deltaSizeBytes)), label: "Delta size" });
  if (baseSizeBytes > 0) {
    kpis.push({ value: escapeHtml(formatBytes(baseSizeBytes)), label: "Full / base" });
  }
  kpis.push({ value: String(changedCount), label: "Changed files" });
  kpis.push({ value: String(deltaChunkCount), label: "Chunks" });

  const kpiHtml = kpis.map(k =>
    `<div class="metric-cell${k.highlight ? " metric-highlight" : ""}">
      <div class="metric-value">${k.value}</div>
      <div class="metric-label">${escapeHtml(k.label)}</div>
    </div>`
  ).join("");

  // ── Explicit changed-files list (all ops, not capped) ──
  const changedOps = ops.filter(o => o.op === "ADD" || o.op === "MODIFY" || o.op === "DELETE");
  const changedFilesHtml = changedOps.length > 0
    ? `<div class="changed-files">
        <div class="changed-files-header">
          <span>Changed files</span>
          <span class="changed-files-count">${addedCount > 0 ? `+${addedCount} added` : ""} ${modifiedCount > 0 ? `~${modifiedCount} modified` : ""} ${deletedCount > 0 ? `-${deletedCount} deleted` : ""}</span>
        </div>
        ${changedOps.map(op => {
          const opCls  = op.op === "ADD" ? "cf-add" : op.op === "DELETE" ? "cf-del" : "cf-mod";
          const opTag  = op.op === "ADD" ? "ADD" : op.op === "DELETE" ? "DEL" : "MOD";
          const relPath = String(op.relativePath || "").replaceAll("\\", "/");
          return `<div class="cf-row">
            <span class="cf-op ${opCls}">${opTag}</span>
            <span class="cf-path" title="${escapeHtml(relPath)}">${escapeHtml(relPath)}</span>
          </div>`;
        }).join("")}
      </div>`
    : "";

  return `
    <div class="card-descriptor">Stores changed files only — apply to base to restore target state</div>

    <div class="delta-bridge">${baseId} <span class="delta-arrow">→</span> ${targetId}</div>

    <div class="delta-metrics">${kpiHtml}</div>

    ${changedFilesHtml}

    <div class="meta-grid" style="margin-top:12px">
      ${metaRow("Verify model", hashSpan(targetRootShort), "meta-row-hash")}
    </div>

    <div class="delta-stored-label">Stored: changed files only · Verify: target root hash</div>`;
}

function renderFolderRecoverySection(entry, token) {
  const fileCount  = token?.fileCount  ?? Number(entry.deltaCount || 0);
  const totalBytes = token?.totalSizeBytes ?? Number(entry.fileSizeBytes || entry.messageLength || 0);
  const chunks     = token?.totalChunkCount ?? Number(entry.chunkCount || 0);
  const rootHash   = shortHash(token?.proof?.folderRootHash || entry.payloadHash || "", 16);

  return `
    <div class="card-descriptor">Full folder base snapshot — foundation for delta and chain tokens</div>
    <div class="delta-metrics">
      <div class="metric-cell">
        <div class="metric-value">${fileCount}</div>
        <div class="metric-label">Files</div>
      </div>
      <div class="metric-cell">
        <div class="metric-value">${escapeHtml(formatBytes(totalBytes))}</div>
        <div class="metric-label">Total size</div>
      </div>
      <div class="metric-cell">
        <div class="metric-value">${chunks}</div>
        <div class="metric-label">Chunks</div>
      </div>
    </div>
    <div class="meta-grid" style="margin-top:12px">
      ${metaRow("Root hash",  hashSpan(rootHash), "meta-row-hash")}
    </div>`;
}

function renderRecoverySection(entry, token) {
  const sizeBytes = token?.file?.sizeBytes ?? Number(entry.fileSizeBytes || entry.messageLength || 0);
  const chunks    = token?.file?.chunkCount ?? Number(entry.chunkCount || 0);
  const hash      = shortHash(token?.proof?.payloadHash || entry.payloadHash || "", 16);

  return `
    <div class="card-descriptor">Recoverable binary file token — restore from chunks by hash</div>
    <div class="delta-metrics">
      <div class="metric-cell">
        <div class="metric-value">${escapeHtml(formatBytes(sizeBytes))}</div>
        <div class="metric-label">File size</div>
      </div>
      <div class="metric-cell">
        <div class="metric-value">${chunks}</div>
        <div class="metric-label">Chunks</div>
      </div>
    </div>
    <div class="meta-grid" style="margin-top:12px">
      ${metaRow("Hash",      hashSpan(hash), "meta-row-hash")}
    </div>`;
}

function renderTextSection(entry) {
  const msgLen     = Number(entry.messageLength || 0);
  const deltaCount = Number(entry.deltaCount || 0);
  const hash       = shortHash(entry.payloadHash || "", 16);
  const type       = String(entry.type || "TEXT").toUpperCase();
  const descriptor = {
    TEXT:   "Sparse text proof token — content verified by payload hash",
    MELODY: "Sparse melody proof token — sequence verified by payload hash",
    ETHIC:  "Sparse ethic proof token — statement verified by payload hash",
  }[type] || "Sparse proof token — content verified by payload hash";

  return `
    <div class="card-descriptor">${escapeHtml(descriptor)}</div>
    <div class="delta-metrics">
      <div class="metric-cell">
        <div class="metric-value">${msgLen}</div>
        <div class="metric-label">Message length</div>
      </div>
      <div class="metric-cell">
        <div class="metric-value">${deltaCount}</div>
        <div class="metric-label">Delta entries</div>
      </div>
    </div>
    <div class="meta-grid" style="margin-top:12px">
      ${metaRow("Hash",           hashSpan(hash), "meta-row-hash")}
    </div>`;
}

// ─── Main card renderer ───────────────────────────────────────────────────────

function renderCard(item = {}) {
  const mode    = getTokenMode(item);
  const type    = normalizeType(item.type);
  const id      = escapeHtml(item.id || "UNKNOWN");
  const version = escapeHtml(item.version || "0.0");
  const svgFile = escapeHtml(item.svg || "");
  const jsonFile = escapeHtml(item.json || "");

  const token = loadTokenJson(item);

  let titleText = type;
  if (mode === "FOLDER_DELTA")    titleText = "DELTA";
  if (mode === "FOLDER_RECOVERY") titleText = "FOLDER";
  if (mode === "RECOVERY")        titleText = type || "FILE";
  if (mode === "DELTA_CHAIN")     titleText = "CHAIN";

  let bodyHtml = "";
  if (mode === "DELTA_CHAIN") {
    bodyHtml = renderDeltaChainSection(item, token);
  } else if (mode === "FOLDER_DELTA") {
    bodyHtml = renderFolderDeltaSection(item, token);
  } else if (mode === "FOLDER_RECOVERY") {
    bodyHtml = renderFolderRecoverySection(item, token);
  } else if (mode === "RECOVERY") {
    bodyHtml = renderRecoverySection(item, token);
  } else {
    bodyHtml = renderTextSection(item);
  }

  const previewHtml = svgFile
    ? `<img src="${svgFile}" alt="${escapeHtml(titleText)} token preview" loading="lazy" />`
    : `<div class="preview-placeholder">No SVG preview generated</div>`;

  return `
    <article class="card card-${mode.toLowerCase().replaceAll("_", "-")}">
      <div class="preview">
        ${previewHtml}
      </div>

      <div class="content">
        <div class="content-top">
          <h2 class="title">${escapeHtml(titleText)}</h2>
          <div class="badge-group">
            ${modeBadge(mode)}
          </div>
        </div>

        <div class="token-id-row">
          <span class="meta-label">Token ID</span>
          <span class="mono token-id-value">${id}</span>
        </div>
        <div class="token-id-row" style="margin-bottom:14px">
          <span class="meta-label">Version</span>
          <span class="meta-value">${version}</span>
        </div>

        ${bodyHtml}

        <div class="actions">
          <a href="${svgFile}" target="_blank" rel="noopener noreferrer">Open SVG</a>
          <a href="${jsonFile}" target="_blank" rel="noopener noreferrer">Open JSON</a>
        </div>
      </div>
    </article>
  `;
}

// ─── Page renderer ────────────────────────────────────────────────────────────

export function renderGalleryPage(manifest = [], outputDir = "output") {
  const safeManifest = Array.isArray(manifest) ? manifest : [];

  // Attach base sizes to FOLDER_DELTA entries by matching baseline ID to FOLDER_RECOVERY entry
  const recoveryByBaseId = new Map();
  for (const entry of safeManifest) {
    if (getTokenMode(entry) === "FOLDER_RECOVERY") {
      recoveryByBaseId.set(entry.id, Number(entry.fileSizeBytes || entry.messageLength || 0));
    }
  }
  const enriched = safeManifest.map(entry => {
    if (getTokenMode(entry) === "FOLDER_DELTA" && entry.baseline) {
      const baseSize = recoveryByBaseId.get(entry.baseline) || 0;
      return { ...entry, _baseSizeBytes: baseSize };
    }
    return entry;
  });

  function sortWeight(entry) {
    const mode = (entry.mode || entry.type || "").toUpperCase();
    if (mode === "DELTA_CHAIN")     return 0;
    if (mode === "FOLDER_DELTA")    return 1;
    if (mode === "FOLDER_RECOVERY") return 2;
    if (mode === "RECOVERY")        return 3;
    return 4;
  }

  const sorted = [...enriched].sort((a, b) => {
    const wDiff = sortWeight(a) - sortWeight(b);
    if (wDiff !== 0) return wDiff;
    const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tB - tA;
  });

  const tokenCount    = sorted.length;
  const deltaCount    = sorted.filter(e => getTokenMode(e) === "FOLDER_DELTA").length;
  const recoveryCount = sorted.filter(e => getTokenMode(e) === "FOLDER_RECOVERY").length;
  const chainCount    = sorted.filter(e => (e.mode || e.type || "").toUpperCase() === "DELTA_CHAIN").length;

  const cards = sorted.map(renderCard).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>VSC Token Gallery</title>
  <style>
    :root {
      --bg: #f4f4f2;
      --card: #ffffff;
      --line: #dddddd;
      --line-soft: #ececec;
      --text: #111111;
      --muted: #666666;
      --shadow: 0 10px 30px rgba(0,0,0,0.06);
      --radius: 22px;
      --delta-accent: #1a1a1a;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      background:
        radial-gradient(circle at top left, rgba(0,0,0,0.025), transparent 35%),
        linear-gradient(to bottom, #fafaf9, #f1f1ef);
      color: var(--text);
      font-family: Arial, Helvetica, sans-serif;
    }

    .shell {
      max-width: 1500px;
      margin: 0 auto;
      padding: 32px 28px 56px;
    }

    .hero {
      background: rgba(255,255,255,0.76);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(0,0,0,0.08);
      border-radius: 28px;
      padding: 28px 30px 24px;
      margin-bottom: 30px;
      box-shadow: var(--shadow);
    }

    .eyebrow {
      font-size: 12px;
      letter-spacing: 4px;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 10px;
    }

    h1 { margin: 0; font-size: 34px; letter-spacing: 6px; font-weight: 500; }

    .hero-subtitle {
      margin: 12px 0 22px;
      color: var(--muted);
      font-size: 16px;
      line-height: 1.6;
      max-width: 900px;
    }

    .stats { display: flex; flex-wrap: wrap; gap: 14px; }

    .stat {
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 10px 16px;
      font-size: 14px;
      color: #222;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
      gap: 28px;
      align-items: start;
    }

    /* ── Card ── */
    .card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      overflow: hidden;
      box-shadow: var(--shadow);
      transition: transform 0.18s ease, box-shadow 0.18s ease;
    }

    .card:hover {
      transform: translateY(-4px);
      box-shadow: 0 14px 34px rgba(0,0,0,0.08);
    }

    .card-folder-delta {
      border-color: #c8c8c8;
    }

    .preview {
      min-height: 480px;
      padding: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(to bottom, rgba(255,255,255,0.9), rgba(248,248,246,1));
      border-bottom: 1px solid var(--line-soft);
    }

    .preview img {
      width: 100%;
      max-height: 460px;
      object-fit: contain;
      display: block;
      filter: drop-shadow(0 3px 8px rgba(0,0,0,0.04));
    }

    .content { padding: 20px 22px 24px; }

    .content-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
    }

    .title { margin: 0; font-size: 26px; letter-spacing: 5px; font-weight: 500; }

    .badge-group { display: flex; gap: 6px; flex-wrap: wrap; }

    /* ── Badges ── */
    .badge {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 5px 11px;
      font-size: 11px;
      letter-spacing: 1.5px;
      border: 1px solid #cfcfcf;
      color: #333;
      background: #f7f7f7;
      white-space: nowrap;
    }

    .badge-delta    { background: #111; color: #fff; border-color: #111; letter-spacing: 1px; }
    .badge-folder   { background: #f0f0f0; border-color: #bbb; }
    .badge-recovery { background: #f5f5ff; border-color: #c0c0e0; }
    .badge-proof    { background: #fff8f0; border-color: #e0d0b0; }
    .badge-text     { background: #f2f6ff; }
    .badge-ethic    { background: #f5fff2; }
    .badge-melody   { background: #fff7f1; }
    .badge-chain    { background: #111; color: #fff; border-color: #111; font-weight: 600; }

    /* ── Token ID row ── */
    .token-id-row {
      display: flex;
      align-items: baseline;
      gap: 10px;
      margin-bottom: 4px;
    }

    .token-id-value {
      font-family: "Courier New", monospace;
      font-size: 13px;
      color: #111;
      word-break: break-all;
    }

    /* ── Meta grid ── */
    .meta-grid { display: grid; gap: 8px; margin-bottom: 16px; }

    .meta-row {
      display: grid;
      grid-template-columns: 130px 1fr;
      gap: 10px;
      align-items: start;
      padding-bottom: 7px;
      border-bottom: 1px solid #f0f0f0;
    }

    .meta-row-hash { border-bottom: none; padding-bottom: 0; }

    .meta-label { color: var(--muted); font-size: 13px; }
    .meta-value { color: var(--text); font-size: 14px; line-height: 1.45; word-break: break-word; }

    .mono { font-family: "Courier New", monospace; }

    .hash {
      display: inline-block;
      background: #f3f3f3;
      border: 1px solid #e7e7e7;
      border-radius: 8px;
      padding: 4px 9px;
      font-family: "Courier New", monospace;
      font-size: 12px;
      word-break: break-all;
    }

    /* ── Delta-specific ── */
    .delta-bridge {
      font-family: "Courier New", monospace;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 1px;
      color: #111;
      margin-bottom: 14px;
      padding: 10px 14px;
      background: #f6f6f6;
      border-radius: 10px;
      border: 1px solid #e4e4e4;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .delta-arrow { color: #555; margin: 0 6px; }

    .delta-metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
      gap: 10px;
      margin-bottom: 14px;
    }

    .metric-cell {
      background: #fafafa;
      border: 1px solid #ececec;
      border-radius: 12px;
      padding: 10px 10px 8px;
      text-align: center;
    }

    .metric-highlight {
      background: #111;
      border-color: #111;
    }

    .metric-highlight .metric-value,
    .metric-highlight .metric-label { color: #fff; }

    .metric-value { font-size: 16px; font-weight: 600; color: #111; line-height: 1.2; }
    .metric-label { font-size: 11px; color: var(--muted); margin-top: 3px; letter-spacing: 0.5px; }

    .section-label {
      font-size: 11px;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 10px;
    }

    .op-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 10px 0 12px;
    }

    .op-pill {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 4px 11px;
      font-family: "Courier New", monospace;
      font-size: 12px;
      border: 1px solid #ccc;
      background: #f5f5f5;
      color: #222;
      white-space: nowrap;
    }

    .op-pill.op-modify { background: #111; color: #fff; border-color: #111; }
    .op-pill.op-add    { background: #f0fff0; border-color: #aaddaa; color: #1a4a1a; }
    .op-pill.op-delete { background: #fff0f0; border-color: #ddaaaa; color: #4a1a1a; }

    /* ── Card descriptor ── */
    .card-descriptor {
      font-size: 13px;
      color: var(--muted);
      margin-bottom: 14px;
      line-height: 1.5;
      border-left: 3px solid #e0e0e0;
      padding-left: 10px;
    }

    .delta-stored-label {
      font-size: 11px;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--muted);
      margin-top: 6px;
      margin-bottom: 16px;
    }

    .preview-placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 200px;
      background: #f4f4f4;
      border: 1px dashed #ccc;
      border-radius: 12px;
      color: #999;
      font-size: 13px;
      letter-spacing: 1px;
    }

    /* ── Chain timeline ── */
    .chain-timeline {
      margin: 12px 0 14px;
      display: grid;
      gap: 0;
    }

    .tl-entry {
      display: flex;
      gap: 12px;
      align-items: stretch;
    }

    .tl-spine {
      display: flex;
      flex-direction: column;
      align-items: center;
      flex-shrink: 0;
      width: 20px;
    }

    .tl-dot {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      flex-shrink: 0;
      margin-top: 4px;
    }

    .tl-node-base   { background: #fff; border: 2px solid #111; }
    .tl-node-delta  { background: #666; border: 2px solid #444; }
    .tl-node-latest { background: #111; border: 2px solid #111; }

    .tl-line {
      flex: 1;
      width: 2px;
      background: #ddd;
      margin: 2px 0;
      min-height: 16px;
    }

    .tl-body {
      padding-bottom: 14px;
      flex: 1;
      min-width: 0;
    }

    .tl-label {
      font-size: 12px;
      font-weight: 700;
      color: #111;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    .tl-id {
      font-family: "Courier New", monospace;
      font-size: 12px;
      color: #444;
      margin-top: 1px;
    }

    .tl-meta {
      font-size: 11px;
      color: #777;
      margin-top: 3px;
    }

    .tl-root {
      font-family: "Courier New", monospace;
      font-size: 10px;
      color: #aaa;
      margin-top: 2px;
    }

    /* ── Restore model ── */
    .restore-model {
      display: flex;
      flex-direction: column;
      gap: 3px;
      background: #f6f6f4;
      border: 1px solid #e4e4e0;
      border-radius: 10px;
      padding: 10px 14px;
      margin-bottom: 12px;
    }

    .restore-model-label {
      font-size: 10px;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--muted);
    }

    .restore-model-path {
      font-size: 13px;
      color: #111;
      line-height: 1.5;
      word-break: break-word;
    }

    /* ── Changed-files list ── */
    .changed-files {
      margin: 12px 0;
      border: 1px solid #e8e8e8;
      border-radius: 10px;
      overflow: hidden;
    }

    .changed-files-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 7px 12px;
      background: #f6f6f6;
      border-bottom: 1px solid #ececec;
      font-size: 12px;
      font-weight: 600;
      color: #333;
      letter-spacing: 0.3px;
    }

    .changed-files-count {
      font-size: 11px;
      color: var(--muted);
      font-weight: 400;
    }

    .cf-row {
      display: flex;
      align-items: baseline;
      gap: 10px;
      padding: 6px 12px;
      border-bottom: 1px solid #f2f2f2;
      font-family: "Courier New", monospace;
      font-size: 12px;
    }

    .cf-row:last-child { border-bottom: none; }

    .cf-op {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1px;
      border-radius: 4px;
      padding: 2px 6px;
      flex-shrink: 0;
    }

    .cf-mod { background: #111; color: #fff; }
    .cf-add { background: #d4f5d4; color: #1a4a1a; border: 1px solid #aaddaa; }
    .cf-del { background: #fde8e8; color: #6b1a1a; border: 1px solid #f0aaaa; }

    .cf-path {
      color: #333;
      word-break: break-all;
      line-height: 1.4;
    }

    /* ── Legacy op-pills (keep for any remaining usage) ── */
    .op-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 10px 0 12px;
    }

    .op-pill {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 4px 11px;
      font-family: "Courier New", monospace;
      font-size: 12px;
      border: 1px solid #ccc;
      background: #f5f5f5;
      color: #222;
      white-space: nowrap;
    }

    .op-pill.op-modify { background: #111; color: #fff; border-color: #111; }
    .op-pill.op-add    { background: #f0fff0; border-color: #aaddaa; color: #1a4a1a; }
    .op-pill.op-delete { background: #fff0f0; border-color: #ddaaaa; color: #4a1a1a; }

    /* ── Actions ── */
    .actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 16px; }

    .actions a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      text-decoration: none;
      color: var(--text);
      border: 1px solid #1b1b1b;
      border-radius: 999px;
      padding: 10px 18px;
      font-size: 14px;
      min-width: 120px;
      transition: background 0.18s ease, color 0.18s ease, transform 0.18s ease;
    }

    .actions a:hover { background: #111; color: #fff; transform: translateY(-1px); }

    .footer-note {
      margin-top: 28px;
      text-align: center;
      color: var(--muted);
      font-size: 13px;
      letter-spacing: 1.5px;
    }

    @media (max-width: 720px) {
      .shell { padding: 18px 14px 40px; }
      h1 { font-size: 26px; letter-spacing: 4px; }
      .preview { min-height: 360px; }
      .preview img { max-height: 340px; }
      .title { font-size: 22px; letter-spacing: 4px; }
      .meta-row { grid-template-columns: 1fr; gap: 3px; }
      .delta-metrics { grid-template-columns: repeat(2, 1fr); }
      .changed-files-header { flex-direction: column; align-items: flex-start; gap: 2px; }
      .restore-model-path { font-size: 12px; }
      .tl-id { font-size: 11px; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <section class="hero">
      <div class="eyebrow">Verifiable State Code</div>
      <h1>VSC TOKEN GALLERY</h1>
      <p class="hero-subtitle">
        Machine-readable sparse-delta tokens. Full folder backups, incremental delta
        backups, binary file recovery and text proofs — all verifiable by root hash.
      </p>

      <div class="stats">
        <div class="stat">Tokens: ${tokenCount}</div>
        <div class="stat">Chains: ${chainCount}</div>
        <div class="stat">Delta backups: ${deltaCount}</div>
        <div class="stat">Folder snapshots: ${recoveryCount}</div>
        <div class="stat">Proof model: Sparse Delta</div>
      </div>
    </section>

    <section class="grid">
      ${cards}
    </section>

    <div class="footer-note">
      VSC Gallery &nbsp;•&nbsp; Deterministic &nbsp;•&nbsp; Machine Readable &nbsp;•&nbsp; Root Hash Verified
    </div>
  </div>
</body>
</html>`;
}

export function saveGalleryPage(manifest, outputFilePath = path.join("output", "gallery.html")) {
  const html = renderGalleryPage(manifest);
  fs.writeFileSync(outputFilePath, html, "utf8");
  return outputFilePath;
}

export default renderGalleryPage;