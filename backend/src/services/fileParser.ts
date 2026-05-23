import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import { Persona } from '../types';

/**
 * Read the SMS template from a plain-text file.
 */
export function readSmsTemplate(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8').trim();
}

/**
 * Parse a CSV or Excel file into an array of Persona objects.
 * The first row is treated as the header / field names.
 * The column named "name" (case-insensitive) becomes `persona.name`.
 */
export function parsePersonasFile(filePath: string): Persona[] {
  const ext = path.extname(filePath).toLowerCase();

  let rows: Record<string, string>[];

  if (ext === '.csv') {
    const content = fs.readFileSync(filePath, 'utf-8');
    rows = parse(content, {
      columns: true,       // use first row as keys
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[];
  } else if (['.xlsx', '.xls'].includes(ext)) {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    rows = XLSX.utils.sheet_to_json<Record<string, string>>(
      workbook.Sheets[sheetName],
      { defval: '' }
    );
  } else {
    throw new Error(`Unsupported file type: ${ext}`);
  }

  return rows.map((row) => {
    // Normalise key casing and locate the "name" field
    const normalised: Persona = { name: '' };
    for (const [k, v] of Object.entries(row)) {
      const key = k.trim();
      normalised[key] = String(v).trim();
      if (key.toLowerCase() === 'name') {
        normalised.name = String(v).trim();
      }
    }
    return normalised;
  });
}
