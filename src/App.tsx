import { useState, useEffect, useRef } from "react";
import { useTetris, TETROMINOS } from "./useTetris";
import { Wallet, Trophy, Play, Coins, AlertTriangle, ExternalLink, BookOpen, X, Volume2, VolumeX } from "lucide-react";
import { ethers, BrowserProvider } from "ethers";
import { toggleMute, playSound } from "./audio";
import timArc1 from './Tim-Arc1.png';
import toastyMp3 from './Toasty.mp3';
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
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <div className="bg-neutral-900 border-4 border-green-600 max-w-lg w-full p-6 shadow-[0_0_50px_rgba(0,255,0,0.3)] relative">
        <button onClick={onClose} className="absolute top-2 right-2 text-green-500 hover:text-white font-bold p-2">
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-xl text-green-400 mb-6 drop-shadow-[0_0_5px_rgba(0,255,0,0.8)]">{title}</h2>
        <div className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar flex flex-col gap-4 text-sm text-neutral-300">
          {children}
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const { board, startGame, gameOver, score, linesClearedLocal, level, tetrisEffect, movePlayer, dropPlayer, playerRotate, hardDrop, tetrisRate, drought } = useTetris();

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
      alert("Please install MetaMask or another Web3 Wallet!");
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
  const [isMinting, setIsMinting] = useState(false);
  const [mintStatus, setMintStatus] = useState("MINT ON ARC");

  // Easter egg
  useEffect(() => {
    if (tetrisEffect) {
       setShowToasty(tetrisEffect);
       if (!isMuted) {
          try {
             const audio = new Audio(toastyMp3);
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
               <a 
                 href="https://x.com/mixon_here" 
                 target="_blank" 
                 rel="noopener noreferrer"
                 className="flex flex-col items-center gap-1 opacity-80 hover:opacity-100 transition-opacity bg-black/40 px-2 py-1 rounded border border-green-900/50"
               >
                 <span className="text-[9px] font-sans text-green-500 uppercase tracking-widest text-center leading-tight">developed<br/>by</span>
                 <img src="https://unavatar.io/x/mixon_here?fallback=https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png" alt="mixon_here avatar" className="w-6 h-6 rounded-full border border-green-500" />
               </a>
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
                <div className="bg-neutral-950 p-3 border-2 border-green-800 flex flex-col gap-1">
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
                <div className="text-[10px] text-green-600 text-right mt-1 font-bold">NET: {networkName}</div>
              </div>
            )}
          </div>

          <div className="bg-neutral-900 border-4 border-green-700 p-6 shadow-[0_0_20px_rgba(0,255,0,0.2)] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm text-green-500 flex items-center gap-2">
                <Trophy className="w-4 h-4" /> LEADERBOARD
              </h2>
              <button onClick={handleToggleMute} className="text-green-500 hover:text-green-300">
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex flex-col gap-3 text-xs text-green-400">
              {leaderboard.length === 0 ? (
                <div className="text-green-800 italic text-center py-4">... NO SCORES ...</div>
              ) : (
                leaderboard.slice(0, 5).map((entry, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-green-900/50 pb-2">
                    <span className="flex-1 font-mono truncate mr-2">
                      <span className="text-green-700 mr-2">{(i+1).toString().padStart(2, '0')}</span>
                      {entry.address.substring(0, 5)}..{entry.address.substring(39)}
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
                    <img src={timArc1} alt="Tim Toasty" className="w-24 h-24 sm:w-32 sm:h-32 object-contain" />
                  </div>

                  {showToasty === 'mega' && (
                      <>
                      <div className={`absolute bottom-[0px] left-[0px] z-[60] drop-shadow-2xl animate-toasty-bl`}>
                         <img src={timArc1} alt="Tim Toasty" className="w-24 h-24 sm:w-32 sm:h-32 object-contain" style={{transform: "scaleX(-1)"}} />
                      </div>
                      
                      <div className={`absolute top-[0px] right-[0px] z-[60] drop-shadow-2xl animate-toasty-tr`}>
                         <img src={timArc1} alt="Tim Toasty" className="w-24 h-24 sm:w-32 sm:h-32 object-contain" style={{transform: "scaleY(-1)"}} />
                      </div>
                      
                      <div className={`absolute top-[0px] left-[0px] z-[60] drop-shadow-2xl animate-toasty-tl`}>
                         <img src={timArc1} alt="Tim Toasty" className="w-24 h-24 sm:w-32 sm:h-32 object-contain" style={{transform: "scale(-1, -1)"}} />
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
                              <a href={`https://testnet.arcscan.app/address/${walletAddress}?tab=txs`} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">VIEW IN EXPLORER</a>
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
                            onClick={startGame}
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
                      onClick={startGame}
                      className="bg-neutral-800 hover:bg-neutral-700 border-2 border-neutral-600 px-8 py-4 text-white text-sm uppercase tracking-widest"
                    >
                      PLAY OFFLINE
                    </button>
                  </div>
                )}
              </div>
            )}
        </div>

        {/* Stats Column */}
        <div className="w-full md:w-72 flex flex-col gap-6 flex-shrink-0">

           <div className="bg-neutral-900 border-4 border-blue-700 p-6 flex flex-col gap-6 shadow-[0_0_20px_rgba(0,0,255,0.2)]">
              <div>
                 <div className="text-[10px] text-blue-500 border-b border-blue-900 mb-2 pb-1">SCORE</div>
                 <div className="text-3xl text-blue-300">{score.toString().padStart(6, '0')}</div>
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
              
              {score >= 5000 && (
                 <div className="mt-4 border border-yellow-500 bg-yellow-900/30 p-0 text-center animate-pulse relative overflow-hidden">
                    <div className="bg-yellow-600 px-2 py-1 text-[10px] text-black font-bold tracking-widest border-b border-yellow-500 flex justify-between items-center">
                       <span>ARC TETRIS EXCLUSIVE</span>
                       <span>MINT READY</span>
                    </div>
                    <div className="p-4 relative">
                       <img src={timArc1} alt="Tim Toasty" className="absolute opacity-20 w-32 h-32 top-[-20px] right-[-20px] object-contain rotate-12 drop-shadow-xl" />
                       <div className="text-yellow-400 font-bold mb-2 relative z-10 text-xl tracking-tight leading-none drop-shadow-md">
                          <span className="text-3xl text-white">{score}</span>
                          <span className="block text-sm text-yellow-500 mt-1 uppercase">PTS NFT UNLOCKED</span>
                       </div>
                       
                       <div className="grid grid-cols-2 gap-2 text-left bg-black/40 border border-yellow-500/30 p-2 mb-3 relative z-10 text-[10px] text-yellow-300 font-mono tracking-tighter">
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
                             
                             setMintStatus("MINTING ON ARC...");
                             const dataPayload = ethers.hexlify(ethers.toUtf8Bytes(`ARC_TETRIS_MINT_NFT_SCORE:${score}`));
                             
                             const tx = await signer.sendTransaction({
                               to: "0x0000000000000000000000000000000000000000",
                               value: 0,
                               data: dataPayload
                             });
                             
                             await tx.wait();
                             
                             setMintStatus("MINTED!");
                             setTimeout(() => setMintStatus("MINT ON ARC"), 3000);
                           } catch (e: any) {
                             console.error("Mint failed", e);
                             setMintStatus("MINT FAILED");
                             setTimeout(() => setMintStatus("MINT ON ARC"), 3000);
                           } finally {
                             setIsMinting(false);
                           }
                         }}
                         disabled={isMinting || mintStatus === "MINTED!"}
                         className={`w-full relative z-10 font-bold py-2 px-4 shadow-[0_0_10px_rgba(255,255,0,0.5)] transition-all ${isMinting || mintStatus === "MINTED!" ? 'bg-yellow-800 text-yellow-500 cursor-not-allowed' : 'bg-yellow-500 hover:bg-yellow-400 text-black'}`}>
                          {mintStatus}
                       </button>
                    </div>
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
                <div>Arc testnet</div>
                <AlertTriangle className="w-5 h-5"/>
              </button>
           </div>

           <div className="text-[10px] text-neutral-500 text-center uppercase tracking-widest mt-auto hidden lg:block border-t border-neutral-800 pt-4">
             <div className="mb-2">CONTROLS:</div>
             <span className="text-white bg-neutral-800 p-2 border border-neutral-700 rounded-sm shadow-inner block text-center">ARROWS TO MOVE<br/>UP TO ROTATE<br/>SPACE TO HARD DROP</span>
           </div>

        </div>

      </div>

      {/* Modals */}
      <Modal isOpen={showHowToPlay} onClose={() => setShowHowToPlay(false)} title="HOW TO PLAY Arc Tetris">
         <div className="flex gap-4">
            <div className="flex-1">
               <p>Arc Tetris is a classic block-stacking puzzle game merged with onchain features!</p>
               <ul className="list-disc pl-5 space-y-3 mt-4 text-green-300">
                  <li><strong>Clear Lines:</strong> Fill an entire horizontal row to clear it and earn points. The game speeds up every 10 lines!</li>
                  <li><strong>Score a 'TETRIS':</strong> Clear 4 lines at once (using the long 'I' piece) for a massive point boost. Watch your Tetris Rate climb!</li>
                  <li><strong>Arc Bonus:</strong> Look out for blocks containing the letters <strong>A</strong>, <strong>R</strong>, <strong>C</strong>.</li>
                  <li><strong>Ultra Bonus:</strong> If you clear a line that creates the word A-R-C, you get a +1000pts Ultra Bonus!</li>
                  <li><strong>Compete:</strong> Connect your wallet to <strong>Arc testnet</strong> to post your highest score to the global leaderboard.</li>
               </ul>
            </div>
            <div className="w-24 sm:w-32 flex-shrink-0">
               <img src={timArc1} alt="Tim Toasty" className="w-full object-contain filter drop-shadow-lg" />
            </div>
         </div>
      </Modal>

      <Modal isOpen={showAboutArc} onClose={() => setShowAboutArc(false)} title="ABOUT Arc testnet">
         <div className="bg-yellow-900/20 border-l-4 border-yellow-600 p-4 mb-4">
            <h3 className="text-yellow-500 font-bold mb-2 flex items-center gap-2">
               <AlertTriangle className="w-4 h-4"/> ONCHAIN INTEGRATION
            </h3>
            <p className="text-yellow-300/80 leading-relaxed text-sm">
               At the end of your game session, a background transaction records your final score to the blockchain.
               A micro-fee is calculated proportionally based on the number of lines you cleared (simulating network usage).
            </p>
         </div>
         <p>Gameplay remains completely uninterrupted, showing how the Arc testnet can bridge the gap between traditional Web2 gaming and Web3 decentralization.</p>
         
         <div className="mt-8">
            <a 
               href="https://faucet.circle.com/" 
               target="_blank" 
               rel="noreferrer"
               className="inline-flex w-full text-sm text-neutral-900 font-bold bg-yellow-500 hover:bg-yellow-400 p-4 justify-center items-center gap-2 transition-colors uppercase tracking-widest"
               title="Get test USDC from Circle's universal faucet"
            >
               <ExternalLink className="w-4 h-4"/> GET TEST USDC FROM FAUCET
            </a>
         </div>
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
                        {entry.walletAddress}
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
