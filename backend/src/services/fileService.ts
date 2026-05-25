import * as XLSX from 'xlsx';
import * as mammoth from 'mammoth';
import * as fs from 'fs';
import type {
  Persona,
  CampaignBrief,
  AITrainingPack,
  ProductDescription,
} from '../types';

/**
 * Extract text from a DOCX file using mammoth.
 */
export async function parseDocxTemplate(filePath: string): Promise<string> {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value.trim();
}

/**
 * Extract text from a plain-text file.
 */
export function parseTxtTemplate(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8').trim();
}

/**
 * Parse the SMS template file — supports .docx and .txt.
 */
export async function parseSmsTemplate(filePath: string): Promise<string> {
  if (filePath.endsWith('.docx')) {
    return parseDocxTemplate(filePath);
  }
  return parseTxtTemplate(filePath);
}

/**
 * Parse the Campaign Brief sheet from the Excel workbook.
 */
function parseCampaignBrief(sheet: XLSX.WorkSheet): CampaignBrief {
  const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
  });

  const brief: CampaignBrief = {};
  const fieldMap: Record<string, keyof CampaignBrief> = {
    'Τίτλος': 'title',
    'Activation': 'title',
    'Πιστωτική κάρτα': 'product',
    'Silver': 'product',
    'Χρησιμοποίησε': 'primaryMessage',
    'Αναφορά σε incentive': 'secondaryMessage',
    'Προνόμια Go For More': 'crossSell',
    'Συχνή χρήση': 'customerJourney',
    'Να εμφανίζεται': 'additionalInfo',
  };

  // Sheet layout: column A (index 0) = label/description, column B (index 1) = value
  for (const row of data) {
    if (!Array.isArray(row)) continue;
    const label = String(row[0] || '').trim();
    const value = String(row[1] || '').trim();
    if (!value) continue;

    // Map known field labels to brief properties
    for (const [key, prop] of Object.entries(fieldMap)) {
      if (label.includes(key) || value.includes(key)) {
        if (!brief[prop]) {
          (brief as Record<string, string>)[prop] = value;
        }
        break;
      }
    }
  }

  // Fallback: extract all non-empty values from column B (index 1)
  const values = data
    .filter((r) => Array.isArray(r) && (r as unknown[])[1])
    .map((r) => String((r as unknown[])[1]).trim())
    .filter(Boolean);

  if (!brief.title && values[0]) brief.title = values[0];
  if (!brief.product && values[1]) brief.product = values[1];
  if (!brief.primaryMessage && values[2]) brief.primaryMessage = values[2];
  if (!brief.secondaryMessage && values[3]) brief.secondaryMessage = values[3];
  if (!brief.crossSell && values[4]) brief.crossSell = values[4];
  if (!brief.customerJourney && values[5]) brief.customerJourney = values[5];
  if (!brief.additionalInfo && values[6]) brief.additionalInfo = values[6];

  return brief;
}

/**
 * Parse the AI Training Pack sheet from the Excel workbook.
 */
function parseAITrainingPack(sheet: XLSX.WorkSheet): AITrainingPack {
  const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
  });

  // AI Training Pack sheet: all data is in column A (index 0)
  const pack: AITrainingPack = {};
  const texts = data
    .filter((r) => Array.isArray(r) && (r as unknown[])[0])
    .map((r) => String((r as unknown[])[0]).trim())
    .filter(Boolean);

  if (texts[0]) pack.purpose = texts[0];
  if (texts[1]) pack.roleDefinition = texts[1];
  if (texts[2]) pack.languageGuidelines = texts[2];
  if (texts[5]) pack.segmentDifferentiation = texts[5];

  return pack;
}

/**
 * Parse the Products Description sheet from the Excel workbook.
 */
function parseProducts(sheet: XLSX.WorkSheet): ProductDescription {
  const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
  });

  const products: ProductDescription = {};

  // Row 1 (index 0) has product names in columns B, D, F, H (indices 1,3,5,7)
  const headerRow = (data[0] as unknown[]) || [];
  const descRow = (data[1] as unknown[]) || [];

  const productCols = [1, 3, 5, 7];
  for (const col of productCols) {
    const name = String(headerRow[col] || '').trim();
    if (!name) continue;
    const description = String(descRow[col] || '').trim();
    products[name] = { description };
  }

  return products;
}

/**
 * Parse the Lifestages Description sheet from the Excel workbook.
 * Returns an array of Persona objects, one per life-stage column.
 */
