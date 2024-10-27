import { z } from 'zod';
import axios, { isAxiosError } from 'axios';

// Helper function to clean string data
function cleanString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().toLowerCase();
  return cleaned === 'n/a' || cleaned === '' ? null : value.trim();
}

// Helper function to clean number data
function cleanNumber(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().toLowerCase();
  if (cleaned === 'n/a' || cleaned === '') return null;
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

// Helper function to clean array data
function cleanArray(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    return value.map(cleanString).filter((item): item is string => item !== null);
  }
  if (typeof value === 'string') {
    const cleaned = cleanString(value);
    return cleaned ? [cleaned] : null;
  }
  return null;
}

// Define a more flexible schema for event data validation
const EventDataSchema = z.object({
  name: z.string().min(1), // Ensure name is not empty
  description: z.string().nullable(),
  start_date: z.string().min(1), // Ensure start_date is not empty
  end_date: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  country: z.string().nullable(),
  attendee_count: z.number().nullable(),
  topics: z.array(z.string()).nullable(),
  event_type: z.string().nullable(),
  attendee_title: z.string().nullable(),
  logo_url: z.string().nullable(),
  sponsorship_options: z.string().nullable(),
  agenda: z.string().nullable(),
  audience_insights: z.string().nullable(),
  sponsors: z.string().nullable(),
  hosting_company: z.string().nullable(),
  ticket_cost: z.string().nullable(),
  contact_email: z.string().nullable(),
  url: z.string()
}).passthrough();

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
      throw new Error(`API Error: ${response.data.error}\nDetails: ${JSON.stringify(response.data.details)}`);
    }

    // Check if the expected data is present
    if (!response.data.event || !response.data.markdown) {
      throw new Error('Incomplete data received from API');
    }

    // Clean and normalize the data
    const cleanedData = {
      ...response.data.event,
      name: cleanString(response.data.event.name) || 'Unnamed Event', // Provide a default name if it's null
      start_date: cleanString(response.data.event.start_date) || new Date().toISOString().split('T')[0], // Use current date if start_date is null
      description: cleanString(response.data.event.description),
      end_date: cleanString(response.data.event.end_date),
      city: cleanString(response.data.event.city),
      state: cleanString(response.data.event.state),
      country: cleanString(response.data.event.country),
      attendee_count: cleanNumber(response.data.event.attendee_count),
      topics: cleanArray(response.data.event.topics),
      event_type: cleanString(response.data.event.event_type),
      attendee_title: cleanString(response.data.event.attendee_title),
      logo_url: cleanString(response.data.event.logo_url),
      sponsorship_options: cleanString(response.data.event.sponsorship_options),
      agenda: cleanString(response.data.event.agenda),
      audience_insights: cleanString(response.data.event.audience_insights),
      sponsors: cleanString(response.data.event.sponsors),
      hosting_company: cleanString(response.data.event.hosting_company),
      ticket_cost: cleanString(response.data.event.ticket_cost),
      contact_email: cleanString(response.data.event.contact_email),
      url: url
    };

    // Validate the cleaned data
    const validatedData = EventDataSchema.parse(cleanedData);
    
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
      throw new Error(error.response?.data?.error || 'Failed to extract event data');
    }
    if (error instanceof z.ZodError) {
      console.error('Zod validation error:', error.errors);
      throw new Error('Invalid event data format received');
    }
    throw error;
  }
}