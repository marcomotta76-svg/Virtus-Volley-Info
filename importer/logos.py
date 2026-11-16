#!/usr/bin/env python3
"""Scarica soltanto loghi di società verificabili da fonti pubbliche.
Le immagini sono validate e servite localmente (no link remoto fragile).
Se mancano, l'app mostra iniziali; mai attribuire uno stemma casuale.
"""
import io
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse
import requests
from PIL import Image, UnidentifiedImageError

BASE="https://caserta.portalefipav.net"
# Associazioni identificate sul portale ufficiale: ID della SOCIETA, non del team.
# Fonte: https://caserta.portalefipav.net/elenco-societa.aspx?ComitatoId=19&PId=7267&SId={id}
REGIONAL_ASSOCIATIONS={
 "FOLGORE VAIRANO":731,
 "CARBAT MATESE":4900,
 "CASAPANE SAN MARCO VOLLEY":729,
}
# URL fotografico etichettato esattamente "PALLAVOLO TELESE LOGO" nella
# notizia del 06/07/2026; non usare come fonte risultati.
EDITORIAL_LOGOS={
 "PALLAVOLO TELESE":"https://www.gazzettabenevento.it/sites/default/files/styles/copertina_proporzioni_originali/public/2026-07/PALLAVOLO%20TELESE%20LOGO.jpg?itok=nG2rnaM6",
 "ELISA VOLLEY POMIGLIANO":"https://volleybox.net/media/upload/teams/big_16873002399e0mM.png",
 "ACADEMY VOLLEY FIAMMA":"https://volleybox.net/media/upload/teams/1691847559lVmC6.png",
}
def valid_image(body):
    if not body or len(body)<700 or len(body)>4000000:return None
    try:
        im=Image.open(io.BytesIO(body))
        if im.width<48 or im.height<48 or im.width>5000 or im.height>5000:return None
        im.load()
        return im
    except (UnidentifiedImageError,OSError,ValueError):
        return None

def download(session,urls):
    for url in urls:
        try:
            response=session.get(url,timeout=12,headers={"Referer":BASE+"/"})
            if response.status_code!=200:continue
            im=valid_image(response.content)
            if im is not None:return im,url
        except requests.RequestException:pass
    return None,None

def main(path):
    p=Path(path);data=json.loads(p.read_text(encoding="utf8"))
    logos=p.parent/"logos";logos.mkdir(parents=True,exist_ok=True)
    session=requests.Session()
    session.headers.update({"User-Agent":"Mozilla/5.0 (compatible; VirtusVolleyInfo/1.0; public asset cache)"})
    logos_by_sid={}
    found=missing=0
    for team in data["teams"]:
        if team.get("isVirtus"):
            team["logo"]="logos/virtus_caserta_original.png"
            continue
        sid=None
        match=re.match(r"ce-(\d+)-",team.get("sourceTeamId",""))
        if match:
            sid=int(match.group(1))
        if sid is None:
            sid=REGIONAL_ASSOCIATIONS.get(team["name"].strip().upper())
        image=None;source=None;key=None
        if sid is not None:
            key=f"ce-{sid}"
            if key not in logos_by_sid:
                root=f"{BASE}/mngArea/Societa/img/{sid}/Loghi/LogoS{sid}"
                candidates=[root+ext for ext in (".png",".jpg",".jpeg",".gif")]
                logos_by_sid[key]=download(session,candidates)
            image,source=logos_by_sid[key]
        if image is None and team["name"].strip().upper() in EDITORIAL_LOGOS:
            image,source=download(session,[EDITORIAL_LOGOS[team["name"].strip().upper()]])
            key="external-"+re.sub(r"[^a-z0-9]+","-",team["name"].lower()).strip("-")
        if image is None:
            team["logo"]=None
            missing+=1
            continue
        dest=logos/(key+".png")
        if not dest.exists():
            image.thumbnail((180,180),Image.Resampling.LANCZOS)
            image.convert("RGBA").save(dest,format="PNG",optimize=True)
        team["logo"]="logos/"+dest.name
        found+=1
    p.write_text(json.dumps(data,ensure_ascii=False,separators=(",",":")),encoding="utf8")
    missing_names=sorted({t["name"] for t in data["teams"] if not t.get("logo")})
    print(f"LOGHI_VERIFICATI squadre={found}, senza_immagine={missing}, distinti={len(list(logos.glob('*.png')))}",flush=True)
    print("LOGHI_MANCANTI:",", ".join(missing_names),flush=True)
    # Non fallire pubblicazione se un logo manca. Risultati e classifiche prioritari.

if __name__=="__main__":
    main(sys.argv[1] if len(sys.argv)>1 else "public/data.json")
