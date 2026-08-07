#!/usr/bin/env python3
"""Monta o criativo vertical de 15s (kinetic typography) para Reels."""
import subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H, FPS, DUR = 1080, 1920, 30, 15.0
TOTAL = int(FPS * DUR)
OUT = sys.argv[1]

BG      = (10, 10, 12)
WHITE   = (246, 246, 244)
ACCENT  = (37, 211, 102)
MUTED   = (110, 110, 118)

BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
_fc = {}
def font(size):
    if size not in _fc:
        _fc[size] = ImageFont.truetype(BOLD, size)
    return _fc[size]

# ---------- fundo: vinheta + grão ----------
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
r = np.sqrt(((xx - W / 2) / (W * 0.78)) ** 2 + ((yy - H / 2) / (H * 0.78)) ** 2)
VIG = np.clip(1.0 - 0.55 * r ** 1.7, 0.35, 1.0)[..., None]
BASE = (np.array(BG, np.float32) * VIG)
GRAIN = [np.random.normal(0, 2.0, (H, W, 1)).astype(np.float32) for _ in range(12)]

SAFE = W - 200          # margem lateral: nada encosta na borda

def ease_out(t):   return 1 - (1 - min(max(t, 0.0), 1.0)) ** 3
def ease_in(t):    return min(max(t, 0.0), 1.0) ** 2

def text_w(s, f): return f.getlength(s)

def fit(size, longest, gap_n=0, gap=18):
    """Reduz o corpo até a linha mais larga caber na área segura."""
    while size > 24:
        f = font(size)
        if text_w(longest, f) + gap_n * gap <= SAFE:
            return f
        size -= 4
    return font(size)

def draw_words(d, words, f, cy, gap=18, line_gap=1.14):
    """words: lista de linhas; cada linha é lista de (texto, cor, alpha)."""
    lh = f.size * line_gap
    top = cy - (len(words) * lh) / 2
    for i, line in enumerate(words):
        total = sum(text_w(w, f) for w, _, _ in line) + gap * (len(line) - 1)
        x = (W - total) / 2
        y = top + i * lh
        for w, col, a in line:
            d.text((x, y), w, font=f, fill=(*col, int(255 * a)))
            x += text_w(w, f) + gap

def sweep(d, lines, size, cy, prog, base=WHITE, hot=ACCENT):
    """Legenda com a palavra corrente destacada."""
    widest = max(lines, key=lambda ln: len("".join(ln)))
    f = fit(size, "".join(widest), len(widest) - 1)
    flat = [w for ln in lines for w in ln]
    cur = min(int(prog * len(flat)), len(flat) - 1)
    k, out = 0, []
    for ln in lines:
        row = []
        for w in ln:
            row.append((w, hot if k == cur else base, 1.0 if k <= cur else 0.22))
            k += 1
        out.append(row)
    draw_words(d, out, f, cy)

def chevron(d, cx, cy, w, h, col, a):
    d.line([(cx - w, cy - h), (cx, cy), (cx + w, cy - h)],
           fill=(*col, int(255 * a)), width=14, joint="curve")

def letterspaced(d, s, f, cy, col, a, sp=8):
    total = sum(text_w(c, f) for c in s) + sp * (len(s) - 1)
    x = (W - total) / 2
    for c in s:
        d.text((x, cy), c, font=f, fill=(*col, int(255 * a)))
        x += text_w(c, f) + sp

# ---------- cenas ----------
def scene_hook(d, t):                                   # 0.00 - 2.80
    rows = [("EU JUREI", 0.00, WHITE), ("QUE ERA", 0.42, WHITE), ("GOLPE.", 0.86, ACCENT)]
    lh = 175
    top = H / 2 - lh
    for i, (txt, t0, col) in enumerate(rows):
        if t < t0:
            continue
        e = ease_out((t - t0) / 0.26)
        f = fit(int(150 * (0.86 + 0.14 * e)), txt)
        d.text(((W - text_w(txt, f)) / 2, top + i * lh - (1 - e) * 26),
               txt, font=f, fill=(*col, int(255 * e)))

