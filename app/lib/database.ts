import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

console.log('Supabase URL:', supabaseUrl ? 'Set' : 'Not set')
console.log('Supabase Anon Key:', supabaseAnonKey ? 'Set' : 'Not set')

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(`Missing Supabase environment variables. 
    NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? 'Set' : 'Not set'}
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ${supabaseAnonKey ? 'Set' : 'Not set'}
  `)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Update the EventData type
type EventData = {
  name: string;
  description?: string;
  start_date: string; // Remove optional modifier
  end_date?: string;
  city?: string;
  state?: string;
  country?: string;
  attendee_count?: number | string;
  topics?: string[] | string;
  event_type?: string;
  attendee_title?: string[] | string;
  logo_url?: string;
  sponsorship_options?: object | string;
  agenda?: object | string;
  audience_insights?: object | string;
  sponsors?: string[] | string;
  hosting_company?: string;
  url: string;
  ticket_cost?: string;
  contact_email?: string;
  event_markdown?: string;
};

export async function saveEventsToDatabase(events: EventData[]) {
  try {
    const uniqueEvents = events.reduce<Record<string, EventData>>((acc, event) => {
      acc[event.url] = event;
      return acc;
    }, {});

    const transformedEvents = Object.values(uniqueEvents).map(event => ({
      name: event.name,
      description: event.description,
      start_date: event.start_date,
      end_date: event.end_date,
      city: event.city,
      state: event.state,
      country: event.country,
      attendee_count: event.attendee_count?.toString(),
      topics: Array.isArray(event.topics) ? event.topics : typeof event.topics === 'string' ? [event.topics] : null,
      event_type: event.event_type,
      attendee_title: Array.isArray(event.attendee_title) ? event.attendee_title : typeof event.attendee_title === 'string' ? [event.attendee_title] : null,
      logo_url: event.logo_url,
      sponsorship_options: typeof event.sponsorship_options === 'object' ? JSON.stringify(event.sponsorship_options) : event.sponsorship_options,
      agenda: typeof event.agenda === 'object' ? JSON.stringify(event.agenda) : event.agenda,
      audience_insights: typeof event.audience_insights === 'object' ? JSON.stringify(event.audience_insights) : event.audience_insights,
      sponsors: Array.isArray(event.sponsors) ? event.sponsors : typeof event.sponsors === 'string' ? [event.sponsors] : null,
      hosting_company: event.hosting_company,
      url: event.url,
      ticket_cost: event.ticket_cost,
      contact_email: event.contact_email,
      event_markdown: event.event_markdown
    }));

    console.log('Attempting to save events:', transformedEvents);

    const { data, error } = await supabase
      .from('scraped_events')
      .upsert(transformedEvents, { 
        onConflict: 'url',
        ignoreDuplicates: false
      });

    if (error) {
      console.error('Supabase error details:', error);
      throw error;
    }

    console.log('Events saved successfully:', data);
    return data;
  } catch (error) {
    console.error('Error saving events to database:', error);
    throw error;
  }
}