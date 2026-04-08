# HouseHunter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished browser-based real estate comparison tool that stores listings in Supabase and displays them in an editable, sortable table with a detail panel.

**Architecture:** Next.js web app with Tailwind CSS for styling, Supabase (PostgreSQL) for data persistence, and client-side JavaScript for financial calculations. Data extraction happens outside the app via Claude-in-Chrome MCP — the web app is a CRUD dashboard that reads/writes listings to Supabase.

**Tech Stack:** Next.js 14 (App Router), Tailwind CSS, Supabase JS client, TypeScript, Vitest (testing)

---

## File Structure

```
househunter/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout with font + metadata
│   │   ├── page.tsx                # Main page — assembles TopBar + Table + DetailPanel
│   │   └── globals.css             # Tailwind directives + custom CSS variables
│   ├── components/
│   │   ├── TopBar.tsx              # URL input field, extraction status, export button
│   │   ├── ListingsTable.tsx       # Sortable, filterable table with sticky header
│   │   ├── TableHeader.tsx         # Column headers with sort indicators
│   │   ├── TableRow.tsx            # Single listing row with inline editing + flags
│   │   ├── EditableCell.tsx        # Click-to-edit cell component
│   │   ├── DetailPanel.tsx         # Slide-out right panel with full listing details
│   │   ├── FilterBar.tsx           # Filter controls (type, price range, status)
│   │   └── StatusBadge.tsx         # Small status indicator (complete/partial/error)
│   ├── lib/
│   │   ├── supabase.ts            # Supabase client initialization
│   │   ├── calculations.ts        # Mortgage, downpayment, $/sqft, total monthly cost
│   │   ├── formatting.ts          # Currency formatting, commute time formatting
│   │   ├── columns.ts             # Column definitions — single source of truth for field config
│   │   ├── flags.ts               # Auto-flag logic (high fees, non-standard foundation/water)
│   │   └── csv-export.ts          # Export listings to CSV
│   ├── hooks/
│   │   ├── useListings.ts         # Fetch, create, update, delete listings from Supabase
│   │   └── useSort.ts             # Column sorting state management
│   └── types/
│       └── listing.ts             # TypeScript type for a listing row
├── tests/
│   ├── calculations.test.ts       # Tests for mortgage, downpayment, $/sqft
│   ├── formatting.test.ts         # Tests for currency and time formatting
│   ├── flags.test.ts              # Tests for auto-flag logic
│   └── csv-export.test.ts         # Tests for CSV export
├── .env.local                      # Supabase URL + anon key (not committed)
├── .env.example                    # Template showing required env vars
├── .gitignore
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.js
└── vitest.config.ts
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `vitest.config.ts`, `.gitignore`, `.env.example`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`

- [ ] **Step 1: Create Next.js project with Tailwind**

Run from `C:\Users\patri\HouseHunter`:
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

When prompted, accept all defaults. This creates the full Next.js project in the current directory.

- [ ] **Step 2: Install additional dependencies**

```bash
npm install @supabase/supabase-js
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 3: Create Vitest config**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 4: Add test script to package.json**

Add to the `"scripts"` section of `package.json`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Create environment variable template**

Create `.env.example`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

- [ ] **Step 6: Update .gitignore**

Append to `.gitignore`:
```
.env.local
.superpowers/
```

- [ ] **Step 7: Verify project runs**

```bash
npm run dev
```
Expected: Server starts at http://localhost:3000, default Next.js page loads.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with Tailwind, Supabase, and Vitest"
```

---

## Task 2: Supabase Database Setup

**Files:**
- Create: `.env.local`, `src/lib/supabase.ts`

- [ ] **Step 1: Create Supabase table**

Using the Supabase MCP `execute_sql` tool, run this SQL against the user's Supabase project:

```sql
CREATE TABLE listings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  link TEXT,
  location TEXT,
  full_address TEXT,
  mls_number TEXT,
  property_type TEXT,
  price INTEGER,
  taxes_yearly INTEGER,
  common_fees_yearly INTEGER,
  bedrooms TEXT,
  liveable_area_sqft INTEGER,
  price_per_sqft INTEGER,
  parking TEXT,
  storey TEXT,
  year_built INTEGER,
  downpayment INTEGER,
  monthly_mortgage INTEGER,
  total_monthly_cost INTEGER,
  commute_school_car TEXT,
  commute_pvm_transit TEXT,
  notes TEXT,
  personal_rating TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

- [ ] **Step 2: Create updated_at trigger**

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER listings_updated_at
  BEFORE UPDATE ON listings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

- [ ] **Step 3: Enable Row Level Security with open access**

For now, allow all operations (this is a personal tool, not multi-user):

```sql
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations" ON listings
  FOR ALL
  USING (true)
  WITH CHECK (true);
```

- [ ] **Step 4: Get Supabase credentials**

Using the Supabase MCP `get_project` tool, retrieve the project URL and anon key. Then create `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<actual-project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<actual-anon-key>
```

- [ ] **Step 5: Create Supabase client**

Create `src/lib/supabase.ts`:
```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

- [ ] **Step 6: Verify connection**

Add a temporary test in `src/app/page.tsx` that fetches from the listings table and logs the result. Confirm empty array is returned (no errors).

- [ ] **Step 7: Commit**

```bash
git add src/lib/supabase.ts .env.example
git commit -m "feat: set up Supabase database schema and client"
```

Note: `.env.local` is gitignored and will NOT be committed (it contains secret keys).

---

## Task 3: TypeScript Types and Column Configuration

**Files:**
- Create: `src/types/listing.ts`, `src/lib/columns.ts`

- [ ] **Step 1: Define listing type**

Create `src/types/listing.ts`:
```typescript
export interface Listing {
  id: string
  link: string | null
  location: string | null
  full_address: string | null
  mls_number: string | null
  property_type: string | null
  price: number | null
  taxes_yearly: number | null
  common_fees_yearly: number | null
  bedrooms: string | null
  liveable_area_sqft: number | null
  price_per_sqft: number | null
  parking: string | null
  storey: string | null
  year_built: number | null
  downpayment: number | null
  monthly_mortgage: number | null
  total_monthly_cost: number | null
  commute_school_car: string | null
  commute_pvm_transit: string | null
  notes: string | null
  personal_rating: string | null
  status: string | null
  created_at: string
  updated_at: string
}
```

