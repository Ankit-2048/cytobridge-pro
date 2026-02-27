import { useState } from 'react';
import Plot from 'react-plotly.js';
import './App.css';

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [rawData, setRawData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const [channels, setChannels] = useState(['FSC-A', 'SSC-A']); 
  const [selection, setSelection] = useState({ x: 'FSC-A', y: 'SSC-A', clusters: 3 });
  
  // NEW: State for the autonomous AI toggle
  const [isAutoDetect, setIsAutoDetect] = useState(true); 

  const handleProcess = async () => {
    if (!selectedFile) {
      alert("Please upload an .fcs file first.");
      return;
    }

    setIsLoading(true);
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      // If Auto-Detect is checked, we send 0 to trigger the Elbow Method in Python
      const targetClusters = isAutoDetect ? 0 : selection.clusters;
      const url = `http://localhost:8000/api/v1/auto-gate?n_populations=${targetClusters}&channel_x=${selection.x}&channel_y=${selection.y}`;
      
      const response = await fetch(url, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.error) {
        alert(result.error);
      } else {
        if (result.all_channels) setChannels(result.all_channels);
        setRawData(result.gated_data_sample);
        
        // NEW: If the AI ran in Auto-Detect mode, update the slider to show what it found!
        if (result.auto_detected) {
          setSelection(prev => ({ ...prev, clusters: result.populations_identified }));
        }
        
        const formattedPlotData = formatForPlotly(result.gated_data_sample, selection.x, selection.y);
        setChartData(formattedPlotData);
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Connection failed. Ensure main.py is running!");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!rawData || rawData.length === 0) return;
    const headers = Object.keys(rawData[0]);
    const csvRows = [];
    csvRows.push(headers.join(',')); 
    for (const row of rawData) {
      const values = headers.map(header => row[header]);
      csvRows.push(values.join(','));
    }
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CytoBridge_Gated_Results_${selection.clusters}_Pops.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatForPlotly = (dataSample, xLabel, yLabel) => {
    const traces = {};
    const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#34495e', '#e84393', '#00cec9', '#fdcb6e', '#6c5ce7', '#ff7675', '#a29bfe', '#ffeaa7'];

    dataSample.forEach(cell => {
      const popId = cell.Population_Gate;
      if (!traces[popId]) {
        traces[popId] = {
          x: [], y: [], mode: 'markers', type: 'scattergl',
          name: `Pop ${popId + 1}`,
          marker: { color: colors[popId % colors.length], size: 4, opacity: 0.6 }
        };
      }
      traces[popId].x.push(cell[xLabel]);
      traces[popId].y.push(cell[yLabel]);
    });
    return Object.values(traces);
  };

  return (
    <div style={{ padding: '40px', fontFamily: 'system-ui, sans-serif', maxWidth: '1100px', margin: '0 auto' }}>
      
      <div style={{ borderBottom: '2px solid #eaeaea', paddingBottom: '20px', marginBottom: '30px' }}>
        <h1 style={{ margin: '0', color: '#2c3e50' }}>CytoBridge Pro</h1>
        <p style={{ color: '#7f8c8d' }}>Autonomous ML Gating for High-Throughput Cytometry</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '30px' }}>
        
        {/* Left Column: Controls */}
        <div style={{ backgroundColor: '#f8f9fa', padding: '25px', borderRadius: '12px', border: '1px solid #dee2e6' }}>
          <h3 style={{ marginTop: '0' }}>Configuration</h3>
          
          <label style={{ display: 'block', marginBottom: '15px' }}>
            <strong>1. Select File (.fcs)</strong>
            <input type="file" accept=".fcs" onChange={(e) => setSelectedFile(e.target.files[0])} style={{ display: 'block', marginTop: '5px' }} />
          </label>

          <label style={{ display: 'block', marginBottom: '15px' }}>
            <strong>2. X-Axis Channel</strong>
            <select value={selection.x} onChange={e => setSelection({...selection, x: e.target.value})} style={{ width: '100%', padding: '8px', marginTop: '5px' }}>
              {channels.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>

          <label style={{ display: 'block', marginBottom: '20px' }}>
            <strong>3. Y-Axis Channel</strong>
            <select value={selection.y} onChange={e => setSelection({...selection, y: e.target.value})} style={{ width: '100%', padding: '8px', marginTop: '5px' }}>
              {channels.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>

          {/* NEW: Auto-Detect Toggle */}
          <div style={{ padding: '15px', backgroundColor: '#e8f4f8', borderRadius: '8px', marginBottom: '15px', border: '1px solid #bde0fe' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', margin: 0 }}>
              <input 
                type="checkbox" 
                checked={isAutoDetect} 
                onChange={(e) => setIsAutoDetect(e.target.checked)} 
                style={{ marginRight: '10px', transform: 'scale(1.2)' }}
              />
              <strong style={{ color: '#023e8a' }}>Enable AI Auto-Detect</strong>
            </label>
            <p style={{ margin: '5px 0 0 25px', fontSize: '12px', color: '#0077b6' }}>
              Uses Elbow Method mathematics to find the optimal biological clusters autonomously.
            </p>
          </div>

          {/* UPGRADED: Slider (Disabled when Auto-Detect is on) */}
          <label style={{ display: 'block', marginBottom: '25px', opacity: isAutoDetect ? 0.4 : 1, transition: 'opacity 0.2s' }}>
            <strong>4. Manual Override: {selection.clusters} Populations</strong>
            <input type="range" min="1" max="15" value={selection.clusters} 
                   onChange={e => setSelection({...selection, clusters: parseInt(e.target.value)})} 
                   disabled={isAutoDetect}
                   style={{ width: '100%', marginTop: '5px', cursor: isAutoDetect ? 'not-allowed' : 'pointer' }} />
          </label>

          <button onClick={handleProcess} disabled={isLoading} style={{
            width: '100%', backgroundColor: isLoading ? '#bdc3c7' : '#27ae60', color: 'white',
            border: 'none', padding: '12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold',
            marginBottom: '10px'
          }}>
            {isLoading ? 'Running Mathematical Models...' : 'Run Autonomous Gating'}
          </button>

          {rawData && (
            <button onClick={handleDownload} style={{
              width: '100%', backgroundColor: '#34495e', color: 'white',
              border: 'none', padding: '12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'
            }}>
              ⬇ Download ML-Ready CSV
            </button>
          )}

        </div>

        {/* Right Column: Visualization */}
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #eaeaea', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          {chartData.length > 0 ? (
            <Plot
              data={chartData}
              layout={{ 
                width: 600, height: 500, title: `Clustering: ${selection.x} vs ${selection.y}`,
                xaxis: { title: selection.x }, yaxis: { title: selection.y },
                hovermode: 'closest', margin: { t: 50, b: 50, l: 60, r: 10 }
              }}
              config={{ responsive: true }}
            />
          ) : (
            <div style={{ height: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bdc3c7', textAlign: 'center' }}>
              <p>Upload a data file and click Run <br/> to generate automated gates.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;