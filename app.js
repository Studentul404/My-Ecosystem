
// Іконки Lucide
lucide.createIcons();

// Глобальні змінні стану
let isRunning = false;
let logs = [];
let logFilter = 'all';
let animationFrameId = null;
let lastUpdateTime = 0;
let activeTab = 'stats';
const FIXED_TIMESTEP = 16; // ~60 FPS
const MAX_UPDATES_PER_FRAME = 5;

// Клас GeneticProfile
class GeneticProfile {
    constructor() {
        // Гени швидкості (Mendelian: S - домінантний, s - рецесивний)
        this.speedAlleles = ['S', 's'];
        this.genotype = this.getRandomSpeedGenotype();
        this.phenotype = this.calculateSpeedPhenotype();

        // Гени кольору (Mendelian: W - білий домінантний, w - чорний рецесивний)
        this.colorAlleles = ['W', 'w'];
        this.colorGenotype = this.getRandomColorGenotype();
        this.colorPhenotype = this.calculateColorPhenotype();

        // Імунність
        this.isImmune = false;
        this.immunityTimer = 0;
        this.immuneToDiseases = new Set();
        this.fertilityPenalty = 0;
    }

    getRandomSpeedGenotype() {
        return [
            Math.random() < settings.initialSpeedAlleleFreq ? 'S' : 's',
            Math.random() < settings.initialSpeedAlleleFreq ? 'S' : 's'
        ];
    }

    calculateSpeedPhenotype() {
        // SS або Ss - висока швидкість, ss - низька
        const hasDominant = this.genotype.includes('S');
        return hasDominant ?
            settings.geneticDominance['S'] + (Math.random() * 0.5 - 0.25) :
            settings.geneticDominance['s'] + (Math.random() * 0.3 - 0.15);
    }

    getRandomColorGenotype() {
        const alleleWChance = settings.initialColorAlleleFreq;
        return [
            Math.random() < alleleWChance ? 'W' : 'w',
            Math.random() < alleleWChance ? 'W' : 'w'
        ];
    }

    calculateColorPhenotype() {
        // WW або Ww - білий колір, ww - чорний колір
        const hasDominant = this.colorGenotype.includes('W');
        return hasDominant ? 'white' : 'black';
    }

    static inheritGenotype(parent1, parent2) {
        // Решітка Пеннета для успадкування
        const allele1 = parent1.genetic.genotype[Math.floor(Math.random() * 2)];
        const allele2 = parent2.genetic.genotype[Math.floor(Math.random() * 2)];

        const offspring = new GeneticProfile();
        offspring.genotype = [allele1, allele2];
        offspring.phenotype = offspring.calculateSpeedPhenotype();

        // Успадкування кольору
        const colorAllele1 = parent1.genetic.colorGenotype[Math.floor(Math.random() * 2)];
        const colorAllele2 = parent2.genetic.colorGenotype[Math.floor(Math.random() * 2)];
        offspring.colorGenotype = [colorAllele1, colorAllele2];
        offspring.colorPhenotype = offspring.calculateColorPhenotype();

        // Успадкування імунітету (якщо обидва батьки імунні до тієї ж хвороби)
        if (parent1.genetic.isImmune && parent2.genetic.isImmune) {
            const commonImmunities = new Set(
                [...parent1.genetic.immuneToDiseases]
                    .filter(x => parent2.genetic.immuneToDiseases.has(x))
            );
            if (commonImmunities.size > 0) {
                offspring.isImmune = true;
                offspring.immuneToDiseases = commonImmunities;
                offspring.immunityTimer = settings.immunityDuration;

                // Плата за імунітет - підвищений шанс безпліддя
                offspring.fertilityPenalty = settings.immunityInfertilityBoost;
            }
        }

        return offspring;
    }
}

// Налаштування симуляції
const settings = {
    plantGrowthRate: 20,
    plantSpread: 150,
    initialRabbits: 15,
    initialFoxes: 3,
    timeScale: 1,
    rabbitMaxAge: 900,
    foxMaxAge: 2000,
    rabbitReproductiveAge: 30,
    foxReproductiveAge: 60,
    rabbitHungerRate: 0.08,
    foxHungerRate: 0.09,
    thirstRate: 0.01,
    reproductionChanceRabbit: 70,
    reproductionChanceFox: 80,
    maxRabbits: 300,
    maxFoxes: 50,
    mutationChance: 0.08,
    enableMutations: true,
    gestationPeriod: 10,
    childhoodDuration: 100,
    limitPregnancies: false,
    plantDestructionChance: 0.5,
    infertilityChance: 0.02,
    diseaseChance: 0.003,
    enableDiseases: true,
    diseaseSpreadRadius: 10,
    diseaseEffect: 0.5,
    waterAvoidanceRadius: 30,
    enableWaterAvoidance: true,
    enablePlantRegrowth: true,
    minSpeed: 0.5,
    maxSpeed: 2.5,

    // Генетичні параметри
    geneticDominance: { 'S': 1.5, 's': 0.7 },
    mendelianInheritance: true,
    initialSpeedAlleleFreq: 0.5,
    initialColorAlleleFreq: 0.5,

    // Параметри хвороби
    diseaseTransmissionRate: 0.3,
    diseaseReproductionPenalty: 0.8,
    immunityInfertilityBoost: 0.15,
    diseaseDuration: 200,
    immunityDuration: 1000,

    // Динаміка популяції
    criticalPopulationThreshold: 5,
    populationRecoveryBoost: 3.0,
    enablePopulationRecovery: true,

    // Поведінка
    edgeAvoidanceRadius: 30,
    tigmotaxisChance: 0.01,
};

// Об'єкт світу
const world = {
    water: [],
    plants: [],
    rabbits: [],
    foxes: [],
    time: 0,
    generation: 0,
    destroyedPlants: 0,
    stats: {
        totalBirths: 0,
        totalDeaths: 0,
        totalKills: 0,
        diseaseDeaths: 0
    }
};

// Історія популяцій для графіка
const populationHistory = [];
const MAX_HISTORY = 100;

// DOM елементи
const canvas = document.getElementById('simulationCanvas');
const ctx = canvas.getContext('2d');
const toggleBtn = document.getElementById('toggleBtn');
const resetBtn = document.getElementById('resetBtn');
const exportBtn = document.getElementById('exportBtn');
const helpBtn = document.getElementById('helpBtn');
const helpModal = document.getElementById('helpModal');
const closeModal = document.querySelector('.close-modal');
const clearLogsBtn = document.getElementById('clearLogsBtn');
const logFilterSelect = document.getElementById('logFilter');
const logsContainer = document.getElementById('logsContainer');
const speedIndicator = document.getElementById('speedIndicator');

// Основні бейджі
const rabbitsBadge = document.getElementById('rabbitsBadge');
const foxesBadge = document.getElementById('foxesBadge');
const plantsBadge = document.getElementById('plantsBadge');
const generationBadge = document.getElementById('generationBadge');

// Статистика
const whiteRabbitsCount = document.getElementById('whiteRabbitsCount');
const blackRabbitsCount = document.getElementById('blackRabbitsCount');
const heterozygousRabbitsCount = document.getElementById('heterozygousRabbitsCount');
const avgRabbitSpeed = document.getElementById('avgRabbitSpeed');
const avgRabbitAge = document.getElementById('avgRabbitAge');
const avgFoxSpeed = document.getElementById('avgFoxSpeed');
const pregnantRabbitsCount = document.getElementById('pregnantRabbitsCount');
const childRabbitsCount = document.getElementById('childRabbitsCount');
const sickRabbitsCount = document.getElementById('sickRabbitsCount');
const totalBirths = document.getElementById('totalBirths');
const totalDeaths = document.getElementById('totalDeaths');
const totalKills = document.getElementById('totalKills');
const infertileRabbitsCount = document.getElementById('infertileRabbitsCount');
const infertileFoxesCount = document.getElementById('infertileFoxesCount');

// Генетичні дані
const mutationFrequency = document.getElementById('mutationFrequency');
const avgSpeedAll = document.getElementById('avgSpeedAll');
const speedTrend = document.getElementById('speedTrend');
const whitePercentage = document.getElementById('whitePercentage');
const blackPercentage = document.getElementById('blackPercentage');
const heterozygousPercentage = document.getElementById('heterozygousPercentage');
const fertilityRate = document.getElementById('fertilityRate');
const ssDominantCount = document.getElementById('ssDominantCount');
const ssHeteroCount = document.getElementById('ssHeteroCount');
const ssRecessiveCount = document.getElementById('ssRecessiveCount');
const wwDominantCount = document.getElementById('wwDominantCount');
const wwHeteroCount = document.getElementById('wwHeteroCount');
const wwRecessiveCount = document.getElementById('wwRecessiveCount');

// Графік
const chartCanvas = document.getElementById('populationChart');
const chartCtx = chartCanvas.getContext('2d');

// Налаштування
const timeScaleSlider = document.getElementById('timeScale');
const timeScaleValue = document.getElementById('timeScaleValue');
const initialRabbitsSlider = document.getElementById('initialRabbits');
const initialRabbitsValue = document.getElementById('initialRabbitsValue');
const initialFoxesSlider = document.getElementById('initialFoxes');
const initialFoxesValue = document.getElementById('initialFoxesValue');
const rabbitHungerRateSlider = document.getElementById('rabbitHungerRate');
const rabbitHungerRateValue = document.getElementById('rabbitHungerRateValue');
const diseaseChanceSlider = document.getElementById('diseaseChance');
const diseaseChanceValue = document.getElementById('diseaseChanceValue');
const mutationChanceSlider = document.getElementById('mutationChance');
const mutationChanceValue = document.getElementById('mutationChanceValue');
const plantGrowthRateSlider = document.getElementById('plantGrowthRate');
const plantGrowthRateValue = document.getElementById('plantGrowthRateValue');
const reproductionChanceRabbitSlider = document.getElementById('reproductionChanceRabbit');
const reproductionChanceRabbitValue = document.getElementById('reproductionChanceRabbitValue');
const reproductionChanceFoxSlider = document.getElementById('reproductionChanceFox');
const reproductionChanceFoxValue = document.getElementById('reproductionChanceFoxValue');
const initialSpeedAlleleFreqSlider = document.getElementById('initialSpeedAlleleFreq');
const initialSpeedAlleleFreqValue = document.getElementById('initialSpeedAlleleFreqValue');
const initialColorAlleleFreqSlider = document.getElementById('initialColorAlleleFreq');
const initialColorAlleleFreqValue = document.getElementById('initialColorAlleleFreqValue');

