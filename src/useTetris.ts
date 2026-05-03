import { useState, useEffect, useCallback, useRef } from "react";
import { playSound } from "./audio";

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;

export const TETROMINOS = {
  0: { shape: [[0]], color: "bg-transparent" },
  I: { shape: [[0, "I", 0, 0], [0, "I", 0, 0], [0, "I", 0, 0], [0, "I", 0, 0]], color: "bg-cyan-400" },
  J: { shape: [[0, "J", 0], [0, "J", 0], ["J", "J", 0]], color: "bg-blue-500" },
  L: { shape: [[0, "L", 0], [0, "L", 0], [0, "L", "L"]], color: "bg-orange-500" },
  O: { shape: [["O", "O"], ["O", "O"]], color: "bg-yellow-400" },
  S: { shape: [[0, "S", "S"], ["S", "S", 0], [0, 0, 0]], color: "bg-green-500" },
  T: { shape: [[0, 0, 0], ["T", "T", "T"], [0, "T", 0]], color: "bg-purple-500" },
  Z: { shape: [["Z", "Z", 0], [0, "Z", "Z"], [0, 0, 0]], color: "bg-red-500" },
};

function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);
  useEffect(() => { savedCallback.current = callback; }, [callback]);
  useEffect(() => {
    if (delay !== null) {
      const id = setInterval(() => savedCallback.current(), delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}

export const randomTetromino = () => {
  const tetrominos = "IJLOSTZ";
  const str = tetrominos[Math.floor(Math.random() * tetrominos.length)] as keyof typeof TETROMINOS;
  return { key: str, ...TETROMINOS[str] };
};

const generateArcMatrix = (shape: any[][]) => {
  const possible = ["A", "R", "C"];
  return shape.map(row => row.map(cell => {
      if (cell === 0) return "";
      return Math.random() < 0.15 ? possible[Math.floor(Math.random() * possible.length)] : "";
  }));
};

export const createBoard = () =>
  Array.from(Array(BOARD_HEIGHT), () => Array(BOARD_WIDTH).fill([0, "clear", ""]));

export const checkCollision = (player: any, board: any, { x: moveX, y: moveY }: { x: number; y: number }) => {
  for (let y = 0; y < player.tetromino.length; y += 1) {
    for (let x = 0; x < player.tetromino[y].length; x += 1) {
      if (player.tetromino[y][x] !== 0) {
        const targetY = y + player.pos.y + moveY;
        const targetX = x + player.pos.x + moveX;

        // Ensure we are inside bounds
        if (targetY >= BOARD_HEIGHT) return true; // bottom collision
        if (targetX < 0 || targetX >= BOARD_WIDTH) return true; // left/right collision
        
        // Ensure the cell we are moving to is not already merged
        if (targetY >= 0 && board[targetY][targetX] && board[targetY][targetX][1] !== "clear") {
          return true; // overlapping with other blocks
        }
      }
    }
  }
  return false;
};

export const useTetris = (isPaused: boolean = false) => {
  const [board, setBoard] = useState(createBoard());
  const [dropTime, setDropTime] = useState<number | null>(null);
  const [gameOver, setGameOver] = useState(true);
  
  const [player, setPlayer] = useState<{
    pos: { x: number; y: number };
    tetromino: (string | number)[][];
    arcLetters: string[][];
    collided: boolean;
  }>({
    pos: { x: BOARD_WIDTH / 2 - 2, y: 0 },
    tetromino: TETROMINOS[0].shape,
    arcLetters: [[""]],
    collided: false,
  });
  
  const [score, setScore] = useState(0);
  const [rows, setRows] = useState(0);
  const [level, setLevel] = useState(1);
  const [linesClearedLocal, setLinesClearedLocal] = useState(0);
  const [tetrisEffect, setTetrisEffect] = useState<"tetris" | "mega" | null>(null);
  const [tetrisClears, setTetrisClears] = useState(0);
  const [drought, setDrought] = useState(0);

  const initialPlayer = useCallback(() => {
    const rTetro = randomTetromino();
    // I-Piece drought
    setDrought(prev => {
      // Return 0 if the piece is I, otherwise increment
      if (rTetro.key === 'I') return 0;
      // Increment only if we are called uniquely (React strict mode might run this twice, but drought issue was likely due to length check on Z)
      return prev + 1;
    });

    setPlayer({
      pos: { x: BOARD_WIDTH / 2 - 2, y: 0 },
      tetromino: rTetro.shape,
      arcLetters: generateArcMatrix(rTetro.shape),
      collided: false,
    });
  }, []);

  const updatePlayerPos = useCallback(({ x, y, collided }: { x: number; y: number; collided: boolean }) => {
    setPlayer(prev => ({
      ...prev,
      pos: { x: prev.pos.x + x, y: prev.pos.y + y },
      collided,
    }));
  }, []);

  const rotate = (matrix: any[], dir: number) => {
    const rotated = matrix.map((_, index) => matrix.map(col => col[index]));
    if (dir > 0) return rotated.map(row => row.reverse());
    return rotated.reverse();
  };

  const playerRotate = useCallback(() => {
    if (player.collided) return;
    playSound('rotate');
    const clonedPlayer = JSON.parse(JSON.stringify(player));
    clonedPlayer.tetromino = rotate(clonedPlayer.tetromino, 1);
    clonedPlayer.arcLetters = rotate(clonedPlayer.arcLetters, 1);

    const pos = clonedPlayer.pos.x;
    let offset = 1;
    while (checkCollision(clonedPlayer, board, { x: 0, y: 0 })) {
      clonedPlayer.pos.x += offset;
      offset = -(offset + (offset > 0 ? 1 : -1));
      if (offset > clonedPlayer.tetromino[0].length) {
        rotate(clonedPlayer.tetromino, -1);
        rotate(clonedPlayer.arcLetters, -1);
        clonedPlayer.pos.x = pos;
        return;
      }
    }
    setPlayer(clonedPlayer);
  }, [player, board]);

  const drop = useCallback(() => {
    if (player.collided || gameOver) return;
    if (rows > (level + 1) * 10) {
      setLevel(prev => prev + 1);
      setDropTime(1000 / (level + 1) + 200);
    }
    
    if (!checkCollision(player, board, { x: 0, y: 1 })) {
      updatePlayerPos({ x: 0, y: 1, collided: false });
    } else {
      if (player.pos.y < 1 && checkCollision(player, board, { x: 0, y: 0 })) {
        setGameOver(true);
        playSound('gameover');
        setDropTime(null);
        return; // Early return to prevent superimposing the piece and merging it
      }
      updatePlayerPos({ x: 0, y: 0, collided: true });
    }
  }, [player, board, rows, level, updatePlayerPos]);

  useInterval(() => {
    drop();
  }, isPaused ? null : dropTime);

  const dropPlayer = useCallback(() => {
    if (player.collided) return;
    if (!checkCollision(player, board, { x: 0, y: 1 })) {
      updatePlayerPos({ x: 0, y: 1, collided: false });
    }
  }, [player, board, updatePlayerPos]);

  const hardDrop = useCallback(() => {
    if (player.collided) return;
    playSound('drop');
    let yOffset = 1;
    while (!checkCollision(player, board, { x: 0, y: yOffset })) {
      yOffset += 1;
    }
    updatePlayerPos({ x: 0, y: yOffset - 1, collided: true });
  }, [player, board, updatePlayerPos]);

  const movePlayer = useCallback((dir: number) => {
    if (player.collided) return;
    playSound('move');
    if (!checkCollision(player, board, { x: dir, y: 0 })) {
      updatePlayerPos({ x: dir, y: 0, collided: false });
    }
  }, [player, board, updatePlayerPos]);

  const startGame = useCallback(() => {
    setBoard(createBoard());
    setDropTime(1000);
    initialPlayer();
    setGameOver(false);
    setScore(0);
    setRows(0);
    setLevel(1);
    setLinesClearedLocal(0);
    setTetrisEffect(null);
    setTetrisClears(0);
    setDrought(0);
  }, [initialPlayer]);

  useEffect(() => {
    if (!player) return;

    let linesClearedThisTick = 0;
    let arcBonus = 0;

    setBoard(prevBoard => {
      let newBoard = prevBoard.map((row: any) =>
        row.map((cell: any) => (cell[1] === "clear" ? [0, "clear", ""] : cell))
      );

      player.tetromino.forEach((row: any, y: number) => {
        row.forEach((value: any, x: number) => {
          if (value !== 0) {
            const bY = y + player.pos.y;
            const bX = x + player.pos.x;
            if (newBoard[bY] && newBoard[bY][bX] !== undefined) {
                if (newBoard[bY][bX][1] !== "merged" || player.collided) {
                   newBoard[bY][bX] = [value, `${player.collided ? "merged" : "clear"}`, player.arcLetters[y][x]];
                }
            }
          }
        });
      });

      if (player.collided) {
        let sweptCount = 0;
        let points = 0;
        newBoard = newBoard.reduce((ack: any[], row: any[]) => {
          if (row.findIndex((cell: any) => cell[0] === 0) === -1) {
            sweptCount += 1;
            const letters = row.map((cell: any) => cell[2] || " ").join("");
            if (letters.replace(/\s+/g,"").includes("ARC")) {
               points += 1000;
            }
            ack.unshift(new Array(BOARD_WIDTH).fill([0, "clear", ""]));
            return ack;
          }
          ack.push(row);
          return ack;
        }, []);
        linesClearedThisTick = sweptCount;
        arcBonus = points;

        setTimeout(() => {
          if (player.pos.y >= 0) { 
             initialPlayer();
          }
          
          if (sweptCount > 0) {
            setLinesClearedLocal(prev => prev + sweptCount);
            setRows(prev => prev + sweptCount);
            
            let linePoints = 0;
            switch(sweptCount) {
                case 1: linePoints = 100 * level; break;
                case 2: linePoints = 300 * level; break;
                case 3: linePoints = 500 * level; break;
                case 4: 
                    linePoints = 1200 * level; // Tetris!
                    setTetrisClears(prev => prev + 1);
                    break;
                default:
                    linePoints = 1200 * level;
                    setTetrisClears(prev => prev + 1);
                    break;
            }
            
            if (points > 0) {
                // ARC bonus!
                points += 5000;
                setTetrisEffect("mega");
                setTimeout(() => setTetrisEffect(null), 800);
                playSound('arc');
            } else if (sweptCount >= 4) {
                // Regular Tetris
                setTetrisEffect("tetris");
                setTimeout(() => setTetrisEffect(null), 800);
                playSound('tetris');
            } else {
                playSound('clear');
            }
            
            setScore(prev => prev + linePoints + points);
          }
        }, 0);
      }

      return newBoard;
    });

  }, [player, initialPlayer, level]);

  // keydown events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Always prevent default for arrows and space to stop page scrolling if game is active
      if (!gameOver && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
         e.preventDefault();
      }
      
      if (gameOver || player.collided || isPaused) return;

      if (e.keyCode === 37) movePlayer(-1);
      else if (e.keyCode === 39) movePlayer(1);
      else if (e.keyCode === 40) dropPlayer();
      else if (e.keyCode === 38) playerRotate();
      else if (e.keyCode === 32) { e.preventDefault(); hardDrop(); } // Space
      else if (e.keyCode === 84) {
         // T key pressed - Test Tetris! Swap to I-piece
         setPlayer(prev => ({
             ...prev,
             tetromino: TETROMINOS['I'].shape,
             arcLetters: TETROMINOS['I'].shape.map(row => row.map(() => ""))
         }));
      }
      else if (e.keyCode === 85) {
          // U key pressed - Fill board for MEGA ARC TETRIS!
          setBoard(prev => {
              const newBoard = createBoard();
              for (let y = BOARD_HEIGHT - 4; y < BOARD_HEIGHT; y++) {
                 for (let x = 0; x < BOARD_WIDTH; x++) {
                    if (x !== 4) newBoard[y][x] = ["L", "merged", ""];
                 }
              }
              // Place ARC letters
              newBoard[BOARD_HEIGHT - 1][0] = ["J", "merged", "A"];
              newBoard[BOARD_HEIGHT - 1][1] = ["J", "merged", "R"];
              newBoard[BOARD_HEIGHT - 1][2] = ["J", "merged", "C"];
              return newBoard;
          });
          // Also swap to I-piece automatically
          setPlayer(prev => ({
             ...prev,
             pos: { x: 3, y: 0 },
             tetromino: TETROMINOS['I'].shape,
             arcLetters: TETROMINOS['I'].shape.map(row => row.map(() => ""))
          }));
      }
    };

    document.addEventListener("keydown", handleKeyDown, { passive: false });
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [gameOver, movePlayer, dropPlayer, playerRotate, hardDrop, isPaused, player.collided]);

  const tetrisRate = linesClearedLocal > 0 ? ((tetrisClears * 4) / linesClearedLocal) * 100 : 0;

  return { board, startGame, gameOver, score, linesClearedLocal, level, tetrisEffect, movePlayer, dropPlayer, playerRotate, hardDrop, tetrisRate, drought };
};
