import { useEffect, useRef, useState, useCallback } from 'react';
import { Game, RunStats } from './game';
import { GameState, SHIPS, MISSIONS, UPGRADES, C, type GameStateType, type SaveData } from './core';
import { initAudio, Audio, setMuted } from './audio';
import { formatScore, formatDistance } from './utils';

type Screen = 'boot' | 'menu' | 'running' | 'paused' | 'gameover' | 'upgrades' | 'hangar' | 'missions';

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [screen, setScreen] = useState<Screen>('boot');
  const [save, setSave] = useState<SaveData | null>(null);
  const [runStats, setRunStats] = useState<RunStats | null>(null);
  const [hudData, setHudData] = useState({ score: 0, multiplier: 1, combo: 0, shields: 1, boost: 0, distance: 0, bestScore: 0 });
  const [floatingTexts, setFloatingTexts] = useState<{ id: number; text: string; color: string }[]>([]);
  const floatIdRef = useRef(0);

  const [webglError, setWebglError] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    try {
      const game = new Game(canvasRef.current);
      gameRef.current = game;

      game.onStateChange = (state: GameStateType) => {
        switch (state) {
          case 'MainMenu': setScreen('menu'); break;
          case 'Running': setScreen('running'); break;
          case 'Paused': setScreen('paused'); break;
          case 'GameOver': setScreen('gameover'); break;
        }
      };

      game.onScoreUpdate = (data) => setHudData(data);
      game.onRunEnd = (stats) => {
        setRunStats(stats);
        setSave({ ...game.getSave() });
      };
      game.onFloatingText = (text, color) => {
        const id = ++floatIdRef.current;
        setFloatingTexts(prev => [...prev, { id, text, color }]);
        setTimeout(() => setFloatingTexts(prev => prev.filter(f => f.id !== id)), 1200);
      };

      setSave({ ...game.getSave() });
      setScreen('menu');

      return () => { game.dispose(); };
    } catch (e) {
      console.error('Failed to initialize game:', e);
      setWebglError(true);
    }
  }, []);

  // Global keyboard handler for pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Escape' || e.key === 'p' || e.key === 'P') && screen === 'running') {
        gameRef.current?.pause();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [screen]);

  const handlePlay = useCallback((daily = false) => {
    initAudio();
    Audio.uiClick();
    gameRef.current?.startRun(daily);
  }, []);

  const handlePause = useCallback(() => {
    Audio.uiClick();
    gameRef.current?.pause();
  }, []);

  const handleResume = useCallback(() => {
    Audio.uiClick();
    gameRef.current?.resume();
  }, []);

  const handleRetry = useCallback(() => {
    Audio.uiClick();
    gameRef.current?.startRun(false);
  }, []);

  const handleMenu = useCallback(() => {
    Audio.uiClick();
    gameRef.current?.goToMenu();
    setSave({ ...gameRef.current!.getSave() });
  }, []);

  const handleUpgrades = useCallback(() => {
    Audio.uiClick();
    setScreen('upgrades');
  }, []);

  const handleHangar = useCallback(() => {
    Audio.uiClick();
    setScreen('hangar');
  }, []);

  const handleMissions = useCallback(() => {
    Audio.uiClick();
    setScreen('missions');
  }, []);

  const handlePurchaseUpgrade = useCallback((id: keyof SaveData['upgradeLevels']) => {
    if (gameRef.current?.purchaseUpgrade(id)) {
      setSave({ ...gameRef.current.getSave() });
    }
  }, []);

  const handleUnlockShip = useCallback((id: string) => {
    if (gameRef.current?.unlockShip(id)) {
      setSave({ ...gameRef.current.getSave() });
    }
  }, []);

  const handleSelectShip = useCallback((id: string) => {
    gameRef.current?.selectShip(id);
    setSave({ ...gameRef.current!.getSave() });
  }, []);

  const handleToggleMute = useCallback(() => {
    gameRef.current?.toggleMute();
    setSave({ ...gameRef.current!.getSave() });
  }, []);

  if (webglError) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#050510] text-white p-8">
        <div className="text-center max-w-md">
          <h1 className="text-3xl font-bold mb-4">WebGL Not Available</h1>
          <p className="text-gray-400">Your browser or device doesn't support WebGL, which is required to run Void Skimmer.</p>
          <p className="text-gray-400 mt-2">Please try a modern browser like Chrome, Firefox, or Safari.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#050510]">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ touchAction: 'none' }}
      />

      {/* HUD - only during running */}
      {screen === 'running' && <HUD data={hudData} onPause={handlePause} muted={save?.settings.muted ?? false} />}

      {/* Floating texts */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        {floatingTexts.map(ft => (
          <div key={ft.id} className="floating-text absolute text-2xl font-bold animate-bounce"
            style={{ color: ft.color, textShadow: `0 0 10px ${ft.color}` }}>
            {ft.text}
          </div>
        ))}
      </div>

      {/* Main Menu */}
      {screen === 'menu' && save && (
        <MainMenu
          save={save}
          onPlay={() => handlePlay(false)}
          onDailyPlay={() => handlePlay(true)}
          onUpgrades={handleUpgrades}
          onHangar={handleHangar}
          onMissions={handleMissions}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* Pause */}
      {screen === 'paused' && (
        <PauseMenu onResume={handleResume} onRestart={handleRetry} onMenu={handleMenu} onToggleMute={handleToggleMute} muted={save?.settings.muted ?? false} />
      )}

      {/* Game Over */}
      {screen === 'gameover' && runStats && (
        <GameOverScreen stats={runStats} save={save!} onRetry={handleRetry} onMenu={handleMenu} onUpgrades={handleUpgrades} />
      )}

      {/* Upgrades */}
      {screen === 'upgrades' && save && (
        <UpgradesScreen save={save} onPurchase={handlePurchaseUpgrade} onBack={handleMenu} />
      )}

      {/* Hangar */}
      {screen === 'hangar' && save && (
        <HangarScreen save={save} onUnlock={handleUnlockShip} onSelect={handleSelectShip} onBack={handleMenu} />
      )}

      {/* Missions */}
      {screen === 'missions' && save && (
        <MissionsScreen save={save} onBack={handleMenu} />
      )}
    </div>
  );
}

