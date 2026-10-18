import { describe, expect, it } from "vitest";
import { api, apiErrorMessage, baseURL } from "./api";

// A minimal stand-in for an Axios error: axios.isAxiosError keys off this flag.
function axiosError(overrides: Record<string, unknown>) {
  return { isAxiosError: true, ...overrides };
}

describe("api client bootstrap", () => {
  it("is configured for cookie-based auth (no JS-readable token)", () => {
    // The whole authentication model depends on these two defaults: the browser
    // attaches the httpOnly session cookie automatically, so nothing is stored in
    // JavaScript. If withCredentials regresses, every authenticated call breaks.
    expect(api.defaults.withCredentials).toBe(true);
    // baseURL is normalised without a trailing slash so paths join cleanly.
    expect(baseURL.endsWith("/")).toBe(false);
  });
});

describe("apiErrorMessage", () => {
  it("surfaces a plain string detail from the server", () => {
    expect(apiErrorMessage(axiosError({ response: { status: 400, data: { detail: "Invalid email" } } }))).toBe(
      "Invalid email",
    );
  });

  it("joins FastAPI validation array details", () => {
    const error = axiosError({
      response: { status: 422, data: { detail: [{ msg: "Field required" }, { msg: "Invalid value" }] } },
    });
    expect(apiErrorMessage(error)).toBe("Field required Invalid value");
  });

  it("falls back to a friendly rate-limit message on 429", () => {
    const error = axiosError({ response: { status: 429, data: {} } });
    expect(apiErrorMessage(error)).toContain("too quickly");
  });

  it("explains an unreachable backend when there is no response", () => {
    const error = axiosError({ response: undefined });
    expect(apiErrorMessage(error)).toContain("Unable to reach MediAssist");
  });

  it("returns the fallback for non-axios errors", () => {
    expect(apiErrorMessage(new Error("boom"), "Please try again.")).toBe("Please try again.");
  });
});
