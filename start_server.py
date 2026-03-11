import http.server
import socketserver
import webbrowser
import os
import time
import socket
import json
import re
import base64
import gzip
import mimetypes
import hashlib
import shutil
import pathlib
import threading
import queue
import traceback
import sys
import ctypes
import subprocess
from datetime import datetime
from urllib.parse import parse_qs, urlparse

try:
    import tkinter as tk
    from tkinter import ttk, filedialog, messagebox, font as tkfont
    TK_AVAILABLE = True
except Exception:
    tk = None
    ttk = None
    filedialog = None
    messagebox = None
    tkfont = None
    TK_AVAILABLE = False

# 获取当前目录
current_dir = os.path.dirname(os.path.abspath(__file__))
os.chdir(current_dir)

LOG_QUEUE = queue.Queue()


def parse_int_env(env_name, default_value, minimum=1):
    raw = os.environ.get(env_name, '')
    try:
        value = int(str(raw).strip())
        if value < minimum:
            raise ValueError
        return value
    except Exception:
        return default_value


DEFAULT_START_PORT = parse_int_env('XMAI_START_PORT', 8001, minimum=1)
DEFAULT_PORT_SCAN_ATTEMPTS = parse_int_env('XMAI_PORT_ATTEMPTS', 50, minimum=1)


def app_log(message, level='INFO'):
    timestamp = datetime.now().strftime('%H:%M:%S')
    text = f"[{timestamp}] [{level}] {message}"
    print(text)
    try:
        LOG_QUEUE.put_nowait(text)
    except Exception:
        pass


def log_api_error(route, error):
    stack = traceback.format_exc()
    app_log(f"{route} 处理失败: {error}\n{stack}", 'ERROR')


def read_reset_state_token():
    if not os.path.exists(reset_state_path):
        return '0'

    try:
        with open(reset_state_path, 'r', encoding='utf-8') as file_obj:
            data = json.load(file_obj)
        if isinstance(data, dict):
            token = str(data.get('reset_token', '')).strip()
            return token or '0'
    except Exception:
        pass
    return '0'


def write_reset_state_token(token):
    normalized = str(token or '').strip() or '0'
    payload = {
        'reset_token': normalized,
        'updated_at': int(time.time())
    }
    os.makedirs(cache_dir, exist_ok=True)
    with open(reset_state_path, 'w', encoding='utf-8') as file_obj:
        json.dump(payload, file_obj, ensure_ascii=False, indent=2)


def bump_reset_state_token():
    token = str(int(time.time() * 1000))
    write_reset_state_token(token)
    return token

# 创建MaiList文件夹（如果不存在）
mai_list_dir = os.path.join(current_dir, 'MaiList')
if not os.path.exists(mai_list_dir):
    os.makedirs(mai_list_dir)
    app_log(f"创建MaiList文件夹成功: {mai_list_dir}")

# 创建Character文件夹（如果不存在）
character_dir = os.path.join(mai_list_dir, 'Character')
if not os.path.exists(character_dir):
    os.makedirs(character_dir)
    app_log(f"创建Character文件夹成功: {character_dir}")

# 创建Result文件夹（如果不存在）
result_dir = os.path.join(current_dir, 'Result')
if not os.path.exists(result_dir):
    os.makedirs(result_dir)
    app_log(f"创建Result文件夹成功: {result_dir}")

# 创建ResultDiagram文件夹（如果不存在）
result_diagram_dir = os.path.join(result_dir, 'ResultDiagram')
if not os.path.exists(result_diagram_dir):
    os.makedirs(result_diagram_dir)
    app_log(f"创建ResultDiagram文件夹成功: {result_diagram_dir}")

# 创建Data文件夹（如果不存在）
data_dir = os.path.join(current_dir, 'Data')
if not os.path.exists(data_dir):
    os.makedirs(data_dir)
    app_log(f"创建Data文件夹成功: {data_dir}")

# 曲绘资源目录
mai_song_lib_dir = os.path.join(current_dir, 'MaiSongLib')
if not os.path.exists(mai_song_lib_dir):
    os.makedirs(mai_song_lib_dir)
    app_log(f"创建MaiSongLib文件夹成功: {mai_song_lib_dir}")

# DownloadCore目录
download_core_dir = os.path.join(current_dir, 'DownloadCore')

# 创建XMao_Core文件夹（如果不存在）
core_dir = os.path.join(current_dir, 'XMao_Core')
if not os.path.exists(core_dir):
    os.makedirs(core_dir)
    app_log(f"创建XMao_Core文件夹成功: {core_dir}")

# 创建背景资源文件夹（如果不存在）
background_dir = os.path.join(core_dir, 'Background')
if not os.path.exists(background_dir):
    os.makedirs(background_dir)
    app_log(f"创建背景资源文件夹成功: {background_dir}")

# 兼容旧路径：XMao_Core/core/Background（仅扫描，不强制创建）
legacy_background_dir = os.path.join(core_dir, 'core', 'Background')

# 应用后的背景资源目录（保存裁剪结果）
background_applied_dir = os.path.join(background_dir, 'Applied')
if not os.path.exists(background_applied_dir):
    os.makedirs(background_applied_dir)
    app_log(f"创建背景已应用目录成功: {background_applied_dir}")

# 背景视频目录（视频模式扫描）
background_video_dir = os.path.join(background_dir, 'Video')
if not os.path.exists(background_video_dir):
    os.makedirs(background_video_dir)
    app_log(f"创建背景视频目录成功: {background_video_dir}")

# 创建缓存文件夹（如果不存在）
cache_dir = os.path.join(current_dir, '.cache')
if not os.path.exists(cache_dir):
    os.makedirs(cache_dir)
    app_log(f"创建缓存文件夹成功: {cache_dir}")

reset_state_path = os.path.join(cache_dir, 'app_reset_state.json')
if not os.path.exists(reset_state_path):
    try:
        write_reset_state_token('0')
    except Exception as reset_error:
        app_log(f"初始化重置状态文件失败: {reset_error}", 'WARN')

memory_test_package_path = os.path.join(cache_dir, 'memory_test_images.pkg.gz')
memory_test_manifest_path = os.path.join(cache_dir, 'memory_test_images_manifest.json')
memory_test_package_info = None

IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.avif', '.svg'}
BACKGROUND_IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg'}
BACKGROUND_VIDEO_EXTENSIONS = {'.mp4'}

default_core_meta = {
    'home': {'id': 'home', 'name': '主页面', 'icon': '🏠', 'order': 10},
    'results': {'id': 'results', 'name': '比赛结果', 'icon': '📊', 'order': 20},
    'settings': {'id': 'settings', 'name': '设置', 'icon': '⚙️', 'order': 30},
    'library': {'id': 'library', 'name': '曲库', 'icon': '🎵', 'order': 40},
}

CORE_MODULE_IGNORE_DIRS = {
    'vendor',
    '__pycache__',
}


def sanitize_module_id(raw_value):
    safe = re.sub(r'[^a-zA-Z0-9_-]+', '-', str(raw_value or '')).strip('-').lower()
    return safe or 'module'


def to_web_path(path):
    relative_path = os.path.relpath(path, current_dir)
    return f"./{relative_path.replace(os.sep, '/')}"


def normalize_local_image_path(raw_path):
    normalized = str(raw_path or '').strip().replace('\\', '/')
    if not normalized:
        raise ValueError('资源路径不能为空')

    while normalized.startswith('./'):
        normalized = normalized[2:]
    while normalized.startswith('/'):
        normalized = normalized[1:]

    normalized = os.path.normpath(normalized).replace('\\', '/')
    if normalized in ('', '.', '..') or normalized.startswith('../'):
        raise ValueError(f'非法资源路径: {raw_path}')

    if not (normalized.startswith('MaiSongLib/') or normalized.startswith('Data/')):
        raise ValueError(f'不允许的资源路径: {raw_path}')

    return normalized


def resolve_local_image_path(normalized_path):
    abs_path = os.path.abspath(os.path.join(current_dir, normalized_path))
    project_root = os.path.abspath(current_dir)
    if abs_path != project_root and not abs_path.startswith(project_root + os.sep):
        raise ValueError(f'资源路径越界: {normalized_path}')
    return abs_path


def read_existing_memory_test_manifest():
    if not os.path.exists(memory_test_manifest_path):
        return None

    with open(memory_test_manifest_path, 'r', encoding='utf-8') as manifest_file:
        data = json.load(manifest_file)

    if not isinstance(data, dict):
        raise ValueError('缓存清单文件格式不正确')

    return data


def build_memory_test_source_signature(image_descriptors):
    hasher = hashlib.sha256()
    for descriptor in image_descriptors:
        normalized_path = str(descriptor.get('normalized_path', ''))
        file_size = int(descriptor.get('size', 0))
        hasher.update(normalized_path.encode('utf-8'))
        hasher.update(b'|')
        hasher.update(str(file_size).encode('ascii'))
        hasher.update(b'\n')
    return hasher.hexdigest()


def collect_memory_test_image_descriptors():
    descriptors = []
    scan_roots = [
        os.path.join(current_dir, 'MaiSongLib'),
        os.path.join(current_dir, 'Data')
    ]

    for root_dir in scan_roots:
        if not os.path.exists(root_dir):
            continue

        for dir_path, _, file_names in os.walk(root_dir):
            for file_name in file_names:
                ext = os.path.splitext(file_name)[1].lower()
                if ext not in IMAGE_EXTENSIONS:
                    continue

                absolute_path = os.path.join(dir_path, file_name)
                relative_path = os.path.relpath(absolute_path, current_dir).replace(os.sep, '/')
                normalized_path = normalize_local_image_path(f'./{relative_path}')

                stat_result = os.stat(absolute_path)
                descriptors.append({
                    'normalized_path': normalized_path,
                    'size': int(stat_result.st_size),
                    'mtime_ns': int(getattr(stat_result, 'st_mtime_ns', int(stat_result.st_mtime * 1_000_000_000)))
                })

    descriptors.sort(key=lambda item: item['normalized_path'])
    return descriptors


def collect_memory_test_image_paths():
    descriptors = collect_memory_test_image_descriptors()
    return [f"./{item['normalized_path']}" for item in descriptors]


def normalize_background_mode(mode):
    normalized = str(mode or '').strip().lower()
    if normalized == 'video':
        return 'video'
    if normalized == 'all':
        return 'all'
    return 'image'


def collect_background_assets(mode='image'):
    mode = normalize_background_mode(mode)
    os.makedirs(background_dir, exist_ok=True)
    os.makedirs(background_applied_dir, exist_ok=True)
    os.makedirs(background_video_dir, exist_ok=True)

    image_files = []
    video_files = []
    visited_urls = set()

    def build_asset_entry(absolute_path, relative_name, asset_type):
        asset_url = to_web_path(absolute_path)
        if asset_url in visited_urls:
            return None
        visited_urls.add(asset_url)

        stat_result = os.stat(absolute_path)
        return {
            'name': relative_name,
            'display_name': os.path.basename(absolute_path),
            'type': asset_type,
            'size': int(stat_result.st_size),
            'mtime': float(stat_result.st_mtime),
            'url': asset_url
        }

    if mode in ('image', 'all'):
        scan_roots = [background_dir]
        if os.path.isdir(legacy_background_dir):
            scan_roots.append(legacy_background_dir)

        for scan_root in scan_roots:
            for dir_path, dir_names, file_names in os.walk(scan_root):
                # 图片模式下不扫描 Applied 与 Video 目录
                dir_names[:] = [d for d in dir_names if d.lower() not in {'applied', 'video'}]

                for file_name in file_names:
                    absolute_path = os.path.join(dir_path, file_name)
                    if not os.path.isfile(absolute_path):
                        continue

                    ext = os.path.splitext(file_name)[1].lower()
                    if ext not in BACKGROUND_IMAGE_EXTENSIONS:
                        continue

                    relative_name = os.path.relpath(absolute_path, scan_root).replace(os.sep, '/')
                    if scan_root == legacy_background_dir:
                        relative_name = f"Legacy/{relative_name}"

                    entry = build_asset_entry(absolute_path, relative_name, 'image')
                    if entry:
                        image_files.append(entry)

    if mode in ('video', 'all'):
        for dir_path, _, file_names in os.walk(background_video_dir):
            for file_name in file_names:
                absolute_path = os.path.join(dir_path, file_name)
                if not os.path.isfile(absolute_path):
                    continue

                ext = os.path.splitext(file_name)[1].lower()
                if ext not in BACKGROUND_VIDEO_EXTENSIONS:
                    continue

                relative_name = os.path.relpath(absolute_path, background_video_dir).replace(os.sep, '/')
                relative_name = f"Video/{relative_name}"

                entry = build_asset_entry(absolute_path, relative_name, 'video')
                if entry:
                    video_files.append(entry)

    image_files.sort(key=lambda item: (item.get('mtime', 0), item['name'].lower()), reverse=True)
    video_files.sort(key=lambda item: item['name'].lower())

    if mode == 'video':
        return video_files
    if mode == 'image':
        return image_files
    return image_files + video_files


def resolve_background_video_file(relative_name):
    normalized = str(relative_name or '').strip().replace('\\', '/')
    while normalized.startswith('./'):
        normalized = normalized[2:]
    while normalized.startswith('/'):
        normalized = normalized[1:]

    normalized = os.path.normpath(normalized).replace('\\', '/')
    if normalized in ('', '.', '..') or normalized.startswith('../'):
        raise ValueError('非法视频路径')

    absolute_path = os.path.abspath(os.path.join(background_video_dir, normalized))
    video_root = os.path.abspath(background_video_dir)
    if absolute_path != video_root and not absolute_path.startswith(video_root + os.sep):
        raise ValueError('视频路径越界')

    if not os.path.exists(absolute_path) or not os.path.isfile(absolute_path):
        raise FileNotFoundError('视频文件不存在')

    ext = os.path.splitext(absolute_path)[1].lower()
    if ext not in BACKGROUND_VIDEO_EXTENSIONS:
        raise ValueError('不支持的视频格式')

    return absolute_path


def safe_background_asset_name(filename, default_name='wallpaper'):
    raw = os.path.basename(str(filename or '')).strip()
    if not raw:
        raw = default_name

    stem, _ = os.path.splitext(raw)
    safe = re.sub(r'[^a-zA-Z0-9_-]+', '_', stem).strip('_')
    return safe or default_name


def save_cropped_background_asset(source_name, image_data):
    source_safe_name = safe_background_asset_name(source_name, 'wallpaper')
    if not isinstance(image_data, str) or not image_data.strip():
        raise ValueError('裁剪后的图片数据为空')

    data_match = re.match(r'^data:image/(png|jpeg|jpg|webp);base64,(.+)$', image_data.strip(), re.IGNORECASE | re.DOTALL)
    if not data_match:
        raise ValueError('裁剪图片格式无效，仅支持 PNG/JPEG/WEBP 的 base64 数据')

    image_ext = data_match.group(1).lower()
    image_base64 = data_match.group(2)
    if image_ext == 'jpeg':
        image_ext = 'jpg'

    try:
        binary_data = base64.b64decode(image_base64, validate=True)
    except Exception as decode_error:
        raise ValueError(f'裁剪图片数据解码失败: {decode_error}') from decode_error

    if not binary_data:
        raise ValueError('裁剪图片数据为空')

    max_bytes = 24 * 1024 * 1024
    if len(binary_data) > max_bytes:
        raise ValueError('裁剪图片体积过大，请缩小裁剪区域后重试')

    os.makedirs(background_applied_dir, exist_ok=True)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
    file_name = f'{source_safe_name}_{timestamp}.{image_ext}'
    file_path = os.path.join(background_applied_dir, file_name)

    with open(file_path, 'wb') as image_file:
        image_file.write(binary_data)

    stat_result = os.stat(file_path)
    return {
        'name': f'Applied/{file_name}',
        'display_name': file_name,
        'type': 'image',
        'size': int(stat_result.st_size),
        'mtime': float(stat_result.st_mtime),
        'url': to_web_path(file_path)
    }


