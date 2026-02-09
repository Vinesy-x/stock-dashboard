import { useState, useEffect, useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement,
} from 'chart.js'
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import './App.css'

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler
)

const VERSION = 'v1.1.0'

const STOCK_POOL: Record<string, string> = {
  '002174': '游族网络', '002517': '恺英网络', '002555': '三七互娱',
  '002558': '巨人网络', '002292': '奥飞娱乐', '603258': '电魂网络',
  '002460': '赣锋锂业', '002466': '天齐锂业', '600995': '南网储能',
  '601222': '林洋能源', '600905': '三峡能源', '002240': '盛新锂能',
  '600570': '恒生电子', '600877': '电科芯片', '603068': '博通集成',
  '002138': '顺络电子', '603678': '火炬电子', '601231': '环旭电子',
  '000425': '徐工机械', '002031': '巨轮智能', '601615': '明阳智能',
  '002097': '山河智能', '603011': '合锻智能', '000977': '浪潮信息',
  '000988': '华工科技', '002230': '科大讯飞', '600588': '用友网络',
  '000555': '神州信息', '000733': '振华科技',
}

// Seeded random for consistent daily data
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function generateStocks() {
  const now = new Date()
  const seed = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate() + now.getHours()
  
  return Object.entries(STOCK_POOL).map(([code, name], idx) => {
    const r = seededRandom(seed + idx * 137)
    const r2 = seededRandom(seed + idx * 293)
    const basePrice = 10 + r * 50
    const change = (r2 - 0.45) * 12
    return {
      code,
      name,
      price: Math.round(basePrice * 100) / 100,
      change_pct: Math.round(change * 100) / 100,
      volume: Math.floor(500000 + r * 30000000)
    }
  }).sort((a, b) => b.change_pct - a.change_pct)
}

function generateHistory(code: string, startDate: string, endDate: string) {
  const seed = code.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const days: { date: string; close: number }[] = []
  let current = new Date(startDate)
  const end = new Date(endDate)
  let price = 15 + seededRandom(seed) * 40

  while (current <= end) {
    if (current.getDay() !== 0 && current.getDay() !== 6) {
      const r = seededRandom(seed + days.length * 17)
      price = price * (1 + (r - 0.48) * 0.06)
      days.push({
        date: current.toISOString().slice(0, 10),
        close: Math.round(price * 100) / 100
      })
    }
    current.setDate(current.getDate() + 1)
  }
  return days
}

function calculateRSI(closes: number[], period = 14): number[] {
  if (closes.length < period + 1) return closes.map(() => 50)
  const rsi: number[] = Array(period).fill(50)
  let gains = 0, losses = 0
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff > 0) gains += diff
    else losses -= diff
  }
  let avgGain = gains / period
  let avgLoss = losses / period || 0.001
  rsi.push(100 - 100 / (1 + avgGain / avgLoss))
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period || 0.001
    rsi.push(100 - 100 / (1 + avgGain / avgLoss))
  }
  return rsi
}

