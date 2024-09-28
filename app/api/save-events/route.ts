import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(request: Request) {
  try {
    const { events } = await request.json();
    
    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: 'Invalid events data' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('scraped_events')
      .insert(events.map(event => {
        const parsedEvent = typeof event === 'string' ? JSON.parse(event) : event;
        return {
          name: parsedEvent.name,
          description: parsedEvent.description,
          start_date: parsedEvent.start_date,
          end_date: parsedEvent.end_date,
          city: parsedEvent.city,
          state: parsedEvent.state,
          country: parsedEvent.country,
          url: parsedEvent.url
        };
      }))
      .select();

    if (error) throw error;

    const savedCount = Array.isArray(data) ? data.length : 0;
    console.log(`Saved ${savedCount} events to the database`);
    return NextResponse.json({ message: `Events saved successfully. Saved ${savedCount} events.` }, { status: 200 });
  } catch (error: any) {
    console.error('Error saving events:', error);
    return NextResponse.json({ error: 'Failed to save events', details: error.message }, { status: 500 });
  }
}