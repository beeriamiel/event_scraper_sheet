import React, { useState, useEffect } from 'react';
import { extractAndStoreEvent } from '../lib/extractor';
import { saveEventsToDatabase } from '../lib/database';

type EventRow = {
  url: string;
  status: 'not_started' | 'in_progress' | 'done' | 'sent_to_db' | 'failed';
  data: any;
  checked: boolean;
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

export default function EventSpreadsheet() {
  const [rows, setRows] = useState<EventRow[]>([]);
  const [allChecked, setAllChecked] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const lines = content.split('\n').filter(line => line.trim() !== '');
        const urls = lines.map(line => {
          const columns = line.split(',');
          return columns[1]?.trim() || '';
        }).filter(url => url !== '');
        
        setRows(urls.map(url => ({ 
          url, 
          status: 'not_started', 
          data: null, 
          checked: false 
        })));
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
            
            setRows(prev => {
              const newRows = prev.map((row, index) => 
                index === i ? { ...row, status: 'done' as const, data: extractedData } : row
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
            alert(`Failed to extract data for ${rows[i].url}: ${errorMessage}`);
          }
        }
      }
    } catch (error) {
      console.error('Unexpected error in extractData:', error);
      alert('An unexpected error occurred. Please check the console for more details.');
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

  const toggleAllChecked = () => {
    setAllChecked(!allChecked);
    setRows(prev => prev.map(row => ({ ...row, checked: !allChecked })));
  };

  const toggleRowChecked = (index: number) => {
    setRows(prev => prev.map((row, i) => 
      i === index ? { ...row, checked: !row.checked } : row
    ));
  };

  const clearAll = () => {
    setRows([]);
    setAllChecked(false);
  };

  const checkedNotStartedCount = rows.filter(row => row.checked && row.status === 'not_started').length;

  return (
    <div className="container mx-auto p-4">
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
      <button onClick={clearAll} className="bg-red-500 text-white px-4 py-2 rounded">Clear All</button>
      
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-300 mt-4">
          <thead>
            <tr className="bg-gray-100">
              <th className="border-b p-2 text-left text-gray-800">Check</th>
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
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
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
                <td className="border-b p-2 text-gray-800">{renderCellContent(row.data?.topics_or_themes)}</td>
                <td className="border-b p-2 text-gray-800">{renderCellContent(row.data?.event_type)}</td>
                <td className="border-b p-2 text-gray-800">{renderCellContent(row.data?.typical_attendee_titles_or_roles)}</td>
                <td className="border-b p-2 text-gray-800">{renderCellContent(row.data?.logo_url)}</td>
                <td className="border-b p-2 text-gray-800">{renderCellContent(row.data?.sponsorship_options)}</td>
                <td className="border-b p-2 text-gray-800">{renderCellContent(row.data?.event_agenda_or_schedule)}</td>
                <td className="border-b p-2 text-gray-800">{renderCellContent(row.data?.audience_insights_or_demographics)}</td>
                <td className="border-b p-2 text-gray-800">{renderCellContent(row.data?.sponsoring_companies)}</td>
                <td className="border-b p-2 text-gray-800">{renderCellContent(row.data?.hosting_company_or_organization)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}