// НОВІ ЕЛЕМЕНТИ КЕРУВАННЯ
const rabbitMaxAgeSlider = document.getElementById('rabbitMaxAge');
const rabbitMaxAgeValue = document.getElementById('rabbitMaxAgeValue');
const foxMaxAgeSlider = document.getElementById('foxMaxAge');
const foxMaxAgeValue = document.getElementById('foxMaxAgeValue');
const childhoodDurationSlider = document.getElementById('childhoodDuration');
const childhoodDurationValue = document.getElementById('childhoodDurationValue');
const gestationPeriodSlider = document.getElementById('gestationPeriod');
const gestationPeriodValue = document.getElementById('gestationPeriodValue');
const limitPregnanciesCheckbox = document.getElementById('limitPregnancies');

const enableMutationsCheckbox = document.getElementById('enableMutations');
const enableDiseasesCheckbox = document.getElementById('enableDiseases');
const enableWaterAvoidanceCheckbox = document.getElementById('enableWaterAvoidance');
const enableMendelianInheritanceCheckbox = document.getElementById('enableMendelianInheritance');
const enablePlantRegrowthCheckbox = document.getElementById('enablePlantRegrowth');
const enablePopulationRecoveryCheckbox = document.getElementById('enablePopulationRecovery');

// Вкладки
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

// Ініціалізація вкладок
function initTabs() {
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.dataset.tab;

            // Оновлюємо активну вкладку
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            tabContents.forEach(content => {
                content.classList.remove('active');
            });

            document.getElementById(`${tabId}-tab`).classList.add('active');
            activeTab = tabId;

            // Оновлюємо відображення логів при перемиканні на вкладку
            if (tabId === 'logs') {
                updateLogsDisplay();
            }
        });
    });
}

// Функція додавання запису в журнал
function addLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const id = Date.now() + Math.random();

    const logEntry = {
        id,
        time: timestamp,
        message,
        type
    };

    logs.unshift(logEntry);

    // Обмеження кількості записів
    if (logs.length > 200) {
        logs.pop();
    }

    // Автоматичне приховування системних повідомлень через 5 секунд
    if (type === 'system') {
        setTimeout(() => {
            const index = logs.findIndex(log => log.id === id);
            if (index !== -1) {
                logs.splice(index, 1);
                updateLogsDisplay();
            }
        }, 5000);
    }

    updateLogsDisplay();
}

// Функція оновлення відображення журналу
function updateLogsDisplay() {
    if (activeTab !== 'logs') return;

    const filteredLogs = logFilter === 'all'
        ? logs
        : logs.filter(log => log.type === logFilter);

    if (filteredLogs.length === 0) {
        logsContainer.innerHTML = '<div class="empty-logs">Події з\'являтимуться тут...</div>';
        return;
    }

    let logsHTML = '';

    filteredLogs.forEach(log => {
        let logClass = 'log-info';

        switch (log.type) {
            case 'birth': logClass = 'log-birth'; break;
            case 'death': logClass = 'log-death'; break;
            case 'kill': logClass = 'log-kill'; break;
            case 'warning': logClass = 'log-warning'; break;
            case 'system': logClass = 'log-system'; break;
            case 'mating': logClass = 'log-mating'; break;
            case 'disease': logClass = 'log-disease'; break;
            default: logClass = 'log-info';
        }

        logsHTML += `
                <div class="log-entry ${logClass}">
                    <span class="log-time">[${log.time}]</span>
                    <span>${log.message}</span>
                </div>
            `;
    });

    logsContainer.innerHTML = logsHTML;
}

// Функція очищення журналу
function clearLogs() {
    logs = [];
    updateLogsDisplay();
    addLog('📜 Журнал очищено', 'system');
}

// Перевірка, чи знаходиться точка у воді
function isInWater(x, y) {
    for (const water of world.water) {
        const dx = x - water.x;
        const dy = y - water.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < water.radius) {
            return true;
        }
    }
    return false;
}

// Функція уникання води
function avoidWater(entity) {
    if (!settings.enableWaterAvoidance) return;

    for (const water of world.water) {
        const dx = entity.x - water.x;
        const dy = entity.y - water.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < water.radius + settings.waterAvoidanceRadius) {
            // Відштовхування від води
            const angle = Math.atan2(dy, dx);
            const pushForce = 1 - (distance / (water.radius + settings.waterAvoidanceRadius));

            entity.vx += Math.cos(angle) * pushForce * 0.5;
            entity.vy += Math.sin(angle) * pushForce * 0.5;
        }
    }
}

// Функція для уникнення стін
function avoidWalls(entity) {
    const bufferZone = settings.edgeAvoidanceRadius;
    const turnForce = 0.5;

    // Відштовхування від лівого краю
    if (entity.x < bufferZone) {
        entity.vx += turnForce * (1 - entity.x / bufferZone);
    }

    // Відштовхування від правого краю
    if (entity.x > canvas.width - bufferZone) {
        entity.vx -= turnForce * (1 - (canvas.width - entity.x) / bufferZone);
    }

    // Відштовхування від верхнього краю
    if (entity.y < bufferZone) {
        entity.vy += turnForce * (1 - entity.y / bufferZone);
    }

    // Відштовхування від нижнього краю
    if (entity.y > canvas.height - bufferZone) {
        entity.vy -= turnForce * (1 - (canvas.height - entity.y) / bufferZone);
    }

    // Тігмотаксис: випадковий рух до краю для схованки
    if (Math.random() < settings.tigmotaxisChance && entity.fear > 0.7) {
        const targetEdge = Math.floor(Math.random() * 4);
        switch (targetEdge) {
            case 0: entity.vx -= turnForce * 2; break; // Ліво
            case 1: entity.vx += turnForce * 2; break; // Право
            case 2: entity.vy -= turnForce * 2; break; // Верх
            case 3: entity.vy += turnForce * 2; break; // Низ
        }
    }
}

// Поширення хвороби
function spreadDisease(sickEntity, entities) {
    if (!sickEntity.disease.isSick) return;

    for (const entity of entities) {
        if (entity === sickEntity || entity.disease.isSick) continue;
        if (entity.genetic && entity.genetic.immuneToDiseases &&
            entity.genetic.immuneToDiseases.has(sickEntity.disease.sicknessType)) continue;

        const dx = entity.x - sickEntity.x;
        const dy = entity.y - sickEntity.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < settings.diseaseSpreadRadius && Math.random() < settings.diseaseTransmissionRate) {
            entity.disease.isSick = true;
            entity.disease.sicknessType = sickEntity.disease.sicknessType || 'generic';
            entity.disease.sicknessTimer = 0;
            addLog(`🦠 ${entities === world.rabbits ? 'Кролик' : 'Лиса'} ${entity.id.toString().slice(-3)} заразився`, 'disease');
        }
    }
}

// Генетичні функції
function getOffspringSpeed(parent1Speed, parent2Speed) {
    let newSpeed = (parent1Speed + parent2Speed) / 2;

    if (settings.enableMutations && Math.random() < settings.mutationChance) {
        const mutation = (Math.random() - 0.5) * 0.3;
        newSpeed += mutation;
    }

    newSpeed += (Math.random() - 0.5) * 0.05;
    return Math.max(settings.minSpeed, Math.min(settings.maxSpeed, newSpeed));
}

// Динамічне відновлення трави
function updatePlantEcosystem() {
    if (!settings.enablePlantRegrowth) return;

    // Зростання існуючих рослин
    world.plants.forEach(plant => {
        if (!plant.destroyed) {
            plant.growthTimer++;
            if (plant.growthTimer > settings.plantGrowthRate) {
                // Трава виросла
                plant.growthTimer = 0;
                plant.hasGrass = true;

                // Поширення трави при повному зростанні
                if (plant.hasGrass && Math.random() < 0.00001) {
                    const angle = Math.random() * Math.PI * 2;
                    const distance = 50 + Math.random() * 100;
                    const newX = Math.max(20, Math.min(canvas.width - 20, plant.x + Math.cos(angle) * distance));
                    const newY = Math.max(20, Math.min(canvas.height - 20, plant.y + Math.sin(angle) * distance));

                    // Перевірка, чи не знаходиться нова трава у воді
                    if (!isInWater(newX, newY)) {
                        world.plants.push({
                            x: newX,
                            y: newY,
                            hasGrass: false,
                            growthTimer: 0,
                            id: Date.now() + Math.random(),
                            destroyed: false
                        });
                    }
                }
            }
        } else {
            // Відновлення знищеної трави через час
            plant.recoveryTimer = (plant.recoveryTimer || 0) + 1;
            if (plant.recoveryTimer > 100) { // 100 тиків для відновлення
                plant.destroyed = false;
                plant.hasGrass = false;
                plant.growthTimer = 0;
                plant.recoveryTimer = 0;
            }
        }
    });

    // Автоматичний спавн нової трави
    if (Math.random() < 0.0005 && world.plants.length < 100) {
        spawnNewPlant(
            Math.random() * canvas.width,
            Math.random() * canvas.height
        );
    }
}

