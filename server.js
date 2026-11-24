const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const zlib = require('zlib');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    pingTimeout: 60000,
    pingInterval: 25000
});

app.use(express.static(path.join(__dirname, 'public')));

function createSolidPng(size) {
    const rawData = Buffer.alloc((size * 4 + 1) * size);
    for (let y = 0; y < size; y++) {
        const rowStart = y * (size * 4 + 1);
        rawData[rowStart] = 0;
        for (let x = 0; x < size; x++) {
            const px = rowStart + 1 + x * 4;
            const isBorder = x < 28 || x >= size - 28 || y < 28 || y >= size - 28;
            const isInnerGold = (x >= 28 && x < 44) || (x >= size - 44 && x < size - 28) || (y >= 28 && y < 44) || (y >= size - 44 && y < size - 28);
            const isCenterDiamond = Math.abs(x - size / 2) + Math.abs(y - size / 2) < size * 0.24;

            if (isBorder) {
                rawData.writeUInt8(15, px); rawData.writeUInt8(23, px + 1); rawData.writeUInt8(42, px + 2); rawData.writeUInt8(255, px + 3);
            } else if (isInnerGold || isCenterDiamond) {
                rawData.writeUInt8(251, px); rawData.writeUInt8(191, px + 1); rawData.writeUInt8(36, px + 2); rawData.writeUInt8(255, px + 3);
            } else {
                rawData.writeUInt8(6, px); rawData.writeUInt8(78, px + 1); rawData.writeUInt8(59, px + 2); rawData.writeUInt8(255, px + 3);
            }
        }
    }

    const compressed = zlib.deflateSync(rawData);
    function crc32(buf) {
        let crc = -1;
        for (let i = 0; i < buf.length; i++) {
            crc ^= buf[i];
            for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
        }
        return (crc ^ -1) >>> 0;
    }
    function makeChunk(type, data) {
        const typeBuf = Buffer.from(type, 'ascii');
        const lenBuf = Buffer.alloc(4);
        lenBuf.writeUInt32BE(data.length, 0);
        const crcBuf = Buffer.alloc(4);
        crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
        return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
    }

    const sig = Buffer.from('89504e470d0a1a0a', 'hex');
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(size, 0);
    ihdr.writeUInt32BE(size, 4);
    ihdr.writeUInt8(8, 8);
    ihdr.writeUInt8(6, 9);
    return Buffer.concat([sig, makeChunk('IHDR', ihdr), makeChunk('IDAT', compressed), makeChunk('IEND', Buffer.alloc(0))]);
}

const cachedIcon192 = createSolidPng(192);
const cachedIcon512 = createSolidPng(512);

app.get('/icon-192.png', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': cachedIcon192.length });
    res.end(cachedIcon192);
});
app.get('/icon-512.png', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': cachedIcon512.length });
    res.end(cachedIcon512);
});
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

