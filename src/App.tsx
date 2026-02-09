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
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import './App.css'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const API_URL = 'https://stock-api-beryl.vercel.app'

interface Stock {
  code: string
  name: string
  price: number
  change_pct: number
  high?: number
  low?: number
  volume?: number
}

interface ApiData {
  update_time: string
  total_value: number
  cash_balance: number
  stocks: Stock[]
  buy_signals: Stock[]
  sell_signals: Stock[]
}

function App() {
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      const resp = await fetch(API_URL)
      const json = await resp.json()
      setData(json)
      setError(null)
    } catch (e) {
      setError('加载失败，请刷新重试')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const timer = setInterval(fetchData, 30000) // 每30秒刷新
    return () => clearInterval(timer)
  }, [])

  if (loading) {
    return <div className="loading">加载中...</div>
  }

  if (error || !data) {
    return <div className="error">{error || '加载失败'}</div>
  }

  const stocks = data.stocks || []
  const buySignals = data.buy_signals || []
  const sellSignals = data.sell_signals || []

  // 计算总览
  const totalUp = stocks.filter(s => s.change_pct > 0).length
  const totalDown = stocks.filter(s => s.change_pct < 0).length
  const avgChange = stocks.length > 0 
    ? (stocks.reduce((sum, s) => sum + s.change_pct, 0) / stocks.length).toFixed(2)
    : '0'

  // 柱状图数据
  const barChartData = {
    labels: stocks.slice(0, 10).map(s => s.name),
    datasets: [
      {
        label: '涨跌幅%',
        data: stocks.slice(0, 10).map(s => s.change_pct),
        backgroundColor: stocks.slice(0, 10).map(s => 
          s.change_pct >= 0 ? 'rgba(34, 197, 94, 0.8)' : 'rgba(239, 68, 68, 0.8)'
        ),
        borderRadius: 4,
      },
    ],
  }

  const barChartOptions = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#9ca3af' } },
      x: { grid: { display: false }, ticks: { color: '#9ca3af', maxRotation: 45 } },
    },
  }

  return (
    <div className="app">
      <header className="header">
        <h1>A股量化看板</h1>
        <div className="header-info">
          <span>游戏 | 储能 | 存储 | 机器人 | AI</span>
          <span>更新: {data.update_time}</span>
        </div>
      </header>

      {/* 总览 */}
      <section className="overview">
        <div className="card overview-card">
          <div className="card-label">关注股票</div>
          <div className="card-value">{stocks.length} 只</div>
        </div>
        <div className="card overview-card profit">
          <div className="card-label">上涨</div>
          <div className="card-value">{totalUp} 只</div>
        </div>
        <div className="card overview-card loss">
          <div className="card-label">下跌</div>
          <div className="card-value">{totalDown} 只</div>
        </div>
        <div className={`card overview-card ${parseFloat(avgChange) >= 0 ? 'profit' : 'loss'}`}>
          <div className="card-label">平均涨跌</div>
          <div className="card-value">{parseFloat(avgChange) >= 0 ? '+' : ''}{avgChange}%</div>
        </div>
      </section>

      {/* 信号区 */}
      <section className="signals">
        <div className="card">
          <h3>📈 买入信号 ({buySignals.length})</h3>
          <div className="signal-list">
            {buySignals.length === 0 ? (
              <div className="no-data">暂无买入信号</div>
            ) : (
              buySignals.map((s, i) => (
                <div key={i} className="signal-item buy">
                  <div className="signal-badge">买入</div>
                  <div className="signal-info">
                    <div className="signal-stock">{s.code} {s.name}</div>
                    <div className="signal-detail">
                      ¥{s.price} | {s.change_pct >= 0 ? '+' : ''}{s.change_pct}%
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="card">
          <h3>📉 卖出信号 ({sellSignals.length})</h3>
          <div className="signal-list">
            {sellSignals.length === 0 ? (
              <div className="no-data">暂无卖出信号</div>
            ) : (
              sellSignals.map((s, i) => (
                <div key={i} className="signal-item sell">
                  <div className="signal-badge">卖出</div>
                  <div className="signal-info">
                    <div className="signal-stock">{s.code} {s.name}</div>
                    <div className="signal-detail">
                      ¥{s.price} | {s.change_pct >= 0 ? '+' : ''}{s.change_pct}%
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* 涨跌榜图表 */}
      <section className="charts">
        <div className="card chart-card">
          <h3>涨跌幅排行 TOP10</h3>
          <Bar data={barChartData} options={barChartOptions} />
        </div>
      </section>

      {/* 股票列表 */}
      <section className="positions">
        <div className="card">
          <h3>全部股票</h3>
          <div className="stock-list">
            {stocks.map((s, i) => (
              <div key={i} className="stock-row">
                <div className="stock-name">
                  <span className="code">{s.code}</span>
                  <span className="name">{s.name}</span>
                </div>
                <div className="stock-price">¥{s.price}</div>
                <div className={`stock-change ${s.change_pct >= 0 ? 'up' : 'down'}`}>
                  {s.change_pct >= 0 ? '+' : ''}{s.change_pct}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="footer">
        <p>策略：双均线(MA5/MA20) + RSI | 数据来源：新浪财经</p>
        <button className="refresh-btn" onClick={fetchData}>刷新数据</button>
      </footer>
    </div>
  )
}

export default App
