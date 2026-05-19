# Embeddings API 功能实现

> 实现日期: 2026-05-20

## 概述

为 Mock OpenAI 服务添加 `/v1/embeddings` 端点，兼容 OpenAI Embeddings API 格式。

## 改动清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `src/services/mock-embeddings.ts` | Embedding 向量生成服务 |
| `src/controllers/embeddings.ts` | Embeddings 请求控制器 |
| `src/routes/embeddings.ts` | `POST /v1/embeddings` 路由 |

### 修改文件

| 文件 | 变更内容 |
|------|----------|
| `src/types/openai.ts` | 新增 Embedding 类型定义 (`EmbeddingRequest`, `EmbeddingData`, `EmbeddingResponse`, `EmbeddingUsage`, `EmbeddingInput`) |
| `src/index.ts` | 导入并注册 `embeddingsRouter` |
| `src/templates/models.md` | 新增 3 个 embedding 模型: `text-embedding-3-small`, `text-embedding-3-large`, `text-embedding-ada-002` |
| `README.md` | 新增 embeddings API 使用文档和 curl 示例 |

## API 规范

### 端点

```
POST /v1/embeddings
```

### 请求体

```typescript
{
  model: string;              // 模型名称
  input: string | string[];   // 输入文本
  user?: string;              // 用户标识（可选）
  encoding_format?: 'float' | 'base64';  // 编码格式（保留，暂仅支持 float）
  dimensions?: number;        // 向量维度（可选，默认根据模型决定）
}
```

### 成功响应

```typescript
{
  object: 'list',
  data: [
    {
      object: 'embedding',
      index: number,
      embedding: number[]    // L2 归一化向量
    }
  ],
  model: string,
  usage: {
    prompt_tokens: number,
    total_tokens: number
  }
}
```

### 错误响应

```json
{
  "error": {
    "message": "input is required",
    "type": "invalid_request_error",
    "code": 400
  }
}
```

## 实现细节

### 确定性向量生成 (`mock-embeddings.ts`)

使用 **mulberry32** 伪随机数生成器 + **Box-Muller 变换**实现确定性 embedding:

```
1. 对输入文本计算 hash seed (每字符 * 31 + charCode)
2. 用 seed 初始化 mulberry32 PRNG
3. Box-Muller 变换生成正态分布随机值
4. L2 归一化到单位长度
```

- **相同输入** → 相同 hash seed → 相同 embedding 向量 ✅
- **不同输入** → 不同 hash seed → 不同 embedding 向量 ✅

### 模型维度映射

| 模型 | 默认维度 |
|------|---------|
| `text-embedding-3-small` | 1536 |
| `text-embedding-3-large` | 3072 |
| `text-embedding-ada-002` | 1536 |
| 其他 | 1536 |

支持通过请求的 `dimensions` 参数覆盖。

### Token 估算

沿用项目中已有的 `countTokens()` 函数（英文 ≈ 0.3 token/字符，中文 ≈ 0.6 token/字符）。

## 测试结果

```
Basic embedding:      ✅ 返回正确格式的 embedding 向量
Multiple inputs:      ✅ 批量返回多个 embedding
Custom dimensions:    ✅ 支持指定维度 (4D, 256D, 1536D, 3072D)
Deterministic:        ✅ 相同输入 = 相同向量，不同输入 = 不同向量
Error handling:       ✅ 缺少 input 返回 400
Models list:          ✅ /v1/models 包含 3 个 embedding 模型
```

## 使用示例

```bash
# 单条文本
curl -X POST http://localhost:3000/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{"input": "Hello world", "model": "text-embedding-3-small"}'

# 批量输入
curl -X POST http://localhost:3000/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{"input": ["你好", "world"], "model": "text-embedding-3-large"}'

# 自定义维度
curl -X POST http://localhost:3000/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{"input": "Hello", "model": "text-embedding-3-small", "dimensions": 256}'
```
