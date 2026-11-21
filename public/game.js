const socket = io();

let playerToken = localStorage.getItem('tukstantis_token');
if (!playerToken) {
    playerToken = 'plr_' + Math.random().toString(36).substring(2, 12) + Date.now();
    localStorage.setItem('tukstantis_token', playerToken);
}

let selectedAvatar = '👨';
let currentRoomCode = sessionStorage.getItem('tukstantis_room') || null;
let lastState = null;
let soundEnabled = true;

socket.on('connect', () => {
    if (currentRoomCode) {
        socket.emit('rejoinRoom', { roomCode: currentRoomCode, playerToken: playerToken });
    }
});

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && currentRoomCode) {
        if (!socket.connected) socket.connect();
        socket.emit('rejoinRoom', { roomCode: currentRoomCode, playerToken: playerToken });
    }
});

const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function initAudio() {
    if (!audioCtx) audioCtx = new AudioCtx();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playSound(type) {
    if (!soundEnabled) return;
    try {
        initAudio();
        const now = audioCtx.currentTime;

        if (type === 'card') {
            const bufferSize = audioCtx.sampleRate * 0.08;
            const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
            }
            const noise = audioCtx.createBufferSource();
            noise.buffer = buffer;

            const filter = audioCtx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 1200;

            const gain = audioCtx.createGain();
            gain.gain.setValueAtTime(0.35, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(audioCtx.destination);
            noise.start(now);
        } else if (type === 'bid') {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(520, now);
            osc.frequency.exponentialRampToValueAtTime(780, now + 0.07);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.07);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now);
            osc.stop(now + 0.07);
        } else if (type === 'marriage') {
            [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, now + idx * 0.06);
                gain.gain.setValueAtTime(0.18, now + idx * 0.06);
                gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.45);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(now + idx * 0.06);
                osc.stop(now + idx * 0.06 + 0.45);
            });
        } else if (type === 'chat') {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, now);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now);
            osc.stop(now + 0.12);
        } else if (type === 'win') {
            [440, 554.37, 659.25, 880].forEach((freq, idx) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + idx * 0.1);
                gain.gain.setValueAtTime(0.18, now + idx * 0.1);
                gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.5);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(now + idx * 0.1);
                osc.stop(now + idx * 0.1 + 0.5);
            });
        }
    } catch (e) {}
}

const soundBtn = document.createElement('button');
soundBtn.innerText = '🔊';
soundBtn.title = 'Įjungti / išjungti garsą';
soundBtn.style.cssText = 'margin-left:10px; padding:3px 9px; font-size:14px; background:#1e293b; color:#fbbf24; border:1px solid #fbbf24; border-radius:8px; vertical-align:middle;';
soundBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundBtn.innerText = soundEnabled ? '🔊' : '🔇';
    if (soundEnabled) playSound('bid');
});
const roomBannerEl = document.querySelector('.room-banner');
if (roomBannerEl) {
    roomBannerEl.appendChild(soundBtn);
}

document.getElementById('lobbyMale').addEventListener('click', () => {
    initAudio();
    selectedAvatar = '👨';
    document.getElementById('lobbyMale').classList.add('active-avatar');
    document.getElementById('lobbyFemale').classList.remove('active-avatar');
});

document.getElementById('lobbyFemale').addEventListener('click', () => {
    initAudio();
    selectedAvatar = '👩';
    document.getElementById('lobbyFemale').classList.add('active-avatar');
    document.getElementById('lobbyMale').classList.remove('active-avatar');
});

document.getElementById('createRoomBtn').addEventListener('click', () => {
    initAudio();
    const name = document.getElementById('playerNameInput').value.trim() || 'Žaidėjas';
    socket.emit('createRoom', { playerName: name, avatar: selectedAvatar, playerToken: playerToken });
});

document.getElementById('joinRoomBtn').addEventListener('click', () => {
    initAudio();
    const name = document.getElementById('playerNameInput').value.trim() || 'Žaidėjas';
    const code = document.getElementById('roomCodeInput').value.trim();
    if (!code) {
        alert('Įrašyk kambario kodą!');
        return;
    }
    socket.emit('joinRoom', { roomCode: code, playerName: name, avatar: selectedAvatar, playerToken: playerToken });
});

