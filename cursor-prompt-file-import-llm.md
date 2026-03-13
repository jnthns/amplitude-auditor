# Cursor Prompt: File Import, Pre-Processing & Audit Engine

> This prompt covers the data layer of the Amplitude Taxonomy Audit app: CSV parsing, client-side pre-processing, Gemini API integration, and audit engine orchestration. It assumes the React/Vite shell, Zustand store, and UI components already exist or will be built separately.

---

## Scope

Build these files in `src/lib/` and `src/types/`:

```
src/
├── types/
│   └── audit.ts            # All shared TypeScript interfaces
├── lib/
│   ├── csvParser.ts         # PapaParse-based CSV import with Amplitude schema validation
│   ├── preProcess.ts        # Deterministic client-side stats computation
│   ├── gemini.ts            # Gemini REST API wrapper with retry + model fallback
│   └── auditEngine.ts       # Orchestrates 4 LLM calls and assembles final results
```

Dependencies: `papaparse` (^5.4.1), `@types/papaparse` (^5.3.15). No other runtime deps for these files.

---

## 1. Types (`src/types/audit.ts`)

```typescript
// ============================================================
// CSV Parsed Types
// ============================================================

export interface ParsedEvent {
  name: string;                    // "Object Name" column
  displayName: string;             // "Event Display Name"
  description: string;             // "Object Description"
  category: string;                // "Event Category"
  tags: string;                    // "Tags"
  schemaStatus: string;            // "Event Schema Status" — LIVE | UNEXPECTED | PLANNED
  activity: string;                // "Event Activity" — ACTIVE | INACTIVE
  hiddenFromDropdowns: boolean;
  hiddenFromPersona: boolean;
  hiddenFromPathfinder: boolean;
  hiddenFromTimeline: boolean;
  source: string;                  // "Event Source"
  volume30d: number;               // "Event 30 Day Volume"
  queries30d: number;              // "Event 30 Day Queries"
  firstSeen: string;
  lastSeen: string;
  properties: ParsedEventProperty[];
}

export interface ParsedEventProperty {
  name: string;                    // "Event Property Name"
  description: string;             // "Property Description"
  category: string;                // "Property Category"
  valueType: string;               // "Property Value Type" (column index 24, 0-indexed)
  schemaStatus: string;            // "Property Schema Status"
  required: boolean;               // "Property Required"
  visibility: string;              // "Property Visibility"
  isArray: boolean;                // "Property Is Array"
  enumValues: string;
  constValue: string;
  regex: string;
  firstSeen: string;
  lastSeen: string;
}

export interface ParsedUserProperty {
  name: string;                    // "Property Name"
  description: string;
  category: string;
  valueType: string;               // "Property Value Type" — use column index 5 (0-indexed), NOT column 9 (duplicate header)
  schemaStatus: string;
  visibility: string;
  isArray: boolean;
  enumValues: string;
  constValue: string;
  regex: string;
  firstSeen: string;
  lastSeen: string;
}

// ============================================================
// Pre-Processed Stats
// ============================================================

export interface PreProcessedStats {
  totalEventRows: number;
  activeEvents: number;
  inactiveEvents: number;
  eventsBySchemaStatus: Record<string, number>;

  namingConventions: Record<string, string[]>;       // convention -> list of event names
  namingConventionDistribution: Record<string, number>;
  propertyNamingConventions: Record<string, number>;

  totalVolume30d: number;
  topEventsByVolume: Array<{ name: string; volume: number; queries: number }>;
  zeroQueryEvents: Array<{ name: string; volume: number }>;
  zeroQueryEventVolume: number;

  avgPropertiesPerEvent: number;
  maxPropertiesPerEvent: { eventName: string; count: number };
  eventsWithOver20Properties: string[];
  totalUserProperties: number;

  suspectedPiiEventProperties: Array<{ eventName: string; propertyName: string }>;
  suspectedPiiUserProperties: string[];

  duplicatePropertyNames: string[];

  eventsWithoutDescription: number;
  eventsWithDescription: number;
  eventPropertiesWithoutDescription: number;
  userPropertiesWithoutDescription: number;

  eventsWithCategory: number;
  eventsWithoutCategory: number;
  uniqueCategories: string[];

  screenViewPatterns: string[];
  clickPatterns: string[];

  unexpectedEventCount: number;
  unexpectedEventPct: number;
  unexpectedPropertyCount: number;
}

// ============================================================
// LLM Result Types
// ============================================================

export interface CriterionResult {
  criteriaId: string;
  score: 'Pass' | 'Fail' | 'N/A';
  comments: string;
  remediation: string | null;
  amplitudeActions: string[];
  pointsEarned: number;
  pointsPossible: number;
}

export interface FixRecommendation {
  title: string;
  issue: string;
  impact: string;
  steps: string[];
  amplitudeFeature: string;
  actIds: string[];
  effort: 'Low' | 'Medium' | 'High';
  criteriaIds: string[];
}

export interface ExecutiveSummary {
  overallScore: {
    earned: number;
    possible: number;
    percentage: number;
    grade: 'Needs Improvement' | 'Meets Expectations' | 'Exceeds Expectations';
  };
  topTakeaways: string[];
  shortTermFixes: FixRecommendation[];
  mediumTermFixes: FixRecommendation[];
  longTermFixes: FixRecommendation[];
}

// ============================================================
// Intake / Store Types (referenced by engine)
// ============================================================

export interface IntakeFormData {
  customerName: string;
  projectId: string;
  dataSources: string[];
  industry: string;
  compliance: string[];
  concerns: string;
  geminiApiKey: string;
}
```

