# Sentinel's Journal

## 2025-02-18 - [Filename Sanitization on Windows]
**Vulnerability:** Filenames like `CON`, `PRN`, or `file.` (trailing dot) are invalid or dangerous on Windows systems, potentially causing download failures or unexpected behavior.
**Learning:** Standard regex sanitization often misses OS-specific reserved words and edge cases like trailing dots.
**Prevention:** Explicitly check for reserved filenames (anchored, with optional extension) and strip trailing dots in sanitization routines.