- [ ] **Step 2: Define column configuration**

Create `src/lib/columns.ts`. This is the single source of truth for which fields appear in the table, their labels, formatting, and editability. Adding a new field later means adding one entry here.

```typescript
export type ColumnAlign = 'left' | 'right'
export type ColumnFormat = 'text' | 'currency' | 'integer' | 'link'

export interface ColumnDef {
  key: string
  label: string
  align: ColumnAlign
  format: ColumnFormat
  editable: boolean
  showInTable: boolean
  showInDetail: boolean
  width?: string
}

export const columns: ColumnDef[] = [
  { key: 'location', label: 'Location', align: 'left', format: 'text', editable: true, showInTable: true, showInDetail: true, width: '140px' },
  { key: 'property_type', label: 'Type', align: 'left', format: 'text', editable: true, showInTable: true, showInDetail: true, width: '90px' },
  { key: 'price', label: 'Price', align: 'right', format: 'currency', editable: true, showInTable: true, showInDetail: true, width: '120px' },
  { key: 'taxes_yearly', label: 'Taxes/yr', align: 'right', format: 'currency', editable: true, showInTable: true, showInDetail: true, width: '100px' },
  { key: 'common_fees_yearly', label: 'Fees/yr', align: 'right', format: 'currency', editable: true, showInTable: true, showInDetail: true, width: '100px' },
  { key: 'bedrooms', label: 'Beds', align: 'left', format: 'text', editable: true, showInTable: true, showInDetail: true, width: '60px' },
  { key: 'liveable_area_sqft', label: 'Area (sqft)', align: 'right', format: 'integer', editable: true, showInTable: true, showInDetail: true, width: '100px' },
  { key: 'price_per_sqft', label: '$/sqft', align: 'right', format: 'currency', editable: false, showInTable: true, showInDetail: true, width: '80px' },
  { key: 'parking', label: 'Parking', align: 'left', format: 'text', editable: true, showInTable: false, showInDetail: true },
  { key: 'storey', label: 'Storey', align: 'left', format: 'text', editable: true, showInTable: false, showInDetail: true },
  { key: 'year_built', label: 'Year Built', align: 'right', format: 'integer', editable: true, showInTable: true, showInDetail: true, width: '80px' },
  { key: 'downpayment', label: 'Down', align: 'right', format: 'currency', editable: false, showInTable: false, showInDetail: true },
  { key: 'monthly_mortgage', label: 'Mortgage/mo', align: 'right', format: 'currency', editable: false, showInTable: true, showInDetail: true, width: '110px' },
  { key: 'total_monthly_cost', label: 'Total/mo', align: 'right', format: 'currency', editable: false, showInTable: true, showInDetail: true, width: '100px' },
  { key: 'commute_school_car', label: 'School', align: 'right', format: 'text', editable: true, showInTable: true, showInDetail: true, width: '70px' },
  { key: 'commute_pvm_transit', label: 'PVM', align: 'right', format: 'text', editable: true, showInTable: true, showInDetail: true, width: '70px' },
  { key: 'personal_rating', label: 'Rating', align: 'left', format: 'text', editable: true, showInTable: true, showInDetail: true, width: '80px' },
  { key: 'notes', label: 'Notes', align: 'left', format: 'text', editable: true, showInTable: false, showInDetail: true },
  { key: 'link', label: 'Link', align: 'left', format: 'link', editable: false, showInTable: false, showInDetail: true },
  { key: 'full_address', label: 'Full Address', align: 'left', format: 'text', editable: true, showInTable: false, showInDetail: true },
  { key: 'mls_number', label: 'MLS #', align: 'left', format: 'text', editable: false, showInTable: false, showInDetail: true },
  { key: 'status', label: 'Status', align: 'left', format: 'text', editable: false, showInTable: true, showInDetail: true, width: '80px' },
]

export const tableColumns = columns.filter(c => c.showInTable)
export const detailColumns = columns.filter(c => c.showInDetail)
```

- [ ] **Step 3: Commit**

```bash
git add src/types/listing.ts src/lib/columns.ts
git commit -m "feat: add listing types and column configuration"
```

---

## Task 4: Calculation Utilities (TDD)

**Files:**
- Create: `src/lib/calculations.ts`, `tests/calculations.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/calculations.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import {
  calculateDownpayment,
  calculateMonthlyMortgage,
  calculateTotalMonthlyCost,
  calculatePricePerSqft,
  recalculateListing,
} from '@/lib/calculations'

describe('calculateDownpayment', () => {
  it('returns 20% of price, rounded', () => {
    expect(calculateDownpayment(500000)).toBe(100000)
  })

  it('rounds to nearest dollar', () => {
    expect(calculateDownpayment(333333)).toBe(66667)
  })

  it('returns null if price is null', () => {
    expect(calculateDownpayment(null)).toBeNull()
  })
})

describe('calculateMonthlyMortgage', () => {
  it('calculates standard amortization at 3.99% over 25 years', () => {
    // $500,000 price → $400,000 principal → ~$2,106/mo
    const result = calculateMonthlyMortgage(500000)
    expect(result).toBe(2106)
  })

  it('returns null if price is null', () => {
    expect(calculateMonthlyMortgage(null)).toBeNull()
  })

  it('handles small prices', () => {
    const result = calculateMonthlyMortgage(100000)
    expect(result).toBe(421)
  })
})

describe('calculateTotalMonthlyCost', () => {
  it('sums mortgage + monthly taxes + monthly fees', () => {
    // mortgage ~$2,106 + taxes $4,000/12=$333 + fees $3,600/12=$300 = $2,739
    const result = calculateTotalMonthlyCost(2106, 4000, 3600)
    expect(result).toBe(2739)
  })

  it('handles null taxes and fees', () => {
    const result = calculateTotalMonthlyCost(2106, null, null)
    expect(result).toBe(2106)
  })

  it('returns null if mortgage is null', () => {
    expect(calculateTotalMonthlyCost(null, 4000, 3600)).toBeNull()
  })
})

describe('calculatePricePerSqft', () => {
  it('divides price by area, rounded', () => {
    expect(calculatePricePerSqft(500000, 1200)).toBe(417)
  })

  it('returns null if area is null', () => {
    expect(calculatePricePerSqft(500000, null)).toBeNull()
  })

  it('returns null if area is 0', () => {
    expect(calculatePricePerSqft(500000, 0)).toBeNull()
  })

  it('returns null if price is null', () => {
    expect(calculatePricePerSqft(null, 1200)).toBeNull()
  })
})

describe('recalculateListing', () => {
  it('fills all calculated fields from price, taxes, fees, area', () => {
    const result = recalculateListing({
      price: 500000,
      taxes_yearly: 4000,
      common_fees_yearly: 3600,
      liveable_area_sqft: 1200,
    })
    expect(result.downpayment).toBe(100000)
    expect(result.monthly_mortgage).toBe(2106)
    expect(result.total_monthly_cost).toBe(2739)
    expect(result.price_per_sqft).toBe(417)
  })

  it('handles missing optional fields', () => {
    const result = recalculateListing({
      price: 300000,
      taxes_yearly: null,
      common_fees_yearly: null,
      liveable_area_sqft: null,
    })
    expect(result.downpayment).toBe(60000)
    expect(result.monthly_mortgage).toBe(1264)
    expect(result.total_monthly_cost).toBe(1264)
    expect(result.price_per_sqft).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```
