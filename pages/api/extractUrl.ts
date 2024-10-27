import type { NextApiRequest, NextApiResponse } from 'next';
import { extractEventUrl } from '../../app/lib/urlExtractor';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      const { url } = req.body;
      const extractedUrl = await extractEventUrl(url);
      res.status(200).json({ extractedUrl });
    } catch (error) {
      res.status(500).json({ error: 'Failed to extract URL' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}