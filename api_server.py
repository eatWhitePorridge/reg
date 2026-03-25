"""
api_server.py - FastAPI 后端，为前端管理面板提供 REST API
启动方式: python api_server.py
"""

import os
import sys
import json
import time
import threading
import io
import logging
from datetime import datetime
from pathlib import Path
from collections import deque
from contextlib import redirect_stdout, redirect_stderr

import importlib

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional

# ================= 项目路径 =================
BASE_DIR = Path(__file__).parent.resolve()
CONFIG_PATH = BASE_DIR / "config.json"
TOKEN_DIR = BASE_DIR / "codex_tokens"
ACCOUNTS_FILE = BASE_DIR / "registered_accounts.txt"
FRONTEND_DIR = BASE_DIR / "frontend" / "dist"

# ================= 日志缓存 =================
LOG_BUFFER: deque = deque(maxlen=500)
_log_lock = threading.Lock()


def _append_log(msg: str):
    ts = datetime.now().strftime("%H:%M:%S")
    with _log_lock:
        LOG_BUFFER.append(f"[{ts}] {msg}")


# 拦截 print 输出到日志缓存
class _LogCapture(io.TextIOBase):
    def __init__(self, original):
        self.original = original

    def write(self, s):
        if s and s.strip():
            _append_log(s.strip())
        return self.original.write(s)

    def flush(self):
        return self.original.flush()


# ================= 任务状态 =================
class TaskState:
    def __init__(self):
        self.running = False
        self.task_type = ""
        self.started_at = ""
        self.error = ""

    def to_dict(self):
        return {
            "running": self.running,
            "task_type": self.task_type,
            "started_at": self.started_at,
            "error": self.error,
        }


_task_state = TaskState()
_scheduler_state = {"running": False, "thread": None}

# 懒加载 ncs_register 模块（只导入一次，避免 reload 引发递归）
_ncs_module = None
def _get_ncs():
    global _ncs_module
    if _ncs_module is None:
        sys.path.insert(0, str(BASE_DIR))
        _ncs_module = importlib.import_module("ncs_register")
    return _ncs_module

# ================= FastAPI App =================
app = FastAPI(title="Codex Register Admin")


# ---- 状态 ----
@app.get("/api/status")
def get_status():
    # 本地 token 数
    token_count = 0
    if TOKEN_DIR.is_dir():
        token_count = len([f for f in TOKEN_DIR.iterdir() if f.suffix == ".json"])

    # registered_accounts 数
    account_count = 0
    if ACCOUNTS_FILE.exists():
        account_count = sum(1 for line in ACCOUNTS_FILE.read_text(encoding="utf-8").splitlines() if line.strip())

    return {
        "token_count": token_count,
        "account_count": account_count,
        "task": _task_state.to_dict(),
        "scheduler_running": _scheduler_state["running"],
        "timestamp": datetime.now().isoformat(),
    }


# ---- 配置管理 ----
@app.get("/api/config")
def get_config():
    if not CONFIG_PATH.exists():
        raise HTTPException(404, "config.json not found")
    return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))


class ConfigUpdate(BaseModel):
    config: dict


