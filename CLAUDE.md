@AGENTS.md

## Listing Extraction — Tool Routing

When extracting data from real estate listings:

- **Claude-in-Chrome MCP:** Use for reading real estate sites (Centris, Realtor.ca, broker sites) that the user has open in Chrome
- **Playwright MCP:** Use for Google Maps commute times (Claude-in-Chrome blocks google.com). Use `browser_navigate` to load the directions URL, then `browser_snapshot` to read travel times
- **WebSearch + WebFetch:** Use for finding and reading listing pages from search results when Claude-in-Chrome can't navigate to them
- **Supabase MCP:** Use for all database inserts and queries (project ID: erklsdwrhscuzkntomxu, table: listings)
