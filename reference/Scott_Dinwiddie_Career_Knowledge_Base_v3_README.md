# Scott Dinwiddie Career Knowledge Base v3

This JSON file is a structured source of truth for AI-assisted resume generation, job alignment, cover letters, interview preparation, recruiter messaging, and application responses.

## Recommended use

Provide the v3 knowledge base and a job description to an AI with this instruction:

1. Parse the job description using `jobDescriptionParsingRules`.
2. Score candidate evidence using `jobMatchingRules`.
3. Apply the relevant `resumeGenerationRules.stackOrderingRules`.
4. Select content from `accomplishments`, `resumeBullets`, `professionalExperience`, and `projects`.
5. Follow `writingPreferences`.
6. Run the review gates in `outputGenerationWorkflow`.
7. Never invent missing facts.

## Important

The file is not a resume and should not be submitted to employers.
