import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useBalanceStore } from "@/stores/balanceStore";
import { isNSEMarketOpen } from "@/lib/marketHours";
import { Stock } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import mockStocks from "@/data/mockStocks";

export interface Holding {
  stockId: string;
  symbol: string;
  name: string;
  quantity: number;
  avgBuyPrice: number;
}

interface PortfolioState {
  holdings: Holding[];
  trades: Array<{
    id: string;
    stockId: string;
    symbol: string;
    quantity: number;
    price: number;
    type: "BUY" | "SELL";
    date: string;
  }>;
  history: Array<{ date: string; value: number }>;
  buyStock: (stock: Stock, quantity: number, price?: number) => boolean;
  sellStock: (stockId: string, quantity: number, price?: number) => boolean;
  getHolding: (stockId: string) => Holding | undefined;
  addHistoryPoint: (value: number, date?: string) => void;
  clearHistory: () => void;
  clearAll: () => void;
  syncFromBackend: () => Promise<void>;
}

export const usePortfolioStore = create<PortfolioState>()(
  persist(
    (set, get) => ({
      holdings: [],
      trades: [],
      history: [],

      buyStock: (stock: Stock, quantity: number, price?: number) => {
        // Restrict to market hours
        if (!isNSEMarketOpen()) return false;
        const unitPrice = price ?? stock.price;
        if (quantity <= 0) return false;

        const totalCost = unitPrice * quantity;
        const deducted = useBalanceStore
          .getState()
          .deductFromBalance(totalCost);
        if (!deducted) return false;

        let updatedHoldingSnapshot: Holding | null = null;

        set((state) => {
          const existing = state.holdings.find((h) => h.stockId === stock.id);
          if (existing) {
            const newQty = existing.quantity + quantity;
            const newAvg =
              (existing.avgBuyPrice * existing.quantity +
                unitPrice * quantity) /
              newQty;
            existing.quantity = newQty;
            existing.avgBuyPrice = newAvg;
            updatedHoldingSnapshot = { ...existing };
          } else {
            const created: Holding = {
              stockId: stock.id,
              symbol: stock.symbol,
              name: stock.name,
              quantity,
              avgBuyPrice: unitPrice,
            };
            state.holdings.push(created);
            updatedHoldingSnapshot = { ...created };
          }

          state.trades.unshift({
            id: `${Date.now()}`,
            stockId: stock.id,
            symbol: stock.symbol,
            quantity,
            price: unitPrice,
            type: "BUY",
            date: new Date().toISOString(),
          });

          return {
            holdings: state.holdings.slice(),
            trades: state.trades.slice(0, 50),
          };
        });

        if (updatedHoldingSnapshot) {
          void syncHoldingAndTransaction({
            holding: updatedHoldingSnapshot,
            tradeQuantity: quantity,
            tradePrice: unitPrice,
            tradeType: "BUY",
          });
        }

        // Also sync updated cash balance for this user so that
        // other devices see the same available cash.
        void syncCashBalanceToProfile();

        return true;
      },

      sellStock: (stockId: string, quantity: number, price?: number) => {
        if (!isNSEMarketOpen()) return false;
        const stateSnapshot = get();
        const holding = stateSnapshot.holdings.find(
          (h) => h.stockId === stockId
        );
        if (!holding || quantity <= 0 || quantity > holding.quantity)
          return false;
        const unitPrice = price ?? holding.avgBuyPrice; // fallback
        const proceeds = unitPrice * quantity;
        useBalanceStore.getState().addToBalance(proceeds);

        let updatedHoldingSnapshot: Holding | null = null;

        set((state) => {
          const h = state.holdings.find((x) => x.stockId === stockId);
          if (!h) return state;
          const remainingQty = h.quantity - quantity;
          if (remainingQty <= 0) {
            updatedHoldingSnapshot = { ...h, quantity: 0 };
            state.holdings = state.holdings.filter(
              (x) => x.stockId !== stockId
            );
          } else {
            h.quantity = remainingQty;
            updatedHoldingSnapshot = { ...h };
          }

          state.trades.unshift({
            id: `${Date.now()}`,
            stockId: h.stockId,
            symbol: h.symbol,
            quantity,
            price: unitPrice,
            type: "SELL",
            date: new Date().toISOString(),
          });

          return {
            holdings: state.holdings.slice(),
            trades: state.trades.slice(0, 50),
          };
        });

        if (updatedHoldingSnapshot) {
          void syncHoldingAndTransaction({
            holding: updatedHoldingSnapshot,
            tradeQuantity: quantity,
            tradePrice: unitPrice,
            tradeType: "SELL",
          });
        }

        // Sync cash after a sell as well.
        void syncCashBalanceToProfile();

        return true;
      },

      getHolding: (stockId: string) => {
        return get().holdings.find((h) => h.stockId === stockId);
      },

      addHistoryPoint: (value: number, date?: string) => {
        const point = { date: date ?? new Date().toISOString(), value };
        set((state) => ({ history: [...state.history, point].slice(-200) })); // keep last 200 points
      },

      clearHistory: () => set({ history: [] }),

      clearAll: () => set({ holdings: [], trades: [], history: [] }),

      syncFromBackend: async () => {
        try {
          const { data: userData, error: userError } =
            await supabase.auth.getUser();
          if (userError || !userData?.user) return;
          const userId = userData.user.id;
          const { data, error } = await supabase
            .from("holdings")
            .select("stock_symbol, quantity, average_buy_price")
            .eq("user_id", userId);

          if (error || !data) {
            if (error) {
              console.error("Failed to load holdings from Supabase", error);
            }
            return;
          }

          const mappedHoldings: Holding[] = data.map((row: any) => {
            const meta = mockStocks.find((m) => m.symbol === row.stock_symbol);
            return {
              stockId: row.stock_symbol,
              symbol: row.stock_symbol,
              name: meta?.name ?? row.stock_symbol,
              quantity: row.quantity ?? 0,
              avgBuyPrice: Number(row.average_buy_price ?? 0),
            };
          });

          // Fetch transactions history
          const { data: txData, error: txError } = await supabase
            .from("transactions")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(50);

          if (txError) {
            console.error("Failed to load transactions", txError);
          }

          let mappedTrades: any[] = [];
          if (txData) {
            mappedTrades = txData.map((tx: any) => {
              const meta = mockStocks.find((m) => m.symbol === tx.stock_symbol);
              return {
                id: tx.id,
                stockId: meta?.id ?? tx.stock_symbol,
                symbol: tx.stock_symbol,
                quantity: tx.quantity,
                price: tx.price,
                type: tx.type,
                date: tx.created_at,
              };
            });
          }

          set((state) => ({
            ...state,
            holdings: mappedHoldings,
            trades: mappedTrades,
          }));
        } catch (err) {
          console.error("Error syncing holdings from Supabase", err);
        }
      },
    }),
    {
      name: "portfolio-storage",
    }
  )
);

