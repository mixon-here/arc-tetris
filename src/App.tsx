import { useState, useEffect, useRef } from "react";
import { useTetris, TETROMINOS } from "./useTetris";
import { Wallet, Trophy, Play, Coins, AlertTriangle, ExternalLink, BookOpen, X, Volume2, VolumeX } from "lucide-react";
import { ethers, BrowserProvider } from "ethers";
import { toggleMute, playSound } from "./audio";
import { submitFirestoreScore, getLeaderboardScores } from './firebase';

import { createWeb3Modal, defaultConfig, useWeb3Modal, useWeb3ModalProvider, useWeb3ModalAccount, useDisconnect } from '@web3modal/ethers/react';

// Web3Modal setup
const projectId = '4c89cbdd955017a8e7184a58f61427a0';

const arcTestnet = {
  chainId: 5042002, // 0x4CEF52
  name: 'Arc',
  currency: 'USDC',
  explorerUrl: 'https://testnet.arcscan.app/',
  rpcUrl: 'https://rpc.testnet.arc.network'
};

const metadata = {
  name: 'Arc Tetris',
  description: 'Arc Tetris Web3 Game',
  url: 'https://aren.com',
  icons: ['https://avatars.githubusercontent.com/u/37784886']
};

const ethersConfig = defaultConfig({
  metadata,
  defaultChainId: 5042002,
  rpcUrl: 'https://rpc.testnet.arc.network'
});

createWeb3Modal({
  ethersConfig,
  chains: [arcTestnet],
  projectId,
  enableAnalytics: true,
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': '#22c55e', // text-green-500
  }
});

const TEST_USDC_ADDRESS = import.meta.env.VITE_TEST_USDC_ADDRESS || "0x0000000000000000000000000000000000000000";
const TREASURY_ADDRESS = import.meta.env.VITE_TREASURY_ADDRESS || "0x0000000000000000000000000000000000000000";

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)"
];

const Modal = ({ isOpen, onClose, title, children }: any) => {
  if (!isOpen) return null;
  return (
    <div 
      className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 cursor-pointer"
      onMouseDown={onClose}
    >
      <div 
        className="bg-neutral-900 border-4 border-green-600 max-w-lg w-full p-4 sm:p-6 shadow-[0_0_50px_rgba(0,255,0,0.3)] relative max-h-[95vh] flex flex-col cursor-auto"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-1 right-1 sm:top-2 sm:right-2 text-green-500 hover:text-white font-bold p-3">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-lg sm:text-xl text-green-400 mb-4 sm:mb-6 pr-8 drop-shadow-[0_0_5px_rgba(0,255,0,0.8)] flex-shrink-0 uppercase">{title}</h2>
        <div className="overflow-y-auto pr-1 sm:pr-2 custom-scrollbar flex flex-col gap-3 sm:gap-4 text-xs sm:text-sm text-neutral-300">
          {children}
        </div>
      </div>
    </div>
  );
};

