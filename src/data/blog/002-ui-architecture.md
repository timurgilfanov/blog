---
title: Android UI Architecture Is Driven by Coordination Requirements
description: How researching MVVM and MVI, reflecting on failed interview discussions, and evolving a messenger showcase project changed my understanding of Android UI architecture.
slug: android-ui-architecture-is-driven-by-coordination-requirements
pubDatetime: 2026-05-13T00:00:00Z
featured: false
draft: false
---

I originally approached UI architecture as a pattern selection problem.

I spent a long time researching MVVM, MVI, and their variations through conference talks, blog posts, open-source example projects, and framework implementations. Most comparisons focused on structure and data flow: immutable state, reducers, unidirectional data flow, intents, or state machines.

At the same time, I was evolving my Android messenger showcase project while preparing for architecture interviews. Some of those discussions did not go well. Reflecting on the questions afterward exposed a gap in my understanding.

I could explain how architectural patterns worked, but I could not clearly explain which problems justified their complexity.

That changed how I reason about UI architecture.

I stopped asking:

> Which architecture is best?

and started asking:

> Which coordination problems do the requirements introduce, and which architectural mechanisms are justified by them?

## Simple screens usually do not need complex coordination

A lot of Android screens do not require sophisticated state coordination.

Some screens mostly display static content. Others have independent actions with little interaction between them. In these cases, a simple ViewModel with a few independent state properties is usually enough.

A screen with:

- a loading indicator,
- a retry button,
- a static list,
- or a couple of independent input fields,

usually does not justify reducers, actors, serialized event pipelines, or complex state machines.

The coordination cost is low.

The architectural mistake is not “using MVVM.” The architectural mistake is introducing abstractions whose complexity is not justified by the requirements.

That realization significantly changed how I evaluated architecture examples.

I stopped asking:

> Is this MVVM or MVI?

and started asking:

> What coordination problem is this abstraction solving?

## Requirements eventually introduce coordination pressure

The situation changes once asynchronous operations stop being independent.

In the messenger project, screens gradually accumulated requirements like:

- search,
- pagination,
- filtering,
- retries,
- optimistic updates,
- and concurrent refresh operations.

Individually, none of these features were particularly complicated.

The complexity appeared in the interaction between them.

For example:

- a new search invalidates paging,
- stale search results must not overwrite newer ones,
- pagination should not overlap,
- retry logic must not duplicate existing state,
- local messages should appear before delivery confirmation,
- failed async operations should not revert newer UI state.

These are not framework concerns.

They are business ordering rules.

The important realization was that coordination complexity grows much faster than feature complexity.

## Business order is not the same as completion order

Asynchronous systems naturally execute work concurrently.

But business rules often require a specific ordering of state transitions regardless of which coroutine finishes first.

For example:

- the latest search request should win,
- older requests should not overwrite newer state,
- a refresh operation may invalidate paging state,
- local echo should appear before server acknowledgement.

This is where many UI architecture problems start becoming coordination problems.

The issue is not simply mutable state.

The issue is deciding which state transition is allowed to win when multiple asynchronous updates compete.

I started thinking about these rules as ordering invariants.

An ordering invariant is a business rule describing which state transition is allowed to win when multiple asynchronous updates compete.

## Why naïve async state updates become difficult to scale

A common ViewModel implementation style is to let multiple coroutines update UI state independently.

At small scale, this is usually fine.

But once ordering invariants appear, coordination logic often becomes scattered across the class:

- cancellation checks,
- stale request guards,
- tokens,
- timestamp comparisons,
- duplicated validation,
- conditional state writes.

The problem is not that these techniques are invalid.

The problem is that coordination rules become implicit and distributed across multiple writers.

At that point, concurrency bugs become architecture problems.

The difficulty is no longer updating state.

The difficulty is controlling authority over ordering rules.

## A single authority for ordering rules

This eventually led me to introduce an explicit architecture rule in the project.

The core idea was simple:

> Once requirements introduce coordination pressure, ordering rules should have a single authority.

The current rule in the project states:

> All ordering rules (e.g., "last write wins", "paging does not overlap", "search clears paging") MUST be implemented exclusively inside the actor. The actor is the only authority to coordinate async work and to commit UI state updates.

The important part is not “using MVI.”

The important part is centralizing coordination.

Reducers, actors, serialized event pipelines, and unidirectional data flow are valuable because they provide mechanisms for controlling coordination complexity.

Without a single authority, ordering rules are easy to bypass accidentally.

## Why the project still does not fully use actor/reducer pipelines

One of the biggest changes in my thinking was realizing that architectural direction does not require immediate architectural complexity.

The messenger project currently does not fully use actor/reducer pipelines everywhere.

That decision is intentional.

Some screens still do not justify that level of coordination infrastructure. Simpler state management remains easier to evolve and maintain when ordering pressure is low.

The architecture rule exists because requirements may eventually introduce stronger coordination constraints.

If that happens, the project already has an explicit direction for where those ordering rules belong.

That is very different from adopting a complex architecture everywhere “just in case.”

## Architecture is a response to coordination requirements

The biggest shift in my understanding was realizing that architecture is not about selecting the most advanced pattern.

There is no universally correct Android UI architecture.

Architectural patterns become valuable only when they solve coordination problems introduced by the requirements.

Reducers, actors, immutable state, serialized pipelines, and state machines are not architectural goals by themselves.

They are coordination mechanisms.

The real architectural question is not:

> Should this screen use MVVM or MVI?

The more useful question is:

> What coordination pressure do the requirements introduce, and which mechanisms are justified by it?