## Coding

- Use Lombok: `@RequiredArgsConstructor` for DI, `val` for local variables, `@Slf4j` for logging.
- Package by feature, not by layer: `com.company.<feature>/{api,domain,infra}`.
- Controllers stay thin — no business logic. Services orchestrate, domain objects enforce invariants.
- Prefer constructor injection. No field injection (`@Autowired` on fields).
- Use `record` for immutable DTOs. Use `Optional` only for return types, never for parameters or fields.
- Format with Spotless (`./gradlew spotlessApply`). Do not commit unformatted code.
- No `System.out` / `printStackTrace`. Use SLF4J.
