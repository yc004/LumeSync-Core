# LumeSync Core

LumeSync 的核心运行时仓库，负责课堂连接控制、状态同步和渲染能力提供。

## 职责边界

- 提供课堂实时同步（Socket.io 事件总线）。
- 提供渲染引擎脚本静态服务（`/engine`）。
- 提供在线学生列表与学生操作日志查询。
- 不负责课程文件管理和业务数据持久化（课程文件由 teacher 端管理）。

## 目录结构

```text
packages/
  engine/           # 浏览器端渲染引擎脚本
  render-engine/    # 渲染引擎路径解析与导出封装
  runtime-control/  # Socket 会话、课堂状态与事件处理
  server/           # 核心运行时 HTTP/Socket 服务入口
```

## 快速开始

```bash
npm install
npm start
```

默认监听端口 `3000`，可通过环境变量覆盖：

```bash
PORT=3100 npm start
```

## 运行接口

核心服务默认入口：`packages/server/index.js`

### HTTP

- `GET /api/health`：健康检查
- `GET /api/students`：在线学生 IP 列表
- `GET /api/student-log`：学生行为日志
- `GET /api/courses`：兼容接口（返回空课程列表）
- `GET /api/course-status`：当前课程与页码状态
- `POST /api/refresh-courses`：兼容接口（不加载课程）
- `GET /api/components-manifest`：兼容接口（返回空组件列表）

### Socket（核心事件）

- 教师端：`select-course`、`sync-slide`、`host-settings`、`end-course`
- 学生端：`student:submit`、`student-alert`、`request-sync-state`
- 课堂互动：`interaction:sync`、`sync-var`
- 投票：`vote:start`、`vote:submit`、`vote:end`
- 标注：`annotation:segment`、`annotation:stroke`、`annotation:clear`

## 关键环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3000` | 核心服务端口 |
| `LUMESYNC_STUDENT_LOG_MAX` | `500` | 学生日志最大缓存条数 |
| `LUMESYNC_ANNOTATION_MAX_SEGMENTS_PER_SLIDE` | `5000` | 单页标注最大缓存段数 |

## 开发说明

- 当前仓库脚本极简：`npm start` 启动运行时服务。
- 课程与资源管理能力不在本仓库实现；联调请搭配 `teacher` 端。

## 常见问题

1. 访问 `/api/courses` 为空
这是预期行为。Core 只保留兼容接口，不托管课程文件。

2. 端口冲突导致启动失败
修改 `PORT` 后重启，或先释放占用端口的进程。

## 相关文档

- [packages/server/README.md](./packages/server/README.md)
- [packages/engine/README.md](./packages/engine/README.md)
- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [SECURITY.md](./SECURITY.md)
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- [LICENSE](./LICENSE)
