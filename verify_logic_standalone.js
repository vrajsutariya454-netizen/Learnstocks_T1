
// Mock Data (Copied from stockData.ts)
const STOCK_DATA = [
    { symbol: "AAPL", name: "Apple", sector: "Technology", riskLevel: "Low", attributes: ["Growth"] },
    { symbol: "NVDA", name: "Nvidia", sector: "Technology", riskLevel: "High", attributes: ["Growth", "AI"] },
    { symbol: "KO", name: "Coke", sector: "Consumer Staples", riskLevel: "Low", attributes: ["Dividend", "Defensive"] },
    { symbol: "COIN", name: "Coinbase", sector: "Technology", riskLevel: "High", attributes: ["Crypto", "Speculative"] },
];

// Mock Logic (Simplified from psgLogic.ts to verify algorithm)
function getSuggestions(profile) {
    return STOCK_DATA.map(stock => {
        let score = 0;
        let reasons = [];

        // Risk
        if (profile.riskTolerance === stock.riskLevel) {
            score += 40;
            reasons.push(`Matches risk: ${stock.riskLevel}`);
        }

        // Sector
        if (profile.sectorPreferences.includes(stock.sector)) {
            score += 30;
            reasons.push(`Matches sector: ${stock.sector}`);
        }

        return { symbol: stock.symbol, score, reasons: reasons.join(", ") };
    }).sort((a, b) => b.score - a.score);
}

// Test Cases
const profile1 = { riskTolerance: "High", sectorPreferences: ["Technology"] };
const profile2 = { riskTolerance: "Low", sectorPreferences: ["Consumer Staples"] };

console.log("--- HIGH RISK / TECH USER ---");
console.log(getSuggestions(profile1).slice(0, 2));

console.log("\n--- LOW RISK / STAPLES USER ---");
console.log(getSuggestions(profile2).slice(0, 2));
