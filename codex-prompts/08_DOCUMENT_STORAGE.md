# Prompt 08 - Document Storage and Downloads

Implement local document storage with immutable versions.

## Requirements

- Configurable LOCAL_DATA_DIR
- Upload DOCX, PDF, TXT, Markdown, JSON, XLSX, and CSV with size limits
- Sanitize filenames and verify MIME/extension
- Calculate checksum
- Create logical Document and immutable DocumentVersion
- Link documents to applications or career profile
- List, preview metadata, download, mark submitted, supersede, and archive
- Never overwrite a stored version
- Store files outside public web root
- Stream downloads through validated server routes

## Acceptance criteria

- Downloaded bytes match uploaded bytes
- New version increments correctly
- Duplicate exact file may be detected by checksum but must not silently replace records
- Invalid file types are rejected safely
