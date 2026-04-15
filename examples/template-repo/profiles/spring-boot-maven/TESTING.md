## Testing

- JUnit 5, AssertJ, Mockito. Use AssertJ only (`assertThat`, `assertThatThrownBy`) — never JUnit's `Assert*`.
- Class under test: name the variable `testee`.
- Method naming: `when<Condition>_then<Expected>()` or `verb_condition_result()`.
- Group related scenarios with `@Nested` classes. Do NOT use `@DisplayName`.
- Use `@ExtendWith(MockitoExtension.class)` with `@Mock` fields for unit tests.
- Use `lombok.val` for all local variables in tests.
- Structure each test with `// Given`, `// When`, `// Then` comments.
- Run: `./mvnw test`. Integration tests: `./mvnw verify`.
- Do not mock the class under test. Do not mock types you do not own without wrapping them first.
