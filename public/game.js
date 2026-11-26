const socket = io();
let currentRoomCode = null;
let myPlayerId = localStorage.getItem('tukstantis_pid');
if (!myPlayerId) {
    myPlayerId = 'pid_' + Math.random().toString(36).substring(2, 12) + '_' + Date.now();
    localStorage.setItem('tukstantis_pid', myPlayerId);
}

let lastState = null;
let choosingNineToHide = false;
let selectedAvatar = '👨';

// --- GARSŲ SISTEMA (Web Audio API) ---
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function playSound(type) {
if (localStorage.getItem('tuk_mute') === '1') return;
    try {
        if (!audioCtx) audioCtx = new AudioCtx();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        const now = audioCtx.currentTime;

        if (type === 'card') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(320, now);
            osc.frequency.exponentialRampToValueAtTime(90, now + 0.08);
            gain.gain.setValueAtTime(0.18, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
            osc.start(now);
            osc.stop(now + 0.08);
        } else if (type === 'bid') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(520, now);
            osc.frequency.exponentialRampToValueAtTime(780, now + 0.12);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
            osc.start(now);
            osc.stop(now + 0.12);
        } else if (type === 'marriage') {
            [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
                const o = audioCtx.createOscillator();
                const g = audioCtx.createGain();
                o.connect(g);
                g.connect(audioCtx.destination);
                o.type = 'triangle';
                o.frequency.setValueAtTime(freq, now + i * 0.07);
                g.gain.setValueAtTime(0.15, now + i * 0.07);
                g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.07 + 0.35);
                o.start(now + i * 0.07);
                o.stop(now + i * 0.07 + 0.35);
            });
        } else if (type === 'burn') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(180, now);
            osc.frequency.linearRampToValueAtTime(65, now + 0.45);
            gain.gain.setValueAtTime(0.22, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
            osc.start(now);
            osc.stop(now + 0.45);
        } else if (type === 'win') {
            [440, 554.37, 659.25, 880].forEach((freq, i) => {
                const o = audioCtx.createOscillator();
                const g = audioCtx.createGain();
                o.connect(g);
                g.connect(audioCtx.destination);
                o.type = 'sine';
                o.frequency.setValueAtTime(freq, now + i * 0.1);
                g.gain.setValueAtTime(0.16, now + i * 0.1);
                g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.4);
                o.start(now + i * 0.1);
                o.stop(now + i * 0.1 + 0.4);
            });
        } else if (type === 'chat') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, now);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.09);
            osc.start(now);
            osc.stop(now + 0.09);
        }
    } catch (e) {}
}

// --- VIZUALINIAI EFEKTAI ---
const extraStyles = document.createElement('style');
extraStyles.innerHTML = '@keyframes burnFlash { 0%, 100% { box-shadow: inset 0 0 0 rgba(239,68,68,0); } 40% { box-shadow: inset 0 0 90px rgba(239,68,68,0.85); } } body.burn-effect { animation: burnFlash 1.2s ease-out; } .player-box.on-barrel, .player-seat.on-barrel { border-color: #ef4444 !important; box-shadow: 0 0 20px rgba(239,68,68,0.8) !important; } .poker-table.blind-aura { box-shadow: inset 0 0 80px rgba(168,85,247,0.65), 0 20px 50px rgba(0,0,0,0.9), 0 0 0 3px #a855f7 !important; } .poker-table.marriage-aura { box-shadow: inset 0 0 90px rgba(251,191,36,0.75), 0 20px 50px rgba(0,0,0,0.9), 0 0 0 4px #fbbf24 !important; } @keyframes confettiDrop { 0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; } 100% { transform: translateY(105vh) rotate(720deg); opacity: 0; } } .confetti-piece { position: fixed; top: 0; width: 10px; height: 14px; z-index: 9999; pointer-events: none; animation: confettiDrop 3s linear forwards; }';
document.head.appendChild(extraStyles);

function triggerBurnAnimation() {
    document.body.classList.remove('burn-effect');
    void document.body.offsetWidth;
    document.body.classList.add('burn-effect');
    setTimeout(() => document.body.classList.remove('burn-effect'), 1200);
    try { if (navigator.vibrate) navigator.vibrate(); } catch (e) {}
}

function triggerConfetti() {
    const colors = ['#fbbf24', '#10b981', '#3b82f6', '#ef4444', '#a855f7'];
    for (let i = 0; i < 65; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';
        piece.style.left = Math.random() * 100 + 'vw';
        piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        piece.style.animationDuration = (Math.random() * 2 + 2) + 's';
        piece.style.animationDelay = (Math.random() * 0.5) + 's';
        document.body.appendChild(piece);
        setTimeout(() => piece.remove(), 4500);
    }
}

function getSuitPointsLabel(suit) {
    if (suit === '♣') return '100 tšk.';
    if (suit === '♠') return '80 tšk.';
    if (suit === '♥') return '60 tšk.';
    if (suit === '♦') return '40 tšk.';
    return '';
}

function saveSession(roomCode, playerName, avatar) {
    localStorage.setItem('tukstantis_session', JSON.stringify({ roomCode, playerName, avatar }));
}

function clearSession() {
    localStorage.removeItem('tukstantis_session');
}

// --- PRISIJUNGIMAS IR AVATARAI ---
const maleBtn = document.getElementById('lobbyMale');
const femaleBtn = document.getElementById('lobbyFemale');
if (maleBtn && femaleBtn) {
    maleBtn.addEventListener('click', () => {
        selectedAvatar = '👨';
        maleBtn.classList.add('active-avatar');
        femaleBtn.classList.remove('active-avatar');
    });
    femaleBtn.addEventListener('click', () => {
        selectedAvatar = '👩';
        femaleBtn.classList.add('active-avatar');
        maleBtn.classList.remove('active-avatar');
    });
}

document.getElementById('createRoomBtn').addEventListener('click', () => {
    const name = document.getElementById('playerNameInput').value.trim() || 'Žaidėjas';
    socket.emit('createRoom', { playerName: name, avatar: selectedAvatar, playerToken: myPlayerId });
});

document.getElementById('joinRoomBtn').addEventListener('click', () => {
    const name = document.getElementById('playerNameInput').value.trim() || 'Žaidėjas';
    const code = document.getElementById('roomCodeInput').value.trim().toUpperCase();
    if (!code) {
        alert('Įvesk kambario kodą!');
        return;
    }
    socket.emit('joinRoom', { roomCode: code, playerName: name, avatar: selectedAvatar, playerToken: myPlayerId });
});

socket.on('errorMsg', (msg) => {
    alert(msg);
    if (msg.includes('nerastas')) clearSession();
});

socket.on('connect', () => {
    const saved = localStorage.getItem('tukstantis_session');
    if (saved) {
        try {
            const { roomCode } = JSON.parse(saved);
            if (roomCode) {
                socket.emit('rejoinRoom', { roomCode, playerToken: myPlayerId });
            }
        } catch (e) {}
    }
});

// --- POKALBIŲ LANGAS ---
function sendChatMessage(textToSend) {
    if (!currentRoomCode) return;
    const input = document.getElementById('chatInput');
    const msg = textToSend || input.value.trim();
    if (!msg) return;
    socket.emit('sendChat', { roomCode: currentRoomCode, message: msg });
    if (!textToSend) input.value = '';
}

document.getElementById('chatSendBtn').addEventListener('click', () => sendChatMessage());
document.getElementById('chatInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatMessage();
});
document.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.addEventListener('click', () => sendChatMessage(btn.getAttribute('data-emoji')));
});

