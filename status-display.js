/*
 This file is part of Leela Chess Zero.
 Copyright (C) 2018 The LCZero Authors
*/

const StatusDisplay = {
  // Helper function to convert UCI scores to White's perspective
  _getScoreFromWhitePerspective: function(scoreCp, scoreMate, turnToMove) {
    let whiteScoreCp = scoreCp;
    let whiteScoreMate = scoreMate;

    if (turnToMove === 'b') { // If it's Black's turn, UCI score is for Black. Invert for White.
        if (whiteScoreCp !== null && whiteScoreCp !== undefined) whiteScoreCp *= -1;
        if (whiteScoreMate !== null && whiteScoreMate !== undefined) whiteScoreMate *= -1;
    }
    return { cp: whiteScoreCp, mate: whiteScoreMate };
  },

  updateStatus: function(controller) {
    var lastMove;
    if (controller.moveIndex > 0 && controller.moveList.length > 0 && controller.moveIndex <= controller.moveList.length) {
      var san = controller.moveList[controller.moveIndex - 1].san;
      var fullMoves = Math.floor((controller.moveList[controller.moveIndex - 1].turn === 'w' ? controller.moveIndex + 1 : controller.moveIndex) / 2);
      if (controller.moveList[controller.moveIndex - 1].color === 'b') { 
        lastMove = 'After ' + fullMoves + '. ... ' + san + '.';
      } else { 
        lastMove = 'After ' + fullMoves + '. ' + san + '.';
      }
    } else {
      lastMove = 'Starting position.';
      const headerFen = controller.game.header().FEN;
      if (headerFen && headerFen !== new Chess().fen()) { 
        lastMove = 'Starting from FEN.';
      }
    }
    $('#status').text(lastMove);

    var pgn = '';
    for (var i = 0; i < controller.moveList.length; i++) {
      if (controller.moveList[i].color === 'w') { 
        if (pgn.length > 0) pgn += ' ';
        pgn += (1 + Math.floor(i / 2)) + '.'; 
      }
      var san = controller.moveList[i].san;
      pgn += ' ';
      var current = i + 1 === controller.moveIndex;
      if (current) pgn += '<b>';
      pgn += san;
      if (current) pgn += '</b>';
    }
    if (controller.gameResult && controller.gameResult.outcome) {
      pgn += ' ' + controller.gameResult.outcome.mnemo;
    }
    $('#movelist').html(pgn);
  },

  parseUciMove: function(uciMove) {
    if (typeof uciMove === 'string' && uciMove.length >= 4) {
      return {
        from: uciMove.substring(0, 2),
        to: uciMove.substring(2, 4),
        promotion: uciMove.length === 5 ? uciMove.substring(4, 5) : undefined
      };
    }
    return null;
  },

  getAnnotationForCpLoss: function(cpLoss, bestScoreIsMateForEngine, pgnMoveIsMateForPlayer) {
    // Note: bestScoreIsMateForEngine and pgnMoveIsMateForPlayer are from White's perspective here.
    // Positive mate = White mates. Negative mate = Black mates (White gets mated).
    if (bestScoreIsMateForEngine > 0 && !(pgnMoveIsMateForPlayer > 0)) return '??'; // White had a mate, but player's move doesn't mate (or worse)
    if (bestScoreIsMateForEngine < 0 && pgnMoveIsMateForPlayer > 0) return '!!'; // White was getting mated, but player finds a mate for White
    if (bestScoreIsMateForEngine < 0 && (pgnMoveIsMateForPlayer === null || pgnMoveIsMateForPlayer <= bestScoreIsMateForEngine) ) return '?'; // White was getting mated, and player's move is still a mate for Black or non-mating eval
    if (pgnMoveIsMateForPlayer < 0 && (bestScoreIsMateForEngine === null || bestScoreIsMateForEngine > pgnMoveIsMateForPlayer)) return '??'; // Player's move leads to mate for Black, and engine's best was not (or was a less severe mate for Black)


    if (isNaN(cpLoss)) return "";
    // cpLoss is absolute difference from White's perspective if not mate-related
    if (cpLoss <= 15) return '!!'; 
    if (cpLoss <= 40) return '!';  
    if (cpLoss <= 90) return '';   
    if (cpLoss <= 180) return '?!'; 
    if (cpLoss <= 350) return '?';  
    return '??'; 
  },

  displayAnalysisVariations: function(controller, engineVariationsP0, isFinalDisplayP0 = false) {
    const variationsDiv = $('#variations');
    const currentPgnMoveIndex = controller.moveIndex; 
    const preMoveFenP0 = controller.game.fen(); 
    const turnAtP0 = (new Chess(preMoveFenP0)).turn();

    const variationsP0 = Array.isArray(engineVariationsP0) ? engineVariationsP0.filter(v => v && typeof v === 'object') : [];
    
    BoardAnnotations.clearArrows(controller); 
    variationsDiv.empty(); 

    let htmlTable = '<table style="width:100%; font-size: 90%; border-collapse: collapse;">';
    let bestEngineMoveDataP0_wp = null; // _wp for White Perspective
    
    const bestRawPvP0 = variationsP0.find(pv => pv.id === 1);
    if (bestRawPvP0) {
        const wpBestScores = StatusDisplay._getScoreFromWhitePerspective(bestRawPvP0.scoreCp, bestRawPvP0.scoreMate, turnAtP0);
        bestEngineMoveDataP0_wp = {
            scoreCp: wpBestScores.cp,
            scoreMate: wpBestScores.mate,
            isMate: wpBestScores.mate !== null && wpBestScores.mate !== undefined,
            uci: bestRawPvP0.pvString ? bestRawPvP0.pvString.split(' ')[0] : null
        };
    }

    const engineArrowColor = '#FFA500'; 
    variationsP0.sort((a, b) => (a.id || Infinity) - (b.id || Infinity)); 
    variationsP0.forEach(function(pv) { 
      let scoreString = ""; 
      let currentCpForThickness_wp = null;

      const wpScores = StatusDisplay._getScoreFromWhitePerspective(pv.scoreCp, pv.scoreMate, turnAtP0);
      const displayScoreCp_wp = wpScores.cp;
      const displayScoreMate_wp = wpScores.mate;

      if (displayScoreMate_wp !== null && displayScoreMate_wp !== undefined) { 
          scoreString = "M" + displayScoreMate_wp; 
          currentCpForThickness_wp = (displayScoreMate_wp > 0) ? Infinity : -Infinity;
      } else if (displayScoreCp_wp !== null && displayScoreCp_wp !== undefined) { 
          currentCpForThickness_wp = parseFloat(displayScoreCp_wp); 
          scoreString = !isNaN(currentCpForThickness_wp) ? (currentCpForThickness_wp / 100.0).toFixed(2) : "N/A";
      } else { 
          scoreString = "N/A"; 
      }

      let pvTextDisplay = pv.move || ""; 
      if (pv.pvString) { 
        const uciMoves = pv.pvString.split(' ');
        if (uciMoves.length > 0 && uciMoves[0]) {
            let currentPvSanForTable = [];
            if(pv.move) currentPvSanForTable.push(pv.move); else if (uciMoves[0]) currentPvSanForTable.push(uciMoves[0]);
            let tempGamePv = new Chess(preMoveFenP0); 
            try {
              let firstMoveValid = tempGamePv.move(uciMoves[0], { sloppy: true });
              if(firstMoveValid && !pv.move){ currentPvSanForTable[0] = firstMoveValid.san; }
              if(firstMoveValid){ 
                  for(let k=1; k < uciMoves.length && k < 5; ++k) { 
                      if (!uciMoves[k]) break;
                      const moveDetail = tempGamePv.move(uciMoves[k], {sloppy: true});
                      if(moveDetail && moveDetail.san) currentPvSanForTable.push(moveDetail.san); else currentPvSanForTable.push(uciMoves[k]); 
                  }
              }
              pvTextDisplay = currentPvSanForTable.join(' ');
            } catch (e) { if (currentPvSanForTable.length === 0 && uciMoves[0]) pvTextDisplay = uciMoves[0]; else if (currentPvSanForTable.length > 0) pvTextDisplay = currentPvSanForTable.join(' ');}
        }
      }
      htmlTable += `<tr style="border-bottom: 1px solid #eee;"><td style="width:5%;text-align:right;padding:2px;">${pv.id||'?'}</td><td style="width:20%;text-align:center;padding:2px;"><b>${scoreString}</b></td><td style="padding:2px;">${pvTextDisplay}</td></tr>`;
      const uciMove = pv.pvString ? pv.pvString.split(' ')[0] : null;
      if (uciMove) {
          const moveCoords = StatusDisplay.parseUciMove(uciMove);
          if (moveCoords) {
              let thickness = 1.5; const maxThick = 7, minThick = 1.5, diff = 200;
              if (bestEngineMoveDataP0_wp && bestEngineMoveDataP0_wp.scoreCp !== null && currentCpForThickness_wp !== null) { 
                  let bestCpVal_wp_for_thick = bestEngineMoveDataP0_wp.isMate ? (bestEngineMoveDataP0_wp.scoreMate > 0 ? Infinity : -Infinity) : bestEngineMoveDataP0_wp.scoreCp;
                  if (pv.id === 1) thickness = maxThick;
                  else if (isFinite(bestCpVal_wp_for_thick) && isFinite(currentCpForThickness_wp)) { const loss = Math.abs(currentCpForThickness_wp - bestCpVal_wp_for_thick); thickness = minThick + (maxThick - 1 - minThick) * Math.max(0, 1 - (loss / diff)); thickness = Math.max(minThick, Math.min(thickness, maxThick -1));}
                  else if (isFinite(currentCpForThickness_wp) && !isFinite(bestCpVal_wp_for_thick)) thickness = minThick; else thickness = (maxThick-minThick)/2;
              } else if (pv.id === 1) thickness = maxThick;
              BoardAnnotations.drawArrow(controller, moveCoords.from, moveCoords.to, engineArrowColor, thickness, scoreString);
          }
      }
    });

    // Handle Player's Actual PGN Move
    if (currentPgnMoveIndex < controller.moveList.length) {
        const actualPgnMove = controller.moveList[currentPgnMoveIndex];
        let playerRowHtml = "";
        let playerArrowText = "";
        let needsSecondaryEval = true; 

        if (controller.playerMoveEvalData && 
            controller.playerMoveEvalData.pgnMove === actualPgnMove && 
            controller.playerMoveEvalData.preMoveFenP0 === preMoveFenP0 && 
            controller.playerMoveEvalData.scoreDataP1) { 
            
            const scoreDataP1_raw = controller.playerMoveEvalData.scoreDataP1;
            const turnAtP1 = (new Chess(controller.playerMoveEvalData.fenBeingEvaluatedP1)).turn();
            const wpPlayerEval = StatusDisplay._getScoreFromWhitePerspective(scoreDataP1_raw.cp, scoreDataP1_raw.mate, turnAtP1);
            
            let pgnMoveScoreCpP1_wp = wpPlayerEval.cp;
            let pgnMoveScoreMateP1_wp = wpPlayerEval.mate;

            if (pgnMoveScoreMateP1_wp !== null) { playerArrowText = "M" + pgnMoveScoreMateP1_wp; }
            else if (pgnMoveScoreCpP1_wp !== null) { playerArrowText = (pgnMoveScoreCpP1_wp / 100.0).toFixed(2); }
            else { playerArrowText = "N/A"; }

            let annotation = "";
            if (bestEngineMoveDataP0_wp && pgnMoveScoreCpP1_wp !== null) { // pgnMoveScoreCpP1_wp can be null if eval is "N/A"
                let bestCpVal_wp = bestEngineMoveDataP0_wp.isMate ? (bestEngineMoveDataP0_wp.scoreMate > 0 ? Infinity : -Infinity) : bestEngineMoveDataP0_wp.scoreCp;
                let pgnNumericForCompare = pgnMoveScoreMateP1_wp !== null ? (pgnMoveScoreMateP1_wp > 0 ? Infinity : -Infinity) : pgnMoveScoreCpP1_wp;

                const cpDiff = (bestCpVal_wp === Infinity && pgnNumericForCompare === Infinity) ? 0 :
                               (bestCpVal_wp === -Infinity && pgnNumericForCompare === -Infinity) ? 0 :
                               (isFinite(bestCpVal_wp) && isFinite(pgnNumericForCompare)) ? bestCpVal_wp - pgnNumericForCompare : 
                               (bestCpVal_wp === Infinity && isFinite(pgnNumericForCompare)) ? 500 : // Engine sees mate, player doesn't
                               (isFinite(bestCpVal_wp) && pgnNumericForCompare === Infinity) ? -500 : // Player finds mate, engine didn't
                                0; // One or both are N/A or other unhandled cases
                annotation = StatusDisplay.getAnnotationForCpLoss(Math.abs(cpDiff), bestEngineMoveDataP0_wp.scoreMate, pgnMoveScoreMateP1_wp);
            }
            playerRowHtml = StatusDisplay.formatPlayerMoveRow(actualPgnMove, playerArrowText, annotation, "");
            BoardAnnotations.drawArrow(controller, actualPgnMove.from, actualPgnMove.to, 'green', 6, `${playerArrowText} ${annotation}`.trim());
            needsSecondaryEval = false;

        } else { 
            const matchingPv = variationsP0.find(pv => pv.pvString && pv.pvString.startsWith(actualPgnMove.from + actualPgnMove.to + (actualPgnMove.promotion || '')));
            if (matchingPv) {
                const wpMatchedPv = StatusDisplay._getScoreFromWhitePerspective(matchingPv.scoreCp, matchingPv.scoreMate, turnAtP0);
                let pgnMoveScoreCp_wp = wpMatchedPv.cp; 
                let pgnMoveScoreMate_wp = wpMatchedPv.mate;

                if (pgnMoveScoreMate_wp !== null) { playerArrowText = "M" + pgnMoveScoreMate_wp; }
                else if (pgnMoveScoreCp_wp !== null) { playerArrowText = (pgnMoveScoreCp_wp / 100.0).toFixed(2); }
                else { playerArrowText = "N/A"; }
                
                let annotation = "";
                if (bestEngineMoveDataP0_wp && pgnMoveScoreCp_wp !== null) {
                     let bestCpVal_wp = bestEngineMoveDataP0_wp.isMate ? (bestEngineMoveDataP0_wp.scoreMate > 0 ? Infinity : -Infinity) : bestEngineMoveDataP0_wp.scoreCp;
                     let pgnNumericForCompare = pgnMoveScoreMate_wp !== null ? (pgnMoveScoreMate_wp > 0 ? Infinity : -Infinity) : pgnMoveScoreCp_wp;
                     const cpDiff = (bestCpVal_wp === Infinity && pgnNumericForCompare === Infinity) ? 0 :
                               (bestCpVal_wp === -Infinity && pgnNumericForCompare === -Infinity) ? 0 :
                               (isFinite(bestCpVal_wp) && isFinite(pgnNumericForCompare)) ? bestCpVal_wp - pgnNumericForCompare : 
                               (bestCpVal_wp === Infinity && isFinite(pgnNumericForCompare)) ? 500 : 
                               (isFinite(bestCpVal_wp) && pgnNumericForCompare === Infinity) ? -500 : 0;
                    annotation = StatusDisplay.getAnnotationForCpLoss(Math.abs(cpDiff), bestEngineMoveDataP0_wp.scoreMate, pgnMoveScoreMate_wp);
                }
                playerRowHtml = StatusDisplay.formatPlayerMoveRow(actualPgnMove, playerArrowText, annotation, ` (matches line ${matchingPv.id})`);
                BoardAnnotations.drawArrow(controller, actualPgnMove.from, actualPgnMove.to, 'green', 6, `${playerArrowText} ${annotation}`.trim());
                needsSecondaryEval = false;
            } else {
                playerRowHtml = StatusDisplay.formatPlayerMoveRow(actualPgnMove, "...", " (evaluating)", "");
                BoardAnnotations.drawArrow(controller, actualPgnMove.from, actualPgnMove.to, 'green', 5, "...");
            }
        }
        htmlTable += playerRowHtml;

        if (needsSecondaryEval && isFinalDisplayP0 && 
            !(controller.playerMoveEvalData && 
              controller.playerMoveEvalData.pgnMove === actualPgnMove &&
              controller.playerMoveEvalData.preMoveFenP0 === preMoveFenP0)) { 
             if (bestEngineMoveDataP0_wp) { // Pass raw UCI scores for P0's best
                 const bestRawPvP0ForEval = variationsP0.find(pv => pv.id ===1);
                 SearchManager.evaluatePlayerMoveAfterP0(controller, 
                                                         actualPgnMove, 
                                                         bestRawPvP0ForEval ? bestRawPvP0ForEval.scoreCp : null, 
                                                         bestRawPvP0ForEval ? bestRawPvP0ForEval.scoreMate : null);
             } else {
                  SearchManager.evaluatePlayerMoveAfterP0(controller, actualPgnMove, null, null);
             }
        }
    }
    
    variationsDiv.html(htmlTable + '</table>');
  },

  formatPlayerMoveRow: function(pgnMove, scoreDisplay, annotation, comment = "") {
      return `<tr style="color: green; font-weight:bold; border-top: 1px dashed #ccc; border-bottom: 1px solid #eee;">
                <td style="text-align:right;padding:2px;">Player:</td>
                <td style="text-align:center;padding:2px;"><b>${scoreDisplay}</b></td>
                <td style="padding:2px;">${pgnMove.san} ${annotation} ${comment}</td>
             </tr>`;
  },

  finalizePlayerMoveEvaluation: function(controller) {
      if (!controller.playerMoveEvalData || !controller.playerMoveEvalData.scoreDataP1) {
          if (controller.playerMoveEvalData) { 
             StatusDisplay.updatePlayerMoveRowInTable(controller, controller.playerMoveEvalData.pgnMove, "Eval Err", "?");
             controller.playerMoveEvalData = null;
          }
          return;
      }
      
      BoardAnnotations.clearArrows(controller); 
      StatusDisplay.displayAnalysisVariations(controller, controller.currentP0AnalysisVariations, true); 
  },

  updatePlayerMoveRowInTable: function(controller, pgnMove, scoreDisplay, annotation, isEvaluating = false) {
    const variationsDiv = $('#variations');
    let playerRowId = "playerMoveRow_" + pgnMove.from + pgnMove.to + (pgnMove.promotion || ""); 
    $('#' + playerRowId).remove(); 

    const comment = isEvaluating ? "(evaluating)" : "";
    const playerMoveRowHtml = `<tr id="${playerRowId}" style="color: green; font-weight:bold; border-top: 1px dashed #ccc; border-bottom: 1px solid #eee;">
                                <td style="text-align:right;padding:2px;">Player:</td>
                                <td style="text-align:center;padding:2px;"><b>${scoreDisplay}</b></td>
                                <td style="padding:2px;">${pgnMove.san} ${annotation} ${comment}</td>
                             </tr>`;
    
    const table = variationsDiv.find('table');
    if (table.length > 0) {
        table.append(playerMoveRowHtml);
    } else { 
        variationsDiv.html('<table style="width:100%; font-size: 90%; border-collapse: collapse;">' + playerMoveRowHtml + '</table>');
    }
  }
};
