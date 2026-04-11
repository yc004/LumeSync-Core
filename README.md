# LumeSync Core

LumeSync 鐨勬牳蹇冭繍琛屾椂浠撳簱锛岃礋璐ｈ鍫傝繛鎺ユ帶鍒躲€佺姸鎬佸悓姝ュ拰娓叉煋鑳藉姏鎻愪緵銆?
## 鑱岃矗杈圭晫

- 鎻愪緵璇惧爞瀹炴椂鍚屾锛圫ocket.io 浜嬩欢鎬荤嚎锛夈€?- 鎻愪緵娓叉煋寮曟搸鑴氭湰闈欐€佹湇鍔★紙`/engine`锛夈€?- 鎻愪緵鍦ㄧ嚎瀛︾敓鍒楄〃涓庡鐢熸搷浣滄棩蹇楁煡璇€?- 涓嶈礋璐ｈ绋嬫枃浠剁鐞嗗拰涓氬姟鏁版嵁鎸佷箙鍖栵紙璇剧▼鏂囦欢鐢?teacher 绔鐞嗭級銆?
## 鐩綍缁撴瀯

```text
packages/
  engine/           # 娴忚鍣ㄧ娓叉煋寮曟搸鑴氭湰
  render-engine/    # 娓叉煋寮曟搸璺緞瑙ｆ瀽涓庡鍑哄皝瑁?  runtime-control/  # Socket 浼氳瘽銆佽鍫傜姸鎬佷笌浜嬩欢澶勭悊
  server/           # 鏍稿績杩愯鏃?HTTP/Socket 鏈嶅姟鍏ュ彛
```

## 蹇€熷紑濮?
```bash
pnpm install
pnpm start
```

榛樿鐩戝惉绔彛 `3000`锛屽彲閫氳繃鐜鍙橀噺瑕嗙洊锛?
```bash
PORT=3100 pnpm start
```

## 杩愯鎺ュ彛

鏍稿績鏈嶅姟榛樿鍏ュ彛锛歚packages/server/index.js`

### HTTP

- `GET /api/health`锛氬仴搴锋鏌?- `GET /api/students`锛氬湪绾垮鐢?IP 鍒楄〃
- `GET /api/student-log`锛氬鐢熻涓烘棩蹇?- `GET /api/courses`锛氬吋瀹规帴鍙ｏ紙杩斿洖绌鸿绋嬪垪琛級
- `GET /api/course-status`锛氬綋鍓嶈绋嬩笌椤电爜鐘舵€?- `POST /api/refresh-courses`锛氬吋瀹规帴鍙ｏ紙涓嶅姞杞借绋嬶級
- `GET /api/components-manifest`锛氬吋瀹规帴鍙ｏ紙杩斿洖绌虹粍浠跺垪琛級

### Socket锛堟牳蹇冧簨浠讹級

- 鏁欏笀绔細`select-course`銆乣sync-slide`銆乣host-settings`銆乣end-course`
- 瀛︾敓绔細`student:submit`銆乣student-alert`銆乣request-sync-state`
- 璇惧爞浜掑姩锛歚interaction:sync`銆乣sync-var`
- 鎶曠エ锛歚vote:start`銆乣vote:submit`銆乣vote:end`
- 鏍囨敞锛歚annotation:segment`銆乣annotation:stroke`銆乣annotation:clear`

## 鍏抽敭鐜鍙橀噺

| 鍙橀噺 | 榛樿鍊?| 璇存槑 |
| --- | --- | --- |
| `PORT` | `3000` | 鏍稿績鏈嶅姟绔彛 |
| `LUMESYNC_STUDENT_LOG_MAX` | `500` | 瀛︾敓鏃ュ織鏈€澶х紦瀛樻潯鏁?|
| `LUMESYNC_ANNOTATION_MAX_SEGMENTS_PER_SLIDE` | `5000` | 鍗曢〉鏍囨敞鏈€澶х紦瀛樻鏁?|

## 寮€鍙戣鏄?
- 褰撳墠浠撳簱鑴氭湰鏋佺畝锛歚pnpm start` 鍚姩杩愯鏃舵湇鍔°€?- 璇剧▼涓庤祫婧愮鐞嗚兘鍔涗笉鍦ㄦ湰浠撳簱瀹炵幇锛涜仈璋冭鎼厤 `teacher` 绔€?
## 甯歌闂

1. 璁块棶 `/api/courses` 涓虹┖
杩欐槸棰勬湡琛屼负銆侰ore 鍙繚鐣欏吋瀹规帴鍙ｏ紝涓嶆墭绠¤绋嬫枃浠躲€?
2. 绔彛鍐茬獊瀵艰嚧鍚姩澶辫触
淇敼 `PORT` 鍚庨噸鍚紝鎴栧厛閲婃斁鍗犵敤绔彛鐨勮繘绋嬨€?
## 鐩稿叧鏂囨。

- [packages/server/README.md](./packages/server/README.md)
- [packages/engine/README.md](./packages/engine/README.md)
- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [SECURITY.md](./SECURITY.md)
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- [LICENSE](./LICENSE)

