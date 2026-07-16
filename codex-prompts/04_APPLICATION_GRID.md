# Prompt 04 - Spreadsheet-Style Applications Grid

Replace the simple list with a spreadsheet-style applications grid while preserving the detail pages and forms.

## Requirements

- Use AG Grid Community or TanStack Table, choosing the option that best satisfies copy behavior without paid features
- Default view should approximate the Tracker worksheet's useful columns
- Sorting, filtering, resizing, reordering, hiding, and frozen leading columns
- Multi-row and multi-cell selection where supported
- Copy selected data as tab-separated values for Excel
- Long notes remain single-line/truncated in grid and fully visible in detail/editor
- Inline editing only for fields that can be updated safely
- Persist saved view preferences locally or in UserSetting
- Fast performance for at least 5,000 applications

## Acceptance criteria

- Selected rows paste into Excel with columns separated correctly
- Dates and links copy as human-usable values
- Grid remains usable with long notes
- Saved column layout restores after reload
- Tests and manual verification instructions are included
