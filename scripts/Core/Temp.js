// ============================================
// 季节与温度系统 2026.10.1
// ============================================
import { world, system } from '@minecraft/server';
import { batchP, Pitem, getAllP, roomHeatMap, checkGameMode } from '../Shares/Config_Common.js';
import { onFatigueCollapse } from './Player_Basic.js';
// ============================================
// 缓存
// ============================================
const tempCache = new Map();//温度缓存

// ============================================
// 变量
// ============================================
const SEASON_DAYS = { 1: 15, 2: 25, 3: 15, 4: 25 };
const SEASON_TEMP = { 1: 15, 2: 28, 3: 15, 4: 2 };

export let currentSeason = 1;
let cachedWeatherDrop = 0;
let lastDay = -1;
let lastWeatherChangeHour = -1;
export let currentWeather = 'Clear';
const WEATHER_TABLE = {
    2: [
        { max: 0.5,  weather: 'Clear',   name: '晴天' },
        { max: 0.8,  weather: 'Rain',    name: '下雨' },
        { max: 1.0,  weather: 'Thunder', name: '雷暴' }
    ],
    4: [
        { max: 0.4,  weather: 'Clear',   name: '晴天' },
        { max: 0.75, weather: 'Rain',    name: '下雨' },
        { max: 1.0,  weather: 'Snow',    name: '下雪' }
    ],
    default: [
        { max: 0.5,  weather: 'Clear',   name: '晴天' },
        { max: 0.85, weather: 'Rain',    name: '下雨' },
        { max: 1.0,  weather: 'Thunder', name: '雷暴' }
    ]
};
const WEATHER_DROP = {
    2: { Rain: () => Math.random() < 0.6 ? 5 : 8 },
    4: { Rain: () => Math.random() < 0.7 ? 5 : 3, Snow: () => 3 },
    default: { Rain: () => 3 }
};


//初始化温度
system.runTimeout(() => {
    updateAllPlayersTemp();
}, 1);

//温度更新 + 睡眠检测
system.runInterval(() => {
    const day = world.getDay();
    const time = world.getTimeOfDay();
    const currentHour = Math.floor(time / 1000);

    // ===== 跨天：季节 / 天气 / 睡眠 =====
    if (day !== lastDay) {
        lastDay = day;
        updateSeason(day);
        changeWeather();
        lastWeatherChangeHour = currentHour;
        checkPlayerSleep();
    }
    // ===== 每 6 小时：换天气 =====
    else if (currentHour !== lastWeatherChangeHour && currentHour % 6 === 0) {
        lastWeatherChangeHour = currentHour;
        changeWeather();
    }

    updateAllPlayersTemp();
}, 20);

// ============================================
// 函数
// ============================================

//A0 睡眠检测
function checkPlayerSleep() {
    for (const P of getAllP()) {
        if (checkGameMode(P)) continue;

        let stage = 'none';
        if (P.hasTag('sleep_normal')) stage = 'normal';
        else if (P.hasTag('sleep_overdue')) stage = 'overdue';
        else if (P.hasTag('sleep_exhausted')) stage = 'exhausted';
        else if (P.hasTag('sleep_tired')) stage = 'tired';

        stage === 'normal' ? null
            : stage === 'overdue' ? (onFatigueCollapse(P), P.removeTag('sleep_overdue'), P.addTag('sleep_normal'))
                : stage === 'exhausted' ? (P.removeTag('sleep_exhausted'), P.addTag('sleep_overdue'))
                    : stage === 'tired' ? (P.removeTag('sleep_tired'), P.addTag('sleep_exhausted'))
                        : P.addTag('sleep_tired');
    }
}

//A1昼夜气温变化
function getSmoothTemperature(time) {
    const key = time % 24000;
    if (tempCache.has(key)) return tempCache.get(key);

    const points = [
        [0, -2], [6000, 10], [12000, 10],
        [18000, -8], [21000, -8], [24000, -2]
    ];

    let result = -2;
    for (let i = 0; i < points.length - 1; i++) {
        const [t1, v1] = points[i];
        const [t2, v2] = points[i + 1];

        if (key >= t1 && key <= t2) {
            const t = (key - t1) / (t2 - t1);
            result = Math.round((v1 + (v2 - v1) * t) * 10) / 10;
            break;
        }
    }

    tempCache.set(key, result);
    return result;
}

//A2季节变化
function updateSeason(day) {
    const yearLength = SEASON_DAYS[1] + SEASON_DAYS[2] + SEASON_DAYS[3] + SEASON_DAYS[4];
    const cycleDay = day % yearLength;

    let total = 0;
    for (let s = 1; s <= 4; s++) {
        total += SEASON_DAYS[s];
        if (cycleDay < total) {
            if (currentSeason !== s) {
                currentSeason = s;
                return true;
            }
            return false;
        }
    }
    return false;
}

//A3天气变化
function changeWeather() {
    if (Math.random() < 0.3) return;

    const table = WEATHER_TABLE[currentSeason] ?? WEATHER_TABLE.default;
    const rand = Math.random();
    const entry = table.find(e => rand < e.max);

    currentWeather = entry.weather;
    updateWeatherDropCache();
    world.sendMessage(`§a[天气系统] §f天气变化: ${entry.name}`);
    updateAllPlayersTemp();
}

//A3.5 外部设置天气[debug]
export function setWeather(weather) {
    currentWeather = weather;
    updateWeatherDropCache();
    updateAllPlayersTemp();
}

//A4环境影响
function getPlayerHeatModifier(P, weatherDrop) {
    let modifier = 0;

    if (P.isInWater) modifier -= 10;

    const handItem = Pitem(P);
    if (handItem?.typeId === 'a:wooden_torch_lit') modifier += 5;

    modifier += roomHeatMap.get(P.id) || 0;
    modifier -= weatherDrop;

    return modifier;
}

//B1更新温度
function updateAllPlayersTemp() {
    const players = getAllP();
    const time = world.getTimeOfDay();
    const timeTemp = getSmoothTemperature(time);
    const baseTemp = SEASON_TEMP[currentSeason] + timeTemp;
    const weatherDrop = cachedWeatherDrop;

    for (const P of players) {
        const heatModifier = getPlayerHeatModifier(P, weatherDrop);
        let finalTemp = Math.round((baseTemp + heatModifier) * 10) / 10;
        finalTemp = Math.min(finalTemp, 40);

        batchP(P, [
            ['setProp', 'temperature', finalTemp],
            ['setProp', 'season', currentSeason]
        ]);
    }
}
//天气温度缓存
function updateWeatherDropCache() {
    const season = WEATHER_DROP[currentSeason] ?? WEATHER_DROP.default;
    const fn = season[currentWeather];
    cachedWeatherDrop = fn ? fn() : 0;
}

updateWeatherDropCache();