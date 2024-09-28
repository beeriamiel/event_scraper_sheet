import { z } from 'zod';
import axios from 'axios';

// Define a schema for event data validation
const EventDataSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  attendee_count: z.union([z.number(), z.string()]).optional(),
  topics: z.array(z.string()).optional(),
  event_type: z.string().optional(),
  attendee_title: z.string().optional(),
  logo_url: z.string().optional(),
  sponsorship_options: z.union([z.string(), z.record(z.unknown())]).optional(),
  agenda: z.union([z.string(), z.record(z.unknown())]).optional(),
  audience_insights: z.union([z.string(), z.record(z.unknown())]).optional(),
  sponsors: z.union([z.array(z.string()), z.record(z.unknown())]).optional(),
  hosting_company: z.union([z.string(), z.record(z.unknown())]).optional(),
  url: z.string()
});

type EventData = z.infer<typeof EventDataSchema>;

export async function extractAndStoreEvent(url: string): Promise<EventData> {
  console.log('Extracting data for URL:', url);
  try {
    // Make a request to your API route
    const response = await axios.post('/api/extract', { url }, {
      timeout: 60000 // Set a 60-second timeout
    });
    
    console.log('Raw API response:', response.data);

    if (response.data.error) {
      throw new Error(response.data.error);
    }

    // Validate the response data
    const validatedData = EventDataSchema.parse({...response.data.event, url});
    
    console.log('Validated data:', validatedData);
    return validatedData;
  } catch (error) {
    console.error('Error extracting event data:', error);
    if (axios.isAxiosError(error)) {
      console.error('Axios error details:', error.response?.data);
      if (error.code === 'ECONNABORTED') {
        throw new Error('Request to API timed out. Please try again.');
      }
      throw new Error(error.response?.data?.error || 'Failed to extract event data');
    }
    throw error;
  }
}