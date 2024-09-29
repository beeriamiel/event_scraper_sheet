import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { isAxiosError } from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('Firecrawl API Key:', process.env.FIRECRAWL_API_KEY ? 'Set' : 'Not set');

  if (req.method === 'POST') {
    console.log('Received POST request:', req.body);
    try {
      const { url } = req.body;
      if (!url) {
        throw new Error('URL is required');
      }

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
              attendee_count: { type: "string" }, // Changed to string type
              topics: { type: ["array", "string", "null"], items: { type: "string" } },
              event_type: { type: "string" },
              attendee_title: { 
                type: ["string", "array"],
                items: { type: "string" }
              },
              logo_url: { type: "string" },
              sponsorship_options: { type: ["string", "object", "null"] },
              agenda: { type: ["string", "object", "null"] },
              audience_insights: { type: ["string", "object", "null"] },
              sponsors: { 
                type: ["array", "object", "string", "null"],
                items: { type: "string" }
              },
              hosting_company: { type: ["string", "object", "null"] },
              ticket_cost: { type: ["string", "null"] },
              contact_email: { type: ["string", "null"] }
            },
            required: ["name"]
          },
          prompt: `Extract detailed event information including:
            - name
            - description
            - start date
            - end date
            - city
            - state (full state name)
            - country
            - estimate of attendee count, must be one of these exact strings: 
              - 0-100
              - 100-500
              - 500-1000
              - 1000-5000
              - 5000-10000
              - 10000+
            - topics or themes that will be discussed at conference
            - event type: choose between: conference, workshop, roundtable
            - titles of attendees attending event - must pick between, and can pick more than one:
                -C-Suite
                -Director
                -Vice President
                -Manager
                -Engineer 
                -Analyst
                -Researcher
            - logo URL
            - sponsorship options (not ticket prices)
            - event agenda or schedule
            - demographics of attendees
            - list of companies who are sponsoring the event, also called partners or exhibitors (company names only)
            - hosting company or organization
            - contact email
            - cost of ticket to attend
            Provide as much detail as possible for each field. Don't make anything up. Use information that you extracted only.
            If you don't know what something is, leave it blank or null.`
        }
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`
        },
        timeout: 55000
      });

      // Add a check for the response structure
      if (!firecrawlResponse.data || !firecrawlResponse.data.data) {
        throw new Error('Unexpected response structure from Firecrawl API');
      }

      console.log('Firecrawl API response received');
      console.log('Firecrawl API response status:', firecrawlResponse.status);
      console.log('Firecrawl API response data:', JSON.stringify(firecrawlResponse.data, null, 2));

      // Ensure we're sending both the extracted data and markdown
      res.status(200).json({ 
        event: firecrawlResponse.data.data.extract,
        markdown: firecrawlResponse.data.data.markdown
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
      }

      res.status(500).json({ 
        error: errorMessage,
        details: errorDetails
      });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}