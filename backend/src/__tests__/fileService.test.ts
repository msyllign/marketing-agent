/**
 * Integration tests for the file parsing service.
 * Tests use the actual uploaded campaign files:
 *   - UC1__Mass_Segment_Consolidated_input.xlsx (multi-sheet campaign brief)
 *   - sms_message1.docx (SMS / Viber template)
 */
import * as path from 'path';
import * as fs from 'fs';
import { parseSmsTemplate, parsePersonasFile } from '../services/fileService';

// Resolve the uploaded files from the test fixtures directory
const FIXTURES_DIR = path.join(__dirname, '../../test-fixtures');
const XLSX_FILE = path.join(FIXTURES_DIR, 'UC1__Mass_Segment_Consolidated_input.xlsx');
const DOCX_FILE = path.join(FIXTURES_DIR, 'sms_message1.docx');

beforeAll(() => {
  // Ensure test fixtures exist (copy from uploads if needed)
  if (!fs.existsSync(FIXTURES_DIR)) {
    fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  }
});

describe('parseSmsTemplate', () => {
  test('parses DOCX template and returns non-empty text', async () => {
    expect(fs.existsSync(DOCX_FILE)).toBe(true);
    const text = await parseSmsTemplate(DOCX_FILE);
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(10);
  });

  test('DOCX template contains expected Greek credit card message', async () => {
    const text = await parseSmsTemplate(DOCX_FILE);
    // Should contain the key Greek terms from the SMS template
    expect(text).toContain('ΠΙΣΤΩΤΙΚΗ ΚΑΡΤΑ');
    expect(text).toContain('ΠΡΟΝΟΜΙΑ');
    expect(text).toContain('group.nbg.gr');
  });

  test('parses TXT template correctly', async () => {
    const tmpTxt = path.join(FIXTURES_DIR, 'test_template.txt');
    fs.writeFileSync(tmpTxt, 'Test SMS template content');
    const text = await parseSmsTemplate(tmpTxt);
    expect(text).toBe('Test SMS template content');
    fs.unlinkSync(tmpTxt);
  });
});

describe('parsePersonasFile - multi-sheet Excel', () => {
  test('file exists and is readable', () => {
    expect(fs.existsSync(XLSX_FILE)).toBe(true);
    const stat = fs.statSync(XLSX_FILE);
    expect(stat.size).toBeGreaterThan(1000);
  });

  test('parses all 6 life-stage personas from Lifestages sheet', () => {
    const { personas } = parsePersonasFile(XLSX_FILE);
    expect(personas).toHaveLength(6);
  });

  test('each persona has a name', () => {
    const { personas } = parsePersonasFile(XLSX_FILE);
    for (const persona of personas) {
      expect(persona.name).toBeTruthy();
      expect(typeof persona.name).toBe('string');
      expect(persona.name.length).toBeGreaterThan(0);
    }
  });

  test('persona names match expected Greek life-stage segments', () => {
    const { personas } = parsePersonasFile(XLSX_FILE);
    const names = personas.map((p) => p.name);
    expect(names).toContain('Νέα γενιά');
    expect(names).toContain('Νεότερος ενήλικας');
    expect(names).toContain('Μεγαλύτερος ενήλικας');
    expect(names).toContain('Γονέας με μικρό παιδί/α');
    expect(names).toContain('Γονέας με μεγαλύτερο παιδί/α');
    expect(names).toContain('Συνταξιούχος-Προς συνταξιοδότηση');
  });

  test('each persona has a generalDescription', () => {
    const { personas } = parsePersonasFile(XLSX_FILE);
    for (const persona of personas) {
      expect(persona.generalDescription).toBeTruthy();
      expect(typeof persona.generalDescription).toBe('string');
    }
  });

  test('personas have needs and milestones data', () => {
    const { personas } = parsePersonasFile(XLSX_FILE);
    // At least some personas should have needs and milestones
    const withNeeds = personas.filter((p) => p.needs && p.needs.length > 0);
    const withMilestones = personas.filter((p) => p.milestones && p.milestones.length > 0);
    expect(withNeeds.length).toBeGreaterThan(0);
    expect(withMilestones.length).toBeGreaterThan(0);
  });

  test('Νέα γενιά persona has expected age range in general description', () => {
    const { personas } = parsePersonasFile(XLSX_FILE);
    const neaGenia = personas.find((p) => p.name === 'Νέα γενιά');
    expect(neaGenia).toBeDefined();
    expect(neaGenia!.generalDescription).toContain('18-27');
  });

  test('parses campaign brief with title and primary message', () => {
    const { brief } = parsePersonasFile(XLSX_FILE);
    expect(brief).toBeDefined();
    // Brief should have some fields populated
    const briefValues = Object.values(brief).filter(Boolean);
    expect(briefValues.length).toBeGreaterThan(0);
  });

  test('parses AI training pack with role definition', () => {
    const { aiTrainingPack } = parsePersonasFile(XLSX_FILE);
    expect(aiTrainingPack).toBeDefined();
    const packValues = Object.values(aiTrainingPack).filter(Boolean);
    expect(packValues.length).toBeGreaterThan(0);
  });

  test('parses product descriptions', () => {
    const { products } = parsePersonasFile(XLSX_FILE);
    expect(products).toBeDefined();
    const productNames = Object.keys(products);
    expect(productNames.length).toBeGreaterThan(0);
    // Each product should have a description
    for (const name of productNames) {
      expect(products[name]).toBeDefined();
    }
  });
});
