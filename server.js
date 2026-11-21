const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const suits = ['♥', '♦', '♣', '♠'];
const ranks = [
    { name: '9', value: 0, power: 1 },
    { name: 'J', value: 2, power: 2 },
    { name: 'Q', value: 3, power: 3 },
    { name: 'K', value: 4, power: 4 },
    { name: '10', value: 10, power: 5 },
    { name: 'A', value: 11, power: 6 }
];

const rooms = {};

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function getMarriageBonus(suit) {
    if (suit === '♣') return 100;
    if (suit === '♠') return 80;
    if (suit === '♥') return 60;
    return 40;
}

function createDeck() {
    let rawDeck = [];
    for (let s of suits) {
        for (let r of ranks) {
            rawDeck.push({
                suit: s, name: r.name, value: r.value, power: r.power,
                isRed: (s === '♥' || s === '♦')
            });
        }
    }
    let deck = [];
    while (rawDeck.length > 0) {
        let idx = Math.floor(Math.random() * rawDeck.length);
        deck.push(rawDeck.splice(idx, 1).at(0));
    }
    return deck;
}

function evaluateBotHand(hand, totalScore) {
    let pts = hand.reduce((sum, c) => sum + c.value, 0);
    for (let s of suits) {
        if (hand.some(c => c.suit === s && c.name === 'K') && hand.some(c => c.suit === s && c.name === 'Q')) {
            pts += getMarriageBonus(s) * 0.8;
        }
    }
    let maxBid = 100;
    if (pts > 130) maxBid = 170;
    else if (pts > 110) maxBid = 150;
    else if (pts > 95) maxBid = 140;
    else if (pts > 75) maxBid = 120;
    else if (pts > 55) maxBid = 110;
    if (totalScore >= 900 && maxBid < 110) maxBid = 110;
    return maxBid;
}

function isValidMove(hand, card, trickCards, trumpSuit) {
    if (trickCards.length === 0) return true;
    let leadSuit = trickCards.at(0).card.suit;
    if (hand.some(c => c.suit === leadSuit)) return card.suit === leadSuit;
    if (trumpSuit && hand.some(c => c.suit === trumpSuit)) return card.suit === trumpSuit;
    return true;
}

function broadcastState(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;

    room.seats.forEach((seat, seatIdx) => {
        if (!seat.isBot && seat.socketId) {
            const publicSeats = room.seats.map((s, idx) => ({
                index: idx,
                name: s.name,
                avatar: s.avatar,
                isBot: s.isBot,
                totalScore: s.totalScore,
                roundScore: s.roundScore,
                cardCount: s.hand.length,
                bidStatus: s.bidStatus,
                cardsRevealed: s.cardsRevealed,
                isBlind: s.isBlind
            }));

            io.to(seat.socketId).emit('gameState', {
                roomCode: room.code,
                mySeatIndex: seatIdx,
                myHand: seat.hand,
                myCardsRevealed: seat.cardsRevealed,
                myIsBlind: seat.isBlind,
                seats: publicSeats,
                phase: room.phase,
                statusText: room.statusText,
                currentBid: room.currentBid,
                minBidAfterWin: room.minBidAfterWin,
                highestBidderIndex: room.highestBidderIndex,
                currentTurnIndex: room.currentTurnIndex,
                trumpSuit: room.trumpSuit,
                talon: room.showTalon ? room.talon : [],
                talonCount: (room.talon || []).length,
                trickCards: room.trickCards,
                discardedPile: (room.highestBidderIndex === seatIdx) ? (room.discardedPile || []) : [],
                discardedCount: (room.discardedPile || []).length,
                discardedPoints: (room.discardedPile || []).reduce((sum, c) => sum + c.value, 0)

                
                
            });
        }
    });
}
function startRound(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;

    const deck = createDeck();
    room.seats.forEach((seat, i) => {
        seat.hand = deck.slice(i * 7, (i + 1) * 7);
        seat.roundScore = 0;
        seat.cardsRevealed = false;
        seat.isBlind = false;
        seat.passed = false;
        seat.bidStatus = '-';
        if (seat.isBot) {
            seat.maxBid = evaluateBotHand(seat.hand, seat.totalScore);
        }
    });

    room.talon = deck.slice(21, 24);
    room.showTalon = false;
    room.discardedPile = [];
    room.trumpSuit = null;
    room.trickCards = [];
    room.currentBid = 100;
    room.minBidAfterWin = 100;
    room.highestBidderIndex = room.roundStarterIndex;

    const fourNinesIdx = room.seats.findIndex(s => s.hand.filter(c => c.name === '9').length === 4);
    if (fourNinesIdx !== -1) {
        room.seats[fourNinesIdx].cardsRevealed = true;
        room.phase = 'FOUR_NINES';
        room.statusText = '🚨 ' + room.seats[fourNinesIdx].name + ' gavo KETURIAS DEVYNAKES! Krupjė permaišo kortas...';
        broadcastState(roomCode);
        setTimeout(() => startRound(roomCode), 2500);
        return;
    }

    room.phase = 'BIDDING';
    room.currentTurnIndex = room.roundStarterIndex;
    room.statusText = 'Kortos išdalintos! Varžytines pradeda ' + room.seats[room.currentTurnIndex].name + '.';
    broadcastState(roomCode);
    checkBotAction(roomCode);
}

