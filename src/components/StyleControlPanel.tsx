import React from 'react';
import { color_scale } from '../data_functions/data';
// Define the style configuration interface
export interface StyleConfig {
  strokeBy: string;
  fillBy: string;
  strokePallette: string;
  fillPallette: string;
  strokeWeight: number;
  fillOpacity: number;
  schoolType: string; 
  schoolCategory: string;
  mapType: string;
}

interface StyleControlPanelProps {
  styleConfig: StyleConfig;
  onStyleChange: (styleConfig: StyleConfig) => void;
  columnNames?: string[];
}

const StyleControlPanel: React.FC<StyleControlPanelProps> = ({styleConfig, 
                                                              onStyleChange,
                                                              columnNames = ['Constant', 'FCI', 'Utilization']}) => {
  // Helper function to handle style changes
  const handleSchoolTypeChange = (value: string) => {
    console.log(value);
    onStyleChange({ ...styleConfig, schoolType: value });
  };
  
  const handleSchoolCategoryChange = (value: string) => {
    console.log(value);
    onStyleChange({ ...styleConfig, schoolCategory: value });
  };

  const handleStyleChange = (key: string, value: string) => {
    onStyleChange({ ...styleConfig, [key]: value });
    
  };

  const handleStrokeByChange = (value: string) => {
    onStyleChange({ ...styleConfig, strokeBy: value });
  };

  const handleFillByChange = (value: string) => {
    onStyleChange({ ...styleConfig, fillBy: value });
  };

  const handleMapTypeChange = (value: string) => {
    onStyleChange({ ...styleConfig, mapType: value });
  };


  return (
    <div className="style-control-panel">
      <h3>Map Style Controls</h3>
      <div className="Options">
        <select id="school-type"
            value={styleConfig.schoolType}
            onChange={(e) => handleSchoolTypeChange(e.target.value)}
        >
          <option value="Secondary">Secondary Schools</option>
          <option value="Elementary">Elementary Schools</option>
          <option value="Middle">Middle Schools</option>
          {/* <option value="Default">Default Style</option> */}
        </select>
        <select id="school-category"
            value={styleConfig.schoolCategory}
            onChange={(e) => handleSchoolCategoryChange(e.target.value)}
        >
            <option value="Public">Public</option>
            <option value="Francophone">Francophone</option>
            <option value="Private">Private</option>
        </select>
        <select id="map-type"
            value={styleConfig.mapType}
            onChange={(e) => handleMapTypeChange(e.target.value)}
        >
            <option value="street">Street Map</option>
            <option value="satellite">Satellite</option>
            <option value="topographic">Topographic</option>
            <option value="terrain">Terrain</option>
            <option value="hybrid">Hybrid</option>
        </select>
      </div>
      <div className="style-section">
        <h4>{styleConfig.schoolType + " " + styleConfig.schoolCategory}</h4>
        <div className="style-input-group">
          <label>
            Stroke Color By:
            <select id="stroke-by"
            value={styleConfig.strokeBy}
            onChange={(e) => handleStrokeByChange(e.target.value)}
        >
            {columnNames.map((columnName) => (
                <option key={columnName} value={columnName}>{columnName}</option>
            ))}
        </select>
          
          </label>
          <label>
            Stroke Pallette:
            <select id="stroke-pallette"
            value={styleConfig.strokePallette}
            onChange={(e) => handleStyleChange('strokePallette', e.target.value)}
            >
              {Object.keys(color_scale).map((scale) => (
                <option key={scale} value={scale}>{scale}</option>
              ))}
            </select>
          </label>
          <label>
            Stroke Weight:
            <input
              type="range"
              min="1"
              max="10"
              value={styleConfig.strokeWeight}
              onChange={(e) => handleStyleChange('strokeWeight', e.target.value)}
            />
            <span>{styleConfig.strokeWeight}px</span>
          </label>
          <label>
            Fill Color By:
            <select id="fill-by"
            value={styleConfig.fillBy}
            onChange={(e) => handleFillByChange(e.target.value)}
            >
                {columnNames.map((columnName) => (
                    <option key={columnName} value={columnName}>{columnName}</option>
                ))}
            </select>
          </label>
          <label>
            Fill Pallette:
            <select id="fill-pallette"
            value={styleConfig.fillPallette}
            onChange={(e) => handleStyleChange('fillPallette', e.target.value)}
            >
                {Object.keys(color_scale).map((scale) => (
                    <option key={scale} value={scale}>{scale}</option>
                ))}
            </select>
          </label>
          <label>
            Fill Opacity:
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={styleConfig.fillOpacity}
              onChange={(e) => handleStyleChange('fillOpacity', e.target.value)}
            />
            <span>{styleConfig.fillOpacity}</span>
          </label>
        </div>
      </div>
    </div>
  );
};

export default StyleControlPanel; 