---

## 2. CSV Parser (`src/lib/csvParser.ts`)

Use PapaParse. Export two async functions.

### `parseEventsCsv(file: File): Promise<ParsedEvent[]>`

The Events + Event Properties CSV has 42 columns and a **parent-child row structure**:

**Column headers (exact):**
```
Action | Object Type | Object Name | Event Display Name | Object Owner |
Object Description | Event Category | Tags | Event Schema Status |
Event Activity | Event Hidden From Dropdowns | Event Hidden From Persona Results |
Event Hidden From Pathfinder | Event Hidden From Timeline | Event Source |
Event 30 Day Volume | Event 30 Day Queries | Event First Seen | Event Last Seen |
Property Type | Property Group Names | Event Property Name |
Property Description | Property Category | Property Value Type |
Property Schema Status | Property Required | Property Visibility |
Property Is Array | String Property Value Min Length |
String Property Value Max Length | Number Is Integer |
Number Property Value Min | Number Property Value Max |
Array Unique Items | Array Min Items | Array Max Items | Enum Values |
Const Value | Property Regex | Property First Seen | Property Last Seen
```

**Two row types determined by position:**

1. **Event rows** — `row["Object Type"] === "Event"`. These populate columns 1–18 (Object Type through Event Last Seen). Columns 19–41 are empty. Create a new `ParsedEvent` and set it as `currentEvent`.

2. **Property rows** — `row["Property Type"] === "Event Property"`. These populate columns 19–41. Columns 1–18 are empty. Each property row belongs to the **most recently seen event row above it** in the CSV. Push a `ParsedEventProperty` to `currentEvent.properties`.

**Critical parsing rules:**
- The `Action` column is ALWAYS `"IGNORE"` — skip it entirely.
- Walk rows sequentially. Maintain a `currentEvent` pointer. When you hit an Event row, create a new ParsedEvent and set it as current. When you hit a Property row, attach it to the current event.
- `Event 30 Day Volume` and `Event 30 Day Queries` are numeric strings — parse with `parseInt(...) || 0`.
- Boolean columns (`Event Hidden From Dropdowns`, `Property Required`, `Property Is Array`) compare against the string `"TRUE"`.
- Do NOT discard events with `Event Schema Status === "UNEXPECTED"` — that's an audit finding.
- Strip BOM if present. PapaParse handles this with `skipEmptyLines: true`.

