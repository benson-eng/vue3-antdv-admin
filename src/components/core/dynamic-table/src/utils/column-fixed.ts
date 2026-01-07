import type { TableColumn } from '../types/column';

type Column = TableColumn;

type FixedDir = 'left' | 'right' | undefined;

/** 穩定 key：支援 dataIndex 是 string[] */
function getStableKey(column: Column): string {
  const k = (column as any)?.key;
  if (k !== undefined && k !== null && String(k).length > 0) { return String(k); }

  const di = (column as any)?.dataIndex;
  if (Array.isArray(di)) { return di.join('.'); } // ✅ 強制穩定
  if (di !== undefined && di !== null) { return String(di); }

  // 最後保底：避免 undefined 變成同一個 key
  return '__NO_KEY__';
}

/** 固定欄位補 width */
function ensureFixedWidth(col: Column): Column {
  if ((col.fixed === 'left' || col.fixed === 'right') && col.width === undefined) {
    return { ...col, width: 120 };
  }
  return col;
}

/** 入口先去重：同 key 只留第一個（避免外層已污染） */
function dedupeByKey(cols: Column[]): Column[] {
  const seen = new Set<string>();
  const out: Column[] = [];
  for (const c of cols) {
    const k = getStableKey(c);
    if (seen.has(k)) { continue; }
    seen.add(k);
    out.push(c);
  }
  return out;
}

/**
 * 最終版：用「固定基準 baseOrderKeys」來做原位回插
 *
 * @param columns 當下 columns（可能已被排序/固定過）
 * @param targetKey 要操作的欄位 key（務必 demonstrate 使用同一套 key）
 * @param fixed 'left' | 'right' | undefined（點同一顆會自動 toggle 成 undefined）
 * @param baseOrderKeys ✅“最初始”欄位順序 key（只初始化一次，不要每次重算）
 */
export function applyColumnFixedChange(
  columns: Column[],
  targetKey: string,
  fixed: FixedDir,
  baseOrderKeys: string[],
): Column[] {
  // 1) 深拷貝 + 入口去重（防止外層已經有重複）
  const safe = dedupeByKey(columns).map(c => ({ ...c }));

  // 2) 找 target
  const idx = safe.findIndex(c => getStableKey(c) === targetKey);
  if (idx === -1) { return safe; }

  const oldFixed = safe[idx].fixed;

  // 3) 點同一顆 = toggle 取消
  if (oldFixed === fixed && fixed !== undefined) { fixed = undefined; }

  const target = ensureFixedWidth({ ...safe[idx], fixed });

  // 4) 移除 target（保證只存在一次）
  const rest = safe.filter((_, i) => i !== idx);

  // 5) 分區（保持各區原本相對順序）
  const left: Column[] = [];
  const right: Column[] = [];
  const normal: Column[] = [];

  for (const c0 of rest) {
    const c = ensureFixedWidth(c0);
    if (c.fixed === 'left') { left.push(c); }
    else if (c.fixed === 'right') { right.push(c); }
    else { normal.push(c); }
  }

  // 6) 組裝
  const out: Column[] = [];

  // left 區：新設 left → 插到 left 區最後（若原本沒 left → 會變第一群）
  if (fixed === 'left') { out.push(...left, target); }
  else { out.push(...left); }

  // normal 區：取消 fixed → 回插到 baseOrderKeys 的原位（以 normal 序列為基準）
  if (fixed === undefined) {
    const tKey = getStableKey(target);

    // 若 normal 已經有（理論上不會，但防外層污染/重複呼叫）
    if (!normal.some(c => getStableKey(c) === tKey)) {
      // 在 baseOrderKeys 中的相對位置，換算成「normal 序列中的插入點」
      // 做法：找出 baseOrderKeys 中，target 前面有哪些 key 仍在 normal，
      // 插在那些 key 的後面。
      const baseIdx = baseOrderKeys.indexOf(tKey);

      if (baseIdx === -1) {
        normal.push(target);
      }
      else {
        // 找出 normal 目前在 baseOrderKeys 的順序索引，計算插入點
        const normalBaseIndexes = normal
          .map(c => baseOrderKeys.indexOf(getStableKey(c)))
          .map(n => (n === -1 ? Number.MAX_SAFE_INTEGER : n));

        // 插入位置 = normal 中第一個 baseIndex > baseIdx 的位置
        let insertAt = normalBaseIndexes.findIndex(n => n > baseIdx);
        if (insertAt === -1) { insertAt = normal.length; }

        normal.splice(insertAt, 0, target);
      }
    }
  }

  out.push(...normal);

  // right 區：新設 right → 插到 right 區最前（你的規格：插到第一個 right 左邊）
  if (fixed === 'right') { out.push(target, ...right); }
  else { out.push(...right); }

  // 7) 最終：再去重一次 + 強制 left/normal/right 分段（防任何異常）
  const final = dedupeByKey(out);
  const fL: Column[] = [];
  const fN: Column[] = [];
  const fR: Column[] = [];
  for (const c of final) {
    if (c.fixed === 'left') { fL.push(c); }
    else if (c.fixed === 'right') { fR.push(c); }
    else { fN.push(c); }
  }
  return [...fL, ...fN, ...fR];
}
