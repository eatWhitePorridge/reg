# CHANGELOG

## 2026-03-24

### fix(ncs_register): 修复 YYDS Mail 创建邮箱 403 域名权限报错
- 文件: `ncs_register.py`
- **根因**: `POST /v1/accounts` 未指定 `domain`，API Key 的 `domainScope` 无可用域名
- 新增 `_fetch_yydsmail_domains()` 方法：
  - 调用 `GET /v1/domains` 获取已验证的公共域名列表
  - 过滤 `isVerified=true` 的域名
- 修改 `create_yydsmail_email()`：
  - 创建邮箱前先获取可用域名，随机选择一个
  - 在 `POST /v1/accounts` body 中显式传入 `{"domain": chosen_domain}`
- 修复 API 响应解析：
  - YYDS Mail API 返回 `{"success": true, "data": {...}}` 信封格式
  - 修复 `create_yydsmail_email`、`_fetch_emails_yydsmail`、`_fetch_email_detail_yydsmail` 三个方法的响应解包逻辑
- 增强预检检查：确认返回的域名列表中有可用的已验证域名

### chore(config): 更新 YYDS Mail API Key
- 文件: `config.json`
- 替换为新的 API Key（domainScope 为 public/all）

### verify
- 执行语法检查：`python3 -m py_compile ncs_register.py` → 通过
- 实际运行注册 1 个账号：
  - YYDS Mail 邮箱创建成功 ✅
  - ChatGPT 注册成功 ✅
  - OTP 验证码接收成功 ✅
  - OAuth Codex Token 获取成功 ✅

---

## 2026-03-22

### feat(ncs_register): 批量注册增加底部进度条（apt install 风格）
- 文件: `ncs_register.py`
- 新增终端单行动态进度条渲染函数：`_render_apt_like_progress(done, total, success, fail, start_time)`
- 在 `run_batch(...)` 中接入实时进度更新：
  - 增加 `completed_count` 统计完成数
  - 启动时先渲染 0% 进度
  - 每个并发任务完成后刷新进度
  - 批量任务结束后换行收尾
- 新增依赖导入：`shutil`（用于终端宽度自适应）

### fix(ncs_register): 修复进度条被日志刷走、仅偶发显示的问题
- 文件: `ncs_register.py`
- 将 `_print_lock` 从 `threading.Lock()` 改为 `threading.RLock()`，避免重绘链路中的递归锁问题
- 新增全局进度状态：`_progress_state`
- 新增辅助函数：
  - `_clear_progress_line_unlocked()`：打印日志前清理当前进度行
  - `_print_with_progress(*args, **kwargs)`：统一日志输出后自动重绘底部进度条
- 全局接管 `print`：
  - `builtins.print = _print_with_progress`
  - 确保任意线程、任意日志输出后，底部进度条都能恢复显示
- 新增依赖导入：`builtins`

### verify
- 执行语法检查：`python3 -m py_compile ncs_register.py`
- 结果：通过

---

## 2026-03-21

### feat(ncs_register): 新增 TempMail.lol 邮箱支持
- 文件: `ncs_register.py`
- 新增 provider：`tempmail_lol`
- 新增配置项：`tempmail_lol_api_base`（默认 `https://api.tempmail.lol/v2`）
- 新增 TempMail.lol 相关方法：
  - `create_tempmail_lol_email()`
  - `_fetch_emails_tempmail_lol()`
  - `_extract_tempmail_lol_code()`
- 注册主流程、OTP 拉取、OAuth 阶段 OTP 拉取均支持 `tempmail_lol`

### fix(ncs_register): 增强 CSRF/Signin 非 JSON 容错与重试
- 文件: `ncs_register.py`
- `get_csrf()`：
  - 非 JSON 时自动重试 1 次（重试前回访首页）
  - 异常信息包含 `status/content-type/body` 片段
- `signin()`：非 JSON 时抛出带上下文的明确错误

### fix(ncs_register): OAuth 协议流程稳定性与可观测性增强
- 文件: `ncs_register.py`
- `authorize_params` 补充：
  - `prompt=login`
  - `id_token_add_organizations=true`
  - `codex_cli_simplified_flow=true`
- 增强日志：
  - sentinel token 生成失败提示
  - `authorize/continue` / `password/verify` 非 200 提示
  - JSON 解析失败时输出响应片段

### feat(ncs_register): 启动前连通性预检
- 文件: `ncs_register.py`
- 新增 `_quick_preflight(proxy, provider)`：
  - 检查 `chatgpt.com`
  - 检查 `chatgpt csrf`
  - 检查 `auth.openai.com`
  - `mail_provider=tempmail_lol` 时检查 TempMail API
- `main()` 新增交互：可启用预检；预检失败可退出或强制继续

### feat(ncs_register): 默认代理与分批上传 CPA
- 文件: `ncs_register.py`
- 默认代理改为：`http://127.0.0.1:7890`
- 新增配置项：`cpa_upload_every_n`（默认 3）
- 支持环境变量：`CPA_UPLOAD_EVERY_N`
- `run_batch(...)` 新增参数 `cpa_upload_every_n`：
  - 每成功 N 个账号触发一次 `_upload_all_tokens_to_cpa()`
  - 批次结束后自动收尾上传剩余 token
- `main()` 新增交互：可自定义每 N 个上传

### feat(auto_scheduler): 同步 ncs_register 交互顺序与新参数
- 文件: `auto_scheduler.py`
- `AUTO_PARAMS` 新增/调整：
  - 默认代理 `http://127.0.0.1:7890`
  - `preflight`（默认 `n`）
  - `cpa_upload_every_n`（默认 `3`）
- `build_register_input(...)` 已同步最新输入顺序：
  - 代理 → 预检 → CPA 清理 → 注册数量 → 并发数 → 每 N 个上传

### docs(readme): 新增项目说明文档
- 文件: `README.md`
- 补充内容：
  - 项目结构与运行方式
  - 配置项说明（含代理与分批上传）
  - 调度器说明
  - 常见故障排查（403 / csrf 非 JSON / OAuth 失败）

### chore(config): 更新默认配置
- 文件: `config.json`
- 新增并设置：
  - `proxy: "http://127.0.0.1:7890"`
  - `tempmail_lol_api_base: "https://api.tempmail.lol/v2"`
  - `cpa_upload_every_n: 3`

### verify
- 执行语法检查：
  - `python3 -m py_compile ncs_register.py`
  - `python3 -m py_compile ncs_register.py auto_scheduler.py`
- 结果：通过
