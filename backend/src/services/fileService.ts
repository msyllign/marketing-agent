import * as XLSX from 'xlsx';
import * as mammoth from 'mammoth';
import * as fs from 'fs';
import * as path from 'path';
import type {
  Persona,
  AITrainingPack,
  ProductDescription,
} from '../types';

// ── Template parsers ─────────────────────────────────────────────────────────

export async function parseDocxTemplate(filePath: string): Promise<string> {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value.trim();
}

export function parseTxtTemplate(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8').trim();
}

export async function parseSmsTemplate(filePath: string): Promise<string> {
  if (filePath.endsWith('.docx')) return parseDocxTemplate(filePath);
  return parseTxtTemplate(filePath);
}

// ── Sheet helpers ────────────────────────────────────────────────────────────

function sheetToTexts(sheet: XLSX.WorkSheet): string[] {
  const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });
  const texts: string[] = [];
  for (const row of data) {
    if (!Array.isArray(row)) continue;
    for (const cell of row as unknown[]) {
      const s = String(cell ?? '').trim();
      if (s) texts.push(s);
    }
  }
  return texts;
}

function sheetToRows(sheet: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });
}

// ── Personas Description sheet ───────────────────────────────────────────────
//
// Expected layout (column-per-persona):
//   Row 0       : ["", "PersonaA", "PersonaB", ...]   ← header
//   Rows 1-4    : common base-profile fields (rows 2-5 in Excel)
//   Row 5+      : product-specific profile (row 6+ in Excel)

function parsePersonasDescription(sheet: XLSX.WorkSheet): Persona[] {
  const rows = sheetToRows(sheet);
  if (rows.length === 0) return [];

  const headerRow = (rows[0] as unknown[]) || [];
  const personas: Persona[] = [];

  // Build column index → persona name map
  const personaCols: Array<{ col: number; name: string }> = [];
  for (let col = 1; col < headerRow.length; col++) {
    const name = String(headerRow[col] ?? '').trim();
    if (name) personaCols.push({ col, name });
  }

  // Fallback: row-based format (each row = one persona)
  if (personaCols.length === 0) {
    const fieldNames = (rows[0] as unknown[]).map((c) => String(c ?? '').trim());
    for (let r = 1; r < rows.length; r++) {
      const row = (rows[r] as unknown[]) || [];
      const nameIdx = fieldNames.findIndex((f) => f.toLowerCase() === 'name' || f === '');
      const name = String(row[nameIdx >= 0 ? nameIdx : 0] ?? '').trim() || `Persona ${r}`;
      const persona: Persona = { name };
      fieldNames.forEach((field, i) => {
        if (field && field.toLowerCase() !== 'name') persona[field] = String(row[i] ?? '').trim();
      });
      if (name) personas.push(persona);
    }
    return personas;
  }

  // Column-based: one persona per column
  // IMPORTANT: rows 1-4 (Excel rows 2-5) = common base profile
  //            row 5+  (Excel row 6+)    = product-specific profile
  const BASE_PROFILE_LAST_ROW_IDX = 4; // inclusive (0-indexed data rows)

  for (const { col, name } of personaCols) {
    const persona: Persona = { name };
    const productProfileParts: string[] = [];

    for (let rowIdx = 1; rowIdx < rows.length; rowIdx++) {
      const rowData = (rows[rowIdx] as unknown[]) || [];
      const label = String(rowData[0] ?? '').trim();
      const value = String(rowData[col] ?? '').trim();
      if (!label || !value) continue;

      if (rowIdx > BASE_PROFILE_LAST_ROW_IDX) {
        // Product-specific rows (row 6+ in Excel)
        productProfileParts.push(`${label}: ${value}`);
      } else {
        // Base profile rows (rows 2-5 in Excel)
        const lower = label.toLowerCase();
        if (lower.includes('γενική') || lower.includes('περιγραφή') || lower.includes('description')) {
          persona.generalDescription = value;
        } else if (lower.includes('ορόσημ') || lower.includes('milestone')) {
          persona.milestones = value;
        } else if (lower.includes('ανάγκ') || lower.includes('need')) {
          persona.needs = value;
        } else if (lower.includes('επικοινων') || lower.includes('commun')) {
          persona.communication = value;
        } else {
          persona[label] = value;
        }
      }
    }

    if (productProfileParts.length > 0) {
      persona.productProfile = productProfileParts.join('\n');
    }

    personas.push(persona);
  }

  return personas;
}

// ── AI Training Pack sheet ───────────────────────────────────────────────────

function parseAITrainingPackSheet(sheet: XLSX.WorkSheet): AITrainingPack {
  const texts = sheetToTexts(sheet);
  if (texts.length === 0) return {};
  const pack: AITrainingPack = {};
  pack.roleDefinition = texts[0];
  pack.validationGuidelines = texts.join('\n');
  pack.languageGuidelines = texts.slice(1, 6).join('\n');
  return pack;
}

// ── Product's Description sheet ─────────────────────────────────────────────
//
// Scans for a "campaign specific offer" row.
// Keywords (EN + GR): campaign offer | specific offer | προσφορά | ειδική προσφορά | promotion
// If that row's value cell is blank → campaignOffer = null (no offer this campaign)
// If it has content → campaignOffer = that text
// All other rows are collected into the product description block.

