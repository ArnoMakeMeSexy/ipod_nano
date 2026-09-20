const STORAGE_KEY = 'ipod-nano-library-v1';
let songs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let currentIndex = 0;
let currentView = 'menu';
let player = null;
let playerReady = false;
let wheelStartAngle = null;
let wheelLastAngle = null;

const $ = id => document.getElementById(id);
const wheel = $('click-wheel');

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
  renderLibrary();
  renderScreen();
}

function getVideoId(url) {
  const match = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  return match ? match[1] : null;
}

function artwork(id) { return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`; }

function identify(title) {
  const value = String(title || '').replace(/\.(mp3|m4a|wav)$/i, '').replace(/[|]/g, '—').trim();
  const parts = value.split(/\s+[—–-]\s+|\s+by\s+/i);
  return parts.length > 1
    ? { title: parts[0].trim(), artist: parts.slice(1).join(' — ').trim() }
    : { title: value || '未命名歌曲', artist: 'YouTube 音樂' };
}

function addSong(id, name = '') {
  if (!id || songs.some(song => song.id === id)) return false;
  const meta = identify(name || `YouTube 影片 ${id}`);
  songs.push({ id, title: meta.title, artist: meta.artist, art: artwork(id) });
  return true;
}

function renderLibrary() {
  $('song-count').textContent = `${songs.length} 首歌曲`;
  $('clear-library').disabled = songs.length === 0;
  $('library-list').innerHTML = songs.length ? songs.map((song, index) => `
    <article class="library-song">
      <img src="${song.art}" alt="">
      <div class="library-song-info"><strong>${escapeHTML(song.title)}</strong><span>${escapeHTML(song.artist)}</span></div>
      <div class="song-actions"><button data-play="${index}" aria-label="播放">▶</button><button data-delete="${index}" aria-label="刪除">×</button></div>
    </article>`).join('') : '<p class="nano-empty">你的音樂庫還是空的，br>請從右側加入歌曲。</p>';
  document.querySelectorAll('[data-play]').forEach(button => button.onclick = () => play(Number(button.dataset.play)));
  document.querySelectorAll('[data-delete]').forEach(button => button.onclick = () => {
    songs.splice(Number(button.dataset.delete), 1);
    currentIndex = Math.min(currentIndex, Math.max(0, songs.length - 1));
    save();
  });
}

function renderScreen() {
  $('screen-title').textContent = currentView === 'now' ? 'Now Playing' : 'Music';
  if (currentView === 'now' && songs.length) {
    const song = songs[currentIndex];
    $('screen-body').innerHTML = `<img class="album-art" src="${song.art}" alt=""><div class="now-title">${escapeHTML(song.title)}</div><div class="now-artist">${escapeHTML(song.artist)}</div><div class="progress"><i></i></div>`;
  } else if (songs.length) {
    $('screen-body').innerHTML = `<ul class="nano-menu">${songs.map((song, index) => `<li class="${index === currentIndex ? 'active' : ''}" data-screen-play="${index}">${escapeHTML(song.title)}<small>${escapeHTML(song.artist)}</small></li>`).join('')}</ul>`;
  } else {
    $('screen-body').innerHTML = '<div class="nano-empty">Music<br><small>請從右側加入歌曲</small></div>';
  }
  document.querySelectorAll('[data-screen-play]').forEach(item => item.onclick = () => play(Number(item.dataset.screenPlay)));
  const song = songs[currentIndex];
  $('mini-player').hidden = !song;
  if (song) { $('mini-art').src = song.art; $('mini-title').textContent = song.title; $('mini-artist').textContent = song.artist; }
}

function play(index = currentIndex) {
  if (!songs.length) return;
  currentIndex = index;
  currentView = 'now';
  renderScreen();
  if (playerReady && player) { player.loadVideoById(songs[index].id); player.playVideo(); }
}
function togglePlay() {
  if (!songs.length) return;
  if (currentView !== 'now') return play(currentIndex);
  const state = player && player.getPlayerState ? player.getPlayerState() : -1;
  if (state === 1) player.pauseVideo(); else if (playerReady) player.playVideo(); else play(currentIndex);
}
function next() { if (songs.length) play((currentIndex + 1) % songs.length); }
function previous() { if (songs.length) play((currentIndex - 1 + songs.length) % songs.length); }

function wheelAction(action) {
  if (action === 'menu') { currentView = 'menu'; renderScreen(); }
  if (action === 'select' || action === 'toggle') togglePlay();
  if (action === 'next') next();
  if (action === 'prev') previous();
}

function wheelAngle(event) {
  const rect = wheel.getBoundingClientRect();
  return Math.atan2(event.clientY - (rect.top + rect.height / 2), event.clientX - (rect.left + rect.width / 2));
}

// 支援 iPhone 滑動轉盤：每跨過約 35 度就切換上一首/下一首。
wheel.addEventListener('pointerdown', event => {
  if (event.target.closest('button')) return;
  wheel.setPointerCapture(event.pointerId);
  wheelStartAngle = wheelLastAngle = wheelAngle(event);
  wheel.classList.add('is-touching');
});
wheel.addEventListener('pointermove', event => {
  if (wheelLastAngle === null) return;
  const angle = wheelAngle(event);
  let delta = angle - wheelLastAngle;
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  if (delta > 0.6) { next(); wheelLastAngle = angle; }
  if (delta < -0.6) { previous(); wheelLastAngle = angle; }
});
['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => wheel.addEventListener(type, () => { wheelLastAngle = wheelStartAngle = null; wheel.classList.remove('is-touching'); }));
wheel.addEventListener('click', event => { const action = event.target.closest('[data-action]')?.dataset.action; if (action) wheelAction(action); });
$('mini-play').onclick = togglePlay;

window.onYouTubeIframeAPIReady = () => {
  player = new YT.Player('youtube-player', { height: '1', width: '1', videoId: songs[0]?.id || '', playerVars: { playsinline: 1 }, events: {
    onReady: () => { playerReady = true; },
    onStateChange: event => { if (event.data === 0) next(); }
  }});
};

$('add-song').onclick = () => { $('song-dialog').showModal(); $('song-url').focus(); };
$('import-playlist').onclick = () => { $('playlist-dialog').showModal(); $('playlist-input').focus(); };
$('theme-toggle').onclick = () => document.body.classList.toggle('dark');
$('clear-library').onclick = () => { if (confirm('確定要清除所有歌曲嗎？')) { songs = []; save(); } };

$('song-dialog').querySelector('form').addEventListener('submit', event => {
  event.preventDefault();
  const id = getVideoId($('song-url').value);
  if (!id) { $('song-message').textContent = '找不到有效的 YouTube 影片網址。'; return; }
  if (!addSong(id, $('song-name').value)) { $('song-message').textContent = '這首歌已經在音樂庫裡了。'; return; }
  save(); event.target.reset(); event.target.closest('dialog').close();
});

$('playlist-dialog').querySelector('form').addEventListener('submit', event => {
  event.preventDefault();
  const ids = [...$('playlist-input').value.matchAll(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/g)].map(match => match[1]);
  const uniqueIds = [...new Set(ids)];
  if (!uniqueIds.length) { $('playlist-message').textContent = '請貼上多個 YouTube 影片網址，每行一個。'; return; }
  uniqueIds.forEach(id => addSong(id));
  save(); $('playlist-message').textContent = `成功匯入 ${uniqueIds.length} 首歌曲。`;
  setTimeout(() => event.target.closest('dialog').close(), 700);
});

renderLibrary();
renderScreen();
