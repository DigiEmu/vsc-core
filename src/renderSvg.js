import fs from "fs";

function escapeXml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function shortHash(hash = "", length = 12) {
  return String(hash || "").slice(0, length).toUpperCase();
}

function normalizeType(type = "") {
  return String(type || "TOKEN").toUpperCase();
}

function entryToNumber(entry, index = 0) {
  if (typeof entry === "number" && Number.isFinite(entry)) {
    return Math.abs(entry);
  }

  if (typeof entry === "string") {
    return Array.from(entry).reduce((acc, ch, i) => acc + ch.charCodeAt(0) * (i + 1), 0);
  }

  if (entry && typeof entry === "object") {
    let total = 0;

    for (const [key, value] of Object.entries(entry)) {
      total += Array.from(String(key)).reduce((a, ch) => a + ch.charCodeAt(0), 0);

      if (typeof value === "number" && Number.isFinite(value)) {
        total += Math.abs(value);
      } else if (typeof value === "string") {
        total += Array.from(value).reduce((a, ch, i) => a + ch.charCodeAt(0) * (i + 1), 0);
      } else if (typeof value === "boolean") {
        total += value ? 17 : 3;
      } else if (value && typeof value === "object") {
        total += Array.from(JSON.stringify(value)).reduce(
          (a, ch, i) => a + ch.charCodeAt(0) * ((i % 11) + 1),
          0
        );
      }
    }

    return total + index * 13;
  }

  return index * 29 + 7;
}

function polarToCartesian(cx, cy, r, angle) {
  return {
    x: cx + Math.cos(angle) * r,
    y: cy + Math.sin(angle) * r
  };
}

function buildDeltaPoints(delta = [], cx, cy, coreRadius, ringCount, ringStep) {
  const points = [];
  const normalized = Array.isArray(delta) ? delta : [];

  if (normalized.length === 0) {
    return points;
  }

  for (let i = 0; i < normalized.length; i++) {
    const value = entryToNumber(normalized[i], i);
    const ringIndex = i % ringCount;
    const radius = coreRadius + ringStep * (ringIndex + 1);

    const angleSeed = (value + i * 37) % 360;
    const angle = -Math.PI / 2 + (angleSeed / 180) * Math.PI;

    const { x, y } = polarToCartesian(cx, cy, radius, angle);

    points.push({
      x,
      y,
      r: 3.2 + (value % 3),
      ringIndex,
      angle,
      value
    });
  }

  return points;
}

function buildHashBand(hash = "", cx, cy, bandRadius) {
  const text = String(hash || "");
  const items = [];

  if (!text) return items;

  const chars = text.slice(0, 64).split("");

  chars.forEach((ch, i) => {
    const code =
      ch >= "0" && ch <= "9"
        ? ch.charCodeAt(0) - 48
        : 10 + ch.toLowerCase().charCodeAt(0) - 97;

    const angle = -Math.PI / 2 + (2 * Math.PI * i) / chars.length;
    const radius = bandRadius + (code % 3) * 6;

    const { x, y } = polarToCartesian(cx, cy, radius, angle);
    items.push({
      x,
      y,
      filled: code % 2 === 0,
      size: 1.9 + (code % 2)
    });
  });

  return items;
}

function buildPrincipleMarkers(cx, cy, outerRadius) {
  const labels = ["1", "2", "3", "4", "5", "6"];
  const markers = [];

  for (let i = 0; i < 6; i++) {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / 6;
    const { x, y } = polarToCartesian(cx, cy, outerRadius + 2, angle);
    markers.push({ label: labels[i], x, y });
  }

  return markers;
}

// ─── FOLDER_DELTA helpers ────────────────────────────────────────────────────

function shortFileName(relPath = "") {
  const parts = String(relPath).replaceAll("\\", "/").split("/");
  return parts[parts.length - 1] || relPath;
}

function getDeltaOperations(token) {
  const ops = token.operations;
  if (!ops) return [];
  if (Array.isArray(ops)) return ops;
  // grouped style: { added: [], modified: [], deleted: [] }
  const result = [];
  if (Array.isArray(ops.added)) {
    for (const o of ops.added) result.push({ op: "ADD", ...o });
  }
  if (Array.isArray(ops.modified)) {
    for (const o of ops.modified) result.push({ op: "MODIFY", ...o });
  }
  if (Array.isArray(ops.deleted)) {
    for (const o of ops.deleted) result.push({ op: "DELETE", ...o });
  }
  return result;
}

function opLabel(op) {
  const prefix = op.op === "ADD" ? "ADD" : op.op === "DELETE" ? "DEL" : "MOD";
  return `${prefix} ${shortFileName(op.relativePath || "")}`;
}

