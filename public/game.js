const socket = io();
let currentRoomCode = null;
let myPlayerId = localStorage.getItem('tukstantis_pid');
if (!myPlayerId) {
    myPlayerId = 'pid_' + Math.random().toString(36).substring(2, 12) + '_' + Date.now();
    localStorage.setItem('tukstantis_pid', myPlayerId);
}

let lastState = null;
let choosingNineToHide = false;
let soundEnabled = true;

// --- GARSŲ SISTEMA (Web Audio API) ---
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function playSound(type) {
    if (!soundEnabled) return;
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

// --- VIZUALINIAI EFEKTAI (SUDEGIMAS IR KONFETI) ---
function triggerBurnAnimation() {
    document.body.classList.remove('burn-effect');
    void document.body.offsetWidth;
    document.body.classList.add('burn-effect');
    setTimeout(() => {
        document.body.classList.remove('burn-effect');
    }, 1200);
    try {
        if (navigator.vibrate) navigator.vibrate();
    } catch (e) {}
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
// --- PAGALBINĖS FUNKCIJOS ---
function getSelectedAvatar() {
    const active = document.querySelector('#avatarPicker .avatar-opt.selected');
    return active ? active.getAttribute('data-avatar') : '😎';
}

function getSuitPointsLabel(suit) {
    if (suit === '♥') return '100 tšk.';
    if (suit === '♦') return '80 tšk.';
    if (suit === '♣') return '60 tšk.';
    if (suit === '♠') return '40 tšk.';
    return '';
}

function saveSession(roomCode, playerName, avatar) {
    localStorage.setItem('tukstantis_session', JSON.stringify({ roomCode, playerName, avatar }));
}

function clearSession() {
    localStorage.removeItem('tukstantis_session');
}

// --- PRISIJUNGIMAS IR KAMBARIAI ---
document.querySelectorAll('#avatarPicker .avatar-opt').forEach(el => {
    el.addEventListener('click', () => {
        document.querySelectorAll('#avatarPicker .avatar-opt').forEach(x => x.classList.remove('selected'));
        el.classList.add('selected');
    });
});

document.getElementById('createRoomBtn').addEventListener('click', () => {
    const name = document.getElementById('playerNameInput').value.trim() || 'Žaidėjas';
    const avatar = getSelectedAvatar();
    socket.emit('createRoom', { playerName: name, avatar, playerId: myPlayerId });
});

document.getElementById('joinRoomBtn').addEventListener('click', () => {
    const name = document.getElementById('playerNameInput').value.trim() || 'Žaidėjas';
    const avatar = getSelectedAvatar();
    const code = document.getElementById('roomCodeInput').value.trim().toUpperCase();
    if (!code) {
        document.getElementById('lobbyError').innerText = 'Įvesk kambario kodą!';
        return;
    }
    socket.emit('joinRoom', { roomCode: code, playerName: name, avatar, playerId: myPlayerId });
});

socket.on('roomJoined', ({ roomCode }) => {
    currentRoomCode = roomCode;
    const name = document.getElementById('playerNameInput').value.trim() || 'Žaidėjas';
    const avatar = getSelectedAvatar();
    saveSession(roomCode, name, avatar);

    document.getElementById('lobbyScreen').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'flex';
    document.getElementById('roomCodeDisplay').innerText = roomCode;
    document.getElementById('lobbyError').innerText = '';
});

socket.on('errorMsg', (msg) => {
    document.getElementById('lobbyError').innerText = msg;
    if (msg.includes('neegzistuoja')) clearSession();
});

socket.on('connect', () => {
    const saved = localStorage.getItem('tukstantis_session');
    if (saved) {
        try {
            const { roomCode, playerName, avatar } = JSON.parse(saved);
            if (roomCode) {
                socket.emit('joinRoom', { roomCode, playerName, avatar, playerId: myPlayerId });
            }
        } catch (e) {}
    }
});

// --- VIRŠUTINIAI VALDYMO MYGTUKAI ---
const copyBtn = document.getElementById('copyCodeBtn');
if (copyBtn) {
    copyBtn.addEventListener('click', () => {
        if (!currentRoomCode) return;
        navigator.clipboard.writeText(currentRoomCode);
        copyBtn.innerText = '✅ Nukopijuota!';
        setTimeout(() => copyBtn.innerText = '📋 Kopijuoti', 1800);
    });
}

const soundBtn = document.getElementById('soundToggleBtn');
if (soundBtn) {
    soundBtn.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        soundBtn.innerText = soundEnabled ? '🔊' : '🔇';
    });
}