export default usePortfolioStore;

async function syncHoldingAndTransaction(params: {
  holding: Holding;
  tradeQuantity: number;
  tradePrice: number;
  tradeType: "BUY" | "SELL";
}) {
  try {
    const { holding, tradeQuantity, tradePrice, tradeType } = params;

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) return;
    const userId = userData.user.id;

    const now = new Date().toISOString();

    // Sync holdings table
    if (tradeType === "SELL" && holding.quantity <= 0) {
      const { error: delError } = await supabase
        .from("holdings")
        .delete()
        .eq("user_id", userId)
        .eq("stock_symbol", holding.symbol);
      if (delError) {
        console.error("Failed to delete holding in Supabase", delError);
      }
    } else {
      const { data: existingRows, error: selectError } = await supabase
        .from("holdings")
        .select("id")
        .eq("user_id", userId)
        .eq("stock_symbol", holding.symbol)
        .limit(1);

      const existing = existingRows && existingRows[0];

      if (!selectError && existing) {
        const { error: updateError } = await supabase
          .from("holdings")
          .update({
            quantity: holding.quantity,
            average_buy_price: holding.avgBuyPrice,
            updated_at: now,
          })
          .eq("id", existing.id);
        if (updateError) {
          console.error("Failed to update holding in Supabase", updateError);
        }
      } else {
        const { error: insertError } = await supabase.from("holdings").insert({
          user_id: userId,
          stock_symbol: holding.symbol,
          quantity: holding.quantity,
          average_buy_price: holding.avgBuyPrice,
          created_at: now,
          updated_at: now,
        });
        if (insertError) {
          console.error("Failed to insert holding in Supabase", insertError);
        }
      }
    }

    // Record transaction
    const { error: txError } = await supabase.from("transactions").insert({
      user_id: userId,
      stock_symbol: holding.symbol,
      quantity: tradeQuantity,
      price: tradePrice,
      type: tradeType,
      created_at: now,
    } as any);
    if (txError) {
      console.error("Failed to insert transaction in Supabase", txError);
    }
  } catch (err) {
    console.error("Error syncing portfolio to Supabase", err);
  }
}

// Push the latest local cash balance into the profile's `points` field
// so that Home and other sessions reflect the same virtual cash.
async function syncCashBalanceToProfile() {
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) return;
    const userId = userData.user.id;

    const balance = useBalanceStore.getState().balance;

    const { error } = await supabase
      .from("profiles")
      .update({ points: balance })
      .eq("id", userId);

    if (error) {
      console.error("Failed to sync cash balance to profile", error);
    }
  } catch (err) {
    console.error("Error syncing cash balance to profile", err);
  }
}
