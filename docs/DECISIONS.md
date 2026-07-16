# Product and Architecture Decisions

## D001 - Local-only personal release

The first release runs locally. No cloud deployment or remote access is required.

## D002 - No login

The local release has no authentication UI. Data records still belong to a seeded workspace.

## D003 - Next.js modular monolith

Use a single TypeScript application to reduce setup and coordination time.

## D004 - PostgreSQL and Prisma

Operational data is relational. PostgreSQL also supports JSONB and future pgvector use.

## D005 - Actual time and job-search date are separate

After-midnight adjustments must never destroy the real timestamp.

## D006 - Activities are separate records

Application rows do not expand indefinitely with every new activity type.

## D007 - Documents are immutable versions

New versions are created instead of overwriting files.

## D008 - Excel remains a supported interface

The web grid and export preserve spreadsheet interoperability rather than forcing users to abandon Excel.

## D009 - OpenAI provider abstraction

OpenAI is the first provider, but application code depends on an internal interface.

## D010 - AI generation follows tracker functionality

The application must become useful before direct AI document generation is built.

## D011 - Generic resume ingestion is later

The personal profile is imported from the existing v3 JSON first. Generic parsing for all users follows personal validation.
