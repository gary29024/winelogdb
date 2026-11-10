# Working in this repository

## Pull requests: open as a draft, mark ready once

GitHub Actions minutes are limited. Every push to a pull request that is ready for review repeats the
full round of checks, including the browser tests. A draft runs only lint, build and the affected unit
tests.

- Open every pull request as a **draft**.
- Push fixes while it is still a draft.
- Mark it **ready for review** once, when the work is finished and the draft checks are green. That
  starts the browser tests and the platform gate.
- Run `npx tsc -b`, `npx eslint .` and the affected `vitest` files locally before pushing, so a push is
  not spent finding a failure a local run would have shown.

How the checks are selected and grouped is described in [docs/testing-strategy.md](docs/testing-strategy.md).
