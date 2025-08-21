import React, { useState, useRef } from 'react';
import './DataAnalysisTestPanel.css';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  TimeScale,
} from 'chart.js';
import {
  Line,
  Bar,
  Pie,
  Scatter,
} from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  TimeScale
);

interface QueryResult {
  success: boolean;
  pipeline?: any;
  result?: {
    userInput: string;
    sqlQuery: string;
    data: any[];
    rowCount: number;
    visualization?: {
      filename: string;
      url: string;
      type: string;
      library?: string;
      config?: any;
    };
    summary?: string;
    executionTime: {
      total: number;
      sqlGeneration: number;
      validation: number;
      queryExecution: number;
      visualization?: number;
      summary?: number;
    };
    warnings: string[];
  };
  error?: string;
}

const DataAnalysisTestPanel: React.FC = () => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [includeVisualization, setIncludeVisualization] = useState(true);
  const [includeSummary, setIncludeSummary] = useState(true);
  const [visualizationType, setVisualizationType] = useState('auto');
  const [maxRows, setMaxRows] = useState(1000);
  const [visualizationLibrary, setVisualizationLibrary] = useState('plotly');
  const chartRef = useRef<any>(null);

  const baseUrl = window.location.hostname === "localhost" ? "http://localhost:5051" : "";

  const downloadChart = (format: 'png' | 'jpeg') => {
    if (!chartRef.current) {
      alert('Chart not ready for download');
      return;
    }

    try {
      const canvas = chartRef.current.canvas;
      const url = canvas.toDataURL(`image/${format}`, 1.0);
      const link = document.createElement('a');
      link.download = `chart.${format}`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading chart:', error);
      alert('Error downloading chart');
    }
  };

  const renderChartJSVisualization = (visualization: any) => {
    if (!visualization?.config) return null;

    const config = visualization.config;
    const chartType = config.type;

    const commonOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
        },
        title: {
          display: true,
          text: config.options?.plugins?.title?.text || 'Chart.js Visualization',
        },
      },
      ...config.options,
    };

    const chartProps = {
      ref: chartRef,
      data: config.data,
      options: commonOptions,
    };

    switch (chartType) {
      case 'bar':
        return <Bar {...chartProps} />;
      case 'line':
        return <Line {...chartProps} />;
      case 'pie':
        return <Pie {...chartProps} />;
      case 'scatter':
        return <Scatter {...chartProps} />;
      default:
        return <Bar {...chartProps} />;
    }
  };

  const handleTest = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(`${baseUrl}/api/data-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          includeVisualization,
          includeSummary,
          visualizationType,
          maxRows,
          visualizationLibrary
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: QueryResult = await response.json();
      setResult(data);
    } catch (error: any) {
      console.error('Error:', error);
      setResult({
        success: false,
        error: error.message || 'An unexpected error occurred'
      });
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${baseUrl}/api/test-connection`);
      const data = await response.json();
      
      setResult({
        success: data.success,
        result: {
          userInput: 'Connection Test',
          sqlQuery: 'N/A',
          data: [],
          rowCount: 0,
          summary: data.message,
          executionTime: { total: 0, sqlGeneration: 0, validation: 0, queryExecution: 0 },
          warnings: []
        }
      });
    } catch (error: any) {
      setResult({
        success: false,
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const getTables = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${baseUrl}/api/tables`);
      const data = await response.json();
      
      setResult({
        success: data.success,
        result: {
          userInput: 'Get Available Tables',
          sqlQuery: 'SHOW TABLES',
          data: data.tables ? data.tables.map((table: string) => ({ table_name: table })) : [],
          rowCount: data.tables?.length || 0,
          summary: data.success ? `Found ${data.tables?.length || 0} tables: ${data.tables?.join(', ') || 'None'}` : data.error,
          executionTime: { total: 0, sqlGeneration: 0, validation: 0, queryExecution: 0 },
          warnings: []
        }
      });
    } catch (error: any) {
      setResult({
        success: false,
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const sampleQueries = [
    "Show me all records from the catchments table",
    "Get the top 10 schools with the highest enrollment",
    "Compare enrollment numbers by school type",
    "Show the distribution of schools across different districts",
    "Find schools with enrollment greater than 500 students"
  ];

  return (
    <div className="w-full max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Data Analysis Pipeline Testing</h2>
        
        {/* Quick Actions */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 text-gray-700">Quick Tests</h3>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={testConnection}
              disabled={loading}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors"
            >
              Test Connection
            </button>
            <button
              onClick={getTables}
              disabled={loading}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              Get Tables
            </button>
          </div>
        </div>

        {/* Sample Queries */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 text-gray-700">Sample Queries</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {sampleQueries.map((sampleQuery, index) => (
              <button
                key={index}
                onClick={() => setQuery(sampleQuery)}
                className="text-left p-2 text-sm bg-gray-100 hover:bg-gray-200 rounded border transition-colors"
              >
                {sampleQuery}
              </button>
            ))}
          </div>
        </div>

        {/* Query Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Natural Language Query
          </label>
          <div className="flex space-x-2">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter your natural language query here... (e.g., 'Show me the top 10 schools by enrollment')"
              className="flex-1 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] resize-y"
            />
            <button
              onClick={handleTest}
              disabled={loading || !query.trim()}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Processing...' : 'Test Pipeline'}
            </button>
          </div>
        </div>

        {/* Options */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={includeVisualization}
                onChange={(e) => setIncludeVisualization(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Include Visualization</span>
            </label>
          </div>
          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={includeSummary}
                onChange={(e) => setIncludeSummary(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Include Summary</span>
            </label>
          </div>
          <div>
            <select
              value={visualizationLibrary}
              onChange={(e) => setVisualizationLibrary(e.target.value)}
              className="text-sm border rounded p-2 w-full"
            >
              <option value="plotly">Plotly.js</option>
              <option value="chartjs">Chart.js</option>
            </select>
          </div>
          <div>
            <select
              value={visualizationType}
              onChange={(e) => setVisualizationType(e.target.value)}
              className="text-sm border rounded p-2 w-full"
            >
              <option value="auto">Auto Detect</option>
              <option value="bar">Bar Chart</option>
              <option value="scatter">Scatter Plot</option>
              <option value="pie">Pie Chart</option>
              <option value="histogram">Histogram</option>
              <option value="time_series">Time Series</option>
              <option value="table">Table</option>
            </select>
          </div>
          <div>
            <input
              type="number"
              value={maxRows}
              onChange={(e) => setMaxRows(parseInt(e.target.value) || 1000)}
              placeholder="Max Rows"
              min="10"
              max="10000"
              className="text-sm border rounded p-2 w-full"
            />
          </div>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-semibold mb-4 text-gray-800">Results</h3>
          
          {result.success ? (
            <div className="space-y-6">
              {/* Success Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-green-50 rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">✅</div>
                  <div className="text-sm text-gray-600">Success</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{result.result?.rowCount || 0}</div>
                  <div className="text-sm text-gray-600">Rows</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {result.result?.executionTime.total ? `${result.result.executionTime.total}ms` : 'N/A'}
                  </div>
                  <div className="text-sm text-gray-600">Total Time</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {result.result?.warnings.length || 0}
                  </div>
                  <div className="text-sm text-gray-600">Warnings</div>
                </div>
              </div>

              {/* Generated SQL */}
              {result.result?.sqlQuery && result.result.sqlQuery !== 'N/A' && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-gray-700">Generated SQL</h4>
                  <pre className="bg-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
                    {result.result.sqlQuery}
                  </pre>
                </div>
              )}

              {/* Data Preview */}
              {result.result?.data && result.result.data.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-gray-700">Data Preview (First 5 rows)</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border border-gray-300 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          {Object.keys(result.result.data[0]).map((header) => (
                            <th key={header} className="border border-gray-300 px-4 py-2 text-left">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.result.data.slice(0, 5).map((row, index) => (
                          <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            {Object.values(row).map((cell, cellIndex) => (
                              <td key={cellIndex} className="border border-gray-300 px-4 py-2">
                                {String(cell)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Visualization */}
              {result.result?.visualization && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-gray-700">Visualization</h4>
                  <div className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-4">
                      <p className="text-sm text-gray-600">
                        Library: {result.result.visualization.library || 'Plotly'} | 
                        Type: {result.result.visualization.type} | 
                        File: {result.result.visualization.filename}
                      </p>
                      <div className="flex space-x-2">
                        {result.result.visualization.library === 'chartjs' && (
                          <>
                            <button
                              onClick={() => downloadChart('png')}
                              className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600 transition-colors"
                            >
                              Download PNG
                            </button>
                            <button
                              onClick={() => downloadChart('jpeg')}
                              className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600 transition-colors"
                            >
                              Download JPEG
                            </button>
                          </>
                        )}
                        <a
                          href={`${baseUrl}${result.result.visualization.url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors"
                        >
                          View Full
                        </a>
                      </div>
                    </div>
                    
                    {result.result.visualization.library === 'chartjs' && result.result.visualization.config ? (
                      <div className="h-96 w-full">
                        {renderChartJSVisualization(result.result.visualization)}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-gray-600 mb-2">Plotly.js visualization available</p>
                        <a
                          href={`${baseUrl}${result.result.visualization.url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                        >
                          Open Visualization
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Summary */}
              {result.result?.summary && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-gray-700">AI Summary</h4>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-gray-800 whitespace-pre-wrap">{result.result.summary}</p>
                  </div>
                </div>
              )}

              {/* Execution Timing */}
              {result.result?.executionTime && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-gray-700">Performance Metrics</h4>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                    <div className="bg-gray-50 p-2 rounded text-center">
                      <div className="font-semibold">{result.result.executionTime.sqlGeneration}ms</div>
                      <div className="text-gray-600">SQL Gen</div>
                    </div>
                    <div className="bg-gray-50 p-2 rounded text-center">
                      <div className="font-semibold">{result.result.executionTime.validation}ms</div>
                      <div className="text-gray-600">Validation</div>
                    </div>
                    <div className="bg-gray-50 p-2 rounded text-center">
                      <div className="font-semibold">{result.result.executionTime.queryExecution}ms</div>
                      <div className="text-gray-600">Query Exec</div>
                    </div>
                    <div className="bg-gray-50 p-2 rounded text-center">
                      <div className="font-semibold">{result.result.executionTime.visualization || 0}ms</div>
                      <div className="text-gray-600">Visualization</div>
                    </div>
                    <div className="bg-gray-50 p-2 rounded text-center">
                      <div className="font-semibold">{result.result.executionTime.summary || 0}ms</div>
                      <div className="text-gray-600">Summary</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Warnings */}
              {result.result?.warnings && result.result.warnings.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-yellow-700">Warnings</h4>
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <ul className="list-disc list-inside space-y-1">
                      {result.result.warnings.map((warning, index) => (
                        <li key={index} className="text-yellow-800">{warning}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 bg-red-50 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <div className="text-2xl">❌</div>
                <h4 className="font-semibold text-red-700">Error</h4>
              </div>
              <p className="text-red-600">{result.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DataAnalysisTestPanel;