**Filtering applied after parsing:**
- Include events where `activity !== "INACTIVE"`. Keep everything else (ACTIVE, empty, or any other value).
- Do NOT filter on schema status, hidden flags, or any other column.

**Validation (throw descriptive errors):**
- Header must contain at minimum: `Object Type`, `Object Name`, `Event Schema Status`, `Event Activity`, `Event 30 Day Volume`, `Event Property Name`
- At least 1 row with `Object Type === "Event"` must exist
- File must be `.csv`, max 10MB
- If `Event 30 Day Volume` is missing or all empty across rows, console.warn but don't reject

### `parseUserPropertiesCsv(file: File): Promise<ParsedUserProperty[]>`

Flat structure — every data row is a user property.

**Column headers (exact):**
```
Action | Property Type | Property Name | Property Description |
Property Category | Property Value Type | Property Schema Status |
Property Visibility | Property Is Array | Property Value Type |
String Property Value Min Length | String Property Value Max Length |
Number Is Integer | Number Property Value Min | Number Property Value Max |
Array Unique Items | Array Min Items | Array Max Items | Enum Values |
Const Value | Property Regex | Property First Seen | Property Last Seen
```

**IMPORTANT:** `Property Value Type` appears TWICE — at column index 5 and column index 9 (0-indexed). Use column index 5 as canonical. Ignore column 9.

**Parsing:** Iterate all rows. Skip `Action` column. For each row where `row["Property Type"] === "User Property"`, create a `ParsedUserProperty`.

**Validation:**
- Header must contain: `Property Type`, `Property Name`, `Property Schema Status`
- At least 1 row with `Property Type === "User Property"` must exist
- File must be `.csv`, max 10MB

---

## 3. Pre-Processing (`src/lib/preProcess.ts`)

Export: `function computeStats(events: ParsedEvent[], userProperties: ParsedUserProperty[]): PreProcessedStats`

Compute every field in `PreProcessedStats` deterministically in JS. This data gets sent to the LLM alongside the raw schema, giving it verified evidence to cite. No LLM calls in this file.

### Naming Convention Classifier

```typescript
function classifyNaming(name: string): string {
  if (/^[A-Z][a-z]+(\s[A-Z][a-z]+)*$/.test(name)) return 'titleCase';
  if (/^[a-z]+(_[a-z0-9]+)*$/.test(name)) return 'snakeCase';
  if (/^[a-z]+([A-Z][a-z0-9]+)*$/.test(name)) return 'camelCase';
  if (/^[A-Z]+(_[A-Z0-9]+)*$/.test(name)) return 'screamingSnake';
  if (/^[a-z]+(\.[a-z0-9]+)*$/.test(name)) return 'dotCase';
  if (/^[a-z]+(-[a-z0-9]+)*$/.test(name)) return 'kebabCase';
  return 'other';
}
```

Apply to every `event.name` → populate `namingConventions` (map of convention to event name list) and `namingConventionDistribution` (map of convention to count).

Apply separately to all event property names + user property names → populate `propertyNamingConventions`.

### PII Scanner

Scan ALL property names (event properties + user properties) case-insensitively against:

```typescript
const PII_PATTERNS: RegExp[] = [
  /email/i, /e[-_]?mail/i,
  /phone/i, /mobile/i, /cell/i,
  /address/i, /street/i, /zip_?code/i, /postal/i,
  /\bssn\b/i, /social_?security/i,
  /passport/i, /driver_?license/i,
  /\bdob\b/i, /date_?of_?birth/i, /birth_?date/i,
  /ip_?address/i,
  /first_?name/i, /last_?name/i, /full_?name/i,
  /credit_?card/i, /card_?number/i, /\bcvv\b/i,
];
```

