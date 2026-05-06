# API Migratinator

## M.O.A.T. — Migrate Old APIs Today

A scripted migration tool for moving large customer API Builder assets to V12 Spec Hub. Supports both non-git-linked APIs (Path B) and git-linked APIs (Path A).

```
moat discover
moat migrate
moat status
```

---

## Commands

### `moat discover`

Pages through all workspaces scoped to your API key, lists every API Builder API found, indicates whether each is git-linked, checks for workspace name collisions using your configured pattern, and prints resolved workspace names — without making any changes.

```bash
moat discover
moat discover --output json   # machine-readable output
```

### `moat migrate`

Migrates API Builder APIs to Spec Hub. Resumes automatically from a checkpoint if interrupted.

```bash
moat migrate                          # migrate all APIs
moat migrate --non-git                # migrate only non-git-linked APIs (Path B)
moat migrate --api-id <id>            # migrate a single API by ID
moat migrate --dry-run                # preview what would be migrated, no changes made
moat migrate --concurrency <n>        # parallel migrations (default: 5)
moat migrate --checkpoint <path>      # checkpoint file path (default: .moat-checkpoint.json)
moat migrate --workspace-pattern <p>  # override workspace naming pattern
```

After each run, `.moat-workspaces.json` is written with the IDs of all workspaces created. Use the cleanup script to delete them between test runs (see below).

Re-running `moat migrate` after a partial run will automatically retry any failed APIs and skip already-completed ones.

### `moat status`

Reads the checkpoint file and reports migration progress without making any changes.

```bash
moat status
moat status --checkpoint <path>
```

---

## Configuration

`moat` looks for config in this order, using the first file it finds:

| Location | When to use |
|---|---|
| `./moat.config.json` | Project-level override (checked first) |
| `~/.moat.config.json` | Global config — set once, works from any directory |

```json
{
  "postmanApiKey": "your-admin-api-key",
  "gitToken": "your-github-or-gitlab-pat",
  "workspacePattern": "{workspace} - {spec}"
}
```

Env vars always take precedence over config files — useful for CI/CD:

```bash
export POSTMAN_API_KEY=your-admin-api-key
export GIT_TOKEN=your-github-or-gitlab-pat
```

> `GIT_TOKEN` is only required when migrating git-linked APIs (Path A). You can run `moat discover` and `moat migrate --non-git` with just `POSTMAN_API_KEY`.

### Workspace naming pattern

Each migrated API gets its own new Postman workspace. The `workspacePattern` controls how it is named:

| Token | Description | Example |
|---|---|---|
| `{workspace}` | Source workspace name | `Payments Team` |
| `{spec}` | API Builder API name | `Payments API` |
| `{repo}` | Git repository name | `payments-api` |
| `{org}` | Git organisation or owner | `acme-corp` |
| `{branch}` | Git branch | `main` |

Precedence: **CLI flag → env var → moat.config.json → default (`{workspace} - {spec}`)**

---

## Migration paths

### Path B — Non-git-linked APIs

APIs without a connected git repository are migrated directly via the Postman `spec-migrations` endpoint. The API spec is moved server-side — no file fetching or manual workspace creation required.

APIs with no schema are automatically skipped. APIs with an unsupported definition type (e.g. WSDL) are also skipped and will not be retried.

### Path A — Git-linked APIs

APIs connected to a GitHub, GitLab, or Bitbucket repository are migrated using the same `spec-migrations` endpoint with git metadata, followed by a `postman workspace push` to sync changes. Requires `GIT_TOKEN` and the Postman CLI to be installed.

---

## Debugging

Prefix any command with `MOAT_DEBUG=1` to log every HTTP request URL, response keys, and error response bodies:

```bash
MOAT_DEBUG=1 moat migrate --api-id <id>
```

---

## Cleanup script

After test runs, delete all workspaces recorded in `.moat-workspaces.json`:

```bash
node scripts/cleanup-workspaces.js           # shows list, prompts before deleting
node scripts/cleanup-workspaces.js --yes     # deletes immediately without prompt
node scripts/cleanup-workspaces.js --file <path>  # use a different log file
```

The script reads the API key from `moat.config.json` automatically, falling back to the `POSTMAN_API_KEY` env var.

---

## Setting up a test environment

### Non-git APIs (Path B)

Any API Builder API that has a schema attached can be migrated via Path B. No git setup required. Run `moat discover` to see what's available in your team, then:

```bash
moat migrate --non-git --dry-run   # preview
moat migrate --non-git             # run
```

### Git-linked APIs (Path A)

To test Path A you need API Builder APIs connected to a git repository.

#### Prerequisites

- A Postman account with API Builder access (Enterprise plan or Professional Services sandbox)
- Admin-level Postman API key
- One or more test git repos on GitHub, GitLab, or Bitbucket
- The repos must be accessible via a connected git integration in Postman
- Postman CLI installed: `npm install -g postman-cli`

#### Repo structure

Each test repo needs at minimum:

```
/
├── openapi.yaml          # OpenAPI 2/3 or AsyncAPI spec
└── postman/
    └── collections/
        └── my-api.json   # a v2.1 collection
```

#### Creating git-linked APIs in API Builder

1. In Postman, open the target workspace and go to **APIs** in the left sidebar
2. Click **+** to create a new API
3. On the API overview page, click the **Repository** tab
4. Click **Connect Repository** and select your git provider
5. Choose the **organization**, **repository**, and **branch**
6. Set the **Schema directory** to the folder containing your spec file (e.g. `/`)
7. Set the **Collection directory** to `postman/collections`
8. Click **Connect**

---

## Development

```bash
npm install
npm run build
npm test
```
