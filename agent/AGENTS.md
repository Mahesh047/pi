# Global Instructions

## Search & File Discovery Tools (enforced globally)

Always use these tools — no exceptions, including inside piped commands:

- **`rg`** (ripgrep) — content search. NEVER use `grep` in any form, standalone or piped.
  - ✅ `rg 'pattern'`
  - ✅ `fd -e c | rg 'pattern'`
  - ❌ `grep 'pattern'`
  - ❌ `fd -e c | grep 'pattern'`
- **`fd`** — file discovery. NEVER use `find`.
  - ✅ `fd -e c`, `fd 'pattern'`
  - ❌ `find . -name '*.c'`

### rg flags to know
- Use `-g '<glob>'` to filter by file type (NOT `--include` — rg does not support it)
- Use `-l` to list matching files only
- Use `-n` for line numbers
