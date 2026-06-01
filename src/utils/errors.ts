import { Request, Response, NextFunction, RequestHandler } from 'express';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * 将异步路由处理函数包装为 Express 请求处理中间件。
 *
 * ## 为什么需要 wrapAsync
 *
 * Express 4 只会在同步中间件中自动捕获 throw 的错误。
 * 对于 async 函数，当内部产生异常时返回的是 rejected promise，
 * Express 4 不会自动注册 .catch()，结果就是 unhandled promise rejection，
 * 客户端收不到任何响应，会一直挂起直到超时。
 *
 * ## 解决了什么
 *
 * 该包装器为 async handler 的返回 Promise 链式调用 .catch(next)，
 * 将 rejected promise 转换为 next(err)。
 * Express 收到 next(err) 后会跳过后续常规中间件，
 * 直接进入全局 errorHandler，返回规范的错误 JSON 响应。
 *
 * @param fn - 异步 (req, res, next) => Promise<void> 路由处理函数
 * @returns 适配 Express 的同步 RequestHandler
 */
export function wrapAsync(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>): RequestHandler {
  return (req, res, next) => fn(req, res, next).catch(next);
}
