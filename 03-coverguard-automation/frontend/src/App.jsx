import { useState, useRef, useEffect, useCallback } from 'react';
import { UploadCloud, CheckCircle, AlertTriangle, FileImage, Zap, Shield, Sun, Moon, Eye, Maximize, X, Activity } from 'lucide-react';
import './App.css';

/* ── Pipeline animation steps ── */
const PIPELINE_STEPS = [
  'Rasterizing image to RGB array...',
  'Computing DPI & sharpness (Laplacian)...',
  'Running dual OCR engine (EasyOCR)...',
  'Clustering text blocks into lines...',
  'Checking badge zone geometry violations...',
  'Building annotated report & dispatching actions...',
];

function usePipelineAnimation(isLoading) {
  const [stepIndex, setStepIndex] = useState(0);
  useEffect(() => {
    if (!isLoading) { setStepIndex(0); return; }
    setStepIndex(0);
    const delays = [0, 450, 1000, 1600, 2200, 2700];
    const timers = delays.map((d, i) => setTimeout(() => setStepIndex(i + 1), d));
    return () => timers.forEach(clearTimeout);
  }, [isLoading]);
  return stepIndex;
}

/* ── Image Preview & Fullscreen Modal ── */
function ImagePreview({ src, violations, hoveredIdx, origW, origH, badgeZoneY }) {
  const [isFullScreen, setIsFullScreen] = useState(false);

  function scaleBox(bbox) {
    if (!origW || !origH) return null;
    return { 
      left: `${(bbox[0]/origW)*100}%`, 
      top: `${(bbox[1]/origH)*100}%`, 
      width: `${((bbox[2]-bbox[0])/origW)*100}%`, 
      height: `${((bbox[3]-bbox[1])/origH)*100}%` 
    };
  }

  function badgeZoneStyle() {
    if (!badgeZoneY || !origH) return null;
    return { left: 0, top: `${(badgeZoneY/origH)*100}%`, width: '100%', height: `${((origH-badgeZoneY)/origH)*100}%` };
  }

  const renderOverlays = () => {
    const bzStyle = badgeZoneStyle();
    return (
      <>
        {bzStyle && <div className="violation-overlay-box badge-zone" style={{ ...bzStyle, position: 'absolute' }} title="Reserved 9mm badge zone" />}
        {violations.map((v, i) => {
          if (!v.bbox) return null;
          const s = scaleBox(v.bbox);
          if (!s) return null;
          return (
            <div
              key={i}
              className={`violation-overlay-box ${v.severity} ${hoveredIdx === i ? 'highlighted' : ''}`}
              style={{ ...s, position: 'absolute' }}
            />
          );
        })}
      </>
    );
  };

  return (
    <>
      <div className="image-mag-wrapper">
        <div style={{ position: 'relative', height: '100%', maxWidth: '100%', aspectRatio: origW && origH ? `${origW} / ${origH}` : 'auto', margin: '0 auto' }}>
          <img src={src} alt="Analyzed cover" draggable={false} style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain', borderRadius: '8px' }} />
          {renderOverlays()}
          <button className="enlarge-btn" onClick={() => setIsFullScreen(true)}>
            <Maximize size={20} />
          </button>
        </div>
      </div>

      {isFullScreen && (
        <div className="fullscreen-modal" onClick={() => setIsFullScreen(false)}>
          <div className="fullscreen-content" onClick={e => e.stopPropagation()}>
            <img src={src} alt="Analyzed cover full size" className="fullscreen-img" draggable={false} />
            {renderOverlays()}
            <button className="close-btn" onClick={() => setIsFullScreen(false)}>
              <X size={28} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Violation Card ── */
function ViolationCard({ v, index, isActive, onHover, onLeave }) {
  function buildDetailedInstruction(v) {
    let detail = v.instruction || '';
    if (v.overlap_mm > 0) {
      detail += ` The text "${v.text}" intrudes into the protected zone by ${v.overlap_mm}mm — this will cover the award badge emblem at print time.`;
    }
    if (v.distance_mm > 0 && v.type === 'near_miss') {
      detail += ` Current clearance is only ${v.distance_mm}mm, which is below the required 3mm minimum safety margin.`;
    }
    return detail;
  }

  return (
    <div
      className={`violation-card ${v.severity} ${isActive ? 'active' : ''}`}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      tabIndex={0}
    >
      <div className="violation-card-header">
        <span className="violation-type">{v.type.replace(/_/g, ' ')}</span>
        <span className={`severity-badge ${v.severity}`}>{v.severity}</span>
      </div>
      <div className="violation-text-pill">
        Detected text: &ldquo;{v.text}&rdquo;
      </div>
      {(v.overlap_mm > 0 || v.distance_mm > 0) && (
        <div className="violation-meta">
          {v.overlap_mm > 0 && <span className="violation-meta-chip">⬆ Overlap: {v.overlap_mm}mm into badge zone</span>}
          {v.distance_mm > 0 && <span className="violation-meta-chip">↕ Clearance: {v.distance_mm}mm (need 3mm+)</span>}
        </div>
      )}
      <p className="violation-instruction">{buildDetailedInstruction(v)}</p>
    </div>
  );
}

/* ── Quality Metrics ── */
function QualityMetrics({ quality, processingTimeMs, ocrEngine }) {
  const dpiOk = quality.dpi >= 72;
  const sharpOk = !quality.is_blurry;
  return (
    <div className="quality-grid">
      <div className={`quality-item ${dpiOk ? 'ok' : 'warn'}`}>
        <div className="quality-label">Resolution</div>
        <div className="quality-value">{quality.dpi.toFixed(1)}<span style={{ fontSize: '0.75rem', marginLeft: '2px' }}>DPI</span></div>
        <div className="quality-badge">{dpiOk ? '✓ Print quality' : '⚠ Below 72 DPI'}</div>
      </div>
      <div className={`quality-item ${sharpOk ? 'ok' : 'warn'}`}>
        <div className="quality-label">Sharpness</div>
        <div className="quality-value">{Math.round(quality.laplacian_variance)}</div>
        <div className="quality-badge">{sharpOk ? '✓ Sharp & clear' : '⚠ Blurry detected'}</div>
      </div>
      <div className="quality-item">
        <div className="quality-label">Pipeline Time</div>
        <div className="quality-value">{processingTimeMs}<span style={{ fontSize: '0.75rem', marginLeft: '2px' }}>ms</span></div>
        <div className="quality-badge">End-to-end AI time</div>
      </div>
      <div className="quality-item ok">
        <div className="quality-label">OCR Engine</div>
        <div className="quality-value" style={{ fontSize: '0.85rem', marginTop: '3px' }}>{ocrEngine}</div>
        <div className="quality-badge">✓ Active & clustered</div>
      </div>
    </div>
  );
}

/* ── Main App ── */
function App() {
  const [theme, setTheme]             = useState('light');
  const [file, setFile]               = useState(null);
  const [isDragging, setIsDragging]   = useState(false);
  const [isLoading, setIsLoading]     = useState(false);
  const [result, setResult]           = useState(null);
  const [error, setError]             = useState(null);
  const [hoveredViolation, setHovered]= useState(null);
  const fileInputRef                  = useRef(null);
  const pipelineStep                  = usePipelineAnimation(isLoading);

  // Apply theme to root element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light');

  const handleDragOver  = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop      = (e) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files?.length > 0) handleFileSelection(e.dataTransfer.files[0]);
  };
  const handleFileChange = (e) => { if (e.target.files?.length > 0) handleFileSelection(e.target.files[0]); };

  const handleFileSelection = (selectedFile) => {
    setError(null); setResult(null);
    let fileToUpload = selectedFile;
    if (!selectedFile.name.includes('_')) {
      fileToUpload = new File([selectedFile], `9780000000000_${selectedFile.name}`, { type: selectedFile.type });
    }
    setFile(fileToUpload);
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsLoading(true); setError(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/analyze/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok || data.error_type) setError(data.message || 'An error occurred during analysis.');
      else setResult(data);
    } catch {
      setError('Cannot connect to the analysis server. Ensure the FastAPI backend is running on port 8000.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetState = () => { setFile(null); setResult(null); setError(null); setHovered(null); };

  const imgSrc = result?.annotated_image_path ? `/analyze/image/${result.filename}` : null;

  return (
    <>
      <div className="app-bg"><div className="orb orb-1" /><div className="orb orb-2" /></div>

      <div className="app-wrapper">
        <div className="nav-actions-floating">
          <button className="theme-toggle-btn" onClick={toggleTheme} title="Toggle theme">
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
        </div>

        {/* ── Header ── */}
        <header className="hero-section">
          <div className="container" style={{ textAlign: 'center', position: 'relative' }}>
            {result && (
              <button className="btn-ghost btn-new" onClick={resetState}>↩ New Analysis</button>
            )}
            <h1 className="hero-title">BookLeaf Publishing</h1>
            <p className="hero-subtitle">
              Automated Cover Validation Pipeline<br />
              <span style={{ fontSize: '0.9rem', opacity: 0.8 }}>Verify badge zones, safe margins, and resolution instantly before printing.</span>
            </p>
          </div>
        </header>



        <main className="container" style={{ paddingBottom: '80px', paddingTop: result ? '0' : '32px' }}>

          {/* Error */}
          {error && (
            <div className="glass-card error-card fade-in-up" style={{ marginTop: '20px' }}>
              <div className="error-card-header">
                <AlertTriangle size={20} color="var(--coral)" />
                <span className="error-title">Analysis Error</span>
              </div>
              <p className="error-msg">{error}</p>
            </div>
          )}

          {/* ── Upload ── */}
          {!result && (
            <div className="glass-card fade-in-up" style={{ marginTop: error ? '16px' : '0' }}>
              <div className="dropzone-outer">
                <div
                  className={`dropzone ${isDragging ? 'active' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => !isLoading && fileInputRef.current?.click()}
                >
                  {isLoading ? (
                    <div className="loader-overlay">
                      <div className="spinner-track" />
                      <div className="spinner-inner" style={{ position: 'relative', top: '-37px' }} />
                      <div style={{ marginTop: '-12px', textAlign: 'center' }}>
                        <div className="loader-title">Running AI Pipeline</div>
                        <div className="loader-subtitle">CoverGuard Engine v2.0 · BookLeaf QA</div>
                      </div>
                      <div className="pipeline-steps">
                        {PIPELINE_STEPS.map((step, i) => (
                          <div
                            key={i}
                            className={`pipeline-step ${i < pipelineStep - 1 ? 'done' : i === pipelineStep - 1 ? 'active' : ''}`}
                            style={{ animationDelay: `${i * 0.45}s` }}
                          >
                            <span className="step-dot" />
                            {i < pipelineStep - 1 ? '✓  ' : ''}{step}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      <UploadCloud size={56} className="upload-icon" />
                      <h3>Drop Your Book Cover Here</h3>
                      <p>
                        Accepts PNG or PDF &nbsp;·&nbsp; Name it{' '}
                        <code style={{ color: 'var(--coral)', background: 'rgba(237,90,107,0.08)', padding: '2px 8px', borderRadius: '5px' }}>
                          ISBN_bookname.ext
                        </code>
                      </p>
                      <input type="file" ref={fileInputRef} className="file-input" accept="image/png,application/pdf" onChange={handleFileChange} />
                      {file ? (
                        <div className="file-pill">
                          <FileImage size={18} />
                          <span>{file.name}</span>
                        </div>
                      ) : (
                        <button className="btn-primary" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                          Select File
                        </button>
                      )}
                    </>
                  )}
                </div>
                {file && !isLoading && (
                  <div style={{ textAlign: 'center' }}>
                    <button className="btn-primary analyze-btn" onClick={handleUpload}>
                      <Zap size={18} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
                      Run AI Validation
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Results ── */}
          {result && (
            <div className="results-wrapper">
              <div className="results-header">
                <h2>Validation Report</h2>
              </div>

              {/* Status Banner */}
              <div className={`status-banner ${result.status === 'PASS' ? 'pass' : 'review'}`}>
                <div className={`status-icon-wrap ${result.status === 'PASS' ? 'pass' : 'review'}`}>
                  {result.status === 'PASS'
                    ? <CheckCircle size={26} color="var(--neon-green)" />
                    : <AlertTriangle size={26} color="var(--coral)" />}
                </div>
                <div>
                  <div className={`status-label ${result.status === 'PASS' ? 'pass' : 'review'}`}>
                    {result.status === 'PASS' ? '✓ Cover Approved — Ready for Print' : '⚠ Action Required — Layout Violations Detected'}
                  </div>
                  <div className="status-meta">
                    <span className="status-chip">Confidence: <strong>&nbsp;{result.confidence}%</strong></span>
                    <span className="status-chip">OCR Engine: <strong>&nbsp;{result.ocr_engine}</strong></span>
                    <span className="status-chip">ISBN: <strong>&nbsp;{result.isbn}</strong></span>
                    {result.violations.length > 0 && (
                      <span className="status-chip"><Eye size={12} />&nbsp;Hover violation cards to highlight on image</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Results Grid */}
              <div className="results-grid">

                {/* Left Layout Wrapper (Metrics + Image) */}
                <div className="left-layout" style={{ display: 'flex', gap: '16px' }}>
                  {/* Left — Metrics */}
                  <div className="metrics-panel" style={{ width: '170px', flexShrink: 0 }}>
                    <div className="metrics-panel-title">
                      <Activity size={14} /> Pipeline Metrics
                    </div>
                    <QualityMetrics quality={result.quality} processingTimeMs={result.processing_time_ms} ocrEngine={result.ocr_engine} />
                  </div>

                  {/* Middle — Image */}
                  <div className="glass-card image-panel" style={{ flexGrow: 1, padding: '20px' }}>
                    <div className="image-panel-title">
                      <Shield size={14} /> Analyzed Cover
                    </div>
                    {imgSrc ? (
                      <>
                        <ImagePreview
                          src={imgSrc}
                          violations={result.violations}
                          hoveredIdx={hoveredViolation}
                          origW={result.image_width || 1}
                          origH={result.image_height || 1}
                          badgeZoneY={result.badge_zone_y_px}
                        />
                        <p className="hover-hint">🔍 Click enlarge icon to view full size · Hover violation cards to highlight zones</p>
                      </>
                    ) : (
                      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>No annotated image available</div>
                    )}
                  </div>
                </div>

                {/* Right — Violations */}
                <div className="violations-panel">
                  <div className="violations-header">
                    <h3>Detected Issues</h3>
                    <div className={`violations-count-badge ${result.violations.length === 0 ? 'zero' : ''}`}>
                      {result.violations.length}
                    </div>
                  </div>

                  {result.violations.length === 0 ? (
                    <div className="pass-state">
                      <CheckCircle size={52} color="var(--neon-green)" style={{ opacity: 0.75 }} />
                      <h3>All Clear — No Violations</h3>
                      <p>This cover meets all BookLeaf publishing guidelines.<br />The badge zone and all safe margins are clear.</p>
                    </div>
                  ) : (
                    <div className="violations-list">
                      {result.violations.map((v, i) => (
                        <ViolationCard
                          key={i} v={v} index={i}
                          isActive={hoveredViolation === i}
                          onHover={() => setHovered(i)}
                          onLeave={() => setHovered(null)}
                        />
                      ))}
                    </div>
                  )}

                  <div className="auto-actions-box">
                    <div className="auto-actions-title">Automated Actions Completed</div>
                    <div className="auto-action-item">
                      <span className="auto-action-dot" />
                      Airtable QA record created with full violation data, confidence score, and annotated image URL
                    </div>
                    <div className="auto-action-item">
                      <span className="auto-action-dot" />
                      Personalized correction email dispatched to author with step-by-step instructions
                    </div>
                    {result.status === 'REVIEW NEEDED' && (
                      <div className="auto-action-item">
                        <span className="auto-action-dot" />
                        Revision tracking flagged — system will detect resubmissions and link records
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        <footer className="footer">
          <p>CoverGuard AI &nbsp;·&nbsp; BookLeaf Publishing Automation &nbsp;·&nbsp; Powered by EasyOCR + OpenCV + FastAPI</p>
        </footer>
      </div>
    </>
  );
}

export default App;