function spawnNewPlant(nearX, nearY) {
    const angle = Math.random() * Math.PI * 2;
    const distance = 50 + Math.random() * 100;
    const newX = Math.max(20, Math.min(canvas.width - 20, nearX + Math.cos(angle) * distance));
    const newY = Math.max(20, Math.min(canvas.height - 20, nearY + Math.sin(angle) * distance));

    // Перевірка, чи не знаходиться нова трава у воді
    if (isInWater(newX, newY)) return;

    world.plants.push({
        x: newX,
        y: newY,
        hasGrass: Math.random() > 0.5, // 50% шанс, що трава вже є
        growthTimer: 0,
        id: Date.now() + Math.random(),
        destroyed: false
    });
}

// Оновлення графіка
function updateChart() {
    // Додаємо точку кожні 10 оновлень
    if (world.time % 10 === 0) {
        populationHistory.push({
            rabbits: world.rabbits.length,
            foxes: world.foxes.length,
            plants: world.plants.filter(p => p.hasGrass && !p.destroyed).length
        });

        if (populationHistory.length > MAX_HISTORY) {
            populationHistory.shift();
        }

        drawChart();
    }
}

function drawChart() {
    chartCtx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);

    if (populationHistory.length < 2) return;

    const maxPopulation = Math.max(
        ...populationHistory.map(d => d.rabbits),
        ...populationHistory.map(d => d.foxes),
        ...populationHistory.map(d => d.plants),
        1
    );

    const stepX = chartCanvas.width / (populationHistory.length - 1);
    const scaleY = chartCanvas.height / maxPopulation;

    // Кролики (зелений)
    chartCtx.beginPath();
    chartCtx.strokeStyle = '#34d399';
    chartCtx.lineWidth = 2;
    populationHistory.forEach((point, i) => {
        const x = i * stepX;
        const y = chartCanvas.height - point.rabbits * scaleY;
        if (i === 0) chartCtx.moveTo(x, y);
        else chartCtx.lineTo(x, y);
    });
    chartCtx.stroke();

    // Лисиці (помаранчевий)
    chartCtx.beginPath();
    chartCtx.strokeStyle = '#f97316';
    chartCtx.lineWidth = 2;
    populationHistory.forEach((point, i) => {
        const x = i * stepX;
        const y = chartCanvas.height - point.foxes * scaleY;
        if (i === 0) chartCtx.moveTo(x, y);
        else chartCtx.lineTo(x, y);
    });
    chartCtx.stroke();

    // Трава (синій)
    chartCtx.beginPath();
    chartCtx.strokeStyle = '#3b82f6';
    chartCtx.lineWidth = 1;
    chartCtx.setLineDash([5, 5]);
    populationHistory.forEach((point, i) => {
        const x = i * stepX;
        const y = chartCanvas.height - point.plants * scaleY;
        if (i === 0) chartCtx.moveTo(x, y);
        else chartCtx.lineTo(x, y);
    });
    chartCtx.stroke();
    chartCtx.setLineDash([]);
}

// Функція створення кролика
function createRabbit(id) {
    const genetic = new GeneticProfile();

    return {
        x: 100 + Math.random() * 600,
        y: 100 + Math.random() * 400,
        speed: genetic.phenotype,
        color: genetic.colorPhenotype,
        colorGenotype: genetic.colorGenotype,
        gender: Math.random() > 0.5 ? 'male' : 'female',
        hunger: 90 + Math.random() * 10,
        thirst: 90 + Math.random() * 10,
        age: 0,
        reproductiveAge: settings.rabbitReproductiveAge,
        maxAge: settings.rabbitMaxAge + Math.random() * 200,
        vx: 0,
        vy: 0,
        target: null,
        id: id,
        reproductiveCooldown: 0,
        isPregnant: false,
        pregnancyTimer: 0,
        hasBeenPregnant: false,
        sizeMultiplier: 1.0,
        isChild: false,
        childhoodTimer: 0,
        infertility: Math.random() < (settings.infertilityChance + (genetic.fertilityPenalty || 0)),
        genetic: genetic,

        // Епідеміологічні властивості
        disease: {
            isSick: false,
            sicknessType: null,
            sicknessTimer: 0,
            carrier: false,
        },

        // Додаткова інформація для статистики
        ageGroup: 'child',
        generation: 0,
        fear: Math.random(),
        lastBreedTime: 0
    };
}

// Функція створення лисиці
function createFox(id) {
    const genetic = new GeneticProfile();

    return {
        x: 100 + Math.random() * 600,
        y: 100 + Math.random() * 400,
        speed: genetic.phenotype,
        gender: Math.random() > 0.5 ? 'male' : 'female',
        hunger: 90 + Math.random() * 10,
        thirst: 90 + Math.random() * 10,
        age: 0,
        reproductiveAge: settings.foxReproductiveAge,
        maxAge: settings.foxMaxAge + Math.random() * 300,
        vx: 0,
        vy: 0,
        target: null,
        id: id,
        reproductiveCooldown: 0,
        isPregnant: false,
        pregnancyTimer: 0,
        hasBeenPregnant: false,
        infertility: Math.random() < (settings.infertilityChance + (genetic.fertilityPenalty || 0)),
        genetic: genetic,
        disease: {
            isSick: false,
            sicknessType: null,
            sicknessTimer: 0,
            carrier: false,
        },
        ageGroup: 'child',
        generation: 0,
        fear: Math.random(),
        lastBreedTime: 0
    };
}

// Ініціалізація світу
function initWorld() {
    // Створюємо водні джерела
    world.water = [
        { x: 150, y: 150, radius: 40, id: 1 },
        { x: 450, y: 350, radius: 35, id: 2 },
        { x: 650, y: 200, radius: 30, id: 3 }
    ];

    // Створюємо траву
    world.plants = [];
    const numPlants = Math.floor(settings.plantSpread);

    for (let i = 0; i < numPlants; i++) {
        const waterSource = world.water[Math.floor(Math.random() * world.water.length)];
        const angle = Math.random() * Math.PI * 2;
        const dist = waterSource.radius + 20 + Math.random() * settings.plantSpread;

        const plantX = Math.max(20, Math.min(780, waterSource.x + Math.cos(angle) * dist));
        const plantY = Math.max(20, Math.min(580, waterSource.y + Math.sin(angle) * dist));

        // Перевірка, чи не знаходиться трава у воді
        if (!isInWater(plantX, plantY)) {
            world.plants.push({
                x: plantX,
                y: plantY,
                hasGrass: Math.random() > 0.5, // 50% шанс, що трава вже є
                growthTimer: Math.random() * settings.plantGrowthRate,
                id: Date.now() + i,
                destroyed: false
            });
        }
    }

    // Створюємо кроликів
    world.rabbits = [];
    const initialRabbitsCount = settings.initialRabbits;
    for (let i = 0; i < initialRabbitsCount; i++) {
        let rabbit = createRabbit(Date.now() + i);
        // Спеціальна логіка гендеру для малих груп (до 6)
        if (initialRabbitsCount <= 6) {
            // i < половини — самці, i >= половини — самиці. 
            // При непарній кількості (напр. 5) буде 2 самці та 3 самиці.
            rabbit.gender = i < Math.floor(initialRabbitsCount / 2) ? 'male' : 'female';
        }
        world.rabbits.push(rabbit);
    }

    world.foxes = [];
    const initialFoxesCount = settings.initialFoxes;
    for (let i = 0; i < initialFoxesCount; i++) {
        let fox = createFox(Date.now() + i + 1000);
        // Спеціальна логіка гендеру для малих груп лисиць
        if (initialFoxesCount <= 6) {
            fox.gender = i < Math.floor(initialFoxesCount / 2) ? 'male' : 'female';
        }
        world.foxes.push(fox);
    }

    world.time = 0;
    world.generation = 0;
    world.destroyedPlants = 0;
    world.stats = {
        totalBirths: 0,
        totalDeaths: 0,
        totalKills: 0,
        diseaseDeaths: 0
    };

    populationHistory.length = 0;
    updateChart();
    updateAgeSexPyramid();

    addLog(`🌍 Світ створено: ${world.rabbits.length} кроликів, ${world.foxes.length} лисиць, ${world.plants.filter(p => p.hasGrass && !p.destroyed).length} трави 🌱`, 'system');
    updateStats();
    updateGeneticsStats();
}

// Пошук найближчого об'єкта
function findNearest(entity, entities, maxDistance = 300, checkAggression = false) {
    let nearest = null;
    let minDist = maxDistance * maxDistance; // Використовуємо квадрат відстані для оптимізації

    for (const target of entities) {
        if (target.destroyed) continue;
        if (checkAggression && target.hunger > 70) continue; // Пропускаємо ситих лисиць
        if (target.hasGrass !== undefined && !target.hasGrass) continue; // Пропускаємо траву без трави

        const dx = target.x - entity.x;
        const dy = target.y - entity.y;
        const distSquared = dx * dx + dy * dy;

        if (distSquared < minDist) {
            minDist = distSquared;
            nearest = target;
        }
    }

    return nearest;
}

