/*!
 * @name KuwoDES
 * @version 1.0.0
 * @author ikun0014
 */

const MUSIC_QUALITY = {
  kw: ["128k", "320k", "flac", "flac24bit", "hires"],
};
const MUSIC_SOURCE = Object.keys(MUSIC_QUALITY);

const QUALITY_MAP = {
  "128k": "128kmp3",
  "320k": "320kmp3",
  flac: "2000kflac",
  flac24bit: "4000kflac",
  hires: "4000kflac",
};

const { EVENT_NAMES, request, on, send, env, version } = globalThis.lx;

const httpFetch = (url, options = { method: "GET" }) => {
  return new Promise((resolve, reject) => {
    console.log("--- start --- " + url);
    request(url, options, (err, resp) => {
      if (err) return reject(err);
      console.log("API Response: ", resp);
      resolve(resp);
    });
  });
};

const handleGetMusicUrl = async (source, musicInfo, quality) => {
  const songId = musicInfo.hash ?? musicInfo.songmid;
  const request = await httpFetch(
    `https://mobi.kuwo.cn/mobi.s?f=web&rid=${songId}&br=${QUALITY_MAP[quality]}&source=jiakong&type=convert_url_with_sign&surl=1`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": `${
          env ? `lx-music-${env}/${version}` : `lx-music-request/${version}`
        }`,
      },
      follow_max: 5,
    }
  );
  const { body } = request;
  if (!body || isNaN(Number(body.code))) throw new Error("unknow error");
  if (env != "mobile") console.groupEnd();
  switch (body.code) {
    case 200:
      console.log(
        `handleGetMusicUrl(${source}_${musicInfo.songmid}, ${quality}) success, URL: ${body.data.surl}`
      );
      return body.data.surl;
    default:
      console.log(
        `handleGetMusicUrl(${source}_${musicInfo.songmid}, ${quality}) failed`
      );
      throw new Error("未知错误");
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

on(EVENT_NAMES.request, ({ action, source, info }) => {
  switch (action) {
    case "musicUrl":
      if (env != "mobile") {
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

send(EVENT_NAMES.inited, {
  status: true,
  openDevTools: false,
  sources: musicSources,
});
