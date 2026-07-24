// 每天自动抓公开热点数据 → _data/hotspots.json
// 数据源：微博热搜 / B站热门 / 百度热搜（公开 API）
// 抖音/小红书：当前由人工维护（写在这里的 douyin/xiaohongshu 数组中），等你后续接入抓取
const fs = require('fs');
const https = require('https');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

function fetchJSON(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': UA, 'Accept': 'application/json', ...(opts.headers || {}) },
      timeout: 8000,
    }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('parse fail: ' + url)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout: ' + url)); });
  });
}

function encode(s) { return encodeURIComponent(s); }

// 各平台抓取（失败不影响其他平台）
async function fetchWeibo() {
  // vvhan 公开 API（免费、无 CORS）
  const d = await fetchJSON('https://api.vvhan.com/api/hotlist/wbHot');
  return (d.data || []).slice(0, 8).map((x, i) => ({
    title: x.title || x.word || '',
    url: x.url || `https://s.weibo.com/weibo?q=${encode(x.title || '')}`,
    hot: x.hot || 0,
    rank: i + 1,
  })).filter(x => x.title);
}

async function fetchBilibili() {
  // B 站全站热门榜（官方公开 API）
  const d = await fetchJSON('https://api.bilibili.com/x/web-interface/ranking/v2?rid=0&type=all');
  const list = (d.data && d.data.list) || [];
  return list.slice(0, 8).map((x, i) => ({
    title: x.title || '',
    url: x.short_link_v2 || (x.bvid ? `https://www.bilibili.com/video/${x.bvid}` : ''),
    hot: x.stat && x.stat.view || 0,
    rank: i + 1,
  })).filter(x => x.title && x.url);
}

async function fetchBaidu() {
  // 百度热搜（公开 JSON 端点）
  const d = await fetchJSON('https://top.baidu.com/api/board?platform=wise&tab=realtime');
  const list = (d.data && d.data.cards && d.data.cards[0] && d.data.cards[0].content) || [];
  return list.slice(0, 8).map((x, i) => ({
    title: x.word || x.desc || '',
    url: x.url || `https://www.baidu.com/s?wd=${encode(x.word || '')}`,
    hot: x.hot || 0,
    rank: i + 1,
  })).filter(x => x.title);
}

async function fetchDouyin() {
  // 抖音热榜：iesdouyin 接口需要 X-Bogus 签名，纯脚本不稳定
  // 兜底：用头条搜索兜底，列出常驻相关话题
  return [
    { title: '#钢琴版热门BGM 挑战', url: 'https://so.toutiao.com/search?keyword=' + encode('钢琴版热门BGM'), hot: 500000, rank: 1 },
    { title: '#30天学会一首歌', url: 'https://so.toutiao.com/search?keyword=' + encode('30天学会一首歌'), hot: 400000, rank: 2 },
    { title: '#Barre芭杆塑形', url: 'https://so.toutiao.com/search?keyword=' + encode('Barre芭杆塑形'), hot: 350000, rank: 3 },
    { title: '#普通人学琴第N天', url: 'https://so.toutiao.com/search?keyword=' + encode('普通人学琴第N天'), hot: 300000, rank: 4 },
    { title: '#零基础学韩语', url: 'https://so.toutiao.com/search?keyword=' + encode('零基础学韩语'), hot: 280000, rank: 5 },
  ];
}

async function fetchXiaohongshu() {
  // 小红书：无公开 API，列出常驻相关话题
  return [
    { title: '普通人学琴第N天', url: 'https://www.xiaohongshu.com/search_result?keyword=' + encode('普通人学琴'), hot: 300000, rank: 1 },
    { title: '钢琴版流行BGM', url: 'https://www.xiaohongshu.com/search_result?keyword=' + encode('钢琴版流行BGM'), hot: 250000, rank: 2 },
    { title: '欧阳春晓芭杆跟练', url: 'https://www.xiaohongshu.com/search_result?keyword=' + encode('欧阳春晓芭杆'), hot: 200000, rank: 3 },
    { title: '零基础学韩语', url: 'https://www.xiaohongshu.com/search_result?keyword=' + encode('零基础学韩语'), hot: 180000, rank: 4 },
    { title: '粤语零基础跟读', url: 'https://www.xiaohongshu.com/search_result?keyword=' + encode('粤语零基础'), hot: 150000, rank: 5 },
  ];
}

(async () => {
  console.log('开始抓取热点...');
  const results = {};
  for (const [key, fn] of [
    ['weibo', fetchWeibo],
    ['bilibili', fetchBilibili],
    ['baidu', fetchBaidu],
    ['douyin', fetchDouyin],
    ['xiaohongshu', fetchXiaohongshu],
  ]) {
    try {
      results[key] = await fn();
      console.log('  ' + key + ': ' + results[key].length + ' 条');
    } catch (e) {
      console.error('  ' + key + ' 失败:', e.message);
      results[key] = [];
    }
  }

  const out = {
    updatedAt: new Date().toISOString(),
    sources: {
      weibo:        { label: '微博热搜',   icon: '🔥', color: '#e6162d' },
      bilibili:     { label: 'B站热门',    icon: '📺', color: '#fb7299' },
      baidu:        { label: '百度热搜',   icon: '🔍', color: '#3385ff' },
      douyin:       { label: '抖音热点',   icon: '🎵', color: '#2a2a2a' },
      xiaohongshu:  { label: '小红书热点', icon: '📕', color: '#ff2e4d' }
    },
    items: results
  };

  fs.writeFileSync('_data/hotspots.json', JSON.stringify(out, null, 2));
  console.log('已写入 _data/hotspots.json');
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
