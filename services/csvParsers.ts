
import { Trade, TradeType, PnLRecord, LedgerRecord, DividendRecord } from '../types';
import { clean, normalizeHeader, parseNum, parseIndianDate } from '../utils/common';

// --- Parser Helper Functions ---

const findValueInFooter = (rows: string[][], keywords: string[]): number | null => {
    const startIdx = Math.max(0, rows.length - 50);
    for (let i = rows.length - 1; i >= startIdx; i--) {
        const row = rows[i];
        for (let j = 0; j < row.length; j++) {
            const cellText = clean(row[j] || '').toLowerCase();
            if (keywords.some(k => cellText === k.toLowerCase())) {
                let val = parseNum(row[j+1] || '');
                if ((val === 0 || isNaN(val)) && (row[j+1] === '')) val = parseNum(row[j+2] || '');
                if ((val === 0 || isNaN(val)) && (row[j+2] === '')) val = parseNum(row[j+3] || '');
                if (val > 0) return val;
            }
        }
    }
    return null;
};

const findHeaderRowIndex = (rows: string[][], requiredKeywords: string[]): number => {
    for (let i = 0; i < Math.min(rows.length, 50); i++) {
        const rowString = rows[i].map(normalizeHeader).join(' ');
        const allFound = requiredKeywords.every(k => rowString.includes(normalizeHeader(k)));
        if (allFound) return i;
    }
    return -1;
};

const getColIndex = (headers: string[], possibleNames: string[]): number => {
    if (!headers) return -1;
    const normalizedHeaders = headers.map(normalizeHeader);
    
    for (const name of possibleNames) {
        const normName = normalizeHeader(name);
        let index = normalizedHeaders.indexOf(normName);
        if (index !== -1) return index;
        index = normalizedHeaders.findIndex(h => h.includes(normName));
        if (index !== -1) return index;
    }
    return -1;
};

// --- Parse Result Interface ---
export type ParseResult<T> = {
    success: boolean;
    data?: T;
    headers?: string[];
    message?: string;
    summary?: {
        charges?: number;
        netPnL?: number;
        cash?: number;
        dividends?: number;
    };
};

// --- Main Parser Logic ---

export const parseMarketDataCSV = (content: string): ParseResult<Record<string, number>> => {
    try {
        const lines = content.split('\n').filter(line => line.trim() !== '');
        const rawRows = lines.map(line => line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/));
        
        const tickerKeywords = ['Ticker', 'Symbol', 'Stock', 'Name', 'Scrip', 'Product'];
        const priceKeywords = ['Price', 'Close', 'LTP', 'Rate', 'Value'];
        
        let hIdx = -1;
        for(let i = 0; i < Math.min(rawRows.length, 50); i++) {
            const rowStr = rawRows[i].join(' ').toLowerCase();
            const hasTicker = tickerKeywords.some(k => rowStr.includes(k.toLowerCase()));
            const hasPrice = priceKeywords.some(k => rowStr.includes(k.toLowerCase()));
            if(hasTicker && hasPrice) {
                hIdx = i;
                break;
            }
        }
        
        if (hIdx === -1) return { success: false, message: "Headers not found. Expecting Ticker and Price." };
        
        const headers = rawRows[hIdx];
        const rows = rawRows.slice(hIdx + 1);
        const idxTicker = getColIndex(headers, tickerKeywords);
        const idxPrice = getColIndex(headers, priceKeywords);
        
        if (idxTicker === -1 || idxPrice === -1) return { success: false, message: "Ticker or Price columns not identified." };
        
        const newPrices: Record<string, number> = {};
        let count = 0;

        rows.forEach(row => {
            const ticker = clean(row[idxTicker] || '').toUpperCase();
            const priceRaw = row[idxPrice] || '';
            const price = Math.abs(parseNum(priceRaw));

            if (ticker && price > 0) {
                newPrices[ticker] = price;
                count++;
            }
        });
        
        if (count === 0) return { success: false, message: "No valid price data extracted." };
        
        return { success: true, data: newPrices, headers, message: `Updated prices for ${count} stocks.` };

    } catch (e: any) {
        return { success: false, message: e.message };
    }
};

