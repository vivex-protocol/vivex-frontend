import { classNames } from "@/utils/classNames"
import { Tab } from "@headlessui/react"
import { PropsWithChildren, useEffect, useRef, useState } from "react"
import { noop } from "rxjs"
// import { ChartingLibraryWidgetOptions, IChartingLibraryWidget, ResolutionString, widget } from "../../charting_library"
import { selectedPair$ } from "../CreateTicket/state"
import { datafeed } from "./datafeed"
import * as env from "../../env"

const baseUrl = env.BASE_URL

const Option: React.FC<
  PropsWithChildren<{
    testId?: string
  }>
> = ({ children, testId }) => {
  return (
    <Tab
      className={({ selected }) =>
        classNames(
          "block font-primary text-sm py-1 px-3 rounded-full items-center hover:bg-backgrounds-300 focus:outline-none",
          selected ? "text-accents-500 hover:text-accents-500" : "text-fontColor-400 hover:text-fontColor-200",
        )
      }
      data-testid={testId}
    >
      {children}
    </Tab>
  )
}

export const TradingViewChart = () => {
  const chartContainerRef = useRef<HTMLDivElement>() as React.MutableRefObject<HTMLInputElement>
  // @ts-ignore
  const widgetRef = useRef<TradingView.IChartingLibraryWidget>()
  // @ts-ignore
  const setResolution = (res: TradingView.ResolutionString) => {
    if (!widgetRef.current) return
    widgetRef.current.setSymbol(widgetRef.current.symbolInterval().symbol, res, noop)
  }

  useEffect(() => {
    const sub = selectedPair$.subscribe((x) => {
      if (widgetRef.current && widgetRef.current.symbolInterval().symbol !== x.chartTicker) {
        widgetRef.current.setSymbol(x.chartTicker, widgetRef.current.symbolInterval().interval, noop)
      }
      if (widgetRef.current) return
      // @ts-ignore
      widgetRef.current = new TradingView.widget({
        symbol: x.chartTicker,
        datafeed,
        // @ts-ignore
        interval: "240" as TradingView.ChartingLibraryWidgetOptions["interval"],
        container: chartContainerRef.current,
        library_path: `${baseUrl}charting_library/`,
        loading_screen: {
          backgroundColor: "#20222E",
          foregroundColor: "#4DFFE0",
        },
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone as any,
        disabled_features: [
          "study_templates",
          "create_volume_indicator_by_default",
          "display_market_status",
          "use_localstorage_for_settings",
          "header_widget",
          "control_bar",
          "timeframes_toolbar",
          "header_symbol_search",
          "symbol_search_hot_key",
          "symbol_info",
          "left_toolbar", // drawing bullshit. style better and re-enable when done
        ],
        enabled_features: ["hide_main_series_symbol_from_indicator_legend", "hide_resolution_in_legend", "hide_left_toolbar_by_default"],
        overrides: {
          "paneProperties.background": "#141622",
          "paneProperties.backgroundType": "solid",
          "mainSeriesProperties.showCountdown": false,
          "paneProperties.legendProperties.showSeriesTitle": false,
          "paneProperties.legendProperties.showSeriesOHLC": true,
          "paneProperties.legendProperties.showBarChange": true,
          "scalesProperties.fontSize": 12,
          "mainSeriesProperties.candleStyle.wickUpColor": "#31D86A",
          "mainSeriesProperties.candleStyle.upColor": "#31D86A",
          "mainSeriesProperties.candleStyle.borderUpColor": "#31D86A",
          "mainSeriesProperties.candleStyle.wickDownColor": "#E84865",
          "mainSeriesProperties.candleStyle.downColor": "#E84865",
          "mainSeriesProperties.candleStyle.borderDownColor": "#E84865",
          "mainSeriesProperties.hollowCandleStyle.upColor": "#31D86A",
          "mainSeriesProperties.hollowCandleStyle.downColor": "#E84865",
          "mainSeriesProperties.hollowCandleStyle.borderUpColor": "#31D86A",
          "mainSeriesProperties.hollowCandleStyle.borderDownColor": "#E84865",
          "mainSeriesProperties.hollowCandleStyle.wickUpColor": "#31D86A",
          "mainSeriesProperties.hollowCandleStyle.wickDownColor": "#E84865",
          "mainSeriesProperties.barStyle.upColor": "#31D86A",
          "mainSeriesProperties.barStyle.downColor": "#E84865",
          "mainSeriesProperties.haStyle.upColor": "#31D86A",
          "mainSeriesProperties.haStyle.downColor": "#E84865",
          "mainSeriesProperties.haStyle.borderUpColor": "#31D86A",
          "mainSeriesProperties.haStyle.borderDownColor": "#E84865",
          "mainSeriesProperties.haStyle.wickUpColor": "#31D86A",
          "mainSeriesProperties.haStyle.wickDownColor": "#E84865",
          "mainSeriesProperties.columnStyle.upColor": "#31D86A",
          "mainSeriesProperties.columnStyle.downColor": "#E84865",
          "mainSeriesProperties.hiloStyle.color": "#279AF5",
          "mainSeriesProperties.hiloStyle.borderColor": "#279AF5",
          "mainSeriesProperties.hiloStyle.labelColor": "#000000",
          "mainSeriesProperties.lineStyle.linewidth": 1,
          "mainSeriesProperties.lineStyle.color": "#31D86A",
          "mainSeriesProperties.areaStyle.linewidth": 1,
          "mainSeriesProperties.areaStyle.color1": "rgba(63, 185, 35, 0.20)",
          "mainSeriesProperties.areaStyle.color2": "rgba(63, 185, 35, 0.05)",
          "mainSeriesProperties.areaStyle.linecolor": "#31D86A",
          "mainSeriesProperties.baselineStyle.topLineWidth": 1,
          "mainSeriesProperties.baselineStyle.bottomLineWidth": 1,
          "mainSeriesProperties.baselineStyle.baselineColor": "#31D86A",
          "mainSeriesProperties.baselineStyle.topFillColor1": "rgba(63, 185, 35, 0.20)",
          "mainSeriesProperties.baselineStyle.topFillColor2": "rgba(63, 185, 35, 0.05)",
          "mainSeriesProperties.baselineStyle.bottomFillColor1": "rgba(232, 70, 74, 0.05)",
          "mainSeriesProperties.baselineStyle.bottomFillColor2": "rgba(232, 70, 74, 0.20)",
          "mainSeriesProperties.baselineStyle.topLineColor": "#31D86A",
          "mainSeriesProperties.baselineStyle.bottomLineColor": "#E84865",
        },
        widgetbar: {
          details: false,
          watchlist: false,
          watchlist_settings: {
            default_symbols: [],
          },
        },
        trading_customization: {
          position: {},
          order: {},
        },
        locale: "en",
        fullscreen: false,
        autosize: true,
        theme: "Dark",
        custom_css_url: `${baseUrl}custom-trading-view.css`,
        custom_font_family: "'Plus Jakarta Sans', sans-serif",
      })
    })

    return () => {
      widgetRef.current?.remove()
      widgetRef.current = undefined
      sub.unsubscribe()
    }
  }, [])

  const [selectedIndex, setSelectedIndex] = useState(1)
  const options = [
    { value: "1D", label: "1 Day" },
    { value: "240", label: "4 Hours" },
    { value: "60", label: "1 Hour" },
    { value: "15", label: "15 Mins" },
    { value: "5", label: "5 Mins" },
    { value: "1", label: "1 Min" },
  ]

  return (
    <div className="flex flex-col w-full h-full rounded-lg p-4 bg-backgrounds-100">
      <div className="flex items-center gap-3">
        <Tab.Group
          selectedIndex={selectedIndex}
          onChange={(index) => {
            setSelectedIndex(index)
            // @ts-ignore
            setResolution(options[index].value as TradingView.ResolutionString)
          }}
        >
          <Tab.List className="flex items-center">
            {options.map((option) => (
              <Option key={option.value}> {option.label} </Option>
            ))}
          </Tab.List>
        </Tab.Group>
      </div>
      <div ref={chartContainerRef} className="h-full w-full rounded-b-lg overflow-hidden" />
    </div>
  )
}
