const tooltipContent = {
  price: "The forward price per unit of base currency.",
  limit: "Worst price you could get due to slippage.",
  spotPrice:
    "The price at which the base currency is currently trading on the spot market. Your trade is routed through a DEX meta aggregator to get the best possible price.",
  basisAPR: {
    text: (
      <div className="flex flex-col gap-1">
        <span>
          Difference between the interest earned from lending, and interest paid for borrowing. Positive means you're getting paid to keep
          position open, negative means you're paying to keep position open.
        </span>
        <span>
          For yield bearing assets like stETH, sDAI, etc, the implicit rate of the asset is added to the (borrowing/lending) rate.
        </span>
      </div>
    ),
    formula: (
      <div className="flex flex-col gap-1">
        <span>{"APR = lending rate - (borrowing rate * debt ratio)"}</span>
        <span>{"debt ratio = 1 - (1 / leverage)"}</span>
      </div>
    ),
  },
  basis: {
    text: "The absolute difference between the entry price and the spot price. If positive the market is in contango, if negative the market is in backwardation.",
    formula: "basis = entry price - spot price",
  },
  positionValue: {
    text: "",
    formula: "position value = price × quantity",
  },
  leverage: {
    text: "Value by which your equity is multiplied to increase your position exposure. The max value indicates the threshold above which your position is eligible for liquidation.",
    formula: "leverage = 1 / margin",
  },
  margin: {
    text: "Relative value between debt and collateral. The min value indicates the threshold below which your position is eligible for liquidation.",
    formula: "margin = (collateral – debt) / collateral",
  },
  fee: "The transaction fee paid to trade on Contango.",
  expiryDate: "Date at which you can get the base currency delivered.",
  entryPrice: "The average price per unit of base currency at which you entered the position.",
  exitPrice: "Price you would get if the position was closed now",
  equity: {
    text: "The money you will receive if you were to close the position now",
    formula: "equity = deposits - withdrawals + unrealised PnL",
  },
  fees: "Fees paid up until now to the protocol.",
  totalFees: "Existing fees + estimated fee of closing",
  pnl: {
    text: "The unrealised profit/loss of the position",
    formula: "PnL = size * (exit price - entry price) - accrued fees - fees of closing",
  },
  realisedPnl: {
    text: "The realised profit/loss of the position",
    formula: "realised PnL = size * (exit price - entry price) - fees",
  },
  grossPnL: {
    text: "Profit/Loss before fees",
    formula: "profit/loss = position size * (exit price - entry price)",
  },
  collateral: "Deposits - Withdrawals",
  slippage: "Your transaction will revert if the price changes unfavorably by more than this percentage",
  amountToReceive: "Estimated amount to be received on the user wallet",
  liquidationPrice: "When the mark price reaches this value, your position will be eligible for liquidation.",
  deliveryCost: "Cost of repaying debt",
  deliveryQuantity: "Amount you will receive from physical delivery.",
  markPrice: `Estimated true value of a contract. It is calculated using decentralised price feeds and is used to determine the value of your position.`,
  tradeSize: "Positive means position size was increased. Negative means position size was decreased",
  userCashflow: "Positive means user deposited funds. Negative means user withdrew funds",
} as const

export const tooltipMapper = (key: keyof typeof tooltipContent) => {
  const property = tooltipContent[key]
  return typeof property === "string" ? (
    property
  ) : (
    <div>
      <span>{property.text}</span>
      <span className="block pt-2 text-sm italic">{property.formula}</span>
    </div>
  )
}

export type TooltipKey = Parameters<typeof tooltipMapper>["0"]
