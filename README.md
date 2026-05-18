# 龙猫早操打卡 (Totoro Morning Sign-in)

这是一个基于 Node.js 和原生前端技术实现的龙猫早操打卡工具。它支持通过微信扫码登录，并模拟移动端 API 进行早操任务查询和签到。

This is a morning exercise sign-in tool for the Totoro platform, built with Node.js and Vanilla JS. It supports WeChat QR code login and simulates mobile API requests for task retrieval and sign-in.

## 项目结构 (Project Structure)

- `backend/`: Node.js Express 服务端，处理 API 代理、RSA 加密及微信登录逻辑。
- `frontend/`: 纯前端界面，包括扫码登录、任务展示和一键签到功能。
- `龙猫API文档.txt`: 项目相关的 API 逆向分析文档（已脱敏）。

## 核心功能 (Core Features)

- **微信扫码登录 (WeChat QR Login)**: 模拟 APP 端微信授权流程。
- **RSA 加密 (RSA Encryption)**: 实现与服务器通信所需的端到端加密逻辑。
- **任务查询 (Task Retrieval)**: 自动获取当日待完成的早操打卡任务。
- **一键打卡 (One-click Sign-in)**: 支持模拟地理位置和二维码验证。

## 快速开始 (Quick Start)

### 服务端 (Backend)

1. 进入后端目录: `cd backend`
2. 安装依赖: `npm install`
3. 启动服务: `npm start`

默认运行在 `http://localhost:3000`。

### 前端 (Frontend)

直接在浏览器中打开 `frontend/index.html`，或者通过后端服务访问（后端已静态托管前端代码）。

## 技术栈 (Tech Stack)

- **Backend**: Node.js, Express, Axios, Cheerio, Crypto (RSA)
- **Frontend**: HTML5, CSS3, Vanilla JavaScript

## 免责声明 (Disclaimer)

本项目仅供学习和研究使用，请勿用于违反学校规定或任何非法用途。开发者不对使用本项目产生的任何后果负责。

This project is for educational and research purposes only. Do not use it to violate any regulations or for any illegal purposes. The developer is not responsible for any consequences arising from the use of this project.

## 许可证 (License)

[MIT License](LICENSE)
