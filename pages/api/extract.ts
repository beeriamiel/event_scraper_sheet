import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { isAxiosError } from 'axios';

// Add this function to validate and correct URLs
function validateAndCorrectUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    // Check if the hostname has at least two parts (domain and TLD)
    const hostnameParts = parsedUrl.hostname.split('.');
    if (hostnameParts.length < 2) {
      // If not, assume it's missing the www subdomain
      parsedUrl.hostname = `www.${parsedUrl.hostname}`;
    }
    return parsedUrl.toString();
  } catch (error) {
    // If URL parsing fails, try prepending 'https://'
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return validateAndCorrectUrl(`https://${url}`);
    }
    // If it still fails, return the original URL
    return url;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('Firecrawl API Key:', process.env.FIRECRAWL_API_KEY ? 'Set' : 'Not set');

  if (req.method === 'POST') {
    console.log('Received POST request:', req.body);
    try {
      let { url } = req.body;
      if (!url) {
        throw new Error('URL is required');
      }

      // Validate and correct the URL
      url = validateAndCorrectUrl(url);
      console.log('Validated URL:', url);

      console.log('Attempting to connect to Firecrawl API...');
      
      const firecrawlResponse = await axios.post('https://api.firecrawl.dev/v1/scrape', {
        url,
        formats: ["markdown", "extract"],
        extract: {
          schema: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              start_date: { type: "string" },
              end_date: { type: "string" },
              city: { type: "string" },
              state: { type: "string" },
              country: { type: "string" },
              attendee_count: { type: "string" },
              topics: { type: "string" },
              event_type: { type: "string" },
              attendee_title: { type: "string" },
              logo_url: { type: "string" },
              sponsorship_options: { type: "string" },
              agenda: { type: "string" },
              audience_insights: { type: "string" },
              sponsors: { type: "string" },
              hosting_company: { type: "string" },
              ticket_cost: { type: "string" },
              contact_email: { type: "string" }
            },
            required: ["name"],
            additionalProperties: true
          },
          prompt: `Extract detailed event information. For each field, provide the information as a simple string. If a field contains multiple items, separate them with commas. If information is not available, use "N/A". Fields to extract:

            - name: Event name
            - description: Brief description of the event
            - start_date: Start date of the event, must be formatted as YYYY-MM-DD
            - end_date: End date of the event, must be formatted as YYYY-MM-DD
            - city: City where the event is held
            - state: Full state name where the event is held
            - country: Country where the event is held
            - attendee_count: Estimated number of attendees (use one of these: 0-100, 100-500, 500-1000, 1000-5000, 5000-10000, 10000+, or N/A if not specified)
            - topics: Main topics or themes of the conference (comma-separated)
            - event_type: Type of event (conference, workshop, or roundtable)
            - attendee_title: Titles of attendees (comma-separated, choose from: C-Suite, Director, Vice President, Manager, Engineer, Analyst, Researcher)
            - logo_url: URL of the event logo
            - sponsorship_options: Available sponsorship options (brief summary)
            - agenda: Brief summary of the event agenda or schedule
            - audience_insights: Brief description of attendee demographics
            - sponsors: List of sponsoring companies (comma-separated)
            - hosting_company: Name of the company or organization hosting the event
            - ticket_cost: Cost of attending the event
            - contact_email: Contact email for the event

            Provide as much accurate information as possible based on the event webpage. Do not invent or assume any information. If a piece of information is not available, use "N/A".`
        }
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`
        },
        timeout: 55000
      });

      console.log('Firecrawl API response received');
      console.log('Firecrawl API response status:', firecrawlResponse.status);
      console.log('Firecrawl API response data:', JSON.stringify(firecrawlResponse.data, null, 2));

      let extractedData, markdown;

      if (firecrawlResponse.data && firecrawlResponse.data.data) {
        extractedData = firecrawlResponse.data.data.extract;
        markdown = firecrawlResponse.data.data.markdown;
      } else if (firecrawlResponse.data && firecrawlResponse.data.extract) {
        extractedData = firecrawlResponse.data.extract;
        markdown = firecrawlResponse.data.markdown || '';
      } else {
        throw new Error('Unexpected response structure from Firecrawl API');
      }

      // Ensure all fields are strings and handle potential null/undefined values
      const sanitizedData = Object.entries(extractedData).reduce((acc, [key, value]) => {
        acc[key] = value != null ? String(value) : 'N/A';
        return acc;
      }, {} as Record<string, string>);

      res.status(200).json({ 
        event: sanitizedData,
        markdown: markdown
      });
    } catch (error: any) {
      console.error('Error in API handler:', error);
      let errorMessage = 'Failed to extract event';
      let errorDetails: any = {};

      if (isAxiosError(error)) {
        console.error('Axios error:', error.message);
        console.error('Axios error code:', error.code);
        console.error('Axios error response:', error.response?.data);

        if (error.code === 'ECONNABORTED') {
          errorMessage = 'Request to Firecrawl API timed out';
        } else if (error.response) {
          errorMessage = `Firecrawl API error: ${error.response.status} ${error.response.statusText}`;
          if (error.response.status === 500) {
            errorMessage += ' (Possible JSON parsing error)';
          }
        }
        errorDetails = {
          code: error.code,
          message: error.message,
          response: error.response?.data
        };
      } else if (error instanceof Error) {
        errorMessage = error.message;
        errorDetails = {
          name: error.name,
          stack: error.stack
        };
      }

      // Instead of sending a 500 status, send a 200 status with error information
      res.status(200).json({ 
        error: errorMessage,
        details: errorDetails
      });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}