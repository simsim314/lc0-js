/*
 This file is part of Leela Chess Zero.
 Copyright (C) 2018 The LCZero Authors
*/

const GameResults = {
  displayGameResult: function(controller) {
    if (!controller.gameResult) return;
    $('#popup div h2').text(controller.gameResult.reason + '!');
    $('#popup div h3').text(controller.gameResult.outcome.text + '.');
    $('#popup').addClass('show-modal');
  },

  checkGameOver: function(controller) {
    if (controller.game.game_over()) {
      var reason = null;
      var outcome = null;
      if (controller.game.in_checkmate()) {
        outcome = ChessConstants.kOutcomeForLoser[controller.game.turn()];
        reason = 'Checkmate';
      } else {
        outcome = ChessConstants.kOutcomeDraw;
        if (controller.game.in_stalemate()) {
          reason = 'Stalemate';
        } else if (controller.game.in_threefold_repetition()) {
          reason = 'Threefold repetition';
        } else if (controller.game.insufficient_material()) {
          reason = 'Insufficient material';
        } else { // Default draw reason if not one of the above common ones (e.g. 50-move)
          reason = 'Draw by rule';
        }
      }
      controller.gameResult = {outcome: outcome, reason: reason};
    }
  }
};
