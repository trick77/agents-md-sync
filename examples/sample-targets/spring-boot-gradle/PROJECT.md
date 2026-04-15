## Project

Ingestion service for the telemetry pipeline. Spring Boot application built with Gradle that receives batched events over HTTP, validates them against the schema registry, and publishes to Kafka for downstream processors. Throughput targets are documented in the SLO doc; this service is on the hot path so allocation-heavy changes need benchmarking before merge.
