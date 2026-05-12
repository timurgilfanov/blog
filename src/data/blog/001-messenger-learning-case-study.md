---
title: One Year Rebuilding My Understanding of Android Architecture
description: Lessons from a year-long Android showcase project about maintainable architecture, shared ownership, requirements, testing, CI, and AI-assisted development workflows.
pubDatetime: 2026-05-12T00:29:00Z
featured: true
draft: false
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

## Architecture complexity should match real problems
At the beginning of the project, I did not have a clear understanding of UI architecture: why MVI exists, what problems it solves compared to MVVM, and when its additional complexity is justified.

I adopted an external dependency that implemented UI architecture and followed its documentation and examples. The first major problems appeared when screens started requiring coordination between multiple asynchronous state updates that were not covered by the “happy path” examples from the library. In one case, concurrent chat updates and text input updates produced subtle ordering issues where stale state could temporarily override newer UI input. In another, trying to store mutable Compose state inside immutable reducers created increasing architectural friction between Compose snapshots and the coroutine-based intent pipeline.

Without understanding the guarantees and constraints introduced by the architecture, it became difficult to reason about how state changes propagated through the UI and how concurrent operations interacted with each other.

During one interview, I realized I could not clearly explain the architectural trade-offs behind different UI architecture approaches and examples. That pushed me to study this area more deeply: MVVM, MVI, actor/reducer patterns, state ownership, and concurrency coordination in UI state management.

The practical result was not switching from one “correct” architecture to another, but understanding which concrete engineering problems different approaches solve. As part of this process, I wrote an [architecture rule](https://github.com/timurgilfanov/messenger/blob/main/docs/architecture/AR-01-single-authority-for-ordering-rules.md) describing when actor/reducer-based MVI is justified for ordering invariants and when simpler approaches are enough.

Eventually, I migrated the application from a dependency-heavy MVI solution to a lighter custom implementation without external architectural dependencies. Screens without complex coordination requirements now use simpler state management, while more complex flows still have a clear path for serialized state coordination when needed. This also made architectural decisions easier to communicate and review, which became increasingly important as I started thinking more about shared ownership and long-term maintainability.

## Requirements should drive architecture
At the beginning of the project, I approached development screen by screen and made product decisions during implementation. This created repeated architectural rework because many technical decisions depended on product rules that had never been defined explicitly.

For example, missing product rules repeatedly caused architectural rework in areas like user identity modeling, synchronization behavior, process death handling, and error modeling. As the intended user experience became clearer, previously reasonable abstractions no longer aligned with the new product requirements and had to be redesigned or split apart.

It was difficult to make low-level implementation decisions, product-level architectural decisions, and MVP scope decisions at the same time.

I paused feature development and started treating the project more like a real product. I wrote a [specification](https://github.com/timurgilfanov/messenger/blob/main/docs/Specification.md) to define the minimum set of features, rules, and constraints needed to support the user experience I wanted to build. It covered business rules, system constraints, UX requirements, and conceptual domain models. After that, I created a roadmap to gradually align the implementation with the specification.

This also changed how I approached architecture itself. Architecture decisions became downstream from product requirements instead of being driven by frameworks, patterns, or implementation convenience.

The specification also became useful when working with coding agents because feature planning discussions could reference documented product rules, constraints, and domain concepts instead of relying only on partially implemented code or implicit assumptions.

## Testing became a staged verification system

I started building automated testing and CI from the beginning of the project because even relatively small applications accumulate more behaviors and interactions than engineers can reliably validate manually during every change.

At first, testing seemed straightforward: write unit and integration tests and run them in CI before merge. As the project grew, this approach stopped scaling well. Different kinds of failures required different levels of confidence, execution environments, and runtime costs.

Running all verification locally on every change would dramatically slow down development, while relying only on fast tests would leave large categories of regressions undetected until much later. This forced me to think about testing less as a collection of individual tests and more as a verification strategy with explicit trade-offs between confidence, verification cost, and feedback speed.

### Different failures require different verification

To make these trade-offs explicit, I introduced a [testing strategy](https://github.com/timurgilfanov/messenger/blob/main/docs/Testing%20Strategy.md) document defining:
- which categories of tests should exist,
- what failures they validate,
- where and when they should run,
- and which failures should block merges or releases.

This helped separate fast feedback from high-confidence verification instead of treating all tests as equally important during every stage of development.

CI evolved into a staged verification pipeline with multiple verification layers optimized for different execution environments, confidence levels, and runtime costs. Instead of simply running “all tests,” the pipeline executes different levels of validation at different lifecycle stages based on the confidence and cost requirements of the change.

## Coding agents changed how I think about implementation workflows

During this project, coding agents gradually became part of my daily development workflow. I started with using Claude Code and later Codex mostly for isolated code generation tasks during implementation.

As the capabilities of the agents evolved, my workflow evolved with them. Instead of treating them only as code generators, I started using them more as implementation and review helpers to reduce repetitive work, speed up iteration, and improve the overall quality of the result.

This shifted my own role away from writing every implementation detail manually and more toward specification, planning, review, and workflow design. A large part of the work became building enough project context and development constraints that agents could operate predictably: architecture rules, specifications, testing strategy, repository conventions, CI checks, and reusable workflows.

I also started building small automation and harness tooling around the agents themselves to improve iteration speed and reduce review overhead. At one point, this included experimenting with [ralphex](https://github.com/umputun/ralphex), an extended Ralph loop orchestration tool for autonomous plan execution and multi-agent review.

The goal was not fully autonomous implementation, but creating workflows where generated changes already align reasonably well with project conventions before review begins.

This reinforced many of the same lessons from the rest of the project. Coding agents become much more effective when architectural boundaries, ownership rules, requirements, and development processes are already explicit. In practice, many problems that appear to be AI quality problems are actually missing specification and coordination problems inside the project itself.

## Conclusion 
The most important lesson from this project was that maintainable architecture is not created by adopting specific patterns, frameworks, or libraries. It emerges from making product rules, ownership boundaries, architectural decisions, and development workflows explicit enough that multiple engineers can evolve the system predictably over time.

Many of the problems I encountered were not caused by incorrect technology choices, but by missing constraints, implicit assumptions, or unclear coordination rules. As the project evolved, architecture became less about finding “correct” abstractions and more about reducing long-term coordination and maintenance costs.

The project itself is still evolving, but after a year, the biggest change was how I think about software engineering: architecture, testing, specifications, and development processes are not separate concerns. They are all mechanisms for helping teams build and change complex systems predictably.