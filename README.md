# my-dsh-ui

DSH（DeepSeek Harness）的**界面子插件容器**。它本身只做一件事：让你像管理 DSH 插件一样管理一组「UI 子插件」——
随时开关、自由组合、卸载，改动立即生效。

首个内置子插件是**置顶 / 未读**：在侧栏导航新增一个入口（带数量角标），点一下就在图标下方、贴着左侧栏
展开浮层——置顶会话排前面（行尾可取消置顶），后台跑完但还没看的会话排后面（看过就自动消失），
点任意一行立即切过去、浮层保持展开，方便连续切换；浮层底部还能进入完整页面。

> 为什么是浮层 + 页面，而不是侧栏里的一段？DSH 的侧栏只给插件留了「导航图标」和「整块会话浏览区」两种位置，
> 工作区标题和会话列表由官方一整块占用，没有「工作区上方」的可插入插槽。要真的插进去只能接管整个会话侧栏，
> 复刻搜索、分组、拖拽与菜单——DSH 每次升级都可能把它弄坏。所以这里选择完全增量的做法：
> **不动官方 UI，只新增一个入口、一个浮层、一个页面**，升级安全。


## 安装

```powershell
# 在 DSH 里：设置 → 插件 → 添加 / 安装，或使用 plugin_manager
plugin_manager install_bundle target="<本地目录或 git 地址>"
```

安装后在 **设置 → 插件 → UI 子插件** 里管理子插件，侧栏出现「置顶/未读」入口。

## 使用

1. 侧栏任意会话行上点「置顶」（DSH 自带的行为）；后台跑完没看的会话会自动算作「未读」。
2. 侧栏导航出现入口，角标为置顶 + 未读的总数；**点一下就在图标下方、贴着左侧栏展开浮层**
   （不占右侧对话区，主区域停在原面板）。
3. 浮层里：置顶会话在前（按置顶时间倒序，行前是灰色图钉），未读会话在后（按最后活动时间倒序，
   标题旁一个**小绿点**，与 DSH 会话行的未读状态点一致）；标题右侧是「置顶数 / 未读数」双色计数
   （灰 / 绿，用 / 隔开）；每行下方是所属工作区，子 agent / 归档会话不出现。
4. 点任意会话行 → 立即切过去，**浮层保持展开**，可以连续切换；点行尾取消置顶 → 会话回到原工作区并从浮层移除；
   看过某个未读会话后它会自动从列表消失。
5. 浮层只在**点击浮层外部**或按 Esc 时收起；底部「在页面中查看」进入完整页面（页面右上角「回到会话」返回）。
6. **设置 → 插件 → UI 子插件**：开关任意子插件（立即生效、持久化），卸载本地安装的子插件。

## 子插件机制

一个子插件就是一个目录：

```
subplugins/<id>/
  subplugin.json   # 清单：id / version / title / description / defaultEnabled / author / homepage
  client.js        # UI 半边：export function apply(ui)
  index.js         # 可选：宿主端半边，export function apply(api, config)
```

- **开关 / 组合**：子插件的每次 `ui.slot(...)`、`ui.locale(...)`、`ui.styles(...)` 都登记在容器的作用域里，
  关掉子插件时这些注册会被逐个回收——和卸载插件一样干净，不需要重启。开关状态保存在
  `$DSH_HOME/my-dsh-ui/state.json`（读不到宿主端时退回浏览器本地存储）。
- **安装**：把目录放进 `$DSH_HOME/my-dsh-ui/subplugins/`（宿主端副作用立即生效）。随包发布的子插件放在
  `subplugins/`，其 UI 代码由 `node scripts/build.mjs` 编译进 `client.js`——所以本地新增的子插件界面需要重启 DSH 生效。
- **卸载**：管理器里对本地的子插件提供「卸载」，会删除目录并停止其宿主端。内置子插件只能停用。

### 写一个子插件

```js
// subplugins/my-feature/client.js
export function apply(ui) {
  const h = ui.h;
  ui.locale('myFeature', { zh: { title: '我的功能' }, en: { title: 'My feature' } });
  ui.styles('feature.css', `.my-feature{color:var(--dsw-alias-label-primary)}`);
  ui.slot('sidebar.panellist', {
    id: 'my-feature',
    order: 30,
    locale: 'myFeature',
    label: () => ui.ctx.locale.bind('myFeature')('title'),
    inject: () => ({}),
  }, function Icon({ size }) { return h('span', null, '★'); });
}
```

可用的 `ui` 能力：

| API | 作用 |
| --- | --- |
| `ui.h` / `ui.React` | React 运行时（不用 JSX，避免构建链） |
| `ui.slot(slotName, options, Component)` | 注册 slot 贡献，随子插件停用而回收 |
| `ui.locale(ns, {zh, en})` / `ui.t(ns)` | 注册 / 绑定文案 |
| `ui.styles(key, css)` | 插入带 `data-plugin-css` 的样式表，随子插件回收 |
| `ui.ctx` | 客户端 Cordis 上下文（`ctx.get('workspaces')` 等） |
| `ui.state()` / `ui.subscribe(fn)` | 容器状态快照与订阅 |
| `ui.text(value)` | 解析 `{zh, en}` 形式的文案 |
| `ui.log(...)` | 带子插件前缀的日志 |

样式只用主题 token（`--dsw-alias-*`、`--dsw-specific-*`、`--dsw-radius-*`、`--dsw-focus-ring-*`），
不要 require 任何 Harness 客户端包，不要写别人组件的 DOM。

## 开发

```powershell
node scripts/build.mjs          # 把 subplugins/*/client.js 编译进 client.js
node scripts/build.mjs --check  # CI：client.js 是否过期
node --check index.js; node --check client.js
```

## 数据与隐私

- 插件自己的状态只有一份：`$DSH_HOME/my-dsh-ui/state.json`（子插件开关）。
- 置顶会话不落盘：直接读 DSH 已有的 Workspace 投影，取消置顶调用 DSH 自己的 `unpinSession`。
- 宿主端只注册一个同源、需登录鉴权的只读 JSON 路由 `/my-dsh-ui/api`（GET 列表、POST 开关/卸载）。

## License

MIT
