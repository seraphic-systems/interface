# Task

`Task` extends [Node](../index.md). It is concrete Build or Learn work. Tasks
stay flat: smaller steps are checklist items, never child task tickets.

## Properties

| Field          | Type                | Required    | Meaning                                                                     |
| -------------- | ------------------- | ----------- | --------------------------------------------------------------------------- |
| `bet`          | reference<Bet>      | conditional | Plan this work supports; mutually exclusive with `playbook`.                |
| `playbook`     | reference<Playbook> | conditional | Source of routine work; mutually exclusive with `bet`.                      |
| `playbook_run` | string              | conditional | Shared identifier grouping tasks from one run; required with `playbook`.    |
| `kind`         | enum                | yes         | `build` (make or change something) or `learn` (reduce uncertainty).         |
| `checklist`    | list<object>        | yes         | One or more embedded steps, each with `text` (string) and `done` (boolean). |
| `owner`        | string              | yes         | Accountable person's name or handle; no Person schema is required.          |
| `stage`        | enum                | yes         | `backlog`, `in_progress`, `done`, or `checked`.                             |

Exactly one of `bet` and `playbook` is required. `playbook_run` is only valid
with `playbook`. Checklist objects permit only `text` and `done`. No additional
properties are allowed, including `parent_task` or child-task references.

## Work and review

Review daily. `done` means the checklist work is complete; `checked` means its
completion or findings have been verified. Learn tasks record evidence and what
changed in their body, then update the relevant Bet or Assumption. A task has
no independent prediction or confidence field.

A large but obvious task gets a longer checklist. When it reveals a real
unknown, promote the uncertain work to a Bet with its own prediction and
confidence, then put flat tasks under that Bet. Preserve the original task's
history and explain the promotion in its body.

Routine work can come from a Playbook instead of a Bet. A failed routine run
is a reason to create a Bet and investigate the uncertainty.

## Example

```markdown
---
id: task-pricing-interviews
type: Task
title: Interview five trial users about pricing
properties:
  bet: bet-watermark-free-tier
  kind: learn
  owner: Tim
  stage: backlog
  checklist:
    - text: Recruit five trial users
      done: false
    - text: Ask about free-tier and trial preferences
      done: false
    - text: Summarize evidence and reassess the Bet's confidence
      done: false
---

## Findings

Record evidence here once interviews are complete.
```
