# Sensor

`Sensor` extends [Node](../index.md). It describes a source of observations,
such as analytics, revenue, support, CI, telemetry, or review decisions. This is
a small configuration schema for the document's future signal layer; it does
not implement a connector or store observations as properties.

## Properties

| Field | Type | Required | Meaning |
| ----- | ---- | -------- | ------- |
| `connector` | string | yes | Source or integration identifier; `manual` is allowed. |
| `source` | string | yes | Query, report, stream, or document location to read. |
| `cadence` | string | yes | When to read, such as weekly on Monday or after each review. |
| `observation_format` | string | yes | Expected fields, units, and timestamps in source observations. |

No additional properties are allowed. Store source descriptions or query
references here, not credentials or access tokens.

## Relationships and signal contract

Outcomes reference a Sensor and can specify a `transformation` to turn its
observations into their own signal. One Sensor may serve several Outcomes.
An Outcome can also be checked manually without a Sensor node.

A future signal reader should produce a normalized time series with timestamps,
values, units, and source provenance. Missing or stale observations should not
be treated as zero or evidence of success. The inference service would compare
observations with predictions and write surprise flags; views would read the
result. None of that infrastructure is required to use these schemas.

Review decisions and task-completion events can also be observations. Preserve
their timestamps and original evidence in the body until an event store exists.

## Example

```markdown
---
id: sensor-plugin-analytics
type: Sensor
title: Plugin activity report
properties:
  connector: manual
  source: Weekly plugin activity analytics report
  cadence: Every Monday before the weekly Bet review
  observation_format: Week ending date and distinct active musicians over the trailing 7 days
---

## Signal notes

Count each musician once per reporting window.
```
