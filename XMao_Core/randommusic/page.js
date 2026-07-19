(function () {
    'use strict';

    var DIFFICULTY_NAMES = ['BASIC', 'ADVANCED', 'EXPERT', 'MASTER', 'Re:MASTER', 'UTAGE'];
    var DIFFICULTY_COLORS = ['#45b94a', '#f2c94c', '#ef5350', '#ab47bc', '#d49dff', '#5bb5d8'];
    var state = {
        bound: false,
        mode: 'all',
        poolFilesLoaded: false,
        poolLoading: false,
        allowedMusicIds: null,
        candidateCharts: [],
        dataFingerprint: '',
        drawToken: 0
    };

    var elements = {};

    function translate(key, fallback, params) {
        if (typeof window.t === 'function') {
            return window.t(key, fallback, params || {});
        }
        return fallback;
    }

    function collectElements() {
        elements.page = document.getElementById('randommusicPage');
        elements.form = document.getElementById('randomMusicForm');
        elements.databaseStatus = document.getElementById('randomDatabaseStatus');
        elements.modeButtons = Array.from(document.querySelectorAll('[data-random-mode]'));
        elements.txtModePanel = document.getElementById('randomTxtModePanel');
        elements.allModePanel = document.getElementById('randomAllModePanel');
        elements.poolSelect = document.getElementById('randomPoolSelect');
        elements.poolStatus = document.getElementById('randomPoolStatus');
        elements.poolRefresh = document.getElementById('randomPoolRefresh');
        elements.genreSelect = document.getElementById('randomGenreSelect');
        elements.levelSelect = document.getElementById('randomLevelSelect');
        elements.typeSelect = document.getElementById('randomTypeSelect');
        elements.constantMin = document.getElementById('randomConstantMin');
        elements.constantMax = document.getElementById('randomConstantMax');
        elements.constantError = document.getElementById('randomConstantError');
        elements.candidateCount = document.getElementById('randomCandidateCount');
        elements.candidateSummary = document.getElementById('randomCandidateSummary');
        elements.drawButton = document.getElementById('randomDrawButton');
        elements.drawButtonLabel = document.getElementById('randomDrawButtonLabel');
        elements.resultStage = elements.page ? elements.page.querySelector('.random-result-stage') : null;
        elements.empty = document.getElementById('randomResultEmpty');
        elements.drawing = document.getElementById('randomResultDrawing');
        elements.rollingTitle = document.getElementById('randomRollingTitle');
        elements.error = document.getElementById('randomResultError');
        elements.errorText = document.getElementById('randomResultErrorText');
        elements.result = document.getElementById('randomResult');
        elements.cover = document.getElementById('randomResultCover');
        elements.resultType = document.getElementById('randomResultType');
        elements.resultPool = document.getElementById('randomResultPool');
        elements.resultCandidatePosition = document.getElementById('randomResultCandidatePosition');
        elements.resultTitle = document.getElementById('randomResultTitle');
        elements.resultArtist = document.getElementById('randomResultArtist');
        elements.resultGenre = document.getElementById('randomResultGenre');
        elements.resultBpm = document.getElementById('randomResultBpm');
        elements.resultVersion = document.getElementById('randomResultVersion');
        elements.resultMusicId = document.getElementById('randomResultMusicId');
        elements.hitDifficulty = document.getElementById('randomHitDifficulty');
        elements.hitLevel = document.getElementById('randomHitLevel');
        elements.hitConstant = document.getElementById('randomHitConstant');
        elements.chartList = document.getElementById('randomChartList');
        elements.drawAgain = document.getElementById('randomDrawAgain');
    }

    function getSongs() {
        var api = window.XMaoMusicData;
        return api && typeof api.getSongs === 'function' ? api.getSongs() : [];
    }

    function getCurrentDatabase() {
        var api = window.XMaoMusicData;
        return api && typeof api.getCurrentDatabase === 'function'
            ? api.getCurrentDatabase()
            : null;
    }

    function songInfo(song) {
        return song && song.基础信息 && typeof song.基础信息 === 'object'
            ? song.基础信息
            : {};
    }

    function normalizeMusicId(value) {
        var parsed = Number.parseInt(String(value == null ? '' : value).trim(), 10);
        return Number.isFinite(parsed) ? String(parsed) : '';
    }

    function parseMusicIds(content) {
        return new Set(
            String(content || '')
                .split(/[,，\s]+/)
                .map(normalizeMusicId)
                .filter(Boolean)
        );
    }

    function levelSortValue(level) {
        var text = String(level || '');
        var value = Number.parseFloat(text.replace('+', ''));
        if (!Number.isFinite(value)) return Number.MAX_SAFE_INTEGER;
        return value + (text.includes('+') ? 0.5 : 0);
    }

    function replaceSelectOptions(select, values, allLabel, preserveValue) {
        if (!select) return;
        var selectedValue = preserveValue ? select.value : 'all';
        select.innerHTML = '';

        var allOption = document.createElement('option');
        allOption.value = 'all';
        allOption.textContent = allLabel;
        select.appendChild(allOption);

        values.forEach(function (value) {
            var option = document.createElement('option');
            option.value = value;
            option.textContent = value;
            select.appendChild(option);
        });

        select.value = values.includes(selectedValue) ? selectedValue : 'all';
    }

    function rebuildFilterOptions() {
        var songs = getSongs();
        var database = getCurrentDatabase();
        var fingerprint = String(database && database.filename || '') + ':' + songs.length;
        if (fingerprint === state.dataFingerprint) return;
        state.dataFingerprint = fingerprint;

        var genres = new Set();
        var levels = new Set();
        var types = new Set();

        songs.forEach(function (song) {
            var info = songInfo(song);
            if (info.流派) genres.add(String(info.流派));
            if (info.type) types.add(String(info.type));
            if (Array.isArray(info.等级)) {
                info.等级.forEach(function (level) {
                    if (level != null && String(level).trim()) levels.add(String(level));
                });
            }
        });

        replaceSelectOptions(
            elements.genreSelect,
            Array.from(genres).sort(function (a, b) { return a.localeCompare(b, 'zh-CN'); }),
            translate('random.range.all_genres', '全部流派'),
            true
        );
        replaceSelectOptions(
            elements.levelSelect,
            Array.from(levels).sort(function (a, b) { return levelSortValue(a) - levelSortValue(b); }),
            translate('random.range.all_levels', '全部等级'),
            true
        );
        replaceSelectOptions(
            elements.typeSelect,
            Array.from(types).sort(function (a, b) { return a.localeCompare(b, 'zh-CN'); }),
            translate('random.filters.all_types', '全部类型'),
            true
        );
    }

    function updateDatabaseStatus() {
        if (!elements.databaseStatus) return;
        var database = getCurrentDatabase();
        var songs = getSongs();
        elements.databaseStatus.classList.toggle('is-empty', songs.length === 0);
        elements.databaseStatus.classList.remove('is-error');

        var textNode = elements.databaseStatus.querySelector('span:last-child');
        if (!textNode) return;
        if (!database || songs.length === 0) {
            textNode.textContent = translate('random.page.database_empty', '当前曲库为空');
            return;
        }
        textNode.textContent = translate(
            'random.page.database_ready',
            '{filename} · {count} 首歌曲',
            { filename: database.filename, count: songs.length }
        );
    }

    async function loadPoolFiles() {
        if (!elements.poolSelect || !elements.poolStatus) return;
        var previousValue = elements.poolSelect.value || 'all';
        elements.poolRefresh.disabled = true;
        elements.poolStatus.textContent = translate('random.pool.loading', '正在读取 TXT 曲池...');

        try {
            var response = await fetch('/api/get-random-music-files', { cache: 'no-store' });
            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }
            var payload = await response.json();
            if (!payload || payload.success !== true || !Array.isArray(payload.files)) {
                throw new Error('文件列表格式无效');
            }

            elements.poolSelect.innerHTML = '';
            var placeholderOption = document.createElement('option');
            placeholderOption.value = '';
            placeholderOption.textContent = translate('random.pool.select', '请选择 TXT 曲池');
            elements.poolSelect.appendChild(placeholderOption);

            payload.files.forEach(function (file) {
                var name = String(file && file.name || '').trim();
                if (!name) return;
                var option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                elements.poolSelect.appendChild(option);
            });

            var fileNames = payload.files.map(function (file) { return String(file.name || ''); });
            elements.poolSelect.value = fileNames.includes(previousValue) ? previousValue : (fileNames[0] || '');
            elements.poolSelect.disabled = fileNames.length === 0;
            state.poolFilesLoaded = true;
            elements.poolStatus.textContent = payload.files.length > 0
                ? translate('random.pool.detected', '已发现 {count} 个 TXT 曲池', { count: payload.files.length })
                : translate('random.pool.empty', '未发现 TXT 曲池');
            await loadSelectedPool();
        } catch (error) {
            state.poolFilesLoaded = false;
            state.allowedMusicIds = new Set();
            elements.poolSelect.value = '';
            elements.poolSelect.disabled = true;
            elements.poolStatus.textContent = translate(
                'random.pool.load_failed',
                'TXT 曲池读取失败：{error}',
                { error: error.message }
            );
            refreshCandidates();
        } finally {
            elements.poolRefresh.disabled = false;
        }
    }

    async function loadSelectedPool() {
        if (!elements.poolSelect || !elements.poolStatus) return;
        var fileName = elements.poolSelect.value;
        var selectedLabel = elements.poolSelect.selectedOptions[0]
            ? elements.poolSelect.selectedOptions[0].textContent
            : '';

        state.drawToken += 1;
        if (!fileName) {
            state.poolLoading = false;
            state.allowedMusicIds = new Set();
            if (state.poolFilesLoaded) {
                elements.poolStatus.textContent = translate('random.pool.empty', '未发现 TXT 曲池');
            }
            refreshCandidates();
            return;
        }

        state.poolLoading = true;
        state.allowedMusicIds = new Set();
        elements.poolStatus.textContent = translate('random.pool.file_loading', '正在读取 {filename}...', { filename: selectedLabel });
        refreshCandidates();

        try {
            var response = await fetch('./RandomMusic-TXT/' + encodeURIComponent(fileName), { cache: 'no-store' });
            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }
            var content = await response.text();
            state.allowedMusicIds = parseMusicIds(content);
            elements.poolStatus.textContent = state.allowedMusicIds.size > 0
                ? translate('random.pool.file_ready', '已载入 {count} 个 MusicID', { count: state.allowedMusicIds.size })
                : translate('random.pool.file_empty', '这个 TXT 中没有有效的 MusicID');
        } catch (error) {
            state.allowedMusicIds = new Set();
            elements.poolStatus.textContent = translate(
                'random.pool.file_failed',
                '{filename} 读取失败：{error}',
                { filename: selectedLabel, error: error.message }
            );
        } finally {
            state.poolLoading = false;
            refreshCandidates();
        }
    }

    function readConstantRange() {
        if (state.mode === 'txt') {
            [elements.constantMin, elements.constantMax].forEach(function (input) {
                if (input) input.setAttribute('aria-invalid', 'false');
            });
            if (elements.constantError) elements.constantError.textContent = '';
            return { min: null, max: null, error: '' };
        }

        var minText = elements.constantMin ? elements.constantMin.value.trim() : '';
        var maxText = elements.constantMax ? elements.constantMax.value.trim() : '';
        var min = minText === '' ? null : Number.parseFloat(minText);
        var max = maxText === '' ? null : Number.parseFloat(maxText);
        var error = '';

        if ((minText !== '' && !Number.isFinite(min)) || (maxText !== '' && !Number.isFinite(max))) {
            error = translate('random.filters.constant_invalid', '请输入有效的定数');
        } else if (min != null && max != null && min > max) {
            error = translate('random.filters.constant_order', '最低定数不能高于最高定数');
        }

        [elements.constantMin, elements.constantMax].forEach(function (input) {
            if (input) input.setAttribute('aria-invalid', error ? 'true' : 'false');
        });
        if (elements.constantError) elements.constantError.textContent = error;
        return { min: min, max: max, error: error };
    }

    function collectCandidateCharts() {
        var range = readConstantRange();
        if (range.error || state.poolLoading) return [];

        var genre = elements.genreSelect ? elements.genreSelect.value : 'all';
        var level = elements.levelSelect ? elements.levelSelect.value : 'all';
        var type = elements.typeSelect ? elements.typeSelect.value : 'all';
        var candidates = [];

        getSongs().forEach(function (song) {
            var info = songInfo(song);
            var musicId = normalizeMusicId(info.MusicID);
            if (state.mode === 'txt') {
                if (!state.allowedMusicIds || !state.allowedMusicIds.has(musicId)) return;
            } else {
                if (genre !== 'all' && String(info.流派 || '') !== genre) return;
                if (type !== 'all' && String(info.type || '') !== type) return;
            }

            var levels = Array.isArray(info.等级) ? info.等级 : [];
            var constants = Array.isArray(info.定数) ? info.定数 : [];
            var chartCount = Math.max(levels.length, constants.length);
            for (var chartIndex = 0; chartIndex < chartCount; chartIndex += 1) {
                var chartLevel = levels[chartIndex] == null ? '' : String(levels[chartIndex]);
                var chartConstant = Number(constants[chartIndex]);
                if (state.mode === 'all') {
                    if (level !== 'all' && chartLevel !== level) continue;
                    if (range.min != null && (!Number.isFinite(chartConstant) || chartConstant < range.min)) continue;
                    if (range.max != null && (!Number.isFinite(chartConstant) || chartConstant > range.max)) continue;
                }

                candidates.push({
                    song: song,
                    chartIndex: chartIndex,
                    level: chartLevel || '-',
                    constant: Number.isFinite(chartConstant) ? chartConstant : null
                });
            }
        });

        return candidates;
    }

    function refreshCandidates() {
        rebuildFilterOptions();
        updateDatabaseStatus();
        state.candidateCharts = collectCandidateCharts();

        if (elements.candidateCount) {
            elements.candidateCount.textContent = String(state.candidateCharts.length);
        }
        if (elements.drawButton) {
            elements.drawButton.disabled = state.poolLoading || state.candidateCharts.length === 0;
        }
        if (elements.candidateSummary) {
            elements.candidateSummary.classList.toggle('is-empty', state.candidateCharts.length === 0);
        }
    }

    function setResultState(nextState) {
        if (elements.empty) elements.empty.hidden = nextState !== 'empty';
        if (elements.drawing) elements.drawing.hidden = nextState !== 'drawing';
        if (elements.error) elements.error.hidden = nextState !== 'error';
        if (elements.result) elements.result.hidden = nextState !== 'result';
        if (elements.resultStage) {
            elements.resultStage.setAttribute('aria-busy', nextState === 'drawing' ? 'true' : 'false');
        }
    }

    function setMode(mode, options) {
        var nextMode = mode === 'txt' ? 'txt' : 'all';
        var changed = state.mode !== nextMode;
        state.mode = nextMode;

        elements.modeButtons.forEach(function (button) {
            var active = button.dataset.randomMode === nextMode;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        if (elements.txtModePanel) elements.txtModePanel.hidden = nextMode !== 'txt';
        if (elements.allModePanel) elements.allModePanel.hidden = nextMode !== 'all';

        if (changed && (!options || options.clearResult !== false)) {
            state.drawToken += 1;
            setResultState('empty');
        }
        refreshCandidates();
    }

    function chartName(index) {
        return DIFFICULTY_NAMES[index] || ('CHART ' + (index + 1));
    }

    function renderChartList(candidate) {
        if (!elements.chartList) return;
        elements.chartList.innerHTML = '';
        var info = songInfo(candidate.song);
        var levels = Array.isArray(info.等级) ? info.等级 : [];
        var constants = Array.isArray(info.定数) ? info.定数 : [];
        var count = Math.max(levels.length, constants.length);

        for (var index = 0; index < count; index += 1) {
            var level = levels[index] == null ? '-' : String(levels[index]);
            var constant = Number(constants[index]);
            var chip = document.createElement('span');
            chip.className = 'random-chart-chip' + (index === candidate.chartIndex ? ' is-selected' : '');
            chip.style.setProperty('--chart-color', DIFFICULTY_COLORS[index] || 'var(--accent-color)');
            chip.textContent = chartName(index) + ' ' + level + (Number.isFinite(constant) ? ' / ' + constant.toFixed(1) : '');
            elements.chartList.appendChild(chip);
        }
    }

    function renderResult(candidate, candidateIndex) {
        var info = songInfo(candidate.song);
        var api = window.XMaoMusicData;

        if (elements.cover) {
            elements.cover.onerror = function () {
                elements.cover.onerror = null;
                elements.cover.src = './Data/人类.png';
            };
            if (api && typeof api.bindSongCover === 'function') {
                api.bindSongCover(elements.cover, candidate.song);
            }
            elements.cover.alt = translate(
                'random.result.cover_alt',
                '{title} 的歌曲封面',
                { title: String(info.歌名 || info.title || '') }
            );
        }

        var poolLabel = state.mode === 'txt' && elements.poolSelect && elements.poolSelect.selectedOptions[0]
            ? elements.poolSelect.selectedOptions[0].textContent
            : translate('random.mode.all', '全曲库抽选');
        elements.resultPool.textContent = poolLabel;
        elements.resultCandidatePosition.textContent = translate(
            'random.result.candidate_position',
            '候选谱面 {index} / {count}',
            { index: candidateIndex + 1, count: state.candidateCharts.length }
        );
        elements.resultTitle.textContent = String(info.歌名 || info.title || translate('song.unknown_title', '未知曲目'));
        elements.resultArtist.textContent = String(info.artist || translate('common.unknown', '未知'));
        elements.resultGenre.textContent = String(info.流派 || '-');
        elements.resultBpm.textContent = String(info.bpm == null ? '-' : info.bpm);
        elements.resultVersion.textContent = String(info.版本 || '-');
        elements.resultMusicId.textContent = String(info.MusicID || '-');
        elements.resultType.textContent = String(info.type || translate('song.type.standard', '标准'));
        elements.hitDifficulty.textContent = chartName(candidate.chartIndex);
        elements.hitLevel.textContent = translate('random.result.level_value', '等级 {value}', { value: candidate.level });
        elements.hitConstant.textContent = candidate.constant == null
            ? translate('random.result.constant_unknown', '定数 -')
            : translate('random.result.constant_value', '定数 {value}', { value: candidate.constant.toFixed(1) });

        renderChartList(candidate);
        setResultState('result');
    }

    function renderError(message) {
        if (elements.errorText) elements.errorText.textContent = message;
        setResultState('error');
    }

    function randomCandidateIndex() {
        return Math.floor(Math.random() * state.candidateCharts.length);
    }

    async function drawRandomSong() {
        refreshCandidates();
        if (state.poolLoading) {
            renderError(translate('random.result.pool_wait', 'TXT 曲池仍在读取，请稍后再试'));
            return;
        }
        if (state.candidateCharts.length === 0) {
            renderError(translate('random.result.no_match', '没有符合当前条件的谱面，请调整筛选范围'));
            return;
        }

        var token = ++state.drawToken;
        var finalIndex = randomCandidateIndex();
        var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var tickCount = reducedMotion ? 1 : 14;
        var tickDelay = reducedMotion ? 20 : 45;

        elements.drawButton.disabled = true;
        elements.drawButtonLabel.textContent = translate('random.result.drawing', '随机中');
        setResultState('drawing');

        for (var tick = 0; tick < tickCount; tick += 1) {
            if (token !== state.drawToken) return;
            var rolling = state.candidateCharts[randomCandidateIndex()];
            elements.rollingTitle.textContent = String(songInfo(rolling.song).歌名 || '...');
            await new Promise(function (resolve) { window.setTimeout(resolve, tickDelay); });
        }

        if (token !== state.drawToken) return;
        renderResult(state.candidateCharts[finalIndex], finalIndex);
        elements.drawButtonLabel.textContent = translate('random.action.draw', '随机一首');
        elements.drawButton.disabled = state.candidateCharts.length === 0;
    }

    async function refreshPage() {
        collectElements();
        rebuildFilterOptions();
        updateDatabaseStatus();
        if (!state.poolFilesLoaded) {
            await loadPoolFiles();
        } else {
            refreshCandidates();
        }
    }

    function bindEvents() {
        collectElements();
        if (!elements.form || state.bound) return;
        state.bound = true;

        elements.form.addEventListener('submit', function (event) {
            event.preventDefault();
            drawRandomSong().catch(function (error) {
                renderError(error && error.message ? error.message : String(error));
                elements.drawButtonLabel.textContent = translate('random.action.draw', '随机一首');
                refreshCandidates();
            });
        });

        [elements.genreSelect, elements.levelSelect, elements.typeSelect].forEach(function (select) {
            if (select) select.addEventListener('change', refreshCandidates);
        });
        [elements.constantMin, elements.constantMax].forEach(function (input) {
            if (input) input.addEventListener('input', refreshCandidates);
        });
        elements.poolSelect.addEventListener('change', function () {
            loadSelectedPool().catch(function (error) {
                renderError(error && error.message ? error.message : String(error));
            });
        });
        elements.poolRefresh.addEventListener('click', function () {
            loadPoolFiles().catch(function (error) {
                renderError(error && error.message ? error.message : String(error));
            });
        });
        elements.drawAgain.addEventListener('click', function () {
            elements.form.requestSubmit();
        });
        elements.modeButtons.forEach(function (button) {
            button.addEventListener('click', function () {
                setMode(button.dataset.randomMode);
            });
        });

        window.addEventListener('xmao:music-data-changed', function () {
            state.dataFingerprint = '';
            refreshCandidates();
        });

        setMode(state.mode, { clearResult: false });
    }

    bindEvents();

    if (window.XMaoCore && typeof window.XMaoCore.registerModuleHooks === 'function') {
        window.XMaoCore.registerModuleHooks('randommusic', {
            onEnter: refreshPage
        });
    }
})();
