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
import { Line, Bar } from 'react-chartjs-2'
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

// 模拟数据类型
interface Position {
  code: string
  name: string
  shares: number
  costPrice: number
  currentPrice: number
  profit: number
  profitPercent: number
}

interface Trade {
  id: string
  date: string
  code: string
  name: string
  action: 'buy' | 'sell'
  price: number
  shares: number
  amount: number
}

interface Signal {
  code: string
  name: string
  signal: 'buy' | 'sell'
  price: number
  rsi: number
  reason: string
}

interface DailyValue {
  date: string
  value: number
}

// 模拟数据
const mockPositions: Position[] = [
  { code: '600519', name: '贵州茅台', shares: 10, costPrice: 1680, currentPrice: 1720, profit: 400, profitPercent: 2.38 },
  { code: '000858', name: '五粮液', shares: 100, costPrice: 158, currentPrice: 162, profit: 400, profitPercent: 2.53 },
  { code: '300750', name: '宁德时代', shares: 50, costPrice: 210, currentPrice: 198, profit: -600, profitPercent: -5.71 },
]

const mockTrades: Trade[] = [
  { id: '1', date: '2026-02-07', code: '600519', name: '贵州茅台', action: 'buy', price: 1680, shares: 10, amount: 16800 },
  { id: '2', date: '2026-02-06', code: '000858', name: '五粮液', action: 'buy', price: 158, shares: 100, amount: 15800 },
  { id: '3', date: '2026-02-05', code: '300750', name: '宁德时代', action: 'buy', price: 210, shares: 50, amount: 10500 },
  { id: '4', date: '2026-02-04', code: '601318', name: '中国平安', action: 'sell', price: 52, shares: 200, amount: 10400 },
]

const mockSignals: Signal[] = [
  { code: '002594', name: '比亚迪', signal: 'buy', price: 245.5, rsi: 28, reason: 'MA5上穿MA20 + RSI超卖反弹' },
  { code: '600036', name: '招商银行', signal: 'buy', price: 35.2, rsi: 32, reason: 'MA5上穿MA20 + 成交量放大' },
  { code: '000001', name: '平安银行', signal: 'sell', price: 12.8, rsi: 75, reason: 'RSI超买 + MA5下穿MA20' },
]

const mockDailyValues: DailyValue[] = [
  { date: '02-01', value: 100000 },
  { date: '02-02', value: 101200 },
  { date: '02-03', value: 99800 },
  { date: '02-04', value: 102500 },
  { date: '02-05', value: 103200 },
  { date: '02-06', value: 104800 },
  { date: '02-07', value: 103500 },
  { date: '02-08', value: 105200 },
  { date: '02-09', value: 106800 },
]