For event properties: push `{ eventName, propertyName }` to `suspectedPiiEventProperties`.
For user properties: push `propertyName` to `suspectedPiiUserProperties`.

### Other Stats to Compute

- **Volume**: sort events by `volume30d` desc → `topEventsByVolume` (top 20). Filter `volume30d > 0 && queries30d === 0` → `zeroQueryEvents`. Sum their volume → `zeroQueryEventVolume`.
- **Property counts**: for each event, `event.properties.length`. Compute avg, max, list events with >20.
- **Duplicates**: collect all unique event property names into a Set, all user property names into a Set. Intersection = `duplicatePropertyNames`.
- **Description coverage**: count events where `description` is empty vs non-empty. Same for event properties and user properties.
- **Category coverage**: count events where `category` is empty vs non-empty. Collect unique non-empty categories.
- **Screen/page patterns**: filter event names matching `/screen|page|view|viewed|visit/i` → `screenViewPatterns`.
- **Click patterns**: filter event names matching `/click|tap|press|select|touch/i` → `clickPatterns`.
- **Schema status**: count events where `schemaStatus === "UNEXPECTED"`. Compute percentage vs total active events. Count properties with UNEXPECTED status.

---

## 4. Gemini API Wrapper (`src/lib/gemini.ts`)

Call the Gemini REST API directly from the browser. No Google SDK. The API key is passed in from the Zustand store (user enters it in the intake form).

### Exports

```typescript
export async function callWithFallback(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  maxOutputTokens?: number
): Promise<any>
```

### Implementation

**Models (try in order):**
```typescript
const MODELS = ['gemini-3-flash-preview', 'gemini-2.5-flash'] as const;
```

**Core call function:**
```typescript
async function callGemini(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  model: string,
  maxOutputTokens: number = 16384,
  retries: number = 3
): Promise<any> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.2,
              maxOutputTokens,
            },
          }),
        }
      );

      if (response.status === 429) {
        const wait = Math.min(60000, 2000 * Math.pow(2, attempt));
        console.warn(`Rate limited on ${model}, waiting ${wait}ms (attempt ${attempt + 1})`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }

      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        throw new Error(`Gemini ${response.status}: ${errBody.slice(0, 200)}`);
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Empty response from Gemini');
      return safeParseJSON(text);
    } catch (err) {
      if (attempt === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
    }
  }
  throw new Error('All retries exhausted');
}
```

**Model fallback:** Try `gemini-3-flash-preview` first. If it returns 429 after all retries, try `gemini-2.5-flash`. If the second model also fails, throw.

```typescript
export async function callWithFallback(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  maxOutputTokens?: number
): Promise<any> {
  for (const model of MODELS) {
    try {
      return await callGemini(apiKey, systemPrompt, userPrompt, model, maxOutputTokens);
    } catch (err: any) {
      const isLast = model === MODELS[MODELS.length - 1];
      if (err.message?.includes('429') && !isLast) {
        console.warn(`All retries on ${model} exhausted, falling back to next model`);
        continue;
      }
      throw err;
    }
  }
  throw new Error('All models exhausted');
}
```

**JSON safety parser:**
```typescript
function safeParseJSON(text: string): any {
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/[\[{][\s\S]*[\]}]/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Failed to parse Gemini response as JSON');
  }
}
```

---

## 5. Audit Engine (`src/lib/auditEngine.ts`)

This is the orchestrator. It takes parsed data + form context, fires 4 LLM calls in sequence, and returns the complete audit.

### Export

```typescript
export async function runAudit(
  events: ParsedEvent[],
  userProperties: ParsedUserProperty[],
  stats: PreProcessedStats,
  formData: IntakeFormData,
  criteria: AuditCriterion[],
  actions: AmplitudeAction[],
  onProgress: (completed: number, total: number, currentArea: string) => void
): Promise<{ results: CriterionResult[]; summary: ExecutiveSummary }>
```

### Batching: 3 Criteria Calls + 1 Summary Call = 4 Total

