import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import wellknown from 'wellknown';

const app = express();
app.use(cors());

const dbConfig = {
  host: '127.0.0.1',
  user: 'admin',
  password: '49-visthinkCo-123!',
  database: 'schools',
};

app.get('/polygons', async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute('SELECT * FROM catchments'); // Adjust query as needed
    connection.end();


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

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));