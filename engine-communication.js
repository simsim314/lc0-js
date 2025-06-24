/*
 This file is part of Leela Chess Zero.
 Copyright (C) 2018 The LCZero Authors
*/

const EngineCommunication = {
  createEngine: function(controller) {
    if (controller.worker) { controller.worker.terminate(); controller.worker = null; }
    CreateLC0Worker()
        .then(worker => EngineCommunication.initEngine(controller, worker))
        .catch(error => UserInteraction.showError(controller, 'Failed to create worker: ' + error));
    UIManager.updateButtons(controller);
  },

  initEngine: function(controller, worker) {
    controller.worker = worker;
    controller.worker.onmessage = (e) => EngineCommunication.receive(controller, e);
    controller.worker.onerror = (e) => UserInteraction.engineError(controller, e);
    controller.state = ChessConstants.kStateOff; 
    controller.uciPendingSearch = null;
    controller.currentP0AnalysisVariations = []; 
    controller.analysisCache = {}; 
    controller.fenUnderAnalysisP0 = null;
    controller.playerMoveEvalData = null;
    if (controller.weightsUrl) { controller.worker.postMessage('load ' + controller.weightsUrl); } 
    else { UserInteraction.showError(controller, "No weights URL configured."); }
    UIManager.updateButtons(controller);
  },

  send: function(controller, message) {
    if (!controller.worker) return;
    if (typeof message !== 'string') { console.error("EngineComm.send: Non-string message:", message); return; }
    controller.worker.postMessage(message);
    if ($('#logs').is(':checked') && (!message.startsWith('load ') || !message.includes("base64"))) {
        controller.output.value += 'send: ' + message + '\n';
        controller.output.scrollTop = controller.output.scrollHeight;
    }
  },

  receive: function(controller, e) {
    const message = e.data;
    if ($('#logs').is(':checked')) {
        if (Array.isArray(message)) { 
            if ((message[0].includes("Loading weights") && message[0].includes("%")) || message[0] === "Network loaded successfully") {
                 controller.output.value += message[1] + ': ' + message[0] + '\n';
            }
        } else if (typeof message === 'string') {
            controller.output.value += message + '\n';
        }
        controller.output.scrollTop = controller.output.scrollHeight;
    }
    EngineCommunication.interpret(controller, message); 
  },

  interpret: function(controller, message) {
    const oldState = controller.state;

    if (Array.isArray(message) && message[0] === "Network loaded successfully") { return; }
    if (typeof message !== 'string') { return; }

    // INFO LINE PARSING
    if (message.startsWith('info') && controller.state === ChessConstants.kStateRunning) {
        const isMainP0Analysis = controller.playerMoveEvalData === null && // Not currently evaluating a specific player move
                                 controller.fenUnderAnalysisP0 === controller.game.fen() && // And main analysis is for current board
                                 controller.mode === ChessConstants.kModeAnalysis;
        
        const isPlayerMoveSpecificEval = controller.playerMoveEvalData && 
                                         controller.playerMoveEvalData.fenBeingEvaluatedP1 === controller.fenUnderAnalysisP0; // fenUnderAnalysisP0 is used for current search FEN

        if (isMainP0Analysis || isPlayerMoveSpecificEval) {
            const parts = message.split(' ');
            let pvIndex = 0, scoreCp = null, scoreMate = null, pvMovesString = "", nodes = null, depth = null;
            
            if (isMainP0Analysis) { 
                 for (let i = 0; i < parts.length; i++) {
                    if (parts[i] === 'multipv' && i + 1 < parts.length) { pvIndex = parseInt(parts[i+1]) - 1; i++; break; }
                 }
            } // pvIndex remains 0 for player move eval (single PV)

            for (let i = 0; i < parts.length; i++) { /* ... parse depth, nodes, score, pv ... */ 
                const currentPart = parts[i];
                if (currentPart === 'depth' && i + 1 < parts.length) { depth = parseInt(parts[i+1]); i++; }
                else if (currentPart === 'nodes' && i + 1 < parts.length) { nodes = parseInt(parts[i+1]); i++; }
                else if (currentPart === 'score' && i + 1 < parts.length) {
                    if (parts[i+1] === 'cp' && i + 2 < parts.length) { scoreCp = parseInt(parts[i+2]); i += 2; }
                    else if (parts[i+1] === 'mate' && i + 2 < parts.length) { scoreMate = parseInt(parts[i+2]); i += 2; }
                } else if (currentPart === 'pv' && i + 1 < parts.length) { pvMovesString = parts.slice(i+1).join(' '); break; }
            }
            
            if ((scoreCp !== null || scoreMate !== null) && pvMovesString) {
                if (isPlayerMoveSpecificEval) {
                    if (!controller.playerMoveEvalData.scoreDataP1) controller.playerMoveEvalData.scoreDataP1 = {};
                    controller.playerMoveEvalData.scoreDataP1.cp = scoreCp;
                    controller.playerMoveEvalData.scoreDataP1.mate = scoreMate;
                    controller.playerMoveEvalData.scoreDataP1.pv = pvMovesString; 
                } else if (isMainP0Analysis && pvIndex >= 0 && pvIndex < 3) {
                    let firstUciMove = pvMovesString.split(' ')[0]; let sanMove = firstUciMove; 
                    if (firstUciMove) { try { const tempGame = new Chess(controller.fenUnderAnalysisP0); const mO = tempGame.move(firstUciMove,{sloppy:true}); if(mO && mO.san) sanMove = mO.san; } catch(e){}}
                    if (!Array.isArray(controller.currentP0AnalysisVariations)) controller.currentP0AnalysisVariations = [];
                    controller.currentP0AnalysisVariations[pvIndex] = { id: pvIndex + 1, depth: depth, nodes: nodes, move: sanMove, scoreCp: scoreCp, scoreMate: scoreMate, pvString: pvMovesString };
                    // CORRECTED FUNCTION NAME and ARGUMENTS
                    StatusDisplay.displayAnalysisVariations(controller, controller.currentP0AnalysisVariations, false); 
                }
            }
        }
    }

    switch (controller.state) {
      case ChessConstants.kStateOff:
        if (message === 'uciok') { EngineCommunication.send(controller, 'isready'); controller.state = ChessConstants.kStateLoadingWeights; } break;
      case ChessConstants.kStateLoadingWeights: 
        if (message === 'readyok') { 
            controller.state = ChessConstants.kStateReady;
            let searchToRun = controller.uciPendingSearch; 
            controller.uciPendingSearch = null;

            if (searchToRun) {
                if (searchToRun.type === 'playermoveeval_P1') {
                     const tempGame = new Chess(searchToRun.preMoveFenP0); // P0
                     tempGame.move(searchToRun.pgnMove); // Make player's move to get P1
                     searchToRun.setup = 'position fen ' + tempGame.fen();
                     searchToRun.go = controller.playGoCmd; 
                     searchToRun.fenKey = tempGame.fen(); // FEN of P1
                     EngineCommunication.send(controller, 'setoption name MultiPV value 1');
                } else if (searchToRun.type === 'multipv_P0') {
                     EngineCommunication.send(controller, 'setoption name MultiPV value 3');
                } else if (!searchToRun.setup || !searchToRun.go) { // Fallback if type missing but was from old queue
                    console.error("Pending search missing setup/go and unknown type:", searchToRun); break; 
                }
                SearchManager.requestSearch(controller, searchToRun);
            } else if (controller.mode === ChessConstants.kModeAnalysis) { 
                NavigationControl.triggerAnalysisForCurrentPosition(controller);
            } else if (controller.mode === ChessConstants.kModePlay && controller.game.turn() !== controller.humanSide && !controller.gameResult) {
                PlayModeController.enginePlay(controller);
            }
        } break;
      case ChessConstants.kStateReady: /* No change from before */ break;
      case ChessConstants.kStateRunning: {
        var matchRun = message.match(ChessConstants.kRegexBestMove);
        if (matchRun) {
          if (controller.playerMoveEvalData && 
              controller.playerMoveEvalData.fenBeingEvaluatedP1 === controller.fenUnderAnalysisP0) { // Was fenUnderAnalysisP0 used for P1's FEN?
            StatusDisplay.finalizePlayerMoveEvaluation(controller); 
            // playerMoveEvalData is cleared within finalizePlayerMoveEvaluation or on next navigation/go
          } else if (controller.mode === ChessConstants.kModeAnalysis && controller.fenUnderAnalysisP0 === controller.game.fen()) {
            // This is bestmove for P0's main analysis
            if (controller.fenUnderAnalysisP0) { // Cache results for P0
                controller.analysisCache[controller.fenUnderAnalysisP0] = JSON.parse(JSON.stringify(controller.currentP0AnalysisVariations.filter(v => v))); 
            }
            // Now, after P0 analysis is complete and cached, trigger player move display/eval
            // CORRECTED FUNCTION NAME and ARGUMENTS
            StatusDisplay.displayAnalysisVariations(controller, controller.currentP0AnalysisVariations, true); // isFinalDisplayForP0 = true
          } else if (controller.mode === ChessConstants.kModePlay) {
            SearchManager.searchResponse(controller, {from: matchRun[1], to: matchRun[2], promotion: matchRun[3]});
          }
          controller.state = ChessConstants.kStateReady;
          controller.fenUnderAnalysisP0 = null; // Clear FEN that was under analysis

          // Process any pending search (e.g., a navigation happened while this search was finishing)
          if (controller.uciPendingSearch && controller.state === ChessConstants.kStateReady) {
              let nextSearch = controller.uciPendingSearch; controller.uciPendingSearch = null;
              // (Reconstruction logic for nextSearch.setup/go if type is playermoveeval_P1 as above)
              if (nextSearch.type === 'playermoveeval_P1' && (!nextSearch.setup || !nextSearch.go)) {
                    const tempGame = new Chess(nextSearch.preMoveFenP0);
                    tempGame.move(nextSearch.pgnMove);
                    nextSearch.setup = 'position fen ' + tempGame.fen();
                    nextSearch.go = controller.playGoCmd; 
                    nextSearch.fenKey = tempGame.fen();
              } else if (!nextSearch.setup || !nextSearch.go) { break; } // Skip malformed
              if(nextSearch.type === 'multipv_P0') EngineCommunication.send(controller, 'setoption name MultiPV value 3');
              else if (nextSearch.type === 'playermoveeval_P1') EngineCommunication.send(controller, 'setoption name MultiPV value 1');
              SearchManager.requestSearch(controller, nextSearch);
          }
        }
        break;
      }
      case ChessConstants.kStateCancelling: { /* No change from before */ break; }
      case ChessConstants.kStateReplacing: { /* Logic for starting pendingSearch needs to correctly set type and fenUnderAnalysisP0 */ 
          if (message.includes("bestmove")) { 
            const pendingSearch = controller.uciPendingSearch;
            controller.uciPendingSearch = null;
            controller.fenUnderAnalysisP0 = null; 
            controller.playerMoveEvalData = null;
            controller.currentP0AnalysisVariations = []; 
            $('#variations').html(''); 

            if (pendingSearch) {
               if (pendingSearch.type === 'playermoveeval_P1' && (!pendingSearch.setup || !pendingSearch.go)) {
                  const tempGame = new Chess(pendingSearch.preMoveFenP0);
                  tempGame.move(pendingSearch.pgnMove);
                  pendingSearch.setup = 'position fen ' + tempGame.fen();
                  pendingSearch.go = controller.playGoCmd; 
                  pendingSearch.fenKey = tempGame.fen();
               } else if (!pendingSearch.setup || !pendingSearch.go) {
                  controller.state = ChessConstants.kStateReady; break;
               }

              if(pendingSearch.type === 'multipv_P0') { EngineCommunication.send(controller, 'setoption name MultiPV value 3'); }
              else if (pendingSearch.type === 'playermoveeval_P1') { EngineCommunication.send(controller, 'setoption name MultiPV value 1'); }
              SearchManager.requestSearch(controller, pendingSearch); 
            } else {
              controller.state = ChessConstants.kStateReady; 
            }
          } break;
        }
    } // end switch

    if (controller.state !== oldState) { UIManager.updateButtons(controller); }
    
    if (controller.state === ChessConstants.kStateReady && oldState !== ChessConstants.kStateReady && controller.uciPendingSearch) {
        let searchToStart = controller.uciPendingSearch; controller.uciPendingSearch = null; 
        if (searchToStart.type === 'playermoveeval_P1' && (!searchToStart.setup || !searchToStart.go)) {
            const tempGame = new Chess(searchToStart.preMoveFenP0);
            tempGame.move(searchToStart.pgnMove);
            searchToStart.setup = 'position fen ' + tempGame.fen();
            searchToStart.go = controller.playGoCmd; 
            searchToStart.fenKey = tempGame.fen();
        } else if (!searchToStart.setup || !searchToStart.go) { return; }
        if(searchToStart.type === 'multipv_P0') { EngineCommunication.send(controller, 'setoption name MultiPV value 3');}
        else if (searchToStart.type === 'playermoveeval_P1') { EngineCommunication.send(controller, 'setoption name MultiPV value 1');}
        SearchManager.requestSearch(controller, searchToStart);
    }
  }
};
