/*
 This file is part of Leela Chess Zero.
 Copyright (C) 2018 The LCZero Authors

 Leela Chess is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 Leela Chess is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of THE GNU General Public License
 along with Leela Chess.  If not, see <http://www.gnu.org/licenses/>.
*/

const kStateOff = 0;
const kStateLoadingWeights = 5; // New state
const kStateReady = 1;
const kStateRunning = 2;
const kStateCancelling = 3;
const kStateReplacing = 4;


const kModePlay = 0;
const kModeAnalysis = 1;

const kRegexBestMove = /^bestmove ([a-h][1-8])([a-h][1-8])([nbrq])?/;
const kRegexResult = /Result "([^"]+)"/; 
const kRegexBasename = /^([^.]*)\..*$/;

const kOutcomeWhiteWon = {loser: 'b', mnemo: '1-0', text: 'White wins'};
const kOutcomeBlackWon = {loser: 'w', mnemo: '0-1', text: 'Black wins'};
const kOutcomeDraw = {mnemo: '1/2-1/2', text: 'Draw'};
const kOutcomeUnknown = {mnemo: '*', text: 'Ongoing or Unknown'};


const kOutcomes = [
  kOutcomeWhiteWon,
  kOutcomeBlackWon,
  kOutcomeDraw,
  kOutcomeUnknown,
];

const kOutcomeForLoser = {};
const kOutcomeForMnemo = {};

kOutcomes.forEach(function(outcome) {
  if (outcome.loser) kOutcomeForLoser[outcome.loser] = outcome;
  kOutcomeForMnemo[outcome.mnemo] = outcome;
});
kOutcomeForMnemo["1-0"] = kOutcomeWhiteWon;
kOutcomeForMnemo["0-1"] = kOutcomeBlackWon;
kOutcomeForMnemo["1/2-1/2"] = kOutcomeDraw;
kOutcomeForMnemo["*"] = kOutcomeUnknown;


const ChessConstants = {
  kStateOff: kStateOff,
  kStateLoadingWeights: kStateLoadingWeights, // New state
  kStateReady: kStateReady,
  kStateRunning: kStateRunning,
  kStateCancelling: kStateCancelling,
  kStateReplacing: kStateReplacing,

  kModePlay: kModePlay,
  kModeAnalysis: kModeAnalysis,

  kRegexBestMove: kRegexBestMove,
  kRegexResult: kRegexResult,
  kRegexBasename: kRegexBasename,

  kOutcomeWhiteWon: kOutcomeWhiteWon,
  kOutcomeBlackWon: kOutcomeBlackWon,
  kOutcomeDraw: kOutcomeDraw,
  kOutcomeUnknown: kOutcomeUnknown,
  kOutcomes: kOutcomes,
  kOutcomeForLoser: kOutcomeForLoser,
  kOutcomeForMnemo: kOutcomeForMnemo,
};
