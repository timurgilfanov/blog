After failing an Android UI architecture interview question, I spent weeks exploring when MVVM + UDF stops being enough and when MVI complexity actually becomes justified.

I built isolated architecture experiments to explore when UI coordination problems actually justify MVI complexity before applying the findings to a long-running messenger project.

The result was removing unjustified architecture complexity instead of adding more.

Wrote up the lessons here:

[Android UI Architecture Is Driven by Coordination Requirements](https://gilfanov.dev/posts/android-ui-architecture-driven-by-requirements)

Earlier context on the architecture experiments:

[One Year Rebuilding Android Architecture](https://gilfanov.dev/posts/one-year-rebuilding-android-architecture/#ui-architecture-complexity-should-match-real-problems)
