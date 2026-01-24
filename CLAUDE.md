danaus is an AT Protocol PDS (Personal Data Server) written in Bun.

## development notes

### project management

- Bun and pnpm is managed by mise, to run commands, use `mise exec -- bun ...`
- install dependencies with `pnpm install`
- format via `bun run fmt` (prettier, in root directory)
- lint via `bun run lint` (oxlint, in root directory)
- run tests via `bun test` (bun, in package)
- typecheck via `bun run tsc` (tsc, in package)
- check `pnpm view <package>` before adding a new dependency
- pnpm doesn't hoist packages by default; check the package's own `node_modules/` directory when
  inspecting dependencies (e.g., `packages/danaus/node_modules/@atcute/crypto` not root
  `node_modules`)

### code writing

- new files should be in kebab-case
- use tabs for indentation, spaces allowed for diagrams in comments
- use single quotes and add trailing commas
- prefer arrow functions, but use regular methods in classes unless arrow functions are necessary
  (e.g., when passing the method as a callback that needs `this` binding)
- use braces for control statements, even single-line bodies
- use bare blocks `{ }` to group related code and limit variable scope
- use template literals for user-facing strings and error messages
- avoid barrel exports (index files that re-export from other modules); import directly from source
- use `// #region <name>` and `// #endregion` to denote regions when a file needs to contain a lot
  of code
- optional parameters should only exist when callers actually vary in what they pass:
  - if all callers use the default, hardcode it instead of making it a parameter
  - if all callers must pass a value (e.g. forwarding), make it required
  - good optional parameters: config values with sensible defaults that some callers override (e.g.,
    `timeout = 5000` where most use the default but some need custom values)
- avoid optional parameters that change behavioral modes; prefer separate functions instead
- when adding optional parameters for backwards compatibility, consider whether a new function with
  a clearer name would be better

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

### Claude Code-specific

- Bash tool persists directory changes (`cd`) across calls; always specify cd with absolute paths to
  be sure
- Task tool (subagents for exploration, planning, etc.) may not always be accurate; verify subagent
  findings when needed

### cgr

use `@oomfware/cgr` to ask questions about external repositories.

```
npx @oomfware/cgr ask [options] <repo>[#branch] <question>

options:
  -m, --model <model>   model to use: opus, sonnet, haiku (default: haiku)
  -d, --deep            clone full history (enables git log/blame/show)
  -w, --with <repo>     additional repository to include, supports #branch (repeatable)
```

useful repositories:

- `github.com/bluesky-social/atproto` for AT Protocol reference implementation, lexicons, XRPC
- `github.com/ascorbic/cirrus` for TypeScript PDS on Cloudflare Workers, @atcute usage patterns
- `github.com/haileyok/cocoon` for Go PDS implementation
- `github.com/davidbuchanan314/millipds` for Python PDS implementation
- `github.com/davidbuchanan314/atmst` for MST internals (Python)
- `tangled.org/futur.blue/pegasus` for OCaml PDS + atproto libraries
- `tangled.org/tranquil.farm/tranquil-pds` for Rust PDS implementation

broad questions work for getting oriented; detailed questions get precise answers. include
file/folder paths when you know them, and reference details from previous answers in follow-ups.

run `npx @oomfware/cgr --help` for more options.

## Decision Graph Workflow

**THIS IS MANDATORY. Log decisions IN REAL-TIME, not retroactively.**

### The Core Rule

```
BEFORE you do something -> Log what you're ABOUT to do
AFTER it succeeds/fails -> Log the outcome
CONNECT immediately -> Link every node to its parent
AUDIT regularly -> Check for missing connections
```

### Behavioral Triggers - MUST LOG WHEN:

| Trigger                      | Log Type           | Example                        |
| ---------------------------- | ------------------ | ------------------------------ |
| User asks for a new feature  | `goal` **with -p** | "Add dark mode"                |
| Choosing between approaches  | `decision`         | "Choose state management"      |
| About to write/edit code     | `action`           | "Implementing Redux store"     |
| Something worked or failed   | `outcome`          | "Redux integration successful" |
| Notice something interesting | `observation`      | "Existing code uses hooks"     |

### CRITICAL: Capture VERBATIM User Prompts