Group the 45 criteria into 3 mega-batches to minimize Gemini RPD burn:

```typescript
const BATCHES = [
  {
    label: 'Naming, Semantics, Event Architecture & Property Architecture',
    areas: ['Naming & Structure', 'Semantic Consistency', 'Event Architecture', 'Property Architecture'],
  },
  {
    label: 'Coverage, Volume, Identity & Data Quality',
    areas: ['Coverage & Completeness', 'Volume & Hygiene', 'Identity & User Model', 'Data Quality & Integrity'],
  },
  {
    label: 'Documentation & Tracking Plan',
    areas: ['Documentation & Tracking Plan'],
  },
];
```

Filter criteria by area for each batch. Run batches sequentially (not parallel — avoids RPM limits). After each batch completes, call `onProgress` with updated counts.

### System Prompt (prepended to every call)

Build this from `formData`:

```typescript
function buildSystemPrompt(formData: IntakeFormData): string {
  return `You are an Amplitude taxonomy audit agent used by Professional Services.
You evaluate Amplitude schema exports against structured audit criteria
and produce detailed, customer-facing findings.

RULES:
- Cite specific event and property names from the schema data. Never use placeholders like [Example A].
- Informal, direct consultant tone. Use contractions.
- Every Fail finding MUST have three distinct sections separated by \\n\\n:
  1. Finding: What's wrong and how widespread it is.
  2. Evidence: Specific event/property names and numbers from the schema.
  3. How to Resolve: Numbered steps tailored to the customer's data source(s).
- Tailor all resolution steps to: ${formData.dataSources.join(', ')}.
- Scoring: Pass = full points, Fail = 0 points, N/A = excluded from denominator.
- UNEXPECTED schema status should be explicitly flagged — it means no tracking plan entry exists.
- Output ONLY valid JSON. No markdown fences, no preamble, no text outside the JSON.

CUSTOMER CONTEXT:
- Customer: ${formData.customerName}
- Industry: ${formData.industry || 'Not specified'}
- Data Source(s): ${formData.dataSources.join(', ')}
- Compliance: ${formData.compliance.length ? formData.compliance.join(', ') : 'None specified'}
- Known Concerns: ${formData.concerns || 'None'}

SCORING:
- High impact = 3 points
- Medium impact = 2 points
- Low impact = 1 point
- Pass = full points for the row
- Fail = 0 points
- N/A = 0 points possible (excluded from denominator)`;
}
```

### Criteria Batch User Prompt

```typescript
function buildBatchPrompt(
  batchCriteria: AuditCriterion[],
  events: ParsedEvent[],
  userProperties: ParsedUserProperty[],
  stats: PreProcessedStats
): string {
  // For large schemas (>500 events), compress: send only name, schemaStatus,
  // activity, volume30d, queries30d, and property count per event.
  // Include full property details only for:
  //   - Top 50 events by volume
  //   - Events with suspected PII properties (from stats)
  //   - Events with >20 properties
  const schemaJSON = events.length > 500
    ? JSON.stringify(compressSchema(events, stats))
    : JSON.stringify(events);

  return `Evaluate these audit criteria against the Amplitude schema data.

## Pre-Computed Statistics (deterministic, use as primary evidence)
${JSON.stringify(stats, null, 2)}

## Event Schema (${events.length} active events)
${schemaJSON}

## User Properties (${userProperties.length} properties)
${JSON.stringify(userProperties)}

## Criteria to Evaluate (${batchCriteria.length} criteria)
${JSON.stringify(batchCriteria.map(c => ({
  id: c.id,
  area: c.area,
  impact: c.impact,
  criteria: c.criteria,
  prompt: c.prompt,
  passCondition: c.passCondition,
  failCondition: c.failCondition,
  naCondition: c.naCondition,
  remediation: c.remediation,
  tooling: c.tooling,
  points: c.points,
  heuristics: c.heuristics,
})))}