socket.on('chatMessage', ({ sender, avatar, text }) => {
    playSound('chat');
    const box = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = '<div class="chat-sender">' + avatar + ' ' + sender + ':</div><div>' + text + '</div>';
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
});

// --- SAUSO SUTRIUŠKINIMO EFEKTAS ---
const sweepStyle = document.createElement('style');
sweepStyle.innerHTML = '@keyframes sweepBannerPop { 0% { transform: translate(-50%, -50%) scale(0.3) rotate(-8deg); opacity: 0; } 20% { transform: translate(-50%, -50%) scale(1.12) rotate(2deg); opacity: 1; } 80% { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 1; } 100% { transform: translate(-50%, -50%) scale(1.25); opacity: 0; } } .sweep-banner { position: fixed; top: 42%; left: 50%; transform: translate(-50%, -50%); background: linear-gradient(135deg, #7f1d1d 0%, #dc2626 45%, #fbbf24 100%); color: #fff; padding: 18px 28px; border-radius: 16px; border: 3px solid #fef08a; box-shadow: 0 0 40px rgba(251, 191, 36, 0.9), 0 15px 35px rgba(0, 0, 0, 0.85); z-index: 9999; text-align: center; pointer-events: none; animation: sweepBannerPop 3.6s cubic-bezier(0.22, 1, 0.36, 1) forwards; }';
document.head.appendChild(sweepStyle);

