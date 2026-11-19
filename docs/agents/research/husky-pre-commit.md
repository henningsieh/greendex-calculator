# Husky pre-commit workflow research

## Findings

- Husky supports disabling hooks with `HUSKY=0`; Git also supports skipping a
  commit hook with `git commit --no-verify`. [Husky How To](https://typicode.github.io/husky/how-to.html)
- Oxfmt accepts explicit file paths and writes in place by default. Passing the
  staged paths avoids formatting every workspace. [Oxfmt CLI](https://oxc.rs/docs/guide/usage/formatter/cli.html)
- `git diff --cached --name-only` describes the staged snapshot and returns its
  affected paths. [Git diff documentation](https://git-scm.com/docs/git-diff)

## Applied design

The hook checks an isolated checkout of the index with the installed tools and
dependencies. Formatting updates selected index entries without changing the
working tree, including partially staged files. Lint examines staged code; the
instruction guard and, when applicable, the copy guard examine the staged
snapshot. Unstaged and untracked files do not participate. Run the repository-wide
`pnpm run format` and `pnpm run lint` separately before committing.
