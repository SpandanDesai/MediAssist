import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

// Mock the API layer so we can drive the auth bootstrap without a network/axios.
// vi.hoisted ensures the fakes exist before the module graph (which imports
// ../lib/api transitively) is evaluated.
const mocks = vi.hoisted(() => ({
  authApi: { login: vi.fn(), signup: vi.fn(), logout: vi.fn() },
  profileApi: { get: vi.fn() },
  api: { interceptors: { response: { use: vi.fn(() => 1), eject: vi.fn() } } },
}));
vi.mock("../lib/api", () => ({
  authApi: mocks.authApi,
  profileApi: mocks.profileApi,
  api: mocks.api,
}));

const SESSION_HINT_KEY = "mediassist.session";
const USER_KEY = "mediassist.user";

import type { User } from "../types";
import { AuthProvider, useAuth } from "../contexts/AuthContext";

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

const sampleUser: User = {
  id: "u1",
  name: "Ada",
  email: "ada@example.com",
  age: null,
  gender: null,
  blood_group: null,
  allergies: null,
  medical_history: null,
  chronic_diseases: null,
  current_medications: null,
  emergency_contact: null,
  allergy_list: [],
  medication_list: [],
};

const authApi = mocks.authApi;
const profileApi = mocks.profileApi;

describe("AuthContext bootstrap", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("skips the bootstrap request without a session hint", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(profileApi.get).not.toHaveBeenCalled();
    expect(result.current.user).toBeNull();
  });

  it("restores the user when a session hint exists and the cookie is valid", async () => {
    localStorage.setItem(SESSION_HINT_KEY, "1");
    profileApi.get.mockResolvedValue(sampleUser);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(profileApi.get).toHaveBeenCalledTimes(1);
    expect(result.current.user?.id).toBe("u1");
  });

  it("clears the session when bootstrap verification fails", async () => {
    localStorage.setItem(SESSION_HINT_KEY, "1");
    localStorage.setItem(USER_KEY, JSON.stringify(sampleUser));
    profileApi.get.mockRejectedValue(new Error("401"));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem(SESSION_HINT_KEY)).toBeNull();
  });

  it("records a session hint and user on successful login", async () => {
    authApi.login.mockResolvedValue({ token: "x", user: sampleUser });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.login({ email: "ada@example.com", password: "secret" });
    });
    expect(localStorage.getItem(SESSION_HINT_KEY)).toBe("1");
    expect(result.current.user?.id).toBe("u1");
  });
});
