/*
 This file is part of Leela Chess Zero.
 Copyright (C) 2018 The LCZero Authors
*/

const SearchManager = {
  // Renamed from 'go' to be more specific
  startMainAnalysis: function(controller) { 
    controller.currentP0AnalysisVariations = []; // Clear previous main analysis results
    controller.playerMoveEvalData = null;       // Clear any pending/completed player move specific eval
    $('#variations').html('Analyzing...');      // Initial UI message

    if (controller.state !== ChessConstants.kStateReady && controller.state !== ChessConstants.kStateLoadingWeights) {
        console.warn("Engine not ready for main analysis. State:", controller.state, ". Search will be queued.");
    }
    
    const fenOfP0 = controller.game.fen();
    // controller.fenUnderAnalysisP0 will be set by requestSearch
    
    EngineCommunication.send(controller, 'setoption name MultiPV value 3');
    
    SearchManager.requestSearch(controller, {
      'type': 'multipv_P0', // Main analysis for current position P0
      'fenKey': fenOfP0, 
      'setup': GameStateCore.getCurrentSetup(controller), 
      'go': controller.playGoCmd 
    });
    UIManager.updateButtons(controller);
  },

  // For evaluating player's specific PGN move after P0 analysis is complete
  evaluatePlayerMoveAfterP0: function(controller, pgnMoveFromP0, bestScoreP0, bestIsMateP0) {
    if (controller.state !== ChessConstants.kStateReady) {
        console.warn("Engine not ready for player move evaluation. State:", controller.state, "Will attempt when ready.");
        // Store the request to be picked up when engine becomes ready
        // controller.fenUnderAnalysisP0 at this point is P0's FEN.
        controller.uciPendingSearch = {
            type: 'playermoveeval_P1',
            pgnMove: pgnMoveFromP0,
            preMoveFenP0: controller.fenUnderAnalysisP0, 
            bestScoreP0: bestScoreP0,
            bestIsMateP0: bestIsMateP0,
            // fenKey, setup, go will be added when dequeued if not already present
        };
        // Update UI to show "(evaluating)" for player move
        StatusDisplay.updatePlayerMoveRowInTable(controller, pgnMoveFromP0, "...", "(pending eval)", true);
        return;
    }

    const tempGame = new Chess(controller.fenUnderAnalysisP0); // Start from P0
    const moveResult = tempGame.move({ 
        from: pgnMoveFromP0.from, to: pgnMoveFromP0.to, promotion: pgnMoveFromP0.promotion 
    });

    if (!moveResult) {
        console.error("Invalid PGN move for secondary evaluation:", pgnMoveFromP0);
        StatusDisplay.updatePlayerMoveRowInTable(controller, pgnMoveFromP0, "Invalid", "");
        return;
    }
    const fenToEvaluateP1 = tempGame.fen();

    // playerMoveEvalData will be set by requestSearch
    
    EngineCommunication.send(controller, 'setoption name MultiPV value 1'); 
    SearchManager.requestSearch(controller, {
        'type': 'playermoveeval_P1', 
        'fenKey': fenToEvaluateP1, // This search is for fenToEvaluateP1
        'pgnMove': pgnMoveFromP0, 
        'preMoveFenP0': controller.fenUnderAnalysisP0, // P0 FEN context for playerMoveEvalData setup
        'bestScoreP0': bestScoreP0,
        'bestIsMateP0': bestIsMateP0,
        'setup': 'position fen ' + fenToEvaluateP1,
        'go': controller.playGoCmd 
    });
    // UIManager.updateButtons(controller); // Main analysis might still be considered running or replacing
  },

  stop: function(controller) { 
    SearchManager.cancelSearch(controller);
    // controller.fenUnderAnalysisP0 = null; // This is better cleared when engine confirms stop or starts new search
    // controller.playerMoveEvalData = null; // This is cleared by new P0 search or navigation typically
    UIManager.updateButtons(controller);
  },

  requestSearch: function(controller, searchRequest) { 
    if (!controller.worker) return;

    if (searchRequest.type === 'playermoveeval_P1') {
        if (searchRequest.pgnMove && searchRequest.preMoveFenP0 && searchRequest.fenKey) {
             controller.playerMoveEvalData = { 
                pgnMove: searchRequest.pgnMove,
                preMoveFenP0: searchRequest.preMoveFenP0, 
                fenBeingEvaluatedP1: searchRequest.fenKey, 
                bestScoreP0: searchRequest.bestScoreP0,    
                bestIsMateP0: searchRequest.bestIsMateP0,  
                scoreDataP1: null 
            };
        } else {
            console.error("Insufficient data in playermoveeval_P1 searchRequest to set playerMoveEvalData", searchRequest);
        }
    } else if (searchRequest.type === 'multipv_P0') {
        controller.currentP0AnalysisVariations = []; 
        controller.playerMoveEvalData = null;       
    }


    switch (controller.state) {
      case ChessConstants.kStateOff: 
      case ChessConstants.kStateLoadingWeights: 
        controller.uciPendingSearch = searchRequest; 
        break;
      case ChessConstants.kStateReady: {
        controller.state = ChessConstants.kStateRunning;
        controller.fenUnderAnalysisP0 = searchRequest.fenKey; 

        EngineCommunication.send(controller, searchRequest.setup);
        EngineCommunication.send(controller, searchRequest.go);
        break;
      }
      case ChessConstants.kStateRunning: { 
        controller.state = ChessConstants.kStateReplacing;
        controller.uciPendingSearch = searchRequest; 
        EngineCommunication.send(controller, 'stop'); 
        break;
      }
      case ChessConstants.kStateCancelling: { 
        // If we are cancelling, but a new request comes in (e.g. rapid navigation),
        // this new request should become the pending one.
        controller.state = ChessConstants.kStateReplacing; // Indicate we're stopping current to run pending.
        controller.uciPendingSearch = searchRequest;
        break;
      }
      case ChessConstants.kStateReplacing: { 
        // Already stopping to replace, just update the pending search to the newest one.
        controller.uciPendingSearch = searchRequest;
        break;
      }
    }
    UIManager.updateButtons(controller); 
  },

  cancelSearch: function(controller) {
    if (!controller.worker) return;

    switch (controller.state) {
      case ChessConstants.kStateOff:
      case ChessConstants.kStateLoadingWeights:
      case ChessConstants.kStateReady:
        // No active search to cancel.
        // If there's a uciPendingSearch, a "stop" action here (e.g. from stop button)
        // implies we want to clear that queue. Navigation would overwrite it.
        if (controller.uciPendingSearch) {
            controller.uciPendingSearch = null;
        }
        break;

      case ChessConstants.kStateRunning:
        // Stopping a currently running search.
        // Any uciPendingSearch at this point was for a replacement that won't happen now.
        controller.uciPendingSearch = null;
        controller.state = ChessConstants.kStateCancelling;
        EngineCommunication.send(controller, 'stop');
        break;

      case ChessConstants.kStateReplacing:
        // Was stopping to replace with uciPendingSearch. Now cancelling that replacement.
        controller.uciPendingSearch = null;
        controller.state = ChessConstants.kStateCancelling; // "stop" already sent.
        break;
      
      case ChessConstants.kStateCancelling:
        // Already trying to stop. If another "cancel" comes (e.g. rapid nav or stop clicks),
        // ensure any uciPendingSearch (which might have been set if we briefly went to kStateReplacing) is cleared.
        controller.uciPendingSearch = null;
        break;
    }
    // Do not clear currentP0AnalysisVariations or fenUnderAnalysisP0 here.
    // fenUnderAnalysisP0 is cleared when engine confirms stop (becomes ready) or when a new search starts.
    // currentP0AnalysisVariations allows user to see last computed lines.
    UIManager.updateButtons(controller);
  },

  searchResponse: function(controller, moveData) { 
    if (controller.mode !== ChessConstants.kModePlay) return;
    var move = GameStateCore.makeMove(controller, moveData);
    if (move == null) return; 
    controller.board.position(controller.game.fen());
    if (controller.gameResult) { GameResults.displayGameResult(controller); } 
    else { PlayModeController.enginePlay(controller); }
    UIManager.updateButtons(controller); 
  }
};
