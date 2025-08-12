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
import { Anthropic } from '@anthropic-ai/sdk';
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
dotenv.config();
import { anyQuery } from './queryFunctions.js';
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

class MCPClient {

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
    this.mcp = new Client({
      name: "SID-Client",
      version: "1.0.0",
    });
    
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
        this.tools = toolsResult.tools.map((tool) => {
          return {
            name: tool.name,
            description: tool.description,
            input_schema: tool.inputSchema,
          };
        });
        console.log(
          "Connected to server with tools:",
          this.tools.map(({ name }) => name)
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
        this.tools = toolsResult.tools.map((tool) => {
          return {
            name: tool.name,
            description: tool.description,
            input_schema: tool.inputSchema,
          };
        });
        this.tools = this.tools.filter((tool) => tool.name !== "changeDatabase");
        console.log(
          "Connected to MCP server with tools:",
          this.tools.map(({ name }) => name)
        );
      }
    } catch (e) {
      console.log("Failed to connect to MCP server: ", e);
      throw e;
    }
  }
  async processQuery(query) {
    const messages = query.map((msg) => {
      return {
        role: msg.isUser ? "user" : "assistant",
        content: msg.text,
      }
    });
    console.log("messages:", messages);
  
    const response = await this.anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1000,
      messages,
      tools: this.tools,
    });
  
    const finalText = [];
    const toolResults = [];
  
    console.log("response.content:", response.content);

   
    for (const content of response.content) {
      if (content.type === "text") {
        finalText.push(content.text);
      } else if (content.type === "tool_use") {
        const toolName = content.name;
        const toolArgs = content.input;
  
        const result = await this.mcp.callTool({
          name: toolName,
          arguments: toolArgs, 
        });
        //TODO add more flags
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
          if (toolArgs.colorFlag) {
            flags.fillByChanged.value = true;
            flags.fillByChanged.fillBy = toolArgs.fillBy;
          }
          if (toolArgs.colorFlag) {
            flags.fillPalletteChanged.value = true;
            flags.fillPalletteChanged.fillPallette = toolArgs.fillPallette;
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
        toolResults.push(result);
        finalText.push(
          `[Calling tool ${toolName} with args ${JSON.stringify(toolArgs)}]`
        );
  
        messages.push({
          role: "user",
          content: result.content ,
        });
  
        const response = await this.anthropic.messages.create({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 1000,
          messages,
        });
  
        finalText.push(
          response.content[0].type === "text" ? response.content[0].text : ""
        );
      }
    }
  
    return {finalText: finalText.join("\n"), flags: flags};
  }
}

const mcpClient = new MCPClient();

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