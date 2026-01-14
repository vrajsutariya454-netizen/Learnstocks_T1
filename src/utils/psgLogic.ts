
import { UserProfile, StockSuggestion } from "@/types";
import { STOCK_DATA, StockMetadata } from "@/data/stockData";

export const getPersonalizedSuggestions = (profile: UserProfile, marketPreference: "Global" | "US" | "India" = "Global"): StockSuggestion[] => {
    if (!profile) return [];

    let filteredStocks = STOCK_DATA;
    if (marketPreference !== "Global") {
        filteredStocks = STOCK_DATA.filter(s => s.market === marketPreference);
    }

    const scoredStocks = filteredStocks.map((stock) => {
        let score = 0;
        const reasons: string[] = [];

        // 1. Risk Tolerance Matching
        if (profile.riskTolerance === "Low") {
            if (stock.riskLevel === "Low") {
                score += 40;
                reasons.push("Aligns with your low risk tolerance");
            } else if (stock.riskLevel === "Medium") {
                score += 10;
            } else {
                score -= 20; // Penalize high risk
            }
        } else if (profile.riskTolerance === "Medium") {
            if (stock.riskLevel === "Medium") {
                score += 40;
                reasons.push("Matches your balanced risk profile");
            } else if (stock.riskLevel === "Low") {
                score += 20;
                reasons.push("Provides stability");
            } else {
                score += 10; // Accept some high risk
            }
        } else if (profile.riskTolerance === "High") {
            if (stock.riskLevel === "High") {
                score += 40;
                reasons.push("Fits your aggressive growth strategy");
            } else if (stock.riskLevel === "Medium") {
                score += 20;
            } else {
                score += 0; // Low risk is boring but okay
            }
        }

        // 2. Sector Preferences
        if (profile.sectorPreferences && profile.sectorPreferences.includes(stock.sector)) {
            score += 30;
            reasons.push(`You expressed interest in the ${stock.sector} sector`);
        }

        // 3. Investment Goals Matching
        const goals = profile.investmentGoals || [];

        if (goals.includes("Wealth Building")) {
            if (stock.attributes.includes("Growth")) {
                score += 15;
                if (!reasons.includes("Strong growth potential")) reasons.push("Strong growth potential");
            }
            if (stock.attributes.includes("Blue Chip")) {
                score += 10;
            }
        }

        if (goals.includes("Retirement")) {
            if (stock.attributes.includes("Dividend")) {
                score += 25;
                reasons.push("Pays dividends for retirement income");
            }
            if (stock.attributes.includes("Stable") || stock.attributes.includes("Defensive")) {
                score += 15;
            }
        }

        if (goals.includes("Short Term Gains")) {
            if (stock.volatility === "High" || stock.attributes.includes("Volatile")) {
                score += 25;
                reasons.push("High volatility offers short-term trading opportunities");
            }
            if (stock.attributes.includes("Growth")) {
                score += 10;
            }
        }

        if (goals.includes("Learning")) {
            if (stock.attributes.includes("Blue Chip")) {
                score += 10;
                reasons.push("Great foundational stock for learning");
            }
        }

        // 4. Experience Level Adjustments
        if (profile.experience === "Beginner") {
            if (stock.attributes.includes("Speculative") || stock.attributes.includes("Crypto")) {
                score -= 15; // Protect beginners
            }
            if (stock.attributes.includes("Blue Chip")) {
                score += 10;
            }
        }

        // Calculate dynamic potential gain (simulation)
        // In a real app, this would come from an API based on analyst targets
        let potentialGain = 0;
        if (stock.riskLevel === "High") potentialGain = 0.15 + Math.random() * 0.20; // 15-35%
        else if (stock.riskLevel === "Medium") potentialGain = 0.08 + Math.random() * 0.12; // 8-20%
        else potentialGain = 0.03 + Math.random() * 0.07; // 3-10%

        // Simulate a small daily price variation so it looks "live"
        const randomVariation = (Math.random() - 0.5) * 0.02; // +/- 1%
        const currentPrice = stock.basePrice * (1 + randomVariation);

        // Draft the main reason string
        let mainReason = stock.description;
        if (reasons.length > 0) {
            if (reasons.length === 1) mainReason = reasons[0];
            else mainReason = `${reasons[0]} and ${reasons[1].toLowerCase()}`;
        }

        return {
            stockId: stock.symbol, // Using symbol as ID for simplicity
            symbol: stock.symbol,
            name: stock.name,
            currentPrice: currentPrice,
            reason: mainReason,
            riskLevel: stock.riskLevel,
            potentialGain: potentialGain,
            score: Math.min(score, 100),
            reasonings: reasons
        } as StockSuggestion;
    });

    // Sort by score descending
    return scoredStocks.sort((a, b) => (b.score || 0) - (a.score || 0));
};
