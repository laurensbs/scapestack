// Encode/decode a bank snapshot to a compact URL-safe string.
//
// Strategy: only persist the raw input the organizer needs to reconstruct
// everything (item ids + quantities). Layout, prices, suggestions are all
// re-derived server-side at view time. This keeps URLs short (~1KB for a
// 200-item bank) and means shared links never stale-out on price changes.

export interface ShareSnapshot {
  v: 1;                       // version, for future format changes
  n?: string;                 // optional bank name
  i: number[];                // item ids, parallel array to `q`
  q: number[];                // quantities; 0 means "unknown" (Bank Tags input)
  k: "banktags" | "bankMemory" | "ids";
  jf?: boolean;               // junk filter active when shared
}

// Pack into TSV-like string the organizer's existing parser handles.
export function snapshotToInput(snap: ShareSnapshot): string {
  if (snap.k === "bankMemory") {
    const lines = ["Item id\tItem name\tItem quantity"];
    for (let j = 0; j < snap.i.length; j++) {
      lines.push(`${snap.i[j]}\tItem\t${snap.q[j]}`);
    }
    return lines.join("\n");
  }
  if (snap.k === "ids") return snap.i.join(",");
  // banktags
  return `banktags,1,${snap.n ?? "shared"},${snap.i[0] ?? 995},${snap.i.join(",")}`;
}

// URL-safe base64 (RFC 4648 §5: - and _ instead of + /)
function b64encode(s: string): string {
  if (typeof window === "undefined") {
    return Buffer.from(s, "utf8").toString("base64")
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  return btoa(unescape(encodeURIComponent(s)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64decode(s: string): string {
  const base = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (base.length % 4)) % 4;
  const padded = base + "=".repeat(pad);
  if (typeof window === "undefined") {
    return Buffer.from(padded, "base64").toString("utf8");
  }
  return decodeURIComponent(escape(atob(padded)));
}

export function encodeSnapshot(snap: ShareSnapshot): string {
  return b64encode(JSON.stringify(snap));
}

export function decodeSnapshot(code: string): ShareSnapshot | null {
  try {
    const json = b64decode(code);
    const parsed = JSON.parse(json);
    if (parsed.v !== 1 || !Array.isArray(parsed.i)) return null;
    return parsed as ShareSnapshot;
  } catch {
    return null;
  }
}

// Build snapshot from organize result (use after a successful organize).
// We ignore tabs/layout — those are re-derived server-side.
export function buildSnapshotFromInput(input: string, kind: "banktags" | "bankMemory" | "ids"): ShareSnapshot {
  // Parse input the same way the organizer does, but just to ids+qty.
  if (kind === "bankMemory") {
    const lines = input.replace(/\r\n/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);
    const ids: number[] = [];
    const qty: number[] = [];
    for (let j = 1; j < lines.length; j++) { // skip header
      const cols = lines[j].split("\t");
      const id = Number(cols[0]);
      const q = Number(cols[2]);
      if (Number.isFinite(id) && Number.isFinite(q)) {
        ids.push(id);
        qty.push(q);
      }
    }
    return { v: 1, k: "bankMemory", i: ids, q: qty };
  }
  if (kind === "ids") {
    const ids = input.split(/[,\s]+/).map(Number).filter(Number.isFinite);
    return { v: 1, k: "ids", i: ids, q: ids.map(() => 0) };
  }
  // banktags: parse parts after banktags,1,name,icon
  const parts = input.trim().split(",");
  const name = parts[2] ?? "shared";
  const ids: number[] = [];
  for (let p = 4; p < parts.length; p++) {
    if (parts[p] === "layout") break;
    const id = Number(parts[p]);
    if (Number.isFinite(id)) ids.push(id);
  }
  return { v: 1, k: "banktags", n: name, i: ids, q: ids.map(() => 0) };
}
