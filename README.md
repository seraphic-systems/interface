# Seraph Zero application

This repo contains the React UI at `src/` and the TypeScript node core at
[`packages/core/`](packages/core/README.md). The private Markdown collection lives
in the separate `seraph-zero-nodes` repository. UI and core can change together;
content history stays in its own repo.

## UI

```sh
npm ci
npm run dev
npm test
npm run build
```

The UI currently uses its existing starter data. The core tooling has migrated
to TypeScript; connecting the UI to the public dataset is separate work.

## Core and local content

Node.js 22.12 or newer is required. The core package is an npm workspace; Python
is no longer needed.

```sh
npm ci
npm run build:core
npm run validate:nodes -- ../seraph-zero-nodes/nodes
npm run export:public -- ../seraph-zero-nodes/nodes --output /tmp/seraph-public/nodes.json
npm run test:core
npm run check:contracts
```

`npm test` runs both core and UI tests. `npm run build` builds both packages.
Core has separate browser-safe and Node.js entry points; see its
[README](packages/core/README.md) for record APIs and generated types.

Keep private content checkouts, credentials, and logs outside public assets.
When connecting a deployment, export in a trusted environment and deliver only
the successful public snapshot to `public/data/nodes.json`. Never deploy an old
snapshot after a failed export. Generated snapshots are ignored by Git.

## Content repository CI

The content repo's thin workflow installs this core package from a pinned commit.
After committing and pushing this refactor, set that repo's GitHub Actions
variable `SERAPH_CORE_REF` to the full 40-character application commit SHA. Update
that pin intentionally when adopting model/tooling changes. Until configured,
content CI fails with a setup message rather than using an unpinned branch.
If this application repo is private, also configure `SERAPH_CORE_READ_TOKEN` as a
secret in the content repo with read-only access to this application repo.
No publishing or remote configuration is performed by the refactor itself.