export const generateNFT_SVG = (score: number, lines: number, level: number, tetrises: number, tetrisRate: number, drought: number) => {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" style="background:#0a0a0a; font-family:monospace;">
  <rect width="100%" height="100%" fill="#0a0a0a" />
  <rect x="2" y="2" width="396" height="396" fill="none" stroke="#16a34a" stroke-width="4" />
  
  <text x="200" y="50" fill="#4ade80" font-size="32" font-weight="bold" text-anchor="middle">Arc Tetris</text>
  <text x="200" y="80" fill="#facc15" font-size="16" letter-spacing="2" text-anchor="middle">ACHIEVEMENT UNLOCKED</text>
  
  <rect x="20" y="110" width="360" height="230" fill="#1e3a8a" fill-opacity="0.2" stroke="#1e3a8a" stroke-width="2" />
  
  <text x="40" y="145" fill="#ffffff" font-size="20">SCORE:</text>
  <text x="360" y="145" fill="#93c5fd" font-size="20" text-anchor="end">${score}</text>
  
  <text x="40" y="180" fill="#ffffff" font-size="20">LINES:</text>
  <text x="360" y="180" fill="#93c5fd" font-size="20" text-anchor="end">${lines}</text>
  
  <text x="40" y="215" fill="#ffffff" font-size="20">LEVEL:</text>
  <text x="360" y="215" fill="#93c5fd" font-size="20" text-anchor="end">${level}</text>
  
  <text x="40" y="250" fill="#ffffff" font-size="20">TETRISES:</text>
  <text x="360" y="250" fill="#93c5fd" font-size="20" text-anchor="end">${tetrises}</text>
  
  <text x="40" y="285" fill="#ffffff" font-size="20">TETRIS RATE:</text>
  <text x="360" y="285" fill="#93c5fd" font-size="20" text-anchor="end">${Number(tetrisRate).toFixed(1)}%</text>
  
  <text x="40" y="320" fill="#ffffff" font-size="20">DROUGHT:</text>
  <text x="360" y="320" fill="#93c5fd" font-size="20" text-anchor="end">${drought}</text>
  
  <text x="200" y="380" fill="#6b7280" font-size="14" text-anchor="middle">Minted on Arc Testnet</text>
</svg>`;
};

const generateMetadataURI = (score: number, lines: number, level: number, tetrises: number, tetrisRate: number, drought: number) => {
  const svg = generateNFT_SVG(score, lines, level, tetrises, tetrisRate, drought);
  
  const svgBase64 = window.btoa(unescape(encodeURIComponent(svg)));
  const json = JSON.stringify({
    name: "Arc Tetris Achievement",
    description: "Exclusive gameplay achievement from Arc Tetris on Testnet.",
    image: `data:image/svg+xml;base64,${svgBase64}`,
    attributes: [
      { trait_type: "Score", value: score },
      { trait_type: "Lines", value: lines },
      { trait_type: "Level", value: level },
      { trait_type: "Tetrises", value: tetrises },
      { trait_type: "Tetris Rate", value: tetrisRate },
      { trait_type: "Drought", value: drought },
    ]
  });
  return `data:application/json;base64,${window.btoa(unescape(encodeURIComponent(json)))}`;
};

export default function App() {
  const [isMinting, setIsMinting] = useState(false);
  const [isManuallyPaused, setIsManuallyPaused] = useState(false);
  const [mintStatus, setMintStatus] = useState("MINT NFT");
  const [mintTxHash, setMintTxHash] = useState<string | null>(null);

  const { board, startGame, gameOver, score, linesClearedLocal, level, tetrisEffect, movePlayer, dropPlayer, playerRotate, hardDrop, tetrisRate, drought, nextPiece, tetrisClears } = useTetris(isMinting || isManuallyPaused);

  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [networkName, setNetworkName] = useState<string>("Unknown");
  const [balance, setBalance] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  const [txCount, setTxCount] = useState<number | null>(null);

  const connectWallet = async () => {
    if ((window as any).ethereum) {
      try {
        let browserProvider = new ethers.BrowserProvider((window as any).ethereum);
        await browserProvider.send("eth_requestAccounts", []);
        
        let network = await browserProvider.getNetwork();
        if (network.chainId !== 5042002n) {
          try {
            await (window as any).ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: '0x4CEF52' }], // 5042002
            });
          } catch (switchError: any) {
            if (switchError.code === 4902 || (switchError.message && switchError.message.includes("Unrecognized chain ID"))) {
              await (window as any).ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: '0x4CEF52',
                  chainName: 'Arc testnet',
                  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
                  rpcUrls: ['https://rpc.testnet.arc.network', 'https://rpc.drpc.testnet.arc.network'],
                  blockExplorerUrls: ['https://testnet.arcscan.app/']
                }],
              });
            } else {
              throw switchError;
            }
          }
          // Recreate provider after network switch
          browserProvider = new ethers.BrowserProvider((window as any).ethereum);
        }

        const signer = await browserProvider.getSigner();
        const address = await signer.getAddress();
        setWalletAddress(address);
        setProvider(browserProvider);
        setNetworkName("Arc testnet");
        await fetchBalance(browserProvider, address);
      } catch (err) {
        console.error("Wallet connection failed", err);
        alert("Wallet connection or network switch failed.");
      }
    } else {
      alert("Web3 wallet not detected. If you are on mobile, please open this site directly inside the built-in browser of your MetaMask, OKX, or other Web3 wallet app.");
    }
  };

  const disconnectWallet = () => {
    setWalletAddress(null);
    setProvider(null);
    setBalance(null);
    setTxCount(null);
  };


  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showAboutArc, setShowAboutArc] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showToasty, setShowToasty] = useState<"tetris" | "mega" | null>(null);

  // Easter egg
  useEffect(() => {
    if (tetrisEffect) {
       setShowToasty(tetrisEffect);
       if (!isMuted) {
          try {
             const audio = new Audio("/Toasty.mp3");
             audio.volume = 0.6;
             // If mega, play some super loud arcade sound maybe? 
             // Let's just use the MK toasty as they asked. But maybe play arc sound too.
             audio.play().catch(e => console.error("Audio play error", e));
          } catch(e) {}
       }
       setTimeout(() => setShowToasty(null), 2500);
    }
  }, [tetrisEffect]);

  const handleToggleMute = () => {
    setIsMuted(toggleMute());
  };

  const linesClearedRef = useRef(0);
  const [syncedLines, setSyncedLines] = useState(0);

  useEffect(() => {
    if (linesClearedLocal > syncedLines) {
      linesClearedRef.current += (linesClearedLocal - syncedLines);
      setSyncedLines(linesClearedLocal);
    }
  }, [linesClearedLocal, syncedLines]);

  const fetchBalance = async (prov: BrowserProvider, address: string) => {
    try {
      if (TEST_USDC_ADDRESS && TEST_USDC_ADDRESS !== "0x0000000000000000000000000000000000000000") {
          const usdcContract = new ethers.Contract(TEST_USDC_ADDRESS, ERC20_ABI, prov);
          const bal = await usdcContract.balanceOf(address);
          setBalance(Number(ethers.formatUnits(bal, 6)).toFixed(2) + " USDC");
      } else {
          const balanceWei = await prov.getBalance(address);
          setBalance(Number(ethers.formatEther(balanceWei)).toFixed(4) + " USDC");
      }
      try {
         const count = await prov.getTransactionCount(address);
         setTxCount(count);
      } catch (e) {
         console.error(e);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const data = await getLeaderboardScores();
      setLeaderboard(data);
    } catch(err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  useEffect(() => {
    // Submit on Game Over if lines > 0
    if (gameOver && linesClearedLocal > 0 && walletAddress && !isSubmitting) {
      submitScoreTx();
    }
  }, [gameOver, walletAddress]);

  const submitScoreTx = async () => {
    if (!provider || isSubmitting || !walletAddress) return;
    setIsSubmitting(true);
    setTxError(null);
    try {
      const signer = await provider.getSigner();

      const perLineFee = 0.0001; 
      const totalFee = (linesClearedLocal * perLineFee).toFixed(4);

      const dataPayload = ethers.hexlify(ethers.toUtf8Bytes(`ARC_TETRIS_SCORE:${score}:LINES:${linesClearedLocal}`));

      if (TEST_USDC_ADDRESS && TEST_USDC_ADDRESS !== "0x0000000000000000000000000000000000000000") {
          const usdcContract = new ethers.Contract(TEST_USDC_ADDRESS, ERC20_ABI, signer);
          const amount = ethers.parseUnits(totalFee, 6);
          const tx = await usdcContract.transfer(TREASURY_ADDRESS, amount);
          setTxHash(tx.hash);
          await tx.wait();
      } else {
          // Native token transaction
          const tx = await signer.sendTransaction({
             to: TREASURY_ADDRESS && TREASURY_ADDRESS !== "0x0000000000000000000000000000000000000000" ? TREASURY_ADDRESS : walletAddress,
             value: ethers.parseEther(totalFee),
             data: dataPayload
          });
          setTxHash(tx.hash);
          await tx.wait();
      }

      await submitFirestoreScore(walletAddress, score, linesClearedLocal);
      fetchLeaderboard();
      if (provider && walletAddress) {
          fetchBalance(provider, walletAddress);
      }
      setSyncedLines(0);
      linesClearedRef.current = 0;

    } catch (err: any) {
      console.error("Transaction failed", err);
      if (err?.code === 4001 || err?.info?.error?.code === 4001) {
        setTxError("Transaction was rejected. Score was not saved.");
      } else if (err?.message?.includes("insufficient funds") || err?.info?.error?.message?.includes("insufficient funds")) {
        setTxError(`Insufficient funds for gas. You need USDC on Arc testnet.`);
      } else {
        setTxError("Transaction failed. Please check your balance and network.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-green-500 font-retro flex flex-col items-center justify-center relative overflow-hidden">
      {/* Visual CRT effects */}
      <div className="absolute inset-0 crt-overlay" />
      <div className="absolute inset-0 bg-green-900/10 pointer-events-none" />

      {/* Background glowing grid */}
      <div 
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
           backgroundImage: 'linear-gradient(#0f380f 1px, transparent 1px), linear-gradient(90deg, #0f380f 1px, transparent 1px)',
           backgroundSize: '40px 40px'
        }}
      />

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-[1400px] mx-auto flex flex-col md:flex-row gap-6 p-4 items-start justify-center">

        {/* Info Column */}
        <div className="w-full md:w-72 flex flex-col gap-6 flex-shrink-0">
          
          <div className="bg-neutral-900 border-4 border-green-700 p-6 rounded-md shadow-[0_0_20px_rgba(0,255,0,0.2)]">
            <div className="flex items-center justify-between mb-6">
               <h1 className="text-3xl text-green-400 drop-shadow-[0_0_5px_rgba(0,255,0,0.8)] leading-snug">Arc<br/>Tetris</h1>
               <button onClick={handleToggleMute} className="text-green-500 hover:text-green-300 bg-green-900/30 p-2 rounded-md">
                 {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
               </button>
            </div>
            
            {!walletAddress ? (
              <button
                onClick={connectWallet}
                className="w-full flex items-center justify-center gap-2 bg-green-800 hover:bg-green-700 text-white px-4 py-4 border-2 border-green-500 hover:border-green-300 transition-all text-sm"
              >
                <Wallet className="w-5 h-5" />
                CONNECT WALLET
              </button>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="p-3 border-2 border-green-800 flex flex-col gap-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-green-700">WALLET:</span>
                    <button 
                      onClick={() => disconnectWallet()} 
                      className="text-[10px] text-red-500 hover:text-red-400 font-bold"
                    >
                      DISCONNECT
                    </button>
                  </div>
                  <span className="font-mono text-xs text-green-400">{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
                </div>
                {balance && (
                  <div className="text-[11px] text-green-500 flex justify-between bg-neutral-950/50 p-2 border border-green-900">
                    <span className="text-green-700">BALANCE:</span>
                    <span>{balance}</span>
                  </div>
                )}
                {txCount !== null && (
                  <div className="text-[11px] text-green-500 flex justify-between bg-neutral-950/50 p-2 border border-green-900 mt-1">
                    <span className="text-green-700">TX COUNT:</span>
                    <span>{txCount}</span>
                  </div>
                )}
                <div className="text-[10px] text-green-600 text-right mt-1 font-bold">NET: Arc testnet</div>
              </div>
            )}
          </div>

          <div className="bg-neutral-900 border-4 border-green-700 p-6 shadow-[0_0_20px_rgba(0,255,0,0.2)] hidden md:flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm text-green-500 flex items-center gap-2">
                <Trophy className="w-4 h-4" /> LEADERBOARD
              </h2>
            </div>
            <div className="flex flex-col gap-3 text-xs text-green-400">
              {leaderboard.length === 0 ? (
                <div className="text-green-800 italic text-center py-4">... NO SCORES ...</div>
              ) : (
                leaderboard.slice(0, 5).map((entry, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-green-900/50 pb-2">
                    <span className="flex-1 font-mono truncate mr-2">
                      <span className="text-green-700 mr-2">{(i+1).toString().padStart(2, '0')}</span>
                      {entry.walletAddress.substring(0, 6)}...{entry.walletAddress.substring(38)}
                    </span>
                    <span className="text-yellow-500 font-bold">{entry.score} pts</span>
                  </div>
                ))
              )}
            </div>
            {leaderboard.length > 5 && (
               <button onClick={() => setShowLeaderboard(true)} className="w-full mt-4 text-[10px] text-green-400 bg-green-900/20 border border-green-800 p-2 hover:bg-green-800/40 hover:text-green-300 transition-colors uppercase tracking-widest">
                 VIEW ALL SCORES
               </button>
            )}
          </div>

        </div>

        {/* Center Canvas */}
        <div className="flex-shrink-0 relative">
            <div className={`bg-neutral-950 p-2 sm:p-3 border-4 border-green-600 shadow-[0_0_40px_rgba(0,255,0,0.3)] transition-all relative ${tetrisEffect ? 'tetris-flash' : ''}`}>
              <div 
                className="grid bg-[#070707] border border-neutral-900 w-[260px] h-[520px] sm:w-[320px] sm:h-[640px] md:w-[360px] md:h-[720px] mx-auto relative"
                style={{
                  gridTemplateRows: `repeat(${board.length}, minmax(0, 1fr))`,
                  gridTemplateColumns: `repeat(${board[0].length}, minmax(0, 1fr))`,
                }}
              >
                {board.map((row: any, y: number) =>
                  row.map((cell: any, x: number) => {
                    const blockType = cell[0];
                    const letter = cell[2];
                    const colorClass = blockType !== 0 ? TETROMINOS[blockType as keyof typeof TETROMINOS]?.color : 'bg-[#0f0f0f] border-neutral-900/50 block opacity-80';
                    return (
                      <div
                        key={`${y}-${x}`}
                        className={`border-t-[3px] border-l-[3px] border-b-[3px] border-r-[3px] border-t-white/30 border-l-white/30 border-b-black/40 border-r-black/40 ${colorClass} flex items-center justify-center`}
                      >
                         {letter && <span className="text-white text-shadow-sm font-sans drop-shadow-md text-xs sm:text-base md:text-xl font-black">{letter}</span>}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Toasty Easter Egg inside the game board */}
              {showToasty && (
                <>
                  {/* Bottom Right Tims */}
                  <div className={`absolute bottom-[0px] right-[0px] z-[60] text-center drop-shadow-2xl ${showToasty === 'mega' ? 'animate-toasty' : 'animate-toasty'}`}>
                    <img src="/Tim-Arc1.png" alt="Tim Toasty" className="w-24 h-24 sm:w-32 sm:h-32 object-contain" />
                  </div>

                  {showToasty === 'mega' && (
                      <>
                      <div className={`absolute bottom-[0px] left-[0px] z-[60] drop-shadow-2xl animate-toasty-bl`}>
                         <img src="/Tim-Arc1.png" alt="Tim Toasty" className="w-24 h-24 sm:w-32 sm:h-32 object-contain" style={{transform: "scaleX(-1)"}} />
                      </div>
                      
                      <div className={`absolute top-[0px] right-[0px] z-[60] drop-shadow-2xl animate-toasty-tr`}>
                         <img src="/Tim-Arc1.png" alt="Tim Toasty" className="w-24 h-24 sm:w-32 sm:h-32 object-contain" style={{transform: "scaleY(-1)"}} />
                      </div>
                      
                      <div className={`absolute top-[0px] left-[0px] z-[60] drop-shadow-2xl animate-toasty-tl`}>
                         <img src="/Tim-Arc1.png" alt="Tim Toasty" className="w-24 h-24 sm:w-32 sm:h-32 object-contain" style={{transform: "scale(-1, -1)"}} />
                      </div>
                      </>
                  )}
                </>
              )}
            </div>

            {/* Mobile Controls */}
            {!gameOver && (
              <div className="grid grid-cols-3 gap-2 mt-4 lg:hidden px-4">
                 <button onClick={() => movePlayer(-1)} className="bg-neutral-800 active:bg-neutral-700 text-green-500 border border-green-800 p-4 rounded-xl font-sans font-bold text-xs">LEFT</button>
                 <button onClick={playerRotate} className="bg-neutral-800 active:bg-neutral-700 text-green-500 border border-green-800 p-4 rounded-xl font-sans font-bold text-xs">ROTATE</button>
                 <button onClick={() => movePlayer(1)} className="bg-neutral-800 active:bg-neutral-700 text-green-500 border border-green-800 p-4 rounded-xl font-sans font-bold text-xs">RIGHT</button>
                 <button onClick={hardDrop} className="col-span-3 bg-green-900 active:bg-green-800 text-green-300 border border-green-500 p-4 rounded-xl font-sans font-bold text-xs">HARD DROP</button>
              </div>
            )}

            {/* Game Over Overlay */}
            {gameOver && (
              <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-6 border-4 border-red-500 shadow-[0_0_50px_rgba(255,0,0,0.4)] text-center scale-[1.01] z-20">
                <h2 className="text-4xl text-red-500 mb-8 animate-pulse italic">GAME OVER</h2>
                
                {walletAddress ? (
                  isSubmitting ? (
                    <div className="flex flex-col items-center text-blue-400 gap-4">
                      <Coins className="w-12 h-12 animate-spin" />
                      <p className="text-xs max-w-[240px] leading-relaxed">
                         PAYING FEES ONCHAIN FOR {linesClearedLocal} CLEARED LINES ({(linesClearedLocal*0.0001).toFixed(4)} USDC). SIGN IN WALLET.
                      </p>
                    </div>
                  ) : (
                      txHash ? (
                        <div className="flex flex-col items-center gap-6">
                            <div className="text-green-400 text-xs text-center border-2 border-green-800 p-6 bg-green-900/20 max-w-[280px]">
                              TRANSACTION SUCCESSFUL!<br/><br/>
                              <a href={`https://testnet.arcscan.app/tx/${txHash}`} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">VIEW IN EXPLORER</a>
                            </div>
                            <button
                              onClick={() => { setTxHash(null); startGame(); }}
                              className="bg-red-700 hover:bg-red-600 border-2 border-red-400 px-8 py-5 text-white text-sm font-bold tracking-wider"
                            >
                              START OVER
                            </button>
                        </div>
                      ) : (
                        txError ? (
                          <div className="flex flex-col items-center gap-6">
                              <div className="text-red-400 text-xs text-center border-2 border-red-800 p-6 bg-red-900/20 max-w-[280px]">
                                TRANSACTION FAILED!<br/><br/>
                                <span className="text-gray-300">{txError}</span>
                              </div>
                              <button
                                onClick={() => { setTxError(null); startGame(); }}
                                className="bg-red-700 hover:bg-red-600 border-2 border-red-400 px-8 py-4 text-white text-sm font-bold tracking-wider"
                              >
                                START OVER W/O SAVING
                              </button>
                              <button
                                onClick={() => submitScoreTx()}
                                className="bg-neutral-800 hover:bg-neutral-700 border-2 border-neutral-500 px-8 py-3 text-white text-sm font-bold mt-2"
                              >
                                TRY AGAIN
                              </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setIsManuallyPaused(false); startGame(); document.body.focus(); }}
                            className="bg-green-700 hover:bg-green-600 border-2 border-green-400 px-8 py-5 text-white text-sm tracking-widest font-bold"
                          >
                            INSERT COIN (PLAY)
                          </button>
                        )
                      )
                  )
                ) : (
                  <div className="flex flex-col items-center gap-6">
                    <p className="text-xs text-yellow-500 max-w-[280px] leading-relaxed">
                      Welcome! This is a test Tetris game for testing Arc testnet. Join in and be one of the pioneers!
                    </p>
                    <p className="text-xs text-purple-400 max-w-[280px] leading-relaxed">
                      Collect a "Tetris" (4 lines) to get an easter egg from Tim, the Arc architect!
                    </p>
                    <button
                      onClick={() => { setIsManuallyPaused(false); startGame(); document.body.focus(); }}
                      className="bg-neutral-800 hover:bg-neutral-700 border-2 border-neutral-600 px-8 py-4 text-white text-sm uppercase tracking-widest"
                    >
                      PLAY OFFLINE
                    </button>
                  </div>
                )}
              </div>
            )}
            
            <div className="mt-4 flex justify-center">
               <a 
                 href="https://x.com/mixon_here" 
                 target="_blank" 
                 rel="noopener noreferrer"
                 className="flex items-center gap-2 opacity-50 hover:opacity-100 transition-opacity px-2 py-1"
               >
                 <span className="text-[10px] font-sans text-neutral-500 tracking-widest text-center leading-tight">developed by</span>
                 <img src="https://unavatar.io/x/mixon_here?fallback=https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png" alt="mixon_here avatar" className="w-5 h-5 rounded-full border border-neutral-600 grayscale hover:grayscale-0 transition-all" />
               </a>
            </div>
        </div>

        {/* Stats Column */}
        <div className="w-full md:w-72 flex flex-col gap-6 flex-shrink-0">

           <div className="bg-neutral-900 border-4 border-blue-700 p-6 flex flex-col gap-6 shadow-[0_0_20px_rgba(0,0,255,0.2)]">
              <div className="flex gap-4">
                  <div className="flex-1">
                     <div className="text-[10px] text-blue-500 border-b border-blue-900 mb-2 pb-1">SCORE</div>
                     <div className="text-3xl text-blue-300">{score.toString().padStart(6, '0')}</div>
                  </div>
                  <div>
                     <div className="text-[10px] text-blue-500 border-b border-blue-900 mb-2 pb-1">NEXT</div>
                     <div className="flex justify-center items-center h-[50px] w-[50px] bg-black/40 border border-blue-900/50">
                        {nextPiece && (
                             <div className="grid gap-[1px]" style={{
                                  gridTemplateRows: `repeat(${nextPiece.shape.length}, minmax(0, 1fr))`,
                                  gridTemplateColumns: `repeat(${nextPiece.shape[0].length}, minmax(0, 1fr))`,
                             }}>
                                 {nextPiece.shape.map((r: any, y: number) => r.map((cell: any, x: number) => (
                                     <div key={`${x}-${y}`} className={`w-3 h-3 ${cell !== 0 ? nextPiece.color : 'bg-transparent'}`} />
                                 )))}
                             </div>
                        )}
                     </div>
                  </div>
              </div>
              <div className="flex justify-between gap-4">
                  <div className="flex-1">
                     <div className="text-[10px] text-blue-500 border-b border-blue-900 mb-2 pb-1">LINES</div>
                     <div className="text-xl text-blue-300">{linesClearedLocal.toString().padStart(4, '0')}</div>
                  </div>
                  <div className="flex-1">
                     <div className="text-[10px] text-blue-500 border-b border-blue-900 mb-2 pb-1">LEVEL</div>
                     <div className="text-xl text-blue-300">{level.toString().padStart(2, '0')}</div>
                  </div>
              </div>

              {/* Controls */}
              {!gameOver && (
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                       setIsManuallyPaused(false);
                       startGame();
                       document.body.focus();
                    }} 
                    className="flex-1 flex items-center justify-center gap-1 bg-red-950 hover:bg-red-900 text-red-200 border-2 border-red-800 transition-all font-bold tracking-widest text-[10px] py-2"
                  >
                    RESTART
                  </button>
                  <button
                    onClick={() => {
                        setIsManuallyPaused(p => !p);
                        // give focus to document body so playing works smoothly
                        document.body.focus();
                    }}
                    className={`flex-1 flex items-center justify-center gap-1 transition-all font-bold tracking-widest text-[10px] py-2 border-2 ${isManuallyPaused ? 'bg-yellow-900 hover:bg-yellow-800 text-yellow-200 border-yellow-700' : 'bg-blue-950 hover:bg-blue-900 text-blue-200 border-blue-800'}`}
                  >
                    {isManuallyPaused ? 'RESUME' : 'PAUSE'}
                  </button>
                </div>
              )}
              
               <div className="flex justify-between gap-4">
                   <div className="flex-1">
                      <div className="text-[10px] text-blue-500 border-b border-blue-900 mb-2 pb-1 text-nowrap">TETRIS RATE</div>
                      <div className="text-xl text-blue-300">{tetrisRate.toFixed(1)}%</div>
                   </div>
                   <div className="flex-1">
                      <div className="text-[10px] text-blue-500 border-b border-blue-900 mb-2 pb-1">DROUGHT</div>
                      <div className="text-xl text-blue-300">{drought.toString().padStart(2, '0')}</div>
                   </div>
               </div>
            </div>

            <div className="flex flex-col gap-4">
               <button 
                 onClick={() => setShowLeaderboard(true)} 
                 className="md:hidden bg-green-900/30 hover:bg-green-900/60 border-2 border-green-700 p-5 text-green-500 font-bold tracking-widest text-sm flex items-center justify-between transition-colors shadow-[0_0_15px_rgba(0,255,0,0.1)]"
               >
                 <div>LEADERBOARD</div>
                 <Trophy className="w-5 h-5"/>
               </button>

               <button 
                 onClick={() => setShowHowToPlay(true)} 
                 className="bg-purple-900/30 hover:bg-purple-900/60 border-2 border-purple-700 p-5 text-purple-400 font-bold uppercase tracking-widest text-sm flex items-center justify-between transition-colors shadow-[0_0_15px_rgba(128,0,128,0.1)]"
               >
                 <div>HOW TO PLAY</div> 
                 <BookOpen className="w-5 h-5"/>
               </button>

               <button 
                 onClick={() => setShowAboutArc(true)} 
                 className="bg-yellow-900/30 hover:bg-yellow-900/60 border-2 border-yellow-700 p-5 text-yellow-500 font-bold tracking-widest text-sm flex items-center justify-between transition-colors shadow-[0_0_15px_rgba(255,255,0,0.1)]"
               >
                 <div>Arc Faucet</div>
                 <AlertTriangle className="w-5 h-5"/>
               </button>
            </div>

            {/* NFT Preview Block */}
            {score >= 5000 && (
               <div className="border-4 border-yellow-500 bg-black text-center animate-pulse relative overflow-hidden shadow-[0_0_20px_rgba(255,255,0,0.2)]">
                  <div className="bg-yellow-600 px-2 py-1 text-[10px] text-black font-bold tracking-widest border-b border-yellow-500 flex justify-between items-center">
                     <span>Arc Tetris EXCLUSIVE</span>
                     <span>NFT PREVIEW</span>
                  </div>
                  <div className="p-4 relative flex flex-col items-center">
                     <div className="w-[180px] h-[180px] shadow-[0_0_15px_rgba(34,197,94,0.3)] bg-black mb-3 border border-green-800" dangerouslySetInnerHTML={{ __html: generateNFT_SVG(score, linesClearedLocal, level, tetrisClears || 0, tetrisRate || 0, drought).replace(/width="400" height="400"/, 'width="100%" height="100%" viewBox="0 0 400 400"') }} />
                     
                     <div className="text-yellow-400 font-bold mb-2 relative z-10 text-xs tracking-tight leading-none drop-shadow-md uppercase">
                        Your Onchain Achievement
                     </div>
                     
                     <div className="grid grid-cols-2 gap-2 text-left bg-black/40 border border-yellow-500/30 p-2 mb-3 relative z-10 text-[10px] text-yellow-300 font-mono tracking-tighter w-full">
                       <div>LINES: <span className="text-white">{linesClearedLocal}</span></div>
                       <div>LEVEL: <span className="text-white">{level}</span></div>
                       <div>TETRIS RATE: <span className="text-white">{tetrisRate}%</span></div>
                       <div>DROUGHT: <span className="text-white">{drought}</span></div>
                     </div>
                     
                     <button 
                       onClick={async () => {
                         if (isMinting || !provider || !walletAddress) {
                            if (!walletAddress) alert("Please connect wallet first!");
                            return;
                         }
                         try {
                           setIsMinting(true);
                           setMintStatus("CONFIRM IN WALLET...");
                           const signer = await provider.getSigner();
                           
                           setMintStatus("MINTING ON Arc...");
                           const contractAddress = "0xd9145CCE52D386f254917e481eB44e9943F39138";
                           const abi = [
                             "function mintNFT(uint256 score, uint256 lines, uint256 level, uint256 tetrises, uint256 tetrisRateBps, uint256 drought, string metadataURI) public returns (uint256)"
                           ];
                           const contract = new ethers.Contract(contractAddress, abi, signer);
                           
                           const tetrisRateBps = isNaN(tetrisRate) ? 0 : Math.floor(tetrisRate * 100);
                           const metadata_URI = generateMetadataURI(score, linesClearedLocal, level, tetrisClears || 0, tetrisRate || 0, drought);
                           
                           const tx = await contract.mintNFT(score, linesClearedLocal, level, tetrisClears || 0, tetrisRateBps, drought, metadata_URI);
                           
                           setMintTxHash(tx.hash);
                           await tx.wait();
                           
                           setMintStatus("MINT SUCCESSFUL");
                           setTimeout(() => {
                              setMintStatus("MINT NFT");
                              setMintTxHash(null);
                           }, 7000);
                         } catch (e: any) {
                           console.error("Mint failed", e);
                           setMintStatus("MINT FAILED");
                           setTimeout(() => setMintStatus("MINT NFT"), 3000);
                         } finally {
                           setIsMinting(false);
                         }
                       }}
                       disabled={isMinting || mintStatus === "MINT SUCCESSFUL"}
                       className={`w-full relative z-10 font-bold py-3 px-4 shadow-[0_0_10px_rgba(255,255,0,0.5)] transition-all ${isMinting || mintStatus === "MINT SUCCESSFUL" ? 'bg-yellow-800 text-yellow-500 cursor-not-allowed' : 'bg-yellow-500 hover:bg-yellow-400 text-black'}`}>
                        {mintStatus}
                     </button>
                     {mintTxHash && (
                         <div className="text-center mt-3">
                           <a 
                             href={`https://testnet.arcscan.app/tx/${mintTxHash}`} 
                             target="_blank" 
                             rel="noopener noreferrer"
                             className="text-[10px] text-yellow-400 hover:text-yellow-300 underline font-mono inline-flex items-center gap-1 bg-yellow-900/50 px-2 py-1"
                           >
                             VIEW ON EXPLORER <ExternalLink className="w-3 h-3" />
                           </a>
                         </div>
                     )}
                  </div>
               </div>
            )}

            <div className="text-[10px] text-neutral-500 text-center uppercase tracking-widest mt-auto hidden lg:block border-t border-neutral-800 pt-4">
             <div className="mb-2">CONTROLS:</div>
             <span className="text-white bg-neutral-800 p-2 border border-neutral-700 rounded-sm shadow-inner block text-center">ARROWS TO MOVE<br/>UP TO ROTATE<br/>SPACE TO HARD DROP</span>
           </div>

        </div>

      </div>

      {/* Modals */}
      <Modal isOpen={showHowToPlay} onClose={() => setShowHowToPlay(false)} title="HOW TO PLAY Arc Tetris">
         <div className="flex gap-4 items-center">
            <div className="flex-1">
               <ul className="list-disc pl-5 space-y-2 text-green-300 text-xs sm:text-sm">
                  <li><strong>Clear Lines:</strong> Fill horizontal rows to earn points. Speeds up every 10 lines!</li>
                  <li><strong>TETRIS:</strong> Clear 4 lines at once for a massive point boost.</li>
                  <li><strong>A-R-C Bonus:</strong> Clear a line containing A-R-C for +1000pts!</li>
                  <li><strong>Compete:</strong> Connect wallet to post high scores to Arc.</li>
                  <li><strong>Mint NFT:</strong> Score 5000+ to mint an exclusive onchain achievement!</li>
               </ul>
            </div>
            <div className="w-20 sm:w-28 flex-shrink-0">
               <img src="/Tim-Arc1.png" alt="Tim Toasty" className="w-full object-contain filter drop-shadow-lg" />
            </div>
         </div>
      </Modal>

      <Modal isOpen={showAboutArc} onClose={() => setShowAboutArc(false)} title="Arc FAUCET & NETWORK">
         <div className="bg-yellow-900/20 border-l-4 border-yellow-600 p-4">
            <p className="text-yellow-300/80 leading-relaxed text-sm">
               Arc Tetris uses the Arc network's decentralized infrastructure to save your high scores securely onchain. 
               To submit scores, you'll need test USDC tokens for micro-fees (simulating network usage).
            </p>
         </div>
         <a 
            href="https://faucet.circle.com/" 
            target="_blank" 
            rel="noreferrer"
            className="inline-flex w-full text-sm text-neutral-900 font-bold bg-yellow-500 hover:bg-yellow-400 p-4 justify-center items-center gap-2 transition-colors uppercase tracking-widest mt-2"
            title="Get test USDC from Circle's universal faucet"
         >
            <ExternalLink className="w-4 h-4"/> GET TEST USDC FROM FAUCET
         </a>
      </Modal>

      <Modal isOpen={showLeaderboard} onClose={() => setShowLeaderboard(false)} title="GLOBAL LEADERBOARD">
         <div className="flex flex-col gap-2">
            {leaderboard.length === 0 ? (
               <div className="text-center text-green-700 italic border border-green-900 p-8">No scores recorded yet.</div>
            ) : (
               leaderboard.map((entry, i) => (
               <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-green-900/50 pb-3 pt-2 gap-2">
                  <div className="flex items-center gap-3">
                     <span className="text-green-700 font-bold text-lg w-6 text-right">#{i+1}</span>
                     <span className="font-mono text-green-300 text-sm truncate max-w-[200px] sm:max-w-none">
                        {entry.walletAddress.substring(0, 6)}...{entry.walletAddress.substring(38)}
                     </span>
                  </div>
                  <div className="flex gap-4 sm:ml-auto items-baseline">
                     <span className="text-green-600 text-xs uppercase">Lines: {entry.lines}</span>
                     <span className="text-yellow-500 font-bold text-lg">{entry.score} pts</span>
                  </div>
               </div>
               ))
            )}
         </div>
      </Modal>

    </div>
  );
}
