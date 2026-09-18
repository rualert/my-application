import { apiRequest } from "./client";
import type { AuthResponse } from "./types";

const BASE_PATH = "/Auth";

export function loginWithGoogle(idToken: string): Promise<AuthResponse> {
  return apiRequest(`${BASE_PATH}/google`, { method: "POST", body: JSON.stringify({ idToken }) });
}

export function refresh(): Promise<AuthResponse> {
  return apiRequest(`${BASE_PATH}/refresh`, { method: "POST" });
}

export function logout(): Promise<void> {
  return apiRequest(`${BASE_PATH}/logout`, { method: "POST" });
}
