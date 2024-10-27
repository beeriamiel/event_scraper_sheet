import FirecrawlApp from 'firecrawl';

const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });

async function scrapeUrl(url: string) {
  try {
    const scrapeResult = await app.scrapeUrl(url, {
      formats: ['markdown', 'extract'],
      extract: {
        prompt: "Extract key information from this page."
      }
    });

    if (!scrapeResult.success) {
      console.error(`Scraping failed for ${url}: ${scrapeResult.error}`);
      return null;
    }

    // Check if 'data' property exists, otherwise return the whole result
    return 'data' in scrapeResult ? scrapeResult.data : scrapeResult;
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
    return null;
  }
}

function postProcessLlmOutput(extractData: any) {
  if (typeof extractData !== 'object' || extractData === null) {
    return { raw_output: extractData };
  }

  // Add any necessary transformations here
  return extractData;
}

export async function extractEventUrl(url: string): Promise<string> {
  try {
    const scrapedData = await scrapeUrl(url);
    if (!scrapedData) {
      throw new Error('Failed to scrape URL');
    }

    // Check if scrapedData has an 'extract' property
    if (typeof scrapedData === 'object' && 'extract' in scrapedData) {
      // If it does, check for a 'url' field in the extract object
      const extractedUrl = (scrapedData.extract as any)?.url;
      if (extractedUrl && typeof extractedUrl === 'string') {
        return extractedUrl;
      }
    }

    // If we couldn't find a URL in the extracted data, return the original URL
    console.log(`No URL found in extracted data for ${url}, returning original URL`);
    return url;
  } catch (error) {
    console.error(`Error extracting event URL for ${url}:`, error);
    return url; // Return the original URL if extraction fails
  }
}