/*
 This file is part of Leela Chess Zero.
 Copyright (C) 2018 The LCZero Authors
*/

// This function is called from HTML, so it needs to be global.
function openTab(evt, tabname) {
  $('.tabcontent').hide();
  $('.tablinks').removeClass('active');
  $('#' + tabname).show();
  if (evt && evt.currentTarget) {
    evt.currentTarget.className += ' active';
  }
}
window.openTab = openTab;

const UIManager = {
  updateButtons: function(controller) {
    const canNav = controller.mode === ChessConstants.kModeAnalysis;
    const moveCount = controller.moveList.length;
    const canNavBack = canNav && controller.moveIndex > 0;
    const canNavForward = canNav && controller.moveIndex < moveCount;

    $('#loadPgnBtn').prop('disabled', !canNav);
    $('#analyzePgnTextBtn').prop('disabled', !canNav);
    $('#pgnTextInput').prop('disabled', !canNav);
    $('#trackedPlayerInput').prop('disabled', !canNav);


    $('#navBegBtn').prop('disabled', !canNavBack);
    $('#navBckBtn').prop('disabled', !canNavBack);
    $('#navFwdBtn').prop('disabled', !canNavForward);
    $('#navEndBtn').prop('disabled', !canNavForward);

    const ready = controller.worker && controller.state !== ChessConstants.kStateOff;
    const analysisMode = ready && controller.mode === ChessConstants.kModeAnalysis;

    $('#goBtn').prop('disabled', !analysisMode);
    $('#stopBtn').prop('disabled', !analysisMode); // Should be disabled if not running

    if (controller.state === ChessConstants.kStateRunning || controller.state === ChessConstants.kStateReplacing) {
        $('#goBtn').prop('disabled', true);
        $('#stopBtn').prop('disabled', false);
    } else if (controller.state === ChessConstants.kStateReady && analysisMode) {
        $('#goBtn').prop('disabled', false);
        $('#stopBtn').prop('disabled', true);
    } else { // kStateOff, kStateCancelling or not analysisMode
        $('#goBtn').prop('disabled', true);
        $('#stopBtn').prop('disabled', true);
    }


    const playMode = ready && controller.mode === ChessConstants.kModePlay;
    const playBlack = playMode && 'w' === controller.humanSide;
    const playWhite = playMode && 'b' === controller.humanSide;
    const resign = playMode && !controller.gameResult;
    // Original: const takeback = playMode && this.moveCount(this.humanSide) > 0;
    const takeback = playMode && GameStateCore.moveCount(controller, controller.humanSide) > 0 && controller.moveIndex > 0;


    $('#playBlackBtn').prop('disabled', !playBlack);
    $('#playWhiteBtn').prop('disabled', !playWhite);
    $('#takebackBtn').prop('disabled', !takeback);
    $('#resignBtn').prop('disabled', !resign);
  },

  displayLogChanged: function(controller) {
    var choice = $('#logs').is(':checked');
    if (choice)
      $('#output').show();
    else
      $('#output').hide();
  },
};
