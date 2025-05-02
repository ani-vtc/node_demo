import React from 'react';

// Define the style configuration interface
export interface StyleConfig {
  colorBy: string;
  strokeColor: string;
  strokeWeight: number;
  fillColor: string;
  fillOpacity: number;
  schoolType: string; 
  schoolCategory: string;
}

interface StyleControlPanelProps {
  styleConfig: StyleConfig;
  onStyleChange: (styleConfig: StyleConfig) => void;
}

const StyleControlPanel: React.FC<StyleControlPanelProps> = ({ styleConfig, onStyleChange }) => {
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

  const handleColorByChange = (value: string) => {
    onStyleChange({ ...styleConfig, colorBy: value });
  };

  return (
    <div className="style-control-panel">
      <h3>Map Style Controls</h3>
      <div className="Options">
        <select id="color-by"
            onChange={(e) => handleColorByChange(e.target.value)}
        >
            <option value="Constant">Constant</option>
            <option value="FCI">FCI</option>
            <option value="Utilization">Utilization</option>
        </select>
        <select id="school-type"
            onChange={(e) => handleSchoolTypeChange(e.target.value)}
        >
          <option value="Secondary">Secondary Schools</option>
          <option value="Elementary">Elementary Schools</option>
          <option value="Middle">Middle Schools</option>
          {/* <option value="Default">Default Style</option> */}
        </select>
        <select id="school-category"
            onChange={(e) => handleSchoolCategoryChange(e.target.value)}
        >
            <option value="Public">Public</option>
            <option value="Francophone">Francophone</option>
            <option value="Private">Private</option>
        </select>
      </div>
      <div className="style-section">
        <h4>{styleConfig.schoolType + " " + styleConfig.schoolCategory}</h4>
        <div className="style-input-group">
          <label>
            Stroke Color:
            <input
              type="color"
              value={styleConfig.strokeColor}
              onChange={(e) => handleStyleChange('strokeColor', e.target.value)}
            />
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
            Fill Color:
            <input
              type="color"
              value={styleConfig.fillColor}
              onChange={(e) => handleStyleChange('fillColor', e.target.value)}
            />
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