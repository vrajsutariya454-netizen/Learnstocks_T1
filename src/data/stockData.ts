
export interface StockMetadata {
    symbol: string;
    name: string;
    sector: string;
    basePrice: number;
    riskLevel: "Low" | "Medium" | "High";
    volatility: "Low" | "Medium" | "High";
    attributes: string[]; // e.g., "Dividend", "Growth", "Value", "Blue Chip", "Speculative", "Cyclical"
    description: string;
}

export const STOCK_DATA: StockMetadata[] = [
    // Technology
    { symbol: "AAPL", name: "Apple Inc.", sector: "Technology", basePrice: 175.0, riskLevel: "Low", volatility: "Medium", attributes: ["Blue Chip", "Growth", "Stable"], description: "Tech giant with robust ecosystem and steady growth." },
    { symbol: "MSFT", name: "Microsoft Corp.", sector: "Technology", basePrice: 380.0, riskLevel: "Low", volatility: "Medium", attributes: ["Blue Chip", "Cloud", "AI"], description: "Leader in enterprise software and cloud computing." },
    { symbol: "NVDA", name: "NVIDIA Corp.", sector: "Technology", basePrice: 850.0, riskLevel: "High", volatility: "High", attributes: ["Growth", "AI", "Semiconductors"], description: "Dominant player in AI and graphics chips." },
    { symbol: "GOOGL", name: "Alphabet Inc.", sector: "Technology", basePrice: 160.0, riskLevel: "Medium", volatility: "Medium", attributes: ["Growth", "Search", "AI"], description: "Market leader in search and digital advertising." },
    { symbol: "PLTR", name: "Palantir Technologies", sector: "Technology", basePrice: 24.0, riskLevel: "High", volatility: "High", attributes: ["Growth", "AI", "Speculative"], description: "Big data analytics software for government and enterprise." },
    { symbol: "AMD", name: "Advanced Micro Devices", sector: "Technology", basePrice: 170.0, riskLevel: "High", volatility: "High", attributes: ["Growth", "Semiconductors"], description: "High-performance computing and graphics solutions." },

    // Consumer Discretionary
    { symbol: "AMZN", name: "Amazon.com", sector: "Consumer Discretionary", basePrice: 180.0, riskLevel: "Medium", volatility: "Medium", attributes: ["Growth", "E-commerce", "Cloud"], description: "E-commerce and cloud computing behemoth." },
    { symbol: "TSLA", name: "Tesla Inc.", sector: "Consumer Discretionary", basePrice: 170.0, riskLevel: "High", volatility: "High", attributes: ["Growth", "EV", "Volatile"], description: "Electric vehicle and clean energy innovator." },
    { symbol: "NKE", name: "Nike Inc.", sector: "Consumer Discretionary", basePrice: 95.0, riskLevel: "Medium", volatility: "Low", attributes: ["Blue Chip", "Retail"], description: "Leading global sportswear and equipment brand." },
    { symbol: "SBUX", name: "Starbucks", sector: "Consumer Discretionary", basePrice: 92.0, riskLevel: "Medium", volatility: "Low", attributes: ["Blue Chip", "Retail", "Dividend"], description: "Premier roaster and retailer of specialty coffee." },

    // Finance
    { symbol: "JPM", name: "JPMorgan Chase", sector: "Financials", basePrice: 195.0, riskLevel: "Low", volatility: "Low", attributes: ["Blue Chip", "Value", "Dividend"], description: "Largest bank in the US with diverse financial services." },
    { symbol: "BAC", name: "Bank of America", sector: "Financials", basePrice: 36.0, riskLevel: "Low", volatility: "Medium", attributes: ["Value", "Dividend", "Stable"], description: "Major financial institution serving individuals and businesses." },
    { symbol: "V", name: "Visa Inc.", sector: "Financials", basePrice: 280.0, riskLevel: "Low", volatility: "Low", attributes: ["Growth", "Fintech", "Stable"], description: "Global payments technology company." },
    { symbol: "GS", name: "Goldman Sachs", sector: "Financials", basePrice: 390.0, riskLevel: "Medium", volatility: "High", attributes: ["Value", "Cyclical"], description: "Leading global investment banking and securities firm." },

    // Healthcare
    { symbol: "JNJ", name: "Johnson & Johnson", sector: "Healthcare", basePrice: 150.0, riskLevel: "Low", volatility: "Low", attributes: ["Blue Chip", "Dividend", "Defensive"], description: "Diversified healthcare giant known for stability." },
    { symbol: "PFE", name: "Pfizer Inc.", sector: "Healthcare", basePrice: 26.0, riskLevel: "Low", volatility: "Low", attributes: ["Value", "Dividend"], description: "Pharmaceutical corporation with global reach." },
    { symbol: "LLY", name: "Eli Lilly", sector: "Healthcare", basePrice: 780.0, riskLevel: "Medium", volatility: "Medium", attributes: ["Growth", "Pharma"], description: "Pharmaceutical leader with strong pipeline." },
    { symbol: "UNH", name: "UnitedHealth Group", sector: "Healthcare", basePrice: 480.0, riskLevel: "Low", volatility: "Medium", attributes: ["Blue Chip", "Growth", "Defensive"], description: "Diversified health care company." },

    // Energy
    { symbol: "XOM", name: "Exxon Mobil", sector: "Energy", basePrice: 115.0, riskLevel: "Medium", volatility: "Medium", attributes: ["Value", "Dividend", "Oil"], description: "Multinational oil and gas corporation." },
    { symbol: "CVX", name: "Chevron", sector: "Energy", basePrice: 155.0, riskLevel: "Medium", volatility: "Medium", attributes: ["Value", "Dividend", "Oil"], description: "Integrated energy company with strong balance sheet." },
    { symbol: "NEE", name: "NextEra Energy", sector: "Energy", basePrice: 65.0, riskLevel: "Medium", volatility: "Medium", attributes: ["Growth", "Utilities", "Renewable"], description: "Largest electric utility and renewable energy generator." },

    // Industrial
    { symbol: "BA", name: "Boeing", sector: "Industrials", basePrice: 180.0, riskLevel: "High", volatility: "High", attributes: ["Recovery", "Aerospace"], description: "Leading aerospace manufacturer." },
    { symbol: "CAT", name: "Caterpillar", sector: "Industrials", basePrice: 350.0, riskLevel: "Medium", volatility: "Medium", attributes: ["Blue Chip", "Value", "Cyclical"], description: "Construction and mining equipment manufacturer." },
    { symbol: "GE", name: "General Electric", sector: "Industrials", basePrice: 170.0, riskLevel: "Medium", volatility: "Medium", attributes: ["Value", "Cyclical"], description: "High-tech industrial company." },

    // Consumer Staples
    { symbol: "KO", name: "Coca-Cola", sector: "Consumer Staples", basePrice: 60.0, riskLevel: "Low", volatility: "Low", attributes: ["Blue Chip", "Dividend", "Defensive"], description: "Global non-alcoholic beverage leader." },
    { symbol: "PG", name: "Procter & Gamble", sector: "Consumer Staples", basePrice: 165.0, riskLevel: "Low", volatility: "Low", attributes: ["Blue Chip", "Dividend", "Defensive"], description: "Consumer goods corporation with trusted brands." },
    { symbol: "WMT", name: "Walmart", sector: "Consumer Staples", basePrice: 60.0, riskLevel: "Low", volatility: "Low", attributes: ["Blue Chip", "Value", "Defensive"], description: "Multinational retail corporation." },

    // Crypto / Risky
    { symbol: "COIN", name: "Coinbase", sector: "Technology", basePrice: 240.0, riskLevel: "High", volatility: "High", attributes: ["Crypto", "Speculative", "Growth"], description: "Leading cryptocurrency exchange platform." },
    { symbol: "BITO", name: "Bitcoin Strategy ETF", sector: "Technology", basePrice: 30.0, riskLevel: "High", volatility: "High", attributes: ["Crypto", "Speculative"], description: "Bitcoin-linked ETF." },

    // Indian Stocks (NSE) - Blue Chips & Majors
    { symbol: "RELIANCE", name: "Reliance Industries", sector: "Energy", basePrice: 2900.0, riskLevel: "Low", volatility: "Medium", attributes: ["Blue Chip", "Conglomerate", "Growth"], description: "Largest Indian conglomerate in Oil, Retail, and Telecom." },
    { symbol: "TCS", name: "Tata Consultancy Services", sector: "Technology", basePrice: 4000.0, riskLevel: "Low", volatility: "Low", attributes: ["Blue Chip", "Dividend", "Tech"], description: "Global IT services and consulting leader." },
    { symbol: "HDFCBANK", name: "HDFC Bank", sector: "Financials", basePrice: 1500.0, riskLevel: "Low", volatility: "Medium", attributes: ["Blue Chip", "Value", "Banking"], description: "Indias largest private sector bank." },
    { symbol: "INFY", name: "Infosys", sector: "Technology", basePrice: 1600.0, riskLevel: "Medium", volatility: "Medium", attributes: ["Blue Chip", "Tech", "Dividend"], description: "Digital services and consulting major." },
    { symbol: "ICICIBANK", name: "ICICI Bank", sector: "Financials", basePrice: 1100.0, riskLevel: "Medium", volatility: "Medium", attributes: ["Growth", "Banking"], description: "Leading private sector bank in India." },
    { symbol: "HINDUNILVR", name: "Hindustan Unilever", sector: "Consumer Staples", basePrice: 2400.0, riskLevel: "Low", volatility: "Low", attributes: ["Defensive", "Dividend", "FMCG"], description: "Indias largest FMCG company." },
    { symbol: "ITC", name: "ITC Ltd", sector: "Consumer Staples", basePrice: 430.0, riskLevel: "Low", volatility: "Low", attributes: ["Dividend", "Value", "Defensive"], description: "Diversified conglomerate known for FMCG and Hotels." },
    { symbol: "SBIN", name: "State Bank of India", sector: "Financials", basePrice: 750.0, riskLevel: "Medium", volatility: "High", attributes: ["Value", "PSU", "Banking"], description: "Largest public sector bank in India." },
    { symbol: "BHARTIARTL", name: "Bharti Airtel", sector: "Communication", basePrice: 1200.0, riskLevel: "Medium", volatility: "Medium", attributes: ["Growth", "Telecom"], description: "Leading global telecommunications company." },
    { symbol: "LT", name: "Larsen & Toubro", sector: "Industrials", basePrice: 3600.0, riskLevel: "Medium", volatility: "Medium", attributes: ["Blue Chip", "Infra", "Construction"], description: "Engineering and construction conglomerate." },
    { symbol: "TATAMOTORS", name: "Tata Motors", sector: "Consumer Discretionary", basePrice: 980.0, riskLevel: "High", volatility: "High", attributes: ["Growth", "EV", "Auto"], description: "Leading automobile manufacturer, owner of JLR." },
    { symbol: "BAJFINANCE", name: "Bajaj Finance", sector: "Financials", basePrice: 7200.0, riskLevel: "High", volatility: "High", attributes: ["Growth", "Fintech"], description: "Major non-banking financial company." },
    { symbol: "ASIANPAINT", name: "Asian Paints", sector: "Materials", basePrice: 2900.0, riskLevel: "Low", volatility: "Medium", attributes: ["Blue Chip", "Market Leader"], description: "Indias largest paint company." },
    { symbol: "MARUTI", name: "Maruti Suzuki", sector: "Consumer Discretionary", basePrice: 12000.0, riskLevel: "Medium", volatility: "Medium", attributes: ["Blue Chip", "Auto"], description: "Leader in the Indian passenger car market." },
    { symbol: "TITAN", name: "Titan Company", sector: "Consumer Discretionary", basePrice: 3700.0, riskLevel: "Medium", volatility: "High", attributes: ["Growth", "Retail", "Luxury"], description: "Lifestyle company known for watches and jewelry." },
    { symbol: "SUNPHARMA", name: "Sun Pharma", sector: "Healthcare", basePrice: 1550.0, riskLevel: "Medium", volatility: "Medium", attributes: ["Defensive", "Pharma"], description: "Major specialty company." },
    { symbol: "ADANIENT", name: "Adani Enterprises", sector: "Industrials", basePrice: 3200.0, riskLevel: "High", volatility: "High", attributes: ["Growth", "Volatile", "Infra"], description: "Incubator for Adani Groups new businesses." },
];
