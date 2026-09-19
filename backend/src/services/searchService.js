// We search the mock store's catalog endpoint
// We fetch pages one by one until we find enough matches to avoid spamming the mock API
async function searchMockStore(query) {
    const results = [];
    const maxPagesToCheck = 100; // Check up to 100 pages to cover the whole 50 page store
    const queryLower = query.toLowerCase();

    for (let page = 1; page <= maxPagesToCheck; page++) {
        try {
            const response = await fetch(`https://demo.inelabteamdev.com/api/catalog?page=${page}`);
            if (!response.ok) {
                // Sometims the store might return an error, just break out of the loop
                break;
            }
            
            const data = await response.json();
            const items = data.items || [];
            
            // Filter items matching the query in their name
            for (const item of items) {
                if (item.name.toLowerCase().includes(queryLower)) {
                    results.push({
                        id: item.id,
                        external_product_id: item.id.toString(),
                        name: item.name,
                        product_url: `https://demo.inelabteamdev.com/product/${item.id}`,
                        image_url: null, // The API doesn't return images in this list
                        brand: item.brand,
                        category: item.category
                    });
                }
            }
            
            // If we found enough results, we can stop searching to be efficient
            if (results.length >= 10) {
                break;
            }
            
            if (page >= data.pages) {
                break; // No more pages left to search
            }
        } catch (error) {
            console.error("Error searching mock store on page", page, error);
            break;
        }
    }
    
    return results;
}

module.exports = {
    searchMockStore
};
