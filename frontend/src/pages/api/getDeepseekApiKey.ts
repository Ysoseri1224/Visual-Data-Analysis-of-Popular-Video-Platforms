import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

/**
 * API接口：从文件中读取DeepSeek API密钥
 * @param req 请求对象
 * @param res 响应对象
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 指定API密钥文件的路径
    const apiKeyPath = path.join(process.cwd(), '..', 'nl2sql_model', 'deepseek_api_key.txt');
    
    // 检查文件是否存在
    if (!fs.existsSync(apiKeyPath)) {
      console.error('API密钥文件不存在:', apiKeyPath);
      return res.status(404).send('API密钥文件不存在');
    }
    
    // 读取API密钥
    const apiKey = fs.readFileSync(apiKeyPath, 'utf8').trim();
    
    // 返回API密钥
    res.status(200).send(apiKey);
  } catch (error) {
    console.error('读取API密钥出错:', error);
    res.status(500).send('内部服务器错误');
  }
}
