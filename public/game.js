const socket = io();

let selectedAvatar = '👨';
let currentRoomCode = null;
let lastState = null;

document.getElementById('lobbyMale').addEventListener('click', () => {
    selectedAvatar = '👨';
    document.getElementById('lobbyMale').classList.add('active-avatar');
    document.getElementById('lobbyFemale').classList.remove('active-avatar');
});

document.getElementById('lobbyFemale').addEventListener('click', () => {
    selectedAvatar = '👩';
    document.getElementById('lobbyFemale').classList.add('active-avatar');
    document.getElementById('lobbyMale').classList.remove('active-avatar');
});

document.getElementById('createRoomBtn').addEventListener('click', () => {
    const name = document.getElementById('playerNameInput').value.trim() || 'Žaidėjas';
    socket.emit('createRoom', { playerName: name, avatar: selectedAvatar });
});

document.getElementById('joinRoomBtn').addEventListener('click', () => {
    const name = document.getElementById('playerNameInput').value.trim() || 'Žaidėjas';
    const code = document.getElementById('roomCodeInput').value.trim();
    if (!code) {
        alert('Įrašyk kambario kodą!');
        return;
    }
    socket.emit('joinRoom', { roomCode: code, playerName: name, avatar: selectedAvatar });
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
    lastState = state;
    currentRoomCode = state.roomCode;

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

function renderControls(state) {
    const area = document.getElementById('controlsArea');
    area.innerHTML = '';

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
            addButton('👀 Atversti kortas', '', () => socket.emit('revealCards', currentRoomCode));
            addButton('🙈 Statyti AKLAI (' + (state.currentBid + 10) + ') [x2]', 'success', () => {
                socket.emit('placeBid', { roomCode: currentRoomCode, blind: true });
            });
        } else {
            addButton('Statyti ' + (state.currentBid + 10), '', () => {
                socket.emit('placeBid', { roomCode: currentRoomCode, blind: false });
            });
        }
        if (!amIHighestBidder || state.currentBid > 100) {
            addButton('Pasuoti', 'danger', () => socket.emit('passBid', currentRoomCode));
        }
    } else if (state.phase === 'RAISE_BID' && amIHighestBidder) {
        if (state.currentBid - 20 >= state.minBidAfterWin) {
            addButton('📉 -20 (' + (state.currentBid - 20) + ')', 'danger', () => socket.emit('adjustBidAfterTalon', { roomCode: currentRoomCode, delta: -20 }));
        }
        if (state.currentBid - 10 >= state.minBidAfterWin) {
            addButton('🔽 -10 (' + (state.currentBid - 10) + ')', 'danger', () => socket.emit('adjustBidAfterTalon', { roomCode: currentRoomCode, delta: -10 }));
        }
        addButton('✅ Pradėti žaidimą su ' + state.currentBid, 'success', () => socket.emit('confirmBidAndPlay', currentRoomCode));
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
if (state.discardedPile.length > 0) {
info.innerText = 'Tavo nusimestos (+' + state.discardedPoints + ' tšk.):';
state.discardedPile.forEach(c => {
const div = document.createElement('div');
div.className = 'card small ' + (c.isRed ? 'red' : '');
div.innerHTML = '' + c.name + '' + c.suit + '';
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
// PABAIGA