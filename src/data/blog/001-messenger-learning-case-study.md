---
title: One Year Rebuilding My Understanding of Android Architecture
description: Lessons from a year-long Android showcase project about maintainable architecture, shared ownership, requirements, testing, CI, and AI-assisted development workflows.
slug: one-year-rebuilding-android-architecture
pubDatetime: 2026-05-11T21:29:00Z
modDatetime: 2026-05-16T12:04:14Z
featured: false
draft: false
tags:
  - Android Architecture
  - Case Study
  - Engineering Process
  - Testing
  - AI-Assisted Development
---
My reflection on maintainable Android architecture started around 2021, after repeatedly experiencing how my own spaghetti code led to expensive debugging, difficult onboarding, and growing long-term maintenance costs in real projects.

Over the next few years, I adopted Google’s recommended app architecture in new projects and partially migrated legacy codebases toward it. Later, after reading Clean Architecture by Robert C. Martin, I gained a much deeper understanding of concepts like separation of concerns, dependency inversion, and the Dependency Rule.

I started [Messenger](https://github.com/timurgilfanov/messenger) showcase project as my first attempt to apply these ideas consistently in a production-like environment with long-term architectural evolution in mind.

A few months later, after a failed interview, the project direction expanded. I realized I lacked experience with another class of problems common in larger Android teams: shared ownership, architectural consistency, and development patterns that allow multiple engineers to work in the same codebase predictably.

After a year, the most valuable outcome was not the app itself, but how much my understanding of engineering processes changed.

## Table of contents

## Shared ownership in larger Android teams
Larger Android teams optimize for different things than solo or small-team projects. The challenge is no longer only feature delivery — it becomes coordination, predictability, and consistency.

### Reduce costs of parallel development coordination
When multiple developers work on the same feature in parallel, their changes eventually need to be merged. The more overlapping implementation details they touch, the more coordination and conflict resolution are required.

To reduce this overhead, teams need to agree on clear technical boundaries before implementation begins: APIs and data models.

The next question is how to split work between developers and define ownership boundaries. With horizontal slicing, one developer implements UI while another works on data or domain layers of the same feature. This can reduce short-term coordination inside a layer, but it also creates additional merge points and makes ownership of the complete user experience less clear.

With vertical slicing, a developer owns a sub-feature end-to-end instead of only one technical layer: UI, domain, data flow, and business rules together. For example, in an authentication feature, one developer could own login while another owns session management.

This approach makes feature requirements easier to reason about because the same developer owns the complete behavior of the sub-feature. It also reduces coordination overhead by minimizing the amount of implementation detail that must be synchronized across multiple developers during active development.

### Following the same conventions in the codebase
Shared ownership becomes difficult when architectural decisions exist only in the heads of individual developers. Engineers need to understand not only what the current implementation is, but also why specific trade-offs were made, which constraints existed, what alternatives were considered, and the scope of a rule or decision.

To reduce this coordination overhead, I started documenting decisions with long-term architectural consequences as Architecture Decision Records (ADRs): short documents describing the context, chosen solution, alternatives, and consequences. Writing these documents also improved the decisions themselves because assumptions and trade-offs had to be made explicit.

I also introduced Architecture Rules (ARs) for project-wide patterns that should be applied consistently across the codebase. Unlike ADRs, which capture a decision made at a specific moment in time, rules describe reusable constraints and conventions such as ownership of state updates, side-effect organization, or boundaries between domain and UI layers.

These documents became increasingly useful not only for engineers, but also for coding agents, because both require clear and durable project context to work predictably in a shared codebase.

## UI architecture complexity should match real problems
At the beginning of the project, I did not have a clear understanding of UI architecture: why MVI exists, what problems it solves compared to MVVM, and when its additional complexity is justified.

Because I wanted to try MVI and avoid inventing architecture from scratch, I adopted an external UI architecture dependency and followed its documentation and examples. At that stage, this felt like a reasonable shortcut: the project needed a consistent structure, and the framework appeared to provide one.

For the first months, I mostly treated the chosen architecture as an implementation pattern rather than a set of trade-offs. The consistent structure helped, but I still ran into UI state correctness problems. In one case, concurrent chat updates and text input updates produced subtle ordering issues where stale state could temporarily override newer UI input. In another, trying to store mutable Compose state inside immutable reducers created increasing architectural friction between Compose snapshots and the coroutine-based intent pipeline.

The issue was not that the framework itself was wrong, but that I did not yet understand how to use it correctly when real screen behavior moved beyond the examples described in the documentation.

The deeper reflection started later, after a failed interview about six months into the project. Interview discussions exposed a gap in how I reasoned about Android UI architecture. I was saying that architecture should match screen complexity, but “complexity” was too vague to be useful. I needed a more concrete way to explain which requirements justify additional architectural machinery.

To make this practical, I started from the same example screen requirements and tried implementing them with several UI architecture approaches:
- loose ViewModel state ownership,
- lightweight UDF with `StateFlow` and direct event handlers,
- UDF with explicit ordering guards such as jobs, tokens, and `flatMapLatest`,
- framework-style MVI with intents and reducers,
- MVI-like action/intent/reducer flow without full serialization,
- and finally actor/reducer-based MVI with a single ordered state pipeline. 

Instead of comparing patterns abstractly, I used the number and location of conditions as a pressure point: more scattered conditions usually mean more fragile code.

For each approach, I looked at how many places and conditions were needed to enforce the same ordering rules and how the solution would scale when new requirements were added. This made the trade-off easier to explain: if the same rules require many scattered checks across handlers, callbacks, or reducers, the architecture is absorbing complexity poorly. That conclusion became the basis for an [architecture rule](https://github.com/timurgilfanov/messenger/blob/main/docs/architecture/AR-01-single-authority-for-ordering-rules.md): when actor/reducer-based MVI is used, ordering rules should live in the actor instead of being duplicated across multiple handlers.

After reviewing Messenger’s UI architecture by checking whether each screen actually needed serialized ordering rules, I removed the external UI architecture dependency and moved screens to a lighter UDF style: ViewModels expose immutable UI state through `StateFlow` and one-off side effects through a `Channel`-backed `Flow`. The reviewed screens did not create enough pressure to justify actor/reducer machinery: most only observed state, and the few ordering needs, such as language last-write-wins or chat send/input coordination, could be handled with small localized mechanisms. More complex flows still have a documented path for serialized state coordination when needed. This also made architectural decisions easier to communicate and review, which became increasingly important as I started thinking more about shared ownership and long-term maintainability.

## Requirements should drive architecture
The same pattern appeared at a broader product level. At the beginning of the project, I approached development screen by screen and made product decisions during implementation. This created repeated architectural rework because many technical decisions depended on product rules that had never been defined explicitly.

For example, missing product rules repeatedly caused architectural rework in areas like user identity modeling, synchronization behavior, process death handling, and error modeling. As the intended user experience became clearer, previously reasonable abstractions no longer aligned with the new product requirements and had to be redesigned or split apart.

It was difficult to make low-level implementation decisions, product-level architectural decisions, and MVP scope decisions at the same time.

I paused feature development and started treating the project more like a real product. I wrote a [specification](https://github.com/timurgilfanov/messenger/blob/main/docs/Specification.md) to define the minimum set of features, rules, and constraints needed to support the user experience I wanted to build. It covered business rules, system constraints, UX requirements, and conceptual domain models. After that, I created a roadmap to gradually align the implementation with the specification.

This also changed how I approached architecture itself. Architecture decisions became downstream from product requirements instead of being driven by frameworks, patterns, or implementation convenience.

The specification also became useful when working with coding agents because feature planning discussions could reference documented product rules, constraints, and domain concepts instead of relying only on partially implemented code or implicit assumptions.

## Testing became a staged verification system

As the project grew, I realized that treating testing as simply “run all tests in CI” did not scale well. Different categories of failures required different levels of confidence, execution environments, and runtime costs.

Fast local feedback, pull request validation, emulator-based verification, and release confidence all optimized for different trade-offs. Running every level of verification during every change would slow down development significantly, while relying only on fast tests would leave important regressions undetected until much later.

This pushed me to think about testing less as individual tests and more as a staged verification strategy.

To make these trade-offs explicit, I introduced a [testing strategy](https://github.com/timurgilfanov/messenger/blob/main/docs/Testing%20Strategy.md) document defining:
- which categories of tests should exist,
- what failures they validate,
- where and when they should run,
- and which failures should block merges or releases.

CI gradually evolved into a staged verification pipeline with multiple verification layers optimized for different confidence levels, execution environments, and runtime costs. Instead of simply running “all tests,” the pipeline executes different levels of validation at different stages of development based on the confidence requirements and cost of the change.

## Coding agents changed how I think about implementation workflows

During this project, coding agents gradually became part of my daily development workflow. I started with using Claude Code and later Codex mostly for isolated code generation tasks during implementation.

As the capabilities of the agents evolved, my workflow evolved with them. Instead of treating them only as code generators, I started using them to automate larger parts of implementation work in order to reduce feature development time and improve the quality of the final result.

Many of the practices introduced earlier in the project — architecture rules, specifications, testing strategy, repository conventions, CI checks, and reusable workflows — also made coding-agent workflows more predictable and consistent.

I also experimented with workflows where multiple coding agents reviewed and refined generated changes. At one point, this included using [ralphex](https://github.com/umputun/ralphex), an extended Ralph loop orchestration tool for autonomous plan execution and multi-agent review. The results have been mostly positive, and I use Claude Code directly as a fallback.

This gradually shifted my role away from writing every implementation detail manually and more toward planning, review, and workflow design, while still keeping final responsibility for requirements, architecture, and validation.

## Conclusion 
The most important lesson from this project was that maintainable architecture is not created by adopting specific patterns, frameworks, or libraries. It emerges from making product rules, ownership boundaries, and architectural decisions explicit enough that multiple engineers can evolve the system predictably over time.

Many of the problems I encountered were not caused by incorrect technology choices, but by missing constraints, implicit assumptions, or unclear coordination rules. As the project evolved, architecture became less about finding “correct” abstractions and more about reducing long-term coordination and maintenance costs.

The project itself is still evolving, but after a year, the biggest change was how I think about software engineering: architecture, testing, specifications, and development processes are not separate concerns. They are all mechanisms for helping teams build and change complex systems predictably.
