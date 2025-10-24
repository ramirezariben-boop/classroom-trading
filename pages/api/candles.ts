import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { ticker = "BAUMXP", tf = "1m", limit = "10" } = req.query as Record<string, string>;
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ ok: true, tag: "candles-pages", ticker, tf, limit: Number(limit) });
}
