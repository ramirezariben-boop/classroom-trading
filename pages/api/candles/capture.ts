import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  // aquí luego metemos la lógica real de captura
  return res.status(200).json({ ok: true, tag: "candles-capture-pages" });
}
