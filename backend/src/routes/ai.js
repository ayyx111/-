/**
 * AI 服务转发路由
 * 把前端请求 /api/v1/ai/* 透明转发到 Python AI 服务 /api/*
 * 让前端只对接后端,无需关心 AI 服务地址,同时支持鉴权统一管控
 */
const express = require('express');
const router = express.Router();
const config = require('../config');

const AI_BASE = config.ai.url.replace(/\/$/, ''); // 去掉末尾斜杠
const AI_TIMEOUT = 60000; // LLM 调用(智谱 GLM-4-Flash)响应可能较慢,设 60s

/**
 * 通用转发函数
 * @param {'GET'|'POST'} method
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {string} aiPath - AI 服务上的路径,如 /api/chatbot
 */
async function forward(method, req, res, aiPath) {
  const url = `${AI_BASE}${aiPath}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT);

  try {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal
    };
    let finalUrl = url;
    // GET:把 query 参数透传;POST:把 body 透传
    if (method === 'GET' && Object.keys(req.query).length > 0) {
      finalUrl = `${url}?${new URLSearchParams(req.query)}`;
    } else if (method !== 'GET') {
      options.body = JSON.stringify(req.body || {});
    }

    const resp = await fetch(finalUrl, options);
    clearTimeout(timer);

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      return res.status(resp.status).json({
        code: resp.status,
        message: `AI 服务返回错误: ${resp.status}`,
        data: null,
        detail: text.slice(0, 500)
      });
    }

    const json = await resp.json();
    return res.json(json);
  } catch (err) {
    clearTimeout(timer);
    const isTimeout = err.name === 'AbortError';
    console.warn(`[AIRoute] 转发失败 ${method} ${aiPath}:`, err.message);
    return res.status(502).json({
      code: 502,
      message: isTimeout ? 'AI 服务响应超时,请稍后再试' : `AI 服务不可用: ${err.message}`,
      data: null
    });
  }
}

// 智能客服:POST /api/v1/ai/chatbot
router.post('/chatbot', (req, res) => forward('POST', req, res, '/api/chatbot'));

// 智能搜索:GET /api/v1/ai/search
router.get('/search', (req, res) => forward('GET', req, res, '/api/search'));

// 智能推荐:GET /api/v1/ai/recommend
router.get('/recommend', (req, res) => forward('GET', req, res, '/api/recommend'));

// 内容审核:POST /api/v1/ai/review (一般由后端内部调用,这里也开放便于前端调试)
router.post('/review', (req, res) => forward('POST', req, res, '/api/review'));

module.exports = router;
