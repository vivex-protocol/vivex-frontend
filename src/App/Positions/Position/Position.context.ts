import { GraphPosition } from "@/api/graphql/queries"
import { createContext, useContext } from "react"
import { Hex } from "viem"

const positionContext = createContext<GraphPosition>({} as any)
export const usePositionContext = () => useContext(positionContext)

export const PositionContextProvider = positionContext.Provider

const accountContext = createContext<Hex>("" as any)
export const usePositionAccount = () => useContext(accountContext)

export const PositionAccountCtx = accountContext.Provider
