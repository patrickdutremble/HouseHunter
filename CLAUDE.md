@AGENTS.md

## Listing Extraction — Tool Routing

When extracting data from real estate listings:

- **Sources:** Use **Centris + the broker's site only**. Do NOT use Realtor.ca. If a field is missing from both primary sources, **leave it blank** — do not fall back to other sources to fill gaps.
- **Commute times:** Do NOT look them up. The user fills commute fields in manually. Leave those fields blank on insert.
- **Claude-in-Chrome MCP:** Use for reading real estate sites (Centris, broker sites) that the user has open in Chrome
- **WebSearch + WebFetch:** Use for finding and reading listing pages from search results when Claude-in-Chrome can't navigate to them
- **Supabase MCP:** Use for all database inserts and queries (project ID: erklsdwrhscuzkntomxu, table: listings)
