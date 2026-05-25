import * as XLSX from 'xlsx';
import * as mammoth from 'mammoth';
import * as fs from 'fs';
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
  if (filePath.endsWith('.docx')) {
    return parseDocxTemplate(filePath);
  }
  return parseTxtTemplate(filePath);
}

// ── Sheet helpers ────────────────────────────────────────────────────────────

/** Return all non-empty string cell values from a sheet as a flat array. */
function sheetToTexts(sheet: XLSX.WorkSheet): string[] {
  const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
  });
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

/** Return rows as arrays (raw sheet_to_json with numeric headers). */
function sheetToRows(sheet: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
  });
}

// ── Personas Description sheet ───────────────────────────────────────────────
//
// Expected layout (column-per-persona):
//   Row 0  : ["", "PersonaA", "PersonaB", ...]
//   Row n  : ["FieldLabel", valueA, valueB, ...]

function parsePersonasDescription(sheet: XLSX.WorkSheet): Persona[] {
  const rows = sheetToRows(sheet);
  if (rows.length === 0) return [];

  const headerRow = (rows[0] as unknown[]) || [];
  const personas: Persona[] = [];

  // Collect column indices that have a persona name in the header row
  const personaCols: Array<{ col: number; name: string }> = [];
  for (let col = 1; col < headerRow.length; col++) {
    const name = String(headerRow[col] ?? '').trim();
    if (name) personaCols.push({ col, name });
  }

  // If no column-based personas found, try row-based (each row = one persona)
  if (personaCols.length === 0) {
    // row 0 = header row with field names, rows 1+ = persona data
    const fieldNames = (rows[0] as unknown[]).map((c) => String(c ?? '').trim());
    for (let r = 1; r < rows.length; r++) {
      const row = (rows[r] as unknown[]) || [];
      const nameIdx = fieldNames.findIndex(
        (f) => f.toLowerCase() === 'name' || f.toLowerCase() === 'ονομα' || f === ''
      );
      const name =
        String(row[nameIdx >= 0 ? nameIdx : 0] ?? '').trim() || `Persona ${r}`;
      const persona: Persona = { name };
      fieldNames.forEach((field, i) => {
        if (field && field.toLowerCase() !== 'name') {
          persona[field] = String(row[i] ?? '').trim();
        }
      });
      if (name) personas.push(persona);
    }
    return personas;
  }

  // Column-based: build one persona per column
  for (const { col, name } of personaCols) {
    const persona: Persona = { name };
    for (let row = 1; row < rows.length; row++) {
      const rowData = (rows[row] as unknown[]) || [];
      const label = String(rowData[0] ?? '').trim();
      const value = String(rowData[col] ?? '').trim();
      if (!label || !value) continue;

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
    personas.push(persona);
  }

  return personas;
}

// ── AI Training Pack sheet ───────────────────────────────────────────────────
//
// Capture ALL content as validation guidelines (role + language rules +
// quality checklist). Any format (rows in col A, or a table) is handled
// by dumping every non-empty cell into a single text block.

function parseAITrainingPackSheet(sheet: XLSX.WorkSheet): AITrainingPack {
  const texts = sheetToTexts(sheet);
  if (texts.length === 0) return {};

  // First non-empty cell = role/purpose definition (if it looks like a sentence)
  const pack: AITrainingPack = {};
  pack.roleDefinition = texts[0];
  // Everything joined = full validation guidelines the critic can reference
  pack.validationGuidelines = texts.join('\n');
  // Compat fields
  pack.languageGuidelines = texts.slice(1, 6).join('\n');

  return pack;
}

// ── Product's Description sheet ──────────────────────────────────────────────
//
// Supported layouts:
//   A) Two columns — Col A = attribute name, Col B = value
//   B) Single column of text blocks
//
// We collect everything and expose it under the key "product" so
// claudeService can access it without knowing the product name up front.

function parseProductDescriptionSheet(sheet: XLSX.WorkSheet): ProductDescription {
  const rows = sheetToRows(sheet);
  const lines: string[] = [];

  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const cells = (row as unknown[])
      .map((c) => String(c ?? '').trim())
      .filter(Boolean);
    if (cells.length === 0) continue;

    if (cells.length >= 2) {
      // Key: Value row
      lines.push(`${cells[0]}: ${cells.slice(1).join(' | ')}`);
    } else {
      lines.push(cells[0]);
    }
  }

  const description = lines.join('\n');
  console.log(`[FileService] Product description (${lines.length} lines)`);
  return { product: { description } };
}

// ── Main export ──────────────────────────────────────────────────────────────

function matchesSheet(name: string, keywords: string[]): boolean {
  const lower = name.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

export function parsePersonasFile(filePath: string): {
  personas: Persona[];
  aiTrainingPack: AITrainingPack;
  products: ProductDescription;
  sheetNames: string[];
} {
  const workbook = XLSX.readFile(filePath, { codepage: 65001 });
  const sheetNames = workbook.SheetNames;

  console.log('[FileService] Excel sheet names:', sheetNames);

  const result = {
    personas: [] as Persona[],
    aiTrainingPack: {} as AITrainingPack,
    products: {} as ProductDescription,
    sheetNames,
  };

  // ── Sheet routing ──────────────────────────────────────────────────────────
  for (const name of sheetNames) {
    const sheet = workbook.Sheets[name];

    if (
      matchesSheet(name, [
        'personas description',
        'personas desc',
        'persona description',
        'persona desc',
        'lifestage',
        'life stage',
        'segment description',
        'personas',
      ])
    ) {
      result.personas = parsePersonasDescription(sheet);
      console.log(
        `[FileService] Personas from "${name}": ${result.personas.length} found` +
        (result.personas.length ? ` — [${result.personas.map((p) => p.name).join(', ')}]` : '')
      );
    } else if (
      matchesSheet(name, [
        'ai training',
        'training pack',
        'ai pack',
        'training',
        'guidelines',
      ])
    ) {
      result.aiTrainingPack = parseAITrainingPackSheet(sheet);
      console.log(`[FileService] AI Training Pack from "${name}"`);
    } else if (
      matchesSheet(name, [
        "product's description",
        'product description',
        'products description',
        'products desc',
        'product desc',
        'product',
      ])
    ) {
      result.products = parseProductDescriptionSheet(sheet);
      console.log(`[FileService] Product description from "${name}"`);
    }
  }

  // ── Fallback: if still no personas, try every sheet ──────────────────────
  if (result.personas.length === 0) {
    console.log('[FileService] No personas found via name matching — trying all sheets...');
    for (const name of sheetNames) {
      const sheet = workbook.Sheets[name];
      const candidates = parsePersonasDescription(sheet);
      if (candidates.length > 0) {
        result.personas = candidates;
        console.log(
          `[FileService] Fallback: ${candidates.length} personas from "${name}"`
        );
        break;
      }
    }
  }

  return result;
}
