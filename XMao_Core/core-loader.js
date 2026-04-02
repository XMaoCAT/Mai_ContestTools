(function () {
    'use strict';

    var CORE_BASE = './XMao_Core';

    function createCoreError(code, message, cause) {
        var error = new Error('[' + code + '] ' + message);
        error.code = code;
        if (cause) {
            error.cause = cause;
        }
        return error;
    }

    function normalizePath(path) {
        if (!path) {
            return null;
        }

        if (path.startsWith('./') || path.startsWith('/') || /^https?:\/\//.test(path)) {
            return path;
        }

        return './' + path.replace(/\\/g, '/');
    }

    function joinPath(base, sub) {
        if (!sub) {
            return null;
        }
        return normalizePath(base.replace(/\/$/, '') + '/' + sub.replace(/^\//, ''));
    }

    function sanitizeId(raw, index) {
        var safe = String(raw || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
        if (!safe) {
            safe = 'module-' + index;
        }
        return safe;
    }

    function normalizeModule(rawModule, index) {
        var module = rawModule || {};
        var folder = String(module.folder || module.directory || module.id || ('module-' + index));
        var id = sanitizeId(module.id || folder, index);
        var name = String(module.name || module.nav_text || folder);
        var icon = String(module.icon || '📁');
        var order = Number.isFinite(Number(module.order)) ? Number(module.order) : 9999;

        var folderBase = CORE_BASE + '/' + folder;

        var pageUrl = normalizePath(module.pageUrl || module.page_url || null);
        if (!pageUrl && module.page) {
            pageUrl = joinPath(folderBase, module.page);
        }
        if (!pageUrl) {
            pageUrl = joinPath(folderBase, 'page.html');
        }

        var scriptUrl = normalizePath(module.scriptUrl || module.script_url || null);
        if (!scriptUrl && module.script) {
            scriptUrl = joinPath(folderBase, module.script);
        }
        if (!scriptUrl) {
            scriptUrl = joinPath(folderBase, 'page.js');
        }

        var styleUrl = normalizePath(module.styleUrl || module.style_url || null);
        if (!styleUrl && module.style) {
            styleUrl = joinPath(folderBase, module.style);
        }
        if (!styleUrl) {
            styleUrl = joinPath(folderBase, 'page.css');
        }

        return {
            id: id,
            name: name,
            icon: icon,
            order: order,
            folder: folder,
            pageUrl: pageUrl,
            scriptUrl: scriptUrl,
            styleUrl: styleUrl
        };
    }

    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            if (!src) {
                resolve();
                return;
            }

            var existing = document.querySelector('script[data-core-src="' + src + '"]');
            if (existing) {
                resolve();
                return;
            }

            var script = document.createElement('script');
            script.src = src;
            script.async = false;
            script.dataset.coreSrc = src;
            script.onload = function () { resolve(); };
            script.onerror = function () {
                reject(createCoreError('CORE-MODULE-007', '模块脚本加载失败: ' + src));
            };
            document.body.appendChild(script);
        });
    }

    function loadStyle(href) {
        if (!href) {
            return;
        }

        var existing = document.querySelector('link[data-core-href="' + href + '"]');
        if (existing) {
            return;
        }

        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.dataset.coreHref = href;
        document.head.appendChild(link);
    }

    function wrapToSection(module, html) {
        if (!html) {
            return '<section class="page" id="' + module.id + 'Page" style="display: none;"><div class="page-content"><h2>' + module.name + '</h2><p>模块页面未提供内容（缺少 page.html）。</p></div></section>';
        }

        var trimmed = html.trim();
        var sectionRegex = /^<section\b[^>]*>[\s\S]*<\/section>$/i;

        if (!sectionRegex.test(trimmed)) {
            return '<section class="page" id="' + module.id + 'Page" style="display: none;">' + trimmed + '</section>';
        }

        var withClass = /class\s*=\s*"[^"]*\bpage\b[^"]*"/i.test(trimmed) ? trimmed : trimmed.replace('<section', '<section class="page"');

        if (/id\s*=\s*"[^"]+"/i.test(withClass)) {
            withClass = withClass.replace(/id\s*=\s*"[^"]+"/i, 'id="' + module.id + 'Page"');
        } else {
            withClass = withClass.replace('<section', '<section id="' + module.id + 'Page"');
        }

        if (/style\s*=\s*"[^"]*"/i.test(withClass)) {
            withClass = withClass.replace(/style\s*=\s*"([^"]*)"/i, function (_, styleText) {
                var hasDisplay = /display\s*:/i.test(styleText);
                var nextStyle = hasDisplay ? styleText.replace(/display\s*:[^;]+;?/i, 'display: none;') : (styleText.trim() + '; display: none;');
                return 'style="' + nextStyle + '"';
            });
        } else {
            withClass = withClass.replace('<section', '<section style="display: none;"');
        }

        return withClass;
    }

    async function fetchModules() {
        var response;
        try {
            response = await fetch('/api/core-modules', { cache: 'no-store' });
        } catch (error) {
            throw createCoreError('CORE-MODULE-001', '读取模块列表失败，无法访问 /api/core-modules', error);
        }

        if (!response.ok) {
            throw createCoreError('CORE-MODULE-002', '读取模块列表失败，HTTP ' + response.status);
        }

        var payload;
        try {
            payload = await response.json();
        } catch (error) {
            throw createCoreError('CORE-MODULE-003', '模块列表返回的 JSON 无法解析', error);
        }

        if (!payload || payload.success !== true || !Array.isArray(payload.modules)) {
            throw createCoreError('CORE-MODULE-004', '模块列表返回格式无效');
        }

        if (payload.modules.length === 0) {
            throw createCoreError('CORE-MODULE-005', '未发现任何模块，请检查 XMao_Core 目录');
        }

        var normalized = payload.modules.map(function (module, index) {
            return normalizeModule(module, index);
        });

        normalized.sort(function (a, b) {
            if (a.order !== b.order) {
                return a.order - b.order;
            }
            return a.name.localeCompare(b.name, 'zh-CN');
        });

        return normalized;
    }

    function renderNav(modules, navContainer) {
        navContainer.innerHTML = '';

        modules.forEach(function (module, index) {
            var nav = document.createElement('a');
            nav.href = '#';
            nav.className = 'nav-item' + (index === 0 ? ' active' : '');
            nav.dataset.page = module.id;
            nav.innerHTML = '<span class="nav-icon">' + module.icon + '</span><span class="nav-text">' + module.name + '</span>';
            navContainer.appendChild(nav);
        });
    }

    var XMaoCore = window.XMaoCore || {};
    XMaoCore.modules = XMaoCore.modules || [];
    XMaoCore.moduleHooks = XMaoCore.moduleHooks || {};

    XMaoCore.registerModuleHooks = function (moduleId, hooks) {
        if (!moduleId) {
            return;
        }
        XMaoCore.moduleHooks[moduleId] = hooks || {};
    };

    XMaoCore.getModuleHooks = function (moduleId) {
        return XMaoCore.moduleHooks[moduleId] || null;
    };

    XMaoCore.loadModules = async function () {
        var navContainer = document.getElementById('dynamicNavMenu');
        var pageHost = document.getElementById('dynamicPagesHost');

        if (!navContainer || !pageHost) {
            throw createCoreError('CORE-MODULE-006', '动态模块容器不存在，请检查 index.html 结构');
        }

        var modules = await fetchModules();

        modules.forEach(function (module) {
            loadStyle(module.styleUrl);
        });

        pageHost.innerHTML = '';

        for (var i = 0; i < modules.length; i += 1) {
            var module = modules[i];
            var html = '';
            if (!module.pageUrl) {
                throw createCoreError('CORE-MODULE-008', '模块缺少页面文件: ' + module.id + '/page.html');
            }

            var response;
            try {
                response = await fetch(module.pageUrl, { cache: 'no-store' });
            } catch (error) {
                throw createCoreError('CORE-MODULE-009', '模块页面加载失败: ' + module.pageUrl, error);
            }

            if (!response.ok) {
                throw createCoreError('CORE-MODULE-010', '模块页面读取失败: ' + module.pageUrl + ' (HTTP ' + response.status + ')');
            }

            html = await response.text();
            pageHost.insertAdjacentHTML('beforeend', wrapToSection(module, html));
            await loadScript(module.scriptUrl);
        }

        renderNav(modules, navContainer);

        if (modules.length > 0) {
            var firstPage = document.getElementById(modules[0].id + 'Page');
            if (firstPage) {
                firstPage.style.display = 'flex';
            }
        }

        XMaoCore.modules = modules;
        window.__xmaoCoreModules = modules;

        return modules;
    };

    window.XMaoCore = XMaoCore;
})();