const rulesBtn = document.getElementById('rulesBtn');
if (rulesBtn) {
    rulesBtn.addEventListener('click', () => {
        const modal = document.getElementById('rulesModal');
        if (modal) modal.style.display = 'flex';
    });
}

const closeRulesBtn = document.getElementById('closeRulesBtn');
if (closeRulesBtn) {
    closeRulesBtn.addEventListener('click', () => {
        const modal = document.getElementById('rulesModal');
        if (modal) modal.style.display = 'none';
    });
}

const leaveBtn = document.getElementById('leaveRoomBtn');
if (leaveBtn) {
    leaveBtn.addEventListener('click', () => {
        clearSession();
        location.reload();
    });
}

const addBotBtn = document.getElementById('addBotBtn');
if (addBotBtn) {
    addBotBtn.addEventListener('click', () => {
        if (currentRoomCode) socket.emit('addBot', currentRoomCode);
    });
}


// --- POKALBIŲ LANGAS ---
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
sweepStyle.innerHTML = '@keyframes sweepBannerPop { 0% { transform: translate(-50%, -50%) scale(0.3) rotate(-8deg); opacity: 0; } 20% { transform: translate(-50%, -50%) scale(1.12) rotate(2deg); opacity: 1; } 80% { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 1; } 100% { transform: translate(-50%, -50%) scale(1.25); opacity: 0; } } .sweep-banner { position: fixed; top: 42%; left: 50%; transform: translate(-50%, -50%); background: linear-gradient(135deg, #7f1d1d 0%, #dc2626 45%, #fbbf24 100%); color: #fff; padding: 18px 28px; border-radius: 16px; border: 3px solid #fef08a; box-shadow: 0 0 40px rgba(251, 191, 36, 0.9), 0 15px 35px rgba(0, 0, 0, 0.85); z-index: 9999; text-align: center; pointer-events: none; animation: sweepBannerPop 3.6s cubic-bezier(0.22, 1, 0.36, 1) forwards; }';
document.head.appendChild(sweepStyle);

function triggerCleanSweepAnimation(winnerName) {
    const old = document.querySelector('.sweep-banner');
    if (old) old.remove();
    const banner = document.createElement('div');
    banner.className = 'sweep-banner';
    banner.innerHTML = '<div style="font-size:26px; font-weight:900; letter-spacing:1px; text-shadow:0 2px 6px rgba(0,0,0,0.6);">⚔️ SAUSAS SUTRIUŠKINIMAS! ⚔️</div>' +
        '<div style="font-size:15px; font-weight:700; color:#fef08a; margin-top:6px;">' + winnerName + ' sutriuškino priešininkus (7:0 kirčių)!</div>';
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 3700);
    triggerConfetti();
    playSound('win');
}

