import { SQLGenerator } from './sqlGenerator.js';
import { SQLValidator } from './sqlValidator.js';
import { QueryExecutor } from './queryExecutor.js';
import { VisualizationTool } from './visualizationTool.js';
import { SummaryGenerator } from './summaryGenerator.js';
import { getTableNames, getTableSchema } from './queryFunctions.js';

export class DataAnalysisPipeline {
  constructor() {
    this.sqlGenerator = new SQLGenerator();
    this.sqlValidator = new SQLValidator();
    this.queryExecutor = new QueryExecutor();
    this.visualizationTool = new VisualizationTool();
    this.summaryGenerator = new SummaryGenerator();
  }

  async processQuery(userInput, options = {}) {
    const {
      includeVisualization = true,
      includeSummary = true,
      visualizationType = 'auto',
      databaseSchema = null,
      maxRows = 10000
    } = options;

    const pipeline = {
      userInput,
      sqlQuery: null,
      validation: null,
      queryResult: null,
      visualization: null,
      summary: null,
      errors: [],
      warnings: [],
      executionTime: {
        start: Date.now(),
        sqlGeneration: null,
        validation: null,
        queryExecution: null,
        visualization: null,
        summary: null,
        total: null
      }
    };

    try {
      // Step 1: Generate SQL Query
      console.log('Step 1: Generating SQL query...');
      const sqlStart = Date.now();
      
      // Get schema dynamically from database if not provided
      let schemaToUse = databaseSchema;
      if (!schemaToUse) {
        try {
          // Fetch available tables and their schemas

          //TODO IMPLEMENT CHECKING ALL DATABASES
          const db = "schools"
          const tablesResult = await getTableNames(db);
          console.log("Tables result:", tablesResult);
          if (Object.keys(tablesResult).length > 0) {
            const schemaInfo = {};
            for (let i = 0; i < Object.keys(tablesResult).length; i++) {
              const tableName = tablesResult[i]["Tables_in_schools"];
              console.log("Table:", tablesResult[i], "Table name:", tableName);
              try {
                const tableSchema = await getTableSchema(db, tableName);
                console.log("Table schema:", tableSchema);
                schemaInfo[tableName] = {
                  table_name: tableName,
                  columns: tableSchema
                };
              } catch (error) {
                console.warn(`Failed to get schema for table ${tableName}:`, error.message);
              }
            }
            
            //schemaToUse = JSON.stringify(schemaInfo);
          }
        } catch (error) {
          console.warn('Failed to fetch dynamic schema, falling back to hardcoded:', error.message);
          // schemaToUse = getSchemaContext();
        }
      }
      console.log("Schema to use:", schemaToUse);
      
      pipeline.sqlQuery = await this.sqlGenerator.generateSQL(userInput, schemaToUse);
      pipeline.executionTime.sqlGeneration = Date.now() - sqlStart;
      
      console.log('Generated SQL:', pipeline.sqlQuery);

      // Step 2: Validate SQL Query
      console.log('Step 2: Validating SQL query...');
      const validationStart = Date.now();
      
      pipeline.validation = this.sqlValidator.validateSQL(pipeline.sqlQuery);
      pipeline.executionTime.validation = Date.now() - validationStart;
      
      if (!pipeline.validation.isValid) {
        throw new Error(`SQL validation failed: ${pipeline.validation.errors.join(', ')}`);
      }

      if (pipeline.validation.warnings.length > 0) {
        pipeline.warnings.push(...pipeline.validation.warnings);
      }

      // Step 3: Execute Query
      console.log('Step 3: Executing query...');
      const queryStart = Date.now();
      
      pipeline.queryResult = await this.queryExecutor.executeQuery(pipeline.sqlQuery, {
        maxRows,
        returnMetadata: true,
        timeout: 30000
      });
      pipeline.executionTime.queryExecution = Date.now() - queryStart;

      if (!pipeline.queryResult.success) {
        throw new Error(`Query execution failed: ${pipeline.queryResult.error}`);
      }

      console.log('Query executed successfully, rows:', pipeline.queryResult.rowCount);

      // Step 4: Create Visualization
      if (includeVisualization && pipeline.queryResult.data.length > 0) {
        console.log('Step 4: Creating visualization...');
        const vizStart = Date.now();
        
        try {
          pipeline.visualization = await this.visualizationTool.createVisualization(
            pipeline.queryResult.data,
            {
              type: visualizationType,
              title: `Results for: ${userInput}`,
              format: 'html'
            }
          );
          pipeline.executionTime.visualization = Date.now() - vizStart;
          console.log('Visualization created:', pipeline.visualization.filename);
        } catch (vizError) {
          console.error('Visualization error:', vizError);
          pipeline.warnings.push(`Visualization creation failed: ${vizError.message}`);
        }
      }

      // Step 5: Generate Summary
      if (includeSummary && pipeline.queryResult.data.length > 0) {
        console.log('Step 5: Generating summary...');
        const summaryStart = Date.now();
        
        try {
          pipeline.summary = await this.summaryGenerator.generateInsightfulSummary(
            pipeline.queryResult.data,
            pipeline.sqlQuery,
            pipeline.visualization,
            userInput
          );
          pipeline.executionTime.summary = Date.now() - summaryStart;
          console.log('Summary generated successfully');
        } catch (summaryError) {
          console.error('Summary generation error:', summaryError);
          pipeline.warnings.push(`Summary generation failed: ${summaryError.message}`);
        }
      }

      pipeline.executionTime.total = Date.now() - pipeline.executionTime.start;
      
      return {
        success: true,
        pipeline,
        result: {
          userInput,
          sqlQuery: pipeline.sqlQuery,
          data: pipeline.queryResult.data,
          rowCount: pipeline.queryResult.rowCount,
          visualization: pipeline.visualization,
          summary: pipeline.summary?.summary,
          executionTime: pipeline.executionTime,
          warnings: pipeline.warnings
        }
      };

    } catch (error) {
      console.error('Pipeline error:', error);
      pipeline.errors.push(error.message);
      pipeline.executionTime.total = Date.now() - pipeline.executionTime.start;

      return {
        success: false,
        pipeline,
        error: error.message,
        result: {
          userInput,
          sqlQuery: pipeline.sqlQuery,
          errors: pipeline.errors,
          warnings: pipeline.warnings,
          executionTime: pipeline.executionTime
        }
      };
    }
  }