// ============ HUD ============
interface HudData { score: number; multiplier: number; combo: number; shields: number; boost: number; distance: number; bestScore: number }

function HUD({ data, onPause, muted }: { data: HudData; onPause: () => void; muted: boolean }) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Top bar */}
      <div className="flex justify-between items-start p-3 sm:p-4">
        <div className="text-left">
          <div className="text-white text-2xl sm:text-3xl font-bold tabular-nums">{formatScore(data.score)}</div>
          <div className="text-gray-400 text-xs sm:text-sm">{formatDistance(data.distance)}</div>
        </div>
        <div className="text-right">
          <div className="text-gray-400 text-xs">BEST: {formatScore(data.bestScore)}</div>
          {data.multiplier > 1 && (
            <div className="text-yellow-400 text-lg sm:text-xl font-bold">x{data.multiplier}</div>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 flex justify-between items-end">
        <div className="flex flex-col gap-1">
          {/* Shields */}
          <div className="flex gap-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={`w-4 h-4 rounded-full border-2 ${i < data.shields ? 'bg-cyan-400 border-cyan-300' : 'bg-transparent border-gray-600'}`} />
            ))}
          </div>
          {/* Boost meter */}
          <div className="w-24 sm:w-32 h-2 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-orange-500 to-yellow-400 transition-all duration-100"
              style={{ width: `${data.boost}%` }} />
          </div>
        </div>

        {/* Combo */}
        {data.combo > 0 && (
          <div className="text-green-400 text-sm font-mono">COMBO: {data.combo}</div>
        )}

        {/* Pause button */}
        <button onClick={onPause} className="pointer-events-auto w-10 h-10 flex items-center justify-center bg-white/10 rounded-lg backdrop-blur-sm active:bg-white/20">
          <span className="text-white text-lg">{muted ? '🔇' : '⏸'}</span>
        </button>
      </div>
    </div>
  );
}