Return a JSON array with one object per criterion:
[
  {
    "criteriaId": "NS-001",
    "score": "Pass" | "Fail" | "N/A",
    "comments": "Paragraph 1: the finding.\\n\\nParagraph 2: evidence with specific names.\\n\\nParagraph 3: How to Resolve with numbered steps.",
    "remediation": "Numbered customer-facing steps. null if Pass.",
    "amplitudeActions": ["ACT-004", "ACT-005"],
    "pointsEarned": 1.0,
    "pointsPossible": 1.0
  }
]

IMPORTANT:
- Use the pre-computed statistics as your primary evidence — they are deterministic and accurate.
- For each Fail, cite at least 3 specific event or property names as evidence.
- If the schema export does not contain enough data to evaluate a criterion (e.g., requires live query data, runtime behavior, or property values not in the export), score "N/A" and explain exactly what data is missing.
- For criteria that reference user properties: if the user properties array is empty, score "N/A" with note "User properties CSV not provided."
- The remediation field should contain numbered steps specific to the customer's data source(s).`;
}
```

### Executive Summary User Prompt

```typescript
function buildSummaryPrompt(
  allResults: CriterionResult[],
  actions: AmplitudeAction[],
  stats: PreProcessedStats
): string {
  return `Generate an executive summary for this completed Amplitude taxonomy audit.

## All Audit Results (${allResults.length} criteria evaluated)
${JSON.stringify(allResults)}

## Amplitude Actions Catalogue
${JSON.stringify(actions)}

## Schema Statistics
${JSON.stringify(stats, null, 2)}

Return a single JSON object:
{
  "overallScore": {
    "earned": <sum of pointsEarned across all results>,
    "possible": <sum of pointsPossible where score !== "N/A">,
    "percentage": <earned / possible * 100, rounded to 1 decimal>,
    "grade": "Needs Improvement" (0-49%) | "Meets Expectations" (50-79%) | "Exceeds Expectations" (80-100%)
  },
  "topTakeaways": [
    "3-5 takeaways written for a VP-level reader who will not read the full audit. Be specific — cite numbers and event names."
  ],
  "shortTermFixes": [
    {
      "title": "Short descriptive title",
      "issue": "What's wrong (1-2 sentences).",
      "impact": "Why it matters to the business.",
      "steps": ["Numbered step 1", "Step 2", "Step 3"],
      "amplitudeFeature": "Product-level recommendation. Always end with ACT-ID footnote. Example: 'Use Amplitude Data display name editor to normalize naming without re-instrumentation. ^ACT-004^'",
      "actIds": ["ACT-004"],
      "effort": "Low",
      "criteriaIds": ["NS-001", "NS-002"]
    }
    // 3 total — highest impact, lowest effort, doable in Amplitude Govern UI
  ],
  "mediumTermFixes": [
    // 2 total — requires cross-team coordination or instrumentation changes
    // Same object shape. effort: "Medium"
  ],
  "longTermFixes": [
    // 2 total — governance, process, or architectural changes
    // Same object shape. effort: "High"
  ]
}

SELECTION RULES:
- shortTermFixes: Things you can do today in Amplitude Govern UI. No engineering needed. Highest impact per minute of effort.
- mediumTermFixes: Requires engineering or cross-team coordination but not architectural changes.
- longTermFixes: Tracking plan overhauls, CDP reconfiguration, org-wide governance standards.
- Every fix MUST reference at least one ACT-ID from the Amplitude Actions catalogue in the amplitudeFeature field.
- Every fix MUST link back to specific criteriaIds from the audit results.`;
}
```

### Schema Compression Helper

```typescript
function compressSchema(events: ParsedEvent[], stats: PreProcessedStats): any[] {
  const piiEventNames = new Set(stats.suspectedPiiEventProperties.map(p => p.eventName));
  const topVolumeNames = new Set(stats.topEventsByVolume.slice(0, 50).map(e => e.name));

  return events.map(e => {
    const needsFullDetail =
      topVolumeNames.has(e.name) ||
      piiEventNames.has(e.name) ||
      e.properties.length > 20;

    return {
      name: e.name,
      displayName: e.displayName,
      schemaStatus: e.schemaStatus,
      activity: e.activity,
      category: e.category,
      description: e.description ? '(has description)' : '',
      volume30d: e.volume30d,
      queries30d: e.queries30d,
      propertyCount: e.properties.length,
      properties: needsFullDetail ? e.properties : undefined,
    };
  });
}
```

### Main Orchestration

```typescript
export async function runAudit(
  events: ParsedEvent[],
  userProperties: ParsedUserProperty[],
  stats: PreProcessedStats,
  formData: IntakeFormData,
  criteria: AuditCriterion[],
  actions: AmplitudeAction[],
  onProgress: (completed: number, total: number, currentArea: string) => void
): Promise<{ results: CriterionResult[]; summary: ExecutiveSummary }> {

  const systemPrompt = buildSystemPrompt(formData);
  const allResults: CriterionResult[] = [];
  let completedCount = 0;
  const totalCriteria = criteria.length;

  // Run 3 criteria batches sequentially
  for (const batch of BATCHES) {
    const batchCriteria = criteria.filter(c => batch.areas.includes(c.area));
    if (batchCriteria.length === 0) continue;

    onProgress(completedCount, totalCriteria, batch.label);

    const userPrompt = buildBatchPrompt(batchCriteria, events, userProperties, stats);
    const results: CriterionResult[] = await callWithFallback(
      formData.geminiApiKey,
      systemPrompt,
      userPrompt,
      16384
    );

    // Validate and normalize results
    for (const r of results) {
      if (!r.criteriaId || !r.score) continue;
      if (!['Pass', 'Fail', 'N/A'].includes(r.score)) r.score = 'N/A';
      allResults.push(r);
    }

    completedCount += batchCriteria.length;
    onProgress(completedCount, totalCriteria, batch.label);

    // Brief pause between batches to avoid RPM limits
    await new Promise(r => setTimeout(r, 2000));
  }

  // Run executive summary call
  onProgress(completedCount, totalCriteria, 'Generating Executive Summary');
  const summaryPrompt = buildSummaryPrompt(allResults, actions, stats);
  const summary: ExecutiveSummary = await callWithFallback(
    formData.geminiApiKey,
    systemPrompt,
    summaryPrompt,
    8192
  );

  return { results: allResults, summary };
}
```

---

## 6. Edge Cases to Handle

### Missing User Properties CSV
If `userProperties` array is empty, criteria that require it (PA-002, PA-005, CC-001, CC-003, CC-004, DQ-001, VH-004) should be scored N/A by the LLM. The prompt already instructs this. Additionally, the `computeStats` function should handle an empty array gracefully — set `totalUserProperties: 0`, `suspectedPiiUserProperties: []`, `duplicatePropertyNames: []`.

### Schema >500 Events
The `compressSchema` function handles this. Full property detail is only sent for top-50 volume events, PII-flagged events, and events with >20 properties. All others get a summary with property count only.

### Schema <10 Events
Run the audit normally. The LLM should score VH-001 as Fail (too few events) and mark criteria requiring meaningful sample sizes as N/A.

### LLM Returns Wrong Number of Results
If the LLM returns fewer criteria results than expected for a batch, log a warning but don't retry. Missing criteria will show as "Not Evaluated" in the report. If it returns more, filter to only expected criteria IDs.

### Gemini Returns Non-JSON Despite `responseMimeType`
The `safeParseJSON` function handles this by stripping markdown fences and extracting the first JSON structure found.

### Empty Volume/Query Columns
Some schemas have volume data missing entirely. `parseInt(undefined) || 0` handles this. Warn in console but don't fail. Volume-dependent criteria (VH-002, VH-005, EA-005) will receive less precise evaluations — the LLM should note data limitations in comments.
