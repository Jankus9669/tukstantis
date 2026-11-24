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
let choosingNineToHide = false;

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
if (roomBannerEl) roomBannerEl.appendChild(soundBtn);

const extraStyle = document.createElement('style');
extraStyle.innerHTML = `
@keyframes screenShake {
    0%, 100% { transform: translateX(0); }
    15%, 45%, 75% { transform: translateX(-8px); }
    30%, 60%, 90% { transform: translateX(8px); }
}
.burn-effect { animation: screenShake 0.45s ease-in-out; box-shadow: inset 0 0 90px rgba(239, 68, 68, 0.85) !important; }
@keyframes goldShimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
}
.card.hidden::after {
    background-image: linear-gradient(120deg, transparent 30%, rgba(255, 255, 255, 0.65) 50%, transparent 70%);
    background-size: 200% 100%;
    animation: goldShimmer 3.2s infinite linear;
}
.poker-table.blind-aura { box-shadow: inset 0 0 80px rgba(168, 85, 247, 0.55), 0 0 35px rgba(168, 85, 247, 0.7) !important; border-color: #7e22ce !important; }
.poker-table.marriage-aura { box-shadow: inset 0 0 90px rgba(251, 191, 36, 0.75), 0 0 45px rgba(251, 191, 36, 0.9) !important; }
@keyframes barrelPulse {
    0%, 100% { box-shadow: 0 0 12px rgba(249, 115, 22, 0.6); }
    50% { box-shadow: 0 0 26px rgba(239, 68, 68, 1); }
}
.on-barrel { animation: barrelPulse 1.6s infinite ease-in-out; border-color: #f97316 !important; }
.trick-fly-me { transform: translate(0, 140px) scale(0.2) rotate(25deg) !important; opacity: 0 !important; transition: all 0.55s ease-in !important; }
.trick-fly-left { transform: translate(-180px, -110px) scale(0.2) rotate(-35deg) !important; opacity: 0 !important; transition: all 0.55s ease-in !important; }
.trick-fly-right { transform: translate(180px, -110px) scale(0.2) rotate(35deg) !important; opacity: 0 !important; transition: all 0.55s ease-in !important; }
`;
document.head.appendChild(extraStyle);

function triggerBurnAnimation() {
    document.body.classList.remove('burn-effect');
    void document.body.offsetWidth;
    document.body.classList.add('burn-effect');
    setTimeout(() => {
        document.body.classList.remove('burn-effect');
    }, 1200);
    try {
        if (navigator.vibrate) navigator.vibrate([180, 80, 180]);
    } catch (e) {}
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

document.addEventListener('mousemove', (e) => {
    const table = document.querySelector('.poker-table');
    if (!table || window.innerWidth <= 768) return;
    const xAxis = (window.innerWidth / 2 - e.pageX) / 65;
    const yAxis = (window.innerHeight / 2 - e.pageY) / 65;
    table.style.transform = 'rotateX(' + (14 + yAxis) + 'deg) rotateY(' + (-xAxis) + 'deg)';
});

window.addEventListener('deviceorientation', (e) => {
    const table = document.querySelector('.poker-table');
    if (!table || !e.gamma || !e.beta) return;
    const tiltX = Math.max(-8, Math.min(8, e.gamma / 5));
    const tiltY = Math.max(-5, Math.min(5, (e.beta - 45) / 8));
    table.style.transform = 'rotateX(' + (10 + tiltY) + 'deg) rotateY(' + tiltX + 'deg)';
});
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
    if (!code) { alert('Įrašyk kambario kodą!'); return; }
    socket.emit('joinRoom', { roomCode: code, playerName: name, avatar: selectedAvatar, playerToken: playerToken });
});

socket.on('errorMsg', (msg) => alert(msg));

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

function getSuitPointsLabel(suit) {
    if (suit === '♣') return '100 tšk.';
    if (suit === '♠') return '80 tšk.';
    if (suit === '♥') return '60 tšk.';
    return '40 tšk.';
}

