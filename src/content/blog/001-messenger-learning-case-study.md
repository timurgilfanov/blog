# One Year Building an Android Messenger Showcase Project: What I Learned About Shared Ownership, Testing, and Coding Agents

About a year ago, I started a project to learn approaches for development in a team with more then one developer on Android platform and grow as Android engineer. Here are the main lessons I learned.

# Shared ownership
My backgound is solely ownership of 100k+ MAU Android applications development end-to-end. For the 1M+ MAU application I'm targeting in my career more then one Android engineer works on application and pair of Senior and Middle engineer work in same codebase often. This creates new challenges:
- How to reduce costs of coordination working on the same codebase in parallel?
- How to keep whole project codebase following the same conventions to reduce onboarding time and make learned knowledge in one part of codebase transferable to other part of codebase?

## Reduce costs of parallel development coordination
Problem, options with trade-offs, solution

## Following same conventions in codebase
### Record of decisions and rules
Record of decisions that have wide and long-term consequences worth to be comprehensive: 1-2 page with the context, decision, alternatives, and positive and negative consequences. Following structure and writing document helps with the quality of decision and will be explanations for engineers and AI agents why this decision was made.
Rules are similar to records of decision but established project-wide pattern, not record a architecture decision in specific moment of time.

#### Reaccess decisions when requirements changes (to be familiar with Orbit MVI -> custom light MVI is enought)
I did not have clear understanding of UI architecture: why MVI exists, what the difference to MVVM. I bring a dependency that implement MVI and follow its guidelines. First stuck was at the moment  when I needed to do something not covered by examples. Without clear understanding of MVI and what new dependency about it was hard to understand how data flow in my implementation.
I understand that I don’t understand UI architecture on interview and dive into this area. The got deeper understanding MVVM, and MVI and learning of actor/reducer pattern. The material results was an architecture rule about what MVI with actor and reducer needs, and migration of all screens of application from dependency-based MVI solution to lighter MVI without dependency and actor and reducer. I found minimum of architecture complexity that cover current needs and have a pattern to cover move complex cases when they required as a bonus.

# Define business requirements before architecture
I started by implementing one screen after another and made business decisions when I needed to code the behaviour. It slows me down and add migration work when I saw that previous decision is not worked for lager picture. It’s hard to jump between low-level and high-level and decisions tends to be not optimal for whole product when you have this narrow focus when start to think about problem.
After few significant migrations I decided to start thinking of my project as a product and define business requirements. I define a scope of the features that I want to see, level of confidentiality and non-functional requirements. It helps me and coding agents to focus on task at hand and now made high-level decisions in the middle of feature implementation.

# CI and testing strategy to catch regressions
With the complexity of the project rises number on things that could be broken. It's hard to expect from engineers to keep all of them in mind. Later broken thigs found — more it costs. Solution is to write unit and integration tests to find regressions and run them early. We cannot run all tests on each commit localy, but run fast and relevant tests on each commit, and all tests to gate PR merge seems reasonable default.

## Testing strategy
It's good to have a document that describe what levels of testing we should have, what device and Android API we tests at what stage, and what coverage we expect. Without this agreement hard to expect consistency it testing trade-offs solving across the codebase.

# Coding agents and Ralph loop changes flow for IC
