// lib/api.ts
export async function login(userId: string, code: string) {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, code }),
  });
  return res.json();
}

export async function logout() {
  const res = await fetch("/api/logout", { method: "POST" });
  return res.json();
}

export async function getMe() {
  const res = await fetch("/api/me");
  return res.json();
}
