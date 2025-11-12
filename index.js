// index.js - "恋爱脑" 后端服务器 (稳定兼容版)
require('dotenv').config();

// 详细的环境变量检查
console.log('=== 环境变量检查 ===');
console.log('MONGO_URI 长度:', process.env.MONGO_URI ? process.env.MONGO_URI.length : '未设置');
console.log('PORT:', process.env.PORT);
console.log('==================');

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// === 数据库配置 ===
const URI = process.env.MONGO_URI;
const DB_NAME = "lovebrainDB";
const SIMULATION_COLLECTION = "simulated_tests";
const SETTINGS_COLLECTION = "settings";
const TOTAL_SIMULATIONS = 1000;

// 维度列表
const DIMENSIONS = [
    'emotional_dependence',
    'idealization_filter',
    'boundary_sacrifice',
    'loss_of_self',
    'relationship_centrality'
];

// === 中间件 ===
// 使用最简单的 CORS 配置
app.use(cors());
app.use(express.json());

// 数据库连接实例
let db = null;
let client = null;

// === 数据库连接函数 ===
async function connectDB() {
    try {
        if (!URI) {
            console.log("❌ MONGO_URI 未设置，跳过数据库连接");
            return;
        }

        console.log('正在连接 MongoDB...');
        
        // 动态导入 mongodb 以避免可能的兼容性问题
        const { MongoClient, ServerApiVersion } = await import('mongodb');
        
        client = new MongoClient(URI, {
            serverApi: {
                version: ServerApiVersion.v1,
                strict: true,
                deprecationErrors: true,
            }
        });

        await client.connect();
        
        // 测试连接
        await client.db("admin").command({ ping: 1 });
        console.log("✅ MongoDB 连接成功！");
        
        db = client.db(DB_NAME);
        console.log(`✅ 已连接到数据库: ${DB_NAME}`);
        
        // 确保 settings 集合存在且有默认配置
        await initializeSettings();
        
    } catch (error) {
        console.error("❌ MongoDB 连接失败:", error.message);
        console.log("💡 提示：服务器将在模拟数据模式下运行");
    }
}

// 初始化设置
async function initializeSettings() {
    try {
        const settingsCollection = db.collection(SETTINGS_COLLECTION);
        const existingConfig = await settingsCollection.findOne({ "type": "main_config" });
        
        if (!existingConfig) {
            await settingsCollection.insertOne({
                type: "main_config",
                accessCode: "1234",
                createdAt: new Date(),
                updatedAt: new Date()
            });
            console.log("✅ 默认设置已初始化，访问码: 1234");
        } else {
            console.log("✅ 设置配置已存在，访问码:", existingConfig.accessCode);
        }
    } catch (error) {
        console.error("初始化设置时出错:", error);
    }
}

// === API 接口 ===

// 1. 健康检查接口
app.get('/', (req, res) => {
    res.json({ 
        status: 'running', 
        message: '「恋爱脑」测试后端 API 正在运行',
        timestamp: new Date().toISOString(),
        database: db ? 'connected' : 'disconnected',
        version: '2.0.0-stable'
    });
});

// 2. 访问码检查接口
app.post('/api/check-access-code', (req, res) => {
    try {
        console.log("收到访问码验证请求:", req.body);
        
        const { accessCode } = req.body;

        if (!accessCode) {
            return res.status(400).json({ 
                success: false, 
                message: '未提供访问码' 
            });
        }

        // 使用硬编码访问码
        const validCodes = ['1234', '0000', 'test', 'lovebrain'];
        
        if (validCodes.includes(accessCode)) {
            console.log("访问码验证成功");
            res.json({ 
                success: true, 
                message: '验证成功' 
            });
        } else {
            console.log("访问码验证失败：输入=", accessCode);
            res.status(401).json({ 
                success: false, 
                message: '访问码错误' 
            });
        }

    } catch (error) {
        console.error("检查访问码时发生错误:", error);
        res.status(500).json({ 
            success: false, 
            message: '服务器内部错误' 
        });
    }
});

