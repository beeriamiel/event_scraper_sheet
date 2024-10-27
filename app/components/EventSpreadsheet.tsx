import React, { useState, useEffect } from 'react';
import { extractAndStoreEvent } from '../lib/extractor';
import { saveEventsToDatabase } from '../lib/database';
import { extractEventUrl } from '../lib/urlExtractor'; // We'll create this new file

type EventRow = {
  url: string;
  status: 'not_started' | 'in_progress' | 'done' | 'sent_to_db' | 'failed';
  data: any;
  markdown: string;
  checked: boolean;
};

type ExtractedUrl = {
  originalUrl: string;
  extractedUrl: string;
  status: 'Uploaded' | 'Extracted' | 'Sent to EDE' | 'Failed';
};

// Add this helper function at the top of your file, outside the component
function renderCellContent(content: any): string {
  if (content === null || content === undefined) {
    return '';
  }
  if (typeof content === 'string' || typeof content === 'number') {
    return content.toString();
  }
  if (Array.isArray(content)) {
    return content.map(item => renderCellContent(item)).join(', ');
  }
  if (typeof content === 'object') {
    return JSON.stringify(content);
  }
  return '';
}

// Add these constants at the top of the file
const ROWS_PER_PAGE = 50; // Adjust this number as needed

export default function EventSpreadsheet() {
  const [rows, setRows] = useState<EventRow[]>([]);
  const [allChecked, setAllChecked] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [activeTab, setActiveTab] = useState<'eventSpreadsheet' | 'urlExtractor'>('eventSpreadsheet');
  const [extractedUrls, setExtractedUrls] = useState<ExtractedUrl[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        console.log("File content:", content);
        const lines = content.split('\n').filter(line => line.trim() !== '');
        console.log("Filtered lines:", lines);
        
        // Assume the first non-empty cell in each row is the URL
        const urls = lines.map(line => {
          const columns = line.split(',');
          return columns.find(col => col.trim() !== '') || '';
        }).filter(url => url !== '');
        console.log("Extracted URLs:", urls);
        
        setRows(urls.map(url => ({ 
          url, 
          status: 'not_started', 
          data: null, 
          markdown: '', 
          checked: false 
        })));
        setCurrentPage(1);
        console.log("Set rows:", urls.length);
      };
      reader.onerror = (error) => {
        console.error("File reading error:", error);
      };
      reader.readAsText(file);
    }
  };

  const extractData = async () => {
    console.log('Extract Data button clicked');
    try {
      const checkedRows = rows.filter(row => row.checked && row.status === 'not_started');
      if (checkedRows.length === 0) {
        alert('Please check at least one row with "Not Started" status to extract data.');
        return;
      }

      setIsExtracting(true);

      for (let i = 0; i < rows.length; i++) {
        if (rows[i].checked && rows[i].status === 'not_started') {
          setRows(prev => prev.map((row, index) => 
            index === i ? { ...row, status: 'in_progress' as const } : row
          ));

          try {
            console.log(`Extracting data for URL: ${rows[i].url}`);
            const extractedData = await extractAndStoreEvent(rows[i].url);
            console.log(`Raw extracted data for ${rows[i].url}:`, JSON.stringify(extractedData, null, 2));
            
            // Process the extracted data
            const processedData = {
              ...extractedData.event,
              end_date: extractedData.event.end_date || extractedData.event.start_date
            };

            setRows(prev => {
              const newRows = prev.map((row, index) => 
                index === i ? { 
                  ...row, 
                  status: 'done' as const, 
                  data: processedData, 
                  markdown: extractedData.markdown 
                } : row
              );
              console.log('Updated row:', JSON.stringify(newRows[i], null, 2));
              return newRows;
            });
          } catch (error: any) {
            console.error(`Error extracting data for ${rows[i].url}:`, error);
            let errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            setRows(prev => prev.map((row, index) => 
              index === i ? { ...row, status: 'failed' as const, data: { error: errorMessage } } : row
            ));
          }
        }
      }
    } catch (error) {
      console.error('Unexpected error in extractData:', error);
    } finally {
      setIsExtracting(false);
    }
  };

  const saveCheckedRows = async () => {
    const checkedRows = rows.filter(row => row.checked && row.status === 'done');
    if (checkedRows.length > 0) {
      try {
        await saveEventsToDatabase(checkedRows.map(row => ({...row.data, url: row.url})));
        setRows(prev => prev.map(row => 
          row.checked && row.status === 'done' ? { ...row, status: 'sent_to_db' } : row
        ));
        alert('Selected events saved to database successfully!');
      } catch (error) {
        console.error('Error saving events:', error);
        alert('Failed to save events to database.');
      }
    }
  };

  const toggleRowChecked = (index: number) => {
    const globalIndex = (currentPage - 1) * ROWS_PER_PAGE + index;
    setRows(prev => prev.map((row, i) => 
      i === globalIndex ? { ...row, checked: !row.checked } : row
    ));
  };

  const toggleAllChecked = () => {
    const newAllChecked = !allChecked;
    setAllChecked(newAllChecked);
    setRows(prev => prev.map(row => ({ ...row, checked: newAllChecked })));
  };

  const clearAll = () => {
    setRows([]);
    setAllChecked(false);
  };

  const pushAllToSupabase = async () => {
    const rowsToPush = rows.filter(row => row.checked && row.status === 'done');
    if (rowsToPush.length === 0) {
      alert('No checked rows with "Done Extracting" status to push to Supabase.');
      return;
    }

    try {
      const eventsToSave = rowsToPush.map(row => ({
        ...row.data,
        url: row.url,
        event_markdown: row.markdown,
        start_date: row.data.start_date || new Date().toISOString().split('T')[0],
        topics: Array.isArray(row.data.topics) ? row.data.topics : typeof row.data.topics === 'string' ? [row.data.topics] : null,
        attendee_title: Array.isArray(row.data.attendee_title) ? row.data.attendee_title : typeof row.data.attendee_title === 'string' ? [row.data.attendee_title] : null,
        sponsors: Array.isArray(row.data.sponsors) ? row.data.sponsors : typeof row.data.sponsors === 'string' ? [row.data.sponsors] : null,
        sponsorship_options: typeof row.data.sponsorship_options === 'object' ? JSON.stringify(row.data.sponsorship_options) : row.data.sponsorship_options,
        agenda: typeof row.data.agenda === 'object' ? JSON.stringify(row.data.agenda) : row.data.agenda,
        audience_insights: typeof row.data.audience_insights === 'object' ? JSON.stringify(row.data.audience_insights) : row.data.audience_insights,
        attendee_count: row.data.attendee_count?.toString()
      }));

      console.log('Events to save:', eventsToSave);

      await saveEventsToDatabase(eventsToSave);
      
      setRows(prev => prev.map(row => 
        row.checked && row.status === 'done' ? { ...row, status: 'sent_to_db' } : row
      ));

      alert(`${rowsToPush.length} checked and extracted row(s) have been pushed to Supabase successfully!`);
    } catch (error) {
      console.error('Error pushing data to Supabase:', error);
      alert('Failed to push some or all data to Supabase. Please check the console for more details.');
    }
  };

  const downloadCSV = () => {
    const extractedRows = rows.filter(row => row.status === 'done' || row.status === 'sent_to_db');
    if (extractedRows.length === 0) {
      alert('No extracted data to download.');
      return;
    }

    const headers = [
      'URL', 'Name', 'Description', 'Start Date', 'End Date', 'City', 'State', 'Country',
      'Attendee Count', 'Topics', 'Event Type', 'Attendee Title', 'Logo URL',
      'Sponsorship Options', 'Agenda', 'Audience Insights', 'Sponsors',
      'Hosting Company', 'Ticket Cost', 'Contact Email'
    ];

    const blobParts = [headers.join(',') + '\n'];

    const batchSize = 100; // Process rows in batches
    for (let i = 0; i < extractedRows.length; i += batchSize) {
      const batch = extractedRows.slice(i, i + batchSize);
      const batchContent = batch.map(row => [
        row.url,
        row.data.name,
        `"${(row.data.description || '').replace(/"/g, '""')}"`,
        row.data.start_date,
        row.data.end_date,
        row.data.city,
        row.data.state,
        row.data.country,
        row.data.attendee_count,
        `"${(row.data.topics || []).join(', ')}"`,
        row.data.event_type,
        row.data.attendee_title,
        row.data.logo_url,
        `"${JSON.stringify(row.data.sponsorship_options).replace(/"/g, '""')}"`,
        `"${JSON.stringify(row.data.agenda).replace(/"/g, '""')}"`,
        `"${JSON.stringify(row.data.audience_insights).replace(/"/g, '""')}"`,
        `"${JSON.stringify(row.data.sponsors).replace(/"/g, '""')}"`,
        `"${JSON.stringify(row.data.hosting_company).replace(/"/g, '""')}"`,
        row.data.ticket_cost,
        row.data.contact_email
      ].join(',') + '\n').join('');

      blobParts.push(batchContent);
    }

    const blob = new Blob(blobParts, { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'extracted_events.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const checkedNotStartedCount = rows.filter(row => row.checked && row.status === 'not_started').length;

  const handleUrlFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const urls = content.split('\n').filter(url => url.trim() !== '');
        console.log('Uploaded URLs:', urls); // Add this line
        setExtractedUrls(urls.map(url => ({ originalUrl: url, extractedUrl: '', status: 'Uploaded' })));
      };
      reader.readAsText(file);
    }
  };

  const extractUrls = async () => {
    console.log('Starting URL extraction');
    setIsExtracting(true);
    const updatedUrls = [...extractedUrls];
    console.log('Updated URLs:', updatedUrls);

    for (let i = 0; i < updatedUrls.length; i++) {
      if (updatedUrls[i].status === 'Uploaded') {
        try {
          const response = await fetch('/api/extractUrl', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url: updatedUrls[i].originalUrl }),
          });

          if (!response.ok) {
            throw new Error('Failed to extract URL');
          }

          const data = await response.json();
          updatedUrls[i] = { ...updatedUrls[i], extractedUrl: data.extractedUrl, status: 'Extracted' };
        } catch (error) {
          console.error(`Failed to extract URL for ${updatedUrls[i].originalUrl}:`, error);
          updatedUrls[i] = { ...updatedUrls[i], extractedUrl: '', status: 'Failed' };
        }
      }
    }

    setExtractedUrls(updatedUrls);
    setIsExtracting(false);
  };

  const copyToEventSpreadsheet = () => {
    const successfulUrls = extractedUrls
      .filter(url => url.status === 'Extracted')
      .map(url => url.extractedUrl);
    setRows(successfulUrls.map(url => ({ 
      url, 
      status: 'not_started', 
      data: null, 
      markdown: '', 
      checked: false 
    })));
    setExtractedUrls(prevUrls => prevUrls.map(url => 
      url.status === 'Extracted' ? { ...url, status: 'Sent to EDE' } : url
    ));
    setActiveTab('eventSpreadsheet');
  };

  const exportExtractedUrlsToCsv = () => {
    const csvContent = [
      ['Original URL', 'Extracted URL', 'Status'].join(','),
      ...extractedUrls.map(url => [
        url.originalUrl,
        url.extractedUrl,
        url.status
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'extracted_urls.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Add this function to get the current page's rows
  const getCurrentPageRows = () => {
    const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
    const endIndex = startIndex + ROWS_PER_PAGE;
    return rows.slice(startIndex, endIndex);
  };

  // Add this function to handle page changes
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  // Add this function to check if all rows are checked
  const areAllRowsChecked = () => rows.every(row => row.checked);

  // Update the useEffect hook to check if all rows are checked whenever rows change
  useEffect(() => {
    setAllChecked(areAllRowsChecked());
  }, [rows]);

  return (
    <div className="container mx-auto p-4">
      <div className="mb-4">
        <button 
          onClick={() => setActiveTab('eventSpreadsheet')} 
          className={`px-4 py-2 mr-2 ${activeTab === 'eventSpreadsheet' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          Event Spreadsheet
        </button>
        <button 
          onClick={() => setActiveTab('urlExtractor')} 
          className={`px-4 py-2 ${activeTab === 'urlExtractor' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          URL Extractor
        </button>
      </div>

      {activeTab === 'eventSpreadsheet' ? (
        <div>
          <input type="file" accept=".csv" onChange={handleFileUpload} className="mb-4" />
          <button 
            onClick={extractData} 
            className="bg-blue-500 text-white px-4 py-2 rounded mr-2" 
            disabled={isExtracting || checkedNotStartedCount === 0}
          >
            {isExtracting ? 'Extracting...' : `Extract Data (${checkedNotStartedCount})`}
          </button>
          <button onClick={saveCheckedRows} className="bg-green-500 text-white px-4 py-2 rounded mr-2">Save Checked Rows</button>
          <button onClick={toggleAllChecked} className="bg-gray-500 text-white px-4 py-2 rounded mr-2">
            {allChecked ? 'Uncheck All' : 'Check All'}
          </button>
          <button onClick={clearAll} className="bg-red-500 text-white px-4 py-2 rounded mr-2">Clear All</button>
          <button 
            onClick={pushAllToSupabase} 
            className="bg-purple-500 text-white px-4 py-2 rounded mr-2"
          >
            Push All to Supabase
          </button>
          <button 
            onClick={downloadCSV} 
            className="bg-yellow-500 text-white px-4 py-2 rounded"
          >
            Download CSV
          </button>
          
          <div>Total rows: {rows.length}</div>
          <div>Current page: {currentPage}</div>
          <div>Rows per page: {ROWS_PER_PAGE}</div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-300 mt-4">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border-b p-2 text-left text-gray-800">
                    <input 
                      type="checkbox" 
                      checked={allChecked}
                      onChange={toggleAllChecked}
                    />
                  </th>
                  <th className="border-b p-2 text-left text-gray-800">Status</th>
                  <th className="border-b p-2 text-left text-gray-800">URL</th>
                  <th className="border-b p-2 text-left text-gray-800">Name</th>
                  <th className="border-b p-2 text-left text-gray-800">Description</th>
                  <th className="border-b p-2 text-left text-gray-800">Start Date</th>
                  <th className="border-b p-2 text-left text-gray-800">End Date</th>
                  <th className="border-b p-2 text-left text-gray-800">City</th>
                  <th className="border-b p-2 text-left text-gray-800">State</th>
                  <th className="border-b p-2 text-left text-gray-800">Country</th>
                  <th className="border-b p-2 text-left text-gray-800">Attendee Count</th>
                  <th className="border-b p-2 text-left text-gray-800">Topics</th>
                  <th className="border-b p-2 text-left text-gray-800">Event Type</th>
                  <th className="border-b p-2 text-left text-gray-800">Attendee Title</th>
                  <th className="border-b p-2 text-left text-gray-800">Logo URL</th>
                  <th className="border-b p-2 text-left text-gray-800">Sponsorship Options</th>
                  <th className="border-b p-2 text-left text-gray-800">Agenda</th>
                  <th className="border-b p-2 text-left text-gray-800">Audience Insights</th>
                  <th className="border-b p-2 text-left text-gray-800">Sponsors</th>
                  <th className="border-b p-2 text-left text-gray-800">Hosting Company</th>
                  <th className="border-b p-2 text-left text-gray-800">Ticket Cost</th>
                  <th className="border-b p-2 text-left text-gray-800">Contact Email</th>
                  <th className="border-b p-2 text-left text-gray-800">Markdown</th>
                </tr>
              </thead>
              <tbody>
                {getCurrentPageRows().map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="border-b p-2">
                      <input 
                        type="checkbox" 
                        checked={row.checked} 
                        onChange={() => toggleRowChecked(index)}
                      />
                    </td>
                    <td className="border-b p-2 text-gray-800">
                      {row.status === 'not_started' && <span className="text-gray-500">Not Started</span>}
                      {row.status === 'in_progress' && <span className="text-blue-500">In Progress</span>}
                      {row.status === 'done' && <span className="text-green-500">Done Extracting</span>}
                      {row.status === 'sent_to_db' && <span className="text-purple-500">Sent to Database</span>}
                      {row.status === 'failed' && <span className="text-red-500">Failed</span>}
                    </td>
                    <td className="border-b p-2 text-gray-800">{row.url}</td>
                    <td className="border-b p-2 text-gray-800">{renderCellContent(row.data?.name)}</td>
                    <td className="border-b p-2 text-gray-800">{renderCellContent(row.data?.description)}</td>
                    <td className="border-b p-2 text-gray-800">{renderCellContent(row.data?.start_date)}</td>
                    <td className="border-b p-2 text-gray-800">{renderCellContent(row.data?.end_date)}</td>
                    <td className="border-b p-2 text-gray-800">{renderCellContent(row.data?.city)}</td>
                    <td className="border-b p-2 text-gray-800">{renderCellContent(row.data?.state)}</td>
                    <td className="border-b p-2 text-gray-800">{renderCellContent(row.data?.country)}</td>
                    <td className="border-b p-2 text-gray-800">{renderCellContent(row.data?.attendee_count)}</td>
                    <td className="border-b p-2 text-gray-800">{renderCellContent(row.data?.topics)}</td>
                    <td className="border-b p-2 text-gray-800">{renderCellContent(row.data?.event_type)}</td>
                    <td className="border-b p-2 text-gray-800">{renderCellContent(row.data?.attendee_title)}</td>
                    <td className="border-b p-2 text-gray-800">{renderCellContent(row.data?.logo_url)}</td>
                    <td className="border-b p-2 text-gray-800">{renderCellContent(row.data?.sponsorship_options)}</td>
                    <td className="border-b p-2 text-gray-800">{renderCellContent(row.data?.agenda)}</td>
                    <td className="border-b p-2 text-gray-800">{renderCellContent(row.data?.audience_insights)}</td>
                    <td className="border-b p-2 text-gray-800">{renderCellContent(row.data?.sponsors)}</td>
                    <td className="border-b p-2 text-gray-800">{renderCellContent(row.data?.hosting_company)}</td>
                    <td className="border-b p-2 text-gray-800">{renderCellContent(row.data?.ticket_cost)}</td>
                    <td className="border-b p-2 text-gray-800">{renderCellContent(row.data?.contact_email)}</td>
                    <td className="border-b p-2 text-gray-800">
                      <div className="max-h-40 overflow-y-auto">
                        <pre className="whitespace-pre-wrap">{row.markdown}</pre>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add pagination controls */}
          <div className="mt-4 flex justify-center">
            <button 
              onClick={() => handlePageChange(currentPage - 1)} 
              disabled={currentPage === 1}
              className="bg-blue-500 text-white px-4 py-2 rounded mr-2"
            >
              Previous
            </button>
            <span className="px-4 py-2">
              Page {currentPage} of {Math.ceil(rows.length / ROWS_PER_PAGE)}
            </span>
            <button 
              onClick={() => handlePageChange(currentPage + 1)} 
              disabled={currentPage === Math.ceil(rows.length / ROWS_PER_PAGE)}
              className="bg-blue-500 text-white px-4 py-2 rounded ml-2"
            >
              Next
            </button>
          </div>
        </div>
      ) : (
        <div>
          <input type="file" accept=".csv" onChange={handleUrlFileUpload} className="mb-4" />
          <button 
            onClick={extractUrls} 
            className="bg-blue-500 text-white px-4 py-2 rounded mr-2" 
            disabled={isExtracting || extractedUrls.filter(url => url.status === 'Uploaded').length === 0}
          >
            {isExtracting ? 'Extracting...' : 'Extract URLs'}
          </button>
          <button 
            onClick={copyToEventSpreadsheet} 
            className="bg-green-500 text-white px-4 py-2 rounded mr-2" 
            disabled={extractedUrls.filter(url => url.status === 'Extracted').length === 0}
          >
            Copy to Event Spreadsheet
          </button>
          <button 
            onClick={exportExtractedUrlsToCsv} 
            className="bg-yellow-500 text-white px-4 py-2 rounded" 
            disabled={extractedUrls.length === 0}
          >
            Export to CSV
          </button>

          <div className="overflow-x-auto mt-4">
            <table className="min-w-full bg-white border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border-b p-2 text-left">Original URL</th>
                  <th className="border-b p-2 text-left">Extracted URL</th>
                  <th className="border-b p-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {extractedUrls.map((url, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="border-b p-2">{url.originalUrl}</td>
                    <td className="border-b p-2">{url.extractedUrl}</td>
                    <td className="border-b p-2">
                      <span className={`
                        ${url.status === 'Uploaded' ? 'text-gray-500' : ''}
                        ${url.status === 'Extracted' ? 'text-green-500' : ''}
                        ${url.status === 'Sent to EDE' ? 'text-blue-500' : ''}
                        ${url.status === 'Failed' ? 'text-red-500' : ''}
                      `}>
                        {url.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}