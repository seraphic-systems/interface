# Playbook

`Playbook` extends [Node](../index.md). It is a reusable template for familiar
work, such as a release checklist or client onboarding. Routine work does not
need a Bet's prediction and confidence fields.

## Properties

| Field | Type | Required | Meaning |
| ----- | ---- | -------- | ------- |
| `trigger` | string | yes | When to start a run. |
| `task_templates` | list<object> | yes | Nonempty ordered list of templates used to create flat Tasks. |

Each task template permits exactly these fields:

| Field | Type | Required | Meaning |
| ----- | ---- | -------- | ------- |
| `title` | string | yes | Title for the generated Task. |
| `kind` | enum | yes | `build` or `learn`. |
| `owner` | string | no | Default accountable person; resolve before creating the Task. |
| `checklist` | list<string> | yes | Nonempty list of step descriptions. |

No additional properties are allowed, including prediction or confidence fields.
Templates are embedded data, not tracked task nodes.

## Runs and escalation

For each run, create Tasks with distinct node IDs, a link to this Playbook, and
the same `playbook_run` string. Copy each template's kind and checklist, set
each step's `done` to `false`, assign an owner, and start at `stage: backlog`.
Tasks use the same Build/Learn schema as Bet work but have no `bet` reference.

The intended tracker generates those Tasks automatically. This repository only
defines the contract; runs can be instantiated manually. Preserve run outcomes
and template changes in the body. When a run goes badly because work is no
longer routine, create a Bet with an explicit prediction and new Tasks under it.

## Example

```markdown
---
id: playbook-plugin-release
type: Playbook
title: Plugin release
properties:
  trigger: A tested release candidate is approved for publication
  task_templates:
    - title: Prepare release notes
      kind: build
      checklist:
        - Summarize user-visible changes
        - Check installation and upgrade instructions
---

## Run notes

Record each run's result and any reason the template needs to change.
```
