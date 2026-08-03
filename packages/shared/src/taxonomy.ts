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
export const CITIES: readonly TaxonomyEntry[] = [
  { slug: 'ahmedabad', name: 'Ahmedabad' },
  { slug: 'aurangabad', name: 'Chhatrapati Sambhajinagar (Aurangabad)' },
  { slug: 'bengaluru', name: 'Bengaluru' },
  { slug: 'bhopal', name: 'Bhopal' },
  { slug: 'bhubaneswar', name: 'Bhubaneswar' },
  { slug: 'chandigarh', name: 'Chandigarh' },
  { slug: 'chennai', name: 'Chennai' },
  { slug: 'coimbatore', name: 'Coimbatore' },
  { slug: 'dehradun', name: 'Dehradun' },
  { slug: 'delhi', name: 'Delhi' },
  { slug: 'faridabad', name: 'Faridabad' },
  { slug: 'gandhinagar', name: 'Gandhinagar' },
  { slug: 'ghaziabad', name: 'Ghaziabad' },
  { slug: 'goa', name: 'Goa' },
  { slug: 'gurugram', name: 'Gurugram' },
  { slug: 'guwahati', name: 'Guwahati' },
  { slug: 'hosur', name: 'Hosur' },
  { slug: 'hyderabad', name: 'Hyderabad' },
  { slug: 'indore', name: 'Indore' },
  { slug: 'jaipur', name: 'Jaipur' },
  { slug: 'jamshedpur', name: 'Jamshedpur' },
  { slug: 'kanpur', name: 'Kanpur' },
  { slug: 'kochi', name: 'Kochi' },
  { slug: 'kolhapur', name: 'Kolhapur' },
  { slug: 'kolkata', name: 'Kolkata' },
  { slug: 'lucknow', name: 'Lucknow' },
  { slug: 'ludhiana', name: 'Ludhiana' },
  { slug: 'madurai', name: 'Madurai' },
  { slug: 'mangaluru', name: 'Mangaluru' },
  { slug: 'mumbai', name: 'Mumbai' },
  { slug: 'mysuru', name: 'Mysuru' },
  { slug: 'nagpur', name: 'Nagpur' },
  { slug: 'nashik', name: 'Nashik' },
  { slug: 'navi-mumbai', name: 'Navi Mumbai' },
  { slug: 'noida', name: 'Noida' },
  { slug: 'patna', name: 'Patna' },
  { slug: 'pimpri-chinchwad', name: 'Pimpri-Chinchwad' },
  { slug: 'pune', name: 'Pune' },
  { slug: 'raipur', name: 'Raipur' },
  { slug: 'rajkot', name: 'Rajkot' },
  { slug: 'ranchi', name: 'Ranchi' },
  { slug: 'rourkela', name: 'Rourkela' },
  { slug: 'salem', name: 'Salem' },
  { slug: 'sanand', name: 'Sanand' },
  { slug: 'silvassa', name: 'Silvassa' },
  { slug: 'sriperumbudur', name: 'Sriperumbudur' },
  { slug: 'surat', name: 'Surat' },
  { slug: 'thane', name: 'Thane' },
  { slug: 'tiruchirappalli', name: 'Tiruchirappalli' },
  { slug: 'tirupur', name: 'Tiruppur' },
  { slug: 'vadodara', name: 'Vadodara' },
  { slug: 'vapi', name: 'Vapi' },
  { slug: 'varanasi', name: 'Varanasi' },
  { slug: 'vijayawada', name: 'Vijayawada' },
  { slug: 'visakhapatnam', name: 'Visakhapatnam' },
  { slug: 'other', name: 'Other' },
] as const;

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
 * Skill slug normalisation.
 *
 * Strips every non-alphanumeric character so "Auto CAD", "AutoCAD" and
 * "auto-cad" all converge on "autocad". This deliberately accepts a false-merge
 * risk in exchange for not fragmenting the taxonomy that Phase 2's matcher
 * scores 35/100 points against. The seeded starter list keeps common skills
 * from ever being auto-created, and the admin merge tool handles the rest.
 */
export function normaliseSkillSlug(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
