/*!
 * @name 星海音乐源
 * @description 基于GD Studio API，支持网易云、QQ、酷狗、酷我、咪咕五大平台。建议优先使用网易云和酷我音乐。
 * @version v2.2.2
 * @author 万去了了
 * @homepage https://cdyzr.dpdns.org/
 * @updateUrl https://zrcdy.dpdns.org/xinghai-music-source.js
 */

// ============================ 核心配置区域 ===========
const UPDATE_CONFIG = {
  versionApiUrl: 'https://zrcdy.dpdns.org/version.php',
  latestScriptUrl: 'https://zrcdy.dpdns.org/xinghai-music-source.js',
  currentVersion: 'v2.2.2'
};

const API_URL = 'https://music-api.gdstudio.xyz/api.php?use_xbridge3=true&loader_name=forest&need_sec_link=1&sec_link_scene=im&theme=light';

// 音质支持配置
const MUSIC_QUALITY = {
  wy: ['128k', '192k', '320k', 'flac', 'flac24bit'],
  tx: ['128k', '192k', '320k', 'flac', 'flac24bit'],
  kw: ['128k', '192k', '320k', 'flac', 'flac24bit'],
  kg: ['128k', '192k', '320k', 'flac', 'flac24bit'],
  mg: ['128k', '192k', '320k', 'flac']
};

const { EVENT_NAMES, request, on, send, env } = globalThis.lx;
const MUSIC_SOURCE = Object.keys(MUSIC_QUALITY);

// ============================ 请求频率限制系统 ============================
const RATE_LIMIT_CONFIG = {
  maxRequests: 60, // 5分钟内最大请求次数
  timeWindow: 5 * 60 * 1000, // 时间窗口：5分钟（毫秒）
  cleanupInterval: 10 * 60 * 1000 // 清理间隔：10分钟
};

let requestHistory = [];
let lastCleanupTime = Date.now();

/**
 * 清理过期的请求记录
 */
function cleanupExpiredRequests() {
  const now = Date.now();
  const cutoffTime = now - RATE_LIMIT_CONFIG.timeWindow;
  
  if (now - lastCleanupTime > RATE_LIMIT_CONFIG.cleanupInterval) {
    requestHistory = requestHistory.filter(record => record.time >= cutoffTime);
    lastCleanupTime = now;
  }
  
  return cutoffTime;
}

/**
 * 检查请求频率限制
 */
function checkRateLimit() {
  cleanupExpiredRequests();
  
  const now = Date.now();
  const cutoffTime = now - RATE_LIMIT_CONFIG.timeWindow;
  
  const recentRequests = requestHistory.filter(record => record.time >= cutoffTime);
  requestHistory = recentRequests;
  
  if (recentRequests.length >= RATE_LIMIT_CONFIG.maxRequests) {
    const remainingTime = Math.ceil((recentRequests[0].time + RATE_LIMIT_CONFIG.timeWindow - now) / 1000);
    return {
      allowed: false,
      message: `请求频率过高，请${Math.ceil(remainingTime/60)}分钟后再试（${RATE_LIMIT_CONFIG.maxRequests}次/5分钟）`,
      currentCount: recentRequests.length,
      remainingTime: remainingTime
    };
  }
  
  requestHistory.push({ time: now });
  
  return {
    allowed: true,
    message: `请求正常 (${recentRequests.length + 1}/${RATE_LIMIT_CONFIG.maxRequests})`,
    currentCount: recentRequests.length + 1
  };
}

// ============================ 工具函数集 ============================
function log(...args) {
  console.log(...args);
}

/**
 * 优化日志输出
 */
function logRequest(action, source, musicInfo, status, extra = '') {
  const songName = musicInfo.name || '未知歌曲';
  log(`[${action}] ${source} | ${songName} | ${status}${extra ? ' | ' + extra : ''}`);
}

/**
 * 平台特定的ID提取逻辑
 */