function parseLifestages(sheet: XLSX.WorkSheet): Persona[] {
  const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
  });

  if (data.length === 0) return [];

  // Row 1 (index 0) has persona names in columns B-G (indices 1-6)
  const headerRow = (data[0] as unknown[]) || [];
  const personaCount = headerRow.length - 1; // subtract column A (label col)

  const personas: Persona[] = [];

  for (let col = 1; col <= personaCount; col++) {
    const name = String(headerRow[col] || '').trim();
    if (!name) continue;

    const persona: Persona = { name };

    for (let row = 1; row < data.length; row++) {
      const rowData = (data[row] as unknown[]) || [];
      const label = String(rowData[0] || '').trim();
      const value = String(rowData[col] || '').trim();

      if (!label || !value) continue;

      // Map Greek row labels to English persona fields
      if (label === 'Γενική περιγραφή') {
        persona.generalDescription = value;
      } else if (label === 'ΟΡΟΣΗΜΑ') {
        persona.milestones = value;
      } else if (label === 'ΑΝΑΓΚΕΣ') {
        persona.needs = value;
      } else if (label === 'ΕΠΙΚΟΙΝΩΝΙΑ') {
        persona.communication = value;
      } else {
        // Store other rows with the Greek label as key
        persona[label] = value;
      }
    }

    personas.push(persona);
  }

  return personas;
}

/**
 * Parse the personas Excel file.
 * Supports both a simple flat sheet (single-sheet with name/attributes per row)
 * and the multi-sheet campaign brief format.
 */
export function parsePersonasFile(filePath: string): {
  personas: Persona[];
  brief: CampaignBrief;
  aiTrainingPack: AITrainingPack;
  products: ProductDescription;
  sheetNames: string[];
} {
  const workbook = XLSX.readFile(filePath, { codepage: 65001 });
  const sheetNames = workbook.SheetNames;

  console.log('[FileService] Excel sheet names:', sheetNames);

  const result = {
    personas: [] as Persona[],
    brief: {} as CampaignBrief,
    aiTrainingPack: {} as AITrainingPack,
    products: {} as ProductDescription,
    sheetNames,
  };

  // Detect multi-sheet campaign brief format (case-insensitive, also matches partial/Greek names)
  const hasLifestages = sheetNames.some((s) =>
    s.toLowerCase().includes('lifestage') ||
    s.toLowerCase().includes('life stage') ||
    s.toLowerCase().includes('segment')
  );
  const hasCampaignBrief = sheetNames.some((s) => {
    const lower = s.toLowerCase();
    return (
      lower.includes('campaign') ||
      lower.includes('brief') ||
      lower.includes('brief') ||
      lower.includes('καμπ') ||  // Greek "campaign"
      lower.includes('ενημ')     // Greek "brief/update"
    );
  });

  // If sheet count >= 3, assume it's the rich multi-sheet format even if names don't match
  const looksMultiSheet = sheetNames.length >= 3;

  if (hasLifestages || (looksMultiSheet && hasCampaignBrief)) {
    // Rich multi-sheet format
    console.log('[FileService] Detected multi-sheet campaign format');
    for (const name of sheetNames) {
      const sheet = workbook.Sheets[name];
      const lower = name.toLowerCase();

      if (
        lower.includes('campaign') ||
        lower.includes('brief') ||
        lower.includes('καμπ') ||
        lower.includes('ενημ') ||
        lower.includes('mass') ||
        lower.includes('input')
      ) {
        result.brief = parseCampaignBrief(sheet);
        console.log(`[FileService] Parsed brief from sheet "${name}"`);
      } else if (
        lower.includes('ai train') ||
        lower.includes('training') ||
        lower.includes('pack')
      ) {
        result.aiTrainingPack = parseAITrainingPack(sheet);
        console.log(`[FileService] Parsed AI training pack from sheet "${name}"`);
      } else if (lower.includes('product')) {
        result.products = parseProducts(sheet);
        console.log(`[FileService] Parsed products from sheet "${name}"`);
      } else if (
        lower.includes('lifestage') ||
        lower.includes('life stage') ||
        lower.includes('segment') ||
        lower.includes('persona')
      ) {
        result.personas = parseLifestages(sheet);
        console.log(
          `[FileService] Parsed ${result.personas.length} personas from sheet "${name}"`
        );
      }
    }

    // If personas still empty, try all remaining sheets as lifestage sheets
    if (result.personas.length === 0) {
      for (const name of sheetNames) {
        const sheet = workbook.Sheets[name];
        const candidates = parseLifestages(sheet);
        if (candidates.length > 0) {
          result.personas = candidates;
          console.log(
            `[FileService] Fallback: found ${candidates.length} personas in sheet "${name}"`
          );
          break;
        }
      }
    }
  } else {
    // Simple flat format: first sheet, each row is a persona
    console.log('[FileService] Using flat single-sheet format');
    const firstSheet = workbook.Sheets[sheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      firstSheet,
      { defval: '' }
    );

    result.personas = rows.map((row) => {
      const persona: Persona = {
        name: String(row['name'] || row['Name'] || row['ΟΝΟΜΑ'] || 'Unknown'),
      };
      for (const [key, val] of Object.entries(row)) {
        persona[key] = String(val);
      }
      return persona;
    });
  }

  return result;
}