function App() {
  const [positions] = useState<Position[]>(mockPositions)
  const [trades] = useState<Trade[]>(mockTrades)
  const [signals] = useState<Signal[]>(mockSignals)
  const [dailyValues] = useState<DailyValue[]>(mockDailyValues)
  const [lastUpdate] = useState(new Date().toLocaleString('zh-CN'))

  // 计算总览数据
  const totalValue = positions.reduce((sum, p) => sum + p.currentPrice * p.shares, 0) + 50000 // 加上现金
  const totalCost = positions.reduce((sum, p) => sum + p.costPrice * p.shares, 0)
  const totalProfit = positions.reduce((sum, p) => sum + p.profit, 0)
  const totalProfitPercent = totalCost > 0 ? (totalProfit / totalCost * 100) : 0
  const cashBalance = 50000

  // 收益曲线图表数据
  const lineChartData = {
    labels: dailyValues.map(d => d.date),
    datasets: [
      {
        label: '账户净值',
        data: dailyValues.map(d => d.value),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  }

  const lineChartOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: false },
    },
    scales: {
      y: {
        beginAtZero: false,
        grid: { color: 'rgba(255,255,255,0.1)' },
        ticks: { color: '#9ca3af' },
      },
      x: {
        grid: { display: false },
        ticks: { color: '#9ca3af' },
      },
    },
  }

  // 持仓分布柱状图
  const barChartData = {
    labels: positions.map(p => p.name),
    datasets: [
      {
        label: '持仓市值',
        data: positions.map(p => p.currentPrice * p.shares),
        backgroundColor: positions.map(p => 
          p.profit >= 0 ? 'rgba(34, 197, 94, 0.8)' : 'rgba(239, 68, 68, 0.8)'
        ),
        borderRadius: 4,
      },
    ],
  }

  const barChartOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(255,255,255,0.1)' },
        ticks: { color: '#9ca3af' },
      },
      x: {
        grid: { display: false },
        ticks: { color: '#9ca3af' },
      },
    },
  }

  return (
    <div className="app">
      <header className="header">
        <h1>A股量化交易看板</h1>
        <div className="header-info">
          <span>策略: 双均线 + RSI</span>
          <span>更新: {lastUpdate}</span>
        </div>
      </header>

      {/* 总览卡片 */}
      <section className="overview">
        <div className="card overview-card">
          <div className="card-label">总资产</div>
          <div className="card-value">¥{totalValue.toLocaleString()}</div>
        </div>
        <div className="card overview-card">
          <div className="card-label">持仓市值</div>
          <div className="card-value">¥{(totalValue - cashBalance).toLocaleString()}</div>
        </div>
        <div className="card overview-card">
          <div className="card-label">可用现金</div>
          <div className="card-value">¥{cashBalance.toLocaleString()}</div>
        </div>
        <div className={`card overview-card ${totalProfit >= 0 ? 'profit' : 'loss'}`}>
          <div className="card-label">总收益</div>
          <div className="card-value">
            {totalProfit >= 0 ? '+' : ''}¥{totalProfit.toLocaleString()}
            <span className="percent">({totalProfitPercent >= 0 ? '+' : ''}{totalProfitPercent.toFixed(2)}%)</span>
          </div>
        </div>
      </section>

      {/* 图表区 */}
      <section className="charts">
        <div className="card chart-card">
          <h3>收益曲线</h3>
          <Line data={lineChartData} options={lineChartOptions} />
        </div>
        <div className="card chart-card">
          <h3>持仓分布</h3>
          <Bar data={barChartData} options={barChartOptions} />
        </div>
      </section>

      {/* 信号区 */}
      <section className="signals">
        <div className="card">
          <h3>今日信号</h3>
          <div className="signal-list">
            {signals.length === 0 ? (
              <div className="no-data">暂无信号</div>
            ) : (
              signals.map((s, i) => (
                <div key={i} className={`signal-item ${s.signal}`}>
                  <div className="signal-badge">{s.signal === 'buy' ? '买入' : '卖出'}</div>
                  <div className="signal-info">
                    <div className="signal-stock">{s.code} {s.name}</div>
                    <div className="signal-detail">
                      价格: ¥{s.price} | RSI: {s.rsi}
                    </div>
                    <div className="signal-reason">{s.reason}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* 持仓列表 */}
      <section className="positions">
        <div className="card">
          <h3>当前持仓</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>代码</th>
                <th>名称</th>
                <th>持股</th>
                <th>成本价</th>
                <th>现价</th>
                <th>盈亏</th>
                <th>盈亏%</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p, i) => (
                <tr key={i}>
                  <td>{p.code}</td>
                  <td>{p.name}</td>
                  <td>{p.shares}</td>
                  <td>¥{p.costPrice.toFixed(2)}</td>
                  <td>¥{p.currentPrice.toFixed(2)}</td>
                  <td className={p.profit >= 0 ? 'profit' : 'loss'}>
                    {p.profit >= 0 ? '+' : ''}¥{p.profit.toFixed(0)}
                  </td>
                  <td className={p.profitPercent >= 0 ? 'profit' : 'loss'}>
                    {p.profitPercent >= 0 ? '+' : ''}{p.profitPercent.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 交易历史 */}
      <section className="trades">
        <div className="card">
          <h3>交易历史</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>日期</th>
                <th>操作</th>
                <th>代码</th>
                <th>名称</th>
                <th>价格</th>
                <th>数量</th>
                <th>金额</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => (
                <tr key={t.id}>
                  <td>{t.date}</td>
                  <td>
                    <span className={`action-badge ${t.action}`}>
                      {t.action === 'buy' ? '买入' : '卖出'}
                    </span>
                  </td>
                  <td>{t.code}</td>
                  <td>{t.name}</td>
                  <td>¥{t.price.toFixed(2)}</td>
                  <td>{t.shares}</td>
                  <td>¥{t.amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="footer">
        <p>量化策略仅供学习参考，投资有风险，入市需谨慎</p>
      </footer>
    </div>
  )
}

export default App