@app.put("/api/config")
def update_config(body: ConfigUpdate):
    # 读取现有配置保留注释格式不可行，直接覆盖
    CONFIG_PATH.write_text(json.dumps(body.config, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return {"ok": True}


# ---- 账号列表 ----
@app.get("/api/accounts")
def get_accounts():
    accounts = []
    if ACCOUNTS_FILE.exists():
        for line in ACCOUNTS_FILE.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            parts = line.split("----")
            accounts.append({
                "email": parts[0] if len(parts) > 0 else "",
                "password": parts[1] if len(parts) > 1 else "",
                "extra": parts[2] if len(parts) > 2 else "",
                "oauth": parts[3] if len(parts) > 3 else "",
            })

    tokens = []
    if TOKEN_DIR.is_dir():
        for f in sorted(TOKEN_DIR.iterdir()):
            if f.suffix == ".json":
                tokens.append(f.name)

    return {"accounts": accounts, "tokens": tokens}


# ---- 日志 ----
@app.get("/api/logs")
def get_logs(since: int = 0):
    with _log_lock:
        logs = list(LOG_BUFFER)
    # since = 上次返回的数量，客户端只取增量
    return {"logs": logs[since:], "total": len(logs)}


# ---- 手动触发注册 ----
class RegisterRequest(BaseModel):
    total_accounts: int = 3
    max_workers: int = 3
    cpa_upload_every_n: int = 3


@app.post("/api/register")
def trigger_register(body: RegisterRequest):
    if _task_state.running:
        raise HTTPException(409, "A task is already running")

    def _run():
        _task_state.running = True
        _task_state.task_type = "register"
        _task_state.started_at = datetime.now().isoformat()
        _task_state.error = ""
        try:
            ncs = _get_ncs()
            proxy = ncs.DEFAULT_PROXY if hasattr(ncs, "DEFAULT_PROXY") else ""
            ncs.run_batch(
                total_accounts=body.total_accounts,
                output_file=str(ACCOUNTS_FILE),
                max_workers=body.max_workers,
                proxy=proxy,
                cpa_cleanup=False,
                cpa_upload_every_n=body.cpa_upload_every_n,
            )
            _append_log("注册任务完成")
        except Exception as e:
            _task_state.error = str(e)
            _append_log(f"注册任务失败: {e}")
        finally:
            _task_state.running = False

    t = threading.Thread(target=_run, daemon=True)
    t.start()
    return {"ok": True, "message": "Registration started"}


# ---- CPA 上传 ----
@app.post("/api/upload-cpa")
def trigger_upload_cpa():
    if _task_state.running:
        raise HTTPException(409, "A task is already running")

    def _run():
        _task_state.running = True
        _task_state.task_type = "upload_cpa"
        _task_state.started_at = datetime.now().isoformat()
        _task_state.error = ""
        try:
            ncs = _get_ncs()
            ncs._upload_all_tokens_to_cpa()
            _append_log("CPA 上传完成")
        except Exception as e:
            _task_state.error = str(e)
            _append_log(f"CPA 上传失败: {e}")
        finally:
            _task_state.running = False

    t = threading.Thread(target=_run, daemon=True)
    t.start()
    return {"ok": True, "message": "CPA upload started"}


# ---- CPA 清理 ----
@app.post("/api/cleanup")
def trigger_cleanup():
    if _task_state.running:
        raise HTTPException(409, "A task is already running")

    def _run():
        _task_state.running = True
        _task_state.task_type = "cleanup"
        _task_state.started_at = datetime.now().isoformat()
        _task_state.error = ""
        try:
            ncs = _get_ncs()
            ncs._run_cpa_cleanup_before_register()
            _append_log("CPA 清理完成")
        except Exception as e:
            _task_state.error = str(e)
            _append_log(f"CPA 清理失败: {e}")
        finally:
            _task_state.running = False

    t = threading.Thread(target=_run, daemon=True)
    t.start()
    return {"ok": True, "message": "Cleanup started"}


# ---- 调度器控制 ----
@app.get("/api/scheduler")
def get_scheduler_status():
    return {"running": _scheduler_state["running"]}


@app.post("/api/scheduler/start")
def start_scheduler():
    if _scheduler_state["running"]:
        return {"ok": True, "message": "Scheduler already running"}

    def _scheduler_loop():
        _scheduler_state["running"] = True
        _append_log("调度器已启动")
        try:
            sys.path.insert(0, str(BASE_DIR))
            sched = importlib.import_module("auto_scheduler")

            cfg = sched._load_account_count_config()
            use_cpa = bool(cfg.get("upload_api_url") and cfg.get("upload_api_token"))

            while _scheduler_state["running"]:
                _append_log("调度器: 开始检测有效账号数量...")
                try:
                    if use_cpa:
                        count = sched.count_valid_accounts_by_probe(cfg)
                    else:
                        count = sched.count_valid_accounts_local(cfg)
                except Exception as e:
                    _append_log(f"调度器: 检测异常: {e}")
                    count = sched.ACCOUNT_THRESHOLD

                _append_log(f"调度器: 当前有效账号 {count} (阈值 {sched.ACCOUNT_THRESHOLD})")

                if count < sched.ACCOUNT_THRESHOLD:
                    needed = sched.ACCOUNT_THRESHOLD - count
                    _append_log(f"调度器: 账号不足，缺口 {needed}，触发注册")
                    params = dict(sched.AUTO_PARAMS)
                    params["total_accounts"] = max(int(sched.AUTO_PARAMS.get("total_accounts", 10)), needed)
                    sched.trigger_registration(params, cfg)
                    cfg = sched._load_account_count_config()
                    use_cpa = bool(cfg.get("upload_api_url") and cfg.get("upload_api_token"))
                else:
                    _append_log("调度器: 账号充足，无需注册")

                # 等待下次检测，每秒检查是否需要停止
                for _ in range(sched.CHECK_INTERVAL_SECONDS):
                    if not _scheduler_state["running"]:
                        break
                    time.sleep(1)
        except Exception as e:
            _append_log(f"调度器异常退出: {e}")
        finally:
            _scheduler_state["running"] = False
            _append_log("调度器已停止")

    t = threading.Thread(target=_scheduler_loop, daemon=True)
    _scheduler_state["thread"] = t
    t.start()
    return {"ok": True, "message": "Scheduler started"}


@app.post("/api/scheduler/stop")
def stop_scheduler():
    if not _scheduler_state["running"]:
        return {"ok": True, "message": "Scheduler not running"}
    _scheduler_state["running"] = False
    _append_log("调度器正在停止...")
    return {"ok": True, "message": "Scheduler stopping"}


# ---- 静态文件 (前端) ----
if FRONTEND_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        file_path = FRONTEND_DIR / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(FRONTEND_DIR / "index.html"))


# ================= 入口 =================
if __name__ == "__main__":
    # 安装 print 拦截
    sys.stdout = _LogCapture(sys.stdout)
    sys.stderr = _LogCapture(sys.stderr)

    import uvicorn
    print(f"Starting API server on http://0.0.0.0:8081")
    print(f"Frontend: {'found' if FRONTEND_DIR.is_dir() else 'not built (run: cd frontend && npm run build)'}")
    uvicorn.run(app, host="0.0.0.0", port=8081, log_level="info")