**Prompts must be the EXACT user message, not a summary.** When a user request triggers new work,
capture their full message word-for-word.

**BAD - summaries are useless for context recovery:**

```bash
# DON'T DO THIS - this is a summary, not a prompt
deciduous add goal "Add auth" -p "User asked: add login to the app"
```

**GOOD - verbatim prompts enable full context recovery:**

```bash
# Use --prompt-stdin for multi-line prompts
deciduous add goal "Add auth" -c 90 --prompt-stdin << 'EOF'
I need to add user authentication to the app. Users should be able to sign up
with email/password, and we need OAuth support for Google and GitHub. The auth
should use JWT tokens with refresh token rotation.
EOF

# Or use the prompt command to update existing nodes
deciduous prompt 42 << 'EOF'
The full verbatim user message goes here...
EOF
```

**When to capture prompts:**

- Root `goal` nodes: YES - the FULL original request
- Major direction changes: YES - when user redirects the work
- Routine downstream nodes: NO - they inherit context via edges

**Updating prompts on existing nodes:**

```bash
deciduous prompt <node_id> "full verbatim prompt here"
cat prompt.txt | deciduous prompt <node_id>  # Multi-line from stdin
```

Prompts are viewable in the TUI detail panel (`deciduous tui`) and web viewer.

### ⚠️ CRITICAL: Maintain Connections

**The graph's value is in its CONNECTIONS, not just nodes.**

| When you create... | IMMEDIATELY link to...            |
| ------------------ | --------------------------------- |
| `outcome`          | The action/goal it resolves       |
| `action`           | The goal/decision that spawned it |
| `option`           | Its parent decision               |
| `observation`      | Related goal/action               |

**Root `goal` nodes are the ONLY valid orphans.**

### Quick Commands

```bash
deciduous add goal "Title" -c 90 -p "User's original request"
deciduous add action "Title" -c 85
deciduous link FROM TO -r "reason"  # DO THIS IMMEDIATELY!
deciduous serve   # View live (auto-refreshes every 30s)
deciduous sync    # Export for static hosting

# Metadata flags
# -c, --confidence 0-100   Confidence level
# -p, --prompt "..."       Store the user prompt (use when semantically meaningful)
# -f, --files "a.rs,b.rs"  Associate files
# -b, --branch <name>      Git branch (auto-detected)
# --commit <hash|HEAD>     Link to git commit (use HEAD for current commit)

# Branch filtering
deciduous nodes --branch main
deciduous nodes -b feature-auth
```

### ⚠️ CRITICAL: Link Commits to Actions/Outcomes

**After every git commit, link it to the decision graph!**

```bash
git commit -m "feat: add auth"
deciduous add action "Implemented auth" -c 90 --commit HEAD
deciduous link <goal_id> <action_id> -r "Implementation"
```

The `--commit HEAD` flag captures the commit hash and links it to the node. The web viewer will show
commit messages, authors, and dates.

### Git History & Deployment

```bash
# Export graph AND git history for web viewer
deciduous sync

# This creates:
# - docs/graph-data.json (decision graph)
# - docs/git-history.json (commit info for linked nodes)
```

To deploy to GitHub Pages:

1. `deciduous sync` to export
2. Push to GitHub
3. Settings > Pages > Deploy from branch > /docs folder

Your graph will be live at `https://<user>.github.io/<repo>/`

### Branch-Based Grouping

Nodes are auto-tagged with the current git branch. Configure in `.deciduous/config.toml`:

```toml
[branch]
main_branches = ["main", "master"]
auto_detect = true
```

### Audit Checklist (Before Every Sync)

1. Does every **outcome** link back to what caused it?
2. Does every **action** link to why you did it?
3. Any **dangling outcomes** without parents?

### Session Start Checklist

```bash
deciduous nodes    # What decisions exist?
deciduous edges    # How are they connected? Any gaps?
git status         # Current state
```

### Multi-User Sync

Share decisions across teammates:

```bash
# Export your branch's decisions
deciduous diff export --branch feature-x -o .deciduous/patches/my-feature.json

# Apply patches from teammates (idempotent)
deciduous diff apply .deciduous/patches/*.json

# Preview before applying
deciduous diff apply --dry-run .deciduous/patches/teammate.json
```

PR workflow: Export patch → commit patch file → PR → teammates apply.