def build_or_reuse_memory_test_package(image_paths=None):
    if image_paths is None:
        image_descriptors = collect_memory_test_image_descriptors()
    else:
        if not isinstance(image_paths, list):
            raise ValueError('image_paths 必须为数组')

        descriptor_map = {}
        for raw_path in image_paths:
            normalized_path = normalize_local_image_path(raw_path)
            abs_path = resolve_local_image_path(normalized_path)
            if not os.path.exists(abs_path):
                raise FileNotFoundError(f'图片文件不存在: {normalized_path}')
            stat_result = os.stat(abs_path)
            descriptor_map[normalized_path] = {
                'normalized_path': normalized_path,
                'size': int(stat_result.st_size),
                'mtime_ns': int(getattr(stat_result, 'st_mtime_ns', int(stat_result.st_mtime * 1_000_000_000)))
            }
        image_descriptors = sorted(descriptor_map.values(), key=lambda item: item['normalized_path'])

    file_count = len(image_descriptors)
    if file_count == 0:
        raise ValueError('没有可打包的图片资源')

    source_total_disk_bytes = sum(int(item.get('size', 0)) for item in image_descriptors)
    source_signature = build_memory_test_source_signature(image_descriptors)

    existing_manifest = None
    try:
        existing_manifest = read_existing_memory_test_manifest()
    except Exception:
        existing_manifest = None

    existing_signature = ''
    existing_source_count = -1
    existing_source_disk_bytes = -1
    if isinstance(existing_manifest, dict):
        existing_signature = str(existing_manifest.get('source_signature', '')).strip()
        try:
            existing_source_count = int(existing_manifest.get('source_file_count', existing_manifest.get('file_count', -1)))
        except Exception:
            existing_source_count = -1
        try:
            existing_source_disk_bytes = int(existing_manifest.get('source_total_disk_bytes', existing_manifest.get('disk_bytes', -1)))
        except Exception:
            existing_source_disk_bytes = -1

    reusable_with_signature = (
        bool(existing_signature)
        and existing_signature == source_signature
        and existing_source_count == file_count
        and existing_source_disk_bytes == source_total_disk_bytes
    )
    if (
        existing_manifest
        and os.path.exists(memory_test_package_path)
        and reusable_with_signature
    ):
        return {
            'reused': True,
            'file_count': file_count,
            'disk_bytes': int(existing_manifest.get('disk_bytes', source_total_disk_bytes)),
            'compressed_bytes': int(existing_manifest.get('compressed_bytes', 0)),
            'generated_at': int(existing_manifest.get('generated_at', int(time.time()))),
            'package_url': '/api/memory-test-package'
        }

    if existing_manifest and os.path.exists(memory_test_package_path):
        reuse_reason = []
        if not existing_signature:
            reuse_reason.append('manifest missing source_signature')
        if existing_signature and existing_signature != source_signature:
            reuse_reason.append('source_signature changed')
        if existing_source_count != file_count:
            reuse_reason.append(f'source_file_count changed: {existing_source_count} -> {file_count}')
        if existing_source_disk_bytes != source_total_disk_bytes:
            reuse_reason.append(f'source_total_disk_bytes changed: {existing_source_disk_bytes} -> {source_total_disk_bytes}')
        if reuse_reason:
            app_log(f"[TestPackage] 缓存包将重建: {'; '.join(reuse_reason)}", 'INFO')

    images_payload = []
    total_disk_bytes = 0

    for descriptor in image_descriptors:
        normalized_path = descriptor['normalized_path']
        abs_path = resolve_local_image_path(normalized_path)
        if not os.path.exists(abs_path):
            raise FileNotFoundError(f'图片文件不存在: {normalized_path}')

        with open(abs_path, 'rb') as image_file:
            binary_data = image_file.read()

        file_size = len(binary_data)
        mime_type = mimetypes.guess_type(normalized_path)[0] or 'application/octet-stream'
        total_disk_bytes += file_size

        images_payload.append({
            'path': f'./{normalized_path}',
            'mime_type': mime_type,
            'disk_size': file_size,
            'content_base64': base64.b64encode(binary_data).decode('ascii')
        })

    package_payload = {
        'version': 1,
        'generated_at': int(time.time()),
        'file_count': file_count,
        'images': images_payload
    }

    package_bytes = json.dumps(package_payload, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    with gzip.open(memory_test_package_path, 'wb', compresslevel=6) as package_file:
        package_file.write(package_bytes)

    compressed_bytes = os.path.getsize(memory_test_package_path)
    generated_at = int(time.time())

    manifest_payload = {
        'version': 1,
        'file_count': file_count,
        'disk_bytes': total_disk_bytes,
        'compressed_bytes': compressed_bytes,
        'generated_at': generated_at,
        'images_source': ['MaiSongLib', 'Data'],
        'source_file_count': file_count,
        'source_total_disk_bytes': source_total_disk_bytes,
        'source_signature': source_signature
    }

    with open(memory_test_manifest_path, 'w', encoding='utf-8') as manifest_file:
        json.dump(manifest_payload, manifest_file, ensure_ascii=False, indent=2)

    return {
        'reused': False,
        'file_count': file_count,
        'disk_bytes': total_disk_bytes,
        'compressed_bytes': compressed_bytes,
        'generated_at': generated_at,
        'package_url': '/api/memory-test-package'
    }


def build_memory_test_package_now(image_paths=None):
    global memory_test_package_info
    start_time = time.time()
    package_info = build_or_reuse_memory_test_package(image_paths=image_paths)
    memory_test_package_info = package_info
    elapsed_ms = int((time.time() - start_time) * 1000)
    return package_info, elapsed_ms


def refresh_memory_test_package_on_startup():
    package_info, elapsed_ms = build_memory_test_package_now()
    mode = '复用缓存包' if package_info.get('reused') else '新建缓存包'
    app_log(
        f"[TestPackage] {mode}完成: files={package_info.get('file_count', 0)}, "
        f"disk={package_info.get('disk_bytes', 0)}B, "
        f"compressed={package_info.get('compressed_bytes', 0)}B, "
        f"time={elapsed_ms}ms"
    )


def get_memory_test_package_info():
    global memory_test_package_info

    if isinstance(memory_test_package_info, dict):
        return memory_test_package_info

    manifest = read_existing_memory_test_manifest()
    if not manifest or not os.path.exists(memory_test_package_path):
        raise FileNotFoundError('内存加载器缓存包未准备好，请重启服务器触发预构建。')

    memory_test_package_info = {
        'reused': True,
        'file_count': int(manifest.get('file_count', 0)),
        'disk_bytes': int(manifest.get('disk_bytes', 0)),
        'compressed_bytes': int(manifest.get('compressed_bytes', 0)),
        'generated_at': int(manifest.get('generated_at', int(time.time()))),
        'package_url': '/api/memory-test-package'
    }
    return memory_test_package_info


def safe_json_filename(filename, default_name='result'):
    raw = os.path.basename(str(filename or '')).strip()
    if not raw:
        raw = default_name
    if not raw.endswith('.json'):
        raw = f'{raw}.json'
    return raw


def safe_png_filename(filename, default_name='result_diagram'):
    raw = os.path.basename(str(filename or '')).strip()
    if not raw:
        raw = default_name
    raw = re.sub(r'[\\/:*?"<>|]+', '_', raw)
    if not raw.lower().endswith('.png'):
        raw = f'{raw}.png'
    return raw


def scan_core_modules():
    modules = []
    used_ids = set()

    if not os.path.exists(core_dir):
        return modules

    for entry in os.scandir(core_dir):
        if not entry.is_dir():
            continue

        folder_name = entry.name
        if folder_name in CORE_MODULE_IGNORE_DIRS or folder_name.startswith('.'):
            continue

        meta = {}
        meta.update(default_core_meta.get(folder_name, {}))

        module_config_path = os.path.join(entry.path, 'module.json')
        has_module_config = os.path.exists(module_config_path)
        has_default_page = os.path.exists(os.path.join(entry.path, 'page.html'))

        # 仅加载真正的模块目录：有 module.json 或存在默认页面文件。
        if not has_module_config and not has_default_page:
            continue

        if os.path.exists(module_config_path):
            try:
                with open(module_config_path, 'r', encoding='utf-8') as config_file:
                    config_data = json.load(config_file)
                if isinstance(config_data, dict):
                    meta.update(config_data)
            except Exception as parse_error:
                app_log(f"读取模块配置失败 {module_config_path}: {parse_error}", 'WARN')

        raw_id = meta.get('id') or folder_name
        base_id = sanitize_module_id(raw_id)
        unique_id = base_id
        suffix = 2
        while unique_id in used_ids:
            unique_id = f"{base_id}-{suffix}"
            suffix += 1
        used_ids.add(unique_id)

        module_name = meta.get('name') or folder_name
        module_icon = meta.get('icon') or '📁'
        try:
            module_order = int(meta.get('order', 9999))
        except (TypeError, ValueError):
            module_order = 9999

        page_name = meta.get('page') or 'page.html'
        script_name = meta.get('script') or 'page.js'
        style_name = meta.get('style') or 'page.css'

        page_path = os.path.join(entry.path, page_name) if page_name else ''
        script_path = os.path.join(entry.path, script_name) if script_name else ''
        style_path = os.path.join(entry.path, style_name) if style_name else ''

        if not page_path or not os.path.exists(page_path):
            app_log(f"跳过模块 {folder_name}: 页面文件不存在 ({page_name})", 'WARN')
            continue

        modules.append({
            'id': unique_id,
            'name': module_name,
            'icon': module_icon,
            'order': module_order,
            'folder': folder_name,
            'page_url': to_web_path(page_path) if page_path and os.path.exists(page_path) else None,
            'script_url': to_web_path(script_path) if script_path and os.path.exists(script_path) else None,
            'style_url': to_web_path(style_path) if style_path and os.path.exists(style_path) else None
        })

    modules.sort(key=lambda item: (item.get('order', 9999), str(item.get('name', ''))))
    return modules

# 自定义HTTP请求处理器
class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        try:
            message = format % args
        except Exception:
            message = str(format)
        client_ip = self.client_address[0] if self.client_address else 'unknown'
        method = getattr(self, 'command', '-')
        path = getattr(self, 'path', '-')
        app_log(f"{client_ip} {method} {path} -> {message}", 'HTTP')

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def _parse_single_byte_range(self, raw_range, file_size):
        if not raw_range or file_size <= 0:
            return None

        header = str(raw_range).strip()
        if not header.lower().startswith('bytes='):
            return None

        range_spec = header.split('=', 1)[1].strip()
        if not range_spec or ',' in range_spec or '-' not in range_spec:
            return None

        start_text, end_text = range_spec.split('-', 1)

        try:
            if start_text == '':
                suffix_length = int(end_text)
                if suffix_length <= 0:
                    return None
                suffix_length = min(suffix_length, file_size)
                start = file_size - suffix_length
                end = file_size - 1
            else:
                start = int(start_text)
                if start < 0 or start >= file_size:
                    return None

                if end_text == '':
                    end = file_size - 1
                else:
                    end = int(end_text)
                    if end < start:
                        return None
                    end = min(end, file_size - 1)
        except (TypeError, ValueError):
            return None

        return (start, end)

    def send_head(self):
        self._byte_range = None
        range_header = self.headers.get('Range')
        if not range_header:
            return super().send_head()

        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().send_head()

        if path.endswith('/'):
            self.send_error(404, 'File not found')
            return None

        try:
            file_obj = open(path, 'rb')
        except OSError:
            self.send_error(404, 'File not found')
            return None

        try:
            stat = os.fstat(file_obj.fileno())
            file_size = int(stat.st_size)
            byte_range = self._parse_single_byte_range(range_header, file_size)
            if byte_range is None:
                file_obj.close()
                return super().send_head()

            start, end = byte_range
            self._byte_range = (start, end)
            content_length = (end - start) + 1

            self.send_response(206)
            self.send_header('Content-type', self.guess_type(path))
            self.send_header('Accept-Ranges', 'bytes')
            self.send_header('Content-Range', f'bytes {start}-{end}/{file_size}')
            self.send_header('Content-Length', str(content_length))
            self.send_header('Last-Modified', self.date_time_string(stat.st_mtime))
            self.end_headers()
            return file_obj
        except Exception:
            file_obj.close()
            raise

    def copyfile(self, source, outputfile):
        byte_range = getattr(self, '_byte_range', None)
        if not byte_range:
            return super().copyfile(source, outputfile)

        start, end = byte_range
        remaining = (end - start) + 1
        source.seek(start)
        buffer_size = 64 * 1024

        while remaining > 0:
            chunk = source.read(min(buffer_size, remaining))
            if not chunk:
                break
            outputfile.write(chunk)
            remaining -= len(chunk)

        self._byte_range = None

    def do_GET(self):
        parsed_url = urlparse(self.path)
        request_path = parsed_url.path
        request_query = parse_qs(parsed_url.query, keep_blank_values=True)

        # 处理获取文件列表请求 - MaiList文件夹
        if request_path == '/api/get-files':
            try:
                # 获取MaiList文件夹中的所有.txt文件
                files = []
                if os.path.exists(mai_list_dir):
                    for file_name in os.listdir(mai_list_dir):
                        if file_name.endswith('.txt'):
                            file_path = os.path.join(mai_list_dir, file_name)
                            files.append({
                                'name': file_name,
                                'size': os.path.getsize(file_path),
                                'mtime': os.path.getmtime(file_path)
                            })
                
                # 按修改时间排序，最新的在前
                files.sort(key=lambda x: x['mtime'], reverse=True)
                
                # 发送成功响应
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': True,
                    'files': files
                }).encode('utf-8'))
                
            except Exception as e:
                log_api_error('/api/get-files', e)
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': False,
                    'error': str(e)
                }).encode('utf-8'))

        # 处理获取Data文件夹中的JSON文件列表请求
        elif request_path == '/api/get-data-files':
            try:
                files = []
                if os.path.exists(data_dir):
                    for file_name in os.listdir(data_dir):
                        if not file_name.lower().endswith('.json'):
                            continue

                        file_path = os.path.join(data_dir, file_name)
                        if not os.path.isfile(file_path):
                            continue

                        files.append({
                            'name': file_name,
                            'size': os.path.getsize(file_path),
                            'mtime': os.path.getmtime(file_path)
                        })

                files.sort(key=lambda item: str(item.get('name', '')).lower())

                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': True,
                    'files': files
                }, ensure_ascii=False).encode('utf-8'))

            except Exception as e:
                log_api_error('/api/get-data-files', e)
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': False,
                    'error': str(e)
                }, ensure_ascii=False).encode('utf-8'))
        
        # 处理获取XMao_Core模块列表请求
        elif request_path == '/api/core-modules':
            try:
                modules = scan_core_modules()

                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': True,
                    'modules': modules
                }, ensure_ascii=False).encode('utf-8'))
            except Exception as e:
                log_api_error('/api/core-modules', e)
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': False,
                    'error': str(e)
                }, ensure_ascii=False).encode('utf-8'))

        # 处理获取Character文件列表请求
        elif request_path == '/api/get-character-files':
            try:
                # 获取Character文件夹中的所有.json文件
                files = []
                if os.path.exists(character_dir):
                    for file_name in os.listdir(character_dir):
                        if file_name.endswith('.json'):
                            file_path = os.path.join(character_dir, file_name)
                            files.append({
                                'name': file_name,
                                'size': os.path.getsize(file_path),
                                'mtime': os.path.getmtime(file_path)
                            })
                
                # 按修改时间排序，最新的在前
                files.sort(key=lambda x: x['mtime'], reverse=True)
                
                # 发送成功响应
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': True,
                    'files': files
                }).encode('utf-8'))
                
            except Exception as e:
                log_api_error('/api/get-character-files', e)
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': False,
                    'error': str(e)
                }).encode('utf-8'))

        # 处理获取Result文件列表请求
        elif request_path == '/api/get-result-files':
            try:
                files = []
                if os.path.exists(result_dir):
                    for file_name in os.listdir(result_dir):
                        if file_name.endswith('.json'):
                            file_path = os.path.join(result_dir, file_name)
                            files.append({
                                'name': file_name,
                                'size': os.path.getsize(file_path),
                                'mtime': os.path.getmtime(file_path)
                            })

                files.sort(key=lambda x: x['mtime'], reverse=True)

                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': True,
                    'files': files
                }, ensure_ascii=False).encode('utf-8'))
            except Exception as e:
                log_api_error('/api/get-result-files', e)
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': False,
                    'error': str(e)
                }, ensure_ascii=False).encode('utf-8'))

        # 处理获取背景资源文件列表请求（XMao_Core/Background）
        elif request_path == '/api/get-background-files':
            try:
                mode = str((request_query.get('mode') or ['image'])[0] or 'image').strip().lower()
                files = collect_background_assets(mode=mode)

                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': True,
                    'mode': normalize_background_mode(mode),
                    'files': files
                }, ensure_ascii=False).encode('utf-8'))
            except Exception as e:
                log_api_error('/api/get-background-files', e)
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': False,
                    'error': str(e)
                }, ensure_ascii=False).encode('utf-8'))

        # 读取背景视频二进制（前端 fetch -> blob，避免直接暴露 .mp4 链接）
        elif request_path == '/api/background-video-blob':
            try:
                raw_name = str((request_query.get('name') or [''])[0] or '').strip()
                file_path = resolve_background_video_file(raw_name)
                file_size = os.path.getsize(file_path)

                self.send_response(200)
                self.send_header('Content-type', 'application/octet-stream')
                self.send_header('Cache-Control', 'no-store')
                self.send_header('X-Content-Type-Options', 'nosniff')
                self.send_header('Content-Length', str(file_size))
                self.end_headers()

                with open(file_path, 'rb') as video_file:
                    shutil.copyfileobj(video_file, self.wfile)
            except (ConnectionAbortedError, BrokenPipeError, ConnectionResetError):
                pass
            except Exception as e:
                log_api_error('/api/background-video-blob', e)
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': False,
                    'error': str(e)
                }, ensure_ascii=False).encode('utf-8'))

        # 读取Test模式缓存包信息（仅返回元数据）
        elif request_path == '/api/memory-test-package-info':
            try:
                package_info = get_memory_test_package_info()

                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': True,
                    'reused': bool(package_info.get('reused', True)),
                    'file_count': int(package_info.get('file_count', 0)),
                    'disk_bytes': int(package_info.get('disk_bytes', 0)),
                    'compressed_bytes': int(package_info.get('compressed_bytes', 0)),
                    'generated_at': int(package_info.get('generated_at', int(time.time()))),
                    'package_url': package_info.get('package_url', '/api/memory-test-package')
                }, ensure_ascii=False).encode('utf-8'))
            except Exception as e:
                log_api_error('/api/memory-test-package-info', e)
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': False,
                    'error': str(e)
                }, ensure_ascii=False).encode('utf-8'))

        # 读取Test模式缓存包内容（服务端压缩，HTTP自动解压）
        elif request_path == '/api/memory-test-package':
            try:
                if not os.path.exists(memory_test_package_path):
                    raise FileNotFoundError('缓存包文件不存在，请重启服务器触发预构建。')

                file_size = os.path.getsize(memory_test_package_path)
                self.send_response(200)
                self.send_header('Content-type', 'application/json; charset=utf-8')
                self.send_header('Content-Encoding', 'gzip')
                self.send_header('Cache-Control', 'no-store')
                self.send_header('Content-Length', str(file_size))
                self.end_headers()

                with open(memory_test_package_path, 'rb') as package_file:
                    shutil.copyfileobj(package_file, self.wfile)
            except (ConnectionAbortedError, BrokenPipeError, ConnectionResetError):
                # 客户端中断连接时静默处理，避免刷出无意义Traceback
                pass
            except Exception as e:
                log_api_error('/api/memory-test-package', e)
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': False,
                    'error': str(e)
                }, ensure_ascii=False).encode('utf-8'))

        # 读取初始化重置状态，用于前端判定是否需要清空本地设置
        elif request_path == '/api/reset-state':
            try:
                token = read_reset_state_token()
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Cache-Control', 'no-store')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': True,
                    'reset_token': token
                }, ensure_ascii=False).encode('utf-8'))
            except Exception as e:
                log_api_error('/api/reset-state', e)
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': False,
                    'error': str(e)
                }, ensure_ascii=False).encode('utf-8'))
        
        else:
            # 其他GET请求使用默认处理
            try:
                super().do_GET()
            except (ConnectionAbortedError, BrokenPipeError, ConnectionResetError):
                # 浏览器主动中断连接时不输出异常栈
                pass
    
    def do_POST(self):
        # 构建（或复用）内存缓存包，并返回最新信息
        if self.path == '/api/build-memory-test-package':
            try:
                package_info, elapsed_ms = build_memory_test_package_now()
                mode = '复用缓存包' if package_info.get('reused') else '新建缓存包'
                app_log(
                    f"[MemoryLoader] {mode}: files={package_info.get('file_count', 0)}, "
                    f"disk={package_info.get('disk_bytes', 0)}B, "
                    f"compressed={package_info.get('compressed_bytes', 0)}B, "
                    f"time={elapsed_ms}ms"
                )

                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': True,
                    'reused': bool(package_info.get('reused', True)),
                    'file_count': int(package_info.get('file_count', 0)),
                    'disk_bytes': int(package_info.get('disk_bytes', 0)),
                    'compressed_bytes': int(package_info.get('compressed_bytes', 0)),
                    'generated_at': int(package_info.get('generated_at', int(time.time()))),
                    'package_url': package_info.get('package_url', '/api/memory-test-package')
                }, ensure_ascii=False).encode('utf-8'))
            except Exception as e:
                log_api_error('/api/build-memory-test-package', e)
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': False,
                    'error': str(e)
                }, ensure_ascii=False).encode('utf-8'))

        # 处理保存背景裁剪结果请求（写入 XMao_Core/Background/Applied）
        elif self.path == '/api/save-background-crop':
            content_length = int(self.headers.get('Content-Length', '0'))
            post_data = self.rfile.read(content_length) if content_length > 0 else b'{}'

            try:
                data = json.loads(post_data.decode('utf-8'))
                source_name = data.get('source_name')
                image_data = data.get('image_data')

                saved_file = save_cropped_background_asset(source_name, image_data)

                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': True,
                    'file': saved_file
                }, ensure_ascii=False).encode('utf-8'))
            except Exception as e:
                log_api_error('/api/save-background-crop', e)
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': False,
                    'error': str(e)
                }, ensure_ascii=False).encode('utf-8'))
            
        # 处理创建文件请求
        elif self.path == '/api/create-file':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                # 解析JSON数据
                data = json.loads(post_data.decode('utf-8'))
                filename = data.get('filename')
                content = data.get('content')
                
                if not filename or not content:
                    self.send_response(400)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'success': False, 'error': '缺少文件名或内容'}).encode('utf-8'))
                    return
                
                # 创建文件路径
                file_path = os.path.join(mai_list_dir, f'{filename}.txt')
                
                # 写入文件
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                
                # 发送成功响应
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': True,
                    'message': f'文件创建成功',
                    'file_path': file_path
                }).encode('utf-8'))
                
                app_log(f"已创建文件: {file_path}")
                app_log(f"文件内容: {content}")
                
            except Exception as e:
                log_api_error('/api/create-file', e)
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': False,
                    'error': str(e)
                }).encode('utf-8'))
        
        # 处理删除文件请求 - MaiList文件夹
        elif self.path == '/api/delete-file':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                # 解析JSON数据
                data = json.loads(post_data.decode('utf-8'))
                files = data.get('files')
                
                if not files or not isinstance(files, list):
                    self.send_response(400)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'success': False, 'error': '缺少文件列表或格式错误'}).encode('utf-8'))
                    return
                
                # 删除文件
                deleted_count = 0
                for file_name in files:
                    file_path = os.path.join(mai_list_dir, file_name)
                    if os.path.exists(file_path):
                        os.remove(file_path)
                        deleted_count += 1
                        app_log(f"已删除文件: {file_path}")
                
                # 发送成功响应
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': True,
                    'message': f'成功删除 {deleted_count} 个文件',
                    'deleted_count': deleted_count
                }).encode('utf-8'))
                
            except Exception as e:
                log_api_error('/api/delete-file', e)
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': False,
                    'error': str(e)
                }).encode('utf-8'))
        
        # 处理保存Character文件请求
        elif self.path == '/api/save-character-file':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                # 解析JSON数据
                data = json.loads(post_data.decode('utf-8'))
                filename = data.get('filename')
                content = data.get('content')
                
                if not filename or not content:
                    self.send_response(400)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'success': False, 'error': '缺少文件名或内容'}).encode('utf-8'))
                    return
                
                # 确保文件名以.json结尾
                if not filename.endswith('.json'):
                    filename = f'{filename}.json'
                
                # 创建文件路径
                file_path = os.path.join(character_dir, filename)
                
                # 写入文件
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(json.dumps(content, ensure_ascii=False, indent=2))
                
                # 发送成功响应
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': True,
                    'message': f'文件创建成功',
                    'file_path': file_path
                }).encode('utf-8'))
                
                app_log(f"已保存Character文件: {file_path}")
                
            except Exception as e:
                log_api_error('/api/save-character-file', e)
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': False,
                    'error': str(e)
                }).encode('utf-8'))

        # 处理保存比赛结果请求
        elif self.path == '/api/save-match-result':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)

            try:
                data = json.loads(post_data.decode('utf-8'))
                filename = safe_json_filename(data.get('filename'), 'match_result')
                content = data.get('content')

                if content is None:
                    self.send_response(400)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        'success': False,
                        'error': '缺少比赛结果内容'
                    }).encode('utf-8'))
                    return

                file_path = os.path.join(result_dir, filename)

                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(json.dumps(content, ensure_ascii=False, indent=2))

                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': True,
                    'message': '比赛结果保存成功',
                    'file_name': filename,
                    'file_path': file_path
                }, ensure_ascii=False).encode('utf-8'))

                app_log(f"已保存比赛结果: {file_path}")
            except Exception as e:
                log_api_error('/api/save-match-result', e)
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': False,
                    'error': str(e)
                }, ensure_ascii=False).encode('utf-8'))

        # 处理获取Result文件内容请求
        elif self.path == '/api/get-result-file':
            content_length = int(self.headers.get('Content-Length', '0'))
            post_data = self.rfile.read(content_length) if content_length > 0 else b'{}'

            try:
                data = json.loads(post_data.decode('utf-8'))
                filename = safe_json_filename(data.get('filename'), 'match_result')
                file_path = os.path.join(result_dir, filename)

                if not os.path.exists(file_path):
                    self.send_response(404)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        'success': False,
                        'error': '文件不存在'
                    }, ensure_ascii=False).encode('utf-8'))
                    return

                with open(file_path, 'r', encoding='utf-8') as f:
                    content = json.load(f)

                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': True,
                    'filename': filename,
                    'content': content
                }, ensure_ascii=False).encode('utf-8'))
            except Exception as e:
                log_api_error('/api/get-result-file', e)
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': False,
                    'error': str(e)
                }, ensure_ascii=False).encode('utf-8'))

        # 处理保存ResultDiagram图片请求
        elif self.path == '/api/save-result-diagram':
            content_length = int(self.headers.get('Content-Length', '0'))
            post_data = self.rfile.read(content_length) if content_length > 0 else b'{}'

            try:
                data = json.loads(post_data.decode('utf-8'))
                items = data.get('items')
                if not isinstance(items, list) or len(items) == 0:
                    self.send_response(400)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        'success': False,
                        'error': '缺少有效的图片列表'
                    }, ensure_ascii=False).encode('utf-8'))
                    return

                saved_files = []
                os.makedirs(result_diagram_dir, exist_ok=True)

                for index, item in enumerate(items):
                    if not isinstance(item, dict):
                        continue
                    filename = safe_png_filename(item.get('filename'), f'result_diagram_{index + 1}')
                    content_base64 = str(item.get('content_base64') or '').strip()
                    if not content_base64:
                        continue

                    image_bytes = base64.b64decode(content_base64, validate=True)
                    file_path = os.path.join(result_diagram_dir, filename)
                    with open(file_path, 'wb') as image_file:
                        image_file.write(image_bytes)
                    saved_files.append(filename)
                    app_log(f"已保存ResultDiagram图片: {file_path}")

                if len(saved_files) == 0:
                    raise ValueError('没有可保存的有效图片数据')

                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': True,
                    'saved_files': saved_files,
                    'target_dir': result_diagram_dir
                }, ensure_ascii=False).encode('utf-8'))
            except Exception as e:
                log_api_error('/api/save-result-diagram', e)
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': False,
                    'error': str(e)
                }, ensure_ascii=False).encode('utf-8'))

        # 处理删除Character文件请求
        elif self.path == '/api/delete-character-file':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                # 解析JSON数据
                data = json.loads(post_data.decode('utf-8'))
                files = data.get('files')
                
                if not files or not isinstance(files, list):
                    self.send_response(400)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'success': False, 'error': '缺少文件列表或格式错误'}).encode('utf-8'))
                    return
                
                # 删除文件
                deleted_count = 0
                for file_name in files:
                    file_path = os.path.join(character_dir, file_name)
                    if os.path.exists(file_path):
                        os.remove(file_path)
                        deleted_count += 1
                        app_log(f"已删除Character文件: {file_path}")
                
                # 发送成功响应
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': True,
                    'message': f'成功删除 {deleted_count} 个文件',
                    'deleted_count': deleted_count
                }).encode('utf-8'))
                
            except Exception as e:
                log_api_error('/api/delete-character-file', e)
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': False,
                    'error': str(e)
                }).encode('utf-8'))
        
        # 处理获取Character文件内容请求
        elif self.path == '/api/get-character-file':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                # 解析JSON数据
                data = json.loads(post_data.decode('utf-8'))
                filename = data.get('filename')
                
                if not filename:
                    self.send_response(400)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'success': False, 'error': '缺少文件名'}).encode('utf-8'))
                    return
                
                # 创建文件路径
                file_path = os.path.join(character_dir, filename)
                
                if not os.path.exists(file_path):
                    self.send_response(404)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'success': False, 'error': '文件不存在'}).encode('utf-8'))
                    return
                
                # 读取文件内容
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = json.load(f)
                
                # 发送成功响应
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': True,
                    'content': content
                }).encode('utf-8'))
                
            except Exception as e:
                log_api_error('/api/get-character-file', e)
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': False,
                    'error': str(e)
                }).encode('utf-8'))
        
        else:
            # 其他POST请求返回404
            self.send_response(404)
            self.end_headers()
    
    # 允许跨域请求
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

        request_path = getattr(self, 'path', '').split('?', 1)[0].lower()
        if request_path and not request_path.startswith('/api/'):
            if (
                request_path == '/'
                or request_path.endswith('.html')
                or request_path.endswith('.css')
                or request_path.endswith('.js')
                or request_path.endswith('.json')
            ):
                # 本地开发场景强制禁缓存，避免重启后出现旧样式/旧脚本。
                self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
                self.send_header('Pragma', 'no-cache')
                self.send_header('Expires', '0')
        super().end_headers()

