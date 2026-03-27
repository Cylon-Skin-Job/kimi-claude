# Tools

## Allowed

- `read_file` — any path in the project
- `glob` — any pattern, any directory
- `grep` — any pattern, any directory
- `git_log` — read-only, any range
- `git_diff` — read-only, any range
- `git_show` — read-only, any commit
- `list_directory` — any path
- `todo_read` — read current task list
- `todo_write` — manage task list for edge processing loop

## Restricted

- `write_file` — only within `ai/workspaces/wiki/`
- `edit_file` — only within `ai/workspaces/wiki/`
- `write_file` — `ai/STATE.md` (project state updates)

## Denied

- `shell_exec` — no arbitrary shell commands
- `git_commit` — wiki agent does not commit
- `git_push` — wiki agent does not push
- `write_file` — any path outside wiki workspace and ai/STATE.md
- `edit_file` — any path outside wiki workspace