function advanceBidding(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;

    const activeCount = room.seats.filter(s => !s.passed).length;
    if (activeCount <= 1) {
        finishBidding(roomCode);
        return;
    }

    do {
        room.currentTurnIndex = (room.currentTurnIndex + 1) % 3;
    } while (room.seats[room.currentTurnIndex].passed);

    room.statusText = 'Varžytinės: dabar stato ' + room.seats[room.currentTurnIndex].name + ' (dabartinis: ' + room.currentBid + ').';
    broadcastState(roomCode);
    checkBotAction(roomCode);
}

function finishBidding(roomCode) {
    const room = rooms[roomCode];
    const winner = room.seats[room.highestBidderIndex];
    room.minBidAfterWin = room.currentBid;
    room.showTalon = true;
    room.statusText = '🏆 Varžytines laimėjo ' + winner.name + ' (' + room.currentBid + ')! Atverčiamas bankas...';
    broadcastState(roomCode);

    setTimeout(() => {
        room.seats.forEach(s => s.cardsRevealed = true);
        winner.hand.push(...room.talon);
        room.talon = [];
        room.showTalon = false;

        if (winner.isBot) {
            let sorted = [...winner.hand].sort((a, b) => a.power - b.power);
            room.discardedPile = sorted.slice(0, 3);
            room.discardedPile.forEach(dc => {
                let idx = winner.hand.indexOf(dc);
                if (idx !== -1) winner.hand.splice(idx, 1);
            });
            let pts = room.discardedPile.reduce((sum, c) => sum + c.value, 0);
            winner.roundScore += pts;

            let newStrength = evaluateBotHand(winner.hand, winner.totalScore);
            let raisedMsg = '';
            if (newStrength > room.currentBid) {
                room.currentBid = newStrength;
                winner.bidStatus = 'Pasikėlė: ' + room.currentBid;
                raisedMsg = ' ir pasikėlė šaukimą iki ' + room.currentBid + '!';
            }
            room.phase = 'PLAYING';
            room.currentTurnIndex = room.highestBidderIndex;
            room.statusText = winner.name + ' paėmė banką, nusimetė 3 kortas (+' + pts + ' tšk.)' + raisedMsg + ' Pradedame!';
            broadcastState(roomCode);
            checkBotAction(roomCode);
        } else {
            room.phase = 'DISCARD_3';
            room.currentTurnIndex = room.highestBidderIndex;
            room.statusText = winner.name + ' paėmė banką ir renkasi 3 kortas nusimetimui...';
            broadcastState(roomCode);
        }
    }, 2000);
}

