/* iPod nano Web App controller
 * Compatible with the current index.html IDs and supports the touch click-wheel.
 */
const STORAGE_KEY = 'ipodSongs';
let songs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let currentIndex = Number(localStorage.getItem('ipodCurrentIndex') || 0);
let shuffle = localStorage.getItem('ipodShuffle') === 'true';
let repeat = localStorage.getItem('ipodRepeat') === 'true';
let player = null;
let playerReady = false;
let currentView = 'menu';
let wheelLastAngle = null;

const $ = id => document.getElementById(id);
const wheel = $('click-wheel');

// 相容舊版資料格式：id/videoId、art 欄位都可讀取。
songs = songs.map(song => ({
  id: song.id || song.videoId,
  videoId: song.videoId || song.id,
  title: song.title || 'YouTube Song',
  artist: song.artist || 'YouTube 音樂',
  art: song.art || `https://i.ytimg.com/vi/${song.videoId || song.id}/hqdefault.jpg`
})).filter(song => song.videoId);

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
  localStorage.setItem('ipodCurrentIndex', String(currentIndex));
  localStorage.setItem('ipodShuffle', String(shuffle));
  localStorage.setItem('ipodRepeat', String(repeat));
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
}

function getYouTubeId(url) {
  const match = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  return match ? match[1] : null;
}

function identify(title) {
  const parts = String(title || '').replace(/[|]/g, '—').split(/\s+[—–-]\s+|\s+by\s+/i);
  return parts.length > 1
    ? { title: parts[0].trim(), artist: parts.slice(1).join(' — ').trim() }
    : { title: title || 'YouTube Song', artist: 'YouTube 音樂' };
}