function triggerCleanSweepAnimation(winnerName) {
    const old = document.querySelector('.sweep-banner');
    if (old) old.remove();
    const banner = document.createElement('div');
banner.className = 'sweep-banner';
banner.innerHTML = '⚔️ SAUSAS SUTRIUŠKINIMAS! ⚔️' +
'' + winnerName + ' sutriuškino priešininkus (7:0 kirčių)!';
document.body.appendChild(banner);
setTimeout(() => banner.remove(), 3700);
triggerConfetti();
playSound('win');
}
// --- PAGRINDINĖ BŪSENOS ATVAIZDAVIMO FUNKCIJA ---
socket.on('gameState', (state) => {
if (state.roomCode) {
currentRoomCode = state.roomCode;
const name = document.getElementById('playerNameInput').value.trim() || 'Žaidėjas';
saveSession(state.roomCode, name, selectedAvatar);
document.getElementById('lobbyScreen').style.display = 'none';
document.getElementById('gameScreen').style.display = 'flex';
document.getElementById('displayRoomCode').innerText = state.roomCode;
}
const prevPhase = lastState ? lastState.phase : null;
const prevTrickCount = lastState ? lastState.trickCards.length : 0;
if (state.trickCards.length > prevTrickCount) playSound('card');
if (state.statusText && (!lastState || lastState.statusText !== state.statusText)) {
if (state.statusText.includes('PORĄ')) playSound('marriage');
if (state.statusText.includes('SAUSAS SUTRIUŠKINIMAS')) {
const parts = state.statusText.split('SAUSAS SUTRIUŠKINIMAS! ');
const wName = parts ? parts.split(' sudorojo') : 'Žaidėjas';
triggerCleanSweepAnimation(wName);
}
if (state.statusText.includes('SUDEGĖ') && prevPhase !== 'ROUND_OVER' && prevPhase !== 'GAME_OVER') {
playSound('burn');
triggerBurnAnimation();
}
if (state.phase === 'GAME_OVER' && prevPhase !== 'GAME_OVER') {
playSound('win');
triggerConfetti();
}
}
document.getElementById('statusText').innerText = state.statusText;
const trumpBadge = document.getElementById('trumpBadge');
if (state.trumpSuit) {
trumpBadge.style.display = 'inline-block';
trumpBadge.innerText = 'Koziris: ' + state.trumpSuit;
} else {
trumpBadge.style.display = 'none';
}
const myIdx = state.mySeatIndex;
const leftIdx = (myIdx + 1) % 3;
const rightIdx = (myIdx + 2) % 3;
const me = state.seats[myIdx];
const left = state.seats[leftIdx];
const right = state.seats[rightIdx];
    const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    const goal = state.targetScore || 1000;
    const barrel = goal - 100;
    // Kairys priešininkas
    setTxt('leftAvatar', left.avatar);
    setTxt('leftName', left.name + (left.totalScore >= barrel ? ' 🛢️' : ''));
    setTxt('leftTotal', left.totalScore);
    setTxt('leftRound', left.roundScore);
    setTxt('leftCount', left.cardCount !== undefined ? left.cardCount : left.handCount);
    setTxt('leftBid', left.bidStatus);

    // Dešinys priešininkas
    setTxt('rightAvatar', right.avatar);
    setTxt('rightName', right.name + (right.totalScore >= barrel ? ' 🛢️' : ''));
    setTxt('rightTotal', right.totalScore);
    setTxt('rightRound', right.roundScore);
    setTxt('rightCount', right.cardCount !== undefined ? right.cardCount : right.handCount);
    setTxt('rightBid', right.bidStatus);
// Mano duomenys
document.getElementById('meAvatar').innerText = me.avatar;
const blindTag = me.isBlind ? ' 🙈 [Aklai x2]' : '';
const barrelTag = me.totalScore >= 900 ? ' 🛢️' : '';
document.getElementById('meHeader').innerText = me.name + blindTag + barrelTag + ' | Bendri: ' + me.totalScore + ' / 1000 | Partijoje: ' + me.roundScore;
// Aktyvaus ėjimo ir statinės paryškinimas
const isPlayPhase = (state.phase !== 'LOBBY' && state.phase !== 'ROUND_OVER' && state.phase !== 'GAME_OVER');
const leftBox = document.getElementById('box-left');
const rightBox = document.getElementById('box-right');
const meBox = document.getElementById('box-me');
leftBox.classList.toggle('active-turn', state.currentTurnIndex === leftIdx && isPlayPhase);
rightBox.classList.toggle('active-turn', state.currentTurnIndex === rightIdx && isPlayPhase);
meBox.classList.toggle('active-turn', state.currentTurnIndex === myIdx && isPlayPhase);
leftBox.classList.toggle('on-barrel', left.totalScore >= 900);
rightBox.classList.toggle('on-barrel', right.totalScore >= 900);
meBox.classList.toggle('on-barrel', me.totalScore >= 900);
// 4D Stalo auros ir Krupjė
const table = document.querySelector('.poker-table');
if (table) {
const anyoneBlind = state.seats.some(s => s.isBlind) && state.phase !== 'LOBBY' && state.phase !== 'ROUND_OVER';
table.classList.toggle('blind-aura', anyoneBlind);
if (state.statusText && state.statusText.includes('PORĄ')) {
table.classList.add('marriage-aura');
setTimeout(() => table.classList.remove('marriage-aura'), 2200);
}
}
const dealerEmoji = document.querySelector('.dealer-seat span');
const dealerSub = document.querySelector('.dealer-seat div span');
if (dealerEmoji && dealerSub && state.statusText) {
if (state.statusText.includes('SUDEGĖ')) { dealerEmoji.innerText = '😱'; dealerSub.innerText = 'Oho, sudegė!'; }
else if (state.statusText.includes('PORĄ')) { dealerEmoji.innerText = '🥳'; dealerSub.innerText = 'Karališka pora!'; }
else if (state.statusText.includes('AKLAI') || state.statusText.includes('Aklai') || state.seats.some(s => s.isBlind)) { dealerEmoji.innerText = '🙈'; dealerSub.innerText = 'Drąsus ėjimas!'; }
else if (state.phase === 'GAME_OVER') { dealerEmoji.innerText = '🏆'; dealerSub.innerText = 'Sveikinimai!'; }
else { dealerEmoji.innerText = '🤵'; dealerSub.innerText = 'Prižiūri stalą'; }
}
if (state.phase === 'BIDDING' || state.phase === 'LOBBY') {
document.body.classList.remove('burn-effect');
}
renderControls(state);
renderTableCenter(state);
renderMyCards(state);
renderDiscarded(state);
lastState = state;
});
function renderControls(state) {
const area = document.getElementById('controlsArea');
area.innerHTML = '';
if (state.phase === 'NINE_GUESS' && state.nineGuess) {
choosingNineToHide = false;
if (state.nineGuess.giverIndex === state.mySeatIndex) {
const info = document.createElement('div');
info.style.cssText = 'color:#fde68a; font-weight:bold; padding:8px;';
info.innerText = '🔮 Laukiame, kol kiti žaidėjai atspės tavo paslėptą devynakę...';
area.appendChild(info);
} else if (state.nineGuess.hasGuessed) {
const info = document.createElement('div');
info.style.cssText = 'color:#10b981; font-weight:bold; padding:8px;';
info.innerText = '✅ Tavo spėjimas užfiksuotas! Laukiame kito žaidėjo...';
area.appendChild(info);
} else {
(state.nineGuess.availableSuits || ['♣', '♠', '♥', '♦']).forEach(s => {
addButton('Spėju: 9' + s + ' (' + getSuitPointsLabel(s) + ')', '', () => {
playSound('bid');
socket.emit('submitNineGuess', { roomCode: currentRoomCode, suit: s });
});
});
}
return;
}
const isMyTurn = (state.currentTurnIndex === state.mySeatIndex);
const amIHighestBidder = (state.highestBidderIndex === state.mySeatIndex);
if (state.phase === 'LOBBY') {
const emptySeats = state.seats.filter(s => s.isEmpty).length;
if (emptySeats > 0) {
addButton('🤖 Pridėti botą', '', () => socket.emit('addBot', currentRoomCode));
}
if (state.mySeatIndex === 0) {
addButton('🚀 Pradėti žaidimą', 'success', () => socket.emit('startGame', currentRoomCode));
}
} else if (state.phase === 'BIDDING' && isMyTurn) {
if (!state.myCardsRevealed) {
addButton('👀 Atversti kortas', '', () => { playSound('card'); socket.emit('revealCards', currentRoomCode); });
addButton('🙈 Statyti AKLAI (' + (state.currentBid + 10) + ') [x2]', 'success', () => {
playSound('bid');
socket.emit('placeBid', { roomCode: currentRoomCode, blind: true });
});
} else {
addButton('Statyti ' + (state.currentBid + 10), 'success', () => {
playSound('bid');
socket.emit('placeBid', { roomCode: currentRoomCode, blind: false });
});
}
addButton('Pasuoti', 'danger', () => socket.emit('passBid', currentRoomCode));
} else if (state.phase === 'RAISE_BID' && amIHighestBidder) {
const stepper = document.createElement('div');
stepper.style.cssText = 'display:inline-flex; align-items:center; gap:8px; background:rgba(15,23,42,0.85); padding:6px 10px; border-radius:12px; border:1px solid #fbbf24;';
const minusBtn = document.createElement('button');
minusBtn.innerText = '➖ -10';
minusBtn.className = 'danger';
minusBtn.disabled = (state.currentBid - 10 < state.minBidAfterWin);
minusBtn.style.opacity = minusBtn.disabled ? '0.4' : '1';
minusBtn.addEventListener('click', () => {
playSound('bid');
socket.emit('adjustBidAfterTalon', { roomCode: currentRoomCode, delta: -10 });
});
const valLabel = document.createElement('span');
valLabel.innerText = state.currentBid;
valLabel.style.cssText = 'font-size:20px; font-weight:900; color:#fbbf24; min-width:48px; text-align:center;';
const plusBtn = document.createElement('button');
plusBtn.innerText = '➕ +10';
plusBtn.disabled = (state.currentBid + 10 > 400);
plusBtn.style.opacity = plusBtn.disabled ? '0.4' : '1';
plusBtn.addEventListener('click', () => {
playSound('bid');
socket.emit('adjustBidAfterTalon', { roomCode: currentRoomCode, delta: 10 });
});
stepper.appendChild(minusBtn);
stepper.appendChild(valLabel);
stepper.appendChild(plusBtn);
area.appendChild(stepper);
addButton('✅ Pradėti žaidimą su ' + state.currentBid, 'success', () => {
playSound('bid');
socket.emit('confirmBidAndPlay', currentRoomCode);
});
} else if (state.phase === 'ROUND_OVER') {
if (state.mySeatIndex === 0) {
addButton('Dalinti kitą partiją ➡️', 'success', () => socket.emit('nextRound', currentRoomCode));
}
} else if (state.phase === 'GAME_OVER') {
if (state.mySeatIndex === 0) {
addButton('Žaisti naują žaidimą 🔄', 'success', () => socket.emit('startGame', currentRoomCode));
}
}
const myNines = (state.myHand || []).filter(c => c.name === '9');
const canOfferNineGuess = state.myCardsRevealed && myNines.length === 3 && !state.myUsedNineGuess && (state.phase === 'BIDDING' || ((state.phase === 'DISCARD_3' || state.phase === 'RAISE_BID') && amIHighestBidder));
if (canOfferNineGuess) {
if (!choosingNineToHide) {
addButton('🔮 Duoti spėti 9-akę (turi 3 devynakes)', '', () => { choosingNineToHide = true; renderControls(lastState); });
} else {
myNines.forEach(c => {
addButton('Paslėpti: 9' + c.suit + ' (' + getSuitPointsLabel(c.suit) + ')', 'success', () => {
choosingNineToHide = false;
playSound('marriage');
socket.emit('startNineGuess', { roomCode: currentRoomCode, suit: c.suit });
});
});
addButton('Atšaukti', 'danger', () => { choosingNineToHide = false; renderControls(lastState); });
}
}
const canGivePlus = !state.myUsedPlus && (state.phase === 'BIDDING' || ((state.phase === 'DISCARD_3' || state.phase === 'RAISE_BID') && amIHighestBidder));
if (canGivePlus) {
addButton('➕ Duoti pliusą (kitiems po +60 tšk.)', 'danger', () => {
if (confirm('Ar tikrai nori panaudoti savo vienkartinę pagalbą „Duoti pliusą“? Likusiems žaidėjams bus pridėta po +60 taškų.')) {
playSound('bid');
socket.emit('givePlus', currentRoomCode);
}
});
}
addButton('🚪 Išeiti', 'danger', () => {
clearSession();
location.reload();
});
}
function renderTableCenter(state) {
const title = document.getElementById('centerTitle');
const container = document.getElementById('tableCards');
container.innerHTML = '';
if (state.phase === 'LOBBY') {
title.innerText = 'Laukia žaidėjų prisijungimo...';
return;
}
if (state.talonCount > 0) {
title.innerText = 'Bankas (3 kortos)';
if (state.talon && state.talon.length > 0) {
state.talon.forEach(c => {
const div = document.createElement('div');
div.className = 'card ' + (c.isRed ? 'red' : '');
div.innerHTML = '' + c.name + '' + c.suit + '';
container.appendChild(div);
});
} else {
for (let i = 0; i < state.talonCount; i++) {
const div = document.createElement('div');
div.className = 'card hidden';
container.appendChild(div);
}
}
} else if (state.trickCards.length > 0) {
title.innerText = 'Kirtis ant stalo';
state.trickCards.forEach(item => {
const seat = state.seats[item.seatIndex];
const wrapper = document.createElement('div');
wrapper.style.textAlign = 'center';
const cardDiv = document.createElement('div');
cardDiv.className = 'card ' + (item.card.isRed ? 'red' : '');
cardDiv.innerHTML = '' + item.card.name + '' + item.card.suit + '';
const nameLabel = document.createElement('div');
nameLabel.style.fontSize = '11px';
nameLabel.style.marginTop = '4px';
nameLabel.style.color = '#e2e8f0';
nameLabel.innerText = seat.avatar + ' ' + seat.name;
wrapper.appendChild(cardDiv);
wrapper.appendChild(nameLabel);
container.appendChild(wrapper);
});
} else {
title.innerText = 'Stalas';
}
}
function renderMyCards(state) {
const container = document.getElementById('playerCards');
const tableEl = document.querySelector('.poker-table');
container.innerHTML = '';
const oldTableHand = document.getElementById('myTableFaceDownHand');
if (oldTableHand) oldTableHand.remove();
if (!state.myCardsRevealed && state.myHand && state.myHand.length > 0 && state.phase !== 'LOBBY') {
const hint = document.createElement('div');
hint.style.cssText = 'color:#94a3b8; font-size:13px; padding:12px; font-style:italic;';
hint.innerText = '🂠 Tavo užverstos kortos guli ant stalo (paspausk ant jų arba „Atversti kortas“)...';
container.appendChild(hint);
if (tableEl) {
const tablePile = document.createElement('div');
tablePile.id = 'myTableFaceDownHand';
tablePile.title = 'Paspausk, kad paimtum kortas į rankas';
tablePile.style.cssText = 'position:absolute; bottom:115px; left:50%; transform:translateX(-50%); display:flex; justify-content:center; z-index:15; cursor:pointer;';
state.myHand.forEach((_, idx) => {
const div = document.createElement('div');
div.className = 'card small hidden';
const angle = (idx - 3) * 4;
div.style.cssText = 'margin-left:' + (idx === 0 ? '0' : '-18px') + '; transform:rotate(' + angle + 'deg); box-shadow:0 4px 10px rgba(0,0,0,0.7); transition:transform 0.2s;';
tablePile.appendChild(div);
});
tablePile.addEventListener('click', () => {
if (state.phase === 'BIDDING' && state.currentTurnIndex === state.mySeatIndex) {
playSound('card');
socket.emit('revealCards', currentRoomCode);
}
});
tableEl.appendChild(tablePile);
}
return;
}
const isMyTurn = (state.currentTurnIndex === state.mySeatIndex);
const canClick = (state.phase === 'DISCARD_3' && isMyTurn) || (state.phase === 'PLAYING' && isMyTurn);
let indexedHand = state.myHand.map((card, originalIndex) => ({ card, originalIndex }));
indexedHand.sort((a, b) => a.card.suit.localeCompare(b.card.suit) || b.card.power - a.card.power);
indexedHand.forEach(item => {
const div = document.createElement('div');
div.className = 'card ' + (item.card.isRed ? 'red' : '') + (canClick ? ' clickable' : '');
div.innerHTML = '' + item.card.name + '' + item.card.suit + '';
if (canClick) {
div.addEventListener('click', () => {
if (state.phase === 'DISCARD_3') {
playSound('card');
socket.emit('discardCard', { roomCode: currentRoomCode, cardIndex: item.originalIndex });
} else if (state.phase === 'PLAYING') {
socket.emit('playCard', { roomCode: currentRoomCode, cardIndex: item.originalIndex });
}
});
}
container.appendChild(div);
});
}
function renderDiscarded(state) {
const info = document.getElementById('discardInfo');
const container = document.getElementById('discardedCards');
container.innerHTML = '';
if (state.discardedCount === 0) {
info.innerText = 'Kol kas nenusimesta';
return;
}
const bidderName = state.seats[state.highestBidderIndex].name;
const canUndo = (state.highestBidderIndex === state.mySeatIndex) && (state.phase === 'DISCARD_3' || state.phase === 'RAISE_BID');
if (state.discardedPile.length > 0) {
info.innerText = canUndo
? 'Tavo nusimestos (+' + state.discardedPoints + ' tšk.) – paspausk, jei nori susigrąžinti:'
: 'Tavo nusimestos (+' + state.discardedPoints + ' tšk.):';
state.discardedPile.forEach((c, idx) => {
const div = document.createElement('div');
div.className = 'card small ' + (c.isRed ? 'red' : '') + (canUndo ? ' clickable' : '');
div.innerHTML = '' + c.name + '' + c.suit + '';
if (canUndo) {
div.title = 'Paspausk, kad sugrąžintum į ranką';
div.addEventListener('click', () => {
playSound('card');
socket.emit('undiscardCard', { roomCode: currentRoomCode, discardIndex: idx });
});
}
container.appendChild(div);
});
} else {
info.innerText = bidderName + ' nusimetė (+' + state.discardedPoints + ' tšk.)';
for (let i = 0; i < state.discardedCount; i++) {
const div = document.createElement('div');
div.className = 'card small hidden';
container.appendChild(div);
}
}
}
function addButton(text, className, onClick) {
const btn = document.createElement('button');
btn.innerText = text;
if (className) btn.className = className;
btn.addEventListener('click', onClick);
document.getElementById('controlsArea').appendChild(btn);
}
// --- 4D STALO PERSPEKTYVA ---
(function init4DTable() {
let targetX = 0, targetY = 0, curX = 0, curY = 0;
document.addEventListener('mousemove', (e) => {
if (window.innerWidth < 768) return;
const nx = (e.clientX / window.innerWidth) - 0.5;
const ny = (e.clientY / window.innerHeight) - 0.5;
targetY = nx * 7;
targetX = 9 - (ny * 6);
});
function animateTable() {
const table = document.querySelector('.poker-table');
if (table && window.innerWidth >= 768) {
curX += (targetX - curX) * 0.08;
curY += (targetY - curY) * 0.08;
table.style.transform = 'rotateX(' + curX.toFixed(2) + 'deg) rotateY(' + curY.toFixed(2) + 'deg)';
}
requestAnimationFrame(animateTable);
}
requestAnimationFrame(animateTable);
})();
// --- 5D IR 10D VIZUALIZACIJA ---
const style10D = document.createElement('style');
style10D.innerHTML = '@keyframes floatDust { 0% { transform: translateY(0) scale(0.8); opacity: 0; } 30% { opacity: 0.75; } 100% { transform: translateY(-160px) scale(1.2); opacity: 0; } } .gold-dust { position: absolute; width: 4px; height: 4px; background: radial-gradient(circle, #fde68a 0%, #f59e0b 100%); border-radius: 50%; pointer-events: none; box-shadow: 0 0 8px #fbbf24; z-index: 2; } @keyframes rippleWave { 0% { transform: translate(-50%, -50%) scale(0.2); opacity: 0.9; } 100% { transform: translate(-50%, -50%) scale(3.5); opacity: 0; } } .touch-ripple { position: fixed; width: 40px; height: 40px; border: 2px solid #fbbf24; border-radius: 50%; pointer-events: none; z-index: 9998; animation: rippleWave 0.65s ease-out forwards; } .card.spotlight-card { background-image: radial-gradient(circle at var(--mx, 50%) var(--my, 50%), rgba(255,255,255,0.65) 0%, transparent 60%), linear-gradient(145deg, #ffffff 0%, #fefce8 65%, #fef3c7 100%) !important; } @keyframes holoShift { 0% { filter: hue-rotate(0deg) brightness(1.05); } 50% { filter: hue-rotate(45deg) brightness(1.15); } 100% { filter: hue-rotate(0deg) brightness(1.05); } } .card.holo-card { border: 2px solid #f59e0b !important; box-shadow: 0 0 18px rgba(251, 191, 36, 0.75), inset 0 0 12px rgba(253, 224, 71, 0.5) !important; animation: holoShift 3s infinite ease-in-out; } @keyframes shockwave10D { 0% { transform: translate(-50%, -50%) scale(0.1); opacity: 1; border-width: 6px; } 100% { transform: translate(-50%, -50%) scale(4.5); opacity: 0; border-width: 1px; } } .table-shockwave { position: absolute; top: 50%; left: 50%; width: 120px; height: 120px; border: 6px solid #fbbf24; border-radius: 50%; pointer-events: none; z-index: 50; animation: shockwave10D 0.85s cubic-bezier(0.16, 1, 0.3, 1) forwards; } @keyframes coinFall10D { 0% { transform: translateY(-20px) rotateY(0deg) scale(0.8); opacity: 1; } 100% { transform: translateY(340px) rotateY(720deg) scale(1.1); opacity: 0; } } .gold-coin-10d { position: absolute; font-size: 20px; pointer-events: none; z-index: 60; text-shadow: 0 0 10px #fbbf24; }';
document.head.appendChild(style10D);
setInterval(() => {
const table = document.querySelector('.poker-table');
const gameScr = document.getElementById('gameScreen');
if (!table || !gameScr || gameScr.style.display === 'none') return;
const dust = document.createElement('div');
dust.className = 'gold-dust';
dust.style.left = (Math.random() * 80 + 10) + '%';
dust.style.top = (Math.random() * 60 + 30) + '%';
const dur = Math.random() * 2500 + 2500;
dust.style.animation = 'floatDust ' + dur + 'ms ease-out forwards';
table.appendChild(dust);
setTimeout(() => dust.remove(), dur);
}, 450);
document.addEventListener('mousemove', (e) => {
const card = e.target.closest('.card:not(.hidden)');
if (!card) return;
const rect = card.getBoundingClientRect();
const x = ((e.clientX - rect.left) / rect.width) * 100;
const y = ((e.clientY - rect.top) / rect.height) * 100;
card.classList.add('spotlight-card');
card.style.setProperty('--mx', x + '%');
card.style.setProperty('--my', y + '%');
});
document.addEventListener('pointerdown', (e) => {
const ripple = document.createElement('div');
ripple.className = 'touch-ripple';
ripple.style.left = e.clientX + 'px';
ripple.style.top = e.clientY + 'px';
document.body.appendChild(ripple);
setTimeout(() => ripple.remove(), 650);
try {
if (navigator.vibrate) {
if (e.target.closest('.card.clickable')) navigator.vibrate(25);
else if (e.target.closest('button')) navigator.vibrate(15);
}
} catch (err) {}
});
function triggerTableShockwave(color) {
const table = document.querySelector('.poker-table');
if (!table) return;
const wave = document.createElement('div');
wave.className = 'table-shockwave';
if (color) wave.style.borderColor = color;
table.appendChild(wave);
setTimeout(() => wave.remove(), 850);
}
function triggerGoldRain10D() {
const table = document.querySelector('.poker-table');
if (!table) return;
const icons = ['👑', '✨', '🪙', '💎'];
for (let i = 0; i < 24; i++) {
const coin = document.createElement('div');
coin.className = 'gold-coin-10d';
coin.innerText = icons[Math.floor(Math.random() * icons.length)];
coin.style.left = (Math.random() * 84 + 8) + '%';
coin.style.top = '0px';
const dur = Math.random() * 1000 + 1200;
coin.style.animation = 'coinFall10D ' + dur + 'ms ease-in forwards';
table.appendChild(coin);
setTimeout(() => coin.remove(), dur);
}
}
setInterval(() => {
document.querySelectorAll('#playerCards .card:not(.hidden)').forEach(card => {
const txt = card.innerText || '';
if (txt.startsWith('A') || txt.startsWith('10')) {
card.classList.add('holo-card');
}
});
}, 500);
let lastStatus10D = '';
socket.on('gameState', (state) => {
if (state.statusText && state.statusText !== lastStatus10D) {
lastStatus10D = state.statusText;
if (state.statusText.includes('PORĄ')) {
triggerTableShockwave('#fbbf24');
triggerGoldRain10D();
try { if (navigator.vibrate) navigator.vibrate(); } catch (e) {}
} else if (state.statusText.includes('Kirtį paėmė')) {
const nums = state.statusText.match(/[0-9]+/g);
const pts = nums ? Number(nums[nums.length - 1]) : 0;
if (pts >= 20) {
triggerTableShockwave('#10b981');
try { if (navigator.vibrate) navigator.vibrate(50); } catch (e) {}
} else {
triggerTableShockwave('rgba(255,255,255,0.45)');
}
}
}
});
// --- AVATARO KŪRĖJAS IR KORTŲ VIRŠELIŲ PASIRINKIMAS ---
(function initCustomStudio() {
    const lobbyCard = document.getElementById('lobbyScreen');
    const createBtn = document.getElementById('createRoomBtn');
    if (!lobbyCard || !createBtn) return;

    // Paslepiame senus 2 mygtukus (Vyras / Moteris), nes dabar turėsime visą studiją
    const oldRow = document.querySelector('#lobbyScreen .avatar-row');
    if (oldRow) oldRow.style.display = 'none';

    const emojis = ['👨', '👩', '😎', '🤠', '🦊', '🦁', '👑', '🤖'];
    const bgColors = [
        { name: 'Auksinė', val: 'linear-gradient(135deg, #f59e0b, #b45309)' },
        { name: 'Smaragdinė', val: 'linear-gradient(135deg, #10b981, #065f46)' },
        { name: 'Rubino', val: 'linear-gradient(135deg, #ef4444, #991b1b)' },
        { name: 'Mėlyna', val: 'linear-gradient(135deg, #3b82f6, #1e3a8a)' },
        { name: 'Violetinė', val: 'linear-gradient(135deg, #a855f7, #581c87)' }
    ];
    const cardBacks = [
        { id: 'blue', label: '🔵 Mėlyna', css: 'repeating-linear-gradient(45deg, #1e3a8a, #1e3a8a 8px, #312e81 8px, #312e81 16px)', border: '#f8fafc' },
        { id: 'red', label: '🔴 Rubinas', css: 'repeating-linear-gradient(45deg, #991b1b, #991b1b 8px, #7f1d1d 8px, #7f1d1d 16px)', border: '#fbbf24' },
        { id: 'green', label: '🟢 Smaragdas', css: 'repeating-linear-gradient(45deg, #065f46, #065f46 8px, #022c22 8px, #022c22 16px)', border: '#34d399' },
        { id: 'vip', label: '⚫ VIP Auksas', css: 'repeating-linear-gradient(45deg, #111827, #111827 8px, #292524 8px, #292524 16px)', border: '#fbbf24' }
    ];

    let savedEmoji = localStorage.getItem('tuk_emoji') || '😎';
    let savedBg = localStorage.getItem('tuk_bg') || bgColors[0].val;
    let savedBack = localStorage.getItem('tuk_back') || 'blue';
    selectedAvatar = savedEmoji;

    const studio = document.createElement('div');
    studio.style.cssText = 'background:rgba(30,41,59,0.75); border:1px solid rgba(251,191,36,0.4); border-radius:14px; padding:12px; margin-bottom:14px; text-align:center;';

    // Avataro peržiūra
    const preview = document.createElement('div');
    preview.style.cssText = 'width:58px; height:58px; border-radius:50%; margin:0 auto 8px auto; display:flex; align-items:center; justify-content:center; font-size:32px; border:3px solid #fbbf24; box-shadow:0 4px 12px rgba(0,0,0,0.6); background:' + savedBg + ';';
    preview.innerText = savedEmoji;
    studio.appendChild(preview);

    // Personažų pasirinkimas
    const emojiTitle = document.createElement('div');
    emojiTitle.style.cssText = 'font-size:12px; color:#cbd5e1; margin-bottom:6px;';
    emojiTitle.innerText = '1. Pasirink personažą ir fono spalvą:';
    studio.appendChild(emojiTitle);

    const emojiWrap = document.createElement('div');
    emojiWrap.style.cssText = 'display:flex; justify-content:center; gap:6px; flex-wrap:wrap; margin-bottom:8px;';
    emojis.forEach(em => {
        const b = document.createElement('button');
        b.type = 'button';
        b.innerText = em;
        b.style.cssText = 'padding:5px 8px; font-size:18px; background:#0f172a; border:2px solid ' + (em === savedEmoji ? '#fbbf24' : '#334155') + '; border-radius:8px; cursor:pointer;';
        b.addEventListener('click', () => {
            savedEmoji = em;
            selectedAvatar = em;
            localStorage.setItem('tuk_emoji', em);
            preview.innerText = em;
            emojiWrap.querySelectorAll('button').forEach(x => x.style.borderColor = '#334155');
            b.style.borderColor = '#fbbf24';
        });
        emojiWrap.appendChild(b);
    });
    studio.appendChild(emojiWrap);

    // Fono spalvos
    const bgWrap = document.createElement('div');
    bgWrap.style.cssText = 'display:flex; justify-content:center; gap:8px; margin-bottom:12px;';
    bgColors.forEach(col => {
        const dot = document.createElement('div');
        dot.title = col.name;
        dot.style.cssText = 'width:24px; height:24px; border-radius:50%; background:' + col.val + '; cursor:pointer; border:2px solid ' + (col.val === savedBg ? '#ffffff' : 'transparent') + '; box-shadow:0 2px 6px rgba(0,0,0,0.5);';
        dot.addEventListener('click', () => {
            savedBg = col.val;
            localStorage.setItem('tuk_bg', col.val);
            preview.style.background = col.val;
            bgWrap.querySelectorAll('div').forEach(x => x.style.borderColor = 'transparent');
            dot.style.borderColor = '#ffffff';
        });
        bgWrap.appendChild(dot);
    });
    studio.appendChild(bgWrap);

    // Kortų viršelių pasirinkimas
    const backTitle = document.createElement('div');
    backTitle.style.cssText = 'font-size:12px; color:#cbd5e1; margin-bottom:6px;';
    backTitle.innerText = '2. Pasirink kortų viršelį (nugarėlę):';
    studio.appendChild(backTitle);

    const backWrap = document.createElement('div');
    backWrap.style.cssText = 'display:grid; grid-template-columns:1fr 1fr; gap:6px;';

    function applyCardBackStyle(backId) {
        const found = cardBacks.find(x => x.id === backId) || cardBacks[0];
        let tag = document.getElementById('customCardBackStyle');
        if (!tag) {
            tag = document.createElement('style');
            tag.id = 'customCardBackStyle';
            document.head.appendChild(tag);
        }
        tag.innerHTML = '.card.hidden { background: ' + found.css + ' !important; border: 2px solid ' + found.border + ' !important; } #meAvatar { background: ' + savedBg + ' !important; }';
    }

    cardBacks.forEach(cb => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.innerText = cb.label;
        btn.style.cssText = 'padding:6px 8px; font-size:12px; background:#0f172a; color:#f8fafc; border:2px solid ' + (cb.id === savedBack ? '#fbbf24' : '#334155') + '; border-radius:8px; cursor:pointer;';
        btn.addEventListener('click', () => {
            savedBack = cb.id;
            localStorage.setItem('tuk_back', cb.id);
            applyCardBackStyle(cb.id);
            backWrap.querySelectorAll('button').forEach(x => x.style.borderColor = '#334155');
            btn.style.borderColor = '#fbbf24';
        });
        backWrap.appendChild(btn);
    });
    studio.appendChild(backWrap);

    // Įterpiame studiją prieš „Sukurti naują kambarį“ mygtuką
    lobbyCard.insertBefore(studio, createBtn);
    applyCardBackStyle(savedBack);

    // Atnaujiname mano avataro foną ir prie stalo
    setInterval(() => {
        const meAv = document.getElementById('meAvatar');
        if (meAv) meAv.style.background = savedBg;
    }, 800);
})();
// --- 1. GARSO MYGTUKAS, 2. TAISYKLIŲ ATMINTINĖ IR 3. PARTIJŲ ISTORIJA BEI ČEMPIONAI ---
(function initClubExtras() {
    const roomBanner = document.querySelector('.room-banner');
    if (roomBanner) {
        const barWrap = document.createElement('div');
        barWrap.style.cssText = 'display:inline-flex; gap:8px; margin-left:12px; vertical-align:middle;';

        // 1. Garso mygtukas
        const soundBtn = document.createElement('button');
        soundBtn.type = 'button';
        let isMuted = (localStorage.getItem('tuk_mute') === '1');
        soundBtn.innerText = isMuted ? '🔇 Tylu' : '🔊 Garsas';
        soundBtn.style.cssText = 'padding:4px 10px; font-size:12px; border-radius:12px; background:#1e293b; color:#fde68a; border:1px solid #fbbf24;';
        soundBtn.addEventListener('click', () => {
            isMuted = !isMuted;
            localStorage.setItem('tuk_mute', isMuted ? '1' : '0');
            soundBtn.innerText = isMuted ? '🔇 Tylu' : '🔊 Garsas';
        });

        // 2. Taisyklių mygtukas
        const rulesBtn = document.createElement('button');
        rulesBtn.type = 'button';
        rulesBtn.innerText = '📖 Taisyklės';
        rulesBtn.style.cssText = 'padding:4px 10px; font-size:12px; border-radius:12px; background:#1e293b; color:#fde68a; border:1px solid #fbbf24;';
        rulesBtn.addEventListener('click', () => {
            modal.style.display = 'flex';
        });

        barWrap.appendChild(soundBtn);
        barWrap.appendChild(rulesBtn);
        roomBanner.appendChild(barWrap);
    }

    // Taisyklių langas (Modal)
    const modal = document.createElement('div');
    modal.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.82); z-index:10000; align-items:center; justify-content:center; padding:16px;';
    modal.innerHTML = '<div style="background:#0f172a; border:2px solid #fbbf24; border-radius:18px; max-width:480px; width:100%; padding:20px; text-align:left; color:#f8fafc; box-shadow:0 20px 50px rgba(0,0,0,0.9);">' +
        '<h3 style="margin:0 0 12px 0; color:#fbbf24; text-align:center;">📖 Greita „Tūkstančio“ atmintinė</h3>' +
        '<ul style="padding-left:18px; line-height:1.6; font-size:14px; color:#e2e8f0; margin:0 0 16px 0;">' +
        '<li><strong>Tikslas:</strong> Pirmam surinkti <strong>1000 taškų</strong>.</li>' +
        '<li><strong>Poros (Q + K):</strong> ♣ 100 | ♠ 80 | ♥ 60 | ♦ 40 tšk. (skelbiamos einant pirmam kirtyje).</li>' +
        '<li><strong>Aklas žaidimas [x2]:</strong> Statant neatvertus kortų, taškai (ir bauda) dvigubinami.</li>' +
        '<li><strong>900 „Statinė“ 🛢️:</strong> Pasiekus 900 tšk., taškai nebekyla – būtina laimėti statymą ir pasiekti 1000.</li>' +
        '<li><strong>Pagalbos (1 kartą per žaidimą):</strong> <em>Duoti pliusą</em> (kitiems po +60) arba <em>3 devynakių spėjimas</em> (+120 / -120).</li>' +
        '</ul>' +
        '<button id="closeQuickRules" style="width:100%; background:#10b981; color:white; padding:10px; border-radius:10px;">Supratau, grįžti prie stalo</button>' +
        '</div>';
    document.body.appendChild(modal);
    modal.querySelector('#closeQuickRules').addEventListener('click', () => modal.style.display = 'none');

    // 3. Partijų istorija ir čempionų lentelė šoninėje kolonoje
    const sideCol = document.querySelector('.side-column');
    if (sideCol) {
        const statsPanel = document.createElement('div');
        statsPanel.className = 'side-panel';
        statsPanel.innerHTML = '<h4>🏆 Čempionai ir Istorija</h4>' +
            '<div id="champBoard" style="font-size:12px; color:#fde68a; margin-bottom:8px; text-align:left;">Kol kas pergalių nėra</div>' +
            '<div style="border-top:1px solid rgba(255,255,255,0.12); padding-top:6px; font-size:11px; color:#94a3b8; text-align:left;">Paskutinės partijos:</div>' +
            '<div id="roundHistoryList" style="max-height:110px; overflow-y:auto; font-size:12px; text-align:left; margin-top:4px; display:flex; flex-direction:column; gap:4px;"></div>';
        sideCol.appendChild(statsPanel);
    }

    function renderChampBoard() {
        const board = document.getElementById('champBoard');
        if (!board) return;
        const champs = JSON.parse(localStorage.getItem('tuk_champs') || '{}');
        const entries = Object.entries(champs).sort((a, b) => b - a);
        if (entries.length === 0) {
            board.innerText = 'Sužaisk žaidimą iki 1000 tšk., kad patektum į lentelę!';
            return;
        }
        board.innerHTML = entries.slice(0, 5).map(([name, wins], idx) => {
            const medal = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : '🎖️'));
            return '<div>' + medal + ' <strong>' + name + '</strong>: ' + wins + ' perg.</div>';
        }).join('');
    }
    renderChampBoard();

    let lastRecordedPhase = null;
    socket.on('gameState', (state) => {
        if (state.phase === 'ROUND_OVER' && lastRecordedPhase !== 'ROUND_OVER') {
            const list = document.getElementById('roundHistoryList');
            if (list) {
                const row = document.createElement('div');
                row.style.cssText = 'background:rgba(30,41,59,0.8); padding:4px 6px; border-radius:6px;';
                const summary = state.seats.map(s => s.avatar + ' ' + s.name + ': ' + s.totalScore).join(' | ');
                row.innerText = summary;
                list.prepend(row);
            }
        }
        if (state.phase === 'GAME_OVER' && lastRecordedPhase !== 'GAME_OVER') {
            const winner = state.seats.reduce((best, cur) => cur.totalScore > best.totalScore ? cur : best, state.seats);
            if (winner && winner.totalScore >= 1000) {
                const champs = JSON.parse(localStorage.getItem('tuk_champs') || '{}');
                champs[winner.name] = (champs[winner.name] || 0) + 1;
                localStorage.setItem('tuk_champs', JSON.stringify(champs));
                renderChampBoard();
            }
        }
        lastRecordedPhase = state.phase;
    });
})();
// --- GREITOJO REŽIMO (500 TŠK.) IR KLASIKINIO (1000 TŠK.) PASIRINKIMAS ---
(function initGameModePicker() {
    const lobbyCard = document.getElementById('lobbyScreen');
    const oldCreateBtn = document.getElementById('createRoomBtn');
    if (!lobbyCard || !oldCreateBtn) return;

    // Pakeičiame mygtuką nauja kopija, kad garantuotai siųstų pasirinktą taškų ribą
    const createBtn = oldCreateBtn.cloneNode(true);
    oldCreateBtn.parentNode.replaceChild(createBtn, oldCreateBtn);

    let chosenGoal = 1000;

    createBtn.addEventListener('click', () => {
        const name = document.getElementById('playerNameInput').value.trim() || 'Žaidėjas';
        socket.emit('createRoom', {
            playerName: name,
            avatar: selectedAvatar,
            playerToken: myPlayerId,
            targetScore: chosenGoal
        });
    });

    const modeBox = document.createElement('div');
    modeBox.style.cssText = 'display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px;';

    const btn1000 = document.createElement('button');
    btn1000.type = 'button';
    btn1000.innerText = '🏆 Klasikinis (1000)';
    btn1000.style.cssText = 'padding:8px; font-size:13px; background:#10b981; color:#fff; border:2px solid #fef08a; border-radius:10px; cursor:pointer;';

    const btn500 = document.createElement('button');
    btn500.type = 'button';
    btn500.innerText = '⚡ Greitasis (500)';
    btn500.style.cssText = 'padding:8px; font-size:13px; background:#1e293b; color:#cbd5e1; border:2px solid #334155; border-radius:10px; cursor:pointer;';

    btn1000.addEventListener('click', () => {
        chosenGoal = 1000;
        btn1000.style.background = '#10b981';
        btn1000.style.color = '#fff';
        btn1000.style.borderColor = '#fef08a';
        btn500.style.background = '#1e293b';
        btn500.style.color = '#cbd5e1';
        btn500.style.borderColor = '#334155';
    });

    btn500.addEventListener('click', () => {
        chosenGoal = 500;
        btn500.style.background = '#f59e0b';
        btn500.style.color = '#111';
        btn500.style.borderColor = '#fef08a';
        btn1000.style.background = '#1e293b';
        btn1000.style.color = '#cbd5e1';
        btn1000.style.borderColor = '#334155';
    });

    modeBox.appendChild(btn1000);
    modeBox.appendChild(btn500);
    lobbyCard.insertBefore(modeBox, createBtn);

    // Pritaikome visus taškų rodymus ir stalo vandens ženklą pagal pasirinktą režimą
    socket.on('gameState', (state) => {
        const goal = state.targetScore || chosenGoal || 1000;
        const barrel = goal - 100;
        const myIdx = state.mySeatIndex;
        const leftIdx = (myIdx + 1) % 3;
        const rightIdx = (myIdx + 2) % 3;

        const me = state.seats[myIdx];
        const left = state.seats[leftIdx];
        const right = state.seats[rightIdx];

        const watermark = document.querySelector('.table-watermark div');
        if (watermark) watermark.innerText = goal;

        const meHeader = document.getElementById('meHeader');
        if (meHeader && me) {
            const blindTag = me.isBlind ? ' 🙈 [Aklai x2]' : '';
            const barrelTag = me.totalScore >= barrel ? ' 🛢️' : '';
            meHeader.innerText = me.name + blindTag + barrelTag + ' | Bendri: ' + me.totalScore + ' / ' + goal + ' | Partijoje: ' + me.roundScore;
        }

        const leftName = document.getElementById('leftName');
        if (leftName && left) {
            leftName.innerText = left.name + (left.totalScore >= barrel ? ' 🛢️' : '');
            if (leftName.nextElementSibling) leftName.nextElementSibling.innerHTML = 'Bendri: <strong>' + left.totalScore + '</strong> / ' + goal;
        }

        const rightName = document.getElementById('rightName');
        if (rightName && right) {
            rightName.innerText = right.name + (right.totalScore >= barrel ? ' 🛢️' : '');
            if (rightName.nextElementSibling) rightName.nextElementSibling.innerHTML = 'Bendri: <strong>' + right.totalScore + '</strong> / ' + goal;
        }

        const leftBox = document.getElementById('box-left');
        const rightBox = document.getElementById('box-right');
        const meBox = document.getElementById('box-me');
        if (leftBox && left) leftBox.classList.toggle('on-barrel', left.totalScore >= barrel);
        if (rightBox && right) rightBox.classList.toggle('on-barrel', right.totalScore >= barrel);
        if (meBox && me) meBox.classList.toggle('on-barrel', me.totalScore >= barrel);
    });
})();
// --- POMPASTIŠKAS ČEMPIONO ŠOU (GAME_OVER) ---
(function initChampionShow() {
    const style = document.createElement('style');
    style.innerHTML = '@keyframes champPop { 0% { transform: scale(0.3) rotate(-6deg); opacity: 0; } 60% { transform: scale(1.06) rotate(1deg); opacity: 1; } 100% { transform: scale(1) rotate(0deg); opacity: 1; } } @keyframes trophyFloat { 0%, 100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-10px) scale(1.12); } } @keyframes fireworkBurst { 0% { transform: translate(0, 0) scale(1); opacity: 1; } 100% { transform: translate(var(--dx), var(--dy)) scale(0.2); opacity: 0; } } .champ-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: radial-gradient(circle at center, rgba(251,191,36,0.28) 0%, rgba(2,6,23,0.92) 85%); z-index: 10005; display: flex; align-items: center; justify-content: center; padding: 16px; } .champ-card { background: linear-gradient(145deg, #1e1b4b 0%, #0f172a 55%, #451a03 100%); border: 4px solid #fbbf24; border-radius: 24px; max-width: 440px; width: 100%; padding: 26px 22px; text-align: center; color: #fff; box-shadow: 0 0 60px rgba(251,191,36,0.85), inset 0 0 30px rgba(251,191,36,0.25); animation: champPop 0.65s cubic-bezier(0.22, 1, 0.36, 1) forwards; position: relative; z-index: 10007; } .champ-trophy { font-size: 74px; display: inline-block; filter: drop-shadow(0 0 22px #fbbf24); animation: trophyFloat 1.8s infinite ease-in-out; } .fw-spark { position: fixed; width: 8px; height: 8px; border-radius: 50%; pointer-events: none; z-index: 10006; animation: fireworkBurst 1.1s ease-out forwards; }';
    document.head.appendChild(style);

    function playChampionFanfare() {
        if (localStorage.getItem('tuk_mute') === '1') return;
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return;
            const ctx = new Ctx();
            const notes = [523.25, 659.25, 783.99, 1046.50, 783.99, 1046.50];
            const times = [0, 0.14, 0.28, 0.44, 0.68, 0.84];
            const durs = [0.13, 0.13, 0.15, 0.22, 0.14, 0.65];
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, ctx.currentTime + times[i]);
                gain.gain.setValueAtTime(0.22, ctx.currentTime + times[i]);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + times[i] + durs[i]);
                osc.start(ctx.currentTime + times[i]);
                osc.stop(ctx.currentTime + times[i] + durs[i]);
            });
        } catch (e) {}
    }

    function launchFireworks() {
        const colors = ['#fbbf24', '#ef4444', '#10b981', '#3b82f6', '#f472b6', '#ffffff'];
        for (let b = 0; b < 7; b++) {
            setTimeout(() => {
                const cx = Math.random() * 80 + 10;
                const cy = Math.random() * 55 + 15;
                const col = colors[Math.floor(Math.random() * colors.length)];
                for (let p = 0; p < 22; p++) {
                    const spark = document.createElement('div');
                    spark.className = 'fw-spark';
                    spark.style.left = cx + 'vw';
                    spark.style.top = cy + 'vh';
                    spark.style.backgroundColor = col;
                    spark.style.boxShadow = '0 0 10px ' + col;
                    const angle = (Math.PI * 2 * p) / 22;
                    const dist = Math.random() * 140 + 60;
                    spark.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
                    spark.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
                    document.body.appendChild(spark);
                    setTimeout(() => spark.remove(), 1150);
                }
            }, b * 420);
        }
    }

    function showChampionModal(state) {
        const old = document.querySelector('.champ-overlay');
        if (old) old.remove();

        const ranked = state.seats.slice().sort((a, b) => b.totalScore - a.totalScore);
        const champ = ranked.at(0);
        const goal = state.targetScore || 1000;

        playChampionFanfare();
        launchFireworks();
        if (typeof triggerConfetti === 'function') triggerConfetti();
        try { if (navigator.vibrate) navigator.vibrate([120, 60, 120, 60, 300]); } catch (e) {}

        const overlay = document.createElement('div');
        overlay.className = 'champ-overlay';

        const podiumHtml = ranked.map((s, idx) => {
            const medal = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : '🥉');
            const rowBg = idx === 0 ? 'rgba(251,191,36,0.22)' : 'rgba(30,41,59,0.75)';
            const rowBorder = idx === 0 ? '1px solid #fbbf24' : '1px solid rgba(255,255,255,0.1)';
            return '<div style="display:flex; justify-content:space-between; align-items:center; background:' + rowBg + '; border:' + rowBorder + '; padding:10px 14px; border-radius:12px; margin-bottom:8px;">' +
                '<div style="font-size:16px; font-weight:bold;">' + medal + ' ' + s.avatar + ' ' + s.name + '</div>' +
                '<div style="font-size:16px; font-weight:900; color:#fde68a;">' + s.totalScore + ' / ' + goal + '</div>' +
                '</div>';
        }).join('');

        overlay.innerHTML = '<div class="champ-card">' +
            '<div class="champ-trophy">🏆</div>' +
            '<div style="font-size:13px; letter-spacing:3px; color:#fde68a; font-weight:bold; margin-top:4px;">KLUBO ČEMPIONAS</div>' +
            '<h2 style="margin:6px 0 4px 0; font-size:28px; color:#fbbf24; text-shadow:0 2px 10px rgba(0,0,0,0.8);">' + champ.avatar + ' ' + champ.name + '</h2>' +
            '<div style="font-size:14px; color:#cbd5e1; margin-bottom:16px;">Surinko <strong>' + champ.totalScore + '</strong> taškų ir laimėjo partiją!</div>' +
            '<div style="margin-bottom:18px;">' + podiumHtml + '</div>' +
            '<button id="closeChampShowBtn" style="width:100%; padding:13px; font-size:16px; font-weight:900; background:linear-gradient(135deg, #f59e0b, #d97706); color:#111; border-radius:14px; border:2px solid #fef08a; cursor:pointer; box-shadow:0 6px 20px rgba(245,158,11,0.5);">🎉 Užbaigti šventę ir grįžti prie stalo</button>' +
            '</div>';

        document.body.appendChild(overlay);
        overlay.querySelector('#closeChampShowBtn').addEventListener('click', () => {
            overlay.remove();
        });
    }

    let lastShowPhase = null;
    socket.on('gameState', (state) => {
        if (state.phase === 'GAME_OVER' && lastShowPhase !== 'GAME_OVER') {
            showChampionModal(state);
        }
        lastShowPhase = state.phase;
    });
})();
// PABAIGA


