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
import { Bar, Doughnut } from 'react-chartjs-2'
import './App.css'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
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
  rsi?: number
  signal?: string
  reason?: string
}

interface ApiData {
  update_time: string
  stocks: Stock[]
  buy_signals: Stock[]
  sell_signals: Stock[]
}

type TabType = 'overview' | 'signals' | 'stocks'

function App() {
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('overview')

  const fetchData = async () => {
    try {
      const resp = await fetch(API_URL)
      const json = await resp.json()
      setData(json)
      setError(null)
    } catch (e) {
      setError('加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const timer = setInterval(fetchData, 30000)
    return () => clearInterval(timer)
  }, [])

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>加载中...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="error-screen">
        <p>{error || '加载失败'}</p>
        <button onClick={fetchData}>重试</button>
      </div>
    )
  }

  const stocks = data.stocks || []
  const buySignals = data.buy_signals || []
  const sellSignals = data.sell_signals || []
  
  const totalUp = stocks.filter(s => s.change_pct > 0).length
  const totalDown = stocks.filter(s => s.change_pct < 0).length
  const totalFlat = stocks.filter(s => s.change_pct === 0).length
  const avgChange = stocks.length > 0 
    ? (stocks.reduce((sum, s) => sum + s.change_pct, 0) / stocks.length)
    : 0

  // 饼图数据
  const pieData = {
    labels: ['上涨', '下跌', '平盘'],
    datasets: [{
      data: [totalUp, totalDown, totalFlat],
      backgroundColor: ['#22c55e', '#ef4444', '#6b7280'],
      borderWidth: 0,
    }],
  }

  // 柱状图数据
  const barData = {
    labels: stocks.slice(0, 8).map(s => s.name.slice(0, 4)),
    datasets: [{
      data: stocks.slice(0, 8).map(s => s.change_pct),
      backgroundColor: stocks.slice(0, 8).map(s => 
        s.change_pct >= 0 ? '#22c55e' : '#ef4444'
      ),
      borderRadius: 4,
    }],
  }

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { 
        grid: { color: 'rgba(255,255,255,0.05)' }, 
        ticks: { color: '#9ca3af', font: { size: 10 } } 
      },
      x: { 
        grid: { display: false }, 
        ticks: { color: '#9ca3af', font: { size: 10 } } 
      },
    },
  }

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { 
      legend: { 
        position: 'bottom' as const,
        labels: { color: '#9ca3af', padding: 15, font: { size: 12 } }
      } 
    },
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-title">
          <h1>📊 量化看板</h1>
          <span className="update-time">{data.update_time?.split(' ')[1] || ''}</span>
        </div>
        <button className="refresh-btn" onClick={fetchData}>🔄</button>
      </header>

      {/* Tab Content */}
      <main className="main">
        {activeTab === 'overview' && (
          <div className="tab-content">
            {/* 统计卡片 */}
            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-value">{stocks.length}</div>
                <div className="stat-label">关注股票</div>
              </div>
              <div className="stat-card up">
                <div className="stat-value">{totalUp}</div>
                <div className="stat-label">上涨</div>
              </div>
              <div className="stat-card down">
                <div className="stat-value">{totalDown}</div>
                <div className="stat-label">下跌</div>
              </div>
              <div className={`stat-card ${avgChange >= 0 ? 'up' : 'down'}`}>
                <div className="stat-value">{avgChange >= 0 ? '+' : ''}{avgChange.toFixed(2)}%</div>
                <div className="stat-label">平均涨跌</div>
              </div>
            </div>

            {/* 信号速览 */}
            <div className="quick-signals">
              <div className="signal-summary buy" onClick={() => setActiveTab('signals')}>
                <span className="signal-count">{buySignals.length}</span>
                <span className="signal-text">买入信号</span>
                <span className="arrow">→</span>
              </div>
              <div className="signal-summary sell" onClick={() => setActiveTab('signals')}>
                <span className="signal-count">{sellSignals.length}</span>
                <span className="signal-text">卖出信号</span>
                <span className="arrow">→</span>
              </div>
            </div>

            {/* 图表 */}
            <div className="chart-section">
              <h3>涨跌分布</h3>
              <div className="pie-container">
                <Doughnut data={pieData} options={pieOptions} />
              </div>
            </div>

            <div className="chart-section">
              <h3>涨跌榜 TOP8</h3>
              <div className="bar-container">
                <Bar data={barData} options={barOptions} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'signals' && (
          <div className="tab-content">
            <div className="signal-section">
              <h3>📈 买入信号</h3>
              {buySignals.length === 0 ? (
                <div className="empty-state">暂无买入信号</div>
              ) : (
                <div className="signal-list">
                  {buySignals.map((s, i) => (
                    <div key={i} className="signal-card buy">
                      <div className="signal-header">
                        <span className="signal-badge">买入</span>
                        <span className={`signal-change ${s.change_pct >= 0 ? 'up' : 'down'}`}>
                          {s.change_pct >= 0 ? '+' : ''}{s.change_pct}%
                        </span>
                      </div>
                      <div className="signal-body">
                        <div className="signal-name">{s.name}</div>
                        <div className="signal-code">{s.code}</div>
                      </div>
                      <div className="signal-footer">
                        <span className="signal-price">¥{s.price}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="signal-section">
              <h3>📉 卖出信号</h3>
              {sellSignals.length === 0 ? (
                <div className="empty-state">暂无卖出信号</div>
              ) : (
                <div className="signal-list">
                  {sellSignals.map((s, i) => (
                    <div key={i} className="signal-card sell">
                      <div className="signal-header">
                        <span className="signal-badge">卖出</span>
                        <span className={`signal-change ${s.change_pct >= 0 ? 'up' : 'down'}`}>
                          {s.change_pct >= 0 ? '+' : ''}{s.change_pct}%
                        </span>
                      </div>
                      <div className="signal-body">
                        <div className="signal-name">{s.name}</div>
                        <div className="signal-code">{s.code}</div>
                      </div>
                      <div className="signal-footer">
                        <span className="signal-price">¥{s.price}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'stocks' && (
          <div className="tab-content">
            <div className="stock-header">
              <span>股票</span>
              <span>价格</span>
              <span>涨跌</span>
            </div>
            <div className="stock-list">
              {stocks.map((s, i) => (
                <div key={i} className="stock-item">
                  <div className="stock-info">
                    <div className="stock-name">{s.name}</div>
                    <div className="stock-code">{s.code}</div>
                  </div>
                  <div className="stock-price">¥{s.price}</div>
                  <div className={`stock-change ${s.change_pct >= 0 ? 'up' : 'down'}`}>
                    {s.change_pct >= 0 ? '+' : ''}{s.change_pct}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Tab Bar */}
      <nav className="tab-bar">
        <button 
          className={`tab-item ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <span className="tab-icon">📊</span>
          <span className="tab-label">总览</span>
        </button>
        <button 
          className={`tab-item ${activeTab === 'signals' ? 'active' : ''}`}
          onClick={() => setActiveTab('signals')}
        >
          <span className="tab-icon">📈</span>
          <span className="tab-label">信号</span>
          {(buySignals.length + sellSignals.length) > 0 && (
            <span className="tab-badge">{buySignals.length + sellSignals.length}</span>
          )}
        </button>
        <button 
          className={`tab-item ${activeTab === 'stocks' ? 'active' : ''}`}
          onClick={() => setActiveTab('stocks')}
        >
          <span className="tab-icon">📋</span>
          <span className="tab-label">全部</span>
        </button>
      </nav>
    </div>
  )
}

export default App
