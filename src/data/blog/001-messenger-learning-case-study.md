---
title: One Year Building an Android Messenger Showcase Project
description:
  About a year ago, I started a project to learn approaches for development in a team with more then one developer on Android platform and grow as Android engineer. Here are the main lessons I learned.
pubDatetime: 2026-05-10T13:46:00Z
featured: true
draft: true
---
My reflection on maintainable Android architecture started around 2021, after repeatedly experiencing how my own spaghetti code led to expensive debugging, difficult onboarding, and growing long-term maintenance costs in real projects.

Over the next few years, I adopted Google’s recommended app architecture in new projects and partially migrated legacy codebases toward it. Later, after reading Clean Architecture by Robert C. Martin, I gained a much deeper understanding of concepts like separation of concerns, dependency inversion, and the Dependency Rule.

I started this showcase project as my first attempt to apply these ideas consistently in a production-like environment with long-term architectural evolution in mind.

A few months later, after a failed interview, the project direction expanded. I realized I lacked experience with another class of problems common in larger Android teams: shared ownership, architectural consistency, and development patterns that allow multiple engineers to work in the same codebase predictably.

After a year, the most valuable outcome was not the app itself, but how much my understanding of engineering processes changed.

## Shared ownership
Larger Android teams optimize for different things than solo or small-team projects. The challenge is no longer only feature delivery — it becomes coordination, predictability, and consistency.

### Reduce costs of parallel development coordination
When multiple developers work on the same feature in parallel, their changes eventually need to be merged. The more overlapping implementation details they touch, the more coordination and conflict resolution are required.

To reduce this overhead, teams need to agree on clear contracts before implementation begins: boundaries between responsibilities, APIs, data models, and ownership of different parts of the feature.

Once the contracts are defined, the next question is how to split work between developers. With horizontal slicing, one developer implements UI while another works on data or domain layers of the same feature. This can reduce short-term coordination inside a layer, but it also creates additional merge points and makes ownership of the complete user experience less clear.

With vertical slicing, a developer owns a complete sub-feature end-to-end instead of only one technical layer: UI, domain, data flow, and business rules together. For example, in an authentication feature, one developer could own login while another owns session management.

This approach makes feature requirements easier to reason about because the same developer owns the complete behavior of the sub-feature end-to-end. It also reduces coordination overhead by minimizing the amount of implementation detail that must be synchronized across multiple developers during active development.

### Following the same conventions in the codebase
Shared ownership becomes difficult when architectural decisions exist only in the heads of individual developers. Engineers need to understand not only what the current implementation is, but also why specific trade-offs were made, which constraints existed, and what alternatives were considered, and where the boundaries of a rule or decision apply.

To reduce this coordination overhead, I started documenting decisions with long-term architectural consequences as decision records: short documents describing the context, chosen solution, alternatives, and consequences. Writing these documents also improved the quality of the decisions themselves by forcing me to make assumptions and trade-offs explicit.

I also introduced architecture rules for project-wide patterns that should be applied consistently across the codebase. Unlike decision records, which capture a decision made at a specific moment in time, rules describe reusable constraints and conventions such as ownership of state updates, side-effect organization, or boundaries between domain and UI layers.

These documents became increasingly useful not only for engineers, but also for coding agents, because both require clear and durable project context to work predictably in a shared codebase.

## Architecture complexity should match real problems
At the beginning of the project, I did not have a clear understanding of UI architecture: why MVI exists, what problems it solves compared to MVVM, and when its additional complexity is justified.

I adopted an external dependency that implemented UI architecture and followed its documentation and examples. The first major problems appeared when screens started requiring coordination between multiple asynchronous state updates that were not covered by the “happy path” examples from the library. In one case, concurrent chat updates and text input updates produced subtle ordering issues where stale state could temporarily override newer UI input. In another, trying to store mutable Compose state inside immutable reducers created increasing architectural friction between Compose snapshots and the coroutine-based intent pipeline.

Without understanding the guarantees and constraints introduced by the architecture, it became difficult to reason about how state changes propagated through the UI and how concurrent operations interacted with each other.

During one interview, I realized I could not clearly explain the architectural trade-offs behind different UI architecture approaches and examples. That pushed me to study this area more deeply: MVVM, MVI, actor/reducer patterns, state ownership, and concurrency coordination in UI state management.

The practical result was not switching from one “correct” architecture to another, but understanding which concrete engineering problems different approaches solve. As part of this process, I wrote an [architecture rule](https://github.com/timurgilfanov/messenger/blob/main/docs/architecture/AR-01-single-authority-for-ordering-rules.md) describing when actor/reducer-based MVI is justified for ordering invariants and when simpler approaches are enough.

Eventually, I migrated the application from a dependency-heavy MVI solution to a lighter custom implementation without external architectural dependencies. Screens without complex coordination requirements now use simpler state management, while more complex flows still have a clear path for serialized state coordination when needed. This also made architectural decisions easier to communicate and review, which became increasingly important as I started thinking more about shared ownership and long-term maintainability.

## Define business requirements before architecture
I started by implementing one screen after another and made business decisions when I needed to code the behaviour. It slows me down and add migration work when I saw that previous decision is not worked for lager picture. It’s hard to jump between low-level and high-level and decisions tends to be not optimal for whole product when you have this narrow focus when start to think about problem.
After few significant migrations I decided to start thinking of my project as a product and define business requirements. I define a scope of the features that I want to see, level of confidentiality and non-functional requirements. It helps me and coding agents to focus on task at hand and now made high-level decisions in the middle of feature implementation.

## CI and testing strategy to catch regressions
With the complexity of the project rises number on things that could be broken. It's hard to expect from engineers to keep all of them in mind. Later broken thigs found — more it costs. Solution is to write unit and integration tests to find regressions and run them early. We cannot run all tests on each commit localy, but run fast and relevant tests on each commit, and all tests to gate PR merge seems reasonable default.

### Testing strategy
It's good to have a document that describe what levels of testing we should have, what device and Android API we tests at what stage, and what coverage we expect. Without this agreement hard to expect consistency it testing trade-offs solving across the codebase.

## Coding agents and Ralph loop changes flow for IC