export const parseIndianEquity = (type: string, rawRows: string[][]): ParseResult<any> => {
    if (type === 'TRADE_HISTORY') {
         const headerIdx = findHeaderRowIndex(rawRows, ['Date', 'Price']);
         if (headerIdx === -1) return { success: false, message: "Header not found. Expecting 'Date' and 'Price'." };
         
         const headers = rawRows[headerIdx];
         const rows = rawRows.slice(headerIdx + 1);

         const idxDate = getColIndex(headers, ['Date', 'Time']);
         const idxTicker = getColIndex(headers, ['Symbol', 'Scrip', 'Name', 'Ticker']);
         const idxType = getColIndex(headers, ['Type', 'Buy/Sell', 'Side']);
         const idxQty = getColIndex(headers, ['Qty', 'Quantity']);
         const idxPrice = getColIndex(headers, ['Price', 'Rate', 'Trade Price']);
         
         const newTrades: Trade[] = [];
         rows.forEach(row => {
             const dateStr = parseIndianDate(clean(row[idxDate] || ''));
             if (!dateStr) return;

             const ticker = clean(row[idxTicker] || '');
             const typeStr = idxType !== -1 ? clean(row[idxType] || '').toUpperCase() : 'BUY'; 
             const qty = Math.abs(parseNum(row[idxQty] || ''));
             const price = Math.abs(parseNum(row[idxPrice] || ''));
             const tradeType = (typeStr.includes('B') || typeStr.includes('P')) ? TradeType.BUY : TradeType.SELL;
             const netAmount = tradeType === TradeType.BUY ? -(qty * price) : (qty * price);

             if (ticker && qty > 0) {
                 newTrades.push({
                     id: Math.random().toString(36).substr(2, 9),
                     date: dateStr,
                     ticker,
                     type: tradeType,
                     quantity: qty,
                     price,
                     netAmount,
                     status: 'TRADED'
                 });
             }
         });
         
         if (newTrades.length > 0) return { success: true, data: newTrades, headers, message: `Imported ${newTrades.length} trades.` };
         return { success: false, message: "No valid trades found." };
    }
    else if (type === 'PNL') {
         const totalCharges = findValueInFooter(rawRows, ['Total Charges', 'Charges']);
         const reportedNet = findValueInFooter(rawRows, ['Net P&L', 'Net Realised P&L']);
         
         const headerIdx = findHeaderRowIndex(rawRows, ['Scrip', 'Qty']);
         if (headerIdx !== -1) {
             const headers = rawRows[headerIdx];
             const rows = rawRows.slice(headerIdx + 1);

             const idxScrip = getColIndex(headers, ['Scrip', 'Symbol', 'Stock']);
             const idxBuyQty = getColIndex(headers, ['Buy Qty']);
             const idxBuyPrice = getColIndex(headers, ['Buy Avg', 'Buy Price']);
             const idxSellQty = getColIndex(headers, ['Sell Qty']);
             const idxSellPrice = getColIndex(headers, ['Sell Avg', 'Sell Price']);
             const idxRealized = getColIndex(headers, ['Realized', 'Realised']);
             const idxUnrealized = getColIndex(headers, ['Unrealized', 'Unrealised']);

             const newPnl: PnLRecord[] = rows.map(row => ({
                 scripName: clean(row[idxScrip] || ''),
                 buyQty: idxBuyQty !== -1 ? parseNum(row[idxBuyQty] || '') : 0,
                 avgBuyPrice: idxBuyPrice !== -1 ? parseNum(row[idxBuyPrice] || '') : 0,
                 buyValue: (idxBuyQty !== -1 && idxBuyPrice !== -1) ? parseNum(row[idxBuyQty] || '') * parseNum(row[idxBuyPrice] || '') : 0, 
                 sellQty: idxSellQty !== -1 ? parseNum(row[idxSellQty] || '') : 0,
                 avgSellPrice: idxSellPrice !== -1 ? parseNum(row[idxSellPrice] || '') : 0,
                 sellValue: (idxSellQty !== -1 && idxSellPrice !== -1) ? parseNum(row[idxSellQty] || '') * parseNum(row[idxSellPrice] || '') : 0,
                 realizedPnL: idxRealized !== -1 ? parseNum(row[idxRealized] || '') : 0,
                 unrealizedPnL: idxUnrealized !== -1 ? parseNum(row[idxUnrealized] || '') : 0,
             })).filter(r => r.scripName && r.scripName !== 'Total' && r.scripName !== '');

             if (newPnl.length > 0) {
                 return { 
                     success: true, 
                     data: newPnl, 
                     headers, 
                     message: `Imported ${newPnl.length} P&L records.`,
                     summary: { charges: totalCharges || 0, netPnL: reportedNet || 0 }
                 };
             }
         }
         return { success: false, message: "P&L headers not found." };
    }
    else if (type === 'LEDGER') {
         const closingBal = findValueInFooter(rawRows, ['Closing Balance', 'Balance']);
         const headerIdx = findHeaderRowIndex(rawRows, ['Date', 'Debit']);
         
         if (headerIdx !== -1) {
             const headers = rawRows[headerIdx];
             const rows = rawRows.slice(headerIdx + 1);
             
             const idxDate = getColIndex(headers, ['Date', 'Posting']);
             const idxDesc = getColIndex(headers, ['Description', 'Narration']);
             const idxDebit = getColIndex(headers, ['Debit']);
             const idxCredit = getColIndex(headers, ['Credit']);
             const idxBalance = getColIndex(headers, ['Balance', 'Net']);
             
             const newLedger: LedgerRecord[] = rows.map(row => ({
                 date: parseIndianDate(clean(row[idxDate] || '')),
                 description: idxDesc !== -1 ? clean(row[idxDesc] || '') : '',
                 credit: idxCredit !== -1 ? parseNum(row[idxCredit] || '') : 0,
                 debit: idxDebit !== -1 ? parseNum(row[idxDebit] || '') : 0,
                 balance: idxBalance !== -1 ? parseNum(row[idxBalance] || '') : 0,
                 type: 'OTHER' as const
             })).filter(r => r.date);
             
             return { 
                 success: true, 
                 data: newLedger, 
                 headers, 
                 message: "Ledger imported.",
                 summary: { cash: closingBal || 0 }
             };
         }
         return { success: false, message: "Ledger headers not found." };
    }
    else if (type === 'DIVIDEND') {
         const totalDiv = findValueInFooter(rawRows, ['Total Dividend Earned', 'Total Dividend', 'Total']);
         const possibleHeaderKeywords = [['Date', 'Amount'], ['Date', 'Net'], ['Payout', 'Amount'], ['Date', 'Dividend']];
         
         let headerIdx = -1;
         for (const keywords of possibleHeaderKeywords) {
             headerIdx = findHeaderRowIndex(rawRows, keywords);
             if (headerIdx !== -1) break;
         }
         if (headerIdx === -1) headerIdx = findHeaderRowIndex(rawRows, ['Date']);

         if (headerIdx !== -1) {
             const headers = rawRows[headerIdx];
             const rows = rawRows.slice(headerIdx + 1);
             const idxDate = getColIndex(headers, ['Date', 'Payout Date']);
             const idxScrip = getColIndex(headers, ['Symbol', 'Scrip', 'Security Name']);
             const idxAmt = getColIndex(headers, ['Amount', 'Net', 'Net Amount', 'Dividend Amount', 'Credit']);
             
             let newDivs: DividendRecord[] = [];
             if (idxDate !== -1 && idxAmt !== -1) {
                 newDivs = rows.map(row => {
                    const dateStr = parseIndianDate(clean(row[idxDate] || ''));
                    if (!dateStr) return null;
                    const scripName = idxScrip !== -1 ? clean(row[idxScrip] || '') : 'Unknown';
                    const amount = Math.abs(parseNum(row[idxAmt] || ''));
                    if (amount <= 0) return null;
                    return { date: dateStr, scripName, amount };
                 }).filter((r): r is DividendRecord => r !== null);
             }
             
             if (newDivs.length > 0) {
                 return { success: true, data: newDivs, headers, message: `Imported ${newDivs.length} dividend records.`, summary: { dividends: totalDiv || 0 } };
             }
         }
         
         // Fallback to total if no rows found
         if (totalDiv !== null && totalDiv > 0) {
             const synthetic: DividendRecord[] = [{ date: new Date().toISOString().split('T')[0], scripName: 'Total (Imported)', amount: totalDiv }];
             return { success: true, data: synthetic, message: `Imported Total Dividend of ${totalDiv}`, summary: { dividends: totalDiv } };
         }
         return { success: false, message: "No dividend rows or total found." };
    }
    return { success: false, message: "Unknown upload type." };
};

