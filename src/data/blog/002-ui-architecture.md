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

You can read the post without opening the code, but the companion [`ui-architecture-study` repository](https://github.com/timurgilfanov/ui-architecture-study) follows the same main sequence. If you want to inspect code while reading, open the numbered `examples/` folders. For example, `examples/01-state-in-view` matches the first stage, `examples/03-async-search-udf` matches the async-search stage, and `examples/04-pagination-coordination` contains the guarded UDF ViewModel and actor/reducer responses to pagination coordination.

I also include a side note about feedback loops. It uses a smaller category-navigation example because filter visibility itself does not create a bidirectional interaction. These feedback-loop examples live under `examples/side-notes/`; the repository also includes a classic Android Views/listener-binding version of the same problem.

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

## Stage 2: Separate source state from derived state

Now the screen gets filters:

- filter chips;
- an `All` chip;
- an empty state;
- a `Clear filters` action.

Several visible values now depend on the same inputs. It may be tempting to store every visible fact as mutable state:

- selected filters;
- whether the `All` chip is selected;
- filtered items;
- whether the empty state is visible;
- whether `Clear filters` is visible.

That creates bug-prone intermediate states. If every mutation has to update several dependent values manually, the UI can briefly or permanently become inconsistent:

- filters changed, but the list still reflects old filters;
- filters were cleared, but `Clear filters` is still visible;
- no filters are selected, but the `All` chip is not selected;
- the list is empty, but the empty state is hidden.

This is the first real pressure: the screen has several values that must stay consistent with the same source inputs. The pressure is relieved with a small rule: only source values are mutable; everything else is computed from them.

For this screen, the mutable source state might be:

- `query`;
- `selectedFilters`;
- the source list of items.

Other values should be derived:

- `isAllSelected` from `selectedFilters`;
- `filteredItems` from items, `query`, and `selectedFilters`;
- `isClearFiltersVisible` from `selectedFilters` and maybe `query`;
- `isEmptyStateVisible` from filtered items.

Later, when remote loading and errors appear, those become additional inputs to empty-state visibility. At this stage, the point is only that empty state is derived from the current local source state.

The lesson is that `Clear filters` visibility is not independent state. It is a derived fact about the current filter state. Treating derived facts as separate mutable sources of truth increases synchronization cost.

## Side note: Feedback loops between UI elements

A feedback loop appears when two stateful parts of the UI drive each other.

This looks similar to the previous stage because both problems involve source-of-truth confusion. The difference is that Stage 2 only had derived values. Here, one derived-looking value can also trigger side effects, so the problem becomes a feedback loop rather than simple derived-state consistency.

A realistic Compose example is category navigation in a sectioned list:

- category navigation controls are shown at the top;
- items are grouped by category in a `LazyColumn`;
- tapping a category scrolls the list to that section;
- manually scrolling the list updates the selected category.

There are two directions:

- selected category changes list scroll position;
- list scroll position changes selected category.

If both sides are modeled as independent mutable state and synchronized with effects, the behavior becomes hard to reason about. A category click starts an animated scroll. During the animation, the list passes through intermediate sections. A scroll observer may update the selected category to those intermediate sections. If selected category state is also used as the trigger for programmatic scrolling, those intermediate selected-category updates can start additional scroll commands.

This is a real feedback loop:

- state A changes state B;
- state B changes state A;
- both directions can be triggered by user actions or programmatic updates.

A local fix usually starts with guard state: `isProgrammaticScroll`, `ignoreScrollUpdates`, `pendingCategory`, a cancellable scroll job, or “only update after scroll settles.” The companion repository includes a guarded intermediate version for this reason. It can reduce visible glitches, but now the screen owns extra coordination rules:

- what happens if the user drags during an animated scroll;
- whether a canceled scroll should keep the tapped category selected;
- when the pending category is considered reached;
- which scroll observations are allowed to update selected-category state.

Guards are not automatically wrong. For small localized cases, they can be a practical solution. The pressure becomes visible when guard state becomes the main way the interaction is coordinated.

Compose avoids many classic Android View feedback loops because recomposition does not call `onValueChange` by itself. A `TextField` with `value` and `onValueChange` is not automatically a feedback loop. But Compose can still create feedback loops when two stateful UI elements are synchronized in both directions.

The architectural response is to choose one authority for the interaction. For example:

- treat scroll position as the source of truth and derive the selected category from the visible section;
- treat category clicks as commands to scroll rather than as a second permanent source of truth;
- keep programmatic-scroll coordination in one place if product behavior requires it.

This relieves the pressure by removing the second permanent selected-category source. If product behavior requires the tapped category to remain selected until scrolling finishes, that rule can still exist, but it should live in one coordinator rather than spread across several effects and callbacks.

The same problem existed even more naturally in classic Android Views, listener binding, and two-way Data Binding-style synchronization. Consider a `Select all` checkbox and several individual filter checkboxes. The user unchecks one individual filter, the ViewModel emits `allSelected == false`, binding sets `selectAll.isChecked = false`, and that programmatic update triggers the `Select all` listener. The ViewModel may then clear every filter, not only the one the user changed. Real projects often added guards by detaching listeners, ignoring programmatic updates, or comparing old and new values.

Compose changes the mechanics, but not the architectural lesson: if two UI states drive each other, one part of the system must own the coordination.

## Before moving to UDF: local transitions are still enough

This point does not add new user-facing behavior. The catalog still has search, filters, an `All` chip, empty state, and `Clear filters`.

The transition rules are small and synchronous:

- typing in the search field changes `query`;
- tapping a filter chip adds or removes that filter;
- tapping `All` means no filter is selected;
- tapping `Clear filters` resets both `query` and `selectedFilters`;
- visible values stay derived from the current source state.

The Stage 2 solution can still handle this. `query` and `selectedFilters` can remain local source state, visible values can remain derived, and callbacks can update the source state directly. Introducing UDF here would mostly add ceremony unless the project already has a convention that every screen follows it.

This is an important non-step: source-of-truth pressure and feedback-loop pressure do not automatically require moving the whole screen behind a ViewModel boundary. Local source state, derived values, and one clear interaction authority can still be enough. The next pressure appears when state changes stop being only immediate local callback results.

## Stage 3: Remote search justifies UDF

Now search becomes remote.

The requirement changes from local filtering to asynchronous loading:

- query changes start a repository request;
- the UI shows loading;
- the UI shows results or an error;
- if the user types quickly, the newest query wins.

This adds time to the problem. State updates can now come from delayed repository responses, not only from immediate user events. A query change no longer only updates a string; it may also cancel previous work, start new work, clear an old error, show loading, and ignore stale results from older queries.

This is the first point where a ViewModel boundary starts paying for itself. The state management is no longer just a couple of local assignments; one user action may mean “update the query, clear old errors, cancel previous work, show loading, and ignore stale results.” Moving that work into a ViewModel gives it a stable owner outside composition. It also matters for lifecycle: during configuration changes, the ViewModel and its coroutine work can survive while the UI is recreated, so an in-flight search does not have to restart just because the screen rotated. The cost is that the UI no longer changes fields directly, and simple callbacks become ViewModel entry points such as `onQueryChanged()`.

The companion repository includes a baseline version that moves async state management into a ViewModel but still exposes several separate state streams: current query, loading flag, error, and items. It also keeps coordination fields for the current job and checks that prevent older results from replacing newer ones. It can meet the requirements, but the behavior is held together by several related mutations and conditions. Because the visible values are emitted independently, the UI has no single atomic snapshot to render and can observe temporary inconsistent combinations; a missed mutation can also turn a temporary mismatch into a correctness bug.

To give the UI a single atomic snapshot, we make the screen state single and immutable: one `SearchUiState` instead of several independent streams. At that point the design becomes unidirectional data flow (UDF): state flows down as a renderable snapshot, user actions flow back up through ViewModel entry points, and mutation stays private.

But single state does not enforce “newest query wins” by itself. A direct ViewModel still needs jobs, generations, and checks before state commits to prevent stale results. The companion repository’s Flow pipeline version expresses that latest-wins rule with coroutine Flow operators: debounce query changes, use `flatMapLatest`, and update the same `SearchUiState` when the latest result arrives.

The Stage 3 takeaway is limited but important: remote search justifies moving async state management into a ViewModel, and a single-state UDF shape gives the screen a stable render contract. For one async latest-wins pipeline, Flow can keep the ordering rule local. The next pressure appears when pagination adds a second async operation that updates the same state as search.

## Stage 4: Pagination creates coordination pressure

The new requirement sounds small:

- add `Load more`.

But once remote search already exists, pagination brings ordering rules with it.

New rules appear immediately:

- load the first page for a new search;
- load more only while the current search still has another page to request (`canLoadMore`);
- do not start a second page request while one is already in flight;
- a new search clears previous paged results;
- a new search invalidates in-flight page requests;
- a page result may be applied only if its query and page state still match the current search.

This is the stage where one new UI element creates a real coordination problem. The screen now has two async operations that update the same fields:

- search replaces `items`, resets `page`, changes `canLoadMore`, and updates loading/error state;
- pagination appends to `items`, increments `page`, changes `canLoadMore`, and updates loading/error state.

The problem is no longer only “how do I update state?” It becomes “who decides which async result is still valid?”

### First response: guarded UDF ViewModel

This keeps the Stage 3 UDF shape: state flows down from a ViewModel, and user actions flow back through methods such as `onQueryChanged` and `loadMore`. “Guarded” means those methods still launch requests and update `StateFlow`, but add checks so stale results do not update the UI.

The companion `examples/04-pagination-coordination/01-guarded-udf-viewmodel` folder compares four guarded UDF ViewModel versions:

- **Generation checks** attach a simple version number to async work. When a result returns, the ViewModel applies it only if the generation still matches the current search. This handles stale search and page results without cancelling old work.
- **Jobs and cancellation** keep explicit jobs for search and paging. A new search cancels obsolete work where possible, but the example still uses generation checks because cancellation alone is not a complete ordering rule.
- **Two Flow pipelines** move search and paging into separate flows. Search can use latest-wins operators, but paging still has to coordinate with the current query, page, and `canLoadMore`.
- **State machine** models events and transitions explicitly. Valid transitions become easier to see, but once events and async results go through one transition point, the design is already close to actor/reducer coordination.

These approaches are not wrong. For some screens, one of them is the right trade-off. The useful signal is whether each new requirement adds another guard, generation check, flag, or special case in a different part of the class.

If the rule “new search invalidates paging” appears in `onQueryChanged`, `loadMore`, search success, search failure, page success, and page failure, the implementation becomes harder to change safely. The same business rule is distributed across multiple callbacks and time-dependent paths.

When local fixes keep spreading the same ordering rule across the implementation, the architecture is telling us something: the screen needs a clearer coordination authority.

### Stronger response: actor/reducer MVI

Actor/reducer MVI is a stronger response to the same pagination requirements.

Not because MVI is more advanced, and not because a new feature appeared after the guarded UDF ViewModel response, but because the screen now has a specific kind of complexity:

- overlapping async operations;
- shared state fields;
- business ordering rules;
- stale results that must not commit state;
- side effects that should belong to user actions, not incidental state restoration.

The companion `examples/04-pagination-coordination/02-mvi-actor-reducer` folder shows this response.

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

For example, a direct ViewModel might guard page success with “does this generation still match?” and “does this query still match?” checks in the page callback. An actor/reducer version moves that decision to the actor boundary: stale page results are not emitted as commit-worthy results, and valid results go through the single reducer path.

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
| Synchronous local transition rules | Local callbacks can still be enough |
| Two UI elements synchronize each other both ways | One interaction authority |
| One cancellable async pipeline with delayed results | Single-state UDF plus coroutine or Flow cancellation |
| Multiple async operations update the same fields | Stronger coordination |
| Business ordering rules appear | State machine or actor/reducer |
| Guards and generation checks are scattered across handlers | Actor/reducer MVI becomes justified |

The point is not to choose the most structured pattern by default. The point is to notice when the current structure no longer absorbs the screen’s complexity.

If a screen has no ordering problem, actor/reducer MVI may add boilerplate without much benefit. If a screen has several overlapping async operations and each handler contains its own guards, staying with direct handlers may make the behavior harder to change safely.

Architecture is a trade-off. The question is whether the structure removes more complexity than it adds.

## Companion repository

The companion [`ui-architecture-study` repository](https://github.com/timurgilfanov/ui-architecture-study) is intended as additional material for this post. It follows the same sequence of pressures:

The repository also includes a minimal runnable Android sample app for visual demos. The async search and pagination-coordination examples have deterministic JVM tests, so this post can stay focused on architecture rather than build setup.

Main progression:

| Example | Purpose |
|---|---|
| [`examples/01-state-in-view`](https://github.com/timurgilfanov/ui-architecture-study/tree/main/examples/01-state-in-view) | Local Compose state and simple filtering |
| [`examples/02-derived-state-source-of-truth`](https://github.com/timurgilfanov/ui-architecture-study/tree/main/examples/02-derived-state-source-of-truth) | Filters, `All` chip, empty state, and `Clear filters` |
| [`examples/03-async-search-udf`](https://github.com/timurgilfanov/ui-architecture-study/tree/main/examples/03-async-search-udf) | Remote search with baseline, single-state UDF, and Flow latest-wins variants |
| [`examples/04-pagination-coordination`](https://github.com/timurgilfanov/ui-architecture-study/tree/main/examples/04-pagination-coordination) | Search plus pagination coordination with guarded UDF ViewModel and actor/reducer MVI responses |

Side notes:

| Example | Purpose |
|---|---|
| [`examples/side-notes/feedback-loop-compose-category-scroll`](https://github.com/timurgilfanov/ui-architecture-study/tree/main/examples/side-notes/feedback-loop-compose-category-scroll) | Category navigation synchronized with `LazyColumn` scroll |
| [`examples/side-notes/feedback-loop-android-views-select-all`](https://github.com/timurgilfanov/ui-architecture-study/tree/main/examples/side-notes/feedback-loop-android-views-select-all) | Classic Android Views/listener-binding `Select all` checkbox loop |

The repository is not meant to be a framework. It is a set of small experiments that make trade-offs visible.

## Conclusion

The evolution from local state to MVI is not a story about replacing a bad pattern with a good one.

Local state was correct when the state was local. A single source of truth became useful when several UI elements depended on the same values. Single-state UDF became useful when remote search introduced delayed results, loading, errors, and latest-wins cancellation. A Flow pipeline reduced the manual guards needed for the latest-wins rule. Pagination created coordination pressure, and actor/reducer MVI became useful as a stronger response when those ordering rules were too expensive to keep distributed.

That is the main lesson: for screen state management, UI architecture should be strongly shaped by coordination requirements.

When there is no coordination problem, simple code is usually better. When coordination rules exist, they should be explicit. And when the same rule appears in several handlers, callbacks, and guards, the screen needs a single authority for that rule.
