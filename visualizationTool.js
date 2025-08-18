import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class VisualizationTool {
  constructor() {
    this.outputDir = path.join(__dirname, 'visualizations');
    this.ensureOutputDirectory();
  }

  ensureOutputDirectory() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  analyzeDataTypes(data) {
    if (!Array.isArray(data) || data.length === 0) {
      return { columns: [], types: {} };
    }

    const columns = Object.keys(data[0]);
    const types = {};

    columns.forEach(column => {
      const values = data.map(row => row[column]).filter(val => val !== null && val !== undefined);
      
      if (values.length === 0) {
        types[column] = 'empty';
        return;
      }

      const numericValues = values.filter(val => !isNaN(parseFloat(val)) && isFinite(val));
      const dateValues = values.filter(val => {
        const date = new Date(val);
        return date instanceof Date && !isNaN(date);
      });

      if (numericValues.length > values.length * 0.8) {
        types[column] = 'numeric';
      } else if (dateValues.length > values.length * 0.8) {
        types[column] = 'date';
      } else {
        const uniqueValues = new Set(values);
        if (uniqueValues.size <= 10 || uniqueValues.size / values.length < 0.1) {
          types[column] = 'categorical';
        } else {
          types[column] = 'text';
        }
      }
    });

    return { columns, types };
  }

  suggestVisualization(data, analysis) {
    const { columns, types } = analysis;
    const numericColumns = columns.filter(col => types[col] === 'numeric');
    const categoricalColumns = columns.filter(col => types[col] === 'categorical');
    const dateColumns = columns.filter(col => types[col] === 'date');

    if (data.length === 1) {
      return 'table';
    }

    if (dateColumns.length > 0 && numericColumns.length > 0) {
      return 'time_series';
    }

    if (numericColumns.length >= 2) {
      return 'scatter';
    }

    if (categoricalColumns.length > 0 && numericColumns.length > 0) {
      if (data.length > 50) {
        return 'histogram';
      }
      return 'bar';
    }

    if (categoricalColumns.length > 0) {
      return 'pie';
    }

    if (numericColumns.length > 0) {
      return 'histogram';
    }

    return 'table';
  }

  async createVisualization(data, options = {}) {
    try {
      const {
        type = 'auto',
        title = 'Data Visualization',
        width = 800,
        height = 600,
        format = 'html',
        filename = null
      } = options;

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Data must be a non-empty array');
      }

      const analysis = this.analyzeDataTypes(data);
      const vizType = type === 'auto' ? this.suggestVisualization(data, analysis) : type;

      let plotData, layout;

      switch (vizType) {
        case 'bar':
          ({ data: plotData, layout } = this.createBarChart(data, analysis, title));
          break;
        case 'scatter':
          ({ data: plotData, layout } = this.createScatterPlot(data, analysis, title));
          break;
        case 'pie':
          ({ data: plotData, layout } = this.createPieChart(data, analysis, title));
          break;
        case 'histogram':
          ({ data: plotData, layout } = this.createHistogram(data, analysis, title));
          break;
        case 'time_series':
          ({ data: plotData, layout } = this.createTimeSeries(data, analysis, title));
          break;
        case 'table':
          return this.createTable(data, title, format, filename);
        default:
          throw new Error(`Unsupported visualization type: ${vizType}`);
      }

      layout.width = width;
      layout.height = height;

      if (format === 'html') {
        return await this.generateHTMLPlot(plotData, layout, filename);
      } else if (format === 'json') {
        return { data: plotData, layout, type: vizType };
      } else {
        throw new Error(`Unsupported format: ${format}`);
      }

    } catch (error) {
      console.error('Visualization creation error:', error);
      throw error;
    }
  }

  createBarChart(data, analysis, title) {
    const { columns, types } = analysis;
    const categoricalCol = columns.find(col => types[col] === 'categorical');
    const numericCol = columns.find(col => types[col] === 'numeric');

    if (!categoricalCol || !numericCol) {
      const firstCol = columns[0];
      const aggregated = this.aggregateData(data, firstCol);
      
      return {
        data: [{
          type: 'bar',
          x: aggregated.labels,
          y: aggregated.values,
          marker: { color: 'rgb(55, 83, 109)' }
        }],
        layout: {
          title: title,
          xaxis: { title: firstCol },
          yaxis: { title: 'Count' }
        }
      };
    }

    const aggregated = this.aggregateData(data, categoricalCol, numericCol);

    return {
      data: [{
        type: 'bar',
        x: aggregated.labels,
        y: aggregated.values,
        marker: { color: 'rgb(55, 83, 109)' }
      }],
      layout: {
        title: title,
        xaxis: { title: categoricalCol },
        yaxis: { title: numericCol }
      }
    };
  }

  createScatterPlot(data, analysis, title) {
    const { columns, types } = analysis;
    const numericColumns = columns.filter(col => types[col] === 'numeric');
    
    const xCol = numericColumns[0];
    const yCol = numericColumns[1] || numericColumns[0];

    return {
      data: [{
        type: 'scatter',
        mode: 'markers',
        x: data.map(row => parseFloat(row[xCol]) || 0),
        y: data.map(row => parseFloat(row[yCol]) || 0),
        marker: { 
          color: 'rgb(55, 83, 109)',
          size: 8
        }
      }],
      layout: {
        title: title,
        xaxis: { title: xCol },
        yaxis: { title: yCol }
      }
    };
  }

  createPieChart(data, analysis, title) {
    const { columns, types } = analysis;
    const categoricalCol = columns.find(col => types[col] === 'categorical') || columns[0];
    
    const aggregated = this.aggregateData(data, categoricalCol);

    return {
      data: [{
        type: 'pie',
        labels: aggregated.labels,
        values: aggregated.values,
        textinfo: 'label+percent',
        textposition: 'outside'
      }],
      layout: {
        title: title
      }
    };
  }

  createHistogram(data, analysis, title) {
    const { columns, types } = analysis;
    const numericCol = columns.find(col => types[col] === 'numeric');
    
    if (!numericCol) {
      return this.createBarChart(data, analysis, title);
    }

    const values = data.map(row => parseFloat(row[numericCol]) || 0);

    return {
      data: [{
        type: 'histogram',
        x: values,
        marker: { color: 'rgb(55, 83, 109)' },
        opacity: 0.7
      }],
      layout: {
        title: title,
        xaxis: { title: numericCol },
        yaxis: { title: 'Frequency' }
      }
    };
  }

  createTimeSeries(data, analysis, title) {
    const { columns, types } = analysis;
    const dateCol = columns.find(col => types[col] === 'date');
    const numericCol = columns.find(col => types[col] === 'numeric');

    if (!dateCol || !numericCol) {
      return this.createScatterPlot(data, analysis, title);
    }

    const sortedData = data.sort((a, b) => new Date(a[dateCol]) - new Date(b[dateCol]));

    return {
      data: [{
        type: 'scatter',
        mode: 'lines+markers',
        x: sortedData.map(row => row[dateCol]),
        y: sortedData.map(row => parseFloat(row[numericCol]) || 0),
        line: { color: 'rgb(55, 83, 109)' },
        marker: { size: 6 }
      }],
      layout: {
        title: title,
        xaxis: { 
          title: dateCol,
          type: 'date'
        },
        yaxis: { title: numericCol }
      }
    };
  }

  createTable(data, title, format, filename) {
    if (format === 'html') {
      const columns = Object.keys(data[0] || {});
      
      let html = `<!DOCTYPE html>
<html>
<head>
    <title>${title}</title>
    <style>
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; font-weight: bold; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        h1 { color: #333; text-align: center; }
        body { font-family: Arial, sans-serif; margin: 20px; }
    </style>
</head>
<body>
    <h1>${title}</h1>
    <table>
        <thead>
            <tr>`;
      
      columns.forEach(col => {
        html += `<th>${col}</th>`;
      });
      
      html += `</tr>
        </thead>
        <tbody>`;
      
      data.forEach(row => {
        html += '<tr>';
        columns.forEach(col => {
          html += `<td>${row[col] || ''}</td>`;
        });
        html += '</tr>';
      });
      
      html += `</tbody>
    </table>
</body>
</html>`;

      const outputFilename = filename || `table_${Date.now()}.html`;
      const filepath = path.join(this.outputDir, outputFilename);
      fs.writeFileSync(filepath, html);

      return {
        type: 'table',
        format: 'html',
        filepath: filepath,
        filename: outputFilename,
        url: `/visualizations/${outputFilename}`
      };
    }

    return { data, type: 'table' };
  }

  async generateHTMLPlot(data, layout, filename) {
    const plotlyConfig = { 
      responsive: true,
      displayModeBar: true,
      modeBarButtonsToRemove: ['pan2d', 'lasso2d']
    };
    const outputFilename = filename || `plot_${Date.now()}.html`;
    const filepath = path.join(this.outputDir, outputFilename);

    const html = `<!DOCTYPE html>
<html>
<head>
    <title>${layout.title || 'Data Visualization'}</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script src="https://cdn.plot.ly/plotly-2.26.0.min.js"></script>
    <style>
        body { 
            margin: 20px; 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f8f9fa;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        #plotDiv { 
            width: 100%; 
            height: ${layout.height || 600}px;
            margin: 20px 0;
        }
        .info {
            color: #666;
            font-size: 14px;
            margin-top: 20px;
            padding: 15px;
            background: #f1f3f4;
            border-radius: 4px;
        }
        h1 {
            color: #333;
            border-bottom: 2px solid #4285f4;
            padding-bottom: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>${layout.title || 'Data Visualization'}</h1>
        <div id="plotDiv"></div>
        <div class="info">
            <strong>Generated:</strong> ${new Date().toLocaleString()}<br>
            <strong>Data Points:</strong> ${Array.isArray(data) && data[0] && data[0].x ? data[0].x.length : 'N/A'}
        </div>
    </div>
    
    <script>
        try {
            const data = ${JSON.stringify(data, null, 2)};
            const layout = ${JSON.stringify(layout, null, 2)};
            const config = ${JSON.stringify(plotlyConfig, null, 2)};
            
            // Enhanced layout with better styling
            layout.font = { family: 'Segoe UI, Arial, sans-serif' };
            layout.plot_bgcolor = 'rgba(0,0,0,0)';
            layout.paper_bgcolor = 'rgba(0,0,0,0)';
            layout.margin = { l: 60, r: 30, t: 80, b: 60 };
            
            Plotly.newPlot('plotDiv', data, layout, config)
                .then(() => {
                    console.log('Plot created successfully');
                })
                .catch((error) => {
                    console.error('Error creating plot:', error);
                    document.getElementById('plotDiv').innerHTML = 
                        '<div style="text-align: center; color: red; padding: 50px;">Error creating visualization: ' + error.message + '</div>';
                });
        } catch (error) {
            console.error('JavaScript error:', error);
            document.getElementById('plotDiv').innerHTML = 
                '<div style="text-align: center; color: red; padding: 50px;">Error loading visualization data</div>';
        }
    </script>
</body>
</html>`;

    fs.writeFileSync(filepath, html);

    return {
      type: 'plot',
      format: 'html',
      filepath: filepath,
      filename: outputFilename,
      url: `/visualizations/${outputFilename}`
    };
  }

  aggregateData(data, groupColumn, valueColumn = null) {
    const groups = {};
    
    data.forEach(row => {
      const key = row[groupColumn] || 'Unknown';
      if (!groups[key]) {
        groups[key] = { count: 0, sum: 0, values: [] };
      }
      groups[key].count++;
      
      if (valueColumn && !isNaN(parseFloat(row[valueColumn]))) {
        const value = parseFloat(row[valueColumn]);
        groups[key].sum += value;
        groups[key].values.push(value);
      }
    });

    const labels = Object.keys(groups);
    const values = labels.map(label => {
      if (valueColumn) {
        return groups[label].values.length > 0 
          ? groups[label].sum / groups[label].values.length 
          : 0;
      }
      return groups[label].count;
    });

    return { labels, values };
  }

  getVisualizationURL(filename) {
    return `/visualizations/${filename}`;
  }

  listVisualizations() {
    try {
      const files = fs.readdirSync(this.outputDir);
      return files
        .filter(file => file.endsWith('.html'))
        .map(file => ({
          filename: file,
          url: this.getVisualizationURL(file),
          created: fs.statSync(path.join(this.outputDir, file)).mtime
        }))
        .sort((a, b) => b.created - a.created);
    } catch (error) {
      console.error('Error listing visualizations:', error);
      return [];
    }
  }

  deleteVisualization(filename) {
    try {
      const filepath = path.join(this.outputDir, filename);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting visualization:', error);
      return false;
    }
  }
}