/*
 This file is part of Leela Chess Zero.
 Copyright (C) 2018 The LCZero Authors
*/

function Controller() {
  var self = this; // The controller instance

  // Initialize properties (state)
  self.game = new Chess();
  self.moveList = [];
  self.moveIndex = 0;
  self.gameResult = null;

  self.state = ChessConstants.kStateOff;
  self.mode = ChessConstants.kModeAnalysis; 
  self.humanSide = 'w'; 
  self.trackedPlayerName = 'simsim314'; 

  self.output = document.getElementById('output');
  self.playGoCmd = 'go nodes 50'; 
  self.currentP0AnalysisVariations = []; 
  self.analysisCache = {}; 
  self.fenUnderAnalysisP0 = null;       
  self.playerMoveEvalData = null;     

  self.weightsUrl = ''; 
  self.uciPendingSearch = null; 
  self.worker = null;

  self.arrowCanvas = document.getElementById('arrowCanvas');
  self.arrowCanvasCtx = self.arrowCanvas.getContext('2d');
  self.currentBoardOrientation = 'white'; 

  var cfg = {
    draggable: true,
    showNotation: true,
    position: 'start',
    onDragStart: function(source, piece, position, orientation) {
      self.currentBoardOrientation = self.board.orientation(); 
      BoardAnnotations.clearArrows(self); 
      self.playerMoveEvalData = null; 
      return UserInteraction.onDragStart(self, source, piece, position, orientation); 
    },
    onDrop: function(source, target) {
      BoardAnnotations.clearArrows(self); 
      self.playerMoveEvalData = null;
      return UserInteraction.onDrop(self, source, target); 
    },
    onSnapEnd: function() {
      UserInteraction.onSnapEnd(self); 
      if (self.mode === ChessConstants.kModeAnalysis) {
        NavigationControl.triggerAnalysisForCurrentPosition(self);
      }
    },
    onChange: function(oldPos, newPos) {
        BoardAnnotations.resizeArrowCanvas(self); 
        self.redrawCurrentArrows(); 
    }
  };
  self.board = ChessBoard('board', cfg); 
  self.currentBoardOrientation = self.board.orientation(); 

  self.redrawCurrentArrows = function() {
      if (self.mode === ChessConstants.kModeAnalysis) {
          BoardAnnotations.clearArrows(self);
          const currentFenP0 = self.game.fen(); 
          
          let p0Variations = self.analysisCache[currentFenP0] || 
                             (self.fenUnderAnalysisP0 === currentFenP0 ? self.currentP0AnalysisVariations : []);
          
          StatusDisplay.displayAnalysisVariations(self, p0Variations, self.analysisCache[currentFenP0] !== undefined);
      }
  };
  
  self.adjustBoardLayout = function() {
    const layoutWrapper = $('#layout-wrapper');
    const boardArea = $('#board-area'); 
    const boardContainer = $('#boardContainer');
    const mainContentPane = $('#main-content-pane');
    const titleDiv = $('#title');
    const creditsDiv = $('#credits');
    const windowWidth = $(window).width(); const windowHeight = $(window).height();
    let staticVerticalSpace = (titleDiv.outerHeight(true) || 0) + (creditsDiv.outerHeight(true) || 0) + 20;
    let availableHeightForFlexItems = windowHeight - staticVerticalSpace;
    let availableWidthForFlexItems = windowWidth - 10; 
    let boardSize; const minBoardSize = 280; const maxBoardSize = 700; 
    const minMainContentWidth = 320; const moveControlsHeight = $('#move-controls').outerHeight(true) || 60;
    const stackingThreshold = minBoardSize + minMainContentWidth + 30; 

    if (windowWidth < stackingThreshold || availableHeightForFlexItems < minBoardSize + 100) { 
        layoutWrapper.removeClass('layout-side-by-side').addClass('layout-stacked');
        let widthForBoard = availableWidthForFlexItems * 0.95; 
        boardSize = Math.min(widthForBoard, maxBoardSize);
        boardSize = Math.min(boardSize, availableHeightForFlexItems - moveControlsHeight - 50); 
    } else { 
        layoutWrapper.removeClass('layout-stacked').addClass('layout-side-by-side');
        let heightForBoard = availableHeightForFlexItems - moveControlsHeight;
        let widthForBoard = availableWidthForFlexItems - minMainContentWidth - 10; 
        boardSize = Math.min(widthForBoard, heightForBoard);
    }
    boardSize = Math.max(minBoardSize, Math.min(boardSize, maxBoardSize));
    boardContainer.css({width: boardSize + 'px', height: boardSize + 'px'});
    if (layoutWrapper.hasClass('layout-side-by-side')) { boardArea.css('width', boardSize + 'px'); } 
    else { boardArea.css('width', '100%'); }
    self.board.resize(); BoardAnnotations.resizeArrowCanvas(self); self.redrawCurrentArrows();
  };

  $(window).on('resize', self.adjustBoardLayout);
  setTimeout(self.adjustBoardLayout, 250); 

  $('input:radio[name="mode"]').change(function() { 
      PlayModeController.modeChanged(self); BoardAnnotations.clearArrows(self); self.playerMoveEvalData = null; 
      if (self.mode === ChessConstants.kModeAnalysis) { NavigationControl.triggerAnalysisForCurrentPosition(self); }
  });
  $('#error').on('click', function() { UserInteraction.hideError(); }); 
  $('#startBtn').on('click', function() { GameStateCore.startpos(self); });
  $('#flipBtn').on('click', function() { 
      self.board.flip(); self.currentBoardOrientation = self.board.orientation();
      BoardAnnotations.clearArrows(self); self.playerMoveEvalData = null; 
      if (self.mode === ChessConstants.kModeAnalysis) { NavigationControl.triggerAnalysisForCurrentPosition(self); }
  }); 
  $('#navBegBtn').on('click', function() { NavigationControl.navigateBegin(self); });
  $('#navBckBtn').on('click', function() { NavigationControl.navigateBack(self); });
  $('#navFwdBtn').on('click', function() { NavigationControl.navigateForward(self); });
  $('#navEndBtn').on('click', function() { NavigationControl.navigateEnd(self); });
  $('#analyzePgnTextBtn').on('click', function() { UserInteraction.analyzePgnFromText(self); });
  $('#applyParams').on('click', function() { UserInteraction.applyParams(self); });
  $('#logs').change(function() { UIManager.displayLogChanged(self); }); 
  UserInteraction.populateNetworks(self); 
  $('#applyNetwork').on('click', function() { UserInteraction.applyNetwork(self); });
  $('#playWhiteBtn').on('click', function() { PlayModeController.playWhite(self); BoardAnnotations.clearArrows(self); self.playerMoveEvalData = null;});
  $('#playBlackBtn').on('click', function() { PlayModeController.playBlack(self); BoardAnnotations.clearArrows(self); self.playerMoveEvalData = null;});
  $('#takebackBtn').on('click', function() { 
      PlayModeController.takeback(self); self.playerMoveEvalData = null;
      if (self.mode === ChessConstants.kModeAnalysis) { NavigationControl.triggerAnalysisForCurrentPosition(self); } 
      else { BoardAnnotations.clearArrows(self); }
  });
  $('#resignBtn').on('click', function() { PlayModeController.resign(self); BoardAnnotations.clearArrows(self); self.playerMoveEvalData = null;});
  $('#goBtn').on('click', function() { BoardAnnotations.clearArrows(self); self.playerMoveEvalData = null; SearchManager.startMainAnalysis(self); }); 
  $('#stopBtn').on('click', function() { SearchManager.stop(self); });
  $('#restartEngineBtn').on('click', function() { // Added Restart Engine Button Handler
      UserInteraction.showError(self, "Restarting engine..."); // Optional: provide feedback
      setTimeout(() => UserInteraction.hideError(), 2000); // Hide message after a bit
      EngineCommunication.createEngine(self); 
  });
  $('#toggleParamsBtn').on('click', function() {
    const paramsSection = $('#parameters-section');
    if (paramsSection.is(':visible')) { paramsSection.slideUp(); $(this).text('Show Parameters'); } 
    else { paramsSection.slideDown(); $(this).text('Hide Parameters'); }
  });
  $('#popup').find('*').on('click', function() { $('#popup').removeClass('show-modal'); });

  if (!$('input:radio[name="mode"]:checked').length) { $('input:radio[name="mode"][value="analysis"]').prop('checked', true); }
  PlayModeController.modeChanged(self); UserInteraction.applyParams(self); EngineCommunication.createEngine(self); 
}
$(document).ready(function() { new Controller(); });
function preventBehavior(e) { e.preventDefault(); }
document.addEventListener('touchmove', preventBehavior, {passive: false});