function evaluateTrick(roomCode) {
    const room = rooms[roomCode];
    let winnerObj = room.trickCards.at(0);

    for (let i = 1; i < room.trickCards.length; i++) {
        let cur = room.trickCards.at(i);
        if (room.trumpSuit && cur.card.suit === room.trumpSuit && winnerObj.card.suit !== room.trumpSuit) {
            winnerObj = cur;
        } else if (cur.card.suit === winnerObj.card.suit && cur.card.power > winnerObj.card.power) {
            winnerObj = cur;
        }
    }

    let pts = room.trickCards.reduce((sum, item) => sum + item.card.value, 0);
    room.seats[winnerObj.seatIndex].roundScore += pts;
    room.statusText = 'Kirtį paėmė ' + room.seats[winnerObj.seatIndex].name + ' (+' + pts + ' tšk.)!';
    broadcastState(roomCode);

    setTimeout(() => {
        room.trickCards = [];
        if (room.seats.at(0).hand.length === 0) {
            finishRound(roomCode);
        } else {
            room.currentTurnIndex = winnerObj.seatIndex;
            room.statusText = 'Eina ' + room.seats[room.currentTurnIndex].name + ' (Šaukimas: ' + room.currentBid + ').';
            broadcastState(roomCode);
            checkBotAction(roomCode);
        }
    }, 1400);
}

function finishRound(roomCode) {
    const room = rooms[roomCode];
    room.phase = 'ROUND_OVER';
    let summary = 'Partija baigta! ';

    const bidder = room.seats[room.highestBidderIndex];
    const bidWon = bidder.roundScore >= room.currentBid;
    const mult = bidder.isBlind ? 2 : 1;

    if (bidWon) {
        const earned = room.currentBid * mult;
        bidder.totalScore += earned;
        summary += bidder.name + ' įvykdė šaukimą (' + room.currentBid + ') +' + earned + ' tšk.! ';
    } else {
        const lost = room.currentBid * mult;
        bidder.totalScore -= lost;
        summary += bidder.name + ' SUDEGĖ (' + bidder.roundScore + '/' + room.currentBid + ') -' + lost + ' tšk.! ';
    }

    room.seats.forEach((s, idx) => {
        if (idx !== room.highestBidderIndex) {
            let rounded = Math.round(s.roundScore / 5) * 5;
            if (s.totalScore >= 900) {
                summary += s.name + ' ant statinės (900). ';
            } else if (s.totalScore + rounded >= 900) {
                s.totalScore = 900;
                summary += s.name + ' pasiekė statinę (900)! ';
            } else {
                s.totalScore += rounded;
            }
        }
    });

    room.roundStarterIndex = (room.roundStarterIndex + 1) % 3;
    const gameWinner = room.seats.find(s => s.totalScore >= 1000);
    if (gameWinner) {
        room.phase = 'GAME_OVER';
        room.statusText = '🏆 ' + gameWinner.name + ' LAIMĖJO ŽAIDIMĄ pasiekęs ' + gameWinner.totalScore + ' taškų!';
    } else {
        room.statusText = summary;
    }
    broadcastState(roomCode);
}

function checkBotAction(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;
    const activeSeat = room.seats[room.currentTurnIndex];
    if (!activeSeat || !activeSeat.isBot) return;

    setTimeout(() => {
        if (room.phase === 'BIDDING') {
            if (room.currentBid + 10 <= activeSeat.maxBid) {
                room.currentBid += 10;
                room.highestBidderIndex = room.currentTurnIndex;
                activeSeat.bidStatus = 'Stato: ' + room.currentBid;
                room.statusText = activeSeat.name + ' kelia statymą iki ' + room.currentBid + '!';
            } else {
                activeSeat.passed = true;
                activeSeat.bidStatus = 'Pasas';
                room.statusText = activeSeat.name + ' pasuoja.';
            }
            advanceBidding(roomCode);
        } else if (room.phase === 'PLAYING') {
            let validCards = activeSeat.hand.filter(c => isValidMove(activeSeat.hand, c, room.trickCards, room.trumpSuit));
            let chosen = validCards.at(0);
            if (room.trickCards.length === 0) {
                let marriage = validCards.find(c => (c.name === 'Q' || c.name === 'K') && activeSeat.hand.some(p => p.suit === c.suit && p.name === (c.name === 'Q' ? 'K' : 'Q')));
                if (marriage) chosen = marriage;
                else {
                    validCards.sort((a, b) => b.power - a.power);
                    chosen = validCards.at(0);
                }
            } else {
                validCards.sort((a, b) => a.power - b.power);
                chosen = validCards.at(0);
            }
            let idx = activeSeat.hand.indexOf(chosen);
            activeSeat.hand.splice(idx, 1);
            executePlayCard(roomCode, room.currentTurnIndex, chosen);
        }
    }, 900);
}