// --- PAGRINDINĖ BŪSENOS ATVAIZDAVIMO FUNKCIJA ---
socket.on('gameState', (state) => {
    const prevPhase = lastState ? lastState.phase : null;
    const prevTrickCount = lastState ? lastState.trickCards.length : 0;

    if (state.trickCards.length > prevTrickCount) {
        playSound('card');
    }
    if (state.statusText && (!lastState || lastState.statusText !== state.statusText)) {
        if (state.statusText.includes('PORĄ')) playSound('marriage');
        if (state.statusText.includes('SAUSAS SUTRIUŠKINIMAS')) {
            const parts = state.statusText.split('SAUSAS SUTRIUŠKINIMAS! ');
            const wName = parts[1] ? parts[1].split(' sudorojo')[0] : 'Žaidėjas';
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

    const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };

    setTxt('statusBanner', state.statusText);
    setTxt('currentBidDisplay', state.currentBid);
    setTxt('trumpDisplay', state.trumpSuit || 'Nėra');

    const emptySeats = state.seats.filter(s => s.isEmpty).length;
    const addBotEl = document.getElementById('addBotBtn');
    if (addBotEl) addBotEl.style.display = (state.phase === 'LOBBY' && emptySeats > 0) ? 'inline-block' : 'none';

    const myIdx = state.mySeatIndex;
    const leftIdx = (myIdx + 1) % 3;
    const rightIdx = (myIdx + 2) % 3;

    const me = state.seats[myIdx];
    const left = state.seats[leftIdx];
    const right = state.seats[rightIdx];

    // Viršutiniai priešininkai
    setTxt('leftPlayerName', left.avatar + ' ' + left.name);
    setTxt('leftTotalScore', left.totalScore + ' / 1000' + (left.totalScore >= 900 ? ' 🛢️' : ''));
    setTxt('leftRoundScore', left.roundScore);
    setTxt('leftBidStatus', left.bidStatus);

    const leftCardsDiv = document.getElementById('leftPlayerCards');
    if (leftCardsDiv) {
        leftCardsDiv.innerHTML = '';
        for (let i = 0; i < left.handCount; i++) {
            const c = document.createElement('div');
            c.className = 'card small hidden';
            leftCardsDiv.appendChild(c);
        }
    }

    setTxt('rightPlayerName', right.avatar + ' ' + right.name);
    setTxt('rightTotalScore', right.totalScore + ' / 1000' + (right.totalScore >= 900 ? ' 🛢️' : ''));
    setTxt('rightRoundScore', right.roundScore);
    setTxt('rightBidStatus', right.bidStatus);

    const rightCardsDiv = document.getElementById('rightPlayerCards');
    if (rightCardsDiv) {
        rightCardsDiv.innerHTML = '';
        for (let i = 0; i < right.handCount; i++) {
            const c = document.createElement('div');
            c.className = 'card small hidden';
            rightCardsDiv.appendChild(c);
        }
    }

    // Mano duomenys
    setTxt('myName', me.avatar + ' ' + me.name + (me.isBlind ? ' 🙈 [Aklai x2]' : ''));
    setTxt('myTotalScore', me.totalScore + ' / 1000' + (me.totalScore >= 900 ? ' 🛢️' : ''));
    setTxt('myRoundScore', me.roundScore);


        // Aktyvaus ėjimo ir 900 statinės paryškinimas
    const myBox = document.getElementById('myPlayerBox');
    const leftBox = document.getElementById('leftPlayerBox');
    const rightBox = document.getElementById('rightPlayerBox');

    const isPlayPhase = (state.phase !== 'LOBBY' && state.phase !== 'ROUND_OVER' && state.phase !== 'GAME_OVER');
    if (myBox) {
        myBox.classList.toggle('active-turn', state.currentTurnIndex === myIdx && isPlayPhase);
        myBox.classList.toggle('on-barrel', me.totalScore >= 900);
    }
    if (leftBox) {
        leftBox.classList.toggle('active-turn', state.currentTurnIndex === leftIdx && isPlayPhase);
        leftBox.classList.toggle('on-barrel', left.totalScore >= 900);
    }
    if (rightBox) {
        rightBox.classList.toggle('active-turn', state.currentTurnIndex === rightIdx && isPlayPhase);
        rightBox.classList.toggle('on-barrel', right.totalScore >= 900);
    }


    // 4D Stalo auros ir gyvas Krupjė
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
    renderTableCenter(state, leftIdx, rightIdx);
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
        if (state.mySeatIndex === 0) {
            addButton('🚀 Pradėti žaidimą (tuščias vietas užims botai)', 'success', () => socket.emit('startGame', currentRoomCode));
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
        if (state.talon && state.talon.length > 0) {
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
    } else if (state.trickCards.length > 0) {
        title.innerText = 'Kirtis ant stalo';
        state.trickCards.forEach(item => {
            const seat = state.seats[item.seatIndex];
            const wrapper = document.createElement('div');
            wrapper.style.textAlign = 'center';

            const cardDiv = document.createElement('div');
            cardDiv.className = 'card ' + (item.card.isRed ? 'red' : '');
            cardDiv.innerHTML = '<div>' + item.card.name + '</div><div>' + item.card.suit + '</div>';

            const nameLabel = document.createElement('div');
            nameLabel.style.fontSize = '11px';
            nameLabel.style.marginTop = '4px';
            nameLabel.style.color = '#e2e8f0';
            nameLabel.innerText = seat.avatar + ' ' + seat.name;

            wrapper.appendChild(cardDiv);
            wrapper.appendChild(nameLabel);
            container.appendChild(wrapper);
        });

        if (state.trickCards.length === 3 && state.statusText && state.statusText.includes('Kirtį paėmė')) {
            const winnerSeat = state.seats.find(s => state.statusText.includes(s.name));
            if (winnerSeat) {
                let flyClass = 'trick-fly-me';
                if (winnerSeat.index === leftIdx) flyClass = 'trick-fly-left';
                else if (winnerSeat.index === rightIdx) flyClass = 'trick-fly-right';
                setTimeout(() => container.classList.add(flyClass), 750);
            }
        }
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

// --- 5D VIZUALIZACIJA: DALELĖS, PROŽEKTORIUS, RATILAI IR HAPTIKA ---
const style5D = document.createElement('style');
style5D.innerHTML = '@keyframes floatDust { 0% { transform: translateY(0) scale(0.8); opacity: 0; } 30% { opacity: 0.75; } 100% { transform: translateY(-160px) scale(1.2); opacity: 0; } } .gold-dust { position: absolute; width: 4px; height: 4px; background: radial-gradient(circle, #fde68a 0%, #f59e0b 100%); border-radius: 50%; pointer-events: none; box-shadow: 0 0 8px #fbbf24; z-index: 2; } @keyframes rippleWave { 0% { transform: translate(-50%, -50%) scale(0.2); opacity: 0.9; } 100% { transform: translate(-50%, -50%) scale(3.5); opacity: 0; } } .touch-ripple { position: fixed; width: 40px; height: 40px; border: 2px solid #fbbf24; border-radius: 50%; pointer-events: none; z-index: 9998; animation: rippleWave 0.65s ease-out forwards; } .card.spotlight-card { background-image: radial-gradient(circle at var(--mx, 50%) var(--my, 50%), rgba(255,255,255,0.65) 0%, transparent 60%), linear-gradient(145deg, #ffffff 0%, #fefce8 65%, #fef3c7 100%) !important; }';
document.head.appendChild(style5D);

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

// --- 10D VIZUALIZACIJA: HOLOGRAMOS, KOMETOS, ŽAIBAI IR SMŪGIO BANGOS ---
const style10D = document.createElement('style');
style10D.innerHTML = '@keyframes holoShift { 0% { filter: hue-rotate(0deg) brightness(1.05); } 50% { filter: hue-rotate(45deg) brightness(1.15); } 100% { filter: hue-rotate(0deg) brightness(1.05); } } .card.holo-card { border: 2px solid #f59e0b !important; box-shadow: 0 0 18px rgba(251, 191, 36, 0.75), inset 0 0 12px rgba(253, 224, 71, 0.5) !important; animation: holoShift 3s infinite ease-in-out; } @keyframes shockwave10D { 0% { transform: translate(-50%, -50%) scale(0.1); opacity: 1; border-width: 6px; } 100% { transform: translate(-50%, -50%) scale(4.5); opacity: 0; border-width: 1px; } } .table-shockwave { position: absolute; top: 50%; left: 50%; width: 120px; height: 120px; border: 6px solid #fbbf24; border-radius: 50%; pointer-events: none; z-index: 50; animation: shockwave10D 0.85s cubic-bezier(0.16, 1, 0.3, 1) forwards; } @keyframes laserSpin { 0% { box-shadow: 0 0 15px #fbbf24, inset 0 0 10px #fbbf24; } 50% { box-shadow: 0 0 32px #34d399, inset 0 0 18px #34d399; } 100% { box-shadow: 0 0 15px #fbbf24, inset 0 0 10px #fbbf24; } } .active-turn { animation: laserSpin 1.4s infinite ease-in-out !important; } @keyframes coinFall10D { 0% { transform: translateY(-20px) rotateY(0deg) scale(0.8); opacity: 1; } 100% { transform: translateY(340px) rotateY(720deg) scale(1.1); opacity: 0; } } .gold-coin-10d { position: absolute; font-size: 20px; pointer-events: none; z-index: 60; text-shadow: 0 0 10px #fbbf24; }';
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
// PABAIGA