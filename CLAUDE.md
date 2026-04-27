danaus is an AT Protocol PDS (Personal Data Server) written in Bun.

## development notes

### project management

- Bun and pnpm is managed by mise, to run commands, use `mise exec -- bun ...`
- install dependencies with `pnpm install`
- format via `bun run fmt` (prettier, in root directory)
- lint and typecheck via `bun run lint` (oxlint, in root directory)
- run tests via `bun test` (bun, in package)
- build via `bun run build` (tsgo + assets, in package)
- check `pnpm view <package>` before adding a new dependency
- pnpm doesn't hoist packages by default; check the package's own `node_modules/` directory when
  inspecting dependencies (e.g., `packages/danaus/node_modules/@atcute/crypto` not root
  `node_modules`)

### code writing

- new files should be in kebab-case
- use tabs for indentation, spaces allowed for diagrams in comments
- use single quotes for strings; use template literals for localization strings (user-facing
  strings, error messages)
- add trailing commas
- prefer arrow functions, but use regular methods in classes unless arrow functions are necessary
  (e.g., when passing the method as a callback that needs `this` binding)
- use braces for control statements, even single-line bodies
- use bare blocks `{ }` to group related code and limit variable scope
- prefer `switch` over `if`/`else if` chains when branching on a single discriminant value
- avoid barrel exports (index files that re-export from other modules); import directly from source
- use `// #region <name>` and `// #endregion` to denote regions when a file needs to contain a lot
  of code
- a parameter should be optional only when callers genuinely split between passing a value and
  relying on the default; if every caller passes a value, make it required; if no caller would ever
  change it, it should not be a parameter at all
- avoid optional parameters that change behavioral modes or make the function do different things
  based on presence/absence; prefer a separate function with a clearer name instead
- avoid type assertions (`as Type`, `as const`) unless TypeScript actually errors without them; when
  it does error, prefer finding a solution that satisfies the type system naturally before resorting
  to an assertion

### commit workflow

we use conventional commits with these rules:

- accepted types: `feat`, `fix`, `refactor`, `docs`, `chore`
  - docs
    - Markdown document changes (README.md and similar)
  - chore
    - build/tooling/dependency changes
    - test-only changes
    - mass-autofixes from linters and formatters
- no scopes; write `feat: ...` / `refactor: ...`, never `feat(runtime): ...`
- append `!` after the type to mark breaking changes, e.g. `feat!:` or `refactor!:`

granularity — each commit should represent one logical change:

- split distinct changes into separate commits rather than bundling them
- pair each README update with the commit it documents, rather than batching doc updates across
  multiple changes

### documentation

- documentations include README, code comments, commit messages
- any writing should be in lowercase, except for proper nouns, acronyms and 'I'; this does not apply
  to public-facing interfaces like web UI
- only comment non-trivial code, focusing on _why_ rather than _what_
- write comments and JSDoc in lowercase (except proper nouns, acronyms, and 'I')
- add JSDoc comments to new publicly exported functions, methods, classes, fields, and enums
- JSDoc should include proper annotations:
  - use `@param` for parameters (no dashes after param names)
  - use `@returns` for return values
  - use `@throws` for exceptions when applicable
  - keep descriptions concise but informative

### agentic coding

- `.research/` directory in the project root serves as a workspace for temporary experiments,
  analysis, and planning materials. create if not present (it's gitignored). this directory may
  contain cloned repositories or other reference materials that can help inform implementation
  decisions
- this document is intentionally incomplete; discover everything else in the repo
- don't make assumptions or speculate about code, plans, or requirements without exploring first;
  pause and ask for clarification when you're still unsure after looking into it
- in plan mode, present the plan for review before exiting to allow for feedback or follow-up
  questions
- when debugging problems, isolate the root cause first before attempting fixes: add logging,
  reproduce the issue, narrow down the scope, and confirm the exact source of the problem
- exploration results done by subagents/subtasks may not be accurate; verify findings as needed
- do not use subagents/subtasks as file I/O proxies ("read and return the file contents")