function runBacktest(startDate: string, endDate: string) {
  const SHORT_MA = 5, LONG_MA = 20, INITIAL = 100000, POS_SIZE = 0.1, MAX_POS = 5

  const allData: Record<string, { date: string; close: number; maShort: number | null; maLong: number | null; rsi: number }[]> = {}
  
  for (const code of Object.keys(STOCK_POOL)) {
    const hist = generateHistory(code, startDate, endDate)
    if (hist.length < LONG_MA + 5) continue
    const closes = hist.map(d => d.close)
    const maShort = closes.map((_, i) => i < SHORT_MA - 1 ? null : closes.slice(i - SHORT_MA + 1, i + 1).reduce((a, b) => a + b) / SHORT_MA)
    const maLong = closes.map((_, i) => i < LONG_MA - 1 ? null : closes.slice(i - LONG_MA + 1, i + 1).reduce((a, b) => a + b) / LONG_MA)
    const rsi = calculateRSI(closes)
    allData[code] = hist.map((d, i) => ({ date: d.date, close: d.close, maShort: maShort[i], maLong: maLong[i], rsi: rsi[i] }))
  }

  const tradingDays = Object.values(allData)[0]?.map(d => d.date).filter(d => d >= startDate && d <= endDate) || []
  
  let cash = INITIAL
  const positions: Record<string, { shares: number; cost: number; name: string }> = {}
  const trades: { datetime: string; action: 'buy' | 'sell'; code: string; name: string; price: number; shares: number; amount: number; profit: number; reason: string }[] = []
  const dailyValues: { date: string; total_value: number; profit_pct: number }[] = []

  for (let dayIdx = 0; dayIdx < tradingDays.length; dayIdx++) {
    const date = tradingDays[dayIdx]
    let posValue = 0
    for (const [code, pos] of Object.entries(positions)) {
      const today = allData[code]?.find(d => d.date === date)
      posValue += pos.shares * (today?.close || pos.cost)
    }
    const totalValue = cash + posValue
    dailyValues.push({ date, total_value: Math.round(totalValue * 100) / 100, profit_pct: Math.round((totalValue / INITIAL - 1) * 10000) / 100 })

    if (dayIdx === 0) continue

    for (const [code, data] of Object.entries(allData)) {
      const todayIdx = data.findIndex(d => d.date === date)
      if (todayIdx < 1) continue
      const today = data[todayIdx], prev = data[todayIdx - 1]
      if (prev.maShort === null || prev.maLong === null) continue

      if (positions[code]) {
        let sell = false, reason = ''
        if (prev.maShort >= prev.maLong && today.maShort! < today.maLong!) { sell = true; reason = 'MA死叉' }
        else if (today.rsi > 80) { sell = true; reason = 'RSI超买' }
        if (sell) {
          const pos = positions[code]
          const amount = pos.shares * today.close
          const profit = (today.close - pos.cost) * pos.shares
          trades.push({
            datetime: `${date} ${9 + dayIdx % 3}:${String(30 + (trades.length * 11) % 30).padStart(2, '0')}`,
            action: 'sell', code, name: STOCK_POOL[code], price: Math.round(today.close * 100) / 100,
            shares: pos.shares, amount: Math.round(amount * 100) / 100, profit: Math.round(profit * 100) / 100, reason
          })
          cash += amount
          delete positions[code]
        }
      } else if (Object.keys(positions).length < MAX_POS) {
        if (prev.maShort <= prev.maLong && today.maShort! > today.maLong! && today.rsi < 70) {
          const buyAmount = cash * POS_SIZE
          const shares = Math.floor(buyAmount / today.close / 100) * 100
          if (shares >= 100 && cash >= shares * today.close) {
            const cost = shares * today.close
            trades.push({
              datetime: `${date} ${9 + dayIdx % 3}:${String(30 + (trades.length * 11) % 30).padStart(2, '0')}`,
              action: 'buy', code, name: STOCK_POOL[code], price: Math.round(today.close * 100) / 100,
              shares, amount: Math.round(cost * 100) / 100, profit: 0, reason: 'MA金叉'
            })
            cash -= cost
            positions[code] = { shares, cost: today.close, name: STOCK_POOL[code] }
          }
        }
      }
    }
  }

  const finalPositions = Object.entries(positions).map(([code, pos]) => {
    const current = allData[code]?.[allData[code].length - 1]?.close || pos.cost
    return {
      code, name: pos.name, shares: pos.shares, cost: Math.round(pos.cost * 100) / 100,
      current_price: Math.round(current * 100) / 100,
      profit: Math.round((current - pos.cost) * pos.shares * 100) / 100,
      profit_pct: Math.round((current / pos.cost - 1) * 10000) / 100
    }
  })

  const finalValue = dailyValues[dailyValues.length - 1]?.total_value || INITIAL
  return {
    initial_capital: INITIAL, final_value: finalValue,
    total_profit: Math.round((finalValue - INITIAL) * 100) / 100,
    total_return: Math.round((finalValue / INITIAL - 1) * 10000) / 100,
    trades, daily_values: dailyValues, positions: finalPositions,
    trade_count: trades.length,
    buy_count: trades.filter(t => t.action === 'buy').length,
    sell_count: trades.filter(t => t.action === 'sell').length,
  }
}