Expected: All tests FAIL (module not found).

- [ ] **Step 3: Implement calculations**

Create `src/lib/calculations.ts`:
```typescript
const DOWNPAYMENT_RATE = 0.20
const ANNUAL_INTEREST_RATE = 0.0399
const MONTHLY_INTEREST_RATE = ANNUAL_INTEREST_RATE / 12
const AMORTIZATION_MONTHS = 25 * 12

export function calculateDownpayment(price: number | null): number | null {
  if (price === null) return null
  return Math.round(price * DOWNPAYMENT_RATE)
}

export function calculateMonthlyMortgage(price: number | null): number | null {
  if (price === null) return null
  const principal = price * (1 - DOWNPAYMENT_RATE)
  const r = MONTHLY_INTEREST_RATE
  const n = AMORTIZATION_MONTHS
  const payment = principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
  return Math.round(payment)
}

export function calculateTotalMonthlyCost(
  monthlyMortgage: number | null,
  taxesYearly: number | null,
  commonFeesYearly: number | null
): number | null {
  if (monthlyMortgage === null) return null
  const monthlyTaxes = taxesYearly ? Math.round(taxesYearly / 12) : 0
  const monthlyFees = commonFeesYearly ? Math.round(commonFeesYearly / 12) : 0
  return monthlyMortgage + monthlyTaxes + monthlyFees
}

export function calculatePricePerSqft(
  price: number | null,
  area: number | null
): number | null {
  if (price === null || area === null || area === 0) return null
  return Math.round(price / area)
}

export interface RecalculateInput {
  price: number | null
  taxes_yearly: number | null
  common_fees_yearly: number | null
  liveable_area_sqft: number | null
}

export interface RecalculateOutput {
  downpayment: number | null
  monthly_mortgage: number | null
  total_monthly_cost: number | null
  price_per_sqft: number | null
}

export function recalculateListing(input: RecalculateInput): RecalculateOutput {
  const downpayment = calculateDownpayment(input.price)
  const monthly_mortgage = calculateMonthlyMortgage(input.price)
  const total_monthly_cost = calculateTotalMonthlyCost(
    monthly_mortgage,
    input.taxes_yearly,
    input.common_fees_yearly
  )
  const price_per_sqft = calculatePricePerSqft(input.price, input.liveable_area_sqft)
  return { downpayment, monthly_mortgage, total_monthly_cost, price_per_sqft }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calculations.ts tests/calculations.test.ts
git commit -m "feat: add mortgage and financial calculation utilities with tests"
```

---

## Task 5: Formatting Utilities (TDD)

**Files:**
- Create: `src/lib/formatting.ts`, `tests/formatting.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/formatting.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { formatCurrency, formatInteger, formatCellValue } from '@/lib/formatting'

describe('formatCurrency', () => {
  it('formats with dollar sign and commas', () => {
    expect(formatCurrency(500000)).toBe('$500,000')
  })

  it('formats large numbers', () => {
    expect(formatCurrency(1250000)).toBe('$1,250,000')
  })

  it('returns em dash for null', () => {
    expect(formatCurrency(null)).toBe('—')
  })

  it('formats small numbers', () => {
    expect(formatCurrency(750)).toBe('$750')
  })
})

describe('formatInteger', () => {
  it('formats with commas', () => {
    expect(formatInteger(1200)).toBe('1,200')
  })

  it('returns em dash for null', () => {
    expect(formatInteger(null)).toBe('—')
  })
})

describe('formatCellValue', () => {
  it('formats currency columns', () => {
    expect(formatCellValue(500000, 'currency')).toBe('$500,000')
  })

  it('formats integer columns', () => {
    expect(formatCellValue(1200, 'integer')).toBe('1,200')
  })

  it('formats text columns', () => {
    expect(formatCellValue('Laval', 'text')).toBe('Laval')
  })

  it('returns em dash for null text', () => {
    expect(formatCellValue(null, 'text')).toBe('—')
  })

  it('formats link columns as URL text', () => {
    expect(formatCellValue('https://centris.ca/123', 'link')).toBe('https://centris.ca/123')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```
Expected: FAIL (module not found).

- [ ] **Step 3: Implement formatting**

Create `src/lib/formatting.ts`:
```typescript
import type { ColumnFormat } from './columns'

const EM_DASH = '—'

export function formatCurrency(value: number | null): string {
  if (value === null) return EM_DASH
  return '$' + value.toLocaleString('en-CA', { maximumFractionDigits: 0 })
}

export function formatInteger(value: number | null): string {
  if (value === null) return EM_DASH
  return value.toLocaleString('en-CA', { maximumFractionDigits: 0 })
}

export function formatCellValue(value: unknown, format: ColumnFormat): string {
  if (value === null || value === undefined) return EM_DASH
  switch (format) {
    case 'currency':
      return formatCurrency(value as number)
    case 'integer':
      return formatInteger(value as number)
    case 'link':
    case 'text':
      return String(value)
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/formatting.ts tests/formatting.test.ts
git commit -m "feat: add currency and cell formatting utilities with tests"
```

