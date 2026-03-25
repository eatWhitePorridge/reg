import { useState, useEffect } from 'react'

const CONFIG_FIELDS: { key: string; label: string; type: 'text' | 'number' | 'bool' }[] = [
  { key: 'mail_provider', label: '邮箱服务商 (mail_provider)', type: 'text' },
  { key: 'proxy', label: '代理服务器地址', type: 'text' },
  { key: 'total_accounts', label: '默认批量注册数量', type: 'number' },
  { key: 'enable_oauth', label: '启用 OAuth 验证', type: 'bool' },
  { key: 'oauth_required', label: '强制 OAuth 成功', type: 'bool' },
  { key: 'upload_api_url', label: 'CPA 数据回传接口', type: 'text' },
  { key: 'upload_api_token', label: 'CPA 鉴权 Token', type: 'text' },
  { key: 'cpa_upload_every_n', label: '上传频率 (每 N 个)', type: 'number' },
  { key: 'cpa_cleanup_enabled', label: '注册前执行 CPA 清理', type: 'bool' },
  { key: 'duckmail_api_base', label: 'DuckMail API 节点', type: 'text' },
  { key: 'duckmail_bearer', label: 'DuckMail 密钥 (Bearer)', type: 'text' },
  { key: 'tempmail_lol_api_base', label: 'TempMail.lol API 节点', type: 'text' },
  { key: 'yydsmail_api_base', label: 'YYDS Mail API 节点', type: 'text' },
  { key: 'yydsmail_api_key', label: 'YYDS Mail API 密钥', type: 'text' },
  { key: 'output_file', label: '数据输出路径', type: 'text' },
  { key: 'ak_file', label: 'AK 文件位置', type: 'text' },
  { key: 'rk_file', label: 'RK 文件位置', type: 'text' },
  { key: 'token_json_dir', label: 'Token 缓存目录', type: 'text' },
]

const SETTINGS_GROUPS = [
  {
    id: 'basic',
    title: '核心参数',
    description: '批量注册任务的基础参数与默认行为。',
    fields: ['total_accounts', 'cpa_upload_every_n', 'proxy']
  },
  {
    id: 'email',
    title: '邮箱服务配置',
    description: '设置临时邮箱接口路径及API鉴权密钥。',
    fields: ['mail_provider', 'duckmail_api_base', 'duckmail_bearer', 'tempmail_lol_api_base', 'yydsmail_api_base', 'yydsmail_api_key']
  },
  {
    id: 'cpa',
    title: 'CPA 平台集成',
    description: '配置外部数据遥测回传及预检规则。',
    fields: ['upload_api_url', 'upload_api_token', 'cpa_cleanup_enabled']
  },
  {
    id: 'advanced',
    title: '开发者选项 (底层配置)',
    description: '系统底层文件路径映射及驱动引擎配置。非必要请勿修改。',
    fields: ['enable_oauth', 'oauth_required', 'output_file', 'ak_file', 'rk_file', 'token_json_dir']
  }
]

