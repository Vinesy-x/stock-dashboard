import { useState, useEffect } from 'react'
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

const API_URL = 'https://stock-api-beryl.vercel.app'

interface Stock {
  code: string; name: string; price: number; change_pct: number
}

interface Trade {
  datetime: string; action: 'buy' | 'sell'; code: string; name: string
  price: number; shares: number; amount: number; profit: number; reason: string
}

interface Position {
  code: string; name: string; shares: number; cost: number
  current_price: number; profit: number; profit_pct: number
}

interface DailyValue {
  date: string; total_value: number; profit_pct: number
}

interface BacktestResult {
  initial_capital: number; final_value: number; total_profit: number
  total_return: number; trades: Trade[]; daily_values: DailyValue[]
  positions: Position[]; trade_count: number; buy_count: number; sell_count: number
}

interface ApiData {
  update_time: string; stocks: Stock[]; buy_signals: Stock[]; sell_signals: Stock[]
}

type TabType = 'overview' | 'signals' | 'stocks' | 'simulate'

function App() {
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  
  // 模拟相关
  const [startDate, setStartDate] = useState('2026-02-02')
  const [endDate, setEndDate] = useState('2026-02-09')
  const [backtest, setBacktest] = useState<BacktestResult | null>(null)
  const [simLoading, setSimLoading] = useState(false)

  const fetchData = async () => {
    try {
      const resp = await fetch(API_URL)
      setData(await resp.json())
    } catch {} finally { setLoading(false) }
  }

  const runBacktest = async () => {
    setSimLoading(true)
    try {
      const resp = await fetch(`${API_URL}?start=${startDate}&end=${endDate}`)
      setBacktest(await resp.json())
    } catch {} finally { setSimLoading(false) }
  }

  useEffect(() => { fetchData(); const t = setInterval(fetchData, 30000); return () => clearInterval(t) }, [])

  if (loading) return <div className="loading-screen"><div className="loading-spinner"></div><p>加载中...</p></div>
  if (!data) return <div className="error-screen"><p>加载失败</p><button onClick={fetchData}>重试</button></div>

  const stocks = data.stocks || []
  const buySignals = data.buy_signals || []
  const sellSignals = data.sell_signals || []
  const totalUp = stocks.filter(s => s.change_pct > 0).length
  const totalDown = stocks.filter(s => s.change_pct < 0).length
  const avgChange = stocks.length > 0 ? stocks.reduce((sum, s) => sum + s.change_pct, 0) / stocks.length : 0

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

  // 回测净值曲线
  const lineData = backtest ? {
    labels: backtest.daily_values.map(d => d.date.slice(5)),
    datasets: [{ label: '收益率%', data: backtest.daily_values.map(d => d.profit_pct), borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true, tension: 0.4 }]
  } : null

  return (
    <div className="app">
      <header className="header">
        <div className="header-title"><h1>📊 量化看板</h1><span className="update-time">{data.update_time?.split(' ')[1] || ''}</span></div>
        <button className="refresh-btn" onClick={fetchData}>🔄</button>
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
                <div className="form-group">
                  <label>开始日期</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>结束日期</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
              </div>
              <button className="sim-btn" onClick={runBacktest} disabled={simLoading}>
                {simLoading ? '计算中...' : '开始回测'}
              </button>
            </div>

            {backtest && (
              <div className="sim-result">
                <div className="sim-summary">
                  <div className="sim-stat">
                    <div className="sim-stat-label">初始资金</div>
                    <div className="sim-stat-value">¥{backtest.initial_capital.toLocaleString()}</div>
                  </div>
                  <div className="sim-stat">
                    <div className="sim-stat-label">最终资产</div>
                    <div className="sim-stat-value">¥{backtest.final_value.toLocaleString()}</div>
                  </div>
                  <div className={`sim-stat ${backtest.total_profit >= 0 ? 'up' : 'down'}`}>
                    <div className="sim-stat-label">总收益</div>
                    <div className="sim-stat-value">{backtest.total_profit >= 0 ? '+' : ''}¥{backtest.total_profit.toLocaleString()}</div>
                  </div>
                  <div className={`sim-stat ${backtest.total_return >= 0 ? 'up' : 'down'}`}>
                    <div className="sim-stat-label">收益率</div>
                    <div className="sim-stat-value">{backtest.total_return >= 0 ? '+' : ''}{backtest.total_return}%</div>
                  </div>
                </div>

                <div className="sim-stats-row">
                  <span>交易 {backtest.trade_count} 笔</span>
                  <span>买入 {backtest.buy_count} 次</span>
                  <span>卖出 {backtest.sell_count} 次</span>
                </div>

                {lineData && (
                  <div className="chart-section">
                    <h3>收益曲线</h3>
                    <div className="line-container"><Line data={lineData} options={chartOpts} /></div>
                  </div>
                )}

                <div className="sim-section">
                  <h3>📝 交易记录</h3>
                  <div className="trade-list">
                    {backtest.trades.map((t, i) => (
                      <div key={i} className={`trade-item ${t.action}`}>
                        <div className="trade-time">{t.datetime}</div>
                        <div className="trade-main">
                          <span className={`trade-action ${t.action}`}>{t.action === 'buy' ? '买入' : '卖出'}</span>
                          <span className="trade-stock">{t.name}</span>
                          <span className="trade-code">{t.code}</span>
                        </div>
                        <div className="trade-detail">
                          <span>¥{t.price} × {t.shares}股 = ¥{t.amount.toLocaleString()}</span>
                          {t.action === 'sell' && <span className={t.profit >= 0 ? 'profit' : 'loss'}>{t.profit >= 0 ? '+' : ''}¥{t.profit}</span>}
                        </div>
                        <div className="trade-reason">{t.reason}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {backtest.positions.length > 0 && (
                  <div className="sim-section">
                    <h3>💼 当前持仓</h3>
                    <div className="position-list">
                      {backtest.positions.map((p, i) => (
                        <div key={i} className="position-item">
                          <div className="position-stock">
                            <div className="position-name">{p.name}</div>
                            <div className="position-code">{p.code}</div>
                          </div>
                          <div className="position-info">
                            <div>成本 ¥{p.cost} × {p.shares}股</div>
                            <div>现价 ¥{p.current_price}</div>
                          </div>
                          <div className={`position-profit ${p.profit >= 0 ? 'up' : 'down'}`}>
                            {p.profit >= 0 ? '+' : ''}¥{p.profit}
                            <span>({p.profit_pct >= 0 ? '+' : ''}{p.profit_pct}%)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <nav className="tab-bar">
        <button className={`tab-item ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          <span className="tab-icon">📊</span><span className="tab-label">总览</span>
        </button>
        <button className={`tab-item ${activeTab === 'signals' ? 'active' : ''}`} onClick={() => setActiveTab('signals')}>
          <span className="tab-icon">📈</span><span className="tab-label">信号</span>
          {(buySignals.length + sellSignals.length) > 0 && <span className="tab-badge">{buySignals.length + sellSignals.length}</span>}
        </button>
        <button className={`tab-item ${activeTab === 'stocks' ? 'active' : ''}`} onClick={() => setActiveTab('stocks')}>
          <span className="tab-icon">📋</span><span className="tab-label">全部</span>
        </button>
        <button className={`tab-item ${activeTab === 'simulate' ? 'active' : ''}`} onClick={() => setActiveTab('simulate')}>
          <span className="tab-icon">🎯</span><span className="tab-label">模拟</span>
        </button>
      </nav>
    </div>
  )
}

export default App
