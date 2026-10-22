# Assumption

`Assumption` extends [Node](../index.md). It makes a belief underlying plans
explicit, so new evidence can affect every Bet that depends on it.

## Properties

| Field | Type | Required | Meaning |
| ----- | ---- | -------- | ------- |
| `statement` | string | yes | Belief about a hidden state or how the world works. |
| `confidence` | enum | yes | `low`, `medium`, or `high`. |
| `evidence` | list<string> | no | Evidence summaries or references to docs, specs, research, or observations. |

No additional properties are allowed. Evidence links can be document URLs or
paths; they are not typed node references. Keep their context in the body.

## Relationships and review

Bets reference this node through their `assumptions` list. Its dependent Bets
are the reverse lookup of those references, not a second manually maintained
list. A Bet can still use plain-text `key_unknowns` before an Assumption exists.

Review when Learn tasks or observations produce new evidence. When confidence
drops, flag every dependent Bet with `review_required: true` and record why.
Preserve earlier confidence assessments and their evidence in dated body notes.
Flagging is a manual contract here, not implemented automation.

## Example

```markdown
---
id: assumption-free-tier-demand
type: Assumption
title: Free access will attract musicians who later pay
properties:
  statement: A meaningful share of free-tier users will eventually pay for the plugin
  confidence: low
---

## Evidence

Pricing interviews and the landing-page test will help assess this belief.
```
