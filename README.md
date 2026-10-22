# Seraph Zero application

This repo contains the React UI at `src/` and the Python node core at
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

The UI currently uses its existing starter data. This refactor relocates the
core tooling; connecting the UI to the public dataset is separate work.

## Core and local content

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e ./packages/core
seraph-validate ../seraph-zero-nodes/nodes
seraph-export ../seraph-zero-nodes/nodes --output /tmp/seraph-public/nodes.json
npm run test:core
npm run check:contracts
```

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
