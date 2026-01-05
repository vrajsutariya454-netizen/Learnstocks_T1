import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import NavigationBar from "@/components/NavigationBar";
import StockQuiz from "@/components/StockQuiz";
import KnowledgeProgressChart from "@/components/KnowledgeProgressChart";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { GamepadIcon, Trophy, BookOpen, Brain, Timer } from "lucide-react";
import { toast } from "sonner";
import { Quiz, QuizQuestion } from "@/types";
// Replaced mockStocks with the expanded real NSE universe provided by user
const predictionUniverse = [
  "ETERNAL.NS",
  "RELIANCE.NS",
  "TCS.NS",
  "HDFCBANK.NS",
  "INFY.NS",
  "ICICIBANK.NS",
  "HINDUNILVR.NS",
  "SBIN.NS",
  "BHARTIARTL.NS",
  "ITC.NS",
  "KOTAKBANK.NS",
  "LT.NS",
  "BAJFINANCE.NS",
  "AXISBANK.NS",
  "ASIANPAINT.NS",
  "MARUTI.NS",
  "WIPRO.NS",
  "ADANIENT.NS",
  "ULTRACEMCO.NS",
  "NESTLEIND.NS",
  "ONGC.NS",
];
// Lightweight metadata cache (name filled later from live price response)
type BasicStock = { symbol: string; name?: string };
const baseStocks: BasicStock[] = predictionUniverse.map((s) => ({
  symbol: s.replace(".NS", ""),
  name: s.replace(".NS", ""),
}));
import TradeDialog from "@/components/TradeDialog";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { useBalanceStore } from "@/stores/balanceStore";
import { useAuth } from "@/contexts/AuthContext";
import StockCard from "@/components/StockCard";
import useLivePrices from "@/hooks/useLivePrices";
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Badge as BadgeIcon,
} from "lucide-react";
import { useMarketChallengeStore } from "@/stores/marketChallengeStore";
import type { PredictionDirection } from "@/stores/marketChallengeStore";
import { supabase } from "@/integrations/supabase/client";
import { useGamePointsStore } from "@/stores/gamePointsStore";
import { isNSEMarketOpen, marketStatusMessage } from "@/lib/marketHours";
import {
  calculateQuizActivityScore,
  detectOverallTrend,
  fetchKnowledgeProgressSeries,
  logGameActivity,
  updateKnowledgeProgress,
} from "@/lib/knowledgeProgress";
import type {
  DifficultyLevel,
  KnowledgeProgressPoint,
  KnowledgeTrend,
} from "@/types";

// ==                         QUESTION POOLS                          ==

