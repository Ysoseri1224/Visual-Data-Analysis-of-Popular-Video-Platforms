// MongoDB初始化脚本
// 创建chart_config集合并设置必要的索引

// 连接数据库
db = db.getSiblingDB('chatbot_analysis');

// 检查chart_configs集合是否存在，如果不存在则创建
if (!db.getCollectionNames().includes('chart_configs')) {
  db.createCollection('chart_configs');
  print("已成功创建chart_configs集合");
  
  // 创建索引
  db.chart_configs.createIndex({ "messageId": 1 }, { unique: true, sparse: true });
  db.chart_configs.createIndex({ "sqlQuery": 1 });
  print("已成功创建chart_configs集合的索引");
}

// 插入一条测试数据
db.chart_configs.insertOne({
  messageId: "test_message_id",
  sqlQuery: "SELECT * FROM test_table LIMIT 10",
  echartsConfig: {
    title: { text: "测试图表" },
    xAxis: { type: "category", data: ["测试1", "测试2", "测试3"] },
    yAxis: { type: "value" },
    series: [{ data: [5, 20, 36], type: "bar" }]
  },
  createdAt: new Date(),
  updatedAt: new Date(),
  source: "init_script"
});

print("数据库初始化完成");
