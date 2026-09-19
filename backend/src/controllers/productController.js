const searchService = require('../services/searchService');

async function searchProducts(req, res) {
    try {
        const query = req.query.q;
        
        if (!query) {
            // Use 400 Bad Request if the query is missing
            return res.status(400).json({ error: 'Search query is required' });
        }
        
        const results = await searchService.searchMockStore(query);
        res.json(results);
    } catch (error) {
        console.error('Error in searchProducts controller:', error);
        res.status(500).json({ error: 'Failed to search products' });
    }
}

module.exports = {
    searchProducts
};
