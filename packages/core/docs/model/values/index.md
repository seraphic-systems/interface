# Value

`Value` extends [Node](../index.md). It states who we are or a line we will not
cross. Values are qualitative and stable; measurable targets belong to Outcomes.

## Properties

| Field | Type | Required | Meaning |
| ----- | ---- | -------- | ------- |
| `statement` | string | yes | The aspiration or boundary in plain language. |
| `kind` | enum | yes | `aspiration` or `guardrail`. |

`kind` expresses the document's value type without colliding with the base
`type: Value`. No additional properties are allowed.

## Relationships and review

Values have no parent. Aims and Outcomes reference the Values they serve;
many-to-many relationships are allowed. Bets assess risk against guardrail
Values, including relevant guardrails outside their Outcome's aspiration links.
A reported risk blocks activation or execution until it has been discussed.

Review yearly: is this still true about who we are? Also revisit the Outcome
proxy when its target is met but this Value does not feel served. Record that
evidence and any decisions in the body.

## Example

```markdown
---
id: value-creative-flow
type: Value
title: Respect creative flow
properties:
  statement: Tools that respect musicians' creative flow
  kind: aspiration
---

Success should feel useful and unintrusive to musicians.
```
