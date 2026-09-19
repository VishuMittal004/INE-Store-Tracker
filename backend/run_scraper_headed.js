const { launchBrowser } = require('./src/scraper/browser');
const { scrapeProduct } = require('./src/scraper/productScraper');

async function run() {
    console.log("Launching browser (Headed mode)...");
    const browser = await launchBrowser(true);
    const page = await browser.newPage();
    
    try {
        console.log("Starting scraper on product 154...");
        const result = await scrapeProduct(page, 'https://demo.inelabteamdev.com/product/154');
        console.log("\n=========================");
        if (result.success) {
            console.log("  EXTRACTION SUCCESS!  ");
            console.log("=========================");
            console.log(result.data);
        } else {
            console.log("  EXTRACTION FAILED!  ");
            console.log("=========================");
            console.log("Error:", result.error);
            console.log("Partial Data:", result.data);
        }
        console.log("=========================\n");
    } catch (e) {
        console.error("Scraper crash:", e.message);
    } finally {
        await browser.close();
    }
}

run();