// --- 100 Questions for Stock Market Basics ---
const allBasicsQuestions: QuizQuestion[] = [
  {
    id: "b1",
    text: "What is a stock?",
    options: [
      "A type of bond issued by companies",
      "A unit of ownership in a company",
      "A loan given to a company",
      "A government security",
    ],
    correctOption: 1,
    explanation: "A stock represents a share of ownership in a company.",
    difficulty: "Easy",
  },
  {
    id: "b2",
    text: "What is a bull market?",
    options: [
      "A market where stock prices are falling",
      "A market dominated by aggressive trading",
      "A market where stock prices are rising",
      "A market with high volatility",
    ],
    correctOption: 2,
    explanation:
      "A bull market is characterized by a sustained rise in market prices.",
    difficulty: "Easy",
  },
  {
    id: "b3",
    text: "What is a dividend?",
    options: [
      "A fee charged by brokers",
      "A portion of profits paid to shareholders",
      "The difference between buy and sell price",
      "A type of market order",
    ],
    correctOption: 1,
    explanation:
      "A dividend is a distribution of a portion of a company's earnings to its shareholders.",
    difficulty: "Easy",
  },
  {
    id: "b4",
    text: "What does P/E ratio stand for?",
    options: [
      "Profit/Earnings ratio",
      "Price/Earnings ratio",
      "Potential/Expected ratio",
      "Performance/Efficiency ratio",
    ],
    correctOption: 1,
    explanation:
      "Price-to-Earnings (P/E) ratio is a valuation ratio of a company's current share price compared to its per-share earnings.",
    difficulty: "Medium",
  },
  {
    id: "b5",
    text: "What is market capitalization?",
    options: [
      "The total value of a company's assets",
      "The total value of a company's outstanding shares",
      "The maximum price of a stock in the past year",
      "The total debt of a company",
    ],
    correctOption: 1,
    explanation:
      "Market capitalization is the total value of a company's outstanding shares.",
    difficulty: "Easy",
  },
  {
    id: "b6",
    text: "When you buy one share of a company's stock, you become:",
    options: [
      "A partial owner of the company",
      "A lender to the company",
      "A company employee",
      "A mandatory board member",
    ],
    correctOption: 0,
    explanation: "Buying one share means you own a fraction of that company.",
    difficulty: "Easy",
  },
  {
    id: "b7",
    text: "Why do private companies typically decide to go public with an IPO?",
    options: [
      "To avoid taxes on profits",
      "To raise capital for growth and expansion",
      "To convert to a cooperative",
      "To limit the number of shareholders",
    ],
    correctOption: 1,
    explanation: "The primary reason for an IPO is to raise funds for growth.",
    difficulty: "Easy",
  },
  {
    id: "b8",
    text: "What happens during a 2-for-1 forward stock split?",
    options: [
      "Each existing share is split into 2 shares, halving the price of each share",
      "Number of shares is cut in half, doubling the price",
      "Total market value of your holding doubles",
      "Company issues extra shares as dividends",
    ],
    correctOption: 0,
    explanation:
      "In a stock split, the number of shares increases but the price per share decreases proportionally.",
    difficulty: "Medium",
  },
  {
    id: "b9",
    text: "Which type of risk can be reduced through diversification of a portfolio?",
    options: [
      "Systematic (market) risk",
      "Unsystematic (company-specific) risk",
      "Inflation risk",
      "Currency risk",
    ],
    correctOption: 1,
    explanation:
      "Diversification helps reduce unsystematic risk (company- or sector-specific).",
    difficulty: "Medium",
  },
  {
    id: "b10",
    text: "Which order type allows you to specify the maximum price you are willing to pay when buying a stock?",
    options: [
      "Market order",
      "Stop order",
      "Limit order",
      "Fill-or-kill order",
    ],
    correctOption: 2,
    explanation:
      "A limit order lets you set the maximum buying price (or minimum selling price).",
    difficulty: "Easy",
  },
  {
    id: "b11",
    text: "Trading on margin means:",
    options: [
      "Borrowing funds from a broker to buy securities, magnifying gains and losses",
      "Trading only government bonds",
      "Buying stocks with cash only",
      "Agreeing to hold a stock for at least one year",
    ],
    correctOption: 0,
    explanation:
      "Margin trading involves borrowing money from brokers to buy more shares.",
    difficulty: "Medium",
  },
  {
    id: "b12",
    text: "The Nifty 50 index represents:",
    options: [
      "The 50 most actively traded global stocks",
      "50 large-cap Indian companies listed on NSE",
      "50 top-performing startups in India",
      "The 50 largest banks in India",
    ],
    correctOption: 1,
    explanation:
      "The Nifty 50 tracks 50 large-cap companies across sectors listed on the NSE.",
    difficulty: "Easy",
  },
  {
    id: "b13",
    text: "What is the main role of SEBI in India?",
    options: [
      "To regulate and protect investors in the securities market",
      "To provide loans to listed companies",
      "To set interest rates for banks",
      "To issue government bonds",
    ],
    correctOption: 0,
    explanation:
      "SEBI (Securities and Exchange Board of India) regulates securities markets and safeguards investor interests.",
    difficulty: "Easy",
  },
  {
    id: "b14",
    text: "Which of the following best describes an ETF (Exchange Traded Fund)?",
    options: [
      "A mutual fund that trades on stock exchanges like a stock",
      "A private loan issued by banks",
      "A type of government bond",
      "A company's retained earnings",
    ],
    correctOption: 0,
    explanation:
      "ETFs are investment funds traded on exchanges, combining features of mutual funds and stocks.",
    difficulty: "Easy",
  },
  {
    id: "b15",
    text: "If a company's share price is ₹100 and it has 1 crore shares outstanding, its market cap is:",
    options: ["₹10 crores", "₹100 crores", "₹1,000 crores", "₹1 crore"],
    correctOption: 1,
    explanation:
      "Market cap = Price × Outstanding shares = 100 × 1 crore = ₹100 crores.",
    difficulty: "Easy",
  },
  {
    id: "b16",
    text: "A stock with a beta greater than 1 indicates:",
    options: [
      "The stock is less volatile than the market",
      "The stock moves opposite to the market",
      "The stock is more volatile than the market",
      "The stock has no correlation with the market",
    ],
    correctOption: 2,
    explanation:
      "A beta >1 means the stock amplifies market movements, rising or falling more sharply.",
    difficulty: "Medium",
  },
  {
    id: "b17",
    text: "What is short selling?",
    options: [
      "Selling a stock you don't own, hoping to buy it back later at a lower price",
      "Selling shares immediately after an IPO",
      "Selling stocks after a dividend is declared",
      "Selling only penny stocks",
    ],
    correctOption: 0,
    explanation:
      "Short selling involves borrowing shares, selling them, and repurchasing later at (hopefully) a lower price.",
    difficulty: "Medium",
  },
  {
    id: "b18",
    text: "What is a 'blue-chip stock'?",
    options: [
      "High-value government bonds",
      "Stocks of large, financially stable, and reputable companies",
      "Stocks that always pay dividends",
      "Technology sector stocks only",
    ],
    correctOption: 1,
    explanation:
      "Blue-chip stocks are from well-established, financially sound companies with reliable performance.",
    difficulty: "Easy",
  },
  {
    id: "b19",
    text: "Which financial statement shows a company's assets, liabilities, and equity?",
    options: [
      "Cash flow statement",
      "Balance sheet",
      "Income statement",
      "Equity statement",
    ],
    correctOption: 1,
    explanation:
      "The Balance Sheet provides a snapshot of a company's financial position at a single point in time.",
    difficulty: "Easy",
  },
  {
    id: "b20",
    text: "What is the role of a stock exchange like NSE or BSE?",
    options: [
      "To lend money to companies",
      "To provide a platform for buying and selling securities",
      "To decide which companies are profitable",
      "To regulate bank interest rates",
    ],
    correctOption: 1,
    explanation:
      "Exchanges provide the infrastructure and platforms for investors to trade securities.",
    difficulty: "Easy",
  },
  {
    id: "b21",
    text: "What does liquidity of a stock mean?",
    options: [
      "The speed at which it can be bought or sold without affecting its price",
      "The company's total profits",
      "Its ability to pay dividends",
      "The stability of its stock price",
    ],
    correctOption: 0,
    explanation:
      "Liquidity measures how easily an asset can be converted to cash without significant price changes.",
    difficulty: "Medium",
  },
  {
    id: "b22",
    text: "What does an index fund do?",
    options: [
      "Attempts to outperform the market with active management",
      "Tracks and replicates the performance of a specific market index",
      "Only invests in Initial Public Offerings (IPOs)",
      "Invests exclusively in government bonds",
    ],
    correctOption: 1,
    explanation:
      "Index funds aim to mirror the performance of a market index like the Nifty 50 or S&P 500.",
    difficulty: "Easy",
  },
  {
    id: "b23",
    text: "What is meant by market volatility?",
    options: [
      "Changes in interest rates set by the RBI",
      "The rate and magnitude of stock price fluctuations",
      "The volume of company earnings reports",
      "The total number of traded shares",
    ],
    correctOption: 1,
    explanation:
      "Volatility refers to how much and how quickly stock prices move up or down over time.",
    difficulty: "Easy",
  },
  {
    id: "b24",
    text: "What is a circuit breaker in stock markets?",
    options: [
      "A limit placed to temporarily halt trading during extreme price swings",
      "A device used to prevent power outages at stock exchanges",
      "A regulatory limit on how many dividends a company can pay",
      "An order to automatically sell all stocks in a portfolio",
    ],
    correctOption: 0,
    explanation:
      "Circuit breakers are regulatory measures that temporarily halt trading on an exchange to curb panic-selling.",
    difficulty: "Medium",
  },
  {
    id: "b25",
    text: "What does the term 'insider trading' refer to?",
    options: [
      "Legally buying stocks of the company you work for",
      "Using non-public, confidential information to trade securities",
      "Trading tips shared by government insiders",
      "Trading only stocks within your country's borders",
    ],
    correctOption: 1,
    explanation:
      "Insider trading is the illegal practice of trading based on material non-public information.",
    difficulty: "Easy",
  },
  {
    id: "b26",
    text: "Which index represents the top 30 companies listed on the Bombay Stock Exchange?",
    options: [
      "Nifty 50",
      "BSE Sensex",
      "Dow Jones Industrial Average",
      "FTSE 100",
    ],
    correctOption: 1,
    explanation:
      "The Sensex is the benchmark index of the BSE, comprising 30 of the largest and most actively-traded stocks.",
    difficulty: "Easy",
  },
  {
    id: "b27",
    text: "What is a Demat Account?",
    options: [
      "A type of savings account for traders",
      "An account to hold financial securities in electronic form",
      "A loan account for buying stocks on margin",
      "An account for receiving dividends only",
    ],
    correctOption: 1,
    explanation:
      "A Demat (Dematerialized) Account is used to hold shares and securities in an electronic format.",
    difficulty: "Easy",
  },
  {
    id: "b28",
    text: "What is a 'bear market'?",
    options: [
      "A market where prices are expected to rise",
      "A market where prices have fallen 20% or more from recent highs",
      "A market with low trading volume",
      "A market for agricultural commodities",
    ],
    correctOption: 1,
    explanation:
      "A bear market is characterized by prolonged price declines and widespread pessimism.",
    difficulty: "Easy",
  },
  {
    id: "b29",
    text: "What is an 'arbitrage' opportunity?",
    options: [
      "A risky investment in a startup company",
      "A government-sponsored investment scheme",
      "Simultaneously buying and selling an asset in different markets to profit from a price difference",
      "A type of high-frequency trading algorithm",
    ],
    correctOption: 2,
    explanation:
      "Arbitrage exploits small price differences of the same asset in different markets.",
    difficulty: "Medium",
  },
  {
    id: "b30",
    text: "What is a 'penny stock'?",
    options: [
      "A stock that costs exactly one penny",
      "A stock issued by a new company",
      "A stock with a very small market capitalization that trades at a low price",
      "A stock that is guaranteed to increase in value",
    ],
    correctOption: 2,
    explanation:
      "Penny stocks are low-priced, speculative stocks of small companies.",
    difficulty: "Easy",
  },
  {
    id: "b31",
    text: "What is a rights issue?",
    options: [
      "An issue of shares to the general public",
      "An invitation to existing shareholders to purchase additional new shares",
      "A legal dispute over share ownership",
      "The first time a company offers stock",
    ],
    correctOption: 1,
    explanation:
      "A rights issue gives existing shareholders the right to buy new shares, usually at a discount.",
    difficulty: "Medium",
  },
  {
    id: "b32",
    text: "What does the term 'Face Value' of a stock mean?",
    options: [
      "The current market price of the stock",
      "The original cost of the stock as stated in the certificate",
      "The average price over the last 52 weeks",
      "The price after paying brokerage",
    ],
    correctOption: 1,
    explanation:
      "Face value is the nominal value of a security as stated by its issuer, and is not affected by market price.",
    difficulty: "Medium",
  },
  {
    id: "b33",
    text: "What is a 'stop-loss' order?",
    options: [
      "An order to buy a stock when it reaches a certain price",
      "An order placed with a broker to sell a security when it reaches a certain price",
      "An order to stop all trading activity",
      "A limit on the amount of loss a company can report",
    ],
    correctOption: 1,
    explanation:
      "A stop-loss order is designed to limit an investor's loss on a security position.",
    difficulty: "Easy",
  },
  {
    id: "b34",
    text: "What are 'promoters' in the context of a company?",
    options: [
      "Marketing agents for a company's products",
      "The individuals or entities who originally form a company",
      "Stockbrokers who promote specific stocks",
      "Financial journalists",
    ],
    correctOption: 1,
    explanation:
      "Promoters are the founders who undertake the formation of a company and its initial financing.",
    difficulty: "Medium",
  },
  {
    id: "b35",
    text: "What does 'portfolio' mean in investing?",
    options: [
      "A single high-value stock",
      "The briefcase used by a stockbroker",
      "A collection or group of financial assets like stocks, bonds, and cash",
      "A company's annual financial report",
    ],
    correctOption: 2,
    explanation:
      "A portfolio is the collection of all of an investor's assets.",
    difficulty: "Easy",
  },
  {
    id: "b36",
    text: "What is a mutual fund?",
    options: [
      "A fund managed by a group of friends",
      "A professionally managed investment fund that pools money from many investors to purchase securities",
      "A government fund for infrastructure projects",
      "A type of insurance policy",
    ],
    correctOption: 1,
    explanation:
      "Mutual funds allow small investors to access a diversified portfolio of assets.",
    difficulty: "Easy",
  },
  {
    id: "b37",
    text: "What is the 'bid price'?",
    options: [
      "The price a seller is willing to accept for a security",
      "The price a buyer is willing to pay for a security",
      "The price at which the last trade occurred",
      "The average price of a security",
    ],
    correctOption: 1,
    explanation:
      "The bid price is the highest price a buyer will pay for a stock.",
    difficulty: "Easy",
  },
  {
    id: "b38",
    text: "What is the 'ask price'?",
    options: [
      "The price a seller is willing to accept for a security",
      "The price a buyer is willing to pay for a security",
      "The price at which the last trade occurred",
      "The average price of a security",
    ],
    correctOption: 0,
    explanation:
      "The ask price is the lowest price a seller will accept for a stock.",
    difficulty: "Easy",
  },
  {
    id: "b39",
    text: "The difference between the bid and ask price is known as the...",
    options: ["Spread", "Margin", "Gap", "Commission"],
    correctOption: 0,
    explanation: "The bid-ask spread is a key measure of a stock's liquidity.",
    difficulty: "Easy",
  },
  {
    id: "b40",
    text: "What does IPO stand for?",
    options: [
      "Internal Profit Obligation",
      "Initial Public Offering",
      "Immediate Payment Order",
      "International Portfolio Organization",
    ],
    correctOption: 1,
    explanation:
      "An Initial Public Offering (IPO) is the process by which a private company can go public by sale of its stocks to the general public.",
    difficulty: "Easy",
  },
  {
    id: "b41",
    text: "What is 'equity'?",
    options: [
      "A company's total debt",
      "The value of the shares issued by a company",
      "The cash held by a company",
      "The interest paid on a bond",
    ],
    correctOption: 1,
    explanation:
      "Equity represents the shareholders' stake in the company, or ownership.",
    difficulty: "Easy",
  },
  {
    id: "b42",
    text: "What are 'derivatives' in finance?",
    options: [
      "Stocks of newly formed companies",
      "Financial securities with a value that is reliant upon an underlying asset or group of assets",
      "A type of dividend payment",
      "Government-issued currency",
    ],
    correctOption: 1,
    explanation:
      "Derivatives are contracts whose value is derived from an underlying asset, like a stock or commodity.",
    difficulty: "Medium",
  },
  {
    id: "b43",
    text: "Which type of stock typically does not offer voting rights?",
    options: [
      "Common Stock",
      "Promoter Shares",
      "Preferred Stock",
      "Bonus Shares",
    ],
    correctOption: 2,
    explanation:
      "Preferred stockholders generally have no or limited voting rights, but have a higher claim on assets and earnings.",
    difficulty: "Medium",
  },
  {
    id: "b44",
    text: "What is a stockbroker?",
    options: [
      "A person who owns more than 10% of a company",
      "A regulated professional who buys and sells shares on behalf of clients",
      "A government official who regulates the stock market",
      "An analyst who writes reports on stocks",
    ],
    correctOption: 1,
    explanation:
      "A stockbroker acts as an intermediary between an investor and a stock exchange.",
    difficulty: "Easy",
  },
  {
    id: "b45",
    text: "What is a 'Bonus Issue' of shares?",
    options: [
      "Shares given as a performance bonus to employees",
      "An issue of free additional shares to existing shareholders",
      "Shares sold at a premium price",
      "The first batch of shares sold in an IPO",
    ],
    correctOption: 1,
    explanation:
      "A bonus issue is when a company distributes additional shares to its existing shareholders free of cost.",
    difficulty: "Medium",
  },
  {
    id: "b46",
    text: "What does 'Day Trading' mean?",
    options: [
      "Trading only during the daytime",
      "The practice of buying and selling financial instruments within the same trading day",
      "A strategy of holding stocks for many years",
      "Trading stocks from different countries every day",
    ],
    correctOption: 1,
    explanation:
      "Day traders aim to profit from small price movements within a single day.",
    difficulty: "Easy",
  },
  {
    id: "b47",
    text: "What is a 'Growth Stock'?",
    options: [
      "A stock that pays high dividends",
      "A stock from a company that is expected to grow at an above-average rate compared to other companies",
      "A stock that has been growing for 10 consecutive years",
      "A stock in the agricultural sector",
    ],
    correctOption: 1,
    explanation:
      "Growth stocks often reinvest earnings for expansion rather than paying dividends.",
    difficulty: "Easy",
  },
  {
    id: "b48",
    text: "What is a 'Value Stock'?",
    options: [
      "A stock that is considered very expensive",
      "A stock that trades at a lower price compared to its fundamentals, such as earnings and sales",
      "A stock that guarantees a certain value",
      "A stock in the retail sector",
    ],
    correctOption: 1,
    explanation:
      "Value investors seek stocks they believe the market has undervalued.",
    difficulty: "Easy",
  },
  {
    id: "b49",
    text: "What is an 'Expense Ratio' for a mutual fund?",
    options: [
      "The ratio of winning trades to losing trades",
      "The annual cost of running the fund, expressed as a percentage of assets",
      "The ratio of stocks to bonds in the fund",
      "The expected return of the fund",
    ],
    correctOption: 1,
    explanation:
      "A lower expense ratio means more of the fund's returns are passed on to the investors.",
    difficulty: "Easy",
  },
  {
    id: "b50",
    text: "Who is the current governor of the Reserve Bank of India (RBI)?",
    options: [
      "Nirmala Sitharaman",
      "Urjit Patel",
      "Shaktikanta Das",
      "Raghuram Rajan",
    ],
    correctOption: 2,
    explanation:
      "Shaktikanta Das is the current governor of the RBI, which plays a key role in India's monetary policy.",
    difficulty: "Easy",
  },
  {
    id: "b51",
    text: "What does CAGR stand for?",
    options: [
      "Compound Annual Growth Rate",
      "Current Asset Gearing Ratio",
      "Cumulative Annual Gross Return",
      "Capital Allocation and Growth Ratio",
    ],
    correctOption: 0,
    explanation:
      "CAGR is the mean annual growth rate of an investment over a specified period longer than one year.",
    difficulty: "Medium",
  },
  {
    id: "b52",
    text: "What is a 'Defensive Stock'?",
    options: [
      "A stock in the defense manufacturing sector",
      "A stock that provides a constant dividend and stable earnings regardless of the state of the overall stock market",
      "A stock that is hard to acquire",
      "A stock that has a high beta",
    ],
    correctOption: 1,
    explanation:
      "Defensive stocks, like those in utilities or consumer staples, are less affected by economic downturns.",
    difficulty: "Medium",
  },
  {
    id: "b53",
    text: "What does 'Book Value' of a company represent?",
    options: [
      "The value of a company's books and records",
      "The market value of the company's shares",
      "The net asset value of a company, calculated as total assets minus intangible assets and liabilities",
      "The value at which a company's stock was first issued",
    ],
    correctOption: 2,
    explanation:
      "Book value is essentially the amount of money shareholders would receive if the company was liquidated.",
    difficulty: "Medium",
  },
  {
    id: "b54",
    text: "What is a 'Reverse Stock Split'?",
    options: [
      "When a company buys back its own shares",
      "A corporate action in which a company divides its existing shares into multiple shares",
      "A process that consolidates the number of existing shares into fewer, proportionally more valuable, shares",
      "When shareholders vote to reverse a previous decision",
    ],
    correctOption: 2,
    explanation:
      "A reverse split is often done to increase a stock's price and avoid being delisted from an exchange.",
    difficulty: "Medium",
  },
  {
    id: "b55",
    text: "What are 'Futures' contracts?",
    options: [
      "Contracts to buy or sell an asset at a predetermined future date and price",
      "Predictions about a company's future performance",
      "A type of long-term bond",
      "Shares with future voting rights",
    ],
    correctOption: 0,
    explanation:
      "Futures are standardized financial contracts that obligate parties to transact an asset at a future date and price.",
    difficulty: "Medium",
  },
  {
    id: "b56",
    text: "What are 'Options' contracts?",
    options: [
      "Contracts that give the buyer the right, but not the obligation, to buy or sell an underlying asset at a specific price",
      "A list of optional stocks to add to a portfolio",
      "A flexible dividend plan",
      "A way to vote on company matters",
    ],
    correctOption: 0,
    explanation:
      "Options provide the 'option' to transact, offering flexibility that futures contracts do not.",
    difficulty: "Medium",
  },
  {
    id: "b57",
    text: "What does 'AUM' stand for in the context of mutual funds?",
    options: [
      "Annual User Metric",
      "Assets Under Management",
      "Average Unit Mover",
      "Allocated Universal Money",
    ],
    correctOption: 1,
    explanation:
      "AUM is the total market value of the investments that a person or entity manages on behalf of clients.",
    difficulty: "Medium",
  },
  {
    id: "b58",
    text: "What is a 'Cyclical Stock'?",
    options: [
      "A stock that moves in a predictable cycle every month",
      "A stock whose price is affected by macroeconomic or systematic changes in the overall economy",
      "A stock related to bicycle manufacturing",
      "A stock that has been delisted and relisted",
    ],
    correctOption: 1,
    explanation:
      "Cyclical stocks, like those in the auto or travel industries, do well in a growing economy but poorly in a recession.",
    difficulty: "Medium",
  },
  {
    id: "b59",
    text: "What does CDSL stand for in the Indian stock market?",
    options: [
      "Central Depository Services Limited",
      "Combined Digital Stock Ledger",
      "Corporate Debt and Securities Listing",
      "Centralized Dividend and Stock Ledger",
    ],
    correctOption: 0,
    explanation:
      "CDSL is one of the two central securities depositories in India, where securities are held in dematerialized form.",
    difficulty: "Easy",
  },
  {
    id: "b60",
    text: "What does NSDL stand for?",
    options: [
      "National Securities Depository Limited",
      "New Stock and Derivatives Listing",
      "National Savings and Debt Ledger",
      "Nominal Stock Distribution Limit",
    ],
    correctOption: 0,
    explanation:
      "NSDL is the other central securities depository in India, alongside CDSL.",
    difficulty: "Easy",
  },
  {
    id: "b61",
    text: "What is a 'bear hug' in corporate finance?",
    options: [
      "A sudden market downturn",
      "An offer made by one company to buy the shares of another for a much higher per-share price than what that company is worth in the market",
      "A type of high-risk bond",
      "A government bailout of a failing company",
    ],
    correctOption: 1,
    explanation:
      "A 'bear hug' is a takeover strategy that is so generous, the target company's board has little choice but to accept it.",
    difficulty: "Difficult",
  },
  {
    id: "b62",
    text: "What is the primary function of a stock market index?",
    options: [
      "To guarantee investment returns",
      "To provide a single number representing the performance of a group of stocks",
      "To determine the price of individual stocks",
      "To execute trades on behalf of investors",
    ],
    correctOption: 1,
    explanation:
      "An index like the Nifty 50 or Sensex acts as a barometer for the overall market's performance.",
    difficulty: "Easy",
  },
  {
    id: "b63",
    text: "What is 'dividend yield'?",
    options: [
      "The total amount of dividends paid",
      "A financial ratio that shows how much a company pays in dividends each year relative to its stock price",
      "The growth rate of a company's dividend payments",
      "A tax on dividend income",
    ],
    correctOption: 1,
    explanation:
      "Dividend Yield = Annual Dividend Per Share / Price Per Share.",
    difficulty: "Medium",
  },
  {
    id: "b64",
    text: "What does 'going long' on a stock mean?",
    options: [
      "Holding a stock for more than one year",
      "Buying a stock with the expectation that its price will rise",
      "Selling a stock short",
      "Investing in a long-term government bond",
    ],
    correctOption: 1,
    explanation:
      "A 'long' position is the most common type of investment, where an investor profits from a price increase.",
    difficulty: "Easy",
  },
  {
    id: "b65",
    text: "What does 'volume' refer to in stock trading?",
    options: [
      "The loudness of the trading floor",
      "The total number of shares traded during a given period",
      "The size of a single trade",
      "The market capitalization of a stock",
    ],
    correctOption: 1,
    explanation:
      "High volume can indicate a higher degree of interest and pressure in a stock.",
    difficulty: "Easy",
  },
  {
    id: "b66",
    text: "What is 'alpha' in the context of portfolio management?",
    options: [
      "The first stock purchased in a portfolio",
      "A measure of the active return on an investment compared to a suitable benchmark",
      "The risk-free rate of return",
      "A rating given to blue-chip stocks",
    ],
    correctOption: 1,
    explanation:
      "Alpha represents the value that a portfolio manager adds or subtracts from a fund's return.",
    difficulty: "Difficult",
  },
  {
    id: "b67",
    text: "What is a 'Systematic Investment Plan' (SIP)?",
    options: [
      "A plan to invest only in systematic risk stocks",
      "A one-time lump sum investment",
      "A disciplined investment approach where an investor invests a fixed amount of money at regular intervals",
      "A government-run pension plan",
    ],
    correctOption: 2,
    explanation:
      "SIPs are a popular way to invest in mutual funds, allowing for rupee cost averaging.",
    difficulty: "Easy",
  },
  {
    id: "b68",
    text: "What does the '52-week high/low' indicate?",
    options: [
      "The highest and lowest price of a stock in the current week",
      "The highest and lowest price of a stock over the past 52 weeks",
      "The projected high and low price for the next 52 weeks",
      "The average price over the last 52 weeks",
    ],
    correctOption: 1,
    explanation:
      "The 52-week range helps investors gauge a stock's volatility and current price relative to its recent history.",
    difficulty: "Easy",
  },
  {
    id: "b69",
    text: "What is a 'proxy vote'?",
    options: [
      "A vote cast by a computer algorithm",
      "A vote cast by one person on behalf of another",
      "A vote to change the company's stock symbol",
      "An informal vote taken before a meeting",
    ],
    correctOption: 1,
    explanation:
      "Shareholders who cannot attend a company's annual meeting can cast a proxy vote on key issues.",
    difficulty: "Medium",
  },
  {
    id: "b70",
    text: "What are 'retained earnings'?",
    options: [
      "Money retained by a broker as commission",
      "The portion of a company's net income that is not paid out as dividends but is kept for reinvestment",
      "Earnings from foreign operations",
      "The total earnings of all employees",
    ],
    correctOption: 1,
    explanation:
      "Retained earnings are a key source of internal financing for a company.",
    difficulty: "Medium",
  },
  {
    id: "b71",
    text: "What does 'Free Float' market capitalization mean?",
    options: [
      "The total market cap of all companies",
      "The market cap excluding shares held by promoters, government, and insiders",
      "The market cap of companies that offer free stock",
      "A company's market cap minus its debt",
    ],
    correctOption: 1,
    explanation:
      "Free float represents the shares that are readily available for trading in the market.",
    difficulty: "Medium",
  },
  {
    id: "b72",
    text: "What is a 'conglomerate'?",
    options: [
      "A company that operates in only one industry",
      "A large corporation that is made up of a number of different, seemingly unrelated businesses",
      "A type of stock market index",
      "A partnership between two companies",
    ],
    correctOption: 1,
    explanation:
      "Prominent Indian conglomerates include Reliance Industries, Tata Group, and Adani Group.",
    difficulty: "Easy",
  },
  {
    id: "b73",
    text: "What is 'Earnings Per Share' (EPS)?",
    options: [
      "A company's total earnings divided by its total expenses",
      "The portion of a company's profit allocated to each outstanding share of common stock",
      "The average salary of a company's employees",
      "The dividend paid per share",
    ],
    correctOption: 1,
    explanation: "EPS is a widely used indicator of a company's profitability.",
    difficulty: "Medium",
  },
  {
    id: "b74",
    text: "In India, what is the 'T+1' settlement cycle?",
    options: [
      "Trades must be paid for in 1 day",
      "Trades are settled (shares delivered and money paid) one trading day after the trade is executed",
      "The market is open for 1 extra hour",
      "A tax that must be paid one day after trading",
    ],
    correctOption: 1,
    explanation:
      "India moved to the T+1 settlement cycle, making it one of the fastest in the world.",
    difficulty: "Medium",
  },
  {
    id: "b75",
    text: "What does the 'Price-to-Book' (P/B) ratio compare?",
    options: [
      "A company's stock price to its revenue",
      "A company's stock price to its book value per share",
      "A company's past price to its future price",
      "The price of a book about the company",
    ],
    correctOption: 1,
    explanation:
      "The P/B ratio is a valuation metric used to see if a stock is over or undervalued relative to its net assets.",
    difficulty: "Medium",
  },
  {
    id: "b76",
    text: "What is 'stagflation'?",
    options: [
      "A period of rapid economic growth",
      "A situation where the stock market is stagnant",
      "A period of high inflation combined with high unemployment and stagnant demand",
      "A government policy to inflate the currency",
    ],
    correctOption: 2,
    explanation:
      "Stagflation is a difficult economic condition for policymakers to address.",
    difficulty: "Medium",
  },
  {
    id: "b77",
    text: "What are 'G-Secs' in the Indian context?",
    options: [
      "Government-secured loans",
      "Government Securities, which are debt instruments issued by the government",
      "Stocks of government-owned companies",
      "Gold-backed securities",
    ],
    correctOption: 1,
    explanation:
      "G-Secs are considered very safe investments as they are backed by the government.",
    difficulty: "Easy",
  },
  {
    id: "b78",
    text: "What is a 'Share Buyback'?",
    options: [
      "When a shareholder buys back a stock they previously sold",
      "When a company repurchases its own outstanding shares from the open market",
      "A mandatory purchase of shares by the government",
      "When an investor buys the entire company",
    ],
    correctOption: 1,
    explanation:
      "Companies buy back shares to reduce the number of outstanding shares, often increasing the value of remaining shares.",
    difficulty: "Medium",
  },
  {
    id: "b79",
    text: "What does 'asset allocation' mean?",
    options: [
      "Allocating assets to different company departments",
      "An investment strategy that aims to balance risk and reward by apportioning a portfolio's assets according to an individual's goals and risk tolerance",
      "The process of selling all assets",
      "A legal process to distribute a bankrupt company's assets",
    ],
    correctOption: 1,
    explanation:
      "Asset allocation involves dividing your portfolio among different asset categories, such as stocks, bonds, and cash.",
    difficulty: "Easy",
  },
  {
    id: "b80",
    text: "What is 'rupee cost averaging'?",
    options: [
      "Calculating the average value of the rupee",
      "An approach in which you invest a fixed amount of money at regular intervals, regardless of the stock price",
      "A way to convert foreign currency to rupees",
      "A trading strategy for currency futures",
    ],
    correctOption: 1,
    explanation:
      "This strategy, often used in SIPs, results in buying more shares when prices are low and fewer when prices are high.",
    difficulty: "Medium",
  },
  {
    id: "b81",
    text: "What is the role of a 'Depository Participant' (DP)?",
    options: [
      "A participant in a company meeting",
      "An agent of the depository (like CDSL or NSDL) who provides depository services to investors",
      "A foreign institutional investor",
      "A government regulator",
    ],
    correctOption: 1,
    explanation:
      "Your stockbroker, like Zerodha or Upstox, typically also acts as your Depository Participant.",
    difficulty: "Medium",
  },
  {
    id: "b82",
    text: "What does 'ex-dividend date' mean?",
    options: [
      "The date a dividend is expected to be announced",
      "The date on or after which a stock trades without its previously declared dividend",
      "The date the dividend is actually paid",
      "The last date to claim a missing dividend",
    ],
    correctOption: 1,
    explanation:
      "To be eligible for the dividend, you must own the stock before the ex-dividend date.",
    difficulty: "Medium",
  },
  {
    id: "b83",
    text: "What are 'Promoter Holdings'?",
    options: [
      "Properties owned by the company's promoters",
      "The percentage of shares in a company that are held by its promoters",
      "A separate company owned by the promoters",
      "The personal bank accounts of the promoters",
    ],
    correctOption: 1,
    explanation:
      "High promoter holding is often seen as a sign of confidence in the company's future.",
    difficulty: "Medium",
  },
  {
    id: "b84",
    text: "What is a 'bear raid'?",
    options: [
      "A sudden increase in market prices",
      "The illegal practice of attempting to drive down the price of a stock by heavy selling and spreading negative rumors",
      "A gathering of investors who are pessimistic about the market",
      "A government investigation into a market crash",
    ],
    correctOption: 1,
    explanation: "A bear raid is a form of market manipulation.",
    difficulty: "Difficult",
  },
  {
    id: "b85",
    text: "What is a 'FPO' (Follow-on Public Offer)?",
    options: [
      "The first sale of stock by a company",
      "An offering of shares by a company that is already listed on an exchange",
      "A private sale of shares",
      "A type of corporate bond",
    ],
    correctOption: 1,
    explanation:
      "An FPO is a way for a publicly traded company to raise additional capital.",
    difficulty: "Medium",
  },
  {
    id: "b86",
    text: "What is 'Corporate Governance'?",
    options: [
      "The way the government regulates corporations",
      "The system of rules, practices, and processes by which a company is directed and controlled",
      "A company's marketing strategy",
      "The process of corporate tax filing",
    ],
    correctOption: 1,
    explanation:
      "Good corporate governance is crucial for building trust with investors and stakeholders.",
    difficulty: "Medium",
  },
  {
    id: "b87",
    text: "What does 'insurable interest' mean?",
    options: [
      "A type of interest-bearing account",
      "A stake in a company's insurance policy",
      "A financial interest in an asset that makes a person eligible to insure it against loss",
      "The interest rate charged by an insurance company",
    ],
    correctOption: 2,
    explanation:
      "You must have an insurable interest to purchase an insurance policy for something or someone.",
    difficulty: "Difficult",
  },
  {
    id: "b88",
    text: "What is a 'hostile takeover'?",
    options: [
      "A friendly merger between two companies",
      "The acquisition of one company by another that is accomplished by going directly to the company's shareholders, without the approval of the target company's management",
      "A takeover that results in a market crash",
      "When a company's employees take over management",
    ],
    correctOption: 1,
    explanation:
      "In a hostile takeover, the acquiring company often offers a premium over the current stock price.",
    difficulty: "Difficult",
  },
  {
    id: "b89",
    text: "What is 'hedging' in finance?",
    options: [
      "Investing in high-risk stocks",
      "A strategy to reduce the risk of adverse price movements in an asset",
      "Delaying an investment decision",
      "Investing only in agricultural stocks",
    ],
    correctOption: 1,
    explanation:
      "An example of hedging is buying an option contract to protect a stock position.",
    difficulty: "Medium",
  },
  {
    id: "b90",
    text: "What does the term 'pink sheets' refer to?",
    options: [
      "The financial section of a newspaper",
      "A listing service for stocks that trade over-the-counter (OTC)",
      "A type of government bond",
      "The balance sheet of a new company",
    ],
    correctOption: 1,
    explanation:
      "Pink sheet stocks are often very high-risk and are not listed on major exchanges like NSE or NYSE.",
    difficulty: "Difficult",
  },
  {
    id: "b91",
    text: "What is a 'white knight' in a takeover scenario?",
    options: [
      "A government regulator who stops a takeover",
      "A friendly investor or company that acquires a corporation at a fair consideration with support from the target company's management",
      "The original founder of a company",
      "A high-risk hedge fund",
    ],
    correctOption: 1,
    explanation:
      "A white knight is a preferred acquirer, often used to fend off a hostile takeover attempt.",
    difficulty: "Difficult",
  },
  {
    id: "b92",
    text: "What is 'book building'?",
    options: [
      "The process of writing a company's annual report",
      "A process used in an IPO for price discovery, where an underwriter builds a book of orders from institutional investors",
      "A strategy for valuing real estate assets",
      "The physical construction of a stock exchange",
    ],
    correctOption: 1,
    explanation:
      "Book building helps companies determine the optimal price at which to offer their shares.",
    difficulty: "Difficult",
  },
  {
    id: "b93",
    text: "What is 'sweat equity'?",
    options: [
      "Shares given to employees for working overtime",
      "A non-monetary contribution that individuals or founders make to a business venture",
      "A type of tax on high earnings",
      "Stocks in fitness and wellness companies",
    ],
    correctOption: 1,
    explanation:
      "Sweat equity refers to the hard work and effort that a founder puts into a startup.",
    difficulty: "Medium",
  },
  {
    id: "b94",
    text: "What is the 'upper circuit' in the stock market?",
    options: [
      "The highest floor of the stock exchange building",
      "A prescribed maximum limit above which a stock's price cannot trade on a given day",
      "The highest price a stock has ever reached",
      "A limit on a company's profits",
    ],
    correctOption: 1,
    explanation:
      "Circuit limits are in place to prevent extreme volatility and manipulation.",
    difficulty: "Medium",
  },
  {
    id: "b95",
    text: "What is the 'lower circuit'?",
    options: [
      "The basement of the stock exchange building",
      "A prescribed minimum limit below which a stock's price cannot trade on a given day",
      "The lowest price a stock has ever reached",
      "A limit on a company's losses",
    ],
    correctOption: 1,
    explanation:
      "When a stock hits its lower circuit, trading is temporarily halted to prevent a freefall.",
    difficulty: "Medium",
  },
  {
    id: "b96",
    text: "What does a 'credit rating' for a company signify?",
    options: [
      "Its popularity among customers",
      "An assessment of its ability to pay back its debt",
      "The quality of its products",
      "Its ranking in its industry",
    ],
    correctOption: 1,
    explanation:
      "Credit rating agencies like CRISIL and S&P assess the financial health and creditworthiness of companies.",
    difficulty: "Medium",
  },
  {
    id: "b97",
    text: "What are 'sunk costs'?",
    options: [
      "Costs that are expected in the future",
      "Costs that have already been incurred and cannot be recovered",
      "The cost of shipping goods overseas",
      "Variable costs of production",
    ],
    correctOption: 1,
    explanation:
      "In business decisions, sunk costs should be ignored as they cannot be changed.",
    difficulty: "Difficult",
  },
  {
    id: "b98",
    text: "What is a 'poison pill' strategy?",
    options: [
      "A strategy to make a company's products less appealing",
      "A defensive tactic used by a target company to prevent or discourage a hostile takeover",
      "A way to declare bankruptcy",
      "A high-risk investment",
    ],
    correctOption: 1,
    explanation:
      "A poison pill might allow existing shareholders to buy more shares at a discount, diluting the acquirer's stake.",
    difficulty: "Difficult",
  },
  {
    id: "b99",
    text: "What is 'capital gains tax'?",
    options: [
      "A tax on a company's total capital",
      "A tax on the profit realized on the sale of a non-inventory asset",
      "A tax on employee salaries",
      "A corporate income tax",
    ],
    correctOption: 1,
    explanation:
      "Capital gains tax is levied on the profit you make from selling assets like stocks or real estate.",
    difficulty: "Medium",
  },
  {
    id: "b100",
    text: "What is a 'stock symbol' or 'ticker'?",
    options: [
      "A secret code for trading",
      "A symbol of the company's brand",
      "A unique series of letters assigned to a security for trading purposes",
      "A password for a trading account",
    ],
    correctOption: 2,
    explanation:
      "Tickers like 'RELIANCE.NS' or 'AAPL' are used to uniquely identify stocks on an exchange.",
    difficulty: "Easy",
  },
];
// --- 100 Questions for Technical Analysis ---
const allTechnicalQuestions: QuizQuestion[] = [
  {
    id: "t1",
    text: "What is a moving average?",
    options: [
      "The average price of a stock over a specific period",
      "The difference between opening and closing prices",
      "The highest price achieved in a day",
      "The total volume of trades for a stock",
    ],
    correctOption: 0,
    explanation:
      "A moving average (MA) is a stock indicator that is commonly used in technical analysis to smoothen out price data by creating a constantly updated average price.",
    difficulty: "Easy",
  },
  {
    id: "t2",
    text: "What pattern is formed when a stock's price reaches new lows twice with a moderate recovery in between?",
    options: [
      "Head and Shoulders",
      "Double Bottom",
      "Double Top",
      "Cup and Handle",
    ],
    correctOption: 1,
    explanation:
      "A Double Bottom is a bullish reversal pattern that looks like the letter 'W', indicating a potential price rise.",
    difficulty: "Easy",
  },
  {
    id: "t3",
    text: "What does RSI stand for?",
    options: [
      "Relative Strength Index",
      "Rolling Stock Indicator",
      "Return on Sales Investment",
      "Risk Standard Index",
    ],
    correctOption: 0,
    explanation:
      "RSI is a momentum oscillator that measures the speed and change of price movements, typically on a scale of 0 to 100.",
    difficulty: "Easy",
  },
  {
    id: "t4",
    text: "An RSI reading above 70 typically indicates that a stock is:",
    options: ["Oversold", "Overbought", "Fairly valued", "About to split"],
    correctOption: 1,
    explanation:
      "A stock is considered overbought when its RSI is above 70, suggesting a potential pullback or reversal.",
    difficulty: "Easy",
  },
  {
    id: "t5",
    text: "What does MACD stand for?",
    options: [
      "Moving Average Correlation/Divergence",
      "Market Activity Charting Display",
      "Moving Average Convergence/Divergence",
      "Monetary Asset Control Department",
    ],
    correctOption: 2,
    explanation:
      "The MACD is a trend-following momentum indicator that shows the relationship between two moving averages of a security’s price.",
    difficulty: "Easy",
  },
  {
    id: "t6",
    text: "In a candlestick chart, what does a long upper shadow signify?",
    options: [
      "Strong buying pressure during the session",
      "Buyers tried to push the price up, but sellers ultimately pushed it back down",
      "The stock opened low and closed high",
      "Low volatility",
    ],
    correctOption: 1,
    explanation:
      "A long upper shadow indicates that sellers took control by the end of the session, which can be a bearish sign.",
    difficulty: "Easy",
  },
  {
    id: "t7",
    text: "What is 'support' in technical analysis?",
    options: [
      "A price level where a stock is guaranteed not to fall below",
      "A price level where falling prices tend to stop and reverse upwards due to a concentration of demand",
      "The lowest price a stock has ever reached",
      "A government program to support stock prices",
    ],
    correctOption: 1,
    explanation:
      "Support is a price floor where buying interest is typically strong enough to overcome selling pressure.",
    difficulty: "Easy",
  },
  {
    id: "t8",
    text: "What is 'resistance' in technical analysis?",
    options: [
      "A price level where rising prices tend to stop and reverse downwards due to a concentration of supply",
      "A price level a stock can never go above",
      "The 52-week high of a stock",
      "A psychological barrier for traders",
    ],
    correctOption: 0,
    explanation:
      "Resistance is a price ceiling where selling interest is typically strong enough to overcome buying pressure.",
    difficulty: "Easy",
  },
  {
    id: "t9",
    text: "A 'Golden Cross' occurs when:",
    options: [
      "A short-term moving average crosses below a long-term moving average",
      "A stock's price crosses above its 200-day moving average",
      "A short-term moving average crosses above a long-term moving average",
      "The MACD line crosses below the signal line",
    ],
    correctOption: 2,
    explanation:
      "A Golden Cross (e.g., 50-day MA crossing above 200-day MA) is a significant bullish signal.",
    difficulty: "Easy",
  },
  {
    id: "t10",
    text: "A 'Death Cross' occurs when:",
    options: [
      "A company declares bankruptcy",
      "A short-term moving average crosses below a long-term moving average",
      "A stock's price falls by more than 50% in a day",
      "A short-term moving average crosses above a long-term moving average",
    ],
    correctOption: 1,
    explanation:
      "A Death Cross (e.g., 50-day MA crossing below 200-day MA) is a significant bearish signal.",
    difficulty: "Easy",
  },
  {
    id: "t11",
    text: "What are Bollinger Bands used to measure?",
    options: [
      "A stock's dividend yield",
      "A company's earnings",
      "A stock's market capitalization",
      "Market volatility and relative price levels",
    ],
    correctOption: 3,
    explanation:
      "Bollinger Bands consist of a moving average plus two standard deviation bands, which widen with volatility and narrow without it.",
    difficulty: "Easy",
  },
  {
    id: "t12",
    text: "What does a 'Doji' candlestick pattern indicate?",
    options: [
      "A strong uptrend",
      "A strong downtrend",
      "Indecision in the market",
      "Guaranteed price reversal",
    ],
    correctOption: 2,
    explanation:
      "A Doji forms when the open and close prices are virtually equal, signifying a potential turning point.",
    difficulty: "Easy",
  },
  {
    id: "t13",
    text: "What is a 'gap up' opening?",
    options: [
      "When a stock opens at the same price it closed at",
      "When a stock opens at a lower price than its previous day's close",
      "When a stock opens at a higher price than its previous day's high",
      "When the stock market is closed for a holiday",
    ],
    correctOption: 2,
    explanation:
      "A gap up often occurs due to positive news overnight and can be a strong bullish signal.",
    difficulty: "Easy",
  },
  {
    id: "t14",
    text: "What is the primary concept of Dow Theory?",
    options: [
      "Stock prices are completely random",
      "The market has three movements: primary, secondary, and minor",
      "All stocks move in the same direction",
      "Technical analysis is not effective",
    ],
    correctOption: 1,
    explanation:
      "Dow Theory states that the market moves in trends, which can be identified and followed.",
    difficulty: "Medium",
  },
  {
    id: "t15",
    text: "What does a 'Head and Shoulders' pattern typically signal?",
    options: [
      "A bullish reversal",
      "A continuation of the current trend",
      "A bearish reversal",
      "A period of low volatility",
    ],
    correctOption: 2,
    explanation:
      "A Head and Shoulders pattern is one of the most reliable trend reversal patterns, signaling a shift from bullish to bearish.",
    difficulty: "Easy",
  },
  {
    id: "t16",
    text: "What does 'On-Balance Volume' (OBV) measure?",
    options: [
      "The total value of outstanding shares",
      "The flow of volume, indicating buying and selling pressure",
      "The average volume over a period",
      "The number of open buy orders",
    ],
    correctOption: 1,
    explanation:
      "OBV adds volume on up-days and subtracts it on down-days to gauge momentum.",
    difficulty: "Medium",
  },
  {
    id: "t17",
    text: "What is a 'Fibonacci retracement'?",
    options: [
      "A method of predicting a stock's earnings",
      "A technical analysis method for determining support and resistance levels based on key numerical ratios",
      "A type of chart pattern",
      "A strategy for portfolio diversification",
    ],
    correctOption: 1,
    explanation:
      "Key Fibonacci retracement levels are 23.6%, 38.2%, 50%, 61.8%, and 100%.",
    difficulty: "Medium",
  },
  {
    id: "t18",
    text: "A 'Hammer' candlestick pattern at the bottom of a downtrend is a signal of:",
    options: [
      "Continuation of the downtrend",
      "A potential bullish reversal",
      "High market volatility",
      "A potential bearish reversal",
    ],
    correctOption: 1,
    explanation:
      "A Hammer shows that sellers pushed the price down, but buyers brought it back up, indicating a potential bottom.",
    difficulty: "Easy",
  },
  {
    id: "t19",
    text: "What is the 'Stochastic Oscillator' used for?",
    options: [
      "To measure a stock's beta",
      "To identify overbought and oversold conditions",
      "To calculate a company's P/E ratio",
      "To predict dividend payments",
    ],
    correctOption: 1,
    explanation:
      "Like the RSI, the Stochastic Oscillator is a momentum indicator that compares a closing price to its price range over a period.",
    difficulty: "Medium",
  },
  {
    id: "t20",
    text: "What is a 'trend line'?",
    options: [
      "A line showing a company's historical earnings",
      "A line drawn over pivot highs or under pivot lows to show the prevailing direction of price",
      "The average of all stock prices",
      "A target price set by an analyst",
    ],
    correctOption: 1,
    explanation:
      "An uptrend line connects higher lows, while a downtrend line connects lower highs.",
    difficulty: "Easy",
  },
  {
    id: "t21",
    text: "What does a 'breakout' refer to in charting?",
    options: [
      "When a stock broker takes a break",
      "When a stock's price moves above a resistance level or below a support level",
      "A sudden stop in trading",
      "A major news announcement",
    ],
    correctOption: 1,
    explanation:
      "A breakout is often accompanied by high volume and can signal the start of a new trend.",
    difficulty: "Easy",
  },
  {
    id: "t22",
    text: "The 'Ichimoku Cloud' is a collection of indicators that show:",
    options: [
      "Support/resistance, momentum, and trend direction",
      "Only the daily trading volume",
      "A company's debt levels",
      "The number of outstanding shares",
    ],
    correctOption: 0,
    explanation:
      "The Ichimoku Cloud is a comprehensive indicator that provides a multi-faceted view of price action.",
    difficulty: "Difficult",
  },
  {
    id: "t23",
    text: "What is an 'Ascending Triangle' pattern?",
    options: [
      "A bearish continuation pattern",
      "A bullish chart pattern defined by a horizontal resistance line and a rising support line",
      "A pattern that indicates market indecision",
      "A candlestick pattern",
    ],
    correctOption: 1,
    explanation:
      "An Ascending Triangle suggests that buying pressure is increasing, often leading to a bullish breakout.",
    difficulty: "Medium",
  },
  {
    id: "t24",
    text: "What does a 'Shooting Star' candlestick pattern at the top of an uptrend signal?",
    options: [
      "A potential bearish reversal",
      "A continuation of the uptrend",
      "A potential bullish reversal",
      "A period of consolidation",
    ],
    correctOption: 0,
    explanation:
      "A Shooting Star is the opposite of a Hammer and indicates that buyers lost control to sellers, signaling a potential top.",
    difficulty: "Medium",
  },
  {
    id: "t25",
    text: "What is 'volume analysis'?",
    options: [
      "Analyzing the volume of a company's sales",
      "The examination of the number of shares traded over a period to gauge the strength of a price move",
      "A method for calculating market cap",
      "Analyzing the size of an order book",
    ],
    correctOption: 1,
    explanation:
      "A price move on high volume is considered more significant than a move on low volume.",
    difficulty: "Easy",
  },
  {
    id: "t26",
    text: "What is a 'Flag' pattern?",
    options: [
      "A long-term reversal pattern",
      "A short-term continuation pattern that forms against the primary trend",
      "A signal of extreme volatility",
      "A pattern used in fundamental analysis",
    ],
    correctOption: 1,
    explanation:
      "A Flag pattern, which looks like a small parallelogram, signals a brief pause before the trend continues.",
    difficulty: "Medium",
  },
  {
    id: "t27",
    text: "What does the 'Average Directional Index' (ADX) measure?",
    options: [
      "The direction of the trend",
      "The strength of a trend, regardless of its direction",
      "The average price of a stock",
      "The stock's correlation with the market",
    ],
    correctOption: 1,
    explanation:
      "A high ADX reading (above 25) indicates a strong trend, while a low reading (below 20) indicates a weak or non-trending market.",
    difficulty: "Medium",
  },
  {
    id: "t28",
    text: "What is an 'Inverse Head and Shoulders' pattern?",
    options: [
      "A bearish continuation pattern",
      "A bullish reversal pattern",
      "A bearish reversal pattern",
      "A neutral pattern",
    ],
    correctOption: 1,
    explanation:
      "As the name suggests, it is the opposite of the bearish Head and Shoulders pattern and signals a potential market bottom.",
    difficulty: "Medium",
  },
  {
    id: "t29",
    text: "What are 'pivot points'?",
    options: [
      "Points where a company's strategy changes",
      "Technical analysis indicators used to determine the overall trend of the market over different time frames",
      "The highest and lowest points of a stock's price",
      "The opening and closing prices",
    ],
    correctOption: 1,
    explanation:
      "Pivot points are calculated based on the prior period's high, low, and closing prices to find likely support and resistance levels.",
    difficulty: "Medium",
  },
  {
    id: "t30",
    text: "A 'Bearish Engulfing' pattern occurs when:",
    options: [
      "A small green candle is followed by a large green candle",
      "A large red candle is followed by a small green candle",
      "A small green candle is followed by a large red candle that engulfs it",
      "Two candles of the same size appear side-by-side",
    ],
    correctOption: 2,
    explanation:
      "This pattern shows that sellers have overwhelmingly taken control from buyers and suggests a potential price decline.",
    difficulty: "Medium",
  },
  {
    id: "t31",
    text: "What is meant by 'divergence'?",
    options: [
      "When a stock's price moves in the opposite direction of a technical indicator",
      "When two stocks in the same sector move in opposite directions",
      "The difference between a stock's high and low price",
      "When an analyst's opinion differs from the market consensus",
    ],
    correctOption: 0,
    explanation:
      "For example, a bullish divergence occurs when the stock price makes a new low but the RSI makes a higher low.",
    difficulty: "Medium",
  },
  {
    id: "t32",
    text: "What is a 'Symmetrical Triangle' pattern?",
    options: [
      "A bullish reversal pattern",
      "A bearish reversal pattern",
      "A continuation pattern that indicates a period of consolidation before the price moves",
      "A long-term investment signal",
    ],
    correctOption: 2,
    explanation:
      "A Symmetrical Triangle is formed by converging trend lines and can break out in either direction, though it often continues the prior trend.",
    difficulty: "Medium",
  },
  {
    id: "t33",
    text: "Which type of chart is most commonly used in technical analysis?",
    options: ["Pie Chart", "Bar Chart", "Line Chart", "Candlestick Chart"],
    correctOption: 3,
    explanation:
      "Candlestick charts provide the most information, showing the open, high, low, and close prices for a period.",
    difficulty: "Easy",
  },
  {
    id: "t34",
    text: "The 'Aroon Oscillator' is used to identify:",
    options: [
      "Trend direction and strength",
      "Market volatility",
      "A company's earnings momentum",
      "Overbought and oversold levels",
    ],
    correctOption: 0,
    explanation:
      "The Aroon indicator measures the time between highs and the time between lows over a time period.",
    difficulty: "Difficult",
  },
  {
    id: "t35",
    text: "What is a 'Cup and Handle' pattern?",
    options: [
      "A bearish reversal pattern",
      "A bullish continuation pattern",
      "A short-term consolidation pattern",
      "A signal of low liquidity",
    ],
    correctOption: 1,
    explanation:
      "The 'cup' is a 'U' shape and the 'handle' is a slight downward drift, often signaling a breakout to the upside.",
    difficulty: "Medium",
  },
  {
    id: "t36",
    text: "What is the primary assumption of technical analysis?",
    options: [
      "Markets are completely efficient",
      "All known information is already reflected in the stock's price",
      "Past price movements cannot predict future movements",
      "Fundamental analysis is irrelevant",
    ],
    correctOption: 1,
    explanation:
      "Technical analysis is based on the idea that market action discounts everything, and that prices move in trends.",
    difficulty: "Easy",
  },
  {
    id: "t37",
    text: "In Elliott Wave Theory, a primary upward trend is typically composed of:",
    options: [
      "Three impulse waves and two corrective waves",
      "Two impulse waves and three corrective waves",
      "Five impulse waves and three corrective waves",
      "An equal number of impulse and corrective waves",
    ],
    correctOption: 2,
    explanation:
      "This 5-3 pattern forms the basic structure of market movements according to Elliott Wave Theory.",
    difficulty: "Difficult",
  },
  {
    id: "t38",
    text: "What is a 'Simple Moving Average' (SMA)?",
    options: [
      "An average of selected high prices",
      "An arithmetic mean of a security's prices over a specific period",
      "A moving average that gives more weight to recent prices",
      "The average of the open and close price",
    ],
    correctOption: 1,
    explanation:
      "An SMA is calculated by adding the closing prices for a number of periods and then dividing this total by that same number of periods.",
    difficulty: "Easy",
  },
  {
    id: "t39",
    text: "What is an 'Exponential Moving Average' (EMA)?",
    options: [
      "A moving average that gives more weight to recent prices",
      "A moving average that gives more weight to older prices",
      "The same as a Simple Moving Average",
      "An average that predicts future prices",
    ],
    correctOption: 0,
    explanation:
      "An EMA reacts more quickly to recent price changes than an SMA.",
    difficulty: "Easy",
  },
  {
    id: "t40",
    text: "What does the 'Parabolic SAR' indicator help traders determine?",
    options: [
      "The potential direction of momentum and points where it might reverse",
      "The market capitalization of a stock",
      "The fair value of a stock",
      "The volume of trades",
    ],
    correctOption: 0,
    explanation:
      "SAR stands for 'Stop and Reverse'. The indicator appears as dots above or below the price.",
    difficulty: "Medium",
  },
  {
    id: "t41",
    text: "A 'Descending Triangle' is typically what kind of pattern?",
    options: [
      "Bullish reversal",
      "Bearish continuation",
      "Bullish continuation",
      "Neutral",
    ],
    correctOption: 1,
    explanation:
      "It's characterized by a flat support line and a descending resistance line, suggesting selling pressure is increasing.",
    difficulty: "Medium",
  },
  {
    id: "t42",
    text: "What is a 'fill or kill' order?",
    options: [
      "An order that must be executed immediately in its entirety or canceled",
      "An order that can be partially filled",
      "An order that stays active for the entire day",
      "An order to buy at any price",
    ],
    correctOption: 0,
    explanation:
      "This order type is used when a trader wants to ensure a large order is filled at a specific price without partial execution.",
    difficulty: "Medium",
  },
  {
    id: "t43",
    text: "What does the term 'Gann Angles' refer to?",
    options: [
      "A method of calculating a company's profit angles",
      "Geometric angles used to predict price movements based on time and price relationships",
      "A type of chart pattern",
      "A risk management technique",
    ],
    correctOption: 1,
    explanation:
      "Developed by W.D. Gann, these angles are drawn on a chart to provide support and resistance lines.",
    difficulty: "Difficult",
  },
  {
    id: "t44",
    text: "A 'Marubozu' is a candlestick with:",
    options: [
      "A long upper shadow and a long lower shadow",
      "No body, only wicks",
      "No shadows (wicks), only a full body",
      "A very small body and long wicks",
    ],
    correctOption: 2,
    explanation:
      "A green Marubozu indicates strong buying pressure from open to close, while a red one indicates strong selling pressure.",
    difficulty: "Medium",
  },
  {
    id: "t45",
    text: "What does the 'Money Flow Index' (MFI) measure?",
    options: [
      "The flow of money into and out of a country's economy",
      "Buying and selling pressure by analyzing both price and volume",
      "A company's cash flow statement",
      "The average salary of financial traders",
    ],
    correctOption: 1,
    explanation:
      "The MFI is a volume-weighted version of the RSI and is used to identify overbought or oversold signals.",
    difficulty: "Medium",
  },
  {
    id: "t46",
    text: "What is a 'Wedge' pattern?",
    options: [
      "A pattern indicating guaranteed profit",
      "A chart pattern marked by converging trend lines, which can be either rising or falling",
      "A type of candlestick",
      "A fundamental analysis tool",
    ],
    correctOption: 1,
    explanation:
      "A rising wedge is typically bearish, while a falling wedge is typically bullish.",
    difficulty: "Medium",
  },
  {
    id: "t47",
    text: "What do 'Keltner Channels' show on a chart?",
    options: [
      "A company's expected earnings channel",
      "Volatility-based bands placed above and below a moving average",
      "The number of buyers vs. sellers",
      "The stock's P/E ratio over time",
    ],
    correctOption: 1,
    explanation:
      "Similar to Bollinger Bands, Keltner Channels help identify trend direction and overbought/oversold conditions.",
    difficulty: "Difficult",
  },
  {
    id: "t48",
    text: "What is a 'Tweezer Bottom' pattern?",
    options: [
      "A single candlestick pattern",
      "A bullish reversal pattern consisting of two candlesticks with matching lows",
      "A bearish continuation pattern",
      "A pattern that only occurs at the market open",
    ],
    correctOption: 1,
    explanation:
      "A Tweezer Bottom indicates a potential support level and a shift in momentum from sellers to buyers.",
    difficulty: "Medium",
  },
  {
    id: "t49",
    text: "What is 'slippage' in trading?",
    options: [
      "A mistake made by a trader",
      "The difference between the expected price of a trade and the price at which the trade is actually executed",
      "A slow decline in a stock's price",
      "The commission charged by a broker",
    ],
    correctOption: 1,
    explanation:
      "Slippage often occurs in highly volatile markets or when trading illiquid stocks.",
    difficulty: "Medium",
  },
  {
    id: "t50",
    text: "What does the 'Chaikin Money Flow' (CMF) indicator measure?",
    options: [
      "The volume of money flowing into the stock market",
      "The amount of buying and selling pressure over a set period",
      "The cash reserves of a company",
      "The dividend payout ratio",
    ],
    correctOption: 1,
    explanation:
      "The CMF uses price and volume to determine if a stock is under accumulation (buying) or distribution (selling).",
    difficulty: "Difficult",
  },
  {
    id: "t51",
    text: "A 'Bullish Harami' is a pattern that suggests:",
    options: [
      "A downtrend is likely to continue",
      "An uptrend is likely to reverse",
      "A downtrend is potentially reversing",
      "The market is moving sideways",
    ],
    correctOption: 2,
    explanation:
      "It consists of a large red candle followed by a smaller green candle contained within the body of the previous candle.",
    difficulty: "Medium",
  },
  {
    id: "t52",
    text: "What is a 'logarithmic' price scale on a chart?",
    options: [
      "A scale where price changes are plotted in absolute units",
      "A scale where the distance between price points is equal in percentage terms",
      "A scale that only shows the logarithm of the price",
      "A scale used for plotting trading volume",
    ],
    correctOption: 1,
    explanation:
      "A logarithmic scale is useful for visualizing long-term price movements where a move from 10 to 20 is shown as the same size as a move from 100 to 200 (a 100% increase).",
    difficulty: "Medium",
  },
  {
    id: "t53",
    text: "What is the 'Accumulation/Distribution Line'?",
    options: [
      "A line showing a company's total assets",
      "A volume-based indicator designed to measure the cumulative flow of money into and out of a security",
      "A line that distributes dividends to shareholders",
      "A trend line connecting major highs",
    ],
    correctOption: 1,
    explanation:
      "It attempts to identify divergences between the stock price and volume flow.",
    difficulty: "Medium",
  },
  {
    id: "t54",
    text: "What is a 'Pennant' pattern?",
    options: [
      "A long-term reversal pattern",
      "A short-term continuation pattern similar to a flag, but formed with converging trend lines (a small symmetrical triangle)",
      "A type of candlestick",
      "A signal of a market top",
    ],
    correctOption: 1,
    explanation:
      "A pennant represents a brief pause in a strong trend before the trend continues.",
    difficulty: "Medium",
  },
  {
    id: "t55",
    text: "What does the 'Williams %R' indicator do?",
    options: [
      "Calculate the annual return of a stock",
      "Identify overbought and oversold levels, similar to the Stochastic Oscillator",
      "Measure the percentage of shares held by institutional investors",
      "Predict a company's revenue growth",
    ],
    correctOption: 1,
    explanation:
      "It's a momentum indicator that moves between 0 and -100, with readings above -20 considered overbought and below -80 considered oversold.",
    difficulty: "Medium",
  },
  {
    id: "t56",
    text: "What is 'algorithmic trading'?",
    options: [
      "Trading based on gut feelings",
      "Using computer programs to execute trades at high speeds based on pre-defined criteria",
      "A type of insider trading",
      "Trading algorithms developed by the government",
    ],
    correctOption: 1,
    explanation:
      "Algorithmic trading, or 'algo trading', is widely used by institutional investors and hedge funds.",
    difficulty: "Easy",
  },
  {
    id: "t57",
    text: "A 'Three White Soldiers' pattern is a:",
    options: [
      "Bearish reversal signal",
      "Bullish reversal signal",
      "Continuation signal",
      "Sign of indecision",
    ],
    correctOption: 1,
    explanation:
      "It consists of three long green candles in a row, each opening within the previous candle's body and closing at a new high, signaling a strong shift to bullish momentum.",
    difficulty: "Medium",
  },
  {
    id: "t58",
    text: "A 'Three Black Crows' pattern is a:",
    options: [
      "Bullish reversal signal",
      "Bearish reversal signal",
      "Continuation signal",
      "Sign of indecision",
    ],
    correctOption: 1,
    explanation:
      "It is the bearish counterpart to the Three White Soldiers, signaling a potential market top or reversal of an uptrend.",
    difficulty: "Medium",
  },
  {
    id: "t59",
    text: "What is 'backtesting' a trading strategy?",
    options: [
      "Testing a strategy on future, unknown data",
      "Applying a trading strategy to historical data to see how it would have performed",
      "Getting a second opinion on a trading strategy",
      "Testing a strategy in a live market with real money",
    ],
    correctOption: 1,
    explanation:
      "Backtesting helps traders evaluate the effectiveness of a strategy before risking capital.",
    difficulty: "Easy",
  },
  {
    id: "t60",
    text: "What does the 'Awesome Oscillator' (AO) measure?",
    options: [
      "Market momentum",
      "Market volatility",
      "A stock's dividend yield",
      "The number of outstanding buy orders",
    ],
    correctOption: 0,
    explanation:
      "Developed by Bill Williams, the AO is a momentum indicator that compares recent market momentum with the general momentum over a wider frame of time.",
    difficulty: "Difficult",
  },
  {
    id: "t61",
    text: "In charting, what is a 'candlestick body'?",
    options: [
      "The lines extending above and below the main block",
      "The main, wide part of the candlestick",
      "The total height of the candlestick",
      "The color of the candlestick",
    ],
    correctOption: 1,
    explanation:
      "The body represents the price range between the open and close of that period.",
    difficulty: "Easy",
  },
  {
    id: "t62",
    text: "What is 'scalping' in trading?",
    options: [
      "A long-term investment strategy",
      "A trading style that specializes in profiting off of small price changes, generally after a trade is executed and becomes profitable",
      "A type of fundamental analysis",
      "A method for calculating risk",
    ],
    correctOption: 1,
    explanation:
      "Scalpers make a large number of trades in a single day, aiming for small, quick profits.",
    difficulty: "Easy",
  },
  {
    id: "t63",
    text: "What does a 'Spinning Top' candlestick indicate?",
    options: [
      "A strong trend",
      "A reversal is guaranteed",
      "Indecision and a potential change in direction",
      "The end of the trading day",
    ],
    correctOption: 2,
    explanation:
      "A Spinning Top has a small body with long upper and lower shadows, showing that neither buyers nor sellers could gain the upper hand.",
    difficulty: "Easy",
  },
  {
    id: "t64",
    text: "What does the 'Commitment of Traders' (COT) report show?",
    options: [
      "The commitment of a company's CEO",
      "The holdings of different types of traders (e.g., commercial, non-commercial) in the futures market",
      "A company's dividend commitments",
      "The daily trading volume",
    ],
    correctOption: 1,
    explanation:
      "The COT report can provide insights into the sentiment and positioning of major market players.",
    difficulty: "Difficult",
  },
  {
    id: "t65",
    text: "What is a 'Point and Figure' (P&F) chart?",
    options: [
      "A chart that uses points and figures to represent price",
      "A type of chart that focuses only on price movements, without regard to time",
      "A chart used by fundamental analysts",
      "A chart that plots a company's earnings",
    ],
    correctOption: 1,
    explanation:
      "P&F charts use columns of X's and O's to represent price movements, making it easier to identify support and resistance levels.",
    difficulty: "Difficult",
  },
  {
    id: "t66",
    text: "What is meant by 'market sentiment'?",
    options: [
      "The total value of the market",
      "The overall attitude of investors toward a particular security or financial market",
      "A government report on the economy",
      "The number of stocks that went up versus down",
    ],
    correctOption: 1,
    explanation:
      "Market sentiment can be bullish (positive) or bearish (negative) and is a key driver of price movements.",
    difficulty: "Easy",
  },
  {
    id: "t67",
    text: "The 'Volume Weighted Average Price' (VWAP) is:",
    options: [
      "The average price of a stock over a day",
      "A trading benchmark that gives the average price a security has traded at throughout the day, based on both volume and price",
      "The price at which the highest volume was traded",
      "A measure of a stock's liquidity",
    ],
    correctOption: 1,
    explanation:
      "Institutional investors often use VWAP to help them buy or sell without affecting the market price.",
    difficulty: "Medium",
  },
  {
    id: "t68",
    text: "What is a 'momentum' trading strategy?",
    options: [
      "A strategy to buy stocks that are out of favor",
      "A strategy that aims to capitalize on the continuance of existing market trends",
      "A strategy that only focuses on dividends",
      "A strategy based on a company's earnings reports",
    ],
    correctOption: 1,
    explanation:
      "Momentum traders believe that stocks that have been performing well will continue to do so.",
    difficulty: "Easy",
  },
  {
    id: "t69",
    text: "What is 'seasonality' in market analysis?",
    options: [
      "The effect of weather on the stock market",
      "The tendency for securities to perform differently at certain times of the year",
      "A measure of a company's sales cycle",
      "The age of a company",
    ],
    correctOption: 1,
    explanation:
      "Examples of seasonality include the 'Santa Claus Rally' in December or the 'Sell in May and Go Away' adage.",
    difficulty: "Easy",
  },
  {
    id: "t70",
    text: "What is the 'fear and greed index'?",
    options: [
      "A government measure of economic confidence",
      "An indicator that measures investor sentiment, ranging from extreme fear to extreme greed",
      "A measure of a company's debt",
      "The ratio of buy orders to sell orders",
    ],
    correctOption: 1,
    explanation:
      "It uses several metrics like market momentum and volatility to gauge whether the market is fairly priced or being driven by emotion.",
    difficulty: "Easy",
  },
  {
    id: "t71",
    text: "What is a 'Descending Hawk' candlestick pattern?",
    options: [
      "A bullish continuation pattern",
      "A two-candle bearish reversal pattern that appears in an uptrend",
      "A single-candle pattern",
      "A pattern related to trading volume",
    ],
    correctOption: 1,
    explanation:
      "It's similar to a bearish harami, where a large green candle is followed by a smaller red candle contained within its body.",
    difficulty: "Difficult",
  },
  {
    id: "t72",
    text: "The 'Force Index' (FI) indicator uses which two inputs?",
    options: [
      "Price and Volume",
      "Price and Time",
      "Volume and Time",
      "Open and Close price",
    ],
    correctOption: 0,
    explanation:
      "Developed by Alexander Elder, the Force Index links price movement and volume to measure the power behind a move.",
    difficulty: "Difficult",
  },
  {
    id: "t73",
    text: "What is a 'dead cat bounce'?",
    options: [
      "A permanent market recovery",
      "A temporary, short-lived recovery in the price of a declining stock",
      "A signal of a new bull market",
      "A type of high-risk investment",
    ],
    correctOption: 1,
    explanation:
      "The term implies that even a dead cat will bounce if it falls from a great height, but it does not mean the cat is alive.",
    difficulty: "Easy",
  },
  {
    id: "t74",
    text: "What is 'mean reversion'?",
    options: [
      "The theory that stock prices will eventually revert to their long-term average price",
      "A strategy of always buying the mean-priced stock",
      "The average return of the market",
      "A type of statistical analysis",
    ],
    correctOption: 0,
    explanation:
      "Mean reversion traders look for assets that have strayed far from their historical average, expecting them to return.",
    difficulty: "Medium",
  },
  {
    id: "t75",
    text: "What is a 'Broadening Top' formation?",
    options: [
      "A bullish reversal pattern",
      "A bearish reversal pattern where price makes higher highs and lower lows in a widening range",
      "A continuation pattern",
      "A sign of low volatility",
    ],
    correctOption: 1,
    explanation:
      "This pattern indicates increasing volatility and disagreement between bulls and bears, often leading to a reversal.",
    difficulty: "Difficult",
  },
  {
    id: "t76",
    text: "The 'Rate of Change' (ROC) indicator is what type of oscillator?",
    options: ["Volatility", "Volume", "Momentum", "Trend"],
    correctOption: 2,
    explanation:
      "ROC measures the percentage change in price between the current price and the price a certain number of periods ago.",
    difficulty: "Medium",
  },
  {
    id: "t77",
    text: "What does a 'candlestick wick' (or shadow) represent?",
    options: [
      "The highest and lowest prices traded during the period",
      "The opening and closing prices",
      "The average price of the period",
      "The trading volume",
    ],
    correctOption: 0,
    explanation:
      "The wicks show the price extremes reached during the session, beyond the open and close prices.",
    difficulty: "Easy",
  },
  {
    id: "t78",
    text: "What is the 'Gartley' pattern?",
    options: [
      "A simple trend line",
      "A harmonic chart pattern based on Fibonacci numbers",
      "A type of moving average",
      "A volume indicator",
    ],
    correctOption: 1,
    explanation:
      "The Gartley pattern is a complex pattern used to identify potential price reversals.",
    difficulty: "Difficult",
  },
  {
    id: "t79",
    text: "What is 'curve fitting' in backtesting?",
    options: [
      "Finding the best-fit curve for a stock's price",
      "Over-optimizing a trading strategy to fit historical data, making it unlikely to work in the future",
      "A method for drawing trend lines",
      "A type of statistical analysis",
    ],
    correctOption: 1,
    explanation:
      "Curve fitting is a common pitfall where a strategy looks perfect on past data but fails in live trading.",
    difficulty: "Difficult",
  },
  {
    id: "t80",
    text: "The 'TRIX' indicator is a momentum oscillator that displays:",
    options: [
      "The slope of a triple-smoothed exponential moving average",
      "The triple-weighted volume",
      "The number of trades in a day",
      "The stock's beta",
    ],
    correctOption: 0,
    explanation:
      "TRIX is designed to filter out insignificant price movements, showing the predominant trend.",
    difficulty: "Difficult",
  },
  {
    id: "t81",
    text: "What is a 'Diamond Top' formation?",
    options: [
      "A bullish continuation pattern",
      "A bearish reversal pattern that looks like a broadening top followed by a symmetrical triangle",
      "A very rare candlestick pattern",
      "A signal of high liquidity",
    ],
    correctOption: 1,
    explanation:
      "The Diamond Top is a complex pattern that usually occurs after a significant uptrend and signals a reversal.",
    difficulty: "Difficult",
  },
  {
    id: "t82",
    text: "What is the 'Coppock Curve' indicator primarily used for?",
    options: [
      "Identifying long-term buying opportunities in indices and stocks",
      "Short-term scalping",
      "Measuring daily volatility",
      "Calculating a company's debt",
    ],
    correctOption: 0,
    explanation:
      "It's a momentum indicator designed to signal major market bottoms.",
    difficulty: "Difficult",
  },
  {
    id: "t83",
    text: "What is a 'Morning Star' pattern?",
    options: [
      "A single-candle pattern",
      "A bearish reversal pattern",
      "A three-candle bullish reversal pattern that appears after a downtrend",
      "A continuation pattern",
    ],
    correctOption: 2,
    explanation:
      "It consists of a large red candle, a small-bodied candle (or doji), and a large green candle, signaling a potential bottom.",
    difficulty: "Medium",
  },
  {
    id: "t84",
    text: "What is an 'Evening Star' pattern?",
    options: [
      "A three-candle bearish reversal pattern that appears after an uptrend",
      "A bullish reversal pattern",
      "A pattern related to overnight trading",
      "A signal of low volume",
    ],
    correctOption: 0,
    explanation:
      "It's the bearish counterpart to the Morning Star, signaling a potential top.",
    difficulty: "Medium",
  },
  {
    id: "t85",
    text: "What is the 'Standard Deviation' (in trading)?",
    options: [
      "A measure of a company's financial health",
      "A statistical measure of market volatility or the dispersion of a stock's returns",
      "The standard price of a stock",
      "A type of trading order",
    ],
    correctOption: 1,
    explanation: "Standard deviation is a key input for Bollinger Bands.",
    difficulty: "Medium",
  },
  {
    id: "t86",
    text: "What is 'intermarket analysis'?",
    options: [
      "Analyzing only one market at a time",
      "A method of analyzing markets by examining the correlations between different asset classes",
      "Analysis of international stocks only",
      "A type of fundamental analysis",
    ],
    correctOption: 1,
    explanation:
      "Intermarket analysis looks at how markets like stocks, bonds, commodities, and currencies influence each other.",
    difficulty: "Difficult",
  },
  {
    id: "t87",
    text: "What does a 'runaway gap' (or measuring gap) suggest?",
    options: [
      "The end of a trend",
      "The trend is likely to continue with strength",
      "A reversal is imminent",
      "The market is indecisive",
    ],
    correctOption: 1,
    explanation:
      "This type of gap occurs in the middle of a strong trend and signals conviction among traders.",
    difficulty: "Medium",
  },
  {
    id: "t88",
    text: "What is the 'Relative Vigor Index' (RVI)?",
    options: [
      "A measure of a company's physical assets",
      "A momentum indicator that compares the closing price to the opening price",
      "An index of the most vigorous companies",
      "A volatility indicator",
    ],
    correctOption: 1,
    explanation:
      "The RVI is based on the idea that in an uptrend, the closing price tends to be higher than the opening price, and vice-versa in a downtrend.",
    difficulty: "Difficult",
  },
  {
    id: "t89",
    text: "What is a 'key reversal bar'?",
    options: [
      "A bar that has no meaning",
      "A single-bar pattern that can signal a potential trend reversal, often marked by a new high/low and a close in the opposite direction",
      "A bar showing the key to the chart",
      "A bar with extremely high volume",
    ],
    correctOption: 1,
    explanation:
      "A bullish key reversal bar makes a new low but closes above the previous bar's high.",
    difficulty: "Medium",
  },
  {
    id: "t90",
    text: "What does 'tick volume' represent?",
    options: [
      "The total monetary value of trades",
      "The number of price changes or transactions",
      "The volume of a single trade",
      "A prediction of future volume",
    ],
    correctOption: 1,
    explanation:
      "In markets where actual share volume is not available (like forex), tick volume is used as a proxy.",
    difficulty: "Medium",
  },
  {
    id: "t91",
    text: "What is the 'Ease of Movement' (EOM) indicator?",
    options: [
      "An indicator that measures how easy it is to buy a stock",
      "A volume-based oscillator that relates price change to volume",
      "A measure of market liquidity",
      "A trend-following indicator",
    ],
    correctOption: 1,
    explanation:
      "EOM highlights periods where prices are moving easily with low volume, or struggling to move with high volume.",
    difficulty: "Difficult",
  },
  {
    id: "t92",
    text: "What is a 'Throwback' in technical analysis?",
    options: [
      "A sudden market crash",
      "When price breaks out above a resistance level, then returns to test that level as new support",
      "A type of bearish pattern",
      "An old trading strategy",
    ],
    correctOption: 1,
    explanation:
      "A successful test of the old resistance as new support is a bullish confirmation.",
    difficulty: "Medium",
  },
  {
    id: "t93",
    text: "What is a 'Pullback'?",
    options: [
      "The opposite of a throwback, where price breaks down through support and returns to test it as new resistance",
      "A long-term market recovery",
      "A signal to buy more shares",
      "A type of market order",
    ],
    correctOption: 0,
    explanation:
      "A successful test of old support as new resistance is a bearish confirmation.",
    difficulty: "Medium",
  },
  {
    id: "t94",
    text: "The 'True Strength Index' (TSI) is what type of indicator?",
    options: [
      "A leading momentum oscillator",
      "A lagging trend indicator",
      "A volume indicator",
      "A volatility indicator",
    ],
    correctOption: 0,
    explanation:
      "The TSI is based on double-smoothed moving averages of price momentum and is useful for identifying overbought/oversold levels and divergences.",
    difficulty: "Difficult",
  },
  {
    id: "t95",
    text: "What is the 'candlestick real body'?",
    options: [
      "The entire range from high to low",
      "The range between the opening and closing price of a period",
      "The wick or shadow of the candle",
      "The color of the candle",
    ],
    correctOption: 1,
    explanation:
      "The real body shows whether the closing price was higher or lower than the opening price.",
    difficulty: "Easy",
  },
  {
    id: "t96",
    text: "The 'Detrended Price Oscillator' (DPO) is used to:",
    options: [
      "Identify long-term market trends",
      "Remove the primary trend from price to more easily identify cycles",
      "Predict a company's future price",
      "Measure market volume",
    ],
    correctOption: 1,
    explanation:
      "The DPO helps traders identify the cyclical peaks and troughs in the price movement, ignoring the longer-term trend.",
    difficulty: "Difficult",
  },
  {
    id: "t97",
    text: "What is a 'Wyckoff accumulation' phase?",
    options: [
      "A period where large institutional investors are actively selling a stock",
      "A period of sideways price movement where large investors are quietly buying a stock without causing a major price increase",
      "The final, sharp rally in a bull market",
      "A rapid market decline",
    ],
    correctOption: 1,
    explanation:
      "Identifying Wyckoff accumulation can help traders position themselves before a major uptrend begins.",
    difficulty: "Difficult",
  },
  {
    id: "t98",
    text: "What does the 'Vortex Indicator' (VI) do?",
    options: [
      "It is used to spot trend reversals and confirm current trends",
      "It measures the vortex of trading activity on an exchange floor",
      "It calculates a company's debt-to-equity ratio",
      "It predicts the weather's effect on markets",
    ],
    correctOption: 0,
    explanation:
      "The Vortex Indicator consists of two oscillating lines, one for positive trend movement (VI+) and one for negative trend movement (VI-).",
    difficulty: "Difficult",
  },
  {
    id: "t99",
    text: "What is 'gann fan' analysis?",
    options: [
      "A method using a series of angled lines called Gann angles to identify support and resistance levels",
      "Analyzing the opinions of market fans",
      "A type of social media sentiment analysis",
      "A fundamental analysis technique",
    ],
    correctOption: 0,
    explanation:
      "The Gann Fan is a tool where lines are drawn from a major top or bottom at different angles, which are believed to provide support and resistance.",
    difficulty: "Difficult",
  },
  {
    id: "t100",
    text: "What is the core principle of 'Market Profile' analysis?",
    options: [
      "To analyze the market based on news headlines",
      "To organize price and time information into a statistical distribution (bell curve) to identify areas of value",
      "To profile successful market traders",
      "To create a social media profile for a stock",
    ],
    correctOption: 1,
    explanation:
      "Market Profile helps traders understand where the most trading activity has occurred, identifying significant support and resistance zones.",
    difficulty: "Difficult",
  },
];

