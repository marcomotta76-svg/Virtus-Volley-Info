#!/usr/bin/env python3
"""Importa il feed pubblico delle gare FIPAV Virtus Caserta nel formato Volley Info.
Questo importatore non inventa risultati né ricalcola classifiche da gare parziali.
"""
import argparse
import datetime as dt
import json
import os
import pathlib
import sys
from urllib.parse import urljoin
import requests

SOURCE="https://kushnirandriy-droid.github.io/app-pallavolo/data.json"
ASSET_ROOT="https://kushnirandriy-droid.github.io/app-pallavolo/"

def convert(src):
    if not isinstance(src,dict) or src.get("stagione")!="2026/27":
        raise ValueError("Stagione non valida")
    if len(src.get("gare",[]))<40 or len(src.get("campionati",[]))<4:
        raise ValueError("Archivio incompleto; non pubblicare")
    orig_teams=src["squadre"]
    competitions=[]
    for c in src["campionati"]:
        if not c.get("virtus"):continue
        short=c["nome"].replace("Femminile","F").replace("Maschile","M").replace("Under ","U").replace("1 Divisione","1ª Div.")
        if str(c.get("girone","")).lower()!="unico":short+=" · Gir. "+str(c.get("girone",""))
        competitions.append(dict(id=c["id"],name=c["nome"],group=c.get("girone"),short=short,
            gender="M" if "maschil" in c["nome"].lower() else "F",
            coverage="complete" if c.get("tutte_le_gare") else "partial",
            source="FIPAV Campania" if c["fonte"]=="campania" else "FIPAV Caserta",
            sourceUrl=c.get("url"),standings=[]))
    comps={c["id"]:c for c in competitions}
    pairs=set()
    for g in src["gare"]:
        if g["campionato"] in comps:
            pairs.add((g["casa"],g["campionato"]))
            pairs.add((g["ospite"],g["campionato"]))
    for c in src["campionati"]:
        if c["id"] in comps:
            for r in c.get("classifica",[]):pairs.add((r["squadra"],c["id"]))
    teams=[]
    for sid,cid in sorted(pairs):
        s=orig_teams.get(sid)
        if s is None:continue
        logo=("logos/virtus_caserta_original.png" if s.get("virtus") else
              urljoin(ASSET_ROOT,s["logo"]) if s.get("logo") else None)
        teams.append(dict(id=sid+"__"+cid,sourceTeamId=sid,name=s.get("nome","?"),
                          isVirtus=bool(s.get("virtus")),competitionIds=[cid],logo=logo))
    teamids={t["id"] for t in teams}
    for c in src["campionati"]:
        if c["id"] not in comps:continue
        dest=comps[c["id"]]
        for r in c.get("classifica",[]):
            tid=r["squadra"]+"__"+c["id"]
            if tid not in teamids:continue
            dest["standings"].append(dict(teamId=tid,position=r.get("pos"),points=r.get("punti",0),
                played=r.get("g",0),wins=r.get("v",0),losses=r.get("p",0),
                sf=r.get("sf",0),sa=r.get("ss",0),pf=r.get("pf",0),pa=r.get("ps",0),penalty=r.get("pen",0)))
    venues=[dict(id=vid,name=v.get("nome","Impianto sportivo"),city=v.get("citta",""),
        address=", ".join(str(x) for x in [v.get("via"),v.get("citta"),v.get("prov")] if x),
        lat=v.get("lat"),lon=v.get("lon"),maps=v.get("maps"))
        for vid,v in src["palestre"].items()]
    matches=[]
    for g in src["gare"]:
        cid=g["campionato"]
        if cid not in comps:continue
        home=g["casa"]+"__"+cid;away=g["ospite"]+"__"+cid
        if home not in teamids or away not in teamids:continue
        score=g.get("set")
        played=isinstance(score,list) and len(score)==2 and score[0] is not None
        matches.append(dict(id=g["id"],competitionId=cid,round=g.get("giornata"),
            datetime=g.get("data"),homeId=home,awayId=away,venueId=g.get("palestra"),
            status="played" if played else "scheduled",statusLabel=g.get("stato_testo") or g.get("stato") or "",
            score=score if played else None,sets=g.get("parziali",[]) if played else [],
            sourceUrl=g.get("url") or comps[cid].get("sourceUrl")))
    matches.sort(key=lambda m:(m["datetime"] or "9999",m["id"]))
    if len(matches)<40 or not any(t["isVirtus"] for t in teams):
        raise ValueError("Mancano gare Virtus nell'archivio")
    return dict(version=2,mode="official",season="2026/27",updatedAt=src["aggiornato"],
      club=dict(name="VIRTUS CASERTA",shortName="Virtus Caserta",city="Caserta",
                logo="logos/virtus_caserta_original.png"),
      competitions=competitions,teams=teams,venues=venues,matches=matches,
      provenance=dict(source="FIPAV Caserta / FIPAV Campania via app-pallavolo",
          url=SOURCE,retrievedAt=dt.datetime.now(dt.timezone.utc).isoformat(),
          note="Alcuni gironi contengono solo le gare Virtus; gare avversarie non sempre complete."))

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--output",default="public/data.json")
    p.add_argument("--source",default=SOURCE)
    a=p.parse_args()
    session=requests.Session()
    r=session.get(a.source,timeout=35,headers={"User-Agent":"Virtus-Volley-Info/1.0 (informational PWA)"})
    r.raise_for_status()
    out=convert(r.json())
    path=pathlib.Path(a.output)
    path.parent.mkdir(parents=True,exist_ok=True)
    temp=path.with_suffix(".tmp")
    temp.write_text(json.dumps(out,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    temp.replace(path)
    print("FIPAV:",len(out["competitions"]),"campionati,",len(out["teams"]),"squadre,",len(out["matches"]),"gare. Fonte aggiornata:",out["updatedAt"])

if __name__=="__main__":
    try:main()
    except Exception as exc:
        print("ERRORE aggiornamento:",exc,file=sys.stderr)
        sys.exit(1)
