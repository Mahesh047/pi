---
name: "file-discovery-fd-rg-fzf"
description: "Use fd, rg, and fzf as the default file discovery and search tools across all projects."
version: 1
created: "2026-06-16"
updated: "2026-06-16"
---
## When to Use
Always. Use these tools instead of find, grep, or bare ls for any file discovery, content search, or interactive selection task.

## Procedure
1. Use fd for finding files by name, type, or extension: `fd -e c`, `fd 'test_.*\.c'`, `fd --type f --max-depth 2`
2. Use rg for searching file contents: `rg 'pattern' --type c`, `rg --files -g '*.h'`, `rg -l 'symbol'`
3. Use fzf for interactive selection, always piped from fd or rg: `fd -e c | fzf`, `rg --files | fzf`
4. Combine all three for power workflows: `fd -e c | fzf` to pick a file, `rg 'pattern' -l | fzf` to pick a matching file interactively

## Pitfalls
- fzf is interactive — do not use it in scripted/automated bash commands
- rg respects .gitignore by default — use --no-ignore if you need to search build or vendor dirs
- fd also respects .gitignore — add --no-ignore to search ignored paths
- find is still needed for metadata queries (mtime, size, permissions) and -exec pipelines

## Verification
1. fd --version
2. rg --version
3. fzf --version