function executePlayCard(roomCode, seatIdx, card) {
    const room = rooms[roomCode];
    const seat = room.seats[seatIdx];

    if (room.trickCards.length === 0 && (card.name === 'Q' || card.name === 'K')) {
        let partner = card.name === 'Q' ? 'K' : 'Q';
        if (seat.hand.some(c => c.suit === card.suit && c.name === partner)) {
            room.trumpSuit = card.suit;
            let bonus = getMarriageBonus(card.suit);
            seat.roundScore += bonus;
            room.statusText = '👑 ' + seat.name + ' skelbia PORĄ (' + card.suit + ') +' + bonus + ' tšk.! Koziris: ' + room.trumpSuit;
        }
    }

    room.trickCards.push({ seatIndex: seatIdx, card: card });
    broadcastState(roomCode);

    if (room.trickCards.length === 3) {
        evaluateTrick(roomCode);
    } else {
        room.currentTurnIndex = (seatIdx + 1) % 3;
        broadcastState(roomCode);
        checkBotAction(roomCode);
    }
}

io.on('connection', (socket) => {
    socket.on('createRoom', ({ playerName, avatar }) => {
        const code = generateRoomCode();
         rooms[code] = {
            code: code,
            phase: 'LOBBY',
            statusText: 'Kambarys sukurtas! Laukia žaidėjų arba spausk „Pradėti žaidimą“.',
            roundStarterIndex: 0,
            seats: [
                { socketId: socket.id, name: playerName || 'Žaidėjas 1', avatar: avatar || '👨', isBot: false, totalScore: 0, roundScore: 0, bidStatus: '-', hand: [] },
                { socketId: null, name: 'Tomas (Botas)', avatar: '🧔‍♂️', isBot: true, totalScore: 0, roundScore: 0, bidStatus: '-', hand: [] },
                { socketId: null, name: 'Ieva (Botas)', avatar: '👩‍🦰', isBot: true, totalScore: 0, roundScore: 0, bidStatus: '-', hand: [] }
            ]
        };

socket.join(code);
broadcastState(code);
});
socket.on('joinRoom', ({ roomCode, playerName, avatar }) => {
const code = (roomCode || '').toUpperCase().trim();
const room = rooms[code];
if (!room) {
socket.emit('errorMsg', 'Kambarys su tokiu kodu nerastas!');
return;
}
if (room.phase !== 'LOBBY') {
socket.emit('errorMsg', 'Šiame kambaryje žaidimas jau prasidėjo!');
return;
}
const botSeatIdx = room.seats.findIndex(s => s.isBot);
if (botSeatIdx === -1) {
socket.emit('errorMsg', 'Kambarys jau pilnas (3 žaidėjai)!');
return;
}
room.seats[botSeatIdx] = {
socketId: socket.id,
name: playerName || ('Žaidėjas ' + (botSeatIdx + 1)),
avatar: avatar || '👩',
isBot: false,
totalScore: 0,
roundScore: 0,
hand: []
};
socket.join(code);
broadcastState(code);
});
socket.on('startGame', (roomCode) => {
const room = rooms[roomCode];
if (!room) return;
room.seats.forEach(s => s.totalScore = 0);
room.roundStarterIndex = 0;
startRound(roomCode);
});
socket.on('nextRound', (roomCode) => {
startRound(roomCode);
});
socket.on('revealCards', (roomCode) => {
const room = rooms[roomCode];
if (!room) return;
const seat = room.seats.find(s => s.socketId === socket.id);
if (seat) {
seat.cardsRevealed = true;
broadcastState(roomCode);
}
});
socket.on('placeBid', ({ roomCode, blind }) => {
const room = rooms[roomCode];
if (!room || room.phase !== 'BIDDING') return;
const seatIdx = room.seats.findIndex(s => s.socketId === socket.id);
if (seatIdx !== room.currentTurnIndex) return;
if (blind) room.seats[seatIdx].isBlind = true;
room.currentBid += 10;
room.highestBidderIndex = seatIdx;
room.seats[seatIdx].bidStatus = 'Stato: ' + room.currentBid;
advanceBidding(roomCode);
});
socket.on('passBid', (roomCode) => {
const room = rooms[roomCode];
if (!room || room.phase !== 'BIDDING') return;
const seatIdx = room.seats.findIndex(s => s.socketId === socket.id);
if (seatIdx !== room.currentTurnIndex) return;
room.seats[seatIdx].passed = true;
room.seats[seatIdx].bidStatus = 'Pasas';
advanceBidding(roomCode);
});
socket.on('discardCard', ({ roomCode, cardIndex }) => {
const room = rooms[roomCode];
if (!room || room.phase !== 'DISCARD_3') return;
const seatIdx = room.seats.findIndex(s => s.socketId === socket.id);
if (seatIdx !== room.highestBidderIndex) return;
const seat = room.seats[seatIdx];
const card = seat.hand.splice(cardIndex, 1).at(0);
if (!card) return;
room.discardedPile.push(card);
seat.roundScore += card.value;
if (room.discardedPile.length === 3) {
room.phase = 'RAISE_BID';
room.statusText = seat.name + ' nusimetė 3 kortas ir renkasi galutinį šaukimą...';
}
broadcastState(roomCode);
});
socket.on('adjustBidAfterTalon', ({ roomCode, delta }) => {
const room = rooms[roomCode];
if (!room || room.phase !== 'RAISE_BID') return;
const seatIdx = room.seats.findIndex(s => s.socketId === socket.id);
if (seatIdx !== room.highestBidderIndex) return;
let nextVal = room.currentBid + delta;
if (nextVal >= room.minBidAfterWin && nextVal <= 300) {
room.currentBid = nextVal;
broadcastState(roomCode);
}
});
socket.on('confirmBidAndPlay', (roomCode) => {
const room = rooms[roomCode];
if (!room || room.phase !== 'RAISE_BID') return;
room.phase = 'PLAYING';
room.currentTurnIndex = room.highestBidderIndex;
room.statusText = 'Žaidimas prasideda! Šaukimas: ' + room.currentBid + '. Eina ' + room.seats[room.currentTurnIndex].name + '.';
broadcastState(roomCode);
});
socket.on('playCard', ({ roomCode, cardIndex }) => {
const room = rooms[roomCode];
if (!room || room.phase !== 'PLAYING') return;
const seatIdx = room.seats.findIndex(s => s.socketId === socket.id);
if (seatIdx !== room.currentTurnIndex) return;
const seat = room.seats[seatIdx];
const card = seat.hand.at(cardIndex);
if (!card || !isValidMove(seat.hand, card, room.trickCards, room.trumpSuit)) {
socket.emit('errorMsg', 'Negali mesti šios kortos! Privalai dėti tos pačios rūšies kortą arba kirsti koziriu.');
return;
}
seat.hand.splice(cardIndex, 1);
executePlayCard(roomCode, seatIdx, card);
});
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
console.log('Serveris veikia! Atsidaryk narsykleje: http://localhost:' + PORT);
});
// SERVERIO PABAIGA