# API Migratinator

## M.O.A.T. — Migrate Old APIs Today

A scripted migration tool for moving large customer API Builder assets to V12 Spec Hub, using the git repo as the source of truth.

```
moat migrate
moat discover
moat status
```

---

## Setting Up for Dev

To test the migration tool end-to-end you need a Postman workspace populated with git-linked API Builder APIs. Follow the steps below to create a realistic test environment.

### Prerequisites

- A Postman account with API Builder access (Enterprise plan or Professional Services sandbox)
- Admin-level Postman API key — generate one at **Postman → Settings → API Keys**
- One or more test git repos on GitHub, GitLab, or Bitbucket (one repo per API is the typical customer pattern, but a monorepo with subdirectories also works)
- The repos must be accessible to your Postman account via a connected git integration

### 1. Connect your git provider to Postman

If you haven't already:

1. In Postman, go to **Settings → Integrations**
2. Add a GitHub (or GitLab / Bitbucket) integration and authorize Postman to access your repos
3. Confirm the integration shows as active before proceeding

### 2. Seed your test repos

Each test repo needs at minimum:

```
/
├── openapi.yaml          # or openapi.json — an OpenAPI 2/3 or AsyncAPI spec
└── postman/
    └── collections/
        └── my-api.json   # a v2.1 collection (the migration will convert this to v3)
```

You can use any valid OpenAPI spec. A minimal example is in [`docs/sample-spec.yaml`](docs/sample-spec.yaml). Create as many repos (or subdirectories) as you want to simulate `n` APIs.

### 3. Create git-linked APIs in API Builder

Repeat the following for each test API you want to migrate:

1. In Postman, open the target workspace and go to **APIs** in the left sidebar
2. Click **+** to create a new API — give it a meaningful name (e.g. `test-api-01`)
3. On the API overview page, click the **Repository** tab
4. Click **Connect Repository** and select your git provider
5. Choose the **organization**, **repository**, and **branch** (e.g. `main`)
6. Set the **Schema directory** to the folder containing your spec file (e.g. `/` or `/specs`)
7. Set the **Collection directory** to `postman/collections`
8. Click **Connect** — Postman will pull the schema from the repo
9. Publish at least one version: go to the **Overview** tab → **Publish** → name it `v1.0.0`

Repeat until you have enough APIs to exercise the tool at the scale you want to test.

### 4. Configure the tool

The tool auto-discovers all workspaces and APIs scoped to the provided API key — no workspace IDs required. A new dedicated workspace is created per API during migration, since V12 links one workspace to one git repo.

`moat` looks for config in this order, using the first file it finds:

| Location | When to use |
|---|---|
| `./moat.config.json` | Project-level override (checked first) |
| `~/.moat.config.json` | Global config — set once, works from any directory |

If installed globally, create `~/.moat.config.json` in your home directory:

```json
{
  "postmanApiKey": "your-admin-api-key",
  "gitToken": "your-github-or-gitlab-pat",
  "workspacePattern": "{workspace} - {spec}"
}
```

Env vars always take precedence over both config files — useful for CI/CD:

```
POSTMAN_API_KEY=your-admin-api-key
GIT_TOKEN=your-github-or-gitlab-pat
```

#### Workspace naming pattern

Each migrated API gets its own new Postman workspace. The `workspacePattern` controls how it is named using tokens from the source API's metadata:

| Token | Description | Example |
|---|---|---|
| `{workspace}` | Source workspace name | `Payments Team` |
| `{spec}` | API Builder API name | `Payments API` |
| `{repo}` | Git repository name | `payments-api` |
| `{org}` | Git organisation or owner | `acme-corp` |
| `{branch}` | Git branch | `main` |

The pattern can also be passed as a CLI flag, which takes precedence over the config file:

```bash
moat migrate --workspace-pattern "{org}/{repo}"
```

Precedence: **CLI flag → env var → moat.config.json → default (`{workspace} - {spec}`)**

`moat discover` will perform a collision check on generated workspace names before any migration runs and will warn if duplicates are detected.

### 5. Verify your setup

Once the tool is built, you can do a dry-run discovery to confirm it can see all your workspaces and APIs before triggering any migration:

```bash
# coming soon
moat discover
```

This will page through all workspaces in your team, list every API Builder API found, indicate whether each is git-linked, check for workspace name collisions using your configured pattern, and print the resolved repo metadata — without making any changes.

---

## Architecture

See [`docs/design.md`](docs/design.md) for the full migration design.

## Development

```bash
npm install
npm run build
npm test
```
