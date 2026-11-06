# Contributing

Use Node.js 22.12 or later and the Yarn version pinned in `package.json`. Run `corepack yarn install --immutable` before making changes.

Keep the renderer independent of frameworks, backend services, and other Seatmap.pro products. KDBush is the spatial-index dependency; keep its major version aligned with the main renderer. Keep the public entry point a compatible subset of the main renderer: no CE-only helpers or public methods. Public types are exported from `src/index.ts`; use explicit types and no `any`. Keep modules under 600 lines and express intent through names and structure instead of explanatory code comments.

Add tests for behaviour changes. Run type checking, lint, formatting, unit tests, library build, and browser tests as listed in the README. Browser tests exercise the built demo, including keyboard navigation, pointer input, selection limits, export, and responsive layout.

Do not include credentials, real attendee data, generated bundles, or dependency directories in a contribution. Synthetic venue examples belong in `demo/venues.ts`.
