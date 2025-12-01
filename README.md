# 🌈 图片颜色提取工具

一个轻量级、高性能的Web应用，用于从图片中智能提取主要颜色，助力设计师和开发者快速获取配色方案。

<div align="center">
  <img src="https://img.shields.io/github/stars/jinzhao-rjb/ColorExtractor?style=for-the-badge" alt="GitHub Stars">
  <img src="https://img.shields.io/github/license/jinzhao-rjb/ColorExtractor?style=for-the-badge" alt="License">
  <img src="https://img.shields.io/github/languages/top/jinzhao-rjb/ColorExtractor?style=for-the-badge" alt="Top Language">
</div>

## ✨ 核心亮点

- **多种提取算法**：支持K-means聚类、最频繁颜色、主色调提取、中位切分法、颜色分层提取五种算法
- **高性能设计**：采用Web Worker进行后台计算，确保页面流畅响应
- **用户友好界面**：支持深色/浅色主题切换，响应式设计适配各种设备

## 🚀 快速开始

### 在线预览
直接访问：[图片颜色提取工具](https://jinzhao-rjb.github.io/ColorExtractor/)

### 本地运行

1. **克隆仓库**
   ```bash
   git clone https://github.com/jinzhao-rjb/ColorExtractor.git
   cd ColorExtractor
   ```

2. **运行项目**
   ```bash
   # 直接在浏览器中打开
   open index.html
   
   # 或使用本地服务器（推荐）
   python -m http.server 8000
   # 然后访问 http://localhost:8000
   ```

### 使用示例

1. 点击"选择图片"按钮上传图片
2. 调整颜色数量（1-20）
3. 选择提取算法
4. 点击"提取颜色"按钮
5. 查看提取结果，点击颜色块可复制颜色值

## 📋 功能清单

| 功能 | 描述 |
|------|------|
| 📥 图片上传 | 支持JPG、PNG、WEBP等多种图片格式 |
| 🎨 颜色提取 | 五种算法：K-means、最频繁颜色、主色调、中位切分、颜色分层 |
| ⚙️ 自定义配置 | 可调整提取颜色数量（1-20） |
| 🎯 颜色格式 | 支持HEX和RGB两种格式显示 |
| 📋 颜色复制 | 点击颜色块即可复制到剪贴板 |
| 🌓 主题切换 | 支持深色/浅色模式切换 |
| 🖱️ 交互体验 | 悬停预览、平滑动画效果 |

## 🛠️ 技术栈

- **前端框架**：原生HTML5 + CSS3 + JavaScript
- **图片处理**：Canvas API
- **性能优化**：Web Worker
- **构建工具**：无（纯静态文件）

## 📸 截图展示

### 主界面
![主界面](screenshots/main.png)<!-- 截图占位符：请替换为实际截图 -->

### 颜色提取结果
![提取结果](screenshots/result.png)<!-- 截图占位符：请替换为实际截图 -->

### 深色模式
![深色模式](screenshots/dark-mode.png)<!-- 截图占位符：请替换为实际截图 -->

## 🎬 动效演示

![动效演示](screenshots/demo.gif)<!-- 动效占位符：建议使用Gifox录制 -->

## 🤝 贡献指南

欢迎提交Issue和Pull Request！

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/AmazingFeature`
3. 提交更改：`git commit -m 'Add some AmazingFeature'`
4. 推送到分支：`git push origin feature/AmazingFeature`
5. 打开Pull Request

## ❓ 常见问题

### Q: 支持哪些图片格式？
A: 支持JPG、PNG、WEBP等常见图片格式，最大支持10MB的图片。

### Q: 为什么提取速度较慢？
A: 提取速度取决于图片大小和选择的算法，K-means算法相对较慢但结果更准确。

### Q: 如何保存提取的颜色？
A: 目前支持单个颜色复制，后续将添加批量导出功能。

## 📄 许可证

MIT License - 查看 [LICENSE](LICENSE) 文件了解详情。

## 📞 联系方式

如有问题或建议，欢迎通过GitHub Issues提交。

---

<div align="center">
  ⭐ 如果这个项目对你有帮助，请给个Star支持一下！
</div>