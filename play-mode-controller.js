/*
 This file is part of Leela Chess Zero.
 Copyright (C) 2018 The LCZero Authors
*/

const PlayModeController = {
  modeChanged: function(controller) {
    var selected = $('input[type=\'radio\'][name=\'mode\']:checked');
    var newMode = selected.val() === 'play' ? ChessConstants.kModePlay : ChessConstants.kModeAnalysis;
    if (newMode === controller.mode) return;

    controller.mode = newMode;
    if (controller.mode === ChessConstants.kModePlay) {
      controller.humanSide = controller.game.turn();
      SearchManager.cancelSearch(controller); // Stop any ongoing analysis
    } else { // Analysis mode
      controller.humanSide = null; // No human side in analysis
      // Potentially stop engine if it was playing a game
      SearchManager.cancelSearch(controller);
    }
    UIManager.updateButtons(controller);
  },

  enginePlay: function(controller) {
    if (controller.mode !== ChessConstants.kModePlay) return;
    if (controller.game.turn() === controller.humanSide) return; // Human's turn
    if (controller.gameResult) return; // Game over

    SearchManager.requestSearch(controller, {
      'setup': GameStateCore.getCurrentSetup(controller),
      'go': controller.playGoCmd
    });
    UIManager.updateButtons(controller);
  },

  playWhite: function(controller) {
    if (controller.mode !== ChessConstants.kModePlay) return;
    if (controller.humanSide === 'w') return; // Already playing white
    controller.board.orientation('white');
    controller.humanSide = 'w';
    SearchManager.cancelSearch(controller); // Cancel if engine was thinking for black
    PlayModeController.enginePlay(controller); // Engine might play if it's black's turn
    UIManager.updateButtons(controller);
  },

  playBlack: function(controller) {
    if (controller.mode !== ChessConstants.kModePlay) return;
    if (controller.humanSide === 'b') return; // Already playing black
    controller.board.orientation('black');
    controller.humanSide = 'b';
    SearchManager.cancelSearch(controller); // Cancel if engine was thinking for white
    PlayModeController.enginePlay(controller); // Engine might play if it's white's turn
    UIManager.updateButtons(controller);
  },

  takeback: function(controller) {
    if (controller.mode !== ChessConstants.kModePlay) return;
    SearchManager.cancelSearch(controller); // Stop engine if it's thinking

    // Take back one human move and one engine move (if applicable)
    // Undo until it's human's turn again, or 2 ply if human just moved.
    // Original logic: undo until last move's color was humanSide
    let movesToUndo = 0;
    if (controller.moveIndex > 0 && controller.moveList[controller.moveIndex-1].color !== controller.humanSide) {
        movesToUndo++; // Undo engine's last move
    }
    if (controller.moveIndex - movesToUndo > 0 && controller.moveList[controller.moveIndex - movesToUndo -1].color === controller.humanSide) {
        movesToUndo++; // Undo human's last move
    }

    if (movesToUndo === 0 && controller.moveIndex > 0) { // If it's engine's turn, human just moved. Undo one pair.
         // This case should be covered by above, but as a fallback, undo at least one move if possible.
    }


    for(let i=0; i<movesToUndo && controller.moveIndex > 0; i++) {
        controller.game.undo();
        controller.moveIndex--;
    }
    controller.gameResult = null; // Game might not be over anymore

    controller.board.position(controller.game.fen());
    UIManager.updateButtons(controller);
    StatusDisplay.updateStatus(controller);
    PlayModeController.enginePlay(controller); // Let engine think if it's its turn now
  },

  resign: function(controller) {
    if (controller.mode !== ChessConstants.kModePlay) return;
    if (controller.gameResult) return; // Game already over
    SearchManager.cancelSearch(controller);

    // controller.moveList.splice(controller.moveIndex); // Not needed, game is over
    const outcome = ChessConstants.kOutcomeForLoser[controller.humanSide];
    const loser = controller.humanSide === 'w' ? 'White' : 'Black';
    controller.gameResult = {outcome: outcome, reason: loser + ' resigned'};

    GameResults.displayGameResult(controller);
    StatusDisplay.updateStatus(controller); // To show result in PGN
    UIManager.updateButtons(controller);
  }
};