  async testConnection() {
    try {
      const result = await this.queryExecutor.testConnection();
      return result;
    } catch (error) {
      return {
        success: false,
        message: `Connection test failed: ${error.message}`
      };
    }
  }

  async getAvailableTables() {
    try {
      const tables = await this.queryExecutor.getAvailableTables();
      return { success: true, tables };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getTableSchema(tableName) {
    try {
      const schema = await this.queryExecutor.getTableSchema(tableName);
      return { success: true, schema };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async createCustomVisualization(data, options = {}) {
    try {
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Data must be a non-empty array');
      }

      const visualization = await this.visualizationTool.createVisualization(data, options);
      return { success: true, visualization };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async generateCustomSummary(data, context = {}) {
    try {
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Data must be a non-empty array');
      }

      const summary = await this.summaryGenerator.generateSummary(data, context);
      return { success: true, summary };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  getVisualizationList() {
    return this.visualizationTool.listVisualizations();
  }

  deleteVisualization(filename) {
    return this.visualizationTool.deleteVisualization(filename);
  }

  validateSQLOnly(sqlQuery) {
    return this.sqlValidator.validateSQL(sqlQuery);
  }

  async executeCustomSQL(sqlQuery, options = {}) {
    try {
      // Validate first
      const validation = this.sqlValidator.validateSQL(sqlQuery);
      if (!validation.isValid) {
        return {
          success: false,
          error: `SQL validation failed: ${validation.errors.join(', ')}`,
          validation
        };
      }

      // Execute query
      const result = await this.queryExecutor.executeQuery(sqlQuery, options);
      return {
        success: result.success,
        data: result.data,
        rowCount: result.rowCount,
        error: result.error,
        validation,
        warnings: validation.warnings
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}