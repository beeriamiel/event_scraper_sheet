const FirecrawlApp = require('@mendable/firecrawl-js');
require('dotenv').config({ path: '.env.local' });

const firecrawl = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY
});

async function testFirecrawl() {
  try {
    const result = await firecrawl.scrapeUrl('https://events.linuxfoundation.org/open-source-summit-europe/');
    console.log('Scrape result:', result);
  } catch (error) {
    console.error('Error:', error);
  }
}

testFirecrawl();