socket.on('gameState', (state) => {
    if (lastState) {
        if (state.trickCards.length > lastState.trickCards.length) playSound('card');
        else if (state.phase === 'BIDDING' && lastState.phase !== 'BIDDING') playSound('card');
        else if (state.currentBid > lastState.currentBid) playSound('bid');
        if (state.trumpSuit && state.trumpSuit !== lastState.trumpSuit) playSound('marriage');
        if ((state.phase === 'ROUND_OVER' || state.phase === 'GAME_OVER') && lastState.phase === 'PLAYING') playSound('win');
        if (state.statusText && state.statusText.includes('SUDEGĖ') && lastState.statusText !== state.statusText) triggerBurnAnimation();
        if (state.phase === 'GAME_OVER' && lastState.phase !== 'GAME_OVER') triggerConfettiAnimation();
    }
    if (state.phase === 'BIDDING' || state.phase === 'LOBBY') {
        document.body.classList.remove('burn-effect');
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

    const meBox = document.getElementById('box-me');
    const leftBox = document.getElementById('box-left');
    const rightBox = document.getElementById('box-right');

    document.getElementById('meAvatar').innerText = me.avatar;
    document.getElementById('meHeader').innerText = me.name + ' | Bendri: ' + formatTotalScore(me.totalScore) + ' / 1000 | Partijoje: ' + me.roundScore;
    meBox.classList.toggle('active-turn', state.currentTurnIndex === myIdx && state.phase !== 'LOBBY' && state.phase !== 'ROUND_OVER');
    meBox.classList.toggle('on-barrel', me.totalScore >= 900);

    document.getElementById('leftAvatar').innerText = left.avatar;
    document.getElementById('leftName').innerText = left.name;
    document.getElementById('leftTotal').innerText = formatTotalScore(left.totalScore);
    document.getElementById('leftRound').innerText = left.roundScore;
    document.getElementById('leftCount').innerText = left.cardCount;
    document.getElementById('leftBid').innerText = left.bidStatus;
    leftBox.classList.toggle('active-turn', state.currentTurnIndex === leftIdx && state.phase !== 'LOBBY' && state.phase !== 'ROUND_OVER');
    leftBox.classList.toggle('on-barrel', left.totalScore >= 900);

    document.getElementById('rightAvatar').innerText = right.avatar;
    document.getElementById('rightName').innerText = right.name;
    document.getElementById('rightTotal').innerText = formatTotalScore(right.totalScore);
    document.getElementById('rightRound').innerText = right.roundScore;
    document.getElementById('rightCount').innerText = right.cardCount;
    document.getElementById('rightBid').innerText = right.bidStatus;
    rightBox.classList.toggle('active-turn', state.currentTurnIndex === rightIdx && state.phase !== 'LOBBY' && state.phase !== 'ROUND_OVER');
    rightBox.classList.toggle('on-barrel', right.totalScore >= 900);

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
        else if (state.statusText.includes('AKLAI') || state.seats.some(s => s.isBlind)) { dealerEmoji.innerText = '😎'; dealerSub.innerText = 'Drąsus ėjimas!'; }
        else if (state.phase === 'GAME_OVER') { dealerEmoji.innerText = '🏆'; dealerSub.innerText = 'Sveikinimai!'; }
        else { dealerEmoji.innerText = '🤵'; dealerSub.innerText = 'Prižiūri stalą'; }
    }

    renderControls(state);
    renderTableCenter(state, leftIdx, rightIdx);
    renderMyCards(state);
    renderDiscarded(state);
});
function renderControls(state) {
    const area = document.getElementById('controlsArea');
    area.innerHTML = '';

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
            (state.nineGuess.availableSuits || ['♣', '♠', '♥', '♦']).forEach(s => {
                addButton('Spėju: 9' + s + ' (' + getSuitPointsLabel(s) + ')', '', () => {
                    playSound('bid');
                    socket.emit('submitNineGuess', { roomCode: currentRoomCode, suit: s });
                });
            });
        }


    const isMyTurn = (state.currentTurnIndex === state.mySeatIndex);
    const amIHighestBidder = (state.highestBidderIndex === state.mySeatIndex);

    if (state.phase === 'LOBBY') {
        if (state.mySeatIndex === 0) {
            addButton('🚀 Pradėti žaidimą (tuščias vietas užims botai)', 'success', () => socket.emit('startGame', currentRoomCode));
        }
    } else if (state.phase === 'BIDDING' && isMyTurn) {
        if (!state.myCardsRevealed) {
            addButton('👀 Atversti kortas', '', () => { playSound('card'); socket.emit('revealCards', currentRoomCode); });
            addButton('🙈 Statyti AKLAI (' + (state.currentBid + 10) + ') [x2]', 'success', () => socket.emit('placeBid', { roomCode: currentRoomCode, blind: true }));
        } else {
            addButton('Statyti ' + (state.currentBid + 10), '', () => socket.emit('placeBid', { roomCode: currentRoomCode, blind: false }));
        }
        if (!amIHighestBidder || state.currentBid > 100) {
            addButton('Pasuoti', 'danger', () => { playSound('bid'); socket.emit('passBid', currentRoomCode); });
        }
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
}

