# Aim

`Aim` extends [Node](../index.md). It provides qualitative, long-horizon
direction between Values and Outcomes. Aims are optional: a small team can
link Outcomes directly to Values.

## Properties

| Field | Type | Required | Meaning |
| ----- | ---- | -------- | ------- |
| `values` | list<reference<Value>> | yes | One or more Values this direction serves. |
| `direction` | string | yes | Qualitative direction, rather than a metric or work plan. |

No additional properties are allowed.

## Relationships and review

An Aim links to Values, never another Aim. Outcomes can reference one or more
Aims. Review yearly to check that the direction still serves its Values;
record the reasoning in the body. Numeric targets belong to Outcomes and
competing plans belong to Bets.

## Example

```markdown
---
id: aim-independent-producers
type: Aim
title: Serve independent producers
properties:
  values:
    - value-creative-flow
  direction: Become the go-to resampling tool for independent producers
---

## Review notes

Consider whether this direction still reflects the musicians we want to serve.
```
