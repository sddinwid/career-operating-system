# OpenAI Integration Design

## Initial purpose

OpenAI integration begins after the tracker works. The first implementation provides a safe provider boundary and structured-output plumbing.

## Provider interface

Methods should support:

- parseJobDescription
- scoreCareerEvidence
- generateResumeContent
- generateCoverLetter
- generateApplicationAnswer
- generateInterviewPreparation

Only `parseJobDescription` needs an early proof of concept.

## Requirements

- API key from local environment only
- Model name configurable
- Structured JSON responses validated through Zod
- Store prompt version, request metadata, model, timing, token usage, and errors
- Do not store secret keys
- Do not automatically submit or overwrite documents
- Every generated claim must map to career evidence before document creation

## Failure behavior

The tracker remains usable when OpenAI is unavailable or unconfigured.
