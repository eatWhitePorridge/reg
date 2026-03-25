import { useState, useEffect, useRef, useCallback } from 'react'

interface Status {
  token_count: number
  account_count: number
  task: { running: boolean; task_type: string; started_at: string; error: string }
  scheduler_running: boolean
  timestamp: string
}

export default function Dashboard() {
  const [status, setStatus] = useState<Status | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [showLogs, setShowLogs] = useState(false)
  const [message, setMessage] = useState('')
  const logRef = useRef<HTMLDivElement>(null)
  const logOffsetRef = useRef(0)
  const showLogsRef = useRef(false)

  // keep refs in sync
  useEffect(() => { showLogsRef.current = showLogs }, [showLogs])

  useEffect(() => {
    const fetchStatus = () =>
      fetch('/api/status')
        .then((r) => r.json())
        .then(setStatus)
        .catch(() => {})

    const fetchLogs = () =>
      fetch(`/api/logs?since=${logOffsetRef.current}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.logs.length > 0) {
            setLogs((prev) => [...prev, ...data.logs].slice(-200))
            logOffsetRef.current = data.total
          }
        })
        .catch(() => {})

    fetchStatus()
    fetchLogs()
    const interval = setInterval(() => {
      fetchStatus()
      if (showLogsRef.current) fetchLogs()
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (showLogs && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [logs, showLogs])

  const apiCall = async (url: string, body?: any) => {
    setMessage('')
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
      const data = await res.json()
      if (res.ok) {
        setMessage(data.message || '操作成功')
      } else {
        setMessage(data.detail || '操作失败')
      }
    } catch {
      setMessage('网络请求失败')
    }
  }

  const toggleAuto = () => {
    if (status?.scheduler_running) {
      apiCall('/api/scheduler/stop')
    } else {
      apiCall('/api/scheduler/start')
    }
    // Optimistic UI update
    setStatus(prev => prev ? { ...prev, scheduler_running: !prev.scheduler_running } : null)
  }

  const triggerQuickRegister = () => {
    apiCall('/api/register', {
      total_accounts: 3,
      max_workers: 3,
      cpa_upload_every_n: 3,
    })
  }

  const isBusy = status?.task.running

  return (
    <div className="space-y-10 animate-slide-up">
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-white/[0.08] pb-6 gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight text-white">运行总览</h1>
          <p className="text-[15px] text-zinc-500">实时监控与控制后台注册任务进程</p>
        </div>
        
        {/* Core Controls */}
        <div className="flex items-center gap-4 bg-[#0a0a0a] border border-white/[0.08] p-2 rounded-xl">
          <div className="flex items-center gap-3 px-3">
            <span className="text-sm font-medium text-zinc-400">自动模式</span>
            <button
              onClick={toggleAuto}
              disabled={isBusy && !status.scheduler_running}
              className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors focus:outline-none ${
                status?.scheduler_running ? 'bg-emerald-500' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  status?.scheduler_running ? 'translate-x-[18px]' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <div className="w-[1px] h-8 bg-white/[0.1]"></div>
          <button
            onClick={triggerQuickRegister}
            disabled={isBusy}
            className="saas-button bg-white text-black hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-500 font-medium px-5"
          >
            {isBusy ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                运行中
              </span>
            ) : (
              '快速注册'
            )}
          </button>
        </div>
      </div>

      {message && (
        <div className="bg-[#111] border border-white/[0.1] px-4 py-3 rounded-xl text-sm text-zinc-300 flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage('')} className="text-zinc-500 hover:text-white">✕</button>
        </div>
      )}

      {/* Big Numbers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="saas-card p-8 flex border border-white/[0.04] flex-col justify-center items-center text-center gap-2">
          <div className="text-sm font-medium text-zinc-500 tracking-wider">可用 TOKEN 总数</div>
          <div className="text-6xl font-light text-white tracking-tighter">{status?.token_count ?? '-'}</div>
        </div>
        <div className="saas-card p-8 flex border border-white/[0.04] flex-col justify-center items-center text-center gap-2">
          <div className="text-sm font-medium text-zinc-500 tracking-wider">已注册账号数</div>
          <div className="text-6xl font-light text-white tracking-tighter">{status?.account_count ?? '-'}</div>
        </div>
      </div>

      {/* Status Info */}
      {status?.task.error && (
        <div className="bg-[#1a0505] border border-rose-900/50 p-5 rounded-xl flex items-start gap-4 text-rose-400 text-sm">
          <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <span className="font-semibold text-rose-300">执行遇到异常: </span>
            <span className="opacity-90 block mt-1">{status.task.error}</span>
          </div>
        </div>
      )}

      {isBusy && !status?.task.error && (
        <div className="text-center text-sm text-zinc-500 flex items-center justify-center gap-2 pt-4">
          <svg className="w-4 h-4 animate-spin text-zinc-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          当前正在执行: <span className="text-zinc-300 font-medium">{status.task.task_type}</span>
        </div>
      )}

      {/* Toggled Logs */}
      <div className="pt-8 border-t border-white/[0.04]">
        <button 
          onClick={() => setShowLogs(!showLogs)} 
          className="text-sm font-medium text-zinc-500 hover:text-zinc-300 flex items-center justify-center gap-2 w-full py-4 bg-[#0a0a0a] border border-white/[0.04] rounded-xl transition-colors hover:bg-[#111]"
        >
          {showLogs ? '收起后台日志信息' : '展开后台日志监控'}
          <svg className={`w-4 h-4 transition-transform ${showLogs ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showLogs && (
          <div className="mt-4 saas-card overflow-hidden">
            <div
              ref={logRef}
              className="p-5 h-[400px] overflow-y-auto font-mono text-[13px] leading-relaxed bg-[#050505]"
            >
              {logs.length === 0 ? (
                <div className="h-full flex items-center justify-center text-zinc-700 italic">
                  等待日志输出中...
                </div>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {logs.map((line, i) => (
                    <div key={i} className="text-zinc-400 hover:text-zinc-200 hover:bg-[#111] px-1.5 py-0.5 rounded-md transition-colors break-all">
                      {line}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
