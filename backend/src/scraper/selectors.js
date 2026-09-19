// Centralized selectors so if the mock store changes, we only update here
module.exports = {
    priceBox: '.price-box', // Area to hover
    revealBtn: '.reveal-btn, .price-reveal', // Button that appears to reveal price
    priceAmount: '.price-amount', // The actual price text
    stockStatus: '.stock-status, .availability', // In-stock or out-of-stock text
    productTitle: '.product-title'
};
