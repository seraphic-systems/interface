# Decision

`Decision` extends [Node](../index.md). It records a major choice and why it
made sense at the time, including the alternatives and tradeoffs. Use it when
future readers would benefit from understanding why a direction was chosen.

## Properties

| Field | Type | Required | Meaning |
| ----- | ---- | -------- | ------- |
| `status` | enum | yes | `proposed`, `accepted`, `rejected`, or `superseded`. |
| `context` | string | yes | Problem, constraints, and relevant facts that call for a decision. |
| `decision` | string | yes | Specific choice being proposed or recorded. |
| `rationale` | string | yes | Why this choice fits the context and is preferable to the alternatives. |
| `consequences` | list<string> | yes | Expected benefits, costs, risks, and obligations; at least one entry. |
| `decision_maker` | string | yes | Accountable person or group; no Person schema is required. |
| `decided_on` | date | conditional | Date the choice was accepted or rejected; required unless `proposed`. |
| `alternatives` | list<object> | no | Other options considered, each with `option` (string) and `tradeoff` (string). |
| `related_nodes` | list<reference<Node>> | no | Nodes affected by or informing this choice, including specialized Node types. |
| `supersedes` | list<reference<Decision>> | no | Earlier accepted Decisions that this choice replaces. |
| `review_when` | string | no | Evidence, conditions, or a date that should trigger reconsideration. |

No additional properties are allowed. Alternative objects permit only `option`
and `tradeoff`, both required. Required strings must contain meaningful text.
`decided_on` uses an ISO 8601 calendar date (`YYYY-MM-DD`); omit it while
`proposed`. For a superseded Decision, it remains the original acceptance date.

## Lifecycle and history

Start at `proposed` when discussion is still open, or create an `accepted`
record to document a choice already made. A rejected proposal keeps its proposed
choice intact; update its rationale to explain why it was rejected and record
the rejection date in `decided_on`. Rejection does not mean an accepted choice
was later reversed.

Once accepted, preserve the original context, choice, rationale, alternatives,
and expected consequences. Add dated evidence and observations in the body.
Correct factual mistakes with a dated explanation. When the choice changes,
create a new Decision, accept it, link it through `supersedes`, and mark the
earlier Decision `superseded`. Even a reversal deserves a new explanation.

Only `accepted` or `superseded` Decisions may have a nonempty `supersedes` list.
Its targets must be `superseded` Decisions that were previously accepted.
Supersession links cannot refer to the same node or form cycles. Find replacement
Decisions by reverse lookup of `supersedes`; do not maintain a duplicate list
on the earlier record. The repository validator checks current statuses,
reference types, self-links, and cycles. Applying transitions and preserving
previously accepted reasoning remain manual responsibilities; validation of a
snapshot cannot prove a Decision's prior status.

## Relationships and review

Decisions sit alongside the planning hierarchy. `related_nodes` can link to
Values, Outcomes, competing Bets, Assumptions, or any other relevant nodes.
These links give context without changing those nodes' schemas or creating
parent-child relationships. A Decision can also stand alone.

Use Bets for uncertain plans and predictions, Tasks for execution, and Decisions
for the explanation of a consequential choice. Accepting a Decision does not
activate a Bet, complete work, satisfy a guardrail check, or prove a prediction.
Update the affected nodes separately and retain their existing review rules.

Record alternatives in proportion to the choice, including doing nothing when
relevant. If no meaningful alternative existed, explain that in the body.
Distinguish evidence from assumptions and expected consequences from observed
results. Review when `review_when` is met or new evidence changes the context;
there is no mandatory recurring review for every Decision.

## Example

This is an illustrative proposal, not a record of an actual decision.

```markdown
---
id: decision-plugin-feedback
type: Decision
title: Use interviews to gather plugin feedback
properties:
  status: proposed
  context: The plugin team needs feedback before choosing a pricing model
  decision: Interview trial users before building a feedback portal
  rationale: Interviews let the team learn before investing in more software
  consequences:
    - Trial users can explain their needs
    - Feedback must initially be summarized manually
    - Someone must recruit and interview users
  decision_maker: Tim
  alternatives:
    - option: Build a feedback portal immediately
      tradeoff: More structured feedback, but more work before learning what users need
    - option: Choose pricing without interviews
      tradeoff: Less research work, but more uncertainty about user needs
  related_nodes:
    - bet-watermark-free-tier
    - outcome-plugin-wau
    - task-pricing-interviews
  review_when: The number of interviews exceeds the team’s capacity
---

## Evidence and discussion

Record user feedback and the constraints considered before accepting or
rejecting this proposal. On acceptance, set status to accepted and add decided_on.

## Follow-up

If accepted, reflect the choice in the interview task checklist. Record later
observations here without rewriting the original rationale.
```