export default function Config() {
  const [config, setConfig] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => setMessage('加载配置失败'))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setMessage('')
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      })
      if (res.ok) {
        setMessage('配置保存成功')
        setTimeout(() => setMessage(''), 3000)
      } else {
        setMessage('配置保存失败')
      }
    } catch {
      setMessage('网络连接异常')
    }
    setSaving(false)
  }

  const apiCall = async (url: string) => {
    setActionMessage('')
    try {
      const res = await fetch(url, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setActionMessage(data.message || '指令下发成功')
      } else {
        setActionMessage(data.detail || '执行该指令失败')
      }
    } catch {
      setActionMessage('网络连接异常，指令未发送')
    }
    setTimeout(() => setActionMessage(''), 3000)
  }

  const updateField = (key: string, value: any) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-10 animate-slide-up pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight text-white">系统设置</h1>
          <p className="text-[15px] text-zinc-500">管理全局运行参数与外部平台交互密钥</p>
        </div>
        <div className="flex items-center gap-4">
          {message && (
            <span className={`text-sm font-medium ${message.includes('成功') ? 'text-[#00ffcc]' : 'text-rose-400'}`}>
              {message}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="saas-button bg-white text-black hover:bg-zinc-200 font-medium px-6"
          >
            {saving ? '保存中...' : '保存修改'}
          </button>
        </div>
      </div>

      <div className="space-y-8">
        {SETTINGS_GROUPS.map((group) => {
          if (group.id === 'advanced' && !showAdvanced) return null
          
          return (
            <div key={group.id} className="saas-card overflow-hidden">
              <div className="px-6 py-5 border-b border-white/[0.04] bg-[#050505]">
                <h2 className="text-base font-medium text-white">{group.title}</h2>
                <p className="text-[13px] text-zinc-500 mt-1">{group.description}</p>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6 bg-[#0a0a0a]">
                {group.fields.map((fieldKey) => {
                  const field = CONFIG_FIELDS.find(f => f.key === fieldKey)
                  if (!field) return null
                  
                  return (
                    <div key={field.key} className="flex flex-col gap-2">
                      <label className="text-[13px] font-medium text-zinc-400">
                        {field.label}
                      </label>
                      {field.type === 'bool' ? (
                        <div className="flex items-center h-10">
                          <button
                            onClick={() => updateField(field.key, !config[field.key])}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                              config[field.key] ? 'bg-white' : 'bg-zinc-800'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-black transition-transform ${
                                config[field.key] ? 'translate-x-[18px]' : 'translate-x-[2px]'
                              }`}
                            />
                          </button>
                        </div>
                      ) : (
                        <input
                          type={field.type === 'number' ? 'number' : 'text'}
                          value={config[field.key] ?? ''}
                          onChange={(e) =>
                            updateField(
                              field.key,
                              field.type === 'number' ? Number(e.target.value) : e.target.value,
                            )
                          }
                          className="saas-input w-full"
                          placeholder={`输入 ${field.label}...`}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {!showAdvanced && (
        <button 
          onClick={() => setShowAdvanced(true)}
          className="text-[13px] font-medium text-zinc-500 hover:text-zinc-300 w-full py-4 border border-dashed border-white/[0.1] rounded-xl transition-colors hover:bg-white/[0.02]"
        >
          展开开发者高级选项
        </button>
      )}

      {/* Advanced Maintenance / Manual Actions */}
      <div className="mt-12 pt-10 border-t border-white/[0.08]">
        <div className="flex flex-col gap-1 mb-6">
          <h2 className="text-xl font-medium text-white">高级维护操作</h2>
          <p className="text-sm text-zinc-500">手动控制异常数据清洗与强制同步回传机制。</p>
        </div>
        
        {actionMessage && (
          <div className="mb-6 bg-[#111] border border-white/[0.1] px-4 py-3 rounded-xl text-sm text-zinc-300 flex items-center justify-between">
            <span>{actionMessage}</span>
            <button onClick={() => setActionMessage('')} className="text-zinc-500 hover:text-white">✕</button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="saas-card p-6 flex flex-col justify-between gap-6 bg-[#050505]">
            <div>
               <h3 className="text-sm font-medium text-white mb-2">强制全量同步 CPA</h3>
               <p className="text-[13px] text-zinc-500 leading-relaxed">无视上传间隔设置，立即扫描并在后台强制将所有本地已注册未上报的 token 推送至服务端。</p>
            </div>
            <button
              onClick={() => apiCall('/api/upload-cpa')}
              className="saas-button saas-button-secondary w-full"
            >
              立即执行同步
            </button>
          </div>

          <div className="saas-card p-6 flex flex-col justify-between gap-6 bg-[#050505] border-rose-900/20">
            <div>
               <h3 className="text-sm font-medium text-white mb-2">强力清理本地废号</h3>
               <p className="text-[13px] text-zinc-500 leading-relaxed">对接 CPA 云端执行 401/403 (Invalid Token) 鉴权扫描，并移除本地数据缓存，防止脏数据堆积。</p>
            </div>
            <button
              onClick={() => apiCall('/api/cleanup')}
              className="saas-button border border-rose-900/30 text-rose-400 bg-rose-950/20 hover:bg-rose-900 hover:text-white w-full transition-colors"
            >
              立刻启动清理
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
