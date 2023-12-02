import { Hex } from "viem"

export enum MoneyMarket {
    Aave = 1,
    Compound = 2,
    Yield = 3,
    Exactly = 4,
    Sonne = 5,
    Maker = 6,
    Spark = 7
}

// Define the structure for the return type of getTradeParams
type TradeParamsType = {
    positionId: number; // Replace with the actual type
    quantity: bigint;
    cashflow: bigint;
    cashflowCcy: number; // Replace with the actual type
    limitPrice: number; // Replace with the actual type
};

// Define the structure of ExecParams
type ExecParamsType = {
    swapBytes: string;
    swapAmount: bigint; // Assuming swapAmount is a bigint
    flashLoanProvider: string; // Replace with the actual type
    spender: string;
    router: string;
};

// Define the structure of Source (example structure, adjust according to actual data)
type SourceType = {
    name: string;
    logoURI: string;
};

// Define the QuoteSwapReturnType
export type QuoteSwapReturnType = Array<{
    tradeParams: TradeParamsType;
    execParams: ExecParamsType;
    price: bigint; // Replace with the actual type of price
    source: SourceType;
}>;

export enum Side {
    Long = "Long",
    Short = "Short"
};

export enum CashflowCurrency {
    None = 0,
    Base = 1,
    Quote = 2
}

export type QuoteTradeParams = {
    side: Side; // Assuming Side is a predefined type or enum
    quantity: bigint;
    leverage: bigint;
    slippageTolerance: bigint;
    cashflowCcy: CashflowCurrency; // Assuming CashflowCurrency is a predefined enum
    excludedFlashloanProviders?: Set<Hex>; // Assuming Hex is a predefined type
};

export type TradeQuote = {
    meta: {
        addresses: {
            spotExecutor: string; // Replace with the actual type
        };
        instrument: {
            base: string; // Replace with the actual type if different
            quote: string; // Replace with the actual type if different
            baseUnit: number | bigint; // Replace with the actual type if different
        };
        normalisedBalances: number | bigint;
        chainId: number;
    };
    swapAmount: bigint;
    swapCcy: number; // or an enum type if you have defined it
    cashflowUsed: bigint;
    cashflowCcy: number; // or an enum type if you have defined it
    slippageDirection: number; // or an enum type if you have defined it
    flashLoanProvider: string; // Replace with the actual type if different,
};

export enum CurrencyId {
    ETH = "ETH",
    DAI = "DAI",
    USDC = "USDC",
    USDT = "USDT",
    WETH = "WETH"
  };