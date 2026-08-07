/**
 * Sector (industry) and Function (department) taxonomy.
 *
 * The proposal put both concepts in one "sector" field, mixing industries
 * (Engineering, Pharma, Manufacturing, Machine Building) with job functions
 * (Operations, Lab, Drafting, Sales). A pharma QC chemist would have to choose
 * between "Pharmaceuticals" and "Lab" and lose the other — which matters
 * because sector is Phase 2's hard elimination filter.
 *
 * Splitting into two required single-select fields absorbs all seven original
 * values. Both are seeded into lookup tables and editable by an admin, so BK
 * can extend them without a deploy.
 *
 * Plan reference: D5.
 */

export interface TaxonomyEntry {
  readonly slug: string;
  readonly name: string;
}

/** A city belongs to exactly one state, so the two dropdowns can cascade. */
export interface CityEntry extends TaxonomyEntry {
  readonly state: string;
}

/** Industry. 28 entries plus OTHER. */
export const SECTORS: readonly TaxonomyEntry[] = [
  { slug: 'epc', name: 'Engineering, Procurement & Construction' },
  { slug: 'automobile-auto-components', name: 'Automobile & Auto Components' },
  { slug: 'industrial-machinery-equipment', name: 'Industrial Machinery & Equipment' },
  { slug: 'machine-building-spm', name: 'Machine Building & Special Purpose Machines' },
  { slug: 'electrical-equipment-power-systems', name: 'Electrical Equipment & Power Systems' },
  { slug: 'electronics-semiconductor', name: 'Electronics & Semiconductor Manufacturing' },
  { slug: 'industrial-automation-instrumentation', name: 'Industrial Automation & Instrumentation' },
  { slug: 'pharmaceuticals-life-sciences', name: 'Pharmaceuticals & Life Sciences' },
  { slug: 'biotechnology', name: 'Biotechnology' },
  { slug: 'medical-devices', name: 'Medical Devices' },
  { slug: 'chemicals-petrochemicals', name: 'Chemicals & Petrochemicals' },
  { slug: 'fertilisers-agrochemicals', name: 'Fertilisers & Agrochemicals' },
  { slug: 'oil-gas', name: 'Oil & Gas' },
  { slug: 'power-renewable-energy', name: 'Power Generation & Renewable Energy' },
  { slug: 'metals-iron-steel', name: 'Metals, Iron & Steel' },
  { slug: 'mining-minerals', name: 'Mining & Minerals' },
  { slug: 'cement-building-materials', name: 'Cement & Building Materials' },
  { slug: 'plastics-polymers-rubber', name: 'Plastics, Polymers & Rubber' },
  { slug: 'packaging', name: 'Packaging' },
  { slug: 'textiles-apparel', name: 'Textiles & Apparel' },
  { slug: 'food-processing-fmcg', name: 'Food Processing & FMCG Manufacturing' },
  { slug: 'paper-pulp', name: 'Paper & Pulp' },
  { slug: 'glass-ceramics', name: 'Glass & Ceramics' },
  { slug: 'aerospace-defence', name: 'Aerospace & Defence' },
  { slug: 'railways-rolling-stock', name: 'Railways & Rolling Stock' },
  { slug: 'shipbuilding-marine', name: 'Shipbuilding & Marine' },
  { slug: 'water-waste-treatment', name: 'Water & Waste Treatment' },
  { slug: 'logistics-supply-chain', name: 'Logistics, Supply Chain & Warehousing' },
  { slug: 'other', name: 'Other' },
] as const;

