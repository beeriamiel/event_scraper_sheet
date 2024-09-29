'use client'

import { useEffect, useState } from 'react'
import EventSpreadsheet from './components/EventSpreadsheet';

export default function Home() {
  const [isSupabaseConfigured, setIsSupabaseConfigured] = useState(false)

  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (supabaseUrl && supabaseAnonKey) {
      setIsSupabaseConfigured(true)
    }
  }, [])

  if (!isSupabaseConfigured) {
    return <div>Loading...</div>
  }

  return (
    <div className="min-h-screen p-8 font-sans">
      <main className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Event Extractor</h1>
        <EventSpreadsheet />
      </main>
    </div>
  );
}
