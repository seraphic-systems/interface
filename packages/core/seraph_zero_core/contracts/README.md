# Public node data contract

Version 1 is a read-only publication snapshot for the frontend.
The source Markdown and its schemas remain the authoring contract. The public
projection is deliberately separate: a public node can depend on private nodes
that a visitor must not learn about.

## Export

After installing this core package (see ../../README.md):

```sh
seraph-export /path/to/nodes --output dist/nodes.json
# Or supply another complete source collection, or emit JSON to stdout:
seraph-export /path/to/nodes --output /path/to/frontend/public/data/nodes.json
seraph-export /path/to/nodes
```

The complete source collection is validated first, including private nodes and
graph invariants. Invalid source data fails the command. Only records whose
visibility is explicitly `public` are exported. An empty public snapshot is valid.

The exporter writes UTF-8 JSON, with nodes sorted by ID and edges sorted by
source, field, and target. Identical input produces identical bytes. It includes
no timestamps, source paths, private counts, private IDs, or repository metadata.
Output files must be JSON outside the source directory. A successful export
atomically replaces the complete file, including when the public set is empty.
A failed export exits nonzero, emits no dataset on stdout, and leaves an existing
output file untouched. Deploy only after a successful command; an old file is
not evidence that the new export succeeded.

## Dataset shape

```json
{
  "schemaVersion": 1,
  "nodes": [
    {
      "id": "aim-community",
      "type": "Aim",
      "title": "Community",
      "properties": {"values": [], "direction": "Gather people"},
      "content": "Public Markdown body.\n"
    }
  ],
  "edges": []
}
```

- `schemaVersion` is the public contract version, independent of source revisions.
- Each node has `id`, `type`, `title`, `properties`, and `content`, with optional
  `presentation` (`icon` and/or `cover`). Visibility is omitted: every exported
  node is public. Defaults are not inserted into individual properties.
- Specialized types retain their declared properties and individual field
  constraints. Source property-level workflow conditions are not part of this
  projection. Non-reference required fields remain required.
- Structured references are declared by the source schemas' `x-node-type`
  annotation. A scalar reference to a private node is omitted. A reference list
  keeps only public targets in source order and may become empty, even if the
  source requires at least one item. Absent source fields stay absent.
- Plain `Node` custom properties are **not exported** in v1: they have no declared
  publication or relationship semantics. Their public `properties` is `{}`.
  Opt custom fields into an explicit contract before publishing them.
- An edge has `source`, `field`, and `target`. `field` is the direct property
  name, e.g. `values`, `bet`, or `related_nodes`. Edges represent structured
  references only; wiki links and prose do not produce edges.

[public-nodes.schema.json](public-nodes.schema.json) is a standalone JSON Schema
2020-12 document with no external dependencies. Enable date format checking
explicitly in validators. [public-nodes.d.ts](public-nodes.d.ts) contains generated
TypeScript types, including a discriminated `PublicNode` union and `PublicDataset`.
TypeScript types do not perform runtime validation or enforce numeric ranges.

The exporter also enforces collection invariants beyond standard JSON Schema:
IDs are unique, all structured references resolve within the public dataset to
the expected types, and the edge set exactly matches those references. Consumers
must not interpret missing relationships as evidence that no relationship exists
in the private source. Build backlinks and search indexes only from this snapshot.

## Text and assets

Text is preserved, not silently rewritten. The exporter rejects detected private
node IDs in exported strings and rejects `[[id]]`, `[[id|label]]`, or
`[[id#heading|label]]` wiki links whose target is not an exported public ID. This
check is conservative and also applies in code blocks and presentation strings.
Wiki links must use exact node IDs. The error requires editing the public prose
or intentionally making the referenced node public; publishing one node never
automatically publishes another.

These checks are not a general privacy scrubber. Review titles, prose, property
text, URLs, Markdown links, and presentation fields before marking a node public.
Private titles mentioned without IDs, relative links to private source files,
and sensitive information in ordinary prose cannot reliably be identified here.
The exporter does not copy, fetch, inspect, or approve images or attachments.
Presentation URLs and Markdown asset references are strings only; publish assets
through a separately reviewed process. Render Markdown safely in the frontend,
and resolve wiki links using only the public ID lookup.

## Frontend consumption

Import the generated declarations from this package in the frontend and deliver
the JSON to `public/data/nodes.json` as part of a trusted build:

```ts
import type { PublicDataset } from '../packages/core/seraph_zero_core/contracts/public-nodes';

const response = await fetch('/data/nodes.json');
if (!response.ok) throw new Error('Could not load nodes');
// For data outside your trusted export pipeline, validate against the JSON Schema.
const data: PublicDataset = await response.json();
if (data.schemaVersion !== 1) throw new Error('Unsupported node dataset version');
const byId = new Map(data.nodes.map(node => [node.id, node]));
```

Use IDs for routes, URL-encoding each ID as a path segment. Handle absent scalar
references and empty reference lists. Rebuild or refresh the public snapshot when
content changes. A trusted build should pass only this export to frontend code;
do not put private Markdown, source checkouts, credentials, or logs in browser
assets or the public website repo. A public-to-private change removes a node and
its edges on the next successful deployment; it cannot retract earlier copies.

## Contract changes

The source schemas are authoritative for field definitions. Regenerate both
public contract files after changing them:

```sh
seraph-generate-contract
seraph-generate-contract --check
python -m unittest discover -s tests -v
seraph-validate /path/to/nodes
seraph-export /path/to/nodes --output dist/nodes.json
```

Commit generated schema/types in the application repo together with the generator, documentation, and
tests. CI checks that generated files are current. Breaking changes to public
field types, removals, or relationship semantics require a new `schemaVersion`
and corresponding consumer migration; additions still need a compatibility review.
This change provides the contract and local exporter, not deployment automation.
