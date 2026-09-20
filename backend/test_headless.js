const { chromium } = require('playwright');

(async () => {
    console.log("Launching headless browser...");
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1920, height: 1080 });

    try {
        console.log("Loading page...");
        await page.goto('https://demo.inelabteamdev.com/product/54', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000);

        console.log("Checking image...");
        const image = page.locator('.product-image-container, img.w-full.h-full.object-cover').first();
        if (await image.isVisible()) {
            console.log("Image is visible. Hovering...");
            await image.hover();
            await page.waitForTimeout(2000);
        } else {
            console.log("Image is NOT visible!");
            // Try scrolling to it?
            await image.scrollIntoViewIfNeeded();
            if (await image.isVisible()) {
                console.log("Image visible after scroll. Hovering...");
                await image.hover();
                await page.waitForTimeout(2000);
            }
        }

        console.log("Checking button...");
        const btn = page.locator('button[aria-label="Reveal price"]');
        const isDisabled = await btn.evaluate(node => node.disabled);
        console.log(`Button disabled state: ${isDisabled}`);

        if (!isDisabled) {
            console.log("Clicking button...");
            await btn.click({ timeout: 3000 });
            await page.waitForTimeout(2000);
            const priceText = await page.locator('.price-block').innerText();
            console.log("Price text:", priceText);
        } else {
            console.log("Button is still disabled! Anti-bot bypassed failed.");
        }

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
})();