socket.on('errorMsg', (msg) => {
    alert(msg);
});

function addButton(text, className, onClickFn) {
    const btn = document.createElement('button');
    btn.innerText = text;
    if (className) btn.className = className;
    btn.addEventListener('click', onClickFn);
    document.getElementById('controlsArea').appendChild(btn);
}

function formatTotalScore(score) {
    if (score >= 900 && score < 1000) return score + ' 🛢️ (Statinė)';
    return score;
}
socket.on('gameState', (state) => {
    if (lastState) {
        if (state.trickCards.length > lastState.trickCards.length) {
            playSound('card');
        } else if (state.phase === 'BIDDING' && lastState.phase !== 'BIDDING') {
            playSound('card');
        } else if (state.currentBid > lastState.currentBid) {
            playSound('bid');
        }
        if (state.trumpSuit && state.trumpSuit !== lastState.trumpSuit) {
            playSound('marriage');
        }
        if ((state.phase === 'ROUND_OVER' || state.phase === 'GAME_OVER') && lastState.phase === 'PLAYING') {
            playSound('win');
        }
    }

    lastState = state;
    currentRoomCode = state.roomCode;
    sessionStorage.setItem('tukstantis_room', state.roomCode);

    document.getElementById('lobbyScreen').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'flex';
    document.getElementById('displayRoomCode').innerText = state.roomCode;
    document.getElementById('statusText').innerText = state.statusText;

    const trumpEl = document.getElementById('trumpBadge');
    if (state.trumpSuit) {
        trumpEl.style.display = 'inline-block';
        trumpEl.innerText = 'Koziris: ' + state.trumpSuit;
    } else {
        trumpEl.style.display = 'none';
    }

    const myIdx = state.mySeatIndex;
    const leftIdx = (myIdx + 1) % 3;
    const rightIdx = (myIdx + 2) % 3;

    const me = state.seats.at(myIdx);
    const left = state.seats.at(leftIdx);
    const right = state.seats.at(rightIdx);

    document.getElementById('meAvatar').innerText = me.avatar;
    document.getElementById('meHeader').innerText = me.name + ' | Bendri: ' + formatTotalScore(me.totalScore) + ' / 1000 | Partijoje: ' + me.roundScore;
    document.getElementById('box-me').classList.toggle('active-turn', state.currentTurnIndex === myIdx && state.phase !== 'LOBBY' && state.phase !== 'ROUND_OVER');

    document.getElementById('leftAvatar').innerText = left.avatar;
    document.getElementById('leftName').innerText = left.name;
    document.getElementById('leftTotal').innerText = formatTotalScore(left.totalScore);
    document.getElementById('leftRound').innerText = left.roundScore;
    document.getElementById('leftCount').innerText = left.cardCount;
    document.getElementById('leftBid').innerText = left.bidStatus;
    document.getElementById('box-left').classList.toggle('active-turn', state.currentTurnIndex === leftIdx && state.phase !== 'LOBBY' && state.phase !== 'ROUND_OVER');

    document.getElementById('rightAvatar').innerText = right.avatar;
    document.getElementById('rightName').innerText = right.name;
    document.getElementById('rightTotal').innerText = formatTotalScore(right.totalScore);
    document.getElementById('rightRound').innerText = right.roundScore;
    document.getElementById('rightCount').innerText = right.cardCount;
    document.getElementById('rightBid').innerText = right.bidStatus;
    document.getElementById('box-right').classList.toggle('active-turn', state.currentTurnIndex === rightIdx && state.phase !== 'LOBBY' && state.phase !== 'ROUND_OVER');

    renderControls(state);
    renderTableCenter(state);
    renderMyCards(state);
    renderDiscarded(state);
});

let choosingNineToHide = false;

function getSuitPointsLabel(suit) {
    if (suit === '♣') return '100 tšk.';
    if (suit === '♠') return '80 tšk.';
    if (suit === '♥') return '60 tšk.';
    return '40 tšk.';
}