function renderTableCenter(state, leftIdx, rightIdx) {
    const title = document.getElementById('centerTitle');
    const container = document.getElementById('tableCards');
    container.innerHTML = '';
    container.classList.remove('trick-fly-me', 'trick-fly-left', 'trick-fly-right');

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

        if (state.trickCards.length === 3 && state.statusText && state.statusText.includes('Kirtį paėmė')) {
            const winnerName = state.seats.find(s => state.statusText.includes(s.name));
            if (winnerName) {
                let flyClass = 'trick-fly-me';
                if (winnerName.index === leftIdx) flyClass = 'trick-fly-left';
                else if (winnerName.index === rightIdx) flyClass = 'trick-fly-right';
                setTimeout(() => container.classList.add(flyClass), 750);
            }
        }
    }
}
function renderMyCards(state) {
    const container = document.getElementById('playerCards');
    const tableEl = document.querySelector('.poker-table');
    container.innerHTML = '';

    // Pašaliname seną užverstų kortų krūvelę ant stalo, jei ji buvo
    const oldTableHand = document.getElementById('myTableFaceDownHand');
    if (oldTableHand) oldTableHand.remove();

    // Jei kortos dar užverstos (ne LOBBY fazėje) – padedame jas ant stalo prieš žaidėją
    if (!state.myCardsRevealed && state.myHand && state.myHand.length > 0 && state.phase !== 'LOBBY') {
        const hint = document.createElement('div');
        hint.style.cssText = 'color:#94a3b8; font-size:13px; padding:12px; font-style:italic;';
        hint.innerText = '🂠 Tavo užverstos kortos guli ant stalo...';
        container.appendChild(hint);

        if (tableEl) {
            const tablePile = document.createElement('div');
            tablePile.id = 'myTableFaceDownHand';
            tablePile.title = 'Paspausk, kad paimtum kortas į rankas';
            tablePile.style.cssText = 'position:absolute; bottom:14px; left:50%; transform:translateX(-50%); display:flex; justify-content:center; z-index:15; cursor:pointer;';

            state.myHand.forEach((_, idx) => {
                const div = document.createElement('div');
                div.className = 'card small hidden';
                const angle = (idx - 3) * 4;
                div.style.cssText = 'margin-left:' + (idx === 0 ? '0' : '-18px') + '; transform:rotate(' + angle + 'deg); box-shadow:0 4px 10px rgba(0,0,0,0.7); transition:transform 0.2s;';
                tablePile.appendChild(div);
            });

            // Leidžiame atversti ir paspaudus tiesiai ant kortų ant stalo (kai ateina eilė)
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

    // Kai kortos atverstos – jos paimtos į rankas
    const isMyTurn = (state.currentTurnIndex === state.mySeatIndex);
    const canClick = (state.phase === 'DISCARD_3' && isMyTurn) || (state.phase === 'PLAYING' && isMyTurn);

    let indexedHand = state.myHand.map((card, originalIndex) => ({ card, originalIndex }));
    indexedHand.sort((a, b) => a.card.suit.localeCompare(b.card.suit) || b.card.power - a.card.power);

    indexedHand.forEach(item => {
        const div = document.createElement('div');
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
            div.innerHTML = '<div>' + c.name + '</div><div>' + c.suit + '</div>';
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
if (chatBtn) chatBtn.addEventListener('click', () => sendChatMessage());

const chatInp = document.getElementById('chatInput');
if (chatInp) {
    chatInp.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });
}

document.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.addEventListener('click', () => sendChatMessage(btn.getAttribute('data-emoji')));
});

socket.on('chatMessage', ({ sender, avatar, text }) => {
    playSound('chat');
    const box = document.getElementById('chatMessages');
    if (!box) return;
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = '<div class="chat-sender">' + avatar + ' ' + sender + ':</div><div>' + text + '</div>';
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
});
// --- SAUSO SUTRIUŠKINIMO (0 KIRČIŲ PRIEŠININKAMS) EFEKTAS ---
const sweepStyle = document.createElement('style');
sweepStyle.innerHTML = `
@keyframes sweepPop {
    0% { transform: translate(-50%, -50%) scale(0.3) rotate(-8deg); opacity: 0; }
    60% { transform: translate(-50%, -50%) scale(1.08) rotate(2deg); opacity: 1; }
    100% { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 1; }
}
.sweep-banner {
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    background: radial-gradient(circle, #7f1d1d 0%, #1e1b4b 100%);
    border: 4px solid #fbbf24; border-radius: 24px; padding: 24px 32px;
    text-align: center; z-index: 10000; max-width: 90%; width: 420px;
    box-shadow: 0 0 60px rgba(239, 68, 68, 0.9), 0 0 100px rgba(251, 191, 36, 0.6);
    animation: sweepPop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    cursor: pointer;
}
`;
document.head.appendChild(sweepStyle);

let lastSweepText = '';
socket.on('gameState', (state) => {
    if (state.statusText && state.statusText.includes('SAUSAS SUTRIUŠKINIMAS') && lastSweepText !== state.statusText) {
        lastSweepText = state.statusText;
        playSound('marriage');
        setTimeout(() => playSound('win'), 250);
        triggerConfettiAnimation();

        const winnerObj = state.seats.find(s => state.statusText.includes(s.name + ' sudorojo'));
        const wName = winnerObj ? winnerObj.name : 'Žaidėjas';

        const banner = document.createElement('div');
        banner.className = 'sweep-banner';
        banner.innerHTML = '<div style="font-size:54px; margin-bottom:6px;">⚔️👑⚔️</div>' +
            '<div style="font-size:24px; font-weight:900; color:#fbbf24; letter-spacing:1px; text-shadow:0 2px 10px rgba(0,0,0,0.8);">SAUSAS SUTRIUŠKINIMAS!</div>' +
            '<div style="font-size:15px; color:#f8fafc; margin-top:8px; line-height:1.4;"><strong>' + wName + '</strong> visiškai sudorojo priešininkus nedavęs jiems nė vieno kirčio!</div>';
        banner.addEventListener('click', () => banner.remove());
        document.body.appendChild(banner);
        setTimeout(() => banner.remove(), 4500);
    }
});
// --- 5D VIZUALIZACIJA: DALELĖS, PROŽEKTORIUS, RATILAI IR HAPTIKA ---
const style5D = document.createElement('style');
style5D.innerHTML = `
@keyframes floatDust {
    0% { transform: translateY(0) scale(0.8); opacity: 0; }
    30% { opacity: 0.75; }
    100% { transform: translateY(-160px) scale(1.2); opacity: 0; }
}
.gold-dust {
    position: absolute;
    width: 4px;
    height: 4px;
    background: radial-gradient(circle, #fde68a 0%, #f59e0b 100%);
    border-radius: 50%;
    pointer-events: none;
    box-shadow: 0 0 8px #fbbf24;
    z-index: 2;
}
@keyframes rippleWave {
    0% { transform: translate(-50%, -50%) scale(0.2); opacity: 0.9; }
    100% { transform: translate(-50%, -50%) scale(3.5); opacity: 0; }
}
.touch-ripple {
    position: fixed;
    width: 40px;
    height: 40px;
    border: 2px solid #fbbf24;
    border-radius: 50%;
    pointer-events: none;
    z-index: 9998;
    animation: rippleWave 0.65s ease-out forwards;
}
.card.spotlight-card {
    background-image: radial-gradient(circle at var(--mx, 50%) var(--my, 50%), rgba(255,255,255,0.65) 0%, transparent 60%), linear-gradient(145deg, #ffffff 0%, #fefce8 65%, #fef3c7 100%) !important;
}
`;
document.head.appendChild(style5D);

// 1. Plaukiojančios auksinės dulkelės virš stalo
setInterval(() => {
    const table = document.querySelector('.poker-table');
    if (!table || document.getElementById('gameScreen').style.display === 'none') return;
    const dust = document.createElement('div');
    dust.className = 'gold-dust';
    dust.style.left = (Math.random() * 80 + 10) + '%';
    dust.style.top = (Math.random() * 60 + 30) + '%';
    const dur = Math.random() * 2500 + 2500;
    dust.style.animation = 'floatDust ' + dur + 'ms ease-out forwards';
    table.appendChild(dust);
    setTimeout(() => dust.remove(), dur);
}, 450);

// 2. Dinaminis šviesos prožektorius ant kortų vedant pelę
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

// 3. Auksinis šviesos ratilas ir jutiminė vibracija palietus / paspaudus
document.addEventListener('pointerdown', (e) => {
    const ripple = document.createElement('div');
    ripple.className = 'touch-ripple';
    ripple.style.left = e.clientX + 'px';
    ripple.style.top = e.clientY + 'px';
    document.body.appendChild(ripple);
    setTimeout(() => ripple.remove(), 650);

    if (navigator.vibrate) {
        if (e.target.closest('.card.clickable')) navigator.vibrate(25);
        else if (e.target.closest('button')) navigator.vibrate(15);
    }
});

// --- 10D VIZUALIZACIJA: HOLOGRAMOS, KOMETOS, ŽAIBAI IR SMŪGIO BANGOS ---
const style10D = document.createElement('style');
style10D.innerHTML = `
@keyframes holoShift {
    0% { filter: hue-rotate(0deg) brightness(1.05); }
    50% { filter: hue-rotate(45deg) brightness(1.15); }
    100% { filter: hue-rotate(0deg) brightness(1.05); }
}
.card.holo-card {
    border: 2px solid #f59e0b !important;
    box-shadow: 0 0 18px rgba(251, 191, 36, 0.75), inset 0 0 12px rgba(253, 224, 71, 0.5) !important;
    animation: holoShift 3s infinite ease-in-out;
}
@keyframes shockwave10D {
    0% { transform: translate(-50%, -50%) scale(0.1); opacity: 1; border-width: 6px; }
    100% { transform: translate(-50%, -50%) scale(4.5); opacity: 0; border-width: 1px; }
}
.table-shockwave {
    position: absolute; top: 50%; left: 50%; width: 120px; height: 120px;
    border: 6px solid #fbbf24; border-radius: 50%; pointer-events: none; z-index: 50;
    animation: shockwave10D 0.85s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
@keyframes laserSpin {
    0% { box-shadow: 0 0 15px #fbbf24, inset 0 0 10px #fbbf24; }
    50% { box-shadow: 0 0 32px #34d399, inset 0 0 18px #34d399; }
    100% { box-shadow: 0 0 15px #fbbf24, inset 0 0 10px #fbbf24; }
}
.active-turn {
    animation: laserSpin 1.4s infinite ease-in-out !important;
}
@keyframes coinFall10D {
    0% { transform: translateY(-20px) rotateY(0deg) scale(0.8); opacity: 1; }
    100% { transform: translateY(340px) rotateY(720deg) scale(1.1); opacity: 0; }
}
.gold-coin-10d {
    position: absolute; font-size: 20px; pointer-events: none; z-index: 60;
    text-shadow: 0 0 10px #fbbf24;
}
`;
document.head.appendChild(style10D);

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

// Pridedame holografinį spindesį Tūzams (A) ir Dešimtakėms (10)
setInterval(() => {
    document.querySelectorAll('#playerCards .card:not(.hidden)').forEach(card => {
        const txt = card.innerText || '';
        if (txt.startsWith('A') || txt.startsWith('10')) {
            card.classList.add('holo-card');
        }
    });
}, 500);

// Reaguojame į įvykius ant stalo 10D bangomis ir aukso lietumi
let lastStatus10D = '';
socket.on('gameState', (state) => {
    if (state.statusText && state.statusText !== lastStatus10D) {
        lastStatus10D = state.statusText;
        if (state.statusText.includes('PORĄ')) {
            triggerTableShockwave('#fbbf24');
            triggerGoldRain10D();
            if (navigator.vibrate) try { navigator.vibrate([40, 30, 80]); } catch (e) {}
        } else if (state.statusText.includes('Kirtį paėmė')) {
            const match = state.statusText.match(/\+(\d+)/);
            const pts = match ? Number(match[1]) : 0;
            if (pts >= 20) {
                triggerTableShockwave('#10b981');
                if (navigator.vibrate) try { navigator.vibrate(50); } catch (e) {}
            } else {
                triggerTableShockwave('rgba(255,255,255,0.45)');
          
        }
    }
});
}
// PABAIGA


