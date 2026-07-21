# M8.4 Manual Test Checklist

Date: July 21, 2026

Use this checklist for a real-world manual pass after automated verification.

## Browser workflow

1. Open `/`.
2. Confirm daily entry points for Applications, Jobs, Documents, pasted job-description intake, and URL-based intake.
3. Create a new Job from `/jobs/new`.
4. Open the saved Job detail page.
5. Use `Import from URL`.
6. Fetch a simple public job page.
7. Confirm requested URL, final URL, status, content type, page title, extractor version, and diagnostics are visible.
8. Confirm meaningful extracted text appears in the editable preview.
9. Edit the preview text.
10. Save the job description.
11. Confirm an immutable `JobDescriptionVersion` is created.
12. Confirm URL provenance is visible on the saved version.
13. Parse the job description.
14. Open parsed analysis.
15. Open requirement review.
16. Confirm the analysis.
17. Retrieve evidence.
18. Score evidence.
19. Generate match report.
20. Create resume plan.
21. Create resume composition.
22. Open Resume Studio.
23. Audit and approve the resume.
24. Render resume DOCX and PDF.
25. Generate a cover letter.
26. Open Cover Letter Studio.
27. Audit and approve the cover letter.
28. Render cover-letter DOCX and PDF.
29. Open Documents.
30. Confirm all rendered artifacts are discoverable without deep links.
31. Return to Job detail.
32. Confirm the workflow panel shows completed stages.

## URL-specific checks

1. Refetch the same URL with unchanged fixture content.
2. Confirm no duplicate `JobDescriptionVersion` is created after save.
3. Refetch a changed fixture variant.
4. Confirm the preview changes before save.
5. Save and confirm a successor immutable version is created.
6. Test a JavaScript-heavy or login-gated page and confirm the failure is understandable.
7. Fall back to pasted text and confirm the save path still works.

## Invariants

Confirm that:

- `Application.status` does not change because of browsing, retrieval, generation, or rendering alone
- `ApplicationStatusHistory` is unchanged by browsing, retrieval, generation, or rendering alone
- rendered artifacts appear in Documents, Job detail, and Application detail
- no manual deep-link entry is required for the implemented flow

## Real-world caution

Some job sites require JavaScript execution, login, or anti-bot challenges. Those pages may not produce usable server-side retrieval results. In those cases, use pasted text instead of attempting browser automation or scraping workarounds.
