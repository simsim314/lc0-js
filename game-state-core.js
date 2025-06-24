/*
 This file is part of Leela Chess Zero.
 Copyright (C) 2018 The LCZero Authors
*/

const GameStateCore = {
  startpos: function(controller) {
    BoardAnnotations.clearArrows(controller);
    controller.analysisCache = {}; 
    controller.fenUnderAnalysisP0 = null; // Corrected property name
    if(controller.state === ChessConstants.kStateRunning || controller.state === ChessConstants.kStateReplacing) {
        SearchManager.stop(controller); // Stop any ongoing analysis
    }

    controller.game.reset();
    controller.board.start(true); 
    controller.moveList = [];
    controller.moveIndex = 0;
    controller.gameResult = null;
    
    $('#trackedPlayerStatus').text(''); // Clear tracked player status


    if (controller.mode === ChessConstants.kModePlay) {
        controller.humanSide = 'w';
        controller.board.orientation('white'); 
        controller.currentBoardOrientation = 'white';
    } else if (controller.mode === ChessConstants.kModeAnalysis) {
        controller.board.orientation('white'); // Default to white for new game analysis start
        controller.currentBoardOrientation = 'white'; 
    }
    
    // Update UI first, then trigger analysis if applicable
    StatusDisplay.updateStatus(controller);
    UIManager.updateButtons(controller);
    if (controller.mode === ChessConstants.kModeAnalysis) {
         // Use setTimeout to ensure UI updates complete before analysis starts,
         // and engine has a chance to become ready if it was just started/reset.
        setTimeout(() => NavigationControl.triggerAnalysisForCurrentPosition(controller), 50);
    }
  },

  makeMove: function(controller, moveData) {
    if (controller.moveIndex < controller.moveList.length) {
        BoardAnnotations.clearArrows(controller);
        controller.analysisCache = {}; 
        controller.fenUnderAnalysisP0 = null; // Corrected property name
        if(controller.state === ChessConstants.kStateRunning || controller.state === ChessConstants.kStateReplacing) {
            SearchManager.stop(controller);
        }
        controller.moveList.splice(controller.moveIndex);
    }

    var move = controller.game.move(moveData);
    if (move == null) return null;

    controller.moveList.push(move);
    controller.moveIndex++;
    controller.gameResult = null; 

    GameResults.checkGameOver(controller); 

    // Update board display via onSnapEnd in controller after this
    // StatusDisplay and UIManager updates will also happen there or after analysis trigger
    
    // If a move is made in analysis mode (e.g. by clicking on board, which is not standard nav)
    // then trigger analysis for the new position.
    // This is now handled by onSnapEnd in controller-main.js
    return move;
  },

  getCurrentSetup: function(controller) {
    // This FEN will have the correct 'turn to move' based on controller.game state
    return "position fen " + controller.game.fen();
  },

  moveCount: function(controller, color) {
    var count = 0;
    for(var i=0; i < controller.moveIndex; i++) {
        if(controller.moveList[i].color === color) {
            count++;
        }
    }
    return count;
  },

  getFenFromSetup: function(setupString) {
    if (setupString && setupString.startsWith("position fen ")) {
        return setupString.substring("position fen ".length).split(" moves")[0];
    } else if (setupString && setupString.startsWith("position startpos")) {
        const g = new Chess(); return g.fen(); 
    }
    return null; 
  }
};
