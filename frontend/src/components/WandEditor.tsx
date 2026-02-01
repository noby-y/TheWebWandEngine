import React from 'react';
import { X, RefreshCw, Image as ImageIcon, Camera } from 'lucide-react';
import { toPng } from 'html-to-image';
import { WandData, SpellInfo, AppSettings } from '../types';
import { PropInput } from './Common';
import { getIconUrl } from '../lib/evaluatorAdapter';
import { useTranslation } from 'react-i18next';

interface WandEditorProps {
  slot: string;
  data: WandData;
  spellDb: Record<string, SpellInfo>;
  selection: { wandSlot: string; indices: number[]; startIdx: number } | null;
  hoveredSlot: { wandSlot: string; idx: number; isRightHalf: boolean } | null;
  updateWand: (slot: string, partial: Partial<WandData>, actionName?: string, icons?: string[]) => void;
  handleSlotMouseDown: (slot: string, idx: number, isRightClick?: boolean) => void;
  handleSlotMouseUp: (slot: string, idx: number) => void;
  handleSlotMouseEnter: (slot: string, idx: number) => void;
  handleSlotMouseMove: (e: React.MouseEvent, slot: string, idx: number) => void;
  handleSlotMouseLeave: () => void;
  openPicker: (slot: string, idx: string, e: React.MouseEvent) => void;
  setSelection: (s: any) => void;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  requestEvaluation: (wand: WandData, force?: boolean) => void;
  settings: AppSettings;
  isConnected: boolean;
}

