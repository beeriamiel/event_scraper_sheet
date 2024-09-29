import { z } from 'zod';
import axios, { isAxiosError } from 'axios';

// Define a more flexible schema for event data validation
const EventDataSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  attendee_count: z.union([
    z.literal('0-100'),
    z.literal('100-500'),
    z.literal('500-1000'),
    z.literal('1000-5000'),
    z.literal('5000-10000'),
    z.literal('10000+'),
    z.null()
  ]).optional(),
  topics: z.union([z.array(z.string()), z.string(), z.null()]).optional(),
  attendee_title: z.union([z.array(z.string()), z.string(), z.null()]).optional(),
  logo_url: z.string().optional(),
  sponsorship_options: z.union([z.string(), z.record(z.unknown()), z.null()]).optional(),
  agenda: z.union([z.string(), z.record(z.unknown()), z.null()]).optional(),
  audience_insights: z.union([z.string(), z.record(z.unknown()), z.null()]).optional(),
  sponsors: z.union([z.array(z.string()), z.string(), z.null()]).optional(),
  hosting_company: z.union([z.string(), z.record(z.unknown()), z.null()]).optional(),
  ticket_cost: z.union([z.string(), z.null()]).optional(),
  contact_email: z.union([z.string(), z.null()]).optional(),
  url: z.string()
});

type EventData = z.infer<typeof EventDataSchema>;

interface ExtractedData {
  event: EventData;
  markdown: string;
}

export async function extractAndStoreEvent(url: string): Promise<ExtractedData> {
  console.log('Extracting data for URL:', url);
  try {
    const response = await axios.post('/api/extract', { url }, {
      timeout: 60000
    });
    
    console.log('Raw API response:', response.data);

    if (response.data.error) {
      throw new Error(response.data.error);
    }

    // Check if the expected data is present
    if (!response.data.event || !response.data.markdown) {
      throw new Error('Incomplete data received from API');
    }

    // Validate the response data
    const validatedData = EventDataSchema.parse({...response.data.event, url});
    
    console.log('Validated data:', validatedData);
    return {
      event: validatedData,
      markdown: response.data.markdown
    };
  } catch (error) {
    console.error('Error extracting event data:', error);
    if (isAxiosError(error)) {
      console.error('Axios error details:', error.response?.data);
      if (error.code === 'ECONNABORTED') {
        throw new Error('Request to API timed out. Please try again.');
      }
      if (error.response?.status === 500) {
        throw new Error('Internal server error. The event data might be in an unexpected format.');
      }
      throw new Error(error.response?.data?.error || 'Failed to extract event data');
    }
    if (error instanceof z.ZodError) {
      console.error('Zod validation error:', error.errors);
      throw new Error('Invalid event data format received');
    }
    throw error;
  }
}