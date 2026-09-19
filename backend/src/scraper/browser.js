const { chromium } = require('playwright');

// Simple browser manager to keep things clean
async function launchBrowser(isHeaded = false) {
    // We launch headless by defualt, but allow headed for the demo recording in M9
    return await chromium.launch({
        headless: !isHeaded,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
}

module.exports = {
    launchBrowser
};
