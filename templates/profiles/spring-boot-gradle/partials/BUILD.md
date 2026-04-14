## Build & Run

- Build: `./gradlew build`
- Run locally: `./gradlew bootRun`
- Format: `./gradlew spotlessApply`
- Use the committed `./gradlew` wrapper. Do not rely on a globally-installed Gradle.
- Required JDK version is repo-specific — check `build.gradle(.kts)` (`java.toolchain.languageVersion`).
- Do not commit `.env` or local `application-*.yml` overrides.
- Docker image: `./gradlew bootBuildImage`.