function addSong(videoId, name) {
  if (!videoId || songs.some(song => song.videoId === videoId)) return false;
  const meta = identify(name || `YouTube 影片 ${videoId}`);
  songs.push({ id: videoId, videoId, title: meta.title, artist: meta.artist, art: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` });
  return true;
}

function setPage(view) {
  currentView = view;
  renderScreen();
}

function renderPlaylist() {
  const list = $('screen-body');
  if (!songs.length) {
    list.innerHTML = '<div class="nano-empty">播放清單目前沒有歌曲<br><small>請從右側加入歌曲</small></div>';
    return;
  }
  list.innerHTML = `<ul class="nano-menu">${songs.map((song, index) => `
    <li class="${index === currentIndex ? 'active' : ''}" data-screen-play="${index}">
      ${escapeHTML(song.title)}<small>${escapeHTML(song.artist)}</small>
    </li>`).join('')}</ul>`;
  document.querySelectorAll('[data-screen-play]').forEach(item => {
    item.addEventListener('click', () => playSong(Number(item.dataset.screenPlay)));
  });
}

function renderScreen() {
  $('screen-title').textContent = currentView === 'nowPlaying' ? 'Now Playing' : 'Music';
  if (currentView === 'nowPlaying' && songs.length) {
    const song = songs[currentIndex];
    $('screen-body').innerHTML = `<img class="album-art" src="${song.art}" alt=""><div class="now-title">${escapeHTML(song.title)}</div><div class="now-artist">${escapeHTML(song.artist)}</div><div class="progress"><i id="progress-bar"></i></div>`;
  } else {
    renderPlaylist();
  }
  const song = songs[currentIndex];
  $('mini-player').hidden = !song;
  if (song) {
    $('mini-art').src = song.art;
    $('mini-title').textContent = song.title;
    $('mini-artist').textContent = song.artist;
  }
  $('song-count').textContent = `${songs.length} 首歌曲`;
  $('clear-library').disabled = songs.length === 0;
}

function playSong(index = currentIndex) {
  if (!songs.length) return;
  currentIndex = Math.max(0, Math.min(index, songs.length - 1));
  setPage('nowPlaying');
  saveData();
  if (playerReady && player) {
    player.loadVideoById(songs[currentIndex].videoId);
    player.playVideo();
  }
}

function togglePlay() {
  if (!songs.length) return;
  if (currentView !== 'nowPlaying') return playSong(currentIndex);
  if (!playerReady || !player) return playSong(currentIndex);
  if (player.getPlayerState() === YT.PlayerState.PLAYING) player.pauseVideo();
  else player.playVideo();
}

function nextSong() {
  if (!songs.length) return;
  if (shuffle && songs.length > 1) {
    let next;
    do next = Math.floor(Math.random() * songs.length); while (next === currentIndex);
    currentIndex = next;
  } else {
    currentIndex += 1;
    if (currentIndex >= songs.length) {
      if (!repeat) { currentIndex = 0; saveData(); return; }
      currentIndex = 0;
    }
  }
  playSong(currentIndex);
}

function previousSong() {
  if (songs.length) playSong((currentIndex - 1 + songs.length) % songs.length);
}

function wheelAngle(event) {
  const rect = wheel.getBoundingClientRect();
  return Math.atan2(event.clientY - (rect.top + rect.height / 2), event.clientX - (rect.left + rect.width / 2));
}

// 轉盤旋轉：每跨過約 35 度切換一首歌；pointer 事件同時支援 iPhone、iPad、滑鼠。
wheel.addEventListener('pointerdown', event => {
  if (event.target.closest('button')) return;
  wheel.setPointerCapture(event.pointerId);
  wheelLastAngle = wheelAngle(event);
  wheel.classList.add('is-touching');
});
wheel.addEventListener('pointermove', event => {
  if (wheelLastAngle === null) return;
  event.preventDefault();
  const angle = wheelAngle(event);
  let delta = angle - wheelLastAngle;
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  if (delta > 0.6) { nextSong(); wheelLastAngle = angle; }
  if (delta < -0.6) { previousSong(); wheelLastAngle = angle; }
});
['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => wheel.addEventListener(type, () => {
  wheelLastAngle = null;
  wheel.classList.remove('is-touching');
}));

wheel.addEventListener('click', event => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'menu') setPage('menu');
  if (action === 'prev') previousSong();
  if (action === 'next') nextSong();
  if (action === 'toggle' || action === 'select') togglePlay();
});
$('mini-play').addEventListener('click', togglePlay);

// index.html 已載入 YouTube API；這裡只接收 API 回呼，不重複插入 script。
window.onYouTubeIframeAPIReady = () => {
  player = new YT.Player('youtube-player', {
    height: '1', width: '1', videoId: songs[0]?.videoId || '',
    playerVars: { playsinline: 1, controls: 1, rel: 0 },
    events: {
      onReady: () => { playerReady = true; },
      onStateChange: event => { if (event.data === YT.PlayerState.ENDED) nextSong(); }
    }
  });
};

$('add-song').addEventListener('click', () => { $('song-dialog').showModal(); $('song-url').focus(); });
$('import-playlist').addEventListener('click', () => { $('playlist-dialog').showModal(); $('playlist-input').focus(); });
$('theme-toggle').addEventListener('click', () => document.body.classList.toggle('dark'));
$('clear-library').addEventListener('click', () => { if (confirm('確定要清除所有歌曲嗎？')) { songs = []; currentIndex = 0; saveData(); renderScreen(); } });

$('song-dialog').querySelector('form').addEventListener('submit', event => {
  event.preventDefault();
  const id = getYouTubeId($('song-url').value);
  if (!id) { $('song-message').textContent = '找不到有效的 YouTube 影片網址。'; return; }
  if (!addSong(id, $('song-name').value.trim())) { $('song-message').textContent = '這首歌已經在音樂庫裡了。'; return; }
  saveData(); renderScreen(); event.target.reset(); event.target.closest('dialog').close();
});

$('playlist-dialog').querySelector('form').addEventListener('submit', event => {
  event.preventDefault();
  const ids = [...$('playlist-input').value.matchAll(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/g)].map(match => match[1]);
  const uniqueIds = [...new Set(ids)];
  if (!uniqueIds.length) { $('playlist-message').textContent = '請貼上多個 YouTube 影片網址，每行一個。'; return; }
  uniqueIds.forEach(id => addSong(id));
  saveData(); renderScreen(); $('playlist-message').textContent = `成功匯入 ${uniqueIds.length} 首歌曲。`;
  setTimeout(() => event.target.closest('dialog').close(), 700);
});

renderScreen();
