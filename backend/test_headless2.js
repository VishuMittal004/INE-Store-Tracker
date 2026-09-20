const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    console.log("Launching headless browser...");
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1920, height: 1080 });

    try {
        console.log("Loading page...");
        await page.goto('https://demo.inelabteamdev.com/product/54', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000);

        const html = await page.content();
        fs.writeFileSync('page_dump.html', html);
        console.log("Dumped to page_dump.html");

        // Try to find image by tag
        const images = await page.locator('img').count();
        console.log(`Found ${images} images.`);
        
        const container = page.locator('.product-image-container');
        console.log(`Container count: ${await container.count()}`);

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
})();
