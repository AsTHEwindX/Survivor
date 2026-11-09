// ============================================
// 调试系统2026.9.30
// ============================================
import { system } from '@minecraft/server';
import { batchP, roomHeatMap } from './Config_Common.js';
import { PlayerDie } from '../Core/Player_Basic.js';
import { setWeather } from '../Core/Temp.js';

// ============================================
// 变量
// ============================================
const AVAILABLE_PROPS = [
    'health', 'health2', 'thirst', 'hunger', 'infected_ticks', 'immunity_ticks', 'armor', 'a:kill_count'
];
// ============================================
// 事件驱动
// ============================================

const CMD = { permissionLevel: 1, cheatsRequired: false };

const runCmd = (o, fn) => {
    const p = o.sourceEntity;
    if (p) system.run(() => fn(p));
};

system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {

    // ========== tp ==========
    customCommandRegistry.registerCommand(
        {
            name: "cmd:t",
            description: "传送到坐标",
            ...CMD,
            mandatoryParameters: [
                { name: "cmd:x", type: "Float" },
                { name: "cmd:y", type: "Float" },
                { name: "cmd:z", type: "Float" }
            ]
        },
        (o) => runCmd(o, (p) => {
            const x = o.params["cmd:x"];
            const y = o.params["cmd:y"];
            const z = o.params["cmd:z"];

            batchP(p, [['msg', `§e[CMD] 3秒后传送到 ${x} ${y} ${z}`]]);
            system.runTimeout(() => {
                if (!p.isValid) return;
                p.teleport({ x, y, z });
                batchP(p, [['msg', `§a[CMD] 已传送到 ${x} ${y} ${z}`]]);
                system.runTimeout(() => {
                    roomHeatMap.delete(p.id);
                }, 1);
            }, 60);
        })
    );

    // ========== prop ==========
    customCommandRegistry.registerCommand(
        {
            name: "cmd:prop",
            description: "设置属性 (例: /cmd:prop health 50)",
            ...CMD,
            mandatoryParameters: [
                { name: "cmd:key", type: "String" },
                { name: "cmd:value", type: "Float" }
            ]
        },
        (o, key, value) => runCmd(o, (p) => {
            // 最原汁原味的写法，直接接参数
            if (!key || value === undefined) {
                return batchP(p, [['msg', `§c[CMD] 用法: /cmd:prop <属性> <数值>`]]);
            }

            // 把 key 强制转为纯文本字符串
            const propKey = String(key);

            if (!AVAILABLE_PROPS.includes(propKey)) {
                batchP(p, [['msg', `§c[CMD] 未知属性: ${propKey}\n§7可用属性: ${AVAILABLE_PROPS.join(', ')}`]]);
                return;
            }

            batchP(p, [
                ['setProp', propKey, value],
                ['msg', `§a[CMD] 已设置 ${propKey} = ${value}`]
            ]);
        })
    );

    // ========== kill ==========
    customCommandRegistry.registerCommand(
        { name: "cmd:dead", description: "3秒后自杀", ...CMD },
        (o) => runCmd(o, (p) => {
            batchP(p, [['msg', "§e[CMD] 3秒后执行自杀"]]);
            system.runTimeout(() => {
                if (!p.isValid) return;
                PlayerDie(p);
                batchP(p, [['msg', "§c[CMD] 已执行自杀"]]);
            }, 60);
        })
    );

    // ========== weather ==========
    customCommandRegistry.registerCommand(
        { name: "cmd:weather_clear", description: "设置为晴天", ...CMD },
        (o) => runCmd(o, (p) => {
            setWeather('Clear');
            batchP(p, [['msg', "§a[CMD] 已设置天气为晴天"]]);
        })
    );

    customCommandRegistry.registerCommand(
        { name: "cmd:weather_rain", description: "设置为下雨", ...CMD },
        (o) => runCmd(o, (p) => {
            setWeather('Rain');
            batchP(p, [['msg', "§a[CMD] 已设置天气为下雨"]]);
        })
    );

    customCommandRegistry.registerCommand(
        { name: "cmd:weather_thunder", description: "设置为雷暴", ...CMD },
        (o) => runCmd(o, (p) => {
            setWeather('Thunder');
            batchP(p, [['msg', "§a[CMD] 已设置天气为雷暴"]]);
        })
    );

    customCommandRegistry.registerCommand(
        { name: "cmd:weather_snow", description: "设置为下雪", ...CMD },
        (o) => runCmd(o, (p) => {
            setWeather('Snow');
            batchP(p, [['msg', "§a[CMD] 已设置天气为下雪"]]);
        })
    );
});