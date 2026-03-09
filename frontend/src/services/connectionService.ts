import axios from 'axios';

// 获取API基础URL，优先使用环境变量，否则使用与前端相同的协议
const API_URL = process.env.NEXT_PUBLIC_API_URL || (window.location.protocol + '//localhost:8080/api/v1');

// 数据库连接类型
interface DatabaseConnection {
  name: string;
  description?: string;
  type: 'database';
  db_type: 'mysql' | 'postgresql' | 'sqlserver' | 'oracle' | 'mongodb';
  host: string;
  port: number | string;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
}

// API连接类型
interface ApiConnection {
  name: string;
  description?: string;
  type: 'api';
  api_type: 'rest' | 'graphql' | 'soap' | 'odata';
  base_url: string;
  auth_type: 'none' | 'api_key' | 'basic' | 'bearer' | 'oauth2';
  api_key?: string;
  api_key_name?: string;
  username?: string;
  password?: string;
  bearer_token?: string;
  headers?: Record<string, string>;
}

// 文件服务器连接类型
interface FileServerConnection {
  name: string;
  description?: string;
  type: 'file';
  file_type: 'ftp' | 'sftp' | 's3' | 'azure_blob' | 'gcs';
  host?: string;
  port?: number | string;
  username?: string;
  password?: string;
  base_path?: string;
  passive?: boolean;
  secure?: boolean;
  access_key?: string;
  secret_key?: string;
  bucket_name?: string;
}

// 连接类型
type Connection = DatabaseConnection | ApiConnection | FileServerConnection;

// 连接响应类型
interface ConnectionResponse {
  id: string;
  name: string;
  description?: string;
  type: string;
  status: 'active' | 'inactive' | 'error';
  created_at: string;
  last_used?: string;
  config: any;
}

// 测试连接响应
interface ConnectionTestResponse {
  success: boolean;
  message: string;
  details?: any;
}

// 获取所有连接
const getConnections = async (): Promise<ConnectionResponse[]> => {
  const response = await axios.get(API_URL + '/connections', {
    withCredentials: true
  });
  return response.data;
};

// 获取单个连接
const getConnection = async (id: string): Promise<ConnectionResponse> => {
  const response = await axios.get(API_URL + '/connections/' + id, {
    withCredentials: true
  });
  return response.data;
};

// 创建新连接
const createConnection = async (
  connectionType: string,
  connection: Connection
): Promise<ConnectionResponse> => {
  // 根据连接类型准备数据
  const data: any = { connection_type: connectionType };
  
  if (connectionType === 'database') {
    data.database = connection;
  } else if (connectionType === 'api') {
    data.api = connection;
  } else if (connectionType === 'file') {
    data.file_server = connection;
  }
  
  const response = await axios.post(API_URL + '/connections', data, {
    withCredentials: true
  });
  return response.data;
};

// 更新连接
const updateConnection = async (
  id: string,
  connectionType: string,
  connection: Connection
): Promise<ConnectionResponse> => {
  // 根据连接类型准备数据
  const data: any = { connection_type: connectionType };
  
  if (connectionType === 'database') {
    data.database = connection;
  } else if (connectionType === 'api') {
    data.api = connection;
  } else if (connectionType === 'file') {
    data.file_server = connection;
  }
  
  const response = await axios.put(API_URL + '/connections/' + id, data, {
    withCredentials: true
  });
  return response.data;
};

// 删除连接
const deleteConnection = async (id: string): Promise<void> => {
  await axios.delete(API_URL + '/connections/' + id, {
    withCredentials: true
  });
};

// 测试新连接
const testNewConnection = async (
  connectionType: string,
  connection: Connection
): Promise<ConnectionTestResponse> => {
  // 根据连接类型准备数据
  const data: any = { connection_type: connectionType };
  
  if (connectionType === 'database') {
    data.database = connection;
  } else if (connectionType === 'api') {
    data.api = connection;
  } else if (connectionType === 'file') {
    data.file_server = connection;
  }
  
  const response = await axios.post(API_URL + '/connections/test', data, {
    withCredentials: true
  });
  return response.data;
};

// 测试现有连接
const testExistingConnection = async (id: string): Promise<ConnectionTestResponse> => {
  const response = await axios.post(API_URL + '/connections/' + id + '/test', {}, {
    withCredentials: true
  });
  return response.data;
};

const connectionService = {
  getConnections,
  getConnection,
  createConnection,
  updateConnection,
  deleteConnection,
  testNewConnection,
  testExistingConnection
};

export default connectionService;
export type {
  Connection,
  DatabaseConnection,
  ApiConnection,
  FileServerConnection,
  ConnectionResponse,
  ConnectionTestResponse
};
