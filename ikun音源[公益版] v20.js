/*!
 * @name ikun音源[公益版]
 * @description QQ群970586864
 * @version v20
 * @author ikunshare
 */

const DEV_ENABLE = false
const UPDATE_ENABLE = true
const API_URL = "https://api.ikunshare.com"
const API_KEY = ""
const SCRIPT_MD5 = "78865ac42b045623787fdfaf24f6d363";
const MUSIC_QUALITY = JSON.parse('{"kw":["128k","320k","flac","flac24bit","hires"],"wy":["128k","320k","flac","flac24bit","hires","atmos","master"],"git":["128k","320k","flac"]}');

const MUSIC_SOURCE = Object.keys(MUSIC_QUALITY);
const {EVENT_NAMES, request, on, send, utils, env, version} = globalThis.lx;

let QQ_MUSIC_CDN_URL = "http://ws.stream.qqmusic.qq.com";

const httpFetch = (url, options = {method: "GET"}) => {
    return new Promise((resolve, reject) => {
        console.log("--- start --- " + url);
        request(url, options, (err, resp) => {
            console.log("API Request: ", options)
            if (err) return reject(err);
            console.log("API Response: ", resp);
            resolve(resp);
        });
    });
};

const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
const raceToSuccess = (promises) => {
    return new Promise((resolve, reject) => {
        let failureCount = 0;
        promises.forEach((p) => {
            p.then(resolve).catch(() => {
                failureCount++;
                if (failureCount === promises.length) reject(new Error("所有节点测速失败"));
            });
        });
    });
};
const handleGetCdnUrl = async () => {
    const request = await httpFetch(
        'https://u6.y.qq.com/cgi-bin/musicu.fcg?cgiKey=GetCdnDispatch',
        {
            method: 'POST',
            headers: {
                'User-Agent': 'QQMusic 20000008(android 12)',
                'Connection': 'Keep-Alive',
                'Content-Type': 'application/json'
            },
            body: {
                "comm": {"ct": "11", "cv": "20000008", "v": "20000008", "tmeAppID": "qqmusic"},
                "req": {
                    "module": "music.audioCdnDispatch.cdnDispatch",
                    "method": "GetCdnDispatch",
                    "param": {
                        "guid": "ffffffff9cab30420000019b8db3f7bf",
                        "uid": "0",
                        "use_new_domain": 1,
                        "use_ipv6": 1
                    }
                }
            }
        }
    );

    const {body} = request;

    const apiData = body["music.audioCdnDispatch.cdnDispatch.GetCdnDispatch"]?.data
        || body.req?.data
        || body.data;

    const defaultCdn = "http://ws.stream.qqmusic.qq.com/";

    if (!apiData || !apiData.sip || apiData.sip.length === 0) {
        return defaultCdn;
    }

    const allIpv6Nodes = apiData.sip.filter(url => url && url.includes('['));

    if (allIpv6Nodes.length === 0) {
        const httpsNodes = apiData.sip.filter(url => url.startsWith('https'));
        return httpsNodes.length > 0 ? getRandom(httpsNodes) : defaultCdn;
    }

    const checkCount = 3;
    const candidates = allIpv6Nodes.sort(() => Math.random() - 0.5).slice(0, checkCount);

    const pingNode = (url) => {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject('timeout'), 1500);

            httpFetch(url, {
                method: 'HEAD',
                follow_max: 0
            }).then(resp => {
                clearTimeout(timeout);
                if (resp.statusCode && resp.statusCode < 500) {
                    resolve(url);
                } else {
                    reject('connect error');
                }
            }).catch(err => {
                clearTimeout(timeout);
                reject(err);
            });
        });
    };

    try {
        return await raceToSuccess(candidates.map(url => pingNode(url)));
    } catch (e) {
        const httpsNodes = apiData.sip.filter(url => url.startsWith('https'));
        return httpsNodes.length > 0 ? getRandom(httpsNodes) : defaultCdn;
    }
};

