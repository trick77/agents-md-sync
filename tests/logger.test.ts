import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logger, setLevel } from "../src/logger.js";

describe("logger", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    setLevel("info");
  });

  it("suppresses messages below the current level", () => {
    setLevel("warn");
    logger.info("quiet");
    logger.debug("quiet");
    expect(logSpy).not.toHaveBeenCalled();
    expect(errSpy).not.toHaveBeenCalled();
  });

  it("routes info/debug to stdout and warn/error to stderr", () => {
    setLevel("debug");
    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");
    expect(logSpy).toHaveBeenCalledTimes(2);
    expect(errSpy).toHaveBeenCalledTimes(2);
  });

  it("prefixes each line with the level tag", () => {
    setLevel("info");
    logger.info("hello");
    const [prefix, msg] = logSpy.mock.calls[0] as [string, string];
    // eslint-disable-next-line no-control-regex
    expect(prefix.replace(/\x1b\[[0-9;]*m/g, "")).toBe("[info]");
    expect(msg).toBe("hello");
  });
});
