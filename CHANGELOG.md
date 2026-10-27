# Changelog

## 0.1.0

- 首个公开版本：`my-dsh-ui` 子插件容器。
- 子插件机制：目录式安装、清单校验、宿主端 `index.js` 半边、客户端 `client.js` 半边；
  开关即时生效，注册随停用回收；状态持久化在 `$DSH_HOME/my-dsh-ui/state.json`。
- 管理器：设置 → 插件 → UI 子插件（开关 / 卸载 / 安装位置提示）。
- 内置子插件 `sidebar-pinned`：侧栏「置顶」入口 + 置顶会话页面，支持打开会话与取消置顶。
- 宿主端桥：`/my-dsh-ui/api`（同源、需鉴权）。
