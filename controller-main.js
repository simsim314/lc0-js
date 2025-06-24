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
    const windowWidth = $(window).width(); 
    const windowHeight = $(window).height();

    let staticVerticalSpace = (titleDiv.outerHeight(true) || 0) + (creditsDiv.outerHeight(true) || 0) + 20; 
    let availableHeightForLayout = windowHeight - staticVerticalSpace;
    let availableWidthForLayout = windowWidth - 10; 

    let boardSize; 
    const minBoardSize = 250; 
    const maxBoardSize = Math.min(700, availableWidthForLayout, availableHeightForLayout * 0.8); 

    const minMainContentWidth = 280; 
    const moveControlsHeight = $('#move-controls').outerHeight(true) || 60;

    const stackingThresholdWidth = minBoardSize + minMainContentWidth + 30; 
    const stackingThresholdHeight = minBoardSize + 150; 

    if (windowWidth < stackingThresholdWidth || availableHeightForLayout < stackingThresholdHeight) { 
        layoutWrapper.removeClass('layout-side-by-side').addClass('layout-stacked');
        
        let widthForBoard = availableWidthForLayout * 0.95; 
        boardSize = Math.min(widthForBoard, maxBoardSize);
        boardSize = Math.min(boardSize, availableHeightForLayout - moveControlsHeight - 80); 

        boardArea.css('width', '100%'); 
        mainContentPane.css('width', '95%'); 
        mainContentPane.css('max-width', '600px'); 
        mainContentPane.css('flex-grow', '0'); 
        mainContentPane.css('height', 'auto');

    } else { 
        layoutWrapper.removeClass('layout-stacked').addClass('layout-side-by-side');
        
        let heightForBoard = availableHeightForLayout - moveControlsHeight;
        let widthForBoard = availableWidthForLayout - minMainContentWidth - 20; 
        boardSize = Math.min(widthForBoard, heightForBoard);

        boardArea.css('width', boardSize + 'px'); 
        mainContentPane.css('width', ''); 
        mainContentPane.css('max-width', '');
        mainContentPane.css('flex-grow', '1');
        mainContentPane.css('height', ''); 
    }

    boardSize = Math.max(minBoardSize, Math.min(boardSize, maxBoardSize));

    boardContainer.css({width: boardSize + 'px', height: boardSize + 'px'});
    
    self.board.resize(); 
    BoardAnnotations.resizeArrowCanvas(self); 
    self.redrawCurrentArrows();
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
  
  // PGN Input Button Handlers
  $('#pastePgnBtn').on('click', function() { UserInteraction.pasteAndAnalyzePgnFromClipboard(self); }); // New button
  $('#analyzePgnTextBtn').on('click', function() { UserInteraction.analyzePgnFromText(self); });

  $('#applyParams').on('click', function() { UserInteraction.applyParams(self); });
  $('#logs').change(function() { UIManager.displayLogChanged(self); }); 
  UserInteraction.populateNetworks(self); 
  $('#applyNetwork').on('click', function() { UserInteraction.applyNetwork(self); });
  $('#restartEngineBtn').on('click', function() { 
      UserInteraction.showError(self, "Restarting engine..."); 
      setTimeout(() => UserInteraction.hideError(), 2000); 
      EngineCommunication.createEngine(self); 
  });
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
