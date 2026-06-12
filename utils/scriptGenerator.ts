
export const generateGoogleAppsScript = (watchlist: any[], email: string, context: string) => {
  // Filter watchlist to only include items with valid targets
  const validItems = watchlist.filter(item => {
    const supports = [item.s1, item.s2, item.s3].filter((s: any) => s && s > 0);
    return supports.length > 0 || (item.desiredEntryPrice && item.desiredEntryPrice > 0);
  }).map(item => {
    return {
      ticker: item.ticker,
      s1: item.s1 || 0,
      s2: item.s2 || 0,
      s3: item.s3 || 0,
      intrinsicValue: item.intrinsicValue || 0,
      manualTarget: item.desiredEntryPrice || 0
    };
  });

  const configJson = JSON.stringify(validItems, null, 2);

  // Determine Formula based on Context
  let formulaLogic = `cell.setFormula(\`=GOOGLEFINANCE("\${ticker}")\`);`;
  
  if (context === 'INDIAN_EQUITY') {
      formulaLogic = `cell.setFormula(\`=IFERROR(GOOGLEFINANCE("NSE:" & "\${ticker}"), GOOGLEFINANCE("BSE:" & "\${ticker}"))\`);`;
  }

  return `
/**
 * FinFolio Email Alert Script (${context.replace('_', ' ')})
 * ---------------------------
 * 1. Go to extensions > Apps Script in your Google Sheet.
 * 2. Paste this code entirely, replacing any existing code.
 * 3. Save the project.
 * 4. Run the 'setupTrigger' function once to start the hourly monitoring.
 */

// --- CONFIGURATION ---
// By default, this sends emails to the Google account running this script (You).
// To send to a different address, replace Session.getActiveUser().getEmail() with "your_email@example.com"
const EMAIL_ADDRESS = Session.getActiveUser().getEmail();

// If auto-detection fails, set this to the column number where Price is (A=1, B=2, etc.)
// Set to 0 to enable auto-detection based on headers like "Price", "LTP", "Current".
const MANUAL_PRICE_COLUMN = 2; 

const WATCHLIST = ${configJson};

// --- TEST FUNCTION ---
// Run this function ('testSystem') first to verify email delivery.
function testSystem() {
  Logger.log("Sending test email to: " + EMAIL_ADDRESS);
  try {
    MailApp.sendEmail({
      to: EMAIL_ADDRESS,
      subject: "FinFolio Alert System: Test Successful",
      body: "Great news! The FinFolio alert system is connected correctly.\\n\\n" +
            "This script is running as: " + EMAIL_ADDRESS + "\\n" +
            "It is monitoring " + WATCHLIST.length + " stocks from your watchlist.\\n\\n" +
            "Next Steps:\\n" +
            "1. Run the 'setupTrigger' function to enable hourly checks.\\n" +
            "2. You can close the script editor; it will run in the background."
    });
    Logger.log("Email sent successfully.");
  } catch (e) {
    Logger.log("Error sending email: " + e.toString());
  }
}

// --- MAIN FUNCTION ---
function checkStockLevels() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheets()[0]; // Uses the first sheet
  const data = sheet.getDataRange().getValues();
  
  if (data.length < 2) {
    Logger.log("Sheet is empty or has no data.");
    return;
  }
  
  // 1. Determine Price Column
  let priceColIndex = -1;
  
  if (MANUAL_PRICE_COLUMN > 0) {
    priceColIndex = MANUAL_PRICE_COLUMN - 1;
  } else {
    // Auto-detect based on common headers
    const headers = data[0];
    for (let i = 0; i < headers.length; i++) {
      const h = String(headers[i]).toLowerCase();
      if (h.includes("price") || h.includes("ltp") || h.includes("current") || h.includes("close") || h.includes("value")) {
        priceColIndex = i;
        break;
      }
    }
    if (priceColIndex === -1) priceColIndex = 1; // Default to Column B if no header match
  }
  
  Logger.log("Reading Sheet: " + sheet.getName());
  Logger.log("Reading Prices from Column: " + (priceColIndex + 1));
  
  // 2. Build Price Map (Name -> Price)
  // Assumes Stock Name is in Column A (Index 0) as per user instruction
  const priceMap = {};
  for (let i = 1; i < data.length; i++) { // Skip header row
    const row = data[i];
    const name = String(row[0]).trim().toUpperCase(); 
    const price = row[priceColIndex];
    
    // Store if valid price found
    if (name && (typeof price === 'number' || !isNaN(parseFloat(price)))) {
      priceMap[name] = typeof price === 'number' ? price : parseFloat(price);
    }
  }
  
  const alerts = [];
  
  Logger.log("--- STARTING CHECK (" + WATCHLIST.length + " items) ---");
  
  for (let i = 0; i < WATCHLIST.length; i++) {
    const item = WATCHLIST[i];
    const tickerName = item.ticker.trim().toUpperCase();
    const price = priceMap[tickerName];
    
    Logger.log("Checking " + item.ticker + " | Price: " + (price || "Not Found"));
    
    if (typeof price !== 'number' || price <= 0) {
        Logger.log("  -> SKIP: Price not found in sheet (Check exact name match in Col A)");
        continue;
    }
    
    // Determine Effective Target
    const supports = [item.s1, item.s2, item.s3].filter(s => s > 0);
    let effectiveTarget = item.manualTarget;
    
    if (supports.length > 0) {
       effectiveTarget = supports.reduce((prev, curr) => 
          Math.abs(curr - price) < Math.abs(prev - price) ? curr : prev
       );
    }
    
    if (effectiveTarget <= 0) {
        Logger.log("  -> SKIP: No valid target set");
        continue;
    }
    
    const callRatio = effectiveTarget / price;
    Logger.log("  -> Target: " + effectiveTarget + " | Ratio: " + callRatio.toFixed(4));
    
    // Logic: Call Ratio > 0.95 triggers alert
    if (callRatio > 0.95) {
      Logger.log("  -> *** ALERT TRIGGERED ***");
      alerts.push({
        ticker: item.ticker,
        price: price,
        target: effectiveTarget,
        ratio: callRatio,
        s1: item.s1,
        s2: item.s2,
        s3: item.s3
      });
    } else {
      Logger.log("  -> OK (Below 0.95)");
    }
  }
  
  Logger.log("--- CHECK COMPLETE. ALERTS: " + alerts.length + " ---");
  
  // --- STATEFUL ALERT LOGIC ---
  const scriptProperties = PropertiesService.getScriptProperties();
  const lastAlertedJson = scriptProperties.getProperty('LAST_ALERTED_TICKERS') || '[]';
  let lastAlertedTickers = [];
  try {
    lastAlertedTickers = JSON.parse(lastAlertedJson);
  } catch (e) {
    lastAlertedTickers = [];
  }
  
  const currentAlertTickers = alerts.map(a => a.ticker);
  
  // Find stocks that are in the current alert list but NOT in the last run's list
  const newAlerts = alerts.filter(a => !lastAlertedTickers.includes(a.ticker));
  
  Logger.log("Previous Alerts: " + JSON.stringify(lastAlertedTickers));
  Logger.log("Current Alerts: " + JSON.stringify(currentAlertTickers));
  Logger.log("New Alerts: " + newAlerts.length);
  
  // Update the stored state for next time
  scriptProperties.setProperty('LAST_ALERTED_TICKERS', JSON.stringify(currentAlertTickers));
  
  // Only send email if there are NEW alerts
  if (newAlerts.length > 0) {
    sendAlertEmail(newAlerts, alerts);
  } else {
    Logger.log("No new additions to the alert list. Skipping email.");
  }
}

function sendAlertEmail(newAlerts, allAlerts) {
  let subject = \`FinFolio Alert: \${newAlerts.length} New Stocks at Buy Levels\`;
  let body = "The following stocks have JUST reached your buying criteria (Call Ratio > 0.95):\\n\\n";
  
  newAlerts.forEach(a => {
    body += \`[NEW] \${a.ticker}: Current Price \${a.price.toFixed(2)}\\n\`;
    body += \`      Target: \${a.target} | Call Ratio: \${a.ratio.toFixed(2)}\\n\`;
    if (a.s1) body += \`      S1: \${a.s1}\`;
    if (a.s2) body += \` | S2: \${a.s2}\`;
    if (a.s3) body += \` | S3: \${a.s3}\`;
    body += "\\n\\n";
  });
  
  // List others if any
  const existing = allAlerts.filter(a => !newAlerts.includes(a));
  if (existing.length > 0) {
    body += "--------------------------------------------------\\n";
    body += "Other Stocks Currently in Buy Zone:\\n\\n";
    existing.forEach(a => {
      body += \`\${a.ticker} (Ratio: \${a.ratio.toFixed(2)})\\n\`;
    });
  }
  
  body += "\\nCheck your FinFolio app for details.";
  
  MailApp.sendEmail({
    to: EMAIL_ADDRESS,
    subject: subject,
    body: body
  });
}

function setupTrigger() {
  // Delete existing triggers to avoid duplicates
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }
  
  // Create a new hourly trigger
  ScriptApp.newTrigger('checkStockLevels')
    .timeBased()
    .everyHours(1)
    .create();
    
  Logger.log("Trigger set up successfully. Will run every hour.");
}
`;
};