// Статево-вікова піраміда
function updateAgeSexPyramid() {
    const ageGroups = {
        rabbits: { child: { male: 0, female: 0 }, youth: { male: 0, female: 0 }, adult: { male: 0, female: 0 } },
        foxes: { child: { male: 0, female: 0 }, youth: { male: 0, female: 0 }, adult: { male: 0, female: 0 } }
    };

    // Класифікація кроликів
    world.rabbits.forEach(r => {
        const ageRatio = r.age / r.maxAge;
        let group = 'adult';
        if (r.isChild) group = 'child';
        else if (ageRatio < 0.4) group = 'youth';

        ageGroups.rabbits[group][r.gender]++;

        // Оновлення вікової групи в об'єкті
        r.ageGroup = group;
    });

    // Класифікація лисиць
    world.foxes.forEach(f => {
        const ageRatio = f.age / f.maxAge;
        let group = 'adult';
        if (ageRatio < 0.2) group = 'child';
        else if (ageRatio < 0.4) group = 'youth';

        ageGroups.foxes[group][f.gender]++;
        f.ageGroup = group;
    });

    // Оновлення графічної піраміди
    updatePyramidChart(ageGroups);
}
// Оновлення графіка піраміди (горизонтальна версія)
function updatePyramidChart(data) {
    const pyramidContainer = document.getElementById('agePyramid');
    if (!pyramidContainer) return;

    const maxCount = Math.max(
        ...Object.values(data.rabbits).flatMap(g => Object.values(g)),
        ...Object.values(data.foxes).flatMap(g => Object.values(g)),
        1
    );

    let html = `
        <div class="pyramid-container">
            <h4>Статево-вікова піраміда</h4>
            <div class="pyramid-legend">
                <div class="legend-item">
                    <div class="legend-color" style="background-color: #3b82f6;"></div>
                    <span>♂ Самці</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background-color: #ec4899;"></div>
                    <span>♀ Самки</span>
                </div>
            </div>
            
            <div class="horizontal-pyramid">
                <!-- Кролики -->
                <div class="pyramid-species">
                    <h5>Кролики</h5>
                    <div class="pyramid-bars">
                        ${createHorizontalPyramidBars(data.rabbits, maxCount)}
                    </div>
                </div>
                
                <!-- Лисиці -->
                <div class="pyramid-species">
                    <h5>Лисиці</h5>
                    <div class="pyramid-bars">
                        ${createHorizontalPyramidBars(data.foxes, maxCount)}
                    </div>
                </div>
            </div>
        </div>
    `;

    pyramidContainer.innerHTML = html;
}

// Допоміжна функція для створення горизонтальних барів
function createHorizontalPyramidBars(speciesData, maxCount) {
    const groups = ['child', 'youth', 'adult'];
    const groupLabels = ['Діти', 'Молодь', 'Дорослі'];
    
    let barsHTML = '';
    
    groups.forEach((group, index) => {
        const maleCount = speciesData[group].male;
        const femaleCount = speciesData[group].female;
        
        // Ширина барів у відсотках
        const maleWidth = (maleCount / maxCount) * 100;
        const femaleWidth = (femaleCount / maxCount) * 100;
        
        barsHTML += `
            <div class="pyramid-row">
                <div class="age-label">${groupLabels[index]}</div>
                <div class="bars-container">
                    <!-- Ліва частина - самці -->
                    <div class="male-bar" style="width: ${maleWidth}%">
                        <span class="bar-label">${maleCount}</span>
                    </div>
                    
                    <!-- Центральний роздільник -->
                    <div class="center-divider"></div>
                    
                    <!-- Права частина - самки -->
                    <div class="female-bar" style="width: ${femaleWidth}%">
                        <span class="bar-label">${femaleCount}</span>
                    </div>
                </div>
            </div>
        `;
    });
    
    return barsHTML;
}

// Оновлення статистики
function updateStats() {
    const whiteCount = world.rabbits.filter(r => r.color === 'white').length;
    const blackCount = world.rabbits.filter(r => r.color === 'black').length;
    const heterozygousCount = world.rabbits.filter(r =>
        r.genetic.colorGenotype &&
        ((r.genetic.colorGenotype[0] === 'W' && r.genetic.colorGenotype[1] === 'w') ||
            (r.genetic.colorGenotype[0] === 'w' && r.genetic.colorGenotype[1] === 'W'))
    ).length;

    const pregnantCount = world.rabbits.filter(r => r.isPregnant).length;
    const childCount = world.rabbits.filter(r => r.isChild).length;
    const sickRabbits = world.rabbits.filter(r => r.disease.isSick).length;
    const sickFoxes = world.foxes.filter(f => f.disease.isSick).length;
    const infertileRabbits = world.rabbits.filter(r => r.infertility).length;
    const infertileFoxes = world.foxes.filter(f => f.infertility).length;

    const avgRabbitSpeedVal = world.rabbits.length > 0
        ? world.rabbits.reduce((sum, r) => sum + r.speed, 0) / world.rabbits.length
        : 0;
    const avgFoxSpeedVal = world.foxes.length > 0
        ? world.foxes.reduce((sum, f) => sum + f.speed, 0) / world.foxes.length
        : 0;

    const avgRabbitAgeVal = world.rabbits.length > 0
        ? world.rabbits.reduce((sum, r) => sum + r.age, 0) / world.rabbits.length
        : 0;
    const avgFoxAgeVal = world.foxes.length > 0
        ? world.foxes.reduce((sum, f) => sum + f.age, 0) / world.foxes.length
        : 0;

    // Оновлення бейджів
    rabbitsBadge.textContent = world.rabbits.length;
    foxesBadge.textContent = world.foxes.length;
    plantsBadge.textContent = world.plants.filter(p => p.hasGrass && !p.destroyed).length;
    generationBadge.textContent = Math.floor(world.time / 100);

    // Статистика
    whiteRabbitsCount.textContent = whiteCount;
    blackRabbitsCount.textContent = blackCount;
    heterozygousRabbitsCount.textContent = heterozygousCount;
    avgRabbitSpeed.textContent = avgRabbitSpeedVal.toFixed(2);
    avgRabbitAge.textContent = avgRabbitAgeVal.toFixed(1);
    avgFoxSpeed.textContent = avgFoxSpeedVal.toFixed(2);
    pregnantRabbitsCount.textContent = pregnantCount;
    childRabbitsCount.textContent = childCount;
    sickRabbitsCount.textContent = sickRabbits;
    infertileRabbitsCount.textContent = infertileRabbits;
    infertileFoxesCount.textContent = infertileFoxes;

    totalBirths.textContent = world.stats.totalBirths;
    totalDeaths.textContent = world.stats.totalDeaths;
    totalKills.textContent = world.stats.totalKills;
}

// Оновлення генетичної статистики
function updateGeneticsStats() {
    const totalRabbits = world.rabbits.length;
    if (totalRabbits === 0) return;

    const whiteCount = world.rabbits.filter(r => r.color === 'white').length;
    const blackCount = world.rabbits.filter(r => r.color === 'black').length;

    const allAnimals = [...world.rabbits, ...world.foxes];
    const avgSpeed = allAnimals.length > 0
        ? allAnimals.reduce((sum, a) => sum + a.speed, 0) / allAnimals.length
        : 0;

    // Розрахунок відсотків
    whitePercentage.textContent = totalRabbits > 0 ? Math.round((whiteCount / totalRabbits) * 100) + '%' : '0%';
    blackPercentage.textContent = totalRabbits > 0 ? Math.round((blackCount / totalRabbits) * 100) + '%' : '0%';

    // Гетерозиготні кролики
    const heterozygousCount = world.rabbits.filter(r =>
        r.genetic.colorGenotype &&
        ((r.genetic.colorGenotype[0] === 'W' && r.genetic.colorGenotype[1] === 'w') ||
            (r.genetic.colorGenotype[0] === 'w' && r.genetic.colorGenotype[1] === 'W'))
    ).length;
    heterozygousPercentage.textContent = totalRabbits > 0 ? Math.round((heterozygousCount / totalRabbits) * 100) + '%' : '0%';

    // Інші показники
    mutationFrequency.textContent = (settings.mutationChance * 100).toFixed(0) + '%';
    avgSpeedAll.textContent = avgSpeed.toFixed(2);

    // Простий розрахунок тенденції
    if (populationHistory.length > 1) {
        const last = populationHistory[populationHistory.length - 1].rabbits;
        const prev = populationHistory[populationHistory.length - 2].rabbits;
        speedTrend.textContent = last > prev ? '↗' : last < prev ? '↘' : '→';
    }

    // Коефіцієнт народжуваності
    const fertility = world.stats.totalBirths / Math.max(1, world.time);
    fertilityRate.textContent = fertility.toFixed(4);

    // Підрахунок генотипів швидкості
    let ssDominant = 0, ssHetero = 0, ssRecessive = 0;
    world.rabbits.forEach(r => {
        if (r.genetic && r.genetic.genotype) {
            const genotype = r.genetic.genotype.sort().join(''); // Сортуємо для уніфікації

            if (genotype === 'SS') ssDominant++;
            else if (genotype === 'Ss' || genotype === 'sS') ssHetero++;
            else if (genotype === 'ss') ssRecessive++;
        }
    });

    // Підрахунок генотипів кольору
    let wwDominant = 0, wwHetero = 0, wwRecessive = 0;
    world.rabbits.forEach(r => {
        if (r.genetic && r.genetic.colorGenotype) {
            const genotype = r.genetic.colorGenotype.sort().join(''); // Сортуємо для уніфікації

            if (genotype === 'WW') wwDominant++;
            else if (genotype === 'Ww' || genotype === 'wW') wwHetero++;
            else if (genotype === 'ww') wwRecessive++;
        }
    });

    // Оновлення відображення
    if (ssDominantCount) ssDominantCount.textContent = ssDominant;
    if (ssHeteroCount) ssHeteroCount.textContent = ssHetero;
    if (ssRecessiveCount) ssRecessiveCount.textContent = ssRecessive;

    if (wwDominantCount) wwDominantCount.textContent = wwDominant;
    if (wwHeteroCount) wwHeteroCount.textContent = wwHetero;
    if (wwRecessiveCount) wwRecessiveCount.textContent = wwRecessive;
}

