# Node

`Node` is the base type for every object in the world. Each node has its own
identity and can combine presentation, structured data, and freeform content.
A page is one possible view of a node.

## Identity

| Field   | Type   | Required | Meaning                                                     |
| ------- | ------ | -------- | ----------------------------------------------------------- |
| `id`    | string | yes      | Stable, unique identity, independent of title or file path. |
| `type`  | string | yes      | `Node`, or a specialized type that extends `Node`.          |
| `title` | string | yes      | Human-readable name; titles do not need to be unique.       |

## Visibility

| Field        | Type   | Required | Meaning                                                       |
| ------------ | ------ | -------- | ------------------------------------------------------------- |
| `visibility` | enum   | no       | `private` or `public`; defaults to `private` when omitted.     |

`private` limits access to the node's owner and explicitly authorized people.
`public` allows anyone to view the node. Visibility does not grant permission
to edit the node or change the visibility of nodes it references.

Visibility is a top-level base field, separate from presentation and structured
properties, and is inherited by every specialized type.

## Presentation

`presentation` is an optional object on the base type, independent of the
specialized type's property schema. For now, it supports two optional fields:

| Field   | Type   | Meaning                                                |
| ------- | ------ | ------------------------------------------------------ |
| `icon`  | string | An emoji or an image reference (a URI or file path).   |
| `cover` | string | An image reference (a URI or file path) for the cover. |

Omitting either field leaves that visual unspecified. Image paths are relative
to the node's Markdown file unless absolute. Presentation can gain more fields
later without changing a node's identity, properties, or content.

## Properties

| Field        | Type   | Required | Meaning                                                                |
| ------------ | ------ | -------- | ---------------------------------------------------------------------- |
| `properties` | object | no       | Structured values keyed by property name; defaults to an empty object. |

## Content

| Field     | Type     | Required | Meaning                                   |
| --------- | -------- | -------- | ----------------------------------------- |
| `content` | Markdown | no       | Freeform body; defaults to empty content. |

In a Markdown file, `content` is the body after the YAML frontmatter, rather than
a frontmatter field. Base fields are reserved and live outside `properties`.

## Structured schemas

The machine-readable contract is [JSON Schema](../../seraph_zero_core/schemas/node.schema.json),
with a shared base and one schema per specialized type in [schemas/](../../seraph_zero_core/schemas/).
Those files are authoritative for structural validation; these Markdown pages
explain the fields, examples, and workflow. Change the schema and its explanatory
documentation together. See the [validation instructions](../../README.md).

The `type` selects the property schema from the world. `Node` itself has no
required properties and permits arbitrary property names. Specialized types
inherit every base field and define their allowed property names, value types,
and any required properties. Fields not declared by a specialized schema are
invalid unless that schema explicitly permits additional properties.

Property types can include strings, numbers, booleans, dates, enumerations,
references to other nodes, and lists of those values. A node reference uses the
target node's `id`, so renaming or moving a node does not break the relationship.
Dates use ISO 8601 strings. A missing optional property means no value has been
set; `null` is only valid if the schema explicitly allows it.

A schema constrains structured properties, not presentation or the freeform
body. A node can have properties without content, content without properties,
or both. Changing its type requires its properties to satisfy the new schema.

## Plain node example

```markdown
---
id: node-work-notes
type: Node
title: Work notes
visibility: private
presentation:
  icon: "✦"
---

Some thoughts that do not need a schema yet.

## Ideas

- Make work feel beautiful and fun.
```

## Specialized node example

For a future `Project` type whose schema declares `status` as an enumeration
(`planned`, `active`, `done`) and `owner` as a reference to a `Person` node:

```markdown
---
id: project-star-0
type: Project
title: Star 0
visibility: public
presentation:
  icon: "🌟"
  cover: ./assets/star-0-cover.jpg
properties:
  status: active
  owner: person-tim
---

## Vision

A place where work can flow.

## Notes

Keep the structured fields small; let the body hold the evolving thinking.
```

The example assumes that `person-tim` identifies an existing `Person` node and
the cover image exists at the referenced path.
`Project` and `Person` schemas are examples, not types defined by this document.

## Planning types

The planning system separates observable goals from competing plans:

**Values → Aims (optional) → Outcomes → Bets → Tasks**

Every type below extends `Node`. Its schema table describes fields inside
`properties`; identity, visibility, presentation, and Markdown content follow
the base schema above. The repository validator checks node structure and
relationships. Tracking, signal reading, and inference remain future work.

| Type | Schema | Purpose | Review cadence |
| ---- | ------ | ------- | -------------- |
| `Value` | [Values](values/index.md) | Stable aspirations and guardrails. | Yearly |
| `Aim` | [Aims](aims/index.md) | Optional qualitative, long-horizon direction. | Yearly |
| `Outcome` | [Outcomes](outcomes/index.md) | Observable goals with a signal and target. | Quarterly |
| `Bet` | [Bets](bets/index.md) | Predictions about plans that might move an outcome. | Weekly |
| `Task` | [Tasks](tasks/index.md) | Flat Build or Learn work with a checklist. | Daily |
| `Assumption` | [Assumptions](assumptions/index.md) | Beliefs that bets depend on. | When evidence changes |
| `Sensor` | [Sensors](sensors/index.md) | Sources of observations for outcome signals. | On its configured cadence |
| `Playbook` | [Playbooks](playbooks/index.md) | Templates for routine tasks. | When routine work changes or fails |
| `Decision` | [Decisions](decisions/index.md) | Major choices with context, rationale, alternatives, and consequences. | When evidence or constraints change |

Decisions can concern any node or stand on their own. They record why a choice
was made alongside the planning hierarchy, rather than adding another level to it.

### Shared conventions

- References are node IDs, never file paths or titles. A `reference<Value>`, for
  example, must resolve to a node whose type is `Value`.
- Lists of references contain distinct IDs. Required lists must be nonempty.
  Optional lists may be omitted or empty. Objects in lists are embedded data,
  not independently tracked nodes.
- Hierarchical links point upward. Children and dependents are found through
  those links rather than maintained as duplicate lists on parents. Hierarchies
  cannot contain cycles.
- Every Outcome serves at least one Value, directly or through its Aims. Aims
  can be introduced later without changing the rest of the hierarchy.
- `confidence` is `low`, `medium`, or `high`. Bet scores are integers from 1 to
  3; no aggregate scoring formula is prescribed.
- Work uses `backlog` → `in_progress` → `done` → `checked`. For Bets, `done`
  means the work finished; `checked` means its result was compared with its
  prediction. A Bet's `status` (`active` or `parked`) is a separate choice about
  which plan to pursue.
- Prediction error sets the review agenda. Worse-than-expected Bets flag their
  Outcome; weakened Assumptions flag dependent Bets. Quarterly reviews check
  whether achieved Outcomes actually served their Values (the Goodhart check).
- Full event history, live signal ingestion, automatic flags, and proposed
  plans are future implementation concerns. Preserve predictions, evidence,
  and review decisions in node content in the meantime; do not silently replace
  earlier reasoning when a plan changes.
- Use a Decision for a major choice that deserves a durable explanation. Link
  it to the affected nodes and preserve accepted reasoning when a later Decision
  supersedes it; routine review notes can stay in node content.

Examples in the type schemas use illustrative IDs. Those references must
resolve to real nodes when the examples are used as records.
