// DOM 元素获取
let navMenuPopup, navMenuToggle, mainContent, navItems, pages, themeRadios, body;
const DEFAULT_AVATAR_PATH = './Data/人类.png';
const SONG_IMAGE_BASE_PATH = './MaiSongLib/';

const memoryTestState = {
    enabled: false,
    loading: false,
    cache: new Map(),
    loadedFiles: 0,
    totalFiles: 0,
    diskBytes: 0,
    memoryBytes: 0
};
const MEMORY_TEST_AUTOLOAD_STORAGE_KEY = 'memory_test_autoload_startup';
let memoryTestAutoLoadInitialized = false;
const THEME_STORAGE_KEY = 'theme';
const LANGUAGE_STORAGE_KEY = 'xmai_language';
const RESET_STATE_API = '/api/reset-state';
const RESET_STATE_STORAGE_KEY = 'xmai_reset_state_token';
const LANGUAGE_PACK_PATH = './XMao_Core/language.json';
let languagePack = null;
let currentLanguage = 'zh';
let languageControlInitialized = false;
let languagePackSignature = '';
let languageWatcherTimer = null;
let resetStateWatcherTimer = null;
let languageDelegatedHandlerBound = false;
let languageSwitchInFlight = null;
let languageSoftReloading = false;
const BACKGROUND_STORAGE_KEY = 'xmai_background_asset';
const BACKGROUND_VIDEO_STORAGE_KEY = 'xmai_background_video_asset';
const BACKGROUND_MODE_STORAGE_KEY = 'xmai_background_mode';
const BACKGROUND_VIDEO_LOOP_STORAGE_KEY = 'xmai_background_video_loop';
const BACKGROUND_VIDEO_VOLUME_STORAGE_KEY = 'xmai_background_video_volume';
const BACKGROUND_CUSTOM_IMAGE_URL_STORAGE_KEY = 'xmai_background_custom_url';
const LAYOUT_MODE_STORAGE_KEY = 'xmai_layout_mode';
const GLASS_SETTINGS_STORAGE_KEY = 'xmai_glass_settings';
const FONT_COLOR_STORAGE_KEY = 'xmai_font_color';
const FONT_OUTLINE_STORAGE_KEY = 'xmai_font_outline_settings';
const RESETTABLE_STORAGE_KEYS = [
    THEME_STORAGE_KEY,
    LANGUAGE_STORAGE_KEY,
    BACKGROUND_STORAGE_KEY,
    BACKGROUND_VIDEO_STORAGE_KEY,
    BACKGROUND_MODE_STORAGE_KEY,
    BACKGROUND_VIDEO_LOOP_STORAGE_KEY,
    BACKGROUND_VIDEO_VOLUME_STORAGE_KEY,
    BACKGROUND_CUSTOM_IMAGE_URL_STORAGE_KEY,
    LAYOUT_MODE_STORAGE_KEY,
    GLASS_SETTINGS_STORAGE_KEY,
    FONT_COLOR_STORAGE_KEY,
    FONT_OUTLINE_STORAGE_KEY,
    MEMORY_TEST_AUTOLOAD_STORAGE_KEY
];
const FONT_COLOR_DEFAULT_LIGHT = '#2c3e50';
const FONT_COLOR_DEFAULT_DARK = '#ffffff';
const FONT_COLOR_SECONDARY_ALPHA = 0.72;
const FONT_OUTLINE_DEFAULTS = Object.freeze({
    enabled: false,
    width: 0.8,
    color: ''
});
const DEFAULT_BACKGROUND_OPTION = '__default__';
const BACKGROUND_FILES_API = '/api/get-background-files';
const BACKGROUND_CROP_API = '/api/save-background-crop';
const BACKGROUND_VIDEO_BLOB_API = '/api/background-video-blob';
const BACKGROUND_APPLIED_PREFIX = 'Applied/';
const BACKGROUND_MODE_IMAGE = 'image';
const BACKGROUND_MODE_VIDEO = 'video';
const GLASS_SETTINGS_DEFAULTS = Object.freeze({
    opacity: 42,
    blur: 14,
    radius: 4,
    border: 18,
    shadow: 8,
    gradient: 18,
    button: 88
});
let backgroundAssets = [];
let backgroundControlsBound = false;
let backgroundModeControlsBound = false;
let backgroundVideoLoopControlsBound = false;
let backgroundVideoPlayerControlsBound = false;
let layoutControlsBound = false;
let glassControlsBound = false;
let fontColorControlsBound = false;
let fontOutlineControlsBound = false;
let currentLayoutMode = 'classic';
let currentFontColor = '';
let currentFontOutline = { ...FONT_OUTLINE_DEFAULTS };
let currentBackgroundSelection = DEFAULT_BACKGROUND_OPTION;
let currentBackgroundMode = BACKGROUND_MODE_IMAGE;
let currentBackgroundVideoLoop = true;
let currentGlassSettings = { ...GLASS_SETTINGS_DEFAULTS };
let backgroundSelectionInFlight = false;
let backgroundVideoCycleToken = 0;
let currentBackgroundVideoVolume = 0;
let currentBackgroundVideoPaused = false;
let currentBackgroundVideoTrackName = '';
let currentBackgroundVideoTrackDisplayName = '';
let currentBackgroundVideoTrackIndex = -1;
let currentBackgroundVideoTrackList = [];
let backgroundVideoStepHandler = null;
let backgroundVideoBlobUrlCache = new Map();
const MENU_VIDEO_PROGRESS_MAX = 1000;
const MENU_VIDEO_SEEK_SYNC_DELAY_MS = 120;
const BACKGROUND_VIDEO_BLOB_CACHE_LIMIT = 3;
let menuVideoProgressInputActive = false;
let backgroundCropModalBound = false;
let backgroundCropSession = null;
let backgroundCropDrag = null;
let backgroundCropRect = { x: 0, y: 0, width: 0, height: 0 };
let backgroundCropStageSize = { width: 0, height: 0 };
const BACKGROUND_CROP_MIN_SIZE = 48;

function resolveNestedLanguageValue(source, keyPath) {
    if (!source || typeof source !== 'object' || typeof keyPath !== 'string' || !keyPath) {
        return undefined;
    }

    // 优先支持扁平 key（例如 "nav.home"）
    if (Object.prototype.hasOwnProperty.call(source, keyPath)) {
        return source[keyPath];
    }

    // 兼容嵌套结构（例如 { nav: { home: "..." } }）
    return keyPath.split('.').reduce((cursor, segment) => {
        if (cursor && typeof cursor === 'object' && Object.prototype.hasOwnProperty.call(cursor, segment)) {
            return cursor[segment];
        }
        return undefined;
    }, source);
}

function normalizeLanguageCode(code) {
    return String(code || '').trim().toLowerCase();
}

function getLanguagePackLanguages() {
    if (!languagePack || typeof languagePack !== 'object' || !languagePack.languages || typeof languagePack.languages !== 'object') {
        return {};
    }
    return languagePack.languages;
}

function getDefaultLanguageCode() {
    const fromPack = normalizeLanguageCode(languagePack?.defaultLanguage);
    if (fromPack) return fromPack;
    return 'zh';
}

function getLanguageStrings(code) {
    const languages = getLanguagePackLanguages();
    const normalizedCode = normalizeLanguageCode(code);
    const languageMeta = languages[normalizedCode];
    if (!languageMeta || typeof languageMeta !== 'object') {
        return {};
    }
    if (!languageMeta.strings || typeof languageMeta.strings !== 'object') {
        return {};
    }
    return languageMeta.strings;
}

function fillLanguageTemplate(text, params = {}) {
    const normalizedText = String(text ?? '');
    return normalizedText.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => {
        if (!Object.prototype.hasOwnProperty.call(params, key)) {
            return `{${key}}`;
        }
        return String(params[key]);
    });
}

function t(key, fallback = '', params = {}) {
    const activeStrings = getLanguageStrings(currentLanguage);
    const defaultStrings = getLanguageStrings(getDefaultLanguageCode());

    const fromActive = resolveNestedLanguageValue(activeStrings, key);
    const fromDefault = resolveNestedLanguageValue(defaultStrings, key);

    const raw = fromActive ?? fromDefault ?? fallback ?? key;
    return fillLanguageTemplate(raw, params);
}

function getSongCoverFallbackDataUri() {
    const label = t('library.song.no_cover', '无曲绘');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#f0f0f0"/><text x="50%" y="50%" font-size="16" text-anchor="middle" fill="#999">${label}</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function refreshModuleNavLanguage() {
    const navKeyMap = {
        home: 'nav.home',
        results: 'nav.results',
        settings: 'nav.settings',
        library: 'nav.library'
    };

    Object.keys(navKeyMap).forEach(moduleId => {
        const textNode = document.querySelector(`.nav-item[data-page="${moduleId}"] .nav-text`);
        if (!textNode) return;
        textNode.textContent = t(navKeyMap[moduleId], textNode.textContent);
    });
}

function applyLanguageToDom() {
    document.documentElement.setAttribute('lang', currentLanguage);

    const titleNode = document.querySelector('title[data-i18n]');
    if (titleNode) {
        titleNode.textContent = t(titleNode.dataset.i18n, titleNode.textContent);
    }

    document.querySelectorAll('[data-i18n]').forEach(node => {
        const key = node.dataset.i18n;
        if (!key) return;
        node.textContent = t(key, node.textContent);
    });

    document.querySelectorAll('[data-i18n-html]').forEach(node => {
        const key = node.dataset.i18nHtml;
        if (!key) return;
        node.innerHTML = t(key, node.innerHTML);
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(node => {
        const key = node.dataset.i18nPlaceholder;
        if (!key) return;
        node.setAttribute('placeholder', t(key, node.getAttribute('placeholder') || ''));
    });

    document.querySelectorAll('[data-i18n-title]').forEach(node => {
        const key = node.dataset.i18nTitle;
        if (!key) return;
        node.setAttribute('title', t(key, node.getAttribute('title') || ''));
    });

    document.querySelectorAll('[data-i18n-alt]').forEach(node => {
        const key = node.dataset.i18nAlt;
        if (!key) return;
        node.setAttribute('alt', t(key, node.getAttribute('alt') || ''));
    });

    refreshModuleNavLanguage();
    updateGlobalSyncToggleButton();
    updateMemoryTestAutoLoadButton();
    updateMemoryTestStatus();
    renderPeopleList();
    updateSelectedSongsList();
    renderBackgroundOptions();
    updateBackgroundModeInfo();
    updateBackgroundVideoLoopInfo();
    updateBackgroundInfo();
    refreshMenuVideoPlayerUI();
    updateLayoutInfo();
    updateGlassControlPanelState();
    updateGlassSliderDisplay();
    updateFontColorInfo();
    updateFontOutlineInfo();

    const resultsPage = document.getElementById('resultsPage');
    if (resultsPage && resultsPage.style.display !== 'none') {
        showMatchResults();
    }

    if (document.getElementById('resultFileSelect')) {
        refreshResultFilesList({ silent: true }).catch(() => {});
    }

    const importPeopleSelect = document.getElementById('importPeopleFileSelect');
    if (importPeopleSelect && importPeopleSelect.closest('.export-dialog.show')) {
        refreshCharacterFiles().catch(() => {});
    }
}

function getCurrentActivePageId() {
    const activeNavItem = document.querySelector('.nav-item.active[data-page]');
    if (activeNavItem) {
        return activeNavItem.dataset.page;
    }

    const visiblePage = Array.from(document.querySelectorAll('.page')).find(page => {
        return page.style.display !== 'none';
    });
    if (!visiblePage || !visiblePage.id) {
        return '';
    }

    const matched = visiblePage.id.match(/^(.+)Page$/);
    return matched ? matched[1] : '';
}

function ensureLanguageSoftReloadMask() {
    let mask = document.getElementById('languageSoftReloadMask');
    if (mask) return mask;

    mask = document.createElement('div');
    mask.id = 'languageSoftReloadMask';
    mask.style.cssText = `
        position: fixed;
        inset: 0;
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 2000;
        background: rgba(0, 0, 0, 0.14);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        color: #ffffff;
        font-size: 16px;
        font-weight: 700;
        letter-spacing: 0.3px;
    `;
    document.body.appendChild(mask);
    return mask;
}

async function performLanguageSoftReload(options = {}) {
    const { keepPage = true } = options;
    if (languageSoftReloading) return;
    languageSoftReloading = true;

    const activePageId = keepPage ? getCurrentActivePageId() : '';
    const mask = ensureLanguageSoftReloadMask();
    mask.textContent = t('lang.soft_reload.message', '语言切换中，界面软加载中...');
    mask.style.display = 'flex';

    try {
        renderLanguageOptions();
        applyLanguageToDom();

        if (typeof fetchMaiListFiles === 'function') {
            fetchMaiListFiles().catch(() => {});
        }
        if (typeof refreshResultFilesList === 'function') {
            refreshResultFilesList({ silent: true }).catch(() => {});
        }

        if (activePageId && typeof switchPage === 'function') {
            switchPage(activePageId);
        }

        await new Promise(resolve => window.setTimeout(resolve, 120));
    } finally {
        mask.style.display = 'none';
        languageSoftReloading = false;
    }
}

function renderLanguageOptions() {
    const languageSelect = document.getElementById('languageSelect');
    const languageInfo = document.getElementById('languageInfo');
    if (!languageSelect) return;

    const languages = getLanguagePackLanguages();
    const languageCodes = Object.keys(languages);
    languageSelect.innerHTML = '';

    if (languageCodes.length === 0) {
        const fallbackOption = document.createElement('option');
        fallbackOption.value = 'zh';
        fallbackOption.textContent = t('lang.name.zh', '中文');
        languageSelect.appendChild(fallbackOption);
        languageSelect.value = 'zh';
        if (languageInfo) {
            languageInfo.textContent = t('settings.language.loading', '语言包加载中...');
        }
        return;
    }

    languageCodes.forEach(code => {
        const languageMeta = languages[code] || {};
        const option = document.createElement('option');
        option.value = code;
        option.textContent = String(languageMeta.name || code);
        languageSelect.appendChild(option);
    });

    languageSelect.value = currentLanguage;
    if (languageInfo) {
        const selectedOption = languageSelect.options[languageSelect.selectedIndex];
        const selectedLabel = selectedOption ? selectedOption.textContent : currentLanguage;
        languageInfo.textContent = t('settings.language.current_prefix', '当前语言：{name}', { name: selectedLabel });
    }
}

async function loadLanguagePack() {
    const response = await fetch(LANGUAGE_PACK_PATH, { cache: 'no-store' });
    if (!response.ok) {
        throw createAppError('APP-LANG-001', `语言包读取失败，HTTP ${response.status}`);
    }

    const result = await response.json();
    if (!result || typeof result !== 'object' || !result.languages || typeof result.languages !== 'object') {
        throw createAppError('APP-LANG-002', '语言包格式无效，缺少 languages 字段');
    }

    languagePack = result;
    languagePackSignature = JSON.stringify(result);
}

function resolveStoredLanguage() {
    const languages = getLanguagePackLanguages();
    const allCodes = Object.keys(languages);
    const defaultCode = getDefaultLanguageCode();

    let storedCode = '';
    try {
        storedCode = normalizeLanguageCode(localStorage.getItem(LANGUAGE_STORAGE_KEY));
    } catch (_) {
        storedCode = '';
    }
    if (storedCode && allCodes.includes(storedCode)) {
        return storedCode;
    }

    if (allCodes.includes(defaultCode)) {
        return defaultCode;
    }

    return allCodes[0] || 'zh';
}

async function setLanguage(code, options = {}) {
    const { reloadPack = false, softReload = true } = options;
    if (reloadPack) {
        await loadLanguagePack();
    }

    const languages = getLanguagePackLanguages();
    const allCodes = Object.keys(languages);
    const normalizedCode = normalizeLanguageCode(code);
    const fallbackCode = resolveStoredLanguage();

    currentLanguage = allCodes.includes(normalizedCode) ? normalizedCode : fallbackCode;
    try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage);
    } catch (_) {
        // 本地存储不可用时忽略
    }

    if (softReload) {
        await performLanguageSoftReload({ keepPage: true });
        return;
    }

    renderLanguageOptions();
    applyLanguageToDom();
}

function ensureLanguageSelectBinding() {
    if (languageDelegatedHandlerBound) {
        languageControlInitialized = true;
        return;
    }

    const handleLanguageSwitch = async (event) => {
        const target = event.target;
        if (!target || target.id !== 'languageSelect') {
            return;
        }

        const nextLanguage = String(target.value || '').trim();
        if (!nextLanguage) {
            return;
        }

        if (languageSwitchInFlight) {
            return;
        }

        languageSwitchInFlight = (async () => {
            try {
                await setLanguage(nextLanguage, { reloadPack: true, softReload: true });
            } catch (error) {
                console.error('切换语言失败:', error);
                if (typeof customAlert !== 'undefined' && customAlert && typeof customAlert.show === 'function') {
                    customAlert.show(
                        t('lang.switch_failed.title', '语言切换失败'),
                        formatAppError(error)
                    );
                }
            } finally {
                languageSwitchInFlight = null;
            }
        })();
    };

    document.addEventListener('change', handleLanguageSwitch, true);
    document.addEventListener('input', handleLanguageSwitch, true);
    languageDelegatedHandlerBound = true;
    languageControlInitialized = true;
}

async function initLanguageSystem() {
    try {
        await loadLanguagePack();
    } catch (error) {
        console.error('语言包初始化失败:', error);
        languagePack = {
            defaultLanguage: 'zh',
            languages: {
                zh: {
                    name: '中文',
                    strings: {}
                }
            }
        };
    }

    currentLanguage = resolveStoredLanguage();
    renderLanguageOptions();
    applyLanguageToDom();
    ensureLanguageSelectBinding();

    if (!languageWatcherTimer) {
        languageWatcherTimer = setInterval(async () => {
            try {
                const response = await fetch(LANGUAGE_PACK_PATH, { cache: 'no-store' });
                if (!response.ok) return;
                const latestPack = await response.json();
                if (!latestPack || typeof latestPack !== 'object') return;
                if (!latestPack.languages || typeof latestPack.languages !== 'object') return;

                const nextSignature = JSON.stringify(latestPack);
                if (nextSignature === languagePackSignature) return;

                languagePack = latestPack;
                languagePackSignature = nextSignature;
                currentLanguage = resolveStoredLanguage();
                await performLanguageSoftReload({ keepPage: true });
            } catch (_) {
                // 自动监听失败时静默，不影响主流程
            }
        }, 4000);
    }
}

function clampNumber(value, min, max, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return fallback;
    }
    return Math.min(max, Math.max(min, numeric));
}

function normalizeLayoutMode(mode) {
    return String(mode || '').trim().toLowerCase() === 'glass' ? 'glass' : 'classic';
}

function resolveStoredLayoutMode() {
    try {
        return normalizeLayoutMode(localStorage.getItem(LAYOUT_MODE_STORAGE_KEY));
    } catch (_) {
        return 'classic';
    }
}

function normalizeHexColor(color) {
    const normalized = String(color || '').trim().toLowerCase();
    const match = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!match) return '';

    let value = match[1];
    if (value.length === 3) {
        value = value.split('').map(part => `${part}${part}`).join('');
    }
    return `#${value}`;
}

function hexColorToRgb(color) {
    const normalized = normalizeHexColor(color);
    if (!normalized) return null;
    const value = normalized.slice(1);
    return {
        r: Number.parseInt(value.slice(0, 2), 16),
        g: Number.parseInt(value.slice(2, 4), 16),
        b: Number.parseInt(value.slice(4, 6), 16)
    };
}

function resolveCurrentThemeName() {
    const bodyElement = body || document.body;
    if (bodyElement && bodyElement.classList.contains('dark-theme')) {
        return 'dark';
    }
    return 'light';
}

function getThemeDefaultFontColor(themeName = resolveCurrentThemeName()) {
    return themeName === 'dark' ? FONT_COLOR_DEFAULT_DARK : FONT_COLOR_DEFAULT_LIGHT;
}

function getThemeDefaultOutlineColor(themeName = resolveCurrentThemeName()) {
    return themeName === 'dark' ? '#000000' : '#ffffff';
}

function loadStoredFontColor() {
    try {
        return normalizeHexColor(localStorage.getItem(FONT_COLOR_STORAGE_KEY));
    } catch (_) {
        return '';
    }
}

function normalizeFontOutlineWidth(value, fallback = FONT_OUTLINE_DEFAULTS.width) {
    const parsed = Number.parseFloat(String(value));
    if (!Number.isFinite(parsed)) return fallback;
    return Math.round(clampNumber(parsed, 0.2, 4, fallback) * 10) / 10;
}

function normalizeFontOutlineSettings(raw = {}) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const enabled = source.enabled === true || source.enabled === 1 || source.enabled === '1' || source.enabled === 'true';
    const width = normalizeFontOutlineWidth(source.width, FONT_OUTLINE_DEFAULTS.width);
    const color = normalizeHexColor(source.color);
    return {
        enabled,
        width,
        color
    };
}

function loadStoredFontOutline() {
    try {
        const raw = localStorage.getItem(FONT_OUTLINE_STORAGE_KEY);
        if (!raw) return { ...FONT_OUTLINE_DEFAULTS };
        const parsed = JSON.parse(raw);
        return normalizeFontOutlineSettings(parsed || {});
    } catch (_) {
        return { ...FONT_OUTLINE_DEFAULTS };
    }
}

function restoreStoredFontOutline(options = {}) {
    const { syncControl = false } = options;
    currentFontOutline = loadStoredFontOutline();
    applyGlobalFontOutline(currentFontOutline, { persist: false, syncControl });
}

function saveFontOutlineSettings() {
    try {
        localStorage.setItem(FONT_OUTLINE_STORAGE_KEY, JSON.stringify(currentFontOutline));
    } catch (_) {
        // 本地存储不可用时忽略
    }
}

function buildSecondaryFontColor(primaryColor) {
    const rgb = hexColorToRgb(primaryColor);
    if (!rgb) {
        return primaryColor;
    }
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${FONT_COLOR_SECONDARY_ALPHA})`;
}

function updateFontColorInfo() {
    const infoNode = document.getElementById('fontColorInfo');
    const valueNode = document.getElementById('fontColorValue');
    const effectiveColor = (currentFontColor || getThemeDefaultFontColor()).toUpperCase();

    if (valueNode) {
        valueNode.textContent = effectiveColor;
    }

    if (!infoNode) return;

    infoNode.textContent = currentFontColor
        ? t('settings.font_color.current_prefix', '当前字体颜色：{color}', { color: effectiveColor })
        : t('settings.font_color.default_prefix', '当前字体颜色：主题默认（{color}）', { color: effectiveColor });
}

function resolveEffectiveFontOutlineColor() {
    return currentFontOutline.color || getThemeDefaultOutlineColor();
}

function formatOutlineWidth(width) {
    return `${Number(width).toFixed(1)}px`;
}

function buildOutlineShadow(width, color) {
    if (width <= 0 || !color) {
        return 'none';
    }

    const px = formatOutlineWidth(width);
    return `${px} 0 0 ${color}, -${px} 0 0 ${color}, 0 ${px} 0 ${color}, 0 -${px} 0 ${color}, ${px} ${px} 0 ${color}, ${px} -${px} 0 ${color}, -${px} ${px} 0 ${color}, -${px} -${px} 0 ${color}`;
}

function updateFontOutlineControlState() {
    const widthInput = document.getElementById('fontOutlineWidthRange');
    const colorInput = document.getElementById('fontOutlineColorPicker');
    const disabled = !currentFontOutline.enabled;
    if (widthInput) {
        widthInput.disabled = disabled;
    }
    if (colorInput) {
        colorInput.disabled = disabled;
    }
}

function updateFontOutlineInfo() {
    const infoNode = document.getElementById('fontOutlineInfo');
    const widthNode = document.getElementById('fontOutlineWidthValue');
    const colorNode = document.getElementById('fontOutlineColorValue');
    const effectiveColor = resolveEffectiveFontOutlineColor().toUpperCase();
    const widthLabel = formatOutlineWidth(currentFontOutline.width);

    if (widthNode) {
        widthNode.textContent = widthLabel;
    }
    if (colorNode) {
        colorNode.textContent = effectiveColor;
    }

    if (!infoNode) return;

    if (!currentFontOutline.enabled) {
        infoNode.textContent = t('settings.font_outline.current_disabled', '当前描边：关闭');
        return;
    }

    infoNode.textContent = t('settings.font_outline.current_enabled', '当前描边：{width} / {color}', {
        width: widthLabel,
        color: effectiveColor
    });
}

function syncFontColorControls() {
    const picker = document.getElementById('fontColorPicker');
    const effectiveColor = currentFontColor || getThemeDefaultFontColor();
    if (picker) {
        picker.value = effectiveColor;
    }
    updateFontColorInfo();
}

function syncFontOutlineControls() {
    const toggle = document.getElementById('fontOutlineToggle');
    const widthInput = document.getElementById('fontOutlineWidthRange');
    const colorInput = document.getElementById('fontOutlineColorPicker');
    const effectiveColor = resolveEffectiveFontOutlineColor();

    if (toggle) {
        toggle.checked = currentFontOutline.enabled;
    }
    if (widthInput) {
        widthInput.value = String(currentFontOutline.width);
    }
    if (colorInput) {
        colorInput.value = effectiveColor;
    }

    updateFontOutlineControlState();
    updateFontOutlineInfo();
}

function applyGlobalFontColor(color, options = {}) {
    const { persist = true, syncControl = true } = options;
    currentFontColor = normalizeHexColor(color);

    const primaryColor = currentFontColor || getThemeDefaultFontColor();
    const secondaryColor = buildSecondaryFontColor(primaryColor);
    const styleHost = body || document.body || document.documentElement;

    if (styleHost) {
        styleHost.style.setProperty('--text-primary', primaryColor);
        styleHost.style.setProperty('--text-secondary', secondaryColor);
        if (currentFontColor) {
            styleHost.style.setProperty('--glass-button-text', primaryColor);
        } else {
            styleHost.style.removeProperty('--glass-button-text');
        }
    }

    if (persist) {
        try {
            localStorage.setItem(FONT_COLOR_STORAGE_KEY, currentFontColor);
        } catch (_) {
            // 本地存储不可用时忽略
        }
    }

    if (syncControl) {
        syncFontColorControls();
    } else {
        updateFontColorInfo();
    }

    applyGlobalFontOutline(currentFontOutline, { persist: false, syncControl: false });
}

function applyGlobalFontOutline(partialSettings = {}, options = {}) {
    const { persist = true, syncControl = true } = options;
    currentFontOutline = normalizeFontOutlineSettings({
        ...currentFontOutline,
        ...(partialSettings && typeof partialSettings === 'object' ? partialSettings : {})
    });

    const outlineWidth = currentFontOutline.enabled ? currentFontOutline.width : 0;
    const outlineColor = resolveEffectiveFontOutlineColor();
    const bodyElement = body || document.body;
    const styleHost = bodyElement || document.documentElement;

    if (styleHost) {
        if (bodyElement && bodyElement.classList) {
            bodyElement.classList.toggle('font-outline-enabled', currentFontOutline.enabled);
        }
        styleHost.style.setProperty('--font-outline-width', `${outlineWidth.toFixed(1)}px`);
        styleHost.style.setProperty('--font-outline-color', outlineColor);
        styleHost.style.setProperty('--font-outline-shadow', buildOutlineShadow(outlineWidth, outlineColor));
    }

    if (persist) {
        saveFontOutlineSettings();
    }

    if (syncControl) {
        syncFontOutlineControls();
    } else {
        updateFontOutlineControlState();
        updateFontOutlineInfo();
    }
}

function ensureFontColorBinding() {
    if (fontColorControlsBound) return;

    const handleFontColorInput = (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement) || target.id !== 'fontColorPicker') {
            return;
        }
        applyGlobalFontColor(target.value, { persist: true, syncControl: false });
    };

    document.addEventListener('input', handleFontColorInput, true);
    document.addEventListener('change', handleFontColorInput, true);
    fontColorControlsBound = true;
}

function ensureFontOutlineBinding() {
    if (fontOutlineControlsBound) return;

    const handleFontOutlineInput = (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) {
            return;
        }

        if (target.id === 'fontOutlineToggle') {
            applyGlobalFontOutline({ enabled: target.checked }, { persist: true, syncControl: false });
            return;
        }

        if (target.id === 'fontOutlineWidthRange') {
            applyGlobalFontOutline({ width: target.value }, { persist: true, syncControl: false });
            return;
        }

        if (target.id === 'fontOutlineColorPicker') {
            applyGlobalFontOutline({ color: target.value }, { persist: true, syncControl: false });
        }
    };

    document.addEventListener('input', handleFontOutlineInput, true);
    document.addEventListener('change', handleFontOutlineInput, true);
    fontOutlineControlsBound = true;
}

function isMouseTrailEnabled() {
    return currentLayoutMode !== 'glass';
}

function updateMouseTrailState() {
    if (isMouseTrailEnabled()) {
        return;
    }
    document.documentElement.style.setProperty('--mouse-x', '50%');
    document.documentElement.style.setProperty('--mouse-y', '50%');
}

function normalizeGlassSettings(raw = {}) {
    return {
        opacity: Math.round(clampNumber(raw.opacity, 18, 95, GLASS_SETTINGS_DEFAULTS.opacity)),
        blur: Math.round(clampNumber(raw.blur, 0, 28, GLASS_SETTINGS_DEFAULTS.blur)),
        radius: Math.round(clampNumber(raw.radius, 0, 16, GLASS_SETTINGS_DEFAULTS.radius)),
        border: Math.round(clampNumber(raw.border, 0, 60, GLASS_SETTINGS_DEFAULTS.border)),
        shadow: Math.round(clampNumber(raw.shadow, 0, 40, GLASS_SETTINGS_DEFAULTS.shadow)),
        gradient: Math.round(clampNumber(raw.gradient, 0, 50, GLASS_SETTINGS_DEFAULTS.gradient)),
        button: Math.round(clampNumber(raw.button, 35, 100, GLASS_SETTINGS_DEFAULTS.button))
    };
}

function loadStoredGlassSettings() {
    try {
        const raw = localStorage.getItem(GLASS_SETTINGS_STORAGE_KEY);
        if (!raw) return { ...GLASS_SETTINGS_DEFAULTS };
        const parsed = JSON.parse(raw);
        return normalizeGlassSettings(parsed || {});
    } catch (_) {
        return { ...GLASS_SETTINGS_DEFAULTS };
    }
}

function saveGlassSettings() {
    try {
        localStorage.setItem(GLASS_SETTINGS_STORAGE_KEY, JSON.stringify(currentGlassSettings));
    } catch (_) {
        // 本地存储不可用时忽略
    }
}

function formatGlassSliderValue(key, value) {
    if (key === 'blur' || key === 'radius') {
        return `${value}px`;
    }
    return `${value}%`;
}

function updateGlassSliderDisplay() {
    const mapping = {
        opacity: 'glassOpacityValue',
        blur: 'glassBlurValue',
        radius: 'glassRadiusValue',
        border: 'glassBorderValue',
        shadow: 'glassShadowValue',
        gradient: 'glassGradientValue',
        button: 'glassButtonValue'
    };

    Object.keys(mapping).forEach(key => {
        const node = document.getElementById(mapping[key]);
        if (!node) return;
        node.textContent = formatGlassSliderValue(key, currentGlassSettings[key]);
    });
}

function syncGlassControls() {
    const mapping = {
        opacity: 'glassOpacityRange',
        blur: 'glassBlurRange',
        radius: 'glassRadiusRange',
        border: 'glassBorderRange',
        shadow: 'glassShadowRange',
        gradient: 'glassGradientRange',
        button: 'glassButtonRange'
    };

    Object.keys(mapping).forEach(key => {
        const inputNode = document.getElementById(mapping[key]);
        if (!inputNode) return;
        inputNode.value = String(currentGlassSettings[key]);
    });

    updateGlassSliderDisplay();
}

function updateGlassControlPanelState() {
    const panel = document.getElementById('glassControlPanel');
    const hint = document.getElementById('glassControlHint');
    if (panel) {
        panel.classList.toggle('is-inactive', currentLayoutMode !== 'glass');
    }
    if (hint) {
        hint.textContent = currentLayoutMode === 'glass'
            ? t('settings.glass.hint_active', '当前为玻璃卡片模式，调整后即时生效。')
            : t('settings.glass.hint_inactive', '当前为经典布局，参数已保存，切换到玻璃卡片模式后生效。');
    }
}

function applyGlassSettings(partialSettings = {}, options = {}) {
    const { persist = true, syncControl = true } = options;
    currentGlassSettings = normalizeGlassSettings({
        ...currentGlassSettings,
        ...partialSettings
    });

    const opacity = currentGlassSettings.opacity / 100;
    const border = currentGlassSettings.border / 100;
    const shadow = currentGlassSettings.shadow / 100;
    const gradient = currentGlassSettings.gradient / 100;
    const button = currentGlassSettings.button / 100;
    const gradientSoft = Math.min(0.95, Math.max(0, gradient * 0.66));
    const inputOpacity = Math.min(0.96, Math.max(0.08, opacity * 0.9));
    const hoverOpacity = Math.min(0.98, Math.max(0.12, opacity + 0.1));
    const shadowHover = Math.min(0.95, Math.max(0.08, shadow + 0.08));
    const buttonRadius = Math.max(2, currentGlassSettings.radius - 4);

    const bodyElement = body || document.body;
    if (bodyElement) {
        bodyElement.style.setProperty('--glass-opacity', opacity.toFixed(2));
        bodyElement.style.setProperty('--glass-blur', `${currentGlassSettings.blur}px`);
        bodyElement.style.setProperty('--glass-radius', `${currentGlassSettings.radius}px`);
        bodyElement.style.setProperty('--glass-button-radius', `${buttonRadius}px`);
        bodyElement.style.setProperty('--glass-border-alpha', border.toFixed(2));
        bodyElement.style.setProperty('--glass-shadow-alpha', shadow.toFixed(2));
        bodyElement.style.setProperty('--glass-shadow-hover-alpha', shadowHover.toFixed(2));
        bodyElement.style.setProperty('--glass-gradient-alpha', gradient.toFixed(2));
        bodyElement.style.setProperty('--glass-gradient-soft-alpha', gradientSoft.toFixed(2));
        bodyElement.style.setProperty('--glass-button-alpha', button.toFixed(2));
        bodyElement.style.setProperty('--glass-input-opacity', inputOpacity.toFixed(2));
        bodyElement.style.setProperty('--glass-hover-opacity', hoverOpacity.toFixed(2));
    }

    if (persist) {
        saveGlassSettings();
    }
    if (syncControl) {
        syncGlassControls();
    } else {
        updateGlassSliderDisplay();
    }
}

function ensureGlassControlsBinding() {
    if (glassControlsBound) return;

    const handleGlassSliderInput = (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) return;
        if (!target.classList.contains('glass-slider-input')) return;

        const key = String(target.dataset.glassKey || '').trim();
        if (!key || !Object.prototype.hasOwnProperty.call(currentGlassSettings, key)) {
            return;
        }

        const nextValue = Math.round(clampNumber(target.value, -9999, 9999, currentGlassSettings[key]));
        applyGlassSettings({ [key]: nextValue }, { persist: true, syncControl: false });
    };

    document.addEventListener('input', handleGlassSliderInput, true);
    document.addEventListener('change', handleGlassSliderInput, true);
    glassControlsBound = true;
}

function updateLayoutInfo() {
    const infoNode = document.getElementById('layoutInfo');
    if (!infoNode) return;

    const modeName = currentLayoutMode === 'glass'
        ? t('settings.layout.glass', '玻璃卡片布局')
        : t('settings.layout.classic', '经典布局');
    infoNode.textContent = t('settings.layout.current_prefix', '当前布局：{name}', { name: modeName });
}

function applyLayoutMode(mode, options = {}) {
    const { persist = true, syncControl = true } = options;
    currentLayoutMode = normalizeLayoutMode(mode);

    const bodyElement = body || document.body;
    if (bodyElement) {
        bodyElement.classList.toggle('ui-glass-mode', currentLayoutMode === 'glass');
    }

    if (persist) {
        try {
            localStorage.setItem(LAYOUT_MODE_STORAGE_KEY, currentLayoutMode);
        } catch (_) {
            // 本地存储不可用时忽略
        }
    }

    if (syncControl) {
        document.querySelectorAll('input[name="layoutMode"]').forEach(radio => {
            radio.checked = radio.value === currentLayoutMode;
        });
    }

    applyGlassSettings(currentGlassSettings, { persist: false, syncControl: false });
    updateMouseTrailState();
    applyGlobalFontColor(currentFontColor, { persist: false, syncControl: false });
    updateLayoutInfo();
    updateGlassControlPanelState();
}

function ensureLayoutModeBinding() {
    if (layoutControlsBound) return;

    document.addEventListener('change', (event) => {
        const target = event.target;
        if (!target || target.name !== 'layoutMode') {
            return;
        }
        applyLayoutMode(target.value, { persist: true, syncControl: false });
    }, true);

    layoutControlsBound = true;
}

function normalizeBackgroundMode(mode) {
    return String(mode || '').trim().toLowerCase() === BACKGROUND_MODE_VIDEO
        ? BACKGROUND_MODE_VIDEO
        : BACKGROUND_MODE_IMAGE;
}

function resolveStoredBackgroundMode() {
    try {
        return normalizeBackgroundMode(localStorage.getItem(BACKGROUND_MODE_STORAGE_KEY));
    } catch (_) {
        return BACKGROUND_MODE_IMAGE;
    }
}

function resolveStoredBackgroundVideoLoop() {
    try {
        const stored = String(localStorage.getItem(BACKGROUND_VIDEO_LOOP_STORAGE_KEY) || '').trim().toLowerCase();
        if (!stored) return true;
        if (stored === '0' || stored === 'false' || stored === 'off' || stored === 'no') {
            return false;
        }
        return true;
    } catch (_) {
        return true;
    }
}

function clampBackgroundVideoVolume(value, fallback = 0) {
    const parsed = Number.parseFloat(String(value));
    if (!Number.isFinite(parsed)) {
        return clampNumber(fallback, 0, 1, 0);
    }
    return clampNumber(parsed, 0, 1, 0);
}

function resolveStoredBackgroundVideoVolume() {
    try {
        const raw = localStorage.getItem(BACKGROUND_VIDEO_VOLUME_STORAGE_KEY);
        if (raw == null) return 0;
        return clampBackgroundVideoVolume(raw, 0);
    } catch (_) {
        return 0;
    }
}

function inferBackgroundType(fileName = '') {
    const ext = String(fileName).toLowerCase().split('.').pop();
    return ext === 'mp4' ? 'video' : 'image';
}

function isAppliedBackgroundName(name = '') {
    return String(name || '').replace(/\\/g, '/').startsWith(BACKGROUND_APPLIED_PREFIX);
}

function findBackgroundAssetByName(name) {
    return backgroundAssets.find(asset => asset.name === name) || null;
}

function getBackgroundSelectionStorageKey() {
    return currentBackgroundMode === BACKGROUND_MODE_VIDEO
        ? BACKGROUND_VIDEO_STORAGE_KEY
        : BACKGROUND_STORAGE_KEY;
}

function getStoredBackgroundSelection() {
    try {
        const storageKey = getBackgroundSelectionStorageKey();
        const stored = String(localStorage.getItem(storageKey) || '').trim();
        return stored || DEFAULT_BACKGROUND_OPTION;
    } catch (_) {
        return DEFAULT_BACKGROUND_OPTION;
    }
}

function getStoredCustomBackgroundUrl() {
    if (currentBackgroundMode !== BACKGROUND_MODE_IMAGE) {
        return '';
    }
    try {
        return String(localStorage.getItem(BACKGROUND_CUSTOM_IMAGE_URL_STORAGE_KEY) || '').trim();
    } catch (_) {
        return '';
    }
}

function saveStoredCustomBackgroundUrl(value = '') {
    try {
        const normalized = String(value || '').trim();
        if (normalized) {
            localStorage.setItem(BACKGROUND_CUSTOM_IMAGE_URL_STORAGE_KEY, normalized);
        } else {
            localStorage.removeItem(BACKGROUND_CUSTOM_IMAGE_URL_STORAGE_KEY);
        }
    } catch (_) {
        // 本地存储不可用时忽略
    }
}

function getSelectableBackgroundAssets() {
    if (currentBackgroundMode === BACKGROUND_MODE_VIDEO) {
        return backgroundAssets.filter(asset => getBackgroundAssetType(asset) === 'video');
    }
    return backgroundAssets.filter(asset => {
        return getBackgroundAssetType(asset) === 'image' && !isAppliedBackgroundName(asset.name);
    });
}

function resolveBackgroundSelection(value) {
    const normalized = String(value || '').trim();
    if (!normalized || normalized === DEFAULT_BACKGROUND_OPTION) {
        return DEFAULT_BACKGROUND_OPTION;
    }
    return getSelectableBackgroundAssets().some(asset => asset.name === normalized)
        ? normalized
        : DEFAULT_BACKGROUND_OPTION;
}

function getBackgroundAssetType(asset) {
    if (!asset || typeof asset !== 'object') return 'image';
    const explicitType = String(asset.type || '').trim().toLowerCase();
    if (explicitType === 'video' || explicitType === 'image') {
        return explicitType;
    }
    return inferBackgroundType(asset.name);
}

function getBackgroundDisplayName(asset) {
    if (!asset || typeof asset !== 'object') return '';
    return String(asset.displayName || asset.display_name || asset.name || '').trim();
}

function buildBackgroundAssetUrl(asset) {
    if (!asset || typeof asset !== 'object') return '';
    if (asset.url) return String(asset.url);
    return `./XMao_Core/Background/${encodeURIComponent(String(asset.name || ''))}`;
}

function getBackgroundVideoCacheKey(asset) {
    return String(asset?.name || '').trim();
}

function inferBackgroundVideoMimeType(assetName = '') {
    const normalized = String(assetName || '').trim().toLowerCase();
    if (normalized.endsWith('.webm')) return 'video/webm';
    if (normalized.endsWith('.ogg') || normalized.endsWith('.ogv')) return 'video/ogg';
    return 'video/mp4';
}

function buildBackgroundVideoBlobApiUrl(asset) {
    const rawName = getBackgroundVideoCacheKey(asset).replace(/\\/g, '/');
    const normalizedName = rawName.replace(/^video\//i, '');
    if (!normalizedName) return '';
    return `${BACKGROUND_VIDEO_BLOB_API}?name=${encodeURIComponent(normalizedName)}`;
}

function touchBackgroundVideoBlobCache(cacheKey) {
    if (!cacheKey || !backgroundVideoBlobUrlCache.has(cacheKey)) return null;
    const entry = backgroundVideoBlobUrlCache.get(cacheKey);
    backgroundVideoBlobUrlCache.delete(cacheKey);
    backgroundVideoBlobUrlCache.set(cacheKey, entry);
    return entry;
}

function clearBackgroundVideoBlobCache() {
    backgroundVideoBlobUrlCache.forEach((entry) => {
        if (entry && entry.objectUrl) {
            try {
                URL.revokeObjectURL(entry.objectUrl);
            } catch (_) {
                // object url 释放失败时忽略
            }
        }
    });
    backgroundVideoBlobUrlCache = new Map();
}

function trimBackgroundVideoBlobCache(excludedKey = '') {
    while (backgroundVideoBlobUrlCache.size > BACKGROUND_VIDEO_BLOB_CACHE_LIMIT) {
        const oldest = backgroundVideoBlobUrlCache.entries().next().value;
        if (!oldest) break;

        const [oldestKey, oldestEntry] = oldest;
        if (oldestKey === excludedKey && backgroundVideoBlobUrlCache.size === 1) {
            break;
        }

        backgroundVideoBlobUrlCache.delete(oldestKey);
        if (oldestEntry && oldestEntry.objectUrl) {
            try {
                URL.revokeObjectURL(oldestEntry.objectUrl);
            } catch (_) {
                // object url 释放失败时忽略
            }
        }
    }
}

async function resolveBackgroundVideoPlaybackUrl(asset, options = {}) {
    const { token = 0, isStale = () => false } = options;

    if (isStale() || token !== backgroundVideoCycleToken) {
        return '';
    }

    const cacheKey = getBackgroundVideoCacheKey(asset);
    if (!cacheKey) return '';

    const cachedEntry = touchBackgroundVideoBlobCache(cacheKey);
    if (cachedEntry && cachedEntry.objectUrl) {
        return cachedEntry.objectUrl;
    }

    const apiUrl = buildBackgroundVideoBlobApiUrl(asset);
    const fallbackUrl = buildBackgroundAssetUrl(asset);
    const targetUrl = apiUrl || fallbackUrl;
    if (!targetUrl) return '';

    const response = await fetch(targetUrl, { cache: 'no-store' });
    if (!response.ok) {
        throw createAppError('APP-BG-VID-001', `背景视频读取失败，HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    if (isStale() || token !== backgroundVideoCycleToken) {
        return '';
    }

    const mimeType = inferBackgroundVideoMimeType(cacheKey);
    const blob = new Blob([arrayBuffer], { type: mimeType });
    const objectUrl = URL.createObjectURL(blob);

    if (isStale() || token !== backgroundVideoCycleToken) {
        try {
            URL.revokeObjectURL(objectUrl);
        } catch (_) {
            // object url 释放失败时忽略
        }
        return '';
    }

    backgroundVideoBlobUrlCache.set(cacheKey, {
        objectUrl,
        mimeType,
        fetchedAt: Date.now()
    });
    trimBackgroundVideoBlobCache(cacheKey);
    return objectUrl;
}

function getBackgroundTypeLabel(type) {
    return type === 'video'
        ? t('settings.background.option.video', '视频')
        : t('settings.background.option.image', '图片');
}

function syncBackgroundModeControl() {
    const toggle = document.getElementById('backgroundVideoModeToggle');
    if (toggle) {
        toggle.checked = currentBackgroundMode === BACKGROUND_MODE_VIDEO;
    }
}

function getBackgroundVideoNode() {
    const backgroundLayer = document.querySelector('.dynamic-background');
    if (!backgroundLayer) return null;
    const node = backgroundLayer.querySelector('.dynamic-background-video');
    return node instanceof HTMLVideoElement ? node : null;
}

function setCurrentBackgroundVideoTrack(asset, index, playlist = []) {
    currentBackgroundVideoTrackName = asset?.name || '';
    currentBackgroundVideoTrackDisplayName = getBackgroundDisplayName(asset) || currentBackgroundVideoTrackName;
    currentBackgroundVideoTrackIndex = Number.isInteger(index) ? index : -1;
    currentBackgroundVideoTrackList = Array.isArray(playlist) ? playlist.slice() : [];
}

function clearCurrentBackgroundVideoTrack() {
    currentBackgroundVideoTrackName = '';
    currentBackgroundVideoTrackDisplayName = '';
    currentBackgroundVideoTrackIndex = -1;
    currentBackgroundVideoTrackList = [];
    currentBackgroundVideoPaused = false;
    menuVideoProgressInputActive = false;
    backgroundVideoStepHandler = null;
}

function getMenuVideoIconSvg(iconType) {
    switch (iconType) {
        case 'prev':
            return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect class="icon-fill" x="3.6" y="4.5" width="2.8" height="15" rx="0.8"></rect><polygon class="icon-fill" points="18.2,5.5 9,12 18.2,18.5"></polygon><polygon class="icon-fill" points="22,5.5 12.8,12 22,18.5"></polygon></svg>';
        case 'next':
            return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect class="icon-fill" x="17.6" y="4.5" width="2.8" height="15" rx="0.8"></rect><polygon class="icon-fill" points="5.8,5.5 15,12 5.8,18.5"></polygon><polygon class="icon-fill" points="2,5.5 11.2,12 2,18.5"></polygon></svg>';
        case 'play':
            return '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon class="icon-fill" points="7,4.8 19.2,12 7,19.2"></polygon></svg>';
        case 'pause':
            return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect class="icon-fill" x="6.2" y="4.8" width="4.6" height="14.4" rx="1"></rect><rect class="icon-fill" x="13.2" y="4.8" width="4.6" height="14.4" rx="1"></rect></svg>';
        case 'repeat_single':
            return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 7.5h10.5a3 3 0 0 1 3 3v1.2"></path><path d="M18 5.8l2.3 2.3-2.3 2.3"></path><path d="M19.5 16.5H9a3 3 0 0 1-3-3v-1.2"></path><path d="M6 18.2l-2.3-2.3L6 13.6"></path><circle class="icon-fill" cx="12" cy="12" r="1.2"></circle></svg>';
        case 'repeat_playlist':
        default:
            return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 7.5h10.5a3 3 0 0 1 3 3v1.2"></path><path d="M18 5.8l2.3 2.3-2.3 2.3"></path><path d="M19.5 16.5H9a3 3 0 0 1-3-3v-1.2"></path><path d="M6 18.2l-2.3-2.3L6 13.6"></path></svg>';
    }
}

function setMenuVideoButtonIcon(button, iconType) {
    if (!(button instanceof HTMLButtonElement)) return;
    button.innerHTML = `<span class="menu-video-btn-icon" aria-hidden="true">${getMenuVideoIconSvg(iconType)}</span>`;
}

function formatMenuVideoTime(totalSeconds) {
    const safeSeconds = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;

    if (hours > 0) {
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function updateMenuVideoPlayerProgress(options = {}) {
    const { force = false } = options;
    const progressRange = document.getElementById('menuVideoProgressRange');
    const timeNode = document.getElementById('menuVideoTimeText');
    const videoNode = getBackgroundVideoNode();
    const isVideoMode = currentBackgroundMode === BACKGROUND_MODE_VIDEO;
    const hasPlayback = !!videoNode;
    const rawDuration = hasPlayback ? Number(videoNode.duration) : Number.NaN;
    const duration = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : 0;
    const rawCurrentTime = hasPlayback ? Number(videoNode.currentTime) : Number.NaN;
    const currentTime = Number.isFinite(rawCurrentTime) && rawCurrentTime > 0 ? rawCurrentTime : 0;

    if (progressRange) {
        const progressTitle = t('menu.video.progress_title', '视频进度');
        progressRange.max = String(MENU_VIDEO_PROGRESS_MAX);
        progressRange.setAttribute('title', progressTitle);
        progressRange.setAttribute('aria-label', progressTitle);

        const canSeek = isVideoMode && hasPlayback && duration > 0;
        progressRange.disabled = !canSeek;
        if (force || !menuVideoProgressInputActive) {
            const normalizedProgress = canSeek ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
            progressRange.value = String(Math.round(normalizedProgress * MENU_VIDEO_PROGRESS_MAX));
        }
    }

    if (!timeNode) return;

    if (!isVideoMode) {
        timeNode.textContent = '--:-- / --:--';
        return;
    }

    if (!hasPlayback) {
        timeNode.textContent = '00:00 / --:--';
        return;
    }

    if (!(duration > 0)) {
        timeNode.textContent = `${formatMenuVideoTime(currentTime)} / --:--`;
        return;
    }

    const safeCurrentTime = Math.min(currentTime, duration);
    timeNode.textContent = `${formatMenuVideoTime(safeCurrentTime)} / ${formatMenuVideoTime(duration)}`;
}

function seekBackgroundVideoByProgressValue(rawValue, options = {}) {
    const { finalize = false } = options;
    const videoNode = getBackgroundVideoNode();
    if (!videoNode || currentBackgroundMode !== BACKGROUND_MODE_VIDEO) {
        if (finalize) {
            updateMenuVideoPlayerProgress({ force: true });
        }
        return;
    }

    const duration = Number(videoNode.duration);
    if (!Number.isFinite(duration) || duration <= 0) {
        if (finalize) {
            updateMenuVideoPlayerProgress({ force: true });
        }
        return;
    }

    const parsedValue = Number.parseFloat(String(rawValue));
    const normalizedValue = Number.isFinite(parsedValue)
        ? Math.min(MENU_VIDEO_PROGRESS_MAX, Math.max(0, parsedValue))
        : 0;
    const nextTime = (normalizedValue / MENU_VIDEO_PROGRESS_MAX) * duration;
    const safeNextTime = Math.min(duration, Math.max(0, nextTime));
    try {
        if (typeof videoNode.fastSeek === 'function') {
            videoNode.fastSeek(safeNextTime);
        } else {
            videoNode.currentTime = safeNextTime;
        }
    } catch (_) {
        // fastSeek 不可用或失败时回退到 currentTime
        try {
            videoNode.currentTime = safeNextTime;
        } catch (_) {
            // 某些浏览器在元数据变更时可能临时拒绝 seek，忽略即可
        }
    }

    const progressRange = document.getElementById('menuVideoProgressRange');
    if (progressRange) {
        progressRange.value = String(Math.round((safeNextTime / duration) * MENU_VIDEO_PROGRESS_MAX));
    }

    const timeNode = document.getElementById('menuVideoTimeText');
    if (timeNode) {
        timeNode.textContent = `${formatMenuVideoTime(safeNextTime)} / ${formatMenuVideoTime(duration)}`;
    }

    if (finalize) {
        window.setTimeout(() => {
            if (getBackgroundVideoNode() !== videoNode) return;
            const currentTime = Number(videoNode.currentTime);
            if (Number.isFinite(currentTime) && Math.abs(currentTime - safeNextTime) > 0.45) {
                try {
                    videoNode.currentTime = safeNextTime;
                } catch (_) {
                    // 当前浏览器拒绝二次 seek 时忽略
                }
            }
            updateMenuVideoPlayerProgress({ force: false });
        }, MENU_VIDEO_SEEK_SYNC_DELAY_MS);
    }
}

function syncMenuVideoPlayerControls() {
    const panel = document.getElementById('menuVideoPlayer');
    const prevBtn = document.getElementById('menuVideoPrevBtn');
    const pauseBtn = document.getElementById('menuVideoPlayPauseBtn');
    const nextBtn = document.getElementById('menuVideoNextBtn');
    const repeatBtn = document.getElementById('menuVideoRepeatBtn');
    const volumeRange = document.getElementById('menuVideoVolumeRange');

    const isVideoMode = currentBackgroundMode === BACKGROUND_MODE_VIDEO;
    const hasTracks = getSelectableBackgroundAssets().filter(asset => getBackgroundAssetType(asset) === 'video').length > 0;
    const hasPlayback = !!getBackgroundVideoNode();
    const controlsEnabled = isVideoMode && hasTracks && hasPlayback;

    if (panel) {
        panel.classList.toggle('is-active', isVideoMode);
        panel.classList.toggle('is-disabled', !isVideoMode);
        panel.setAttribute('aria-hidden', isVideoMode ? 'false' : 'true');
    }

    if (prevBtn) {
        prevBtn.disabled = !controlsEnabled;
        const label = t('menu.video.prev_title', '上一条视频');
        prevBtn.setAttribute('title', label);
        prevBtn.setAttribute('aria-label', label);
        setMenuVideoButtonIcon(prevBtn, 'prev');
    }

    if (nextBtn) {
        nextBtn.disabled = !controlsEnabled;
        const label = t('menu.video.next_title', '下一条视频');
        nextBtn.setAttribute('title', label);
        nextBtn.setAttribute('aria-label', label);
        setMenuVideoButtonIcon(nextBtn, 'next');
    }

    if (pauseBtn) {
        pauseBtn.disabled = !controlsEnabled;
        const pauseTitle = currentBackgroundVideoPaused
            ? t('menu.video.play_title', '继续播放')
            : t('menu.video.pause_title', '暂停播放');
        pauseBtn.setAttribute('title', pauseTitle);
        pauseBtn.setAttribute('aria-label', pauseTitle);
        setMenuVideoButtonIcon(pauseBtn, currentBackgroundVideoPaused ? 'play' : 'pause');
    }

    if (repeatBtn) {
        repeatBtn.disabled = !controlsEnabled;
        const repeatTitle = currentBackgroundVideoLoop
            ? t('menu.video.repeat_playlist_title', '切换为单个循环')
            : t('menu.video.repeat_single_title', '切换为列表循环');
        repeatBtn.setAttribute('title', repeatTitle);
        repeatBtn.setAttribute('aria-label', repeatTitle);
        setMenuVideoButtonIcon(repeatBtn, currentBackgroundVideoLoop ? 'repeat_playlist' : 'repeat_single');
    }

    if (volumeRange) {
        volumeRange.disabled = !isVideoMode;
        volumeRange.value = String(Math.round(clampBackgroundVideoVolume(currentBackgroundVideoVolume, 0) * 100));
    }
}

function updateMenuVideoPlayerInfo() {
    const infoNode = document.getElementById('menuVideoInfo');
    if (!infoNode) return;

    const isVideoMode = currentBackgroundMode === BACKGROUND_MODE_VIDEO;
    const trackCount = getSelectableBackgroundAssets().filter(asset => getBackgroundAssetType(asset) === 'video').length;

    if (!isVideoMode) {
        infoNode.textContent = t('menu.video.disabled_hint', '仅视频模式可用');
        return;
    }

    if (trackCount === 0) {
        infoNode.textContent = t('menu.video.no_video', '未检测到视频资源');
        return;
    }

    if (!currentBackgroundVideoTrackDisplayName) {
        infoNode.textContent = t('menu.video.ready', '播放器已就绪');
        return;
    }

    infoNode.textContent = t('menu.video.now_playing', '正在播放：{name}', {
        name: currentBackgroundVideoTrackDisplayName
    });
}

function refreshMenuVideoPlayerUI() {
    syncMenuVideoPlayerControls();
    updateMenuVideoPlayerInfo();
    updateMenuVideoPlayerProgress();
}

function applyBackgroundVideoVolume(volume, options = {}) {
    const { persist = true, syncControl = true } = options;
    currentBackgroundVideoVolume = clampBackgroundVideoVolume(volume, currentBackgroundVideoVolume);

    const videoNode = getBackgroundVideoNode();
    if (videoNode) {
        videoNode.volume = currentBackgroundVideoVolume;
        videoNode.muted = currentBackgroundVideoVolume <= 0.0001;
    }

    if (persist) {
        try {
            localStorage.setItem(BACKGROUND_VIDEO_VOLUME_STORAGE_KEY, String(currentBackgroundVideoVolume));
        } catch (_) {
            // 本地存储不可用时忽略
        }
    }

    if (syncControl) {
        syncMenuVideoPlayerControls();
    }
    updateMenuVideoPlayerInfo();
    updateMenuVideoPlayerProgress();
}

function stepBackgroundVideo(offset) {
    if (currentBackgroundMode !== BACKGROUND_MODE_VIDEO) return;
    if (typeof backgroundVideoStepHandler !== 'function') return;
    backgroundVideoStepHandler(offset);
}

function toggleBackgroundVideoPause() {
    if (currentBackgroundMode !== BACKGROUND_MODE_VIDEO) return;
    const videoNode = getBackgroundVideoNode();
    if (!videoNode) return;

    if (videoNode.paused) {
        const playback = videoNode.play();
        if (playback && typeof playback.catch === 'function') {
            playback.catch(() => {});
        }
    } else {
        videoNode.pause();
    }
}

function toggleBackgroundVideoRepeatMode() {
    if (currentBackgroundMode !== BACKGROUND_MODE_VIDEO) return;
    applyBackgroundVideoLoop(!currentBackgroundVideoLoop, {
        persist: true,
        syncControl: true,
        reapply: true
    });
}

function ensureBackgroundVideoPlayerBinding() {
    if (backgroundVideoPlayerControlsBound) return;

    document.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;

        const actionButton = target.closest('#menuVideoPrevBtn, #menuVideoPlayPauseBtn, #menuVideoNextBtn, #menuVideoRepeatBtn');
        if (!(actionButton instanceof HTMLButtonElement)) return;

        if (actionButton.id === 'menuVideoPrevBtn') {
            stepBackgroundVideo(-1);
            return;
        }

        if (actionButton.id === 'menuVideoPlayPauseBtn') {
            toggleBackgroundVideoPause();
            return;
        }

        if (actionButton.id === 'menuVideoNextBtn') {
            stepBackgroundVideo(1);
            return;
        }

        if (actionButton.id === 'menuVideoRepeatBtn') {
            toggleBackgroundVideoRepeatMode();
        }
    }, true);

    const handleVolumeInput = (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement) || target.id !== 'menuVideoVolumeRange') {
            return;
        }
        applyBackgroundVideoVolume(Number.parseFloat(target.value) / 100, {
            persist: true,
            syncControl: false
        });
    };

    const handleProgressInput = (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement) || target.id !== 'menuVideoProgressRange') {
            return;
        }

        if (event.type === 'input') {
            menuVideoProgressInputActive = true;
            seekBackgroundVideoByProgressValue(target.value, { finalize: false });
        } else {
            menuVideoProgressInputActive = false;
            seekBackgroundVideoByProgressValue(target.value, { finalize: true });
        }
    };

    const handleProgressBlur = (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement) || target.id !== 'menuVideoProgressRange') {
            return;
        }
        menuVideoProgressInputActive = false;
        updateMenuVideoPlayerProgress({ force: false });
    };

    document.addEventListener('input', handleVolumeInput, true);
    document.addEventListener('change', handleVolumeInput, true);
    document.addEventListener('input', handleProgressInput, true);
    document.addEventListener('change', handleProgressInput, true);
    document.addEventListener('blur', handleProgressBlur, true);

    backgroundVideoPlayerControlsBound = true;
}

function syncBackgroundVideoLoopControl() {
    const toggle = document.getElementById('backgroundVideoLoopToggle');
    if (!toggle) return;
    toggle.checked = currentBackgroundVideoLoop;
    toggle.disabled = currentBackgroundMode !== BACKGROUND_MODE_VIDEO;
}

function updateBackgroundModeInfo() {
    const modeInfo = document.getElementById('backgroundModeInfo');
    if (!modeInfo) return;

    const modeLabel = currentBackgroundMode === BACKGROUND_MODE_VIDEO
        ? t('settings.background.mode.video', '视频模式')
        : t('settings.background.mode.image', '图片模式');

    modeInfo.textContent = t('settings.background.mode.current_prefix', '当前模式：{mode}', {
        mode: modeLabel
    });
}

function updateBackgroundVideoLoopInfo() {
    const infoNode = document.getElementById('backgroundVideoLoopInfo');
    if (!infoNode) return;

    if (currentBackgroundMode !== BACKGROUND_MODE_VIDEO) {
        infoNode.textContent = t('settings.background.video.loop_inactive', '仅视频模式可用');
        return;
    }

    infoNode.textContent = currentBackgroundVideoLoop
        ? t('settings.background.video.loop_on', '当前视频播放：循环播放')
        : t('settings.background.video.loop_off', '当前视频播放：单个循环');
}

function applyBackgroundVideoLoop(loopEnabled, options = {}) {
    const { persist = true, syncControl = true, reapply = true } = options;
    currentBackgroundVideoLoop = loopEnabled !== false;

    if (persist) {
        try {
            localStorage.setItem(BACKGROUND_VIDEO_LOOP_STORAGE_KEY, currentBackgroundVideoLoop ? '1' : '0');
        } catch (_) {
            // 本地存储不可用时忽略
        }
    }

    if (syncControl) {
        syncBackgroundVideoLoopControl();
    }
    renderBackgroundOptions();
    updateBackgroundVideoLoopInfo();
    refreshMenuVideoPlayerUI();

    if (reapply && currentBackgroundMode === BACKGROUND_MODE_VIDEO) {
        applyBackgroundSelection(currentBackgroundSelection, { persist: false, syncControl: true });
    }
}

function renderBackgroundOptions() {
    const backgroundSelect = document.getElementById('backgroundSelect');
    if (!backgroundSelect) return;

    backgroundSelect.innerHTML = '';

    const defaultOption = document.createElement('option');
    defaultOption.value = DEFAULT_BACKGROUND_OPTION;
    defaultOption.textContent = currentBackgroundMode === BACKGROUND_MODE_VIDEO
        ? (currentBackgroundVideoLoop
            ? t('settings.background.option.video_playlist', '视频顺序循环播放')
            : t('settings.background.option.video_playlist_once', '视频单个循环播放'))
        : t('settings.background.option.default', '默认动态背景');
    backgroundSelect.appendChild(defaultOption);

    getSelectableBackgroundAssets().forEach(asset => {
        const option = document.createElement('option');
        const assetType = getBackgroundAssetType(asset);
        const displayName = getBackgroundDisplayName(asset) || asset.name;
        option.value = asset.name;
        option.textContent = `${displayName} (${getBackgroundTypeLabel(assetType)})`;
        backgroundSelect.appendChild(option);
    });

    const selected = resolveBackgroundSelection(currentBackgroundSelection || getStoredBackgroundSelection());
    backgroundSelect.value = selected;
    backgroundSelect.disabled = false;
}

function updateBackgroundInfo() {
    const backgroundInfo = document.getElementById('backgroundInfo');
    if (!backgroundInfo) return;

    const selectableAssets = getSelectableBackgroundAssets();
    const detectedSuffix = t('settings.background.detected_count', '已识别 {count} 个资源', {
        count: selectableAssets.length
    });

    if (currentBackgroundMode === BACKGROUND_MODE_VIDEO) {
        if (selectableAssets.length === 0) {
            backgroundInfo.textContent = t('settings.background.empty_video', '未找到视频资源，将显示默认纯色背景。');
            return;
        }

        if (currentBackgroundSelection === DEFAULT_BACKGROUND_OPTION) {
            backgroundInfo.textContent = currentBackgroundVideoLoop
                ? t('settings.background.video.playing_prefix', '视频模式已启用，按顺序循环播放 {count} 条视频', {
                    count: selectableAssets.length
                })
                : t('settings.background.video.playing_once_prefix', '视频模式已启用，当前视频单个循环（共 {count} 条可切换）', {
                    count: selectableAssets.length
                });
            return;
        }

        const asset = selectableAssets.find(item => item.name === currentBackgroundSelection);
        if (!asset) {
            backgroundInfo.textContent = currentBackgroundVideoLoop
                ? t('settings.background.video.playing_prefix', '视频模式已启用，按顺序循环播放 {count} 条视频', {
                    count: selectableAssets.length
                })
                : t('settings.background.video.playing_once_prefix', '视频模式已启用，当前视频单个循环（共 {count} 条可切换）', {
                    count: selectableAssets.length
                });
            return;
        }

        const modeSuffix = currentBackgroundVideoLoop
            ? t('settings.background.video.single_loop_suffix', '指定视频循环播放')
            : t('settings.background.video.single_once_suffix', '指定视频单个循环');
        backgroundInfo.textContent = `${t('settings.background.current_prefix', '当前背景：{name}（{type}）', {
            name: getBackgroundDisplayName(asset) || asset.name,
            type: getBackgroundTypeLabel('video')
        })} | ${modeSuffix} | ${detectedSuffix}`;
        return;
    }

    if (selectableAssets.length === 0) {
        backgroundInfo.textContent = t('settings.background.empty_image', '未找到图片资源，将显示默认纯色背景。');
        return;
    }

    if (currentBackgroundSelection === DEFAULT_BACKGROUND_OPTION) {
        backgroundInfo.textContent = `${t('settings.background.current_default', '当前背景：默认动态背景')} | ${detectedSuffix}`;
        return;
    }

    const asset = selectableAssets.find(item => item.name === currentBackgroundSelection);
    if (!asset) {
        backgroundInfo.textContent = `${t('settings.background.current_default', '当前背景：默认动态背景')} | ${detectedSuffix}`;
        return;
    }

    const typeLabel = getBackgroundTypeLabel(getBackgroundAssetType(asset));
    backgroundInfo.textContent = `${t('settings.background.current_prefix', '当前背景：{name}（{type}）', {
        name: getBackgroundDisplayName(asset) || asset.name,
        type: typeLabel
    })} | ${detectedSuffix}`;
}

function clearBackgroundVideo(backgroundLayer) {
    backgroundVideoCycleToken += 1;
    clearCurrentBackgroundVideoTrack();
    clearBackgroundVideoBlobCache();
    if (!backgroundLayer) {
        refreshMenuVideoPlayerUI();
        return;
    }
    backgroundLayer.querySelectorAll('.dynamic-background-video').forEach(videoNode => {
        try {
            videoNode.pause();
            videoNode.removeAttribute('src');
            videoNode.load();
        } catch (_) {
            // 节点销毁阶段忽略异常
        }
        videoNode.remove();
    });
    refreshMenuVideoPlayerUI();
}

function applySolidBackgroundFallback(backgroundLayer) {
    if (!backgroundLayer) return;
    backgroundLayer.classList.add('background-solid-fallback');
    backgroundLayer.style.backgroundImage = 'none';
}

function startBackgroundVideoPlayback(backgroundLayer, preferredName = '', loopEnabled = true) {
    if (!backgroundLayer) return;
    const playlist = getSelectableBackgroundAssets().filter(asset => getBackgroundAssetType(asset) === 'video');
    if (playlist.length === 0) {
        applySolidBackgroundFallback(backgroundLayer);
        clearCurrentBackgroundVideoTrack();
        refreshMenuVideoPlayerUI();
        return;
    }

    const token = ++backgroundVideoCycleToken;
    let currentIndex = playlist.findIndex(asset => asset.name === preferredName);
    if (currentIndex < 0) {
        currentIndex = 0;
    }
    let playRequestSequence = 0;

    const videoNode = document.createElement('video');
    videoNode.className = 'dynamic-background-video';
    videoNode.autoplay = true;
    videoNode.loop = false;
    videoNode.muted = true;
    videoNode.playsInline = true;
    videoNode.preload = 'metadata';
    videoNode.setAttribute('aria-hidden', 'true');
    const syncProgress = (force = false) => {
        if (token !== backgroundVideoCycleToken) return;
        updateMenuVideoPlayerProgress({ force });
    };

    const playAt = async (index) => {
        if (token !== backgroundVideoCycleToken || playlist.length === 0) return;

        const requestId = ++playRequestSequence;
        currentIndex = ((index % playlist.length) + playlist.length) % playlist.length;
        const targetAsset = playlist[currentIndex];
        if (!targetAsset) return;

        setCurrentBackgroundVideoTrack(targetAsset, currentIndex, playlist);
        currentBackgroundVideoPaused = false;
        menuVideoProgressInputActive = false;

        videoNode.loop = loopEnabled !== true;
        videoNode.volume = currentBackgroundVideoVolume;
        videoNode.muted = currentBackgroundVideoVolume <= 0.0001;

        let playbackUrl = '';
        try {
            playbackUrl = await resolveBackgroundVideoPlaybackUrl(targetAsset, {
                token,
                isStale: () => token !== backgroundVideoCycleToken || requestId !== playRequestSequence
            });
        } catch (error) {
            console.warn('背景视频预加载失败，回退为直接播放：', error);
            playbackUrl = '';
        }

        if (token !== backgroundVideoCycleToken || requestId !== playRequestSequence) return;

        if (!playbackUrl) {
            playbackUrl = buildBackgroundAssetUrl(targetAsset);
        }
        if (!playbackUrl) {
            if (playlist.length <= 1) {
                applySolidBackgroundFallback(backgroundLayer);
                refreshMenuVideoPlayerUI();
            } else {
                void playAt(currentIndex + 1);
            }
            return;
        }

        try {
            videoNode.pause();
            videoNode.src = playbackUrl;
            videoNode.load();
        } catch (_) {
            // 切换视频源阶段忽略异常，后续通过 error 事件兜底
        }

        const playback = videoNode.play();
        if (playback && typeof playback.catch === 'function') {
            playback.catch(() => {
                // 自动播放策略下带声音可能被拦截，降级为静音播放确保画面可见
                videoNode.muted = true;
                const retry = videoNode.play();
                if (retry && typeof retry.catch === 'function') {
                    retry.catch(() => {});
                }
            });
        }

        refreshMenuVideoPlayerUI();
        syncProgress(true);
    };

    backgroundVideoStepHandler = (offset) => {
        if (token !== backgroundVideoCycleToken) return false;
        const delta = Number.parseInt(String(offset), 10);
        if (!Number.isFinite(delta) || delta === 0) return false;
        void playAt(currentIndex + delta);
        return true;
    };

    videoNode.addEventListener('play', () => {
        if (token !== backgroundVideoCycleToken) return;
        currentBackgroundVideoPaused = false;
        refreshMenuVideoPlayerUI();
        syncProgress(true);
    });

    videoNode.addEventListener('pause', () => {
        if (token !== backgroundVideoCycleToken) return;
        currentBackgroundVideoPaused = true;
        refreshMenuVideoPlayerUI();
        syncProgress(true);
    });

    videoNode.addEventListener('loadedmetadata', () => {
        syncProgress(true);
    });

    videoNode.addEventListener('durationchange', () => {
        syncProgress(true);
    });

    videoNode.addEventListener('timeupdate', () => {
        syncProgress(false);
    });

    videoNode.addEventListener('seeking', () => {
        syncProgress(true);
    });

    videoNode.addEventListener('seeked', () => {
        syncProgress(true);
    });

    if (loopEnabled === true) {
        videoNode.addEventListener('ended', () => {
            void playAt(currentIndex + 1);
        });
    } else {
        videoNode.addEventListener('ended', () => {
            syncProgress(true);
        });
    }

    videoNode.addEventListener('error', () => {
        if (token !== backgroundVideoCycleToken) return;
        if (playlist.length <= 1) {
            applySolidBackgroundFallback(backgroundLayer);
            refreshMenuVideoPlayerUI();
            return;
        }
        void playAt(currentIndex + 1);
    });

    backgroundLayer.appendChild(videoNode);
    backgroundLayer.classList.add('background-custom-video');

    void playAt(currentIndex);
}

function startBackgroundSingleVideo(backgroundLayer, assetName, loopEnabled) {
    startBackgroundVideoPlayback(backgroundLayer, assetName, loopEnabled);
}

function startBackgroundVideoPlaylist(backgroundLayer, preferredName = '', loopEnabled = true) {
    startBackgroundVideoPlayback(backgroundLayer, preferredName, loopEnabled);
}

function applyBackgroundSelection(value, options = {}) {
    const { persist = true, syncControl = true, customImageUrl = '', skipVisualApply = false } = options;
    const resolvedValue = resolveBackgroundSelection(value);
    currentBackgroundSelection = resolvedValue;

    if (!skipVisualApply) {
        const backgroundLayer = document.querySelector('.dynamic-background');
        if (backgroundLayer) {
            clearBackgroundVideo(backgroundLayer);
            backgroundLayer.classList.remove('background-custom-image', 'background-custom-video', 'background-solid-fallback');
            backgroundLayer.style.backgroundImage = '';

            if (currentBackgroundMode === BACKGROUND_MODE_VIDEO) {
                if (resolvedValue === DEFAULT_BACKGROUND_OPTION) {
                    startBackgroundVideoPlaylist(backgroundLayer, '', currentBackgroundVideoLoop);
                } else {
                    startBackgroundSingleVideo(backgroundLayer, resolvedValue, currentBackgroundVideoLoop);
                }
            } else if (resolvedValue === DEFAULT_BACKGROUND_OPTION) {
                if (getSelectableBackgroundAssets().length === 0) {
                    applySolidBackgroundFallback(backgroundLayer);
                }
            } else {
                const asset = findBackgroundAssetByName(resolvedValue);
                const fallbackUrl = asset ? buildBackgroundAssetUrl(asset) : '';
                const imageUrl = String(customImageUrl || getStoredCustomBackgroundUrl() || fallbackUrl).trim();
                if (imageUrl) {
                    backgroundLayer.style.backgroundImage = `url("${imageUrl}")`;
                    backgroundLayer.classList.add('background-custom-image');
                } else {
                    applySolidBackgroundFallback(backgroundLayer);
                }
            }
        }
    }

    if (persist) {
        try {
            localStorage.setItem(getBackgroundSelectionStorageKey(), resolvedValue);
        } catch (_) {
            // 本地存储不可用时忽略
        }
    }

    if (currentBackgroundMode === BACKGROUND_MODE_IMAGE) {
        if (resolvedValue === DEFAULT_BACKGROUND_OPTION) {
            saveStoredCustomBackgroundUrl('');
        } else if (typeof customImageUrl === 'string' && customImageUrl.trim()) {
            saveStoredCustomBackgroundUrl(customImageUrl.trim());
        }
    }

    if (syncControl) {
        const backgroundSelect = document.getElementById('backgroundSelect');
        if (backgroundSelect) {
            const hasOption = Array.from(backgroundSelect.options).some(option => option.value === resolvedValue);
            backgroundSelect.value = hasOption ? resolvedValue : DEFAULT_BACKGROUND_OPTION;
        }
    }

    updateBackgroundInfo();
    refreshMenuVideoPlayerUI();
}

async function fetchBackgroundAssets(mode = currentBackgroundMode) {
    const normalizedMode = normalizeBackgroundMode(mode);
    const query = new URLSearchParams({ mode: normalizedMode }).toString();
    const response = await fetch(`${BACKGROUND_FILES_API}?${query}`, { cache: 'no-store' });
    if (!response.ok) {
        throw createAppError('APP-BG-001', `读取背景资源失败，HTTP ${response.status}`);
    }

    const result = await response.json();
    if (!result || result.success !== true) {
        throw createAppError('APP-BG-002', `读取背景资源失败: ${result?.error || '响应标记为失败'}`);
    }

    if (!Array.isArray(result.files)) {
        throw createAppError('APP-BG-003', '读取背景资源失败: 返回格式不正确（files不是数组）');
    }

    const parsedFiles = result.files.map(item => ({
        name: String(item?.name || '').trim().replace(/\\/g, '/'),
        displayName: String(item?.display_name || item?.displayName || item?.name || '').trim(),
        type: String(item?.type || '').trim().toLowerCase(),
        url: String(item?.url || '').trim()
    })).filter(item => item.name);

    if (normalizedMode === BACKGROUND_MODE_VIDEO) {
        parsedFiles.sort((a, b) => a.name.localeCompare(b.name, 'en'));
    }
    return parsedFiles;
}

async function applyBackgroundMode(mode, options = {}) {
    const { persist = true, syncControl = true, silent = true } = options;
    currentBackgroundMode = normalizeBackgroundMode(mode);

    if (persist) {
        try {
            localStorage.setItem(BACKGROUND_MODE_STORAGE_KEY, currentBackgroundMode);
        } catch (_) {
            // 本地存储不可用时忽略
        }
    }

    if (syncControl) {
        syncBackgroundModeControl();
    }
    syncBackgroundVideoLoopControl();
    updateBackgroundVideoLoopInfo();
    refreshMenuVideoPlayerUI();

    await refreshBackgroundAssets({ silent });
}

function ensureBackgroundModeBinding() {
    if (backgroundModeControlsBound) return;

    document.addEventListener('change', async (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement) || target.id !== 'backgroundVideoModeToggle') {
            return;
        }

        const nextMode = target.checked ? BACKGROUND_MODE_VIDEO : BACKGROUND_MODE_IMAGE;
        try {
            if (nextMode === BACKGROUND_MODE_VIDEO) {
                const videoAssets = await fetchBackgroundAssets(BACKGROUND_MODE_VIDEO);
                const hasVideoAssets = videoAssets.some(asset => getBackgroundAssetType(asset) === 'video');
                if (!hasVideoAssets) {
                    target.checked = false;
                    await applyBackgroundMode(BACKGROUND_MODE_IMAGE, {
                        persist: true,
                        syncControl: true,
                        silent: true
                    });

                    const guideTitle = t('settings.background.video.empty_guide_title', '未检测到视频资源');
                    const guideMessage = t(
                        'settings.background.video.empty_guide_message',
                        '请先将视频文件放入 XMao_Core/Background/Video 文件夹（支持 mp4 / webm / ogg），再重新开启视频模式。'
                    );
                    if (typeof customAlert !== 'undefined' && customAlert) {
                        if (typeof customAlert.countdownConfirm === 'function') {
                            await customAlert.countdownConfirm(guideTitle, guideMessage, {
                                seconds: 3,
                                buttonText: t('common.confirm', '确定')
                            });
                        } else if (typeof customAlert.show === 'function') {
                            customAlert.show(guideTitle, guideMessage);
                        }
                    }
                    return;
                }
            }

            await applyBackgroundMode(nextMode, { persist: true, syncControl: false, silent: false });
        } catch (error) {
            console.error('背景模式切换失败:', error);
            target.checked = currentBackgroundMode === BACKGROUND_MODE_VIDEO;
            if (typeof customAlert !== 'undefined' && customAlert && typeof customAlert.toast === 'function') {
                customAlert.toast(
                    t('settings.background.load_failed_title', '背景资源读取失败'),
                    formatAppError(error),
                    1400
                );
            }
        }
    }, true);

    backgroundModeControlsBound = true;
}

function ensureBackgroundVideoLoopBinding() {
    if (backgroundVideoLoopControlsBound) return;

    document.addEventListener('change', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement) || target.id !== 'backgroundVideoLoopToggle') {
            return;
        }

        applyBackgroundVideoLoop(target.checked, { persist: true, syncControl: false, reapply: true });
    }, true);

    backgroundVideoLoopControlsBound = true;
}

async function refreshBackgroundAssets(options = {}) {
    const { silent = false, preservePlayback = false } = options;
    const backgroundInfo = document.getElementById('backgroundInfo');
    if (backgroundInfo) {
        backgroundInfo.textContent = t('settings.background.loading', '背景资源加载中...');
    }

    try {
        backgroundAssets = await fetchBackgroundAssets(currentBackgroundMode);
        renderBackgroundOptions();
        const requestedSelection = currentBackgroundMode === BACKGROUND_MODE_VIDEO
            ? resolveBackgroundSelection(currentBackgroundSelection || getStoredBackgroundSelection())
            : resolveBackgroundSelection(getStoredBackgroundSelection());
        const shouldSkipVisualApply = preservePlayback &&
            currentBackgroundMode === BACKGROUND_MODE_VIDEO &&
            !!getBackgroundVideoNode() &&
            requestedSelection === currentBackgroundSelection;

        applyBackgroundSelection(requestedSelection, {
            persist: true,
            syncControl: true,
            skipVisualApply: shouldSkipVisualApply
        });
        updateBackgroundModeInfo();
        updateBackgroundVideoLoopInfo();
    } catch (error) {
        backgroundAssets = [];
        renderBackgroundOptions();
        applyBackgroundSelection(DEFAULT_BACKGROUND_OPTION, { persist: true, syncControl: true });
        updateBackgroundModeInfo();
        updateBackgroundVideoLoopInfo();

        const infoNode = document.getElementById('backgroundInfo');
        if (infoNode) {
            infoNode.textContent = t('settings.background.load_failed', '背景资源读取失败: {error}', {
                error: formatAppError(error)
            });
        }

        if (!silent && typeof customAlert !== 'undefined' && customAlert && typeof customAlert.toast === 'function') {
            customAlert.toast(
                t('settings.background.load_failed_title', '背景资源读取失败'),
                formatAppError(error),
                1400
            );
        }
    }
}

function getBackgroundCropElements() {
    return {
        modal: document.getElementById('backgroundCropModal'),
        source: document.getElementById('backgroundCropSource'),
        workspace: document.getElementById('backgroundCropWorkspace'),
        image: document.getElementById('backgroundCropImage'),
        stage: document.getElementById('backgroundCropStage'),
        rect: document.getElementById('backgroundCropRect'),
        info: document.getElementById('backgroundCropInfo'),
        confirm: document.getElementById('backgroundCropConfirm'),
        cancel: document.getElementById('backgroundCropCancel'),
        close: document.getElementById('backgroundCropClose')
    };
}

function updateBackgroundCropInfo(message) {
    const { info } = getBackgroundCropElements();
    if (info) {
        info.textContent = message;
    }
}

function renderBackgroundCropRect() {
    const { rect } = getBackgroundCropElements();
    if (!rect) return;

    rect.style.left = `${backgroundCropRect.x}px`;
    rect.style.top = `${backgroundCropRect.y}px`;
    rect.style.width = `${backgroundCropRect.width}px`;
    rect.style.height = `${backgroundCropRect.height}px`;
}

function resetBackgroundCropRect() {
    const stageWidth = backgroundCropStageSize.width;
    const stageHeight = backgroundCropStageSize.height;
    if (stageWidth <= 0 || stageHeight <= 0) return;

    const insetX = Math.max(16, Math.floor(stageWidth * 0.1));
    const insetY = Math.max(16, Math.floor(stageHeight * 0.1));
    const width = Math.min(stageWidth, Math.max(BACKGROUND_CROP_MIN_SIZE, stageWidth - insetX * 2));
    const height = Math.min(stageHeight, Math.max(BACKGROUND_CROP_MIN_SIZE, stageHeight - insetY * 2));

    backgroundCropRect = {
        x: Math.max(0, Math.floor((stageWidth - width) / 2)),
        y: Math.max(0, Math.floor((stageHeight - height) / 2)),
        width,
        height
    };
    renderBackgroundCropRect();
}

function layoutBackgroundCropStage(keepRelativeRect = true) {
    const { workspace, image, stage } = getBackgroundCropElements();
    if (!workspace || !image || !stage) return;
    if (!image.naturalWidth || !image.naturalHeight) return;

    const workspaceWidth = workspace.clientWidth;
    const workspaceHeight = workspace.clientHeight;
    if (!workspaceWidth || !workspaceHeight) return;

    const imageRatio = image.naturalWidth / image.naturalHeight;
    const workspaceRatio = workspaceWidth / workspaceHeight;
    let drawWidth = workspaceWidth;
    let drawHeight = workspaceHeight;
    let drawX = 0;
    let drawY = 0;

    if (imageRatio > workspaceRatio) {
        drawHeight = Math.floor(workspaceWidth / imageRatio);
        drawY = Math.floor((workspaceHeight - drawHeight) / 2);
    } else {
        drawWidth = Math.floor(workspaceHeight * imageRatio);
        drawX = Math.floor((workspaceWidth - drawWidth) / 2);
    }

    const oldStage = { ...backgroundCropStageSize };
    backgroundCropStageSize = { width: drawWidth, height: drawHeight };

    stage.style.left = `${drawX}px`;
    stage.style.top = `${drawY}px`;
    stage.style.width = `${drawWidth}px`;
    stage.style.height = `${drawHeight}px`;

    if (
        keepRelativeRect &&
        oldStage.width > 0 &&
        oldStage.height > 0 &&
        backgroundCropRect.width > 0 &&
        backgroundCropRect.height > 0
    ) {
        backgroundCropRect = {
            x: Math.round((backgroundCropRect.x / oldStage.width) * drawWidth),
            y: Math.round((backgroundCropRect.y / oldStage.height) * drawHeight),
            width: Math.round((backgroundCropRect.width / oldStage.width) * drawWidth),
            height: Math.round((backgroundCropRect.height / oldStage.height) * drawHeight)
        };
        backgroundCropRect.width = Math.max(BACKGROUND_CROP_MIN_SIZE, backgroundCropRect.width);
        backgroundCropRect.height = Math.max(BACKGROUND_CROP_MIN_SIZE, backgroundCropRect.height);
        backgroundCropRect.x = clampNumber(backgroundCropRect.x, 0, Math.max(0, drawWidth - backgroundCropRect.width), 0);
        backgroundCropRect.y = clampNumber(backgroundCropRect.y, 0, Math.max(0, drawHeight - backgroundCropRect.height), 0);
        renderBackgroundCropRect();
    } else {
        resetBackgroundCropRect();
    }
}

function closeBackgroundCropModal(result = null) {
    const { modal, image } = getBackgroundCropElements();
    if (modal) {
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
    }
    if (image) {
        image.removeAttribute('src');
    }

    backgroundCropDrag = null;
    backgroundCropStageSize = { width: 0, height: 0 };
    backgroundCropRect = { x: 0, y: 0, width: 0, height: 0 };

    const pendingSession = backgroundCropSession;
    backgroundCropSession = null;
    if (pendingSession && typeof pendingSession.resolve === 'function') {
        pendingSession.resolve(result);
    }
}

function openBackgroundCropModal(asset, previousSelection) {
    ensureBackgroundCropBinding();
    const { modal, image, source, confirm, cancel, close } = getBackgroundCropElements();

    if (!modal || !image || !source || !confirm || !cancel) {
        return Promise.resolve(null);
    }

    return new Promise(resolve => {
        backgroundCropSession = {
            asset,
            previousSelection,
            resolve,
            saving: false
        };

        source.textContent = t('settings.background.crop.source_prefix', '源文件：{name}', {
            name: getBackgroundDisplayName(asset) || asset.name
        });
        updateBackgroundCropInfo(t('settings.background.crop.loading', '正在载入图片，请稍候...'));

        confirm.disabled = false;
        cancel.disabled = false;
        if (close) {
            close.disabled = false;
        }
        modal.classList.add('show');
        modal.setAttribute('aria-hidden', 'false');

        const assetUrl = buildBackgroundAssetUrl(asset);
        const cacheBypass = assetUrl.includes('?') ? '&' : '?';
        image.src = `${assetUrl}${cacheBypass}crop=${Date.now()}`;
    });
}

function calculateMovedCropRect(startRect, dx, dy) {
    const stageWidth = backgroundCropStageSize.width;
    const stageHeight = backgroundCropStageSize.height;
    return {
        x: Math.round(clampNumber(startRect.x + dx, 0, Math.max(0, stageWidth - startRect.width), startRect.x)),
        y: Math.round(clampNumber(startRect.y + dy, 0, Math.max(0, stageHeight - startRect.height), startRect.y)),
        width: startRect.width,
        height: startRect.height
    };
}

function calculateResizedCropRect(startRect, handle, dx, dy) {
    const stageWidth = backgroundCropStageSize.width;
    const stageHeight = backgroundCropStageSize.height;
    const moveLeft = handle.includes('w');
    const moveRight = handle.includes('e');
    const moveTop = handle.includes('n');
    const moveBottom = handle.includes('s');

    let left = startRect.x;
    let top = startRect.y;
    let right = startRect.x + startRect.width;
    let bottom = startRect.y + startRect.height;

    if (moveLeft) {
        left = clampNumber(left + dx, 0, right - BACKGROUND_CROP_MIN_SIZE, left);
    }
    if (moveRight) {
        right = clampNumber(right + dx, left + BACKGROUND_CROP_MIN_SIZE, stageWidth, right);
    }
    if (moveTop) {
        top = clampNumber(top + dy, 0, bottom - BACKGROUND_CROP_MIN_SIZE, top);
    }
    if (moveBottom) {
        bottom = clampNumber(bottom + dy, top + BACKGROUND_CROP_MIN_SIZE, stageHeight, bottom);
    }

    return {
        x: Math.round(left),
        y: Math.round(top),
        width: Math.round(right - left),
        height: Math.round(bottom - top)
    };
}

function handleBackgroundCropPointerDown(event) {
    if (!backgroundCropSession) return;
    const { rect } = getBackgroundCropElements();
    if (!rect) return;

    const handleNode = event.target.closest('[data-handle]');
    const mode = handleNode ? String(handleNode.dataset.handle || '').trim() : 'move';
    if (!mode) return;

    if (event.target !== rect && !handleNode && !rect.contains(event.target)) {
        return;
    }

    backgroundCropDrag = {
        mode,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startRect: { ...backgroundCropRect }
    };

    event.preventDefault();
}

function handleBackgroundCropPointerMove(event) {
    if (!backgroundCropDrag) return;
    const dx = event.clientX - backgroundCropDrag.startClientX;
    const dy = event.clientY - backgroundCropDrag.startClientY;

    if (backgroundCropDrag.mode === 'move') {
        backgroundCropRect = calculateMovedCropRect(backgroundCropDrag.startRect, dx, dy);
    } else {
        backgroundCropRect = calculateResizedCropRect(backgroundCropDrag.startRect, backgroundCropDrag.mode, dx, dy);
    }

    renderBackgroundCropRect();
    event.preventDefault();
}

function handleBackgroundCropPointerUp() {
    if (backgroundCropDrag) {
        backgroundCropDrag = null;
    }
}

function ensureBackgroundCropBinding() {
    if (backgroundCropModalBound) return;
    const elements = getBackgroundCropElements();
    if (!elements.modal || !elements.image || !elements.rect) return;

    elements.image.addEventListener('load', () => {
        layoutBackgroundCropStage(false);
        updateBackgroundCropInfo(t('settings.background.crop.tip', '拖拽或拉伸裁剪框，确认后会保存为新的壁纸文件，不修改原图。'));
    });

    elements.rect.addEventListener('pointerdown', handleBackgroundCropPointerDown);
    window.addEventListener('pointermove', handleBackgroundCropPointerMove);
    window.addEventListener('pointerup', handleBackgroundCropPointerUp);
    window.addEventListener('resize', () => {
        if (backgroundCropSession) {
            layoutBackgroundCropStage(true);
        }
    });

    if (elements.cancel) {
        elements.cancel.addEventListener('click', () => closeBackgroundCropModal(null));
    }
    if (elements.close) {
        elements.close.addEventListener('click', () => closeBackgroundCropModal(null));
    }
    if (elements.modal) {
        elements.modal.addEventListener('click', (event) => {
            if (event.target === elements.modal) {
                closeBackgroundCropModal(null);
            }
        });
    }
    if (elements.confirm) {
        elements.confirm.addEventListener('click', async () => {
            if (!backgroundCropSession || backgroundCropSession.saving) return;
            backgroundCropSession.saving = true;
            elements.confirm.disabled = true;
            elements.cancel.disabled = true;
            if (elements.close) {
                elements.close.disabled = true;
            }
            updateBackgroundCropInfo(t('settings.background.crop.saving', '正在保存裁剪结果...'));

            try {
                const dataUrl = createCroppedBackgroundDataUrl();
                const savedFile = await saveCroppedBackgroundImage(backgroundCropSession.asset.name, dataUrl);
                closeBackgroundCropModal({ savedFile });
            } catch (error) {
                updateBackgroundCropInfo(t('settings.background.crop.failed', '裁剪保存失败：{error}', {
                    error: formatAppError(error)
                }));
                if (typeof customAlert !== 'undefined' && customAlert && typeof customAlert.toast === 'function') {
                    customAlert.toast(
                        t('settings.background.crop.save_failed_title', '保存裁剪背景失败'),
                        formatAppError(error),
                        1400
                    );
                }
                if (backgroundCropSession) {
                    backgroundCropSession.saving = false;
                }
                elements.confirm.disabled = false;
                elements.cancel.disabled = false;
                if (elements.close) {
                    elements.close.disabled = false;
                }
            }
        });
    }

    backgroundCropModalBound = true;
}

function createCroppedBackgroundDataUrl() {
    const { image } = getBackgroundCropElements();
    if (!image || !image.naturalWidth || !image.naturalHeight) {
        throw createAppError('APP-BG-010', t('settings.background.crop.no_image', '未加载可裁剪图片'));
    }

    const stageWidth = backgroundCropStageSize.width;
    const stageHeight = backgroundCropStageSize.height;
    if (!stageWidth || !stageHeight) {
        throw createAppError('APP-BG-011', t('settings.background.crop.invalid', '裁剪区域无效'));
    }

    const scaleX = image.naturalWidth / stageWidth;
    const scaleY = image.naturalHeight / stageHeight;
    const sx = Math.max(0, Math.floor(backgroundCropRect.x * scaleX));
    const sy = Math.max(0, Math.floor(backgroundCropRect.y * scaleY));
    const sw = Math.max(1, Math.floor(backgroundCropRect.width * scaleX));
    const sh = Math.max(1, Math.floor(backgroundCropRect.height * scaleY));

    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const context = canvas.getContext('2d');
    if (!context) {
        throw createAppError('APP-BG-012', t('settings.background.crop.invalid', '裁剪区域无效'));
    }

    context.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
    return canvas.toDataURL('image/png');
}

async function saveCroppedBackgroundImage(sourceName, imageData) {
    const response = await fetch(BACKGROUND_CROP_API, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            source_name: sourceName,
            image_data: imageData
        })
    });

    if (!response.ok) {
        throw createAppError('APP-BG-020', `保存裁剪背景失败，HTTP ${response.status}`);
    }

    const result = await response.json();
    if (!result || result.success !== true || !result.file) {
        throw createAppError('APP-BG-021', `保存裁剪背景失败: ${result?.error || '响应标记为失败'}`);
    }

    return result.file;
}

async function handleBackgroundSelectionRequest(targetSelect, requestedValue) {
    const nextValue = resolveBackgroundSelection(requestedValue);
    if (nextValue === currentBackgroundSelection) {
        if (targetSelect) {
            targetSelect.value = currentBackgroundSelection;
        }
        return;
    }

    if (nextValue === DEFAULT_BACKGROUND_OPTION) {
        applyBackgroundSelection(DEFAULT_BACKGROUND_OPTION, { persist: true, syncControl: true });
        return;
    }

    const asset = findBackgroundAssetByName(nextValue);
    if (!asset) {
        applyBackgroundSelection(DEFAULT_BACKGROUND_OPTION, { persist: true, syncControl: true });
        return;
    }

    if (currentBackgroundMode === BACKGROUND_MODE_VIDEO) {
        applyBackgroundSelection(nextValue, { persist: true, syncControl: true });
        return;
    }

    // 图片模式：每次切换都必须先裁剪再应用
    const cropResult = await openBackgroundCropModal(asset, currentBackgroundSelection);
    const savedUrl = String(cropResult?.savedFile?.url || '').trim();
    if (!savedUrl) {
        if (targetSelect) {
            targetSelect.value = currentBackgroundSelection;
        }
        return;
    }

    applyBackgroundSelection(nextValue, {
        persist: true,
        syncControl: true,
        customImageUrl: savedUrl
    });
}

function ensureBackgroundBinding() {
    if (backgroundControlsBound) return;

    document.addEventListener('change', async (event) => {
        const target = event.target;
        if (!target || target.id !== 'backgroundSelect') {
            return;
        }
        if (backgroundSelectionInFlight) {
            return;
        }

        backgroundSelectionInFlight = true;
        try {
            await handleBackgroundSelectionRequest(target, target.value);
        } catch (error) {
            console.error('背景切换失败:', error);
            target.value = currentBackgroundSelection;
            if (typeof customAlert !== 'undefined' && customAlert && typeof customAlert.toast === 'function') {
                customAlert.toast(
                    t('settings.background.load_failed_title', '背景资源读取失败'),
                    formatAppError(error),
                    1400
                );
            }
        } finally {
            backgroundSelectionInFlight = false;
        }
    }, true);

    document.addEventListener('click', (event) => {
        const target = event.target;
        if (!target || target.id !== 'refreshBackgroundBtn') {
            return;
        }
        refreshBackgroundAssets({ silent: false }).catch(() => {});
    }, true);

    backgroundControlsBound = true;
}

async function initAppearanceSettings() {
    currentGlassSettings = loadStoredGlassSettings();
    applyGlassSettings(currentGlassSettings, { persist: false, syncControl: true });
    ensureGlassControlsBinding();
    applyLayoutMode(resolveStoredLayoutMode(), { persist: false, syncControl: true });
    ensureLayoutModeBinding();
    currentFontColor = loadStoredFontColor();
    applyGlobalFontColor(currentFontColor, { persist: false, syncControl: true });
    ensureFontColorBinding();
    currentFontOutline = loadStoredFontOutline();
    applyGlobalFontOutline(currentFontOutline, { persist: false, syncControl: true });
    ensureFontOutlineBinding();
    currentBackgroundMode = resolveStoredBackgroundMode();
    currentBackgroundVideoLoop = resolveStoredBackgroundVideoLoop();
    currentBackgroundVideoVolume = resolveStoredBackgroundVideoVolume();
    syncBackgroundModeControl();
    syncBackgroundVideoLoopControl();
    updateBackgroundVideoLoopInfo();
    ensureBackgroundVideoPlayerBinding();
    applyBackgroundVideoVolume(currentBackgroundVideoVolume, { persist: false, syncControl: true });
    ensureBackgroundModeBinding();
    ensureBackgroundVideoLoopBinding();
    ensureBackgroundCropBinding();
    ensureBackgroundBinding();
    await applyBackgroundMode(currentBackgroundMode, { persist: false, syncControl: true, silent: true });
    refreshMenuVideoPlayerUI();
}

// 初始化DOM元素
function initDOM() {
    navMenuPopup = document.getElementById('navMenuPopup');
    navMenuToggle = document.getElementById('navMenuToggle');
    mainContent = document.getElementById('mainContent');
    navItems = document.querySelectorAll('.nav-item');
    pages = document.querySelectorAll('.page'); // 重新获取所有页面元素
    themeRadios = document.querySelectorAll('input[name="theme"]');
    body = document.body;
    
    // 事件监听器 - 在DOM元素初始化后添加
    if (navMenuToggle) {
        // 导航菜单按钮点击事件
        navMenuToggle.addEventListener('click', () => {
            // 检查是否在介绍页面
            if (window.isIntroPageVisible) {
                const introPage = document.getElementById('introPage');
                const mainContent = document.getElementById('mainContent');
                
                if (introPage && mainContent) {
                    // 隐藏介绍页面，显示主内容
                    introPage.style.display = 'none';
                    mainContent.style.display = 'block';
                    // 初始化人员管理功能
                    initPeopleManagement();
                }
                
                // 更新状态
                window.isIntroPageVisible = false;
            }
            
            // 显示导航菜单
            navMenuPopup.classList.toggle('open');
        });
    }
    
    // 导航项点击事件
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = item.dataset.page;
            switchPage(pageId);
        });
    });
    
    // 主题切换事件
    themeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            saveTheme(e.target.value);
        });
    });
    
    // 点击页面其他区域关闭菜单
    document.addEventListener('click', (e) => {
        if (navMenuPopup && navMenuToggle && !navMenuPopup.contains(e.target) && !navMenuToggle.contains(e.target)) {
            closeNavMenu();
        }
    });

    ensureBackgroundVideoPlayerBinding();
}

// 初始化主题
function initTheme() {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'light';
    body.classList.remove('light-theme', 'dark-theme');
    body.classList.add(`${savedTheme}-theme`);
    
    // 更新单选按钮状态
    themeRadios.forEach(radio => {
        if (radio.value === savedTheme) {
            radio.checked = true;
        }
    });

    // 先恢复描边状态，避免后续流程把描边误置回默认值。
    restoreStoredFontOutline({ syncControl: false });

    currentFontColor = loadStoredFontColor();
    applyGlobalFontColor(currentFontColor, { persist: false, syncControl: false });
}

// 保存主题
function saveTheme(theme) {
    const previousTheme = resolveCurrentThemeName();
    const nextTheme = theme === 'dark' ? 'dark' : 'light';

    localStorage.setItem(THEME_STORAGE_KEY, theme);
    body.classList.remove('light-theme', 'dark-theme');
    body.classList.add(`${nextTheme}-theme`);
    applyGlassSettings(currentGlassSettings, { persist: false, syncControl: false });

    // 主题切换时强制应用一次可读默认字色，后续仍允许用户自行调整。
    if (previousTheme !== nextTheme && nextTheme === 'dark') {
        applyGlobalFontColor(FONT_COLOR_DEFAULT_DARK, { persist: true, syncControl: true });
        return;
    }

    if (previousTheme !== nextTheme && nextTheme === 'light') {
        applyGlobalFontColor(FONT_COLOR_DEFAULT_LIGHT, { persist: true, syncControl: true });
        return;
    }

    applyGlobalFontColor(currentFontColor, { persist: false, syncControl: true });
}

// 切换悬浮菜单
function toggleNavMenu() {
    const isOpen = navMenuPopup.classList.toggle('open');
    if (isOpen) {
        navMenuToggle.classList.add('hidden');
    } else {
        navMenuToggle.classList.remove('hidden');
    }
}

// 关闭悬浮菜单
function closeNavMenu() {
    navMenuPopup.classList.remove('open');
    navMenuToggle.classList.remove('hidden');
}

// 切换页面
function switchPage(pageId) {
    if (pageId !== 'settings' && backgroundCropSession) {
        closeBackgroundCropModal(null);
    }

    if (pageId !== 'library') {
        resetScrollListener();
        hideLevelTooltip(true);
        // 离开曲库页面时主动释放曲绘，降低内存占用
        releaseLibraryGridImages(getActiveSongsGrid());
    }

    if (mainContent) {
        mainContent.style.overflowY = pageId === 'library' ? 'hidden' : 'auto';
    }

    // 隐藏所有页面
    pages.forEach(page => {
        page.style.display = 'none';
    });
    
    // 移除所有导航项的活跃状态
    navItems.forEach(item => {
        item.classList.remove('active');
    });
    
    // 显示目标页面
    const targetPage = document.getElementById(`${pageId}Page`);
    if (targetPage) {
        targetPage.style.display = 'flex';
        
        // 处理home和results页面的特殊逻辑
        if (pageId === 'home' || pageId === 'results') {
            initPeopleManagement();
            
            // 获取相关版块元素
            const peopleToolContainer = document.getElementById('peopleToolContainer');
            const matchContainer = document.getElementById('matchContainer');
            const matchResultsContainer = document.getElementById('matchResultsContainer');
            
            if (pageId === 'home') {
                // 主页根据当前隐藏状态恢复（隐藏时仅保留喵按钮）
                syncPeopleToolVisibilityState();
                if (matchResultsContainer) matchResultsContainer.style.display = 'none';
            } else if (pageId === 'results') {
                // 显示比赛结果，隐藏人员列表和比赛分组
                if (peopleToolContainer) peopleToolContainer.style.display = 'none';
                if (matchContainer) matchContainer.style.display = 'none';
                if (matchResultsContainer) matchResultsContainer.style.display = 'flex';
                showMatchResults();
                initResultHistoryManagement();
                refreshResultFilesList({ silent: true }).catch(() => {});
            }
        } else if (pageId === 'settings') {
            if (languagePack) {
                renderLanguageOptions();
                applyLanguageToDom();
            }
            refreshDatabaseSelection({ showMissingPrompt: true, forceReload: false }).catch(() => {});
            ensureLanguageSelectBinding();
            ensureLayoutModeBinding();
            ensureFontColorBinding();
            ensureFontOutlineBinding();
            ensureBackgroundModeBinding();
            ensureBackgroundVideoLoopBinding();
            ensureBackgroundVideoPlayerBinding();
            syncBackgroundModeControl();
            syncBackgroundVideoLoopControl();
            ensureBackgroundBinding();
            ensureBackgroundCropBinding();
            ensureGlassControlsBinding();
            syncGlassControls();
            syncFontColorControls();
            restoreStoredFontOutline({ syncControl: true });
            updateBackgroundModeInfo();
            updateBackgroundVideoLoopInfo();
            refreshMenuVideoPlayerUI();
            updateGlassControlPanelState();
            refreshBackgroundAssets({ silent: true, preservePlayback: true }).catch(() => {});
        } else if (pageId === 'library') {
            // 曲库页面显示后重新绑定滚动监听并触发一次加载判定
            setTimeout(() => {
                addScrollListener();
                refreshLibraryImageObservers();
                handleScroll();
            }, 0);
        } else {
            setTimeout(() => {
                refreshLibraryImageObservers();
            }, 0);
        }
    }
    
    // 设置当前导航项为活跃状态
    const targetNavItem = document.querySelector(`[data-page="${pageId}"]`);
    if (targetNavItem) {
        targetNavItem.classList.add('active');
    }
    
    // 切换页面后关闭菜单
    closeNavMenu();
}

async function resetLocalSettingsIfNeeded() {
    try {
        const response = await fetch(RESET_STATE_API, { cache: 'no-store' });
        if (!response.ok) return false;

        const result = await response.json();
        if (!result || result.success !== true) return false;

        const serverToken = String(result.reset_token || '').trim();
        if (!serverToken) return false;

        const localToken = String(localStorage.getItem(RESET_STATE_STORAGE_KEY) || '').trim();
        if (localToken === serverToken) {
            return false;
        }

        const keysToRemove = new Set(RESETTABLE_STORAGE_KEYS);
        for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index);
            if (!key) continue;
            if (key.startsWith('xmai_') || key === 'theme' || key === MEMORY_TEST_AUTOLOAD_STORAGE_KEY) {
                keysToRemove.add(key);
            }
        }

        keysToRemove.forEach((key) => {
            try {
                localStorage.removeItem(key);
            } catch (_error) {
                // ignore
            }
        });

        localStorage.setItem(RESET_STATE_STORAGE_KEY, serverToken);
        return true;
    } catch (error) {
        console.warn('resetLocalSettingsIfNeeded failed:', error);
        return false;
    }
}

function startResetStateWatcher() {
    if (resetStateWatcherTimer) return;

    const checkAndReloadIfNeeded = async () => {
        const changed = await resetLocalSettingsIfNeeded();
        if (!changed) return;
        window.location.reload();
    };

    resetStateWatcherTimer = setInterval(() => {
        checkAndReloadIfNeeded().catch(() => {});
    }, 3000);

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        checkAndReloadIfNeeded().catch(() => {});
    });
}

// 初始化
async function initApp() {
    // 初始化DOM元素
    initDOM();

    await resetLocalSettingsIfNeeded();
    
    initTheme();

    // 初始化语言系统（读取 XMao_Core/language.json）
    await initLanguageSystem();

    // 初始化外观设置（布局模式 + 壁纸）
    await initAppearanceSettings();
    
    // 初始化数据库选择
    initDatabaseSelection();
    
    // 初始化MaiList管理
    initMaiListManagement();
    
    // 初始化Test模式
    initMemoryTestMode();
    
    // 初始化介绍页面交互
    initIntroPage();
    
    // 确保导航菜单按钮在介绍页面中可见
    navMenuToggle.classList.remove('hidden');
    
    // 如果已经不是介绍页面，初始化人员管理功能
    if (!window.isIntroPageVisible) {
        initPeopleManagement();
    }

    startResetStateWatcher();
}

function createAppError(code, message, cause) {
    const error = new Error(`[${code}] ${message}`);
    error.code = code;
    if (cause) {
        error.cause = cause;
    }
    return error;
}

function formatAppError(error) {
    if (!error) return '[APP-UNKNOWN] 未知错误';
    return error.message || String(error);
}

function normalizeImagePath(path) {
    if (typeof path !== 'string') return '';
    let normalized = path.trim().replace(/\\/g, '/');
    if (!normalized) return '';

    if (/^(blob:|data:|https?:)/i.test(normalized)) {
        return normalized;
    }

    if (normalized.startsWith('/')) {
        normalized = `.${normalized}`;
    }

    if (
        !normalized.startsWith('./') &&
        !normalized.startsWith('../') &&
        !/^[a-zA-Z]+:/.test(normalized)
    ) {
        normalized = `./${normalized}`;
    }

    normalized = normalized.replace(/\/{2,}/g, '/');
    return normalized;
}

function isLocalImagePath(path) {
    const normalized = normalizeImagePath(path);
    if (!normalized) return false;
    return normalized.startsWith(SONG_IMAGE_BASE_PATH) ||
        normalized.startsWith('./Data/') ||
        normalized.startsWith('MaiSongLib/') ||
        normalized.startsWith('Data/') ||
        normalized.startsWith('/MaiSongLib/') ||
        normalized.startsWith('/Data/');
}

function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, unitIndex);
    const fixed = unitIndex === 0 ? 0 : 2;
    return `${value.toFixed(fixed)} ${units[unitIndex]}`;
}

function resolveImageSourcePath(imagePath) {
    const normalized = normalizeImagePath(imagePath);
    if (!normalized) return '';

    if (!memoryTestState.enabled || !isLocalImagePath(normalized)) {
        return normalized;
    }

    const cacheEntry = memoryTestState.cache.get(normalized);
    if (!cacheEntry || !cacheEntry.objectUrl) {
        throw createAppError('APP-MEM-018', `Memory cache miss: ${normalized}`);
    }

    return cacheEntry.objectUrl;
}

const LAZY_IMAGE_UNLOAD_DELAY_MS = 260;
const lazyImageUnloadTimers = new WeakMap();

function clearLazyImageUnloadTimer(image) {
    if (!image) return;
    const timerId = lazyImageUnloadTimers.get(image);
    if (timerId) {
        clearTimeout(timerId);
        lazyImageUnloadTimers.delete(image);
    }
}

function setSongImageVisualState(image, state) {
    if (!(image instanceof HTMLImageElement)) return;
    const container = image.closest('.song-image');

    image.classList.remove('is-loading', 'is-loaded', 'is-unloading');
    if (state === 'loaded') {
        image.classList.add('is-loaded');
    } else if (state === 'unloading') {
        image.classList.add('is-unloading');
    } else {
        image.classList.add('is-loading');
    }

    if (container) {
        container.classList.remove('image-loading', 'image-ready', 'image-unloading');
        if (state === 'loaded') {
            container.classList.add('image-ready');
        } else if (state === 'unloading') {
            container.classList.add('image-unloading');
        } else {
            container.classList.add('image-loading');
        }
    }
}

function ensureLazyImageTransitionHooks(image) {
    if (!(image instanceof HTMLImageElement)) return;
    if (image.dataset.fadeHookBound === 'true') return;
    image.dataset.fadeHookBound = 'true';

    image.addEventListener('load', () => {
        if (!image.isConnected) return;
        clearLazyImageUnloadTimer(image);
        image.dataset.imageLoaded = 'true';
        image.dataset.imageUnloading = 'false';
        setSongImageVisualState(image, 'loaded');
    });

    image.addEventListener('error', () => {
        if (!image.isConnected) return;
        clearLazyImageUnloadTimer(image);
        image.dataset.imageLoaded = 'true';
        image.dataset.imageUnloading = 'false';
        setSongImageVisualState(image, 'loaded');
    });
}

function bindImageElementSource(imageElement, imagePath, options = {}) {
    if (!imageElement) return;

    const normalized = normalizeImagePath(imagePath);
    const { lazy = false } = options;

    imageElement.dataset.imagePath = normalized;
    imageElement.dataset.lazy = lazy ? 'true' : 'false';

    if (!normalized) {
        clearLazyImageUnloadTimer(imageElement);
        imageElement.removeAttribute('src');
        imageElement.dataset.imageLoaded = 'false';
        imageElement.dataset.imageUnloading = 'false';
        if (lazy) {
            ensureLazyImageTransitionHooks(imageElement);
            setSongImageVisualState(imageElement, 'loading');
        }
        if (lazy) {
            imageElement.dataset.src = '';
        }
        return;
    }

    const resolvedSource = resolveImageSourcePath(normalized);

    if (lazy) {
        ensureLazyImageTransitionHooks(imageElement);
        clearLazyImageUnloadTimer(imageElement);
        imageElement.dataset.src = resolvedSource;
        imageElement.dataset.imageLoaded = 'false';
        imageElement.dataset.imageUnloading = 'false';
        setSongImageVisualState(imageElement, 'loading');
        observeImage(imageElement);
        return;
    }

    imageElement.src = resolvedSource;
    imageElement.dataset.imageLoaded = 'true';
}

function refreshBoundImageSources() {
    const allImages = document.querySelectorAll('img');
    allImages.forEach((image) => {
        const existingPath = normalizeImagePath(image.dataset.imagePath);
        const attrPath = normalizeImagePath(image.getAttribute('src'));
        const candidatePath = existingPath || attrPath;

        if (!candidatePath) return;
        if (!existingPath && !isLocalImagePath(candidatePath)) return;
        if (!existingPath) {
            image.dataset.imagePath = candidatePath;
            image.dataset.lazy = 'false';
        }

        const resolvedSource = resolveImageSourcePath(image.dataset.imagePath);
        const isLazy = image.dataset.lazy === 'true';
        const isLoaded = image.dataset.imageLoaded === 'true';

        if (isLazy && !isLoaded) {
            image.dataset.src = resolvedSource;
            return;
        }

        image.src = resolvedSource;
        if (isLazy) {
            image.dataset.src = resolvedSource;
        }
    });
}

function isMemoryTestAutoLoadEnabled() {
    try {
        return localStorage.getItem(MEMORY_TEST_AUTOLOAD_STORAGE_KEY) === '1';
    } catch (error) {
        return false;
    }
}

function setMemoryTestAutoLoadEnabled(enabled) {
    const normalized = enabled ? '1' : '0';
    try {
        localStorage.setItem(MEMORY_TEST_AUTOLOAD_STORAGE_KEY, normalized);
    } catch (error) {
        console.warn('无法保存内存加载器启动自动加载设置:', error);
    }
}

function updateMemoryTestAutoLoadButton() {
    const startupToggleBtn = document.getElementById('memoryTestStartupToggleBtn');
    if (!startupToggleBtn) return;

    const enabled = isMemoryTestAutoLoadEnabled();
    startupToggleBtn.textContent = enabled
        ? t('settings.experimental.autoload_on', '启动自动加载：已开启')
        : t('settings.experimental.autoload_off', '启动自动加载：已关闭');
    startupToggleBtn.style.background = enabled ? '#34a5ff' : '#9e9e9e';
    startupToggleBtn.style.color = '#ffffff';
    startupToggleBtn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
}

function updateMemoryTestStatus() {
    const status = document.getElementById('memoryTestStatus');
    const toggleBtn = document.getElementById('memoryTestToggleBtn');
    updateMemoryTestAutoLoadButton();
    if (!status || !toggleBtn) return;

    toggleBtn.disabled = memoryTestState.loading;

    if (memoryTestState.loading) {
        status.textContent = t('settings.experimental.status_loading', '状态: 加载中 {loaded} / {total}', {
            loaded: memoryTestState.loadedFiles,
            total: memoryTestState.totalFiles
        });
        return;
    }

    if (memoryTestState.enabled) {
        status.textContent = t('settings.experimental.status_enabled', '状态: 已开启 | 文件: {files} | 磁盘: {disk} | 内存: {memory}', {
            files: memoryTestState.totalFiles,
            disk: formatBytes(memoryTestState.diskBytes),
            memory: formatBytes(memoryTestState.memoryBytes)
        });
        return;
    }

    status.textContent = t('settings.experimental.status_off', '状态: 已关闭');
}

function updateMemoryTestDialogProgress(stats = {}) {
    const titleElement = document.getElementById('memoryTestTitle');
    const progressFill = document.getElementById('memoryTestProgressFill');
    const percentElement = document.getElementById('memoryTestPercent');
    const detailsElement = document.getElementById('memoryTestDetails');
    const filesElement = document.getElementById('memoryTestFiles');
    const diskElement = document.getElementById('memoryTestDisk');
    const memoryElement = document.getElementById('memoryTestMemory');

    const loadedFiles = Number(stats.loadedFiles || 0);
    const totalFiles = Number(stats.totalFiles || 0);
    const diskBytes = Number(stats.diskBytes || 0);
    const memoryBytes = Number(stats.memoryBytes || 0);
    const explicitPercent = Number(stats.percent);
    const percent = Number.isFinite(explicitPercent)
        ? Math.max(0, Math.min(100, explicitPercent))
        : (totalFiles > 0 ? Math.min(100, (loadedFiles / totalFiles) * 100) : 0);

    if (titleElement && typeof stats.title === 'string' && stats.title) {
        titleElement.textContent = stats.title;
    }
    if (progressFill) {
        progressFill.style.width = `${percent.toFixed(2)}%`;
    }
    if (percentElement) {
        percentElement.textContent = `${Math.floor(percent)}%`;
    }
    if (detailsElement) {
        detailsElement.textContent = typeof stats.details === 'string' && stats.details
            ? stats.details
            : t('settings.experimental.dialog.preparing', '准备中...');
    }
    if (filesElement) {
        filesElement.textContent = t('settings.experimental.dialog.files', '文件: {loaded} / {total}', {
            loaded: loadedFiles,
            total: totalFiles
        });
    }
    if (diskElement) {
        diskElement.textContent = t('settings.experimental.dialog.disk', '磁盘大小: {size}', {
            size: formatBytes(diskBytes)
        });
    }
    if (memoryElement) {
        memoryElement.textContent = t('settings.experimental.dialog.memory', '内存占用: {size}', {
            size: formatBytes(memoryBytes)
        });
    }
}

function showMemoryTestDialog(title, totalFiles, details = t('settings.experimental.dialog.preparing', '准备中...')) {
    const dialog = document.getElementById('memoryTestDialog');
    if (!dialog) return;
    dialog.classList.add('show');
    updateMemoryTestDialogProgress({
        title,
        loadedFiles: 0,
        totalFiles: totalFiles || 0,
        diskBytes: 0,
        memoryBytes: 0,
        percent: 0,
        details
    });
}

function hideMemoryTestDialog() {
    const dialog = document.getElementById('memoryTestDialog');
    if (!dialog) return;
    dialog.classList.remove('show');
}

function decodeBase64ToBlob(base64Content, mimeType) {
    const binaryString = atob(base64Content);
    const byteLength = binaryString.length;
    const bytes = new Uint8Array(byteLength);
    for (let i = 0; i < byteLength; i += 1) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType || 'application/octet-stream' });
}

async function requestMemoryTestPackageInfo(options = {}) {
    const buildBeforeRead = options.buildBeforeRead === true;
    const endpoint = buildBeforeRead ? '/api/build-memory-test-package' : '/api/memory-test-package-info';
    const requestInit = buildBeforeRead
        ? { method: 'POST', cache: 'no-store' }
        : { cache: 'no-store' };
    const response = await fetch(endpoint, requestInit);

    if (!response.ok) {
        throw createAppError('APP-MEM-001', `Failed to read package info (HTTP ${response.status})`);
    }

    const result = await response.json();
    if (!result || result.success !== true) {
        throw createAppError('APP-MEM-002', `Package info API failed: ${result?.error || 'unknown error'}`);
    }

    if (typeof result.package_url !== 'string' || !result.package_url) {
        throw createAppError('APP-MEM-003', 'Package info is missing package_url');
    }

    return result;
}

async function fetchMemoryTestPackageData(packageUrl) {
    const cacheBypassUrl = packageUrl.includes('?')
        ? `${packageUrl}&_=${Date.now()}`
        : `${packageUrl}?_=${Date.now()}`;

    const response = await fetch(cacheBypassUrl, { cache: 'no-store' });
    if (!response.ok) {
        throw createAppError('APP-MEM-004', `Failed to download package (HTTP ${response.status})`);
    }
    try {
        return await response.json();
    } catch (error) {
        throw createAppError('APP-MEM-005', 'Failed to parse package JSON.', error);
    }
}

function parseMemoryTestPackage(packageData) {
    if (!packageData || !Array.isArray(packageData.images)) {
        throw createAppError('APP-MEM-006', 'Package data is invalid: images array is missing.');
    }

    return packageData;
}

async function preloadPackageImagesToMemory(packageData, progressConfig, onProgress) {
    const images = packageData.images;
    const totalFiles = images.length;
    const basePercent = Number(progressConfig?.basePercent || 0);
    const percentSpan = Number(progressConfig?.percentSpan || 100);

    const cache = new Map();
    let loadedFiles = 0;
    let diskBytes = 0;
    let memoryBytes = 0;

    try {
        for (const imageEntry of images) {
            const imagePath = normalizeImagePath(imageEntry?.path);
            const base64Content = imageEntry?.content_base64;
            const mimeType = typeof imageEntry?.mime_type === 'string' ? imageEntry.mime_type : 'application/octet-stream';

            if (!imagePath || typeof base64Content !== 'string') {
                throw createAppError('APP-MEM-007', 'Package image entry is invalid.');
            }

            const imageBlob = decodeBase64ToBlob(base64Content, mimeType);
            const objectUrl = URL.createObjectURL(imageBlob);
            const rawDiskSize = Number(imageEntry?.disk_size);
            const entryDiskSize = Number.isFinite(rawDiskSize) && rawDiskSize >= 0 ? rawDiskSize : imageBlob.size;

            cache.set(imagePath, {
                objectUrl,
                diskBytes: entryDiskSize,
                memoryBytes: imageBlob.size
            });

            loadedFiles += 1;
            diskBytes += entryDiskSize;
            memoryBytes += imageBlob.size;

            if (typeof onProgress === 'function') {
                const loopPercent = totalFiles > 0 ? (loadedFiles / totalFiles) : 1;
                const percent = basePercent + (loopPercent * percentSpan);
                onProgress({
                    loadedFiles,
                    totalFiles,
                    diskBytes,
                    memoryBytes,
                    percent
                });
            }

            if (loadedFiles % 20 === 0) {
                await new Promise((resolve) => setTimeout(resolve, 0));
            }
        }
    } catch (error) {
        clearMemoryImageCache(cache);
        throw error;
    }

    return {
        cache,
        loadedFiles,
        totalFiles,
        diskBytes,
        memoryBytes
    };
}

function clearMemoryImageCache(cacheMap) {
    if (!cacheMap || typeof cacheMap.forEach !== 'function') return;
    cacheMap.forEach((entry) => {
        if (entry && entry.objectUrl) {
            URL.revokeObjectURL(entry.objectUrl);
        }
    });
}

function unloadMemoryTestCache() {
    if (!memoryTestState.enabled && memoryTestState.cache.size === 0) {
        updateMemoryTestStatus();
        return;
    }

    const oldCache = memoryTestState.cache;
    memoryTestState.enabled = false;
    memoryTestState.loading = false;
    memoryTestState.cache = new Map();
    memoryTestState.loadedFiles = 0;
    memoryTestState.totalFiles = 0;
    memoryTestState.diskBytes = 0;
    memoryTestState.memoryBytes = 0;

    refreshBoundImageSources();
    clearMemoryImageCache(oldCache);
    updateMemoryTestStatus();
}

async function enableMemoryTestCache() {
    memoryTestState.loading = true;
    memoryTestState.enabled = false;
    memoryTestState.loadedFiles = 0;
    memoryTestState.totalFiles = 0;
    memoryTestState.diskBytes = 0;
    memoryTestState.memoryBytes = 0;
    updateMemoryTestStatus();
    const loadingTitle = t('settings.experimental.dialog.title_loading', '加载内存缓存');
    showMemoryTestDialog(
        loadingTitle,
        0,
        t('settings.experimental.dialog.step.read_meta', '构建并读取缓存包信息...')
    );

    updateMemoryTestDialogProgress({
        title: loadingTitle,
        loadedFiles: 0,
        totalFiles: 0,
        diskBytes: 0,
        memoryBytes: 0,
        percent: 5,
        details: t('settings.experimental.dialog.step.read_meta_detail', '正在按当前曲绘构建（或复用）缓存包...')
    });

    const packageInfo = await requestMemoryTestPackageInfo({ buildBeforeRead: true });
    const packageFileCount = Number(packageInfo.file_count || 0);
    const packageDiskBytes = Number(packageInfo.disk_bytes || 0);
    memoryTestState.totalFiles = packageFileCount;
    memoryTestState.diskBytes = packageDiskBytes;
    updateMemoryTestStatus();

    updateMemoryTestDialogProgress({
        title: loadingTitle,
        loadedFiles: 0,
        totalFiles: packageFileCount,
        diskBytes: packageDiskBytes,
        memoryBytes: 0,
        percent: 15,
        details: packageInfo.reused
            ? t('settings.experimental.dialog.step.package_reused', '检测到图片数量未变化，复用已有压缩包。')
            : t('settings.experimental.dialog.step.package_rebuilt', '检测到图片数量变化，已构建新缓存包。')
    });

    const packageDataRaw = await fetchMemoryTestPackageData(packageInfo.package_url);
    updateMemoryTestDialogProgress({
        title: loadingTitle,
        loadedFiles: 0,
        totalFiles: packageFileCount,
        diskBytes: packageDiskBytes,
        memoryBytes: 0,
        percent: 28,
        details: t('settings.experimental.dialog.step.downloaded', '缓存包下载完成，正在解析内容...')
    });

    const packageData = parseMemoryTestPackage(packageDataRaw);

    updateMemoryTestDialogProgress({
        title: loadingTitle,
        loadedFiles: 0,
        totalFiles: packageData.images.length,
        diskBytes: packageDiskBytes,
        memoryBytes: 0,
        percent: 35,
        details: t('settings.experimental.dialog.step.unpack', '内容就绪，正在解包到内存...')
    });

    const preloadResult = await preloadPackageImagesToMemory(
        packageData,
        { basePercent: 35, percentSpan: 65 },
        (progress) => {
            memoryTestState.loadedFiles = progress.loadedFiles;
            memoryTestState.totalFiles = progress.totalFiles;
            memoryTestState.diskBytes = progress.diskBytes;
            memoryTestState.memoryBytes = progress.memoryBytes;
            updateMemoryTestStatus();
            updateMemoryTestDialogProgress({
                title: loadingTitle,
                loadedFiles: progress.loadedFiles,
                totalFiles: progress.totalFiles,
                diskBytes: progress.diskBytes,
                memoryBytes: progress.memoryBytes,
                percent: progress.percent,
                details: t('settings.experimental.dialog.step.extracting', '正在解包: {loaded}/{total}', {
                    loaded: progress.loadedFiles,
                    total: progress.totalFiles
                })
            });
        }
    );

    const oldCache = memoryTestState.cache;
    memoryTestState.cache = preloadResult.cache;
    memoryTestState.enabled = true;
    memoryTestState.loading = false;
    memoryTestState.loadedFiles = preloadResult.loadedFiles;
    memoryTestState.totalFiles = preloadResult.totalFiles;
    memoryTestState.diskBytes = preloadResult.diskBytes || packageDiskBytes;
    memoryTestState.memoryBytes = preloadResult.memoryBytes;

    refreshBoundImageSources();
    clearMemoryImageCache(oldCache);
    updateMemoryTestStatus();
    updateMemoryTestDialogProgress({
        title: t('settings.experimental.dialog.title_ready', '内存缓存已就绪'),
        loadedFiles: preloadResult.loadedFiles,
        totalFiles: preloadResult.totalFiles,
        diskBytes: memoryTestState.diskBytes,
        memoryBytes: preloadResult.memoryBytes,
        percent: 100,
        details: packageInfo.reused
            ? t('settings.experimental.dialog.step.done_reused', '完成，已从复用缓存包加载。')
            : t('settings.experimental.dialog.step.done_rebuilt', '完成，已从新构建缓存包加载。')
    });

    window.setTimeout(() => {
        hideMemoryTestDialog();
    }, 700);
}

function initMemoryTestMode() {
    const toggleBtn = document.getElementById('memoryTestToggleBtn');
    const startupToggleBtn = document.getElementById('memoryTestStartupToggleBtn');

    if (toggleBtn && toggleBtn.dataset.bound !== 'true') {
        toggleBtn.dataset.bound = 'true';
        toggleBtn.addEventListener('click', async () => {
            if (memoryTestState.loading) return;

            try {
                if (memoryTestState.enabled) {
                    unloadMemoryTestCache();
                    return;
                }

                await enableMemoryTestCache();
            } catch (error) {
                memoryTestState.loading = false;
                hideMemoryTestDialog();
                updateMemoryTestStatus();
                const finalError = (error && error.code) ? error : createAppError(
                    'APP-MEM-012',
                    t('settings.experimental.switch_failed', '切换内存加载器失败'),
                    error
                );
                console.error('Memory loader switch failed:', finalError);
                customAlert.show(t('settings.experimental.test_error_title', '内存加载器错误'), formatAppError(finalError));
            }
        });
    }

    if (startupToggleBtn && startupToggleBtn.dataset.bound !== 'true') {
        startupToggleBtn.dataset.bound = 'true';
        startupToggleBtn.addEventListener('click', () => {
            const nextEnabled = !isMemoryTestAutoLoadEnabled();
            setMemoryTestAutoLoadEnabled(nextEnabled);
            updateMemoryTestAutoLoadButton();
            if (typeof customAlert !== 'undefined' && customAlert && typeof customAlert.toast === 'function') {
                customAlert.toast(
                    t('settings.experimental.title', '实验性功能'),
                    nextEnabled
                        ? t('settings.experimental.autoload_enabled_notice', '已开启启动自动加载')
                        : t('settings.experimental.autoload_disabled_notice', '已关闭启动自动加载'),
                    1200
                );
            }
        });
    }

    if (
        isMemoryTestAutoLoadEnabled()
        && !memoryTestAutoLoadInitialized
        && !memoryTestState.enabled
        && !memoryTestState.loading
    ) {
        memoryTestAutoLoadInitialized = true;
        enableMemoryTestCache().catch((error) => {
            memoryTestState.loading = false;
            hideMemoryTestDialog();
            updateMemoryTestStatus();
            const finalError = (error && error.code) ? error : createAppError(
                'APP-MEM-013',
                t('settings.experimental.autoload_failed', '启动自动加载内存加载器失败'),
                error
            );
            console.error('Memory loader startup preload failed:', finalError);
            if (typeof customAlert !== 'undefined' && customAlert && typeof customAlert.toast === 'function') {
                customAlert.toast(t('settings.experimental.autoload_failed_title', '内存加载器自动加载失败'), formatAppError(finalError), 1800);
            }
        });
    }

    updateMemoryTestStatus();
}

let coreLoaderEnsurePromise = null;
let localQrGeneratorEnsurePromise = null;
const localQrDataUrlCache = new Map();

function loadExternalScript(src) {
    return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[data-dynamic-src="${src}"]`) ||
            document.querySelector(`script[src="${src}"]`);

        if (existing) {
            if (existing.dataset.loaded === 'true' || (window.XMaoCore && typeof window.XMaoCore.loadModules === 'function')) {
                existing.dataset.loaded = 'true';
                resolve();
                return;
            }
            // 已存在但状态不明时，主动补发一次加载，避免 Promise 永久等待。
            const cacheBreaker = src.includes('?') ? '&' : '?';
            src = `${src}${cacheBreaker}_reload=${Date.now()}`;
        }

        const script = document.createElement('script');
        script.src = src;
        script.async = false;
        script.dataset.dynamicSrc = src;
        script.onload = () => {
            script.dataset.loaded = 'true';
            resolve();
        };
        script.onerror = () => reject(new Error(`脚本加载失败: ${src}`));
        document.head.appendChild(script);
    });
}

function buildSongSearchKeyword(songName) {
    const safeSongName = typeof songName === 'string' && songName.trim()
        ? songName.trim()
        : t('song.unknown_title', '未知曲目');
    return `MaiMai 【${safeSongName}】`;
}

function buildSongSearchUrl(songName) {
    const keyword = buildSongSearchKeyword(songName);
    return `https://search.bilibili.com/all?keyword=${encodeURIComponent(keyword)}`;
}

async function ensureLocalQrGeneratorAvailable() {
    if (typeof window.qrcode === 'function') {
        return window.qrcode;
    }

    if (!localQrGeneratorEnsurePromise) {
        localQrGeneratorEnsurePromise = loadExternalScript('./XMao_Core/vendor/qrcode.min.js')
            .then(() => {
                if (typeof window.qrcode !== 'function') {
                    throw new Error('本地二维码库未正确加载');
                }
                return window.qrcode;
            })
            .catch((error) => {
                localQrGeneratorEnsurePromise = null;
                throw error;
            });
    }

    return localQrGeneratorEnsurePromise;
}

function createQrFallbackDataUrl(text = 'QR') {
    try {
        const canvas = document.createElement('canvas');
        const size = 132;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return '';

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
        ctx.strokeStyle = '#222222';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, size - 2, size - 2);
        ctx.fillStyle = '#222222';
        ctx.font = 'bold 20px Microsoft YaHei, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, size / 2, size / 2);
        return canvas.toDataURL('image/png');
    } catch (error) {
        return '';
    }
}

function renderLocalSongSearchQr(qrImageElement, searchUrl, songName) {
    if (!(qrImageElement instanceof HTMLImageElement)) return;
    const cacheKey = String(searchUrl || '').trim();
    if (!cacheKey) return;

    const cachedUrl = localQrDataUrlCache.get(cacheKey);
    if (cachedUrl) {
        qrImageElement.src = cachedUrl;
        qrImageElement.dataset.qrReady = 'true';
        return;
    }

    qrImageElement.dataset.qrReady = 'false';
    qrImageElement.src = createQrFallbackDataUrl('...');

    ensureLocalQrGeneratorAvailable()
        .then((qrFactory) => {
            const qr = qrFactory(0, 'M');
            qr.addData(cacheKey, 'Byte');
            qr.make();
            const dataUrl = qr.createDataURL(5, 2);
            localQrDataUrlCache.set(cacheKey, dataUrl);
            qrImageElement.src = dataUrl;
            qrImageElement.dataset.qrReady = 'true';
        })
        .catch((error) => {
            console.error('[QR-LOCAL-001] 本地二维码生成失败:', error);
            qrImageElement.src = createQrFallbackDataUrl('QR');
            qrImageElement.dataset.qrReady = 'false';
            qrImageElement.title = `二维码生成失败，请复制链接手动搜索：${buildSongSearchKeyword(songName)}`;
        });
}

async function ensureCoreLoaderAvailable() {
    if (window.XMaoCore && typeof window.XMaoCore.loadModules === 'function') {
        return;
    }

    if (!coreLoaderEnsurePromise) {
        coreLoaderEnsurePromise = (async () => {
            const candidates = ['./XMao_Core/core-loader.js', '/XMao_Core/core-loader.js'];
            let lastError = null;

            for (const src of candidates) {
                try {
                    await loadExternalScript(src);
                    if (window.XMaoCore && typeof window.XMaoCore.loadModules === 'function') {
                        return;
                    }
                } catch (error) {
                    lastError = error;
                }
            }

            throw createAppError('APP-BOOT-001', '核心模块加载器不可用，请检查 XMao_Core/core-loader.js 是否可访问', lastError);
        })();
    }

    await coreLoaderEnsurePromise;
}

// 确保核心模块加载任务存在；缺失时自动补建
async function ensureCoreModuleTask() {
    if (window.__xmaoCoreReady && typeof window.__xmaoCoreReady.then === 'function') {
        return window.__xmaoCoreReady;
    }

    await ensureCoreLoaderAvailable();

    try {
        const bootTask = window.XMaoCore.loadModules();
        if (!bootTask || typeof bootTask.then !== 'function') {
            throw createAppError('APP-BOOT-001', 'XMaoCore.loadModules 未返回 Promise，无法等待模块初始化');
        }
        window.__xmaoCoreReady = bootTask;
        return bootTask;
    } catch (error) {
        throw createAppError('APP-BOOT-001', '创建核心模块加载任务失败', error);
    }
}

// 等待动态核心模块加载完成
async function waitForCoreModules() {
    let coreTask;
    try {
        coreTask = await ensureCoreModuleTask();
    } catch (error) {
        throw error && error.code ? error : createAppError('APP-BOOT-001', '核心模块加载任务不存在，请检查 index.html 中的 core-loader 初始化顺序', error);
    }

    try {
        await coreTask;
    } catch (error) {
        throw createAppError('APP-BOOT-002', '核心模块加载失败', error);
    }
}

// 添加页面加载动画
window.addEventListener('load', async () => {
    try {
        // 确保模块页面先注入，再初始化主逻辑
        await waitForCoreModules();
        
        // 先初始化应用，确保DOM元素被正确获取
        await initApp();
        
        // 仅执行一次的全局初始化
        initSelectedSongs();
        initLazyLoading();
        document.documentElement.style.setProperty('--mouse-x', '50%');
        document.documentElement.style.setProperty('--mouse-y', '50%');
        
        // 然后设置页面加载动画
        if (body) {
            body.style.opacity = '0';
            setTimeout(() => {
                body.style.transition = 'opacity 0.5s ease';
                body.style.opacity = '1';
            }, 100);
        }
    } catch (error) {
        console.error('应用启动失败:', error);
        const message = formatAppError(error);
        if (typeof customAlert !== 'undefined' && customAlert && typeof customAlert.show === 'function') {
            customAlert.show(t('app.startup_failed.title', '启动失败'), message);
        } else {
            window.alert(message);
        }
    }
});

// 自定义弹窗功能
let customAlert = {
    _cleanup: null,
    _autoCloseTimer: null,

    _getElements: function() {
        const alertElement = document.getElementById('customAlert');
        const titleElement = document.getElementById('alertTitle');
        const messageElement = document.getElementById('alertMessage');
        const buttonElement = document.getElementById('alertButton');
        const cancelButtonElement = document.getElementById('alertCancelButton');
        const closeElement = document.getElementById('alertClose');
        const footerElement = alertElement ? alertElement.querySelector('.alert-footer') : null;

        if (!alertElement || !titleElement || !messageElement || !buttonElement || !cancelButtonElement || !closeElement || !footerElement) {
            return null;
        }

        return {
            alertElement,
            titleElement,
            messageElement,
            buttonElement,
            cancelButtonElement,
            closeElement,
            footerElement
        };
    },

    _clearAutoClose: function() {
        if (this._autoCloseTimer) {
            clearTimeout(this._autoCloseTimer);
            this._autoCloseTimer = null;
        }
    },

    hide: function(options = {}) {
        const instant = !!(options && options.instant);
        this._clearAutoClose();

        const elements = this._getElements();
        if (!elements) return;
        const {
            alertElement,
            cancelButtonElement,
            closeElement,
            footerElement
        } = elements;

        const wasShown = alertElement.classList.contains('show');
        const wasAutoDismiss = alertElement.classList.contains('auto-dismiss');

        const resetToDefaultLayout = () => {
            alertElement.classList.remove('auto-dismiss');
            cancelButtonElement.style.display = 'none';
            closeElement.style.display = 'flex';
            footerElement.style.display = 'flex';
        };

        const runCleanup = () => {
            if (typeof this._cleanup === 'function') {
                this._cleanup();
                this._cleanup = null;
            }
        };

        if (instant || !wasShown) {
            alertElement.classList.remove('show');
            resetToDefaultLayout();
            runCleanup();
            return;
        }

        alertElement.classList.remove('show');
        runCleanup();

        if (!wasAutoDismiss) {
            resetToDefaultLayout();
            return;
        }

        let finalized = false;
        const finalize = () => {
            if (finalized) return;
            finalized = true;
            alertElement.removeEventListener('transitionend', handleTransitionEnd);
            resetToDefaultLayout();
        };
        const handleTransitionEnd = (event) => {
            if (event.target !== alertElement) return;
            finalize();
        };

        alertElement.addEventListener('transitionend', handleTransitionEnd);
        setTimeout(finalize, 360);
    },

    show: function(title, message, buttonText = '') {
        const elements = this._getElements();
        if (!elements) {
            window.alert(`${title}\n${message}`);
            return;
        }

        this.hide({ instant: true });

        const {
            alertElement,
            titleElement,
            messageElement,
            buttonElement,
            cancelButtonElement,
            closeElement,
            footerElement
        } = elements;

        // 设置内容
        titleElement.textContent = title;
        messageElement.textContent = message;
        buttonElement.textContent = buttonText || t('common.confirm', '确定');

        // 隐藏取消按钮，显示单个确认按钮
        cancelButtonElement.style.display = 'none';
        closeElement.style.display = 'flex';
        footerElement.style.display = 'flex';
        buttonElement.style.marginRight = '0';

        // 事件监听器
        const closeAlert = () => {
            this.hide();
        };

        const handleBackdrop = (e) => {
            if (e.target === alertElement) {
                closeAlert();
            }
        };

        buttonElement.addEventListener('click', closeAlert);
        closeElement.addEventListener('click', closeAlert);
        alertElement.addEventListener('click', handleBackdrop);

        this._cleanup = () => {
            buttonElement.removeEventListener('click', closeAlert);
            closeElement.removeEventListener('click', closeAlert);
            alertElement.removeEventListener('click', handleBackdrop);
        };

        requestAnimationFrame(() => {
            alertElement.classList.add('show');
        });
    },

    toast: function(title, message, durationMs = 1000) {
        const elements = this._getElements();
        if (!elements) {
            window.alert(`${title}\n${message}`);
            return;
        }

        this.hide({ instant: true });

        const {
            alertElement,
            titleElement,
            messageElement,
            closeElement,
            footerElement
        } = elements;

        titleElement.textContent = title;
        messageElement.textContent = message;
        closeElement.style.display = 'none';
        footerElement.style.display = 'none';
        alertElement.classList.add('auto-dismiss');

        requestAnimationFrame(() => {
            alertElement.classList.add('show');
        });

        const delay = Number.isFinite(Number(durationMs)) ? Math.max(100, Number(durationMs)) : 1000;
        this._autoCloseTimer = setTimeout(() => {
            this.hide();
        }, delay);
    },
    
    // 确认弹窗，返回Promise
    confirm: function(title, message, confirmText = '', cancelText = '') {
        return new Promise((resolve) => {
            const elements = this._getElements();
            if (!elements) {
                resolve(window.confirm(`${title}\n${message}`));
                return;
            }

            this.hide({ instant: true });

            const {
                alertElement,
                titleElement,
                messageElement,
                buttonElement,
                cancelButtonElement,
                closeElement,
                footerElement
            } = elements;

            // 设置内容
            titleElement.textContent = title;
            messageElement.textContent = message;
            buttonElement.textContent = confirmText || t('common.confirm', '确定');
            cancelButtonElement.textContent = cancelText || t('common.cancel', '取消');

            // 显示取消按钮，显示双按钮布局
            cancelButtonElement.style.display = 'inline-block';
            closeElement.style.display = 'flex';
            footerElement.style.display = 'flex';
            buttonElement.style.marginRight = '0';

            // 事件监听器
            const handleConfirm = () => {
                resolve(true);
                this.hide();
            };

            const handleCancel = () => {
                resolve(false);
                this.hide();
            };

            const handleBackdrop = (e) => {
                if (e.target === alertElement) {
                    handleCancel();
                }
            };

            buttonElement.addEventListener('click', handleConfirm);
            cancelButtonElement.addEventListener('click', handleCancel);
            closeElement.addEventListener('click', handleCancel);
            alertElement.addEventListener('click', handleBackdrop);

            this._cleanup = () => {
                buttonElement.removeEventListener('click', handleConfirm);
                cancelButtonElement.removeEventListener('click', handleCancel);
                closeElement.removeEventListener('click', handleCancel);
                alertElement.removeEventListener('click', handleBackdrop);
            };

            requestAnimationFrame(() => {
                alertElement.classList.add('show');
            });
        });
    },

    // 单按钮倒计时确认弹窗，倒计时结束后才允许点击关闭
    countdownConfirm: function(title, message, options = {}) {
        return new Promise((resolve) => {
            const elements = this._getElements();
            if (!elements) {
                window.alert(`${title}\n${message}`);
                resolve(true);
                return;
            }

            this.hide({ instant: true });

            const {
                alertElement,
                titleElement,
                messageElement,
                buttonElement,
                cancelButtonElement,
                closeElement,
                footerElement
            } = elements;

            const baseButtonText = String(options.buttonText || t('common.confirm', '确定'));
            const totalSecondsRaw = Number(options.seconds);
            const totalSeconds = Number.isFinite(totalSecondsRaw)
                ? Math.max(0, Math.floor(totalSecondsRaw))
                : 3;
            let remainingSeconds = totalSeconds;
            let countdownTimer = null;

            titleElement.textContent = title;
            messageElement.textContent = message;
            cancelButtonElement.style.display = 'none';
            closeElement.style.display = 'none';
            footerElement.style.display = 'flex';
            buttonElement.style.marginRight = '0';

            const updateButtonLabel = () => {
                if (remainingSeconds > 0) {
                    buttonElement.textContent = `${baseButtonText} (${remainingSeconds}s)`;
                    buttonElement.disabled = true;
                } else {
                    buttonElement.textContent = baseButtonText;
                    buttonElement.disabled = false;
                }
            };

            updateButtonLabel();

            const handleConfirm = () => {
                if (buttonElement.disabled) return;
                resolve(true);
                this.hide();
            };

            const handleBackdrop = (event) => {
                if (event.target !== alertElement) return;
                if (buttonElement.disabled) return;
                resolve(true);
                this.hide();
            };

            buttonElement.addEventListener('click', handleConfirm);
            alertElement.addEventListener('click', handleBackdrop);

            if (remainingSeconds > 0) {
                countdownTimer = setInterval(() => {
                    remainingSeconds -= 1;
                    if (remainingSeconds <= 0) {
                        remainingSeconds = 0;
                        if (countdownTimer) {
                            clearInterval(countdownTimer);
                            countdownTimer = null;
                        }
                    }
                    updateButtonLabel();
                }, 1000);
            }

            this._cleanup = () => {
                buttonElement.removeEventListener('click', handleConfirm);
                alertElement.removeEventListener('click', handleBackdrop);
                if (countdownTimer) {
                    clearInterval(countdownTimer);
                    countdownTimer = null;
                }
            };

            requestAnimationFrame(() => {
                alertElement.classList.add('show');
            });
        });
    }
};

// 数据库选择功能
let currentDatabase = null;
let databaseList = [];
let songs = [];
let pendingInitialDatabaseSuccessToast = true;
const DATA_FILES_API = '/api/get-data-files';
let databaseSelectBound = false;

// Data文件夹下实时扫描得到的JSON文件列表
let dataFiles = [];

function renderDatabaseSelectionEmptyState(showMissingPrompt = false) {
    const databaseSelect = document.getElementById('databaseSelect');
    const databaseInfo = document.getElementById('databaseInfo');
    const countValueElement = document.getElementById('countValue');

    if (databaseSelect) {
        databaseSelect.innerHTML = '';
        const option = document.createElement('option');
        option.value = '';
        option.textContent = t('database.empty.option', '无曲库文件');
        databaseSelect.appendChild(option);
        databaseSelect.value = '';
        databaseSelect.disabled = true;
    }

    if (databaseInfo) {
        databaseInfo.textContent = t('database.empty.info', '无曲库文件');
    }

    if (countValueElement) {
        countValueElement.textContent = '0';
    }

    currentDatabase = null;
    databaseList = [];
    songs = [];
    if (memoryTestState.enabled) {
        unloadMemoryTestCache();
    }
    displaySongs([]);

    if (showMissingPrompt) {
        customAlert.show(
            t('common.tip', '提示'),
            '未找到曲库文件  请使用PythonGUI提供的按钮下载'
        );
    }
}

async function fetchDataFilesFromServer() {
    const response = await fetch(DATA_FILES_API, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    if (!result || result.success !== true || !Array.isArray(result.files)) {
        throw new Error('Invalid response format');
    }

    const files = result.files
        .map(item => String(item?.name || '').trim())
        .filter(Boolean)
        .filter(name => name.toLowerCase().endsWith('.json'));

    return Array.from(new Set(files));
}

// 加载数据库
async function loadDatabase(filename, options = {}) {
    const showSuccessAlert = options.showSuccessAlert !== false;
    try {
        // 开始加载
        console.log(`正在加载数据库: ${filename}`);
        
        // 实际项目中可以移除这个延迟，这里保留是为了更好的用户体验
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // 读取真实JSON文件 - 使用相对路径
        const response = await fetch(`./Data/${filename}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const count = data.length;
        
        currentDatabase = {
            filename: filename,
            data: data,
            count: count
        };
        
        // 更新数据库信息显示
        const databaseInfo = document.getElementById('databaseInfo');
        databaseInfo.textContent = t('database.info.loaded', '已加载 {filename}，共 {count} 个条目', {
            filename,
            count
        });
        
        // 首次自动加载成功时使用自动淡出提示，后续手动切换维持普通弹窗
        if (showSuccessAlert) {
            if (pendingInitialDatabaseSuccessToast) {
                customAlert.toast(
                    t('database.load_success.title', '数据库加载成功'),
                    t('database.load_success.message', '成功加载 {filename}，条目数量: {count}', { filename, count }),
                    1000
                );
                pendingInitialDatabaseSuccessToast = false;
            } else {
                customAlert.show(
                    t('database.load_success.title', '数据库加载成功'),
                    t('database.load_success.message_multiline', '成功加载 {filename}\n条目数量: {count}', { filename, count })
                );
            }
        }
        
        // 保存歌曲数据
        songs = data;
        if (memoryTestState.enabled) {
            unloadMemoryTestCache();
        }
        
        // 更新曲库页面的条目数量显示
        const countValueElement = document.getElementById('countValue');
        if (countValueElement) {
            countValueElement.textContent = count;
        }
        
        // 构建搜索索引，加速后续搜索，特别是针对"别名"字段
        buildSearchIndex();
        
        // 初始化曲库页面
        initLibraryPage();
        
        console.log(`数据库加载完成: ${filename}，共 ${count} 个条目`);
        console.log('数据示例:', data[0] || '无数据');
    } catch (error) {
        console.error('加载数据库失败:', error);

        // 文件被删除或不存在时，立即重新扫描数据库列表
        if (String(error?.message || '').includes('404')) {
            await refreshDatabaseSelection({ showMissingPrompt: true, forceReload: false });
            return;
        }
        
        // 更新数据库信息显示
        const databaseInfo = document.getElementById('databaseInfo');
        databaseInfo.textContent = t('database.info.failed', '加载 {filename} 失败', { filename });
        
        // 使用自定义弹窗显示错误
        customAlert.show(
            t('database.load_failed.title', '数据库加载失败'),
            t('database.load_failed.message', '无法加载 {filename}\n错误信息: {error}', { filename, error: error.message })
        );
    }
}

async function refreshDatabaseSelection(options = {}) {
    const showMissingPrompt = options.showMissingPrompt === true;
    const forceReload = options.forceReload === true;
    const databaseSelect = document.getElementById('databaseSelect');
    if (!databaseSelect) return;

    let files = [];
    try {
        files = await fetchDataFilesFromServer();
    } catch (error) {
        console.error('扫描Data目录失败:', error);
        renderDatabaseSelectionEmptyState(false);
        const databaseInfo = document.getElementById('databaseInfo');
        if (databaseInfo) {
            databaseInfo.textContent = t('database.scan.failed', '扫描曲库文件失败');
        }
        return;
    }

    dataFiles = files;
    if (files.length === 0) {
        renderDatabaseSelectionEmptyState(showMissingPrompt);
        return;
    }

    databaseSelect.disabled = false;
    databaseSelect.innerHTML = '';
    files.forEach(filename => {
        const option = document.createElement('option');
        option.value = filename;
        option.textContent = filename;
        databaseSelect.appendChild(option);
    });

    const currentFilename = String(currentDatabase?.filename || '').trim();
    const hasCurrent = currentFilename && files.includes(currentFilename);
    const selectedFilename = hasCurrent ? currentFilename : files[0];
    databaseSelect.value = selectedFilename;

    if (hasCurrent && !forceReload) {
        const databaseInfo = document.getElementById('databaseInfo');
        if (databaseInfo && Number.isFinite(Number(currentDatabase?.count))) {
            databaseInfo.textContent = t('database.info.loaded', '已加载 {filename}，共 {count} 个条目', {
                filename: currentFilename,
                count: Number(currentDatabase.count)
            });
        }
        return;
    }

    await loadDatabase(selectedFilename, { showSuccessAlert: false });
}

// 初始化数据库选择
function initDatabaseSelection() {
    const databaseSelect = document.getElementById('databaseSelect');
    if (!databaseSelect) return;
    
    if (!databaseSelectBound) {
        databaseSelect.addEventListener('change', (e) => {
            const selectedFilename = String(e.target.value || '').trim();
            if (!selectedFilename) return;
            loadDatabase(selectedFilename, { showSuccessAlert: true });
        });
        databaseSelectBound = true;
    }

    refreshDatabaseSelection({ showMissingPrompt: false, forceReload: false }).catch(error => {
        console.error('初始化数据库选择失败:', error);
    });
}

// 初始化曲库页面
function initLibraryPage() {
    // 生成筛选选项
    generateFilterOptions();
    
    // 显示所有歌曲
    displaySongs(songs);
    
    // 添加筛选事件监听器
    addFilterEventListeners();
    
    // 添加搜索框展开/折叠功能
    initSearchToggle();
}

// 初始化搜索框展开/折叠功能
function initSearchToggle() {
    // 获取搜索相关元素
    const searchToggle = document.getElementById('searchToggle');
    const searchContainer = document.querySelector('.search-container.expandable');
    const searchInput = document.getElementById('searchInput');
    
    if (searchToggle && searchContainer && searchInput) {
        // 添加点击事件监听
        searchToggle.addEventListener('click', (e) => {
            e.stopPropagation(); // 阻止事件冒泡
            searchContainer.classList.toggle('expanded');
            if (searchContainer.classList.contains('expanded')) {
                // 展开后自动聚焦
                searchInput.focus();
            }
        });
        
        // 点击外部区域关闭搜索框展开状态
        document.addEventListener('click', (e) => {
            if (searchContainer && !searchContainer.contains(e.target) && !searchToggle.contains(e.target)) {
                searchContainer.classList.remove('expanded');
            }
        });
        
        // 搜索输入框回车事件（可选）
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                // 可以添加搜索提交逻辑
                console.log('搜索关键词:', searchInput.value);
            }
        });
    }
}

// 生成筛选选项
function generateFilterOptions() {
    if (!currentDatabase) return;
    
    const data = currentDatabase.data;
    
    // 获取所有流派
    const genres = [...new Set(data.map(song => song.基础信息.流派))].sort();
    const genreFilter = document.getElementById('genreFilter');
    genreFilter.innerHTML = `<option value="">${t('library.filter.all', '全部')}</option>`;
    genres.forEach(genre => {
        const option = document.createElement('option');
        option.value = genre;
        option.textContent = genre;
        genreFilter.appendChild(option);
    });
    
    // 获取所有版本
    const versions = [...new Set(data.map(song => song.基础信息.版本))].sort();
    const versionFilter = document.getElementById('versionFilter');
    versionFilter.innerHTML = `<option value="">${t('library.filter.all', '全部')}</option>`;
    versions.forEach(version => {
        const option = document.createElement('option');
        option.value = version;
        option.textContent = version;
        versionFilter.appendChild(option);
    });
    
    // 动态生成等级筛选选项
    const levelFilter = document.getElementById('levelFilter');
    // 获取所有唯一等级
    const allLevels = [];
    data.forEach(song => {
        if (song.基础信息.等级) {
            song.基础信息.等级.forEach(level => {
                if (!allLevels.includes(level)) {
                    allLevels.push(level);
                }
            });
        }
    });
    // 按数字大小排序
    allLevels.sort((a, b) => {
        // 处理带+号的等级，如"12+"
        const aNum = parseFloat(a.replace('+', ''));
        const bNum = parseFloat(b.replace('+', ''));
        return aNum - bNum;
    });
    // 更新等级筛选选项
    levelFilter.innerHTML = `<option value="">${t('library.filter.all', '全部')}</option>`;
    allLevels.forEach(level => {
        const option = document.createElement('option');
        option.value = level;
        option.textContent = level;
        levelFilter.appendChild(option);
    });
}

// 添加筛选事件监听器
function addFilterEventListeners() {
    const genreFilter = document.getElementById('genreFilter');
    const versionFilter = document.getElementById('versionFilter');
    const levelFilter = document.getElementById('levelFilter');
    const searchInput = document.getElementById('searchInput');
    const resetFilter = document.getElementById('resetFilter');
    
    // 移除之前的事件监听器（防止重复绑定）
    if (genreFilter._filterHandler) {
        genreFilter.removeEventListener('change', genreFilter._filterHandler);
    }
    if (versionFilter._filterHandler) {
        versionFilter.removeEventListener('change', versionFilter._filterHandler);
    }
    if (levelFilter._filterHandler) {
        levelFilter.removeEventListener('change', levelFilter._filterHandler);
    }
    if (searchInput._filterHandler) {
        searchInput.removeEventListener('input', searchInput._filterHandler);
    }
    
    // 筛选事件
    const filterSongs = () => {
        console.log('Filter triggered');
        const genre = genreFilter.value;
        const version = versionFilter.value;
        const level = levelFilter.value;
        const searchTerm = searchInput.value.trim().toLowerCase();
        
        let result = songs;
        
        // 先执行基础筛选
        if (genre) {
            result = result.filter(song => song.基础信息.流派 === genre);
        }
        
        if (version) {
            result = result.filter(song => song.基础信息.版本 === version);
        }
        
        if (level) {
            result = result.filter(song => {
                return song.基础信息.等级.some(l => l === level || l.startsWith(level + '+'));
            });
        }
        
        // 然后执行搜索筛选（匹配歌名或别名）
        if (searchTerm) {
            console.log(`搜索关键词：${searchTerm}`);
            console.log(`筛选后待搜索歌曲：${result.length}`);
            
            // 遍历筛选后的歌曲进行搜索
            result = result.filter(song => {
                const songInfo = song.基础信息;
                
                // 匹配歌名
                const title = songInfo.歌名 ? songInfo.歌名.toLowerCase() : '';
                const matchTitle = title.includes(searchTerm);
                
                // 匹配别名
                let matchAlias = false;
                
                // 重点：JSON中的"别名"字段在根对象下，不在"基础信息"内
                if (song.别名) {
                    // 处理各种可能的别名格式
                    if (typeof song.别名 === 'string') {
                        matchAlias = song.别名.toLowerCase().includes(searchTerm);
                    } 
                    else if (Array.isArray(song.别名)) {
                        matchAlias = song.别名.some(alias => 
                            alias.toLowerCase().includes(searchTerm)
                        );
                    } 
                    else {
                        // 处理其他类型
                        matchAlias = String(song.别名).toLowerCase().includes(searchTerm);
                    }
                }
                
                return matchTitle || matchAlias;
            });
            
            console.log(`搜索结果：${result.length} 首歌曲`);
        }
        
        // 重置滚动状态
        resetScrollListener();
        
        // 显示筛选结果
        displaySongs(result);
    };
    
    // 保存处理器引用
    genreFilter._filterHandler = filterSongs;
    versionFilter._filterHandler = filterSongs;
    levelFilter._filterHandler = filterSongs;
    searchInput._filterHandler = filterSongs;
    
    // 添加筛选事件
    genreFilter.addEventListener('change', filterSongs);
    versionFilter.addEventListener('change', filterSongs);
    levelFilter.addEventListener('change', filterSongs);
    searchInput.addEventListener('input', filterSongs);
    
    // 重置筛选
    if (resetFilter._resetHandler) {
        resetFilter.removeEventListener('click', resetFilter._resetHandler);
    }
    
    const resetHandler = () => {
        genreFilter.value = '';
        versionFilter.value = '';
        levelFilter.value = '';
        searchInput.value = '';
        
        // 重置滚动状态
        resetScrollListener();
        
        // 显示所有歌曲
        displaySongs(songs);
    };
    
    resetFilter._resetHandler = resetHandler;
    resetFilter.addEventListener('click', resetHandler);
}

// 曲库虚拟化相关变量
let filteredSongs = [];
let cardObserver = null; // 兼容保留，不再承担主要虚拟化逻辑

const LIBRARY_VIRTUAL_CARD_HEIGHT = 280;
const LIBRARY_VIRTUAL_CARD_MIN_WIDTH = 200;
const LIBRARY_VIRTUAL_DEFAULT_GAP = 24;
const LIBRARY_VIRTUAL_BUFFER_RATIO = 1 / 3;
const LIBRARY_VIRTUAL_MIN_BUFFER_ROWS = 2;
const LIBRARY_VIRTUAL_JUMP_ROWS = 8;

const libraryVirtualState = {
    renderedStart: -1,
    renderedEnd: -1,
    renderedColumns: 1,
    rowHeight: LIBRARY_VIRTUAL_CARD_HEIGHT + LIBRARY_VIRTUAL_DEFAULT_GAP,
    spacerTop: null,
    spacerBottom: null,
    scrollContainer: null,
    scrollHandler: null,
    resizeObserver: null,
    resizeHandler: null,
    rafPending: false
};

function getActiveSongsGrid() {
    const grids = Array.from(document.querySelectorAll('.songs-grid'));
    if (grids.length === 0) return null;

    const visibleGrid = grids.find(grid => grid.offsetParent !== null);
    return visibleGrid || grids[0];
}

function getActiveLibraryMain() {
    const mains = Array.from(document.querySelectorAll('.library-main'));
    if (mains.length === 0) return null;

    const visibleMain = mains.find(main => main.offsetParent !== null);
    return visibleMain || mains[0];
}

function getLibraryScrollContainer() {
    return getActiveSongsGrid();
}

function getLibraryGridGap() {
    const grid = getActiveSongsGrid();
    if (!grid) return LIBRARY_VIRTUAL_DEFAULT_GAP;

    const style = window.getComputedStyle(grid);
    const parsed = parseFloat(style.rowGap || style.gap || `${LIBRARY_VIRTUAL_DEFAULT_GAP}`);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
    return LIBRARY_VIRTUAL_DEFAULT_GAP;
}

function computeLibraryGridColumns(grid) {
    if (!grid) return 1;
    const gap = getLibraryGridGap();
    const width = grid.clientWidth;
    if (!Number.isFinite(width) || width <= 0) return 1;
    return Math.max(1, Math.floor((width + gap) / (LIBRARY_VIRTUAL_CARD_MIN_WIDTH + gap)));
}

function ensureVirtualSpacers(grid) {
    if (!grid) return;

    let spacerTop = grid.querySelector('.virtual-spacer-top');
    let spacerBottom = grid.querySelector('.virtual-spacer-bottom');

    if (!spacerTop) {
        spacerTop = document.createElement('div');
        spacerTop.className = 'virtual-spacer virtual-spacer-top';
        spacerTop.style.height = '0px';
        grid.appendChild(spacerTop);
    }

    if (!spacerBottom) {
        spacerBottom = document.createElement('div');
        spacerBottom.className = 'virtual-spacer virtual-spacer-bottom';
        spacerBottom.style.height = '0px';
        grid.appendChild(spacerBottom);
    }

    libraryVirtualState.spacerTop = spacerTop;
    libraryVirtualState.spacerBottom = spacerBottom;
}

function clearVirtualizedCards(grid) {
    if (!grid) return;

    const removableCards = Array.from(grid.querySelectorAll('.song-card'));
    removableCards.forEach(card => {
        const lazyImages = card.querySelectorAll('img[data-lazy="true"]');
        lazyImages.forEach(image => {
            if (imageObserver) imageObserver.unobserve(image);
            unloadLazyImageTarget(image, { immediate: true });
        });
        card.remove();
    });
}

function getLibraryViewportMetrics(scrollContainer, grid) {
    const containerScrollTop = scrollContainer.scrollTop;
    const containerBottom = containerScrollTop + scrollContainer.clientHeight;

    let viewportStart = 0;
    let viewportEnd = 0;
    if (scrollContainer === grid) {
        viewportStart = Math.max(0, containerScrollTop);
        viewportEnd = Math.max(0, containerBottom);
    } else {
        const gridStart = grid.offsetTop;
        viewportStart = Math.max(0, containerScrollTop - gridStart);
        viewportEnd = Math.max(0, containerBottom - gridStart);
    }

    const viewportHeight = Math.max(0, viewportEnd - viewportStart);

    return {
        viewportStart,
        viewportEnd,
        viewportHeight
    };
}

function computeVirtualWindowBounds(viewportStart, viewportEnd, rowHeight, columns, totalSongs) {
    const totalRows = Math.ceil(totalSongs / columns);
    if (totalRows <= 0) {
        return {
            startIndex: 0,
            endIndex: 0,
            startRow: 0,
            endRow: 0,
            totalRows: 0,
            visibleCount: 0
        };
    }

    const safeRowHeight = Number.isFinite(rowHeight) && rowHeight > 0
        ? rowHeight
        : (LIBRARY_VIRTUAL_CARD_HEIGHT + LIBRARY_VIRTUAL_DEFAULT_GAP);
    const visibleStartRow = Math.max(0, Math.floor(viewportStart / safeRowHeight));
    const visibleEndRowRaw = Math.max(visibleStartRow + 1, Math.ceil(viewportEnd / safeRowHeight));
    const visibleEndRow = Math.min(totalRows, visibleEndRowRaw);
    const visibleStartIndex = visibleStartRow * columns;
    const visibleEndIndex = Math.min(totalSongs, visibleEndRow * columns);
    const visibleCount = Math.max(columns, visibleEndIndex - visibleStartIndex);

    const minBufferCount = columns * LIBRARY_VIRTUAL_MIN_BUFFER_ROWS;
    const dynamicBufferCount = Math.floor(visibleCount * LIBRARY_VIRTUAL_BUFFER_RATIO);
    const bufferCount = Math.max(minBufferCount, dynamicBufferCount);

    let startIndex = Math.max(0, visibleStartIndex - bufferCount);
    let endIndex = Math.min(totalSongs, visibleEndIndex + bufferCount);

    if (endIndex <= startIndex) {
        endIndex = Math.min(totalSongs, startIndex + Math.max(columns, visibleCount));
    }

    const startRow = Math.floor(startIndex / columns);
    const endRow = Math.ceil(endIndex / columns);

    return {
        startIndex,
        endIndex,
        startRow,
        endRow,
        totalRows,
        visibleCount
    };
}

function syncVirtualizedSongsWindow(grid, startIndex, endIndex) {
    if (!grid) return;
    const spacerBottom = libraryVirtualState.spacerBottom;
    if (!spacerBottom) return;

    const existingCards = Array.from(grid.querySelectorAll('.song-card'));
    const existingCardMap = new Map();

    existingCards.forEach(card => {
        const cardIndex = Number(card.dataset.songIndex);
        if (!Number.isFinite(cardIndex)) {
            const lazyImages = card.querySelectorAll('img[data-lazy="true"]');
            lazyImages.forEach(image => {
                if (imageObserver) imageObserver.unobserve(image);
                unloadLazyImageTarget(image, { immediate: true });
            });
            card.remove();
            return;
        }

        if (existingCardMap.has(cardIndex)) {
            const lazyImages = card.querySelectorAll('img[data-lazy="true"]');
            lazyImages.forEach(image => {
                if (imageObserver) imageObserver.unobserve(image);
                unloadLazyImageTarget(image, { immediate: true });
            });
            card.remove();
            return;
        }

        existingCardMap.set(cardIndex, card);
    });

    const fragment = document.createDocumentFragment();
    for (let index = startIndex; index < endIndex; index += 1) {
        const song = filteredSongs[index];
        if (!song) continue;

        let songCard = existingCardMap.get(index);
        if (songCard) {
            existingCardMap.delete(index);
        } else {
            songCard = createSongCard(song);
            songCard.dataset.songIndex = String(index);
        }

        fragment.appendChild(songCard);
    }

    grid.insertBefore(fragment, spacerBottom);

    existingCardMap.forEach(card => {
        const lazyImages = card.querySelectorAll('img[data-lazy="true"]');
        lazyImages.forEach(image => {
            if (imageObserver) imageObserver.unobserve(image);
            unloadLazyImageTarget(image, { immediate: true });
        });
        card.remove();
    });
}

function forceLoadRenderedWindowImages(grid) {
    if (!grid) return;
    const lazyImages = grid.querySelectorAll('.song-card img[data-lazy="true"]');
    lazyImages.forEach(image => {
        loadLazyImageTarget(image);
    });
}

function renderVirtualizedSongs(force = false) {
    const grid = getActiveSongsGrid();
    const scrollContainer = getLibraryScrollContainer();
    if (!grid || !scrollContainer) return;

    ensureVirtualSpacers(grid);
    const spacerTop = libraryVirtualState.spacerTop;
    const spacerBottom = libraryVirtualState.spacerBottom;
    if (!spacerTop || !spacerBottom) return;

    if (!Array.isArray(filteredSongs) || filteredSongs.length === 0) {
        clearVirtualizedCards(grid);
        spacerTop.style.height = '0px';
        spacerBottom.style.height = '0px';
        libraryVirtualState.renderedStart = -1;
        libraryVirtualState.renderedEnd = -1;
        libraryVirtualState.renderedColumns = 1;
        return;
    }

    const columns = computeLibraryGridColumns(grid);
    const gap = getLibraryGridGap();
    const rowHeight = LIBRARY_VIRTUAL_CARD_HEIGHT + gap;

    const {
        viewportStart,
        viewportEnd,
        viewportHeight
    } = getLibraryViewportMetrics(scrollContainer, grid);

    const effectiveViewportStart = Math.max(0, viewportStart);
    const effectiveViewportEnd = Math.max(
        effectiveViewportStart + 1,
        viewportHeight > 0 ? viewportEnd : (effectiveViewportStart + scrollContainer.clientHeight)
    );

    const {
        startIndex,
        endIndex,
        startRow,
        endRow,
        totalRows,
        visibleCount
    } = computeVirtualWindowBounds(
        effectiveViewportStart,
        effectiveViewportEnd,
        rowHeight,
        columns,
        filteredSongs.length
    );

    const unchanged = !force &&
        libraryVirtualState.renderedStart === startIndex &&
        libraryVirtualState.renderedEnd === endIndex &&
        libraryVirtualState.renderedColumns === columns &&
        libraryVirtualState.rowHeight === rowHeight;

    if (unchanged) return;

    const previousStart = libraryVirtualState.renderedStart;
    const jumpThreshold = Math.max(visibleCount, columns * LIBRARY_VIRTUAL_JUMP_ROWS);
    const isRapidJump = previousStart >= 0 && Math.abs(startIndex - previousStart) >= jumpThreshold;

    syncVirtualizedSongsWindow(grid, startIndex, endIndex);

    const topRows = startRow;
    const bottomRows = Math.max(0, totalRows - endRow);
    spacerTop.style.height = `${topRows * rowHeight}px`;
    spacerBottom.style.height = `${bottomRows * rowHeight}px`;

    libraryVirtualState.renderedStart = startIndex;
    libraryVirtualState.renderedEnd = endIndex;
    libraryVirtualState.renderedColumns = columns;
    libraryVirtualState.rowHeight = rowHeight;

    refreshLibraryImageObservers();

    if (isRapidJump) {
        forceLoadRenderedWindowImages(grid);
    }
}

// 加速搜索 - 预处理的歌曲索引
let songSearchIndex = [];

// 构建搜索索引
function buildSearchIndex() {
    if (!songs || songs.length === 0) {
        console.log('无歌曲数据，无法构建搜索索引');
        return;
    }
    
    // 清空索引
    songSearchIndex = [];
    
    console.log(`开始构建搜索索引，共 ${songs.length} 首歌曲`);
    
    // 遍历所有歌曲，构建索引
    songs.forEach((song, index) => {
        const songInfo = song.基础信息;
        
        // 收集所有搜索字段
        const searchFields = [];
        
        // 添加歌名
        if (songInfo.歌名) {
            searchFields.push(songInfo.歌名.toLowerCase());
        }
        
        // 添加别名 - 重点：JSON中的"别名"字段在根对象下，不在"基础信息"内
        if (song.别名) {
            // 调试：打印别名信息
            console.log(`歌曲 ${songInfo.歌名} 的别名：`, song.别名);
            
            // 如果是字符串直接添加
            if (typeof song.别名 === 'string') {
                searchFields.push(song.别名.toLowerCase());
                console.log(`添加字符串别名：${song.别名.toLowerCase()}`);
            }
            // 如果是数组遍历添加
            else if (Array.isArray(song.别名)) {
                song.别名.forEach(alias => {
                    searchFields.push(alias.toLowerCase());
                    console.log(`添加数组别名：${alias.toLowerCase()}`);
                });
            }
            // 处理其他可能的类型
            else {
                searchFields.push(String(song.别名).toLowerCase());
                console.log(`添加其他类型别名：${String(song.别名).toLowerCase()}`);
            }
        }
        
        // 创建索引项
        const indexItem = {
            song: song,
            searchText: searchFields.join(' '), // 合并为一个字符串，方便搜索
            originalIndex: index
        };
        
        songSearchIndex.push(indexItem);
        
        // 调试：打印索引项
        if (index < 5) { // 只打印前5首歌曲的索引信息
            console.log(`索引项 ${index}：`, indexItem.searchText);
        }
    });
    
    console.log(`搜索索引构建完成，共 ${songSearchIndex.length} 个索引项`);
}

// 当歌曲数据更新时重新构建索引
function updateSearchIndex() {
    buildSearchIndex();
}

// 显示歌曲列表
function displaySongs(songList) {
    filteredSongs = Array.isArray(songList) ? songList : [];

    // 更新显示数量
    const countValueElement = document.getElementById('countValue');
    if (countValueElement) {
        countValueElement.textContent = filteredSongs.length;
    }

    const songsGrid = getActiveSongsGrid();
    if (!songsGrid) {
        console.error('[LIBRARY-001] songs-grid 容器不存在，无法渲染歌曲列表');
        return;
    }

    const scrollContainer = getLibraryScrollContainer();
    if (scrollContainer) {
        scrollContainer.scrollTop = 0;
    }

    releaseLibraryGridImages(songsGrid);
    songsGrid.innerHTML = '';

    ensureVirtualSpacers(songsGrid);
    addScrollListener();
    renderVirtualizedSongs(true);
}

// 滚动节流函数，减少滚动事件触发次数
function throttle(func, delay) {
    let timeoutId;
    return function() {
        const context = this;
        const args = arguments;
        if (!timeoutId) {
            timeoutId = setTimeout(() => {
                func.apply(context, args);
                timeoutId = null;
            }, delay);
        }
    };
}

// 添加滚动监听
function addScrollListener() {
    const container = getLibraryScrollContainer();
    if (!container) return;

    if (libraryVirtualState.scrollContainer && libraryVirtualState.scrollHandler) {
        libraryVirtualState.scrollContainer.removeEventListener('scroll', libraryVirtualState.scrollHandler);
    }

    const onScroll = () => {
        if (libraryVirtualState.rafPending) return;
        libraryVirtualState.rafPending = true;
        requestAnimationFrame(() => {
            libraryVirtualState.rafPending = false;
            handleScroll();
        });
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    libraryVirtualState.scrollContainer = container;
    libraryVirtualState.scrollHandler = onScroll;

    const songsGrid = getActiveSongsGrid();
    if (songsGrid && 'ResizeObserver' in window) {
        if (libraryVirtualState.resizeObserver) {
            libraryVirtualState.resizeObserver.disconnect();
        }
        libraryVirtualState.resizeObserver = new ResizeObserver(() => {
            renderVirtualizedSongs(true);
        });
        libraryVirtualState.resizeObserver.observe(container);
        libraryVirtualState.resizeObserver.observe(songsGrid);
    } else if (!libraryVirtualState.resizeHandler) {
        const resizeHandler = throttle(() => {
            renderVirtualizedSongs(true);
        }, 80);
        window.addEventListener('resize', resizeHandler);
        libraryVirtualState.resizeHandler = resizeHandler;
    }

    // 初始化卡片可见性观察器（兼容保留）
    initCardVisibilityObserver();
}

// 初始化卡片可见性观察器
function initCardVisibilityObserver() {
    if (cardObserver) {
        cardObserver.disconnect();
        cardObserver = null;
    }
}

// 滚动处理函数
function handleScroll() {
    hideLevelTooltip(true);
    renderVirtualizedSongs();
}


// 重置滚动监听
function resetScrollListener() {
    if (libraryVirtualState.scrollContainer && libraryVirtualState.scrollHandler) {
        libraryVirtualState.scrollContainer.removeEventListener('scroll', libraryVirtualState.scrollHandler);
    }

    libraryVirtualState.scrollContainer = null;
    libraryVirtualState.scrollHandler = null;
    libraryVirtualState.rafPending = false;

    if (libraryVirtualState.resizeObserver) {
        libraryVirtualState.resizeObserver.disconnect();
        libraryVirtualState.resizeObserver = null;
    }

    if (libraryVirtualState.resizeHandler) {
        window.removeEventListener('resize', libraryVirtualState.resizeHandler);
        libraryVirtualState.resizeHandler = null;
    }

    libraryVirtualState.renderedStart = -1;
    libraryVirtualState.renderedEnd = -1;
    libraryVirtualState.renderedColumns = 1;
    libraryVirtualState.rowHeight = LIBRARY_VIRTUAL_CARD_HEIGHT + getLibraryGridGap();

    // 清理观察器
    if (cardObserver) {
        cardObserver.disconnect();
        cardObserver = null;
    }
}

// 选中歌曲管理
let selectedSongs = new Map(); // 使用Map存储选中的歌曲，key为MusicID，value为歌曲对象

// 导出弹窗元素
const exportDialog = document.getElementById('exportDialog');
const exportFileNameInput = document.getElementById('exportFileName');
const exportConfirmBtn = document.getElementById('exportConfirm');
const exportCancelBtn = document.getElementById('exportCancel');

// 初始化选中歌曲功能
function initSelectedSongs() {
    // 添加导出弹窗事件监听
    if (exportConfirmBtn) exportConfirmBtn.addEventListener('click', handleExportConfirm);
    if (exportCancelBtn) exportCancelBtn.addEventListener('click', handleExportCancel);
    
    // 添加全部清除和导出按钮事件监听
    const clearAllBtn = document.getElementById('clearAllSongs');
    const exportBtn = document.getElementById('exportSongs');
    
    if (clearAllBtn) clearAllBtn.addEventListener('click', clearAllSelectedSongs);
    if (exportBtn) exportBtn.addEventListener('click', showExportDialog);
}

// 图片懒加载配置
let imageObserver;
let imageObserverRoot = null;
const TRANSPARENT_PIXEL_DATA_URL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

function getLibraryImageObserverRoot() {
    const scrollContainer = getLibraryScrollContainer();
    if (scrollContainer && scrollContainer.offsetParent !== null) {
        return scrollContainer;
    }
    return null;
}

function loadLazyImageTarget(image) {
    if (!image) return;
    ensureLazyImageTransitionHooks(image);
    clearLazyImageUnloadTimer(image);
    image.dataset.imageUnloading = 'false';

    const imagePath = image.dataset.imagePath || image.dataset.src;
    if (!imagePath) return;

    let resolvedSource = '';
    try {
        resolvedSource = resolveImageSourcePath(imagePath);
    } catch (error) {
        console.warn('Failed to resolve lazy image source:', error);
        return;
    }

    if (!resolvedSource) return;

    image.dataset.src = resolvedSource;

    if (image.src === resolvedSource) {
        if (image.complete && image.naturalWidth > 0) {
            image.dataset.imageLoaded = 'true';
            setSongImageVisualState(image, 'loaded');
        } else {
            setSongImageVisualState(image, 'loading');
        }
        return;
    }

    image.dataset.imageLoaded = 'false';
    setSongImageVisualState(image, 'loading');
    image.src = resolvedSource;
}

function unloadLazyImageTarget(image, options = {}) {
    const { immediate = false } = options;
    if (!image || image.dataset.lazy !== 'true') return;

    const runUnload = () => {
        if (image.dataset.imageUnloading !== 'true') return;
        image.src = TRANSPARENT_PIXEL_DATA_URL;
        image.dataset.imageLoaded = 'false';
        image.dataset.imageUnloading = 'false';
        setSongImageVisualState(image, 'loading');
        lazyImageUnloadTimers.delete(image);
    };

    clearLazyImageUnloadTimer(image);

    if (image.dataset.imageLoaded !== 'true') return;
    image.dataset.imageUnloading = 'true';
    setSongImageVisualState(image, 'unloading');

    if (immediate) {
        runUnload();
        return;
    }

    const timerId = window.setTimeout(runUnload, LAZY_IMAGE_UNLOAD_DELAY_MS);
    lazyImageUnloadTimers.set(image, timerId);
}

function rebuildImageObserver(root = getLibraryImageObserverRoot()) {
    if (!('IntersectionObserver' in window)) {
        imageObserver = null;
        imageObserverRoot = null;
        return;
    }

    const normalizedRoot = root || null;
    if (imageObserver && imageObserverRoot === normalizedRoot) {
        return;
    }

    if (imageObserver) {
        imageObserver.disconnect();
    }

    imageObserverRoot = normalizedRoot;
    imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const image = entry.target;
            if (!(image instanceof HTMLImageElement)) return;

            if (entry.isIntersecting) {
                loadLazyImageTarget(image);
            } else {
                unloadLazyImageTarget(image);
            }
        });
    }, {
        root: imageObserverRoot,
        rootMargin: '280px 0px',
        threshold: 0.01
    });
}

function refreshLibraryImageObservers() {
    const libraryPage = document.getElementById('libraryPage');
    const isLibraryVisible = !!(libraryPage && libraryPage.offsetParent !== null);
    if (!isLibraryVisible) {
        rebuildImageObserver(null);
        return;
    }

    const activeGrid = getActiveSongsGrid();
    rebuildImageObserver(getLibraryImageObserverRoot());

    if (!activeGrid || !imageObserver) return;
    const lazyImages = activeGrid.querySelectorAll('img[data-lazy="true"]');
    lazyImages.forEach(image => {
        imageObserver.observe(image);
    });
}

function releaseLibraryGridImages(container = getActiveSongsGrid()) {
    if (!container) return;
    const lazyImages = container.querySelectorAll('img[data-lazy="true"]');
    lazyImages.forEach(image => {
        if (imageObserver) {
            imageObserver.unobserve(image);
        }
        unloadLazyImageTarget(image, { immediate: true });
    });
}

// 初始化图片懒加载
function initLazyLoading() {
    if (!('IntersectionObserver' in window)) return;
    rebuildImageObserver();
}

// 观察图片是否进入可视区域
function observeImage(image) {
    if (imageObserver) {
        imageObserver.observe(image);
    } else {
        loadLazyImageTarget(image);
    }
}

// 难度定数提示状态
const levelTooltipState = {
    element: null,
    owner: null,
    dismissHandler: null,
    dismissAttached: false,
    fadeTimeoutId: null
};

function detachLevelTooltipDismissListeners() {
    if (!levelTooltipState.dismissAttached || !levelTooltipState.dismissHandler) return;
    const handler = levelTooltipState.dismissHandler;

    window.removeEventListener('wheel', handler, true);
    window.removeEventListener('scroll', handler, true);
    window.removeEventListener('resize', handler);
    window.removeEventListener('blur', handler);
    document.removeEventListener('visibilitychange', handler);

    levelTooltipState.dismissAttached = false;
    levelTooltipState.dismissHandler = null;
}

function attachLevelTooltipDismissListeners() {
    if (levelTooltipState.dismissAttached) return;
    const handler = () => hideLevelTooltip(true);
    levelTooltipState.dismissHandler = handler;

    window.addEventListener('wheel', handler, { passive: true, capture: true });
    window.addEventListener('scroll', handler, { passive: true, capture: true });
    window.addEventListener('resize', handler, { passive: true });
    window.addEventListener('blur', handler);
    document.addEventListener('visibilitychange', handler);

    levelTooltipState.dismissAttached = true;
}

function hideLevelTooltip(immediate = false) {
    if (levelTooltipState.fadeTimeoutId) {
        clearTimeout(levelTooltipState.fadeTimeoutId);
        levelTooltipState.fadeTimeoutId = null;
    }

    const tooltip = levelTooltipState.element;
    const owner = levelTooltipState.owner;

    levelTooltipState.element = null;
    levelTooltipState.owner = null;
    detachLevelTooltipDismissListeners();

    if (owner && owner.dataset) {
        delete owner.dataset.tooltipVisible;
    }

    if (!tooltip || !tooltip.isConnected) return;

    if (immediate) {
        tooltip.remove();
        return;
    }

    tooltip.style.opacity = '0';
    levelTooltipState.fadeTimeoutId = window.setTimeout(() => {
        if (tooltip.isConnected) {
            tooltip.remove();
        }
        levelTooltipState.fadeTimeoutId = null;
    }, 180);
}

function showLevelTooltip(levelCylinder, levelValue) {
    if (!levelCylinder) return;
    hideLevelTooltip(true);

    const tooltip = document.createElement('div');
    tooltip.className = 'level-tooltip';
    tooltip.textContent = t('library.level_constant', '定数: {value}', { value: levelValue });
    tooltip.style.position = 'absolute';
    tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    tooltip.style.color = 'white';
    tooltip.style.padding = '8px 12px';
    tooltip.style.borderRadius = '8px';
    tooltip.style.fontSize = '14px';
    tooltip.style.zIndex = '1000';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.transition = 'opacity 0.15s ease';
    tooltip.style.opacity = '0';
    tooltip.style.whiteSpace = 'nowrap';

    const rect = levelCylinder.getBoundingClientRect();
    const top = rect.top + window.scrollY - 40;
    tooltip.style.left = `${rect.left + window.scrollX + rect.width / 2}px`;
    tooltip.style.top = `${Math.max(window.scrollY + 8, top)}px`;
    tooltip.style.transform = 'translateX(-50%)';

    document.body.appendChild(tooltip);
    levelTooltipState.element = tooltip;
    levelTooltipState.owner = levelCylinder;
    levelCylinder.dataset.tooltipVisible = 'true';
    attachLevelTooltipDismissListeners();

    requestAnimationFrame(() => {
        if (levelTooltipState.element === tooltip) {
            tooltip.style.opacity = '1';
        }
    });
}

// 创建歌曲卡片
function createSongCard(song) {
    const card = document.createElement('div');
    card.className = 'song-card';
    
    const songInfo = song.基础信息;
    const musicId = String(songInfo.MusicID ?? '');
    card.dataset.musicId = musicId;
    if (selectedSongs.has(musicId)) {
        card.classList.add('selected');
    }
    
    // 获取曲绘URL
    const imageUrl = `./MaiSongLib/${songInfo.image_url}`;
    
    // 创建曲绘容器
    const imageContainer = document.createElement('div');
    imageContainer.className = 'song-image';
    imageContainer.classList.add('image-loading');
    const image = document.createElement('img');
    bindImageElementSource(image, imageUrl, { lazy: true });
    // 使用浏览器原生懒加载作为补充
    image.loading = 'lazy';
    image.alt = songInfo.title;
    image.onerror = () => {
        // 图片加载失败时显示默认图像
        image.src = getSongCoverFallbackDataUri();
    };
    imageContainer.appendChild(image);
    
    // 添加歌曲类型标签
    const songType = song.基础信息.type || t('song.type.standard', '标准'); // 从基础信息中获取type字段
    const typeTag = document.createElement('div');
    typeTag.className = `song-type-tag ${songType === 'DX' ? 'dx' : 'standard'}`;
    typeTag.textContent = songType === 'DX' ? 'DX' : t('song.type.standard', '标准');
    imageContainer.appendChild(typeTag);
    
    // 创建歌曲信息容器
    const infoContainer = document.createElement('div');
    infoContainer.className = 'song-info';
    
    // 歌名
    const title = document.createElement('div');
    title.className = 'song-title';
    title.textContent = songInfo.歌名; // 修复：使用正确的中文字段名
    infoContainer.appendChild(title);
    
    // 等级容器
    const levelsContainer = document.createElement('div');
    levelsContainer.className = 'song-levels';
    
    // 等级颜色映射
    const levelColors = {
        '5': '#4CAF50', // 绿
        '6': '#4CAF50', // 绿
        '7': '#4CAF50', // 绿
        '8': '#FFC107', // 黄
        '9': '#FFC107', // 黄
        '10': '#FF5722', // 红
        '11': '#FF5722', // 红
        '12': '#9C27B0', // 紫
        '13': '#9C27B0', // 紫
        '14': '#9C27B0', // 紫
        '白': '#ffd9fd'  // 白
    };
    
    // 添加等级圆柱 - 按照绿、黄、红、紫、白的顺序
    const levels = songInfo.等级;
    const levelValues = songInfo.定数 || []; // 获取定数数组
    const colorOrder = [
        '#4CAF50', // 绿 - 第一个难度
        '#FFC107', // 黄 - 第二个难度
        '#FF5722', // 红 - 第三个难度
        '#9C27B0', // 紫 - 第四个难度
        '#ffd9fd'  // 白 - 第五个难度（如果有）
    ];
    
    // 只显示最多5个难度，按照位置分配颜色
    for (let i = 0; i < Math.min(levels.length, 5); i++) {
        const level = levels[i];
        const levelCylinder = document.createElement('div');
        levelCylinder.className = 'level-cylinder';
        
        // 按照位置分配颜色，从左到右依次为绿、黄、红、紫、白
        const color = colorOrder[i];
        levelCylinder.style.backgroundColor = color;
        levelCylinder.textContent = level;
        
        // 添加定数显示功能
        if (levelValues[i] !== undefined) {
            const levelValue = levelValues[i];
            const tooltipText = t('library.level_constant', '定数: {value}', { value: levelValue });
            levelCylinder.setAttribute('aria-label', tooltipText);
            
            levelCylinder.addEventListener('mouseenter', () => {
                showLevelTooltip(levelCylinder, levelValue);
            });
            
            levelCylinder.addEventListener('mouseleave', () => {
                hideLevelTooltip();
            });
        }
        
        levelsContainer.appendChild(levelCylinder);
    }
    
    infoContainer.appendChild(levelsContainer);
    
    card.appendChild(imageContainer);
    card.appendChild(infoContainer);
    
    // 添加点击选中事件
    card.addEventListener('click', () => {
        toggleSongSelection(song, card);
    });
    
    return card;
}

// 鼠标跟随效果
let mouseX = 0;
let mouseY = 0;

window.addEventListener('mousemove', (e) => {
    if (!isMouseTrailEnabled()) {
        return;
    }

    mouseX = e.clientX;
    mouseY = e.clientY;
    
    // 更新CSS变量
    document.documentElement.style.setProperty('--mouse-x', `${mouseX}px`);
    document.documentElement.style.setProperty('--mouse-y', `${mouseY}px`);
});

// 切换歌曲选中状态
function toggleSongSelection(song, cardElement) {
    const musicId = String(song.基础信息.MusicID ?? '');
    
    if (selectedSongs.has(musicId)) {
        // 取消选中
        selectedSongs.delete(musicId);
        cardElement.classList.remove('selected');
    } else {
        // 添加选中
        selectedSongs.set(musicId, song);
        cardElement.classList.add('selected');
    }
    
    // 更新选中歌曲列表
    updateSelectedSongsList();
}

// 更新选中歌曲列表
function updateSelectedSongsList() {
    const listContainer = document.getElementById('selectedSongsList');
    if (!listContainer) return;
    
    // 清空列表
    listContainer.innerHTML = '';
    listContainer.classList.remove('is-empty');
    
    // 如果没有选中歌曲，显示提示
    if (selectedSongs.size === 0) {
        listContainer.classList.add('is-empty');
        const emptyMessage = document.createElement('div');
        emptyMessage.style.textAlign = 'center';
        emptyMessage.style.color = 'var(--text-secondary)';
        emptyMessage.style.padding = '20px';
        emptyMessage.style.fontSize = '14px';
        emptyMessage.textContent = t('library.selected.empty', '暂无选中歌曲，请点击歌曲卡片添加');
        listContainer.appendChild(emptyMessage);
        return;
    }
    
    // 生成选中歌曲列表
    selectedSongs.forEach((song, musicId) => {
        const songItem = document.createElement('div');
        songItem.className = 'selected-song-item';
        songItem.dataset.musicId = musicId;
        
        // 添加曲绘
        const songImage = document.createElement('img');
        const imageUrl = `./MaiSongLib/${song.基础信息.image_url}`;
        bindImageElementSource(songImage, imageUrl);
        songImage.alt = song.基础信息.歌名;
        songItem.appendChild(songImage);
        
        // 添加曲名
        const songTitle = document.createElement('div');
        songTitle.className = 'selected-song-title';
        songTitle.textContent = song.基础信息.歌名;
        songItem.appendChild(songTitle);
        
        // 添加删除按钮
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-song-btn';
        removeBtn.innerHTML = '&times;';
        removeBtn.title = t('library.selected.remove_title', '删除这首歌');
        removeBtn.addEventListener('click', () => {
            removeSelectedSong(musicId);
        });
        songItem.appendChild(removeBtn);
        
        listContainer.appendChild(songItem);
    });
}

// 移除选中的歌曲
function removeSelectedSong(musicId) {
    selectedSongs.delete(musicId);
    
    // 更新歌曲卡片选中状态
    const allCards = document.querySelectorAll('.song-card');
    allCards.forEach(card => {
        // 查找对应musicId的卡片
        const cardMusicId = card.dataset.musicId;
        if (cardMusicId === musicId) {
            card.classList.remove('selected');
        }
    });
    
    // 更新选中歌曲列表
    updateSelectedSongsList();
}

// 清除所有选中歌曲
function clearAllSelectedSongs() {
    // 清空选中歌曲Map
    selectedSongs.clear();
    
    // 移除所有卡片的选中状态
    const allCards = document.querySelectorAll('.song-card');
    allCards.forEach(card => {
        card.classList.remove('selected');
    });
    
    // 更新选中歌曲列表
    updateSelectedSongsList();
}

// 显示导出弹窗
function showExportDialog() {
    if (!exportDialog) return;
    
    // 清空输入框
    if (exportFileNameInput) exportFileNameInput.value = '';
    
    // 显示弹窗
    exportDialog.classList.add('show');
}

// 处理导出确认
function handleExportConfirm() {
    if (!exportFileNameInput) return;
    
    const fileName = exportFileNameInput.value.trim();
    if (!fileName) {
        customAlert.show(t('common.tip', '提示'), t('common.enter_filename', '请输入文件名'));
        return;
    }
    
    // 生成导出内容
    const musicIds = Array.from(selectedSongs.keys()).join(',');
    
    // 保存文件
    saveExportFile(fileName, musicIds);
    
    // 关闭弹窗
    exportDialog.classList.remove('show');
}

// 处理导出取消
function handleExportCancel() {
    if (!exportDialog) return;
    exportDialog.classList.remove('show');
}

// 保存导出文件到服务器
async function saveExportFile(fileName, content) {
    try {
        // 发送POST请求到服务器API
        const response = await fetch('/api/create-file', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                filename: fileName,
                content: content
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // 显示成功提示
            customAlert.show(
                t('library.export.success.title', '导出成功'),
                t('library.export.success.message', '歌单已导出为 {filename}.txt\n文件已成功保存到MaiList文件夹中', { filename: fileName })
            );
        } else {
            // 显示错误提示
            customAlert.show(
                t('library.export.failed.title', '导出失败'),
                t('library.export.failed.create', '无法创建文件: {error}', { error: result.error })
            );
        }
    } catch (error) {
        // 显示网络错误提示
        customAlert.show(
            t('library.export.failed.title', '导出失败'),
            t('common.network_error', '网络错误: {error}', { error: error.message })
        );
    }
}

// MaiList文件管理功能
let selectedFiles = new Set(); // 存储选中的文件

// 初始化MaiList文件管理
function initMaiListManagement() {
    // 添加按钮事件监听
    const refreshBtn = document.getElementById('refreshMaiList');
    const batchDeleteBtn = document.getElementById('batchDeleteFiles');
    
    const handleFetchError = (error) => {
        console.error('获取MaiList文件列表失败:', error);
        customAlert.show(t('settings.mailist.load_failed.title', '文件列表加载失败'), formatAppError(error));
    };

    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            try {
                await fetchMaiListFiles();
            } catch (error) {
                handleFetchError(error);
            }
        });
    }

    if (batchDeleteBtn) batchDeleteBtn.addEventListener('click', handleBatchDelete);
    
    // 页面切换到设置页面时刷新文件列表
    document.querySelectorAll('.nav-item[data-page="settings"]').forEach(item => {
        item.addEventListener('click', async () => {
            try {
                await fetchMaiListFiles();
            } catch (error) {
                handleFetchError(error);
            }
        });
    });
    
    // 初始加载时获取文件列表
    fetchMaiListFiles().catch(handleFetchError);
}

// 获取MaiList文件夹中的文件列表
async function fetchMaiListFiles() {
    try {
        const response = await fetch('/api/get-files');
        if (!response.ok) {
            throw createAppError('APP-MAILIST-001', `获取MaiList文件失败，HTTP ${response.status}`);
        }

        const result = await response.json();
        if (!result || result.success !== true) {
            throw createAppError('APP-MAILIST-002', `获取MaiList文件失败: ${result?.error || '响应标记为失败'}`);
        }

        if (!Array.isArray(result.files)) {
            throw createAppError('APP-MAILIST-003', '获取MaiList文件失败: 返回格式不正确（files不是数组）');
        }

        renderMaiListFiles(result.files);
        return result.files;
    } catch (error) {
        renderMaiListFiles([]);
        throw error.code ? error : createAppError('APP-MAILIST-004', '获取MaiList文件失败', error);
    }
}

// 渲染文件列表
function renderMaiListFiles(files) {
    const listContainer = document.getElementById('mailistFilesList');
    if (!listContainer) return;
    
    // 清空列表
    listContainer.innerHTML = '';
    
    // 清空选中的文件
    selectedFiles.clear();
    
    // 更新批量删除按钮状态
    const batchDeleteBtn = document.getElementById('batchDeleteFiles');
    if (batchDeleteBtn) batchDeleteBtn.disabled = true;
    
    // 如果没有文件，显示提示
    if (files.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.style.textAlign = 'center';
        emptyMessage.style.color = 'var(--text-secondary)';
        emptyMessage.style.padding = '20px';
        emptyMessage.style.fontSize = '14px';
        emptyMessage.textContent = t('settings.mailist.empty', 'MaiList文件夹中暂无文件');
        listContainer.appendChild(emptyMessage);
        return;
    }
    
    // 生成文件列表
    files.forEach(file => {
        const fileItem = document.createElement('div');
        fileItem.className = 'selected-song-item';
        fileItem.dataset.fileName = file.name;
        
        // 添加复选框
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.style.marginRight = '12px';
        checkbox.addEventListener('change', (e) => {
            toggleFileSelection(file.name, e.target.checked);
        });
        fileItem.appendChild(checkbox);
        
        // 添加文件名
        const fileName = document.createElement('div');
        fileName.className = 'selected-song-title';
        fileName.style.flex = '1';
        fileName.textContent = file.name;
        fileItem.appendChild(fileName);
        
        // 添加文件大小
        const fileSize = document.createElement('div');
        fileSize.style.fontSize = '12px';
        fileSize.style.color = 'var(--text-secondary)';
        fileSize.style.marginRight = '12px';
        fileSize.textContent = `${(file.size / 1024).toFixed(2)} KB`;
        fileItem.appendChild(fileSize);
        
        // 添加修改时间
        const fileTime = document.createElement('div');
        fileTime.style.fontSize = '12px';
        fileTime.style.color = 'var(--text-secondary)';
        fileTime.style.marginRight = '12px';
        fileTime.textContent = new Date(file.mtime * 1000).toLocaleString();
        fileItem.appendChild(fileTime);
        
        // 添加单个删除按钮
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'remove-song-btn';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.title = t('settings.mailist.delete_button_title', '删除此文件');
        deleteBtn.addEventListener('click', () => {
            deleteSingleFile(file.name);
        });
        fileItem.appendChild(deleteBtn);
        
        listContainer.appendChild(fileItem);
    });
}

// 切换文件选中状态
function toggleFileSelection(fileName, isChecked) {
    if (isChecked) {
        selectedFiles.add(fileName);
    } else {
        selectedFiles.delete(fileName);
    }
    
    // 更新批量删除按钮状态
    const batchDeleteBtn = document.getElementById('batchDeleteFiles');
    if (batchDeleteBtn) {
        batchDeleteBtn.disabled = selectedFiles.size === 0;
    }
}

// 删除单个文件
async function deleteSingleFile(fileName) {
    const confirmed = await customAlert.confirm(
        t('settings.mailist.delete_file_confirm.title', '删除文件'),
        t('settings.mailist.delete_file_confirm.message', '确定要删除文件 {filename} 吗？', { filename: fileName }),
        t('common.confirm', '确定'),
        t('common.cancel', '取消')
    );
    
    if (confirmed) {
        await deleteFiles([fileName]);
    }
}

// 处理批量删除
async function handleBatchDelete() {
    if (selectedFiles.size === 0) return;
    
    const confirmed = await customAlert.confirm(
        t('settings.mailist.batch_delete_confirm.title', '批量删除'),
        t('settings.mailist.batch_delete_confirm.message', '确定要删除选中的 {count} 个文件吗？', { count: selectedFiles.size }),
        t('common.confirm', '确定'),
        t('common.cancel', '取消')
    );
    
    if (confirmed) {
        await deleteFiles(Array.from(selectedFiles));
    }
}

// 删除文件
async function deleteFiles(fileNames) {
    try {
        const response = await fetch('/api/delete-file', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                files: fileNames
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            customAlert.show(t('settings.mailist.delete_success.title', '删除成功'), result.message);
            // 刷新文件列表
            try {
                await fetchMaiListFiles();
            } catch (refreshError) {
                console.error('删除后刷新文件列表失败:', refreshError);
                customAlert.show(t('settings.mailist.refresh_failed.title', '文件列表刷新失败'), formatAppError(refreshError));
            }
        } else {
            customAlert.show(
                t('settings.mailist.delete_failed.title', '删除失败'),
                t('settings.mailist.delete_failed.message', '无法删除文件: {error}', { error: result.error })
            );
        }
    } catch (error) {
        customAlert.show(
            t('settings.mailist.delete_failed.title', '删除失败'),
            t('common.network_error', '网络错误: {error}', { error: error.message })
        );
    }
}

// 人员数据管理
let people = [];
let savedMatchGroups = null;
let currentMatchConfig = null;
let matchResults = [];
let runtimeGlobalSyncEnabled = false;
let peopleManagementInitialized = false;
let resultHistoryManagementInitialized = false;
let peopleToolManuallyHidden = false;
let pendingWinnerExportContext = null;
let mergeDialogAvailableFiles = [];
let mergedBracketRenderState = {
    model: null,
    boardElement: null,
    lineLayerElement: null,
    nodeAnchorMap: new Map(),
    resizeHandler: null
};
let defaultAvatarDataUriCache = '';

function getHomePageContentElement() {
    const homePage = document.getElementById('homePage');
    if (!homePage) return null;
    return homePage.querySelector('.page-content');
}

function syncPeopleToolVisibilityState() {
    const peopleToolContainer = document.getElementById('peopleToolContainer');
    const matchContainer = document.getElementById('matchContainer');
    const meowBtn = document.getElementById('meowBtn');
    const homePageContent = getHomePageContentElement();
    if (document.body) {
        document.body.classList.toggle('people-tool-hidden', peopleToolManuallyHidden);
    }

    if (peopleToolManuallyHidden) {
        if (peopleToolContainer) {
            peopleToolContainer.style.display = 'none';
        }
        if (matchContainer) {
            matchContainer.style.display = 'none';
        }
        if (homePageContent) {
            homePageContent.style.display = 'none';
        }
        if (meowBtn) {
            meowBtn.style.display = 'block';
            meowBtn.style.opacity = '1';
            meowBtn.style.visibility = 'visible';
            meowBtn.style.transform = 'scale(1)';
        }
        return;
    }

    if (homePageContent) {
        homePageContent.style.display = '';
    }
    if (peopleToolContainer) {
        peopleToolContainer.style.display = 'block';
    }
    if (matchContainer) {
        matchContainer.style.display = 'none';
    }
    if (meowBtn) {
        meowBtn.style.display = 'none';
        meowBtn.style.opacity = '0';
        meowBtn.style.visibility = 'hidden';
        meowBtn.style.transform = 'scale(0.5)';
    }
}

function showGlobalSyncStateMessage(enabled) {
    const message = enabled
        ? t('home.match.global_sync_on', '全局同步已开启')
        : t('home.match.global_sync_off', '全局同步已关闭');
    if (typeof customAlert !== 'undefined' && customAlert && typeof customAlert.toast === 'function') {
        customAlert.toast(t('home.match.global_sync_title', '全局同步'), message, 1000);
        return;
    }
    if (typeof customAlert !== 'undefined' && customAlert && typeof customAlert.show === 'function') {
        customAlert.show(t('common.tip', '提示'), message);
        return;
    }
    console.log(message);
}

function formatResultFileTime(rawSeconds) {
    const numericSeconds = Number(rawSeconds);
    if (!Number.isFinite(numericSeconds) || numericSeconds <= 0) {
        return t('common.unknown_time', '未知时间');
    }
    try {
        return new Date(numericSeconds * 1000).toLocaleString();
    } catch (_) {
        return t('common.unknown_time', '未知时间');
    }
}

function renderResultFileOptions(files, preferredFileName = '') {
    const fileSelect = document.getElementById('resultFileSelect');
    const infoLabel = document.getElementById('resultFileInfo');
    const loadBtn = document.getElementById('loadResultFileBtn');
    if (!fileSelect || !infoLabel || !loadBtn) return;

    fileSelect.innerHTML = '';
    const normalizedFiles = Array.isArray(files) ? files : [];

    if (normalizedFiles.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = t('results.history.no_files', '暂无历史文件');
        fileSelect.appendChild(option);
        loadBtn.disabled = true;
        infoLabel.textContent = t('results.history.not_found', '未发现历史结果文件');
        return;
    }

    normalizedFiles.forEach(file => {
        const option = document.createElement('option');
        option.value = file.name;
        option.textContent = `${file.name} (${formatResultFileTime(file.mtime)})`;
        fileSelect.appendChild(option);
    });

    const hasPreferred = preferredFileName && normalizedFiles.some(file => file.name === preferredFileName);
    fileSelect.value = hasPreferred ? preferredFileName : normalizedFiles[0].name;
    loadBtn.disabled = !fileSelect.value;
    infoLabel.textContent = t('results.history.count', '历史结果文件 {count} 个', {
        count: normalizedFiles.length
    });
}

async function fetchResultFiles() {
    try {
        const response = await fetch('/api/get-result-files');
        if (!response.ok) {
            throw createAppError('APP-RESULT-001', `读取比赛结果文件失败，HTTP ${response.status}`);
        }

        const result = await response.json();
        if (!result || result.success !== true) {
            throw createAppError('APP-RESULT-002', `读取比赛结果文件失败: ${result?.error || '响应标记为失败'}`);
        }

        if (!Array.isArray(result.files)) {
            throw createAppError('APP-RESULT-003', '读取比赛结果文件失败: 返回格式不正确（files不是数组）');
        }

        return result.files;
    } catch (error) {
        throw error.code ? error : createAppError('APP-RESULT-004', '读取比赛结果文件失败', error);
    }
}

async function refreshResultFilesList(options = {}) {
    const { silent = false, preferredFileName = '' } = options;
    try {
        const files = await fetchResultFiles();
        renderResultFileOptions(files, preferredFileName);
        return files;
    } catch (error) {
        renderResultFileOptions([]);
        if (!silent) {
            if (typeof customAlert !== 'undefined' && customAlert && typeof customAlert.show === 'function') {
                customAlert.show(t('results.history.read_failed_title', '读取结果文件失败'), formatAppError(error));
            } else {
                console.error('读取结果文件失败:', error);
            }
        }
        throw error;
    }
}

function normalizeLoadedMatchResult(rawResult, sourceFileName = '') {
    if (!rawResult || typeof rawResult !== 'object') {
        throw createAppError('APP-RESULT-007', '结果文件内容格式不正确');
    }

    const normalizeOptionalScore = (rawScore) => {
        if (rawScore === null || rawScore === undefined) return null;
        const rawText = String(rawScore).trim();
        if (!rawText) return null;
        const numericValue = Number(rawText);
        if (!Number.isFinite(numericValue)) return null;
        return roundToFourDecimals(Math.min(101, Math.max(0, numericValue)));
    };

    const normalizedTimestamp = (() => {
        const parsed = new Date(rawResult.timestamp);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed.toISOString();
        }
        return new Date().toISOString();
    })();

    const normalizedGroups = Array.isArray(rawResult.groups) ? rawResult.groups : [];
    const sanitizedGroups = normalizedGroups.map((group, groupIndex) => {
        const safeGroup = group && typeof group === 'object' ? group : {};
        const player1 = safeGroup.player1 ? safeGroup.player1 : { name: t('results.card.unknown_player', '未知选手') };
        const player2 = safeGroup.player2 ? safeGroup.player2 : null;

        const rawTotalScores = Array.isArray(safeGroup.totalScores)
            ? safeGroup.totalScores
            : (Array.isArray(safeGroup.total_scores) ? safeGroup.total_scores : []);
        const totalScores = [
            roundToFourDecimals(rawTotalScores[0] ?? 0),
            roundToFourDecimals(rawTotalScores[1] ?? 0)
        ];
        const resultCode = resolveGroupResultCode(totalScores, !!player2, safeGroup.result);

        const rawSongs = Array.isArray(safeGroup.songs)
            ? safeGroup.songs
            : (Array.isArray(safeGroup.songResults) ? safeGroup.songResults : []);
        const songs = rawSongs.map((song, songOrderIndex) => {
            const safeSong = song && typeof song === 'object' ? song : {};
            const musicId = String(safeSong.musicId ?? safeSong.music_id ?? safeSong.MusicID ?? '').trim();
            const title = String(
                safeSong.title
                || safeSong.songTitle
                || safeSong.name
                || safeSong.song_name
                || t('song.unknown_title', '未知曲目')
            ).trim();

            const imageFile = String(safeSong.imageFile || safeSong.image_file || safeSong.image_url || '').trim();
            const coverPath = normalizeImagePath(
                String(safeSong.coverPath || safeSong.cover_path || (imageFile ? `./MaiSongLib/${imageFile}` : '')).trim()
            );

            const seedScores = [player1, player2]
                .map((player, playerSlot) => {
                    if (!player) return null;
                    return {
                        playerSlot,
                        playerId: player.id ?? null,
                        playerName: String(player.name || '').trim() || t('results.card.unknown_player', '未知选手'),
                        score: null
                    };
                })
                .filter(Boolean);

            if (Array.isArray(safeSong.playerScores)) {
                safeSong.playerScores.forEach((scoreItem, fallbackSlot) => {
                    const slot = parseInt(scoreItem?.playerSlot ?? scoreItem?.slot ?? fallbackSlot, 10);
                    if (!Number.isFinite(slot)) return;

                    const existingIndex = seedScores.findIndex(entry => entry.playerSlot === slot);
                    const nextScore = normalizeOptionalScore(
                        scoreItem?.score ?? scoreItem?.value ?? scoreItem?.achievement ?? scoreItem
                    );
                    const fallbackPlayer = slot === 0 ? player1 : player2;
                    const nextEntry = {
                        playerSlot: slot,
                        playerId: scoreItem?.playerId ?? fallbackPlayer?.id ?? null,
                        playerName: String(
                            scoreItem?.playerName
                            || scoreItem?.name
                            || fallbackPlayer?.name
                            || t('results.card.unknown_player', '未知选手')
                        ).trim(),
                        score: nextScore
                    };

                    if (existingIndex >= 0) {
                        seedScores[existingIndex] = nextEntry;
                    } else {
                        seedScores.push(nextEntry);
                    }
                });
            } else if (Array.isArray(safeSong.scores)) {
                safeSong.scores.forEach((scoreValue, scoreSlot) => {
                    const existingIndex = seedScores.findIndex(entry => entry.playerSlot === scoreSlot);
                    if (existingIndex < 0) return;
                    seedScores[existingIndex].score = normalizeOptionalScore(scoreValue);
                });
            }

            return {
                songIndex: Number.isFinite(parseInt(safeSong.songIndex ?? safeSong.index, 10))
                    ? parseInt(safeSong.songIndex ?? safeSong.index, 10)
                    : songOrderIndex,
                musicId,
                title,
                artist: String(safeSong.artist || '').trim(),
                bpm: Number.isFinite(Number(safeSong.bpm)) ? Number(safeSong.bpm) : null,
                genre: String(safeSong.genre || '').trim(),
                type: String(safeSong.type || '').trim(),
                imageFile,
                coverPath,
                levels: Array.isArray(safeSong.levels) ? [...safeSong.levels] : [],
                constants: Array.isArray(safeSong.constants) ? [...safeSong.constants] : [],
                playerScores: seedScores
                    .sort((left, right) => (left.playerSlot ?? 0) - (right.playerSlot ?? 0))
            };
        }).sort((left, right) => (left.songIndex ?? 0) - (right.songIndex ?? 0));

        return {
            groupIndex: Number.isFinite(parseInt(safeGroup.groupIndex, 10))
                ? parseInt(safeGroup.groupIndex, 10)
                : groupIndex,
            player1,
            player2,
            totalScores,
            result: resultCode,
            winnerPlayerSlot: resultCode === 1 ? 0 : (resultCode === 2 ? 1 : null),
            songs
        };
    });

    return {
        schemaVersion: Number(rawResult.schemaVersion || 1),
        round: rawResult.round ?? t('common.unknown', '未知'),
        songCount: rawResult.songCount ?? '-',
        globalSync: !!rawResult.globalSync,
        byRating: !!rawResult.byRating,
        groups: sanitizedGroups,
        people: Array.isArray(rawResult.people) ? rawResult.people : [],
        timestamp: normalizedTimestamp,
        __sourceFileName: String(sourceFileName || rawResult.__sourceFileName || '').trim()
    };
}

function sortMatchResultsByTimeDesc() {
    matchResults.sort((left, right) => {
        const leftTime = new Date(left?.timestamp || 0).getTime();
        const rightTime = new Date(right?.timestamp || 0).getTime();
        return rightTime - leftTime;
    });
}

function upsertMatchResult(resultData) {
    if (!resultData || typeof resultData !== 'object') return;

    const sourceFileName = String(resultData.__sourceFileName || '').trim();
    const roundKey = String(resultData.round ?? '');
    const timestampKey = String(resultData.timestamp ?? '');

    const existingIndex = matchResults.findIndex(item => {
        if (!item || typeof item !== 'object') return false;
        if (sourceFileName && String(item.__sourceFileName || '').trim() === sourceFileName) {
            return true;
        }
        return String(item.round ?? '') === roundKey && String(item.timestamp ?? '') === timestampKey;
    });

    if (existingIndex >= 0) {
        matchResults[existingIndex] = resultData;
    } else {
        matchResults.push(resultData);
    }

    sortMatchResultsByTimeDesc();
}

function resolvePreferredResultForWinnerExport() {
    const fileSelect = document.getElementById('resultFileSelect');
    const preferredFileName = String(fileSelect?.value || '').trim();
    if (preferredFileName) {
        const matched = matchResults.find(item => String(item?.__sourceFileName || '').trim() === preferredFileName);
        if (matched) return matched;
    }
    return matchResults[0] || null;
}

function collectWinnerPlayersFromMatchResult(resultData) {
    if (!resultData || typeof resultData !== 'object') return [];
    const groups = Array.isArray(resultData.groups) ? resultData.groups : [];
    const winnerMap = new Map();

    groups.forEach(group => {
        if (!group || typeof group !== 'object') return;
        const resultCode = resolveGroupResultCode(group.totalScores || [0, 0], !!group.player2, group.result);
        const winner = resultCode === 1 ? group.player1 : (resultCode === 2 ? group.player2 : null);
        if (!winner || typeof winner !== 'object') return;

        const dedupeKey = String(
            winner.id
            ?? `${winner.name || ''}::${winner.qq || ''}`
        ).trim();
        if (!dedupeKey || winnerMap.has(dedupeKey)) return;

        winnerMap.set(dedupeKey, {
            id: winner.id ?? Date.now() + winnerMap.size,
            name: winner.name || '',
            qq: winner.qq || '',
            rating: winner.rating ?? '',
            avatar: winner.avatar || DEFAULT_AVATAR_PATH,
            createdAt: winner.createdAt || new Date().toLocaleString()
        });
    });

    return Array.from(winnerMap.values());
}

function sanitizeWinnerExportFileName(fileName, fallbackName) {
    const fallback = String(fallbackName || 'Success').trim() || 'Success';
    let normalized = String(fileName || '').trim();
    if (!normalized) {
        normalized = fallback;
    }
    normalized = normalized.replace(/[\\/:*?"<>|]/g, '_');
    if (!normalized.toLowerCase().endsWith('.json')) {
        normalized = `${normalized}.json`;
    }
    return normalized;
}

function closeExportWinnersDialog(options = {}) {
    const { clearContext = true } = options;
    const dialog = document.getElementById('exportWinnersDialog');
    const input = document.getElementById('exportWinnersFileName');
    const confirmBtn = document.getElementById('exportWinnersConfirm');
    if (dialog) {
        dialog.classList.remove('show');
    }
    if (input) {
        input.value = '';
    }
    if (confirmBtn) {
        confirmBtn.disabled = false;
    }
    if (clearContext) {
        pendingWinnerExportContext = null;
    }
}

function showExportWinnersDialog(defaultFileName, context) {
    const dialog = document.getElementById('exportWinnersDialog');
    const input = document.getElementById('exportWinnersFileName');
    const confirmBtn = document.getElementById('exportWinnersConfirm');
    if (!dialog || !input || !confirmBtn) {
        throw createAppError('APP-RESULT-012', '导出胜利者弹窗缺失，无法继续导出');
    }

    pendingWinnerExportContext = context;
    input.value = defaultFileName;
    confirmBtn.disabled = false;
    dialog.classList.add('show');

    window.setTimeout(() => {
        input.focus();
        input.select();
    }, 0);
}

async function confirmExportWinnersDialog() {
    const input = document.getElementById('exportWinnersFileName');
    const confirmBtn = document.getElementById('exportWinnersConfirm');
    const context = pendingWinnerExportContext;
    if (!input || !context) {
        closeExportWinnersDialog();
        return;
    }

    const rawInputName = String(input.value || '').trim();
    const finalFileName = sanitizeWinnerExportFileName(rawInputName, context.defaultFileName);

    if (confirmBtn) {
        confirmBtn.disabled = true;
    }

    try {
        await persistWinnersAsCharacterFile(finalFileName, context.winners);
        customAlert.show(
            t('common.success', '成功'),
            t('results.export_winners.success', '胜利者名单已导出为 {filename}', { filename: finalFileName })
        );
        closeExportWinnersDialog();
    } catch (error) {
        const finalError = error?.code ? error : createAppError('APP-RESULT-011', '导出胜利者名单失败', error);
        customAlert.show(t('results.export_winners.failed_title', '导出失败'), formatAppError(finalError));
        if (confirmBtn) {
            confirmBtn.disabled = false;
        }
    }
}

async function persistWinnersAsCharacterFile(fileName, winners) {
    const response = await fetch('/api/save-character-file', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            filename: fileName,
            content: winners
        })
    });

    if (!response.ok) {
        throw createAppError('APP-RESULT-009', `导出胜利者失败，HTTP ${response.status}`);
    }

    const result = await response.json();
    if (!result || result.success !== true) {
        throw createAppError('APP-RESULT-010', `导出胜利者失败: ${result?.error || '响应标记为失败'}`);
    }
}

async function exportWinnersAsCharacterFile() {
    let targetResult = resolvePreferredResultForWinnerExport();
    const fileSelect = document.getElementById('resultFileSelect');
    const selectedFileName = String(fileSelect?.value || '').trim();

    if (!targetResult && selectedFileName) {
        try {
            targetResult = await loadResultFileByName(selectedFileName, { silent: true });
        } catch (_) {
            targetResult = null;
        }
    }

    if (!targetResult) {
        customAlert.show(t('common.tip', '提示'), t('results.export_winners.no_result', '请先加载一个比赛结果文件'));
        return;
    }

    const winners = collectWinnerPlayersFromMatchResult(targetResult);
    if (winners.length === 0) {
        customAlert.show(t('common.tip', '提示'), t('results.export_winners.no_winners', '当前结果中没有可导出的胜利者'));
        return;
    }

    const sourceFileName = String(targetResult.__sourceFileName || selectedFileName || `Round_${targetResult.round ?? 'Unknown'}`).trim();
    const sourceBaseName = sourceFileName.replace(/\.json$/i, '');
    const defaultFileName = sanitizeWinnerExportFileName(`Success_${sourceBaseName}`, 'Success');
    showExportWinnersDialog(defaultFileName, {
        winners,
        defaultFileName
    });
}

async function fetchNormalizedResultFileByName(fileName) {
    const normalizedFileName = String(fileName || '').trim();
    if (!normalizedFileName) {
        throw createAppError('APP-RESULT-013', '结果文件名不能为空');
    }

    const response = await fetch('/api/get-result-file', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            filename: normalizedFileName
        })
    });

    if (!response.ok) {
        throw createAppError('APP-RESULT-005', `加载比赛结果失败，HTTP ${response.status}`);
    }

    const result = await response.json();
    if (!result || result.success !== true) {
        throw createAppError('APP-RESULT-006', `加载比赛结果失败: ${result?.error || '响应标记为失败'}`);
    }

    const normalizedResult = normalizeLoadedMatchResult(result.content, result.filename || normalizedFileName);
    return {
        normalizedResult,
        fileName: String(result.filename || normalizedFileName).trim()
    };
}

async function loadResultFileByName(fileName, options = {}) {
    const normalizedFileName = String(fileName || '').trim();
    const {
        silent = false,
        upsertAndRender = true
    } = options;

    if (!normalizedFileName) {
        if (!silent && typeof customAlert !== 'undefined' && customAlert && typeof customAlert.show === 'function') {
            customAlert.show(t('common.tip', '提示'), t('results.history.select_prompt', '请选择要加载的结果文件'));
        }
        return null;
    }

    try {
        const { normalizedResult, fileName: resolvedFileName } = await fetchNormalizedResultFileByName(normalizedFileName);
        if (upsertAndRender) {
            upsertMatchResult(normalizedResult);
            showMatchResults();
        }

        if (!silent) {
            if (typeof customAlert !== 'undefined' && customAlert && typeof customAlert.show === 'function') {
                customAlert.show(
                    t('results.history.load_success_title', '加载成功'),
                    t('results.history.load_success_message', '已加载结果文件 {name}', { name: resolvedFileName || normalizedFileName })
                );
            }
        }

        return normalizedResult;
    } catch (error) {
        const finalError = error.code ? error : createAppError('APP-RESULT-008', `加载比赛结果失败: ${normalizedFileName}`, error);
        if (!silent) {
            if (typeof customAlert !== 'undefined' && customAlert && typeof customAlert.show === 'function') {
                customAlert.show(t('results.history.load_failed_title', '加载失败'), formatAppError(finalError));
            } else {
                console.error('加载比赛结果失败:', finalError);
            }
        }
        throw finalError;
    }
}

function closeMergeResultsDialog() {
    const dialog = document.getElementById('mergeResultsDialog');
    if (dialog) {
        dialog.classList.remove('show');
    }
}

function resolveMatchResultSortWeight(result, fallbackOrder = 0) {
    const directRound = Number(result?.round);
    if (Number.isFinite(directRound)) {
        return directRound;
    }

    const sourceFileName = String(result?.__sourceFileName || '').trim();
    const fileRoundMatch = sourceFileName.match(/(\d+(?:\.\d+)?)/);
    if (fileRoundMatch) {
        const parsed = Number(fileRoundMatch[1]);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    const parsedTime = new Date(result?.timestamp || 0).getTime();
    if (Number.isFinite(parsedTime) && parsedTime > 0) {
        return 100000 + parsedTime / 1000000000;
    }

    return 200000 + fallbackOrder;
}

function parseNumericHintFromResultFileName(result) {
    const sourceFileName = String(result?.__sourceFileName || '').trim();
    const match = sourceFileName.match(/(\d+(?:\.\d+)?)/);
    if (!match) return null;
    const value = Number(match[1]);
    return Number.isFinite(value) ? value : null;
}

function sortResultsForMergedBracket(results) {
    const normalized = Array.isArray(results) ? [...results] : [];
    normalized.sort((left, right) => {
        const leftWeight = resolveMatchResultSortWeight(left, 0);
        const rightWeight = resolveMatchResultSortWeight(right, 0);
        if (leftWeight !== rightWeight) {
            return leftWeight - rightWeight;
        }

        const leftFileHint = parseNumericHintFromResultFileName(left);
        const rightFileHint = parseNumericHintFromResultFileName(right);
        if (Number.isFinite(leftFileHint) && Number.isFinite(rightFileHint) && leftFileHint !== rightFileHint) {
            return leftFileHint - rightFileHint;
        }

        const leftTime = new Date(left?.timestamp || 0).getTime();
        const rightTime = new Date(right?.timestamp || 0).getTime();
        if (leftTime !== rightTime) {
            return leftTime - rightTime;
        }

        const leftFile = String(left?.__sourceFileName || '');
        const rightFile = String(right?.__sourceFileName || '');
        return leftFile.localeCompare(rightFile, 'zh-Hans-CN');
    });
    return normalized;
}

function resolveMergedPlayerKey(player) {
    if (!player || typeof player !== 'object') return '';
    const idKey = String(player.id ?? '').trim();
    if (idKey) return `id:${idKey}`;
    const nameKey = String(player.name || '').trim();
    const qqKey = String(player.qq || '').trim();
    if (!nameKey && !qqKey) return '';
    return `name:${nameKey}|qq:${qqKey}`;
}

function resolveResultSongCoverPath(songEntry) {
    if (!songEntry || typeof songEntry !== 'object') return '';
    const directCover = normalizeImagePath(String(songEntry.coverPath || '').trim());
    if (directCover) return directCover;
    const imageFile = String(songEntry.imageFile || '').trim();
    if (imageFile) return normalizeImagePath(`./MaiSongLib/${imageFile}`);
    return '';
}

function formatOptionalScoreValue(rawScore) {
    if (rawScore === null || rawScore === undefined || String(rawScore).trim() === '') {
        return '--.----';
    }
    return formatScoreValue(rawScore);
}

function buildMergedBracketModel(results, selectedFileNames = []) {
    const sortedResults = sortResultsForMergedBracket(results);
    const rounds = sortedResults.map((resultEntry, roundIndex) => {
        const safeGroups = Array.isArray(resultEntry?.groups) ? resultEntry.groups : [];
        const sourceFileName = String(resultEntry?.__sourceFileName || '').trim();
        const roundTitleValue = String(resultEntry?.round ?? roundIndex + 1).trim() || String(roundIndex + 1);
        const roundTitle = `第 ${roundTitleValue} 轮`;

        const matches = safeGroups.map((groupEntry, matchIndex) => {
            const resultCode = resolveGroupResultCode(groupEntry?.totalScores || [0, 0], !!groupEntry?.player2, groupEntry?.result);
            const totalScores = Array.isArray(groupEntry?.totalScores)
                ? [roundToFourDecimals(groupEntry.totalScores[0] ?? 0), roundToFourDecimals(groupEntry.totalScores[1] ?? 0)]
                : [0, 0];
            const winnerSlot = resultCode === 1 ? 0 : (resultCode === 2 ? 1 : null);
            const baseNodeId = `r${roundIndex}m${matchIndex}`;
            const songEntries = Array.isArray(groupEntry?.songs) ? groupEntry.songs : [];

            const players = [0, 1].map(playerSlot => {
                const rawPlayer = playerSlot === 0 ? groupEntry?.player1 : groupEntry?.player2;
                const exists = !!rawPlayer;
                const isBye = !exists && playerSlot === 1;
                let status = 'tie';
                if (isBye) {
                    status = 'bye';
                } else if (resultCode === 1) {
                    status = playerSlot === 0 ? 'winner' : 'loser';
                } else if (resultCode === 2) {
                    status = playerSlot === 1 ? 'winner' : 'loser';
                }

                return {
                    slot: playerSlot,
                    nodeId: `${baseNodeId}p${playerSlot}`,
                    exists,
                    isBye,
                    status,
                    playerKey: exists ? resolveMergedPlayerKey(rawPlayer) : '',
                    name: isBye
                        ? t('results.card.bye', '轮空')
                        : String(rawPlayer?.name || t('results.card.unknown_player', '未知选手')),
                    avatar: exists
                        ? (rawPlayer?.avatar || DEFAULT_AVATAR_PATH)
                        : '',
                    totalScore: exists ? totalScores[playerSlot] : null,
                    rawPlayer: rawPlayer || null
                };
            });

            return {
                roundIndex,
                matchIndex,
                groupIndex: Number.isFinite(parseInt(groupEntry?.groupIndex, 10))
                    ? parseInt(groupEntry.groupIndex, 10)
                    : matchIndex,
                resultCode,
                winnerSlot,
                totalScores,
                players,
                songs: songEntries.map(songEntry => {
                    const playerScoreMap = new Map();
                    (Array.isArray(songEntry?.playerScores) ? songEntry.playerScores : []).forEach(scoreEntry => {
                        const slot = parseInt(scoreEntry?.playerSlot, 10);
                        if (!Number.isFinite(slot)) return;
                        playerScoreMap.set(slot, scoreEntry);
                    });

                    return {
                        musicId: String(songEntry?.musicId || '').trim(),
                        title: String(songEntry?.title || t('song.unknown_title', '未知曲目')),
                        coverPath: resolveResultSongCoverPath(songEntry) || getSongCoverFallbackDataUri(),
                        artist: String(songEntry?.artist || '').trim(),
                        bpm: Number.isFinite(Number(songEntry?.bpm)) ? Number(songEntry.bpm) : null,
                        genre: String(songEntry?.genre || '').trim(),
                        type: String(songEntry?.type || '').trim(),
                        levels: Array.isArray(songEntry?.levels) ? [...songEntry.levels] : [],
                        constants: Array.isArray(songEntry?.constants) ? [...songEntry.constants] : [],
                        scoreP1: playerScoreMap.get(0)?.score ?? null,
                        scoreP2: playerScoreMap.get(1)?.score ?? null
                    };
                }),
                sourceFileName
            };
        });

        return {
            roundIndex,
            sourceFileName,
            roundTitleValue,
            title: roundTitle,
            matches
        };
    });

    return {
        selectedFileNames: Array.isArray(selectedFileNames) ? [...selectedFileNames] : [],
        rounds,
        edges: buildMergedBracketEdges(rounds),
        displayRounds: rounds
            .map((round, orderIndex) => ({
                ...round,
                displayOrderIndex: orderIndex
            }))
            .reverse()
    };
}

function buildMergedBracketEdges(rounds) {
    const edges = [];
    if (!Array.isArray(rounds) || rounds.length <= 1) {
        return edges;
    }

    for (let roundIndex = 0; roundIndex < rounds.length - 1; roundIndex += 1) {
        const currentRound = rounds[roundIndex];
        const nextRound = rounds[roundIndex + 1];
        const nextPlayerMap = new Map();

        (Array.isArray(nextRound?.matches) ? nextRound.matches : []).forEach(match => {
            (Array.isArray(match?.players) ? match.players : []).forEach(player => {
                if (!player?.playerKey) return;
                if (!nextPlayerMap.has(player.playerKey)) {
                    nextPlayerMap.set(player.playerKey, []);
                }
                nextPlayerMap.get(player.playerKey).push(player.nodeId);
            });
        });

        const consumedTargetSet = new Set();
        (Array.isArray(currentRound?.matches) ? currentRound.matches : []).forEach(match => {
            if (!Number.isFinite(match?.winnerSlot)) return;
            const winnerPlayer = match.players?.[match.winnerSlot];
            if (!winnerPlayer?.playerKey) return;

            const targetCandidates = nextPlayerMap.get(winnerPlayer.playerKey) || [];
            const targetNodeId = targetCandidates.find(nodeId => !consumedTargetSet.has(nodeId));
            if (!targetNodeId) return;

            consumedTargetSet.add(targetNodeId);
            edges.push({
                fromNodeId: winnerPlayer.nodeId,
                toNodeId: targetNodeId
            });
        });
    }

    return edges;
}

function computeMergedBracketLayout(rounds) {
    const safeRounds = Array.isArray(rounds) ? rounds : [];
    const cardWidth = 224;
    const cardHeight = 136;
    const rowGap = 176;
    const headerOffset = 48;
    const sidePadding = 28;
    const cardGap = 44;
    const maxMatches = Math.max(1, ...safeRounds.map(round => Math.max(1, Array.isArray(round?.matches) ? round.matches.length : 1)));

    const boardWidth = Math.max(
        620,
        sidePadding * 2 + maxMatches * cardWidth + Math.max(0, maxMatches - 1) * cardGap
    );
    const boardHeight = Math.max(
        360,
        headerOffset + safeRounds.length * rowGap + 32
    );

    const cardsByRound = safeRounds.map((round, roundIndex) => {
        const matches = Array.isArray(round?.matches) ? round.matches : [];
        const matchCount = Math.max(1, matches.length);
        const rowWidth = matchCount * cardWidth + Math.max(0, matchCount - 1) * cardGap;
        const startX = (boardWidth - rowWidth) / 2;
        const y = headerOffset + roundIndex * rowGap;

        return matches.map((_, matchIndex) => ({
            left: startX + matchIndex * (cardWidth + cardGap),
            top: y,
            width: cardWidth,
            height: cardHeight
        }));
    });

    return {
        cardWidth,
        cardHeight,
        boardWidth,
        boardHeight,
        cardsByRound
    };
}

function formatMergedRoundLabel(round, fallbackIndex = 0) {
    const labelValue = String(round?.roundTitleValue || fallbackIndex + 1).trim() || String(fallbackIndex + 1);
    const numericValue = Number(labelValue);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
        return `第${labelValue}轮`;
    }

    const toChineseNumber = (value) => {
        const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
        const integerValue = Math.floor(value);
        if (integerValue <= 10) {
            if (integerValue === 10) return '十';
            return digits[integerValue];
        }
        if (integerValue < 20) {
            return `十${digits[integerValue - 10]}`;
        }
        if (integerValue < 100) {
            const tens = Math.floor(integerValue / 10);
            const ones = integerValue % 10;
            return `${digits[tens]}十${ones > 0 ? digits[ones] : ''}`;
        }
        return String(integerValue);
    };

    return `第${toChineseNumber(numericValue)}轮`;
}

function drawMergedBracketConnectionLines() {
    const { model, boardElement, lineLayerElement, nodeAnchorMap } = mergedBracketRenderState;
    if (!model || !boardElement || !lineLayerElement || !(nodeAnchorMap instanceof Map)) {
        return;
    }

    const boardRect = boardElement.getBoundingClientRect();
    const width = Math.max(1, Math.ceil(boardElement.scrollWidth));
    const height = Math.max(1, Math.ceil(boardElement.scrollHeight));
    lineLayerElement.setAttribute('width', String(width));
    lineLayerElement.setAttribute('height', String(height));
    lineLayerElement.setAttribute('viewBox', `0 0 ${width} ${height}`);
    lineLayerElement.innerHTML = '';

    const safeEdges = Array.isArray(model.edges) ? model.edges : [];
    safeEdges.forEach(edge => {
        const fromAnchor = nodeAnchorMap.get(edge.fromNodeId);
        const toAnchor = nodeAnchorMap.get(edge.toNodeId);
        if (!(fromAnchor instanceof HTMLElement) || !(toAnchor instanceof HTMLElement)) {
            return;
        }

        const fromRect = fromAnchor.getBoundingClientRect();
        const toRect = toAnchor.getBoundingClientRect();
        const x1 = fromRect.left + fromRect.width / 2 - boardRect.left;
        const y1 = fromRect.top + fromRect.height / 2 - boardRect.top;
        const x2 = toRect.left + toRect.width / 2 - boardRect.left;
        const y2 = toRect.top + toRect.height / 2 - boardRect.top;
        const controlY = (y1 + y2) / 2;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M ${x1} ${y1} C ${x1} ${controlY}, ${x2} ${controlY}, ${x2} ${y2}`);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', 'rgba(255, 215, 0, 0.85)');
        path.setAttribute('stroke-width', '3');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        lineLayerElement.appendChild(path);
    });
}

function renderMergedBracketDetailPanel(model) {
    const detailPanel = document.createElement('aside');
    detailPanel.className = 'merged-detail-panel';

    const safeRounds = Array.isArray(model?.displayRounds) ? model.displayRounds : [];
    safeRounds.forEach((round, roundIndex) => {
        const roundBlock = document.createElement('section');
        roundBlock.className = 'merged-detail-round';

        const roundTitle = document.createElement('h5');
        roundTitle.className = 'merged-detail-round-title';
        roundTitle.textContent = formatMergedRoundLabel(round, roundIndex);
        roundBlock.appendChild(roundTitle);

        const safeMatches = Array.isArray(round?.matches) ? round.matches : [];
        safeMatches.forEach(match => {
            const matchBlock = document.createElement('div');
            matchBlock.className = 'merged-detail-match';

            const player1Name = String(match?.players?.[0]?.name || t('results.card.unknown_player', '未知选手'));
            const player2Name = String(match?.players?.[1]?.name || t('results.card.bye', '轮空'));
            const header = document.createElement('div');
            header.className = 'merged-detail-match-head';
            header.textContent = `${t('results.card.groups', '分组情况')} ${Number(match?.groupIndex ?? match?.matchIndex ?? 0) + 1}: ${player1Name} vs ${player2Name}`;
            matchBlock.appendChild(header);

            const totalLine = document.createElement('div');
            totalLine.className = 'merged-detail-match-total';
            const total1 = formatOptionalScoreValue(match?.players?.[0]?.totalScore);
            const total2 = match?.players?.[1]?.isBye ? '--.----' : formatOptionalScoreValue(match?.players?.[1]?.totalScore);
            totalLine.textContent = `${t('results.total_completion', '总完成度')}: ${player1Name} ${total1} | ${player2Name} ${total2}`;
            matchBlock.appendChild(totalLine);

            const songs = Array.isArray(match?.songs) ? match.songs : [];
            if (songs.length === 0) {
                const emptySong = document.createElement('div');
                emptySong.className = 'merged-detail-song-empty';
                emptySong.textContent = t('results.song.empty', '本组暂无已记录歌曲');
                matchBlock.appendChild(emptySong);
            } else {
                songs.forEach(song => {
                    const songRow = document.createElement('div');
                    songRow.className = 'merged-detail-song-row';

                    const cover = document.createElement('img');
                    cover.className = 'merged-detail-song-cover';
                    cover.alt = song.title || t('song.unknown_title', '未知曲目');
                    bindImageElementSource(cover, song.coverPath || getSongCoverFallbackDataUri(), { lazy: false });

                    const info = document.createElement('div');
                    info.className = 'merged-detail-song-info';

                    const title = document.createElement('div');
                    title.className = 'merged-detail-song-title';
                    title.textContent = song.title || t('song.unknown_title', '未知曲目');

                    const meta = document.createElement('div');
                    meta.className = 'merged-detail-song-meta';
                    const metaItems = [];
                    if (song.musicId) metaItems.push(`MusicID ${song.musicId}`);
                    if (Number.isFinite(song.bpm)) metaItems.push(`BPM ${song.bpm}`);
                    if (song.genre) metaItems.push(song.genre);
                    if (song.type) metaItems.push(song.type);
                    if (Array.isArray(song.levels) && song.levels.length > 0) {
                        metaItems.push(`Lv ${song.levels.join('/')}`);
                    }
                    meta.textContent = metaItems.join(' · ');

                    const scoreLine = document.createElement('div');
                    scoreLine.className = 'merged-detail-song-scores';
                    scoreLine.textContent = `${player1Name}: ${formatOptionalScoreValue(song.scoreP1)} | ${player2Name}: ${match?.players?.[1]?.isBye ? '--.----' : formatOptionalScoreValue(song.scoreP2)}`;

                    info.appendChild(title);
                    if (meta.textContent) {
                        info.appendChild(meta);
                    }
                    info.appendChild(scoreLine);

                    songRow.appendChild(cover);
                    songRow.appendChild(info);
                    matchBlock.appendChild(songRow);
                });
            }

            roundBlock.appendChild(matchBlock);
        });

        detailPanel.appendChild(roundBlock);
    });

    return detailPanel;
}

function renderMergedBracketCanvas(model) {
    const section = document.getElementById('mergedBracketSection');
    const subtitle = document.getElementById('mergedBracketSubtitle');
    const viewport = document.getElementById('mergedBracketViewport');
    const exportBtn = document.getElementById('exportMergedBracketPngBtn');
    if (!section || !subtitle || !viewport || !exportBtn) return;

    if (mergedBracketRenderState.resizeHandler) {
        window.removeEventListener('resize', mergedBracketRenderState.resizeHandler);
    }

    viewport.innerHTML = '';
    mergedBracketRenderState = {
        model,
        boardElement: null,
        lineLayerElement: null,
        nodeAnchorMap: new Map(),
        resizeHandler: null
    };

    const displayRounds = Array.isArray(model?.displayRounds) ? model.displayRounds : [];
    const layout = computeMergedBracketLayout(displayRounds);
    const shell = document.createElement('div');
    shell.className = 'merged-bracket-canvas-shell';

    const canvas = document.createElement('div');
    canvas.className = 'merged-bracket-canvas';
    canvas.id = 'mergedBracketCanvas';

    const detailPanel = renderMergedBracketDetailPanel(model);

    const boardPanel = document.createElement('section');
    boardPanel.className = 'merged-board-panel';

    const board = document.createElement('div');
    board.className = 'merged-board';
    board.style.width = `${layout.boardWidth}px`;
    board.style.height = `${layout.boardHeight}px`;

    const lineLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    lineLayer.classList.add('merged-board-lines');
    board.appendChild(lineLayer);

    displayRounds.forEach((round, roundIndex) => {
        const firstCard = layout.cardsByRound?.[roundIndex]?.[0] || null;
        const roundLabel = document.createElement('div');
        roundLabel.className = 'merged-board-round-title';
        roundLabel.textContent = formatMergedRoundLabel(round, roundIndex);
        roundLabel.style.left = '12px';
        if (firstCard) {
            roundLabel.style.top = `${Math.max(6, firstCard.top - 24)}px`;
        }
        board.appendChild(roundLabel);

        const safeMatches = Array.isArray(round?.matches) ? round.matches : [];
        safeMatches.forEach((match, matchIndex) => {
            const cardLayout = layout.cardsByRound?.[roundIndex]?.[matchIndex] || null;
            if (!cardLayout) return;
            const matchCard = document.createElement('article');
            matchCard.className = 'merged-board-match-card';
            matchCard.style.left = `${cardLayout.left}px`;
            matchCard.style.top = `${cardLayout.top}px`;
            matchCard.style.width = `${cardLayout.width}px`;
            matchCard.style.height = `${cardLayout.height}px`;

            const matchTag = document.createElement('div');
            matchTag.className = 'merged-board-match-tag';
            matchTag.textContent = `${t('results.card.groups', '分组情况')} ${Number(match?.groupIndex ?? matchIndex) + 1}`;
            matchCard.appendChild(matchTag);

            const safePlayers = Array.isArray(match?.players) ? match.players : [];
            safePlayers.forEach(player => {
                const row = document.createElement('div');
                row.className = `merged-board-player-row is-${player?.status || 'tie'}`;

                const avatarShell = document.createElement('div');
                avatarShell.className = 'merged-player-avatar-shell';

                if (player?.isBye) {
                    const byeAvatar = document.createElement('div');
                    byeAvatar.className = 'merged-player-avatar-placeholder';
                    byeAvatar.textContent = '?';
                    avatarShell.appendChild(byeAvatar);
                } else {
                    const avatar = document.createElement('img');
                    avatar.className = 'merged-player-avatar-image';
                    avatar.alt = String(player?.name || t('results.card.unknown_player', '未知选手'));
                    bindImageElementSource(avatar, player?.avatar || DEFAULT_AVATAR_PATH, { lazy: false });
                    avatarShell.appendChild(avatar);
                }

                const info = document.createElement('div');
                info.className = 'merged-board-player-info';

                const name = document.createElement('div');
                name.className = 'merged-board-player-name';
                name.textContent = String(player?.name || t('results.card.unknown_player', '未知选手'));

                const total = document.createElement('div');
                total.className = 'merged-board-player-total';
                total.textContent = `${t('results.total_completion', '总完成度')}: ${player?.isBye ? '--.----' : formatOptionalScoreValue(player?.totalScore)}`;

                info.appendChild(name);
                info.appendChild(total);
                row.appendChild(avatarShell);
                row.appendChild(info);
                matchCard.appendChild(row);

                mergedBracketRenderState.nodeAnchorMap.set(player.nodeId, avatarShell);
            });

            board.appendChild(matchCard);
        });
    });

    boardPanel.appendChild(board);
    canvas.appendChild(detailPanel);
    canvas.appendChild(boardPanel);
    shell.appendChild(canvas);
    viewport.appendChild(shell);

    mergedBracketRenderState.model = model;
    mergedBracketRenderState.boardElement = board;
    mergedBracketRenderState.lineLayerElement = lineLayer;

    const subtitleFileNames = Array.isArray(model.selectedFileNames) ? model.selectedFileNames : [];
    subtitle.textContent = `已合并 ${subtitleFileNames.length} 个文件：${subtitleFileNames.join('、')}`;

    section.style.display = 'block';
    exportBtn.disabled = false;

    drawMergedBracketConnectionLines();
    window.requestAnimationFrame(() => drawMergedBracketConnectionLines());
    window.setTimeout(() => drawMergedBracketConnectionLines(), 150);

    const resizeHandler = () => {
        drawMergedBracketConnectionLines();
    };
    mergedBracketRenderState.resizeHandler = resizeHandler;
    window.addEventListener('resize', resizeHandler);
}

function renderMergeResultFileList(files, defaultSelectedNames = new Set()) {
    const listContainer = document.getElementById('mergeResultsFileList');
    if (!listContainer) return;

    const normalizedFiles = Array.isArray(files) ? files : [];
    listContainer.innerHTML = '';

    if (normalizedFiles.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'merge-results-empty';
        emptyState.textContent = t('results.history.no_files', '暂无历史文件');
        listContainer.appendChild(emptyState);
        updateMergeResultsConfirmButtonState();
        return;
    }

    normalizedFiles.forEach(file => {
        const item = document.createElement('label');
        item.className = 'merge-results-file-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = file.name;
        checkbox.checked = defaultSelectedNames.has(file.name);

        const textWrap = document.createElement('div');
        textWrap.className = 'merge-results-file-text';

        const nameNode = document.createElement('div');
        nameNode.className = 'merge-results-file-name';
        nameNode.textContent = file.name;

        const metaNode = document.createElement('div');
        metaNode.className = 'merge-results-file-meta';
        metaNode.textContent = `${formatResultFileTime(file.mtime)} · ${(Number(file.size || 0) / 1024).toFixed(1)} KB`;

        textWrap.appendChild(nameNode);
        textWrap.appendChild(metaNode);
        item.appendChild(checkbox);
        item.appendChild(textWrap);
        listContainer.appendChild(item);
    });

    updateMergeResultsConfirmButtonState();
}

function collectSelectedMergeResultFileNames() {
    const listContainer = document.getElementById('mergeResultsFileList');
    if (!listContainer) return [];
    return Array.from(listContainer.querySelectorAll('input[type="checkbox"]:checked'))
        .map(input => String(input.value || '').trim())
        .filter(Boolean);
}

function updateMergeResultsConfirmButtonState() {
    const confirmBtn = document.getElementById('mergeResultsConfirm');
    if (!confirmBtn) return;
    const selectedCount = collectSelectedMergeResultFileNames().length;
    confirmBtn.disabled = selectedCount < 2;
}

async function openMergeResultsDialog() {
    const dialog = document.getElementById('mergeResultsDialog');
    const listContainer = document.getElementById('mergeResultsFileList');
    if (!dialog || !listContainer) {
        throw createAppError('APP-RESULT-014', '合并结果弹窗缺失，无法执行合并');
    }

    dialog.classList.add('show');
    listContainer.innerHTML = `<div class="merge-results-empty">${t('common.loading', '加载中...')}</div>`;

    try {
        const files = await fetchResultFiles();
        mergeDialogAvailableFiles = files;

        const selectedFileName = String(document.getElementById('resultFileSelect')?.value || '').trim();
        const defaultSelected = new Set();
        if (selectedFileName && files.some(file => file.name === selectedFileName)) {
            defaultSelected.add(selectedFileName);
        }
        files.forEach(file => {
            if (defaultSelected.size < 2) {
                defaultSelected.add(file.name);
            }
        });

        renderMergeResultFileList(files, defaultSelected);
    } catch (error) {
        listContainer.innerHTML = `<div class="merge-results-empty">${t('common.load_failed', '加载失败')}</div>`;
        throw error;
    }
}

async function confirmMergeResultsDialog() {
    const selectedFileNames = collectSelectedMergeResultFileNames();
    if (selectedFileNames.length < 2) {
        customAlert.show(t('common.tip', '提示'), '请至少选择 2 个结果文件进行合并');
        return;
    }

    const confirmBtn = document.getElementById('mergeResultsConfirm');
    if (confirmBtn) {
        confirmBtn.disabled = true;
    }

    try {
        const loadedResults = [];
        for (const fileName of selectedFileNames) {
            const { normalizedResult } = await fetchNormalizedResultFileByName(fileName);
            loadedResults.push(normalizedResult);
            upsertMatchResult(normalizedResult);
        }
        sortMatchResultsByTimeDesc();
        showMatchResults();

        const mergedModel = buildMergedBracketModel(loadedResults, selectedFileNames);
        renderMergedBracketCanvas(mergedModel);
        closeMergeResultsDialog();
    } catch (error) {
        const finalError = error?.code ? error : createAppError('APP-RESULT-015', '合并结果文件失败', error);
        customAlert.show(t('results.history.load_failed_title', '加载失败'), formatAppError(finalError));
    } finally {
        updateMergeResultsConfirmButtonState();
        if (confirmBtn) {
            confirmBtn.disabled = false;
        }
    }
}

function formatTimestampForFileName(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}_${hour}${minute}${second}`;
}

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('读取二进制数据失败'));
        reader.readAsDataURL(blob);
    });
}

async function loadImagePathAsDataUrl(imagePath, fallbackDataUrl = '') {
    const normalizedPath = normalizeImagePath(String(imagePath || '').trim());
    if (!normalizedPath) {
        return fallbackDataUrl;
    }
    if (normalizedPath.startsWith('data:')) {
        return normalizedPath;
    }

    try {
        const resolvedPath = resolveImageSourcePath(normalizedPath);
        const absoluteUrl = new URL(resolvedPath, window.location.href).toString();
        const response = await fetch(absoluteUrl, { cache: 'force-cache' });
        if (!response.ok) {
            throw createAppError('APP-RESULT-016', `读取导出图片失败，HTTP ${response.status}`);
        }
        const blob = await response.blob();
        return await blobToDataUrl(blob);
    } catch (_) {
        return fallbackDataUrl;
    }
}

async function getDefaultAvatarDataUrl() {
    if (defaultAvatarDataUriCache) return defaultAvatarDataUriCache;
    defaultAvatarDataUriCache = await loadImagePathAsDataUrl(DEFAULT_AVATAR_PATH, '');
    return defaultAvatarDataUriCache;
}

function loadImageElementFromUrl(url) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.decoding = 'async';
        image.onload = () => resolve(image);
        image.onerror = () => reject(createAppError('APP-RESULT-017', '构建导出图片失败，无法加载中间图像'));
        image.src = url;
    });
}

const diagramCanvasImageCache = new Map();

async function loadDiagramCanvasImage(imagePath, options = {}) {
    const {
        fallbackDataUrl = '',
        treatRemoteAsDefaultAvatar = false
    } = options;

    let normalized = normalizeImagePath(String(imagePath || '').trim());
    if (!normalized && fallbackDataUrl) {
        normalized = fallbackDataUrl;
    }
    if (!normalized) {
        return null;
    }

    if (treatRemoteAsDefaultAvatar && /^https?:/i.test(normalized)) {
        normalized = DEFAULT_AVATAR_PATH;
    }

    if (diagramCanvasImageCache.has(normalized)) {
        return diagramCanvasImageCache.get(normalized);
    }

    const dataUrl = await loadImagePathAsDataUrl(normalized, fallbackDataUrl);
    if (!dataUrl) return null;

    try {
        const image = await loadImageElementFromUrl(dataUrl);
        diagramCanvasImageCache.set(normalized, image);
        return image;
    } catch (_) {
        return null;
    }
}

function drawRoundedRectPath(ctx, x, y, width, height, radius) {
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function fillRoundedRect(ctx, x, y, width, height, radius, fillStyle, strokeStyle = '', lineWidth = 1) {
    drawRoundedRectPath(ctx, x, y, width, height, radius);
    ctx.fillStyle = fillStyle;
    ctx.fill();
    if (strokeStyle) {
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
    }
}

function fitTextWithEllipsis(ctx, text, maxWidth) {
    const rawText = String(text || '');
    if (ctx.measureText(rawText).width <= maxWidth) {
        return rawText;
    }
    let value = rawText;
    while (value.length > 0 && ctx.measureText(`${value}...`).width > maxWidth) {
        value = value.slice(0, -1);
    }
    return `${value}...`;
}

function estimateDetailPanelHeight(rounds) {
    let height = 16;
    rounds.forEach(round => {
        height += 36;
        const matches = Array.isArray(round?.matches) ? round.matches : [];
        matches.forEach(match => {
            const songs = Array.isArray(match?.songs) ? match.songs : [];
            const songRows = Math.max(1, songs.length);
            height += 68 + songRows * 54;
        });
        height += 10;
    });
    return height;
}

function createDiagramTheme(variant) {
    if (variant === 'dark') {
        return {
            name: 'dark',
            background: '#0d1218',
            panel: '#151d26',
            panelSoft: '#1e2935',
            text: '#f2f6ff',
            textSoft: '#c2d0e3',
            border: '#2f4258',
            accent: '#8ec4ff',
            line: '#f6d25f',
            winner: '#ffd700',
            loser: '#ff6b6b',
            tie: '#4ecdc4'
        };
    }
    return {
        name: 'light',
        background: '#f8fbff',
        panel: '#ffffff',
        panelSoft: '#f2f7ff',
        text: '#1d2a3b',
        textSoft: '#5a6f86',
        border: '#c8d8eb',
        accent: '#2f7ccf',
        line: '#c59b00',
        winner: '#d8aa00',
        loser: '#df5252',
        tie: '#2caea0'
    };
}

async function drawMergedBracketDiagramToCanvas(model, variant = 'light') {
    const displayRounds = Array.isArray(model?.displayRounds) ? model.displayRounds : [];
    const boardLayout = computeMergedBracketLayout(displayRounds);
    const detailWidth = 460;
    const gap = 18;
    const margin = 20;
    const boardWidth = boardLayout.boardWidth;
    const boardHeight = boardLayout.boardHeight;
    const detailHeight = estimateDetailPanelHeight(displayRounds);
    const contentHeight = Math.max(boardHeight, detailHeight);
    const canvasWidth = detailWidth + gap + boardWidth + margin * 2;
    const canvasHeight = contentHeight + margin * 2;
    const boardOriginX = margin + detailWidth + gap;
    const boardOriginY = margin;
    const theme = createDiagramTheme(variant);

    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(canvasWidth * 2);
    canvas.height = Math.ceil(canvasHeight * 2);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw createAppError('APP-RESULT-019', '导出PNG失败，无法创建画布');
    }

    ctx.scale(2, 2);
    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    fillRoundedRect(ctx, margin, margin, detailWidth, contentHeight, 12, theme.panel, theme.border, 1.2);
    fillRoundedRect(ctx, boardOriginX, boardOriginY, boardWidth, boardHeight, 12, theme.panel, theme.border, 1.2);

    let detailY = margin + 16;
    ctx.fillStyle = theme.text;
    ctx.font = '700 18px "Segoe UI", "Microsoft YaHei", sans-serif';
    ctx.fillText('比赛明细', margin + 14, detailY);
    detailY += 22;

    const avatarFallback = (await getDefaultAvatarDataUrl()) || getSongCoverFallbackDataUri();
    const coverFallback = getSongCoverFallbackDataUri();

    const nodeAnchorMap = new Map();
    displayRounds.forEach((round, roundIndex) => {
        const roundCards = Array.isArray(boardLayout.cardsByRound?.[roundIndex]) ? boardLayout.cardsByRound[roundIndex] : [];
        roundCards.forEach((card, matchIndex) => {
            const match = Array.isArray(round?.matches) ? round.matches[matchIndex] : null;
            if (!match) return;
            const rowStartY = boardOriginY + card.top + 24;
            const playerRowHeight = 46;
            const avatarSize = 34;
            [0, 1].forEach(playerIndex => {
                const player = Array.isArray(match.players) ? match.players[playerIndex] : null;
                if (!player) return;
                const rowY = rowStartY + playerIndex * (playerRowHeight + 4);
                const avatarX = boardOriginX + card.left + 12;
                const avatarY = rowY + (playerRowHeight - avatarSize) / 2;
                nodeAnchorMap.set(player.nodeId, {
                    x: avatarX + avatarSize / 2,
                    y: avatarY + avatarSize / 2
                });
            });
        });
    });

    ctx.strokeStyle = theme.line;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    (Array.isArray(model?.edges) ? model.edges : []).forEach(edge => {
        const from = nodeAnchorMap.get(edge.fromNodeId);
        const to = nodeAnchorMap.get(edge.toNodeId);
        if (!from || !to) return;
        const controlY = (from.y + to.y) / 2;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.bezierCurveTo(from.x, controlY, to.x, controlY, to.x, to.y);
        ctx.stroke();
    });

    displayRounds.forEach((round, roundIndex) => {
        const roundLabelY = boardOriginY + (boardLayout.cardsByRound?.[roundIndex]?.[0]?.top ?? 0) - 8;
        ctx.fillStyle = theme.accent;
        ctx.font = '700 14px "Segoe UI", "Microsoft YaHei", sans-serif';
        ctx.fillText(formatMergedRoundLabel(round, roundIndex), boardOriginX + 14, Math.max(boardOriginY + 18, roundLabelY));

    });

    for (let roundIndex = 0; roundIndex < displayRounds.length; roundIndex += 1) {
        const round = displayRounds[roundIndex];
        const roundCards = Array.isArray(boardLayout.cardsByRound?.[roundIndex]) ? boardLayout.cardsByRound[roundIndex] : [];
        const matches = Array.isArray(round?.matches) ? round.matches : [];

        for (let matchIndex = 0; matchIndex < matches.length; matchIndex += 1) {
            const match = matches[matchIndex];
            const card = roundCards[matchIndex];
            if (!card) continue;
            const cardX = boardOriginX + card.left;
            const cardY = boardOriginY + card.top;

            fillRoundedRect(ctx, cardX, cardY, card.width, card.height, 10, theme.panelSoft, theme.border, 1);
            ctx.fillStyle = theme.textSoft;
            ctx.font = '700 11px "Segoe UI", "Microsoft YaHei", sans-serif';
            ctx.fillText(`${t('results.card.groups', '分组情况')} ${Number(match?.groupIndex ?? matchIndex) + 1}`, cardX + 10, cardY + 15);

            const rowStartY = cardY + 24;
            const playerRowHeight = 46;
            const avatarSize = 34;
            const players = Array.isArray(match?.players) ? match.players : [];
            for (let playerIndex = 0; playerIndex < players.length; playerIndex += 1) {
                const player = players[playerIndex];
                const rowY = rowStartY + playerIndex * (playerRowHeight + 4);
                let borderColor = theme.tie;
                if (player?.status === 'winner') borderColor = theme.winner;
                if (player?.status === 'loser') borderColor = theme.loser;

                fillRoundedRect(ctx, cardX + 8, rowY, card.width - 16, playerRowHeight, 8, theme.panel, borderColor, 1.2);
                const avatarX = cardX + 12;
                const avatarY = rowY + (playerRowHeight - avatarSize) / 2;

                ctx.save();
                ctx.beginPath();
                ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();
                const avatarImage = player?.isBye
                    ? null
                    : await loadDiagramCanvasImage(player?.avatar || DEFAULT_AVATAR_PATH, {
                        fallbackDataUrl: avatarFallback,
                        treatRemoteAsDefaultAvatar: true
                    });
                if (avatarImage) {
                    ctx.drawImage(avatarImage, avatarX, avatarY, avatarSize, avatarSize);
                } else {
                    ctx.fillStyle = theme.panelSoft;
                    ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
                }
                ctx.restore();

                ctx.strokeStyle = borderColor;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
                ctx.stroke();

                ctx.fillStyle = theme.text;
                ctx.font = '700 12px "Segoe UI", "Microsoft YaHei", sans-serif';
                const playerName = fitTextWithEllipsis(
                    ctx,
                    String(player?.name || t('results.card.unknown_player', '未知选手')),
                    card.width - 74
                );
                ctx.fillText(playerName, cardX + 54, rowY + 17);

                ctx.fillStyle = theme.textSoft;
                ctx.font = '600 11px "Segoe UI", "Microsoft YaHei", sans-serif';
                const totalLabel = `${t('results.total_completion', '总完成度')}: ${player?.isBye ? '--.----' : formatOptionalScoreValue(player?.totalScore)}`;
                ctx.fillText(fitTextWithEllipsis(ctx, totalLabel, card.width - 74), cardX + 54, rowY + 33);
            }
        }
    }

    detailY += 4;
    for (let roundIndex = 0; roundIndex < displayRounds.length; roundIndex += 1) {
        const round = displayRounds[roundIndex];
        ctx.fillStyle = theme.accent;
        ctx.font = '700 15px "Segoe UI", "Microsoft YaHei", sans-serif';
        ctx.fillText(formatMergedRoundLabel(round, roundIndex), margin + 14, detailY);
        detailY += 18;

        const matches = Array.isArray(round?.matches) ? round.matches : [];
        for (let matchIndex = 0; matchIndex < matches.length; matchIndex += 1) {
            const match = matches[matchIndex];
            const player1Name = String(match?.players?.[0]?.name || t('results.card.unknown_player', '未知选手'));
            const player2Name = String(match?.players?.[1]?.name || t('results.card.bye', '轮空'));

            fillRoundedRect(ctx, margin + 10, detailY, detailWidth - 20, 60, 8, theme.panelSoft, theme.border, 1);
            ctx.fillStyle = theme.text;
            ctx.font = '700 12px "Segoe UI", "Microsoft YaHei", sans-serif';
            ctx.fillText(
                fitTextWithEllipsis(ctx, `${t('results.card.groups', '分组情况')} ${Number(match?.groupIndex ?? matchIndex) + 1}: ${player1Name} vs ${player2Name}`, detailWidth - 34),
                margin + 18,
                detailY + 16
            );
            ctx.fillStyle = theme.textSoft;
            ctx.font = '600 11px "Segoe UI", "Microsoft YaHei", sans-serif';
            const totalLine = `${t('results.total_completion', '总完成度')}: ${player1Name} ${formatOptionalScoreValue(match?.players?.[0]?.totalScore)} | ${player2Name} ${match?.players?.[1]?.isBye ? '--.----' : formatOptionalScoreValue(match?.players?.[1]?.totalScore)}`;
            ctx.fillText(fitTextWithEllipsis(ctx, totalLine, detailWidth - 34), margin + 18, detailY + 34);
            detailY += 64;

            const songs = Array.isArray(match?.songs) ? match.songs : [];
            if (songs.length === 0) {
                ctx.fillStyle = theme.textSoft;
                ctx.font = '600 11px "Segoe UI", "Microsoft YaHei", sans-serif';
                ctx.fillText(t('results.song.empty', '本组暂无已记录歌曲'), margin + 18, detailY + 12);
                detailY += 18;
                continue;
            }

            for (let songIndex = 0; songIndex < songs.length; songIndex += 1) {
                const song = songs[songIndex];
                fillRoundedRect(ctx, margin + 14, detailY, detailWidth - 28, 48, 7, theme.panel, theme.border, 1);
                const coverImage = await loadDiagramCanvasImage(song?.coverPath || '', {
                    fallbackDataUrl: coverFallback,
                    treatRemoteAsDefaultAvatar: false
                });
                if (coverImage) {
                    ctx.drawImage(coverImage, margin + 20, detailY + 6, 36, 36);
                }

                ctx.fillStyle = theme.text;
                ctx.font = '700 11px "Segoe UI", "Microsoft YaHei", sans-serif';
                const songTitle = fitTextWithEllipsis(ctx, String(song?.title || t('song.unknown_title', '未知曲目')), detailWidth - 98);
                ctx.fillText(songTitle, margin + 64, detailY + 17);

                ctx.fillStyle = theme.textSoft;
                ctx.font = '600 10px "Segoe UI", "Microsoft YaHei", sans-serif';
                const songMeta = [
                    song?.musicId ? `MusicID ${song.musicId}` : '',
                    Number.isFinite(song?.bpm) ? `BPM ${song.bpm}` : '',
                    song?.genre || '',
                    song?.type || ''
                ].filter(Boolean).join(' · ');
                ctx.fillText(fitTextWithEllipsis(ctx, songMeta, detailWidth - 98), margin + 64, detailY + 29);

                const songScore = `${player1Name}: ${formatOptionalScoreValue(song?.scoreP1)} | ${player2Name}: ${match?.players?.[1]?.isBye ? '--.----' : formatOptionalScoreValue(song?.scoreP2)}`;
                ctx.fillText(fitTextWithEllipsis(ctx, songScore, detailWidth - 98), margin + 64, detailY + 41);
                detailY += 52;
            }
        }

        detailY += 8;
    }

    return canvas;
}

async function saveMergedDiagramImages(payloadItems) {
    const response = await fetch('/api/save-result-diagram', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            items: payloadItems
        })
    });

    if (!response.ok) {
        throw createAppError('APP-RESULT-023', `保存晋级图失败，HTTP ${response.status}`);
    }

    const result = await response.json();
    if (!result || result.success !== true || !Array.isArray(result.saved_files)) {
        throw createAppError('APP-RESULT-024', `保存晋级图失败: ${result?.error || '响应标记为失败'}`);
    }
    return result.saved_files;
}

async function exportMergedBracketAsPng() {
    const model = mergedBracketRenderState.model;
    const exportBtn = document.getElementById('exportMergedBracketPngBtn');
    if (!model || typeof model !== 'object') {
        customAlert.show(t('common.tip', '提示'), '请先生成合并晋级图');
        return;
    }

    if (exportBtn) {
        exportBtn.disabled = true;
    }

    try {
        const timestamp = formatTimestampForFileName();
        const lightCanvas = await drawMergedBracketDiagramToCanvas(model, 'light');
        const darkCanvas = await drawMergedBracketDiagramToCanvas(model, 'dark');
        const items = [
            {
                filename: `Merged_${timestamp}_light.png`,
                content_base64: String(lightCanvas.toDataURL('image/png').split(',')[1] || '')
            },
            {
                filename: `Merged_${timestamp}_dark.png`,
                content_base64: String(darkCanvas.toDataURL('image/png').split(',')[1] || '')
            }
        ];

        const savedFiles = await saveMergedDiagramImages(items);
        const fileList = savedFiles.map(file => String(file || '').trim()).filter(Boolean).join('、');
        customAlert.show(t('common.success', '成功'), `晋级图已保存到 Result/ResultDiagram：${fileList}`);
    } catch (error) {
        const finalError = error?.code ? error : createAppError('APP-RESULT-021', '导出PNG失败', error);
        customAlert.show(t('common.tip', '提示'), formatAppError(finalError));
    } finally {
        if (exportBtn) {
            exportBtn.disabled = false;
        }
    }
}

function initResultHistoryManagement() {
    if (resultHistoryManagementInitialized) {
        return;
    }

    const refreshBtn = document.getElementById('refreshResultFilesBtn');
    const loadBtn = document.getElementById('loadResultFileBtn');
    const fileSelect = document.getElementById('resultFileSelect');
    const exportWinnersBtn = document.getElementById('exportWinnersBtn');
    const mergeResultsBtn = document.getElementById('mergeResultsBtn');
    const exportMergedPngBtn = document.getElementById('exportMergedBracketPngBtn');

    const exportWinnersDialog = document.getElementById('exportWinnersDialog');
    const exportWinnersInput = document.getElementById('exportWinnersFileName');
    const exportWinnersCancel = document.getElementById('exportWinnersCancel');
    const exportWinnersConfirm = document.getElementById('exportWinnersConfirm');

    const mergeResultsDialog = document.getElementById('mergeResultsDialog');
    const mergeResultsList = document.getElementById('mergeResultsFileList');
    const mergeResultsCancel = document.getElementById('mergeResultsCancel');
    const mergeResultsConfirm = document.getElementById('mergeResultsConfirm');

    if (
        !refreshBtn &&
        !loadBtn &&
        !fileSelect &&
        !exportWinnersBtn &&
        !mergeResultsBtn &&
        !exportMergedPngBtn
    ) {
        return;
    }

    resultHistoryManagementInitialized = true;

    if (exportMergedPngBtn) {
        exportMergedPngBtn.disabled = !mergedBracketRenderState.model;
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            try {
                await refreshResultFilesList();
            } catch (_) {
                // 错误提示在 refreshResultFilesList 中处理
            }
        });
    }

    if (fileSelect) {
        fileSelect.addEventListener('change', () => {
            if (loadBtn) {
                loadBtn.disabled = !String(fileSelect.value || '').trim();
            }
        });
    }

    if (loadBtn) {
        loadBtn.addEventListener('click', async () => {
            const selectedFileName = fileSelect ? fileSelect.value : '';
            await loadResultFileByName(selectedFileName);
        });
    }

    if (exportWinnersBtn) {
        exportWinnersBtn.addEventListener('click', async () => {
            try {
                await exportWinnersAsCharacterFile();
            } catch (error) {
                const finalError = error?.code ? error : createAppError('APP-RESULT-011', '导出胜利者名单失败', error);
                customAlert.show(t('results.export_winners.failed_title', '导出失败'), formatAppError(finalError));
            }
        });
    }

    if (exportWinnersCancel) {
        exportWinnersCancel.addEventListener('click', () => {
            closeExportWinnersDialog();
        });
    }

    if (exportWinnersConfirm) {
        exportWinnersConfirm.addEventListener('click', async () => {
            await confirmExportWinnersDialog();
        });
    }

    if (exportWinnersInput) {
        exportWinnersInput.addEventListener('keydown', async event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                await confirmExportWinnersDialog();
                return;
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                closeExportWinnersDialog();
            }
        });
    }

    if (exportWinnersDialog) {
        exportWinnersDialog.addEventListener('click', event => {
            if (event.target === exportWinnersDialog) {
                closeExportWinnersDialog();
            }
        });
    }

    if (mergeResultsBtn) {
        mergeResultsBtn.addEventListener('click', async () => {
            try {
                await openMergeResultsDialog();
            } catch (error) {
                const finalError = error?.code ? error : createAppError('APP-RESULT-022', '打开合并弹窗失败', error);
                customAlert.show(t('common.tip', '提示'), formatAppError(finalError));
            }
        });
    }

    if (mergeResultsList) {
        mergeResultsList.addEventListener('change', () => {
            updateMergeResultsConfirmButtonState();
        });
    }

    if (mergeResultsCancel) {
        mergeResultsCancel.addEventListener('click', () => {
            closeMergeResultsDialog();
        });
    }

    if (mergeResultsConfirm) {
        mergeResultsConfirm.addEventListener('click', async () => {
            await confirmMergeResultsDialog();
        });
    }

    if (mergeResultsDialog) {
        mergeResultsDialog.addEventListener('click', event => {
            if (event.target === mergeResultsDialog) {
                closeMergeResultsDialog();
            }
        });
    }

    if (exportMergedPngBtn) {
        exportMergedPngBtn.addEventListener('click', async () => {
            await exportMergedBracketAsPng();
        });
    }
}

function getThemeCssVar(variableName, fallbackValue = '') {
    if (typeof variableName !== 'string' || !variableName) return fallbackValue;
    const bodyStyles = window.getComputedStyle(document.body);
    const bodyValue = bodyStyles.getPropertyValue(variableName).trim();
    if (bodyValue) return bodyValue;

    const rootStyles = window.getComputedStyle(document.documentElement);
    const rootValue = rootStyles.getPropertyValue(variableName).trim();
    if (rootValue) return rootValue;

    return fallbackValue;
}

function normalizeScoreValue(rawValue) {
    const numericValue = Number(rawValue);
    if (!Number.isFinite(numericValue)) return 0;
    const clamped = Math.min(101, Math.max(0, numericValue));
    return Math.round(clamped * 10000) / 10000;
}

function formatScoreValue(value) {
    const normalized = normalizeScoreValue(value);
    return normalized.toFixed(4);
}

function roundToFourDecimals(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return 0;
    return Math.round(numericValue * 10000) / 10000;
}

function formatTotalScoreValue(value) {
    return roundToFourDecimals(value).toFixed(4);
}

function normalizeScoreInputValue(inputElement, options = {}) {
    if (!(inputElement instanceof HTMLInputElement)) return 0;
    const { fillEmptyAsZero = false } = options;
    const raw = String(inputElement.value ?? '').trim();
    if (!raw) {
        if (fillEmptyAsZero) {
            inputElement.value = '0.0000';
            return 0;
        }
        inputElement.value = '';
        return 0;
    }

    const normalized = normalizeScoreValue(raw);
    inputElement.value = normalized.toFixed(4);
    return normalized;
}

function fitTextInContainer(textElement, minFontSize = 12, maxFontSize = 26) {
    if (!(textElement instanceof HTMLElement)) return;
    let size = maxFontSize;
    textElement.style.fontSize = `${size}px`;
    while (size > minFontSize && textElement.scrollWidth > textElement.clientWidth) {
        size -= 1;
        textElement.style.fontSize = `${size}px`;
    }
}

function isGlobalSyncEnabled() {
    if (currentMatchConfig && typeof currentMatchConfig.globalSync === 'boolean') {
        return currentMatchConfig.globalSync;
    }
    return runtimeGlobalSyncEnabled;
}

function updateGlobalSyncToggleButton() {
    const toggleGlobalSyncBtn = document.getElementById('toggleGlobalSyncBtn');
    if (!toggleGlobalSyncBtn) return;

    const enabled = isGlobalSyncEnabled();
    toggleGlobalSyncBtn.textContent = enabled
        ? t('home.match.global_sync_on', '全局同步已开启')
        : t('home.match.global_sync_off', '全局同步已关闭');
    toggleGlobalSyncBtn.style.background = enabled ? '#34a5ff' : '#9e9e9e';
    toggleGlobalSyncBtn.style.color = 'white';
    toggleGlobalSyncBtn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
}

function setGlobalSyncEnabled(enabled, options = {}) {
    const { notify = false, syncCheckbox = true } = options;
    const normalized = !!enabled;
    runtimeGlobalSyncEnabled = normalized;

    if (currentMatchConfig) {
        currentMatchConfig.globalSync = normalized;
    }

    if (syncCheckbox) {
        const globalSyncCheckbox = document.getElementById('matchConfigGlobalSync');
        if (globalSyncCheckbox) {
            globalSyncCheckbox.checked = normalized;
        }
    }

    updateGlobalSyncToggleButton();

    if (notify) {
        showGlobalSyncStateMessage(normalized);
    }
}

// 初始化介绍页面交互
function initIntroPage() {
    // 初始状态：显示介绍页面，隐藏主内容和导航菜单
    const introPage = document.getElementById('introPage');
    const mainContent = document.getElementById('mainContent');
    
    if (introPage && mainContent) {
        introPage.style.display = 'flex';
        mainContent.style.display = 'none';
    }
    
    // 存储介绍页面状态
    window.isIntroPageVisible = true;
}

// 初始化人员管理功能
function initPeopleManagement() {
    renderPeopleList();
    updateGlobalSyncToggleButton();
    initResultHistoryManagement();
    syncPeopleToolVisibilityState();

    if (peopleManagementInitialized) {
        return;
    }
    peopleManagementInitialized = true;

    // 添加人员按钮事件监听
    const addPersonBtn = document.getElementById('addPersonBtn');
    if (addPersonBtn) {
        addPersonBtn.addEventListener('click', showAddPersonDialog);
    }
    
    // 导入导出按钮事件监听
    const importPeopleBtn = document.getElementById('importPeopleBtn');
    const exportPeopleBtn = document.getElementById('exportPeopleBtn');
    
    if (importPeopleBtn) importPeopleBtn.addEventListener('click', handleImportPeople);
    if (exportPeopleBtn) exportPeopleBtn.addEventListener('click', handleExportPeople);
    
    // 弹窗按钮事件监听
    const addPersonConfirmBtn = document.getElementById('addPersonConfirm');
    const addPersonCancelBtn = document.getElementById('addPersonCancel');
    
    if (addPersonConfirmBtn) addPersonConfirmBtn.addEventListener('click', handleAddPersonConfirm);
    if (addPersonCancelBtn) addPersonCancelBtn.addEventListener('click', handleAddPersonCancel);
    
    // 导出人员弹窗按钮事件监听
    const exportPeopleConfirmBtn = document.getElementById('exportPeopleConfirm');
    const exportPeopleCancelBtn = document.getElementById('exportPeopleCancel');
    
    if (exportPeopleConfirmBtn) exportPeopleConfirmBtn.addEventListener('click', handleExportPeopleConfirm);
    if (exportPeopleCancelBtn) exportPeopleCancelBtn.addEventListener('click', handleExportPeopleCancel);
    
    // 导入人员弹窗按钮事件监听
    const importPeopleConfirmBtn = document.getElementById('importPeopleConfirm');
    const importPeopleCancelBtn = document.getElementById('importPeopleCancel');
    
    if (importPeopleConfirmBtn) importPeopleConfirmBtn.addEventListener('click', handleImportPeopleConfirm);
    if (importPeopleCancelBtn) importPeopleCancelBtn.addEventListener('click', handleImportPeopleCancel);
    
    // QQ号输入事件监听，实时更新头像
    const personQQInput = document.getElementById('personQQ');
    if (personQQInput) {
        personQQInput.addEventListener('input', handleQQInput);
    }
    
    // 开始比赛按钮事件监听
    const startMatchBtn = document.getElementById('startMatchBtn');
    if (startMatchBtn) {
        startMatchBtn.addEventListener('click', startMatch);
    }
    
    // 隐藏按钮事件监听
    const hidePeopleBtn = document.getElementById('hidePeopleBtn');
    if (hidePeopleBtn) {
        hidePeopleBtn.addEventListener('click', hidePeopleTool);
    }
    
    // 喵按钮事件监听
    const meowBtn = document.getElementById('meowBtn');
    if (meowBtn) {
        meowBtn.addEventListener('click', showPeopleTool);
    }
    
    // 返回人员列表按钮事件监听
    const backToPeopleBtn = document.getElementById('backToPeopleBtn');
    if (backToPeopleBtn) {
        backToPeopleBtn.addEventListener('click', () => {
            peopleToolManuallyHidden = false;
            syncPeopleToolVisibilityState();
            
            // 滚动到页面顶部
            window.scrollTo(0, 0);
        });
    }
    
    const toggleGlobalSyncBtn = document.getElementById('toggleGlobalSyncBtn');
    if (toggleGlobalSyncBtn) {
        if (toggleGlobalSyncBtn._toggleSyncHandler) {
            toggleGlobalSyncBtn.removeEventListener('click', toggleGlobalSyncBtn._toggleSyncHandler);
        }

        const toggleSyncHandler = () => {
            setGlobalSyncEnabled(!isGlobalSyncEnabled(), { notify: true });
        };

        toggleGlobalSyncBtn._toggleSyncHandler = toggleSyncHandler;
        toggleGlobalSyncBtn.addEventListener('click', toggleSyncHandler);
        updateGlobalSyncToggleButton();
    }
    
    // 比赛配置弹窗事件监听
    const matchConfigCancelBtn = document.getElementById('matchConfigCancel');
    const matchConfigConfirmBtn = document.getElementById('matchConfigConfirm');
    
    if (matchConfigCancelBtn) {
        matchConfigCancelBtn.addEventListener('click', () => {
            const dialog = document.getElementById('matchConfigDialog');
            if (dialog) {
                dialog.classList.remove('show');
            }
        });
    }
    
    if (matchConfigConfirmBtn) {
        matchConfigConfirmBtn.addEventListener('click', () => {
            // 获取配置值
            const roundInput = document.getElementById('matchConfigRound');
            const songCountInput = document.getElementById('matchConfigSongCount');
            const globalSyncCheckbox = document.getElementById('matchConfigGlobalSync');
            const byRatingCheckbox = document.getElementById('matchConfigByRating');
            
            if (!roundInput || !songCountInput || !globalSyncCheckbox || !byRatingCheckbox) return;
            
            const round = parseInt(roundInput.value);
            const songCount = parseInt(songCountInput.value);
            const globalSync = globalSyncCheckbox.checked;
            const byRating = byRatingCheckbox.checked;
            
            // 验证输入
            if (isNaN(round) || round < 1) {
                customAlert.show(t('common.tip', '提示'), t('match.config.invalid_round', '请输入有效的场次数'));
                return;
            }
            
            if (isNaN(songCount) || songCount < 1) {
                customAlert.show(t('common.tip', '提示'), t('match.config.invalid_song_count', '请输入有效的歌曲数量'));
                return;
            }
            
            // 保存配置
            currentMatchConfig = {
                round: round,
                songCount: songCount,
                globalSync: globalSync,
                byRating: byRating
            };
            setGlobalSyncEnabled(globalSync, { notify: false, syncCheckbox: true });
            
            // 关闭弹窗
            const dialog = document.getElementById('matchConfigDialog');
            if (dialog) {
                dialog.classList.remove('show');
            }
            
            // 继续开始比赛
            if (savedMatchGroups) {
                // 询问用户是否使用保存的结果
                customAlert.confirm(
                    t('common.tip', '提示'),
                    t('match.config.use_saved_prompt', '已有保存的比赛分组结果，是否使用？'),
                    t('match.config.use_saved_confirm', '使用保存结果'),
                    t('match.config.use_saved_cancel', '重新随机')
                ).then((confirmed) => {
                    if (confirmed) {
                        // 使用保存的结果
                        displayMatchGroups(savedMatchGroups);
                    } else {
                        // 重新随机分组
                        createAndDisplayNewGroups();
                    }
                });
            } else {
                // 没有保存的结果，直接重新随机分组
                createAndDisplayNewGroups();
            }
        });
    }
    
    // 结束比赛按钮事件监听
    const endMatchBtn = document.getElementById('endMatchBtn');
    if (endMatchBtn) {
        endMatchBtn.addEventListener('click', () => {
            endMatch();
        });
    }
    
    // 隐藏结果按钮事件监听
    const hideResultsBtn = document.getElementById('hideResultsBtn');
    if (hideResultsBtn) {
        hideResultsBtn.addEventListener('click', () => {
            const resultsContainer = document.getElementById('matchResultsContainer');
            if (resultsContainer) {
                resultsContainer.style.display = 'none';
            }
        });
    }
    
    // 歌曲选择弹窗事件监听
    const songSelectCancelBtn = document.getElementById('songSelectCancel');
    const songSelectConfirmBtn = document.getElementById('songSelectConfirm');
    
    if (songSelectCancelBtn) {
        songSelectCancelBtn.addEventListener('click', () => {
            const dialog = document.getElementById('songSelectDialog');
            if (dialog) {
                dialog.classList.remove('show');
            }
        });
    }
    
    // 随机范围选择弹窗事件监听
    const randomRangeCancelBtn = document.getElementById('randomRangeCancel');
    const randomRangeConfirmBtn = document.getElementById('randomRangeConfirm');
    
    // 动态生成等级和流派选项
    function generateRandomRangeOptions() {
        // 生成等级选项
        const levelSelect = document.getElementById('randomLevel');
        if (levelSelect) {
            // 清空现有选项
            levelSelect.innerHTML = `<option value="all">${t('random.range.all_levels', '全部等级')}</option>`;
            
            // 获取所有等级
            const allLevels = [];
            songs.forEach(song => {
                if (song.基础信息.等级) {
                    song.基础信息.等级.forEach(level => {
                        if (!allLevels.includes(level)) {
                            allLevels.push(level);
                        }
                    });
                }
            });
            
            // 按数字大小排序
            allLevels.sort((a, b) => {
                // 处理带+号的等级，如"12+"
                const aNum = parseFloat(a.replace('+', ''));
                const bNum = parseFloat(b.replace('+', ''));
                return aNum - bNum;
            });
            
            // 添加等级选项
            allLevels.forEach(level => {
                const option = document.createElement('option');
                option.value = level;
                option.textContent = level;
                levelSelect.appendChild(option);
            });
        }
        
        // 生成流派选项
        const genreSelect = document.getElementById('randomGenre');
        if (genreSelect) {
            // 清空现有选项
            genreSelect.innerHTML = `<option value="all">${t('random.range.all_genres', '全部流派')}</option>`;
            
            // 获取所有流派
            const allGenres = [];
            songs.forEach(song => {
                if (song.基础信息.流派 && !allGenres.includes(song.基础信息.流派)) {
                    allGenres.push(song.基础信息.流派);
                }
            });
            
            // 按字母排序
            allGenres.sort();
            
            // 添加流派选项
            allGenres.forEach(genre => {
                const option = document.createElement('option');
                option.value = genre;
                option.textContent = genre;
                genreSelect.appendChild(option);
            });
        }
    }
    
    // 显示随机范围选择弹窗时生成选项
    function showRandomRangeDialog() {
        const dialog = document.getElementById('randomRangeDialog');
        if (dialog) {
            dialog.classList.add('show');
            // 生成选项
            generateRandomRangeOptions();
        }
    }
    
    if (randomRangeCancelBtn) {
        randomRangeCancelBtn.addEventListener('click', () => {
            const dialog = document.getElementById('randomRangeDialog');
            if (dialog) {
                dialog.classList.remove('show');
            }
        });
    }
    
    if (randomRangeConfirmBtn) {
        randomRangeConfirmBtn.addEventListener('click', () => {
            // 保存随机范围设置
            const levelSelect = document.getElementById('randomLevel');
            const genreSelect = document.getElementById('randomGenre');
            
            window.currentRandomConfig = {
                level: levelSelect.value,
                genre: genreSelect.value
            };
            
            // 关闭当前弹窗
            const dialog = document.getElementById('randomRangeDialog');
            if (dialog) {
                dialog.classList.remove('show');
            }
            
            // 显示歌曲信息弹窗并开始随机动画
            showSongInfoDialog(true);
        });
    }
    
    // 修改歌曲选择弹窗的下一步按钮事件，使用新的函数显示随机范围弹窗
    if (songSelectConfirmBtn) {
        songSelectConfirmBtn.addEventListener('click', () => {
            const randomRadio = document.getElementById('songSelectRandom');
            const dialog = document.getElementById('songSelectDialog');
            
            if (randomRadio.checked) {
                // 显示随机范围选择弹窗
                showRandomRangeDialog();
            } else {
                // 显示指定文件选择弹窗
                const specificFileDialog = document.getElementById('specificFileDialog');
                if (specificFileDialog) {
                    specificFileDialog.classList.add('show');
                    // 加载文件列表
                    loadSpecificFileList();
                }
            }
            
            // 关闭当前弹窗
            if (dialog) {
                dialog.classList.remove('show');
            }
        });
    }
    
    // 指定文件选择弹窗事件监听
    const specificFileCancelBtn = document.getElementById('specificFileCancel');
    const specificFileConfirmBtn = document.getElementById('specificFileConfirm');
    
    // 显示指定文件选择弹窗时获取文件列表
    function loadSpecificFileList() {
        const fileSelect = document.getElementById('specificFileSelect');
        if (!fileSelect) return;
        
        // 清空现有选项
        fileSelect.innerHTML = `<option value="">${t('common.loading', '加载中...')}</option>`;
        
        // 使用fetchMaiListFiles函数获取文件列表
        fetchMaiListFiles().then(files => {
            // 清空现有选项
            fileSelect.innerHTML = '';
            
            // 添加全部选项
            const allOption = document.createElement('option');
            allOption.value = 'all';
            allOption.textContent = t('random.all_songs', '全部歌曲');
            fileSelect.appendChild(allOption);
            
            // 添加文件选项
            files.forEach(file => {
                const option = document.createElement('option');
                option.value = file.name;
                option.textContent = file.name;
                fileSelect.appendChild(option);
            });
        }).catch(error => {
            console.error('获取文件列表失败:', error);
            fileSelect.innerHTML = `<option value="">${t('common.load_failed', '加载失败')}</option>`;
            customAlert.show(t('random.specific_file_load_failed.title', '读取指定文件列表失败'), formatAppError(error));
        });
    }
    
    if (specificFileCancelBtn) {
        specificFileCancelBtn.addEventListener('click', () => {
            const dialog = document.getElementById('specificFileDialog');
            if (dialog) {
                dialog.classList.remove('show');
            }
        });
    }
    
    if (specificFileConfirmBtn) {
        specificFileConfirmBtn.addEventListener('click', () => {
            // 保存指定文件设置
            const fileSelect = document.getElementById('specificFileSelect');
            window.currentSpecificFile = fileSelect.value;
            
            // 关闭当前弹窗
            const dialog = document.getElementById('specificFileDialog');
            if (dialog) {
                dialog.classList.remove('show');
            }
            
            // 显示歌曲信息弹窗并开始随机动画
            showSongInfoDialog(false);
        });
    }
    
    // 监听指定文件选择弹窗的显示事件
    const specificFileDialog = document.getElementById('specificFileDialog');
    if (specificFileDialog) {
        // 使用MutationObserver监听弹窗显示状态变化
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    if (specificFileDialog.classList.contains('show')) {
                        // 弹窗显示时加载文件列表
                        loadSpecificFileList();
                    }
                }
            });
        });
        
        if (specificFileDialog._xmaiObserver) {
            specificFileDialog._xmaiObserver.disconnect();
        }
        specificFileDialog._xmaiObserver = observer;
        observer.observe(specificFileDialog, { attributes: true });
    }
}

// 显示添加人员弹窗
function showAddPersonDialog() {
    const dialog = document.getElementById('addPersonDialog');
    if (dialog) {
        // 重置表单
        const personNameInput = document.getElementById('personName');
        const personQQInput = document.getElementById('personQQ');
        const personRatingInput = document.getElementById('personRating');
        const personAvatar = document.getElementById('personAvatar');
        
        if (personNameInput) personNameInput.value = '';
        if (personQQInput) personQQInput.value = '';
        if (personRatingInput) personRatingInput.value = '';
        if (personAvatar) bindImageElementSource(personAvatar, DEFAULT_AVATAR_PATH);
        
        dialog.classList.add('show');
    }
}

// 处理QQ号输入，更新头像
function handleQQInput(e) {
    const qqNumber = e.target.value.trim();
    const avatarImg = document.getElementById('personAvatar');
    if (!avatarImg) return;
    
    if (qqNumber) {
        // 使用QQ头像API
        const avatarUrl = `https://q.qlogo.cn/g?b=qq&nk=${qqNumber}&s=640`;
        bindImageElementSource(avatarImg, avatarUrl);
        
        // 错误处理：如果加载失败，显示默认头像
        avatarImg.onerror = function() {
            bindImageElementSource(this, DEFAULT_AVATAR_PATH);
        };
    } else {
        // 显示默认头像
        bindImageElementSource(avatarImg, DEFAULT_AVATAR_PATH);
    }
}

// 渲染人员列表
function renderPeopleList() {
    const peopleList = document.getElementById('peopleList');
    if (!peopleList) return;
    
    // 清空现有列表
    peopleList.innerHTML = '';
    peopleList.classList.remove('is-empty');
    
    // 如果没有人员，显示提示
    if (people.length === 0) {
        peopleList.classList.add('is-empty');
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-message';
        emptyMessage.textContent = t('home.people.empty', '暂无人员数据，请添加人员');
        peopleList.appendChild(emptyMessage);
        return;
    }
    
    // 渲染每个人员项
    people.forEach(person => {
        const personItem = document.createElement('div');
        personItem.className = 'person-item';
        personItem.style.cssText = `
            display: flex;
            align-items: center;
            gap: 15px;
            padding: 15px;
            margin-bottom: 10px;
            background: var(--bg-primary);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            transition: all 0.2s ease;
        `;
        
        personItem.onmouseenter = () => {
            personItem.style.backgroundColor = 'var(--bg-secondary)';
            personItem.style.transform = 'translateX(5px)';
        };
        
        personItem.onmouseleave = () => {
            personItem.style.backgroundColor = 'var(--bg-primary)';
            personItem.style.transform = 'translateX(0)';
        };
        
        // 头像
        const avatar = document.createElement('img');
        bindImageElementSource(avatar, person.avatar || DEFAULT_AVATAR_PATH);
        avatar.alt = person.name;
        avatar.style.cssText = `
            width: 50px;
            height: 50px;
            border-radius: 50%;
            object-fit: cover;
            border: 2px solid var(--border-color);
        `;
        
        // 人员信息
        const personInfo = document.createElement('div');
        personInfo.style.cssText = `
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 5px;
        `;
        
        // 姓名
        const name = document.createElement('div');
        name.style.cssText = `
            font-weight: bold;
            color: var(--text-primary);
            font-size: 16px;
        `;
        name.textContent = person.name;
        
        // 其他信息
        const otherInfo = document.createElement('div');
        otherInfo.style.cssText = `
            color: var(--text-secondary);
            font-size: 14px;
            white-space: normal;
        `;
        
        const infoParts = [];
        if (person.qq) {
            infoParts.push(t('people.meta.qq', 'QQ: {value}', { value: person.qq }));
        }
        if (person.rating) {
            infoParts.push(t('people.meta.rating', 'Rating: {value}', { value: person.rating }));
        }
        // 移除创建日期的显示，避免person-item过长
        // if (person.createdAt) infoParts.push(`创建时间: ${person.createdAt}`);
        
        otherInfo.textContent = infoParts.join(' | ');
        
        // 添加到人员信息
        personInfo.appendChild(name);
        personInfo.appendChild(otherInfo);
        
        // 添加到人员项
        personItem.appendChild(avatar);
        personItem.appendChild(personInfo);
        
        // 添加到列表
        peopleList.appendChild(personItem);
    });
}

// 处理添加人员确认
function handleAddPersonConfirm() {
    const nameInput = document.getElementById('personName');
    const qqInput = document.getElementById('personQQ');
    const ratingInput = document.getElementById('personRating');
    const avatarImg = document.getElementById('personAvatar');
    
    if (!nameInput || !qqInput || !avatarImg) return;
    
    const name = nameInput.value.trim();
    const qq = qqInput.value.trim();
    const rating = ratingInput ? parseFloat(ratingInput.value) || null : null;
    
    // 验证姓名必填
    if (!name) {
        customAlert.show(t('common.tip', '提示'), t('people.add.prompt_name', '请输入姓名'));
        return;
    }
    
    // 创建人员对象
    const person = {
        id: Date.now(), // 使用时间戳作为唯一ID
        name: name,
        qq: qq,
        rating: rating,
        avatar: avatarImg.dataset.imagePath || avatarImg.src,
        createdAt: new Date().toLocaleString()
    };
    
    // 添加到人员列表
    people.push(person);
    
    // 渲染人员列表
    renderPeopleList();
    
    // 关闭弹窗
    const dialog = document.getElementById('addPersonDialog');
    if (dialog) dialog.classList.remove('show');
    
    // 显示成功提示
    customAlert.show(t('common.success', '成功'), t('people.add.success', '人员添加成功'));
}

// 处理添加人员取消
function handleAddPersonCancel() {
    const dialog = document.getElementById('addPersonDialog');
    if (dialog) {
        // 恢复弹窗默认状态
        delete dialog.dataset.editPersonId;
        const dialogTitle = dialog.querySelector('h3');
        if (dialogTitle) {
            dialogTitle.textContent = t('dialog.add_person.title', '添加人员');
        }
        const confirmBtn = document.getElementById('addPersonConfirm');
        if (confirmBtn) {
            confirmBtn.textContent = t('common.confirm', '确定');
        }
        
        // 关闭弹窗
        dialog.classList.remove('show');
        
        // 重置表单
        const personNameInput = document.getElementById('personName');
        const personQQInput = document.getElementById('personQQ');
        const personRatingInput = document.getElementById('personRating');
        const personAvatar = document.getElementById('personAvatar');
        
        if (personNameInput) personNameInput.value = '';
        if (personQQInput) personQQInput.value = '';
        if (personRatingInput) personRatingInput.value = '';
        if (personAvatar) bindImageElementSource(personAvatar, DEFAULT_AVATAR_PATH);
    }
}

// 处理导入人员
async function handleImportPeople() {
    const dialog = document.getElementById('importPeopleDialog');
    if (dialog) {
        try {
            // 刷新文件列表
            await refreshCharacterFiles();
        } catch (error) {
            customAlert.show(t('people.import.failed_title', '导入失败'), formatAppError(error));
            return;
        }
        dialog.classList.add('show');
    }
}

// 处理导出人员
function handleExportPeople() {
    const dialog = document.getElementById('exportPeopleDialog');
    if (dialog) {
        dialog.classList.add('show');
    }
}

// 处理导出人员确认
function handleExportPeopleConfirm() {
    const dialog = document.getElementById('exportPeopleDialog');
    const fileNameInput = document.getElementById('exportPeopleFileName');
    if (!dialog || !fileNameInput) return;
    
    const fileName = fileNameInput.value.trim();
    if (!fileName) {
        customAlert.show(t('common.tip', '提示'), t('common.enter_filename', '请输入文件名'));
        return;
    }
    
    // 保存人员数据到服务器
    saveCharacterFile(fileName, people);
    
    // 关闭弹窗
    dialog.classList.remove('show');
    fileNameInput.value = '';
}

// 处理导出人员取消
function handleExportPeopleCancel() {
    const dialog = document.getElementById('exportPeopleDialog');
    const fileNameInput = document.getElementById('exportPeopleFileName');
    if (dialog) {
        dialog.classList.remove('show');
    }
    if (fileNameInput) {
        fileNameInput.value = '';
    }
}

// 处理导入人员确认
function handleImportPeopleConfirm() {
    const dialog = document.getElementById('importPeopleDialog');
    const fileSelect = document.getElementById('importPeopleFileSelect');
    if (!dialog || !fileSelect) return;
    
    const selectedFile = fileSelect.value;
    if (!selectedFile) {
        customAlert.show(t('common.tip', '提示'), t('people.import.select_prompt', '请选择要导入的文件'));
        return;
    }
    
    // 从服务器加载人员数据
    loadCharacterFile(selectedFile);
    
    // 关闭弹窗
    dialog.classList.remove('show');
}

// 处理导入人员取消
function handleImportPeopleCancel() {
    const dialog = document.getElementById('importPeopleDialog');
    if (dialog) {
        dialog.classList.remove('show');
    }
}

// 开始比赛 - 随机分组
function startMatch() {
    // 确保有足够的人员
    if (people.length < 2) {
        customAlert.show(t('common.tip', '提示'), t('match.start.need_two', '至少需要2名人员才能开始比赛'));
        return;
    }
    
    // 关闭导航菜单
    closeNavMenu();
    
    // 检查是否有保存的分组结果
    if (savedMatchGroups) {
        // 询问是否重新随机
        customAlert.confirm(
            t('common.tip', '提示'),
            t('match.start.use_saved_prompt', '已有保存的比赛分组结果，是否重新随机？'),
            t('match.start.rerandom', '重新随机'),
            t('match.start.use_saved', '使用保存结果')
        ).then((confirmed) => {
            if (confirmed) {
                // 显示比赛配置弹窗
                const dialog = document.getElementById('matchConfigDialog');
                if (dialog) {
                    // 重置表单
                    const roundInput = document.getElementById('matchConfigRound');
                    const songCountInput = document.getElementById('matchConfigSongCount');
                    const globalSyncCheckbox = document.getElementById('matchConfigGlobalSync');
                    const byRatingCheckbox = document.getElementById('matchConfigByRating');
                    
                    if (roundInput) roundInput.value = '';
                    if (songCountInput) songCountInput.value = '';
                    if (globalSyncCheckbox) globalSyncCheckbox.checked = false;
                    if (byRatingCheckbox) byRatingCheckbox.checked = false;
                    
                    dialog.classList.add('show');
                }
            } else {
                // 使用保存的结果
                displayMatchGroups(savedMatchGroups);
            }
        });
    } else {
        // 没有保存的结果，直接显示比赛配置弹窗
        const dialog = document.getElementById('matchConfigDialog');
        if (dialog) {
            // 重置表单
            const roundInput = document.getElementById('matchConfigRound');
            const songCountInput = document.getElementById('matchConfigSongCount');
            const globalSyncCheckbox = document.getElementById('matchConfigGlobalSync');
            const byRatingCheckbox = document.getElementById('matchConfigByRating');
            
            if (roundInput) roundInput.value = '';
            if (songCountInput) songCountInput.value = '';
            if (globalSyncCheckbox) globalSyncCheckbox.checked = false;
            if (byRatingCheckbox) byRatingCheckbox.checked = false;
            
            dialog.classList.add('show');
        }
    }
}

// 创建并显示新的随机分组
function createAndDisplayNewGroups() {
    let shuffledPeople = [...people];
    
    // 检查是否按Rating分配
    if (currentMatchConfig && currentMatchConfig.byRating) {
        // 按Rating排序
        shuffledPeople.sort((a, b) => {
            // 处理rating为空或null的情况
            const ratingA = a.rating || 0;
            const ratingB = b.rating || 0;
            return ratingA - ratingB;
        });
    } else {
        // 随机打乱
        shuffledPeople = shuffledPeople.sort(() => Math.random() - 0.5);
    }
    
    // 创建比赛分组
    const matchGroups = [];
    for (let i = 0; i < shuffledPeople.length; i += 2) {
        // 每两人一组
        const group = {
            player1: shuffledPeople[i],
            player2: shuffledPeople[i + 1] || null // 处理奇数人数的情况
        };
        matchGroups.push(group);
    }
    
    // 显示比赛分组
    displayMatchGroups(matchGroups);
}

function getSongFromLibraryByMusicId(musicId) {
    const normalizedMusicId = String(musicId ?? '').trim();
    if (!normalizedMusicId || !Array.isArray(songs)) return null;
    return songs.find(item => String(item?.基础信息?.MusicID ?? '').trim() === normalizedMusicId) || null;
}

function parseScoreInputValue(scoreInput) {
    if (!(scoreInput instanceof HTMLInputElement)) return null;
    const rawValue = String(scoreInput.value ?? '').trim();
    if (!rawValue) return null;
    const numericValue = Number(rawValue);
    if (!Number.isFinite(numericValue)) return null;
    return roundToFourDecimals(Math.min(101, Math.max(0, numericValue)));
}

function resolveGroupResultCode(totalScores, hasPlayer2, fallbackResultCode = null) {
    const parsedFallback = parseInt(fallbackResultCode, 10);
    if ([0, 1, 2].includes(parsedFallback)) {
        return parsedFallback;
    }

    const score1 = roundToFourDecimals(totalScores?.[0] ?? 0);
    const score2 = roundToFourDecimals(totalScores?.[1] ?? 0);
    if (!hasPlayer2) {
        return 1;
    }
    if (score1 > score2) return 1;
    if (score1 < score2) return 2;
    return 0;
}

function collectGroupSongResults(groupDiv, group) {
    if (!(groupDiv instanceof HTMLElement)) return [];

    const players = [group?.player1 || null, group?.player2 || null];
    const songBoxes = Array.from(groupDiv.querySelectorAll('.song-box'))
        .sort((left, right) => {
            const leftIndex = parseInt(left.dataset.songIndex, 10);
            const rightIndex = parseInt(right.dataset.songIndex, 10);
            return (Number.isFinite(leftIndex) ? leftIndex : 0) - (Number.isFinite(rightIndex) ? rightIndex : 0);
        });

    const collectedSongs = [];
    songBoxes.forEach((songBox, orderIndex) => {
        if (!songBoxHasSelectedSong(songBox)) {
            return;
        }

        const songIndex = Number.isFinite(parseInt(songBox.dataset.songIndex, 10))
            ? parseInt(songBox.dataset.songIndex, 10)
            : orderIndex;
        const musicId = String(songBox.dataset.musicId || '').trim();
        const songTitleFromDataset = String(songBox.dataset.songTitle || '').trim();
        const songFromLibrary = getSongFromLibraryByMusicId(musicId);
        const songInfo = songFromLibrary?.基础信息 || null;

        const imageFile = String(songInfo?.image_url || '').trim();
        const fallbackCoverImg = songBox.querySelector('img');
        const fallbackCoverPath = fallbackCoverImg
            ? String(fallbackCoverImg.dataset.imagePath || fallbackCoverImg.getAttribute('src') || '').trim()
            : '';
        const coverPath = imageFile ? `./MaiSongLib/${imageFile}` : normalizeImagePath(fallbackCoverPath);
        const title = String(songInfo?.歌名 || songInfo?.title || songTitleFromDataset || t('song.unknown_title', '未知曲目')).trim();

        const inputScoreMap = new Map();
        const scoreInputs = songBox.querySelectorAll('.song-score-area input[data-player-index]');
        scoreInputs.forEach(scoreInput => {
            const playerSlot = parseInt(scoreInput.dataset.playerIndex, 10);
            if (!Number.isFinite(playerSlot)) return;
            const scoreValue = parseScoreInputValue(scoreInput);
            inputScoreMap.set(playerSlot, scoreValue);
        });

        const playerScores = players
            .map((player, playerSlot) => {
                if (!player) return null;
                return {
                    playerSlot,
                    playerId: player.id ?? null,
                    playerName: String(player.name || '').trim() || t('results.card.unknown_player', '未知选手'),
                    score: inputScoreMap.has(playerSlot) ? inputScoreMap.get(playerSlot) : null
                };
            })
            .filter(Boolean);

        collectedSongs.push({
            songIndex,
            musicId,
            title,
            artist: String(songInfo?.artist || '').trim(),
            bpm: Number.isFinite(Number(songInfo?.bpm)) ? Number(songInfo.bpm) : null,
            genre: String(songInfo?.流派 || '').trim(),
            type: String(songInfo?.type || '').trim(),
            imageFile,
            coverPath,
            levels: Array.isArray(songInfo?.等级) ? [...songInfo.等级] : [],
            constants: Array.isArray(songInfo?.定数) ? [...songInfo.定数] : [],
            playerScores
        });
    });

    return collectedSongs;
}

function collectDetailedGroupResult(groupDiv, group, groupIndex) {
    const safeGroup = group && typeof group === 'object' ? group : {};
    const player1 = safeGroup.player1 || null;
    const player2 = safeGroup.player2 || null;

    const totalScores = (() => {
        if (groupDiv instanceof HTMLElement) {
            return collectLockedTotalScores(groupDiv);
        }
        const fromGroup = Array.isArray(safeGroup.totalScores) ? safeGroup.totalScores : [0, 0];
        return [
            roundToFourDecimals(fromGroup[0] ?? 0),
            roundToFourDecimals(fromGroup[1] ?? 0)
        ];
    })();

    const resultCode = resolveGroupResultCode(
        totalScores,
        !!player2,
        groupDiv instanceof HTMLElement ? groupDiv.dataset.groupResult : safeGroup.result
    );

    const songsForGroup = groupDiv instanceof HTMLElement
        ? collectGroupSongResults(groupDiv, safeGroup)
        : [];

    return {
        groupIndex,
        player1,
        player2,
        totalScores: [
            roundToFourDecimals(totalScores[0] ?? 0),
            roundToFourDecimals(totalScores[1] ?? 0)
        ],
        result: resultCode,
        winnerPlayerSlot: resultCode === 1 ? 0 : (resultCode === 2 ? 1 : null),
        songs: songsForGroup
    };
}

function collectDetailedMatchGroups() {
    if (!Array.isArray(savedMatchGroups)) return [];
    const groupDivs = Array.from(document.querySelectorAll('#matchGroups > div'));

    return savedMatchGroups.map((group, groupIndex) => {
        const groupDiv = groupDivs[groupIndex] || null;
        return collectDetailedGroupResult(groupDiv, group, groupIndex);
    });
}

// 结束比赛并保存结果
async function endMatch() {
    if (!currentMatchConfig || !savedMatchGroups) {
        customAlert.show(t('common.tip', '提示'), t('match.end.no_result', '没有可保存的比赛结果'));
        return;
    }

    const detailedGroups = collectDetailedMatchGroups();
    if (detailedGroups.length === 0) {
        customAlert.show(t('common.tip', '提示'), t('match.end.no_result', '没有可保存的比赛结果'));
        return;
    }

    // 创建比赛结果对象（包含分组、歌曲与逐人分数细则）
    const matchResult = {
        schemaVersion: 2,
        round: currentMatchConfig.round,
        songCount: currentMatchConfig.songCount,
        globalSync: currentMatchConfig.globalSync,
        byRating: currentMatchConfig.byRating,
        groups: detailedGroups,
        people: people,
        timestamp: new Date().toISOString()
    };
    
    try {
        const targetFileName = `${currentMatchConfig.round}.json`;
        const response = await fetch('/api/save-match-result', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                filename: targetFileName,
                content: matchResult
            })
        });

        if (!response.ok) {
            throw createAppError('APP-MATCH-001', `保存比赛结果失败，HTTP ${response.status}`);
        }

        const result = await response.json();
        if (!result || result.success !== true) {
            throw createAppError('APP-MATCH-002', `保存比赛结果失败: ${result?.error || '响应标记为失败'}`);
        }

        const persistedFileName = String(result.file_name || targetFileName || '').trim();
        if (persistedFileName) {
            matchResult.__sourceFileName = persistedFileName;
        }
        upsertMatchResult(matchResult);
        showMatchResults();
        refreshResultFilesList({ silent: true, preferredFileName: persistedFileName }).catch(() => {});
        customAlert.show(
            t('common.success', '成功'),
            t('match.end.save_success', '比赛结果已成功保存为 {filename}', { filename: (result.file_name || targetFileName) })
        );

        // 隐藏比赛分组，显示人员列表
        peopleToolManuallyHidden = false;
        syncPeopleToolVisibilityState();

        // 滚动到页面顶部
        window.scrollTo(0, 0);
    } catch (error) {
        console.error('保存比赛结果失败:', error);
        customAlert.show(t('match.end.save_failed_title', '保存失败'), formatAppError(error));
    }
}

// 显示比赛结果版块
function showMatchResults() {
    const resultsContainer = document.getElementById('matchResultsContainer');
    const resultsList = document.getElementById('matchResultsList');
    
    if (!resultsContainer || !resultsList) return;

    sortMatchResultsByTimeDesc();
    
    // 清空现有结果列表
    resultsList.innerHTML = '';
    
    // 如果没有比赛结果，显示提示信息
    if (matchResults.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.style.cssText = `
            text-align: center;
            color: var(--text-secondary);
            padding: 40px;
            font-size: 16px;
        `;
        emptyState.textContent = t('results.empty', '暂无比赛结果');
        resultsList.appendChild(emptyState);
        return;
    }
    
    // 显示所有保存的比赛结果
    matchResults.forEach(result => {
        displayMatchResultCard(result);
    });
}

// 显示比赛结果卡片
function displayMatchResultCard(result) {
    const resultsList = document.getElementById('matchResultsList');
    if (!resultsList) return;

    const safeRound = result?.round ?? t('common.unknown', '未知');
    const safeTimestamp = (() => {
        const parsed = new Date(result?.timestamp);
        return Number.isNaN(parsed.getTime()) ? t('common.unknown_time', '未知时间') : parsed.toLocaleString();
    })();
    const safeGroups = Array.isArray(result?.groups) ? result.groups : [];
    const sourceFileName = String(result?.__sourceFileName || '').trim();

    const resolveGroupPlayerStatus = (group, playerSlot) => {
        const resultCode = parseInt(group?.result, 10);
        const hasOpponent = !!group?.player2;
        if (playerSlot === 1 && !hasOpponent) return 'bye';
        if (resultCode === 1) return playerSlot === 0 ? 'winner' : 'loser';
        if (resultCode === 2) return playerSlot === 1 ? 'winner' : 'loser';
        return 'tie';
    };

    const resolveSongCoverPath = (songEntry) => {
        if (!songEntry || typeof songEntry !== 'object') return '';
        const directCover = normalizeImagePath(String(songEntry.coverPath || '').trim());
        if (directCover) return directCover;
        const imageFile = String(songEntry.imageFile || '').trim();
        if (imageFile) return normalizeImagePath(`./MaiSongLib/${imageFile}`);
        return '';
    };

    const formatScoreLine = (rawScore) => {
        if (rawScore === null || rawScore === undefined || String(rawScore).trim() === '') return '--.----';
        return formatScoreValue(rawScore);
    };

    const resultCard = document.createElement('article');
    resultCard.className = 'result-card-advanced';

    const cardHeader = document.createElement('header');
    cardHeader.className = 'result-card-advanced-header';

    const cardTitle = document.createElement('h4');
    cardTitle.className = 'result-card-advanced-title';
    cardTitle.textContent = t('results.card.title', '第 {round} 场比赛结果', { round: safeRound });

    const cardMeta = document.createElement('div');
    cardMeta.className = 'result-card-advanced-meta';
    cardMeta.textContent = `${t('results.card.time', '比赛时间')}: ${safeTimestamp}${sourceFileName ? ` · ${t('results.card.source', '来源文件')}: ${sourceFileName}` : ''}`;

    cardHeader.appendChild(cardTitle);
    cardHeader.appendChild(cardMeta);
    resultCard.appendChild(cardHeader);

    const bracketList = document.createElement('div');
    bracketList.className = 'result-bracket-list';

    safeGroups.forEach((group, index) => {
        const groupPanel = document.createElement('section');
        groupPanel.className = 'result-bracket-group';

        const groupTag = document.createElement('div');
        groupTag.className = 'result-bracket-group-tag';
        groupTag.textContent = `${t('results.card.groups', '分组情况')} ${index + 1}`;
        groupPanel.appendChild(groupTag);

        const groupMain = document.createElement('div');
        groupMain.className = 'result-bracket-group-main';

        const playersPanel = document.createElement('div');
        playersPanel.className = 'result-bracket-players';

        const createPlayerNode = (player, playerSlot) => {
            const status = resolveGroupPlayerStatus(group, playerSlot);
            const isBye = !player && playerSlot === 1;
            const playerNode = document.createElement('div');
            playerNode.className = `result-bracket-player is-${status}`;

            const avatarShell = document.createElement('div');
            avatarShell.className = 'result-bracket-player-avatar-shell';

            if (isBye) {
                const byeNode = document.createElement('div');
                byeNode.className = 'result-bracket-player-bye';
                byeNode.textContent = '?';
                avatarShell.appendChild(byeNode);
            } else {
                const avatar = document.createElement('img');
                avatar.className = 'result-bracket-player-avatar';
                avatar.alt = String(player?.name || t('results.card.unknown_player', '未知选手'));
                bindImageElementSource(avatar, player?.avatar || DEFAULT_AVATAR_PATH, { lazy: false });
                avatarShell.appendChild(avatar);
            }

            const nameNode = document.createElement('div');
            nameNode.className = 'result-bracket-player-name';
            nameNode.textContent = isBye
                ? t('results.card.bye', '轮空')
                : String(player?.name || t('results.card.unknown_player', '未知选手'));

            const totalNode = document.createElement('div');
            totalNode.className = 'result-bracket-player-total';
            const totalScore = Array.isArray(group?.totalScores) ? group.totalScores[playerSlot] : null;
            totalNode.textContent = `${t('results.total_completion', '总完成度')}: ${isBye ? '--.----' : formatTotalScoreValue(totalScore || 0)}`;

            playerNode.appendChild(avatarShell);
            playerNode.appendChild(nameNode);
            playerNode.appendChild(totalNode);
            return playerNode;
        };

        playersPanel.appendChild(createPlayerNode(group?.player1 || null, 0));
        playersPanel.appendChild(createPlayerNode(group?.player2 || null, 1));

        const songsPanel = document.createElement('div');
        songsPanel.className = 'result-bracket-songs';

        const groupSongs = Array.isArray(group?.songs) ? group.songs : [];
        if (groupSongs.length === 0) {
            const emptySongNode = document.createElement('div');
            emptySongNode.className = 'result-bracket-songs-empty';
            emptySongNode.textContent = t('results.song.empty', '本组暂无已记录歌曲');
            songsPanel.appendChild(emptySongNode);
        } else {
            groupSongs.forEach(songEntry => {
                const songRow = document.createElement('div');
                songRow.className = 'result-bracket-song-row';

                const cover = document.createElement('img');
                cover.className = 'result-bracket-song-cover';
                cover.alt = String(songEntry?.title || t('song.unknown_title', '未知曲目'));
                bindImageElementSource(cover, resolveSongCoverPath(songEntry) || getSongCoverFallbackDataUri(), { lazy: false });

                const songInfo = document.createElement('div');
                songInfo.className = 'result-bracket-song-info';

                const songTitle = document.createElement('div');
                songTitle.className = 'result-bracket-song-title';
                songTitle.textContent = String(songEntry?.title || t('song.unknown_title', '未知曲目'));

                const scoreLines = document.createElement('div');
                scoreLines.className = 'result-bracket-song-scores';
                const scoreMap = new Map();
                (Array.isArray(songEntry?.playerScores) ? songEntry.playerScores : []).forEach(item => {
                    const slot = parseInt(item?.playerSlot, 10);
                    if (!Number.isFinite(slot)) return;
                    scoreMap.set(slot, item);
                });

                const player1Name = String(group?.player1?.name || t('results.card.unknown_player', '未知选手'));
                const player2Name = group?.player2
                    ? String(group.player2.name || t('results.card.unknown_player', '未知选手'))
                    : t('results.card.bye', '轮空');

                const scoreLine1 = document.createElement('div');
                scoreLine1.className = 'result-bracket-song-score';
                scoreLine1.textContent = `${player1Name}: ${formatScoreLine(scoreMap.get(0)?.score)}`;

                const scoreLine2 = document.createElement('div');
                scoreLine2.className = 'result-bracket-song-score';
                scoreLine2.textContent = `${player2Name}: ${group?.player2 ? formatScoreLine(scoreMap.get(1)?.score) : '--.----'}`;

                scoreLines.appendChild(scoreLine1);
                scoreLines.appendChild(scoreLine2);

                songInfo.appendChild(songTitle);
                songInfo.appendChild(scoreLines);

                songRow.appendChild(cover);
                songRow.appendChild(songInfo);
                songsPanel.appendChild(songRow);
            });
        }

        groupMain.appendChild(playersPanel);
        groupMain.appendChild(songsPanel);
        groupPanel.appendChild(groupMain);
        bracketList.appendChild(groupPanel);
    });

    resultCard.appendChild(bracketList);
    resultsList.appendChild(resultCard);
}

function songBoxHasSelectedSong(songBox) {
    if (!(songBox instanceof HTMLElement)) return false;
    const musicId = (songBox.dataset.musicId || '').trim();
    return musicId.length > 0;
}

function isGroupFinalized(groupIndex) {
    const normalizedGroupIndex = parseInt(groupIndex, 10);
    if (!Number.isFinite(normalizedGroupIndex)) return false;

    const groupDiv = document.querySelectorAll('#matchGroups > div')[normalizedGroupIndex];
    if (!groupDiv) return false;
    if (groupDiv.dataset.groupFinished === 'true') return true;

    const endRecordingBtn = groupDiv.querySelector('.end-recording-btn');
    if (!endRecordingBtn) return false;
    return !!(endRecordingBtn.disabled || endRecordingBtn.dataset.state === 'finished');
}

function openSongSelectDialogFromSongBox(songBox) {
    if (!(songBox instanceof HTMLElement)) return;
    const groupIndex = parseInt(songBox.dataset.groupIndex, 10);
    if (isGroupFinalized(groupIndex)) {
        if (typeof customAlert !== 'undefined' && customAlert && typeof customAlert.toast === 'function') {
            customAlert.toast(
                t('common.tip', '提示'),
                t('match.group_finished', '该分组已结束录入，无法继续随机乐曲'),
                1200
            );
        } else if (typeof customAlert !== 'undefined' && customAlert && typeof customAlert.show === 'function') {
            customAlert.show(t('common.tip', '提示'), t('match.group_finished', '该分组已结束录入，无法继续随机乐曲'));
        }
        return;
    }

    window.currentSongBox = songBox;
    window.currentSongIndex = parseInt(songBox.dataset.songIndex, 10);
    window.currentGroupIndex = groupIndex;

    const songSelectDialog = document.getElementById('songSelectDialog');
    if (songSelectDialog) {
        songSelectDialog.classList.add('show');
    }
}

// 显示比赛分组
function displayMatchGroups(matchGroups) {
    const matchContainer = document.getElementById('matchContainer');
    const matchGroupsDiv = document.getElementById('matchGroups');
    const peopleToolContainer = document.getElementById('peopleToolContainer');
    const homePageContent = getHomePageContentElement();
    const meowBtn = document.getElementById('meowBtn');
    
    if (!matchContainer || !matchGroupsDiv) return;

    peopleToolManuallyHidden = false;
    document.body.classList.remove('people-tool-hidden');
    if (homePageContent) {
        homePageContent.style.display = '';
    }
    if (meowBtn) {
        meowBtn.style.display = 'none';
        meowBtn.style.opacity = '0';
        meowBtn.style.visibility = 'hidden';
        meowBtn.style.transform = 'scale(0.5)';
    }
    
    // 隐藏人员检录工具，以便能够滚动到页面顶部
    if (peopleToolContainer) {
        peopleToolContainer.style.display = 'none';
    }
    
    // 保存当前分组结果
    savedMatchGroups = matchGroups;

    if (currentMatchConfig && typeof currentMatchConfig.globalSync === 'boolean') {
        runtimeGlobalSyncEnabled = !!currentMatchConfig.globalSync;
    }
    updateGlobalSyncToggleButton();
    
    // 清空现有分组
    matchGroupsDiv.innerHTML = '';
    
    // 创建分组HTML
    matchGroups.forEach((group, index) => {
        // 获取歌曲数量
        const songCount = currentMatchConfig ? currentMatchConfig.songCount : 1;
        
        const groupDiv = document.createElement('div');
        groupDiv.className = 'match-group-card';
        groupDiv.dataset.groupIndex = String(index);
        groupDiv.dataset.groupFinished = 'false';
        groupDiv.dataset.groupResult = '';
        groupDiv.style.cssText = `
            display: flex;
            flex-wrap: wrap;
            align-items: stretch;
            gap: 20px;
            padding: 20px;
            background: var(--bg-secondary);
            border-radius: 12px;
            border: 1px solid var(--border-color);
            box-shadow: 0 4px 15px var(--shadow-color);
            width: 100%;
            min-width: 0;
        `;
        
        // 左侧：VS和两人的头像
        const leftSection = document.createElement('div');
        leftSection.className = 'match-group-left';
        leftSection.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 16px;
            padding: 12px;
            background: var(--bg-primary);
            border-radius: 8px;
            border: 1px solid var(--border-color);
            flex: 0 0 220px;
            min-width: 180px;
        `;
        
        // 玩家1头像
        const player1Avatar = createSmallAvatar(group.player1, 0);
        
        // VS/晋级状态
        const vsStatus = document.createElement('div');
        vsStatus.className = 'match-vs-status';

        const vsLabel = document.createElement('div');
        vsLabel.className = 'match-vs-label';
        vsLabel.textContent = 'VS';

        const vsArrow = document.createElement('div');
        vsArrow.className = 'match-vs-arrow';
        vsArrow.textContent = '';

        vsStatus.appendChild(vsLabel);
        vsStatus.appendChild(vsArrow);
        
        // 玩家2头像
        let player2Avatar = null;
        if (group.player2) {
            player2Avatar = createSmallAvatar(group.player2, 1);
        } else {
            // 轮空情况的头像
            const emptyAvatarContainer = document.createElement('div');
            emptyAvatarContainer.className = 'match-avatar-container match-avatar-empty-container';
            emptyAvatarContainer.style.cssText = `
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 5px;
            `;
            
            const emptyAvatar = document.createElement('div');
            emptyAvatar.className = 'match-avatar-empty';
            emptyAvatar.style.cssText = `
                width: 60px;
                height: 60px;
                border-radius: 50%;
                background: var(--bg-primary);
                border: 2px dashed var(--border-color);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
                color: var(--text-secondary);
            `;
            emptyAvatar.textContent = '?';
            
            const emptyName = document.createElement('div');
            emptyName.className = 'match-avatar-empty-name';
            emptyName.style.cssText = `
                font-size: 14px;
                font-weight: bold;
                color: var(--text-primary);
            `;
            emptyName.textContent = t('results.card.bye', '轮空');
            
            emptyAvatarContainer.appendChild(emptyAvatar);
            emptyAvatarContainer.appendChild(emptyName);
            
            player2Avatar = emptyAvatarContainer;
        }
        
        // 右侧：根据歌曲数显示对应数量的框框
        const rightSection = document.createElement('div');
        rightSection.className = 'match-group-right';
        rightSection.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 20px;
            padding: 15px;
            background: var(--bg-primary);
            border-radius: 8px;
            border: 1px solid var(--border-color);
            flex: 1 1 620px;
            min-width: 320px;
        `;
        
        // 添加歌曲框
        for (let i = 0; i < songCount; i++) {
            const songBox = document.createElement('div');
            songBox.className = 'song-box';
            songBox.style.cssText = `
                width: 100%;
                min-width: 0;
                min-height: 240px;
                height: 240px;
                background: var(--bg-secondary);
                border: 2px dashed var(--border-color);
                border-radius: 8px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 12px;
                text-align: center;
                font-size: 14px;
                font-weight: bold;
                color: var(--text-secondary);
                transition: all 0.3s ease;
                cursor: pointer;
                padding: 20px;
                box-sizing: border-box;
            `;
            songBox.textContent = t('match.song_slot.label', '歌曲 {index}', { index: i + 1 });
            songBox.dataset.songIndex = i;
            songBox.dataset.groupIndex = index;
            songBox.dataset.musicId = '';
            
            // 添加点击事件
            songBox.addEventListener('click', (e) => {
                // 如果点击的是输入框或其子元素，不触发歌曲选择
                if (e.target.tagName === 'INPUT' || e.target.closest('input')) {
                    return;
                }

                const activeSongBox = e.currentTarget instanceof HTMLElement
                    ? e.currentTarget
                    : songBox;

                // 有数据时单击不触发，改为双击触发
                if (songBoxHasSelectedSong(activeSongBox)) {
                    return;
                }

                openSongSelectDialogFromSongBox(activeSongBox);
            });

            songBox.addEventListener('dblclick', (e) => {
                if (e.target.tagName === 'INPUT' || e.target.closest('input')) {
                    return;
                }

                const activeSongBox = e.currentTarget instanceof HTMLElement
                    ? e.currentTarget
                    : songBox;

                // 仅当有数据时双击才重新打开随机页
                if (!songBoxHasSelectedSong(activeSongBox)) {
                    return;
                }

                openSongSelectDialogFromSongBox(activeSongBox);
            });
            
            rightSection.appendChild(songBox);
        }
        
        // 添加到分组
        leftSection.appendChild(player1Avatar);
        leftSection.appendChild(vsStatus);
        leftSection.appendChild(player2Avatar);
        groupDiv.appendChild(leftSection);
        groupDiv.appendChild(rightSection);
        
        // 添加到匹配容器
        matchGroupsDiv.appendChild(groupDiv);
    });
    
    // 显示匹配容器
    matchContainer.style.display = 'flex';
    
    // 重置可能影响滚动的样式
    matchContainer.style.position = 'static';
    matchContainer.style.zIndex = 'auto';
    
    // 确保页面可以正常滚动
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';
    
    // 找到实际的滚动容器：main-content元素
    const mainContent = document.getElementById('mainContent');
    const homePage = document.getElementById('homePage');
    
    // 确保main-content和page元素样式正确
    if (mainContent) {
        mainContent.style.overflow = 'auto';
        mainContent.style.height = 'auto';
        mainContent.style.minHeight = '100vh';
    }
    
    if (homePage) {
        homePage.style.overflow = 'visible';
    }
    
    // 强制滚动到顶部
    setTimeout(() => {
        // 先滚动main-content到顶部
        if (mainContent) {
            mainContent.scrollTop = 0;
        }
        // 再滚动window到顶部
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        // 确保matchContainer在视口中可见
        matchContainer.scrollIntoView({ 
            behavior: 'auto',
            block: 'start',
            inline: 'nearest'
        });
    }, 0);
}

// 创建小头像
function clearGroupAvatarResultState(groupDiv) {
    if (!(groupDiv instanceof HTMLElement)) return;
    const avatarContainers = groupDiv.querySelectorAll('.match-avatar-container');
    avatarContainers.forEach(container => {
        container.classList.remove('avatar-winner', 'avatar-loser', 'avatar-tie');
    });
}

function resetGroupVsStatus(groupDiv) {
    if (!(groupDiv instanceof HTMLElement)) return;
    const vsStatus = groupDiv.querySelector('.match-vs-status');
    if (!(vsStatus instanceof HTMLElement)) return;

    const vsLabel = vsStatus.querySelector('.match-vs-label');
    const vsArrow = vsStatus.querySelector('.match-vs-arrow');

    vsStatus.classList.remove('is-progress', 'is-tie');
    if (vsLabel) {
        vsLabel.textContent = t('results.card.vs', 'VS');
    }
    if (vsArrow) {
        vsArrow.textContent = '';
    }
}

function applyGroupVsStatus(groupDiv, resultCode) {
    if (!(groupDiv instanceof HTMLElement)) return;
    const vsStatus = groupDiv.querySelector('.match-vs-status');
    if (!(vsStatus instanceof HTMLElement)) return;

    const vsLabel = vsStatus.querySelector('.match-vs-label');
    const vsArrow = vsStatus.querySelector('.match-vs-arrow');
    if (!vsLabel || !vsArrow) return;

    resetGroupVsStatus(groupDiv);

    if (resultCode === 1) {
        vsStatus.classList.add('is-progress');
        vsLabel.textContent = t('match.group.status.promote', '晋级');
        vsArrow.textContent = '←';
        return;
    }

    if (resultCode === 2) {
        vsStatus.classList.add('is-progress');
        vsLabel.textContent = t('match.group.status.promote', '晋级');
        vsArrow.textContent = '→';
        return;
    }

    vsStatus.classList.add('is-tie');
    vsLabel.textContent = t('match.group.status.tie', '平局');
    vsArrow.textContent = '==';
}

function applyGroupAvatarResultState(groupDiv, resultCode) {
    if (!(groupDiv instanceof HTMLElement)) return;
    clearGroupAvatarResultState(groupDiv);

    const playerAvatars = Array.from(groupDiv.querySelectorAll('.match-avatar-container[data-player-slot]'));
    if (playerAvatars.length === 0) return;

    const avatarSlotMap = new Map();
    playerAvatars.forEach(container => {
        const slot = parseInt(container.dataset.playerSlot, 10);
        if (Number.isFinite(slot)) {
            avatarSlotMap.set(slot, container);
        }
    });

    if (resultCode === 1) {
        if (avatarSlotMap.has(0)) avatarSlotMap.get(0).classList.add('avatar-winner');
        if (avatarSlotMap.has(1)) avatarSlotMap.get(1).classList.add('avatar-loser');
        return;
    }

    if (resultCode === 2) {
        if (avatarSlotMap.has(0)) avatarSlotMap.get(0).classList.add('avatar-loser');
        if (avatarSlotMap.has(1)) avatarSlotMap.get(1).classList.add('avatar-winner');
        return;
    }

    avatarSlotMap.forEach(container => {
        container.classList.add('avatar-tie');
    });
}

function createSmallAvatar(player, playerSlot = null) {
    const avatarContainer = document.createElement('div');
    avatarContainer.className = 'match-avatar-container';
    if (Number.isFinite(parseInt(playerSlot, 10))) {
        avatarContainer.dataset.playerSlot = String(parseInt(playerSlot, 10));
    }
    avatarContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 5px;
    `;
    
    // 头像
    const avatar = document.createElement('img');
    avatar.className = 'match-avatar-image';
    bindImageElementSource(avatar, player.avatar || DEFAULT_AVATAR_PATH);
    avatar.alt = player.name;
    avatar.style.cssText = `
        width: 60px;
        height: 60px;
        border-radius: 50%;
        object-fit: cover;
        border: 2px solid var(--border-color);
        box-shadow: 0 2px 8px var(--shadow-color);
    `;
    
    // 姓名
    const name = document.createElement('div');
    name.className = 'match-avatar-name';
    name.style.cssText = `
        font-size: 14px;
        font-weight: bold;
        color: var(--text-primary);
        text-align: center;
        max-width: 80px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    `;
    name.textContent = player.name;
    
    // 添加到容器
    avatarContainer.appendChild(avatar);
    avatarContainer.appendChild(name);
    
    return avatarContainer;
}

// 创建玩家卡片
function createPlayerCard(player) {
    const card = document.createElement('div');
    card.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        padding: 20px;
        background: var(--bg-primary);
        border-radius: 12px;
        border: 1px solid var(--border-color);
        box-shadow: 0 4px 15px var(--shadow-color);
        width: 150px;
        min-height: 220px;
        transition: all 0.3s ease;
    `;
    
    // 头像
    const avatar = document.createElement('img');
    bindImageElementSource(avatar, player.avatar || DEFAULT_AVATAR_PATH);
    avatar.alt = player.name;
    avatar.style.cssText = `
        width: 100px;
        height: 100px;
        border-radius: 50%;
        object-fit: cover;
        border: 2px solid var(--border-color);
        box-shadow: 0 2px 8px var(--shadow-color);
    `;
    
    // 姓名
    const name = document.createElement('div');
    name.style.cssText = `
        font-size: 18px;
        font-weight: bold;
        color: var(--text-primary);
    `;
    name.textContent = player.name;
    
    // QQ号
    if (player.qq) {
        const qq = document.createElement('div');
        qq.style.cssText = `
            font-size: 14px;
            color: var(--text-secondary);
        `;
        qq.textContent = t('people.meta.qq', 'QQ: {value}', { value: player.qq });
        card.appendChild(qq);
    }
    
    // Rating
    if (player.rating) {
        const rating = document.createElement('div');
        rating.style.cssText = `
            font-size: 16px;
            font-weight: bold;
            color: var(--accent-color);
        `;
        rating.textContent = t('people.meta.rating', 'Rating: {value}', { value: player.rating });
        card.appendChild(rating);
    }
    
    // 添加到卡片
    card.appendChild(avatar);
    card.appendChild(name);
    
    return card;
}

// 隐藏人员检录工具
function hidePeopleTool() {
    peopleToolManuallyHidden = true;
    syncPeopleToolVisibilityState();
    
    // 滚动到页面顶部
    window.scrollTo(0, 0);
}

// 显示人员检录工具
function showPeopleTool() {
    const peopleToolContainer = document.getElementById('peopleToolContainer');
    
    peopleToolManuallyHidden = false;
    syncPeopleToolVisibilityState();
    
    // 滚动到页面顶部
    window.scrollTo(0, 0);
    
    // 确保人员名单在可视区域顶部
    setTimeout(() => {
        if (!peopleToolContainer) return;
        peopleToolContainer.scrollIntoView({ 
            behavior: 'auto', 
            block: 'start' 
        });
    }, 100);
}

// 刷新Character文件夹中的文件列表
async function refreshCharacterFiles() {
    try {
        const response = await fetch('/api/get-character-files');
        if (!response.ok) {
            throw createAppError('APP-CHARACTER-001', `读取Character文件列表失败，HTTP ${response.status}`);
        }

        const result = await response.json();
        if (!result || result.success !== true) {
            throw createAppError('APP-CHARACTER-002', `读取Character文件列表失败: ${result?.error || '响应标记为失败'}`);
        }

        if (!Array.isArray(result.files)) {
            throw createAppError('APP-CHARACTER-003', '读取Character文件列表失败: 返回格式不正确（files不是数组）');
        }

        // 更新文件选择器
        const fileSelect = document.getElementById('importPeopleFileSelect');
        if (fileSelect) {
            fileSelect.innerHTML = '';
            if (result.files.length === 0) {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = t('people.import.no_files', '暂无可导入文件');
                fileSelect.appendChild(option);
            } else {
                result.files.forEach(file => {
                    const option = document.createElement('option');
                    option.value = file.name;
                    option.textContent = file.name;
                    fileSelect.appendChild(option);
                });
            }
        }

        return result.files;
    } catch (error) {
        console.error('获取Character文件列表失败:', error);
        
        // 错误发生时，清空文件选择器
        const fileSelect = document.getElementById('importPeopleFileSelect');
        if (fileSelect) {
            fileSelect.innerHTML = '';
        }

        throw error.code ? error : createAppError('APP-CHARACTER-004', '读取Character文件列表失败', error);
    }
}

// 保存Character文件到服务器
async function saveCharacterFile(fileName, data) {
    try {
        const response = await fetch('/api/save-character-file', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                filename: fileName,
                content: data
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            customAlert.show(
                t('people.export.success_title', '导出成功'),
                t('people.export.success_message', '人员数据已成功导出为 {filename}.json', { filename: fileName })
            );
        } else {
            customAlert.show(
                t('people.export.failed_title', '导出失败'),
                t('people.export.failed_message', '无法导出人员数据: {error}', { error: result.error })
            );
        }
    } catch (error) {
        customAlert.show(
            t('people.export.failed_title', '导出失败'),
            t('common.network_error', '网络错误: {error}', { error: error.message })
        );
    }
}

// 显示歌曲信息弹窗并开始随机动画
function showSongInfoDialog(isRandom) {
    // 显示歌曲信息弹窗
    const songInfoDialog = document.getElementById('songInfoDialog');
    if (songInfoDialog) {
        songInfoDialog.classList.add('show');
        
        // 添加双击检测，防止误触
        let clickCount = 0;
        let clickTimer = null;
        
        // 移除之前可能添加的事件监听器
        if (songInfoDialog._doubleClickHandler) {
            songInfoDialog.removeEventListener('click', songInfoDialog._doubleClickHandler);
        }
        
        // 添加新的双击处理函数
        const doubleClickHandler = (e) => {
            // 只有点击弹窗背景（不是内容区域）时才处理
            if (e.target === songInfoDialog) {
                clickCount++;
                
                if (clickCount === 1) {
                    // 第一次点击，设置定时器
                    clickTimer = setTimeout(() => {
                        clickCount = 0;
                        clickTimer = null;
                    }, 300); // 300ms内双击有效
                } else if (clickCount === 2) {
                    // 双击，重新随机
                    clearTimeout(clickTimer);
                    clickCount = 0;
                    clickTimer = null;
                    
                    // 重新开始随机
                    showSongInfoDialog(isRandom);
                }
            }
        };
        
        // 保存处理函数引用以便后续移除
        songInfoDialog._doubleClickHandler = doubleClickHandler;
        songInfoDialog.addEventListener('click', doubleClickHandler);
    }
    
    // 显示随机动画，隐藏歌曲信息
    const songRandomAnimation = document.getElementById('songRandomAnimation');
    const songInfoContent = document.getElementById('songInfoContent');
    const songInfoAgain = document.getElementById('songInfoAgain');
    
    if (songRandomAnimation && songInfoContent) {
        songRandomAnimation.style.display = 'flex';
        songInfoContent.style.display = 'none';
        songInfoAgain.style.display = 'none';
    }
    
    // 开始随机动画
    let animationCount = 0;
    const maxAnimationCount = 50;
    const randomSongText = document.getElementById('randomSongText');
    
    // 获取用于动画的歌曲列表
    let animationSongs = isRandom ? songs : [];
    if (!isRandom && window.currentSpecificFile) {
        // 如果是指定文件模式，预先筛选歌曲用于动画
        fetch(`./MaiList/${window.currentSpecificFile}`)
            .then(response => {
                if (!response.ok) {
                    throw createAppError('APP-RANDOM-001', `预加载指定文件失败，HTTP ${response.status}`);
                }
                return response.text();
            })
            .then(fileContent => {
                const musicIds = fileContent.trim().split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
                if (musicIds.length > 0) {
                    animationSongs = songs.filter(song => {
                        const songId = parseInt(song.基础信息.MusicID);
                        return musicIds.includes(songId);
                    });
                }
            })
            .catch(error => {
                console.error('预加载指定文件歌曲列表失败:', error);
                randomSongText.textContent = t('random.specific_file_load_failed.inline', '指定文件读取失败');
            });
    }
    
    const animationInterval = setInterval(() => {
        animationCount++;
        
        // 随机显示一些歌曲名称
        if (animationSongs.length > 0) {
            const randomSongIndex = Math.floor(Math.random() * animationSongs.length);
            const randomSong = animationSongs[randomSongIndex];
            randomSongText.textContent = randomSong ? randomSong.基础信息.歌名 : t('random.animating', '随机中...');
        } else if (!isRandom) {
            randomSongText.textContent = t('random.loading_specific', '读取指定文件中...');
        } else {
            randomSongText.textContent = t('random.animating', '随机中...');
        }
        
        // 动画结束
        if (animationCount >= maxAnimationCount) {
            clearInterval(animationInterval);
            
            // 根据是否随机选择歌曲
            if (isRandom) {
                // 随机选择歌曲
                try {
                    const selectedSong = getRandomSong(window.currentRandomConfig);
                    displaySongInfo(selectedSong);
                } catch (error) {
                    customAlert.show(t('random.failed_title', '随机失败'), formatAppError(error));
                    if (songInfoDialog) {
                        songInfoDialog.classList.remove('show');
                    }
                }
            } else {
                // 从指定文件中随机选择歌曲
                getSpecificFileRandomSong(window.currentSpecificFile).then(selectedSong => {
                    displaySongInfo(selectedSong);
                }).catch(error => {
                    customAlert.show(t('random.failed_title', '随机失败'), formatAppError(error));
                    if (songInfoDialog) {
                        songInfoDialog.classList.remove('show');
                    }
                });
            }
        }
    }, 50);
}

// 根据配置随机选择歌曲
function getRandomSong(config) {
    if (!Array.isArray(songs) || songs.length === 0) {
        throw createAppError('APP-RANDOM-002', '曲库为空，无法随机歌曲');
    }

    if (!config || typeof config !== 'object') {
        throw createAppError('APP-RANDOM-003', '随机配置无效');
    }

    // 过滤符合条件的歌曲
    let filteredSongs = [...songs];
    
    // 按等级过滤
    if (config.level !== 'all') {
        filteredSongs = filteredSongs.filter(song => {
            const levels = song.基础信息.等级;
            return levels.includes(config.level);
        });
    }
    
    // 按流派过滤
    if (config.genre !== 'all') {
        filteredSongs = filteredSongs.filter(song => {
            return song.基础信息.流派 === config.genre;
        });
    }
    
    // 随机选择一首歌曲
    if (filteredSongs.length === 0) {
        throw createAppError('APP-RANDOM-004', '没有符合当前随机条件的歌曲');
    }
    
    return filteredSongs[Math.floor(Math.random() * filteredSongs.length)];
}

// 从指定文件中随机选择歌曲
async function getSpecificFileRandomSong(fileName) {
    if (!fileName) {
        throw createAppError('APP-RANDOM-005', '未选择指定文件');
    }

    if (!Array.isArray(songs) || songs.length === 0) {
        throw createAppError('APP-RANDOM-006', '曲库为空，无法按指定文件随机');
    }

    // 显式选择“全部歌曲”时，直接从真实曲库随机
    if (fileName === 'all') {
        return songs[Math.floor(Math.random() * songs.length)];
    }

    // 读取指定文件内容
    const response = await fetch(`./MaiList/${fileName}`);
    if (!response.ok) {
        throw createAppError('APP-RANDOM-007', `无法读取指定文件 ${fileName}，HTTP ${response.status}`);
    }

    const fileContent = await response.text();

    // 解析文件内容，提取MusicID列表
    const musicIds = fileContent.trim().split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    if (musicIds.length === 0) {
        throw createAppError('APP-RANDOM-008', `文件 ${fileName} 中没有有效的 MusicID`);
    }

    // 根据MusicID筛选歌曲
    const filteredSongs = songs.filter(song => {
        const songId = parseInt(song.基础信息.MusicID);
        return musicIds.includes(songId);
    });

    if (filteredSongs.length === 0) {
        throw createAppError('APP-RANDOM-009', `文件 ${fileName} 中的 MusicID 在当前曲库中均未匹配到歌曲`);
    }

    // 从筛选后的歌曲中随机选择一首
    return filteredSongs[Math.floor(Math.random() * filteredSongs.length)];
}

function resolveTargetSongBoxes(currentSongBox, currentSongIndex) {
    const activeSongBox = currentSongBox instanceof HTMLElement
        ? currentSongBox.closest('.song-box')
        : null;
    if (!activeSongBox) return [];

    if (!isGlobalSyncEnabled() || !Number.isFinite(currentSongIndex)) {
        return [activeSongBox];
    }

    const selector = `#matchGroups .song-box[data-song-index="${currentSongIndex}"]`;
    const syncedSongBoxes = Array.from(document.querySelectorAll(selector))
        .filter(songBox => {
            const groupIndex = parseInt(songBox.dataset.groupIndex, 10);
            return !isGroupFinalized(groupIndex);
        });
    if (syncedSongBoxes.length === 0) {
        return [activeSongBox];
    }

    return syncedSongBoxes;
}

function renderSongSelectionInSongBox(songBox, selectedSong) {
    if (!songBox || !selectedSong || !selectedSong.基础信息) return;

    const songInfo = selectedSong.基础信息;
    const songNameValue = typeof songInfo.歌名 === 'string' ? songInfo.歌名.trim() : '';
    const bilibiliSearchUrl = buildSongSearchUrl(songNameValue);
    const bpmValue = songInfo.bpm || t('song.undefined_value', '未定义');
    songBox.style.cssText = `
        width: 100%;
        min-width: 0;
        min-height: 250px;
        height: auto;
        background: var(--bg-secondary);
        border: 2px solid var(--accent-color);
        border-radius: 8px;
        display: flex;
        flex-direction: row;
        align-items: stretch;
        justify-content: flex-start;
        gap: 16px;
        font-size: 14px;
        font-weight: bold;
        color: var(--text-secondary);
        transition: all 0.3s ease;
        cursor: pointer;
        overflow: visible;
        padding: 20px;
        box-sizing: border-box;
    `;

    songBox.innerHTML = '';

    const leftPanel = document.createElement('div');
    leftPanel.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        gap: 10px;
        width: 210px;
        min-width: 190px;
        flex-shrink: 0;
        padding: 6px;
        border-radius: 8px;
        background: var(--bg-primary);
        border: 1px solid var(--border-color);
    `;

    const songCoverImg = document.createElement('img');
    if (songInfo.image_url) {
        bindImageElementSource(songCoverImg, `./MaiSongLib/${songInfo.image_url}`);
    } else {
        bindImageElementSource(songCoverImg, '');
    }
    songCoverImg.style.cssText = `
        width: 160px;
        height: 160px;
        border-radius: 8px;
        object-fit: cover;
        flex-shrink: 0;
    `;
    leftPanel.appendChild(songCoverImg);

    const songBpm = document.createElement('div');
    songBpm.textContent = t('song.meta.bpm', 'BPM: {value}', { value: bpmValue });
    songBpm.style.cssText = `
        font-size: 15px;
        color: var(--text-primary);
        padding: 6px 10px;
        border-radius: 6px;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        width: 100%;
        text-align: center;
    `;
    leftPanel.appendChild(songBpm);

    const songInfoContainer = document.createElement('div');
    songInfoContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        flex: 1;
        min-width: 0;
        overflow: hidden;
        padding: 6px 4px;
        text-align: center;
    `;

    const songName = document.createElement('div');
    songName.textContent = songNameValue || t('song.unknown_title', '未知曲目');
    songName.style.cssText = `
        font-size: 24px;
        font-weight: bold;
        color: var(--text-primary);
        white-space: normal;
        word-break: break-word;
        line-height: 1.28;
    `;

    const songMusicId = document.createElement('div');
    songMusicId.textContent = t('song.meta.id', 'ID: {value}', { value: songInfo.MusicID });
    songMusicId.style.cssText = `
        font-size: 16px;
        color: var(--text-secondary);
        margin-top: 8px;
    `;

    const textBlock = document.createElement('div');
    textBlock.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-width: 0;
        text-align: center;
    `;
    textBlock.appendChild(songName);
    textBlock.appendChild(songMusicId);
    songInfoContainer.appendChild(textBlock);

    const qrBlock = document.createElement('div');
    qrBlock.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        align-self: center;
        width: 122px;
        min-width: 118px;
        flex-shrink: 0;
    `;

    const qrImage = document.createElement('img');
    qrImage.alt = t('song.qr.alt', 'B站搜索二维码: {song}', {
        song: songNameValue || t('song.unknown_title', '未知曲目')
    });
    qrImage.style.cssText = `
        width: 110px;
        height: 110px;
        border-radius: 8px;
        border: 1px solid var(--border-color);
        background: #fff;
        padding: 4px;
        object-fit: contain;
        flex-shrink: 0;
    `;
    renderLocalSongSearchQr(qrImage, bilibiliSearchUrl, songNameValue);
    qrBlock.appendChild(qrImage);

    songBox.appendChild(leftPanel);
    songBox.appendChild(songInfoContainer);
    songBox.appendChild(qrBlock);
    songBox.dataset.musicId = String(songInfo.MusicID ?? '');
    songBox.dataset.songTitle = songNameValue;
    songBox.dataset.searchUrl = bilibiliSearchUrl;
}

function applySelectedSongToTargetBoxes(selectedSong) {
    const currentSongIndex = parseInt(window.currentSongIndex, 10);
    const targetSongBoxes = resolveTargetSongBoxes(window.currentSongBox, currentSongIndex);
    if (targetSongBoxes.length === 0) return;

    const affectedSongTargets = new Map();
    targetSongBoxes.forEach(songBox => {
        renderSongSelectionInSongBox(songBox, selectedSong);
        const groupIndex = parseInt(songBox.dataset.groupIndex, 10);
        const songIndex = parseInt(songBox.dataset.songIndex, 10);
        if (Number.isFinite(groupIndex) && Number.isFinite(songIndex)) {
            if (!affectedSongTargets.has(groupIndex)) {
                affectedSongTargets.set(groupIndex, new Set());
            }
            affectedSongTargets.get(groupIndex).add(songIndex);
        }
    });

    affectedSongTargets.forEach((songIndexSet, groupIndex) => {
        songIndexSet.forEach(songIndex => {
            addScoreInputArea(groupIndex, songIndex);
        });
        updateTotalScoreDisplay(groupIndex);
    });
}

// 显示歌曲信息
function displaySongInfo(song) {
    // 保存当前选中的歌曲
    window.currentSelectedSong = song;
    
    // 隐藏随机动画，显示歌曲信息
    const songRandomAnimation = document.getElementById('songRandomAnimation');
    const songInfoContent = document.getElementById('songInfoContent');
    const songInfoAgain = document.getElementById('songInfoAgain');
    
    if (songRandomAnimation && songInfoContent) {
        songRandomAnimation.style.display = 'none';
        songInfoContent.style.display = 'block';
        songInfoAgain.style.display = 'inline-block';
    }
    
    // 填充歌曲信息
    const songCover = document.getElementById('songCover');
    const songTitle = document.getElementById('songTitle');
    const songArtist = document.getElementById('songArtist');
    const songBpm = document.getElementById('songBpm');
    const songGenre = document.getElementById('songGenre');
    const songType = document.getElementById('songType');
    const songDifficulties = document.getElementById('songDifficulties');
    
    if (songCover && song) {
        // 检查song.基础信息.image_url是否存在
        if (song.基础信息 && song.基础信息.image_url) {
            const imageUrl = `./MaiSongLib/${song.基础信息.image_url}`;
            bindImageElementSource(songCover, imageUrl);
            
            // 添加错误处理，防止图片加载失败
            songCover.onerror = function() {
                console.error(`无法加载图片: ${imageUrl}`);
                // 使用默认图片或隐藏图片
                // songCover.src = './Data/人类.png'; // 可以使用默认图片
            };
        } else {
            // 如果没有图片URL，清空或使用默认图片
            bindImageElementSource(songCover, '');
        }
        
        // 添加歌曲类型标签（标准/DX）到曲绘右上角
        const songCoverParent = songCover.parentElement;
        if (songCoverParent) {
            // 移除现有的类型标签
            const existingTypeTag = songCoverParent.querySelector('.song-type-tag');
            if (existingTypeTag) {
                existingTypeTag.remove();
            }
            
            // 确保父元素有position: relative定位
            songCoverParent.style.position = 'relative';
            
            // 创建新的类型标签
            const songTypeTag = document.createElement('div');
            songTypeTag.className = 'song-type-tag';
            
            // 设置标签内容和样式
            const songType = song.基础信息.type || t('song.type.standard', '标准');
            if (songType === 'DX') {
                songTypeTag.textContent = 'DX';
                songTypeTag.style.cssText = `
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    font-weight: 700;
                    color: white;
                    z-index: 10;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
                    border: 2px solid white;
                    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
                    background-color: #ffca00; /* DX类型 - 黄色 */
                `;
            } else {
                songTypeTag.textContent = t('song.type.standard', '标准');
                songTypeTag.style.cssText = `
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    font-weight: 700;
                    color: white;
                    z-index: 10;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
                    border: 2px solid white;
                    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
                    background-color: #34a5ff; /* 标准类型 - 蓝色 */
                `;
            }
            
            // 添加到父元素
            songCoverParent.appendChild(songTypeTag);
        }
    }
    
    if (songTitle && song) {
        songTitle.textContent = song.基础信息.歌名;
    }
    
    if (songArtist && song) {
        songArtist.textContent = t('song.meta.artist', '艺术家: {value}', { value: song.基础信息.artist });
    }
    
    if (songBpm && song) {
        songBpm.textContent = t('song.meta.bpm', 'BPM: {value}', { value: song.基础信息.bpm });
    }
    
    if (songGenre && song) {
        songGenre.textContent = t('song.meta.genre', '流派: {value}', { value: song.基础信息.流派 });
    }
    
    if (songType && song) {
        songType.textContent = t('song.meta.version', '版本: {value}', {
            value: song.基础信息.版本 || 'maimai'
        });
    }
    
    // 显示难度信息
    if (songDifficulties && song) {
        songDifficulties.innerHTML = '';
        
        const difficulties = song.基础信息.等级;
        const ratings = song.基础信息.定数;
        
        // 颜色根据显示顺序决定：绿 黄 红 紫 白紫
        const colors = [
            '#4CAF50',         // 绿色
            '#FFC107',         // 黄色
            '#FF5722',         // 红色
            '#9C27B0',         // 紫色
            'rgb(255, 217, 253)' // 白紫色
        ];
        
        // 确保difficulties和ratings长度一致
        const maxLength = Math.min(difficulties.length, ratings.length, colors.length);
        
        // 遍历每个难度，根据显示顺序分配颜色
        for (let i = 0; i < maxLength; i++) {
            const diff = difficulties[i];
            const rating = ratings[i];
            const color = colors[i]; // 根据索引取颜色，索引0是绿色，1是黄色，依此类推
            
            const difficultyDiv = document.createElement('div');
            difficultyDiv.style.cssText = `
                display: inline-block;
                padding: 5px 10px;
                margin-right: 5px;
                background: var(--bg-secondary);
                border: 1px solid var(--border-color);
                border-radius: 4px;
                font-size: 14px;
                font-weight: bold;
            `;
            
            difficultyDiv.style.color = color;
            difficultyDiv.textContent = `${diff} (${rating})`;
            songDifficulties.appendChild(difficultyDiv);
        }
    }
    
    // 为再次随机按钮添加事件
    const songInfoAgainBtn = document.getElementById('songInfoAgain');
    if (songInfoAgainBtn) {
        if (songInfoAgainBtn._againHandler) {
            songInfoAgainBtn.removeEventListener('click', songInfoAgainBtn._againHandler);
        }
        const againHandler = () => {
            // 根据当前模式重新开始随机
            const isRandom = window.currentRandomConfig ? true : false;
            showSongInfoDialog(isRandom);
        };
        songInfoAgainBtn._againHandler = againHandler;
        songInfoAgainBtn.addEventListener('click', againHandler);
    }
    
    // 为确认按钮添加事件
    const songInfoConfirmBtn = document.getElementById('songInfoConfirm');
    if (songInfoConfirmBtn) {
        if (songInfoConfirmBtn._confirmHandler) {
            songInfoConfirmBtn.removeEventListener('click', songInfoConfirmBtn._confirmHandler);
        }
        const confirmHandler = () => {
            // 关闭弹窗
            const songInfoDialog = document.getElementById('songInfoDialog');
            if (songInfoDialog) {
                songInfoDialog.classList.remove('show');
            }
            
            // 更新歌曲框显示
            if (window.currentSongBox && window.currentSelectedSong) {
                applySelectedSongToTargetBoxes(window.currentSelectedSong);
            }
        };
        songInfoConfirmBtn._confirmHandler = confirmHandler;
        songInfoConfirmBtn.addEventListener('click', confirmHandler);
    }
}

// 添加成绩输入区域
function addScoreInputArea(groupIndex = window.currentGroupIndex, songIndex = null) {
    const targetGroupIndex = parseInt(groupIndex, 10);
    if (!Number.isFinite(targetGroupIndex) || !Array.isArray(savedMatchGroups)) return;
    const targetSongIndex = Number.isFinite(parseInt(songIndex, 10))
        ? parseInt(songIndex, 10)
        : null;

    // 获取当前分组
    const groupDiv = document.querySelectorAll('#matchGroups > div')[targetGroupIndex];
    if (!groupDiv) return;
    
    // 获取当前分组的玩家
    const group = savedMatchGroups[targetGroupIndex];
    if (!group) return;
    const players = [group.player1, group.player2];
    
    // 为目标歌曲创建成绩输入区域
    let songBoxes = Array.from(groupDiv.querySelectorAll('.song-box'));
    if (Number.isFinite(targetSongIndex)) {
        songBoxes = songBoxes.filter(songBox => parseInt(songBox.dataset.songIndex, 10) === targetSongIndex);
    }

    songBoxes.forEach(songBox => {
        if (!songBoxHasSelectedSong(songBox)) {
            return;
        }

        const currentSongIndex = Number.isFinite(parseInt(songBox.dataset.songIndex, 10))
            ? parseInt(songBox.dataset.songIndex, 10)
            : targetSongIndex;

        const applyScoreAreaLayout = (scoreArea) => {
            if (!(scoreArea instanceof HTMLElement)) return;
            scoreArea.style.cssText = `
                display: flex;
                flex-direction: column;
                justify-content: center;
                gap: 10px;
                margin-left: auto;
                align-self: stretch;
                min-width: 200px;
                max-width: 240px;
                padding: 10px;
                background: var(--bg-primary);
                border-radius: 8px;
                border: 1px solid var(--border-color);
                box-sizing: border-box;
            `;
        };

        // 检查是否已存在成绩输入区域
        let songScoreArea = songBox.querySelector('.song-score-area');
        if (songScoreArea) {
            applyScoreAreaLayout(songScoreArea);
            if (songScoreArea.parentElement !== songBox) {
                songBox.appendChild(songScoreArea);
            }
            if (songScoreArea.querySelector('.song-score-lock-btn')) {
                return;
            }
            songScoreArea.remove();
            songScoreArea = null;
        }

        if (!songScoreArea) {
            songScoreArea = document.createElement('div');
        }
        songScoreArea.className = 'song-score-area';
        songScoreArea.dataset.locked = 'false';
        applyScoreAreaLayout(songScoreArea);
        songScoreArea.addEventListener('click', (event) => {
            event.stopPropagation();
        });
        songScoreArea.addEventListener('dblclick', (event) => {
            event.stopPropagation();
        });
        
        // 为每个玩家创建成绩输入
        players.forEach((player, playerIndex) => {
            if (!player) return;
            
            const playerScoreInput = document.createElement('div');
            playerScoreInput.style.cssText = `
                display: flex;
                flex-direction: column;
                align-items: stretch;
                gap: 5px;
                width: 100%;
            `;
            
            // 玩家名称
            const playerName = document.createElement('div');
            playerName.style.cssText = `
                font-size: 12px;
                font-weight: bold;
                color: var(--text-primary);
                text-align: center;
            `;
            playerName.textContent = player.name;
            
            // 成绩输入框
            const scoreInput = document.createElement('input');
            scoreInput.type = 'number';
            scoreInput.min = '0';
            scoreInput.max = '101';
            scoreInput.step = '0.0001';
            scoreInput.placeholder = '0.0000';
            scoreInput.inputMode = 'decimal';
            scoreInput.style.cssText = `
                width: 100%;
                padding: 8px;
                font-size: 14px;
                text-align: center;
                background: var(--bg-secondary);
                color: var(--text-primary);
                border: 1px solid var(--border-color);
                border-radius: 6px;
                outline: none;
                transition: all 0.2s ease;
            `;
            scoreInput.addEventListener('focus', () => {
                if (songScoreArea.dataset.locked === 'true') return;
                scoreInput.style.borderColor = getThemeCssVar('--accent-color', '#34a5ff');
                scoreInput.style.boxShadow = `0 0 0 2px rgba(52, 165, 255, 0.25)`;
            });
            scoreInput.addEventListener('blur', () => {
                normalizeScoreInputValue(scoreInput, { fillEmptyAsZero: false });
                scoreInput.style.borderColor = getThemeCssVar('--border-color', '#d0d0d0');
                scoreInput.style.boxShadow = 'none';
                updateTotalScoreDisplay(targetGroupIndex);
            });
            scoreInput.addEventListener('input', () => {
                const rawValue = String(scoreInput.value ?? '').trim();
                const numericValue = Number(rawValue);
                const isValid = rawValue === '' || (Number.isFinite(numericValue) && numericValue >= 0 && numericValue <= 101);
                scoreInput.style.borderColor = isValid
                    ? getThemeCssVar('--border-color', '#d0d0d0')
                    : '#ff6b6b';
                updateTotalScoreDisplay(targetGroupIndex);
            });
            
            // 保存分数
            scoreInput.dataset.playerIndex = playerIndex;
            scoreInput.dataset.songIndex = Number.isFinite(currentSongIndex) ? currentSongIndex : 0;
            
            playerScoreInput.appendChild(playerName);
            playerScoreInput.appendChild(scoreInput);
            songScoreArea.appendChild(playerScoreInput);
        });

        const lockButton = document.createElement('button');
        lockButton.type = 'button';
        lockButton.className = 'song-score-lock-btn';
        lockButton.style.cssText = `
            width: 100%;
            margin-top: 2px;
            padding: 8px 10px;
            font-size: 13px;
            font-weight: 700;
            color: #ffffff;
            background: var(--accent-color);
            border: none;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s ease;
        `;

        const applyLockState = (locked) => {
            const isLocked = !!locked;
            songScoreArea.dataset.locked = isLocked ? 'true' : 'false';
            lockButton.textContent = isLocked
                ? t('match.score.locked_dblclick', '已锁定（双击解锁）')
                : t('match.score.lock', '锁定成绩');
            lockButton.style.background = isLocked ? '#4CAF50' : getThemeCssVar('--accent-color', '#34a5ff');
            const scoreInputs = songScoreArea.querySelectorAll('input');
            scoreInputs.forEach(input => {
                input.readOnly = isLocked;
                input.style.opacity = isLocked ? '0.85' : '1';
                input.style.cursor = isLocked ? 'not-allowed' : 'text';
                input.style.borderColor = getThemeCssVar('--border-color', '#d0d0d0');
                input.style.boxShadow = 'none';
            });
        };

        lockButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (groupDiv.dataset.groupFinished === 'true') return;
            if (songScoreArea.dataset.locked === 'true') return;

            const scoreInputs = songScoreArea.querySelectorAll('input');
            scoreInputs.forEach(input => {
                normalizeScoreInputValue(input, { fillEmptyAsZero: true });
            });

            applyLockState(true);
            updateTotalScoreDisplay(targetGroupIndex);
        });

        lockButton.addEventListener('dblclick', (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (groupDiv.dataset.groupFinished === 'true') return;
            if (songScoreArea.dataset.locked !== 'true') return;
            applyLockState(false);
            updateTotalScoreDisplay(targetGroupIndex);
        });

        applyLockState(false);
        songScoreArea.appendChild(lockButton);
        
        songBox.appendChild(songScoreArea);
    });
    
    // 添加总成绩对比和结束录入按钮
    addTotalScoreAndEndButton(groupDiv, targetGroupIndex);
}

// 添加总成绩对比和结束录入按钮
function addTotalScoreAndEndButton(groupDiv, groupIndex) {
    // 检查是否已存在总成绩区域
    let totalScoreArea = groupDiv.querySelector('.total-score-area');
    if (totalScoreArea) {
        updateTotalScoreDisplay(groupIndex);
        return;
    }
    
    // 创建总成绩区域
    totalScoreArea = document.createElement('div');
    totalScoreArea.className = 'total-score-area';
    totalScoreArea.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 15px;
        margin-top: 20px;
        padding: 20px;
        background: var(--bg-primary);
        border-radius: 12px;
        border: 1px solid var(--border-color);
    `;
    
    // 总成绩标题
    const totalScoreTitle = document.createElement('div');
    totalScoreTitle.style.cssText = `
        font-size: 16px;
        font-weight: bold;
        color: var(--text-primary);
        margin-bottom: 10px;
    `;
    totalScoreTitle.textContent = t('match.total_score.title', '总成绩对比');
    totalScoreArea.appendChild(totalScoreTitle);
    
    // 总成绩显示
    const totalScoreDisplay = document.createElement('div');
    totalScoreDisplay.className = 'total-score-display';
    totalScoreDisplay.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: stretch;
        justify-content: center;
        gap: 12px;
        width: 100%;
        max-width: 420px;
        font-size: 24px;
        font-weight: bold;
    `;
    
    // 获取当前分组的玩家
    const group = savedMatchGroups[groupIndex];
    const players = [group.player1, group.player2];
    
    // 为每个玩家创建总成绩显示
    players.forEach((player, playerIndex) => {
        if (!player) return;
        
        const playerTotalScore = document.createElement('div');
        playerTotalScore.className = `player-total-score player-${playerIndex}-total`;
        playerTotalScore.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            width: 100%;
            padding: 10px 14px;
            border-radius: 8px;
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            color: var(--text-primary);
        `;
        
        // 玩家名称
        const playerName = document.createElement('div');
        playerName.style.cssText = `
            font-size: 15px;
            font-weight: 600;
            text-align: left;
        `;
        playerName.textContent = player.name;
        
        // 总成绩数值
        const totalScoreValue = document.createElement('div');
        totalScoreValue.className = 'total-score-value';
        totalScoreValue.textContent = '0.0000';
        totalScoreValue.style.cssText = `
            font-size: 26px;
            line-height: 1;
            min-width: 0;
            max-width: 220px;
            text-align: right;
            white-space: nowrap;
            overflow: hidden;
        `;
        
        playerTotalScore.appendChild(playerName);
        playerTotalScore.appendChild(totalScoreValue);
        totalScoreDisplay.appendChild(playerTotalScore);
    });
    
    totalScoreArea.appendChild(totalScoreDisplay);
    
    // 结束录入按钮
    const endRecordingBtn = document.createElement('button');
    endRecordingBtn.className = 'end-recording-btn';
    endRecordingBtn.style.cssText = `
        padding: 12px 30px;
        font-size: 16px;
        font-weight: bold;
        color: white;
        background: var(--accent-color);
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 4px 15px var(--shadow-color);
    `;
    endRecordingBtn.textContent = t('match.end_recording', '结束录入');
    endRecordingBtn.dataset.state = 'active';

    const applyDefaultEndButtonStyle = () => {
        const accentColor = getThemeCssVar('--accent-color', '#34a5ff');
        const shadowColor = getThemeCssVar('--shadow-color', 'rgba(0, 0, 0, 0.2)');
        endRecordingBtn.style.background = accentColor;
        endRecordingBtn.style.filter = 'none';
        endRecordingBtn.style.transform = 'translateY(0)';
        endRecordingBtn.style.boxShadow = `0 4px 15px ${shadowColor}`;
    };

    applyDefaultEndButtonStyle();

    endRecordingBtn.addEventListener('mouseenter', () => {
        if (endRecordingBtn.disabled) return;
        endRecordingBtn.style.background = getThemeCssVar('--accent-color', '#34a5ff');
        endRecordingBtn.style.filter = 'brightness(1.08)';
        endRecordingBtn.style.transform = 'translateY(-2px)';
        const shadowColor = getThemeCssVar('--shadow-color', 'rgba(0, 0, 0, 0.2)');
        endRecordingBtn.style.boxShadow = `0 6px 20px ${shadowColor}`;
    });
    endRecordingBtn.addEventListener('mouseleave', () => {
        if (endRecordingBtn.disabled) return;
        applyDefaultEndButtonStyle();
    });
    endRecordingBtn.addEventListener('click', () => {
        calculateFinalResult(groupIndex);
    });
    
    totalScoreArea.appendChild(endRecordingBtn);
    
    // 添加到分组
    groupDiv.appendChild(totalScoreArea);
    updateTotalScoreDisplay(groupIndex);
}

function collectLockedTotalScores(groupDiv) {
    const totalScores = [0, 0];
    if (!(groupDiv instanceof HTMLElement)) {
        return totalScores;
    }

    const lockedScoreAreas = groupDiv.querySelectorAll('.song-score-area[data-locked="true"]');
    lockedScoreAreas.forEach(scoreArea => {
        const scoreInputs = scoreArea.querySelectorAll('input[data-player-index]');
        scoreInputs.forEach(input => {
            const playerIndex = parseInt(input.dataset.playerIndex, 10);
            if (!Number.isFinite(playerIndex) || playerIndex < 0 || playerIndex > 1) return;

            const rawValue = String(input.value ?? '').trim();
            if (!rawValue) return;

            const numericValue = Number(rawValue);
            if (!Number.isFinite(numericValue)) return;

            const normalizedScore = Math.min(101, Math.max(0, numericValue));
            totalScores[playerIndex] += normalizedScore;
        });
    });

    totalScores[0] = roundToFourDecimals(totalScores[0]);
    totalScores[1] = roundToFourDecimals(totalScores[1]);
    return totalScores;
}

// 更新总成绩显示
function updateTotalScoreDisplay(groupIndex) {
    const groupDiv = document.querySelectorAll('#matchGroups > div')[groupIndex];
    if (!groupDiv) return;

    const totalScores = collectLockedTotalScores(groupDiv);
    
    // 更新显示
    const totalScoreValues = groupDiv.querySelectorAll('.total-score-value');
    totalScoreValues.forEach((valueElement, playerIndex) => {
        valueElement.textContent = formatTotalScoreValue(totalScores[playerIndex] || 0);
        fitTextInContainer(valueElement, 12, 26);
    });
}

// 计算最终结果
function calculateFinalResult(groupIndex) {
    const groupDiv = document.querySelectorAll('#matchGroups > div')[groupIndex];
    if (!groupDiv) return;
    if (groupDiv.dataset.groupFinished === 'true') return;

    const totalScores = collectLockedTotalScores(groupDiv);
    updateTotalScoreDisplay(groupIndex);
    
    // 获取玩家元素
    const playerTotalScores = groupDiv.querySelectorAll('.player-total-score');
    
    // 判断结果并添加颜色
    let resultCode = 0;
    if (playerTotalScores.length >= 2) {
        if (totalScores[0] > totalScores[1]) {
            resultCode = 1;
            playerTotalScores[0].style.color = '#FFD700';
            playerTotalScores[1].style.color = '#FF6B6B';
        } else if (totalScores[0] < totalScores[1]) {
            resultCode = 2;
            playerTotalScores[0].style.color = '#FF6B6B';
            playerTotalScores[1].style.color = '#FFD700';
        } else {
            resultCode = 0;
            playerTotalScores[0].style.color = '#4ECDC4';
            playerTotalScores[1].style.color = '#4ECDC4';
        }
    } else if (playerTotalScores.length === 1) {
        resultCode = 1;
        playerTotalScores[0].style.color = '#FFD700';
    }

    applyGroupAvatarResultState(groupDiv, resultCode);
    applyGroupVsStatus(groupDiv, resultCode);
    groupDiv.dataset.groupResult = String(resultCode);
    
    // 禁用所有成绩输入框
    const allScoreInputs = groupDiv.querySelectorAll('.song-score-area input');
    allScoreInputs.forEach(input => {
        normalizeScoreInputValue(input, { fillEmptyAsZero: false });
        input.readOnly = true;
        input.disabled = true;
        input.style.opacity = '0.7';
        input.style.cursor = 'not-allowed';
        input.style.boxShadow = 'none';
        input.style.borderColor = getThemeCssVar('--border-color', '#d0d0d0');
    });

    // 禁用分曲锁定按钮
    const allLockButtons = groupDiv.querySelectorAll('.song-score-lock-btn');
    allLockButtons.forEach(lockButton => {
        lockButton.disabled = true;
        lockButton.style.opacity = '0.7';
        lockButton.style.cursor = 'not-allowed';
    });
    
    // 禁用结束录入按钮
    const endRecordingBtn = groupDiv.querySelector('.end-recording-btn');
    if (endRecordingBtn) {
        endRecordingBtn.disabled = true;
        endRecordingBtn.style.opacity = '0.7';
        endRecordingBtn.style.cursor = 'not-allowed';
        endRecordingBtn.style.filter = 'none';
        endRecordingBtn.style.transform = 'translateY(0)';
        endRecordingBtn.style.background = getThemeCssVar('--accent-color', '#34a5ff');
        endRecordingBtn.style.boxShadow = `0 4px 15px ${getThemeCssVar('--shadow-color', 'rgba(0, 0, 0, 0.2)')}`;
        endRecordingBtn.textContent = t('match.finished', '已结束');
        endRecordingBtn.dataset.state = 'finished';
    }
    groupDiv.dataset.groupFinished = 'true';

    // 回写到当前分组，供结束比赛导出使用。
    if (Array.isArray(savedMatchGroups) && savedMatchGroups[groupIndex]) {
        savedMatchGroups[groupIndex].result = resultCode;
        savedMatchGroups[groupIndex].totalScores = [
            roundToFourDecimals(totalScores[0]),
            roundToFourDecimals(totalScores[1])
        ];
    }
    
    // 显示结果提示
    if (typeof customAlert !== 'undefined' && customAlert && typeof customAlert.toast === 'function') {
        customAlert.toast(t('common.tip', '提示'), t('match.result_calculated', '比赛结果已计算完成'), 1200);
    } else if (typeof customAlert !== 'undefined' && customAlert && typeof customAlert.show === 'function') {
        customAlert.show(t('common.tip', '提示'), t('match.result_calculated', '比赛结果已计算完成'));
    } else {
        alert(t('match.result_calculated', '比赛结果已计算完成'));
    }
}

// 从服务器加载Character文件
async function loadCharacterFile(fileName) {
    try {
        // 使用POST请求，在请求体中传递文件名
        const response = await fetch('/api/get-character-file', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                filename: fileName
            })
        });
        const result = await response.json();
        
        if (result.success) {
            // 更新人员列表
            people = result.content;
            renderPeopleList();
            customAlert.show(
                t('people.import.success_title', '导入成功'),
                t('people.import.success_message', '成功导入 {filename}', { filename: fileName })
            );
        } else {
            customAlert.show(
                t('people.import.failed_title', '导入失败'),
                t('people.import.failed_message', '无法导入文件: {error}', { error: result.error })
            );
        }
    } catch (error) {
        customAlert.show(
            t('people.import.failed_title', '导入失败'),
            t('common.network_error', '网络错误: {error}', { error: error.message })
        );
    }
}


