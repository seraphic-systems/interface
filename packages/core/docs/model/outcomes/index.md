# Outcome

`Outcome` extends [Node](../index.md). It describes something observable we
want to see, separately from the plans intended to produce it.

## Properties

| Field | Type | Required | Meaning |
| ----- | ---- | -------- | ------- |
| `values` | list<reference<Value>> | conditional | Direct links to Values served; required if `aims` is empty or absent. |
| `aims` | list<reference<Aim>> | conditional | Links to qualitative directions; required if `values` is empty or absent. |
| `signal` | string | yes | Observable measure, including units and population or time window. |
| `target` | string | yes | Desired condition and any deadline or assessment window. |
| `check_method` | string | yes | How, when, and by whom the signal is checked; a manual method is sufficient. |
| `sensor` | reference<Sensor> | no | Optional source for a future live signal. |
| `transformation` | string | no | How the source observations become this Outcome's signal. |
| `review_required` | boolean | no | Explicit review flag; defaults to `false`. |

At least one of `values` or `aims` must be nonempty; both may be used. Each Aim
must itself link to Values. `transformation` requires `sensor`. No additional
properties are allowed.

## Relationships and review

Several Bets can compete for this Outcome. Keep one active plan at a time for
each set of alternatives and park the others. Completing tasks does not mean
the Outcome succeeded: compare the observed signal with the target.

A worse-than-expected Bet requires this Outcome to be flagged for weekly
review. The review chooses to keep the current Bet, switch to a parked
alternative, or add Learn work. Record the decision and its evidence in the
body before clearing the flag. Automatic flag propagation is a future feature.

Review quarterly whether hitting the target actually served the linked Values.
If it did not, revise the signal or target and preserve the prior reasoning.
Live queries and normalized time series can be added through Sensors later;
this schema does not require that infrastructure.

## Example

```markdown
---
id: outcome-plugin-wau
type: Outcome
title: Weekly active plugin users above 500
properties:
  values:
    - value-creative-flow
  signal: Distinct musicians using the plugin in the trailing 7 days
  target: More than 500 weekly active users at the quarterly review
  check_method: Product owner checks the analytics report every Monday
  review_required: false
---

## Value check

Read user feedback alongside activity: growth should still respect creative flow.
```
