import mysql from 'mysql2/promise';
import { anyQuery } from './queryFunctions.js';
import dotenv from 'dotenv';

dotenv.config();

export class QueryExecutor {
  constructor() {
    this.dbConfig = {
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'schools',
    };
  }

  async executeQuery(sqlQuery, options = {}) {
    try {
      const {
        timeout = 30000,
        maxRows = 10000,
        returnMetadata = false
      } = options;

      let result;
      let metadata = {};

      if (process.env.ENV === "dev") {
        result = await this.executeLocalQuery(sqlQuery, { timeout, maxRows });
      } else {
        result = await this.executeCloudQuery(sqlQuery, { timeout, maxRows });
      }

      if (returnMetadata) {
        metadata = {
          rowCount: result.length,
          columns: result.length > 0 ? Object.keys(result[0]) : [],
          executionTime: Date.now(),
          environment: process.env.ENV || 'production'
        };
      }

      return {
        success: true,
        data: result,
        metadata: returnMetadata ? metadata : undefined,
        rowCount: result.length
      };

    } catch (error) {
      console.error('Query execution error:', error);
      return {
        success: false,
        error: error.message,
        data: [],
        rowCount: 0
      };
    }
  }

  async executeLocalQuery(sqlQuery, options = {}) {
    const { timeout, maxRows } = options;
    
    const connection = await mysql.createConnection({
      ...this.dbConfig,
      timeout
    });

    try {
      let finalQuery = sqlQuery;
      if (maxRows && !sqlQuery.toLowerCase().includes('limit')) {
        finalQuery = sqlQuery.replace(/;?\s*$/, ` LIMIT ${maxRows};`);
      }

      const [rows] = await connection.execute(finalQuery);
      return Array.isArray(rows) ? rows : [rows];
    } finally {
      await connection.end();
    }
  }

  async executeCloudQuery(sqlQuery, options = {}) {
    const { maxRows } = options;
    
    // For cloud execution, we need to work with the anyQuery function
    // which constructs its own SQL. Let's use a different approach.
    
    let finalQuery = sqlQuery.trim();
    if (maxRows && !sqlQuery.toLowerCase().includes('limit')) {
      finalQuery = finalQuery.replace(/;?\s*$/, ` LIMIT ${maxRows}`);
    }
    
    // The anyQuery function expects tbl, select, and conditions parameters
    // but it constructs the SQL itself. For complex queries, we need to use
    // a workaround by passing the full query directly.
    
    try {
      // Use a special approach: pass the query as a "table" parameter
      // and modify anyQuery to handle full queries
      console.log("Executing raw cloud query:", finalQuery);
      const [result] = await this.executeRawCloudQuery(finalQuery);
      return Array.isArray(result) ? result : [result];
    } catch (error) {
      console.error('Raw query execution failed:', error);
      
      // Fallback: try to parse and use component-based approach
      const parsedQuery = this.parseSelectQuery(sqlQuery);
      if (!parsedQuery) {
        throw new Error(`Unable to parse SELECT query: ${sqlQuery}`);
      }

      const [result] = await anyQuery_no_db({
        prj: process.env.GCP_PROJECT_ID || "magnetic-runway-428121",
        ds: process.env.GCP_DATASET_ID || "schools",
        tbl: parsedQuery.table,
        select: parsedQuery.select,
        conditions: parsedQuery.conditions
      });

      return Array.isArray(result) ? result : [result];
    }
  }

