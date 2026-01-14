
import { getPersonalizedSuggestions } from "./src/utils/psgLogic";
import { UserProfile } from "./src/types";

// Mock Profiles
const aggressiveProfile: UserProfile = {
    id: "1",
    name: "Aggressive User",
    age: 25,
    experience: "Advanced",
    riskTolerance: "High",
    investmentGoals: ["Wealth Building", "Short Term Gains"],
    points: 100,
    lastLoginDate: new Date().toISOString(),
    portfolioValue: 10000,
    sectorPreferences: ["Technology", "Crypto"],
    email: "test@example.com"
};

const conservativeProfile: UserProfile = {
    id: "2",
    name: "Conservative User",
    age: 60,
    experience: "Beginner",
    riskTolerance: "Low",
    investmentGoals: ["Retirement", "Learning"],
    points: 100,
    lastLoginDate: new Date().toISOString(),
    portfolioValue: 50000,
    sectorPreferences: ["Health", "Consumer Staples"],
    email: "test2@example.com"
};

console.log("--- TEST: Aggressive Profile ---");
const aggressiveSuggestions = getPersonalizedSuggestions(aggressiveProfile);
aggressiveSuggestions.slice(0, 3).forEach(s => {
    console.log(`${s.symbol} (${s.score}): ${s.reason}`);
});

console.log("\n--- TEST: Conservative Profile ---");
const conservativeSuggestions = getPersonalizedSuggestions(conservativeProfile);
conservativeSuggestions.slice(0, 3).forEach(s => {
    console.log(`${s.symbol} (${s.score}): ${s.reason}`);
});