// Generic helper function to get daily random questions for any quiz
const getDailyRandomQuestions = (
  allQuestions: QuizQuestion[],
  quizId: string,
  count: number,
  userId?: string
) => {
  const today = new Date().toDateString();
  const storageKey = userId
    ? `dailyQuestions_${quizId}_${today}_${userId}`
    : `dailyQuestions_${quizId}_${today}`;

  let dailyQuestionsJson = localStorage.getItem(storageKey);

  if (!dailyQuestionsJson) {
    // Try to ensure difficulty coverage when possible: prefer to include at least one Easy, one Medium, one Difficult
    // Build pools by difficulty (if the question objects have difficulty)
    const pools: Record<string, QuizQuestion[]> = {
      Easy: [],
      Medium: [],
      Difficult: [],
    };
    allQuestions.forEach((q: any) => {
      const d = (q.difficulty as string) || "Medium";
      if (!pools[d]) pools[d] = [];
      pools[d].push(q);
    });

    const selected: QuizQuestion[] = [];

    // If count is >=3, attempt to pick one from each difficulty if available
    if (count >= 3) {
      const difficulties: ("Easy" | "Medium" | "Difficult")[] = [
        "Easy",
        "Medium",
        "Difficult",
      ];
      for (const d of difficulties) {
        const pool = pools[d] || [];
        if (pool.length > 0) {
          const idx = Math.floor(Math.random() * pool.length);
          selected.push(pool.splice(idx, 1)[0]);
        }
        if (selected.length >= count) break;
      }
    }

    // Fill remaining slots from the remaining questions shuffled
    const remaining = Object.values(pools)
      .flat()
      .concat(
        // also include any questions that didn't have difficulty
        allQuestions.filter((q: any) => !q.difficulty)
      );
    const shuffledRemaining = [...remaining].sort(() => 0.5 - Math.random());
    while (selected.length < count && shuffledRemaining.length > 0) {
      selected.push(shuffledRemaining.shift() as QuizQuestion);
    }

    // As a last resort, if still short, fill from allQuestions
    if (selected.length < count) {
      const fill = [...allQuestions].sort(() => 0.5 - Math.random());
      for (const q of fill) {
        if (selected.length >= count) break;
        if (!selected.find((s) => s.id === (q as any).id))
          selected.push(q as QuizQuestion);
      }
    }

    localStorage.setItem(storageKey, JSON.stringify(selected));
    return selected;
  }

  return JSON.parse(dailyQuestionsJson);
};

