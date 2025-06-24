/*
 This file will handle drawing arrows and other annotations on the board canvas.
*/

const BoardAnnotations = {
    resizeArrowCanvas: function(controller) {
        const boardElement = $('#board'); 
        const canvas = controller.arrowCanvas;
        let boardWidth = boardElement.width();
        let boardHeight = boardElement.height();

        if (boardWidth > 0 && boardHeight > 0) {
            canvas.width = boardWidth; 
            canvas.height = boardHeight;
        } else { 
            const containerElement = $('#boardContainer');
            boardWidth = containerElement.width() || 400; 
            boardHeight = containerElement.height() || 400;
            canvas.width = boardWidth; 
            canvas.height = boardHeight;
        }
    },

    clearArrows: function(controller) {
        if (controller && controller.arrowCanvasCtx && controller.arrowCanvas) {
            controller.arrowCanvasCtx.clearRect(0, 0, controller.arrowCanvas.width, controller.arrowCanvas.height);
        }
    },

    squareToPixel: function(controller, square) {
        const boardElement = $('#board');
        const boardWidth = boardElement.width();
        if (boardWidth === 0 && !controller.arrowCanvas.width) {
            return {x:0, y:0}; 
        }
        const effectiveBoardWidth = boardWidth > 0 ? boardWidth : controller.arrowCanvas.width;
        const squareSize = effectiveBoardWidth / 8; 

        const file = square.charCodeAt(0) - 'a'.charCodeAt(0); 
        const rank = 8 - parseInt(square[1]);                 
        
        let x, y;
        if (controller.currentBoardOrientation === 'white') {
            x = file * squareSize + squareSize / 2;
            y = rank * squareSize + squareSize / 2;
        } else { 
            x = (7 - file) * squareSize + squareSize / 2;
            y = (7 - rank) * squareSize + squareSize / 2;
        }
        return { x: x, y: y };
    },

    drawArrow: function(controller, fromSq, toSq, color = '#FFA500', thickness = 2, scoreText = "") { // Changed default to Orange
        if (!controller || !controller.arrowCanvasCtx || !fromSq || !toSq) return;

        const ctx = controller.arrowCanvasCtx;
        const from = BoardAnnotations.squareToPixel(controller, fromSq);
        const to = BoardAnnotations.squareToPixel(controller, toSq);

        if ((from.x === 0 && from.y === 0 && fromSq !== "a8" && fromSq !== "h1" && fromSq !=="a1" && fromSq !== "h8") || 
            (to.x === 0 && to.y === 0 && toSq !== "a8" && toSq !== "h1" && toSq !=="a1" && toSq !== "h8")) {
             // If squareToPixel returned 0,0 (e.g. canvas not sized yet), don't draw.
             return;
        }

        const headlen = Math.max(7, thickness * 2.8) * 0.8; 
        const headAngle = Math.PI / 7; 
        const angle = Math.atan2(to.y - from.y, to.x - from.x);

        const lineToX = to.x - headlen * Math.cos(angle); 
        const lineToY = to.y - headlen * Math.sin(angle);

        // Adjust start of the line so it doesn't start exactly at the center of the from-square,
        // but slightly offset towards the to-square, to avoid overlapping piece too much.
        const adjustStart = Math.min(thickness * 1.5, 8); // How much to shorten the start of the line.
        const lineFromX = from.x + adjustStart * Math.cos(angle);
        const lineFromY = from.y + adjustStart * Math.sin(angle);

        ctx.beginPath();
        ctx.moveTo(lineFromX, lineFromY);
        ctx.lineTo(lineToX, lineToY); 
        ctx.strokeStyle = color;
        ctx.lineWidth = thickness;
        ctx.stroke();

        // Draw arrowhead
        ctx.beginPath();
        ctx.moveTo(to.x, to.y); // Tip of the arrow
        ctx.lineTo(to.x - headlen * Math.cos(angle - headAngle), to.y - headlen * Math.sin(angle - headAngle));
        ctx.lineTo(to.x - headlen * Math.cos(angle + headAngle), to.y - headlen * Math.sin(angle + headAngle));
        ctx.closePath();
        ctx.fillStyle = color; // Arrowhead fill color
        ctx.fill();


        // Draw the score text
        if (scoreText) {
            let textColor = color; // Text color matches arrow color by default
            let fontWeight = 'bold'; // Always bold as requested
            let fontSize = '24px';   // Increased font size (original was 18px, 18*1.35 approx 24)
            
            // Optional: If you want text to be black for orange arrows for contrast, uncomment below:
            // if (color.toUpperCase() === '#FFA500' || color.toLowerCase() === 'orange') {
            //     textColor = 'black';
            // } else if (color.toLowerCase() === 'green') { // Example: Green arrow, black text
            //     textColor = 'black';
            // }
            
            ctx.fillStyle = textColor;
            ctx.font = `${fontWeight} ${fontSize} Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Position the text slightly off the tip of the arrow, along the arrow's angle
            const textOffsetFromTip = headlen * 0.3 + 12; // Adjust 12 for larger font
            const textX = to.x + textOffsetFromTip * Math.cos(angle);
            const textY = to.y + textOffsetFromTip * Math.sin(angle);

            // Add a small background for better readability if desired (optional)
            // const textMetrics = ctx.measureText(scoreText);
            // const textWidth = textMetrics.width;
            // const textHeight = parseInt(fontSize, 10); // Approximate height
            // ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'; // Semi-transparent white background
            // ctx.fillRect(textX - textWidth / 2 - 2, textY - textHeight / 2 - 2, textWidth + 4, textHeight + 4);
            // ctx.fillStyle = textColor; // Reset to text color for actual text

            ctx.fillText(scoreText, textX, textY);
        }
    }
};
