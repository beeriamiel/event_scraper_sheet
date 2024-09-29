import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const response = await axios.get(url);
    const html = response.data;

    // Try to find the iframe src
    const iframeMatch = html.match(/<iframe[^>]*title="embedded event's website"[^>]*src="([^"]*)"[^>]*>/i);
    if (iframeMatch && iframeMatch[1]) {
      return res.status(200).json({ extractedUrl: iframeMatch[1] });
    }

    // If iframe not found, look for the "Visit" link
    const visitLinkMatch = html.match(/<a[^>]*href="([^"]*)"[^>]*>Visit<\/a>/i);
    if (visitLinkMatch && visitLinkMatch[1]) {
      return res.status(200).json({ extractedUrl: visitLinkMatch[1] });
    }

    // If neither iframe nor "Visit" link found, try to extract from the original URL
    const urlParts = url.split('/');
    const eventSlug = urlParts[urlParts.length - 1].split('-');
    eventSlug.pop(); // Remove the last part (usually an ID)
    const eventName = eventSlug.join('-');
    
    if (eventName) {
      return res.status(200).json({ extractedUrl: `https://${eventName}.com` });
    }

    throw new Error('Unable to extract event URL');
  } catch (error) {
    console.error('Error extracting event URL:', error);
    res.status(500).json({ error: 'Failed to extract URL' });
  }
}