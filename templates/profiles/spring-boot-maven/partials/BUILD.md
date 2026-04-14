## Build & Run

- Build: `./mvnw clean verify`
- Run locally: `./mvnw spring-boot:run`
- Format: `./mvnw spotless:apply`
- Use the committed `./mvnw` wrapper. Do not rely on a globally-installed Maven.
- Required JDK version is repo-specific — check `pom.xml` (`java.version` / `maven.compiler.release`).
- Do not commit `.env` or local `application-*.yml` overrides.
- Docker image: `./mvnw spring-boot:build-image`.
