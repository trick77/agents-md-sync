## Coding

- TypeScript strict mode. No `any` without a written reason.
- Prefer standalone components over NgModules. Use the `inject()` function rather than constructor DI.
- Use signals (`signal`, `computed`, `effect`) for component state. Avoid `BehaviorSubject` for new UI state.
- Use the new control flow (`@if`, `@for`, `@switch`). Do not use `*ngIf`, `*ngFor` in new code.
- Components: suffix `.component.ts`; services: `.service.ts`; directives: `.directive.ts`; guards: `.guard.ts`.
- One component/service/directive per file.
- Templates: prefer inline templates only for components under ~15 lines of markup; otherwise use a separate `.html` file.
- Styling: use component-scoped styles. Avoid `::ng-deep`.
- Forms: prefer Reactive Forms over Template-driven for anything beyond trivial inputs.
- HTTP: always type the response. Handle errors at the service layer, not in components.