// ============ MAIN MENU ============
function MainMenu({ save, onPlay, onDailyPlay, onUpgrades, onHangar, onMissions, onToggleMute }: {
  save: SaveData; onPlay: () => void; onDailyPlay: () => void; onUpgrades: () => void; onHangar: () => void; onMissions: () => void; onToggleMute: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const dailyAvailable = save.dailyChallenge.date !== today;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-transparent via-[#050510]/80 to-[#050510]/95 p-4">
      <h1 className="text-4xl sm:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 mb-2">
        VOID SKIMMER
      </h1>
      <p className="text-gray-400 text-sm mb-8">Fly close. Score big. Survive.</p>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button onClick={onPlay}
          className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-xl rounded-xl shadow-lg shadow-blue-500/30 hover:scale-105 active:scale-95 transition-transform">
          ▶ PLAY
        </button>

        {dailyAvailable && (
          <button onClick={onDailyPlay}
            className="px-6 py-3 bg-gradient-to-r from-yellow-600 to-orange-600 text-white font-bold rounded-xl hover:scale-105 active:scale-95 transition-transform">
            ⭐ DAILY CHALLENGE
          </button>
        )}

        <div className="flex gap-2 mt-2">
          <button onClick={onUpgrades}
            className="flex-1 px-4 py-2.5 bg-white/10 text-white rounded-lg hover:bg-white/20 active:scale-95 transition-all text-sm font-medium">
            🔧 Upgrades
          </button>
          <button onClick={onHangar}
            className="flex-1 px-4 py-2.5 bg-white/10 text-white rounded-lg hover:bg-white/20 active:scale-95 transition-all text-sm font-medium">
            🚀 Hangar
          </button>
          <button onClick={onMissions}
            className="flex-1 px-4 py-2.5 bg-white/10 text-white rounded-lg hover:bg-white/20 active:scale-95 transition-all text-sm font-medium">
            📋 Missions
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-8 flex gap-6 text-center">
        <div>
          <div className="text-yellow-400 text-lg font-bold">{save.stardust}</div>
          <div className="text-gray-500 text-xs">STARDUST</div>
        </div>
        <div>
          <div className="text-blue-400 text-lg font-bold">{formatScore(save.bestScore)}</div>
          <div className="text-gray-500 text-xs">BEST SCORE</div>
        </div>
        <div>
          <div className="text-green-400 text-lg font-bold">{save.totalRuns}</div>
          <div className="text-gray-500 text-xs">RUNS</div>
        </div>
      </div>

      {/* Mute toggle */}
      <button onClick={onToggleMute} className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-white/10 rounded-lg text-white hover:bg-white/20">
        {save.settings.muted ? '🔇' : '🔊'}
      </button>
    </div>
  );
}

// ============ PAUSE MENU ============
function PauseMenu({ onResume, onRestart, onMenu, onToggleMute, muted }: {
  onResume: () => void; onRestart: () => void; onMenu: () => void; onToggleMute: () => void; muted: boolean;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="flex flex-col gap-3 w-64">
        <h2 className="text-2xl font-bold text-white text-center mb-4">PAUSED</h2>
        <button onClick={onResume} className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 active:scale-95 transition-all">
          ▶ RESUME
        </button>
        <button onClick={onRestart} className="px-6 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 active:scale-95 transition-all">
          ↺ RESTART
        </button>
        <button onClick={onMenu} className="px-6 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 active:scale-95 transition-all">
          ✕ QUIT
        </button>
        <button onClick={onToggleMute} className="px-6 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 active:scale-95 transition-all">
          {muted ? '🔇 UNMUTE' : '🔊 MUTE'}
        </button>
      </div>
    </div>
  );
}

// ============ GAME OVER ============
function GameOverScreen({ stats, save, onRetry, onMenu, onUpgrades }: {
  stats: RunStats; save: SaveData; onRetry: () => void; onMenu: () => void; onUpgrades: () => void;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-gray-900/90 rounded-2xl p-6 max-w-sm w-full border border-gray-700">
        {stats.isNewRecord && (
          <div className="text-center mb-3">
            <span className="text-yellow-400 font-bold text-lg animate-pulse">★ NEW RECORD ★</span>
          </div>
        )}
        <h2 className="text-3xl font-bold text-white text-center mb-1">{formatScore(stats.score)}</h2>
        <p className="text-gray-400 text-center text-sm mb-4">FINAL SCORE</p>

        <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
          <div className="bg-white/5 rounded-lg p-2 text-center">
            <div className="text-blue-400 font-bold">{formatDistance(stats.distance)}</div>
            <div className="text-gray-500 text-xs">DISTANCE</div>
          </div>
          <div className="bg-white/5 rounded-lg p-2 text-center">
            <div className="text-green-400 font-bold">{stats.time.toFixed(1)}s</div>
            <div className="text-gray-500 text-xs">SURVIVED</div>
          </div>
          <div className="bg-white/5 rounded-lg p-2 text-center">
            <div className="text-purple-400 font-bold">{stats.nearMisses}</div>
            <div className="text-gray-500 text-xs">NEAR-MISSES</div>
          </div>
          <div className="bg-white/5 rounded-lg p-2 text-center">
            <div className="text-yellow-400 font-bold">{stats.bestCombo}</div>
            <div className="text-gray-500 text-xs">BEST COMBO</div>
          </div>
          <div className="bg-white/5 rounded-lg p-2 text-center">
            <div className="text-cyan-400 font-bold">{stats.shardsCollected}</div>
            <div className="text-gray-500 text-xs">SHARDS</div>
          </div>
          <div className="bg-white/5 rounded-lg p-2 text-center">
            <div className="text-yellow-400 font-bold">+{stats.stardustEarned}</div>
            <div className="text-gray-500 text-xs">STARDUST</div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button onClick={onRetry}
            className="px-6 py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-lg rounded-xl hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-blue-500/30">
            ↺ RETRY
          </button>
          <div className="flex gap-2">
            <button onClick={onUpgrades} className="flex-1 px-4 py-2.5 bg-white/10 text-white rounded-lg hover:bg-white/20 active:scale-95 transition-all text-sm">
              🔧 Upgrades
            </button>
            <button onClick={onMenu} className="flex-1 px-4 py-2.5 bg-white/10 text-white rounded-lg hover:bg-white/20 active:scale-95 transition-all text-sm">
              ✕ Menu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ UPGRADES SCREEN ============
function UpgradesScreen({ save, onPurchase, onBack }: { save: SaveData; onPurchase: (id: keyof SaveData['upgradeLevels']) => void; onBack: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-gray-900/90 rounded-2xl p-6 max-w-md w-full border border-gray-700 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white">UPGRADES</h2>
          <div className="text-yellow-400 font-bold">✦ {save.stardust}</div>
        </div>

        <div className="flex flex-col gap-3">
          {UPGRADES.map(upg => {
            const level = save.upgradeLevels[upg.id];
            const maxed = level >= C.maxUpgradeLevel;
            const cost = maxed ? 0 : C.upgradeCosts[level];
            const canAfford = save.stardust >= cost;

            return (
              <div key={upg.id} className="bg-white/5 rounded-xl p-3 flex items-center gap-3">
                <div className="flex-1">
                  <div className="text-white font-medium text-sm">{upg.name}</div>
                  <div className="text-gray-400 text-xs">{maxed ? 'MAX LEVEL' : upg.description(level)}</div>
                  <div className="flex gap-0.5 mt-1">
                    {Array.from({ length: C.maxUpgradeLevel }).map((_, i) => (
                      <div key={i} className={`w-3 h-1.5 rounded-full ${i < level ? 'bg-blue-400' : 'bg-gray-700'}`} />
                    ))}
                  </div>
                </div>
                {!maxed && (
                  <button
                    onClick={() => onPurchase(upg.id)}
                    disabled={!canAfford}
                    className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${canAfford ? 'bg-blue-600 text-white hover:bg-blue-500 active:scale-95' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                  >
                    ✦ {cost}
                  </button>
                )}
                {maxed && <span className="text-green-400 text-xs font-bold">MAX</span>}
              </div>
            );
          })}
        </div>

        <button onClick={onBack} className="mt-4 w-full px-6 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 active:scale-95 transition-all">
          ← BACK
        </button>
      </div>
    </div>
  );
}

// ============ HANGAR SCREEN ============
function HangarScreen({ save, onUnlock, onSelect, onBack }: { save: SaveData; onUnlock: (id: string) => void; onSelect: (id: string) => void; onBack: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-gray-900/90 rounded-2xl p-6 max-w-md w-full border border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white">HANGAR</h2>
          <div className="text-yellow-400 font-bold">✦ {save.stardust}</div>
        </div>

        <div className="flex flex-col gap-3">
          {SHIPS.map(ship => {
            const owned = save.unlockedShips.includes(ship.id);
            const selected = save.selectedShipId === ship.id;
            const canAfford = save.stardust >= ship.cost;

            return (
              <div key={ship.id} className={`rounded-xl p-4 border-2 transition-all ${selected ? 'border-blue-400 bg-blue-900/20' : 'border-gray-700 bg-white/5'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: ship.bodyColor + '33' }}>
                    <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-b-[20px] border-l-transparent border-r-transparent" style={{ borderBottomColor: ship.bodyColor }} />
                  </div>
                  <div className="flex-1">
                    <div className="text-white font-bold">{ship.name}</div>
                    <div className="text-gray-400 text-xs">Handling: {ship.handling.toFixed(2)}x</div>
                  </div>
                  {selected && <span className="text-blue-400 text-xs font-bold">SELECTED</span>}
                  {!owned && (
                    <button
                      onClick={() => onUnlock(ship.id)}
                      disabled={!canAfford}
                      className={`px-3 py-1.5 rounded-lg text-sm font-bold ${canAfford ? 'bg-green-600 text-white hover:bg-green-500' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                    >
                      ✦ {ship.cost}
                    </button>
                  )}
                  {owned && !selected && (
                    <button onClick={() => onSelect(ship.id)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-500 active:scale-95">
                      SELECT
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <button onClick={onBack} className="mt-4 w-full px-6 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 active:scale-95 transition-all">
          ← BACK
        </button>
      </div>
    </div>
  );
}

// ============ MISSIONS SCREEN ============
function MissionsScreen({ save, onBack }: { save: SaveData; onBack: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-gray-900/90 rounded-2xl p-6 max-w-md w-full border border-gray-700 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-white mb-4">MISSIONS</h2>

        <div className="flex flex-col gap-3">
          {MISSIONS.map(mission => {
            const ms = save.missions[mission.id] || { progress: 0, completed: false, claimed: false };
            const progress = Math.min(ms.progress, mission.target);
            const pct = (progress / mission.target) * 100;

            return (
              <div key={mission.id} className={`rounded-xl p-3 ${ms.completed ? 'bg-green-900/20 border border-green-700' : 'bg-white/5'}`}>
                <div className="flex justify-between items-center mb-1">
                  <div className="text-white text-sm font-medium">{mission.description}</div>
                  <div className="text-yellow-400 text-xs font-bold">✦ {mission.rewardStardust}</div>
                </div>
                <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${ms.completed ? 'bg-green-500' : 'bg-blue-500'}`}
                    style={{ width: `${pct}%` }} />
                </div>
                <div className="text-gray-500 text-xs mt-1">
                  {ms.completed ? '✓ COMPLETE' : `${Math.floor(progress)} / ${mission.target}`}
                </div>
              </div>
            );
          })}
        </div>

        <button onClick={onBack} className="mt-4 w-full px-6 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 active:scale-95 transition-all">
          ← BACK
        </button>
      </div>
    </div>
  );
}

export default App;