---

## Task 6: Auto-Flag Logic (TDD)

**Files:**
- Create: `src/lib/flags.ts`, `tests/flags.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/flags.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { generateFlags, hasHighFees, hasNonStandardFoundation, hasNonStandardWater } from '@/lib/flags'

describe('hasHighFees', () => {
  it('returns true if yearly fees > $6,000 (i.e. >$500/mo)', () => {
    expect(hasHighFees(7200)).toBe(true)
  })

  it('returns false if yearly fees <= $6,000', () => {
    expect(hasHighFees(6000)).toBe(false)
  })

  it('returns false if null', () => {
    expect(hasHighFees(null)).toBe(false)
  })
})

describe('hasNonStandardFoundation', () => {
  it('detects stone foundation', () => {
    expect(hasNonStandardFoundation('Stone foundation, 2 storey')).toBe(true)
  })

  it('detects block foundation', () => {
    expect(hasNonStandardFoundation('Concrete block')).toBe(true)
  })

  it('returns false for concrete (poured)', () => {
    expect(hasNonStandardFoundation('Poured concrete')).toBe(false)
  })

  it('returns false for null', () => {
    expect(hasNonStandardFoundation(null)).toBe(false)
  })
})

describe('hasNonStandardWater', () => {
  it('detects well water', () => {
    expect(hasNonStandardWater('Well')).toBe(true)
  })

  it('detects septic system', () => {
    expect(hasNonStandardWater('Septic tank')).toBe(true)
  })

  it('returns false for municipal', () => {
    expect(hasNonStandardWater('Municipal water and sewer')).toBe(false)
  })

  it('returns false for null', () => {
    expect(hasNonStandardWater(null)).toBe(false)
  })
})

describe('generateFlags', () => {
  it('generates combined flag text', () => {
    const flags = generateFlags({
      common_fees_yearly: 7200,
      foundation: 'Stone',
      water_sewer: 'Well and septic',
    })
    expect(flags).toContain('High condo fees')
    expect(flags).toContain('foundation')
    expect(flags).toContain('water')
  })

  it('returns empty string when no flags', () => {
    const flags = generateFlags({
      common_fees_yearly: 3600,
      foundation: 'Poured concrete',
      water_sewer: 'Municipal',
    })
    expect(flags).toBe('')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```
Expected: FAIL.

- [ ] **Step 3: Implement flag logic**

Create `src/lib/flags.ts`:
```typescript
const HIGH_FEE_YEARLY_THRESHOLD = 6000 // $500/month × 12

const NON_STANDARD_FOUNDATION_KEYWORDS = [
  'stone', 'block', 'brick', 'wood', 'pile', 'pier',
]

const NON_STANDARD_WATER_KEYWORDS = [
  'well', 'septic', 'cistern', 'holding tank', 'private',
]

export function hasHighFees(commonFeesYearly: number | null): boolean {
  if (commonFeesYearly === null) return false
  return commonFeesYearly > HIGH_FEE_YEARLY_THRESHOLD
}

export function hasNonStandardFoundation(foundationText: string | null): boolean {
  if (!foundationText) return false
  const lower = foundationText.toLowerCase()
  // "concrete block" is non-standard, but "poured concrete" or just "concrete" is standard
  if (lower.includes('block')) return true
  if (lower.includes('concrete') && !lower.includes('block')) return false
  return NON_STANDARD_FOUNDATION_KEYWORDS.some(kw => lower.includes(kw))
}

export function hasNonStandardWater(waterSewerText: string | null): boolean {
  if (!waterSewerText) return false
  const lower = waterSewerText.toLowerCase()
  if (lower.includes('municipal')) return false
  return NON_STANDARD_WATER_KEYWORDS.some(kw => lower.includes(kw))
}

export interface FlagInput {
  common_fees_yearly: number | null
  foundation: string | null
  water_sewer: string | null
}

export function generateFlags(input: FlagInput): string {
  const flags: string[] = []

  if (hasHighFees(input.common_fees_yearly)) {
    const monthly = Math.round((input.common_fees_yearly ?? 0) / 12)
    flags.push(`High condo fees ($${monthly}/mo)`)
  }

  if (hasNonStandardFoundation(input.foundation)) {
    flags.push(`Non-standard foundation: ${input.foundation}`)
  }

  if (hasNonStandardWater(input.water_sewer)) {
    flags.push(`Non-standard water/sewer: ${input.water_sewer}`)
  }

  return flags.join(' | ')
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/flags.ts tests/flags.test.ts
git commit -m "feat: add auto-flag logic for high fees, foundation, and water system"
```

---

## Task 7: CSV Export (TDD)

**Files:**
- Create: `src/lib/csv-export.ts`, `tests/csv-export.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/csv-export.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { listingsToCSV } from '@/lib/csv-export'
import type { Listing } from '@/types/listing'

describe('listingsToCSV', () => {
  it('generates CSV header row', () => {
    const csv = listingsToCSV([])
    const firstLine = csv.split('\n')[0]
    expect(firstLine).toContain('Location')
    expect(firstLine).toContain('Price')
    expect(firstLine).toContain('MLS #')
  })

  it('generates data rows with proper escaping', () => {
    const listing: Partial<Listing> = {
      id: '1',
      location: 'Laval',
      price: 500000,
      mls_number: '12345678',
      notes: 'Has "nice" view, big yard',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }
    const csv = listingsToCSV([listing as Listing])
    const lines = csv.split('\n')
    expect(lines.length).toBe(2) // header + 1 data row
    // Quotes in notes should be escaped
    expect(lines[1]).toContain('"Has ""nice"" view, big yard"')
  })

  it('handles null values as empty strings', () => {
    const listing: Partial<Listing> = {
      id: '1',
      location: null,
      price: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }
    const csv = listingsToCSV([listing as Listing])
    expect(csv).toContain(',,')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```
Expected: FAIL.

- [ ] **Step 3: Implement CSV export**

