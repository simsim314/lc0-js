/*
 This file is part of Leela Chess Zero.
 Copyright (C) 2018 The LCZero Authors
*/

const NavigationControl = {
  _performNavigateAction: function(controller, gameUpdateFn) {
    BoardAnnotations.clearArrows(controller);
    controller.playerMoveEvalData = null; // Clear specific player move eval context on any navigation
    
    const navigateAndAnalyze = function() {
        gameUpdateFn(); 
        controller.board.position(controller.game.fen()); 
        StatusDisplay.updateStatus(controller);           
        UIManager.updateButtons(controller);              
        NavigationControl.triggerAnalysisForCurrentPosition(controller); 
    };

    if (controller.state === ChessConstants.kStateRunning || controller.state === ChessConstants.kStateReplacing) {
        SearchManager.stop(controller); 
        // After stopping, the new analysis will be queued if triggerAnalysis calls SearchManager.startMainAnalysis
        // while engine is still busy stopping/resetting.
    }
    navigateAndAnalyze(); 
  },

  navigateBegin: function(controller) {
    NavigationControl._performNavigateAction(controller, function() {
        while (controller.moveIndex > 0) {
          controller.game.undo();
          controller.moveIndex--;
        }
    });
  },

  navigateEnd: function(controller) {
    NavigationControl._performNavigateAction(controller, function() {
        while (controller.moveIndex < controller.moveList.length) {
          var move = controller.moveList[controller.moveIndex];
          if (controller.game.move(move) === null) break;
          controller.moveIndex++;
        }
    });
  },

  navigateBack: function(controller) {
    if (controller.moveIndex === 0) return;
    NavigationControl._performNavigateAction(controller, function() {
        controller.game.undo(); 
        controller.moveIndex--;
    });
  },

  navigateForward: function(controller) {
    if (controller.moveIndex === controller.moveList.length) return;
    NavigationControl._performNavigateAction(controller, function() {
        var move = controller.moveList[controller.moveIndex];
        if (controller.game.move(move) === null) return; 
        controller.moveIndex++;
    });
  },

  triggerAnalysisForCurrentPosition: function(controller) {
    StatusDisplay.updateStatus(controller); 
    UIManager.updateButtons(controller);   

    if (controller.mode === ChessConstants.kModeAnalysis) {
      const currentFen = controller.game.fen();
      controller.currentBoardOrientation = controller.board.orientation(); 
      controller.playerMoveEvalData = null; // New position, clear any old player move specific context

      BoardAnnotations.clearArrows(controller); 

      if (controller.analysisCache[currentFen]) {
        StatusDisplay.displayAnalysisVariations(controller, controller.analysisCache[currentFen], true); // true = isFromCache / isFinalForP0
      } else {
        if (controller.state === ChessConstants.kStateReady) {
            $('#variations').html('Analyzing position...'); 
            // CORRECTED FUNCTION NAME
            SearchManager.startMainAnalysis(controller); 
        } else {
            // If engine not ready, queue the main analysis.
            // SearchManager.startMainAnalysis will internally call requestSearch which handles queuing.
            $('#variations').html('Engine busy, queuing analysis...');
             SearchManager.startMainAnalysis(controller);
        }
      }
    } else {
        BoardAnnotations.clearArrows(controller);
        $('#variations').html('');
        controller.currentP0AnalysisVariations = [];
    }
  }
};