// Автоматичне відновлення популяції
function autoRecoverPopulation() {
    if (!settings.enablePopulationRecovery) return;

    // Відновлення кроликів
    if (world.rabbits.length < 3 && world.time % 50 === 0) {
        const newRabbit = createRabbit(Date.now() + Math.random());
        world.rabbits.push(newRabbit);
        world.stats.totalBirths++;
        addLog(`🐰 Система: створено нового кролика для відновлення популяції`, 'system');
    }

    // Відновлення лисиць
    if (world.foxes.length < 2 && world.time % 100 === 0 && world.rabbits.length > 5) {
        const newFox = createFox(Date.now() + Math.random());
        world.foxes.push(newFox);
        world.stats.totalBirths++;
        addLog(`🦊 Система: створено нову лису для відновлення популяції`, 'system');
    }
}

function drawWorld() {
    // Фон
    ctx.fillStyle = '#6B7F6A';
    ctx.fillRect(0, 0, 800, 600);
    ctx.globalAlpha = 1.0;

    // Вода
    world.water.forEach(w => {
        ctx.fillStyle = '#2196F3';
        ctx.beginPath();
        ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2);
        ctx.fill();

        // Блиск води
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(w.x - w.radius / 3, w.y - w.radius / 3, w.radius / 4, 0, Math.PI * 2);
        ctx.fill();

        // Межа уникання води
        if (settings.enableWaterAvoidance) {
            ctx.strokeStyle = 'rgba(33, 150, 243, 0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(w.x, w.y, w.radius + settings.waterAvoidanceRadius, 0, Math.PI * 2);
            ctx.stroke();
        }
    });

    ctx.globalAlpha = 1.0;
    ctx.fillStyle = '#000000';
    // Трава (емодзі)
    world.plants.forEach(p => {
        if (p.destroyed) return;
        ctx.globalAlpha = 1;

        if (p.hasGrass) {
            ctx.globalAlpha = 1.0;
            ctx.font = '16px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🌱', p.x, p.y);
        }
    });

    // Кролики
    world.rabbits.forEach(r => {
        // Розрахунок розміру (діти менші за дорослих)
        const size = r.isChild ? r.sizeMultiplier : 1.0;

        // 1. ВИЗНАЧЕННЯ КОЛЬОРУ ТІЛА
        let bodyColor;
        if (r.disease.isSick) {
            bodyColor = '#7c3aed'; // Фіолетовий (хворий)
        } else if (r.isChild) {
            bodyColor = '#ADD8E6'; // Світло-блакитний (дитинча)
        } else if (r.isPregnant) {
            bodyColor = '#FF69B4'; // Рожевий (вагітна)
        } else {
            // Генетичні кольори за законами Менделя:
            if (r.color === 'white') {
                // Для гетерозигот можна додати легкий відтінок
                if (r.genetic.colorGenotype &&
                    ((r.genetic.colorGenotype[0] === 'W' && r.genetic.colorGenotype[1] === 'w') ||
                        (r.genetic.colorGenotype[0] === 'w' && r.genetic.colorGenotype[1] === 'W'))) {
                    bodyColor = '#F5F5F5'; // Світло-сірий для гетерозигот
                } else {
                    bodyColor = '#FFFFFF'; // Чисто білий для домінантних гомозигот
                }
            } else {
                // Чорний колір (рецесивна гомозигота)
                bodyColor = '#2D2D2D';
            }
        }

        // 2. МАЛЮВАННЯ ТІЛА
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, 6 * size, 4 * size, 0, 0, Math.PI * 2);
        ctx.fill();

        // 3. МАЛЮВАННЯ ВУХ
        // Робимо колір вух відповідним до тіла, але злегка контрастним
        let earColor = bodyColor;
        if (bodyColor === '#FFFFFF' || bodyColor === '#F5F5F5') earColor = '#F5F5DC'; // Кремові вуха для білих
        if (bodyColor === '#2D2D2D') earColor = '#1A1A1A'; // Глибокий чорний
        if (r.isChild) earColor = '#87CEEB';
        if (r.disease.isSick) earColor = '#9d7bdc';

        ctx.fillStyle = earColor;
        // Ліве вухо
        ctx.fillRect(r.x - 4 * size, r.y - 8 * size, 2 * size, 5 * size);
        // Праве вухо
        ctx.fillRect(r.x + 2 * size, r.y - 8 * size, 2 * size, 5 * size);

        // 4. МАЛЮВАННЯ ОЧЕЙ
        // Контрастна логіка: на чорному кролику малюємо білі очі, на інших - чорні
        if (r.disease.isSick) {
            ctx.fillStyle = '#4c1d95'; // Темно-фіолетові очі
        } else if (bodyColor === '#2D2D2D' || bodyColor === '#1A1A1A') {
            ctx.fillStyle = '#FFFFFF'; // Білі очі, щоб їх було видно на чорному
        } else {
            ctx.fillStyle = '#000000'; // Чорні очі для світлих кроликів
        }

        ctx.beginPath();
        ctx.arc(r.x - 2 * size, r.y - 1 * size, 1.2 * size, 0, Math.PI * 2);
        ctx.arc(r.x + 2 * size, r.y - 1 * size, 1.2 * size, 0, Math.PI * 2);
        ctx.fill();

        // 5. ІНДИКАТОРИ СТАНУ
        // Голод (знизу)
        if (r.hunger < 30) {
            ctx.fillStyle = r.hunger < 10 ? '#FF0000' : '#FFA500';
            ctx.beginPath();
            ctx.arc(r.x, r.y + 7 * size, 2.5 * size, 0, Math.PI * 2);
            ctx.fill();
        }

        // Хвороба (значок над головою)
        if (r.disease.isSick) {
            ctx.fillStyle = '#7c3aed';
            ctx.beginPath();
            ctx.arc(r.x, r.y - 12 * size, 2 * size, 0, Math.PI * 2);
            ctx.fill();
        }
    });

    // Лисиці
    world.foxes.forEach(f => {
        const size = 16; // Розмір емодзі
        ctx.font = `${size}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Додаємо легку прозорість, якщо лисиця хвора
        ctx.globalAlpha = f.disease.isSick ? 0.5 : 1.0;

        // Малюємо емодзі лисиці
        ctx.fillText('🦊', f.x, f.y);

        // Повертаємо прозорість до норми
        ctx.globalAlpha = 1.0;

        // Якщо лисиця вагітна, можна додати маленьке сердечко або індикатор зверху
        if (f.isPregnant) {
            ctx.font = '10px serif';
            ctx.fillText('✨', f.x, f.y - 12);
        }

        // Індикатор хвороби
        if (f.disease.isSick) {
            ctx.font = '12px serif';
            ctx.fillText('🦠', f.x + 12, f.y);
        }
    });
}

// Оновлення руху з урахуванням уникнення стін
function updateMovement() {
    // Кролики
    world.rabbits.forEach(r => {
        // Додаємо уникнення стін
        avoidWalls(r);

        // Оновлюємо позицію
        r.x += r.vx;
        r.y += r.vy;

        // М'яке обмеження замість різкого обрізання
        const margin = 5;
        if (r.x < margin) r.x = margin;
        if (r.x > canvas.width - margin) r.x = canvas.width - margin;
        if (r.y < margin) r.y = margin;
        if (r.y > canvas.height - margin) r.y = canvas.height - margin;
    });

    // Лисиці
    world.foxes.forEach(f => {
        avoidWalls(f);
        f.x += f.vx;
        f.y += f.vy;

        const margin = 5;
        if (f.x < margin) f.x = margin;
        if (f.x > canvas.width - margin) f.x = canvas.width - margin;
        if (f.y < margin) f.y = margin;
        if (f.y > canvas.height - margin) f.y = canvas.height - margin;
    });
}

// Оновлена логіка розмноження з генетикою
function processReproduction() {
    // Кролики
    world.rabbits.forEach(rabbit => {
        if (!rabbit.isChild && rabbit.age > rabbit.reproductiveAge &&
            rabbit.hunger > 40 && rabbit.reproductiveCooldown === 0 && !rabbit.infertility) {

            if (world.rabbits.length < settings.maxRabbits && !isInWater(rabbit.x, rabbit.y)) {
                // Шукаємо партнера протилежної статі
                const partner = world.rabbits.find(other =>
                    other !== rabbit &&
                    other.gender !== rabbit.gender &&
                    !other.isChild &&
                    !other.infertility &&
                    other.age > other.reproductiveAge &&
                    other.reproductiveCooldown === 0 &&
                    Math.sqrt((other.x - rabbit.x) ** 2 + (other.y - rabbit.y) ** 2) < 40 &&
                    !isInWater(other.x, other.y)
                );

                if (partner && Math.random() * 100 < settings.reproductionChanceRabbit) {
                    if (rabbit.gender === 'female') {
                        // Перевірка на одноразову вагітність
                        if (settings.limitPregnancies && rabbit.hasBeenPregnant) {
                            return;
                        }
                        rabbit.isPregnant = true;
                        rabbit.pregnancyTimer = 0 - (Math.floor(Math.random() * 25)); // Невелика випадкова затримка
                        if (settings.limitPregnancies) {
                            rabbit.hasBeenPregnant = true;
                        }
                        partner.reproductiveCooldown = 10;
                        rabbit.reproductiveCooldown = 90;


                        addLog(`🐰 Кролиха ${rabbit.id.toString().slice(-3)} завагітніла від самця ${partner.id.toString().slice(-3)}`, 'mating');
                    } else if (partner.gender === 'female') {
                        // Якщо поточний кролик - самець, а знайшли самицю
                        // Перевірка на одноразову вагітність
                        if (settings.limitPregnancies && partner.hasBeenPregnant) {
                            return;
                        }
                        partner.isPregnant = true;
                        if (settings.limitPregnancies) {
                            partner.hasBeenPregnant = true;
                        }
                        partner.pregnancyTimer = 0 - (Math.floor(Math.random() * 25));
                        rabbit.reproductiveCooldown = 10;
                        partner.reproductiveCooldown = 90;

                        addLog(`🐰 Кролиха ${partner.id.toString().slice(-3)} завагітніла від самця ${rabbit.id.toString().slice(-3)}`, 'mating');
                    }
                }
            }
        }
    });

    // Лисиці
    world.foxes.forEach(fox => {
        if (fox.age > fox.reproductiveAge && fox.hunger > 40 &&
            fox.reproductiveCooldown === 0 && !fox.infertility) {

            if (world.foxes.length < settings.maxFoxes && !isInWater(fox.x, fox.y)) {
                const partner = world.foxes.find(other =>
                    other !== fox &&
                    other.gender !== fox.gender &&
                    !other.infertility &&
                    other.age > other.reproductiveAge &&
                    other.reproductiveCooldown === 0 &&
                    Math.sqrt((other.x - fox.x) ** 2 + (other.y - fox.y) ** 2) < 60 &&
                    !isInWater(other.x, other.y)
                );

                if (partner && Math.random() * 100 < settings.reproductionChanceFox) {
                    if (fox.gender === 'female') {
                        // Перевірка на одноразову вагітність
                        if (settings.limitPregnancies && fox.hasBeenPregnant) {
                            return;
                        }
                        fox.isPregnant = true;
                        fox.pregnancyTimer = 0;
                        partner.reproductiveCooldown = 120;
                        fox.reproductiveCooldown = 120;

                        addLog(`🦊 Лисиця ${fox.id.toString().slice(-3)} завагітніла від самця ${partner.id.toString().slice(-3)}`, 'mating');
                    } else if (partner.gender === 'female') {
                        // Перевірка на одноразову вагітність
                        if (settings.limitPregnancies && partner.hasBeenPregnant) {
                            return;
                        }
                        partner.isPregnant = true;
                        partner.pregnancyTimer = 0;
                        fox.reproductiveCooldown = 120;
                        partner.reproductiveCooldown = 120;

                        addLog(`🦊 Лисиця ${partner.id.toString().slice(-3)} завагітніла від самця ${fox.id.toString().slice(-3)}`, 'mating');
                    }
                }
            }
        }
    });
}

// Оновлення сутностей
function updateEntities() {
    // Оновлення трави
    updatePlantEcosystem();

    // Оновлення кроликів
    const newRabbits = [];
    world.rabbits.forEach(r => {
        r.age++;

        // Зменшення reproductiveCooldown кожен кадр
        if (r.reproductiveCooldown > 0) {
            r.reproductiveCooldown--;
        }

        // Онтогенез: зростання кроленят
        if (r.isChild) {
            r.childhoodTimer++;
            if (r.childhoodTimer >= settings.childhoodDuration) {
                r.isChild = false;
                r.sizeMultiplier = 1.0;
            } else {
                // Плавне зростання від 0.5 до 1.0
                r.sizeMultiplier = 0.5 + (r.childhoodTimer / settings.childhoodDuration) * 0.5;
            }
        }

        // Хвороба
        if (settings.enableDiseases) {
            if (!r.disease.isSick && Math.random() * 1000 < settings.diseaseChance) {
                r.disease.isSick = true;
                r.disease.sicknessType = 'generic';
                r.disease.sicknessTimer = 0;
                addLog(`🦠 Кролик ${r.id.toString().slice(-3)} захворів`, 'disease');
            }

            if (r.disease.isSick) {
                r.disease.sicknessTimer++;
                // Поширення хвороби
                if (r.disease.sicknessTimer % 50 === 0) {
                    spreadDisease(r, world.rabbits);
                }
            }
        }

        // Вагітність
        if (r.isPregnant) {
            r.pregnancyTimer++;
            if (r.pregnancyTimer >= settings.gestationPeriod) {
                // Народження потомства
                r.isPregnant = false;
                r.pregnancyTimer = 0;
                if (settings.limitPregnancies) {
                    r.hasBeenPregnant = true;
                }

                // Кількість потомства залежить від здоров'я матері
                const healthFactor = Math.min(1.5, (r.hunger / 100) * (r.thirst / 100));
                const offspringCount = Math.max(1, Math.floor((Math.random() * 6 + 1) * healthFactor));

                for (let i = 0; i < offspringCount; i++) {
                    if (world.rabbits.length >= settings.maxRabbits) break;

                    // Знаходимо партнера, якщо він є
                    let partner = null;
                    for (const other of world.rabbits) {
                        if (other !== r && Math.sqrt((other.x - r.x) ** 2 + (other.y - r.y) ** 2) < 50) {
                            partner = other;
                            break;
                        }
                    }

                    // Створення генетичного профілю для потомства
                    let childGenetic;
                    if (partner && settings.mendelianInheritance) {
                        childGenetic = GeneticProfile.inheritGenotype(r, partner);
                    } else {
                        childGenetic = new GeneticProfile();
                        childGenetic.phenotype = partner ? getOffspringSpeed(r.speed, partner.speed) : r.speed;
                        childGenetic.colorPhenotype = r.color;
                        childGenetic.colorGenotype = [...r.genetic.colorGenotype];
                    }

                    const child = {
                        x: r.x + (Math.random() - 0.5) * 20,
                        y: r.y + (Math.random() - 0.5) * 20,
                        speed: childGenetic.phenotype,
                        color: childGenetic.colorPhenotype,
                        colorGenotype: childGenetic.colorGenotype,
                        gender: Math.random() > 0.5 ? 'male' : 'female',
                        hunger: 100,
                        thirst: 100,
                        age: 0,
                        reproductiveAge: settings.rabbitReproductiveAge,
                        maxAge: settings.rabbitMaxAge + Math.random() * 200,
                        vx: 0,
                        vy: 0,
                        target: null,
                        id: Date.now() + i + Math.random(),
                        reproductiveCooldown: 0,
                        isPregnant: false,
                        pregnancyTimer: 0,
                        hasBeenPregnant: false,
                        sizeMultiplier: 0.5,
                        isChild: true,
                        childhoodTimer: 0,
                        infertility: Math.random() < (settings.infertilityChance + (childGenetic.fertilityPenalty || 0)),
                        genetic: childGenetic,
                        disease: {
                            isSick: false,
                            sicknessType: null,
                            sicknessTimer: 0,
                            carrier: false,
                        },
                        ageGroup: 'child',
                        generation: partner ? Math.max(r.generation, partner.generation) + 1 : r.generation + 1,
                        fear: Math.random(),
                        lastBreedTime: world.time
                    };

                    newRabbits.push(child);
                }

                world.stats.totalBirths += offspringCount;
                addLog(`🐰 Кролиха ${r.id.toString().slice(-3)} народила ${offspringCount} кроленят`, 'birth');
            }
        }

        // Витрати енергії та води
        const energyMultiplier = r.isPregnant ? 1.5 : 1.0;
        const diseaseMultiplier = r.disease.isSick ? (1 + settings.diseaseEffect) : 1.0;

        r.hunger -= (r.speed * settings.rabbitHungerRate * energyMultiplier * diseaseMultiplier) * (0.8 + Math.random() * 0.4);
        r.thirst -= (settings.thirstRate * energyMultiplier * diseaseMultiplier) * (0.5 + Math.random() * 1.0);

        // Додаткове зменшення енергії у воді
        if (isInWater(r.x, r.y)) {
            r.hunger -= 0.5;
            r.thirst -= 0.5;
        }

        // Перевірка смерті
        if (r.hunger <= 0 || r.thirst <= 0 || r.age > r.maxAge) {
            const cause = r.hunger <= 0 ? 'від голоду' :
                r.thirst <= 0 ? 'від спраги' :
                    'від старості';

            addLog(`🐰 Кролик ${r.id.toString().slice(-3)} помер ${cause}${r.disease.isSick ? ' (хвороба)' : ''}`, 'death');
            world.stats.totalDeaths++;
            if (r.disease.isSick) world.stats.diseaseDeaths++;
            return; // Пропускаємо цього кролика
        }

        // Спочатку перевіряємо лисиць - високий пріоритет
        const nearestFox = findNearest(r, world.foxes, 15);
        if (nearestFox && Math.sqrt((nearestFox.x - r.x) ** 2 + (nearestFox.y - r.y) ** 2) < 15) {
            // Тікаємо від лисиці
            r.target = null;
            // Напрямок тікання - протилежно від лисиці
            const dx = r.x - nearestFox.x;
            const dy = r.y - nearestFox.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 0) {
                // Інтенсивність тікання залежить від відстані - ближче = швидше тікаємо
                const fearFactor = Math.min(2.5, 1 + (100 / Math.max(dist, 1)));
                r.vx = (dx / dist) * r.speed * fearFactor;
                r.vy = (dy / dist) * r.speed * fearFactor;

                // Збільшуємо страх
                r.fear = Math.min(1, r.fear + 0.1);
            }

            // Логуємо тікання (тільки іноді)
            if (Math.random() < 0.001) {
                addLog(`🐰 Кролик ${r.id.toString().slice(-3)} тікає від лисиці!`, 'warning');
            }
        }
        // Тільки якщо немає лисиць поруч - шукаємо їжу або воду
        else if (!r.target || Math.random() < 0.01) {
            if (r.hunger < 50 + Math.random() * 30) {
                r.target = findNearest(r, world.plants.filter(p => p.hasGrass && !p.destroyed));
            } else if (r.thirst < 40 + Math.random() * 30) {
                r.target = findNearest(r, world.water);
            } else {
                r.target = null;
            }

            // Повільно зменшуємо страх, якщо не бачимо лисиць
            r.fear = Math.max(0, r.fear - 0.01);
        }

        // Рух до цілі або випадковий рух
        if (r.target) {
            const dx = r.target.x - r.x;
            const dy = r.target.y - r.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 10) {
                if (r.target.hasGrass !== undefined && r.target.hasGrass) {
                    r.target.hasGrass = false;
                    r.target.growthTimer = 0;
                    r.hunger = Math.min(100, r.hunger + 60);
                    addLog(`🐰 Кролик ${r.id.toString().slice(-3)} з'їв траву 🌱`, 'info');

                    // Знищення трави при з'їданні
                    if (Math.random() < settings.plantDestructionChance) {
                        r.target.destroyed = true;
                        world.destroyedPlants++;
                        addLog(`🌱 Трава біля (${Math.round(r.target.x)}, ${Math.round(r.target.y)}) знищена`, 'warning');
                    }
                } else if (r.target.radius !== undefined) {
                    r.thirst = Math.min(100, r.thirst + 70);
                    addLog(`🐰 Кролик ${r.id.toString().slice(-3)} напився води`, 'info');
                }
                r.target = null;
            } else {
                const speedMultiplier = r.isChild ? 0.7 : 1.0;
                r.vx = (dx / dist) * r.speed * speedMultiplier;
                r.vy = (dy / dist) * r.speed * speedMultiplier;
            }
        } else {
            // Випадковий рух
            r.vx += (Math.random() - 0.5) * 0.2;
            r.vy += (Math.random() - 0.5) * 0.2;
            const speed = Math.sqrt(r.vx * r.vx + r.vy * r.vy);
            const maxSpeed = r.speed * (r.isChild ? 0.7 : 1.0);
            if (speed > maxSpeed) {
                r.vx = (r.vx / speed) * maxSpeed;
                r.vy = (r.vy / speed) * maxSpeed;
            }
        }

        // Уникання води
        avoidWater(r);

        newRabbits.push(r);
    });

    world.rabbits = newRabbits;

    // Оновлення лисиць
    const newFoxes = [];
    world.foxes.forEach(f => {
        f.age++;

        // Зменшення reproductiveCooldown кожен кадр
        if (f.reproductiveCooldown > 0) {
            f.reproductiveCooldown--;
        }

        // Хвороба
        if (settings.enableDiseases) {
            if (!f.disease.isSick && Math.random() * 1000 < settings.diseaseChance) {
                f.disease.isSick = true;
                f.disease.sicknessType = 'generic';
                f.disease.sicknessTimer = 0;
                addLog(`🦠 Лиса ${f.id.toString().slice(-3)} захворіла`, 'disease');
            }

            if (f.disease.isSick) {
                f.disease.sicknessTimer++;
                // Поширення хвороби
                if (f.disease.sicknessTimer % 50 === 0) {
                    spreadDisease(f, world.foxes);
                }
            }
        }

        // Вагітність
        if (f.isPregnant) {
            f.pregnancyTimer++;
            if (f.pregnancyTimer >= settings.gestationPeriod) {
                // Народження потомства
                f.isPregnant = false;
                f.pregnancyTimer = 0;
                if (settings.limitPregnancies) {
                    f.hasBeenPregnant = true;
                }

                const healthFactor = Math.min(1.5, (f.hunger / 100) * (f.thirst / 100));
                const offspringCount = Math.max(1, Math.floor((Math.random() * 4 + 1) * healthFactor));

                for (let i = 0; i < offspringCount; i++) {
                    if (world.foxes.length >= settings.maxFoxes) break;

                    // Знаходимо партнера, якщо він є
                    let partner = null;
                    for (const other of world.foxes) {
                        if (other !== f && Math.sqrt((other.x - f.x) ** 2 + (other.y - f.y) ** 2) < 50) {
                            partner = other;
                            break;
                        }
                    }

                    // Створення генетичного профілю для потомства
                    let childGenetic;
                    if (partner && settings.mendelianInheritance) {
                        childGenetic = GeneticProfile.inheritGenotype(f, partner);
                    } else {
                        childGenetic = new GeneticProfile();
                        childGenetic.phenotype = partner ? getOffspringSpeed(f.speed, partner.speed) : f.speed;
                    }

                    newFoxes.push({
                        x: f.x + (Math.random() - 0.5) * 20,
                        y: f.y + (Math.random() - 0.5) * 20,
                        speed: childGenetic.phenotype,
                        gender: Math.random() > 0.5 ? 'male' : 'female',
                        hunger: 100,
                        thirst: 100,
                        age: 0,
                        reproductiveAge: settings.foxReproductiveAge,
                        maxAge: settings.foxMaxAge + Math.random() * 300,
                        vx: 0,
                        vy: 0,
                        target: null,
                        id: Date.now() + i + Math.random(),
                        reproductiveCooldown: 0,
                        isPregnant: false,
                        pregnancyTimer: 0,
                        hasBeenPregnant: false,
                        infertility: Math.random() < (settings.infertilityChance + (childGenetic.fertilityPenalty || 0)),
                        genetic: childGenetic,
                        disease: {
                            isSick: false,
                            sicknessType: null,
                            sicknessTimer: 0,
                            carrier: false,
                        },
                        ageGroup: 'child',
                        generation: partner ? Math.max(f.generation, partner.generation) + 1 : f.generation + 1,
                        fear: Math.random(),
                        lastBreedTime: world.time
                    });
                }

                world.stats.totalBirths += offspringCount;
                addLog(`🦊 Лисиця ${f.id.toString().slice(-3)} народила ${offspringCount} лисенят`, 'birth');
            }
        }

        // Витрати енергії та води
        const energyMultiplier = f.isPregnant ? 1.3 : 1.0;
        const diseaseMultiplier = f.disease.isSick ? (1 + settings.diseaseEffect) : 1.0;

        f.hunger -= (settings.foxHungerRate * energyMultiplier * diseaseMultiplier) * (0.8 + Math.random() * 0.4);
        f.thirst -= (settings.thirstRate * 0.8 * energyMultiplier * diseaseMultiplier) * (0.5 + Math.random() * 1.0);

        // Додаткове зменшення енергії у воді
        if (isInWater(f.x, f.y)) {
            f.hunger -= 0.8;
            f.thirst -= 0.8;
        }

        // Перевірка смерті
        if (f.hunger <= 0 || f.thirst <= 0 || f.age > f.maxAge) {
            const cause = f.hunger <= 0 ? 'від голоду' :
                f.thirst <= 0 ? 'від спраги' :
                    'від старості';

            addLog(`🦊 Лиса ${f.id.toString().slice(-3)} померла ${cause}${f.disease.isSick ? ' (хвороба)' : ''}`, 'death');
            world.stats.totalDeaths++;
            if (f.disease.isSick) world.stats.diseaseDeaths++;
            return; // Пропускаємо цю лисицю
        }

        // Пошук їжі або води
        if (!f.target || Math.random() < 0.01) {
            if (f.hunger < 60 + Math.random() * 30 && world.rabbits.length > 0) {
                f.target = findNearest(f, world.rabbits, 250);
            } else if (f.thirst < 40 + Math.random() * 30) {
                f.target = findNearest(f, world.water);
            } else {
                f.target = null;
            }
        }

        // Рух до цілі
        if (f.target) {
            const dx = f.target.x - f.x;
            const dy = f.target.y - f.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 12) {
                if (f.target.hunger !== undefined) { // Це кролик
                    // Не ловити кроликів у воді
                    if (!isInWater(f.target.x, f.target.y)) {
                        const rabbitIndex = world.rabbits.findIndex(rabbit => rabbit === f.target);
                        if (rabbitIndex > -1) {
                            const rabbit = world.rabbits[rabbitIndex];
                            const rabbitColor = rabbit.color;
                            world.rabbits.splice(rabbitIndex, 1);
                            f.hunger = Math.min(100, f.hunger + 85);
                            world.stats.totalKills++;

                            const colorNames = {
                                white: 'білого',
                                black: 'чорного'
                            };

                            addLog(`🦊 Лиса ${f.id.toString().slice(-3)} зловила ${colorNames[rabbitColor]} кролика`, 'kill');
                        }
                    }
                    f.target = null;
                } else { // Це вода
                    f.thirst = Math.min(100, f.thirst + 70);
                    addLog(`🦊 Лиса ${f.id.toString().slice(-3)} напилась води`, 'info');
                    f.target = null;
                }
            } else {
                f.vx = (dx / dist) * f.speed;
                f.vy = (dy / dist) * f.speed;
            }
        } else {
            // Випадковий рух
            f.vx += (Math.random() - 0.5) * 0.1;
            f.vy += (Math.random() - 0.5) * 0.1;
            const speed = Math.sqrt(f.vx * f.vx + f.vy * f.vy);
            if (speed > f.speed * 0.8) {
                f.vx = (f.vx / speed) * f.speed * 0.8;
                f.vy = (f.vy / speed) * f.speed * 0.8;
            }
        }

        // Уникання води
        avoidWater(f);

        newFoxes.push(f);
    });

    world.foxes = newFoxes;

    // Оновлення розмноження з генетикою
    processReproduction();

    // Оновлення руху з уникненням стін
    updateMovement();

    world.time++;
    if (world.time % 100 === 0) {
        world.generation++;
    }

    // Автоматичне відновлення популяції при вимиранні
    autoRecoverPopulation();

    // Перевірка на вимиранні
    if (world.rabbits.length === 0 && world.foxes.length === 0) {
        addLog('💀 Всі організми вимерли. Симуляція завершена.', 'system');
        return false;
    } else if (world.rabbits.length === 0) {
        if (world.time % 100 === 0) {
            addLog('⚠️ Всі кролики вимерли! Лисиці голодують.', 'warning');
        }
    } else if (world.foxes.length === 0) {
        if (world.time % 100 === 0) {
            addLog('⚠️ Всі лиси вимерли! Кролики неконтрольовано розмножуються.', 'warning');
        }
    }

    return true;
}

