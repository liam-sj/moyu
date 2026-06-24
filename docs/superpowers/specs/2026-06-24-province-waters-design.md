# 省份水域系统改造设计

## 概述
将现有 12 个职业主题鱼塘替换为 31 个省份特有水域，通关后根据用户 GPS 自动定位加入所在省份水域，去掉手动选塘步骤。

## 核心变更

| 原来 | 现在 |
|------|------|
| 12个职业鱼塘 | 31个省份水域（每省一个） |
| 通关后手动选鱼塘 | GPS自动定位 → 自动加入 |
| 可切换鱼塘 | 水域固定（不可切换） |
| pondId 为主键 | waterId（省份code）为主键 |

## 流程

```
通关 Level 2 → 摸到随机鱼
  → wx.getLocation → 经纬度
    → 成功 → 云函数 getProvince 逆地理编码 → 省份
    → 失败/拒绝 → "四海为家"默认水域
  → 自动加入水域（无需用户选择）
  → 展示：你摸到了 XX + 自动加入 XX水域
  → 回到首页，公告牌显示所在水域信息
```

## 31省水域映射

```
北京→什刹海  上海→黄浦江  天津→海河    重庆→嘉陵江
广东→珠江    浙江→西湖    江苏→太湖    湖南→洞庭湖
湖北→洪湖    四川→都江堰  福建→闽江    江西→鄱阳湖
安徽→巢湖    山东→大明湖  河南→黄河    河北→白洋淀
山西→汾河    陕西→渭河    甘肃→月牙泉  青海→青海湖
云南→洱海    贵州→黄果树  广西→漓江    海南→南海
辽宁→鸭绿江  吉林→天池    黑龙江→松花江 新疆→天池
西藏→纳木错  宁夏→沙湖    内蒙古→呼伦湖 台湾→日月潭
香港→维多利亚港  澳门→南湾湖

默认：四海为家
```

## 技术实现

### 1. 省份水域配置 `src/config/waters.ts`
- `WATER_BODIES` 数组：province (省份名), waterId (拼音), waterName (水域中文名), emoji
- `getWaterByProvince(province)` 查找函数
- `DEFAULT_WATER` 常量（四海为家）
- 省份→水域映射缓存 key: `user_province`

### 2. 云函数 `cloudfunctions/getProvince/`
- 输入：latitude, longitude
- 调用腾讯地图逆地理编码 API
- 返回：province（省份名，如"广东省"）
- 微信云环境内可使用 `cloud.openapi` 或直接 HTTP 调用腾讯地图 API

### 3. 通关流程修改
- `GameOverlayView.showFishResult`：
  - 展示摸到的鱼（保留鱼展示）
  - 调用 `wx.getLocation` + `getProvince` 确定省份
  - 展示自动加入的水域名
  - 调用 `selectAndContribute` 写入 DB
  - 缓存省份到本地存储
- 去掉 `showPondPicker` 完全

### 4. 首页修改
- 公告牌显示：当前水域名 + 排名
- 水域排行榜（按 `fatPondRank` 逻辑，key 改为 waterId）
- 去掉"选择鱼塘"按钮/入口

### 5. DB 适配
- `player_ponds` 集合的文档 ID 或字段：pondId → waterId
- `pond_stats` 集合 key：pondId → waterId
- 新增字段 `province` 便于统计

## 文件清单
- **NEW** `src/config/waters.ts` — 省份水域配置 + 缓存
- **NEW** `cloudfunctions/getProvince/index.js` — 经纬度→省份
- **NEW** `cloudfunctions/getProvince/package.json`
- **MODIFY** `src/scenes/overlays/GameOverlayView.ts` — 合并鱼展示+自动入水域
- **MODIFY** `src/scenes/GameScene.ts` — 去掉 _showPondPicker 调用，改为自动加入
- **MODIFY** `src/scenes/MenuScene.ts` — 首页水域适配
- **MODIFY** `cloudfunctions/selectAndContribute/index.js` — pondId→waterId
- **MODIFY** `cloudfunctions/getPondRanking/index.js` — 水域排行榜
- **MODIFY** `cloudfunctions/getPondDetail/index.js` — 水域详情
- **DELETE** `src/scenes/SelectFishScene.ts` — 不再需要
- **DELETE** `src/config/ponds.ts` — 替换为 waters.ts

## 验证
1. `npm run build` 编译通过
2. 部署所有云函数
3. 真机测试：通关 → 位置授权 → 自动入水域 → 首页显示
4. 拒绝授权 → 进入"四海为家"
5. 首页排行榜按水域正确展示
