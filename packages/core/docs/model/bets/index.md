# Bet

`Bet` extends [Node](../index.md). It is a plan with a prediction that can be
checked. Alternative Bets compete to achieve the same Outcome.

## Properties

| Field | Type | Required | Meaning |
| ----- | ---- | -------- | ------- |
| `outcome` | reference<Outcome> | conditional | Goal for a top-level Bet; mutually exclusive with `parent_bet`. |
| `parent_bet` | reference<Bet> | conditional | Parent plan for a nested Bet; mutually exclusive with `outcome`. |
| `expectation` | string | yes | A “We expect…” prediction, with a measurable change and assessment window. |
| `confidence` | enum | yes | `low`, `medium`, or `high`. |
| `key_unknowns` | list<string> | no | Open questions; omit or use an empty list when none are known. |
| `assumptions` | list<reference<Assumption>> | no | Beliefs this plan depends on; structured counterparts to key unknowns. |
| `impact` | integer | yes | 1–3: how much this plan should move its goal. |
| `learning` | integer | yes | 1–3: how much uncertainty it should reduce. |
| `cost` | integer | yes | 1–3: effort or risk; higher means more costly. |
| `guardrail_risk` | boolean | yes | Does this plan risk violating any guardrail Value? |
| `guardrail_values` | list<reference<Value>> | conditional | Guardrails at risk; nonempty when `guardrail_risk` is `true`. |
| `guardrail_discussion` | string | no | Discussion, decision, and any mitigation for a reported risk. |
| `status` | enum | yes | `active` or `parked`: selection among competing plans. |
| `stage` | enum | yes | `backlog`, `in_progress`, `done`, or `checked`: work and evaluation progress. |
| `observed_result` | string | conditional | What actually happened, with evidence; required at `checked`. |
| `surprise` | enum | conditional | `as_expected`, `better_than_expected`, or `worse_than_expected`; required at `checked`. |
| `review_required` | boolean | no | Explicit flag for a changed belief or prediction error; defaults to `false`. |

Exactly one of `outcome` and `parent_bet` is required. No additional properties
are allowed. `guardrail_values` may only reference Values with `kind: guardrail`.
An absent optional result means it has not yet been recorded, not that the
prediction was met.

## Depth and alternatives

Nested Bets inherit their ultimate Outcome through their parent chain. Each
level must earn its place with a distinct uncertainty, prediction, and review
timescale. Size alone does not justify a nested Bet. Parent chains cannot cycle.

For alternatives under the same Outcome or parent Bet, select one active Bet
and park the others. Multiple nested Bets may support a parent plan when they
address different uncertainties rather than compete as alternatives. Explain
that distinction in the body.

## Execution and close-out

- A low-confidence Bet begins with Learn tasks addressing its key unknowns
  before Build tasks begin. Record what was learned and reassess confidence.
- A guardrail risk blocks activation and execution until discussed. Record
  the decision and mitigation in `guardrail_discussion`; if the risk remains
  unacceptable, keep the Bet parked. Scores never override this check.
- Work completion moves the Bet to `done`. Comparison of the prediction with
  an observed result and surprise moves it to `checked`. Checkpoints can also
  record results while work is still in progress.
- `as_expected` means the result matched the prediction; `better_than_expected`
  and `worse_than_expected` record its direction relative to that prediction.
- A worse-than-expected result flags the ultimate Outcome for review, including
  when this Bet is nested. Revisit parent predictions when child evidence
  undermines them. A weakened Assumption flags every dependent Bet.

Review weekly: keep the current plan, switch to a parked alternative, or add a
Learn task when evidence is insufficient. Keep dated predictions, checkpoint
results, and decisions in the body. These are manual rules until a tracker
implements flag propagation and event history.

## Example

```markdown
---
id: bet-watermark-free-tier
type: Bet
title: Free tier with a watermark
properties:
  outcome: outcome-plugin-wau
  expectation: We expect a free tier with a watermark to add 150 WAU within 6 weeks
  confidence: low
  key_unknowns:
    - Will free users convert to paid users?
  assumptions:
    - assumption-free-tier-demand
  impact: 3
  learning: 3
  cost: 2
  guardrail_risk: false
  status: active
  stage: backlog
---

## Plan

Start with pricing interviews and a landing-page test, then reassess before Build.
```