const OFFER_ROW_KEYWORDS = [
  'campaign offer', 'specific offer', 'campaign specific', 'campaign action',
  'promotion', 'incentive', 'προσφορά', 'ειδική', 'προωθητική',
];

function isOfferRow(label: string): boolean {
  const lower = label.toLowerCase();
  return OFFER_ROW_KEYWORDS.some((kw) => lower.includes(kw));
}

function parseProductDescriptionSheet(sheet: XLSX.WorkSheet): {
  products: ProductDescription;
  campaignOffer: string | null;
} {
  const rows = sheetToRows(sheet);
  const lines: string[] = [];
  let campaignOffer: string | null = null;

  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const rawRow = row as unknown[];
    const label = String(rawRow[0] ?? '').trim();
    if (!label) continue;

    if (isOfferRow(label)) {
      // Collect all non-empty value cells after the label
      const value = rawRow
        .slice(1)
        .map((c) => String(c ?? '').trim())
        .filter(Boolean)
        .join(' ')
        .trim();
      campaignOffer = value || null;
      console.log(
        `[FileService] Campaign offer row "${label}": ${campaignOffer ?? '(blank — no offer)'}`
      );
    } else {
      const cells = rawRow.map((c) => String(c ?? '').trim()).filter(Boolean);
      if (cells.length >= 2) {
        lines.push(`${cells[0]}: ${cells.slice(1).join(' | ')}`);
      } else if (cells.length === 1) {
        lines.push(cells[0]);
      }
    }
  }

  console.log(`[FileService] Product description (${lines.length} lines)`);
  return { products: { product: { description: lines.join('\n') } }, campaignOffer };
}

// ── In-memory cache ──────────────────────────────────────────────────────────

export interface ParsedFileData {
  personas: Persona[];
  aiTrainingPack: AITrainingPack;
  products: ProductDescription;
  campaignOffer: string | null;   // null = no offer for this campaign
  sheetNames: string[];
}

interface CacheEntry {
  mtimeMs: number;
  data: ParsedFileData;
}

const fileCache = new Map<string, CacheEntry>();

function getFromCache(filePath: string): ParsedFileData | null {
  const entry = fileCache.get(filePath);
  if (!entry) return null;
  try {
    const { mtimeMs } = fs.statSync(filePath);
    if (mtimeMs !== entry.mtimeMs) { fileCache.delete(filePath); return null; }
    console.log(`[FileService] Cache hit: ${path.basename(filePath)}`);
    return entry.data;
  } catch {
    fileCache.delete(filePath);
    return null;
  }
}

function saveToCache(filePath: string, data: ParsedFileData): void {
  try {
    const { mtimeMs } = fs.statSync(filePath);
    fileCache.set(filePath, { mtimeMs, data });
    console.log(`[FileService] Cached: ${path.basename(filePath)}`);
  } catch { /* non-fatal */ }
}

// ── Main export ──────────────────────────────────────────────────────────────

function matchesSheet(name: string, keywords: string[]): boolean {
  const lower = name.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

export function parsePersonasFile(filePath: string): ParsedFileData {
  // Return cached result if the file hasn't changed
  const cached = getFromCache(filePath);
  if (cached) return cached;

  const workbook = XLSX.readFile(filePath, { codepage: 65001 });
  const sheetNames = workbook.SheetNames;
  console.log('[FileService] Parsing Excel. Sheet names:', sheetNames);

  const result: ParsedFileData = {
    personas: [],
    aiTrainingPack: {},
    products: {},
    campaignOffer: null,
    sheetNames,
  };

  for (const name of sheetNames) {
    const sheet = workbook.Sheets[name];

    if (matchesSheet(name, ['personas description', 'personas desc', 'persona description',
        'persona desc', 'lifestage', 'life stage', 'segment description', 'personas'])) {
      result.personas = parsePersonasDescription(sheet);
      console.log(
        `[FileService] Personas from "${name}": ${result.personas.length}` +
        (result.personas.length ? ` — [${result.personas.map((p) => p.name).join(', ')}]` : '')
      );
    } else if (matchesSheet(name, ['ai training', 'training pack', 'ai pack', 'training', 'guidelines'])) {
      result.aiTrainingPack = parseAITrainingPackSheet(sheet);
      console.log(`[FileService] AI Training Pack from "${name}"`);
    } else if (matchesSheet(name, ["product's description", 'product description',
        'products description', 'products desc', 'product desc', 'product'])) {
      const parsed = parseProductDescriptionSheet(sheet);
      result.products = parsed.products;
      result.campaignOffer = parsed.campaignOffer;
      console.log(`[FileService] Product description from "${name}"`);
    }
  }

  // Fallback: try all sheets for personas
  if (result.personas.length === 0) {
    console.log('[FileService] No personas via name matching — trying all sheets...');
    for (const name of sheetNames) {
      const candidates = parsePersonasDescription(workbook.Sheets[name]);
      if (candidates.length > 0) {
        result.personas = candidates;
        console.log(`[FileService] Fallback: ${candidates.length} personas from "${name}"`);
        break;
      }
    }
  }

  saveToCache(filePath, result);
  return result;
}
