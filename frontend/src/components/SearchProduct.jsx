import { useState } from 'react';
import { X } from 'lucide-react';
import { searchProducts } from '../services/api';
import './SearchProduct.css';

export default function SearchProduct({ onTrackProduct }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // Search function when the user submits the form
    const handleSearch = async (e) => {
        e.preventDefault();
        
        if (!query.trim()) return;
        
        setIsLoading(true);
        setError(null);
        
        try {
            const foundItems = await searchProducts(query);
            setResults(foundItems);
            
            if (foundItems.length === 0) {
                setError("No products found matching that name.");
            }
        } catch (err) {
            setError("Something went wrong while searching.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="search-container glass-panel">
            <h2>Find a Product to Track</h2>
            
            <form onSubmit={handleSearch} className="search-form">
                <div className="input-wrapper">
                    <input 
                        type="text" 
                        value={query}
                        onChange={(e) => {
                            const val = e.target.value;
                            setQuery(val);
                            if (!val.trim()) {
                                setResults([]);
                                setError(null);
                            }
                        }}
                        placeholder="E.g. Ironwood Kettle..."
                        className="search-input"
                        disabled={isLoading}
                    />
                    {query && (
                        <button
                            type="button"
                            className="clear-icon"
                            onClick={() => {
                                setQuery('');
                                setResults([]);
                                setError(null);
                            }}
                            disabled={isLoading}
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>
                <button type="submit" className="btn primary-btn" disabled={isLoading || !query.trim()}>
                    {isLoading ? 'Searching...' : 'Search'}
                </button>
            </form>

            {error && <div className="error-message">{error}</div>}

            {results.length > 0 && (
                <div className="results-list">
                    {results.map((product) => (
                        <div key={product.id} className="product-card">
                            <div className="product-info">
                                <h3>{product.name}</h3>
                                <p className="product-brand">{product.brand} - {product.category}</p>
                            </div>
                            <button 
                                className="btn track-btn"
                                onClick={() => onTrackProduct(product)}
                            >
                                Track Price
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
