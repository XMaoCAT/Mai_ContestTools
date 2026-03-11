import argparse
import concurrent.futures
import json
import os
import sys
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests
import urllib3

# 禁用SSL警告
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

EVENT_PREFIX = "@@XMAI_EVENT@@"


def configure_utf8_stdio() -> None:
    for stream_name in ("stdout", "stderr"):
        stream_obj = getattr(sys, stream_name, None)
        if stream_obj is None:
            continue
        if hasattr(stream_obj, "reconfigure"):
            try:
                stream_obj.reconfigure(encoding="utf-8", errors="replace")
            except Exception:
                pass


def emit_event(event_name: str, **payload) -> None:
    data = {"event": event_name}
    data.update(payload)
    print(f"{EVENT_PREFIX}{json.dumps(data, ensure_ascii=False)}", flush=True)


def list_data_json_files(data_dir: Path) -> List[Path]:
    if not data_dir.exists() or not data_dir.is_dir():
        return []

    result = []
    for entry in data_dir.iterdir():
        if entry.is_file() and entry.suffix.lower() == ".json":
            result.append(entry.resolve())

    result.sort(key=lambda p: p.name.lower())
    return result


def extract_image_urls(data: Any) -> List[str]:
    urls: List[str] = []

    def walk(obj: Any) -> None:
        if isinstance(obj, dict):
            image_url = obj.get("image_url")
            if isinstance(image_url, str) and image_url.strip():
                urls.append(image_url.strip())
            for value in obj.values():
                walk(value)
            return

        if isinstance(obj, list):
            for item in obj:
                walk(item)

    walk(data)
    return urls


def dedup_keep_order(values: List[str]) -> List[str]:
    seen = set()
    result = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result


def verify_existing_files(result_dir: Path, image_names: List[str], verify_integrity: bool = False) -> Tuple[List[str], int]:
    print("正在扫描本地已存在的文件...", flush=True)

    existing_files = set()
    if result_dir.exists():
        for entry in result_dir.iterdir():
            if entry.is_file():
                existing_files.add(entry.name)

    need_download = []
    skipped = []

    for img_name in image_names:
        clean_name = str(img_name or "").strip()
        if not clean_name:
            continue
        if clean_name in existing_files:
            skipped.append(clean_name)
        else:
            need_download.append(clean_name)

    print(f"本地已存在 {len(existing_files)} 个文件", flush=True)
    print(f"需要下载: {len(need_download)} 个文件", flush=True)
    print(f"跳过已存在: {len(skipped)} 个文件", flush=True)

    if verify_integrity and skipped:
        print("开始验证已存在文件的完整性...", flush=True)
        re_download = []
        for img_name in skipped:
            file_path = result_dir / img_name
            if file_path.exists() and file_path.stat().st_size <= 1024:
                try:
                    file_path.unlink()
                except Exception:
                    pass
                re_download.append(img_name)
        if re_download:
            need_download.extend(re_download)
            print(f"发现 {len(re_download)} 个不完整文件需要重新下载", flush=True)
            return need_download, len(skipped) - len(re_download)

    return need_download, len(skipped)


def download_image(
    url: str,
    save_path: Path,
    headers: Dict[str, str],
    timeout: int = 30,
    max_retries: int = 3,
    progress_callback=None
) -> Tuple[bool, Optional[str], int]:
    for attempt in range(max_retries):
        temp_path = save_path.with_suffix(f"{save_path.suffix}.part")
        try:
            with requests.get(url, headers=headers, timeout=timeout, verify=False, stream=True) as response:
                if response.status_code == 404:
                    return False, "文件不存在 (404)", 0
                if response.status_code == 403:
                    return False, "访问被拒绝 (403)", 0
                if response.status_code != 200:
                    return False, f"HTTP错误 {response.status_code}", 0

                save_path.parent.mkdir(parents=True, exist_ok=True)
                expected_size = int(response.headers.get("Content-Length", "0") or 0)
                downloaded_size = 0

                with temp_path.open("wb") as file_obj:
                    for chunk in response.iter_content(chunk_size=1024 * 64):
                        if not chunk:
                            continue
                        file_obj.write(chunk)
                        chunk_size = len(chunk)
                        downloaded_size += chunk_size
                        if callable(progress_callback):
                            progress_callback(chunk_size, downloaded_size, expected_size)

                if downloaded_size <= 0:
                    try:
                        temp_path.unlink(missing_ok=True)
                    except Exception:
                        pass
                    return False, "下载的文件为空", 0

                temp_path.replace(save_path)
                return True, None, downloaded_size

        except requests.exceptions.Timeout:
            if attempt < max_retries - 1:
                time.sleep(1.5)
                continue
            return False, "请求超时", 0
        except requests.exceptions.ConnectionError:
            if attempt < max_retries - 1:
                time.sleep(1.5)
                continue
            return False, "连接错误", 0
        except Exception as error:
            if attempt < max_retries - 1:
                time.sleep(1.5)
                continue
            return False, str(error), 0
        finally:
            if temp_path.exists():
                try:
                    temp_path.unlink()
                except Exception:
                    pass

    return False, "未知错误", 0


