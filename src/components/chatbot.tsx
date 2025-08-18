import React, { useState } from 'react';
interface Message {
  text: string;
  isUser: boolean;
}


// Add type declaration for window.handleDatabaseChange
declare global {
  interface Window {
    handleDatabaseChange?: (database: string) => boolean;
    handleStyleChange?: (strokeData: string, strokeColor: string, strokeWeight: number) => boolean;
    handleStrokeByChange?: (strokeBy: string) => boolean;
    handleStrokePalletteChange?: (strokePallette: string) => boolean;
    handleStrokeWeightChange?: (strokeWeight: number) => boolean;
    handleFillByChange?: (fillBy: string) => boolean;
    handleFillPalletteChange?: (fillPallette: string) => boolean;
    handleFillOpacityChange?: (fillOpacity: number) => boolean;
    handleSchoolTypeChange?: (schoolType: string) => boolean;
    handleSchoolCategoryChange?: (schoolCategory: string) => boolean;
    handleLatLngChange?: (lat: number, lng: number) => boolean;
  }
}

const Chatbot: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [useDataAnalysis, setUseDataAnalysis] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    // Add user message
    const userMessage: Message = { text: inputText, isUser: true };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputText('');

    try {
      const endpoint = useDataAnalysis 
        ? (window.location.hostname === "localhost" ? "http://localhost:5051/api/data-analysis" : "/api/data-analysis")
        : (window.location.hostname === "localhost" ? "http://localhost:5051/api/chat" : "/api/chat");
      
      const requestBody = useDataAnalysis 
        ? { 
            query: inputText, 
            includeVisualization: true, 
            includeSummary: true, 
            visualizationType: 'auto', 
            maxRows: 100 
          }
        : { messages: updatedMessages };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }
      
      const data = await response.json();
      console.log('chatbot tsx data: ', data);
      
      let responseText = '';
      
      if (useDataAnalysis) {
        // Handle data analysis response
        if (data.success) {
          responseText = `✅ Query processed successfully!\n\n`;
          responseText += `📊 **SQL Generated:** ${data.result.sqlQuery}\n\n`;
          responseText += `📈 **Results:** ${data.result.rowCount} rows found\n\n`;
          
          if (data.result.visualization) {
            const baseUrl = window.location.hostname === "localhost" ? "http://localhost:5051" : "";
            responseText += `🎨 **Visualization:** [View Chart](${baseUrl}${data.result.visualization.url})\n\n`;
          }
          
          if (data.result.summary) {
            responseText += `💡 **AI Summary:**\n${data.result.summary}\n\n`;
          }
          
          if (data.result.warnings && data.result.warnings.length > 0) {
            responseText += `⚠️ **Warnings:**\n${data.result.warnings.join('\n')}\n\n`;
          }
          
          responseText += `⏱️ **Execution Time:** ${data.result.executionTime.total}ms`;
        } else {
          responseText = `❌ **Error:** ${data.error}`;
        }
      } else {
        // Handle regular chat response
        const flags = data.response?.flags;
        if (flags) {
          if (flags.strokeByChanged?.value) {
            window.handleStrokeByChange?.(flags.strokeByChanged.strokeBy);
          }
          if (flags.strokePalletteChanged?.value) {
            window.handleStrokePalletteChange?.(flags.strokePalletteChanged.strokePallette);
          }
          if (flags.strokeWeightChanged?.value) {
            window.handleStrokeWeightChange?.(flags.strokeWeightChanged.strokeWeight);
          }
          if (flags.fillByChanged?.value) {
            window.handleFillByChange?.(flags.fillByChanged.fillBy);
          }
          if (flags.fillPalletteChanged?.value) {
            window.handleFillPalletteChange?.(flags.fillPalletteChanged.fillPallette);
          }
          if (flags.fillOpacityChanged?.value) {
            window.handleFillOpacityChange?.(flags.fillOpacityChanged.fillOpacity);
          }
          if (flags.schoolTypeChanged?.value) {
            window.handleSchoolTypeChange?.(flags.schoolTypeChanged.schoolType);
          }
          if (flags.schoolCategoryChanged?.value) {
            window.handleSchoolCategoryChange?.(flags.schoolCategoryChanged.schoolCategory);
          }
          if (flags.latLngChanged?.value) {
            window.handleLatLngChange?.(flags.latLngChanged.lat, flags.latLngChanged.lng);
          }
        }
        
        let responseText: any = data.response?.finalText;
        
        // Handle case where finalText might be an object or array
        if (typeof responseText === 'object') {
          if (Array.isArray(responseText)) {
            // If it's an array, extract text from each item
            responseText = responseText.map((item: any) => {
              if (typeof item === 'object' && item.text) {
                return item.text;
              }
              return String(item);
            }).join(' ');
          } else if (responseText && responseText.text) {
            // If it's an object with a text property
            responseText = responseText.text;
          } else {
            // Fallback: stringify the object
            responseText = JSON.stringify(responseText);
          }
        }
      }
      
      const botMessage: Message = { text: String(responseText || 'No response received'), isUser: false };
      setMessages(prev => [...prev, botMessage]);
    } catch (error: any) {
      console.error('Error:', error);
      
      // Provide more specific error messages based on the error type
      let errorText = 'Sorry, I encountered an error. Please try again.';
      
      if (error.message && error.message.includes('Failed to fetch')) {
        errorText = 'Connection error. Please check your internet connection and try again.';
      } else if (error.message && (error.message.includes('overloaded') || error.message.includes('429'))) {
        errorText = 'The service is currently busy. Please wait a moment and try again.';
      } else if (error.message && error.message.includes('timeout')) {
        errorText = 'Request timed out. Please try again with a shorter message.';
      }
      
      // Add error message
      const errorMessage: Message = { 
        text: errorText, 
        isUser: false 
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  return (
    <div className="flex flex-col h-[500px] w-full max-w-2xl mx-auto border rounded-lg shadow-lg">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] rounded-lg p-3 ${
                message.isUser
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-800'
              }`}
            >
              {message.text}
            </div>
          </div>
        ))}
      </div>

      {/* Input area */}
      <form onSubmit={handleSubmit} className="border-t p-4">
        <div className="mb-3">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={useDataAnalysis}
              onChange={(e) => setUseDataAnalysis(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm font-medium text-gray-700">
              {useDataAnalysis ? '🧠 Data Analysis Mode' : '💬 Chat Mode'}
            </span>
          </label>
          <p className="text-xs text-gray-500 mt-1">
            {useDataAnalysis 
              ? 'Natural language queries will be converted to SQL, executed, and visualized'
              : 'Regular chatbot for map interactions and general questions'
            }
          </p>
        </div>
        <div className="flex space-x-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={useDataAnalysis 
              ? "Ask about your data... (e.g., 'Show me schools with high enrollment')" 
              : "Type your message..."
            }
            className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className={`px-4 py-2 text-white rounded-lg focus:outline-none focus:ring-2 transition-colors ${
              useDataAnalysis 
                ? 'bg-purple-500 hover:bg-purple-600 focus:ring-purple-500' 
                : 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-500'
            }`}
          >
            {useDataAnalysis ? 'Analyze' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Chatbot;
