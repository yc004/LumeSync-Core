# LumeSync Core

LumeSync Core 是课堂运行时内核，只负责：

- 连接鉴权与角色分配
- Socket 事件转发
- 运行时脚本分发（`/engine`）
- 少量兼容 HTTP 接口

它**不再负责**：

- 教师端 / 学生端 UI 状态
- 课程文件管理
- 提交落盘
- 投票、标注、学生监控等课堂编排状态存储

这些能力已经迁移到 teacher 端服务。

## 目录结构

```text
packages/
  engine/           # 浏览器端运行时脚本
  render-engine/    # 运行时脚本路径解析
  runtime-control/  # 连接鉴权与事件转发
  server/           # HTTP/Socket 服务入口
```

## 启动

```bash
pnpm install
pnpm start
```

默认端口：`3000`

```bash
PORT=3100 pnpm start
```

## HTTP 接口

- `GET /api/health`
- `GET /api/runtime-status`
- `GET /api/students`（兼容接口，返回当前 viewer IP 列表）
- `GET /api/student-log`（兼容接口，仅返回连接/离线日志）
- `POST /api/session/bootstrap`
- `GET /api/courses`（空兼容响应）
- `GET /api/course-status`（空兼容响应）
- `POST /api/refresh-courses`（空兼容响应）
- `GET /api/components-manifest`（空兼容响应）

## Socket 行为

core 不再持有课堂 UI 状态，只做：

- `role-assigned`
- `identity-rejected`
- `participant-joined`
- `participant-left`
- 业务事件透传/定向转发

课堂控制、投票、标注、学生监控等事件即使经过 core，也应由 teacher / student 端自己解释和管理。

## 相关说明

- teacher 是课堂数据面与编排层
- core 是 transport/runtime kernel
