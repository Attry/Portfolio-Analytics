import { useState, useEffect } from 'react';
import { AssetContext, PortfolioSnapshot } from '../types';

export const getSnapshotStorageKey = (context: AssetContext | 'CONSOLIDATED') => {
    if (context === 'CONSOLIDATED') return 'portfolio_snapshots';
    return `portfolio_snapshots_${context.toLowerCase()}`;
};

export const useSnapshotData = (
    context: AssetContext | 'CONSOLIDATED',
    currentValue: number,
    totalInvested: number,
    xirr: number
) => {
    const storageKey = getSnapshotStorageKey(context);

    const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });

    // Keep snapshots in sync if localStorage changes or context changes
    useEffect(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            setSnapshots(saved ? JSON.parse(saved) : []);
        } catch {
            setSnapshots([]);
        }
    }, [storageKey]);

    const takeSnapshotNow = () => {
        try {
            const todayStr = new Date().toISOString().split('T')[0];
            const saved = localStorage.getItem(storageKey);
            const list: PortfolioSnapshot[] = saved ? JSON.parse(saved) : [];
            const existingIndex = list.findIndex(s => s.date === todayStr);

            let twr = 100;
            let lastSnapshot: PortfolioSnapshot | null = null;
            if (existingIndex >= 0) {
                lastSnapshot = existingIndex > 0 ? list[existingIndex - 1] : null;
            } else {
                lastSnapshot = list.length > 0 ? list[list.length - 1] : null;
            }

            if (lastSnapshot) {
                const prevVal = lastSnapshot.currentValue;
                const prevInvested = lastSnapshot.totalInvested;
                const prevTwr = lastSnapshot.twr;
                
                const deltaI = totalInvested - prevInvested;
                const adjustedStartValue = prevVal + deltaI;
                
                if (adjustedStartValue > 0) {
                    const periodReturn = (currentValue - adjustedStartValue) / adjustedStartValue;
                    twr = prevTwr * (1 + periodReturn);
                } else {
                    twr = prevTwr;
                }
            }

            const newSnapshot: PortfolioSnapshot = {
                date: todayStr,
                totalInvested,
                currentValue,
                xirr,
                twr: parseFloat(twr.toFixed(2))
            };

            if (existingIndex >= 0) {
                list[existingIndex] = newSnapshot;
            } else {
                list.push(newSnapshot);
            }

            const updated = list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            localStorage.setItem(storageKey, JSON.stringify(updated));
            setSnapshots([...updated]);
            console.log(`Manually logged snapshot for ${context} on ${todayStr} with value ${currentValue}, invested ${totalInvested}`);
            return true;
        } catch (e) {
            console.error(`Error taking snapshot for ${context}:`, e);
            return false;
        }
    };

    const seedDemoSnapshots = () => {
        try {
            const list: PortfolioSnapshot[] = [];
            const today = new Date();
            
            for (let i = 12; i >= 1; i--) {
                const snapDate = new Date();
                snapDate.setDate(today.getDate() - i * 7);
                const dateStr = snapDate.toISOString().split('T')[0];
                
                const ratio = (13 - i) / 12;
                const invested = Math.round(totalInvested * (0.8 + 0.2 * ratio));
                const performanceFactor = 0.95 + 0.15 * ratio + (Math.sin(i) * 0.03);
                const val = Math.round(invested * performanceFactor);
                
                let twr = 100;
                if (list.length > 0) {
                    const lastSnap = list[list.length - 1];
                    const deltaI = invested - lastSnap.totalInvested;
                    const adjustedStart = lastSnap.currentValue + deltaI;
                    if (adjustedStart > 0) {
                        twr = lastSnap.twr * (val / adjustedStart);
                    } else {
                        twr = lastSnap.twr;
                    }
                }
                
                const snapXirr = xirr * (0.8 + 0.4 * ratio);
                
                list.push({
                    date: dateStr,
                    totalInvested: invested,
                    currentValue: val,
                    xirr: snapXirr,
                    twr: parseFloat(twr.toFixed(2))
                });
            }
            
            const todayStr = today.toISOString().split('T')[0];
            let currentTwr = 100;
            if (list.length > 0) {
                const lastSnap = list[list.length - 1];
                const deltaI = totalInvested - lastSnap.totalInvested;
                const adjustedStart = lastSnap.currentValue + deltaI;
                if (adjustedStart > 0) {
                    currentTwr = lastSnap.twr * (currentValue / adjustedStart);
                } else {
                    currentTwr = lastSnap.twr;
                }
            }
            
            list.push({
                date: todayStr,
                totalInvested,
                currentValue,
                xirr,
                twr: parseFloat(currentTwr.toFixed(2))
            });
            
            localStorage.setItem(storageKey, JSON.stringify(list));
            setSnapshots(list);
            console.log(`Seeded demo snapshots for ${context}`);
        } catch (e) {
            console.error(`Error seeding demo snapshots for ${context}:`, e);
        }
    };

    const clearSnapshots = () => {
        try {
            localStorage.removeItem(storageKey);
            setSnapshots([]);
            console.log(`Cleared snapshots for ${context}`);
        } catch (e) {
            console.error(`Error clearing snapshots for ${context}:`, e);
        }
    };

    // Auto snapshot logging (primarily for active view when loaded)
    useEffect(() => {
        if (!currentValue || !totalInvested) return;

        const checkAndAutoSnapshot = () => {
            try {
                const saved = localStorage.getItem(storageKey);
                const list: PortfolioSnapshot[] = saved ? JSON.parse(saved) : [];
                
                const today = new Date();
                const todayStr = today.toISOString().split('T')[0];
                const isFriday = today.getDay() === 5;
                
                // For determining if we should log a brand new snapshot for a new interval
                let moreThanSevenDaysAgo = false;
                if (list.length > 0) {
                    // Filter out today's snapshot to find the actual last interval date
                    const historicalList = list.filter(s => s.date !== todayStr);
                    if (historicalList.length > 0) {
                        const lastDate = new Date(historicalList[historicalList.length - 1].date);
                        const diffTime = Math.abs(today.getTime() - lastDate.getTime());
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        if (diffDays >= 7) {
                            moreThanSevenDaysAgo = true;
                        }
                    } else {
                        moreThanSevenDaysAgo = true;
                    }
                } else {
                    moreThanSevenDaysAgo = true;
                }

                const existingIndex = list.findIndex(s => s.date === todayStr);
                const alreadyLoggedToday = existingIndex >= 0;

                // We want to auto-log if it's Friday or >= 7 days since last historical snapshot
                const isLoggingInterval = isFriday || moreThanSevenDaysAgo;

                // Helper to check if two values are practically different (rounding to 2 decimals & handling NaN safely)
                const valuesAreDifferent = (a: number, b: number) => {
                    const cleanA = isNaN(a) || !isFinite(a) ? 0 : parseFloat(a.toFixed(2));
                    const cleanB = isNaN(b) || !isFinite(b) ? 0 : parseFloat(b.toFixed(2));
                    return Math.abs(cleanA - cleanB) >= 0.01;
                };

                // We should write/update the snapshot if:
                // 1. It is a logging interval AND we haven't logged today yet.
                // 2. OR, we already logged today, but today's logged values are different from the current values (stale values from initial load/offline state)
                let shouldWrite = false;
                if (isLoggingInterval) {
                    if (!alreadyLoggedToday) {
                        shouldWrite = true;
                    } else {
                        const existing = list[existingIndex];
                        // If values are different, update today's snapshot to match the latest/live data
                        if (
                            valuesAreDifferent(existing.currentValue, currentValue) || 
                            valuesAreDifferent(existing.totalInvested, totalInvested) || 
                            valuesAreDifferent(existing.xirr, xirr)
                        ) {
                            shouldWrite = true;
                        }
                    }
                }

                if (shouldWrite) {
                    let twr = 100;
                    let lastSnapshot: PortfolioSnapshot | null = null;
                    if (existingIndex >= 0) {
                        lastSnapshot = existingIndex > 0 ? list[existingIndex - 1] : null;
                    } else {
                        lastSnapshot = list.length > 0 ? list[list.length - 1] : null;
                    }

                    const cleanCurrentValue = isNaN(currentValue) || !isFinite(currentValue) ? 0 : parseFloat(currentValue.toFixed(2));
                    const cleanTotalInvested = isNaN(totalInvested) || !isFinite(totalInvested) ? 0 : parseFloat(totalInvested.toFixed(2));
                    const cleanXirr = isNaN(xirr) || !isFinite(xirr) ? 0 : parseFloat(xirr.toFixed(2));

                    if (lastSnapshot) {
                        const prevVal = lastSnapshot.currentValue;
                        const prevInvested = lastSnapshot.totalInvested;
                        const prevTwr = lastSnapshot.twr;
                        
                        const deltaI = cleanTotalInvested - prevInvested;
                        const adjustedStartValue = prevVal + deltaI;
                        
                        if (adjustedStartValue > 0) {
                            const periodReturn = (cleanCurrentValue - adjustedStartValue) / adjustedStartValue;
                            twr = prevTwr * (1 + periodReturn);
                        } else {
                            twr = prevTwr;
                        }
                    }

                    if (isNaN(twr) || !isFinite(twr)) {
                        twr = 100;
                    }

                    const newSnapshot: PortfolioSnapshot = {
                        date: todayStr,
                        totalInvested: cleanTotalInvested,
                        currentValue: cleanCurrentValue,
                        xirr: cleanXirr,
                        twr: parseFloat(twr.toFixed(2))
                    };

                    if (existingIndex >= 0) {
                        list[existingIndex] = newSnapshot;
                    } else {
                        list.push(newSnapshot);
                    }

                    const updated = list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                    localStorage.setItem(storageKey, JSON.stringify(updated));
                    setSnapshots(updated);
                    console.log(`Automatically logged/updated snapshot for ${context} on ${todayStr} with value ${cleanCurrentValue}, invested ${cleanTotalInvested}`);
                }
            } catch (e) {
                console.error("Error in autoLogWeeklySnapshot:", e);
            }
        };

        checkAndAutoSnapshot();
    }, [context, currentValue, totalInvested, xirr, storageKey]);

    return {
        snapshots,
        takeSnapshotNow,
        seedDemoSnapshots,
        clearSnapshots
    };
};