/** Department / functional area. 18 entries plus OTHER. */
export const FUNCTIONS: readonly TaxonomyEntry[] = [
  { slug: 'design-drafting', name: 'Design & Drafting' },
  { slug: 'production-manufacturing', name: 'Production & Manufacturing' },
  { slug: 'quality-assurance-control', name: 'Quality Assurance & Quality Control' },
  { slug: 'maintenance-reliability', name: 'Maintenance & Reliability' },
  { slug: 'process-engineering', name: 'Process Engineering' },
  { slug: 'rnd-product-development', name: 'R&D and Product Development' },
  { slug: 'laboratory-testing', name: 'Laboratory & Testing' },
  { slug: 'project-management', name: 'Project Management' },
  { slug: 'installation-commissioning', name: 'Installation & Commissioning' },
  { slug: 'service-field-engineering', name: 'Service & Field Engineering' },
  { slug: 'automation-controls', name: 'Automation & Controls' },
  { slug: 'planning-industrial-engineering', name: 'Planning (PPC) & Industrial Engineering' },
  { slug: 'tool-room-tooling', name: 'Tool Room & Tooling' },
  { slug: 'supply-chain-purchase-stores', name: 'Supply Chain, Purchase & Stores' },
  { slug: 'ehs', name: 'EHS (Environment, Health & Safety)' },
  { slug: 'regulatory-affairs-compliance', name: 'Regulatory Affairs & Compliance' },
  { slug: 'technical-sales-bd', name: 'Technical Sales & Business Development' },
  { slug: 'operations-plant-management', name: 'Operations & Plant Management' },
  { slug: 'other', name: 'Other' },
] as const;

/**
 * Seeded city list. "Filter by city" is a contractual promise, and free text
 * gives you "Pune", "pune" and "Pune, MH" as three distinct filter values —
 * which also poisons Phase 2's location score.
 *
 * Weighted towards India's industrial belts rather than being a generic
 * population ranking.
 */
