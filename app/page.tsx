'use client'

import EventSpreadsheet from './components/EventSpreadsheet';

export default function Home() {
  return (
    <div className="min-h-screen p-8 font-sans">
      <main className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Event Extractor</h1>
        <EventSpreadsheet />
      </main>
    </div>
  );
}
