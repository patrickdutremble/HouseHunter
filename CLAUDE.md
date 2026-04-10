@AGENTS.md

## Listing Extraction — Tool Routing

When extracting data from real estate listings:

- **Primary input = the `listings` table in Supabase.** The user adds new rows via the "+ Add listing" button in the web app and pastes the Centris URL into the `centris_link` column and the broker URL into the `broker_link` column. When the user says things like *"extract data for the new listings"*, query Supabase (project `erklsdwrhscuzkntomxu`, table `listings`) for rows where `centris_link IS NOT NULL` AND core fields (e.g. `price`, `full_address`, `mls_number`) are null/empty. Those are the rows to process.
- **Sources:** Use **Centris + the broker's site only**. Do NOT use Realtor.ca. If a field is missing from both primary sources, **leave it blank** — do not fall back to other sources to fill gaps.
- **Commute times:** Do NOT look them up. The user fills commute fields in manually. Leave those fields blank on insert.
- **WebFetch:** Use to read the `centris_link` and `broker_link` URLs stored in each row.
- **Claude-in-Chrome MCP:** Only if the user explicitly has a page open and asks you to read it.
- **Supabase MCP:** Use for all database reads/updates. Update existing rows via `execute_sql` — do NOT insert new rows (the app does that).