export const CITIES: readonly CityEntry[] = [
  // Andhra Pradesh
  { slug: 'visakhapatnam', name: 'Visakhapatnam', state: 'Andhra Pradesh' },
  { slug: 'vijayawada', name: 'Vijayawada', state: 'Andhra Pradesh' },
  { slug: 'tirupati', name: 'Tirupati', state: 'Andhra Pradesh' },
  // Assam
  { slug: 'guwahati', name: 'Guwahati', state: 'Assam' },
  // Bihar
  { slug: 'patna', name: 'Patna', state: 'Bihar' },
  // Chandigarh
  { slug: 'chandigarh', name: 'Chandigarh', state: 'Chandigarh' },
  // Chhattisgarh
  { slug: 'raipur', name: 'Raipur', state: 'Chhattisgarh' },
  { slug: 'bhilai', name: 'Bhilai', state: 'Chhattisgarh' },
  // Dadra & Nagar Haveli and Daman & Diu
  { slug: 'silvassa', name: 'Silvassa', state: 'Dadra & Nagar Haveli and Daman & Diu' },
  { slug: 'daman', name: 'Daman', state: 'Dadra & Nagar Haveli and Daman & Diu' },
  // Delhi
  { slug: 'delhi', name: 'Delhi', state: 'Delhi' },
  // Goa
  { slug: 'panaji', name: 'Panaji', state: 'Goa' },
  { slug: 'verna', name: 'Verna', state: 'Goa' },
  // Gujarat
  { slug: 'ahmedabad', name: 'Ahmedabad', state: 'Gujarat' },
  { slug: 'vadodara', name: 'Vadodara', state: 'Gujarat' },
  { slug: 'surat', name: 'Surat', state: 'Gujarat' },
  { slug: 'rajkot', name: 'Rajkot', state: 'Gujarat' },
  { slug: 'gandhinagar', name: 'Gandhinagar', state: 'Gujarat' },
  { slug: 'sanand', name: 'Sanand', state: 'Gujarat' },
  { slug: 'vapi', name: 'Vapi', state: 'Gujarat' },
  { slug: 'ankleshwar', name: 'Ankleshwar', state: 'Gujarat' },
  { slug: 'jamnagar', name: 'Jamnagar', state: 'Gujarat' },
  { slug: 'bharuch', name: 'Bharuch', state: 'Gujarat' },
  // Haryana
  { slug: 'gurugram', name: 'Gurugram', state: 'Haryana' },
  { slug: 'faridabad', name: 'Faridabad', state: 'Haryana' },
  { slug: 'manesar', name: 'Manesar', state: 'Haryana' },
  { slug: 'panipat', name: 'Panipat', state: 'Haryana' },
  // Himachal Pradesh
  { slug: 'baddi', name: 'Baddi', state: 'Himachal Pradesh' },
  // Jammu & Kashmir
  { slug: 'jammu', name: 'Jammu', state: 'Jammu & Kashmir' },
  // Jharkhand
  { slug: 'jamshedpur', name: 'Jamshedpur', state: 'Jharkhand' },
  { slug: 'ranchi', name: 'Ranchi', state: 'Jharkhand' },
  { slug: 'bokaro', name: 'Bokaro', state: 'Jharkhand' },
  // Karnataka
  { slug: 'bengaluru', name: 'Bengaluru', state: 'Karnataka' },
  { slug: 'mysuru', name: 'Mysuru', state: 'Karnataka' },
  { slug: 'mangaluru', name: 'Mangaluru', state: 'Karnataka' },
  { slug: 'hubballi', name: 'Hubballi', state: 'Karnataka' },
  { slug: 'belagavi', name: 'Belagavi', state: 'Karnataka' },
  // Kerala
  { slug: 'kochi', name: 'Kochi', state: 'Kerala' },
  { slug: 'thiruvananthapuram', name: 'Thiruvananthapuram', state: 'Kerala' },
  // Madhya Pradesh
  { slug: 'indore', name: 'Indore', state: 'Madhya Pradesh' },
  { slug: 'bhopal', name: 'Bhopal', state: 'Madhya Pradesh' },
  { slug: 'pithampur', name: 'Pithampur', state: 'Madhya Pradesh' },
  // Maharashtra
  { slug: 'pune', name: 'Pune', state: 'Maharashtra' },
  { slug: 'mumbai', name: 'Mumbai', state: 'Maharashtra' },
  { slug: 'navi-mumbai', name: 'Navi Mumbai', state: 'Maharashtra' },
  { slug: 'thane', name: 'Thane', state: 'Maharashtra' },
  { slug: 'pimpri-chinchwad', name: 'Pimpri-Chinchwad', state: 'Maharashtra' },
  { slug: 'nashik', name: 'Nashik', state: 'Maharashtra' },
  { slug: 'aurangabad', name: 'Chhatrapati Sambhajinagar (Aurangabad)', state: 'Maharashtra' },
  { slug: 'nagpur', name: 'Nagpur', state: 'Maharashtra' },
  { slug: 'kolhapur', name: 'Kolhapur', state: 'Maharashtra' },
  { slug: 'chakan', name: 'Chakan', state: 'Maharashtra' },
  // Odisha
  { slug: 'bhubaneswar', name: 'Bhubaneswar', state: 'Odisha' },
  { slug: 'rourkela', name: 'Rourkela', state: 'Odisha' },
  { slug: 'angul', name: 'Angul', state: 'Odisha' },
  // Puducherry
  { slug: 'puducherry', name: 'Puducherry', state: 'Puducherry' },
  // Punjab
  { slug: 'ludhiana', name: 'Ludhiana', state: 'Punjab' },
  { slug: 'mohali', name: 'Mohali', state: 'Punjab' },
  { slug: 'jalandhar', name: 'Jalandhar', state: 'Punjab' },
  // Rajasthan
  { slug: 'jaipur', name: 'Jaipur', state: 'Rajasthan' },
  { slug: 'bhiwadi', name: 'Bhiwadi', state: 'Rajasthan' },
  { slug: 'jodhpur', name: 'Jodhpur', state: 'Rajasthan' },
  // Tamil Nadu
  { slug: 'chennai', name: 'Chennai', state: 'Tamil Nadu' },
  { slug: 'coimbatore', name: 'Coimbatore', state: 'Tamil Nadu' },
  { slug: 'hosur', name: 'Hosur', state: 'Tamil Nadu' },
  { slug: 'sriperumbudur', name: 'Sriperumbudur', state: 'Tamil Nadu' },
  { slug: 'tiruchirappalli', name: 'Tiruchirappalli', state: 'Tamil Nadu' },
  { slug: 'salem', name: 'Salem', state: 'Tamil Nadu' },
  { slug: 'madurai', name: 'Madurai', state: 'Tamil Nadu' },
  { slug: 'tirupur', name: 'Tiruppur', state: 'Tamil Nadu' },
  // Telangana
  { slug: 'hyderabad', name: 'Hyderabad', state: 'Telangana' },
  { slug: 'sangareddy', name: 'Sangareddy', state: 'Telangana' },
  // Uttar Pradesh
  { slug: 'noida', name: 'Noida', state: 'Uttar Pradesh' },
  { slug: 'ghaziabad', name: 'Ghaziabad', state: 'Uttar Pradesh' },
  { slug: 'greater-noida', name: 'Greater Noida', state: 'Uttar Pradesh' },
  { slug: 'kanpur', name: 'Kanpur', state: 'Uttar Pradesh' },
  { slug: 'lucknow', name: 'Lucknow', state: 'Uttar Pradesh' },
  { slug: 'varanasi', name: 'Varanasi', state: 'Uttar Pradesh' },
  // Uttarakhand
  { slug: 'dehradun', name: 'Dehradun', state: 'Uttarakhand' },
  { slug: 'haridwar', name: 'Haridwar', state: 'Uttarakhand' },
  { slug: 'pantnagar', name: 'Pantnagar', state: 'Uttarakhand' },
  // West Bengal
  { slug: 'kolkata', name: 'Kolkata', state: 'West Bengal' },
  { slug: 'haldia', name: 'Haldia', state: 'West Bengal' },
  { slug: 'durgapur', name: 'Durgapur', state: 'West Bengal' },
] as const;