Create `src/lib/csv-export.ts`:
```typescript
import type { Listing } from '@/types/listing'

const CSV_COLUMNS: { key: keyof Listing; label: string }[] = [
  { key: 'location', label: 'Location' },
  { key: 'full_address', label: 'Full Address' },
  { key: 'mls_number', label: 'MLS #' },
  { key: 'property_type', label: 'Type' },
  { key: 'price', label: 'Price' },
  { key: 'taxes_yearly', label: 'Taxes (yearly)' },
  { key: 'common_fees_yearly', label: 'Common Fees (yearly)' },
  { key: 'bedrooms', label: 'Bedrooms' },
  { key: 'liveable_area_sqft', label: 'Area (sqft)' },
  { key: 'price_per_sqft', label: '$/sqft' },
  { key: 'parking', label: 'Parking' },
  { key: 'storey', label: 'Storey' },
  { key: 'year_built', label: 'Year Built' },
  { key: 'downpayment', label: 'Downpayment' },
  { key: 'monthly_mortgage', label: 'Monthly Mortgage' },
  { key: 'total_monthly_cost', label: 'Total Monthly Cost' },
  { key: 'commute_school_car', label: 'Commute to School (car)' },
  { key: 'commute_pvm_transit', label: 'Commute to PVM (transit)' },
  { key: 'personal_rating', label: 'Rating' },
  { key: 'notes', label: 'Notes' },
  { key: 'link', label: 'Link' },
  { key: 'status', label: 'Status' },
]

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

export function listingsToCSV(listings: Listing[]): string {
  const header = CSV_COLUMNS.map(c => c.label).join(',')
  const rows = listings.map(listing =>
    CSV_COLUMNS.map(c => escapeCSV(listing[c.key])).join(',')
  )
  return [header, ...rows].join('\n')
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/csv-export.ts tests/csv-export.test.ts
git commit -m "feat: add CSV export utility with tests"
```

---

## Task 8: Supabase Data Hook

**Files:**
- Create: `src/hooks/useListings.ts`

- [ ] **Step 1: Create the hook**

Create `src/hooks/useListings.ts`:
```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { recalculateListing } from '@/lib/calculations'
import type { Listing } from '@/types/listing'

export function useListings() {
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchListings = useCallback(async () => {
    setLoading(true)
    const { data, error: fetchError } = await supabase
      .from('listings')
      .select('*')
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setListings(data ?? [])
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchListings()
  }, [fetchListings])

  const updateListing = async (id: string, field: string, value: unknown) => {
    const updates: Record<string, unknown> = { [field]: value }

    // Recalculate derived fields if a source field changed
    const recalcFields = ['price', 'taxes_yearly', 'common_fees_yearly', 'liveable_area_sqft']
    if (recalcFields.includes(field)) {
      const current = listings.find(l => l.id === id)
      if (current) {
        const input = {
          price: field === 'price' ? (value as number) : current.price,
          taxes_yearly: field === 'taxes_yearly' ? (value as number) : current.taxes_yearly,
          common_fees_yearly: field === 'common_fees_yearly' ? (value as number) : current.common_fees_yearly,
          liveable_area_sqft: field === 'liveable_area_sqft' ? (value as number) : current.liveable_area_sqft,
        }
        const calculated = recalculateListing(input)
        Object.assign(updates, calculated)
      }
    }

    const { error: updateError } = await supabase
      .from('listings')
      .update(updates)
      .eq('id', id)

    if (updateError) {
      setError(updateError.message)
      return false
    }

    // Update local state
    setListings(prev =>
      prev.map(l => (l.id === id ? { ...l, ...updates } as Listing : l))
    )
    return true
  }

  const deleteListing = async (id: string) => {
    const { error: deleteError } = await supabase
      .from('listings')
      .delete()
      .eq('id', id)

    if (deleteError) {
      setError(deleteError.message)
      return false
    }

    setListings(prev => prev.filter(l => l.id !== id))
    return true
  }

  return { listings, loading, error, fetchListings, updateListing, deleteListing }
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useListings.ts
git commit -m "feat: add useListings hook for Supabase CRUD with auto-recalculation"
```

---

## Task 9: Sort Hook

**Files:**
- Create: `src/hooks/useSort.ts`

- [ ] **Step 1: Create the sort hook**

Create `src/hooks/useSort.ts`:
```typescript
'use client'

import { useState, useMemo } from 'react'
import type { Listing } from '@/types/listing'

export type SortDirection = 'asc' | 'desc' | null

export interface SortState {
  column: string | null
  direction: SortDirection
}

export function useSort(listings: Listing[]) {
  const [sort, setSort] = useState<SortState>({ column: null, direction: null })

  const toggleSort = (column: string) => {
    setSort(prev => {
      if (prev.column !== column) return { column, direction: 'asc' }
      if (prev.direction === 'asc') return { column, direction: 'desc' }
      return { column: null, direction: null }
    })
  }

  const sorted = useMemo(() => {
    if (!sort.column || !sort.direction) return listings

    return [...listings].sort((a, b) => {
      const aVal = a[sort.column as keyof Listing]
      const bVal = b[sort.column as keyof Listing]

      if (aVal === null || aVal === undefined) return 1
      if (bVal === null || bVal === undefined) return -1

      let comparison = 0
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal
      } else {
        comparison = String(aVal).localeCompare(String(bVal))
      }

      return sort.direction === 'desc' ? -comparison : comparison
    })
  }, [listings, sort])

  return { sorted, sort, toggleSort }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useSort.ts
git commit -m "feat: add useSort hook for column sorting"
```

---

## Task 10: StatusBadge Component

**Files:**
- Create: `src/components/StatusBadge.tsx`

- [ ] **Step 1: Create component**

Create `src/components/StatusBadge.tsx`:
```tsx
interface StatusBadgeProps {
  status: string | null
}

export function StatusBadge({ status }: StatusBadgeProps) {
  if (!status) return <span className="text-slate-400">—</span>

  const styles: Record<string, string> = {
    complete: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    partial: 'bg-amber-50 text-amber-700 border-amber-200',
    pending: 'bg-slate-50 text-slate-500 border-slate-200',
    error: 'bg-red-50 text-red-700 border-red-200',
  }

  const style = styles[status] ?? styles.pending

  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border ${style}`}>
      {status}
    </span>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/StatusBadge.tsx
