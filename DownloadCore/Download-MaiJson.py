#!/usr/bin/env python3
"""
Download songdata + fish data, wait 1 second, merge to MusicALL.json.
After merge, delete temp files songdata.json and Music-Fish.json by default.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple


DEFAULT_UPDATE_URL = "https://bucket-1256206908.cos.ap-shanghai.myqcloud.com/update.json"
DEFAULT_FISH_URL = "https://www.diving-fish.com/api/maimaidxprober/music_data"
USER_AGENT = "MaimaiData-DownloadJson/1.0"


def fetch_json(url: str, timeout: int, retries: int) -> dict:
    last_error: Optional[Exception] = None
    for attempt in range(1, retries + 1):
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": USER_AGENT,
                "Accept": "application/json,text/plain,*/*",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as response:
                charset = response.headers.get_content_charset() or "utf-8"
                payload = json.loads(response.read().decode(charset, errors="replace"))
                if not isinstance(payload, dict):
                    raise ValueError("update.json is not a JSON object")
                if isinstance(payload.get("data"), dict):
                    return payload["data"]
                return payload
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ValueError) as exc:
            last_error = exc
            if attempt < retries:
                time.sleep(1.2 * attempt)
            else:
                break
    raise RuntimeError(f"failed to fetch '{url}': {last_error}") from last_error


def collect_data_slots(meta: dict) -> Dict[int, Tuple[Optional[str], str]]:
    pattern = re.compile(r"^data_url(?:_(\d+))?$")
    slots: Dict[int, Tuple[Optional[str], str]] = {}
    for key, value in meta.items():
        m = pattern.match(key)
        if not m or not isinstance(value, str) or not value.strip():
            continue
        slot = int(m.group(1) or "0")
        version_key = "data_version" if slot == 0 else f"data_version_{slot}"
        version = meta.get(version_key) if isinstance(meta.get(version_key), str) else None
        slots[slot] = (version, value)
    return slots


def select_slot(
    slots: Dict[int, Tuple[Optional[str], str]], requested_slot: Optional[int]
) -> Tuple[int, Optional[str], str]:
    if not slots:
        raise RuntimeError("no data_url fields found in update metadata")
    if requested_slot is not None:
        if requested_slot not in slots:
            available = ", ".join(str(s) for s in sorted(slots.keys()))
            raise RuntimeError(
                f"requested slot {requested_slot} not found; available slots: {available}"
            )
        version, url = slots[requested_slot]
        return requested_slot, version, url
    slot = max(slots.keys())
    version, url = slots[slot]
    return slot, version, url


def download_file(url: str, output_path: Path, timeout: int, retries: int) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    last_error: Optional[Exception] = None
    for attempt in range(1, retries + 1):
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as response:
                with output_path.open("wb") as f:
                    while True:
                        chunk = response.read(1024 * 128)
                        if not chunk:
                            break
                        f.write(chunk)
            return
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            last_error = exc
            if attempt < retries:
                time.sleep(1.2 * attempt)
            else:
                break
    raise RuntimeError(f"failed to download '{url}': {last_error}") from last_error


def load_json_list(path: Path) -> List[Dict[str, Any]]:
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise ValueError(f"{path} is not a JSON array")
    return [item for item in data if isinstance(item, dict)]


def build_index(items: Iterable[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    result: Dict[str, Dict[str, Any]] = {}
    for item in items:
        if "id" in item:
            result[str(item["id"])] = item
    return result


def first_non_none(*values: Any) -> Any:
    for v in values:
        if v is not None:
            return v
    return None


def map_type(value: Any) -> str:
    raw = str(value or "")
    if raw == "SD":
        return "标准"
    if raw == "DX":
        return "DX"
    return raw


def ensure_list(value: Any) -> List[Any]:
    return value if isinstance(value, list) else []


def dedup_keep_order(items: List[Any]) -> List[Any]:
    seen = set()
    out = []
    for x in items:
        key = json.dumps(x, ensure_ascii=False, sort_keys=True) if isinstance(x, (dict, list)) else x
        if key in seen:
            continue
        seen.add(key)
        out.append(x)
    return out


def synthesize_152j(song_path: Path, fish_path: Path, merged_path: Path) -> Tuple[int, int, int]:
    song_list = load_json_list(song_path)
    fish_map = build_index(load_json_list(fish_path))

    records: List[Dict[str, Any]] = []
    for song in song_list:
        sid = str(song.get("id", ""))
        if not sid:
            continue
        fish = fish_map.get(sid, {})
        sbi = song.get("basic_info", {}) if isinstance(song.get("basic_info"), dict) else {}
        fbi = fish.get("basic_info", {}) if isinstance(fish.get("basic_info"), dict) else {}

        alias = [a for a in ensure_list(song.get("alias")) if isinstance(a, str)]
        alias = dedup_keep_order(alias)

        ds = ensure_list(first_non_none(song.get("ds"), fish.get("ds")))
        level = ensure_list(first_non_none(song.get("level"), fish.get("level")))
        old_ds = ensure_list(first_non_none(song.get("old_ds"), song.get("ds"), fish.get("ds")))
        title = first_non_none(
            song.get("title"), fish.get("title"), sbi.get("title"), fbi.get("title"), ""
        )
        type_value = first_non_none(song.get("type"), fish.get("type"), "")

        base_info = {
            "artist": first_non_none(sbi.get("artist"), fbi.get("artist"), ""),
            "bpm": first_non_none(sbi.get("bpm"), fbi.get("bpm"), 0),
            "版本": first_non_none(sbi.get("from"), fbi.get("from"), ""),
            "流派": first_non_none(sbi.get("genre"), fbi.get("genre"), ""),
            "image_url": first_non_none(sbi.get("image_url"), ""),
            "是否为Best15曲": bool(first_non_none(sbi.get("is_new"), fbi.get("is_new"), False)),
            "歌名": title,
            "版本代号": str(first_non_none(sbi.get("version"), "")),
            "定数": ds,
            "MusicID": sid,
            "等级": level,
            "老定数": old_ds,
            "title": title,
            "type": map_type(type_value),
        }
        records.append({"别名": alias, "基础信息": base_info})

    with merged_path.open("w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=4)
        f.write("\n")
    return len(song_list), len(fish_map), len(records)


def remove_if_exists(path: Path) -> None:
    if path.exists():
        path.unlink()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Download songdata + fish json and merge to MusicALL.json."
    )
    parser.add_argument("--update-url", default=DEFAULT_UPDATE_URL)
    parser.add_argument("--slot", type=int, default=None)
    parser.add_argument("--output", default="songdata.json")
    parser.add_argument("--fish-url", default=DEFAULT_FISH_URL)
    parser.add_argument("--fish-output", default="Music-Fish.json")
    parser.add_argument("--merged-output", default="MusicALL.json")
    parser.add_argument("--timeout", type=int, default=30)
    parser.add_argument("--retries", type=int, default=3)
    parser.add_argument("--no-download", dest="download", action="store_false")
    parser.add_argument("--keep-temp", dest="cleanup_temp", action="store_false")
    parser.set_defaults(download=True, cleanup_temp=True)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        meta = fetch_json(args.update_url, timeout=args.timeout, retries=args.retries)
        slot, version, song_url = select_slot(
            collect_data_slots(meta), requested_slot=args.slot
        )
        print("Resolved download target:")
        print(f"  slot={slot}")
        print(f"  version={version or 'N/A'}")
        print(f"  url={song_url}")

        song_out = Path(args.output).resolve()
        fish_out = Path(args.fish_output).resolve()
        merged_out = Path(args.merged_output).resolve()

        if args.download:
            try:
                download_file(song_url, song_out, timeout=args.timeout, retries=args.retries)
                print(f"Downloaded to: {song_out}")
            except Exception as song_error:
                raise RuntimeError(
                    "songdata.json 下载失败: "
                    f"url='{song_url}', output='{song_out}', error={song_error}"
                ) from song_error

            try:
                download_file(args.fish_url, fish_out, timeout=args.timeout, retries=args.retries)
                print(f"Downloaded fish data to: {fish_out}")
            except Exception as fish_error:
                raise RuntimeError(
                    "Music-Fish.json 下载失败: "
                    f"url='{args.fish_url}', output='{fish_out}', error={fish_error}"
                ) from fish_error

            print("Both JSON files downloaded. Waiting 1 second before merge...")
            time.sleep(1)

        song_count, fish_count, merged_count = synthesize_152j(song_out, fish_out, merged_out)
        print(f"Merged output: {merged_out}")
        print(f"Merge stats: songdata={song_count}, fish={fish_count}, merged={merged_count}")

        if args.cleanup_temp:
            remove_if_exists(song_out)
            remove_if_exists(fish_out)
            print("Temp files deleted: songdata.json, Music-Fish.json")

        return 0
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
