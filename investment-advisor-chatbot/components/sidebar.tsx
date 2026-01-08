"use client"

import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"

interface SidebarProps {
  riskTolerance: string
  setRiskTolerance: (value: string) => void
  investmentReason: string
  setInvestmentReason: (value: string) => void
}

export function Sidebar({ riskTolerance, setRiskTolerance, investmentReason, setInvestmentReason }: SidebarProps) {
  const riskOptions = [
    { value: "conservative", label: "Conservative" },
    { value: "moderate", label: "Moderate" },
    { value: "aggressive", label: "Aggressive" },
  ]

  const reasonOptions = [
    "Retirement Planning",
    "Wealth Building",
    "Short-term Goals",
    "College Savings",
    "Emergency Fund",
    "Other",
  ]

  return (
    <div className="w-80 border-r border-border bg-card p-6 overflow-y-auto">
      <div className="space-y-8">
        {/* Header */}
        <div className="border-b border-border pb-4">
          <h1 className="text-2xl font-bold text-foreground">Investment Advisor</h1>
          <p className="text-sm text-muted-foreground mt-1">Personalized guidance powered by AI</p>
        </div>

        {/* Risk Tolerance */}
        <div className="space-y-4">
          <Label className="text-base font-semibold text-foreground">Risk Tolerance</Label>
          <div className="space-y-2">
            {riskOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setRiskTolerance(option.value)}
                className={`w-full px-4 py-3 rounded-lg text-left font-medium transition-all ${
                  riskTolerance === option.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-muted"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Investment Reason */}
        <div className="space-y-4">
          <Label className="text-base font-semibold text-foreground">Investment Reason</Label>
          <div className="space-y-2">
            {reasonOptions.map((reason) => (
              <button
                key={reason}
                onClick={() => setInvestmentReason(reason)}
                className={`w-full px-4 py-3 rounded-lg text-left font-medium transition-all ${
                  investmentReason === reason
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-muted"
                }`}
              >
                {reason}
              </button>
            ))}
          </div>
        </div>

        {/* Info Card */}
        <Card className="bg-secondary p-4 border-border">
          <p className="text-sm text-secondary-foreground leading-relaxed">
            Our AI advisor considers your risk profile and investment goals to provide tailored recommendations.
          </p>
        </Card>
      </div>
    </div>
  )
}