function extractPlatformId(musicInfo, source) {
  let songId;
  
  switch(source) {
    case 'wy': // 网易云音乐
      songId = musicInfo.id || musicInfo.hash;
      break;
    case 'tx': // QQ音乐
      songId = musicInfo.songmid || musicInfo.id;
      break;
    case 'kg': // 酷狗音乐
      songId = musicInfo.hash || musicInfo.id;
      break;
    case 'kw': // 酷我音乐
      songId = musicInfo.id || musicInfo.hash || musicInfo.songmid;
      break;
    case 'mg': // 咪咕音乐
      songId = musicInfo.songmid || musicInfo.id || musicInfo.hash;
      break;
    default:
      songId = musicInfo.hash || musicInfo.songmid || musicInfo.id;
  }
  
  return songId;
}

/**
 * 封装HTTP请求
 */
const httpFetch = (url, options = { method: 'GET' }) => {
  return new Promise((resolve, reject) => {
    const cancelRequest = request(url, options, (err, resp) => {
      if (err) {
        log('请求失败:', err.message);
        return reject(new Error(`网络请求异常：${err.message}`));
      }
      resolve({
        body: resp.body,
        statusCode: resp.statusCode
      });
    });
  });
};

/**
 * 版本号比对算法
 */
const compareVersions = (remoteVer, currentVer) => {
  const remoteParts = remoteVer.replace(/^v/, '').split('.').map(Number);
  const currentParts = currentVer.replace(/^v/, '').split('.').map(Number);
  
  for (let i = 0; i < Math.max(remoteParts.length, currentParts.length); i++) {
    const remote = remoteParts[i] || 0;
    const current = currentParts[i] || 0;
    if (remote > current) return true;
    if (remote < current) return false;
  }
  return false;
};

// ============================ 自动更新系统 ============================
const checkAutoUpdate = async () => {
  log('检查更新...');
  try {
    const resp = await httpFetch(UPDATE_CONFIG.versionApiUrl, {
      timeout: 15000,
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'LX-Music-Mobile'
      }
    });

    let apiData;
    try {
      apiData = typeof resp.body === 'object' ? resp.body : JSON.parse(resp.body);
    } catch (parseError) {
      throw new Error('版本接口返回数据格式错误');
    }

    if (!apiData || typeof apiData !== 'object') {
      throw new Error('版本接口返回数据无效');
    }

    if (!apiData.version) {
      throw new Error('版本接口未返回版本号');
    }

    const remoteVersion = apiData.version;
    const updateLog = apiData.changelog || '暂无更新日志';
    const minRequiredVersion = apiData.min_required || 'v1.0.0';

    const needUpdate = compareVersions(remoteVersion, UPDATE_CONFIG.currentVersion);
    
    if (needUpdate) {
      log('发现新版本:', remoteVersion);
      
      const isForceUpdate = compareVersions(remoteVersion, minRequiredVersion) && 
                           compareVersions(minRequiredVersion, UPDATE_CONFIG.currentVersion);
      
      const updateMessage = `【星海音乐源更新通知】\n当前版本：${UPDATE_CONFIG.currentVersion}\n最新版本：${remoteVersion}\n\n更新内容：\n${updateLog}${
        isForceUpdate ? '\n\n⚠️ 此版本需要强制更新，请立即更新以正常使用' : ''
      }`;

      send(EVENT_NAMES.updateAlert, {
        log: updateMessage,
        updateUrl: UPDATE_CONFIG.latestScriptUrl,
        confirmText: '立即更新',
        cancelText: isForceUpdate ? '退出应用' : '暂不更新'
      });
    } else {
      log('当前已是最新版本');
    }
  } catch (err) {
    log('更新检查失败:', err.message);
  }
};

// ============================ 音频链接解析核心 ============================
// 音质映射表
const qualityMap = {
  '128k': '128',
  '192k': '192', 
  '320k': '320',
  'flac': '999',
  'flac24bit': '740'
};