export function WandEditor({
  slot,
  data,
  spellDb,
  selection,
  hoveredSlot,
  updateWand,
  handleSlotMouseDown,
  handleSlotMouseUp,
  handleSlotMouseEnter,
  handleSlotMouseMove,
  handleSlotMouseLeave,
  openPicker,
  setSelection,
  setSettings,
  requestEvaluation,
  settings,
  isConnected
}: WandEditorProps) {
  const { t, i18n } = useTranslation();
  const [isAltPressed, setIsAltPressed] = React.useState(false);
  const wandRef = React.useRef<HTMLDivElement>(null);
  const spellsRef = React.useRef<HTMLDivElement>(null);

  const absoluteToOrdinal = React.useMemo(() => {
    const map: Record<number, number> = {};
    let ordinal = 1;
    for (let i = 1; i <= data.deck_capacity; i++) {
      if (data.spells && data.spells[i.toString()]) {
        map[i] = ordinal++;
      }
    }
    return map;
  }, [data.spells, data.deck_capacity]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setIsAltPressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setIsAltPressed(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', () => setIsAltPressed(false)); // Reset on loss of focus
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const renderTimeInput = (label: string, frames: number, updateKey: keyof WandData) => {
    const primaryValue = settings.showStatsInFrames ? frames : parseFloat((frames / 60).toFixed(3));
    const secondaryValue = settings.showStatsInFrames ? (frames / 60).toFixed(2) + 's' : frames + 'f';
    
    return (
      <PropInput 
        label={label}
        value={primaryValue}
        secondaryValue={secondaryValue}
        colorClass="text-amber-300"
        onChange={v => updateWand(slot, { [updateKey]: settings.showStatsInFrames ? Math.round(v) : Math.round(v * 60) })}
      />
    );
  };

  const getWand2Text = () => {
    const sequence = Array.from({ length: data.deck_capacity }).map((_, i) => data.spells[(i + 1).toString()] || "");
    return `{{Wand2
| wandCard     = Yes
| wandPic      = 
| spellsCast   = ${data.actions_per_round}
| shuffle      = ${data.shuffle_deck_when_empty ? 'Yes' : 'No'}
| castDelay    = ${(data.fire_rate_wait / 60).toFixed(2)}
| rechargeTime = ${(data.reload_time / 60).toFixed(2)}
| manaMax      = ${data.mana_max.toFixed(2)}
| manaCharge   = ${data.mana_charge_speed.toFixed(2)}
| capacity     = ${data.deck_capacity}
| spread       = ${data.spread_degrees}
| speed        = ${data.speed_multiplier.toFixed(2)}
| spells       = ${sequence.join(',')}
| alwaysCasts  = ${data.always_cast.join(',')}
}}`;
  };

  const embedMetadata = async (blob: Blob, text: string): Promise<Blob> => {
    const buffer = await blob.arrayBuffer();
    const view = new DataView(buffer);
    
    // Check PNG signature
    if (view.getUint32(0) !== 0x89504E47 || view.getUint32(4) !== 0x0D0A1A0A) {
      return blob;
    }

    const chunks: { type: string; data: Uint8Array }[] = [];
    let pos = 8;
    while (pos < buffer.byteLength) {
      const length = view.getUint32(pos);
      const type = String.fromCharCode(...new Uint8Array(buffer.slice(pos + 4, pos + 8)));
      const data = new Uint8Array(buffer.slice(pos + 8, pos + 8 + length));
      chunks.push({ type, data });
      pos += 12 + length;
    }

    // Insert tEXt chunk before IDAT or at the end
    const keyword = "Wand2Data";
    const encoder = new TextEncoder();
    const textData = encoder.encode(keyword + "\0" + text);
    const newChunk = { type: 'tEXt', data: textData };
    
    // Find first IDAT
    const idatIdx = chunks.findIndex(c => c.type === 'IDAT');
    if (idatIdx !== -1) {
      chunks.splice(idatIdx, 0, newChunk);
    } else {
      chunks.splice(chunks.length - 1, 0, newChunk);
    }

    // Rebuild PNG
    let totalSize = 8;
    chunks.forEach(c => totalSize += 12 + c.data.length);
    const newBuffer = new ArrayBuffer(totalSize);
    const newView = new DataView(newBuffer);
    
    // Signature
    newView.setUint32(0, 0x89504E47);
    newView.setUint32(4, 0x0D0A1A0A);
    
    let currentPos = 8;
    const crcTable = new Int32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      crcTable[i] = c;
    }

    const calculateCrc = (type: string, data: Uint8Array) => {
      let crc = -1;
      const typeBytes = encoder.encode(type);
      for (let i = 0; i < 4; i++) {
        crc = crcTable[(crc ^ typeBytes[i]) & 0xFF] ^ (crc >>> 8);
      }
      for (let i = 0; i < data.length; i++) {
        crc = crcTable[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
      }
      return crc ^ -1;
    };

    chunks.forEach(c => {
      newView.setUint32(currentPos, c.data.length);
      const typeBytes = encoder.encode(c.type);
      new Uint8Array(newBuffer, currentPos + 4, 4).set(typeBytes);
      new Uint8Array(newBuffer, currentPos + 8, c.data.length).set(c.data);
      const crc = calculateCrc(c.type, c.data);
      newView.setUint32(currentPos + 8 + c.data.length, crc);
      currentPos += 12 + c.data.length;
    });

    return new Blob([newBuffer], { type: 'image/png' });
  };

  const handleExportImage = async (mode: 'only_spells' | 'full') => {
    const ref = mode === 'only_spells' ? spellsRef : wandRef;
    if (!ref.current) return;

    // Target elements for temporary style changes
    const scrollables = ref.current.querySelectorAll('.overflow-y-auto, .custom-scrollbar');
    const attributesContainer = ref.current.querySelector('.attributes-container');
    
    const originalStyles = Array.from(scrollables).map(el => {
      const hEl = el as HTMLElement;
      const original = {
        el: hEl,
        maxHeight: hEl.style.maxHeight,
        overflow: hEl.style.overflow,
        height: hEl.style.height
      };
      hEl.style.maxHeight = 'none';
      hEl.style.overflow = 'visible';
      hEl.style.height = 'auto';
      return original;
    });

    // Ensure attributes container is visible and stable
    let originalAttrStyle = '';
    if (attributesContainer) {
      const hEl = attributesContainer as HTMLElement;
      originalAttrStyle = hEl.style.display;
      hEl.style.display = 'flex';
    }

    try {
      const dataUrl = await toPng(ref.current, {
        pixelRatio: 3,
        backgroundColor: '#0c0c0e',
        cacheBust: true,
        style: {
          borderRadius: '0',
          margin: '0',
        },
        filter: (node: Node) => {
          if (node instanceof HTMLElement && node.classList.contains('export-ignore')) return false;
          return true;
        }
      });

      let blob = await (await fetch(dataUrl)).blob();

      if (settings.embedMetadataInImage) {
        blob = await embedMetadata(blob, getWand2Text());
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `wand_${new Date().getTime()}.png`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export image:', err);
    } finally {
      // Restore original styles
      originalStyles.forEach(s => {
        s.el.style.maxHeight = s.maxHeight;
        s.el.style.overflow = s.overflow;
        s.el.style.height = s.height;
      });
      if (attributesContainer) {
        (attributesContainer as HTMLElement).style.display = originalAttrStyle;
      }
    }
  };

  return (
    <div ref={wandRef} className="px-6 py-6 bg-[#0c0c0e] border-t border-white/5 space-y-8 select-none">
      <div className="flex items-start gap-8 attributes-container">
        <div 
          className="flex flex-wrap items-center bg-zinc-900/50 border border-white/5 rounded-xl p-1 pr-6 shadow-2xl min-w-[600px] wand-attributes-box"
          onMouseUp={() => handleSlotMouseUp(slot, -1000)}
        >
          {/* Group 1: Shuffle */}
          <div className="px-6 py-2 border-r border-white/5 flex items-center h-16">
            <button 
              onClick={() => updateWand(slot, { shuffle_deck_when_empty: !data.shuffle_deck_when_empty })}
              className={`flex items-center gap-2 px-3 py-1.5 rounded border transition-all ${data.shuffle_deck_when_empty ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'}`}
            >
              <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${data.shuffle_deck_when_empty ? 'bg-red-500' : 'bg-emerald-500'}`} />
              <span className="text-[10px] font-black uppercase tracking-widest">{data.shuffle_deck_when_empty ? 'Shuffle' : 'No Shuffle'}</span>
            </button>
          </div>

          {/* Group 2: Mana */}
          <div className="px-8 py-2 border-r border-white/5 flex gap-10">
            <PropInput label="Mana Max" value={data.mana_max} colorClass="text-cyan-400" onChange={v => updateWand(slot, { mana_max: v })} />
            <PropInput label="Recharge" value={data.mana_charge_speed} colorClass="text-cyan-400" onChange={v => updateWand(slot, { mana_charge_speed: v })} />
          </div>

          {/* Group 3: Timing */}
          <div className="px-8 py-2 border-r border-white/5 flex gap-10">
            {renderTimeInput("Cast Delay", data.fire_rate_wait, "fire_rate_wait")}
            {renderTimeInput("Rechg. Time", data.reload_time, "reload_time")}
          </div>

          {/* Group 4: Specs */}
          <div className="px-8 py-2 flex gap-10">
            <PropInput label="Capacity" value={data.deck_capacity} onChange={v => updateWand(slot, { deck_capacity: v })} />
            <PropInput label="Spread" value={data.spread_degrees} colorClass={data.spread_degrees <= 0 ? 'text-emerald-400' : 'text-red-400'} onChange={v => updateWand(slot, { spread_degrees: v })} />
            <PropInput label="Spells/Cast" value={data.actions_per_round} onChange={v => updateWand(slot, { actions_per_round: Math.max(1, Math.round(v)) })} />
            <PropInput label="Speed" value={data.speed_multiplier} colorClass="text-indigo-400" onChange={v => updateWand(slot, { speed_multiplier: v })} />
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 h-fit export-ignore">
          <div className="flex items-center bg-white/[0.02] border border-white/5 rounded-lg overflow-hidden">
            <button 
              onClick={() => handleExportImage('only_spells')}
              className="flex items-center gap-2 px-3 py-2 hover:bg-white/5 text-zinc-400 border-r border-white/5 text-[10px] font-black uppercase tracking-widest transition-all"
              title={t('settings.export_only_spells')}
            >
              <ImageIcon size={14} className="opacity-70" />
              <span className="hidden sm:inline">{t('settings.export_only_spells')}</span>
            </button>
            <button 
              onClick={() => handleExportImage('full')}
              className="flex items-center gap-2 px-3 py-2 hover:bg-white/5 text-zinc-400 text-[10px] font-black uppercase tracking-widest transition-all"
              title={t('settings.export_wand_and_spells')}
            >
              <Camera size={14} className="opacity-70" />
              <span className="hidden sm:inline">{t('settings.export_wand_and_spells')}</span>
            </button>
          </div>
          <button 
            onClick={() => requestEvaluation(data, true)}
            className="flex items-center gap-2 px-3 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
            title={t('evaluator.force_analyze_desc')}
          >
            <RefreshCw size={12} className="opacity-70" />
            {t('evaluator.force_analyze')}
          </button>
        </div>
      </div>

      <div ref={spellsRef} className="space-y-8">
        {Array.isArray(data.always_cast) && data.always_cast.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-amber-500/30 to-transparent" />
            <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.3em]">Always Cast Slots</span>
            <div className="h-px flex-1 bg-gradient-to-l from-amber-500/30 to-transparent" />
          </div>
          <div className="flex flex-wrap gap-3">
            {data.always_cast.map((sid, i) => {
              const spell = spellDb[sid];
              const displayName = spell ? (i18n.language.startsWith('en') && spell.en_name ? spell.en_name : spell.name) : sid;
              const acIdx = -(i + 1);
              const isHovered = hoveredSlot?.wandSlot === slot && hoveredSlot?.idx === acIdx;

              return (
                <div 
                  key={i} 
                  className="group/ac relative"
                  onMouseDown={(e) => handleSlotMouseDown(slot, acIdx, e.button === 2)}
                  onMouseUp={() => handleSlotMouseUp(slot, acIdx)}
                  onMouseMove={(e) => handleSlotMouseMove(e, slot, acIdx)}
                  onMouseLeave={handleSlotMouseLeave}
                  onClick={(e) => {
                    if (e.altKey) {
                      const newAC = [...data.always_cast];
                      newAC.splice(i, 1);
                      updateWand(slot, { always_cast: newAC }, "删除始终施放法术");
                      return;
                    }
                    openPicker(slot, `ac-${i}`, e);
                  }}
                >
                  <div className={`
                    w-12 h-12 rounded-lg border flex items-center justify-center relative shadow-[0_0_15px_rgba(245,158,11,0.1)] transition-transform hover:scale-105
                    ${isHovered ? 'border-indigo-500 bg-indigo-500/20' : 'border-amber-500/30 bg-amber-500/5'}
                  `}>
                    {isHovered && (
                      <div 
                        className="absolute top-0 bottom-0 w-1 bg-indigo-400 z-50 animate-pulse rounded-full" 
                        style={{ [hoveredSlot.isRightHalf ? 'right' : 'left']: `-6px` }}
                      />
                    )}
                    {spell ? (
                      <img 
                        src={getIconUrl(spell.icon, isConnected)} 
                        className="w-10 h-10 image-pixelated" 
                        alt="" 
                        title={`Always Cast: ${displayName}\nID: ${sid}\n(Alt+Click to remove)`}
                      />
                    ) : (
                      <span className="text-amber-500/20 text-xs">?</span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const newAC = [...data.always_cast];
                        newAC.splice(i, 1);
                        updateWand(slot, { always_cast: newAC });
                      }}
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover/ac:opacity-100 transition-opacity z-10 shadow-lg"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="max-h-[600px] overflow-y-auto custom-scrollbar p-1 select-none">
        <div 
          className="grid gap-0"
          style={{ 
            gridTemplateColumns: `repeat(auto-fill, minmax(${56 + (settings.editorSpellGap || 0)}px, 1fr))` 
          }}
        >
          {Array.from({ length: Math.max(data.deck_capacity, 24) }).map((_, i) => {
            const idx = (i + 1).toString();
            const sid = data.spells ? data.spells[idx] : null;
            const spell = sid ? spellDb[sid] : null;
            const uses = (data.spell_uses || {})[idx] ?? spell?.max_uses;
            const isLocked = i >= data.deck_capacity;
            const isSelected = selection?.wandSlot === slot && selection.indices.includes(i + 1);
            const isHovered = hoveredSlot?.wandSlot === slot && hoveredSlot?.idx === (i + 1);
            const gap = settings.editorSpellGap || 0;

            return (
              <div
                key={i}
                className="aspect-square relative"
                style={{ padding: `${gap / 2}px` }}
                onMouseMove={(e) => !isLocked && handleSlotMouseMove(e, slot, i + 1)}
                onMouseLeave={handleSlotMouseLeave}
              >
                <div
                  onMouseDown={(e) => {
                    if (!isLocked) {
                      if (e.button === 1 && spell) {
                        e.preventDefault();
                        e.stopPropagation();
                        const marked = Array.isArray(data.marked_slots) ? data.marked_slots : [];
                        const slotIdx = i + 1; // Align with 1-based index used by simulator
                        const newMarked = marked.includes(slotIdx)
                          ? marked.filter(m => m !== slotIdx)
                          : [...marked, slotIdx];
                        updateWand(slot, { marked_slots: newMarked });
                        return;
                      }
                      e.preventDefault();
                      handleSlotMouseDown(slot, i + 1, e.button === 2);
                    }
                  }}
                  onMouseUp={(e) => {
                    if (!isLocked) {
                      handleSlotMouseUp(slot, i + 1);
                    }
                  }}
                  onContextMenu={(e) => {
                    // Prevent context menu on spells to allow right-click drag
                    if (spell) e.preventDefault();
                  }}
                  onMouseEnter={() => !isLocked && handleSlotMouseEnter(slot, i + 1)}
                  onClick={(e) => {
                    if (e.altKey && spell) {
                      e.preventDefault();
                      e.stopPropagation();
                      
                      // Special handling for condition spells
                      if (sid === 'IF_HP' || sid === 'IF_PROJECTILE' || sid === 'IF_ENEMY') {
                        setSettings(prev => {
                          const next = { ...prev };
                          if (sid === 'IF_HP') next.simulateLowHp = !prev.simulateLowHp;
                          if (sid === 'IF_PROJECTILE') next.simulateManyProjectiles = !prev.simulateManyProjectiles;
                          if (sid === 'IF_ENEMY') next.simulateManyEnemies = !prev.simulateManyEnemies;
                          return next;
                        });
                        return;
                      }

                      const newUses = uses === 0 ? (spell.max_uses ?? -1) : 0;
                      const newSpellUses = { ...(data.spell_uses || {}), [idx]: newUses };
                      const actionName = newUses === 0 ? t('app.notification.set_charges_0') : t('app.notification.restore_charges');
                      updateWand(slot, { spell_uses: newSpellUses }, actionName);
                      return;
                    }
                    if (selection && selection.indices.length > 1) {
                      setSelection(null);
                    } else {
                      !isLocked && openPicker(slot, idx, e);
                    }
                  }}
                  className={`
                      w-full h-full rounded-lg border flex items-center justify-center relative group/cell transition-all active:scale-95
                      ${isLocked ? 'bg-black/40 border-transparent opacity-10' : 'bg-zinc-800/80 border-white/5 hover:border-indigo-500/50 cursor-pointer shadow-inner hover:bg-zinc-700/80'}
                      ${isSelected ? 'ring-2 ring-indigo-500 ring-inset bg-indigo-500/20 border-indigo-400/50 z-10' : ''}
                    `}
                >
                  {isHovered && (
                    <div 
                      className="absolute top-0 bottom-0 w-1 bg-indigo-400 z-50 animate-pulse rounded-full" 
                      style={{ [hoveredSlot.isRightHalf ? 'right' : 'left']: `-${gap / 2 + 2}px` }}
                    />
                  )}
                  {spell ? (
                    <div className="relative w-full h-full flex items-center justify-center pointer-events-none">
                      {/* Check if condition is active */}
                      {(() => {
                        const isTriggered = (sid === 'IF_HP' && settings.simulateLowHp) || 
                                           (sid === 'IF_PROJECTILE' && settings.simulateManyProjectiles) ||
                                           (sid === 'IF_ENEMY' && settings.simulateManyEnemies);
                        const isGrayscale = (uses === 0) || isTriggered;
                        const isMarked = Array.isArray(data.marked_slots) && data.marked_slots.includes(i + 1);
                        
                        return (
                          <>
                            <img src={getIconUrl(spell.icon, isConnected)} className={`w-11 h-11 image-pixelated transition-transform group-hover/cell:scale-110 ${isGrayscale ? 'grayscale opacity-50' : ''}`} alt="" draggable="false" />
                            
                            {isMarked && (
                              <div className="absolute inset-0 border-2 border-amber-500 rounded-lg shadow-[0_0_10px_rgba(245,158,11,0.5)] z-10 pointer-events-none" />
                            )}
                            
                            {isTriggered && (
                              <div className="absolute bottom-0 left-0">
                                <svg width="12" height="12" viewBox="0 0 12 12" className="drop-shadow-[0_0_2px_rgba(239,68,68,0.8)]">
                                  <path d="M0 12 L12 12 L0 0 Z" fill="rgb(239, 68, 68)" />
                                </svg>
                              </div>
                            )}

                            {uses !== undefined && (settings.showSpellCharges || uses === 0) && uses !== -1 && !isTriggered && (
                              <div 
                                className={`absolute bottom-0 left-0 px-1.5 py-0.5 bg-black/90 text-[10px] font-mono font-black border-tr border-white/10 rounded-tr pointer-events-auto cursor-pointer select-none z-20 shadow-lg ${uses === 0 ? 'text-red-500' : 'text-amber-400'}`}
                                title="点击修改次数 (Alt+点击设为0, 再点击还原)"
                                onClick={(e) => {
                                   e.stopPropagation();
                                   const newUses = uses === 0 ? (spell.max_uses ?? 10) : 0;
                                   const newSpellUses = { ...(data.spell_uses || {}), [idx]: newUses };
                                   updateWand(slot, { spell_uses: newSpellUses });
                                }}
                              >
                                {uses}
                              </div>
                            )}
                          </>
                        );
                      })()}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const newSpells = { ...(data.spells || {}) };
                          const newSpellUses = { ...(data.spell_uses || {}) };
                          delete newSpells[idx];
                          delete newSpellUses[idx];
                          updateWand(slot, { spells: newSpells, spell_uses: newSpellUses });
                        }}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity z-10 pointer-events-auto shadow-lg"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : !isLocked && (
                    <span className="text-zinc-800 text-2xl font-thin opacity-50">+</span>
                  )}
                  {!isLocked && absoluteToOrdinal[i + 1] && (
                    <div className={`
                      absolute bottom-1 right-1 text-[10px] font-black transition-all duration-200 pointer-events-none
                      ${(isAltPressed || settings.showIndices) ? 'text-cyan-400 scale-110 drop-shadow-[0_0_2px_rgba(0,0,0,0.8)]' : 'text-white/5'}
                    `}>
                      {absoluteToOrdinal[i + 1]}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  </div>
);
}
