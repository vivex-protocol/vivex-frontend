import { formatCurrency, getDecimalSeparator, parseCurrency } from "@/utils/currency-utils"
import { useReducer } from "react"

interface State {
  value: bigint | null
  decimals: number
  text: string
}

interface Reset {
  type: "reset"
  payload: Omit<State, "text">
}
interface TextChanged {
  type: "change"
  payload: Omit<State, "decimals">
}

function init({ value, decimals }: Reset["payload"]): State {
  return {
    value,
    decimals,
    text: formatCurrency(value, decimals, { nDecimals: Infinity }),
  }
}

function reducer(state: State, { type, payload }: Reset | TextChanged): State {
  // prettier-ignore
  return type === "change"
    ? { ...state, ...payload }
    : state.value === payload.value && state.decimals === payload.decimals
      ? state
      : init(payload)
}

function isPendingZero(value: string, decimals: number, separator: string) {
  const [, decimalPart] = value.split(separator)
  return decimalPart && decimalPart.length <= decimals && decimalPart.endsWith("0")
}

export const useCurrencyInput = (
  value: bigint | null,
  decimals: number,
  onChange?: (value: bigint | null) => void,
): [value: string, onChange: React.ChangeEventHandler<HTMLInputElement> | undefined] => {
  const [state, dispatch] = useReducer(reducer, { value, decimals }, init)
  if (state.value !== value || state.decimals !== decimals) {
    dispatch({ type: "reset", payload: { value, decimals } })
  }

  return [
    state.text,
    onChange &&
      (({ target: { value: eventValue } }: React.ChangeEvent<HTMLInputElement>) => {
        if (eventValue === "") {
          onChange(null)
          return
        }
        let value: bigint | null
        let separator: string | null
        try {
          separator = getDecimalSeparator(eventValue)
          value = parseCurrency(eventValue, decimals)
        } catch (_) {
          return
        }

        if (value !== state.value) {
          const formatOptions = {
            nDecimals: Infinity,
            ...(separator && { decimalSeparator: separator }),
          }
          dispatch({
            type: "change",
            payload: {
              value,
              text: eventValue.length > state.text.length ? formatCurrency(value, decimals, formatOptions) : eventValue,
            },
          })
          onChange(value)
          return
        }

        if (eventValue.length < state.text.length || (separator && isPendingZero(eventValue, decimals, separator))) {
          dispatch({
            type: "change",
            payload: {
              value,
              text: eventValue,
            },
          })
        }
      }),
  ]
}
