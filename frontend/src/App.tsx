import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Config from './pages/Config'

const navItems = [
  { to: '/', label: '运行总览' },
  { to: '/config', label: '系统设置' },
]

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col font-sans bg-[#000000] text-zinc-300">
        <nav className="sticky top-0 z-50 bg-[#000000]/80 backdrop-blur-md border-b border-white/[0.08] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded bg-zinc-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-sm font-semibold tracking-tight text-zinc-100">
                Codex 注册终端
              </span>
            </div>
            <div className="flex gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-200 ${
                      isActive
                        ? 'text-zinc-100 bg-[#1a1a1a]'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-[#111111]'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        </nav>
        <main className="flex-1 p-6 md:p-10 max-w-[1000px] mx-auto w-full animate-fade-in text-zinc-300">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/config" element={<Config />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
