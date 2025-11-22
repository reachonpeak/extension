// --- CONFIGURATION SELECTORS ---
// YOU MUST INSPECT AMAZON RELAY PAGE AND UPDATE THESE CLASSES
const SELECTORS = {
    loadItem: '.css-1q2w3e', // The container for a single load row
    payout: '.css-payout-class', // Class containing "$2000"
    rate: '.css-rate-class', // Class containing "$2.40/mi"
    stops: '.css-stops-class', // Class containing number of stops
    origin: '.css-origin-city', // Origin city/state text
    destination: '.css-dest-city', // Destination city/state text
    time: '.css-time-window', // Time/Date text
    bookButton: 'button.book-load-btn', // The actual book button
    refreshButton: 'button.refresh-board-btn' // The board refresh button (if exists)
};

let isRunning = false;
let settings = {};
let refreshTimeoutId = null;

// Initialize on load
chrome.storage.local.get(['isRunning', 'settings', 'bookedCount'], (result) => {
    if (result.isRunning) {
        isRunning = true;
        settings = result.settings;
        console.log("Amazon Relay 2.0: Resuming...", settings);
        startCycle();
    }
});

// Listen for popup commands
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "start") {
        isRunning = true;
        settings = request.settings;
        console.log("Amazon Relay 2.0: Started");
        startCycle();
    } else if (request.action === "stop") {
        isRunning = false;
        clearTimeout(refreshTimeoutId);
        console.log("Amazon Relay 2.0: Stopped");
    }
});

function startCycle() {
    if (!isRunning) return;

    scanAndBook();

    // Schedule next refresh
    const randomDelay = Math.floor(Math.random() * settings.randomizerMs);
    const totalDelay = settings.refreshMs + randomDelay;

    refreshTimeoutId = setTimeout(() => {
        triggerRefresh();
    }, totalDelay);
}

function triggerRefresh() {
    if (!isRunning) return;
    
    // Try to find a physical refresh button on page first (SPA friendly)
    const btn = document.querySelector(SELECTORS.refreshButton);
    if (btn) {
        btn.click();
        // Give it time to load then scan again
        setTimeout(startCycle, 2000); 
    } else {
        // Fallback to hard reload
        location.reload();
    }
}

function scanAndBook() {
    // Get all load rows
    const loads = document.querySelectorAll(SELECTORS.loadItem);
    
    for (let load of loads) {
        if (!isRunning) break;

        const data = parseLoadData(load);
        
        if (isMatch(data)) {
            console.log("MATCH FOUND!", data);
            if (settings.autoBook) {
                attemptBook(load);
                // Pause briefly after booking attempt
                return; 
            }
        }
    }
}

function parseLoadData(loadElement) {
    // Helper to safely get text
    const getText = (sel) => {
        const el = loadElement.querySelector(sel);
        return el ? el.innerText.trim() : "";
    };

    // Extract raw strings
    const payoutStr = getText(SELECTORS.payout).replace(/[^0-9.]/g, '');
    const rateStr = getText(SELECTORS.rate).replace(/[^0-9.]/g, '');
    const stopsStr = getText(SELECTORS.stops); // Needs parsing logic based on actual format
    const origin = getText(SELECTORS.origin);
    const destination = getText(SELECTORS.destination);

    // Parse Numbers
    return {
        payout: parseFloat(payoutStr) || 0,
        rate: parseFloat(rateStr) || 0,
        stops: parseInt(stopsStr) || 2, // Default to 2 if not found
        origin: origin,
        destination: destination,
        rawElement: loadElement
    };
}

function isMatch(data) {
    // 1. Payout Check
    if (data.payout < settings.minPayout) return false;

    // 2. Rate Check
    if (data.rate < settings.minRate) return false;

    // 3. Stops Check
    if (data.stops > settings.maxStops) return false;

    // 4. Exclude Check (Location)
    const locationString = (data.origin + " " + data.destination).toUpperCase();
    for (let tag of settings.excludeList) {
        if (locationString.includes(tag)) return false;
    }

    // 5. Time Range (Stem) - omitted for brevity, requires complex Date parsing
    // You would parse the time string in data.rawElement and compare vs settings.rangeMin/Max

    return true;
}

function attemptBook(loadElement) {
    const bookBtn = loadElement.querySelector(SELECTORS.bookButton);
    if (bookBtn) {
        bookBtn.click();
        
        // Increment booked count
        chrome.storage.local.get('bookedCount', (res) => {
            let count = (res.bookedCount || 0) + 1;
            chrome.storage.local.set({bookedCount: count});
            
            if (count >= settings.bookLimit) {
                isRunning = false;
                chrome.storage.local.set({isRunning: false});
                alert("Amazon Relay: Target Booking Reached!");
            }
        });
    }
}