git commit -m "feat: add StatusBadge component"
```

---

## Task 11: EditableCell Component

**Files:**
- Create: `src/components/EditableCell.tsx`

- [ ] **Step 1: Create component**

Create `src/components/EditableCell.tsx`:
```tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import type { ColumnFormat } from '@/lib/columns'
import { formatCellValue } from '@/lib/formatting'

interface EditableCellProps {
  value: unknown
  format: ColumnFormat
  editable: boolean
  align: 'left' | 'right'
  onSave: (newValue: string | number | null) => void
}

export function EditableCell({ value, format, editable, align, onSave }: EditableCellProps) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const handleClick = () => {
    if (!editable) return
    setEditValue(value === null || value === undefined ? '' : String(value))
    setEditing(true)
  }

  const handleSave = () => {
    setEditing(false)
    const trimmed = editValue.trim()

    if (trimmed === '') {
      onSave(null)
      return
    }

    if (format === 'currency' || format === 'integer') {
      const numeric = Number(trimmed.replace(/[$,\s]/g, ''))
      if (!isNaN(numeric)) {
        onSave(Math.round(numeric))
        return
      }
    }

    onSave(trimmed)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') setEditing(false)
  }

  const alignClass = align === 'right' ? 'text-right' : 'text-left'

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={e => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className={`w-full px-2 py-1 text-sm border border-blue-400 rounded outline-none bg-white ${alignClass}`}
      />
    )
  }

  const displayValue = formatCellValue(value, format)
  const cursorClass = editable ? 'cursor-pointer hover:bg-blue-50 rounded px-1 -mx-1 transition-colors' : ''

  return (
    <span
      onClick={handleClick}
      className={`block truncate ${alignClass} ${cursorClass}`}
      title={editable ? 'Click to edit' : undefined}
    >
      {displayValue}
    </span>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/EditableCell.tsx
git commit -m "feat: add EditableCell component with click-to-edit and formatting"
```

---

## Task 12: TableHeader Component

**Files:**
- Create: `src/components/TableHeader.tsx`

- [ ] **Step 1: Create component**

Create `src/components/TableHeader.tsx`:
```tsx
import { tableColumns } from '@/lib/columns'
import type { SortState } from '@/hooks/useSort'

interface TableHeaderProps {
  sort: SortState
  onSort: (column: string) => void
}

export function TableHeader({ sort, onSort }: TableHeaderProps) {
  return (
    <thead>
      <tr className="border-b border-slate-200">
        {tableColumns.map(col => {
          const isSorted = sort.column === col.key
          const arrow = isSorted
            ? sort.direction === 'asc' ? ' ↑' : ' ↓'
            : ''

          return (
            <th
              key={col.key}
              onClick={() => onSort(col.key)}
              className={`
                sticky top-0 z-10 bg-slate-50 px-3 py-2.5
                text-xs font-semibold uppercase tracking-wider text-slate-500
                cursor-pointer select-none hover:text-slate-800 hover:bg-slate-100
                transition-colors border-b border-slate-200
                ${col.align === 'right' ? 'text-right' : 'text-left'}
              `}
              style={{ width: col.width, minWidth: col.width }}
            >
              {col.label}{arrow}
            </th>
          )
        })}
      </tr>
    </thead>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/TableHeader.tsx
git commit -m "feat: add TableHeader component with sort indicators"
```

---

## Task 13: TableRow Component

**Files:**
- Create: `src/components/TableRow.tsx`

- [ ] **Step 1: Create component**

Create `src/components/TableRow.tsx`:
```tsx
import { tableColumns } from '@/lib/columns'
import { EditableCell } from './EditableCell'
import { StatusBadge } from './StatusBadge'
import type { Listing } from '@/types/listing'

interface TableRowProps {
  listing: Listing
  isSelected: boolean
  onSelect: (id: string) => void
  onUpdate: (id: string, field: string, value: string | number | null) => void
}

export function TableRow({ listing, isSelected, onSelect, onUpdate }: TableRowProps) {
  const hasHighFees = (listing.common_fees_yearly ?? 0) > 6000
  const hasFlags = listing.notes && (
    listing.notes.toLowerCase().includes('foundation') ||
    listing.notes.toLowerCase().includes('water') ||
    listing.notes.toLowerCase().includes('sewer')
  )

  return (
    <tr
      onClick={() => onSelect(listing.id)}
      className={`
        border-b border-slate-100 cursor-pointer transition-colors
        ${isSelected ? 'bg-blue-50 border-blue-200' : 'hover:bg-slate-50'}
        ${hasFlags ? 'ring-1 ring-inset ring-amber-200' : ''}
      `}
    >
      {tableColumns.map(col => {
        if (col.key === 'status') {
          return (
            <td key={col.key} className="px-3 py-2.5" style={{ width: col.width }}>
              <StatusBadge status={listing.status} />
            </td>
          )
        }

        const value = listing[col.key as keyof Listing]
        const isHighFeeCell = col.key === 'common_fees_yearly' && hasHighFees

        return (
          <td
            key={col.key}
            className={`px-3 py-2.5 text-sm ${isHighFeeCell ? 'bg-red-50 text-red-800 font-medium' : 'text-slate-700'}`}
            style={{ width: col.width, minWidth: col.width }}
          >
            <EditableCell
              value={value}
              format={col.format}
              editable={col.editable}
              align={col.align}
              onSave={(newValue) => {
                onUpdate(listing.id, col.key, newValue)
              }}
            />
          </td>
        )
      })}
    </tr>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/TableRow.tsx
git commit -m "feat: add TableRow component with flag highlighting and inline editing"
```

---

## Task 14: FilterBar Component

**Files:**
- Create: `src/components/FilterBar.tsx`

- [ ] **Step 1: Create component**

Create `src/components/FilterBar.tsx`:
```tsx
'use client'

import { useState } from 'react'

export interface Filters {
  type: string
  minPrice: string
  maxPrice: string
  status: string
}

const EMPTY_FILTERS: Filters = { type: '', minPrice: '', maxPrice: '', status: '' }

interface FilterBarProps {
  propertyTypes: string[]
  onFilterChange: (filters: Filters) => void
}

export function FilterBar({ propertyTypes, onFilterChange }: FilterBarProps) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [open, setOpen] = useState(false)

  const update = (field: keyof Filters, value: string) => {
    const next = { ...filters, [field]: value }
    setFilters(next)
    onFilterChange(next)
  }

  const clear = () => {
    setFilters(EMPTY_FILTERS)
    onFilterChange(EMPTY_FILTERS)
  }

  const hasActiveFilters = Object.values(filters).some(v => v !== '')

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setOpen(!open)}
        className={`
          px-3 py-1.5 text-sm rounded-lg border transition-colors
          ${hasActiveFilters
            ? 'bg-blue-50 border-blue-300 text-blue-700'
            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }
        `}
      >
        Filters{hasActiveFilters ? ' ●' : ''}
      </button>

      {open && (
        <div className="flex items-center gap-3">
          <select
            value={filters.type}
            onChange={e => update('type', e.target.value)}
            className="px-2 py-1.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-700"
          >
            <option value="">All types</option>
            {propertyTypes.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Min $"
            value={filters.minPrice}
            onChange={e => update('minPrice', e.target.value)}
            className="w-24 px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
          />

          <input
            type="text"
            placeholder="Max $"
            value={filters.maxPrice}
            onChange={e => update('maxPrice', e.target.value)}
            className="w-24 px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
          />

          <select
            value={filters.status}
            onChange={e => update('status', e.target.value)}
            className="px-2 py-1.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-700"
          >
            <option value="">All status</option>
            <option value="complete">Complete</option>
            <option value="partial">Partial</option>
            <option value="pending">Pending</option>
            <option value="error">Error</option>
          </select>

          {hasActiveFilters && (
            <button
              onClick={clear}
              className="px-2 py-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/FilterBar.tsx
git commit -m "feat: add FilterBar component with type, price, and status filters"
```

---

## Task 15: ListingsTable Component

**Files:**
- Create: `src/components/ListingsTable.tsx`

- [ ] **Step 1: Create component**

Create `src/components/ListingsTable.tsx`:
```tsx
'use client'

import { useMemo, useState } from 'react'
import { TableHeader } from './TableHeader'
import { TableRow } from './TableRow'
import { FilterBar, type Filters } from './FilterBar'
import { useSort } from '@/hooks/useSort'
import type { Listing } from '@/types/listing'

interface ListingsTableProps {
  listings: Listing[]
  selectedId: string | null
  onSelect: (id: string) => void
  onUpdate: (id: string, field: string, value: string | number | null) => void
}

export function ListingsTable({ listings, selectedId, onSelect, onUpdate }: ListingsTableProps) {
  const [filters, setFilters] = useState<Filters>({ type: '', minPrice: '', maxPrice: '', status: '' })

  const filtered = useMemo(() => {
    return listings.filter(l => {
      if (filters.type && l.property_type !== filters.type) return false
      if (filters.status && l.status !== filters.status) return false
      if (filters.minPrice) {
        const min = Number(filters.minPrice.replace(/[$,\s]/g, ''))
        if (!isNaN(min) && (l.price ?? 0) < min) return false
      }
      if (filters.maxPrice) {
        const max = Number(filters.maxPrice.replace(/[$,\s]/g, ''))
        if (!isNaN(max) && (l.price ?? Infinity) > max) return false
      }
      return true
    })
  }, [listings, filters])

  const { sorted, sort, toggleSort } = useSort(filtered)

  const propertyTypes = useMemo(() => {
    const types = new Set(listings.map(l => l.property_type).filter(Boolean) as string[])
    return Array.from(types).sort()
  }, [listings])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
        <FilterBar propertyTypes={propertyTypes} onFilterChange={setFilters} />
        <span className="text-sm text-slate-500">
          {sorted.length} listing{sorted.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <TableHeader sort={sort} onSort={toggleSort} />
          <tbody>
            {sorted.map(listing => (
              <TableRow
                key={listing.id}
                listing={listing}
                isSelected={listing.id === selectedId}
                onSelect={onSelect}
                onUpdate={onUpdate}
              />
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={99} className="px-4 py-12 text-center text-slate-400 text-sm">
                  {listings.length === 0
                    ? 'No listings yet. Paste a Centris link above to get started.'
                    : 'No listings match your filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ListingsTable.tsx
git commit -m "feat: add ListingsTable with filtering, sorting, and empty states"
```

---

## Task 16: DetailPanel Component

**Files:**
- Create: `src/components/DetailPanel.tsx`

- [ ] **Step 1: Create component**

Create `src/components/DetailPanel.tsx`:
```tsx
'use client'

import { detailColumns } from '@/lib/columns'
import { formatCellValue } from '@/lib/formatting'
import { EditableCell } from './EditableCell'
import { StatusBadge } from './StatusBadge'
import type { Listing } from '@/types/listing'

interface DetailPanelProps {
  listing: Listing
  onClose: () => void
  onUpdate: (id: string, field: string, value: string | number | null) => void
  onDelete: (id: string) => void
}

export function DetailPanel({ listing, onClose, onUpdate, onDelete }: DetailPanelProps) {
  const googleMapsUrl = listing.full_address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(listing.full_address)}`
    : null

  return (
    <div className="w-[420px] border-l border-slate-200 bg-white flex flex-col h-full shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">
            {listing.location ?? 'Unknown Location'}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={listing.status} />
            {listing.mls_number && (
              <span className="text-xs text-slate-400">MLS# {listing.mls_number}</span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          aria-label="Close"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {/* Quick Links */}
        <div className="flex gap-2 mb-5">
          {listing.link && (
            <a
              href={listing.link}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
            >
              View on Centris ↗
            </a>
          )}
          {googleMapsUrl && (
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors"
            >
              Google Maps ↗
            </a>
          )}
        </div>

        {/* Fields */}
        <div className="space-y-3">
          {detailColumns.map(col => {
            if (col.key === 'status') return null
            if (col.key === 'link') return null

            const value = listing[col.key as keyof Listing]

            return (
              <div key={col.key} className="flex items-start justify-between py-1.5 border-b border-slate-50">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wide w-32 shrink-0 pt-0.5">
                  {col.label}
                </span>
                <div className="flex-1 text-sm text-slate-700">
                  <EditableCell
                    value={value}
                    format={col.format}
                    editable={col.editable}
                    align="left"
                    onSave={(newValue) => onUpdate(listing.id, col.key, newValue)}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-slate-200 bg-slate-50">
        <button
          onClick={() => {
            if (confirm('Delete this listing? This cannot be undone.')) {
              onDelete(listing.id)
            }
          }}
          className="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
        >
          Delete listing
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/DetailPanel.tsx
git commit -m "feat: add DetailPanel with all fields, links, editing, and delete"
```

---

## Task 17: TopBar Component

**Files:**
- Create: `src/components/TopBar.tsx`

- [ ] **Step 1: Create component**

Create `src/components/TopBar.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { listingsToCSV } from '@/lib/csv-export'
import type { Listing } from '@/types/listing'

interface TopBarProps {
  listings: Listing[]
}

export function TopBar({ listings }: TopBarProps) {
  const [url, setUrl] = useState('')
  const [copied, setCopied] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return

    // Copy URL to clipboard for easy pasting in Claude Code
    navigator.clipboard.writeText(url.trim()).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleExport = () => {
    const csv = listingsToCSV(listings)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `househunter-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return (
    <div className="flex items-center gap-4 px-5 py-3 bg-white border-b border-slate-200">
      {/* Logo / Title */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <span className="text-white text-sm font-bold">H</span>
        </div>
        <h1 className="text-lg font-semibold text-slate-800">HouseHunter</h1>
      </div>

      {/* URL Input */}
      <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2">
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="Paste a Centris.ca link here..."
          className="flex-1 px-4 py-2 text-sm border border-slate-200 rounded-lg
                     bg-slate-50 placeholder-slate-400 text-slate-700
                     focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent
                     transition-all"
        />
        <button
          type="submit"
          className={`
            px-4 py-2 text-sm font-medium rounded-lg transition-all
            ${copied
              ? 'bg-emerald-500 text-white'
              : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
            }
          `}
        >
          {copied ? 'Copied!' : 'Copy URL'}
        </button>
      </form>

      {/* Export */}
      <button
        onClick={handleExport}
        disabled={listings.length === 0}
        className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg
                   hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Export CSV
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/TopBar.tsx
git commit -m "feat: add TopBar with URL input, copy-to-clipboard, and CSV export"
```

---

## Task 18: Main Page Assembly

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Update globals.css**

Replace the contents of `src/app/globals.css` with:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #f8fafc;
  --foreground: #0f172a;
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-inter), system-ui, -apple-system, sans-serif;
}

/* Custom scrollbar for the table */
.overflow-auto::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.overflow-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-auto::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}

.overflow-auto::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
```

- [ ] **Step 2: Update layout.tsx**

Replace the contents of `src/app/layout.tsx` with:
```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'HouseHunter',
  description: 'Real estate listing comparison tool',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Build the main page**

Replace the contents of `src/app/page.tsx` with:
```tsx
'use client'

import { useState } from 'react'
import { TopBar } from '@/components/TopBar'
import { ListingsTable } from '@/components/ListingsTable'
import { DetailPanel } from '@/components/DetailPanel'
import { useListings } from '@/hooks/useListings'

export default function Home() {
  const { listings, loading, error, updateListing, deleteListing } = useListings()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selectedListing = selectedId
    ? listings.find(l => l.id === selectedId) ?? null
    : null

  const handleDelete = async (id: string) => {
    const success = await deleteListing(id)
    if (success && selectedId === id) {
      setSelectedId(null)
    }
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-400 text-sm">Loading listings...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="text-red-500 text-sm">Error: {error}</div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      <TopBar listings={listings} />

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <ListingsTable
            listings={listings}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onUpdate={updateListing}
          />
        </div>

        {selectedListing && (
          <DetailPanel
            listing={selectedListing}
            onClose={() => setSelectedId(null)}
            onUpdate={updateListing}
            onDelete={handleDelete}
          />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify the app loads**

```bash
npm run dev
```
Open http://localhost:3000. Expected: The app loads with the TopBar, an empty table with the message "No listings yet. Paste a Centris link above to get started.", and no errors in the browser console.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/layout.tsx src/app/globals.css
git commit -m "feat: assemble main page with TopBar, ListingsTable, and DetailPanel"
```

---

## Task 19: Run All Tests and Type-Check

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

```bash
npm test
```
Expected: All tests pass (calculations, formatting, flags, csv-export).

- [ ] **Step 2: Run type checker**

```bash
npx tsc --noEmit
```
Expected: No type errors.

- [ ] **Step 3: Run production build**

```bash
npm run build
```
Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit any fixes**

If any step above required fixes, commit them:
```bash
git add -A
git commit -m "fix: resolve build and type errors"
```

---

## Task 20: Deploy to Vercel

**Files:**
- None (deployment)

- [ ] **Step 1: Initialize git remote and push**

Create a GitHub repository (or use Vercel's direct deployment). Push the code:
```bash
git remote add origin <github-repo-url>
git push -u origin master
```

- [ ] **Step 2: Deploy to Vercel**

Using the Vercel MCP tool or the Vercel dashboard:
1. Import the GitHub repository
2. Set environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key
3. Deploy

- [ ] **Step 3: Verify deployment**

Open the Vercel URL. Expected: App loads, connects to Supabase, shows empty table.

- [ ] **Step 4: Commit Vercel config if generated**

```bash
git add -A
git commit -m "chore: add Vercel deployment configuration"
```

---

## Extraction Flow Note

The data extraction (reading Centris, Realtor.ca, broker sites, Google Maps via Claude-in-Chrome) happens **outside** the web app, in a Claude Code conversation. The flow is:

1. User pastes a Centris URL in the HouseHunter top bar (copies it to clipboard)
2. User asks Claude Code to extract the listing data
3. Claude uses Claude-in-Chrome to read the pages and gather data
4. Claude uses the Supabase MCP to insert/update the listing row
5. User refreshes the HouseHunter page to see the new row

This extraction logic is conversational — it lives in Claude Code prompts and instructions, not in the web app code. A future enhancement could add an API route that triggers extraction, but for Phase 1, the Claude Code conversation is the extraction engine.
