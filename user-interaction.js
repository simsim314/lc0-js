/*
 This file is part of Leela Chess Zero.
 Copyright (C) 2018 The LCZero Authors
*/

const UserInteraction = {
  onDragStart: function(controller, source, piece, position, orientation) {
    if (controller.mode === ChessConstants.kModeAnalysis) return true; 
    if (controller.game.game_over()) return false;
    if (controller.game.turn() !== controller.humanSide) return false; 
    if (controller.state !== ChessConstants.kStateReady && controller.mode === ChessConstants.kModePlay) return false; 
    return true;
  },

  onDrop: function(controller, source, target) {
    if (controller.mode === ChessConstants.kModePlay && controller.state !== ChessConstants.kStateReady) {
      return 'snapback';
    }

    var moveData = {from: source, to: target, promotion: 'q'}; 
    var piece = controller.game.get(source);
    if (piece && piece.type === 'p') {
        const rank = target.charAt(1);
        if ((piece.color === 'w' && rank === '8') || (piece.color === 'b' && rank === '1')) {
            // moveData.promotion = prompt("Promote to (q, r, b, n):", "q") || 'q';
        }
    }

    var move = GameStateCore.makeMove(controller, moveData);
    if (move === null) return 'snapback';

    if (controller.mode === ChessConstants.kModePlay) {
      if (controller.gameResult) {
        GameResults.displayGameResult(controller);
      } else {
        PlayModeController.enginePlay(controller); 
      }
    }
  },

  onSnapEnd: function(controller) {
    controller.board.position(controller.game.fen());
    StatusDisplay.updateStatus(controller); 
    UIManager.updateButtons(controller);   
    // If a manual move was made in analysis mode, trigger analysis for new position
    // This is now handled in controller-main.js cfg.onSnapEnd
  },

  populateNetworks: function(controller) {
    var urls = null;
    $.ajax({
      url: 'networks.txt',
      async: false, 
      success: function(text) {
        urls = text.split(/\r?\n/);
      }
    });
    if (!urls) return;

    for (var i = 0; i < urls.length; i++) {
      var url = urls[i];
      if (!url || url.length === 0) continue;
      var match = url.match(ChessConstants.kRegexBasename);
      var label = match ? match[1] : url;
      $('#network').append($('<option></option>').attr('value', url).text(label));
      if (i === 0) controller.weightsUrl = url;
    }
  },

  applyParams: function(controller) {
    var selected = $('input[type=\'radio\'][name=\'go\']:checked');
    if (selected.val() === 'nodes') {
      var nodes = $('#gonodes').val();
      controller.playGoCmd = 'go nodes ' + nodes;
    } else {
      var movetime = $('#gomovetime').val();
      controller.playGoCmd = 'go movetime ' + movetime;
    }
  },

  applyNetwork: function(controller) {
    controller.weightsUrl = $('#network').find(':selected').val();
    EngineCommunication.createEngine(controller); 
  },

  analyzePgnFromText: function(controller) {
    const pgnText = $('#pgnTextInput').val().trim();
    const trackedPlayer = $('#trackedPlayerInput').val().trim();

    controller.trackedPlayerName = trackedPlayer || 'simsim314'; 
    $('#trackedPlayerInput').val(controller.trackedPlayerName); 

    if (pgnText === '') {
        UserInteraction.showError(controller, "PGN text area is empty.");
        return;
    }
    UserInteraction.processPgnString(controller, pgnText);
  },

  processPgnString: function(controller, pgnString) {
    if (!pgnString) {
        UserInteraction.showError(controller, "Empty PGN string provided.");
        return;
    }
    BoardAnnotations.clearArrows(controller); // Clear arrows before loading new PGN
    controller.analysisCache = {}; // Clear analysis cache for new PGN
    controller.fenUnderAnalysisP0 = null; // Corrected property name


    var loaded = controller.game.load_pgn(pgnString, {sloppy: true});

    if (!loaded) {
      UserInteraction.showError(controller, "Failed to load PGN. Ensure it's valid.");
      GameStateCore.startpos(controller); 
      $('#trackedPlayerStatus').text(''); 
      return;
    }

    controller.moveList = controller.game.history({verbose: true});
    controller.moveIndex = controller.moveList.length; 

    controller.gameResult = null; 
    const pgnHeader = controller.game.header();
    if (pgnHeader && pgnHeader.Result) {
      const outcome = ChessConstants.kOutcomeForMnemo[pgnHeader.Result];
      if (outcome) {
        controller.gameResult = {outcome: outcome, reason: "From PGN result"};
      }
    }
    if (!controller.gameResult) {
        GameResults.checkGameOver(controller);
    }
    
    UserInteraction.hideError();

    let trackedPlayerMessage = `Tracked player '${controller.trackedPlayerName}' not found in PGN.`;
    let boardOrientation = 'white'; 

    if (pgnHeader) {
        const whitePlayer = pgnHeader.White || "";
        const blackPlayer = pgnHeader.Black || "";
        const trackedLower = controller.trackedPlayerName.toLowerCase();

        if (whitePlayer.toLowerCase() === trackedLower) {
            trackedPlayerMessage = `${controller.trackedPlayerName} is White.`;
            boardOrientation = 'white';
        } else if (blackPlayer.toLowerCase() === trackedLower) {
            trackedPlayerMessage = `${controller.trackedPlayerName} is Black.`;
            boardOrientation = 'black';
        } else if (!whitePlayer && !blackPlayer) {
            trackedPlayerMessage = "PGN missing player names. Displaying White's perspective.";
        }
    } else {
        trackedPlayerMessage = "PGN headers not found. Displaying White's perspective.";
    }

    $('#trackedPlayerStatus').text(trackedPlayerMessage);
    controller.board.orientation(boardOrientation);
    controller.currentBoardOrientation = boardOrientation; // CRITICAL: Update controller's tracking

    NavigationControl.navigateBegin(controller); // This will call triggerAnalysisForCurrentPosition
  },

  engineError: function(controller, e) {
    UserInteraction.showError(controller, 'Engine error: ' + e.message + ' (line ' + e.lineno + ')');
    $('#trackedPlayerStatus').text(''); 
  },

  showError: function(controller, message) {
    $('#error-content').text(message);
    $('#error').show();
  },

  hideError: function() {
    $('#error').hide();
    $('#error-content').empty();
  }
};
