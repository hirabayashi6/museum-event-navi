# やさしい日本語の文言に、小学2年生までに習う漢字（1年80字＋2年160字）以外が入っていないかを調べる
import re
import sys

G1 = "一右雨円王音下火花貝学気九休玉金空月犬見五口校左三山子四糸字耳七車手十出女小上森人水正生青夕石赤千川先早草足村大男竹中虫町天田土二日入年白八百文木本名目立力林六"
G2 = ("引羽雲園遠何科夏家歌画回会海絵外角楽活間丸岩顔汽記帰弓牛魚京強教近兄形計元言原戸古午後語工公広交光考行高黄合谷国黒今才細作算止市矢姉思紙寺自時室社弱首秋週春書少場色食心新親図数西声星晴切雪船線前組走多太体台地池知茶昼長鳥朝直通弟店点電刀冬当東答頭同道読内南肉馬売買麦半番父風分聞米歩母方北毎妹万明鳴毛門夜野友用曜来里理話")
OK = set(G1) | set(G2)
assert len(G1) == 80 and len(G2) == 160, (len(G1), len(G2))

src = open(sys.argv[1], encoding="utf-8").read()
# 「easy: "…"」の文字列だけを調べる
bad = {}
for m in re.finditer(r'easy:\s*"([^"]*)"', src):
    for ch in m.group(1):
        if "一" <= ch <= "鿿" and ch not in OK:
            bad.setdefault(ch, []).append(m.group(1))
if bad:
    for ch, where in bad.items():
        print(f"範囲外の漢字「{ch}」: {where[0]}")
    sys.exit(1)
print(f"やさしい日本語 {len(re.findall(r'easy:', src))}か所、範囲外の漢字 0字")
