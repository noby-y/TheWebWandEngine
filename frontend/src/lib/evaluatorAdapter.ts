import { WandData, EvalResponse } from '../types';

let worker: Worker | null = null;
let lastRequestId = 0;

/**
 * 获取图标路径
 */
export function getIconUrl(iconPath: string, isConnected: boolean): string {
  const isStaticMode = (import.meta as any).env?.VITE_STATIC_MODE === 'true';
  // 如果是离线静态模式，或者后端没连接（且没开启 API），使用本地静态资源
  if (isStaticMode) {
    return `./static_data/icons/${iconPath}`;
  }
  // 否则尝试调用后端 API
  return `/api/icon/${iconPath}`;
}

/**
 * 魔杖评估适配器
 * 自动在 后端API 和 本地WASM引擎 之间切换
 */
export async function evaluateWand(
  wand: WandData, 
  settings: any, 
  isConnected: boolean,
  force: boolean = false
): Promise<{ data: EvalResponse, id: number } | null> {
  
  // 模式 A: 只有在非静态模式时尝试使用 API
  const isStaticMode = (import.meta as any).env?.VITE_STATIC_MODE === 'true';
  
  if (!isStaticMode) {
    // API mode doesn't really support 'force' cancellation in the same way,
    // but we can still use IDs to ignore stale responses.
    const requestId = ++lastRequestId;
    try {
      const spells: string[] = [];
      for (let i = 1; i <= wand.deck_capacity; i++) {
        spells.push(wand.spells[i.toString()] || "");
      }

      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // ... (same as before)
          mana_max: wand.mana_max,
          mana_charge_speed: wand.mana_charge_speed,
          reload_time: wand.reload_time,
          fire_rate_wait: wand.fire_rate_wait,
          deck_capacity: wand.deck_capacity,
          shuffle_deck_when_empty: wand.shuffle_deck_when_empty,
          spread_degrees: wand.spread_degrees,
          speed_multiplier: wand.speed_multiplier,
          actions_per_round: wand.actions_per_round,
          spells: spells,
          spell_uses: wand.spell_uses || {},
          always_cast: wand.always_cast || [],
          number_of_casts: settings.numCasts || 3,
          unlimited_spells: settings.unlimitedSpells,
          initial_if_half: settings.initialIfHalf,
          simulate_low_hp: settings.simulateLowHp,
          simulate_many_enemies: settings.simulateManyEnemies,
          simulate_many_projectiles: settings.simulateManyProjectiles,
          fold_nodes: settings.foldNodes
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.success) return { data: data.data, id: requestId };
      }
    } catch (e) {}
  }

  // 模式 B: 使用 Web Worker + Lua WASM
  if (force && worker) {
    worker.terminate();
    worker = null;
  }

  const requestId = ++lastRequestId;

  return new Promise((resolve, reject) => {
    if (!worker) {
      worker = new Worker(new URL('./evaluator.worker.ts', import.meta.url), {
        type: 'module'
      });
    }

    const handler = (e: MessageEvent) => {
      if (e.data.id !== requestId) return; // Ignore stale results

      if (e.data.type === 'RESULT') {
        worker?.removeEventListener('message', handler);
        resolve({ data: e.data.data, id: requestId });
      } else if (e.data.type === 'ERROR') {
        worker?.removeEventListener('message', handler);
        reject(e.data.error);
      }
    };

    worker.addEventListener('message', handler);
    worker.postMessage({ type: 'EVALUATE', data: wand, options: settings, id: requestId });
  });
}
