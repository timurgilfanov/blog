---
title: Android UI Architecture Is Driven by Coordination Requirements
description: How researching MVVM and MVI, reflecting on failed interview discussions, and evolving a messenger showcase project changed my understanding of Android UI architecture.
slug: android-ui-architecture-is-driven-by-coordination-requirements
pubDatetime: 2026-05-13T00:00:00Z
featured: false
draft: true
---

The interview discussions exposed gaps in how I understood Android UI architecture. I was reasoning about architecture mostly as justified by complexity of the screen, which is very abstract.

To find specific requirements that justify more complex architecture I use an example screen with two async requests that require coordination, define requirements for this screen and try several archetictures to implement those requirements. I weight compexity of the architecture to pressure points it creates, and how it scales with increase of coordination, to make the choise on an architecture. 

Pressure points where number of conditions used in implementation. More conditions — more complexity — more fragile code is.

I formulate architecture rule that define that all ordering rules (e.g., "last write wins", "paging does not overlap", "search clears paging") MUST be implemented exclusively inside the actor.

I reviewed Messenger UI architecture and lower the complexity to justified by requirements and remove the dependency.