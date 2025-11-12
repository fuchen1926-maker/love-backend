// seed.js - "恋爱脑"测试 虚拟数据播种脚本

require('dotenv').config(); // 确保加载 .env 文件
const { MongoClient } = require('mongodb');

// --- 数据库配置 ---
const URI = process.env.MONGO_URI; 
const DB_NAME = "lovebrainDB"; // *** 新的数据库名称 ***
const COLLECTION_NAME = "simulated_tests"; // 集合名称
const SIMULATION_COUNT = 1000; // 生成 1000 份数据

// --- 计分规则 ---
// 5个维度, 8道题/维度 = 40题
const DIMENSIONS = [
    'emotional_dependence', // 情感依赖 (D1: Q 0-7)
    'idealization_filter',  // 理想化滤镜 (D2: Q 8-15)
    'boundary_sacrifice',   // 界限牺牲 (D3: Q 16-23)
    'loss_of_self',         // 自我迷失 (D4: Q 24-31)
    'relationship_centrality' // 关系优先 (D5: Q 32-39)
];
const QUESTIONS_PER_DIMENSION = 8;
const MAX_SCORE_PER_QUESTION = 4; // 0-4分制

// *** 关键：反向计分题的索引 (基于 0-39 的总索引) ***
const REVERSE_SCORED_INDICES = [
    // D2 (Q 8-15)
    13, // "即使我再爱一个人..."
    14, // "当ta做出一些客观上讨人厌的行为时..."
    // D3 (Q 16-23)
    22, // "对我来说，任何形式的不忠..."
    23, // "如果一段关系开始持续地伤害我的自尊..."
    // D5 (Q 32-39)
    36, // "就像那句话说的，‘生活不应该只有眼前的苟且...’"
    37, // "我无法接受一个为了爱情而放弃自己核心事业...)"
    39  // "如果一段关系开始严重阻碍我的个人成长..."
];

// --- 辅助函数 ---

// 生成一个 0-4 之间的随机整数
function getRandomScore() {
    return Math.floor(Math.random() * (MAX_SCORE_PER_QUESTION + 1)); // 0, 1, 2, 3, 4
}

// 生成一份完整的虚拟测试数据 (1000份之一)
function generateSingleTestData() {
    const dimensionScores = {
        'emotional_dependence': 0,
        'idealization_filter': 0,
        'boundary_sacrifice': 0,
        'loss_of_self': 0,
        'relationship_centrality': 0
    };
    
    // 模拟 40 道题的回答
    for (let i = 0; i < (DIMENSIONS.length * QUESTIONS_PER_DIMENSION); i++) {
        
        let score = getRandomScore(); // 随机生成一个 0-4 的分数

        // 1. 检查是否为反向计分题
        if (REVERSE_SCORED_INDICES.includes(i)) {
            // 反向计分 (0 -> 4, 1 -> 3, 2 -> 2, 3 -> 1, 4 -> 0)
            score = MAX_SCORE_PER_QUESTION - score;
        }

        // 2. 确定分数属于哪个维度
        const dimIndex = Math.floor(i / QUESTIONS_PER_DIMENSION);
        const dimName = DIMENSIONS[dimIndex];

        // 3. 将分数累加到对应的维度总分上
        dimensionScores[dimName] += score;
    }
    
    // 返回包含 5 个维度总分的对象
    // 每个维度的分数范围是 (0分 x 8题) 到 (4分 x 8题) = 0 到 32 分
    return dimensionScores;
}

// --- 主函数 ---

async function seedDatabase() {
    if (!URI) {
        console.error("致命错误：未设置 MONGO_URI 环境变量。无法连接数据库。");
        process.exit(1);
    }
    const client = new MongoClient(URI);

    try {
        console.log(`[SEED] 正在连接到 MongoDB...`);
        await client.connect();
        const db = client.db(DB_NAME);
        const collection = db.collection(COLLECTION_NAME);

        // 1. 清空旧数据
        await collection.deleteMany({});
        console.log(`[SEED] 已清空集合 ${COLLECTION_NAME} 中的所有旧数据。`);

        // 2. 生成 1000 份数据
        const simulatedData = [];
        for (let i = 0; i < SIMULATION_COUNT; i++) {
            simulatedData.push(generateSingleTestData());
        }
        console.log(`[SEED] 成功生成 ${SIMULATION_COUNT} 份“恋爱脑”虚拟测试数据。`);

        // 3. 批量插入数据到数据库
        const result = await collection.insertMany(simulatedData);
        console.log(`[SEED] 成功将 ${result.insertedCount} 份数据插入到数据库 ${DB_NAME}。`);
        
    } catch (error) {
        console.error("[SEED] 数据播种失败:", error);
    } finally {
        // 4. 断开连接
        await client.close();
        console.log("[SEED] 数据库连接已关闭。");
    }
}

// 运行主函数
seedDatabase();