import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import wellknown from 'wellknown';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleAuth } from 'google-auth-library';
import { URL } from 'url';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
dotenv.config();
import { anyQuery } from './queryFunctions.js';
import { DataAnalysisPipeline } from './dataAnalysisPipeline.js';
//import Queries from './src/Queries/Queries.json' with { type: 'json' };
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const Queries = JSON.parse(fs.readFileSync(path.join(__dirname, './Queries/Queries.json'), 'utf8'));
const app = express();
app.use(cors());
app.use(express.json());
//test

//Db config for cloud run/local
const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'schools',
};

let flags = {
  databaseChanged: {value: false, database: null},
  strokeByChanged: {value: false, strokeBy: null},
  strokePalletteChanged: {value: false, strokePallette: null},
  strokeWeightChanged: {value: false, strokeWeight: null},
  fillByChanged: {value: false, fillBy: null},  
  fillPalletteChanged: {value: false, fillPallette: null},
  fillOpacityChanged: {value: false, fillOpacity: null},
  latLngChanged: {value: false, lat: null, lng: null}
}

class LangChainMCPClient {

  constructor() {
    this.llm = new ChatAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: "claude-3-5-sonnet-20241022",
      temperature: 0,
    });
    
    this.mcp = new Client({
      name: "SID-Client",
      version: "1.0.0",
    });
    
    this.tools = [];
    this.agent = null;
    this.agentExecutor = null;
    
    // Initialize Google Auth with default credentials
    // This will automatically use:
    // - Workload Identity when running on Cloud Run
    // - Service account JSON when running locally (if GOOGLE_APPLICATION_CREDENTIALS is set)
    this.googleAuth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
  }
  async cleanup() {
    if (this.transport) {
      await this.mcp.close();
    }
  }

  async createLangChainTools(mcpTools) {
    const tools = [];
    
    for (const tool of mcpTools) {
      const langchainTool = new DynamicStructuredTool({
        name: tool.name,
        description: tool.description,
        schema: this.convertSchemaToZod(tool.inputSchema),
        func: async (input) => {
          try {
            const result = await this.mcp.callTool({
              name: tool.name,
              arguments: input,
            });
            
            // Handle flag updates for specific tools
            this.handleToolFlags(tool.name, input);
            
            return JSON.stringify(result.content);
          } catch (error) {
            return `Error calling tool ${tool.name}: ${error.message}`;
          }
        },
      });
      tools.push(langchainTool);
    }
    
    return tools;
  }

  convertSchemaToZod(inputSchema) {
    // Convert JSON Schema to Zod schema
    const properties = inputSchema.properties || {};
    const zodObj = {};
    
    for (const [key, prop] of Object.entries(properties)) {
      if (prop.type === 'string') {
        zodObj[key] = z.string().optional();
      } else if (prop.type === 'number') {
        zodObj[key] = z.number().optional();
      } else if (prop.type === 'boolean') {
        zodObj[key] = z.boolean().optional();
      } else if (prop.type === 'array') {
        zodObj[key] = z.array(z.any()).optional();
      } else {
        zodObj[key] = z.any().optional();
      }
    }
    
    return z.object(zodObj);
  }

  handleToolFlags(toolName, toolArgs) {
    // Handle flag updates for specific tools
    if (toolName === "setStroke") {
      if (toolArgs.colorFlag) {
        flags.strokePalletteChanged.value = true;
        flags.strokePalletteChanged.strokePallette = toolArgs.strokeColor;
      }
      if (toolArgs.weightFlag) {
        flags.strokeWeightChanged.value = true;
        flags.strokeWeightChanged.strokeWeight = toolArgs.strokeWeight;
      }
      if (toolArgs.dataFlag) {
        flags.strokeByChanged.value = true;
        flags.strokeByChanged.strokeBy = toolArgs.strokeData;
      }
    }
    if (toolName === "setFill") {
      if (toolArgs.dataFlag) {
        flags.fillByChanged.value = true;
        flags.fillByChanged.fillBy = toolArgs.fillData;
      }
      if (toolArgs.colorFlag) {
        flags.fillPalletteChanged.value = true;
        flags.fillPalletteChanged.fillPallette = toolArgs.fillColor;
      }
      if (toolArgs.opacityFlag) {
        flags.fillOpacityChanged.value = true;
        flags.fillOpacityChanged.fillOpacity = toolArgs.fillOpacity;
      }
    }
    if (toolName === "setLatLng") {
      flags.latLngChanged.value = true;
      flags.latLngChanged.lat = toolArgs.lat;
      flags.latLngChanged.lng = toolArgs.lng;
    }
  }

  async setupAgent() {
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", "You are a helpful assistant that can call tools to help with map visualization tasks."],
      new MessagesPlaceholder("chat_history"),
      ["human", "{input}"],
      new MessagesPlaceholder("agent_scratchpad"),
    ]);

    this.agent = await createToolCallingAgent({
      llm: this.llm,
      tools: this.tools,
      prompt,
    });

    this.agentExecutor = new AgentExecutor({
      agent: this.agent,
      tools: this.tools,
      verbose: true,
      maxIterations: 3,
    });
  }
  async connectToServer(serverScriptPath) {
    try {
      if (process.env.ENV == "dev") {
        const isJs = serverScriptPath.endsWith(".js");
        const isPy = serverScriptPath.endsWith(".py");
        if (!isJs && !isPy) {
          throw new Error("Server script must be a .js or .py file");
        }
        const command = isPy
          ? process.platform === "win32"
            ? "python"
            : "python3"
          : process.execPath;
    
        this.transport = new StdioClientTransport({
          command,
          args: [serverScriptPath],
        });
        this.mcp.connect(this.transport);
    
        const toolsResult = await this.mcp.listTools();
        this.tools = await this.createLangChainTools(toolsResult.tools);
        await this.setupAgent();
        console.log(
          "Connected to server with tools:",
          this.tools.map((tool) => tool.name)
        );
      } else {
        const aud = 'https://sid-mcp-1010920399604.northamerica-northeast2.run.app';
        const url = new URL('/mcp', aud);
        
        let token;
        try {
          // Method 1: Try using the metadata server (recommended for Cloud Run)
          // This is the preferred method when running on Cloud Run
          const metadataResponse = await fetch(
            `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${encodeURIComponent(aud)}`,
            {
              headers: {
                'Metadata-Flavor': 'Google'
              }
            }
          );
          
          if (metadataResponse.ok) {
            token = await metadataResponse.text();
            console.log('Successfully obtained ID token from metadata server');
          } else {
            throw new Error(`Metadata server responded with status: ${metadataResponse.status}`);
          }
        } catch (metadataError) {
          console.log('Metadata server not available, falling back to Google Auth library:', metadataError.message);
          
          // Method 2: Fallback to Google Auth library (for local development)
          try {
            const client = await this.googleAuth.getIdTokenClient(aud);
            token = await client.fetchIdToken(aud);
            console.log('Successfully obtained ID token from Google Auth library');
          } catch (authError) {
            console.error('Both metadata server and Google Auth library failed:', {
              metadataError: metadataError.message,
              authError: authError.message
            });
            throw new Error('Failed to obtain authentication token');
          }
        }

        // Debug logging to identify the issue
        console.log('Debug - URL object:', url);
        console.log('Debug - URL href:', url.href);
        console.log('Debug - URL href type:', typeof url.href);
        console.log('Debug - Token type:', typeof token);
        console.log('Debug - Token length:', token.length);

        // Create a custom fetch function that includes authentication
        const authenticatedFetch = async (input, init = {}) => {
          const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...(init.headers || {})
          };
          
          return fetch(input, {
            ...init,
            headers
          });
        };

        // Store original fetch in case we need to override globally
        const originalFetch = global.fetch;

        // Try Method 1: Custom fetch function
        try {
          this.transport = new StreamableHTTPClientTransport(
            url.href,
            {
              fetch: authenticatedFetch
            }
          );
          console.log('Using custom fetch function for authentication');
          await this.mcp.connect(this.transport);
        } catch (fetchError) {
          console.log('Custom fetch method failed, trying alternative approach:', fetchError.message);
          
          // Method 2: Try with requestInit option (alternative parameter structure)
          try {
            this.transport = new StreamableHTTPClientTransport(
              url.href,
              {
                requestInit: {
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                  }
                }
              }
            );
            console.log('Using requestInit for authentication');
            await this.mcp.connect(this.transport);
          } catch (requestInitError) {
            console.log('RequestInit method failed, trying basic constructor:', requestInitError.message);
            
             // Method 3: Basic constructor with global fetch override
             console.log('Trying global fetch override method');
             
             // Temporarily override global fetch
             global.fetch = authenticatedFetch;
             
             try {
               this.transport = new StreamableHTTPClientTransport(url.href);
               console.log('Using basic constructor with global fetch override');
             } finally {
               // Restore original fetch after transport creation
               global.fetch = originalFetch;
             }
             await this.mcp.connect(this.transport);
           }
         }
        

        const toolsResult = await this.mcp.listTools();
        const filteredTools = toolsResult.tools.filter((tool) => tool.name !== "changeDatabase");
        this.tools = await this.createLangChainTools(filteredTools);
        await this.setupAgent();
        console.log(
          "Connected to MCP server with tools:",
          this.tools.map((tool) => tool.name)
        );
      }
    } catch (e) {
      console.log("Failed to connect to MCP server: ", e);
      throw e;
    }
  }
  async processQuery(query, retryCount = 0) {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second
    
    try {
      // Convert message format for LangChain
      const chatHistory = [];
      let currentInput = "";
      
      for (let i = 0; i < query.length; i++) {
        const msg = query[i];
        if (msg.isUser) {
          if (i === query.length - 1) {
            // Last message is the current input
            currentInput = msg.text;
          } else {
            // Previous user messages go to chat history
            chatHistory.push(["human", msg.text]);
          }
        } else {
          // Assistant messages go to chat history
          chatHistory.push(["assistant", msg.text]);
        }
      }
      
      console.log("Processing query with LangChain:", currentInput);
      console.log("Chat history:", chatHistory);
      
      const result = await this.agentExecutor.invoke({
        input: currentInput,
        chat_history: chatHistory,
      });
      
      console.log("LangChain result:", result);
      
      return {
        finalText: result.output || "No response generated",
        flags: flags
      };
    } catch (error) {
      console.error("Error in LangChain processQuery:", error);
      
      // Check if this is an overload error and we haven't exceeded retry limit
      const isOverloadError = error.message && (
        error.message.includes('overloaded') || 
        error.message.includes('Overloaded') ||
        error.message.includes('rate_limit') ||
        error.message.includes('429')
      );
      
      if (isOverloadError && retryCount < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryCount); // Exponential backoff
        console.log(`API overloaded, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.processQuery(query, retryCount + 1);
      }
      
      // If not an overload error or max retries exceeded, return user-friendly message
      let errorMessage = "I'm currently experiencing high traffic. Please try again in a moment.";
      
      if (!isOverloadError) {
        errorMessage = "I encountered an error processing your request. Please try again.";
      }
      
      return {
        finalText: errorMessage,
        flags: flags
      };
    }
  }
}

app.get('/api/config', async (req, res) => {
  try {
    res.json({ apiKey: process.env.VITE_GOOGLE_MAPS_API_KEY });
  } catch (error) {
    console.error('Error in config endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


const mcpClient = new LangChainMCPClient();
const dataAnalysisPipeline = new DataAnalysisPipeline();

// Chat endpoint for LLM interactions
app.post('/api/chat', async (req, res) => {
  try {
    const { messages} = req.body;
    console.log('Received messages:', messages);

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid message format' });
    }

    const response = await mcpClient.processQuery(messages);
    resetFlags();
    res.json({ response: response });
  } catch (error) {
    console.error('Error in chat endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.get('/api/polygons', async (req, res) => {
  try {
    let rows;
    if (process.env.ENV == "dev") {
      const connection = await mysql.createConnection(dbConfig);
      [rows] = await connection.execute('SELECT * FROM catchments'); // Adjust query as needed
      connection.end();
    } else {
      [rows] = await anyQuery({
        tbl: 'catchments',
        select: '*'
      });
    }
    // Convert rows to GeoJSON format
    const geoJson = {
      type: 'FeatureCollection',
      features: rows.map(row => ({
        type: 'Feature',
        geometry: wellknown.parse(row.Geometry_WKT), // Convert WKT to GeoJSON
        properties: { ...row }, // Include other properties
      })),
    };

    res.json(geoJson);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching polygons');
  }
});

app.get('/api/polygons/:id', async (req, res) => {
  try {
    const id = req.params.id;
    let rows;
    if (process.env.ENV == "dev") {
      const connection = await mysql.createConnection(dbConfig);
      [rows] = await connection.execute("Select * FROM " + Queries[`${id.toLowerCase()}_catchments_query`]);
      connection.end();
    } else {
      [rows] = await anyQuery({
        tbl: Queries[`${id.toLowerCase()}_catchments_query`],
        select: '*',
        
      });
    }
    // Convert rows to GeoJSON format
    const geoJson = {
      type: 'FeatureCollection',
      features: rows.map(row => ({
        type: 'Feature',
        geometry: wellknown.parse(row.Geometry_WKT), // Convert WKT to GeoJSON
        properties: { ...row }, // Include other properties
      })),
    };
    res.json(geoJson);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching polygon');
  }
});

// Data Analysis Pipeline Endpoints

// Main data analysis endpoint
app.post('/api/data-analysis', async (req, res) => {
  try {
    const { 
      query, 
      includeVisualization = true, 
      includeSummary = true,
      visualizationType = 'auto',
      maxRows = 10000,
      visualizationLibrary = 'plotly'
    } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required and must be a string' });
    }

    console.log('Processing data analysis query:', query, 'with library:', visualizationLibrary);

    const result = await dataAnalysisPipeline.processQuery(query, {
      includeVisualization,
      includeSummary,
      visualizationType,
      maxRows,
      visualizationLibrary
    });

    res.json(result);
  } catch (error) {
    console.error('Error in data analysis endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Execute custom SQL query
app.post('/api/execute-sql', async (req, res) => {
  try {
    const { sqlQuery, maxRows = 10000 } = req.body;

    if (!sqlQuery || typeof sqlQuery !== 'string') {
      return res.status(400).json({ error: 'SQL query is required' });
    }

    const result = await dataAnalysisPipeline.executeCustomSQL(sqlQuery, { maxRows });
    res.json(result);
  } catch (error) {
    console.error('Error in execute SQL endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Validate SQL query
app.post('/api/validate-sql', async (req, res) => {
  try {
    const { sqlQuery } = req.body;

    if (!sqlQuery || typeof sqlQuery !== 'string') {
      return res.status(400).json({ error: 'SQL query is required' });
    }

    const validation = dataAnalysisPipeline.validateSQLOnly(sqlQuery);
    res.json(validation);
  } catch (error) {
    console.error('Error in validate SQL endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create custom visualization
app.post('/api/visualize', async (req, res) => {
  try {
    const { data, type = 'auto', title = 'Custom Visualization', width = 800, height = 600 } = req.body;

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'Data must be a non-empty array' });
    }

    const result = await dataAnalysisPipeline.createCustomVisualization(data, {
      type,
      title,
      width,
      height,
      format: 'html'
    });

    res.json(result);
  } catch (error) {
    console.error('Error in visualize endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate custom summary
app.post('/api/generate-summary', async (req, res) => {
  try {
    const { data, context = {} } = req.body;

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'Data must be a non-empty array' });
    }

    const result = await dataAnalysisPipeline.generateCustomSummary(data, context);
    res.json(result);
  } catch (error) {
    console.error('Error in generate summary endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get available database tables
app.get('/api/tables', async (req, res) => {
  try {
    const result = await dataAnalysisPipeline.getAvailableTables();
    res.json(result);
  } catch (error) {
    console.error('Error in tables endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get table schema
app.get('/api/tables/:tableName/schema', async (req, res) => {
  try {
    const { tableName } = req.params;
    const result = await dataAnalysisPipeline.getTableSchema(tableName);
    res.json(result);
  } catch (error) {
    console.error('Error in table schema endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// List visualizations
app.get('/api/visualizations', async (req, res) => {
  try {
    const visualizations = dataAnalysisPipeline.getVisualizationList();
    res.json({ visualizations });
  } catch (error) {
    console.error('Error in visualizations list endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete visualization
app.delete('/api/visualizations/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const success = dataAnalysisPipeline.deleteVisualization(filename);
    res.json({ success });
  } catch (error) {
    console.error('Error in delete visualization endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test database connection
app.get('/api/test-connection', async (req, res) => {
  try {
    const result = await dataAnalysisPipeline.testConnection();
    res.json(result);
  } catch (error) {
    console.error('Error in test connection endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function resetFlags() {
  flags = {
    databaseChanged: {value: false, database: null},
    strokeByChanged: {value: false, strokeBy: null},
    strokePalletteChanged: {value: false, strokePallette: null},
    strokeWeightChanged: {value: false, strokeWeight: null},
    fillByChanged: {value: false, fillBy: null},  
    fillPalletteChanged: {value: false, fillPallette: null},
    fillOpacityChanged: {value: false, fillOpacity: null},
    latLngChanged: {value: false, lat: null, lng: null}
  }
}

// Serve visualization files
const visualizationPath = path.join(__dirname, 'visualizations');
if (!fs.existsSync(visualizationPath)) {
  fs.mkdirSync(visualizationPath, { recursive: true });
}
app.use('/visualizations', express.static(visualizationPath));

// Check if dist directory exists before trying to serve static files
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  console.log('Serving static files from dist directory');
  // Serve static files from the React app build directory
  app.use(express.static(distPath));

  // For any request that doesn't match an API route, send the React app
  app.get('/', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  console.log('Dist directory not found, serving API only.');
  app.get('/', (req, res) => {
    res.send('API server is running. Frontend build not available.');
  });
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`)
  try {
    await mcpClient.connectToServer('../sid-mcp/build/index.js');
  } catch (error) {
    console.error('Error connecting to MCP server:', error);
  }
});