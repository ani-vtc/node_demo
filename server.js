import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import wellknown from 'wellknown';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { anyQuery } from './queryFunctions.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());

//Db config for cloud run/local
const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'schools',
};

app.get('/polygons', async (req, res) => {
  try {
    if (process.env.ENV === 'dev') {
      const connection = await mysql.createConnection(dbConfig);
      const [rows] = await connection.execute('SELECT * FROM catchments'); // Adjust query as needed
      connection.end();
    } else {
      const rows = await anyQuery({
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

// Check if dist directory exists before trying to serve static files
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  console.log('Serving static files from dist directory');
  // Serve static files from the React app build directory
  app.use(express.static(distPath));

  // For any request that doesn't match an API route, send the React app
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  console.log('Dist directory not found, serving API only.');
  app.get('/', (req, res) => {
    res.send('API server is running. Frontend build not available.');
  });
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));