/**
 * "Other" is offered in every state rather than being one global entry —
 * industrial India has far more towns than any list can carry, and forcing a
 * candidate in an unlisted town to pick the wrong city would corrupt the
 * location data that Phase 2 scores on.
 */
export const OTHER_CITY_SLUG = 'other';

export function citiesInState(state: string | null | undefined): CityEntry[] {
  if (!state) return [];
  return CITIES.filter((city) => city.state === state);
}

export function stateOfCity(slug: string | null | undefined): string | null {
  if (!slug) return null;
  return CITIES.find((city) => city.slug === slug)?.state ?? null;
}

export const INDIAN_STATES: readonly string[] = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman & Nicobar Islands',
  'Chandigarh',
  'Dadra & Nagar Haveli and Daman & Diu',
  'Delhi',
  'Jammu & Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
] as const;

/**
 * Characters that carry meaning in a skill name and must survive slugging.
 *
 * Stripping everything non-alphanumeric merged P&ID (piping and
 * instrumentation diagrams) with PID (proportional-integral-derivative
 * control) — two unrelated competencies in this client's sectors — and did the
 * same to C++/C and GD&T/GDT.
 */
const MEANINGFUL_SYMBOLS: Record<string, string> = {
  '&': 'and',
  '+': 'plus',
  '#': 'sharp',
};

/**
 * Skill slug normalisation.
 *
 * Collapses spacing and punctuation so "Auto CAD", "AutoCAD" and "auto-cad"
 * converge, while keeping the symbols above as words so distinct terms stay
 * distinct.
 *
 * Non-Latin names are preserved rather than dropped. Previously every name
 * written in Devanagari, Tamil or emoji normalised to the empty string, so they
 * all collided on ONE shared row and inherited whichever name was created
 * first — a candidate typing a Hindi skill got someone else's text on their
 * profile. Phase 2 scores this table for 35 of 100 points.
 */
export function normaliseSkillSlug(raw: string): string {
  const expanded = raw
    .toLowerCase()
    .replace(/[&+#]/g, (ch) => `-${MEANINGFUL_SYMBOLS[ch]}-`)
    // Compatibility-decompose so accented Latin folds to its base letter.
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');

  // Keep any letter or digit in any script, plus the expansion separators.
  const slug = expanded
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');

  return slug;
}

/**
 * True when a name carries no letters or digits at all (pure punctuation or
 * emoji). Such a name has no usable slug and is rejected rather than collapsed
 * onto a shared row.
 */
export function isUnusableSkillName(raw: string): boolean {
  return normaliseSkillSlug(raw).length === 0;
}

export function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
