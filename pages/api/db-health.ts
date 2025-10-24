import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  // mínimo para verificar que la ruta existe
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ ok: true, tag: 'db-health-pages' });
}