function renderFolderDeltaSvg(token = {}) {
  const WIDTH = 1100;
  const HEIGHT = 1280;
  const CX = WIDTH / 2;
  const CY = 555;

  const OUTER_R     = 360;
  const HASH_BAND_R = 388;
  const CORE_R      = 78;
  // Fewer, quieter rings — only 4 structural rings between core and outer
  const STRUCT_RINGS = [CORE_R + 56, CORE_R + 112, CORE_R + 168, CORE_R + 224];
  // Delta ring sits at ~70% between core and outer — clearly dominant mid-ring
  const DELTA_RING_R = CORE_R + 188;

  const version    = escapeXml(token.version || "1.4");
  const tokenId    = escapeXml(token.id || "UNKNOWN");
  const baseId     = String(token.baseTokenId || token.baseline || "BASE").toUpperCase();
  const targetId   = String(token.id || "TARGET").toUpperCase();
  const summary    = token.summary || {};
  const operations = getDeltaOperations(token);

  const addedCount    = summary.addedCount    ?? operations.filter(o => o.op === "ADD").length;
  const modifiedCount = summary.modifiedCount ?? operations.filter(o => o.op === "MODIFY").length;
  const deletedCount  = summary.deletedCount  ?? operations.filter(o => o.op === "DELETE").length;
  const deltaSizeBytes  = summary.deltaSizeBytes  ?? 0;
  const deltaChunkCount = summary.deltaChunkCount ?? 0;

  const targetRootHash  = String(token.proof?.targetFolderRootHash || token.proof?.payloadHash || "");
  const targetRootShort = shortHash(targetRootHash, 16);

  const hashDots        = buildHashBand(targetRootHash, CX, CY, HASH_BAND_R);
  const principleLabelY = CY - OUTER_R - 24;

  // Six orientation markers — but quieter: no number label, just small open circles
  const orientMarkers = buildPrincipleMarkers(CX, CY, OUTER_R);

  // ── BASE arc: left semicircle of OUTER_R (180°→360°, i.e. top-left to bottom-left)
  // ── TARGET arc: right semicircle (0°→180°, top-right to bottom-right)
  // SVG arc for left half: start at top (CX, CY-OUTER_R) → bottom (CX, CY+OUTER_R), sweep left
  const baseArcD =
    `M ${CX} ${CY - OUTER_R} A ${OUTER_R} ${OUTER_R} 0 0 0 ${CX} ${CY + OUTER_R}`;
  const targetArcD =
    `M ${CX} ${CY - OUTER_R} A ${OUTER_R} ${OUTER_R} 0 0 1 ${CX} ${CY + OUTER_R}`;

  // Label positions on the arc midpoints
  const baseLabelPt   = polarToCartesian(CX, CY, OUTER_R + 32, Math.PI);       // left midpoint
  const targetLabelPt = polarToCartesian(CX, CY, OUTER_R + 32, 0);             // right midpoint

  // ── Operation nodes on DELTA_RING_R ──
  const opCount  = operations.length;
  const SHOW_LABELS = 10;
  // Spread ops over right 220° arc (target side), starting top-right, going clockwise
  const ARC_START = -Math.PI / 2 + (30 / 180) * Math.PI;
  const ARC_TOTAL = (220 / 180) * Math.PI;

  const opNodes = operations.map((op, i) => {
    const angle = opCount <= 1
      ? 0    // single op at right
      : ARC_START + (i / (opCount - 1)) * ARC_TOTAL;
    const { x, y } = polarToCartesian(CX, CY, DELTA_RING_R, angle);
    return { op, angle, x, y, showLabel: i < SHOW_LABELS };
  });

  // ── Layout ──
  const titleY     = 86;
  const subtitleY  = 118;
  const footerY    = 1144;
  const tokenIdY   = 1178;
  const lowerMetaY = 1210;

  const title    = `VSC DELTA TOKEN`;
  const subtitle = `BASE ${escapeXml(baseId.slice(0, 12))} → TARGET ${escapeXml(targetId.slice(0, 12))} · CHANGED FILES ONLY · SHA-256`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${WIDTH}"
  height="${HEIGHT}"
  viewBox="0 0 ${WIDTH} ${HEIGHT}"
>
  <defs>
    <style>
      .bg            { fill: #f8f8f6; }
      .line-strong   { stroke: #111; stroke-width: 2.4; fill: none; }
      .line-mid      { stroke: #888; stroke-width: 1.2; fill: none; }
      .line-soft     { stroke: #d8d8d8; stroke-width: 0.8; fill: none; }
      .text-title    { font-family: Arial, Helvetica, sans-serif; font-size: 28px; letter-spacing: 8px; fill: #111; }
      .text-subtitle { font-family: Arial, Helvetica, sans-serif; font-size: 12px; letter-spacing: 3.5px; fill: #444; }
      .text-small    { font-family: Arial, Helvetica, sans-serif; font-size: 13px; fill: #333; }
      .text-medium   { font-family: Arial, Helvetica, sans-serif; font-size: 16px; fill: #222; }
      .text-meta     { font-family: Arial, Helvetica, sans-serif; font-size: 12px; letter-spacing: 2px; fill: #444; }
      .text-id       { font-family: 'Courier New', monospace; font-size: 14px; letter-spacing: 2px; fill: #111; }
      .text-arc-label { font-family: Arial, Helvetica, sans-serif; font-size: 15px; letter-spacing: 3px; fill: #111; font-weight: 600; }
      .text-arc-id   { font-family: 'Courier New', monospace; font-size: 11px; fill: #555; }
      .text-core-big { font-family: Arial, Helvetica, sans-serif; font-size: 52px; font-weight: 700; fill: #111; }
      .text-core-sub { font-family: Arial, Helvetica, sans-serif; font-size: 11px; letter-spacing: 2px; fill: #555; }
      .text-op-label { font-family: 'Courier New', monospace; font-size: 11.5px; fill: #111; }
      .label-box     { fill: #f9f9f9; stroke: #c8c8c8; stroke-width: 1.1; }
      .orient-dot    { fill: #fff; stroke: #bbb; stroke-width: 1.2; }
      .hash-fill     { fill: #333; }
      .hash-open     { fill: none; stroke: #999; stroke-width: 0.9; }
      .arc-base      { stroke: #999; stroke-width: 2.2; fill: none; stroke-dasharray: 8 5; }
      .arc-target    { stroke: #111; stroke-width: 2.8; fill: none; }
      .delta-ring    { stroke: #444; stroke-width: 2; fill: none; stroke-dasharray: 7 4; }
      .op-spoke      { stroke: #bbb; stroke-width: 1; fill: none; }
      .op-modify     { fill: #111; stroke: none; }
      .op-add        { fill: #fff; stroke: #111; stroke-width: 2.2; }
      .op-delete     { fill: #f0f0f0; stroke: #111; stroke-width: 2; }
      .crosshair     { stroke: #e4e4e4; stroke-width: 0.8; stroke-dasharray: 2 8; }
    </style>
    <marker id="darr" markerWidth="7" markerHeight="5" refX="6" refY="2.5" orient="auto">
      <polygon points="0 0, 7 2.5, 0 5" fill="#444" />
    </marker>
  </defs>

  <rect class="bg" x="0" y="0" width="${WIDTH}" height="${HEIGHT}" />

  <!-- Title / subtitle -->
  <text x="${CX}" y="${titleY}" text-anchor="middle" class="text-title">${escapeXml(title)}</text>
  <text x="${CX}" y="${subtitleY}" text-anchor="middle" class="text-subtitle">${escapeXml(subtitle)}</text>
  <line x1="${CX - 160}" y1="${subtitleY + 14}" x2="${CX + 160}" y2="${subtitleY + 14}" class="line-soft" />

  <!-- Quiet crosshairs — two axes only -->
  <line x1="${CX}" y1="${CY - OUTER_R - 10}" x2="${CX}" y2="${CY + OUTER_R + 10}" class="crosshair" />
  <line x1="${CX - OUTER_R - 10}" y1="${CY}" x2="${CX + OUTER_R + 10}" y2="${CY}" class="crosshair" />

  <!-- Structural rings — 4 quiet rings -->
  ${STRUCT_RINGS.map(r => `<circle cx="${CX}" cy="${CY}" r="${r}" class="line-soft" />`).join("\n  ")}

  <!-- Outer ring: BASE (dashed/grey left) and TARGET (solid/black right) arcs -->
  <path d="${baseArcD}"   class="arc-base"   />
  <path d="${targetArcD}" class="arc-target" />

  <!-- BASE / TARGET arc labels -->
  <text x="${baseLabelPt.x.toFixed(1)}"   y="${(baseLabelPt.y - 14).toFixed(1)}"  text-anchor="middle" class="text-arc-label">BASE</text>
  <text x="${baseLabelPt.x.toFixed(1)}"   y="${(baseLabelPt.y + 4).toFixed(1)}"   text-anchor="middle" class="text-arc-id">${escapeXml(baseId.slice(0, 12))}</text>
  <text x="${targetLabelPt.x.toFixed(1)}" y="${(targetLabelPt.y - 14).toFixed(1)}" text-anchor="middle" class="text-arc-label">TARGET</text>
  <text x="${targetLabelPt.x.toFixed(1)}" y="${(targetLabelPt.y + 4).toFixed(1)}"  text-anchor="middle" class="text-arc-id">${escapeXml(targetId.slice(0, 12))}</text>

  <!-- Six quiet orientation markers (no number) -->
  ${orientMarkers.map(m => `<circle cx="${m.x.toFixed(1)}" cy="${m.y.toFixed(1)}" r="8" class="orient-dot" />`).join("\n  ")}

  <!-- Target root hash band — quieter dots -->
  ${hashDots.map(d =>
    d.filled
      ? `<circle cx="${d.x}" cy="${d.y}" r="${d.size * 0.8}" class="hash-fill" />`
      : `<circle cx="${d.x}" cy="${d.y}" r="${d.size * 0.7}" class="hash-open" />`
  ).join("\n  ")}

  <!-- Delta ring — prominent dashed ring on target side -->
  <circle cx="${CX}" cy="${CY}" r="${DELTA_RING_R}" class="delta-ring" />

  <!-- Core: Δ symbol (changed-files nucleus) -->
  <circle cx="${CX}" cy="${CY}" r="${CORE_R}" class="line-strong" />
  <circle cx="${CX}" cy="${CY}" r="${CORE_R - 16}" class="line-mid" />
  <text x="${CX}" y="${CY + 18}" text-anchor="middle" class="text-core-big">Δ</text>
  <text x="${CX}" y="${CY + 42}" text-anchor="middle" class="text-core-sub">CHANGED FILES</text>

  <!-- Operation nodes on delta ring: spokes + nodes -->
  ${opNodes.length === 0
    ? `<text x="${CX}" y="${CY - DELTA_RING_R - 14}" text-anchor="middle" class="text-meta">NO CHANGES</text>`
    : opNodes.map(n => {
        const spokePt  = polarToCartesian(CX, CY, CORE_R + 10, n.angle);
        const outerPt  = polarToCartesian(CX, CY, DELTA_RING_R + 32, n.angle);
        const isRight  = n.x >= CX;
        const nr = opCount === 1 ? 11 : (opCount <= 3 ? 9 : 7);
        const arm = nr - 2;

        let nodeShape = "";
        if (n.op.op === "MODIFY") {
          nodeShape = `<circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${nr}" class="op-modify" />`;
        } else if (n.op.op === "ADD") {
          nodeShape = `<circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${nr}" class="op-add" />
            <line x1="${(n.x-arm).toFixed(1)}" y1="${n.y.toFixed(1)}" x2="${(n.x+arm).toFixed(1)}" y2="${n.y.toFixed(1)}" stroke="#111" stroke-width="2" />
            <line x1="${n.x.toFixed(1)}" y1="${(n.y-arm).toFixed(1)}" x2="${n.x.toFixed(1)}" y2="${(n.y+arm).toFixed(1)}" stroke="#111" stroke-width="2" />`;
        } else {
          nodeShape = `<circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${nr}" class="op-delete" />
            <line x1="${(n.x-arm).toFixed(1)}" y1="${(n.y-arm).toFixed(1)}" x2="${(n.x+arm).toFixed(1)}" y2="${(n.y+arm).toFixed(1)}" stroke="#111" stroke-width="1.8" />
            <line x1="${(n.x+arm).toFixed(1)}" y1="${(n.y-arm).toFixed(1)}" x2="${(n.x-arm).toFixed(1)}" y2="${(n.y+arm).toFixed(1)}" stroke="#111" stroke-width="1.8" />`;
        }

        const labelHtml = n.showLabel
          ? `<text x="${outerPt.x.toFixed(1)}" y="${(outerPt.y + 4).toFixed(1)}" text-anchor="${isRight ? "start" : "end"}" class="text-op-label">${escapeXml(opLabel(n.op))}</text>`
          : "";

        return `<line x1="${spokePt.x.toFixed(1)}" y1="${spokePt.y.toFixed(1)}" x2="${n.x.toFixed(1)}" y2="${n.y.toFixed(1)}" class="op-spoke" />
    ${nodeShape}
    ${labelHtml}`;
      }).join("\n  ")
  }

  <!-- Delta direction arrow — from BASE arc point to TARGET arc point (top of ring) -->
  <line x1="${(CX - 30).toFixed(1)}" y1="${(CY - OUTER_R + 30).toFixed(1)}"
        x2="${(CX + 30).toFixed(1)}" y2="${(CY - OUTER_R + 30).toFixed(1)}"
        stroke="#444" stroke-width="2" marker-end="url(#darr)" />

  <!-- Footer meta boxes -->
  <g transform="translate(76, 1076)">
    <rect x="0" y="0" width="240" height="80" rx="10" class="label-box" />
    <text x="14" y="24" class="text-small">● MOD · ○+ ADD · ○× DEL</text>
    <text x="14" y="46" class="text-small">--- BASE arc  ─── TARGET arc</text>
    <text x="14" y="66" class="text-small">Δ core = changed files nucleus</text>
  </g>

  <g transform="translate(784, 1076)">
    <rect x="0" y="0" width="240" height="80" rx="10" class="label-box" />
    <text x="14" y="24" class="text-small">+${addedCount} added  ~${modifiedCount} modified  -${deletedCount} deleted</text>
    <text x="14" y="46" class="text-small">Delta: ${escapeXml(String(deltaSizeBytes))} B · ${deltaChunkCount} chunks</text>
    <text x="14" y="66" class="text-small">Verify: ${escapeXml(targetRootShort)}</text>
  </g>

  <!-- Footer -->
  <text x="${CX}" y="${footerY}"    text-anchor="middle" class="text-medium">VSC-${escapeXml(version)} / FOLDER DELTA</text>
  <text x="${CX}" y="${tokenIdY}"   text-anchor="middle" class="text-id">TOKEN ID: ${escapeXml(tokenId)}</text>
  <text x="${CX}" y="${lowerMetaY}" text-anchor="middle" class="text-meta">STORED: CHANGED FILES ONLY · VERIFY: TARGET ROOT HASH ${escapeXml(targetRootShort)}</text>
</svg>`;
}

// ─── DELTA_CHAIN renderer ─────────────────────────────────────────────────────

function renderDeltaChainSvg(token = {}) {
  const WIDTH = 1100;
  const HEIGHT = 1280;
  const CX = WIDTH / 2;
  const CY = 555;

  const OUTER_R     = 360;
  const HASH_BAND_R = 388;
  const CORE_R      = 68;
  // 3 quiet structural rings
  const STRUCT_RINGS = [CORE_R + 70, CORE_R + 150, CORE_R + 240];

  const version         = escapeXml(token.version || "1.5");
  const tokenId         = escapeXml(token.id || "UNKNOWN");
  const summary         = token.summary || {};
  const steps           = Array.isArray(token.steps) ? token.steps : [];
  const proof           = token.proof || {};

  const stepCount       = summary.stepCount ?? steps.length;
  const totalDeltaBytes = summary.totalDeltaSizeBytes ?? 0;
  const estFullBytes    = summary.estimatedFullCopyBytes ?? 0;
  const reductionPct    = summary.estimatedReductionPercent ?? 0;
  const chainHashShort  = shortHash(proof.chainHash || "", 16);
  const latestRootShort = shortHash(proof.latestFolderRootHash || token.latestFolderRootHash || "", 16);
  const baseTokenId     = String(token.baseTokenId || "").toUpperCase();
  const latestTokenId   = String(token.latestTokenId || "").toUpperCase();

  function fmtB(n) {
    const v = Number(n) || 0;
    if (v < 1024) return `${v} B`;
    if (v < 1048576) return `${(v / 1024).toFixed(1)} KB`;
    return `${(v / 1048576).toFixed(2)} MB`;
  }

  const hashDots    = buildHashBand(proof.latestFolderRootHash || "", CX, CY, HASH_BAND_R);
  const orientMarkers = buildPrincipleMarkers(CX, CY, OUTER_R);

  // ── Timeline: left-rail spine at x = CX - 180 ──
  // Spine runs from top to bottom of the inner field
  const RAIL_X    = CX - 160;
  const RAIL_TOP  = CY - 248;
  const RAIL_BOT  = CY + 248;
  const ANNO_X    = RAIL_X + 52;   // right of the rail, where annotations go

  // Build node list: base + one per step
  const allNodes = [];
  allNodes.push({
    label: "BASE", sublabel: baseTokenId.slice(0, 12),
    isBase: true, isLatest: false, stepData: null
  });
  for (let i = 0; i < steps.length; i++) {
    const st = steps[i];
    const isLast = i === steps.length - 1;
    allNodes.push({
      label: `Δ${st.index}`, sublabel: String(st.toTokenId || "").toUpperCase().slice(0, 12),
      isBase: false, isLatest: isLast, stepData: st
    });
  }
  const nodeCount = allNodes.length;

  // Y positions along the rail
  const nodeY = allNodes.map((_, i) =>
    nodeCount === 1 ? CY : RAIL_TOP + (i / (nodeCount - 1)) * (RAIL_BOT - RAIL_TOP)
  );

  // Node radii by role
  const nodeR = allNodes.map(n => n.isLatest ? 26 : n.isBase ? 18 : 14);

  // ── Footer layout ──
  const titleY     = 86;
  const subtitleY  = 118;
  const footerY    = 1148;
  const tokenIdY   = 1182;
  const metaY      = 1216;

  const title    = `VSC CHAIN TOKEN`;
  const subtitle = `BASE ${escapeXml(baseTokenId.slice(0, 12))} → LATEST ${escapeXml(latestTokenId.slice(0, 12))} · ORDERED DELTAS · SHA-256`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${WIDTH}"
  height="${HEIGHT}"
  viewBox="0 0 ${WIDTH} ${HEIGHT}"
>
  <defs>
    <style>
      .bg            { fill: #f8f8f6; }
      .line-strong   { stroke: #111; stroke-width: 2.4; fill: none; }
      .line-mid      { stroke: #888; stroke-width: 1.2; fill: none; }
      .line-soft     { stroke: #d8d8d8; stroke-width: 0.8; fill: none; }
      .text-title    { font-family: Arial, Helvetica, sans-serif; font-size: 26px; letter-spacing: 7px; fill: #111; }
      .text-subtitle { font-family: Arial, Helvetica, sans-serif; font-size: 11px; letter-spacing: 3.5px; fill: #444; }
      .text-small    { font-family: Arial, Helvetica, sans-serif; font-size: 13px; fill: #333; }
      .text-medium   { font-family: Arial, Helvetica, sans-serif; font-size: 16px; fill: #222; }
      .text-meta     { font-family: Arial, Helvetica, sans-serif; font-size: 12px; letter-spacing: 2px; fill: #444; }
      .text-id       { font-family: 'Courier New', monospace; font-size: 14px; letter-spacing: 2px; fill: #111; }
      .text-node-label { font-family: Arial, Helvetica, sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 1px; fill: #fff; }
      .text-node-label-base { font-family: Arial, Helvetica, sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 1px; fill: #111; }
      .text-node-id  { font-family: 'Courier New', monospace; font-size: 10px; fill: #555; }
      .text-anno-head { font-family: Arial, Helvetica, sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 1px; fill: #111; }
      .text-anno-body { font-family: 'Courier New', monospace; font-size: 11px; fill: #555; }
      .text-latest-label { font-family: Arial, Helvetica, sans-serif; font-size: 11px; letter-spacing: 2px; fill: #fff; }
      .text-core-big { font-family: Arial, Helvetica, sans-serif; font-size: 40px; font-weight: 700; fill: #111; }
      .text-core-sub { font-family: Arial, Helvetica, sans-serif; font-size: 10px; letter-spacing: 2px; fill: #555; }
      .label-box     { fill: #f9f9f9; stroke: #c8c8c8; stroke-width: 1.1; }
      .orient-dot    { fill: #fff; stroke: #ccc; stroke-width: 1; }
      .hash-fill     { fill: #333; }
      .hash-open     { fill: none; stroke: #aaa; stroke-width: 0.8; }
      .crosshair     { stroke: #e8e8e8; stroke-width: 0.8; stroke-dasharray: 2 8; }
      .rail-spine    { stroke: #bbb; stroke-width: 2.2; fill: none; }
      .rail-conn     { stroke: #999; stroke-width: 1.6; fill: none; }
      .node-base     { fill: #fff; stroke: #111; stroke-width: 2.4; }
      .node-delta    { fill: #666; stroke: #444; stroke-width: 1.8; }
      .node-latest   { fill: #111; stroke: #111; stroke-width: 2.4; }
      .latest-band   { fill: #111; }
      .anno-line     { stroke: #ddd; stroke-width: 1; fill: none; }
      .arrow-head    { fill: #555; }
    </style>
    <marker id="ca" markerWidth="7" markerHeight="5" refX="6" refY="2.5" orient="auto">
      <polygon points="0 0, 7 2.5, 0 5" class="arrow-head" />
    </marker>
  </defs>

  <rect class="bg" x="0" y="0" width="${WIDTH}" height="${HEIGHT}" />

  <!-- Title / subtitle -->
  <text x="${CX}" y="${titleY}" text-anchor="middle" class="text-title">${escapeXml(title)}</text>
  <text x="${CX}" y="${subtitleY}" text-anchor="middle" class="text-subtitle">${escapeXml(subtitle)}</text>
  <line x1="${CX - 160}" y1="${subtitleY + 14}" x2="${CX + 160}" y2="${subtitleY + 14}" class="line-soft" />

  <!-- Quiet crosshairs -->
  <line x1="${CX}" y1="${CY - OUTER_R}" x2="${CX}" y2="${CY + OUTER_R}" class="crosshair" />
  <line x1="${CX - OUTER_R}" y1="${CY}" x2="${CX + OUTER_R}" y2="${CY}" class="crosshair" />

  <!-- Structural rings -->
  ${STRUCT_RINGS.map(r => `<circle cx="${CX}" cy="${CY}" r="${r}" class="line-soft" />`).join("\n  ")}

  <!-- Outer ring -->
  <circle cx="${CX}" cy="${CY}" r="${OUTER_R}" class="line-strong" />
  <circle cx="${CX}" cy="${CY}" r="${OUTER_R - 16}" class="line-mid" />

  <!-- Six quiet orientation dots -->
  ${orientMarkers.map(m => `<circle cx="${m.x.toFixed(1)}" cy="${m.y.toFixed(1)}" r="7" class="orient-dot" />`).join("\n  ")}

  <!-- Latest root hash band — quieter -->
  ${hashDots.map(d =>
    d.filled
      ? `<circle cx="${d.x}" cy="${d.y}" r="${(d.size * 0.75).toFixed(1)}" class="hash-fill" />`
      : `<circle cx="${d.x}" cy="${d.y}" r="${(d.size * 0.65).toFixed(1)}" class="hash-open" />`
  ).join("\n  ")}

  <!-- Chain core: small neutral center -->
  <circle cx="${CX}" cy="${CY}" r="${CORE_R}" class="line-strong" />
  <circle cx="${CX}" cy="${CY}" r="${CORE_R - 14}" class="line-mid" />
  <text x="${CX}" y="${CY + 14}" text-anchor="middle" class="text-core-big">${stepCount}</text>
  <text x="${CX}" y="${CY + 36}" text-anchor="middle" class="text-core-sub">DELTA STEPS</text>

  <!-- Rail spine: vertical line from RAIL_TOP to RAIL_BOT -->
  <line x1="${RAIL_X}" y1="${RAIL_TOP}" x2="${RAIL_X}" y2="${RAIL_BOT}" class="rail-spine" />

  <!-- Start cap -->
  <circle cx="${RAIL_X}" cy="${RAIL_TOP}" r="4" fill="#bbb" />
  <line x1="${RAIL_X}" y1="${RAIL_TOP - 4}" x2="${RAIL_X}" y2="${RAIL_TOP - 24}" class="rail-conn" marker-end="url(#ca)" />
  <text x="${RAIL_X}" y="${RAIL_TOP - 28}" text-anchor="middle" class="text-meta">START</text>

  <!-- Chain nodes along the rail -->
  ${allNodes.map((n, i) => {
    const y  = nodeY[i];
    const r  = nodeR[i];
    const cls   = n.isBase ? "node-base" : n.isLatest ? "node-latest" : "node-delta";
    const txtCls = n.isBase ? "text-node-label-base" : "text-node-label";

    // Connector to next node (rail segment is always drawn, but nodes sit on it)
    const connLine = (i < allNodes.length - 1)
      ? `<line x1="${RAIL_X}" y1="${(y + r + 2).toFixed(1)}" x2="${RAIL_X}" y2="${(nodeY[i+1] - nodeR[i+1] - 2).toFixed(1)}" class="rail-conn" marker-end="url(#ca)" />`
      : "";

    // Right-side annotation line
    const annoLineX2 = ANNO_X + 280;
    const annoLine = `<line x1="${(RAIL_X + r + 2).toFixed(1)}" y1="${y.toFixed(1)}" x2="${(ANNO_X - 4).toFixed(1)}" y2="${y.toFixed(1)}" class="anno-line" />`;

    // Annotation content
    let annoHtml = "";
    if (n.isBase) {
      annoHtml = `<text x="${ANNO_X}" y="${(y - 8).toFixed(1)}" class="text-anno-head">BASE SNAPSHOT</text>
      <text x="${ANNO_X}" y="${(y + 8).toFixed(1)}" class="text-anno-body">${escapeXml(n.sublabel)}</text>`;
    } else if (n.isLatest) {
      // Prominent "LATEST STATE" filled band
      annoHtml = `<rect x="${ANNO_X}" y="${(y - 18).toFixed(1)}" width="280" height="36" rx="6" class="latest-band" />
      <text x="${(ANNO_X + 12).toFixed(1)}" y="${(y - 4).toFixed(1)}" class="text-latest-label">LATEST VERIFIED STATE</text>
      <text x="${(ANNO_X + 12).toFixed(1)}" y="${(y + 12).toFixed(1)}" class="text-latest-label">${escapeXml(n.sublabel)}</text>`;
    } else {
      const st = n.stepData || {};
      annoHtml = `<text x="${ANNO_X}" y="${(y - 9).toFixed(1)}" class="text-anno-head">STEP ${st.index ?? ""}</text>
      <text x="${ANNO_X}" y="${(y + 6).toFixed(1)}" class="text-anno-body">+${st.addedCount ?? 0} ~${st.modifiedCount ?? 0} -${st.deletedCount ?? 0}  ${escapeXml(fmtB(st.deltaSizeBytes ?? 0))}</text>
      <text x="${ANNO_X}" y="${(y + 19).toFixed(1)}" class="text-anno-body">${escapeXml(n.sublabel)}</text>`;
    }

    return `
  ${connLine}
  <circle cx="${RAIL_X}" cy="${y.toFixed(1)}" r="${r}" class="${cls}" />
  <text x="${RAIL_X}" y="${(y + 4).toFixed(1)}" text-anchor="middle" class="${txtCls}">${escapeXml(n.label)}</text>
  ${annoLine}
  ${annoHtml}`;
  }).join("")}

  <!-- Footer meta boxes -->
  <g transform="translate(76, 1076)">
    <rect x="0" y="0" width="230" height="66" rx="10" class="label-box" />
    <text x="14" y="24" class="text-small">○ = BASE snapshot</text>
    <text x="14" y="44" class="text-small">■ = LATEST verified state</text>
  </g>

  <g transform="translate(794, 1062)">
    <rect x="0" y="0" width="230" height="96" rx="10" class="label-box" />
    <text x="14" y="24" class="text-small">Steps:       ${stepCount}</text>
    <text x="14" y="44" class="text-small">Delta total: ${escapeXml(fmtB(totalDeltaBytes))}</text>
    <text x="14" y="64" class="text-small">Chain hash:  ${escapeXml(chainHashShort.slice(0, 12))}</text>
    <text x="14" y="84" class="text-small">Latest root: ${escapeXml(latestRootShort.slice(0, 12))}</text>
  </g>

  <!-- Footer -->
  <text x="${CX}" y="${footerY}"  text-anchor="middle" class="text-medium">VSC-${escapeXml(version)} / DELTA CHAIN</text>
  <text x="${CX}" y="${tokenIdY}" text-anchor="middle" class="text-id">CHAIN ID: ${escapeXml(tokenId)}</text>
  <text x="${CX}" y="${metaY}"    text-anchor="middle" class="text-meta">VERIFY: LATEST ROOT HASH ${escapeXml(latestRootShort)}</text>
</svg>`;
}

// ─── Main renderer ───────────────────────────────────────────────────────────

export function renderSvg(token = {}) {
  if (token.mode === "DELTA_CHAIN" || token.type === "VSC_CHAIN") {
    return renderDeltaChainSvg(token);
  }
  if (token.mode === "FOLDER_DELTA") {
    return renderFolderDeltaSvg(token);
  }
  const protocol = escapeXml(token.protocol || "VSC");
  const version = escapeXml(token.version || "0.0");
  const type = normalizeType(token.type || "TOKEN");
  const tokenId = escapeXml(token.id || "UNKNOWN");
  const encoding = escapeXml(token.encoding || "ASCII");
  const baseline = escapeXml(
    token.baseline !== undefined && token.baseline !== null ? token.baseline : "0"
  );
  const messageLength = Number(token.messageLength || 0);
  const delta = Array.isArray(token.delta) ? token.delta : [];
  const deltaCount = delta.length;
  const payloadHash = String(token?.proof?.payloadHash || token?.hash || "");

  const WIDTH = 1100;
  const HEIGHT = 1280;

  const CX = WIDTH / 2;
  const CY = 555;

  const OUTER_R     = 360;
  const HASH_BAND_R = 388;
  const CORE_R      = 78;
  // Reduced to 5 quiet structural rings (was 12)
  const STRUCT_RINGS = [CORE_R + 56, CORE_R + 112, CORE_R + 168, CORE_R + 224, CORE_R + 280];

  // Type-specific core label and descriptor
  const isFolderType    = type === "FOLDER" || type === "FOLDER_RECOVERY";
  const isRecoveryType  = type === "RECOVERY" || type === "PDF" || type === "BINARY";
  const isSparseType    = type === "TEXT" || type === "MELODY" || type === "ETHIC";
  const coreLabel       = isFolderType   ? "⊞"
                        : isRecoveryType ? "▣"
                        : isSparseType   ? "◌"
                        : "0";
  const coreSublabel    = isFolderType   ? "BASE SNAPSHOT"
                        : isRecoveryType ? "RECOVERABLE"
                        : isSparseType   ? "SPARSE PROOF"
                        : "GENESIS";

  const title    = `${protocol} ${type} TOKEN`;
  const subtitle = `MACHINE READABLE · BASELINE ${baseline} · SPARSE DELTA · SHA-256`;

  const titleY     = 86;
  const subtitleY  = 118;
  const footerY    = 1144;
  const tokenIdY   = 1178;
  const lowerMetaY = 1210;

  const points = buildDeltaPoints(delta, CX, CY, CORE_R, 6, 44);
  const hashDots = buildHashBand(payloadHash, CX, CY, HASH_BAND_R);
  const orientMarkers = buildPrincipleMarkers(CX, CY, OUTER_R);

  const principleLabelY = CY - OUTER_R - 24;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${WIDTH}"
  height="${HEIGHT}"
  viewBox="0 0 ${WIDTH} ${HEIGHT}"
>
  <defs>
    <style>
      .bg          { fill: #f8f8f6; }
      .line-strong { stroke: #111; stroke-width: 2.4; fill: none; }
      .line-mid    { stroke: #888; stroke-width: 1.2; fill: none; }
      .line-soft   { stroke: #d8d8d8; stroke-width: 0.8; fill: none; }
      .text-title  { font-family: Arial, Helvetica, sans-serif; font-size: 28px; letter-spacing: 8px; fill: #111; }
      .text-subtitle { font-family: Arial, Helvetica, sans-serif; font-size: 12px; letter-spacing: 4px; fill: #444; }
      .text-small  { font-family: Arial, Helvetica, sans-serif; font-size: 13px; fill: #333; }
      .text-medium { font-family: Arial, Helvetica, sans-serif; font-size: 16px; fill: #222; }
      .text-meta   { font-family: Arial, Helvetica, sans-serif; font-size: 12px; letter-spacing: 2px; fill: #444; }
      .text-id     { font-family: 'Courier New', monospace; font-size: 14px; letter-spacing: 2px; fill: #111; }
      .text-core-big   { font-family: Arial, Helvetica, sans-serif; font-size: 58px; font-weight: 700; fill: #111; }
      .text-core-small { font-family: Arial, Helvetica, sans-serif; font-size: 11px; letter-spacing: 2px; fill: #555; }
      .label-box   { fill: #f9f9f9; stroke: #c8c8c8; stroke-width: 1.1; }
      .orient-dot  { fill: #fff; stroke: #ccc; stroke-width: 1.2; }
      .hash-fill   { fill: #333; }
      .hash-open   { fill: none; stroke: #999; stroke-width: 0.9; }
      .point       { fill: #111; }
      .point-soft  { fill: #666; opacity: 0.7; }
      .guide       { stroke: #ccc; stroke-width: 0.8; fill: none; stroke-dasharray: 3 7; }
      .crosshair   { stroke: #e8e8e8; stroke-width: 0.8; stroke-dasharray: 2 8; }
    </style>
  </defs>

  <rect class="bg" x="0" y="0" width="${WIDTH}" height="${HEIGHT}" />

  <!-- Title / subtitle -->
  <text x="${CX}" y="${titleY}" text-anchor="middle" class="text-title">${escapeXml(title)}</text>
  <text x="${CX}" y="${subtitleY}" text-anchor="middle" class="text-subtitle">${escapeXml(subtitle)}</text>
  <line x1="${CX - 150}" y1="${subtitleY + 14}" x2="${CX + 150}" y2="${subtitleY + 14}" class="line-soft" />

  <!-- Quiet crosshairs — two axes only -->
  <line x1="${CX}" y1="${CY - OUTER_R}" x2="${CX}" y2="${CY + OUTER_R}" class="crosshair" />
  <line x1="${CX - OUTER_R}" y1="${CY}" x2="${CX + OUTER_R}" y2="${CY}" class="crosshair" />

  <!-- 5 structural rings (was 12) -->
  ${STRUCT_RINGS.map(r => `<circle cx="${CX}" cy="${CY}" r="${r}" class="line-soft" />`).join("\n  ")}

  <!-- Outer ring — strong boundary -->
  <circle cx="${CX}" cy="${CY}" r="${OUTER_R}" class="line-strong" />
  <circle cx="${CX}" cy="${CY}" r="${OUTER_R - 18}" class="line-mid" />

  <!-- Six quiet orientation dots (no number) -->
  ${orientMarkers.map(m => `<circle cx="${m.x.toFixed(1)}" cy="${m.y.toFixed(1)}" r="9" class="orient-dot" />`).join("\n  ")}

  <!-- Hash band — slightly quieter dots -->
  ${hashDots.map(d =>
    d.filled
      ? `<circle cx="${d.x}" cy="${d.y}" r="${(d.size * 0.85).toFixed(1)}" class="hash-fill" />`
      : `<circle cx="${d.x}" cy="${d.y}" r="${(d.size * 0.75).toFixed(1)}" class="hash-open" />`
  ).join("\n  ")}

  <!-- Core circle with type-specific symbol -->
  <circle cx="${CX}" cy="${CY}" r="${CORE_R}" class="line-strong" />
  <circle cx="${CX}" cy="${CY}" r="${CORE_R - 18}" class="line-mid" />
  <text x="${CX}" y="${CY + 22}" text-anchor="middle" class="text-core-big">${coreLabel}</text>
  <text x="${CX}" y="${CY + 46}" text-anchor="middle" class="text-core-small">${coreSublabel}</text>

  <!-- Sparse delta points — guide lines + dots, using wider spacing (6 rings, step 44) -->
  ${points.map((p, i) => {
    const inner = polarToCartesian(CX, CY, CORE_R + 6, p.angle);
    return `<line x1="${inner.x.toFixed(1)}" y1="${inner.y.toFixed(1)}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" class="${i % 7 === 0 ? "guide" : "line-soft"}" />
    <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${p.r.toFixed(1)}" class="${i % 5 === 0 ? "point-soft" : "point"}" />`;
  }).join("\n  ")}

  <!-- Footer meta boxes -->
  <g transform="translate(100, 1082)">
    <rect x="0" y="0" width="230" height="82" rx="10" class="label-box" />
    <text x="14" y="26" class="text-small">⊙ = payload hash band</text>
    <text x="14" y="48" class="text-small">● = sparse delta marker</text>
    <text x="14" y="68" class="text-small">${escapeXml(coreSublabel)} token</text>
  </g>

  <g transform="translate(770, 1074)">
    <rect x="0" y="0" width="230" height="96" rx="10" class="label-box" />
    <text x="110" y="24" text-anchor="middle" class="text-meta">TOKEN META</text>
    <text x="14" y="48" class="text-small">Encoding: ${escapeXml(encoding)}</text>
    <text x="14" y="68" class="text-small">Message: ${messageLength} · Δ ${deltaCount}</text>
    <text x="14" y="88" class="text-small">Version: ${escapeXml(version)}</text>
  </g>

  <!-- Footer -->
  <text x="${CX}" y="${footerY}"    text-anchor="middle" class="text-medium">VSC-${escapeXml(version)} / ${escapeXml(type)}</text>
  <text x="${CX}" y="${tokenIdY}"   text-anchor="middle" class="text-id">TOKEN ID: ${escapeXml(tokenId)}</text>
  <text x="${CX}" y="${lowerMetaY}" text-anchor="middle" class="text-meta">HASH: ${escapeXml(shortHash(payloadHash, 24))}</text>
</svg>`;
}

export function saveSvg(token, outputFilePath) {
  const svg = renderSvg(token);
  fs.writeFileSync(outputFilePath, svg, "utf8");
  return outputFilePath;
}

export default renderSvg;