  async executeRawCloudQuery(fullQuery) {
    // Create a modified version of anyQuery that accepts raw SQL
    const baseUrl = "https://backend-v1-1010920399604.northamerica-northeast2.run.app";
    
    let idToken;
    try {
      const response = await fetch("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=" + baseUrl, {
        headers: {
          "Metadata-Flavor": "Google"
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get identity token: ${response.status} ${response.statusText}`);
      }
      
      idToken = await response.text();
    } catch (error) {
      throw new Error(`Authentication failed: ${error.message}`);
    }

    // Prepare the request body with the full query
    const body = {
      fun: "get",
      projectId: process.env.GCP_PROJECT_ID || "magnetic-runway-428121",
      datasetId: process.env.GCP_DATASET_ID || "schools",
      query: fullQuery
    };
     
    // Make the API request
    const apiResponse = await fetch(`${baseUrl}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify(body)
    });
    
    // Parse the response
    if (apiResponse.ok) {
      const result = await apiResponse.json();
      return [result];
    } else {
      const errorText = await apiResponse.text();
      throw new Error(`API request failed: ${apiResponse.status} ${apiResponse.statusText}. Query: ${fullQuery}. Error: ${errorText}`);
    }
  }

  parseSelectQuery(sqlQuery) {
    try {
      const cleanQuery = sqlQuery.trim();
      
      if (!cleanQuery.toLowerCase().startsWith('select')) {
        console.error('Query does not start with SELECT:', cleanQuery.substring(0, 50));
        return null;
      }

      // More flexible regex to handle various SELECT query formats
      const selectMatch = cleanQuery.match(/select\s+((?:(?!from\s).)*?)\s+from\s+([`\w]+(?:\s+as\s+\w+)?)/i);
      if (!selectMatch) {
        console.error('Could not parse SELECT and FROM clauses:', cleanQuery.substring(0, 100));
        // Try a simpler approach
        const simpleMatch = cleanQuery.match(/select\s+(.*?)\s+from\s+(\S+)/i);
        if (!simpleMatch) {
          return null;
        }
        return {
          select: simpleMatch[1].trim() || '*',
          table: simpleMatch[2].trim().replace(/[`;]/g, ''),
          conditions: []
        };
      }

      const select = selectMatch[1].trim() || '*';
      const table = selectMatch[2].trim().replace(/[`;]/g, '');

      // Extract different clauses more flexibly
      const conditions = [];
      
      // WHERE clause
      const whereMatch = cleanQuery.match(/where\s+((?:(?!(?:group\s+by|order\s+by|limit|having)\s).)*?)(?:\s+(?:group\s+by|order\s+by|limit|having)|\s*;?\s*$)/i);
      if (whereMatch && whereMatch[1].trim()) {
        conditions.push(`WHERE ${whereMatch[1].trim()}`);
      }

      // GROUP BY clause
      const groupMatch = cleanQuery.match(/group\s+by\s+((?:(?!(?:having|order\s+by|limit)\s).)*?)(?:\s+(?:having|order\s+by|limit)|\s*;?\s*$)/i);
      if (groupMatch && groupMatch[1].trim()) {
        conditions.push(`GROUP BY ${groupMatch[1].trim()}`);
      }

      // HAVING clause
      const havingMatch = cleanQuery.match(/having\s+((?:(?!(?:order\s+by|limit)\s).)*?)(?:\s+(?:order\s+by|limit)|\s*;?\s*$)/i);
      if (havingMatch && havingMatch[1].trim()) {
        conditions.push(`HAVING ${havingMatch[1].trim()}`);
      }

      // ORDER BY clause
      const orderMatch = cleanQuery.match(/order\s+by\s+((?:(?!limit\s).)*?)(?:\s+limit|\s*;?\s*$)/i);
      if (orderMatch && orderMatch[1].trim()) {
        conditions.push(`ORDER BY ${orderMatch[1].trim()}`);
      }

      // LIMIT clause
      const limitMatch = cleanQuery.match(/limit\s+(\d+)(?:\s+offset\s+\d+)?\s*;?\s*$/i);
      if (limitMatch) {
        conditions.push(`LIMIT ${limitMatch[1]}`);
      }

      console.log('Parsed query successfully:', { select, table, conditions });

      return {
        select: select === '*' ? '*' : select,
        table,
        conditions
      };
    } catch (error) {
      console.error('Error parsing query:', error);
      console.error('Query was:', sqlQuery);
      return null;
    }
  }

  async testConnection() {
    try {
      if (process.env.ENV === "dev") {
        const connection = await mysql.createConnection(this.dbConfig);
        await connection.ping();
        await connection.end();
        return { success: true, message: 'Local database connection successful' };
      } else {
        await anyQuery({ tbl: 'catchments', select: '1', conditions: ['LIMIT 1'] });
        return { success: true, message: 'Cloud database connection successful' };
      }
    } catch (error) {
      return { success: false, message: `Connection failed: ${error.message}` };
    }
  }

  async getTableSchema(tableName) {
    try {
      let schemaQuery;
      if (process.env.ENV === "dev") {
        schemaQuery = `DESCRIBE ${tableName};`;
        const connection = await mysql.createConnection(this.dbConfig);
        const [rows] = await connection.execute(schemaQuery);
        await connection.end();
        return rows;
      } else {
        schemaQuery = `SELECT column_name, data_type, is_nullable 
                      FROM information_schema.columns 
                      WHERE table_name = '${tableName}' 
                      AND table_schema = DATABASE();`;
        
        const [result] = await anyQuery({
          tbl: 'information_schema.columns',
          select: 'column_name, data_type, is_nullable',
          conditions: [
            `WHERE table_name = '${tableName}'`,
            'AND table_schema = DATABASE()'
          ]
        });
        return result;
      }
    } catch (error) {
      console.error('Error getting table schema:', error);
      throw error;
    }
  }

  async getAvailableTables() {
    try {
      if (process.env.ENV === "dev") {
        const connection = await mysql.createConnection(this.dbConfig);
        const [rows] = await connection.execute('SHOW TABLES;');
        await connection.end();
        return rows.map(row => Object.values(row)[0]);
      } else {
        const [result] = await anyQuery({
          tbl: 'information_schema.tables',
          select: 'table_name',
          conditions: ['WHERE table_schema = DATABASE()']
        });
        return Array.isArray(result) ? result.map(row => row.table_name) : [];
      }
    } catch (error) {
      console.error('Error getting available tables:', error);
      throw error;
    }
  }
}