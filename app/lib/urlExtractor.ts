export async function extractEventUrl(devEventsUrl: string): Promise<string> {
  try {
    const response = await fetch('/api/extractUrl', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: devEventsUrl }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to extract URL: ${errorData.error || response.statusText}`);
    }

    const data = await response.json();
    if (!data.extractedUrl) {
      throw new Error('No URL extracted');
    }
    return data.extractedUrl;
  } catch (error) {
    console.error('Error extracting event URL:', error);
    throw error;
  }
}