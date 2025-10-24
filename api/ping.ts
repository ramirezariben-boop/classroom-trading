export const runtime = "nodejs";

export default async function handler(req, res) {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
}
