const selectors = require('./selectors');

async function scrapeProduct(page, url) {
    try {
        console.log(`Loading page...`);
        // Set a desktop viewport! In headless mode on Linux, it defaults to a small size which can trigger the mock store's mobile CSS and hide the image!
        await page.setViewportSize({ width: 1920, height: 1080 });
        
        const response = await page.goto(url, { 
            waitUntil: 'domcontentloaded',
            timeout: 60000 
        });
        
        const httpCode = response ? response.status() : null;
        const retryAfter = response ? response.headers()['retry-after'] || null : null;
        
        console.log(`Page HTTP status: ${httpCode}`);
        if (retryAfter) {
            console.log(`Server Retry-After: ${retryAfter}`);
        }

        await page.waitForTimeout(2000); // hydrate

        // 1. Move mouse far away initially to guarantee onMouseEnter triggers when we move back
        await page.mouse.move(0, 0);
        await page.waitForTimeout(500);

        // 2. Dismiss the cookie overlay before any mouse interaction.
        try {
            const cookieOverlay = page.locator('.cookie-overlay');
            await cookieOverlay.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});

            if (await cookieOverlay.isVisible().catch(() => false)) {
                console.log('Cookie overlay detected.');

                const acceptButton = page.locator('.cookie-overlay button').filter({ hasText: /^Accept$/i }).first();

                if (await acceptButton.isVisible().catch(() => false)) {
                    await acceptButton.click({ force: true });
                    console.log('Cookie consent accepted.');
                }

                await cookieOverlay.waitFor({
                    state: 'hidden',
                    timeout: 5000
                }).catch(() => {});

                const isStillVisible = await cookieOverlay.isVisible().catch(() => false);
                console.log('Cookie overlay visible after dismissal:', isStillVisible);
                
                if (isStillVisible) {
                    console.log('===== COOKIE OVERLAY HTML =====');
                    console.log(await cookieOverlay.evaluate(el => el.outerHTML).catch(() => ''));
                    console.log('===============================');
                }
            }
        } catch (e) {
            console.log(`Cookie handling warning: ${e.message}`);
        }

        // 3. Move to the product price area and trigger the hover-based UI.
        const priceBlock = page.locator('.price-block');

        const cookieOverlay = page.locator('.cookie-overlay');
        if (await cookieOverlay.isVisible().catch(() => false)) {
            throw new Error('Cookie overlay is still visible; cannot interact with price block.');
        }

        if (await priceBlock.isVisible()) {
            console.log('Hovering over price block with trajectory...');
            
            const box = await priceBlock.boundingBox();
            if (box) {
                // Move mouse across the price block (required by mock store JS)
                const y = box.y + box.height / 2;
                await page.mouse.move(box.x + 10, y, { steps: 5 });
                await page.waitForTimeout(100);
                await page.mouse.move(box.x + box.width / 4, y, { steps: 5 });
                await page.waitForTimeout(100);
                await page.mouse.move(box.x + box.width / 2, y, { steps: 5 });
                await page.waitForTimeout(100);
                await page.mouse.move(box.x + (box.width * 3) / 4, y, { steps: 5 });
                await page.waitForTimeout(100);
                await page.mouse.move(box.x + box.width - 10, y, { steps: 5 });
                
                // CRITICAL: Dwell on the price block for 3 seconds to trigger the state change
                await page.waitForTimeout(3000);
            }

            console.log(
                'Price block class after hover:',
                await priceBlock.getAttribute('class')
            );

            console.log(
                'Reveal button disabled after hover:',
                await page.locator('button[aria-label="Reveal price"]').isDisabled().catch(() => true)
            );
            
            console.log('After hover price block text:');
            console.log(
                JSON.stringify(
                    await priceBlock.innerText().catch(() => '')
                )
            );
        }
        
        const priceBlockHTML = await priceBlock.evaluate(el => el.outerHTML).catch(() => 'PRICE BLOCK NOT FOUND');
        console.log('===== PRICE BLOCK HTML =====');
        console.log(priceBlockHTML);
        console.log('============================');

        const buttonHTML = await page
            .locator('button[aria-label="Reveal price"]')
            .evaluate(el => el.outerHTML)
            .catch(() => 'BUTTON NOT FOUND');

        console.log('===== REVEAL BUTTON HTML =====');
        console.log(buttonHTML);
        console.log('==============================');

        // 4. Wait for the Reveal Price button to enable and click it
        const revealButton = page.locator('button[aria-label="Reveal price"]');

        try {
            await revealButton.waitFor({
                state: 'visible',
                timeout: 10000
            });

            await page.waitForFunction(() => {
                const btn = document.querySelector(
                    'button[aria-label="Reveal price"]'
                );
                return btn && !btn.disabled;
            }, { timeout: 15000 });

            console.log('Reveal price button is enabled.');

            const btnBox = await revealButton.boundingBox();
            if (btnBox) {
                await page.mouse.click(btnBox.x + btnBox.width / 2, btnBox.y + btnBox.height / 2);
            }
            console.log('Clicked reveal button with pure mouse.');
        } catch (e) {
            console.log(`Reveal button interaction failed: ${e.message}`);
        }

        try {
            // Wait dynamically for the price to load on slower servers (like Render)
            await page.waitForFunction(() => {
                const el = document.querySelector('.price-block');
                return el && el.innerText && el.innerText.includes('₹');
            }, { timeout: 15000 });
        } catch (e) {
            console.log(`Failed waiting for price to load: ${e.message}`);
        }

        // 5. Extract ONLY from the price-block area!
        const priceArea = await page.locator('.price-block').innerText().catch(() => '');
        
        console.log('===== PRICE DEBUG =====');
        console.log('Price block visible:', await page.locator('.price-block').isVisible().catch(() => false));
        console.log('Price block text:', JSON.stringify(priceArea));
        console.log('Reveal button count:', await page.locator('button[aria-label="Reveal price"]').count());
        console.log('Reveal button visible:', await page.locator('button[aria-label="Reveal price"]').isVisible().catch(() => false));
        console.log('Reveal button disabled:', await page.locator('button[aria-label="Reveal price"]').isDisabled().catch(() => false));
        console.log('=======================');

        // Remove zero-width characters that may appear inside the displayed price.
        const cleanPriceArea = priceArea.replace(/\u200b/g, ''); 
        
        // Normalize different number formats before converting to a number.
        // Include apostrophes (') as they are sometimes used as thousands separators.
        const rawMatches = cleanPriceArea.match(/₹\s*([\d., \xA0']+)/g);
        let price = null;
        
        if (rawMatches && rawMatches.length > 0) {
            const numbers = rawMatches.map(m => {
                let s = m.replace(/₹\s*/, '').trim();
                
                // Handle randomized locale formats (e.g., 18.781,00 vs 19,296 vs 19 100 vs 19'100)
                const decimalMatch = s.match(/[.,](\d{2})$/);
                if (decimalMatch) {
                    s = s.slice(0, -3).replace(/[., \xA0']/g, '') + '.' + decimalMatch[1];
                } else {
                    s = s.replace(/[., \xA0']/g, '');
                }
                return parseFloat(s);
            }); 
            
            // Validation: Ensure the click succeeded by checking if at least one price loaded
            if (numbers.length >= 1) {
                price = Math.min(...numbers); // Grab the absolute lowest price
            } else {
                console.log(`Validation failed: Found ${numbers.length} price(s). Mock store click ignored.`);
            }
        }

        const nameText = await page.locator('h1').textContent().catch(() => null);
        const bodyText = await page.innerText('body').catch(() => '');
        const stock = !bodyText.toLowerCase().includes('out of stock');

        // If price is NOT null, we succeeded!
        if (price !== null && Number.isFinite(price) && price > 0) {
            return {
                success: true,
                httpCode,
                retryAfter,
                data: {
                    name: nameText ? nameText.trim() : 'Unknown Product',
                    price: price,
                    stock: stock
                }
            };
        }
        
        // Extraction failed
        return {
            success: false,
            httpCode,
            retryAfter,
            error: 'Price was not extracted as a valid positive number',
            data: { 
                name: nameText ? nameText.trim() : 'Unknown Product', 
                price: null, 
                stock: null 
            }
        };

    } catch (e) {
        return {
            success: false,
            httpCode: null,
            retryAfter: null,
            error: e.message,
            data: null
        };
    }
}

module.exports = {
    scrapeProduct
};
