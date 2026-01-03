
export const clean = (val: string) => val ? val.replace(/"/g, '').trim() : '';

export const normalizeHeader = (header: string) => {
    if (!header) return "";
    return header
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
};

export const parseNum = (val: string) => {
    if (!val) return 0;
    
    // Clean string: remove spaces (thousands separators in French), quotes
    let cleaned = val.replace(/[\s"]/g, '').trim();
    
    if (cleaned.includes('(') && cleaned.includes(')')) {
        cleaned = '-' + cleaned.replace(/[()]/g, '');
    }

    // Remove currency symbols/text (keeping digits, minus sign, dots, commas)
    cleaned = cleaned.replace(/[^0-9.,-]/g, '');

    if (!cleaned) return 0;

    // Robust European vs Standard detection
    if (cleaned.indexOf(',') > -1 && (cleaned.indexOf('.') === -1 || cleaned.indexOf(',') > cleaned.indexOf('.'))) {
         cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } 
    else {
        cleaned = cleaned.replace(/,/g, '');
    }

    const res = parseFloat(cleaned);
    return isNaN(res) ? 0 : res;
};

export const parseIndianDate = (dateStr: string): string => {
    if (!dateStr) return '';
    dateStr = dateStr.trim();
    
    // ISO format already
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) return dateStr;
    
    // Indian DD-MM-YYYY
    if (dateStr.match(/^\d{2}-\d{2}-\d{4}$/)) {
        const [d, m, y] = dateStr.split('-');
        return `${y}-${m}-${d}`;
    }

    const months: {[key: string]: string} = {
        'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
        'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
    };

    const parts = dateStr.split(/[-/ ]/);
    if (parts.length === 3) {
        let p0 = parts[0];
        let p1 = parts[1];
        let p2 = parts[2];
        let day, month, year;
        
        // YYYY/MM/DD or YYYY-MM-DD (if not caught by regex)
        if (p0.length === 4) { year = p0; month = p1; day = p2; }
        // DD/MM/YYYY or MM/DD/YYYY
        else if (p2.length === 4) { 
            year = p2;
            
            // Check for month names
            if (isNaN(Number(p1))) {
                const mStr = p1.toLowerCase().substring(0, 3);
                if (months[mStr]) {
                    month = months[mStr];
                    day = p0;
                } else {
                    // Maybe p0 is month name?
                    const mStr0 = p0.toLowerCase().substring(0, 3);
                    if (months[mStr0]) {
                        month = months[mStr0];
                        day = p1;
                    } else {
                        return '';
                    }
                }
            } else {
                // Numeric Month handling
                // Default assumption: DD/MM/YYYY (Indian)
                let num0 = parseInt(p0, 10);
                let num1 = parseInt(p1, 10);

                if (num1 > 12 && num0 <= 12) {
                    // Definitely MM/DD/YYYY (US style where p1 is Day > 12)
                    // Wait, if input is 05/25/2023. p0=05, p1=25. 
                    // p0 is Month, p1 is Day.
                    month = p0;
                    day = p1;
                } else if (num0 > 12 && num1 <= 12) {
                    // Definitely DD/MM/YYYY (Day is p0)
                    day = p0;
                    month = p1;
                } else {
                    // Ambiguous (e.g. 05/06/2023). Prefer DD/MM/YYYY for this app context (Indian)
                    day = p0;
                    month = p1;
                }
            }
        }
        else {
            // YY format (e.g. 24)
            day = p0; month = p1; year = '20' + p2;
        }

        if (isNaN(Number(month)) && typeof month === 'string') {
             const mStr = month.toLowerCase().substring(0, 3);
             if (months[mStr]) month = months[mStr];
        }

        if (year && year.length === 2) year = '20' + year;
        
        const m = month ? month.toString().padStart(2, '0') : '00';
        const d = day ? day.toString().padStart(2, '0') : '00';
        
        if (isNaN(Number(year)) || isNaN(Number(m)) || isNaN(Number(d))) return '';
        if (Number(m) === 0 || Number(d) === 0) return '';

        return `${year}-${m}-${d}`;
    }
    return '';
};

export const formatLastSync = (isoString?: string) => {
    if (!isoString) return null;
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
