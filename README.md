# ColorExtractor

一个功能强大的颜色提取工具，可以从图像中提取主要颜色。

## 功能特性

- 从上传的图像中提取主要颜色
- 支持多种颜色提取算法
- 实时预览颜色提取结果
- 提供友好的错误处理
- 响应式设计，适配各种设备

## 快速开始

### 本地运行

1. 克隆仓库
   ```bash
   git clone https://github.com/yourusername/ColorExtractor.git
   cd ColorExtractor
   ```

2. 启动本地服务器
   ```bash
   # 使用Python内置服务器
   python -m http.server 8080
   
   # 或者使用http-server
   npx http-server -p 8080
   ```

3. 在浏览器中访问 `http://localhost:8080`

## 如何部署到GitHub Pages

1. 创建GitHub仓库
   - 在GitHub上创建名为`ColorExtractor`的新仓库
   - 不要初始化README或.gitignore文件（我们已经有了）

2. 推送本地代码到GitHub
   ```bash
   git remote add origin https://github.com/yourusername/ColorExtractor.git
   git branch -M main
   git push -u origin main
   ```

3. 启用GitHub Pages
   - 进入仓库设置
   - 找到"Pages"部分
   - 选择`main`分支作为源
   - 点击"Save"按钮

4. 访问部署的网站
   - 部署完成后，可以通过 `https://yourusername.github.io/ColorExtractor` 访问

## 技术栈

- HTML5
- CSS3
- JavaScript (ES6+)
- Web Workers（用于高效图像处理）
- Canvas API

## 项目结构

- `index.html`: 主页面
- `script.js`: 主要JavaScript代码
- `style.css`: 样式文件
- `.gitignore`: Git忽略文件

## 许可证

MIT License