# Prompt 11 - OpenAI Foundation

Add OpenAI integration plumbing without building the complete document-generation engine.

## Requirements

- Internal AI provider interface
- OpenAI implementation using official SDK
- API key from environment only
- Configurable model
- Zod-validated structured outputs
- AiRun persistence with purpose, prompt version, request metadata, response metadata, token usage, timing, status, and errors
- Tracker works with no API key
- Implement a single job-description parsing proof of concept behind an explicit user action
- Save parsed output to JobOpportunity.descriptionData after user review, not automatically
- Add rate/error handling and clear local setup instructions

## Acceptance criteria

- No secret appears in logs or database
- Mock-provider tests require no external API
- Optional manual test works when OPENAI_API_KEY is present
- Invalid model output is rejected rather than silently accepted
