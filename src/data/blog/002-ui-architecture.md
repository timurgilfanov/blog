---
title: "From Compose State to MVI: Android UI Architecture Driven by Requirements"
description: A requirement-driven walkthrough of how Android UI architecture evolves from local Compose state, through single UI state and unidirectional data flow, to actor/reducer MVI when multiple async operations create ordering rules.
slug: android-ui-architecture-driven-by-requirements
pubDatetime: 2026-05-22T00:00:00Z
featured: false
draft: false
tags:
  - Android Architecture
  - UI Architecture
  - Jetpack Compose
  - State Management
  - MVI
---

A failed interview made me realize that my understanding of Android UI architecture was too pattern-oriented. I could talk about MVVM, UDF, and MVI in general, but I was not sure about reasons behing each pattern. Saying “use MVI for complex screens” is not enough, because “complex” can mean many different things.

This post follows one ordinary Android screen as requirements grow. The goal is to show how UI architecture pressure appears step by step, and how each change in architecture can relieve that pressure with the smallest useful increase in complexity.

## Table of contents

## The screen we will evolve

The main example is intentionally common: a searchable catalog screen.

I start with a simple list and add requirements one by one: local search, filters, remote loading, and pagination. The list screen itself is not the interesting part. It is just a small example for showing how each new requirement changes the way UI state, user actions, and asynchronous work need to be coordinated.