// Ігровий цикл з контролем швидкості
function gameLoop(timestamp) {
    if (!isRunning) return;

    if (!lastUpdateTime) lastUpdateTime = timestamp;
    const deltaTime = timestamp - lastUpdateTime;

    const updatesNeeded = Math.floor(deltaTime / (FIXED_TIMESTEP / settings.timeScale));

    if (updatesNeeded > 0) {
        lastUpdateTime = timestamp - (deltaTime % (FIXED_TIMESTEP / settings.timeScale));

        for (let i = 0; i < Math.min(updatesNeeded, MAX_UPDATES_PER_FRAME); i++) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const shouldContinue = updateEntities();

            drawWorld();
            updateStats();
            updateGeneticsStats();
            updateChart();

            // Оновлення піраміди кожні 10 тиків
            if (world.time % 10 === 0) {
                updateAgeSexPyramid();
            }

            if (!shouldContinue) {
                stopSimulation();
                return;
            }
        }
    }

    animationFrameId = requestAnimationFrame(gameLoop);
}

// Керування симуляцією
function startSimulation() {
    if (isRunning) return;
    isRunning = true;
    lastUpdateTime = 0;
    toggleBtn.innerHTML = '<i data-lucide="pause"></i><span>Пауза</span>';
    lucide.createIcons();
    addLog('▶️ Симуляцію запущено', 'system');
    animationFrameId = requestAnimationFrame(gameLoop);
}

