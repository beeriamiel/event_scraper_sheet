import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('Supabase URL:', supabaseUrl ? 'Set' : 'Not set')
console.log('Supabase Anon Key:', supabaseAnonKey ? 'Set' : 'Not set')

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(`Missing Supabase environment variables. 
    NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? 'Set' : 'Not set'}
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ${supabaseAnonKey ? 'Set' : 'Not set'}
  `)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function saveEventsToDatabase(events: any[]) {
  const { data, error } = await supabase
    .from('scraped_events')
    .upsert(events.map(event => ({
      name: event.name,
      description: event.description,
      start_date: event.start_date,
      end_date: event.end_date,
      city: event.city,
      state: event.state,
      country: event.country,
      attendee_count: event.attendee_count,
      topics: Array.isArray(event.topics) ? event.topics : event.topics ? [event.topics] : null,
      event_type: event.event_type,
      attendee_title: Array.isArray(event.attendee_title) ? event.attendee_title : event.attendee_title ? [event.attendee_title] : null,
      logo_url: event.logo_url,
      sponsorship_options: event.sponsorship_options,
      agenda: event.agenda,
      audience_insights: event.audience_insights,
      sponsors: Array.isArray(event.sponsors) ? event.sponsors : event.sponsors ? [event.sponsors] : null,
      hosting_company: event.hosting_company,
      url: event.url,
      ticket_cost: event.ticket_cost,
      contact_email: event.contact_email,
      event_markdown: event.event_markdown
    })), { 
      onConflict: 'url',
      ignoreDuplicates: false
    })

  if (error) {
    console.error('Error saving events to database:', error)
    console.error('Error details:', JSON.stringify(error, null, 2))
    throw error
  }

  return data
}