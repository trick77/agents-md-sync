## Build & Run

- Install deps: `npm ci` (use the committed `package-lock.json`; do not `npm install` in CI).
- Dev server: `npm start` (alias for `ng serve`).
- Production build: `npm run build` (alias for `ng build`).
- Lint: `npm run lint`.
- Required Node version is repo-specific — see `.nvmrc` or `package.json` `engines`.
- Do not commit `node_modules/` or local `.env` files.
- Angular CLI commands run through `npx ng <cmd>` or scripts defined in `package.json`.