function renderControls(state) {
    const area = document.getElementById('controlsArea');
    area.innerHTML = '';

    // Jei vyksta 3 devynakių spėliojimo etapas
    if (state.phase === 'NINE_GUESS' && state.nineGuess) {
        choosingNineToHide = false;
        if (state.nineGuess.giverIndex === state.mySeatIndex) {
            const info = document.createElement('div');
            info.style.cssText = 'color:#fde68a; font-weight:bold; padding:8px;';
            info.innerText = '⏳ Laukiame, kol kiti žaidėjai atspės tavo paslėptą devynakę...';
            area.appendChild(info);
        } else if (state.nineGuess.hasGuessed) {
            const info = document.createElement('div');
            info.style.cssText = 'color:#10b981; font-weight:bold; padding:8px;';
            info.innerText = '✅ Tavo spėjimas užfiksuotas! Laukiame kito žaidėjo...';
            area.appendChild(info);
        } else {
            ['♣', '♠', '♥', '♦'].forEach(s => {
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
        if (state.mySeatIndex === 0) {
            addButton('🚀 Pradėti žaidimą (tuščias vietas užims botai)', 'success', () => {
                socket.emit('startGame', currentRoomCode);
            });
        }
    } else if (state.phase === 'BIDDING' && isMyTurn) {
        if (!state.myCardsRevealed) {
            addButton('👀 Atversti kortas', '', () => { playSound('card'); socket.emit('revealCards', currentRoomCode); });
            addButton('🙈 Statyti AKLAI (' + (state.currentBid + 10) + ') [x2]', 'success', () => {
                socket.emit('placeBid', { roomCode: currentRoomCode, blind: true });
            });
        } else {
            addButton('Statyti ' + (state.currentBid + 10), '', () => {
                socket.emit('placeBid', { roomCode: currentRoomCode, blind: false });
            });
        }
        if (!amIHighestBidder || state.currentBid > 100) {
            addButton('Pasuoti', 'danger', () => { playSound('bid'); socket.emit('passBid', currentRoomCode); });
        }
    } else if (state.phase === 'RAISE_BID' && amIHighestBidder) {
        if (state.currentBid - 20 >= state.minBidAfterWin) {
            addButton('📉 -20 (' + (state.currentBid - 20) + ')', 'danger', () => socket.emit('adjustBidAfterTalon', { roomCode: currentRoomCode, delta: -20 }));
        }
        if (state.currentBid - 10 >= state.minBidAfterWin) {
            addButton('🔽 -10 (' + (state.currentBid - 10) + ')', 'danger', () => socket.emit('adjustBidAfterTalon', { roomCode: currentRoomCode, delta: -10 }));
        }
        addButton('✅ Pradėti žaidimą su ' + state.currentBid, 'success', () => { playSound('bid'); socket.emit('confirmBidAndPlay', currentRoomCode); });
        if (state.currentBid + 10 <= 300) {
            addButton('📈 +10 (' + (state.currentBid + 10) + ')', '', () => socket.emit('adjustBidAfterTalon', { roomCode: currentRoomCode, delta: 10 }));
        }
        if (state.currentBid + 20 <= 300) {
            addButton('🔥 +20 (' + (state.currentBid + 20) + ')', '', () => socket.emit('adjustBidAfterTalon', { roomCode: currentRoomCode, delta: 20 }));
        }
        if (state.currentBid + 50 <= 300) {
            addButton('🚀 +50 (' + (state.currentBid + 50) + ')', '', () => socket.emit('adjustBidAfterTalon', { roomCode: currentRoomCode, delta: 50 }));
        }
    } else if (state.phase === 'ROUND_OVER' && state.mySeatIndex === 0) {
        addButton('Dalinti kitą partiją ➡️', 'success', () => socket.emit('nextRound', currentRoomCode));
    } else if (state.phase === 'GAME_OVER' && state.mySeatIndex === 0) {
        addButton('Žaisti naują žaidimą 🔄', 'success', () => socket.emit('startGame', currentRoomCode));
    }

    // 3 devynakių spėjimo pasiūlymas
    const myNines = (state.myHand || []).filter(c => c.name === '9');
    const canOfferNineGuess = state.myCardsRevealed && myNines.length === 3 && !state.myUsedNineGuess && (
        state.phase === 'BIDDING' ||
        ((state.phase === 'DISCARD_3' || state.phase === 'RAISE_BID') && amIHighestBidder)
    );

    if (canOfferNineGuess) {
        if (!choosingNineToHide) {
            addButton('🔮 Duoti spėti 9-akę (turi 3 devynakes)', '', () => {
                choosingNineToHide = true;
                renderControls(lastState);
            });
        } else {
            myNines.forEach(c => {
                addButton('Paslėpti: 9' + c.suit + ' (' + getSuitPointsLabel(c.suit) + ')', 'success', () => {
                    choosingNineToHide = false;
                    playSound('marriage');
                    socket.emit('startNineGuess', { roomCode: currentRoomCode, suit: c.suit });
                });
            });
            addButton('Atšaukti', 'danger', () => {
                choosingNineToHide = false;
                renderControls(lastState);
            });
        }
    }

    // Vienkartinė pagalba „Duoti pliusą“
    const canGivePlus = !state.myUsedPlus && (
        state.phase === 'BIDDING' ||
        ((state.phase === 'DISCARD_3' || state.phase === 'RAISE_BID') && amIHighestBidder)
    );
    if (canGivePlus) {
        addButton('➕ Duoti pliusą (kitiems po +60 tšk.)', 'danger', () => {
            if (confirm('Ar tikrai nori panaudoti savo vienkartinę pagalbą „Duoti pliusą“? Likusiems žaidėjams bus pridėta po +60 taškų.')) {
                playSound('bid');
                socket.emit('givePlus', currentRoomCode);
            }
        });
    }
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
        if (state.talon.length > 0) {
            state.talon.forEach(c => {
                const div = document.createElement('div');
                div.className = 'card ' + (c.isRed ? 'red' : '');
                div.innerHTML = '<div>' + c.name + '</div><div>' + c.suit + '</div>';
                container.appendChild(div);
            });
        } else {
            for (let i = 0; i < state.talonCount; i++) {
                const div = document.createElement('div');
                div.className = 'card hidden';
                container.appendChild(div);
            }
        }
    } else {
        title.innerText = 'Kirtis ant stalo (Šaukimas: ' + state.currentBid + ')';
        state.trickCards.forEach(item => {
            const wrapper = document.createElement('div');
            wrapper.style.textAlign = 'center';

            const div = document.createElement('div');
            div.className = 'card ' + (item.card.isRed ? 'red' : '');
            div.innerHTML = '<div>' + item.card.name + '</div><div>' + item.card.suit + '</div>';

            const lbl = document.createElement('div');
            lbl.style.fontSize = '11px';
            lbl.style.marginTop = '3px';
            lbl.innerText = state.seats.at(item.seatIndex).name;

            wrapper.appendChild(div);
            wrapper.appendChild(lbl);
            container.appendChild(wrapper);
        });
    }
}

function renderMyCards(state) {
    const container = document.getElementById('playerCards');
    container.innerHTML = '';

    const isMyTurn = (state.currentTurnIndex === state.mySeatIndex);
    const canClick = (state.phase === 'DISCARD_3' && isMyTurn) || (state.phase === 'PLAYING' && isMyTurn);

    let indexedHand = state.myHand.map((card, originalIndex) => ({ card, originalIndex }));
    if (state.myCardsRevealed) {
        indexedHand.sort((a, b) => a.card.suit.localeCompare(b.card.suit) || b.card.power - a.card.power);
    }

    indexedHand.forEach(item => {
        const div = document.createElement('div');
        if (state.myCardsRevealed) {
            div.className = 'card ' + (item.card.isRed ? 'red' : '') + (canClick ? ' clickable' : '');
            div.innerHTML = '<div>' + item.card.name + '</div><div>' + item.card.suit + '</div>';
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
} else {
div.className = 'card hidden';
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
const bidderName = state.seats.at(state.highestBidderIndex).name;
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
function sendChatMessage(textToSend) {
if (!currentRoomCode) return;
const input = document.getElementById('chatInput');
const msg = textToSend || input.value.trim();
if (!msg) return;
socket.emit('sendChat', { roomCode: currentRoomCode, message: msg });
if (!textToSend) input.value = '';
}
const chatBtn = document.getElementById('chatSendBtn');
if (chatBtn) {
chatBtn.addEventListener('click', () => sendChatMessage());
}
const chatInp = document.getElementById('chatInput');
if (chatInp) {
chatInp.addEventListener('keypress', (e) => {
if (e.key === 'Enter') sendChatMessage();
});
}
document.querySelectorAll('.emoji-btn').forEach(btn => {
btn.addEventListener('click', () => {
sendChatMessage(btn.getAttribute('data-emoji'));
});
});
socket.on('chatMessage', ({ sender, avatar, text }) => {
playSound('chat');
const box = document.getElementById('chatMessages');
if (!box) return;
const div = document.createElement('div');
div.className = 'chat-msg';
div.innerHTML = '' + avatar + ' ' + sender + ':' + text + '';
box.appendChild(div);
box.scrollTop = box.scrollHeight;
});
// --- PERGALĖS KONFETI IR SUDEGIMO ANIMACIJOS ---
const animStyle = document.createElement('style');
animStyle.innerHTML = `
@keyframes screenShake {
    0%, 100% { transform: translateX(0); }
    15%, 45%, 75% { transform: translateX(-8px); }
    30%, 60%, 90% { transform: translateX(8px); }
}
.burn-effect {
    animation: screenShake 0.45s ease-in-out;
    box-shadow: inset 0 0 90px rgba(239, 68, 68, 0.85) !important;
}
`;
document.head.appendChild(animStyle);

function triggerBurnAnimation() {
    document.body.classList.remove('burn-effect');
    void document.body.offsetWidth;
    document.body.classList.add('burn-effect');
    if (navigator.vibrate) navigator.vibrate([150, 80, 150]);
    setTimeout(() => document.body.classList.remove('burn-effect'), 700);
}

function triggerConfettiAnimation() {
    const colors = ['#fbbf24', '#10b981', '#ef4444', '#3b82f6', '#ec4899', '#a855f7'];
    for (let i = 0; i < 110; i++) {
        const conf = document.createElement('div');
        const size = Math.random() * 8 + 6;
        conf.style.cssText = 'position:fixed; top:-15px; left:' + (Math.random() * 100) + 'vw; width:' + size + 'px; height:' + (size * 1.4) + 'px; background:' + colors[Math.floor(Math.random() * colors.length)] + '; z-index:9999; pointer-events:none; border-radius:2px;';
        document.body.appendChild(conf);

        const duration = Math.random() * 2000 + 2200;
        const drift = (Math.random() - 0.5) * 200;
        const rot = Math.random() * 720 + 360;

        conf.animate([
            { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
            { transform: 'translate(' + drift + 'px, 105vh) rotate(' + rot + 'deg)', opacity: 0.2 }
        ], { duration: duration, easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' });

        setTimeout(() => conf.remove(), duration);
    }
}

socket.on('gameState', (state) => {
    if (state.statusText && state.statusText.includes('SUDEGĖ') && (!lastState || lastState.statusText !== state.statusText)) {
        triggerBurnAnimation();
    }
    if (state.phase === 'GAME_OVER' && (!lastState || lastState.phase !== 'GAME_OVER')) {
        triggerConfettiAnimation();
    }
});
// --- AUTOMATINIS PNG IKONĖLĖS GENERAVIMAS TELEFONAMS ---
(function generateAppIcon() {
    try {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // Tamsiai žalias stalo fonas
        ctx.fillStyle = '#064e3b';
        ctx.fillRect(0, 0, 512, 512);

        // Auksinis rėmelis
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 22;
        ctx.strokeRect(24, 24, 464, 464);

        // Užrašas 1000
        ctx.fillStyle = '#fbbf24';
        ctx.font = '900 135px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('1000', 256, 225);

        // Kryžiaus simbolis
        ctx.fillStyle = '#ffffff';
        ctx.font = '180px Arial, sans-serif';
        ctx.fillText('♣', 256, 405);

        const pngUrl = canvas.toDataURL('image/png');
        document.querySelectorAll('link[rel*="icon"]').forEach(el => el.href = pngUrl);
    } catch (e) {}
})();
// PABAIGA

