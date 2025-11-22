// content.js

// --- CONFIGURATION SELECTORS ---
// We use generic selectors where possible to avoid breaking when Amazon changes classes
const SELECTORS = {
    // 'div[role="row"]' matches the rows in the load table safely
    loadItem: 'div[role="row"]', 
    
    // The refresh button class from your screenshot (Screenshot 2025-11-22 at 1.20.15 PM.png)
    refreshButton: 'button.css-q7ppch, button[aria-label="Refresh"]' 
};

let isRunning = false;
let settings = {};
let refreshTimeoutId = null;
let scannedLoadIds = new Set(); 

// Initialize
chrome.storage.local.get(['isRunning', 'settings', 'bookedCount'], (result) => {
    if (result.isRunning) {
        isRunning = true;
        settings = result.settings || {};
        console.log("Amazon Relay 2.0: Resuming...", settings);
        startCycle();
    }
});

// Listen for popup commands
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "start") {
        isRunning = true;
        settings = request.settings;
        scannedLoadIds.clear(); // Reset scanned list on new start
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

    // 1. Scan existing loads
    scanAndBook();

    // 2. Schedule next refresh with randomizer
    const randomDelay = Math.floor(Math.random() * (settings.randomizerMs || 1000));
    const totalDelay = (settings.refreshMs || 2000) + randomDelay;

    refreshTimeoutId = setTimeout(() => {
        triggerSoftRefresh();
    }, totalDelay);
}

function triggerSoftRefresh() {
    if (!isRunning) return;
    
    const btn = document.querySelector(SELECTORS.refreshButton);
    
    if (btn) {
        console.log("Amazon Relay 2.0: Clicking Refresh...");
        btn.click();
        // Wait 2.5 seconds for the table to reload, then loop
        setTimeout(startCycle, 2500); 
    } else {
        console.warn("Amazon Relay 2.0: Refresh button not found. Retrying...");
        // Retry shortly if button wasn't found (maybe DOM wasn't ready)
        setTimeout(startCycle, 5000);
    }
}

function scanAndBook() {
    // Find all rows
    const loads = document.querySelectorAll(SELECTORS.loadItem);
    
    console.log(`Amazon Relay 2.0: Scanning ${loads.length} rows...`);

    Array.from(loads).forEach(load => {
        if (!isRunning) return;

        // Create a simple ID from the text to avoid double-alerting
        // We take the first 50 chars which usually includes Origin/Dest/Time
        const loadId = load.innerText.replace(/\s/g, '').substring(0, 50); 
        
        if (scannedLoadIds.has(loadId)) return; 
        
        const data = parseLoadData(load);
        
        // Log data for debugging (optional, helps see if parsing works)
        // console.log("Parsed Load:", data);

        if (isMatch(data)) {
            console.log("MATCH FOUND!", data);
            scannedLoadIds.add(loadId);
            
            // Visual Highlight (Green Border)
            load.style.border = "3px solid #00ff00";
            load.style.backgroundColor = "rgba(0, 255, 0, 0.05)";

            // CHECK: Auto Book vs Alert Only
            if (settings.autoBook) {
                attemptBook(load);
            } else {
                playAlertSound();
            }
        }
    });
}

function playAlertSound() {
    const audio = new Audio(chrome.runtime.getURL('sounds/alert.mp3'));
    audio.volume = 1.0;
    audio.play().catch(e => console.log("Audio play error:", e));
}

function parseLoadData(loadElement) {
    const rowText = loadElement.innerText;

    // --- FIX 1: Handle CAD, USD, GBP, or $ ---
    // We look for a number that follows a currency code or symbol
    // Matches: "$2000", "CAD 2000", "USD 2,000.50"
    const payoutMatch = rowText.match(/(?:CAD|USD|GBP|£|\$)\s?([0-9,]+(?:\.[0-9]{2})?)/i);
    
    // Fallback: If regex fails, find the largest number in the row > 100
    let payout = 0;
    if (payoutMatch) {
        payout = parseFloat(payoutMatch[1].replace(/,/g, ''));
    } else {
        // Fallback strategy: find all numbers, assume payout is the big one
        const allNumbers = rowText.match(/[0-9,]+\.[0-9]{2}/g);
        if (allNumbers) {
            const nums = allNumbers.map(n => parseFloat(n.replace(/,/g, '')));
            payout = Math.max(...nums);
        }
    }

    // --- FIX 2: Parse Rate ---
    // Looks for "/mi" pattern
    const rateMatch = rowText.match(/([0-9.]+)\/mi/);
    const rate = rateMatch ? parseFloat(rateMatch[1]) : 0;

    return {
        payout: payout,
        rate: rate,
        fullText: rowText.toUpperCase(),
        rawElement: loadElement
    };
}

function isMatch(data) {
    // 1. Payout Check
    if (data.payout < settings.minPayout) return false;

    // 2. Rate Check
    if (data.rate < settings.minRate) return false;

    // 3. Exclude Check
    if (settings.excludeList && settings.excludeList.length > 0) {
        for (let tag of settings.excludeList) {
            // Check if row text contains the excluded word (e.g. "NY", "DQB2")
            if (data.fullText.includes(tag)) return false;
        }
    }

    return true;
}

function attemptBook(loadElement) {
    console.log("Attempting to book...");
    
    // Find any button with text "Book" inside the row
    // This is safer than relying on a specific class like .book-button
    const buttons = loadElement.querySelectorAll('button');
    let bookBtn = null;
    
    buttons.forEach(btn => {
        if (btn.innerText.toUpperCase().includes('BOOK')) {
            bookBtn = btn;
        }
    });

    if (bookBtn) {
        bookBtn.click();
        console.log("Book button clicked.");
        
        // Update stats
        chrome.storage.local.get('bookedCount', (res) => {
            let count = (res.bookedCount || 0) + 1;
            chrome.storage.local.set({bookedCount: count});
            
            // Stop if limit reached
            if (settings.bookLimit && count >= settings.bookLimit) {
                isRunning = false;
                chrome.storage.local.set({isRunning: false});
                alert("Amazon Relay 2.0: Booking limit reached!");
            }
        });
    } else {
        console.error("Could not find Book button in the row.");
    }
}