type TabType = 'overview' | 'signals' | 'stocks' | 'simulate'

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [updateTime, setUpdateTime] = useState('')
  const [startDate, setStartDate] = useState('2026-01-01')
  const [endDate, setEndDate] = useState('2026-02-09')
  const [backtest, setBacktest] = useState<ReturnType<typeof runBacktest> | null>(null)
  const [simLoading, setSimLoading] = useState(false)

  const stocks = useMemo(() => generateStocks(), [])
  const buySignals = useMemo(() => stocks.filter(s => s.change_pct > 3).slice(0, 5), [stocks])
  const sellSignals = useMemo(() => stocks.filter(s => s.change_pct < -2).slice(0, 5), [stocks])

  useEffect(() => {
    const now = new Date()
    setUpdateTime(now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
  }, [])

  const refresh = () => {
    setUpdateTime(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
  }

  const doBacktest = () => {
    setSimLoading(true)
    setTimeout(() => {
      setBacktest(runBacktest(startDate, endDate))
      setSimLoading(false)
    }, 100)
  }

  const totalUp = stocks.filter(s => s.change_pct > 0).length
  const totalDown = stocks.filter(s => s.change_pct < 0).length
  const avgChange = stocks.reduce((sum, s) => sum + s.change_pct, 0) / stocks.length

  const pieData = {
    labels: ['上涨', '下跌', '平盘'],
    datasets: [{ data: [totalUp, totalDown, stocks.length - totalUp - totalDown], backgroundColor: ['#22c55e', '#ef4444', '#6b7280'], borderWidth: 0 }]
  }

  const barData = {
    labels: stocks.slice(0, 8).map(s => s.name.slice(0, 4)),
    datasets: [{ data: stocks.slice(0, 8).map(s => s.change_pct), backgroundColor: stocks.slice(0, 8).map(s => s.change_pct >= 0 ? '#22c55e' : '#ef4444'), borderRadius: 4 }]
  }

  const chartOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af', font: { size: 10 } } }, x: { grid: { display: false }, ticks: { color: '#9ca3af', font: { size: 10 } } } } }
  const pieOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' as const, labels: { color: '#9ca3af', padding: 15 } } } }

  const lineData = backtest ? {
    labels: backtest.daily_values.map(d => d.date.slice(5)),
    datasets: [{ label: '收益率%', data: backtest.daily_values.map(d => d.profit_pct), borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true, tension: 0.4 }]
  } : null

  return (
    <div className="app">
      <header className="header">
        <div className="header-title"><h1>📊 量化看板</h1><span className="version">{VERSION}</span></div>
        <div className="header-right"><span className="update-time">{updateTime}</span><button className="refresh-btn" onClick={refresh}>🔄</button></div>
      </header>

      <main className="main">
        {activeTab === 'overview' && (
          <div className="tab-content">
            <div className="stat-grid">
              <div className="stat-card"><div className="stat-value">{stocks.length}</div><div className="stat-label">关注股票</div></div>
              <div className="stat-card up"><div className="stat-value">{totalUp}</div><div className="stat-label">上涨</div></div>
              <div className="stat-card down"><div className="stat-value">{totalDown}</div><div className="stat-label">下跌</div></div>
              <div className={`stat-card ${avgChange >= 0 ? 'up' : 'down'}`}><div className="stat-value">{avgChange >= 0 ? '+' : ''}{avgChange.toFixed(2)}%</div><div className="stat-label">平均涨跌</div></div>
            </div>
            <div className="quick-signals">
              <div className="signal-summary buy" onClick={() => setActiveTab('signals')}><span className="signal-count">{buySignals.length}</span><span className="signal-text">买入信号</span><span className="arrow">→</span></div>
              <div className="signal-summary sell" onClick={() => setActiveTab('signals')}><span className="signal-count">{sellSignals.length}</span><span className="signal-text">卖出信号</span><span className="arrow">→</span></div>
            </div>
            <div className="chart-section"><h3>涨跌分布</h3><div className="pie-container"><Doughnut data={pieData} options={pieOpts} /></div></div>
            <div className="chart-section"><h3>涨跌榜 TOP8</h3><div className="bar-container"><Bar data={barData} options={chartOpts} /></div></div>
          </div>
        )}

        {activeTab === 'signals' && (
          <div className="tab-content">
            <div className="signal-section"><h3>📈 买入信号</h3>
              {buySignals.length === 0 ? <div className="empty-state">暂无买入信号</div> : (
                <div className="signal-list">{buySignals.map((s, i) => (
                  <div key={i} className="signal-card buy">
                    <div className="signal-header"><span className="signal-badge">买入</span><span className={`signal-change ${s.change_pct >= 0 ? 'up' : 'down'}`}>{s.change_pct >= 0 ? '+' : ''}{s.change_pct}%</span></div>
                    <div className="signal-body"><div className="signal-name">{s.name}</div><div className="signal-code">{s.code}</div></div>
                    <div className="signal-footer"><span className="signal-price">¥{s.price}</span></div>
                  </div>
                ))}</div>
              )}
            </div>
            <div className="signal-section"><h3>📉 卖出信号</h3>
              {sellSignals.length === 0 ? <div className="empty-state">暂无卖出信号</div> : (
                <div className="signal-list">{sellSignals.map((s, i) => (
                  <div key={i} className="signal-card sell">
                    <div className="signal-header"><span className="signal-badge">卖出</span><span className={`signal-change ${s.change_pct >= 0 ? 'up' : 'down'}`}>{s.change_pct >= 0 ? '+' : ''}{s.change_pct}%</span></div>
                    <div className="signal-body"><div className="signal-name">{s.name}</div><div className="signal-code">{s.code}</div></div>
                    <div className="signal-footer"><span className="signal-price">¥{s.price}</span></div>
                  </div>
                ))}</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'stocks' && (
          <div className="tab-content">
            <div className="stock-header"><span>股票</span><span>价格</span><span>涨跌</span></div>
            <div className="stock-list">{stocks.map((s, i) => (
              <div key={i} className="stock-item">
                <div className="stock-info"><div className="stock-name">{s.name}</div><div className="stock-code">{s.code}</div></div>
                <div className="stock-price">¥{s.price}</div>
                <div className={`stock-change ${s.change_pct >= 0 ? 'up' : 'down'}`}>{s.change_pct >= 0 ? '+' : ''}{s.change_pct}%</div>
              </div>
            ))}</div>
          </div>
        )}

        {activeTab === 'simulate' && (
          <div className="tab-content">
            <div className="sim-form">
              <h3>📈 策略回测</h3>
              <div className="form-row">
                <div className="form-group"><label>开始日期</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
                <div className="form-group"><label>结束日期</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
              </div>
              <button className="sim-btn" onClick={doBacktest} disabled={simLoading}>{simLoading ? '计算中...' : '开始回测'}</button>
            </div>

            {backtest && (
              <div className="sim-result">
                <div className="sim-summary">
                  <div className="sim-stat"><div className="sim-stat-label">初始资金</div><div className="sim-stat-value">¥{backtest.initial_capital.toLocaleString()}</div></div>
                  <div className="sim-stat"><div className="sim-stat-label">最终资产</div><div className="sim-stat-value">¥{backtest.final_value.toLocaleString()}</div></div>
                  <div className={`sim-stat ${backtest.total_profit >= 0 ? 'up' : 'down'}`}><div className="sim-stat-label">总收益</div><div className="sim-stat-value">{backtest.total_profit >= 0 ? '+' : ''}¥{backtest.total_profit.toLocaleString()}</div></div>
                  <div className={`sim-stat ${backtest.total_return >= 0 ? 'up' : 'down'}`}><div className="sim-stat-label">收益率</div><div className="sim-stat-value">{backtest.total_return >= 0 ? '+' : ''}{backtest.total_return}%</div></div>
                </div>
                <div className="sim-stats-row"><span>交易 {backtest.trade_count} 笔</span><span>买入 {backtest.buy_count} 次</span><span>卖出 {backtest.sell_count} 次</span></div>
                {lineData && <div className="chart-section"><h3>收益曲线</h3><div className="line-container"><Line data={lineData} options={chartOpts} /></div></div>}
                <div className="sim-section"><h3>📝 交易记录</h3>
                  <div className="trade-list">{backtest.trades.map((t, i) => (
                    <div key={i} className={`trade-item ${t.action}`}>
                      <div className="trade-time">{t.datetime}</div>
                      <div className="trade-main"><span className={`trade-action ${t.action}`}>{t.action === 'buy' ? '买入' : '卖出'}</span><span className="trade-stock">{t.name}</span><span className="trade-code">{t.code}</span></div>
                      <div className="trade-detail"><span>¥{t.price} × {t.shares}股 = ¥{t.amount.toLocaleString()}</span>{t.action === 'sell' && <span className={t.profit >= 0 ? 'profit' : 'loss'}>{t.profit >= 0 ? '+' : ''}¥{t.profit}</span>}</div>
                      <div className="trade-reason">{t.reason}</div>
                    </div>
                  ))}</div>
                </div>
                {backtest.positions.length > 0 && (
                  <div className="sim-section"><h3>💼 当前持仓</h3>
                    <div className="position-list">{backtest.positions.map((p, i) => (
                      <div key={i} className="position-item">
                        <div className="position-stock"><div className="position-name">{p.name}</div><div className="position-code">{p.code}</div></div>
                        <div className="position-info"><div>成本 ¥{p.cost} × {p.shares}股</div><div>现价 ¥{p.current_price}</div></div>
                        <div className={`position-profit ${p.profit >= 0 ? 'up' : 'down'}`}>{p.profit >= 0 ? '+' : ''}¥{p.profit}<span>({p.profit_pct >= 0 ? '+' : ''}{p.profit_pct}%)</span></div>
                      </div>
                    ))}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <nav className="tab-bar">
        <button className={`tab-item ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}><span className="tab-icon">📊</span><span className="tab-label">总览</span></button>
        <button className={`tab-item ${activeTab === 'signals' ? 'active' : ''}`} onClick={() => setActiveTab('signals')}><span className="tab-icon">📈</span><span className="tab-label">信号</span>{(buySignals.length + sellSignals.length) > 0 && <span className="tab-badge">{buySignals.length + sellSignals.length}</span>}</button>
        <button className={`tab-item ${activeTab === 'stocks' ? 'active' : ''}`} onClick={() => setActiveTab('stocks')}><span className="tab-icon">📋</span><span className="tab-label">全部</span></button>
        <button className={`tab-item ${activeTab === 'simulate' ? 'active' : ''}`} onClick={() => setActiveTab('simulate')}><span className="tab-icon">🎯</span><span className="tab-label">模拟</span></button>
      </nav>
    </div>
  )
}

export default App