You can read the post without opening the code, but the companion [repository](https://github.com/timurgilfanov/ui-architecture-study) contains:

- `examples` folders to inspect code while reading;
- runnable `sample app` to interact with selected examples visually;
- tests focused on the async ordering examples, where behavior is harder to verify by inspection alone.

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

This side note uses a smaller category-navigation example instead of the catalog filters. Filter visibility is derived state, but it does not by itself create a bidirectional interaction. Category selection and list scrolling make the feedback-loop pressure easier to see.[^feedback-loop-code]

[^feedback-loop-code]: The companion code for this detour lives under `examples/side-notes/`. The Compose category-scroll example includes naive, guarded, and one-authority versions; the Android Views example covers the listener-binding `Select all` checkbox loop.

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

A local fix usually starts with guard state: `isProgrammaticScroll`, `ignoreScrollUpdates`, `pendingCategory`, a cancellable scroll job, or “only update after scroll settles.” A guarded intermediate version can reduce visible glitches, but now the screen owns extra coordination rules:

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

The companion code uses search as the only request input from this point onward.[^stage-3-filters]

[^stage-3-filters]: From Stage 3 onward, the companion examples leave out the Stage 2 filter chips. This keeps the code focused on delayed results, cancellation, retry, and latest-wins behavior. Filters could be added back as another request input, but they would not change the main async coordination problem.

This adds time to the problem. State updates can now come from delayed repository responses, not only from immediate user events. A query change no longer only updates a string; it may also cancel previous work, start new work, clear an old error, show loading, and ignore stale results from older queries.

This is the first point where a ViewModel boundary starts paying for itself. The state management is no longer just a couple of local assignments; one user action may mean “update the query, clear old errors, cancel previous work, show loading, and ignore stale results.” Moving that work into a ViewModel gives it a stable owner outside composition. It also matters for lifecycle: during configuration changes, the ViewModel and its coroutine work can survive while the UI is recreated, so an in-flight search does not have to restart just because the screen rotated. The cost is that the UI no longer changes fields directly, and simple callbacks become ViewModel entry points such as `onQueryChanged()`.

The companion repository includes a baseline version that moves async state management into a ViewModel but still exposes several separate state streams: current query, loading flag, search-completed flag, error, and items. It also keeps coordination fields for the current job and checks that prevent older results from replacing newer ones. It can meet the requirements, but the behavior is held together by several related mutations and conditions. Because the visible values are emitted independently, the UI has no single atomic snapshot to render and can observe temporary inconsistent combinations; a missed mutation can also turn a temporary mismatch into a correctness bug.

To give the UI a single atomic snapshot, we make the screen state single and immutable: one `SearchUiState` instead of several independent streams. At that point the design becomes unidirectional data flow (UDF): state flows down as a renderable snapshot, user actions flow back up through ViewModel entry points, and mutation stays private.

But single state does not enforce “newest query wins” by itself. A direct ViewModel still needs jobs, generations, and checks before state commits to prevent stale results. The companion repository’s Flow pipeline version expresses that latest-wins rule with a coroutine Flow pipeline: delay before starting a request, use `flatMapLatest` to cancel stale work, and update the same `SearchUiState` when the latest result arrives.

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
- stale page results from older search generations must not update the current search.

This is the stage where one new UI element creates a real coordination problem. The screen now has two async operations that update the same fields:

- search replaces `items`, resets `page`, changes `canLoadMore`, and updates loading/error state;
- pagination appends to `items`, increments `page`, changes `canLoadMore`, and updates loading/error state.

The problem is no longer only “how do I update state?” It becomes “who decides which async result is still valid?”

### First response: guarded UDF ViewModel

This keeps the Stage 3 UDF shape: state flows down from a ViewModel, and user actions flow back through methods such as `onQueryChanged` and `loadMore`. “Guarded” means those methods still launch requests and update `StateFlow`, but add checks so stale results do not update the UI.

The companion Stage 4 code first compares three direct guarded UDF ViewModel versions:

- **Generation checks** attach a simple version number to async work. When a result returns, the ViewModel applies it only if the generation still matches the current search. This handles stale search and page results without cancelling old work.
- **Jobs and cancellation** keep explicit jobs for search and paging. A new search cancels obsolete work where possible, but the example still uses generation checks because cancellation alone is not a complete ordering rule.
- **Two Flow pipelines** move search and paging into separate flows. Search can use latest-wins operators, but paging still has to coordinate with the current query generation, query, page, and `canLoadMore`.

These versions satisfy the search-and-pagination requirements, but the rule “new search invalidates paging” is still preserved through guards around handlers and async completions. The companion tests cover stale page invalidation, same-query refreshes, and non-overlapping page requests for the guarded variants. That makes behavior harder to debug, update, and explain because the rule is reconstructed from checks in different paths.

### Centralized response: state-machine UDF ViewModel

The state-machine version improves ownership by centralizing View actions and async completions in one transition function. The invalidation rule is less scattered, but the single coordination point now does too much: it decides allowed work, starts async requests, validates async completions, and commits UI state.

### Stronger response: actor/reducer MVI

Actor/reducer MVI takes the state-machine idea one step further: keep one coordination boundary, but split ownership. The actor owns time-dependent coordination; the reducer owns state transitions.

In this design:

- the View sends intents, such as `QueryChanged` or `LoadMore`;
- the actor decides what async work is allowed, rejects stale completions, and emits results;
- the reducer converts previous state plus result into next state.

For this search screen, the actor decides:

- whether a query should start a new search;
- whether a page request is allowed;
- whether an in-flight page request should be cancelled or ignored;
- whether a page result still belongs to the current search generation.[^actor-guard-scope]

[^actor-guard-scope]: The companion code keeps this completion guard intentionally small: because the actor starts page requests from its own ordering projection and allows only one page request at a time, a matching generation is enough for this example. If the example later adds prefetching, retries, or overlapping page requests, query, expected page, and loading-state checks should become explicit completion guards.

The reducer handles state transitions: search started/succeeded/failed and page started/succeeded/failed.

That separation makes time-dependent coordination explicit without letting async callbacks commit state directly.

## Boundary pressure guide

New UI state, interaction, lifecycle, and async requirements can expose boundary pressure in the current design. Sometimes an existing boundary becomes too weak; sometimes a missing boundary needs to be introduced: who owns state, who has authority over interactions, how long state must live, how async work is coordinated, and where transitions are committed. When these responsibilities are unclear, the UI becomes harder to update, debug, and explain.

Use the table below as a diagnostic guide. It roughly follows the article’s progression from simple local state to stronger coordination, but it is not an upgrade path. Each row names a specific pressure, the boundary it stresses or introduces, and one architectural response that may be enough.

| Requirement pressure                                | Boundary affected or needed        | Architecture response that may be enough                            |
| --------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------- |
| Independent visual state                            | No new boundary needed             | Local Compose state                                                 |
| State must survive beyond composition               | State lifetime boundary            | `rememberSaveable`, ViewModel, or persistence depending on lifetime |
| Values are derived from the same source             | Source-of-truth boundary           | Single source of truth and derived state                            |
| Synchronous local transition rules                  | Transition ownership boundary      | Local callbacks can still be enough                                 |
| Two UI elements synchronize each other both ways    | Interaction authority boundary     | One owner for the shared interaction                                |
| One cancellable async pipeline with delayed results | Async ownership boundary           | Single-state UDF plus coroutine or Flow cancellation                |
| Multiple async operations update the same fields    | State commit coordination boundary | Stronger coordination around state commits                          |
| Business ordering rules appear                      | Ordering boundary                  | State machine or actor/reducer                                      |

Implementation symptoms matter too. If guards, generation checks, or stale-result checks are scattered across handlers, the current async boundary is probably too weak. Stronger coordination, such as actor/reducer MVI, may become justified.

If one transition function starts allowed work, launches async calls, validates results, and commits state, the boundary has moved too far in the other direction. Splitting coordination from state transitions can make the code easier to update, debug, and explain.

## Shared baseline, explicit escalation

Consistency still matters in a shared codebase, but consistency does not have to come from the heaviest pattern. In the [Messenger project reflection](/posts/one-year-rebuilding-android-architecture/#ui-architecture-complexity-should-match-real-problems), the external MVI dependency gave screens a common shape, which helped reduce variation across screens. The lesson was that this shared shape should be a baseline contract first, and heavier coordination should be introduced only when the screen has a named coordination problem.

A practical compromise is a light default screen contract:

- a ViewModel exposes read-only `StateFlow<UiState>`;
- one-off events use a separate side-effect `Flow`;
- the UI sends callbacks or events to the ViewModel;
- state ownership rules are predictable;
- ordering and coordination rules have documented escalation paths.

Actor/reducer MVI then becomes an escalation path for screens with real ordering or coordination pressure, not the default shape of every screen. Architecture is a trade-off: the question is whether the structure removes more complexity than it adds.

## Conclusion

The evolution from local state to MVI is not a story about replacing a weak pattern with a stronger one. It is a story about introducing or redrawing ownership boundaries when new requirements make the current structure hard to update, debug, or explain.

Local state was correct while the behavior had one owner. A single source of truth became useful when several visible values depended on the same inputs. Single-state UDF became useful when remote search introduced delayed results, loading, errors, and latest-wins cancellation. A Flow pipeline reduced the manual guards needed for the latest-wins rule. Actor/reducer MVI became useful when pagination added ordering rules.

For a shared codebase, the practical lesson is not to use the same heavy architecture everywhere. It is to use a consistent baseline and a clear escalation path. A light contract can make screens familiar across developers, while stronger boundaries should appear only when named coordination problems make the baseline hard to update, debug, or explain.

Architecture should remove more complexity than it adds. Simple screens should stay simple. Coordinated screens should make ownership explicit.

## Notes