function stopSimulation() {
    isRunning = false;
    toggleBtn.innerHTML = '<i data-lucide="play"></i><span>Старт</span>';
    lucide.createIcons();
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

function toggleSimulation() {
    if (isRunning) {
        stopSimulation();
        addLog('⏸️ Симуляцію призупинено', 'system');
    } else {
        startSimulation();
    }
}

function resetSimulation() {
    stopSimulation();
    logs = [];
    updateLogsDisplay();
    initWorld();
    addLog('🔄 Симуляцію скинуто', 'system');
}

function exportStats() {
    const stats = {
        rabbits: world.rabbits.length,
        foxes: world.foxes.length,
        generation: Math.floor(world.time / 100),
        whiteRabbits: world.rabbits.filter(r => r.color === 'white').length,
        blackRabbits: world.rabbits.filter(r => r.color === 'black').length,
        heterozygousRabbits: world.rabbits.filter(r =>
            r.genetic.colorGenotype &&
            ((r.genetic.colorGenotype[0] === 'W' && r.genetic.colorGenotype[1] === 'w') ||
                (r.genetic.colorGenotype[0] === 'w' && r.genetic.colorGenotype[1] === 'W'))
        ).length,
        pregnantRabbits: world.rabbits.filter(r => r.isPregnant).length,
        childRabbits: world.rabbits.filter(r => r.isChild).length,
        infertileRabbits: world.rabbits.filter(r => r.infertility).length,
        sickRabbits: world.rabbits.filter(r => r.disease.isSick).length,
        avgRabbitSpeed: world.rabbits.length > 0 ?
            (world.rabbits.reduce((sum, r) => sum + r.speed, 0) / world.rabbits.length).toFixed(2) : 0,
        avgFoxSpeed: world.foxes.length > 0 ?
            (world.foxes.reduce((sum, f) => sum + f.speed, 0) / world.foxes.length).toFixed(2) : 0,
        avgRabbitAge: world.rabbits.length > 0 ?
            (world.rabbits.reduce((sum, r) => sum + r.age, 0) / world.rabbits.length).toFixed(1) : 0,
        avgFoxAge: world.foxes.length > 0 ?
            (world.foxes.reduce((sum, f) => sum + f.age, 0) / world.foxes.length).toFixed(1) : 0,
        totalBirths: world.stats.totalBirths,
        totalDeaths: world.stats.totalDeaths,
        totalKills: world.stats.totalKills,
        diseaseDeaths: world.stats.diseaseDeaths,
        plantCount: world.plants.filter(p => p.hasGrass && !p.destroyed).length,
        destroyedPlants: world.destroyedPlants,
        waterSources: world.water.length,
        history: populationHistory.slice(-50),
        settings: settings,
        timestamp: new Date().toISOString()
    };

    const dataStr = JSON.stringify(stats, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `ecosystem_stats_${new Date().toISOString().slice(0, 10)}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();

    addLog('📊 Статистику експортовано', 'system');
}

// Оновлення налаштувань
function updateSettingsFromSliders() {
    settings.timeScale = parseFloat(timeScaleSlider.value);
    timeScaleValue.textContent = settings.timeScale.toFixed(1) + 'x';
    speedIndicator.textContent = settings.timeScale.toFixed(1) + 'x';

    settings.initialRabbits = parseInt(initialRabbitsSlider.value);
    initialRabbitsValue.textContent = settings.initialRabbits;

    settings.initialFoxes = parseInt(initialFoxesSlider.value);
    initialFoxesValue.textContent = settings.initialFoxes;

    settings.rabbitHungerRate = parseFloat(rabbitHungerRateSlider.value);
    rabbitHungerRateValue.textContent = settings.rabbitHungerRate.toFixed(2);

    settings.diseaseChance = parseFloat(diseaseChanceSlider.value);
    diseaseChanceValue.textContent = (settings.diseaseChance * 100).toFixed(1) + '%';

    settings.mutationChance = parseFloat(mutationChanceSlider.value);
    mutationChanceValue.textContent = (settings.mutationChance * 100).toFixed(0) + '%';

    settings.plantGrowthRate = parseInt(plantGrowthRateSlider.value);
    plantGrowthRateValue.textContent = settings.plantGrowthRate;

    settings.reproductionChanceRabbit = parseFloat(reproductionChanceRabbitSlider.value);
    reproductionChanceRabbitValue.textContent = (settings.reproductionChanceRabbit).toFixed(1) + '%';

    settings.reproductionChanceFox = parseFloat(reproductionChanceFoxSlider.value);
    reproductionChanceFoxValue.textContent = (settings.reproductionChanceFox).toFixed(1) + '%';

    settings.initialSpeedAlleleFreq = parseFloat(initialSpeedAlleleFreqSlider.value);
    initialSpeedAlleleFreqValue.textContent = (settings.initialSpeedAlleleFreq * 100).toFixed(0) + '%';

    settings.initialColorAlleleFreq = parseFloat(initialColorAlleleFreqSlider.value);
    initialColorAlleleFreqValue.textContent = (settings.initialColorAlleleFreq * 100).toFixed(0) + '%';

    // НОВІ НАЛАШТУВАННЯ
    settings.rabbitMaxAge = parseInt(rabbitMaxAgeSlider.value);
    rabbitMaxAgeValue.textContent = settings.rabbitMaxAge;

    settings.foxMaxAge = parseInt(foxMaxAgeSlider.value);
    foxMaxAgeValue.textContent = settings.foxMaxAge;

    settings.childhoodDuration = parseInt(childhoodDurationSlider.value);
    childhoodDurationValue.textContent = settings.childhoodDuration;

    settings.gestationPeriod = parseInt(gestationPeriodSlider.value);
    gestationPeriodValue.textContent = settings.gestationPeriod;

    settings.enableMutations = enableMutationsCheckbox.checked;
    settings.enableDiseases = enableDiseasesCheckbox.checked;
    settings.enableWaterAvoidance = enableWaterAvoidanceCheckbox.checked;
    settings.mendelianInheritance = enableMendelianInheritanceCheckbox.checked;
    settings.enablePlantRegrowth = enablePlantRegrowthCheckbox.checked;
    settings.enablePopulationRecovery = enablePopulationRecoveryCheckbox.checked;
    settings.limitPregnancies = limitPregnanciesCheckbox.checked;
}

// Ініціалізація подій
function initEventListeners() {
    toggleBtn.addEventListener('click', toggleSimulation);
    resetBtn.addEventListener('click', resetSimulation);
    exportBtn.addEventListener('click', exportStats);
    helpBtn.addEventListener('click', () => helpModal.style.display = 'block');
    closeModal.addEventListener('click', () => helpModal.style.display = 'none');
    window.addEventListener('click', (event) => {
        if (event.target === helpModal) helpModal.style.display = 'none';
    });

    clearLogsBtn.addEventListener('click', clearLogs);
    logFilterSelect.addEventListener('change', (e) => {
        logFilter = e.target.value;
        updateLogsDisplay();
    });

    // Налаштування
    const sliders = [
        timeScaleSlider, initialRabbitsSlider, initialFoxesSlider,
        rabbitHungerRateSlider, diseaseChanceSlider, mutationChanceSlider,
        plantGrowthRateSlider, reproductionChanceRabbitSlider, reproductionChanceFoxSlider,
        initialSpeedAlleleFreqSlider, initialColorAlleleFreqSlider,
        // НОВІ СЛАЙДЕРИ
        rabbitMaxAgeSlider, foxMaxAgeSlider, childhoodDurationSlider, gestationPeriodSlider
    ];

    sliders.forEach(slider => {
        slider.addEventListener('input', () => {
            updateSettingsFromSliders();
            if (!isRunning) {
                updateStats();
                updateGeneticsStats();
            }
        });
    });

    [enableMutationsCheckbox, enableDiseasesCheckbox, enableWaterAvoidanceCheckbox,
        enableMendelianInheritanceCheckbox, enablePlantRegrowthCheckbox,
        enablePopulationRecoveryCheckbox, limitPregnanciesCheckbox]
        .forEach(checkbox => {
            checkbox.addEventListener('change', updateSettingsFromSliders);
        });
}

// Запуск додатка
function init() {
    initTabs();
    initEventListeners();
    updateSettingsFromSliders();
    initWorld();
    drawWorld();
    updateChart();
    updateAgeSexPyramid();
}

window.addEventListener('load', init);