const sourceMap = {
  wy: 'netease',
  tx: 'tencent',
  kw: 'kuwo',
  kg: 'kugou',
  mg: 'migu'
};

/**
 * 获取音频播放地址核心方法
 */
const handleGetMusicUrl = async (source, musicInfo, quality) => {
  // 检查频率限制
  const rateLimit = checkRateLimit();
  if (!rateLimit.allowed) {
    logRequest('解析地址', source, musicInfo, '阻止', `频率限制: ${rateLimit.message}`);
    throw new Error(`🎵 星海音乐源：${rateLimit.message}`);
  }

  logRequest('解析地址', source, musicInfo, '开始');

  const songId = extractPlatformId(musicInfo, source);
  if (!songId) {
    const errMsg = `无法获取${source}平台的歌曲ID`;
    logRequest('解析地址', source, musicInfo, '失败', errMsg);
    throw new Error(errMsg);
  }

  const apiSource = sourceMap[source];
  const apiQuality = qualityMap[quality];
  
  if (!apiSource) {
    const errMsg = `不支持的平台：${source}`;
    logRequest('解析地址', source, musicInfo, '失败', errMsg);
    throw new Error(errMsg);
  }

  if (!apiQuality) {
    const errMsg = `不支持的音质：${quality}`;
    logRequest('解析地址', source, musicInfo, '失败', errMsg);
    throw new Error(errMsg);
  }

  const requestUrl = `${API_URL}&types=url&source=${apiSource}&id=${songId}&br=${apiQuality}`;

  try {
    const resp = await httpFetch(requestUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'LX-Music-Mobile',
        'Accept': 'application/json'
      }
    });

    let apiData;
    try {
      apiData = typeof resp.body === 'object' ? resp.body : JSON.parse(resp.body);
    } catch (parseError) {
      const errMsg = 'API响应解析失败';
      logRequest('解析地址', source, musicInfo, '失败', errMsg);
      throw new Error('API接口返回数据格式错误');
    }

    if (!apiData.url) {
      const errMsg = apiData.msg || '无有效音频地址';
      logRequest('解析地址', source, musicInfo, '失败', errMsg);
      throw new Error(errMsg);
    }

    logRequest('解析地址', source, musicInfo, '成功');
    return apiData.url;

  } catch (err) {
    logRequest('解析地址', source, musicInfo, '失败', err.message);
    throw err;
  }
};

// ============================ 注册音乐平台 ============================
const musicSources = {};
MUSIC_SOURCE.forEach(sourceKey => {
  musicSources[sourceKey] = {
    name: {
      wy: '网易云音乐',
      tx: 'QQ音乐',
      kw: '酷我音乐',
      kg: '酷狗音乐',
      mg: '咪咕音乐'
    }[sourceKey],
    type: 'music',
    actions: ['musicUrl'],
    qualitys: MUSIC_QUALITY[sourceKey]
  };
});

/**
 * 注册事件监听器
 */
on(EVENT_NAMES.request, ({ action, source, info }) => {
  if (action !== 'musicUrl') {
    return Promise.reject(new Error(`不支持的操作类型：${action}`));
  }

  if (!info || !info.musicInfo || !info.type) {
    return Promise.reject(new Error('请求参数不完整'));
  }

  return handleGetMusicUrl(source, info.musicInfo, info.type)
    .then(url => Promise.resolve(url))
    .catch(err => Promise.reject(err));
});

// ============================ 初始化入口 ============================
log('星海音乐源初始化...');
log(`频率限制: ${RATE_LIMIT_CONFIG.maxRequests}次/${RATE_LIMIT_CONFIG.timeWindow/60000}分钟`);

send(EVENT_NAMES.inited, {
  status: true,
  openDevTools: false,
  sources: musicSources
});
log('星海音乐源初始化完成');

// 延迟检查更新
setTimeout(() => {
  checkAutoUpdate();
}, 2000);