const handleGetMusicUrl = async (source, musicInfo, quality) => {
    const songId = musicInfo.hash ?? musicInfo.songmid;
    const request = await httpFetch(
        `${API_URL}/url?source=${source}&songId=${songId}&quality=${quality}`,
        {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": `${
                    env ? `lx-music-${env}/${version}` : `lx-music-request/${version}`
                }`,
                "X-Request-Key": API_KEY,
            },
            follow_max: 5,
        }
    );
    const {body} = request;
    if (!body || isNaN(Number(body.code))) throw new Error("unknow error");
    if (env !== "mobile") console.groupEnd();
    switch (body.code) {
        case 200:
            console.log(
                `handleGetMusicUrl(${source}_${musicInfo.songmid}, ${quality}) success, URL: ${body.url}`
            );
            if (body.clientcdn) {
                return QQ_MUSIC_CDN_URL + body.url;
            }
            return body.url;
        case 403:
            console.log(
                `handleGetMusicUrl(${source}_${musicInfo.songmid}, ${quality}) failed: Key失效/鉴权失败`
            );
            throw new Error("Key失效/鉴权失败");
        case 500:
            console.log(
                `handleGetMusicUrl(${source}_${musicInfo.songmid}, ${quality}) failed, ${body.message}`
            );
            throw new Error(`获取URL失败, ${body.message ?? "未知错误"}`);
        case 429:
            console.log(
                `handleGetMusicUrl(${source}_${musicInfo.songmid}, ${quality}) failed, 请求过于频繁，请休息一下吧`
            );
            throw new Error("请求过速");
        default:
            console.log(
                `handleGetMusicUrl(${source}_${
                    musicInfo.songmid
                }, ${quality}) failed, ${body.message ? body.message : "未知错误"}`
            );
            throw new Error(body.message ?? "未知错误");
    }
};

const checkUpdate = async () => {
    const request = await httpFetch(
        `${API_URL}/script/lxmusic?key=${API_KEY}&checkUpdate=${SCRIPT_MD5}`,
        {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": `${
                    env ? `lx-music-${env}/${version}` : `lx-music-request/${version}`
                }`,
            },
        }
    );
    const {body} = request;

    if (!body || body.code !== 200) console.log("checkUpdate failed");
    else {
        console.log("checkUpdate success");
        if (body.data != null) {
            globalThis.lx.send(lx.EVENT_NAMES.updateAlert, {
                log: body.data.updateMsg,
                updateUrl: body.data.updateUrl,
            });
        }
    }
};

const musicSources = {};
MUSIC_SOURCE.forEach((item) => {
    musicSources[item] = {
        name: item,
        type: "music",
        actions: ["musicUrl"],
        qualitys: MUSIC_QUALITY[item],
    };
});

on(EVENT_NAMES.request, ({action, source, info}) => {
    switch (action) {
        case "musicUrl":
            if (env !== "mobile") {
                console.group(`Handle Action(musicUrl)`);
                console.log("source", source);
                console.log("quality", info.type);
                console.log("musicInfo", info.musicInfo);
            } else {
                console.log(`Handle Action(musicUrl)`);
                console.log("source", source);
                console.log("quality", info.type);
                console.log("musicInfo", info.musicInfo);
            }
            return handleGetMusicUrl(source, info.musicInfo, info.type)
                .then((data) => Promise.resolve(data))
                .catch((err) => Promise.reject(err));
        default:
            console.error(`action(${action}) not support`);
            return Promise.reject("action not support");
    }
});

if (UPDATE_ENABLE) checkUpdate();

handleGetCdnUrl().then(
    (value) => {
        QQ_MUSIC_CDN_URL = value
    }
)

send(EVENT_NAMES.inited, {
    status: true,
    openDevTools: DEV_ENABLE,
    sources: musicSources,
});