def scene_b(d, t):                                      # 2.80 - 5.40
    sweep(d, [["UM", "GRUPO", "NO"], ["WHATSAPP", "QUE"], ["POSTA", "OFERTA"]], 92, H / 2, t / 2.60)

def scene_c(d, t):                                      # 5.40 - 7.10
    sweep(d, [["DE", "ELETRÔNICO"], ["E", "GAMER"]], 108, H / 2, t / 1.70)

def scene_punch(d, t):                                  # 7.10 - 8.80
    e = ease_out(t / 0.22)
    pulse = 1 + 0.035 * np.sin(t * 7.5)
    f = fit(int(215 * (0.7 + 0.3 * e) * pulse), "TODO")
    for i, txt in enumerate(("TODO", "DIA")):
        y = H / 2 - f.size * 1.05 + i * f.size * 1.05
        d.text(((W - text_w(txt, f)) / 2, y), txt, font=f, fill=(*ACCENT, int(255 * e)))

ITEMS = ["HEADSET", "TECLADO", "MONITOR", "CELULAR", "FONE"]
def scene_list(d, t):                                   # 8.80 - 11.00
    step = 2.20 / len(ITEMS)
    i = min(int(t / step), len(ITEMS) - 1)
    e = ease_out((t - i * step) / 0.14)
    txt = ITEMS[i]
    f = fit(int(132 * (0.9 + 0.1 * e)), txt)
    tw = text_w(txt, f)
    d.text(((W - tw) / 2, H / 2 - f.size * 0.6), txt, font=f, fill=(*WHITE, int(255 * e)))
    bw = tw * ease_out((t - i * step) / 0.3)
    d.rectangle([(W - bw) / 2, H / 2 + f.size * 0.62, (W + bw) / 2, H / 2 + f.size * 0.62 + 10],
                fill=(*ACCENT, 255))

def scene_f(d, t):                                      # 11.00 - 12.70
    sweep(d, [["AGORA", "EU", "CONFIRO"], ["ANTES", "DE", "COMPRAR"]], 86, H / 2, t / 1.70)

def scene_cta(d, t):                                    # 12.70 - 15.00
    e = ease_out(t / 0.3)
    f = fit(155, "É DE GRAÇA")
    for i, (txt, col) in enumerate((("ENTRAR", WHITE), ("É DE GRAÇA", ACCENT))):
        d.text(((W - text_w(txt, f)) / 2, H / 2 - 330 + i * f.size * 1.12 - (1 - e) * 20),
               txt, font=f, fill=(*col, int(255 * e)))
    for i in range(3):                                   # setas descendo
        ph = (t * 1.7 - i * 0.18) % 1.0
        chevron(d, W / 2, H / 2 + 60 + i * 62 + ph * 18, 46, 34, ACCENT,
                (1 - ph) * 0.85 * ease_out(t / 0.5))
    letterspaced(d, "TOQUE NO LINK", font(52), H / 2 + 330, MUTED, ease_out((t - 0.5) / 0.5), 12)

SCENES = [(0.00, 2.80, scene_hook), (2.80, 5.40, scene_b), (5.40, 7.10, scene_c),
          (7.10, 8.80, scene_punch), (8.80, 11.00, scene_list), (11.00, 12.70, scene_f),
          (12.70, 15.00, scene_cta)]

# ---------- render ----------
ff = "/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2"
p = subprocess.Popen(
    [ff, "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
     "-i", "-", "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "22",
     "-pix_fmt", "yuv420p", "-movflags", "+faststart", OUT],
    stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

for n in range(TOTAL):
    t = n / FPS
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    for t0, t1, fn in SCENES:
        if t0 <= t < t1:
            fn(d, t - t0)
            break

    # barra de progresso
    d.rectangle([70, 96, W - 70, 103], fill=(*MUTED, 70))
    d.rectangle([70, 96, 70 + (W - 140) * (t / DUR), 103], fill=(*ACCENT, 255))

    frame = BASE + GRAIN[n % 12]
    lay = np.asarray(layer, np.float32)
    a = lay[..., 3:4] / 255.0
    frame = frame * (1 - a) + lay[..., :3] * a
    p.stdin.write(np.clip(frame, 0, 255).astype(np.uint8).tobytes())

p.stdin.close()
p.wait()
print("ok", OUT)
