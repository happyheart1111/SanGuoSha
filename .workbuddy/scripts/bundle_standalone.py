# -*- coding: utf-8 -*-
"""把三国杀多文件项目打包为单个自包含 HTML（内联 game.css 与全部 src/*.js）。"""
import re
import sys
from pathlib import Path

ROOT = Path(r"C:\Users\admin\Documents\三国杀")
HTML = ROOT / "index.html"
OUT = ROOT / "sanguosha-standalone.html"

html = HTML.read_text(encoding="utf-8")

# 1) 内联 CSS
def inline_css(m):
    href = m.group(1)
    css = (ROOT / href).read_text(encoding="utf-8")
    return f"<style>\n{css}\n</style>"

html = re.sub(r'<link rel="stylesheet" href="([^"]+\.css)">', inline_css, html)

# 2) 内联 JS（保持原有加载顺序；排除 https?:// 外链如 peerjs CDN）
def inline_js(m):
    src = m.group(1)
    js = (ROOT / src).read_text(encoding="utf-8")
    return f"<script>\n{js}\n</script>"

html = re.sub(r'<script src="((?!https?://)[^"]+\.js)"></script>', inline_js, html)

# 3) 安全检查：不应残留任何本地的 <link href> / <script src>（CDN 的 peerjs 保留）
remaining = re.findall(r'<(?:link|script)[^>]+(?:href|src)="(?!https?:)[^"]*"', html)
if remaining:
    print("WARNING: 仍有本地资源引用未内联：")
    for r in remaining:
        print("  ", r)
    sys.exit(1)

OUT.write_text(html, encoding="utf-8")
print(f"OK  -> {OUT}")
print(f"     size = {OUT.stat().st_size:,} bytes")
