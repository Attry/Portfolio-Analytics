      else if (type === 'LEDGER') {
           const headerIdx = findHeaderRowIndex(rawRows, ['Date', 'Description']);
           if (headerIdx !== -1) {
               const headers = rawRows[headerIdx];
               setLastUploadHeaders(headers);
               const rows = rawRows.slice(headerIdx + 1);
               
               const idxDate = getColIndex(headers, ['Date', 'Value Date']);
               const idxDesc = getColIndex(headers, ['Description']);
               const idxProduct = getColIndex(headers, ['Produit', 'Product']);
               // "Mouvements" or "Change" column often contains the Currency (e.g. USD, EUR)
               const idxCurrency = getColIndex(headers, ['Mouvements', 'Movement', 'Change']); 
               
               const newDividends: DividendRecord[] = [];
               
               rows.forEach(row => {
                   if (idxDesc === -1 || idxDate === -1) return;

                   const desc = clean(row[idxDesc] || '');
                   
                   // Strict filter for 'Dividende'
                   if (desc === 'Dividende') {
                       const dateStr = parseIndianDate(clean(row[idxDate] || ''));
                       if (!dateStr) return;
                       
                       const scripName = idxProduct !== -1 ? clean(row[idxProduct] || '') : 'Unknown';
                       
                       let currency = 'EUR';
                       let valStr = '0';

                       if (idxCurrency !== -1) {
                           // Dynamic: Currency is at found index, Amount is in the adjacent column (Index + 1)
                           currency = clean(row[idxCurrency] || 'EUR').toUpperCase();
                           valStr = clean(row[idxCurrency + 1] || '0');
                       } else {
                           // Fallback: Look for 'Montant' or 'Amount' directly
                           const idxAmount = getColIndex(headers, ['Montant', 'Amount']);
                           if (idxAmount !== -1) {
                               valStr = clean(row[idxAmount] || '0');
                               const idxDevise = getColIndex(headers, ['Devise', 'Currency']);
                               if (idxDevise !== -1) currency = clean(row[idxDevise] || 'EUR').toUpperCase();
                           }
                       }

                       // Strict European Parsing: Remove dots (thousands), replace comma with dot (decimal)
                       // Example: "1.250,50" -> 1250.50
                       const amountVal = parseFloat(valStr.replace(/\./g, '').replace(',', '.'));

                       if (!isNaN(amountVal) && amountVal !== 0) {
                           // Currency Conversion Rates
                           let rate = 1.0; 
                           if (currency === 'USD') rate = 0.92;
                           else if (currency === 'NO' || currency === 'NOK') rate = 0.088; 
                           else if (currency === 'SEK') rate = 0.087;
                           else if (currency === 'GBP') rate = 1.17;

                           const convertedAmount = Math.abs(amountVal) * rate;

                           newDividends.push({
                               date: dateStr,
                               scripName, 
                               amount: convertedAmount
                           });
                       }
                   }
               });

               if (newDividends.length > 0) {
                   setDividendData(newDividends);
                   persistData(STORAGE_KEYS.DIVIDENDS, newDividends);
                   
                   // Reset summary to ensure calculated total is used
                   setExtractedDividends(0);
                   saveSummary({ dividends: 0 });

                   updateMeta({ dividend: new Date().toISOString(), ledger: new Date().toISOString() });
                   alert(`Success: Imported ${newDividends.length} Dividend records using dynamic column mapping.`);
               } else {
                   alert("No rows with Description 'Dividende' found.");
               }
           } else {
               alert("Could not find Degiro Account headers (Date, Description).");
           }
      }