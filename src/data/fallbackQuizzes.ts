import { QuizQuestion } from "@/types";

export const FALLBACK_QUESTIONS_BASICS: QuizQuestion[] = [
    {
        id: "fb-1",
        text: "What does 'IPO' stand for?",
        options: [
            "Initial Public Offering",
            "Internal Profit Organization",
            "International Price Option",
            "Indian Public Office"
        ],
        correctOption: 0,
        explanation: "IPO stands for Initial Public Offering, representing the first time a company sells shares to the public.",
        difficulty: "Easy"
    },
    {
        id: "fb-2",
        text: "Which of these is considered a 'Bear Market'?",
        options: [
            "Prices are rising consistently",
            "Prices are falling consistently",
            "Prices are stagnant",
            "High volatility with no trend"
        ],
        correctOption: 1,
        explanation: "A Bear Market is characterized by falling share prices, typically exceeding a 20% decline.",
        difficulty: "Easy"
    },
    {
        id: "fb-3",
        text: "What is a 'Dividend'?",
        options: [
            "A tax paid to the government",
            "A fee paid to a broker",
            "A portion of company profits distributed to shareholders",
            "The price of a stock"
        ],
        correctOption: 2,
        explanation: "Dividends are payments made by a corporation to its shareholder members, usually from profits.",
        difficulty: "Easy"
    },
    {
        id: "fb-4",
        text: "What is the primary function of the SEBI in India?",
        options: [
            "Printing currency",
            "Regulating the securities market",
            "Collecting income tax",
            "Managing foreign relations"
        ],
        correctOption: 1,
        explanation: "The Securities and Exchange Board of India (SEBI) is the regulatory body for the securities and commodity market in India.",
        difficulty: "Medium"
    },
    {
        id: "fb-5",
        text: "Equity represents what in a company?",
        options: [
            "Debt",
            "Ownership",
            "Inventory",
            "Employee salaries"
        ],
        correctOption: 1,
        explanation: "Equity represents the amount of money that would be returned to a company's shareholders if all of the assets were liquidated and all of the company's debt was paid off.",
        difficulty: "Easy"
    }
];

export const FALLBACK_QUESTIONS_TECHNICAL: QuizQuestion[] = [
    {
        id: "ft-1",
        text: "What does 'RSI' stand for in technical analysis?",
        options: [
            "Relative Strength Index",
            "Rate of Stock Increase",
            "Real Stock Indicator",
            "Risk Standard Index"
        ],
        correctOption: 0,
        explanation: "RSI (Relative Strength Index) is a momentum indicator used to measure the speed and magnitude of a security's recent price changes.",
        difficulty: "Medium"
    },
    {
        id: "ft-2",
        text: "A 'Golden Cross' occurs when:",
        options: [
            "50-day MA crosses below 200-day MA",
            "50-day MA crosses above 200-day MA",
            "Price hits a 52-week low",
            "Price hits a 52-week high"
        ],
        correctOption: 1,
        explanation: "A Golden Cross is a bullish signal that occurs when a short-term moving average crosses above a long-term moving average.",
        difficulty: "Medium"
    },
    {
        id: "ft-3",
        text: "Which chart pattern typically indicates a reversal?",
        options: [
            "Head and Shoulders",
            "Flag",
            "Pennant",
            "Cup and Handle (continuation)"
        ],
        correctOption: 0,
        explanation: "The Head and Shoulders pattern is a chart formation that appears as a baseline with three peaks, predicting a bullish-to-bearish trend reversal.",
        difficulty: "Medium"
    },
    {
        id: "ft-4",
        text: "What is 'Support' in technical analysis?",
        options: [
            "A price level where a stock has difficulty falling below",
            "A price level where a stock has difficulty rising above",
            "The volume of shares traded",
            "The advice given by a broker"
        ],
        correctOption: 0,
        explanation: "Support is a price level where a downtrend can be expected to pause due to a concentration of demand (buying interest).",
        difficulty: "Easy"
    },
    {
        id: "ft-5",
        text: "Candlestick charts originated in which country?",
        options: [
            "USA",
            "UK",
            "Japan",
            "China"
        ],
        correctOption: 2,
        explanation: "Candlestick charts are thought to have been developed in the 18th century by Munehisa Homma, a Japanese rice trader.",
        difficulty: "Easy"
    }
];
