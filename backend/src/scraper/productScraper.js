const selectors = require('./selectors');

async function scrapeProduct(page, url) {
    try {
        console.log(`Loading page...`);
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000); // hydrate

        // 1. Move mouse far away initially to guarantee onMouseEnter triggers when we move back
        await page.mouse.move(0, 0);
        await page.waitForTimeout(500);

        // 2. Dismiss cookies reliably using evaluate to bypass any overlay issues
        try {
            await page.evaluate(() => {
                document.querySelectorAll('button').forEach(b => {
                    if (b.innerText.toUpperCase().includes('ACCEPT')) b.click();
                });
            });
            await page.waitForTimeout(1000);
        } catch(e) {}

        // 3. Hover over the price block with a large "human" wiggle to guarantee React catches it
        try {
            const box = await page.locator('.price-block').boundingBox();
            if (box) {
                // Wiggle across the box
                for (let i = 0; i < 15; i++) {
                    await page.mouse.move(box.x + 10 + i*10, box.y + 10 + i*10);
                    await page.waitForTimeout(50);
                }
            }
        } catch (e) {}

        // 4. Wait for the Reveal Price button to enable and click it
        try {
            await page.waitForFunction(() => {
                const btn = document.querySelector('button[aria-label="Reveal price"]');
                return btn && !btn.disabled;
            }, { timeout: 4000 });
            
            await page.locator('button[aria-label="Reveal price"]').click({ force: true, timeout: 3000 });
            await page.waitForTimeout(3000); 
        } catch (e) {
            console.log(`Reveal interaction timed out, might be mock store anti-bot.`);
        }

        // 5. Extract ONLY from the price-block area!
        const priceArea = await page.locator('.price-block').innerText().catch(() => '');
        
        // DEFEAT ANTI-BOT 1: Remove zero-width spaces (\u200b) injected between digits
        const cleanPriceArea = priceArea.replace(/\u200b/g, ''); 
        
        // DEFEAT ANTI-BOT 2: Only match numbers directly attached to the Rupee symbol, now allowing spaces
        const rawMatches = cleanPriceArea.match(/₹\s*([\d., \xA0]+)/g);
        let price = null;
        
        if (rawMatches && rawMatches.length > 0) {
            const numbers = rawMatches.map(m => {
                let s = m.replace(/₹\s*/, '').trim();
                
                // DEFEAT ANTI-BOT 3: Handle randomized locale formats (e.g., 18.781,00 vs 19,296 vs 19 100)
                const decimalMatch = s.match(/[.,](\d{2})$/);
                if (decimalMatch) {
                    s = s.slice(0, -3).replace(/[., \xA0]/g, '') + '.' + decimalMatch[1];
                } else {
                    s = s.replace(/[., \xA0]/g, '');
                }
                return parseFloat(s);
            }); 
            
            // Validation: Ensure the click succeeded by checking if multiple prices loaded
            if (numbers.length >= 2) {
                price = Math.min(...numbers); // Grab the absolute lowest price
            } else {
                console.log(`Validation failed: Found ${numbers.length} price(s). Mock store click ignored.`);
            }
        }

        const nameText = await page.locator('h1').textContent().catch(() => null);
        const bodyText = await page.innerText('body').catch(() => '');
        const stock = !bodyText.toLowerCase().includes('out of stock');

        // If price is NOT null, we succeeded!
        if (price !== null) {
            return {
                success: true,
                data: {
                    name: nameText ? nameText.trim() : 'Unknown Product',
                    price: price,
                    stock: stock
                }
            };
        }
        
        // If price is null, we failed the anti-bot check
        return {
            success: false,
            error: 'Anti-bot blocked reveal or hover failed',
            data: { name: nameText ? nameText.trim() : 'Unknown Product', price: null, stock: false }
        };

    } catch (e) {
        return {
            success: false,
            error: e.message,
            data: null
        };
    }
}

module.exports = {
    scrapeProduct
};
