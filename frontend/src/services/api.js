// A centralized place for all our API calls to the backend
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export async function searchProducts(query) {
    if (!query) return [];
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/products/search?q=${encodeURIComponent(query)}`);
        
        if (!response.ok) {
            throw new Error('Failed to search products');
        }
        
        return await response.json();
    } catch (error) {
        console.error("Search API error:", error);
        return []; // Return empty array on failure instead of crashing
    }
}

export async function getTrackedProducts() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/tracked-products`);
        if (!response.ok) throw new Error('Failed to fetch tracked products');
        return await response.json();
    } catch (error) {
        console.error("Fetch tracked products error:", error);
        return [];
    }
}

export async function trackProduct(product) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/tracked-products`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                external_product_id: product.external_product_id,
                name: product.name,
                product_url: product.product_url,
                image_url: product.category || 'PRODUCT'
            })
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to track product');
        }
        
        return await response.json();
    } catch (error) {
        console.error("Track product error:", error);
        throw error;
    }
}

export async function stopTracking(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/tracked-products/${id}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('Failed to stop tracking');
        return true;
    } catch (error) {
        console.error("Stop tracking error:", error);
        throw error;
    }
}

export async function getProductHistory(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/tracked-products/${id}/history`);
        if (!response.ok) throw new Error('Failed to fetch product history');
        return await response.json();
    } catch (error) {
        console.error("Fetch history error:", error);
        return [];
    }
}

export async function getProductLogs(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/tracked-products/${id}/logs`);
        if (!response.ok) throw new Error('Failed to fetch product logs');
        return await response.json();
    } catch (error) {
        console.error("Fetch logs error:", error);
        return [];
    }
}

export async function getAlerts() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/tracked-products/alerts`);
        if (!response.ok) throw new Error('Failed to fetch alerts');
        return await response.json();
    } catch (error) {
        console.error("Fetch alerts error:", error);
        return [];
    }
}

export async function markAlertRead(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/tracked-products/alerts/${id}/read`, {
            method: 'POST'
        });
        if (!response.ok) throw new Error('Failed to mark alert as read');
        return true;
    } catch (error) {
        console.error("Mark alert read error:", error);
        return false;
    }
}