# 使用自定义处理器
Handler = CustomHTTPRequestHandler


class ThreadingTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True


# 检测端口是否被占用
def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(1)
        return s.connect_ex(('localhost', port)) == 0

# 查找可用端口
def find_available_port(start_port=DEFAULT_START_PORT, max_attempts=DEFAULT_PORT_SCAN_ATTEMPTS):
    for port in range(start_port, start_port + max_attempts):
        if not is_port_in_use(port):
            return port
    return None

def preload_memory_package():
    try:
        refresh_memory_test_package_on_startup()
    except Exception as preload_error:
        app_log(f"[TestPackage] 预构建失败: {preload_error}", 'WARN')
        app_log("[TestPackage] 可继续启动服务器，但内存加载器将不可用，直到重启并成功预构建。", 'WARN')


def create_http_server(start_port=DEFAULT_START_PORT, max_attempts=DEFAULT_PORT_SCAN_ATTEMPTS):
    candidate_port = start_port
    attempts = 0

    while attempts < max_attempts:
        if is_port_in_use(candidate_port):
            attempts += 1
            candidate_port += 1
            continue

        try:
            httpd = ThreadingTCPServer(("", candidate_port), Handler)
            return httpd, candidate_port
        except OSError as bind_error:
            app_log(f"端口 {candidate_port} 绑定失败: {bind_error}", 'WARN')
            attempts += 1
            candidate_port += 1

    raise RuntimeError('无法找到可用端口，请关闭占用端口的程序后重试')


