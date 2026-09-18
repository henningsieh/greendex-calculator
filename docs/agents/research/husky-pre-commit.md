# Husky pre-commit workflow research

## Findings

- Husky supports disabling hooks with `HUSKY=0`; Git also supports skipping a
  commit hook with `git commit --no-verify`. [Husky How To](https://typicode.github.io/husky/how-to.html)
- Oxfmt accepts explicit file paths and writes in place by default. Passing the
  staged paths avoids formatting every workspace. [Oxfmt CLI](https://oxc.rs/docs/guide/usage/formatter/cli.html)
- `git diff --cached --name-only` describes the staged snapshot and returns its
  affected paths. [Git diff documentation](https://git-scm.com/docs/git-diff)

## Applied design

The hook now formats and lints only staged files by default. It temporarily
stashes unstaged tracked edits and restores them after checks. Set
`PRE_COMMIT_FULL=1` for repository-wide `format` and `lint` behavior.
