# 📈 LearnStocks

> A gamified stock market learning platform that teaches you how to invest — without risking real money.

![React](https://img.shields.io/badge/React-18-blue?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-5.4-purple?logo=vite)
![Supabase](https://img.shields.io/badge/Supabase-Auth%20%26%20DB-green?logo=supabase)
![FastAPI](https://img.shields.io/badge/FastAPI-Python%20Backend-teal?logo=fastapi)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8?logo=tailwindcss)

---

## 🚀 About the Project

**LearnStocks** is an interactive, gamified web application designed to help beginners and enthusiasts learn how the stock market works — through hands-on simulated trading, mini-games, AI-powered price predictions, and real-time sentiment analysis from live news.

Whether you're a complete beginner or someone who wants to sharpen their trading instincts, LearnStocks makes learning finance engaging and risk-free.

---

## ✨ Features

- 🎮 **Gamified Learning** — Play stock market mini-games to learn trading concepts interactively
- 📊 **Portfolio / Holdings Tracker** — Track your virtual stock holdings and performance
- 🔍 **Stock Search & Detail Pages** — Search for stocks and view detailed charts and info
- 🤖 **AI Price Predictions** — LSTM-based model predicts next closing price using historical data
- 📰 **Sentiment Analysis** — Analyzes live news headlines using VADER to score market sentiment
- 🏆 **Leaderboard & Profile** — Compete with others, build your profile, and track progress
- 🔐 **Authentication** — Secure sign-up/login via Supabase Auth
- 🌙 **Dark Mode Support** — Full theme switching with `next-themes`

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 18 + TypeScript | Core UI framework |
| Vite 5 | Lightning-fast dev server & bundler |
| TailwindCSS 3 | Utility-first styling |
| shadcn/ui + Radix UI | Accessible UI component library |
| React Router DOM v6 | Client-side routing |
| TanStack Query v5 | Server state management & caching |
| Zustand | Lightweight global state management |
| Recharts | Interactive stock charts |
| React Hook Form + Zod | Form handling & validation |
| Supabase JS | Auth, Database & Realtime |

### Backend (Python API)
| Technology | Purpose |
|---|---|
| FastAPI | REST API framework |
| TensorFlow / Keras | LSTM model for price prediction |
| scikit-learn | Data preprocessing (MinMaxScaler) |
| VADER Sentiment | News sentiment scoring |
| NewsAPI | Real-time stock-related news |
| NumPy | Numerical computations |

---

## 📁 Project Structure

```
LearnStocks/
├── src/
│   ├── pages/          # App pages (Home, Games, Holdings, Search, Profile, etc.)
│   ├── components/     # Reusable UI components
│   ├── contexts/       # React context providers
│   ├── hooks/          # Custom React hooks
│   ├── stores/         # Zustand global stores
│   ├── integrations/   # Supabase client & types
│   ├── lib/            # Utility functions
│   ├── types/          # TypeScript type definitions
│   └── utils/          # Helper utilities
├── python-api/
│   ├── main.py         # FastAPI app (predictions + sentiment)
│   ├── requirements.txt
│   └── Procfile        # For deployment (Render)
├── supabase/           # Supabase migrations & config
├── public/             # Static assets
└── .env.example        # Environment variable template
```

---

## ⚙️ Getting Started

### Prerequisites
- **Node.js** >= 18
- **Python** >= 3.10
- A [Supabase](https://supabase.com) project
- A [NewsAPI](https://newsapi.org) key

---

### 1. Clone the Repository

```bash
git clone https://github.com/vrajsutariya454-netizen/Learnstocks_T1.git
cd Learnstocks_T1/LearnStocks
```

---

### 3. Python API Setup

```bash
cd python-api

# Create a virtual environment
python -m venv venv
venv\Scripts\activate      # Windows
# source venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Set your NewsAPI key
set NEWS_API_KEY=your_newsapi_key   # Windows
# export NEWS_API_KEY=your_newsapi_key  # macOS/Linux

# Start the API server
uvicorn main:app --reload
```

API runs at → `http://localhost:8000`

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/predict` | Predict next closing price (LSTM) |
| `GET` | `/sentiment/{symbol}` | News sentiment for a stock symbol |

### `/predict` Request Body
```json
{
  "symbol": "AAPL",
  "days": 90,
  "closePrices": [150.0, 152.3, 148.9, ...]
}
```

---

## 🚢 Deployment

| Service | Purpose |
|---|---|
| [Vercel](https://vercel.com) | Frontend hosting (`vercel.json` included) |
| [Render](https://render.com) | Python API hosting (`render.yaml` + `Procfile` included) |
| [Supabase](https://supabase.com) | Database + Auth backend |

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

## 👨‍💻 Author

**Vraj Sutariya**  
GitHub: [@vrajsutariya454-netizen](https://github.com/vrajsutariya454-netizen)

---

> *"The stock market is filled with individuals who know the price of everything, but the value of nothing." — Philip Fisher*
