
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
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) return dateStr;
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
        if (p0.length === 4) { year = p0; month = p1; day = p2; }
        else if (p2.length === 4) { day = p0; month = p1; year = p2; }
        else {
            day = p0; month = p1; year = '20' + p2;
        }
        if (isNaN(Number(month))) {
            const mStr = month.toLowerCase().substring(0, 3);
            if (months[mStr]) month = months[mStr];
            else return '';
        }
        if (year.length === 2) year = '20' + year;
        const m = month.toString().padStart(2, '0');
        const d = day.toString().padStart(2, '0');
        if (isNaN(Number(year)) || isNaN(Number(m)) || isNaN(Number(d))) return '';
        return `${year}-${m}-${d}`;
    }
    return '';
};

export const formatLastSync = (isoString?: string) => {
    if (!isoString) return null;
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