def run_download(
    json_file: Path,
    output_dir: Path,
    verify_integrity: bool,
    assume_yes: bool,
    timeout: int,
    retries: int,
    max_workers: int
) -> int:
    if not json_file.exists() or not json_file.is_file():
        raise FileNotFoundError(f"JSON文件不存在: {json_file}")

    with json_file.open("r", encoding="utf-8") as file_obj:
        data = json.load(file_obj)

    urls = extract_image_urls(data)
    unique_urls = dedup_keep_order(urls)
    print(f"找到 {len(urls)} 个image_url，去重后 {len(unique_urls)} 个", flush=True)

    if not unique_urls:
        emit_event(
            "complete",
            json_file=str(json_file),
            output_dir=str(output_dir),
            total=0,
            success=0,
            failed=0,
            skipped=0,
            report_path=""
        )
        return 0

    output_dir.mkdir(parents=True, exist_ok=True)
    need_download, skipped_count = verify_existing_files(output_dir, unique_urls, verify_integrity=verify_integrity)
    total_need = len(need_download)

    if total_need == 0:
        emit_event(
            "complete",
            json_file=str(json_file),
            output_dir=str(output_dir),
            total=0,
            success=0,
            failed=0,
            skipped=skipped_count,
            report_path=""
        )
        return 0

    if not assume_yes:
        proceed = input(f"是否继续下载 {total_need} 个文件? (y/n): ").strip().lower()
        if proceed != "y":
            emit_event("cancelled", message="用户取消下载")
            return 0

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Referer": "https://maimaidx.jp/"
    }

    base_url = "https://maimaidx.jp/maimai-mobile/img/Music/"
    success = 0
    failed: List[Tuple[str, str]] = []
    total_downloaded_bytes = 0
    start_time = time.time()
    last_emit_time = 0.0
    completed_count = 0
    active_progress: Dict[str, Tuple[int, int]] = {}
    stats_lock = threading.Lock()
    worker_count = max(1, min(32, int(max_workers)))

    emit_event(
        "start",
        json_file=str(json_file),
        output_dir=str(output_dir),
        total=total_need,
        skipped=skipped_count,
        workers=worker_count
    )

    def emit_progress_locked(current_file: str, force: bool = False) -> None:
        nonlocal last_emit_time
        now = time.time()
        if not force and (now - last_emit_time) < 0.2:
            return

        partial_ratio = 0.0
        for downloaded_size, expected_size in active_progress.values():
            if expected_size > 0:
                partial_ratio += max(0.0, min(0.999, downloaded_size / expected_size))

        overall_ratio = (completed_count + partial_ratio) / max(total_need, 1)
        overall_ratio = max(0.0, min(1.0, overall_ratio))
        speed_bps = total_downloaded_bytes / max(now - start_time, 0.001)
        emit_event(
            "progress",
            percent=round(overall_ratio * 100, 2),
            speed_bps=round(speed_bps, 2),
            completed=completed_count,
            total=total_need,
            success=success,
            failed=len(failed),
            current_file=current_file
        )
        last_emit_time = now

    def download_one(img_name: str) -> None:
        nonlocal success, completed_count, total_downloaded_bytes
        url = f"{base_url}{img_name}"
        save_path = output_dir / img_name

        def progress_callback(chunk_size: int, downloaded_size: int, expected_size: int) -> None:
            nonlocal total_downloaded_bytes
            with stats_lock:
                total_downloaded_bytes += int(chunk_size)
                active_progress[img_name] = (int(downloaded_size), int(expected_size or 0))
                emit_progress_locked(current_file=img_name, force=False)

        ok, error_message, _downloaded_bytes = download_image(
            url=url,
            save_path=save_path,
            headers=headers,
            timeout=timeout,
            max_retries=retries,
            progress_callback=progress_callback
        )

        with stats_lock:
            active_progress.pop(img_name, None)
            completed_count += 1
            if ok:
                success += 1
            else:
                failed.append((img_name, str(error_message or "未知错误")))
            emit_progress_locked(current_file=img_name, force=True)

    with concurrent.futures.ThreadPoolExecutor(max_workers=worker_count) as executor:
        futures = [executor.submit(download_one, img_name) for img_name in need_download]
        for future in concurrent.futures.as_completed(futures):
            future.result()

    if failed:
        failed_path = output_dir / "failed_downloads.txt"
        with failed_path.open("w", encoding="utf-8") as file_obj:
            file_obj.write("失败下载列表:\n")
            for name, error_message in failed:
                file_obj.write(f"{name}: {error_message}\n")
        print(f"失败记录已保存到: {failed_path}", flush=True)

    total_size = 0
    file_count = 0
    for entry in output_dir.iterdir():
        if entry.is_file():
            total_size += entry.stat().st_size
            file_count += 1

    report_path = output_dir / "download_report.txt"
    with report_path.open("w", encoding="utf-8") as file_obj:
        file_obj.write("下载报告\n")
        file_obj.write(f"生成时间: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
        file_obj.write(f"{'=' * 40}\n")
        file_obj.write(f"JSON文件: {json_file}\n")
        file_obj.write(f"找到的image_url总数: {len(urls)}\n")
        file_obj.write(f"去重后的总数: {len(unique_urls)}\n")
        file_obj.write(f"需要下载的文件数: {total_need}\n")
        file_obj.write(f"成功下载: {success}\n")
        file_obj.write(f"下载失败: {len(failed)}\n")
        file_obj.write(f"跳过已存在: {skipped_count}\n")
        file_obj.write(f"最终文件总数: {file_count}\n")
        file_obj.write(f"总大小: {total_size / 1024 / 1024:.2f} MB\n")

    emit_event(
        "complete",
        json_file=str(json_file),
        output_dir=str(output_dir),
        total=total_need,
        success=success,
        failed=len(failed),
        skipped=skipped_count,
        report_path=str(report_path)
    )

    return 0


def choose_json_file_interactively(data_dir: Path) -> Path:
    candidates = list_data_json_files(data_dir)
    if not candidates:
        raise FileNotFoundError(f"Data目录中未找到JSON文件: {data_dir}")

    if len(candidates) == 1:
        selected = candidates[0]
        print(f"自动选择JSON: {selected}", flush=True)
        return selected

    print("检测到多个JSON文件，请输入序号选择:", flush=True)
    for idx, path_obj in enumerate(candidates, 1):
        print(f"  {idx}. {path_obj.name}", flush=True)

    while True:
        raw = input("请选择JSON序号: ").strip()
        try:
            index = int(raw)
        except Exception:
            print("输入无效，请输入数字序号。", flush=True)
            continue
        if 1 <= index <= len(candidates):
            selected = candidates[index - 1]
            print(f"已选择: {selected}", flush=True)
            return selected
        print("序号超出范围，请重新输入。", flush=True)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Download maimai illustration images from image_url fields.")
    parser.add_argument("--data-dir", default="Data", help="Data目录路径，用于发现JSON文件")
    parser.add_argument("--json-file", default="", help="要读取的JSON文件路径")
    parser.add_argument("--output-dir", default="Result", help="图片输出目录")
    parser.add_argument("--list-json", action="store_true", help="仅列出Data目录中的JSON文件")
    parser.add_argument("--verify-existing", action="store_true", help="验证已存在文件完整性")
    parser.add_argument("--yes", action="store_true", help="不询问，直接开始下载")
    parser.add_argument("--timeout", type=int, default=30, help="单请求超时时间（秒）")
    parser.add_argument("--retries", type=int, default=3, help="单文件重试次数")
    parser.add_argument("--max-workers", type=int, default=32, help="并发线程数，最大32")
    return parser


def main() -> int:
    configure_utf8_stdio()
    args = build_parser().parse_args()
    try:
        data_dir = Path(args.data_dir).resolve()

        if args.list_json:
            json_files = list_data_json_files(data_dir)
            files_payload = []
            for path_obj in json_files:
                files_payload.append({
                    "name": path_obj.name,
                    "path": str(path_obj),
                    "size": int(path_obj.stat().st_size)
                })
            emit_event("json_list", data_dir=str(data_dir), count=len(files_payload), files=files_payload)
            print(f"Data目录中找到 {len(files_payload)} 个JSON文件", flush=True)
            return 0

        if args.json_file:
            selected_json = Path(args.json_file).resolve()
        else:
            selected_json = choose_json_file_interactively(data_dir)

        output_dir = Path(args.output_dir).resolve()
        return run_download(
            json_file=selected_json,
            output_dir=output_dir,
            verify_integrity=bool(args.verify_existing),
            assume_yes=bool(args.yes),
            timeout=max(3, int(args.timeout)),
            retries=max(1, int(args.retries)),
            max_workers=max(1, min(32, int(args.max_workers)))
        )

    except Exception as error:
        emit_event("error", message=str(error))
        print(f"ERROR: {error}", file=sys.stderr, flush=True)
        return 1


if __name__ == "__main__":
    sys.exit(main())
