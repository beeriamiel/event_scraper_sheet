import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Event = {
  id: string;
  name: string;
  date: string | Date;
  location: string;
};

export default function Home() {
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []);

  async function fetchEvents() {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) console.error('Error fetching events:', error);
    else setEvents(data as Event[] || []);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (response.ok) {
        setUrl('');
        fetchEvents();
      } else {
        throw new Error('Failed to extract event');
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Event Extractor</h1>
      <form onSubmit={handleSubmit} className="mb-4">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter event URL"
          required
          className="border p-2 mr-2"
        />
        <button type="submit" disabled={loading} className="bg-blue-500 text-white p-2">
          {loading ? 'Extracting...' : 'Extract Event'}
        </button>
      </form>
      <div>
        <h2 className="text-xl font-semibold mb-2">Extracted Events</h2>
        <ul>
          {events.map((event: Event) => (
            <li key={event.id} className="mb-2">
              <strong>{event.name}</strong> - {new Date(event.date).toLocaleDateString()}
              <br />
              {event.location}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}