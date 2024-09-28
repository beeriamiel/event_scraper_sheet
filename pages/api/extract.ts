import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

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
      
      // Make a request to the Firecrawl API
      const firecrawlResponse = await axios.post('https://api.firecrawl.dev/v1/scrape', {
        url,
        formats: ["extract"],
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
              attendee_count: { type: ["number", "string"] },
              topics: { type: "array", items: { type: "string" } },
              event_type: { type: "string" },
              attendee_title: { type: "string" },
              logo_url: { type: "string" },
              sponsorship_options: { type: ["string", "object"] },
              agenda: { type: ["string", "object"] },
              audience_insights: { type: ["string", "object"] },
              sponsors: { 
                type: ["array", "object"],
                items: { type: "string" }
              },
              hosting_company: { type: ["string", "object"] }
            },
            required: ["name", "start_date"]
          },
          prompt: `Extract detailed event information including:
            - name
            - description
            - start date
            - end date
            - city
            - state (full state name)
            - country
            - attendee count
            - topics or themes that will be discussed at conference
            - event type: choose between: conference, workshop, roundtable
            - titles of attendees attending event
            - logo URL
            - sponsorship options (not ticket prices)
            - event agenda or schedule
            - demographics of attendees
            - list of companies who are sponsoring the event, also called partners or exhibitors (company names only)
            - hosting company or organization
            - contact email
            - cost of ticket to attend
            Provide as much detail as possible for each field. Don't make anything up. Use information that you extracted only.
            If you don't know what something is, leave it blank.`
        }
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`
        },
        timeout: 30000 // 30-second timeout
      });

      console.log('Firecrawl API response received');
      console.log('Firecrawl API response status:', firecrawlResponse.status);
      console.log('Firecrawl API response data:', JSON.stringify(firecrawlResponse.data, null, 2));

      // Send the extracted data back to the client
      res.status(200).json({ event: firecrawlResponse.data.data.extract });
    } catch (error: any) {
      console.error('Error in API handler:', error);
      let errorMessage = 'Failed to extract event';
      let errorDetails = {};

      if (axios.isAxiosError(error)) {
        console.error('Axios error:', error.message);
        console.error('Axios error code:', error.code);
        console.error('Axios error response:', error.response?.data);

        if (error.code === 'ECONNABORTED') {
          errorMessage = 'Request to Firecrawl API timed out';
        } else if (error.code === 'ENOTFOUND') {
          errorMessage = 'Unable to connect to Firecrawl API. Please check your internet connection and try again.';
        } else if (error.response) {
          errorMessage = `Firecrawl API error: ${error.response.status} ${error.response.statusText}`;
        }
        errorDetails = {
          code: error.code,
          message: error.message,
          response: error.response?.data
        };
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