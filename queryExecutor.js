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
    
    const parsedQuery = this.parseSelectQuery(sqlQuery);
    if (!parsedQuery) {
      throw new Error('Unable to parse SELECT query');
    }

    let finalQuery = sqlQuery;
    if (maxRows && !sqlQuery.toLowerCase().includes('limit')) {
      finalQuery = sqlQuery.replace(/;?\s*$/, ` LIMIT ${maxRows};`);
    }

    const [result] = await anyQuery({
      prj: process.env.GCP_PROJECT_ID || "magnetic-runway-428121",
      ds: process.env.GCP_DATASET_ID || "schools",
      tbl: parsedQuery.table,
      select: parsedQuery.select,
      conditions: parsedQuery.conditions
    });

    return Array.isArray(result) ? result : [result];
  }

  parseSelectQuery(sqlQuery) {
    try {
      const cleanQuery = sqlQuery.trim().toLowerCase();
      
      if (!cleanQuery.startsWith('select')) {
        return null;
      }

      const selectMatch = sqlQuery.match(/select\s+(.*?)\s+from\s+(\w+)/i);
      if (!selectMatch) {
        return null;
      }

      const select = selectMatch[1].trim();
      const table = selectMatch[2].trim();

      const whereMatch = sqlQuery.match(/where\s+(.*?)(?:\s+order\s+by|\s+group\s+by|\s+limit|\s*;?\s*$)/i);
      const orderMatch = sqlQuery.match(/order\s+by\s+(.*?)(?:\s+limit|\s*;?\s*$)/i);
      const groupMatch = sqlQuery.match(/group\s+by\s+(.*?)(?:\s+order\s+by|\s+limit|\s*;?\s*$)/i);
      const limitMatch = sqlQuery.match(/limit\s+(\d+)/i);

      const conditions = [];
      if (whereMatch) conditions.push(`WHERE ${whereMatch[1].trim()}`);
      if (groupMatch) conditions.push(`GROUP BY ${groupMatch[1].trim()}`);
      if (orderMatch) conditions.push(`ORDER BY ${orderMatch[1].trim()}`);
      if (limitMatch) conditions.push(`LIMIT ${limitMatch[1]}`);

      return {
        select: select === '*' ? '*' : select,
        table,
        conditions
      };
    } catch (error) {
      console.error('Error parsing query:', error);
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