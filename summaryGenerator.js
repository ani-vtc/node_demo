import { ChatAnthropic } from '@langchain/anthropic';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import dotenv from 'dotenv';

dotenv.config();

export class SummaryGenerator {
  constructor() {
    this.llm = new ChatAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: "claude-3-5-sonnet-20241022",
      temperature: 0.3,
    });
  }

  async generateSummary(data, context = {}) {
    try {
      const {
        sqlQuery = '',
        visualizationType = '',
        analysisSteps = [],
        userQuestion = '',
        insights = []
      } = context;

      const dataAnalysis = this.analyzeData(data);
      
      const prompt = ChatPromptTemplate.fromTemplate(`
You are a data analyst tasked with creating clear, insightful summaries for non-technical users.

**Data Analysis Context:**
- Original Question: {userQuestion}
- SQL Query Used: {sqlQuery}
- Visualization Type: {visualizationType}
- Analysis Steps: {analysisSteps}

**Data Summary:**
- Total Records: {totalRecords}
- Columns: {columns}
- Data Types: {dataTypes}
- Key Statistics: {statistics}

**Raw Data Sample (first 5 rows):**
{dataSample}

**Task:**
Create a comprehensive but accessible summary that includes:
1. **Key Findings**: The most important insights from this data
2. **Trends & Patterns**: Notable trends, patterns, or relationships
3. **Extremes & Anomalies**: Highest/lowest values, outliers, or unusual patterns
4. **Business Context**: What these findings might mean in practical terms
5. **Recommendations**: Actionable insights based on the data

**Guidelines:**
- Use plain language that non-technical users can understand
- Focus on business impact and practical implications
- Highlight the most significant findings first
- Use specific numbers and percentages where relevant
- Avoid technical jargon and database terminology
- Keep the summary concise but comprehensive (3-5 paragraphs)

**Summary:**`);

      const chain = prompt.pipe(this.llm);
      const response = await chain.invoke({
        userQuestion: userQuestion || 'Data analysis request',
        sqlQuery: sqlQuery || 'N/A',
        visualizationType: visualizationType || 'N/A',
        analysisSteps: Array.isArray(analysisSteps) ? analysisSteps.join(', ') : 'N/A',
        totalRecords: dataAnalysis.totalRecords,
        columns: dataAnalysis.columns.join(', '),
        dataTypes: JSON.stringify(dataAnalysis.dataTypes, null, 2),
        statistics: JSON.stringify(dataAnalysis.statistics, null, 2),
        dataSample: this.formatDataSample(data.slice(0, 5))
      });

      return {
        summary: response.content.trim(),
        metadata: {
          generatedAt: new Date().toISOString(),
          dataAnalysis: dataAnalysis,
          context: context
        }
      };

    } catch (error) {
      console.error('Error generating summary:', error);
      throw new Error('Failed to generate data summary');
    }
  }

  analyzeData(data) {
    if (!Array.isArray(data) || data.length === 0) {
      return {
        totalRecords: 0,
        columns: [],
        dataTypes: {},
        statistics: {}
      };
    }

    const columns = Object.keys(data[0] || {});
    const dataTypes = {};
    const statistics = {};

    columns.forEach(column => {
      const values = data.map(row => row[column]).filter(val => val !== null && val !== undefined);
      
      // Determine data type
      const numericValues = values.filter(val => !isNaN(parseFloat(val)) && isFinite(val));
      const dateValues = values.filter(val => {
        const date = new Date(val);
        return date instanceof Date && !isNaN(date);
      });

      if (numericValues.length > values.length * 0.8) {
        dataTypes[column] = 'numeric';
        const nums = numericValues.map(val => parseFloat(val));
        statistics[column] = {
          type: 'numeric',
          count: nums.length,
          min: Math.min(...nums),
          max: Math.max(...nums),
          mean: nums.reduce((sum, val) => sum + val, 0) / nums.length,
          median: this.calculateMedian(nums)
        };
      } else if (dateValues.length > values.length * 0.8) {
        dataTypes[column] = 'date';
        const dates = dateValues.map(val => new Date(val));
        statistics[column] = {
          type: 'date',
          count: dates.length,
          earliest: new Date(Math.min(...dates)),
          latest: new Date(Math.max(...dates))
        };
      } else {
        dataTypes[column] = 'categorical';
        const uniqueValues = new Set(values);
        const valueCounts = {};
        values.forEach(val => {
          valueCounts[val] = (valueCounts[val] || 0) + 1;
        });
        
        const sortedCounts = Object.entries(valueCounts)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5);

        statistics[column] = {
          type: 'categorical',
          count: values.length,
          uniqueValues: uniqueValues.size,
          mostCommon: sortedCounts
        };
      }
    });

    return {
      totalRecords: data.length,
      columns: columns,
      dataTypes: dataTypes,
      statistics: statistics
    };
  }

  calculateMedian(numbers) {
    const sorted = [...numbers].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[middle - 1] + sorted[middle]) / 2;
    }
    return sorted[middle];
  }

  formatDataSample(data) {
    if (!Array.isArray(data) || data.length === 0) {
      return 'No data available';
    }

    const headers = Object.keys(data[0] || {});
    let formatted = headers.join(' | ') + '\n';
    formatted += headers.map(() => '---').join(' | ') + '\n';
    
    data.forEach(row => {
      formatted += headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return 'null';
        if (typeof value === 'string' && value.length > 20) {
          return value.substring(0, 17) + '...';
        }
        return String(value);
      }).join(' | ') + '\n';
    });

    return formatted;
  }

  async generateInsightfulSummary(data, sqlQuery, visualizationResult, userQuestion) {
    try {
      const context = {
        sqlQuery: sqlQuery,
        visualizationType: visualizationResult?.type || 'unknown',
        userQuestion: userQuestion,
        analysisSteps: [
          'Generated SQL query from natural language',
          'Validated query for security',
          'Executed query against database',
          'Created data visualization',
          'Generated summary insights'
        ]
      };

      return await this.generateSummary(data, context);
    } catch (error) {
      console.error('Error generating insightful summary:', error);
      throw error;
    }
  }

  async generateComparisonSummary(datasets, labels, context = {}) {
    try {
      if (!Array.isArray(datasets) || datasets.length < 2) {
        throw new Error('At least two datasets required for comparison');
      }

      const comparisons = datasets.map((data, index) => ({
        label: labels[index] || `Dataset ${index + 1}`,
        analysis: this.analyzeData(data)
      }));

      const prompt = ChatPromptTemplate.fromTemplate(`
You are a data analyst comparing multiple datasets for non-technical users.

**Comparison Context:**
{context}

**Datasets Being Compared:**
{comparisons}

**Task:**
Create a comparative analysis that highlights:
1. **Key Differences**: Major differences between the datasets
2. **Similarities**: Common patterns or characteristics
3. **Relative Performance**: Which dataset performs better in key metrics
4. **Trends**: How the datasets compare over time or categories
5. **Insights**: What these differences mean in practical terms

Use plain language and focus on actionable insights.

**Comparative Summary:**`);

      const chain = prompt.pipe(this.llm);
      const response = await chain.invoke({
        context: JSON.stringify(context, null, 2),
        comparisons: JSON.stringify(comparisons, null, 2)
      });

      return {
        summary: response.content.trim(),
        metadata: {
          generatedAt: new Date().toISOString(),
          comparisons: comparisons,
          context: context
        }
      };

    } catch (error) {
      console.error('Error generating comparison summary:', error);
      throw error;
    }
  }

  async generateTrendAnalysis(timeSeriesData, dateColumn, valueColumn, context = {}) {
    try {
      const sortedData = timeSeriesData.sort((a, b) => 
        new Date(a[dateColumn]) - new Date(b[dateColumn])
      );

      const values = sortedData.map(row => parseFloat(row[valueColumn]) || 0);
      const trendAnalysis = this.calculateTrend(values);

      const prompt = ChatPromptTemplate.fromTemplate(`
You are a data analyst specializing in trend analysis for non-technical audiences.

**Time Series Data:**
- Date Column: {dateColumn}
- Value Column: {valueColumn}
- Data Points: {dataPoints}
- Time Period: {startDate} to {endDate}

**Trend Analysis:**
- Overall Trend: {overallTrend}
- Trend Strength: {trendStrength}
- Average Change: {averageChange}
- Volatility: {volatility}

**Key Statistics:**
- Starting Value: {startValue}
- Ending Value: {endValue}
- Highest Value: {maxValue}
- Lowest Value: {minValue}
- Total Change: {totalChange}%

**Context:**
{context}

**Task:**
Create a trend analysis summary that explains:
1. **Overall Direction**: Is the trend increasing, decreasing, or stable?
2. **Trend Strength**: How consistent is the trend?
3. **Key Turning Points**: When did significant changes occur?
4. **Volatility**: How much variation exists in the data?
5. **Future Implications**: What might this trend suggest going forward?

Use clear language and provide actionable insights.

**Trend Analysis:**`);

      const chain = prompt.pipe(this.llm);
      const response = await chain.invoke({
        dateColumn,
        valueColumn,
        dataPoints: sortedData.length,
        startDate: sortedData[0][dateColumn],
        endDate: sortedData[sortedData.length - 1][dateColumn],
        overallTrend: trendAnalysis.direction,
        trendStrength: trendAnalysis.strength,
        averageChange: trendAnalysis.averageChange.toFixed(2),
        volatility: trendAnalysis.volatility,
        startValue: values[0],
        endValue: values[values.length - 1],
        maxValue: Math.max(...values),
        minValue: Math.min(...values),
        totalChange: (((values[values.length - 1] - values[0]) / values[0]) * 100).toFixed(2),
        context: JSON.stringify(context, null, 2)
      });

      return {
        summary: response.content.trim(),
        trendAnalysis: trendAnalysis,
        metadata: {
          generatedAt: new Date().toISOString(),
          dateColumn,
          valueColumn,
          dataPoints: sortedData.length
        }
      };

    } catch (error) {
      console.error('Error generating trend analysis:', error);
      throw error;
    }
  }

  calculateTrend(values) {
    if (values.length < 2) {
      return { direction: 'insufficient data', strength: 0, averageChange: 0, volatility: 'low' };
    }

    const changes = [];
    for (let i = 1; i < values.length; i++) {
      changes.push(values[i] - values[i - 1]);
    }

    const averageChange = changes.reduce((sum, change) => sum + change, 0) / changes.length;
    const positiveChanges = changes.filter(change => change > 0).length;
    const negativeChanges = changes.filter(change => change < 0).length;

    let direction;
    if (positiveChanges > negativeChanges * 1.5) {
      direction = 'increasing';
    } else if (negativeChanges > positiveChanges * 1.5) {
      direction = 'decreasing';
    } else {
      direction = 'stable';
    }

    const consistency = Math.max(positiveChanges, negativeChanges) / changes.length;
    const strength = consistency > 0.7 ? 'strong' : consistency > 0.5 ? 'moderate' : 'weak';

    const standardDeviation = Math.sqrt(
      changes.reduce((sum, change) => sum + Math.pow(change - averageChange, 2), 0) / changes.length
    );
    const volatility = standardDeviation > Math.abs(averageChange) * 2 ? 'high' : 
                      standardDeviation > Math.abs(averageChange) ? 'moderate' : 'low';

    return {
      direction,
      strength,
      averageChange,
      volatility,
      consistency: consistency * 100
    };
  }
}