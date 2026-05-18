---
title: "From Compose State to MVI: Android UI Architecture Driven by Requirements"
description: A requirement-driven walkthrough of Android UI architecture evolution from local Compose state, through single UI state and unidirectional data flow, to actor/reducer MVI when async ordering rules appear.
slug: android-ui-architecture-is-driven-by-coordination-requirements
pubDatetime: 2026-05-17T00:00:00Z
featured: false
draft: false
---

A failed interview made me realize that my understanding of Android UI architecture was too pattern-oriented.

I could talk about MVVM, UDF, and MVI as implementation styles, but I was less precise about the requirements that make each style useful. Saying “use MVI for complex screens” was not enough, because “complex” can mean many different things.

The question I needed to answer was not “Which pattern is better?” but “Which coordination problem does this screen actually have?”

This post follows one ordinary Android screen as requirements grow. The goal is to show how UI architecture pressure appears step by step, and how each change in architecture can relieve that pressure with the smallest useful increase in complexity.

The longer project context is in the UI architecture section of my previous reflection: [UI architecture complexity should match real problems](/posts/one-year-rebuilding-android-architecture/#ui-architecture-complexity-should-match-real-problems).

## Table of contents

## The screen we will evolve

The main example is intentionally common: a searchable catalog screen.

I start with a simple list and add requirements one by one: local search, filters, empty state, remote loading, pagination, and retry. The point is not the screen itself, but how each requirement changes the relationship between UI elements, state, and asynchronous work.

You can read the post without opening the code, but the companion [`ui-architecture-study` repository](https://github.com/timurgilfanov/ui-architecture-study) follows the same sequence. If you want to inspect code while reading, open the numbered `examples/` folders. For example, `examples/01-state-in-view` matches the first stage, `examples/06-async-search-udf` matches the async-search stage, and `examples/08-mvi-actor-reducer` matches the final actor/reducer example.

For feedback loops, I use a smaller side example: category chips synchronized with a sectioned `LazyColumn`. That example is more precise than filter visibility because chip selection and scroll position can drive each other in both directions. The repository also includes a classic Android Views/listener-binding version of the same feedback-loop problem.

The runnable `sample-app` is optional. It exists so you can interact with the examples visually. The tests are focused on the async ordering examples, where behavior is harder to verify by inspection alone.

## Stage 1: Local state is enough

The first requirement is simple:

- show a list of items;
- add a search field;
- filter the visible items locally.

In this version, keeping the query as local Compose state is reasonable. The query is used by the text field and by the derived filtered list. There is no repository call, loading state, pagination, retry, or ordering rule.

Local state is not automatically a code smell. It becomes risky when other parts of the screen start depending on it, changing it, or coordinating with it.

At this stage:

- `query` has one owner;
- filtered items are derived from `query` and the source list;
- there are no side effects;
- there are no delayed results;
- recomposition is enough to update the UI.

Adding a ViewModel or MVI store here would mostly add structure without solving any coordination problem. The simplest architecture still matches the problem.

## Stage 2: Derived state needs one source of truth

Now the screen gets filters:

- filter chips;
- an `All` chip;
- an empty state;
- a `Clear filters` action.

This is the first real pressure, but it is not yet a feedback loop. It is a source-of-truth and derived-state problem.

It may be tempting to store every visible fact as mutable state:

- selected filters;
- whether the `All` chip is selected;
- filtered items;
- whether the empty state is visible;
- whether `Clear filters` is visible.

That creates bug-prone intermediate states. If every mutation has to update several dependent values manually, the UI can briefly or permanently become inconsistent:

- filters changed, but the list still reflects old filters;
- filters were cleared, but `Clear filters` is still visible;
- all filters are selected, but the `All` chip is not selected;
- the list is empty, but the empty state is hidden.

The fix is not MVI. The fix is simpler: distinguish source state from derived state.

For this screen, the mutable source state might be:

- `query`;
- `selectedFilters`;
- the source item list.

Other values should be derived:

- `isAllSelected` from `selectedFilters`;
- `filteredItems` from items, `query`, and `selectedFilters`;
- `isClearFiltersVisible` from `selectedFilters` and maybe `query`;
- `isEmptyStateVisible` from filtered items.

Later, when remote loading and errors appear, those become additional inputs to empty-state visibility. At this stage, the point is only that empty state is derived from the current local source state.

The lesson is that `Clear filters` visibility is not independent state. It is a derived fact about the current filter state. Treating derived facts as separate mutable sources of truth increases synchronization cost.

## Stage 3: Feedback loops between UI elements

A feedback loop appears when two stateful parts of the UI drive each other.

A realistic Compose example is a catalog with category navigation:

- category chips are shown at the top;
- items are grouped by category in a `LazyColumn`;
- tapping a chip scrolls the list to that category;
- manually scrolling the list updates the selected chip.

There are two directions:

- chip selection changes list scroll position;
- list scroll position changes chip selection.

If both sides are modeled as independent mutable state and synchronized with effects, the behavior becomes hard to reason about. A chip click starts an animated scroll. During the animation, the list passes through intermediate sections. A scroll observer may update the selected chip to those intermediate sections. If selected chip state is also used as the trigger for programmatic scrolling, those intermediate selected-chip updates can start additional scroll commands. Then guards start appearing: `isProgrammaticScroll`, `ignoreScrollUpdates`, `pendingCategory`, or “only update after scroll settles.”

This is a real feedback loop:

- state A changes state B;
- state B changes state A;
- both directions can be triggered by user actions or programmatic updates.

Compose avoids many classic Android View feedback loops because recomposition does not call `onValueChange` by itself. A `TextField` with `value` and `onValueChange` is not automatically a feedback loop. But Compose can still create feedback loops when two stateful UI elements are synchronized in both directions.

The architectural response is to choose one authority for the interaction. For example:

- treat scroll position as the source of truth and derive the selected chip from the visible section;
- treat chip clicks as commands to scroll rather than as a second permanent source of truth;
- keep programmatic-scroll coordination in one place if product behavior requires it.

The same problem existed even more naturally in classic Android Views, listener binding, and two-way Data Binding-style synchronization. Consider a `Select all` checkbox and several individual filter checkboxes. The user unchecks one individual filter, the ViewModel emits `allSelected == false`, binding sets `selectAll.isChecked = false`, and that programmatic update triggers the `Select all` listener. The ViewModel may then clear every filter, not only the one the user changed. Real projects often added guards by detaching listeners, ignoring programmatic updates, or comparing old and new values.

Compose changes the mechanics, but not the architectural lesson: if two UI states drive each other, one part of the system must own the coordination.

## Stage 4: UDF establishes state ownership

After derived state and feedback loops appear, the next useful step is Unidirectional Data Flow.

In lightweight UDF:

- the View renders state;
- the View reports user events;
- the ViewModel or coordinator owns state transitions;
- mutable state is private;
- the UI observes read-only state.

For the catalog screen, the View can report events like:

- `QueryChanged`;
- `FilterToggled`;
- `AllFiltersClicked`;
- `ClearFiltersClicked`.

The category-scroll feedback loop is handled separately in the companion example. This catalog UDF stage keeps only query and filter events.

The ViewModel decides how those events change state. The View should not directly mutate `selectedFilters`, manually update `isClearFiltersVisible`, or synchronize chip state and list state in both directions.

This is useful before full MVI. Direct event-handler methods are often enough. A ViewModel that exposes one read-only `StateFlow<UiState>` and accepts explicit events already solves many ownership problems.

The important shift is this:

- state goes down;
- events go up;
- transitions happen in one place.

UDF helps prevent hidden UI feedback loops by preventing the View from becoming an implicit state machine.

## Stage 5: One async pipeline

Now search becomes remote.

The requirement changes from local filtering to asynchronous loading:

- query changes start a repository request;
- the UI shows loading;
- the UI shows results or an error;
- if the user types quickly, the newest query wins.

This adds time to the problem. State updates can now come from delayed repository responses, not only from immediate user events.

For one async pipeline, lightweight UDF is still usually enough. A ViewModel can debounce query changes, use `flatMapLatest` or cancel the previous job, set loading state, and update the same `UiState` when the latest result arrives.

The key point is that async work alone does not automatically justify MVI. A single latest-wins pipeline has a clear owner and a clear ordering rule. The rule is local: only the latest search result may commit state.

If the implementation has one state stream, private mutation, explicit event handlers, and a well-contained cancellation strategy, adding an actor and reducer may not remove enough complexity to justify the extra structure.

## Stage 6: Pagination introduces ordering rules

Pagination changes the problem more than it first appears.

The new requirement sounds small:

- add `Load more`.

But once remote search already exists, pagination brings ordering rules with it.

Local paging rules appear immediately:

- do not start page 2 twice;
- do not start a new page request while another page request is running;
- do not load more when `canLoadMore` is false;
- append page results in order.

Search and paging coordination rules also appear:

- a new search clears previous paged results;
- a new search invalidates in-flight page requests;
- a page result belongs only to the query and page state that started it;
- an old page result must not append into a newer search result.

This is the first stage where one new UI element creates a real coordination problem. The screen now has at least two async operations that update the same fields:

- search replaces `items`, resets `page`, changes `canLoadMore`, and updates loading/error state;
- pagination appends to `items`, increments `page`, changes `canLoadMore`, and updates loading/error state.

A direct ViewModel can still handle this. It can cancel jobs, compare queries, keep tokens, or guard state commits. The question is where those checks live.

If the rule “new search invalidates paging” appears in `onQueryChanged`, `loadMore`, search success, search failure, page success, and page failure, the implementation becomes harder to change safely. The same business rule is distributed across multiple callbacks and time-dependent paths.

The problem is no longer only “how do I update state?” It becomes “who decides which async result is still valid?”

## Stage 7: Repair attempts before MVI

Before introducing MVI, it is worth trying to improve the simpler design.

Several repair attempts are possible:

| Approach | What improves | Remaining pressure |
|---|---|---|
| Jobs and cancellation | Cancels obvious stale work | Rules can remain spread across handlers and callbacks |
| Tokens | Makes stale-result checks explicit | Token checks appear in multiple places |
| Two Flow pipelines | Models search latest-wins clearly | Paging still coordinates with current state |
| State machine | Centralizes events and transitions | This is already close to actor/reducer |

The companion `examples/07-mvvm-with-guards` folder keeps simplified versions of these repair attempts together: jobs, tokens, two Flow pipelines, and a small state machine.

These approaches are not wrong. For some screens, one of them is the right trade-off. The useful signal is whether each new requirement adds another guard, token, flag, or special case in a different part of the class.

When local fixes keep spreading the same ordering rule across the implementation, the architecture is telling us something: the screen needs a clearer coordination authority.

For example, a direct ViewModel might guard page success with “does this generation still match?” and “does this query still match?” checks in the page callback. An actor/reducer version moves that decision to the actor boundary: stale page results are not emitted as commit-worthy results, and valid results go through the single reducer path.

## Stage 8: Actor/reducer MVI

This is where actor/reducer MVI becomes useful.

Not because MVI is more advanced, but because the screen now has a specific kind of complexity:

- overlapping async operations;
- shared state fields;
- business ordering rules;
- stale results that must not commit state;
- side effects that should belong to user actions, not incidental state restoration.

In an actor/reducer design:

- an intent represents something that happened from outside the state machine, such as `QueryChanged` or `LoadMore`;
- the actor decides what async work is allowed and enforces ordering rules;
- a result represents the outcome of work or an internal decision;
- the reducer converts previous state plus result into next state;
- the View renders state and sends intents.

The important part is not the names. The important part is ownership.

If ordering rules are the reason for MVI, then those rules must live inside the actor/reducer boundary. In this style of actor/reducer MVI, the actor owns allowed work and request validity. If any handler can still commit state directly, the rule can be bypassed. If every async callback can update state independently, the reducer is only ceremony.

For the search screen, the actor can own questions like:

- should this query start a new search;
- should this page request be allowed;
- should an in-flight page request be cancelled or ignored;
- does this page result still belong to the current query;
- should retry repeat search or paging;
- should this action produce analytics.

The reducer owns state transitions like:

- search started;
- search succeeded;
- search failed;
- page started;
- page succeeded;
- page failed.

That separation makes the ordering rules visible in one place instead of implicit across multiple event handlers and callbacks.

## Follow-up requirements: retry and analytics

Retry and analytics are not needed to prove the MVI point. Search plus pagination already creates enough coordination pressure.

But they are useful follow-up requirements because they expose related ownership questions.

Retry asks:

- did the initial search fail;
- did a page request fail;
- what exactly should be repeated;
- is it safe to infer that from the current page number, or should failed request identity be modeled explicitly?

Analytics asks:

- which user action should produce an event;
- should retry count as a new search or as retry;
- how do we avoid sending analytics again after rotation or state restoration;
- where should one-off side effects live?

These requirements strengthen the same lesson. Once the screen has meaningful user actions, async requests, and ordering rules, event identity and request identity matter. They should be modeled intentionally instead of inferred from incidental state.

## Decision guide

The stages above are not strict rules. They are signals.

| Requirement pressure | Architecture that may be enough |
|---|---|
| Independent visual state | Local Compose state |
| State must survive beyond composition | `rememberSaveable`, ViewModel, or persistence depending on lifetime |
| Values are derived from the same source | Single source of truth and derived state |
| View directly mutates state with dependents | UDF boundary |
| Two UI elements synchronize each other both ways | One interaction authority or UDF coordinator |
| One cancellable async pipeline | UDF with coroutine or Flow cancellation |
| Multiple async operations update the same fields | Stronger coordination |
| Business ordering rules appear | State machine or actor/reducer |
| Guards and tokens are scattered across handlers | Actor/reducer MVI becomes justified |

The point is not to choose the most structured pattern by default. The point is to notice when the current structure no longer absorbs the screen’s complexity.

If a screen has no ordering problem, actor/reducer MVI may add boilerplate without much benefit. If a screen has several overlapping async operations and each handler contains its own guards, staying with direct handlers may make the behavior harder to change safely.

Architecture is a trade-off. The question is whether the structure removes more complexity than it adds.

## Companion repository

The companion [`ui-architecture-study` repository](https://github.com/timurgilfanov/ui-architecture-study) is intended as additional material for this post. It follows the same sequence of pressures:

The repository also includes a minimal runnable Android sample app for visual demos. The async search, MVVM guard,
and actor/reducer ordering examples have deterministic JVM tests, so this post can stay focused on architecture rather
than build setup.

| Example | Purpose |
|---|---|
| [`examples/01-state-in-view`](https://github.com/timurgilfanov/ui-architecture-study/tree/main/examples/01-state-in-view) | Local Compose state and simple filtering |
| [`examples/02-derived-state-source-of-truth`](https://github.com/timurgilfanov/ui-architecture-study/tree/main/examples/02-derived-state-source-of-truth) | Filters, `All` chip, empty state, and `Clear filters` |
| [`examples/03-feedback-loop-compose-category-scroll`](https://github.com/timurgilfanov/ui-architecture-study/tree/main/examples/03-feedback-loop-compose-category-scroll) | Category chips synchronized with `LazyColumn` scroll |
| [`examples/04-feedback-loop-android-views-select-all`](https://github.com/timurgilfanov/ui-architecture-study/tree/main/examples/04-feedback-loop-android-views-select-all) | Classic Android Views/listener-binding `Select all` checkbox loop |
| [`examples/05-single-ui-state-udf`](https://github.com/timurgilfanov/ui-architecture-study/tree/main/examples/05-single-ui-state-udf) | One immutable UI state and explicit UI events |
| [`examples/06-async-search-udf`](https://github.com/timurgilfanov/ui-architecture-study/tree/main/examples/06-async-search-udf) | Remote search, loading/error, and latest-wins |
| [`examples/07-mvvm-with-guards`](https://github.com/timurgilfanov/ui-architecture-study/tree/main/examples/07-mvvm-with-guards) | Search plus pagination with jobs, tokens, flow pipelines, state machine, and guards |
| [`examples/08-mvi-actor-reducer`](https://github.com/timurgilfanov/ui-architecture-study/tree/main/examples/08-mvi-actor-reducer) | Actor owns ordering and reducer commits state |

The repository is not meant to be a framework. It is a set of small experiments that make trade-offs visible.

## Conclusion

The evolution from local state to MVI is not a story about replacing a bad pattern with a good one.

Local state was correct when the state was local. A single source of truth became useful when several UI elements depended on the same values. UDF became useful when the View needed to stop being a state writer. Actor/reducer MVI became useful only after overlapping async operations introduced ordering rules that were too expensive to keep distributed.

That is the main lesson: for screen state management, UI architecture should be strongly shaped by coordination requirements.

When there is no coordination problem, simple code is usually better. When coordination rules exist, they should be explicit. And when the same rule appears in several handlers, callbacks, and guards, the screen needs a single authority for that rule.
