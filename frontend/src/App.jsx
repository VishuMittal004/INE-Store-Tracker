import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import SearchProduct from './components/SearchProduct';
import ProductDashboardModal from './components/ProductDashboardModal';
import { getTrackedProducts, trackProduct, stopTracking, getAlerts, markAlertRead } from './services/api';
import './App.css';

function App() {
  const [trackedProducts, setTrackedProducts] = useState([]);
  const [isFetching, setIsFetching] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Alerts state
  const [alerts, setAlerts] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const alertsRef = useRef(null);

  // Load data on initial render
  useEffect(() => {
    loadTrackedProducts();
    loadAlerts();

    // Poll for alerts every 30 seconds
    const intervalId = setInterval(loadAlerts, 30000);

    // Click outside listener
    const handleClickOutside = (event) => {
      if (alertsRef.current && !alertsRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const loadAlerts = async () => {
    const data = await getAlerts();
    setAlerts(data);
  };

  const loadTrackedProducts = async () => {
    setIsFetching(true);
    const data = await getTrackedProducts();
    setTrackedProducts(data);
    setIsFetching(false);
  };

  const handleTrackProduct = async (product) => {
    try {
      await trackProduct(product);
      alert(`${product.name} is now being tracked!`);
      await loadTrackedProducts();
    } catch (error) {
      alert(`Error tracking product: ${error.message}`);
    }
  };

  const handleStopTracking = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to stop tracking this product?")) return;

    try {
      await stopTracking(id);
      await loadTrackedProducts();
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleAlertClick = async (alertId) => {
    await markAlertRead(alertId);
    setAlerts(alerts.filter(a => a.id !== alertId)); // Remove locally to feel instant
  };

  return (
    <div>
      <header className="app-header-container">
        <div className="app-header">
          <div className="logo-section">
            {/* <div className="logo-icon"></div> */}
            <h1 className="serif">INE Store Tracker</h1>
          </div>

          <div className="alerts-container" ref={alertsRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '20px' }}>
            {/* <div className="header-motto serif">Everyday goods, honestly priced.</div> */}
            <button
              className="btn"
              onClick={() => setShowDropdown(!showDropdown)}
              style={{ position: 'relative', outline: 'none' }}
            >
              <Bell size={20} color="#111111" />
              {alerts.length > 0 && (
                <span style={{ position: 'absolute', top: '-5px', right: '-8px', background: '#000', color: '#fff', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 'bold' }}>
                  {alerts.length}
                </span>
              )}
            </button>

            {showDropdown && (
              <div className="alerts-dropdown" style={{ position: 'absolute', top: '35px', right: '0', width: '320px', padding: '15px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '400px', overflowY: 'auto', overscrollBehavior: 'contain' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h3 className="sans" style={{ margin: '0', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Notifications</h3>
                  {alerts.length > 0 && (
                    <button 
                      onClick={() => {
                        // 1. Capture the IDs we need to clear
                        const idsToClear = alerts.map(a => a.id);
                        // 2. Optimistic UI update: instantly clear the panel!
                        setAlerts([]);
                        // 3. Process the backend requests silently in the background
                        idsToClear.forEach(id => markAlertRead(id).catch(console.error));
                      }} 
                      style={{ background: 'none', border: 'none', color: '#999', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                    >
                      Dismiss all
                    </button>
                  )}
                </div>
                {alerts.length === 0 ? (
                  <p style={{ color: '#999', fontSize: '13px', margin: 0 }}>No new alerts.</p>
                ) : (
                  alerts.map(a => (
                    <div key={a.id} className="alert-item" style={{ cursor: 'default' }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: '13px', fontWeight: '500' }}>{a.message}</p>
                          <small
                            style={{ color: '#999', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAlertClick(a.id);
                            }}
                          >
                            Click to dismiss
                          </small>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <hr className="divider-full" />

      <div className="app-container">
        <main className="app-main">
          <div className="page-title-section">
            <h2 className="serif">All tracked products</h2>
            <p className="sans">{trackedProducts.length} products are being monitored. Prices are shown on each product's page.</p>
            <hr className="title-divider" />
          </div>

          <SearchProduct onTrackProduct={handleTrackProduct} />
          <br />

          {isFetching ? (
            <p className="sans">Loading...</p>
          ) : trackedProducts.length === 0 ? (
            <p className="sans" style={{ textAlign: 'center', margin: '3rem 0', color: '#999' }}>You aren't tracking any products yet. Search above to get started!</p>
          ) : (
            <div className="dashboard-grid">
              {trackedProducts.map(p => (
                <div key={p.id} className="tracked-item">
                  <div className="tracked-info" onClick={() => setSelectedProduct(p)} style={{ cursor: 'pointer' }}>
                    <div className="category-label">{p.image_url || 'PRODUCT'}</div>
                    <div className="product-name serif">
                      {p.name}
                    </div>
                    <div className="product-subname sans">Tracked Item</div>
                    <div className="product-sku sans">SKU-INE-{String(p.external_product_id).padStart(8, '0')}</div>

                    <div className="tracked-price-preview" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                      <span className="price-tag serif">₹{p.current_price?.toLocaleString() || 'N/A'}</span>
                      <span style={{ fontSize: '12px', color: '#000000ff', paddingBottom: '3px' }}>(click anywhere to see logs)</span>
                    </div>
                  </div>
                  <div className="card-action">
                    <button className="btn action-btn" onClick={(e) => handleStopTracking(p.id, e)}>
                      STOP TRACKING &rarr;
                    </button>
                    <a href={p.product_url} target="_blank" rel="noopener noreferrer" className="btn action-btn" onClick={e => e.stopPropagation()}>
                      VIEW IN STORE &rarr;
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        <ProductDashboardModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      </div>
    </div>
  );
}

export default App;
