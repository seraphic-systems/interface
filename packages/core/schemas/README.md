# Node schemas

These schemas describe the complete private source collection. The separate
[public contract](../contracts/README.md) describes filtered publication data;
its JSON Schema and TypeScript types are generated from these field definitions.
Regenerate them with `npm run generate:contracts` after changes.

`node.schema.json` is the public entry point for JSON Schema draft 2020-12.
It selects exactly one of `Node`, `Value`, `Aim`, `Outcome`, `Bet`, `Task`,
`Assumption`, `Sensor`, `Playbook`, or `Decision` by the top-level `type`.
Unknown types are invalid until explicitly registered here.

`common.schema.json` defines the shared envelope, including `content` as a
string. Each specialized schema combines that envelope with its fixed `type`
and its own closed `properties` object. Plain `Node` permits arbitrary property
names except reserved base field names. Presentation currently permits `icon`
and `cover`; extend the common schema when adding presentation fields.

All references between schema files are relative. The repository validator
registers these files locally and does not fetch schemas over the network.
External consumers should resolve this directory's relative references and
enable date format validation explicitly. A `format: date` annotation alone
does not guarantee enforcement in every JSON Schema implementation.

## Node references

`$ref` links schema definitions, not node records. The custom annotation
`x-node-type` declares the expected target type of a node ID. It is attached
to a scalar reference or to the item schema in a reference list. `Node` as the
expected type accepts every specialized type, too.

Standard JSON Schema validators ignore this annotation. The repository
validator reads it to check node references across the supplied collection.
When adding a reference field, include the annotation and, for a list, set
`uniqueItems: true`. Required reference lists must also set `minItems: 1`.

## Boundaries

Schemas validate the canonical parsed object, not raw Markdown. The loader
requires YAML frontmatter, rejects duplicate keys and non-JSON values, keeps
dates as strings, and attaches the body as `content`. It does not interpret
Markdown links or prose as structured references.

The graph pass checks duplicate IDs, reference existence and type, guardrail
Value kinds, Bet parent cycles, and Decision supersession statuses and cycles.
A valid Outcome reaches Values through a nonempty direct list or through Aims,
whose own nonempty Value lists and references must also validate.

Historical transitions, adequacy of evidence and guardrail discussion, competing
versus complementary Bets, and automatic review flag propagation are workflow
concerns described in the Markdown. They are not inferred from a static node
snapshot. JSON schemas are the authoritative structural contract; keep their
explanatory tables and examples synchronized when editing them.
