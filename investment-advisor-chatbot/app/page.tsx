"use client"

import { useEffect, useState } from "react"
import { ChatInterface } from "@/components/chat-interface"
import { Sidebar } from "@/components/sidebar"

export default function Home() {
  const [riskTolerance, setRiskTolerance] = useState<string>("moderate")
  const [investmentReason, setInvestmentReason] = useState<string>("")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        riskTolerance={riskTolerance}
        setRiskTolerance={setRiskTolerance}
        investmentReason={investmentReason}
        setInvestmentReason={setInvestmentReason}
      />
      <ChatInterface riskTolerance={riskTolerance} investmentReason={investmentReason} />
    </div>
  )
}