def run_cli_server(open_browser_on_start=True):
    app_log("正在启动服务器...")
    app_log(f"静态资源根目录: {current_dir}")
    app_log(f"端口分配策略: 从 {DEFAULT_START_PORT} 开始，最多尝试 {DEFAULT_PORT_SCAN_ATTEMPTS} 个端口")
    preload_memory_package()

    try:
        httpd, port = create_http_server()
    except Exception as create_error:
        app_log(str(create_error), 'ERROR')
        return 1

    url = f"http://localhost:{port}"
    app_log(f"服务器已启动: {url}")

    if open_browser_on_start:
        try:
            webbrowser.open(url)
            app_log(f"已尝试打开浏览器: {url}")
        except Exception as browser_error:
            app_log(f"浏览器打开失败: {browser_error}", 'WARN')

    app_log("按 Ctrl+C 停止服务器")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        app_log("收到 Ctrl+C，正在关闭服务器...")
    except Exception as serve_error:
        app_log(f"服务运行异常: {serve_error}", 'ERROR')
        app_log(traceback.format_exc(), 'ERROR')
    finally:
        try:
            httpd.shutdown()
        except Exception:
            pass
        httpd.server_close()
        app_log("服务器已关闭")

    return 0


if TK_AVAILABLE:
    class RoundedButton(tk.Canvas):
        def __init__(
            self,
            master,
            text='',
            command=None,
            font_def=None,
            min_width=96,
            height=36,
            radius=14,
            horizontal_padding=18
        ):
            super().__init__(
                master,
                width=min_width,
                height=height,
                highlightthickness=0,
                bd=0,
                relief=tk.FLAT
            )
            self._text = str(text or '')
            self._command = command
            self._font_def = font_def or ('TkDefaultFont', 10)
            self._min_width = max(52, int(min_width))
            self._height = max(26, int(height))
            self._radius = max(8, int(radius))
            self._horizontal_padding = max(8, int(horizontal_padding))
            self._enabled = True
            self._hover = False
            self._pressed = False
            self._style = {
                'surface_bg': '#ffffff',
                'bg': '#ffffff',
                'hover_bg': '#f4f7fb',
                'active_bg': '#eaf2ff',
                'fg': '#1e5aa8',
                'disabled_bg': '#d8dfeb',
                'disabled_fg': '#8b97aa',
                'border': '#c7dcff'
            }

            self.configure(cursor='hand2')
            self.bind('<Enter>', self._on_enter)
            self.bind('<Leave>', self._on_leave)
            self.bind('<ButtonPress-1>', self._on_press)
            self.bind('<ButtonRelease-1>', self._on_release)
            self.bind('<Configure>', lambda _event: self._draw())
            self._refresh_size()
            self._draw()

        def _measure_text_width(self):
            try:
                font_obj = tkfont.Font(font=self._font_def)
                return font_obj.measure(self._text)
            except Exception:
                return max(32, len(self._text) * 12)

        def _refresh_size(self):
            width = max(self._min_width, self._measure_text_width() + self._horizontal_padding * 2)
            self.configure(width=width, height=self._height)

        def set_text(self, text):
            self._text = str(text or '')
            self._refresh_size()
            self._draw()

        def set_command(self, command):
            self._command = command

        def set_enabled(self, enabled):
            self._enabled = bool(enabled)
            if not self._enabled:
                self._hover = False
                self._pressed = False
            self.configure(cursor='hand2' if self._enabled else 'arrow')
            self._draw()

        def is_enabled(self):
            return self._enabled

        def apply_style(self, style_payload):
            if isinstance(style_payload, dict):
                self._style.update(style_payload)
            self.configure(bg=self._style.get('surface_bg', '#ffffff'))
            self._draw()

        def _on_enter(self, _event):
            if not self._enabled:
                return
            self._hover = True
            self._draw()

        def _on_leave(self, _event):
            if not self._enabled:
                return
            self._hover = False
            self._pressed = False
            self._draw()

        def _on_press(self, _event):
            if not self._enabled:
                return
            self._pressed = True
            self._draw()

        def _on_release(self, _event):
            if not self._enabled:
                return

            should_fire = self._pressed and self._hover
            self._pressed = False
            self._draw()
            if should_fire and callable(self._command):
                self._command()

        def _draw_rounded_rect(self, x1, y1, x2, y2, radius, fill_color, border_color, border_width=1):
            radius = max(2, min(radius, (x2 - x1) / 2, (y2 - y1) / 2))
            self.create_rectangle(x1 + radius, y1, x2 - radius, y2, fill=fill_color, outline='')
            self.create_rectangle(x1, y1 + radius, x2, y2 - radius, fill=fill_color, outline='')
            self.create_arc(x1, y1, x1 + radius * 2, y1 + radius * 2, start=90, extent=90, fill=fill_color, outline='')
            self.create_arc(x2 - radius * 2, y1, x2, y1 + radius * 2, start=0, extent=90, fill=fill_color, outline='')
            self.create_arc(x1, y2 - radius * 2, x1 + radius * 2, y2, start=180, extent=90, fill=fill_color, outline='')
            self.create_arc(x2 - radius * 2, y2 - radius * 2, x2, y2, start=270, extent=90, fill=fill_color, outline='')

            if border_width > 0 and border_color:
                self.create_line(x1 + radius, y1, x2 - radius, y1, fill=border_color, width=border_width)
                self.create_line(x1 + radius, y2, x2 - radius, y2, fill=border_color, width=border_width)
                self.create_line(x1, y1 + radius, x1, y2 - radius, fill=border_color, width=border_width)
                self.create_line(x2, y1 + radius, x2, y2 - radius, fill=border_color, width=border_width)
                self.create_arc(
                    x1, y1, x1 + radius * 2, y1 + radius * 2,
                    start=90, extent=90, style=tk.ARC, outline=border_color, width=border_width
                )
                self.create_arc(
                    x2 - radius * 2, y1, x2, y1 + radius * 2,
                    start=0, extent=90, style=tk.ARC, outline=border_color, width=border_width
                )
                self.create_arc(
                    x1, y2 - radius * 2, x1 + radius * 2, y2,
                    start=180, extent=90, style=tk.ARC, outline=border_color, width=border_width
                )
                self.create_arc(
                    x2 - radius * 2, y2 - radius * 2, x2, y2,
                    start=270, extent=90, style=tk.ARC, outline=border_color, width=border_width
                )

        def _draw(self):
            self.delete('all')
            width = float(self.cget('width'))
            height = float(self.cget('height'))
            x1, y1 = 1, 1
            x2, y2 = max(2, width - 1), max(2, height - 1)

            if not self._enabled:
                bg_color = self._style.get('disabled_bg', '#d8dfeb')
                fg_color = self._style.get('disabled_fg', '#8b97aa')
            elif self._pressed:
                bg_color = self._style.get('active_bg', self._style.get('bg', '#ffffff'))
                fg_color = self._style.get('fg', '#1e5aa8')
            elif self._hover:
                bg_color = self._style.get('hover_bg', self._style.get('bg', '#ffffff'))
                fg_color = self._style.get('fg', '#1e5aa8')
            else:
                bg_color = self._style.get('bg', '#ffffff')
                fg_color = self._style.get('fg', '#1e5aa8')

            border_color = self._style.get('border', '#c7dcff')
            self._draw_rounded_rect(x1, y1, x2, y2, self._radius, bg_color, border_color, border_width=1)
            self.create_text(
                width / 2,
                height / 2,
                text=self._text,
                fill=fg_color,
                font=self._font_def
            )


