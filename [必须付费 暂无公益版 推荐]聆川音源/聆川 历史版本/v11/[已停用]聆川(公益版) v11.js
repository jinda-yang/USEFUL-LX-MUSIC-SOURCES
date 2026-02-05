/*!
 * @name 聆川(公益版)
 * @description 澜音插件 支持所有平台最高320k
 * @version v11
 * @author guoyue2010
 * @homepage https://lc.guoyue2010.top
 */

// 插件信息
const pluginInfo = {
  name: "聆川(公益版)",
  version: "v11",
  author: "guoyue2010",
  description: "澜音插件 支持所有平台最高320k",
  updateMd5: "60d7cfa2c879fe8b1c1005aa757b1c4e",
  apiKey: "",
  type:'cr'
};

// 支持的音源配置
const sources = {
  kw: {
    name: "酷我音乐",
    qualitys: ["128k","320k"]
  },
  mg: {
    name: "咪咕音乐", 
    qualitys: ["128k","320k"]
  },
  kg: {
    name: "酷狗音乐",
    qualitys: ["128k","320k"]
  },
  tx: {
    name: "QQ音乐",
    qualitys: ["128k","320k"]
  },
  wy: {
    name: "网易云音乐",
    qualitys: ["128k","320k"]
  }
};
// api 地址
const apiUrl = "https://lc.guoyue2010.top";
// 获取工具函数
const {request, NoticeCenter} = cerumusic;

// 插件名格式化 修饰
function pluginName(source){
  return `[${pluginInfo.name} <${sources[source].name}>]`;
}

// 获取音乐链接的主要方法
async function musicUrl(source, musicInfo, quality) {
  console.log("收到解析请求", '-------------不优雅的分割线-------------');
  try {
    // 检查source是否有效
    if (!sources[source]) {
      throw new Error(`无效的音源: ${source}`);
    }

    // 检查quality是否有效
    if (!sources[source].qualitys.includes(quality)) {
      throw new Error(`无效的音质: ${quality}，支持的音质: ${sources[source].qualitys.join(', ')}`);
    }
    
    const songId = musicInfo.hash ?? musicInfo.songmid ?? musicInfo.id;

    if (!songId) {
      throw new Error('音乐ID不存在');
    }
    console.log(`${pluginName(source)} 请求音乐链接: 歌曲ID: ${songId}, 音质: ${quality}`);
    // 使用 cerumusic API 发送 HTTP 请求
    const result = await request(`${apiUrl}/music/url?source=${source}&songId=${songId}&quality=${quality}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': pluginInfo.apiKey,
        'User-Agent': `CeruMusic-Plugin/${pluginInfo.version}`
      },
      timeout: 15000
    });
    console.info(`${pluginName(source)} 请求响应数据:`, result.body);
    console.log(`${pluginName(source)} 请求结束，响应状态码: ${result.statusCode}`);
    if (result.statusCode === 200 && result.body && result.body.code === 200) {
      if (result.body.url) {
        console.log(`${pluginName(source)} 获取音乐链接成功: ${songId}, 音质: ${quality}, 链接: ${result.body.url}`);
        return result.body.url;
      } else {
        throw new Error('返回数据中没有音乐链接');
      }
    } else if (result.body && result.body.code) {
      switch (result.body.code) {
        case 403:
          // 发送错误通知
          NoticeCenter('error', {
            title: '音乐链接获取失败',
            content: `来源: ${pluginName(source)}, 错误: API Key失效或鉴权失败`
          });
          throw new Error('API Key失效或鉴权失败');
        case 429:
          NoticeCenter('error', {
            title: '音乐链接获取失败',
            content: `来源: ${pluginName(source)}, 错误: 请求过于频繁，请稍后再试`
          });
          throw new Error('请求过于频繁，请稍后再试');
        case 500:
          throw new Error(`服务器错误: ${result.body.message || '未知错误'}`);
        default:
          cerumusic.NoticeCenter('error', {
            title: '音乐链接获取失败',
            content: `来源: ${pluginName(source)}, 错误: API错误 ${result.body.message || '未知错误'}`
          });
          throw new Error(`API错误: ${result.body.message || '未知错误'}`);
      }
    } else {
      throw new Error(`HTTP请求失败: ${result.statusCode}`);
    }
  } catch (error) {
    console.error(`${pluginName(source)} 获取音乐链接失败:`, error.message);
    throw new Error(error.message??error);
  }
}


const checkUpdate = async () => {
  try {
    const {body} = await request(
      `${apiUrl}/script?checkUpdate=${pluginInfo.updateMd5}&key=${pluginInfo.apiKey}&type=${pluginInfo.type}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": `CeruMusic-Plugin/${pluginInfo.version}`
        },
      }
    );
    console.log('版本更新检测响应:', body);
    if (!body || body.code !== 200){
      console.error('版本更新检测失败:', body.message || '未知错误');
    } else {
      if (body.data != null) {
        NoticeCenter('update', {
          title: `${pluginInfo.name} 有新的版本 ${body.data.version}`,
          content: body.data.updateMsg,
          url: `${body.data.updateUrl}`, // 可选 当通知为update 版本跟新可传
          version: body.data.version, // 当通知为update 版本跟新可传
          pluginInfo: {
            name: pluginInfo.name,
            type: 'cr' // 固定唯一标识
          } // 当通知为update 版本跟新可传
        })
      } else{
        console.log(`${pluginInfo.name} 没有新的版本`);
      }
    }
  } catch (error) {
    console.error("checkUpdate error:", error);
  }
};
checkUpdate().then(() => {
  console.log("版本更新检测完成");
});

// 导出插件
module.exports = {
  pluginInfo,
  sources,
  musicUrl
};