function addBonusWithBarrelRule(seat, bonus) {
    if (seat.totalScore >= 900) {
        return seat.name + ' sėdi ant statinės (900). ';
    } else if (seat.totalScore + bonus >= 900) {
        seat.totalScore = 900;
        return seat.name + ' pasiekė statinę (900)! ';
    } else {
        seat.totalScore += bonus;
        return seat.name + ' gauna +' + bonus + ' tšk.! ';
    }
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
                isBlind: s.isBlind,
                usedPlus: !!s.usedPlus,
                usedNineGuess: !!s.usedNineGuess
            }));

                        let guessInfo = null;
            if (room.nineGuess) {
                guessInfo = {
                    giverIndex: room.nineGuess.giverIndex,
                    hasGuessed: !!room.nineGuess.guesses[seatIdx],
                    availableSuits: room.nineGuess.availableSuits || ['♣', '♠', '♥', '♦']
                };
            }


            io.to(seat.socketId).emit('gameState', {
                roomCode: room.code,
                mySeatIndex: seatIdx,
                myHand: seat.hand,
                myCardsRevealed: seat.cardsRevealed,
                myIsBlind: seat.isBlind,
                                 myUsedPlus: !!seat.usedPlus,
                myUsedNineGuess: !!seat.usedNineGuess,
               
                nineGuess: guessInfo,
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
                trickCards: room.trickCards || [],
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
        seat.tricksWon = 0;
        seat.cardsRevealed = false;
        seat.isBlind = false;
        seat.passed = false;
        seat.bidStatus = '-';
        seat.usedNineGuess = false;
        if (seat.isBot) {
            seat.maxBid = evaluateBotHand(seat.hand, seat.totalScore);
        }
    });

    room.talon = deck.slice(21, 24);
    room.showTalon = false;
    room.discardedPile = [];
    room.trumpSuit = null;
    room.trickCards = [];
    room.nineGuess = null;
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
    if (!room || room.phase !== 'BIDDING') return;

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
        if (!rooms[roomCode] || room.phase !== 'BIDDING') return;
        room.seats.forEach(s => s.cardsRevealed = true);
        winner.hand.push(...room.talon);
        room.talon = [];
        room.showTalon = false;

        if (winner.isBot) {
            let sorted = Array.from(winner.hand).sort((a, b) => a.power - b.power);
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

function evaluateNineGuess(roomCode) {
    const room = rooms[roomCode];
    if (!room || !room.nineGuess) return;

    const ng = room.nineGuess;
    const giver = room.seats[ng.giverIndex];
    const targetSuit = ng.targetSuit;
    const bonus = getMarriageBonus(targetSuit);

    const correctGuessers = [];
    room.seats.forEach((s, idx) => {
        if (idx !== ng.giverIndex && ng.guesses[idx] === targetSuit) {
            correctGuessers.push(s);
        }
    });

    let msg = '🔮 ' + giver.name + ' buvo paslėpęs 9' + targetSuit + ' (' + bonus + ' tšk.)! ';

    if (correctGuessers.length === 1) {
        msg += 'Atspėjo tik ' + correctGuessers.at(0).name + '! ' + addBonusWithBarrelRule(correctGuessers.at(0), bonus);
    } else if (correctGuessers.length === 2) {
        const half = bonus / 2;
        msg += 'Atspėjo ABUDU (' + correctGuessers.at(0).name + ' ir ' + correctGuessers.at(1).name + '), todėl taškai dalinami per pusę (po +' + half + ' tšk.)! ';
        msg += addBonusWithBarrelRule(correctGuessers.at(0), half);
        msg += addBonusWithBarrelRule(correctGuessers.at(1), half);
    } else {
        msg += 'Neatspėjo NĖ VIENAS! Visus taškus pasiima ' + giver.name + '! ' + addBonusWithBarrelRule(giver, bonus);
    }

    room.phase = ng.prevPhase;
    room.nineGuess = null;
    room.statusText = msg;
    broadcastState(roomCode);

    if (room.phase === 'BIDDING' || room.phase === 'PLAYING') {
        checkBotAction(roomCode);
    }
}

function evaluateTrick(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;
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
    room.seats[winnerObj.seatIndex].tricksWon = (room.seats[winnerObj.seatIndex].tricksWon || 0) + 1;
    room.statusText = 'Kirtį paėmė ' + room.seats[winnerObj.seatIndex].name + ' (+' + pts + ' tšk.)!';
    broadcastState(roomCode);

    setTimeout(() => {
        if (!rooms[roomCode]) return;
        room.trickCards = [];
        if (room.seats[0].hand.length === 0) {
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
    if (!room) return;

    room.phase = 'ROUND_OVER';
    let summary = 'Partija baigta! ';

    const bidder = room.seats[room.highestBidderIndex];
    const bidAmount = Number(room.currentBid) || 100;
    const bidWon = (bidder.roundScore >= bidAmount);
    const isBlindRound = Boolean(bidder.isBlind);
    const mult = isBlindRound ? 2 : 1;

    if (bidWon) {
        const earned = bidAmount * mult;
        bidder.totalScore += earned;
        summary += bidder.name + ' įvykdė šaukimą (' + bidAmount + ') +' + earned + ' tšk.! ';
    } else {
        const lost = bidAmount * mult;
        bidder.totalScore -= lost;
        summary += bidder.name + ' SUDEGĖ (' + bidder.roundScore + '/' + bidAmount + ') -' + lost + ' tšk.! ';
    }

    if (isBlindRound) {
        summary += '[Aklas žaidimas: kitų taškai x2!] ';
    }

    for (let idx = 0; idx < room.seats.length; idx++) {
        if (idx !== room.highestBidderIndex) {
            const s = room.seats[idx];
            let rounded = (Math.round(s.roundScore / 5) * 5) * mult;
            if (s.totalScore >= 900) {
                summary += s.name + ' ant statinės (900). ';
            } else if (s.totalScore + rounded >= 900) {
                s.totalScore = 900;
                summary += s.name + ' pasiekė statinę (900)! ';
            } else {
                s.totalScore += rounded;
            }
        }
    }

    room.roundStarterIndex = (room.roundStarterIndex + 1) % 3;

    const sweepWinner = room.seats.find(s => s.tricksWon === 7);
    const sweepPrefix = sweepWinner ? ('⚔️ SAUSAS SUTRIUŠKINIMAS! ' + sweepWinner.name + ' sudorojo priešininkus nedavęs nė vieno kirčio! ') : '';

    const loser = room.seats.find(s => s.totalScore <= -500);
    const gameWinner = room.seats.find(s => s.totalScore >= 1000);

    if (loser) {
        room.phase = 'GAME_OVER';
        let topPlayer = room.seats[0];
        for (let i = 1; i < room.seats.length; i++) {
            if (room.seats[i].totalScore > topPlayer.totalScore) topPlayer = room.seats[i];
        }
        room.statusText = sweepPrefix + '💥 ' + loser.name + ' pasiekė ' + loser.totalScore + ' taškų ir PRALAIMĖJO! 🏆 Laimėjo ' + topPlayer.name + ' (' + topPlayer.totalScore + ' tšk.)!';
        broadcastState(roomCode);
    } else if (gameWinner) {
        room.phase = 'GAME_OVER';
        room.statusText = sweepPrefix + '🏆 ' + gameWinner.name + ' LAIMĖJO ŽAIDIMĄ pasiekęs ' + gameWinner.totalScore + ' taškų!';
        broadcastState(roomCode);
    } else {
        room.statusText = sweepPrefix + summary + ' (Krupjė automatiškai dalins po 4 sek...)';
        broadcastState(roomCode);
        setTimeout(() => {
            if (rooms[roomCode] && rooms[roomCode].phase === 'ROUND_OVER') {
                startRound(roomCode);
            }
        }, 4000);
    }
}

function checkBotAction(roomCode) {
    const room = rooms[roomCode];
    if (!room || room.phase === 'NINE_GUESS') return;
    const activeSeat = room.seats[room.currentTurnIndex];
    if (!activeSeat || !activeSeat.isBot) return;

    setTimeout(() => {
        if (!rooms[roomCode] || room.phase === 'ROUND_OVER' || room.phase === 'GAME_OVER' || room.phase === 'NINE_GUESS') return;
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
    if (!room) return;
    const seat = room.seats[seatIdx];
    if (!seat || !card) return;


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
    socket.on('createRoom', ({ playerName, avatar, playerToken }) => {
        const code = generateRoomCode();
        rooms[code] = {
            code: code,
            phase: 'LOBBY',
            statusText: 'Kambarys sukurtas! Laukia žaidėjų arba spausk „Pradėti žaidimą“.',
            roundStarterIndex: 0,
            seats: [
                { socketId: socket.id, playerToken: playerToken, name: playerName || 'Žaidėjas 1', avatar: avatar || '👨', isBot: false, totalScore: 0, roundScore: 0, bidStatus: '-', usedPlus: false, hand: [] },
                { socketId: null, playerToken: null, name: 'Tomas (Botas)', avatar: '🧔‍♂️', isBot: true, totalScore: 0, roundScore: 0, bidStatus: '-', usedPlus: false, hand: [] },
                { socketId: null, playerToken: null, name: 'Ieva (Botas)', avatar: '👩‍🦰', isBot: true, totalScore: 0, roundScore: 0, bidStatus: '-', usedPlus: false, hand: [] }
            ]
        };
        socket.join(code);
        broadcastState(code);
    });

    socket.on('joinRoom', ({ roomCode, playerName, avatar, playerToken }) => {
        const code = (roomCode || '').toUpperCase().trim();
        const room = rooms[code];
        if (!room) { socket.emit('errorMsg', 'Kambarys su tokiu kodu nerastas!'); return; }

        const existingSeat = room.seats.find(s => !s.isBot && s.playerToken === playerToken);
        if (existingSeat) {
            existingSeat.socketId = socket.id;
            socket.join(code);
            broadcastState(code);
            return;
        }

        if (room.phase !== 'LOBBY') { socket.emit('errorMsg', 'Šiame kambaryje žaidimas jau prasidėjo!'); return; }
        const botSeatIdx = room.seats.findIndex(s => s.isBot);
        if (botSeatIdx === -1) { socket.emit('errorMsg', 'Kambarys jau pilnas (3 žaidėjai)!'); return; }

        room.seats[botSeatIdx] = {
            socketId: socket.id, playerToken: playerToken, name: playerName || ('Žaidėjas ' + (botSeatIdx + 1)),
            avatar: avatar || '👩', isBot: false, totalScore: 0, roundScore: 0, bidStatus: '-', usedPlus: false, hand: []
        };
        socket.join(code);
        broadcastState(code);
    });

    socket.on('rejoinRoom', ({ roomCode, playerToken }) => {
        const code = (roomCode || '').toUpperCase().trim();
        const room = rooms[code];
        if (!room || !playerToken) return;
        const seat = room.seats.find(s => !s.isBot && s.playerToken === playerToken);
        if (seat) {
            seat.socketId = socket.id;
            socket.join(code);
            broadcastState(code);
        }
    });

    socket.on('startGame', (roomCode) => {
        const room = rooms[roomCode];
        if (!room) return;
        room.seats.forEach(s => { s.totalScore = 0; s.usedPlus = false; });
        room.roundStarterIndex = 0;
        startRound(roomCode);
    });

    socket.on('nextRound', (roomCode) => {
        startRound(roomCode);
    });

    socket.on('givePlus', (roomCode) => {
        const room = rooms[roomCode];
        if (!room || (room.phase !== 'BIDDING' && room.phase !== 'DISCARD_3' && room.phase !== 'RAISE_BID')) return;
        const seatIdx = room.seats.findIndex(s => s.socketId === socket.id);
        if (seatIdx === -1) return;
        const giver = room.seats[seatIdx];
        if (giver.usedPlus) { socket.emit('errorMsg', 'Šią pagalbą („Duoti pliusą“) šiame žaidime jau panaudojai!'); return; }

        giver.usedPlus = true;
        room.phase = 'ROUND_OVER';
        room.talon = [];
        room.showTalon = false;
        room.trickCards = [];
        room.seats.forEach(s => s.cardsRevealed = true);

        let infoMsg = '➕ ' + giver.name + ' pasinaudojo vienkartine pagalba „DUOTI PLIUSĄ“! Likusiems žaidėjams pridedama po +60 taškų. ';
        room.seats.forEach((s, idx) => { if (idx !== seatIdx) infoMsg += addBonusWithBarrelRule(s, 60); });
        room.roundStarterIndex = (room.roundStarterIndex + 1) % 3;
        room.statusText = infoMsg;
        broadcastState(roomCode);
    });

    socket.on('startNineGuess', ({ roomCode, suit }) => {
        const room = rooms[roomCode];
        if (!room || (room.phase !== 'BIDDING' && room.phase !== 'DISCARD_3' && room.phase !== 'RAISE_BID')) return;
        const seatIdx = room.seats.findIndex(s => s.socketId === socket.id);
        if (seatIdx === -1) return;
        const giver = room.seats[seatIdx];
        const nines = giver.hand.filter(c => c.name === '9');
        if (nines.length !== 3 || giver.usedNineGuess || !nines.some(c => c.suit === suit)) return;

                const availableSuits = nines.map(c => c.suit);
        giver.usedNineGuess = true;
        room.nineGuess = { giverIndex: seatIdx, targetSuit: suit, availableSuits: availableSuits, prevPhase: room.phase, guesses: {} };
        room.phase = 'NINE_GUESS';
        room.statusText = '🔮 ' + giver.name + ' turi TRIS DEVYNAKES (' + availableSuits.join(', ') + ') ir siūlo atspėti vieną iš jų!';
        broadcastState(roomCode);

        room.seats.forEach((s, idx) => {
            if (idx !== seatIdx && s.isBot) {
                room.nineGuess.guesses[idx] = availableSuits[Math.floor(Math.random() * availableSuits.length)];
            }
        });


    socket.on('submitNineGuess', ({ roomCode, suit }) => {
        const room = rooms[roomCode];
        if (!room || room.phase !== 'NINE_GUESS' || !room.nineGuess) return;
        const seatIdx = room.seats.findIndex(s => s.socketId === socket.id);
        if (seatIdx === -1 || seatIdx === room.nineGuess.giverIndex || room.nineGuess.guesses[seatIdx]) return;
        room.nineGuess.guesses[seatIdx] = suit;
        if (Object.keys(room.nineGuess.guesses).length >= room.seats.filter((_, idx) => idx !== room.nineGuess.giverIndex).length) {
            evaluateNineGuess(roomCode);
        } else {
            broadcastState(roomCode);
        }
    });

           socket.on('revealCards', (roomCode) => {
        const room = rooms[roomCode];
        if (!room) return;
        const seat = room.seats.find(s => s.socketId === socket.id);
        if (seat) {
            seat.cardsRevealed = true;
            if (seat.isBlind) {
                seat.isBlind = false;
                seat.bidStatus = 'Pasižiūrėjo (' + room.currentBid + ')';
                room.statusText = '👀 ' + seat.name + ' pasižiūrėjo į kortas (aklas x2 atšauktas)!';
            }
            broadcastState(roomCode);
        }
    });

    socket.on('placeBid', ({ roomCode, blind }) => {
        const room = rooms[roomCode];
        if (!room || room.phase !== 'BIDDING') return;
        const seatIdx = room.seats.findIndex(s => s.socketId === socket.id);
        if (seatIdx !== room.currentTurnIndex) return;

        const seat = room.seats[seatIdx];
        if (blind && !seat.cardsRevealed) {
            seat.isBlind = true;
        } else {
            seat.isBlind = false;
        }

        room.currentBid += 10;
        room.highestBidderIndex = seatIdx;
        seat.bidStatus = seat.isBlind ? ('🙈 Aklai: ' + room.currentBid + ' [x2]') : ('Stato: ' + room.currentBid);

        const activeCount = room.seats.filter(s => !s.passed).length;
        if (activeCount <= 1) {
            finishBidding(roomCode);
            return;
        }

        do {
            room.currentTurnIndex = (room.currentTurnIndex + 1) % 3;
        } while (room.seats[room.currentTurnIndex].passed);

        if (seat.isBlind) {
            room.statusText = '🙈 ' + seat.name + ' stato AKLAI ' + room.currentBid + ' [x2]! Dabar stato ' + room.seats[room.currentTurnIndex].name + '.';
        } else {
            room.statusText = 'Varžytinės: ' + seat.name + ' pastatė ' + room.currentBid + '. Dabar stato ' + room.seats[room.currentTurnIndex].name + '.';
        }
        broadcastState(roomCode);
        checkBotAction(roomCode);
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
socket.on('undiscardCard', ({ roomCode, discardIndex }) => {
const room = rooms[roomCode];
if (!room || (room.phase !== 'DISCARD_3' && room.phase !== 'RAISE_BID')) return;
const seatIdx = room.seats.findIndex(s => s.socketId === socket.id);
if (seatIdx !== room.highestBidderIndex) return;
const seat = room.seats[seatIdx];
const card = room.discardedPile.splice(discardIndex, 1).at(0);
if (!card) return;
seat.hand.push(card);
seat.roundScore -= card.value;
room.phase = 'DISCARD_3';
room.statusText = seat.name + ' susigrąžino kortą. Liko nusimesti: ' + (3 - room.discardedPile.length) + '.';
broadcastState(roomCode);
});
socket.on('adjustBidAfterTalon', ({ roomCode, delta }) => {
const room = rooms[roomCode];
if (!room || room.phase !== 'RAISE_BID') return;
const seatIdx = room.seats.findIndex(s => s.socketId === socket.id);
if (seatIdx !== room.highestBidderIndex) return;
let nextVal = room.currentBid + delta;
if (nextVal >= room.minBidAfterWin && nextVal <= 400) { room.currentBid = nextVal; broadcastState(roomCode); }
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
socket.on('sendChat', ({ roomCode, message }) => {
const room = rooms[roomCode];
if (!room || !message) return;
const seat = room.seats.find(s => s.socketId === socket.id);
if (!seat) return;
const cleanMsg = message.trim().slice(0, 120);
if (cleanMsg.length > 0) io.to(roomCode).emit('chatMessage', { sender: seat.name, avatar: seat.avatar, text: cleanMsg });
});
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Serveris veikia! Atsidaryk narsykleje: http://localhost:' + PORT));
// SERVERIO PABAIGA