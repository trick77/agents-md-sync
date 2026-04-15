## Testing

- Framework: Jasmine + Karma by default (Angular CLI default). Projects on Vitest/Jest should override this via `.agents/TESTING.md`.
- Use `TestBed.configureTestingModule` with standalone components in `imports`, not `declarations`.
- Prefer `ComponentFixture` + DOM queries for component tests. Use `HarnessLoader` for Angular Material components.
- Mock HTTP with `HttpTestingController` (`provideHttpClientTesting()`).
- One `describe` per component/service; nested `describe` blocks for scenarios.
- Test names: `it('should <behavior> when <condition>')`.
- Run unit tests: `npm test` (single run: `npm test -- --watch=false --browsers=ChromeHeadless`).
- Do not test private methods directly. Test through the public API.
- Do not use `fdescribe` / `fit` in committed code.