// 3. 排名计算接口
app.post('/api/lovebrain-rankings', async (req, res) => {
    try {
        console.log("收到排名计算请求:", req.body);
        
        const userScores = req.body;

        // 验证输入数据
        if (!userScores || typeof userScores !== 'object') {
            return res.status(400).json({ 
                success: false,
                message: '请求格式错误：缺少用户分数数据。' 
            });
        }

        // 检查每个维度的分数
        for (const dim of DIMENSIONS) {
            if (typeof userScores[dim] !== 'number') {
                return res.status(400).json({ 
                    success: false,
                    message: `请求格式错误：维度 ${dim} 的分数必须是数字。` 
                });
            }
        }

        let rankings = {};
        let source = "mock"; // 默认使用模拟数据

        // 如果数据库连接正常，尝试使用数据库
        if (db) {
            try {
                const collection = db.collection(SIMULATION_COLLECTION);
                rankings = {};

                for (const dim of DIMENSIONS) {
                    const userScore = userScores[dim];
                    
                    const lowerCount = await collection.countDocuments({
                        [dim]: { $lt: userScore }
                    });

                    const rankPercentage = Math.round((lowerCount / TOTAL_SIMULATIONS) * 100);
                    rankings[dim] = Math.max(1, Math.min(99, rankPercentage)); // 确保在 1-99 范围内
                }

                source = "database";
                console.log("使用数据库计算排名:", rankings);
                
            } catch (dbError) {
                console.error("数据库查询错误，使用模拟数据:", dbError.message);
                rankings = generateMockRankings(userScores);
            }
        } else {
            // 数据库不可用，使用模拟数据
            rankings = generateMockRankings(userScores);
            console.log("使用模拟排名数据:", rankings);
        }

        res.json({
            success: true,
            message: "排名计算成功",
            rankings: rankings,
            userScores: userScores,
            source: source
        });

    } catch (error) {
        console.error("计算排名时发生错误:", error);
        res.status(500).json({ 
            success: false,
            message: '服务器内部错误，无法计算排名' 
        });
    }
});

// 生成模拟排名数据的辅助函数
function generateMockRankings(userScores) {
    const mockRankings = {};
    
    DIMENSIONS.forEach(dim => {
        const userScore = userScores[dim];
        
        // 基于用户分数生成更合理的模拟排名
        let baseRank;
        if (userScore <= 1.5) baseRank = 15;
        else if (userScore <= 2.5) baseRank = 35;
        else if (userScore <= 3.5) baseRank = 55;
        else if (userScore <= 4.5) baseRank = 75;
        else baseRank = 90;
        
        // 添加一些随机变化 (±8%)
        const variation = Math.floor(Math.random() * 17) - 8;
        mockRankings[dim] = Math.max(1, Math.min(99, baseRank + variation));
    });
    
    return mockRankings;
}

// 4. 获取服务器状态接口
app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        status: 'running',
        database: db ? 'connected' : 'disconnected',
        port: PORT,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// === 错误处理中间件 ===
app.use((error, req, res, next) => {
    console.error('服务器错误:', error);
    res.status(500).json({ 
        success: false, 
        message: '服务器内部错误' 
    });
});

// === 404 处理中间件 ===
// 放在所有路由之后
app.use((req, res) => {
    res.status(404).json({ 
        success: false, 
        message: `接口不存在: ${req.method} ${req.originalUrl}` 
    });
});

// === 服务器启动 ===
async function startServer() {
    try {
        console.log('🚀 正在启动服务器...');
        
        // 先启动服务器
        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log(`✅ 服务器正在端口 ${PORT} 上运行`);
            console.log(`📍 本地访问: http://localhost:${PORT}/`);
            console.log(`📍 状态检查: http://localhost:${PORT}/api/status`);
            console.log(`⏰ 启动时间: ${new Date().toLocaleString()}`);
            console.log('💡 提示：前端可以通过访问码 1234 进行测试');
        });

        // 异步连接数据库（不阻塞服务器启动）
        setTimeout(() => {
            connectDB().catch(error => {
                console.log('⚠️  数据库连接失败，但服务器继续运行在模拟数据模式');
            });
        }, 1000);

        // 优雅关闭处理
        const gracefulShutdown = async (signal) => {
            console.log(`\n📦 收到 ${signal} 信号，正在关闭服务器...`);
            
            server.close(() => {
                console.log('✅ HTTP 服务器已关闭');
            });
            
            if (client) {
                await client.close();
                console.log('✅ 数据库连接已关闭');
            }
            
            console.log('👋 服务器已完全关闭');
            process.exit(0);
        };

        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

    } catch (error) {
        console.error("❌ 启动服务器失败:", error);
        process.exit(1);
    }
}

// 启动服务器
startServer();