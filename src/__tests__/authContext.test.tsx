import { renderHook, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/context/AuthContext";

describe("AuthContext — corrupted localStorage regression (audit #1)", () => {
  it("renders with user:null instead of crashing on malformed aa_user", () => {
    localStorage.setItem("aa_user", "{corrupted json!!");

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("clears the bad value so the corruption cannot recur on next boot", () => {
    localStorage.setItem("aa_user", "{corrupted json!!");

    renderHook(() => useAuth(), { wrapper: AuthProvider });

    expect(localStorage.getItem("aa_user")).toBeNull();
  });

  it("still restores a valid persisted session", () => {
    localStorage.setItem("aa_user", JSON.stringify({ id: "u1", email: "a@b.co", name: "A" }));

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    expect(result.current.user).toEqual({ id: "u1", email: "a@b.co", name: "A" });
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("signIn persists a fresh session to localStorage", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await act(async () => {
      await result.current.signIn("dev@acme.com", "hunter2");
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.email).toBe("dev@acme.com");
    expect(JSON.parse(localStorage.getItem("aa_user")!)).toMatchObject({ email: "dev@acme.com" });
  });
});