export const parseInternationalEquity = (type: string, rawRows: string[][]): ParseResult<any> => {
      if (type === 'TRADE_HISTORY') {
          const headerIdx = findHeaderRowIndex(rawRows, ['Date', 'Produit', 'Quantité']);
          if (headerIdx === -1) return { success: false, message: "Header not found (Degiro)." };
          
          const headers = rawRows[headerIdx];
          const rows = rawRows.slice(headerIdx + 1);

          const idxDate = getColIndex(headers, ['Date']);
          const idxTime = getColIndex(headers, ['Heure', 'Time']);
          const idxTicker = getColIndex(headers, ['Produit', 'Product']);
          const idxQty = getColIndex(headers, ['Quantité', 'Quantity', 'Quantite']); 
          const idxPrice = getColIndex(headers, ['Cours', 'Price']);
          const idxNetEUR = getColIndex(headers, ['Montant négocié EUR', 'Montant negocie EUR', 'Montant EUR', 'Net Amount', 'Total']); 
          const idxAutoFX = getColIndex(headers, ['Frais conversion AutoFX', 'AutoFX']);
          const idxBrokerage = getColIndex(headers, ['Frais de courtage et/ou de parties', 'Courtage', 'Brokerage', 'Commission']);

          const newTrades: Trade[] = [];
          let totalFeesAccumulated = 0;
          const orderedRows = [...rows].reverse();

          orderedRows.forEach(row => {
              let dateStr = parseIndianDate(clean(row[idxDate] || ''));
              if (!dateStr) return;
              if (idxTime !== -1 && clean(row[idxTime] || '').includes(':')) {
                  dateStr = `${dateStr}T${clean(row[idxTime] || '')}`;
              }

              const ticker = clean(row[idxTicker] || '');
              const qtyRaw = parseNum(row[idxQty] || '');
              const qty = Math.abs(qtyRaw);
              const price = Math.abs(parseNum(row[idxPrice] || ''));
              const tradeType = qtyRaw > 0 ? TradeType.BUY : TradeType.SELL;
              
              totalFeesAccumulated += (idxAutoFX !== -1 ? Math.abs(parseNum(row[idxAutoFX] || '')) : 0) + 
                                      (idxBrokerage !== -1 ? Math.abs(parseNum(row[idxBrokerage] || '')) : 0);

              let netAmount = (idxNetEUR !== -1 && row[idxNetEUR]) ? parseNum(row[idxNetEUR]) : (tradeType === TradeType.BUY ? -(qty * price) : (qty * price));

              if (ticker && qty > 0) {
                  newTrades.push({ id: Math.random().toString(36).substr(2, 9), date: dateStr, ticker, type: tradeType, quantity: qty, price, netAmount, status: 'TRADED' });
              }
          });

          if (newTrades.length > 0) {
              return { success: true, data: newTrades, headers, message: `Imported ${newTrades.length} trades.`, summary: { charges: totalFeesAccumulated } };
          }
          return { success: false, message: "No trades parsed." };
      }
      else if (type === 'LEDGER') {
           const headerIdx = findHeaderRowIndex(rawRows, ['Date', 'Description']);
           if (headerIdx !== -1) {
               const headers = rawRows[headerIdx];
               const rows = rawRows.slice(headerIdx + 1);
               const idxDate = getColIndex(headers, ['Date', 'Value Date']);
               const idxDesc = getColIndex(headers, ['Description']);
               const idxProduct = getColIndex(headers, ['Produit', 'Product']);
               const idxCurrency = getColIndex(headers, ['Mouvements', 'Movement', 'Change']); 
               
               const newDividends: DividendRecord[] = [];
               rows.forEach(row => {
                   if (idxDesc === -1 || idxDate === -1) return;
                   const desc = clean(row[idxDesc] || '');
                   if (desc === 'Dividende') {
                       const dateStr = parseIndianDate(clean(row[idxDate] || ''));
                       if (!dateStr) return;
                       const scripName = idxProduct !== -1 ? clean(row[idxProduct] || '') : 'Unknown';
                       let currency = 'EUR';
                       let valStr = '0';

                       if (idxCurrency !== -1) {
                           currency = clean(row[idxCurrency] || 'EUR').toUpperCase();
                           valStr = clean(row[idxCurrency + 1] || '0');
                       } else {
                           const idxAmount = getColIndex(headers, ['Montant', 'Amount']);
                           if (idxAmount !== -1) {
                               valStr = clean(row[idxAmount] || '0');
                               const idxDevise = getColIndex(headers, ['Devise', 'Currency']);
                               if (idxDevise !== -1) currency = clean(row[idxDevise] || 'EUR').toUpperCase();
                           }
                       }
                       const amountVal = parseFloat(valStr.replace(/\./g, '').replace(',', '.'));
                       if (!isNaN(amountVal) && amountVal !== 0) {
                           let rate = 1.0; 
                           if (currency === 'USD') rate = 0.92;
                           else if (currency === 'NO' || currency === 'NOK') rate = 0.088; 
                           else if (currency === 'SEK') rate = 0.087;
                           else if (currency === 'GBP') rate = 1.17;
                           newDividends.push({ date: dateStr, scripName, amount: Math.abs(amountVal) * rate });
                       }
                   }
               });

               if (newDividends.length > 0) {
                   return { success: true, data: newDividends, headers, message: `Imported ${newDividends.length} Dividend records.`, summary: { dividends: 0 } };
               }
           }
           return { success: false, message: "Ledger/Dividend parsing failed." };
      }
      else if (type === 'PORTFOLIO_SNAPSHOT') {
          let cashVal = 0;
          if (rawRows.length > 1 && rawRows[1].length > 6) cashVal = parseNum(rawRows[1][6]);
          
          const headerIdx = findHeaderRowIndex(rawRows, ['Produit', 'Clôture']); 
          if (headerIdx === -1) return { success: false, message: "Portfolio headers not found." };

          const headers = rawRows[headerIdx];
          const rows = rawRows.slice(headerIdx + 1);
          const idxProduct = getColIndex(headers, ['Produit', 'Product']);
          const idxPrice = getColIndex(headers, ['Clôture', 'Close', 'Price']);
          
          const newPrices: Record<string, number> = {};
          let count = 0;
          rows.forEach(row => {
              const ticker = clean(row[idxProduct] || '').toUpperCase();
              const price = Math.abs(parseNum(row[idxPrice] || ''));
              if (ticker && price > 0) {
                  newPrices[ticker] = price;
                  count++;
              }
          });
          
          if (count > 0) {
              return { success: true, data: newPrices, headers, message: `Updated prices for ${count} stocks.`, summary: { cash: cashVal } };
          }
          return { success: false, message: "No portfolio prices found." };
      }
      return { success: false, message: "Unknown upload type." };
};
