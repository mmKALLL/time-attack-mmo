import { useGame, type Scene } from '../state/store';
import './app.css';
import { MainMenuScreen } from '../screens/MainMenuScreen';
import { DungeonScreen } from '../screens/DungeonScreen';
import { WorldMapScreen } from '../screens/WorldMapScreen';
import { ShopScreen } from '../screens/ShopScreen';
import { SkillAllocationScreen } from '../screens/SkillAllocationScreen';
import { CharacterCreationScreen } from '../screens/CharacterCreationScreen';
import { HotkeyConfigScreen } from '../screens/HotkeyConfigScreen';
import { NpcChatScreen } from '../screens/NpcChatScreen';

const SCREENS: Record<Scene, () => JSX.Element> = {
  mainMenu: MainMenuScreen,
  dungeon: DungeonScreen,
  worldMap: WorldMapScreen,
  shop: ShopScreen,
  skills: SkillAllocationScreen,
  charCreate: CharacterCreationScreen,
  hotkeys: HotkeyConfigScreen,
  npcChat: NpcChatScreen,
};

const NAV: { scene: Scene; label: string }[] = [
  // { scene: 'mainMenu', label: 'Menu' },
  { scene: 'dungeon', label: 'In-Game' },
  { scene: 'skills', label: 'Skills' },
  { scene: 'worldMap', label: 'World Map' },
  { scene: 'shop', label: 'Shop' },
  // { scene: 'charCreate', label: 'Create' },
  { scene: 'hotkeys', label: 'Hotkeys' },
  // { scene: 'npcChat', label: 'NPC' },
];

export default function App() {
  const scene = useGame((s) => s.scene);
  const setScene = useGame((s) => s.setScene);
  const highlights = useGame((s) => s.highlights);
  const Screen = SCREENS[scene];
  // The full-screen character / world-map views own their whole canvas (incl. the
  // top-right), so hide the debug nav there — each has its own "Return" control.
  const showNav = scene !== 'skills' && scene !== 'worldMap' && scene !== 'mainMenu';
  return (
    <>
      <Screen />
      {showNav && (
        <nav
          style={{
            position: 'fixed',
            top: 8,
            right: 8,
            display: 'flex',
            gap: 6,
            zIndex: 50,
            pointerEvents: 'auto',
            opacity: 0.86,
          }}
        >
          {NAV.map((n) => (
            <button
              key={n.scene}
              onClick={() => setScene(n.scene)}
              className={highlights[n.scene] ? 'nav-glow' : undefined}
              style={{
                fontFamily: 'var(--font-header)',
                fontSize: 12,
                background: scene === n.scene ? '#2a3a5a' : 'rgba(21,26,34,0.9)',
                color: 'var(--ink)',
                border: '1px solid var(--panel-edge)',
                borderRadius: 4,
                padding: '4px 9px',
                cursor: 'pointer',
              }}
            >
              {n.label}
            </button>
          ))}
        </nav>
      )}
    </>
  );
}