// Lightweight type for search-assets results (global NSE universe)
interface SearchAssetResult {
  symbol: string;
  shortname?: string;
  longname?: string;
  quoteType: "EQUITY" | "ETF" | "MUTUALFUND" | "INDEX" | "CURRENCY" | "FUTURE";
  exchange: string;
}

const Games = () => {
  const location = useLocation();
  const initialCategory = location.state?.activeTab || "quizzes";

  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [isQuizDialogOpen, setIsQuizDialogOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>(initialCategory);
  // Simulator state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchAssetResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedStock, setSelectedStock] = useState<any | null>(null);
  const [isTradeDialogOpen, setIsTradeDialogOpen] = useState(false);
  const [tradeAction, setTradeAction] = useState<"buy" | "sell">("buy");
  const buyStock = usePortfolioStore((s) => s.buyStock);
  const addHistoryPoint = usePortfolioStore((s) => s.addHistoryPoint);
  const trades = usePortfolioStore((s) => s.trades);
  const { addToBalance } = useBalanceStore();
  const { user } = useAuth();
  const { prices, fetchPrices, setSymbols } = useLivePrices([], 5000);
  // prediction store hooks
  const predictions = useMarketChallengeStore((s) => s.predictions);
  const addPrediction = useMarketChallengeStore((s) => s.addPrediction);
  const evaluatePredictions = useMarketChallengeStore(
    (s) => s.evaluatePredictions
  );
  const clearAllPredictions = useMarketChallengeStore((s) => s.clearAll);
  // game points store hooks
  const events = useGamePointsStore((s) => s.events);
  const addGamePointEvent = useGamePointsStore((s) => s.addEvent);
  const todayPointsISO = new Date().toISOString().slice(0, 10);
  const todayPoints = events
    .filter((e) => e.dateISO === todayPointsISO)
    .reduce((sum, e) => sum + e.points, 0);
  const marketOpen = isNSEMarketOpen();

  // Progression graph state
  const [knowledgeSeries, setKnowledgeSeries] = useState<
    KnowledgeProgressPoint[]
  >([]);
  const [knowledgeTrend, setKnowledgeTrend] = useState<KnowledgeTrend | null>(
    null
  );
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);

  const refreshKnowledgeProgress = useCallback(async () => {
    if (!user) return;
    setKnowledgeLoading(true);
    try {
      const series = await fetchKnowledgeProgressSeries(user.id);
      setKnowledgeSeries(series);
      const trend: KnowledgeTrend =
        series.length > 0 ? detectOverallTrend(series) : "stagnant";
      setKnowledgeTrend(trend);
    } catch (err) {
      console.error("Failed to fetch knowledge progression", err);
    } finally {
      setKnowledgeLoading(false);
    }
  }, [user]);

  // Dynamically build quizzes using the large question pools
  const mockQuizzes: Quiz[] = [
    {
      id: "basics",
      title: "Stock Market Basics",
      description:
        "Test your knowledge of fundamental stock market concepts. 5 new questions daily!",
      points: 500,
      questions: getDailyRandomQuestions(
        allBasicsQuestions,
        "basics",
        5,
        user?.id
      ),
    },
    {
      id: "technical",
      title: "Technical Analysis",
      description:
        "Learn about charts, patterns, and indicators. 5 new questions daily!",
      points: 750,
      questions: getDailyRandomQuestions(
        allTechnicalQuestions,
        "technical",
        5,
        user?.id
      ),
    },
  ];

  useEffect(() => {
    if (location.state?.activeTab) {
      setActiveCategory(location.state.activeTab);
    }
  }, [location.state]);

  // Initial progression load when user changes
  useEffect(() => {
    if (user) {
      refreshKnowledgeProgress();
    } else {
      setKnowledgeSeries([]);
      setKnowledgeTrend(null);
    }
  }, [user, refreshKnowledgeProgress]);

  const handleStartQuiz = (quiz: Quiz) => {
    const today = new Date().toDateString();
    const completedToday = user
      ? localStorage.getItem(
          `quiz_completed_${quiz.id}_${today}_${user.id}`
        ) === "true"
      : false;

    if (completedToday) {
      toast.info(`You've already completed today's ${quiz.title} challenge!`, {
        description: "Come back tomorrow for new questions. 📅",
      });
      return;
    }

    // --- THIS IS THE FIX ---
    // Instead of passing just 5 questions, pass ALL of them.
    // StockQuiz will build its own pools from all 100 questions
    // and correctly limit the quiz to 5 questions itself.

    const allQuestionsForQuiz =
      quiz.id === "basics" ? allBasicsQuestions : allTechnicalQuestions;

    const updatedQuiz = {
      ...quiz,
      // Pass ALL questions to the quiz component
      questions: allQuestionsForQuiz,
      // Tell the quiz component to only ask 5
      totalQuestionsToAsk: 5,
    };
    // --- END FIX ---

    setSelectedQuiz(updatedQuiz);
    setIsQuizDialogOpen(true);
  };
  // Global search for Trading Simulator & Challenges using Edge Function `search-assets`
  useEffect(() => {
    if (!searchQuery) {
      setSearchResults([]);
      // when nothing is searched, keep default prediction universe for live prices
      setSymbols(predictionUniverse);
      return;
    }

    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke(
          "search-assets",
          {
            body: { query: searchQuery },
          }
        );
        if (error) throw error;
        setSearchResults((data?.quotes || []) as SearchAssetResult[]);

        // For searched results, subscribe live prices for those symbols (NSE equities only)
        const equitySymbols = (data?.quotes || [])
          .filter((q: SearchAssetResult) => q.quoteType === "EQUITY")
          .map((q: SearchAssetResult) =>
            q.symbol.endsWith(".NS") ? q.symbol : `${q.symbol}.NS`
          );
        if (equitySymbols.length) {
          setSymbols(equitySymbols);
        }
      } catch (err) {
        console.error("Games search error:", err);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, setSymbols]);

  // Build the stocks list used by simulator & prediction challenges
  const filteredStocks = useMemo(() => {
    if (!searchQuery) return baseStocks;
    if (!searchResults.length) return [];

    const equities = searchResults.filter(
      (r) =>
        r.quoteType === "EQUITY" &&
        (r.exchange?.toUpperCase().includes("NSE") || r.symbol.endsWith(".NS"))
    );

    return equities.map((r) => {
      const base = r.symbol.replace(/\.NS$/i, "");
      return {
        symbol: base,
        name: r.shortname || r.longname || base,
      } as BasicStock;
    });
  }, [searchQuery, searchResults]);

  // helper for evaluation (fetch historical and compute day change percent)
  const getDayChangePercent = useCallback(
    async (symbol: string, dateISO: string) => {
      try {
        const days = 14;
        const { data, error } = await supabase.functions.invoke(
          "get-stock-data",
          { body: { symbol: `${symbol}.NS`, days } }
        );
        if (error || !data?.historicalData) return null;
        const hist = (data.historicalData as any[])
          .map((h) => ({
            date: new Date(h.date).toISOString().slice(0, 10),
            close: h.close as number,
          }))
          .sort((a, b) => a.date.localeCompare(b.date));
        const idx = hist.findIndex((h) => h.date === dateISO);
        if (idx <= 0) return null;
        const prev = hist[idx - 1].close;
        const close = hist[idx].close;
        return ((close - prev) / prev) * 100;
      } catch {
        return null;
      }
    },
    []
  );

  const handleEvaluateNow = () => {
    // Evaluation is only allowed after market hours.
    if (marketOpen) {
      toast.info(
        "Evaluation is available only after market close (15:30 IST)."
      );
      return;
    }

    evaluatePredictions(getDayChangePercent).then(() => {
      if (user) {
        refreshKnowledgeProgress();
      }
    });
  };

  const todayISO = new Date().toISOString().slice(0, 10);

  const PredictionPicker: React.FC<{
    filteredStocks: any[];
    prices: any;
    fetchPrices: any;
  }> = ({ filteredStocks, prices }) => (
    <div className="grid md:grid-cols-2 gap-4">
      {filteredStocks.slice(0, 8).map((stock) => {
        const live = prices[stock.symbol];
        const price = live ? live.price : 0;
        const already = predictions.some(
          (p) =>
            p.symbol === stock.symbol && p.dateISO === todayISO && !p.resolved
        );
        const place = (dir: PredictionDirection) => {
          if (!marketOpen) {
            toast.info(
              "Market is closed. Predictions allowed 09:15–15:30 IST (Mon–Fri)"
            );
            return;
          }
          if (already) {
            toast.info(`Already predicted for ${stock.symbol} today.`);
            return;
          }
          addPrediction({
            symbol: stock.symbol,
            dateISO: todayISO,
            direction: dir,
          });
          toast.success(`Prediction placed: ${stock.symbol} ${dir}`);
        };
        return (
          <div
            key={stock.symbol}
            className="p-3 border rounded flex items-center justify-between gap-3"
          >
            <div>
              <div className="font-semibold">{stock.symbol}</div>
              <div className="text-sm text-gray-500">
                {live?.name || stock.name}
              </div>
            </div>
            <div className="text-right">
              <div className="font-medium">
                {price ? `₹${price.toFixed(2)}` : "—"}
              </div>
              <div className="text-xs text-gray-500">Today</div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                disabled={already || !marketOpen}
                onClick={() => place("UP")}
              >
                <TrendingUp className="h-4 w-4 mr-1" />
                Up
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={already || !marketOpen}
                onClick={() => place("DOWN")}
              >
                <TrendingDown className="h-4 w-4 mr-1" />
                Down
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );

  const PredictionsList: React.FC<{ prices: any }> = () => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Your Predictions</CardTitle>
          <CardDescription>
            Status and results for today & previous days
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleEvaluateNow}
            disabled={marketOpen}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Evaluate
          </Button>
          <Button variant="ghost" onClick={clearAllPredictions}>
            Clear
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {predictions.length === 0 ? (
          <div className="text-center text-gray-500 py-6">
            No predictions yet.
          </div>
        ) : (
          <div className="space-y-2">
            {predictions.map((p) => (
              <div
                key={p.id}
                className="p-2 border rounded flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                    {p.dateISO}
                  </span>
                  <div className="font-medium">{p.symbol}</div>
                </div>
                <div className="flex items-center gap-4">
                  <div
                    className={`font-semibold ${
                      p.direction === "UP" ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {p.direction}
                  </div>
                  {p.resolved ? (
                    <div
                      className={`text-sm ${
                        p.correct ? "text-green-700" : "text-orange-600"
                      }`}
                    >
                      {p.correct ? "+500" : "-100"} pts
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">Pending</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  const handleQuizComplete = async (score: number) => {
    if (!selectedQuiz || !user) return;

    const totalQuestions =
      (selectedQuiz as any).totalQuestionsToAsk ||
      selectedQuiz.questions.length;
    const percentCorrect =
      totalQuestions > 0 ? (score / totalQuestions) * 100 : 0;

    const quizDifficulty: DifficultyLevel =
      selectedQuiz.id === "basics" ? "easy" : "medium";

    const earnedPoints = Math.round(
      (percentCorrect / 100) * selectedQuiz.points
    );
    addToBalance(earnedPoints);
    // log to centralized game points store so header updates immediately
    try {
      addGamePointEvent({
        source: "quiz",
        label: selectedQuiz.title,
        points: earnedPoints,
      });
    } catch {}
    toast.success(`Quiz Complete! You earned ${earnedPoints} points! 🏆`);

    // Mark this specific quiz as completed for today for this user
    const today = new Date().toDateString();
    localStorage.setItem(
      `quiz_completed_${selectedQuiz.id}_${today}_${user.id}`,
      "true"
    );

    // Progression tracking for quizzes
    try {
      const activityScore = calculateQuizActivityScore(
        percentCorrect,
        quizDifficulty
      );

      await logGameActivity({
        gameType: "quiz",
        gameId: selectedQuiz.id,
        difficultyLevel: quizDifficulty,
        score: activityScore,
        outcome: "completed",
        metadata: {
          title: selectedQuiz.title,
          percentCorrect,
          totalQuestions,
        },
      });

      await updateKnowledgeProgress({
        source: "quiz",
        gameScore: activityScore,
        difficultyLevel: quizDifficulty,
      });

      await refreshKnowledgeProgress();
    } catch (err) {
      console.error("quiz progression logging failed", err);
    }

    setTimeout(() => {
      setIsQuizDialogOpen(false);
      setSelectedQuiz(null);
    }, 3000);
  };

  const handleOpenSimulator = () => setActiveCategory("simulator");
  const handleOpenChallenges = () => setActiveCategory("challenges");

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationBar />

      <main className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Games & Quizzes</h1>
          <div className="bg-learngreen-100 px-4 py-2 rounded-lg flex items-center shadow-sm">
            <Trophy className="h-5 w-5 text-learngreen-600 mr-2" />
            <span className="font-semibold text-learngreen-700">
              {todayPoints} Points Earned Today
            </span>
          </div>
        </div>
        {user && (
          <div className="mb-6">
            <KnowledgeProgressChart
              data={knowledgeSeries}
              trend={knowledgeTrend}
              loading={knowledgeLoading}
            />
          </div>
        )}
        {!marketOpen && (
          <div className="mb-4 text-sm text-orange-700 bg-orange-50 border border-orange-200 rounded p-3">
            Market Closed • Predictions and trades allowed 09:15–15:30 IST
            (Mon–Fri)
          </div>
        )}

        {/* Category Selection */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card
            className={`text-center transition-all ${
              activeCategory === "quizzes"
                ? "border-2 border-learngreen-500 shadow-lg"
                : "hover:shadow-md"
            }`}
          >
            <CardHeader>
              <div className="flex justify-center mb-2">
                <div className="bg-learngreen-100 p-3 rounded-full">
                  <BookOpen className="h-8 w-8 text-learngreen-600" />
                </div>
              </div>
              <CardTitle>Knowledge Quizzes</CardTitle>
              <CardDescription>
                Test your stock market knowledge.
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button
                className="w-full bg-learngreen-600 hover:bg-learngreen-700"
                onClick={() => setActiveCategory("quizzes")}
              >
                Explore Quizzes
              </Button>
            </CardFooter>
          </Card>
          <Card
            className={`text-center transition-all ${
              activeCategory === "simulator"
                ? "border-2 border-learngreen-500 shadow-lg"
                : "hover:shadow-md"
            }`}
          >
            <CardHeader>
              <div className="flex justify-center mb-2">
                <div className="bg-learngreen-100 p-3 rounded-full">
                  <Brain className="h-8 w-8 text-learngreen-600" />
                </div>
              </div>
              <CardTitle>Trading Simulator</CardTitle>
              <CardDescription>Practice with virtual money.</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button
                className="w-full bg-learngreen-600 hover:bg-learngreen-700"
                onClick={handleOpenSimulator}
              >
                Start Trading
              </Button>
            </CardFooter>
          </Card>
          <Card
            className={`text-center transition-all ${
              activeCategory === "challenges"
                ? "border-2 border-learngreen-500 shadow-lg"
                : "hover:shadow-md"
            }`}
          >
            <CardHeader>
              <div className="flex justify-center mb-2">
                <div className="bg-learngreen-100 p-3 rounded-full">
                  <Timer className="h-8 w-8 text-learngreen-600" />
                </div>
              </div>
              <CardTitle>Market Challenges</CardTitle>
              <CardDescription>Timed prediction games.</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button
                className="w-full bg-learngreen-600 hover:bg-learngreen-700"
                onClick={handleOpenChallenges}
              >
                Join Challenge
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Dynamic Content */}
        {activeCategory === "quizzes" && (
          <div>
            <h2 className="text-2xl font-semibold mb-4">Available Quizzes</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {mockQuizzes.map((quiz) => {
                const today = new Date().toDateString();
                const completedToday = user
                  ? localStorage.getItem(
                      `quiz_completed_${quiz.id}_${today}_${user.id}`
                    ) === "true"
                  : false;

                return (
                  <Card
                    key={quiz.id}
                    className={
                      completedToday ? "bg-gray-100 border-learngreen-200" : ""
                    }
                  >
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <CardTitle>{quiz.title}</CardTitle>
                        {completedToday && (
                          <Badge
                            variant="outline"
                            className="bg-learngreen-100 text-learngreen-700 border-learngreen-200"
                          >
                            Completed Today
                          </Badge>
                        )}
                      </div>
                      <CardDescription>{quiz.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between text-sm">
                        <span>Questions: {quiz.questions.length}</span>
                        <span className="font-semibold text-learngreen-700">
                          {quiz.points} points
                        </span>
                      </div>
                      {completedToday && (
                        <div className="mt-2 text-xs text-center text-orange-600 bg-orange-50 p-2 rounded-md">
                          Come back tomorrow for 5 new questions! 📅
                        </div>
                      )}
                    </CardContent>
                    <CardFooter>
                      <Button
                        onClick={() => handleStartQuiz(quiz)}
                        className="w-full bg-learngreen-600 hover:bg-learngreen-700"
                        disabled={completedToday}
                      >
                        {completedToday ? "Done for Today" : "Start Quiz"}
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}

              <Card className="opacity-70 border-dashed flex flex-col justify-center items-center text-center p-6">
                <GamepadIcon className="h-12 w-12 text-gray-300 mb-4" />
                <CardTitle>More Quizzes Coming Soon!</CardTitle>
                <CardDescription>
                  New categories will be added regularly.
                </CardDescription>
              </Card>
            </div>
          </div>
        )}

        {activeCategory === "simulator" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Trading Simulator</CardTitle>
                <CardDescription>
                  Search stocks and buy with your virtual balance.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <input
                    className="w-full border p-2 rounded"
                    placeholder="Search by symbol or name (e.g. RELIANCE)"
                    onChange={(e) => setSearchQuery(e.target.value)}
                    value={searchQuery}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {filteredStocks.map((stock) => {
                    const live = prices[stock.symbol];
                    const display = {
                      id: stock.symbol,
                      symbol: stock.symbol,
                      name: live?.name || stock.name || stock.symbol,
                      price: live?.price || 0,
                      change: live?.change || 0,
                      changePercent: live?.changePercent || 0,
                      volume: 0,
                      marketCap: 0,
                      sector: "",
                    } as any;
                    return (
                      <div
                        key={stock.symbol}
                        onClick={() => {
                          setSelectedStock(display);
                          setTradeAction("buy");
                          setIsTradeDialogOpen(true);
                        }}
                      >
                        <StockCard stock={display} />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Trades</CardTitle>
              </CardHeader>
              <CardContent>
                {trades.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    No trades yet. Buy a stock to see it here.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {trades.map((t) => (
                      <div
                        key={t.id}
                        className="flex justify-between items-center p-2 border rounded"
                      >
                        <div>
                          <div className="font-medium">
                            {t.symbol} • {t.type}
                          </div>
                          <div className="text-sm text-gray-500">
                            {new Date(t.date).toLocaleString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <div>Qty: {t.quantity}</div>
                          <div>₹{t.price.toFixed(2)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <TradeDialog
              open={isTradeDialogOpen}
              onOpenChange={setIsTradeDialogOpen}
              stock={selectedStock}
              action={tradeAction}
              onConfirm={(qty) => {
                if (!selectedStock) return;
                if (tradeAction === "buy") {
                  (async () => {
                    const symbolWithNs = `${selectedStock.symbol}.NS`;
                    const fetched = await fetchPrices([symbolWithNs]);
                    const live =
                      fetched[selectedStock.symbol] ||
                      prices[selectedStock.symbol];
                    const priceToUse = live ? live.price : selectedStock.price;
                    const ok = buyStock(selectedStock, qty, priceToUse);
                    if (ok) {
                      toast.success(
                        `Bought ${qty} ${
                          selectedStock.symbol
                        } @ ₹${priceToUse.toFixed(2)}`
                      );
                      try {
                        // Combine fetched prices with currently polled prices
                        const combined = {
                          ...(prices || {}),
                          ...(fetched || {}),
                        };
                        const portfolio = usePortfolioStore.getState();
                        const investedValue = portfolio.holdings.reduce(
                          (s, h) => {
                            const p =
                              combined[h.symbol]?.price ?? h.avgBuyPrice;
                            return s + h.quantity * p;
                          },
                          0
                        );
                        usePortfolioStore
                          .getState()
                          .addHistoryPoint(investedValue);
                      } catch (err) {
                        console.error(
                          "Failed to append history point after buy",
                          err
                        );
                      }
                    } else
                      toast.error("Insufficient balance or invalid quantity");
                  })();
                }
                setIsTradeDialogOpen(false);
              }}
            />
          </div>
        )}

        {activeCategory === "challenges" && (
          <div className="space-y-6">
            {/* Prediction Input */}
            <Card>
              <CardHeader>
                <CardTitle>Daily Direction Prediction</CardTitle>
                <CardDescription>
                  Predict if a stock will close UP or DOWN today. Correct: +500
                  • Wrong: -100
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <input
                    className="w-full border p-2 rounded"
                    placeholder="Search stock (e.g. RELIANCE)"
                    onChange={(e) => setSearchQuery(e.target.value)}
                    value={searchQuery}
                  />
                </div>
                <PredictionPicker
                  filteredStocks={filteredStocks}
                  prices={prices}
                  fetchPrices={fetchPrices}
                />
              </CardContent>
            </Card>
            <PredictionsList prices={prices} />
          </div>
        )}
      </main>

      {/* Quiz Dialog */}
      <Dialog open={isQuizDialogOpen} onOpenChange={setIsQuizDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col bg-white">
          <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle>{selectedQuiz?.title}</DialogTitle>
          </DialogHeader>
          <div className="p-6 pt-4 overflow-y-auto">
            {selectedQuiz && (
              <StockQuiz quiz={selectedQuiz} onComplete={handleQuizComplete} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Games;
