/**
 * Seeds the taxonomy lookup tables from packages/shared.
 *
 * Idempotent: re-running updates names and ordering without touching rows that
 * candidates or jobs already reference. Rows removed from the shared constants
 * are deactivated rather than deleted, because a candidate may already point at
 * one and a hard delete would break the FK.
 */

import { SECTORS, FUNCTIONS, CITIES, nowIso } from '@bktc/shared';
import { getDb, closeDatabase, type Db } from './client.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

interface Entry {
  readonly slug: string;
  readonly name: string;
}

function seedTaxonomy(db: Db, table: 'sector' | 'functional_area', entries: readonly Entry[]): void {
  const upsert = db.prepare(
    `INSERT INTO ${table} (slug, name, sort_order, is_active)
     VALUES (@slug, @name, @sortOrder, 1)
     ON CONFLICT (slug) DO UPDATE SET
       name = excluded.name,
       sort_order = excluded.sort_order,
       is_active = 1`,
  );

  const slugs = entries.map((e) => e.slug);
  const placeholders = slugs.map(() => '?').join(', ');
  const deactivate = db.prepare(
    `UPDATE ${table} SET is_active = 0 WHERE slug NOT IN (${placeholders})`,
  );

  db.transaction(() => {
    entries.forEach((entry, index) => {
      upsert.run({ slug: entry.slug, name: entry.name, sortOrder: index });
    });
    deactivate.run(...slugs);
  })();
}

/**
 * Cities carry a state so the City dropdown can be filtered by the selected
 * State. "Other" is seeded with a NULL state and offered in every state — no
 * list covers industrial India exhaustively, and forcing someone in an unlisted
 * town to pick the wrong city corrupts the location data outright.
 */
function seedCities(db: Db): void {
  const upsert = db.prepare(
    `INSERT INTO city (slug, name, state, sort_order, is_active)
     VALUES (@slug, @name, @state, @sortOrder, 1)
     ON CONFLICT (slug) DO UPDATE SET
       name = excluded.name,
       state = excluded.state,
       sort_order = excluded.sort_order,
       is_active = 1`,
  );

  const slugs = [...CITIES.map((c) => c.slug), 'other'];
  const placeholders = slugs.map(() => '?').join(', ');
  const deactivate = db.prepare(`UPDATE city SET is_active = 0 WHERE slug NOT IN (${placeholders})`);

  db.transaction(() => {
    CITIES.forEach((city, index) => {
      upsert.run({ slug: city.slug, name: city.name, state: city.state, sortOrder: index });
    });
    upsert.run({ slug: 'other', name: 'Other', state: null, sortOrder: 9999 });
    deactivate.run(...slugs);
  })();
}

/**
 * Starter skills. Seeding the common ones pre-approved keeps them from being
 * auto-created with divergent spellings, which is what fragments the taxonomy
 * Phase 2 scores against.
 */
const STARTER_SKILLS = [
  'AutoCAD', 'SolidWorks', 'CATIA', 'Creo', 'NX', 'Inventor', 'ANSYS', 'HyperMesh',
  'P&ID', 'GD&T', 'Sheet Metal Design', 'Tool Design', 'Jigs & Fixtures',
  'CNC Programming', 'VMC', 'Turning', 'Milling', 'Welding', 'Fabrication',
  'PLC', 'SCADA', 'HMI', 'Siemens PLC', 'Allen Bradley', 'DCS', 'Servo Drives',
  'Instrumentation', 'Process Control', 'Six Sigma', 'Lean Manufacturing',
  'Kaizen', '5S', 'TPM', 'Root Cause Analysis', 'FMEA', 'SPC', 'MSA',
  'ISO 9001', 'IATF 16949', 'ISO 14001', 'ISO 45001',
  'GMP', 'GLP', 'cGMP', 'HPLC', 'GC', 'UV Spectroscopy', 'Dissolution Testing',
  'Method Validation', 'Stability Studies', 'Quality Control', 'Quality Assurance',
  'Regulatory Affairs', 'USFDA', 'Pharmacovigilance', 'Formulation Development',
  'Chemical Process Design', 'Heat Transfer', 'Mass Transfer', 'Distillation',
  'HAZOP', 'Process Safety', 'Boiler Operation', 'Utilities',
  'Preventive Maintenance', 'Predictive Maintenance', 'Hydraulics', 'Pneumatics',
  'Electrical Maintenance', 'Panel Wiring', 'Transformers', 'Switchgear',
  'Project Management', 'Primavera', 'MS Project', 'Erection & Commissioning',
  'SAP', 'SAP MM', 'SAP PP', 'ERP', 'Inventory Management', 'Vendor Development',
  'Supply Chain Management', 'Production Planning', 'Costing',
  'Technical Sales', 'Business Development', 'Key Account Management',
];

function seedSkills(db: Db): void {
  const insert = db.prepare(
    `INSERT INTO skill (slug, name, is_approved, created_at)
     VALUES (@slug, @name, 1, @createdAt)
     ON CONFLICT (slug) DO UPDATE SET is_approved = 1`,
  );
  const now = nowIso();

  db.transaction(() => {
    for (const name of STARTER_SKILLS) {
      // Same normalisation the application uses, so a seeded skill and a
      // candidate typing the same thing converge on one row.
      const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      insert.run({ slug, name, createdAt: now });
    }
  })();
}

export function seed(db: Db = getDb(), options: { silent?: boolean } = {}): void {
  const log = (msg: string) => {
    if (!options.silent) console.log(msg);
  };

  seedTaxonomy(db, 'sector', SECTORS);
  log(`Seeded ${SECTORS.length} sectors`);

  seedTaxonomy(db, 'functional_area', FUNCTIONS);
  log(`Seeded ${FUNCTIONS.length} functional areas`);

  seedCities(db);
  log(`Seeded ${CITIES.length} cities across states, plus "Other"`);

  seedSkills(db);
  log(`Seeded ${STARTER_SKILLS.length} skills`);
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (invokedDirectly) {
  try {
    seed();
    closeDatabase();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
