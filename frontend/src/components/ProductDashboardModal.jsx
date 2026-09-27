import { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getProductHistory, getProductLogs } from '../services/api';
import './ProductDashboardModal.css';

export default function ProductDashboardModal({ product, onClose }) {
  const [history, setHistory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedDates, setExpandedDates] = useState({});

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      const [historyData, logsData] = await Promise.all([
        getProductHistory(product.id),
        getProductLogs(product.id)
      ]);
      
      // Format history data for chart
      const chartData = historyData.map(h => ({
        ...h,
        displayDate: new Date(h.scraped_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      }));

      setHistory(chartData);
      setLogs(logsData);
      
      // By default, expand the most recent date
      if (logsData.length > 0) {
        const mostRecentDate = new Date(logsData[0].started_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
        setExpandedDates({ [mostRecentDate]: true });
      }
      
      setIsLoading(false);
    }
    
    if (product) {
      loadData();
    }
  }, [product]);

  const toggleDate = (date) => {
    setExpandedDates(prev => ({ ...prev, [date]: !prev[date] }));
  };

  const groupedLogs = logs.reduce((acc, log) => {
    const dateStr = new Date(log.started_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(log);
    return acc;
  }, {});

  if (!product) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          <X size={24} color="#111111" />
        </button>

        <div className="modal-header">
          <div className="modal-title-group">
            <h2>{product.name}</h2>
            <p className="modal-price">Current Price: ₹{product.current_price?.toLocaleString() || 'N/A'}</p>
            <p className={`modal-stock ${product.current_stock ? 'in-stock' : 'out-of-stock'}`}>
              {product.current_stock ? 'In Stock' : 'Out of Stock'}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="modal-loading">Loading rich data...</div>
        ) : (
          <div className="modal-body">
            
            <section className="dashboard-section">
              <h3>Price History Over Time</h3>
              <div className="chart-container">
                {history.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={history} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                      <XAxis dataKey="displayDate" stroke="#666666" fontSize={12} tickMargin={10} />
                      <YAxis stroke="#666666" fontSize={12} domain={['auto', 'auto']} tickFormatter={val => `₹${val}`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #111111', borderRadius: '4px', color: '#111111' }}
                        itemStyle={{ color: '#111111', fontWeight: 'bold' }}
                      />
                      {/* Reduced strokeWidth and dot radius to make points much smaller and less clustered */}
                      <Line type="monotone" dataKey="price" stroke="#111111" strokeWidth={2} dot={{ r: 1.5, fill: '#111111' }} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="empty-state">No price history available yet.</p>
                )}
              </div>
            </section>

            <section className="dashboard-section">
              <h3>Honest Scrape Logs (Retries & Failures)</h3>
              <div className="logs-table-container">
                {Object.keys(groupedLogs).length > 0 ? (
                  <table className="logs-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Outcome</th>
                        <th>Attempt</th>
                        <th>Message</th>
                      </tr>
                    </thead>
                    {Object.entries(groupedLogs).map(([dateStr, dateLogs]) => (
                      <tbody key={dateStr}>
                        <tr 
                          className="date-group-header" 
                          onClick={() => toggleDate(dateStr)}
                          style={{ cursor: 'pointer', backgroundColor: '#f9f9f9', borderTop: '2px solid #e5e5e5' }}
                        >
                          <td colSpan="4" style={{ fontWeight: 'bold', padding: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {expandedDates[dateStr] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                              {dateStr} <span style={{ fontWeight: 'normal', color: '#666', fontSize: '0.9em' }}>({dateLogs.length} logs)</span>
                            </div>
                          </td>
                        </tr>
                        {expandedDates[dateStr] && dateLogs.map(log => (
                          <tr key={log.id} className={`log-row log-${log.status}`}>
                            <td>{new Date(log.started_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                            <td>
                              <span className={`status-badge status-${log.status}`}>
                                {log.status.toUpperCase()}
                              </span>
                            </td>
                            <td>{log.attempt_number}/5</td>
                            <td className="log-message">{log.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    ))}
                  </table>
                ) : (
                  <p className="empty-state">No logs recorded yet.</p>
                )}
              </div>
            </section>

          </div>
        )}
      </div>
    </div>
  );
}
