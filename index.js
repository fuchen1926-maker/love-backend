// index.js - "恋爱脑" 后端服务器 (纯环境变量访问码版本)
require('dotenv').config();

// 详细的环境变量检查
console.log('=== 环境变量检查 ===');
console.log('MONGO_URI 长度:', process.env.MONGO_URI ? process.env.MONGO_URI.length : '未设置');
console.log('PORT:', process.env.PORT);
console.log('ACCESS_CODE:', process.env.ACCESS_CODE ? '已设置' : '未设置');
console.log('==================');

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// === 配置 ===
const URI = process.env.MONGO_URI;
const ACCESS_CODE = process.env.ACCESS_CODE; // 主要访问码
const DB_NAME = "lovebrainDB";
const SIMULATION_COLLECTION = "simulated_tests";
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
app.use(cors());
app.use(express.json());

// 数据库连接实例 (仅用于排名计算)
let db = null;
let client = null;

// === 数据库连接函数 (仅用于排名计算) ===
async function connectDB() {
    try {
        if (!URI) {
            console.log("❌ MONGO_URI 未设置，跳过数据库连接");
            return;
        }

        console.log('正在连接 MongoDB...');
        
        // 动态导入 mongodb
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
        
    } catch (error) {
        console.error("❌ MongoDB 连接失败:", error.message);
        console.log("💡 提示：排名计算将使用模拟数据");
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
        accessCode: ACCESS_CODE ? '已设置' : '未设置',
        version: '3.0.0-env-only-access'
    });
});

// 2. 访问码检查接口 - 仅使用环境变量
app.post('/api/check-access-code', (req, res) => {
    try {
        console.log("收到访问码验证请求");
        
        const { accessCode } = req.body;

        if (!accessCode) {
            return res.status(400).json({ 
                success: false, 
                message: '未提供访问码' 
            });
        }

        // 直接比较环境变量中的访问码
        if (ACCESS_CODE && ACCESS_CODE === accessCode) {
            console.log("✅ 访问码验证成功");
            res.json({ 
                success: true, 
                message: '验证成功'
            });
        } else {
            console.log("❌ 访问码验证失败：输入=", accessCode, "期望=", ACCESS_CODE);
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
        accessCode: ACCESS_CODE ? '已设置' : '未设置',
        port: PORT,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        version: '3.0.0-env-only-access'
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
        
        // 检查必要的环境变量
        if (!ACCESS_CODE) {
            console.warn('⚠️  ACCESS_CODE 环境变量未设置，访问码验证将始终失败！');
        } else {
            console.log('✅ 访问码已通过环境变量设置');
        }
        
        // 先启动服务器
        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log(`✅ 服务器正在端口 ${PORT} 上运行`);
            console.log(`📍 本地访问: http://localhost:${PORT}/`);
            console.log(`📍 状态检查: http://localhost:${PORT}/api/status`);
            console.log(`⏰ 启动时间: ${new Date().toLocaleString()}`);
            console.log('💡 提示：访问码完全通过环境变量管理，响应速度更快');
        });

        // 异步连接数据库（不阻塞服务器启动）
        setTimeout(() => {
            connectDB().catch(error => {
                console.log('⚠️  数据库连接失败，排名计算将使用模拟数据');
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