class ServerDebugApp:
    FONT_NAME = "微软雅黑"
    FONT_FILES = [
        r"C:\Windows\Fonts\msyh.ttc",
        r"C:\Windows\Fonts\msyhl.ttc",
        r"C:\Windows\Fonts\msyhbd.ttc"
    ]
    FONT_FAMILY_HINTS = {
        'msyh.ttc': '微软雅黑',
        'msyhl.ttc': '微软雅黑 Light',
        'msyhbd.ttc': '微软雅黑'
    }

    def __init__(self):
        self.root = tk.Tk()
        self.root.title("XMaoMaiContestTools Server Debug")
        self.root.geometry("900x580")
        self.root.minsize(760, 460)

        self._registered_font_files = []
        self.font_source_path = None
        self.FONT_NAME = self._resolve_font_family()

        self.httpd = None
        self.server_thread = None
        self.current_port = None
        self.current_url = ''
        self.download_music_running = False
        self.download_illustration_running = False
        self.initialize_running = False
        self.compile_cache_running = False
        self.illustration_progress_dialog = None
        self.illustration_progress_value = None
        self.illustration_progress_status_var = None
        self.illustration_progress_detail_var = None

        self.themes = {
            'white': {
                'root_bg': '#eaf2ff',
                'panel_bg': '#ffffff',
                'sub_bg': '#f4f9ff',
                'border': '#c7dcff',
                'outer_border': '#9fc0ef',
                'title_fg': '#1e5aa8',
                'text_fg': '#1f3f66',
                'btn_primary_bg': '#4facfe',
                'btn_primary_active': '#399aee',
                'btn_primary_fg': '#ffffff',
                'btn_secondary_bg': '#ffffff',
                'btn_secondary_active': '#e6f2ff',
                'btn_secondary_fg': '#1e5aa8',
                'btn_disabled_bg': '#b9cee8',
                'btn_disabled_fg': '#f1f6ff',
                'log_bg': '#f4f9ff',
                'log_fg': '#17355b'
            },
            'black': {
                'root_bg': '#0f1115',
                'panel_bg': '#171a20',
                'sub_bg': '#11161d',
                'border': '#2f3641',
                'outer_border': '#545f71',
                'title_fg': '#ffffff',
                'text_fg': '#d9e0eb',
                'btn_primary_bg': '#ffffff',
                'btn_primary_active': '#e8e8e8',
                'btn_primary_fg': '#101216',
                'btn_secondary_bg': '#222a34',
                'btn_secondary_active': '#2f3a47',
                'btn_secondary_fg': '#f4f7fb',
                'btn_disabled_bg': '#2a313b',
                'btn_disabled_fg': '#7f8895',
                'log_bg': '#10151c',
                'log_fg': '#dde6f5'
            }
        }
        self.theme_name = 'white'

        self.status_text = tk.StringVar(value="状态: 未启动")
        self.url_text = tk.StringVar(value="地址: -")
        self.port_text = tk.StringVar(value="端口: -")

        self._build_ui()
        self._apply_theme()
        self._set_running(False)
        self._drain_log_queue()
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)

    def _resolve_font_file(self):
        for font_file in self.FONT_FILES:
            if os.path.exists(font_file):
                return font_file

        if messagebox:
            messagebox.showwarning(
                "字体缺失",
                "未在 C:\\Windows\\Fonts 中找到 msyh.ttc / msyhl.ttc / msyhbd.ttc。\n请手动选择一个 .ttc 字体文件。"
            )

        initial_dir = r"C:\Windows\Fonts" if os.path.isdir(r"C:\Windows\Fonts") else current_dir
        if filedialog:
            selected = filedialog.askopenfilename(
                title="选择 TTC 字体文件",
                initialdir=initial_dir,
                filetypes=[("TTC 字体", "*.ttc"), ("所有文件", "*.*")]
            )
            return selected or None

        return None

    def _register_font_file(self, font_file):
        if os.name != 'nt' or not font_file:
            return False

        try:
            FR_PRIVATE = 0x10
            added = ctypes.windll.gdi32.AddFontResourceExW(str(font_file), FR_PRIVATE, 0)
            if added > 0:
                self._registered_font_files.append(font_file)
                app_log(f"已加载字体文件: {font_file}")
                return True
            return False
        except Exception as error:
            app_log(f"加载字体文件失败: {font_file}, error={error}", 'WARN')
            return False

    def _resolve_font_family(self):
        font_file = self._resolve_font_file()
        if not font_file:
            app_log("未选择字体文件，已回退为系统默认字体。", 'WARN')
            return 'TkDefaultFont'

        self.font_source_path = font_file
        self._register_font_file(font_file)

        family_candidates = []
        file_name = os.path.basename(font_file).lower()
        hinted_family = self.FONT_FAMILY_HINTS.get(file_name)
        if hinted_family:
            family_candidates.append(hinted_family)

        family_candidates.extend(['微软雅黑', 'Microsoft YaHei', '微软雅黑 Light'])

        try:
            installed_families = set(tkfont.families(self.root))
        except Exception:
            installed_families = set()

        for family in family_candidates:
            if family in installed_families:
                app_log(f"使用字体: {family} ({font_file})")
                return family

        if hinted_family:
            app_log(f"字体族未出现在系统列表中，尝试直接使用: {hinted_family}", 'WARN')
            return hinted_family

        app_log(f"无法识别字体族，已回退系统默认字体: {font_file}", 'WARN')
        return 'TkDefaultFont'

    def _unregister_font_files(self):
        if os.name != 'nt' or not self._registered_font_files:
            return

        FR_PRIVATE = 0x10
        for font_file in self._registered_font_files:
            try:
                ctypes.windll.gdi32.RemoveFontResourceExW(str(font_file), FR_PRIVATE, 0)
            except Exception:
                pass
        self._registered_font_files.clear()

    def _theme(self):
        return self.themes[self.theme_name]

    def _build_ui(self):
        self.shell_frame = tk.Frame(self.root, bd=0, highlightthickness=2)
        self.shell_frame.pack(fill=tk.BOTH, expand=True, padx=12, pady=12)

        self.header_frame = tk.Frame(self.shell_frame, bd=0, highlightthickness=1)
        self.header_frame.pack(fill=tk.X, padx=14, pady=(14, 10))

        self.title_label = tk.Label(
            self.header_frame,
            text="XMaoMaiContestTools - OvO",
            font=(self.FONT_NAME, 16, "bold")
        )
        self.title_label.pack(anchor="w", padx=16, pady=(12, 4))

        self.status_label = tk.Label(
            self.header_frame,
            textvariable=self.status_text,
            font=(self.FONT_NAME, 10)
        )
        self.status_label.pack(anchor="w", padx=16)

        self.port_label = tk.Label(
            self.header_frame,
            textvariable=self.port_text,
            font=(self.FONT_NAME, 10)
        )
        self.port_label.pack(anchor="w", padx=16)

        self.url_label = tk.Label(
            self.header_frame,
            textvariable=self.url_text,
            font=(self.FONT_NAME, 10)
        )
        self.url_label.pack(anchor="w", padx=16, pady=(0, 12))

        self.controls_frame = tk.Frame(self.shell_frame, bd=0)
        self.controls_frame.pack(fill=tk.X, padx=14, pady=(0, 4))

        self.primary_controls_frame = tk.Frame(self.controls_frame, bd=0)
        self.primary_controls_frame.pack(fill=tk.X, pady=(0, 8))

        self.start_btn = RoundedButton(
            self.primary_controls_frame,
            text="启动服务",
            command=self._start_server,
            font_def=(self.FONT_NAME, 10),
            min_width=104,
            height=38
        )
        self.start_btn.pack(side=tk.LEFT)

        self.stop_btn = RoundedButton(
            self.primary_controls_frame,
            text="停止服务",
            command=self._stop_server,
            font_def=(self.FONT_NAME, 10),
            min_width=104,
            height=38
        )
        self.stop_btn.pack(side=tk.LEFT, padx=(8, 0))

        self.open_btn = RoundedButton(
            self.primary_controls_frame,
            text="打开浏览器",
            command=self._open_browser,
            font_def=(self.FONT_NAME, 10),
            min_width=122,
            height=38
        )
        self.open_btn.pack(side=tk.LEFT, padx=(8, 0))

        self.clear_btn = RoundedButton(
            self.primary_controls_frame,
            text="清空日志",
            command=self._clear_logs,
            font_def=(self.FONT_NAME, 10),
            min_width=100,
            height=38
        )
        self.clear_btn.pack(side=tk.LEFT, padx=(8, 0))

        self.theme_btn = RoundedButton(
            self.primary_controls_frame,
            text="切换黑色",
            command=self._toggle_theme,
            font_def=(self.FONT_NAME, 10),
            min_width=112,
            height=38
        )
        self.theme_btn.pack(side=tk.LEFT, padx=(8, 0))

        self.download_controls_frame = tk.Frame(self.controls_frame, bd=0)
        self.download_controls_frame.pack(fill=tk.X, pady=(0, 8))

        self.download_music_btn = RoundedButton(
            self.download_controls_frame,
            text="下载曲库",
            command=self._download_music_library,
            font_def=(self.FONT_NAME, 10),
            min_width=112,
            height=38
        )
        self.download_music_btn.pack(side=tk.LEFT)

        self.download_illustration_btn = RoundedButton(
            self.download_controls_frame,
            text="下载曲绘",
            command=self._download_illustrations,
            font_def=(self.FONT_NAME, 10),
            min_width=112,
            height=38
        )
        self.download_illustration_btn.pack(side=tk.LEFT, padx=(8, 0))

        self.download_hint_btn = RoundedButton(
            self.download_controls_frame,
            text="？",
            command=self._show_download_hint,
            font_def=(self.FONT_NAME, 10, "bold"),
            min_width=44,
            height=38
        )
        self.download_hint_btn.pack(side=tk.LEFT, padx=(8, 0))

        self.open_wallpaper_folder_btn = RoundedButton(
            self.download_controls_frame,
            text="打开壁纸文件夹",
            command=lambda: self._open_folder(background_dir, create_if_missing=True, folder_label='壁纸文件夹'),
            font_def=(self.FONT_NAME, 10),
            min_width=150,
            height=38
        )
        self.open_wallpaper_folder_btn.pack(side=tk.LEFT, padx=(8, 0))

        self.initialize_btn = RoundedButton(
            self.download_controls_frame,
            text="初始化软件",
            command=self._initialize_software_prompt,
            font_def=(self.FONT_NAME, 10),
            min_width=126,
            height=38
        )
        self.initialize_btn.pack(side=tk.LEFT, padx=(8, 0))

        self.compile_cache_btn = RoundedButton(
            self.download_controls_frame,
            text="编译缓存包",
            command=self._compile_memory_package_prompt,
            font_def=(self.FONT_NAME, 10),
            min_width=126,
            height=38
        )
        self.compile_cache_btn.pack(side=tk.LEFT, padx=(8, 0))

        self.shortcut_frame = tk.Frame(self.shell_frame, bd=0)
        self.shortcut_frame.pack(fill=tk.X, padx=14, pady=(0, 10))

        self.open_screenshot_folder_btn = RoundedButton(
            self.shortcut_frame,
            text="打开截图文件夹",
            command=lambda: self._open_folder(result_diagram_dir, create_if_missing=True, folder_label='截图文件夹'),
            font_def=(self.FONT_NAME, 10),
            min_width=138,
            height=36
        )
        self.open_screenshot_folder_btn.pack(side=tk.LEFT)

        self.open_character_folder_btn = RoundedButton(
            self.shortcut_frame,
            text="打开用户信息文件夹",
            command=lambda: self._open_folder(character_dir, create_if_missing=True, folder_label='用户信息文件夹'),
            font_def=(self.FONT_NAME, 10),
            min_width=168,
            height=36
        )
        self.open_character_folder_btn.pack(side=tk.LEFT, padx=(8, 0))

        self.open_song_folder_btn = RoundedButton(
            self.shortcut_frame,
            text="打开歌曲文件夹",
            command=lambda: self._open_folder(data_dir, create_if_missing=True, folder_label='歌曲文件夹'),
            font_def=(self.FONT_NAME, 10),
            min_width=140,
            height=36
        )
        self.open_song_folder_btn.pack(side=tk.LEFT, padx=(8, 0))

        self.open_mai_list_folder_btn = RoundedButton(
            self.shortcut_frame,
            text="打开歌单文件夹",
            command=lambda: self._open_folder(mai_list_dir, create_if_missing=True, folder_label='歌单文件夹'),
            font_def=(self.FONT_NAME, 10),
            min_width=150,
            height=36
        )
        self.open_mai_list_folder_btn.pack(side=tk.LEFT, padx=(8, 0))

        self.open_result_folder_btn = RoundedButton(
            self.shortcut_frame,
            text="打开成绩文件夹",
            command=lambda: self._open_folder(result_dir, create_if_missing=True, folder_label='成绩文件夹'),
            font_def=(self.FONT_NAME, 10),
            min_width=140,
            height=36
        )
        self.open_result_folder_btn.pack(side=tk.LEFT, padx=(8, 0))

        self.log_wrap = tk.Frame(self.shell_frame, bd=0, highlightthickness=1)
        self.log_wrap.pack(fill=tk.BOTH, expand=True, padx=14, pady=(0, 14))

        self.log_title_label = tk.Label(
            self.log_wrap,
            text="运行日志",
            font=(self.FONT_NAME, 11, "bold")
        )
        self.log_title_label.pack(anchor="w", padx=12, pady=(10, 6))

        self.text_container = tk.Frame(self.log_wrap, bd=0, highlightthickness=1)
        self.text_container.pack(fill=tk.BOTH, expand=True, padx=12, pady=(0, 12))

        self.log_text = tk.Text(
            self.text_container,
            height=8,
            relief=tk.FLAT,
            bd=0,
            font=(self.FONT_NAME, 10),
            wrap=tk.NONE
        )
        self.log_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        self.log_text.configure(state=tk.DISABLED)

        self.y_scroll = tk.Scrollbar(self.text_container, orient=tk.VERTICAL, command=self.log_text.yview)
        self.y_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        self.log_text.configure(yscrollcommand=self.y_scroll.set)

    def _apply_theme(self):
        theme = self._theme()
        self.root.configure(bg=theme['root_bg'])
        self.shell_frame.configure(bg=theme['root_bg'], highlightbackground=theme['outer_border'], highlightcolor=theme['outer_border'])
        self.header_frame.configure(bg=theme['panel_bg'], highlightbackground=theme['border'], highlightcolor=theme['border'])
        self.controls_frame.configure(bg=theme['root_bg'])
        self.primary_controls_frame.configure(bg=theme['root_bg'])
        self.download_controls_frame.configure(bg=theme['root_bg'])
        self.shortcut_frame.configure(bg=theme['root_bg'])
        self.log_wrap.configure(bg=theme['panel_bg'], highlightbackground=theme['border'], highlightcolor=theme['border'])
        self.text_container.configure(bg=theme['sub_bg'], highlightbackground=theme['border'], highlightcolor=theme['border'])

        label_pairs = [
            (self.title_label, (self.FONT_NAME, 16, "bold"), theme['title_fg']),
            (self.status_label, (self.FONT_NAME, 10), theme['text_fg']),
            (self.port_label, (self.FONT_NAME, 10), theme['text_fg']),
            (self.url_label, (self.FONT_NAME, 10), theme['text_fg']),
            (self.log_title_label, (self.FONT_NAME, 11, "bold"), theme['title_fg'])
        ]
        for label, font_def, fg_color in label_pairs:
            label.configure(bg=theme['panel_bg'], fg=fg_color, font=font_def)

        self.log_text.configure(
            bg=theme['log_bg'],
            fg=theme['log_fg'],
            insertbackground=theme['log_fg'],
            highlightthickness=0
        )
        self.y_scroll.configure(
            bg=theme['sub_bg'],
            activebackground=theme['border'],
            troughcolor=theme['panel_bg'],
            highlightbackground=theme['border'],
            highlightcolor=theme['border'],
            bd=0
        )

        self._style_button(self.start_btn, 'primary')
        self._style_button(self.stop_btn, 'disabled')
        self._style_button(self.open_btn, 'secondary')
        self._style_button(self.clear_btn, 'secondary')
        self._style_button(self.download_music_btn, 'secondary')
        self._style_button(self.download_illustration_btn, 'secondary')
        self._style_button(self.download_hint_btn, 'secondary')
        self._style_button(self.theme_btn, 'secondary')
        self._style_button(self.open_screenshot_folder_btn, 'secondary')
        self._style_button(self.open_character_folder_btn, 'secondary')
        self._style_button(self.open_song_folder_btn, 'secondary')
        self._style_button(self.open_mai_list_folder_btn, 'secondary')
        self._style_button(self.open_wallpaper_folder_btn, 'secondary')
        self._style_button(self.initialize_btn, 'secondary')
        self._style_button(self.compile_cache_btn, 'secondary')
        self._style_button(self.open_result_folder_btn, 'secondary')

        self.theme_btn.set_text('切换黑色' if self.theme_name == 'white' else '切换白色')
        self._set_running(self.httpd is not None)

    def _style_button(self, button, style='secondary'):
        theme = self._theme()
        if isinstance(button, RoundedButton):
            if style == 'primary':
                button.apply_style({
                    'surface_bg': theme['root_bg'],
                    'bg': theme['btn_primary_bg'],
                    'hover_bg': theme['btn_primary_active'],
                    'active_bg': theme['btn_primary_active'],
                    'fg': theme['btn_primary_fg'],
                    'disabled_bg': theme['btn_disabled_bg'],
                    'disabled_fg': theme['btn_disabled_fg'],
                    'border': theme['border']
                })
                return

            if style == 'disabled':
                button.apply_style({
                    'surface_bg': theme['root_bg'],
                    'bg': theme['btn_disabled_bg'],
                    'hover_bg': theme['btn_disabled_bg'],
                    'active_bg': theme['btn_disabled_bg'],
                    'fg': theme['btn_disabled_fg'],
                    'disabled_bg': theme['btn_disabled_bg'],
                    'disabled_fg': theme['btn_disabled_fg'],
                    'border': theme['border']
                })
                return

            button.apply_style({
                'surface_bg': theme['root_bg'],
                'bg': theme['btn_secondary_bg'],
                'hover_bg': theme['btn_secondary_active'],
                'active_bg': theme['btn_secondary_active'],
                'fg': theme['btn_secondary_fg'],
                'disabled_bg': theme['btn_disabled_bg'],
                'disabled_fg': theme['btn_disabled_fg'],
                'border': theme['border']
            })
            return

    def _set_running(self, running):
        if running:
            self.start_btn.set_enabled(False)
            self._style_button(self.stop_btn, 'primary')
            self.stop_btn.set_enabled(True)
            self.open_btn.set_enabled(True)
        else:
            self.start_btn.set_enabled(True)
            self._style_button(self.stop_btn, 'disabled')
            self.stop_btn.set_enabled(False)
            self.open_btn.set_enabled(False)

    def _append_log(self, line):
        self.log_text.configure(state=tk.NORMAL)
        self.log_text.insert(tk.END, f"{line}\n")
        self.log_text.see(tk.END)
        self.log_text.configure(state=tk.DISABLED)

    def _drain_log_queue(self):
        if not self.root.winfo_exists():
            return

        while True:
            try:
                line = LOG_QUEUE.get_nowait()
            except queue.Empty:
                break
            self._append_log(line)

        try:
            self.root.after(120, self._drain_log_queue)
        except tk.TclError:
            pass

    def _clear_logs(self):
        self.log_text.configure(state=tk.NORMAL)
        self.log_text.delete('1.0', tk.END)
        self.log_text.configure(state=tk.DISABLED)

    def _toggle_theme(self):
        self.theme_name = 'black' if self.theme_name == 'white' else 'white'
        self._apply_theme()

    def _open_browser(self):
        if not self.current_url:
            return
        try:
            webbrowser.open(self.current_url)
            app_log(f"手动打开浏览器: {self.current_url}")
        except Exception as error:
            app_log(f"浏览器打开失败: {error}", 'WARN')

    def _open_folder(self, target_dir, create_if_missing=False, folder_label='文件夹'):
        folder_path = os.path.abspath(str(target_dir or current_dir))
        try:
            if create_if_missing:
                os.makedirs(folder_path, exist_ok=True)
            elif not os.path.isdir(folder_path):
                raise FileNotFoundError(f'目录不存在: {folder_path}')

            if os.name == 'nt':
                os.startfile(folder_path)
            elif sys.platform == 'darwin':
                subprocess.Popen(['open', folder_path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            else:
                subprocess.Popen(['xdg-open', folder_path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

            app_log(f"已打开{folder_label}: {folder_path}")
        except Exception as error:
            app_log(f"打开{folder_label}失败: {error}", 'WARN')
            if messagebox:
                try:
                    messagebox.showwarning("打开失败", f"无法打开{folder_label}：\n{folder_path}\n\n{error}")
                except Exception:
                    pass

    def _center_modal(self, dialog):
        try:
            dialog.update_idletasks()
            width = dialog.winfo_width()
            height = dialog.winfo_height()
            root_x = self.root.winfo_rootx()
            root_y = self.root.winfo_rooty()
            root_width = self.root.winfo_width()
            root_height = self.root.winfo_height()
            x = root_x + max(0, (root_width - width) // 2)
            y = root_y + max(0, (root_height - height) // 2)
            dialog.geometry(f"+{x}+{y}")
        except Exception:
            pass

    def _show_choice_dialog(self, title, message, buttons, detail_text='', default_value=None):
        if not buttons:
            return default_value

        theme = self._theme()
        if default_value is None:
            default_value = buttons[0].get('value')

        result = {'value': default_value}
        dialog = tk.Toplevel(self.root)
        dialog.title(str(title or '提示'))
        dialog.transient(self.root)
        dialog.resizable(False, False)
        dialog.configure(bg=theme['root_bg'])

        shell = tk.Frame(
            dialog,
            bg=theme['panel_bg'],
            bd=0,
            highlightthickness=1,
            highlightbackground=theme['border'],
            highlightcolor=theme['border']
        )
        shell.pack(fill=tk.BOTH, expand=True, padx=12, pady=12)

        title_label = tk.Label(
            shell,
            text=str(title or '提示'),
            bg=theme['panel_bg'],
            fg=theme['title_fg'],
            font=(self.FONT_NAME, 12, 'bold')
        )
        title_label.pack(anchor='w', padx=14, pady=(12, 6))

        message_label = tk.Label(
            shell,
            text=str(message or ''),
            bg=theme['panel_bg'],
            fg=theme['text_fg'],
            font=(self.FONT_NAME, 10),
            justify=tk.LEFT,
            wraplength=520
        )
        message_label.pack(anchor='w', padx=14, pady=(0, 10))

        if detail_text:
            detail_wrap = tk.Frame(
                shell,
                bg=theme['sub_bg'],
                bd=0,
                highlightthickness=1,
                highlightbackground=theme['border'],
                highlightcolor=theme['border']
            )
            detail_wrap.pack(fill=tk.BOTH, expand=True, padx=14, pady=(0, 10))

            detail_label = tk.Label(
                detail_wrap,
                text=str(detail_text),
                bg=theme['sub_bg'],
                fg=theme['text_fg'],
                font=(self.FONT_NAME, 9),
                justify=tk.LEFT,
                anchor='w',
                wraplength=500
            )
            detail_label.pack(fill=tk.BOTH, expand=True, padx=10, pady=8)

        button_row = tk.Frame(shell, bg=theme['panel_bg'])
        button_row.pack(fill=tk.X, padx=14, pady=(0, 14))

        def close_with(value):
            result['value'] = value
            try:
                dialog.grab_release()
            except Exception:
                pass
            dialog.destroy()

        dialog.protocol("WM_DELETE_WINDOW", lambda: close_with(default_value))

        first_button = None
        for index, button_spec in enumerate(buttons):
            button_value = button_spec.get('value')
            button_label = str(button_spec.get('label') or button_value or '确定')
            button_style = str(button_spec.get('style') or 'secondary')
            button = RoundedButton(
                button_row,
                text=button_label,
                command=lambda selected=button_value: close_with(selected),
                font_def=(self.FONT_NAME, 10),
                min_width=max(90, len(button_label) * 20),
                height=34
            )
            self._style_button(button, button_style)
            button.pack(side=tk.LEFT, padx=(0 if index == 0 else 8, 0))
            if first_button is None:
                first_button = button

        dialog.update_idletasks()
        self._center_modal(dialog)
        dialog.grab_set()
        dialog.focus_force()
        if first_button is not None:
            try:
                first_button.focus_set()
            except Exception:
                pass
        self.root.wait_window(dialog)
        return result['value']

    def _show_text_input_dialog(
        self,
        title,
        message,
        initial_value='',
        confirm_text='确认',
        cancel_text='取消',
        default_value=''
    ):
        theme = self._theme()
        result = {'value': default_value}

        dialog = tk.Toplevel(self.root)
        dialog.title(str(title or '输入'))
        dialog.transient(self.root)
        dialog.resizable(False, False)
        dialog.configure(bg=theme['root_bg'])

        shell = tk.Frame(
            dialog,
            bg=theme['panel_bg'],
            bd=0,
            highlightthickness=1,
            highlightbackground=theme['border'],
            highlightcolor=theme['border']
        )
        shell.pack(fill=tk.BOTH, expand=True, padx=12, pady=12)

        title_label = tk.Label(
            shell,
            text=str(title or '输入'),
            bg=theme['panel_bg'],
            fg=theme['title_fg'],
            font=(self.FONT_NAME, 12, 'bold')
        )
        title_label.pack(anchor='w', padx=14, pady=(12, 6))

        message_label = tk.Label(
            shell,
            text=str(message or ''),
            bg=theme['panel_bg'],
            fg=theme['text_fg'],
            font=(self.FONT_NAME, 10),
            justify=tk.LEFT,
            wraplength=520
        )
        message_label.pack(anchor='w', padx=14, pady=(0, 8))

        entry_var = tk.StringVar(value=str(initial_value or ''))
        entry = tk.Entry(
            shell,
            textvariable=entry_var,
            font=(self.FONT_NAME, 10),
            relief=tk.FLAT,
            bd=0,
            bg=theme['sub_bg'],
            fg=theme['text_fg'],
            insertbackground=theme['text_fg'],
            highlightthickness=1,
            highlightbackground=theme['border'],
            highlightcolor=theme['btn_primary_bg']
        )
        entry.pack(fill=tk.X, padx=14, pady=(0, 10), ipady=6)

        button_row = tk.Frame(shell, bg=theme['panel_bg'])
        button_row.pack(fill=tk.X, padx=14, pady=(0, 14))

        def confirm():
            value = str(entry_var.get() or '').strip()
            result['value'] = value if value else default_value
            try:
                dialog.grab_release()
            except Exception:
                pass
            dialog.destroy()

        def cancel():
            result['value'] = default_value
            try:
                dialog.grab_release()
            except Exception:
                pass
            dialog.destroy()

        dialog.protocol("WM_DELETE_WINDOW", cancel)
        entry.bind('<Return>', lambda _event: confirm())
        entry.bind('<Escape>', lambda _event: cancel())

        confirm_btn = RoundedButton(
            button_row,
            text=str(confirm_text or '确认'),
            command=confirm,
            font_def=(self.FONT_NAME, 10),
            min_width=96,
            height=34
        )
        self._style_button(confirm_btn, 'primary')
        confirm_btn.pack(side=tk.LEFT)

        cancel_btn = RoundedButton(
            button_row,
            text=str(cancel_text or '取消'),
            command=cancel,
            font_def=(self.FONT_NAME, 10),
            min_width=96,
            height=34
        )
        self._style_button(cancel_btn, 'secondary')
        cancel_btn.pack(side=tk.LEFT, padx=(8, 0))

        dialog.update_idletasks()
        self._center_modal(dialog)
        dialog.grab_set()
        entry.focus_set()
        entry.selection_range(0, tk.END)
        self.root.wait_window(dialog)
        return result['value']

    def _show_list_select_dialog(
        self,
        title,
        message,
        items,
        confirm_text='确认',
        cancel_text='取消',
        default_index=0
    ):
        if not items:
            return None

        theme = self._theme()
        result = {'value': None}

        dialog = tk.Toplevel(self.root)
        dialog.title(str(title or '选择'))
        dialog.transient(self.root)
        dialog.resizable(False, False)
        dialog.configure(bg=theme['root_bg'])

        shell = tk.Frame(
            dialog,
            bg=theme['panel_bg'],
            bd=0,
            highlightthickness=1,
            highlightbackground=theme['border'],
            highlightcolor=theme['border']
        )
        shell.pack(fill=tk.BOTH, expand=True, padx=12, pady=12)

        title_label = tk.Label(
            shell,
            text=str(title or '选择'),
            bg=theme['panel_bg'],
            fg=theme['title_fg'],
            font=(self.FONT_NAME, 12, 'bold')
        )
        title_label.pack(anchor='w', padx=14, pady=(12, 6))

        message_label = tk.Label(
            shell,
            text=str(message or ''),
            bg=theme['panel_bg'],
            fg=theme['text_fg'],
            font=(self.FONT_NAME, 10),
            justify=tk.LEFT,
            wraplength=560
        )
        message_label.pack(anchor='w', padx=14, pady=(0, 8))

        list_wrap = tk.Frame(
            shell,
            bg=theme['sub_bg'],
            bd=0,
            highlightthickness=1,
            highlightbackground=theme['border'],
            highlightcolor=theme['border']
        )
        list_wrap.pack(fill=tk.BOTH, expand=True, padx=14, pady=(0, 10))

        listbox = tk.Listbox(
            list_wrap,
            relief=tk.FLAT,
            bd=0,
            activestyle='none',
            bg=theme['sub_bg'],
            fg=theme['text_fg'],
            selectbackground=theme['btn_primary_bg'],
            selectforeground=theme['btn_primary_fg'],
            font=(self.FONT_NAME, 10),
            height=min(12, max(4, len(items)))
        )
        listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(8, 0), pady=8)

        y_scroll = tk.Scrollbar(list_wrap, orient=tk.VERTICAL, command=listbox.yview)
        y_scroll.pack(side=tk.RIGHT, fill=tk.Y, padx=(0, 8), pady=8)
        listbox.configure(yscrollcommand=y_scroll.set)

        for item in items:
            label_text = str(item.get('label') if isinstance(item, dict) else item)
            listbox.insert(tk.END, label_text)

        safe_default_index = max(0, min(int(default_index), len(items) - 1))
        listbox.selection_set(safe_default_index)
        listbox.see(safe_default_index)

        button_row = tk.Frame(shell, bg=theme['panel_bg'])
        button_row.pack(fill=tk.X, padx=14, pady=(0, 14))

        def confirm():
            selected = listbox.curselection()
            if not selected:
                return
            index = int(selected[0])
            result['value'] = items[index]
            try:
                dialog.grab_release()
            except Exception:
                pass
            dialog.destroy()

        def cancel():
            result['value'] = None
            try:
                dialog.grab_release()
            except Exception:
                pass
            dialog.destroy()

        dialog.protocol("WM_DELETE_WINDOW", cancel)
        listbox.bind('<Double-Button-1>', lambda _event: confirm())
        listbox.bind('<Return>', lambda _event: confirm())
        listbox.bind('<Escape>', lambda _event: cancel())

        confirm_btn = RoundedButton(
            button_row,
            text=str(confirm_text or '确认'),
            command=confirm,
            font_def=(self.FONT_NAME, 10),
            min_width=96,
            height=34
        )
        self._style_button(confirm_btn, 'primary')
        confirm_btn.pack(side=tk.LEFT)

        cancel_btn = RoundedButton(
            button_row,
            text=str(cancel_text or '取消'),
            command=cancel,
            font_def=(self.FONT_NAME, 10),
            min_width=96,
            height=34
        )
        self._style_button(cancel_btn, 'secondary')
        cancel_btn.pack(side=tk.LEFT, padx=(8, 0))

        dialog.update_idletasks()
        self._center_modal(dialog)
        dialog.grab_set()
        listbox.focus_set()
        self.root.wait_window(dialog)
        return result['value']

    def _parse_download_event_line(self, line, prefix='@@XMAI_EVENT@@'):
        raw = str(line or '').strip()
        if not raw.startswith(prefix):
            return None
        payload_text = raw[len(prefix):].strip()
        if not payload_text:
            return None
        try:
            payload = json.loads(payload_text)
        except Exception:
            return None
        if not isinstance(payload, dict):
            return None
        return payload

    def _format_speed(self, speed_bps):
        try:
            value = float(speed_bps)
        except Exception:
            value = 0.0
        value = max(0.0, value)
        if value >= 1024 * 1024:
            return f"{value / 1024 / 1024:.2f} MB/s"
        if value >= 1024:
            return f"{value / 1024:.2f} KB/s"
        return f"{value:.0f} B/s"

    def _build_python_utf8_env(self):
        env = os.environ.copy()
        env['PYTHONIOENCODING'] = 'utf-8'
        env['PYTHONUTF8'] = '1'
        return env

    def _show_info_dialog(self, title, message):
        self._show_choice_dialog(
            title=title,
            message=message,
            buttons=[{'value': 'ok', 'label': '确定', 'style': 'primary'}],
            default_value='ok'
        )

    def _show_download_hint(self):
        self._show_info_dialog(
            "提示",
            "请在点击[启动服务]前完成下载，否则可能会变的奇怪"
        )

    def _count_local_illustration_files(self):
        if not os.path.isdir(mai_song_lib_dir):
            return 0

        count = 0
        for walk_root, _dir_names, file_names in os.walk(mai_song_lib_dir):
            for file_name in file_names:
                ext = os.path.splitext(file_name)[1].lower()
                if ext in IMAGE_EXTENSIONS:
                    count += 1
        return count

    def _set_compile_cache_running(self, running):
        self.compile_cache_running = bool(running)
        if self.compile_cache_running:
            self.compile_cache_btn.set_text("编译中...")
            self.compile_cache_btn.set_enabled(False)
            return

        self.compile_cache_btn.set_text("编译缓存包")
        self.compile_cache_btn.set_enabled(True)

    def _compile_memory_package_prompt(self):
        if self.compile_cache_running:
            return

        if self.initialize_running:
            self._show_info_dialog("提示", "初始化进行中，请稍后再编译缓存包。")
            return

        illustration_count = self._count_local_illustration_files()
        if illustration_count <= 0:
            action = self._show_choice_dialog(
                title='无法构建缓存包',
                message=f'检测到 {mai_song_lib_dir} 文件夹内没有曲绘文件，无法构建，是否下载曲绘文件？',
                buttons=[
                    {'value': 'yes', 'label': '是', 'style': 'primary'},
                    {'value': 'no', 'label': '否', 'style': 'secondary'}
                ],
                default_value='yes'
            )
            if action == 'yes':
                self._download_illustrations()
            return

        self._set_compile_cache_running(True)
        app_log(f"开始编译缓存包，当前检测到曲绘文件: {illustration_count}")
        threading.Thread(target=self._compile_memory_package_worker, daemon=True).start()

    def _compile_memory_package_worker(self):
        try:
            package_info, elapsed_ms = build_memory_test_package_now()
            self.root.after(
                0,
                lambda info=package_info, ms=elapsed_ms: self._on_compile_memory_package_done(info, ms)
            )
        except Exception as error:
            app_log(f"编译缓存包失败: {error}", 'ERROR')
            app_log(traceback.format_exc(), 'ERROR')
            self.root.after(0, lambda msg=str(error): self._on_compile_memory_package_failed(msg))

    def _on_compile_memory_package_done(self, package_info, elapsed_ms):
        self._set_compile_cache_running(False)
        reused = bool(package_info.get('reused'))
        mode = '复用已有缓存包' if reused else '已新建缓存包'
        file_count = int(package_info.get('file_count', 0))
        disk_bytes = int(package_info.get('disk_bytes', 0))
        compressed_bytes = int(package_info.get('compressed_bytes', 0))

        app_log(
            f"缓存包编译完成: mode={mode}, files={file_count}, disk={disk_bytes}B, "
            f"compressed={compressed_bytes}B, time={elapsed_ms}ms"
        )
        self._show_info_dialog(
            "编译完成",
            (
                f"{mode}\n"
                f"文件数: {file_count}\n"
                f"源数据体积: {disk_bytes} B\n"
                f"缓存包体积: {compressed_bytes} B\n"
                f"耗时: {elapsed_ms} ms"
            )
        )

    def _on_compile_memory_package_failed(self, error_message):
        self._set_compile_cache_running(False)
        self._show_info_dialog("编译失败", f"缓存包编译失败：\n{error_message}")

    def _set_initialize_running(self, running):
        self.initialize_running = bool(running)
        if self.initialize_running:
            self.initialize_btn.set_text("初始化中...")
            self.initialize_btn.set_enabled(False)
            if not self.compile_cache_running:
                self.compile_cache_btn.set_enabled(False)
            return

        self.initialize_btn.set_text("初始化软件")
        self.initialize_btn.set_enabled(True)
        if not self.compile_cache_running:
            self.compile_cache_btn.set_enabled(True)

    def _initialize_software_prompt(self):
        if self.initialize_running:
            return
        if self.compile_cache_running:
            self._show_info_dialog("提示", "缓存包编译进行中，请稍后再初始化软件。")
            return

        action = self._show_choice_dialog(
            title='初始化软件',
            message='此操作不可逆 会清理一切使用痕迹，确定要继续吗？',
            buttons=[
                {'value': 'yes', 'label': '是', 'style': 'primary'},
                {'value': 'no', 'label': '否', 'style': 'secondary'}
            ],
            default_value='no'
        )
        if action != 'yes':
            return

        self._set_initialize_running(True)
        app_log("开始执行初始化清理...")
        threading.Thread(target=self._initialize_software_worker, daemon=True).start()

    def _initialize_software_purge_directory(self, target_dir, removable_extensions=None):
        deleted_files = 0
        deleted_dirs = 0
        errors = []
        folder_path = os.path.abspath(str(target_dir or current_dir))
        root_path = os.path.abspath(current_dir)
        if removable_extensions is None:
            removable_extensions = {'.png', '.json', '.txt'}
        else:
            removable_extensions = {str(ext or '').lower() for ext in removable_extensions}

        if folder_path != root_path and not folder_path.startswith(root_path + os.sep):
            raise ValueError(f"禁止清理项目外目录: {folder_path}")

        if not os.path.isdir(folder_path):
            return deleted_files, deleted_dirs, errors

        try:
            for walk_root, _dir_names, file_names in os.walk(folder_path):
                for file_name in file_names:
                    extension = os.path.splitext(file_name)[1].lower()
                    if extension not in removable_extensions:
                        continue

                    file_path = os.path.abspath(os.path.join(walk_root, file_name))
                    try:
                        os.remove(file_path)
                        deleted_files += 1
                    except Exception as error:
                        errors.append(f"{file_path}: {error}")
        except Exception as error:
            errors.append(f"{folder_path}: {error}")

        return deleted_files, deleted_dirs, errors

    def _initialize_software_purge_pycache(self):
        deleted_dirs = 0
        errors = []
        root_path = os.path.abspath(current_dir)

        for walk_root, dir_names, _file_names in os.walk(root_path):
            for name in list(dir_names):
                if name != '__pycache__':
                    continue

                cache_path = os.path.abspath(os.path.join(walk_root, name))
                try:
                    shutil.rmtree(cache_path)
                    deleted_dirs += 1
                    dir_names.remove(name)
                except Exception as error:
                    errors.append(f"{cache_path}: {error}")

        return deleted_dirs, errors

    def _initialize_cleanup_download_core_artifacts(self):
        deleted_files = 0
        errors = []
        patterns = [
            'songdata.json',
            'Music-Fish.json',
            'MusicALL.json',
            'MusicALL-DownloadTemp-*.json'
        ]

        for pattern in patterns:
            try:
                for path_obj in pathlib.Path(download_core_dir).glob(pattern):
                    if path_obj.is_file():
                        try:
                            path_obj.unlink()
                            deleted_files += 1
                        except Exception as error:
                            errors.append(f"{path_obj}: {error}")
            except Exception as error:
                errors.append(f"{download_core_dir}\\{pattern}: {error}")

        return deleted_files, errors

    def _initialize_software_worker(self):
        global memory_test_package_info
        try:
            background_cleanup_extensions = {
                '.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif', '.avif',
                '.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v',
                '.json', '.txt'
            }

            targets = [
                (data_dir, {'.json', '.txt'}),  # Data目录保留png
                (mai_song_lib_dir, {'.png', '.json', '.txt'}),
                (cache_dir, {'.png', '.json', '.txt', '.gz', '.pkg'}),
                (result_dir, {'.png', '.json', '.txt'}),
                (background_dir, background_cleanup_extensions),
                (mai_list_dir, {'.png', '.json', '.txt'})
            ]

            deleted_files = 0
            deleted_dirs = 0
            errors = []

            for target, extensions in targets:
                file_count, dir_count, current_errors = self._initialize_software_purge_directory(
                    target,
                    removable_extensions=extensions
                )
                deleted_files += int(file_count)
                deleted_dirs += int(dir_count)
                errors.extend(current_errors)

            artifacts_deleted, artifact_errors = self._initialize_cleanup_download_core_artifacts()
            deleted_files += int(artifacts_deleted)
            errors.extend(artifact_errors)

            memory_test_package_info = None
            reset_token = bump_reset_state_token()

            required_dirs = [
                data_dir,
                mai_song_lib_dir,
                cache_dir,
                result_dir,
                result_diagram_dir,
                mai_list_dir,
                character_dir,
                core_dir,
                background_dir,
                background_applied_dir,
                background_video_dir
            ]
            for folder in required_dirs:
                os.makedirs(folder, exist_ok=True)

            self.root.after(
                0,
                lambda files=deleted_files, dirs=deleted_dirs, issues=errors, token=reset_token: self._initialize_software_done(files, dirs, issues, token)
            )
        except Exception as error:
            app_log(f"初始化失败: {error}", 'ERROR')
            app_log(traceback.format_exc(), 'ERROR')
            self.root.after(0, lambda msg=str(error): self._initialize_software_failed(msg))

    def _initialize_software_done(self, deleted_files, deleted_dirs, errors, reset_token=''):
        self._set_initialize_running(False)
        app_log(f"初始化完成: 删除文件 {deleted_files} 个, 删除目录 {deleted_dirs} 个, reset_token={reset_token}")

        if errors:
            preview = '\n'.join(errors[:5])
            more = f"\n... 另有 {len(errors) - 5} 条错误" if len(errors) > 5 else ''
            self._show_info_dialog(
                "初始化完成",
                (
                    f"初始化已完成，但有 {len(errors)} 个项目清理失败。\n"
                    f"已删除文件: {deleted_files}\n"
                    f"已删除目录: {deleted_dirs}\n\n"
                    f"{preview}{more}"
                )
            )
            return

        self._show_info_dialog(
            "初始化完成",
            (
                "软件已恢复到初始状态。\n"
                f"已删除文件: {deleted_files}\n"
                f"已删除目录: {deleted_dirs}"
            )
        )

    def _initialize_software_failed(self, error_message):
        self._set_initialize_running(False)
        self._show_info_dialog("初始化失败", f"初始化过程中出现错误：\n{error_message}")

    def _collect_json_files(self, folder_path):
        result = []
        if not os.path.isdir(folder_path):
            return result

        try:
            with os.scandir(folder_path) as entries:
                for entry in entries:
                    if entry.is_file() and entry.name.lower().endswith('.json'):
                        result.append(os.path.abspath(entry.path))
        except Exception:
            return []

        result.sort(key=lambda path: os.path.basename(path).lower())
        return result

    def _sanitize_json_filename(self, raw_name, fallback_name='MusicData.json'):
        fallback = os.path.basename(str(fallback_name or 'MusicData.json')).strip()
        if not fallback.lower().endswith('.json'):
            fallback = f"{fallback}.json"

        candidate = str(raw_name or '').strip().replace('\\', '/')
        candidate = os.path.basename(candidate)
        candidate = re.sub(r'[<>:"/\\|?*]+', '_', candidate).strip().strip('.')
        if not candidate:
            candidate = fallback
        if not candidate.lower().endswith('.json'):
            candidate = f"{candidate}.json"
        return candidate

    def _build_unique_json_path(self, folder_path, preferred_name):
        safe_name = self._sanitize_json_filename(preferred_name, fallback_name='MusicData.json')
        base_name, ext = os.path.splitext(safe_name)
        candidate = os.path.join(folder_path, safe_name)
        index = 1

        while os.path.exists(candidate):
            candidate = os.path.join(folder_path, f"{base_name}-{index}{ext}")
            index += 1

        return candidate

    def _delete_files(self, file_paths):
        deleted_count = 0
        failed_items = []
        for file_path in file_paths:
            try:
                if os.path.isfile(file_path):
                    os.remove(file_path)
                    deleted_count += 1
            except Exception as error:
                failed_items.append(f"{os.path.basename(file_path)} ({error})")
        return deleted_count, failed_items

    def _prompt_cleanup_old_data(self, old_json_paths):
        old_names = [os.path.basename(path) for path in old_json_paths if path]
        if not old_names:
            return 'keep'

        if len(old_names) == 1:
            message = f"是否删除 Data 文件夹内旧数据？\n旧数据文件名为: {old_names[0]}"
            detail_text = ''
            buttons = [
                {'value': 'delete', 'label': '删除', 'style': 'primary'},
                {'value': 'keep', 'label': '保留', 'style': 'secondary'},
                {'value': 'open', 'label': '打开文件夹', 'style': 'secondary'}
            ]
        else:
            message = "是否删除 Data 文件夹内旧数据？"
            detail_text = "旧数据文件名为:\n" + "\n".join(old_names)
            buttons = [
                {'value': 'keep', 'label': '保留', 'style': 'secondary'},
                {'value': 'delete_all', 'label': '全部删除', 'style': 'primary'},
                {'value': 'open', 'label': '打开文件夹', 'style': 'secondary'}
            ]

        while True:
            action = self._show_choice_dialog(
                title='旧数据处理',
                message=message,
                detail_text=detail_text,
                buttons=buttons,
                default_value='keep'
            )
            if action == 'open':
                self._open_folder(data_dir, create_if_missing=True, folder_label='歌曲文件夹')
                continue
            return action

    def _set_download_music_running(self, running):
        self.download_music_running = bool(running)
        if self.download_music_running:
            self.download_music_btn.set_text("下载中...")
            self.download_music_btn.set_enabled(False)
            return

        self.download_music_btn.set_text("下载曲库")
        self.download_music_btn.set_enabled(True)

    def _download_music_library(self):
        if self.download_music_running:
            return

        self._set_download_music_running(True)
        app_log("开始下载曲库数据...")
        threading.Thread(target=self._download_music_library_worker, daemon=True).start()

    def _download_music_library_worker(self):
        try:
            script_path = os.path.join(download_core_dir, 'Download-MaiJson.py')
            if not os.path.isfile(script_path):
                raise FileNotFoundError(f"未找到下载脚本: {script_path}")

            os.makedirs(data_dir, exist_ok=True)
            old_data_json_files = self._collect_json_files(data_dir)

            timestamp_text = datetime.now().strftime('%Y%m%d-%H%M%S')
            temp_output_name = f"MusicALL-DownloadTemp-{timestamp_text}.json"
            temp_output_path = os.path.join(download_core_dir, temp_output_name)
            if os.path.exists(temp_output_path):
                os.remove(temp_output_path)

            command = [sys.executable, script_path, '--merged-output', temp_output_name]
            app_log(f"执行下载命令: {' '.join(command)}")

            completed = subprocess.run(
                command,
                cwd=download_core_dir,
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='replace',
                env=self._build_python_utf8_env()
            )

            if completed.stdout:
                for line in completed.stdout.splitlines():
                    stripped = line.strip()
                    if stripped:
                        app_log(f"[下载曲库] {stripped}")

            if completed.stderr:
                for line in completed.stderr.splitlines():
                    stripped = line.strip()
                    if stripped:
                        level = 'WARN' if completed.returncode == 0 else 'ERROR'
                        app_log(f"[下载曲库] {stripped}", level)

            if completed.returncode != 0:
                error_lines = []
                if completed.stderr:
                    error_lines.extend([line.strip() for line in completed.stderr.splitlines() if line.strip()])
                if completed.stdout:
                    error_lines.extend([line.strip() for line in completed.stdout.splitlines() if line.strip().lower().startswith('error')])

                if error_lines:
                    raise RuntimeError(
                        f"下载脚本执行失败，返回码: {completed.returncode}，原因: {error_lines[-1]}"
                    )

                raise RuntimeError(f"下载脚本执行失败，返回码: {completed.returncode}")

            if not os.path.isfile(temp_output_path):
                candidates = self._collect_json_files(download_core_dir)
                if not candidates:
                    raise FileNotFoundError("下载脚本执行成功，但未在 DownloadCore 找到 JSON 文件。")
                temp_output_path = max(candidates, key=lambda path: os.path.getmtime(path))

            self.root.after(
                0,
                lambda source_path=temp_output_path, old_files=old_data_json_files: self._on_download_music_ready(source_path, old_files)
            )
        except Exception as error:
            app_log(f"下载曲库失败: {error}", 'ERROR')
            app_log(traceback.format_exc(), 'ERROR')
            self.root.after(0, lambda msg=str(error): self._on_download_music_error(msg))

    def _on_download_music_error(self, error_message):
        self._set_download_music_running(False)
        self._show_info_dialog("下载失败", f"下载曲库失败：\n{error_message}")

    def _on_download_music_ready(self, source_json_path, old_data_json_files):
        try:
            if not os.path.isfile(source_json_path):
                raise FileNotFoundError(f"下载结果文件不存在: {source_json_path}")

            download_time = datetime.fromtimestamp(os.path.getmtime(source_json_path))
            default_name = f"MusicData-{download_time.strftime('%Y%m%d-%H%M%S')}.json"

            rename_action = self._show_choice_dialog(
                title='下载完成',
                message=f"已下载完成，是否重命名文件？\n当前文件: {os.path.basename(source_json_path)}",
                detail_text=f"不重命名时将使用: {default_name}",
                buttons=[
                    {'value': 'rename', 'label': '重命名', 'style': 'primary'},
                    {'value': 'default', 'label': '不重命名', 'style': 'secondary'}
                ],
                default_value='default'
            )

            target_name = default_name
            if rename_action == 'rename':
                input_name = self._show_text_input_dialog(
                    title='重命名 Json',
                    message='请输入新的 JSON 文件名：',
                    initial_value=default_name,
                    confirm_text='确认',
                    cancel_text='取消',
                    default_value=default_name
                )
                target_name = self._sanitize_json_filename(input_name, fallback_name=default_name)

            os.makedirs(data_dir, exist_ok=True)
            target_path = self._build_unique_json_path(data_dir, target_name)
            shutil.move(source_json_path, target_path)
            app_log(f"曲库文件已转移到 Data: {target_path}")

            cleanup_action = self._prompt_cleanup_old_data(old_data_json_files)
            if cleanup_action in ('delete', 'delete_all'):
                deleted_count, failed_items = self._delete_files(old_data_json_files)
                app_log(f"旧数据删除完成: {deleted_count} 个文件")
                if failed_items:
                    app_log("以下文件删除失败: " + "; ".join(failed_items), 'WARN')

            self._show_info_dialog(
                "下载完成",
                f"新曲库文件已保存：{os.path.basename(target_path)}\n目录：{data_dir}"
            )
        except Exception as error:
            app_log(f"处理下载结果失败: {error}", 'ERROR')
            app_log(traceback.format_exc(), 'ERROR')
            self._show_info_dialog("下载失败", f"处理下载结果时出现错误：\n{error}")
        finally:
            self._set_download_music_running(False)

    def _set_download_illustration_running(self, running):
        self.download_illustration_running = bool(running)
        if self.download_illustration_running:
            self.download_illustration_btn.set_text("下载中...")
            self.download_illustration_btn.set_enabled(False)
            return

        self.download_illustration_btn.set_text("下载曲绘")
        self.download_illustration_btn.set_enabled(True)

    def _open_illustration_progress_dialog(self, json_name):
        self._close_illustration_progress_dialog()
        theme = self._theme()

        dialog = tk.Toplevel(self.root)
        dialog.title("下载曲绘")
        dialog.transient(self.root)
        dialog.resizable(False, False)
        dialog.configure(bg=theme['root_bg'])

        shell = tk.Frame(
            dialog,
            bg=theme['panel_bg'],
            bd=0,
            highlightthickness=1,
            highlightbackground=theme['border'],
            highlightcolor=theme['border']
        )
        shell.pack(fill=tk.BOTH, expand=True, padx=12, pady=12)

        title_label = tk.Label(
            shell,
            text="下载曲绘任务进行中",
            bg=theme['panel_bg'],
            fg=theme['title_fg'],
            font=(self.FONT_NAME, 12, 'bold')
        )
        title_label.pack(anchor='w', padx=14, pady=(12, 6))

        self.illustration_progress_status_var = tk.StringVar(value="网速: 0 B/s | 进度: 0.00%")
        status_label = tk.Label(
            shell,
            textvariable=self.illustration_progress_status_var,
            bg=theme['panel_bg'],
            fg=theme['text_fg'],
            font=(self.FONT_NAME, 10)
        )
        status_label.pack(anchor='w', padx=14, pady=(0, 8))

        style_name = 'XMai.Horizontal.TProgressbar'
        try:
            progress_style = ttk.Style(self.root)
            progress_style.configure(
                style_name,
                troughcolor=theme['sub_bg'],
                background=theme['btn_primary_bg'],
                bordercolor=theme['border'],
                lightcolor=theme['btn_primary_bg'],
                darkcolor=theme['btn_primary_bg']
            )
        except Exception:
            style_name = 'Horizontal.TProgressbar'

        self.illustration_progress_value = tk.DoubleVar(value=0.0)
        progress_bar = ttk.Progressbar(
            shell,
            orient=tk.HORIZONTAL,
            mode='determinate',
            maximum=100,
            variable=self.illustration_progress_value,
            style=style_name,
            length=520
        )
        progress_bar.pack(fill=tk.X, padx=14, pady=(0, 10))

        self.illustration_progress_detail_var = tk.StringVar(value=f"准备下载: {json_name}")
        detail_label = tk.Label(
            shell,
            textvariable=self.illustration_progress_detail_var,
            bg=theme['panel_bg'],
            fg=theme['text_fg'],
            font=(self.FONT_NAME, 9),
            justify=tk.LEFT,
            wraplength=520
        )
        detail_label.pack(anchor='w', padx=14, pady=(0, 12))

        dialog.protocol("WM_DELETE_WINDOW", lambda: None)
        dialog.update_idletasks()
        self._center_modal(dialog)

        self.illustration_progress_dialog = dialog

    def _close_illustration_progress_dialog(self):
        dialog = self.illustration_progress_dialog
        self.illustration_progress_dialog = None
        self.illustration_progress_value = None
        self.illustration_progress_status_var = None
        self.illustration_progress_detail_var = None
        if dialog is None:
            return
        try:
            if dialog.winfo_exists():
                dialog.destroy()
        except Exception:
            pass

    def _update_illustration_progress_dialog(self, percent, speed_bps, detail_text=''):
        dialog = self.illustration_progress_dialog
        if dialog is None:
            return
        try:
            if not dialog.winfo_exists():
                return
        except Exception:
            return

        try:
            percent_value = float(percent)
        except Exception:
            percent_value = 0.0
        percent_value = max(0.0, min(100.0, percent_value))

        if self.illustration_progress_value is not None:
            self.illustration_progress_value.set(percent_value)

        if self.illustration_progress_status_var is not None:
            self.illustration_progress_status_var.set(
                f"网速: {self._format_speed(speed_bps)} | 进度: {percent_value:.2f}%"
            )

        if self.illustration_progress_detail_var is not None and detail_text:
            self.illustration_progress_detail_var.set(str(detail_text))

    def _download_illustrations(self):
        if self.download_illustration_running:
            return

        self._set_download_illustration_running(True)
        app_log("开始准备下载曲绘...")
        threading.Thread(target=self._download_illustrations_prepare_worker, daemon=True).start()

    def _download_illustrations_prepare_worker(self):
        try:
            script_path = os.path.join(download_core_dir, 'Download_Mai_Illustration.py')
            if not os.path.isfile(script_path):
                raise FileNotFoundError(f"未找到脚本: {script_path}")

            command = [sys.executable, script_path, '--list-json', '--data-dir', data_dir]
            app_log(f"执行曲绘预检查命令: {' '.join(command)}")

            completed = subprocess.run(
                command,
                cwd=download_core_dir,
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='replace',
                env=self._build_python_utf8_env()
            )

            json_files = []
            error_lines = []

            if completed.stdout:
                for line in completed.stdout.splitlines():
                    stripped = line.strip()
                    if not stripped:
                        continue

                    payload = self._parse_download_event_line(stripped)
                    if payload and payload.get('event') == 'json_list':
                        files = payload.get('files')
                        if isinstance(files, list):
                            json_files = files
                        continue

                    app_log(f"[下载曲绘] {stripped}")

            if completed.stderr:
                for line in completed.stderr.splitlines():
                    stripped = line.strip()
                    if not stripped:
                        continue
                    app_log(f"[下载曲绘] {stripped}", 'ERROR' if completed.returncode != 0 else 'WARN')
                    error_lines.append(stripped)

            if completed.returncode != 0:
                if error_lines:
                    raise RuntimeError(error_lines[-1])
                raise RuntimeError(f"曲绘预检查失败，返回码: {completed.returncode}")

            self.root.after(0, lambda files=json_files: self._on_illustration_json_list_ready(files))
        except Exception as error:
            app_log(f"下载曲绘准备失败: {error}", 'ERROR')
            app_log(traceback.format_exc(), 'ERROR')
            self.root.after(0, lambda msg=str(error): self._on_download_illustrations_error(msg))

    def _on_illustration_json_list_ready(self, json_files):
        normalized = []
        for item in (json_files or []):
            if not isinstance(item, dict):
                continue
            path_value = str(item.get('path') or '').strip()
            if not path_value:
                continue
            file_path = os.path.abspath(path_value)
            if not os.path.isfile(file_path):
                continue
            name_value = str(item.get('name') or os.path.basename(file_path))
            size_value = int(item.get('size') or 0)
            normalized.append({
                'name': name_value,
                'path': file_path,
                'size': size_value
            })

        if not normalized:
            self._on_download_illustrations_error("Data 文件夹中未找到可用 JSON 文件。")
            return

        selected = None
        if len(normalized) == 1:
            selected = normalized[0]
        else:
            options = []
            for item in normalized:
                size_kb = float(item.get('size', 0)) / 1024.0
                options.append({
                    'label': f"{item['name']} ({size_kb:.1f} KB)",
                    'value': item
                })

            chosen = self._show_list_select_dialog(
                title='选择曲库 JSON',
                message='检测到 Data 文件夹中有多个 JSON 文件，请选择一个用于下载曲绘：',
                items=options,
                confirm_text='开始下载',
                cancel_text='取消'
            )
            if not chosen:
                self._set_download_illustration_running(False)
                app_log("用户取消了下载曲绘任务。", 'WARN')
                return
            selected = chosen.get('value')

        if not selected or not os.path.isfile(selected.get('path', '')):
            self._on_download_illustrations_error("选择的 JSON 文件无效。")
            return

        app_log(f"下载曲绘使用JSON: {selected.get('path')}")
        self._open_illustration_progress_dialog(selected.get('name', ''))
        threading.Thread(
            target=self._download_illustrations_worker,
            args=(selected.get('path', ''),),
            daemon=True
        ).start()

    def _download_illustrations_worker(self, json_file_path):
        try:
            script_path = os.path.join(download_core_dir, 'Download_Mai_Illustration.py')
            if not os.path.isfile(script_path):
                raise FileNotFoundError(f"未找到脚本: {script_path}")

            output_dir = os.path.join(current_dir, 'MaiSongLib')
            os.makedirs(output_dir, exist_ok=True)

            command = [
                sys.executable,
                script_path,
                '--data-dir',
                data_dir,
                '--json-file',
                os.path.abspath(json_file_path),
                '--output-dir',
                output_dir,
                '--yes',
                '--max-workers',
                '32'
            ]
            app_log(f"执行下载曲绘命令: {' '.join(command)}")

            process = subprocess.Popen(
                command,
                cwd=download_core_dir,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding='utf-8',
                errors='replace',
                bufsize=1,
                env=self._build_python_utf8_env()
            )

            summary_payload = None
            error_message = ''

            if process.stdout is not None:
                for raw_line in process.stdout:
                    stripped = raw_line.strip()
                    if not stripped:
                        continue

                    payload = self._parse_download_event_line(stripped)
                    if payload:
                        event_name = str(payload.get('event') or '')
                        if event_name == 'error':
                            error_message = str(payload.get('message') or '').strip()
                        if event_name == 'complete':
                            summary_payload = payload
                        self.root.after(0, lambda event_payload=payload: self._handle_illustration_download_event(event_payload))
                        continue

                    app_log(f"[下载曲绘] {stripped}")
                    if stripped.lower().startswith('error'):
                        error_message = stripped

            return_code = process.wait()
            if return_code != 0:
                if not error_message:
                    error_message = f"下载曲绘脚本执行失败，返回码: {return_code}"
                raise RuntimeError(error_message)

            self.root.after(0, lambda summary=summary_payload: self._on_download_illustrations_complete(summary))
        except Exception as error:
            app_log(f"下载曲绘失败: {error}", 'ERROR')
            app_log(traceback.format_exc(), 'ERROR')
            self.root.after(0, lambda msg=str(error): self._on_download_illustrations_error(msg))

    def _handle_illustration_download_event(self, payload):
        if not isinstance(payload, dict):
            return

        event_name = str(payload.get('event') or '')
        if event_name == 'start':
            total = int(payload.get('total') or 0)
            skipped = int(payload.get('skipped') or 0)
            detail = f"待下载: {total} | 已存在跳过: {skipped}"
            self._update_illustration_progress_dialog(0.0, 0.0, detail)
            return

        if event_name == 'progress':
            try:
                percent = float(payload.get('percent') or 0.0)
            except Exception:
                percent = 0.0
            speed_bps = float(payload.get('speed_bps') or 0.0)
            completed = int(payload.get('completed') or 0)
            total = int(payload.get('total') or 0)
            success = int(payload.get('success') or 0)
            failed = int(payload.get('failed') or 0)
            current_file = str(payload.get('current_file') or '-')
            detail = (
                f"当前: {current_file}\n"
                f"完成: {completed}/{total} | 成功: {success} | 失败: {failed}"
            )
            self._update_illustration_progress_dialog(percent, speed_bps, detail)
            return

        if event_name == 'complete':
            total = int(payload.get('total') or 0)
            success = int(payload.get('success') or 0)
            failed = int(payload.get('failed') or 0)
            skipped = int(payload.get('skipped') or 0)
            detail = f"下载完成 | 成功: {success} | 失败: {failed} | 跳过: {skipped} | 总任务: {total}"
            final_percent = 100.0 if total > 0 else 100.0
            self._update_illustration_progress_dialog(final_percent, 0.0, detail)
            return

        if event_name == 'error':
            detail = f"错误: {payload.get('message')}"
            self._update_illustration_progress_dialog(0.0, 0.0, detail)

    def _on_download_illustrations_complete(self, summary):
        self._set_download_illustration_running(False)

        summary_payload = summary if isinstance(summary, dict) else {}
        success = int(summary_payload.get('success') or 0)
        failed = int(summary_payload.get('failed') or 0)
        skipped = int(summary_payload.get('skipped') or 0)
        total = int(summary_payload.get('total') or 0)
        output_path = str(summary_payload.get('output_dir') or os.path.join(current_dir, 'MaiSongLib'))
        report_path = str(summary_payload.get('report_path') or '')

        self._close_illustration_progress_dialog()
        self._show_info_dialog(
            "下载完成",
            (
                f"曲绘下载任务已完成。\n"
                f"总任务: {total}\n成功: {success}\n失败: {failed}\n跳过: {skipped}\n"
                f"输出目录: {output_path}\n"
                f"{'报告文件: ' + report_path if report_path else ''}"
            ).strip()
        )

    def _on_download_illustrations_error(self, error_message):
        self._set_download_illustration_running(False)
        self._close_illustration_progress_dialog()
        self._show_info_dialog("下载失败", f"下载曲绘失败：\n{error_message}")

    def _start_server(self):
        if self.httpd is not None:
            return
        self.status_text.set("状态: 启动中...")
        self.start_btn.set_enabled(False)
        self._style_button(self.stop_btn, 'disabled')
        self.stop_btn.set_enabled(False)
        self.open_btn.set_enabled(False)
        threading.Thread(target=self._start_server_worker, daemon=True).start()

    def _start_server_worker(self):
        app_log("正在启动服务器...")
        app_log(f"静态资源根目录: {current_dir}")
        app_log(f"端口分配策略: 从 {DEFAULT_START_PORT} 开始，最多尝试 {DEFAULT_PORT_SCAN_ATTEMPTS} 个端口")
        preload_memory_package()

        try:
            httpd, port = create_http_server()
        except Exception as error:
            app_log(str(error), 'ERROR')
            self.root.after(0, lambda: self.status_text.set(f"状态: 启动失败 - {error}"))
            self.root.after(0, lambda: self._set_running(False))
            return

        self.httpd = httpd
        self.current_port = port
        self.current_url = f"http://localhost:{port}"

        self.server_thread = threading.Thread(target=self._serve_forever_worker, args=(httpd,), daemon=True)
        self.server_thread.start()

        app_log(f"服务器已启动: {self.current_url}")
        try:
            webbrowser.open(self.current_url)
            app_log(f"已尝试打开浏览器: {self.current_url}")
        except Exception as browser_error:
            app_log(f"浏览器打开失败: {browser_error}", 'WARN')

        self.root.after(0, self._on_server_started)

    def _serve_forever_worker(self, httpd):
        try:
            httpd.serve_forever(poll_interval=0.5)
        except Exception as error:
            app_log(f"服务线程异常: {error}", 'ERROR')
            app_log(traceback.format_exc(), 'ERROR')

    def _on_server_started(self):
        self.status_text.set("状态: 运行中")
        self.port_text.set(f"端口: {self.current_port}")
        self.url_text.set(f"地址: {self.current_url}")
        self._set_running(True)

    def _stop_server(self):
        if self.httpd is None:
            return
        self.status_text.set("状态: 停止中...")
        self.stop_btn.set_enabled(False)
        threading.Thread(target=self._stop_server_worker, kwargs={'notify_ui': True}, daemon=True).start()

    def _stop_server_worker(self, notify_ui=True):
        httpd = self.httpd
        self.httpd = None

        if httpd is not None:
            try:
                httpd.shutdown()
            except Exception as error:
                app_log(f"关闭服务时发生错误: {error}", 'WARN')
            try:
                httpd.server_close()
            except Exception as error:
                app_log(f"释放端口时发生错误: {error}", 'WARN')

        self.current_port = None
        self.current_url = ''
        app_log("服务器已停止")
        if notify_ui:
            self.root.after(0, self._on_server_stopped)

    def _on_server_stopped(self):
        self.status_text.set("状态: 已停止")
        self.port_text.set("端口: -")
        self.url_text.set("地址: -")
        self._set_running(False)

    def _on_close(self):
        if self.httpd is not None:
            self._stop_server_worker(notify_ui=False)
        self._close_illustration_progress_dialog()
        self._unregister_font_files()
        self.root.destroy()


def run_gui_server():
    app = ServerDebugApp()
    app.root.mainloop()
    return 0


# 主函数
if __name__ == "__main__":
    if '--cli' in sys.argv or not TK_AVAILABLE:
        if not TK_AVAILABLE and '--cli' not in sys.argv:
            app_log("未检测到 tkinter，已回退到命令行模式。", 'WARN')
        sys.exit(run_cli_server())

    sys.exit(run_gui_server())
