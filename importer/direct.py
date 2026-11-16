#!/usr/bin/env python3
"""Collettore indipendente dai siti FIPAV Caserta e Campania.
Non legge feed di terzi. Output: data.json versione 2 della PWA.
La pubblicazione avviene soltanto dopo la validazione di tutte le fonti.
"""
import argparse
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo
from urllib.parse import quote_plus, urljoin
import json
import re
import sys
import time
import unicodedata
import html as html_lib

import requests
from bs4 import BeautifulSoup

TZ = ZoneInfo("Europe/Rome")
BASE_CE = "https://caserta.portalefipav.net"
BASE_CR = "https://www.fipavcampania.it/mobile"
STAGIONE = "2026/27"
STAGIONE_ID = 2399
COMITATO_ID = 19
PID = 7261
SOCIETA_ID = 5150
GIRONI_CE = {
  94216: ("1 Divisione Femminile", "A"),
  94304: ("Under 14 Femminile", "A"),
  94397: ("Under 14 Femminile", "B"),
  94233: ("Under 15 Femminile", "A"),
  94396: ("Under 15 Maschile", "Unico"),
  94228: ("Under 17 Femminile", "A"),
  94222: ("Under 19 Femminile", "A"),
  94223: ("Under 19 Femminile", "B"),
}
GIRONI_CR = {92747: ("Serie D Femminile", "C")}
DATA_SOURCE = "FIPAV Caserta e Campania (acquisizione diretta)"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; VirtusVolleyInfo/1.0; informational; +https://github.com/marcomotta76-svg/Virtus-Volley-Info)",
           "Accept-Language": "it-IT,it;q=0.9"}
SESSION = requests.Session()
SESSION.headers.update(HEADERS)
LAST_REQUEST = 0.0
REQUESTS_MADE = 0

def clean(s):
    return re.sub(r"\s+", " ", (s or "").replace("\xa0", " ")).strip()

def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")

def num(s):
    s = clean(s)
    if not s or not re.fullmatch(r"-?\d+", s):
        return None
    return int(s)

def date_it(text):
    m = re.search(r"(\d{1,2})/(\d{1,2})/(\d{2,4})(?:\s*(\d{1,2}):(\d{2}))?", clean(text))
    if not m:
        return None
    day, month, year = map(int, m.group(1,2,3))
    if year < 100: year += 2000
    try:
        return datetime(year, month, day, int(m[4] or 0), int(m[5] or 0), tzinfo=TZ).isoformat()
    except ValueError:
        return None

def get(url):
    global LAST_REQUEST, REQUESTS_MADE
    for trial in range(2):
        elapsed = time.monotonic() - LAST_REQUEST
        if elapsed < 0.85:
            time.sleep(0.85-elapsed)
        LAST_REQUEST = time.monotonic()
        REQUESTS_MADE += 1
        try:
            r = SESSION.get(url, timeout=35)
            r.raise_for_status()
            if len(r.content) < 450:
                raise ValueError("Risposta troppo corta")
            try:
                return r.content.decode("utf-8")
            except UnicodeDecodeError:
                return r.content.decode("cp1252", errors="replace")
        except (requests.RequestException, ValueError):
            if trial:
                raise
            time.sleep(2)

def soup(url):
    return BeautifulSoup(get(url), "html.parser")

def ce_results_url(cid):
    return (f"{BASE_CE}/risultati-classifiche.aspx?ComitatoId={COMITATO_ID}"
            f"&StId={STAGIONE_ID}&DataDa=&StatoGara=&CId={cid}&SId="
            f"&PId={PID}&btFiltro=CERCA")

def ce_standings_url(cid):
    return f"{BASE_CE}/classifica.aspx?CId={cid}"

def cr_results_url(cid):
    return f"{BASE_CR}/risultati.asp?CampionatoId={cid}"

def cr_details_url(cid, mid):
    return f"{BASE_CR}/risultati.asp?CampionatoId={cid}&GaraId={mid}"

def cr_standings_url(cid):
    return f"{BASE_CR}/risultati.asp?CampionatoId={cid}&vis=classifica"

class Collection:
    def __init__(self):
        self.comps, self.teams, self.matches, self.venues = {}, {}, {}, {}
        self.matches_per_comp = {}
    def comp(self,cid,name,group,source,url):
        short=name.replace("Femminile","F").replace("Maschile","M").replace("Under ","U").replace("1 Divisione","1ª Div.")
        if group.lower()!="unico":
            short += " · Gir. " + group
        self.comps[cid] = dict(id=cid,name=name,group=group,short=short,
            gender="M" if "maschil" in name.lower() else "F",source=source,
            sourceUrl=url,coverage="complete",standings=[])
    def team(self,cid,name,sid=None,source="ce"):
        if not clean(name):
            return None
        name=clean(name)
        is_virtus=(sid==SOCIETA_ID) if source=="ce" else "VIRTUS CASERTA" in name.upper()
        tid=f"{source}-{sid if sid is not None else 'x'}-{slug(name)}__{cid}"
        self.teams[tid]=dict(id=tid,name=name,sourceTeamId=tid.split("__")[0],
            competitionIds=[cid],isVirtus=is_virtus,
            logo=("logos/virtus_caserta_original.png" if is_virtus else
              f"{BASE_CE}/mngArea/Societa/img/{sid}/Loghi/LogoS{sid}.png" if sid else None))
        return tid
    def ce_team(self,cid,cell):
        if cell is None: return None
        sid=None
        image=cell.select_one("img[src]")
        if image:
            match=re.search(r"/img/(\d+)/Loghi/", image.get("src",""), re.I)
            if match: sid=int(match.group(1))
        return self.team(cid, cell.get_text(" ",strip=True),sid,"ce")
    def cr_team(self,cid,name):
        return self.team(cid,name,None,"cr")
    def venue(self, name, city="", province="", address="", lat=None, lon=None):
        if not name and not city:
            return None
        name=clean(name) or "Impianto sportivo"
        city=clean(city)
        ident="pal-"+slug(name+" "+city)
        addr=", ".join(filter(None,[clean(address),city,clean(province)]))
        self.venues[ident] = dict(id=ident,name=name,city=city,address=addr,lat=lat,lon=lon,
            maps="https://www.google.com/maps/search/?api=1&query="+quote_plus(" ".join(filter(None,[name,addr]))))
        return ident
    def ce_venue(self, cell):
        if not cell:
            return None
        image=cell.find("img",src=re.compile(r"info_16",re.I))
        if not image or not image.get("title"):
            return None
        h=BeautifulSoup(html_lib.unescape(image["title"]),"html.parser")
        p=h.find("p")
        if not p:return None
        label=p.find("b")
        name=clean(label.get_text(" ",strip=True)) if label else ""
        parts=[clean(t) for t in p.find_all(string=True) if t.parent.name!="b" and clean(t)]
        city=province=street=""
        if parts:
            mm=re.match(r"(.*?)\s+([A-Z]{2})$",parts[0])
            city,province=(mm[1],mm[2]) if mm else (parts[0],"")
        if len(parts)>1:street=parts[1]
        return self.venue(name,city,province,street)

def parse_ce_round(c,cid,comp_name,group):
    doc=soup(ce_results_url(cid))
    tables=doc.select("table.tbl-risultati")
    if not tables:
        raise ValueError(f"Caserta {cid}: nessuna tabella risultati")
    the_comp=f"ce-{cid}"
    c.comp(the_comp,comp_name,group,"FIPAV Caserta",ce_standings_url(cid))
    parsed=0
    for table in tables:
        body=table.find("tbody") or table
        for row in body.find_all("tr",recursive=False):
            cols=row.find_all("td",recursive=False)
            if len(cols)<8:continue
            result=cols[5]
            mid=re.sub(r"\D","",result.get("id",""))
            if not mid: continue
            home=c.ce_team(the_comp,cols[3]);away=c.ce_team(the_comp,cols[4])
            if not home or not away:continue
            sm=re.search(r"(\d+)\s*-\s*(\d+)",clean(result.get_text(" ",strip=True)))
            score=[int(sm[1]),int(sm[2])] if sm else None
            partials=[]
            for sp in cols[6].select("span.parziali"):
                mm=re.search(r"(\d+)\s*-\s*(\d+)",clean(sp.get_text(" ",strip=True)))
                if mm:partials.append([int(mm[1]),int(mm[2])])
            state_image=cols[7].select_one("span[id^=StatoGara] img")
            state_code=state_image.get("src","").split("/")[-1].split(".")[0].lower() if state_image else ""
            state_text=clean(BeautifulSoup(state_image.get("title",""),"html.parser").get_text(" ",strip=True)) if state_image else ""
            is_final=state_code.startswith("stato5")
            c.matches[f"ce-{mid}"]=dict(id=f"ce-{mid}",competitionId=the_comp,round=num(cols[1].get_text()),
                datetime=date_it(cols[2].get_text(" ",strip=True)),homeId=home,awayId=away,
                venueId=c.ce_venue(cols[7]),status="played" if score is not None else "scheduled",
                statusLabel=state_text or ("omologata" if is_final else "da disputare"),
                score=score,sets=partials,sourceUrl=ce_results_url(cid))
            parsed+=1
    # Classifica: intestazioni per nome; portale con o senza Penal.
    stand=soup(ce_standings_url(cid)).select_one("table.tbl-classifica")
    if stand is None:
        raise ValueError(f"Caserta {cid}: nessuna tabella classifica")
    head=stand.select("thead th") or (stand.find("tr").find_all("th") if stand.find("tr") else [])
    labels={"POS":"position","SQUADRA":"teamId","PUNTI":"points","PG":"played","PV":"wins","PP":"losses","SF":"sf","SS":"sa","PF":"pf","PS":"pa","PENAL":"penalty"}
    col={}
    for i,th in enumerate(head):
        key=clean(th.get_text(" ",strip=True)).upper().strip(".")
        if key in labels:col[labels[key]]=i
    required={"position","teamId","points","played","wins","losses"}
    if not required.issubset(col):
        raise ValueError(f"Caserta {cid}: intestazioni classifica non compatibili {list(col)}")
    rankings=[]
    for row in stand.find_all("tr"):
        td=row.find_all("td",recursive=False)
        if len(td)<=max(col.values()):continue
        tid=c.ce_team(the_comp,td[col["teamId"]])
        if not tid:continue
        values={name:(num(td[idx].get_text(" ",strip=True)) or 0) for name,idx in col.items() if name!="teamId"}
        values["teamId"]=tid
        rankings.append(values)
    if not rankings:
        raise ValueError(f"Caserta {cid}: classifica senza squadre")
    c.comps[the_comp]["standings"]=rankings
    if parsed==0:
        raise ValueError(f"Caserta {cid}: calendario vuoto")
    c.matches_per_comp[the_comp]=parsed
    print(f"CE {cid}: {parsed} gare, {len(rankings)} squadre in classifica",flush=True)

def cr_match_name(div):
    if div is None:return ""
    return clean("".join(div.find_all(string=True, recursive=False)))

def parse_cr_venue(section,c):
    elem=section.select_one("div.divImpianto")
    if elem is None:return None
    strings=[clean(x) for x in elem.find_all(string=True) if clean(x)]
    if not strings:return None
    first=elem.find_all(string=True)[0] if elem.find_all(string=True) else ""
    if "\xa0" in str(first):name,city=first.rsplit("\xa0",1)
    else:name,city=str(first),""
    province=""
    mm=re.search(r"(.*?)\s+([A-Z]{2})$",clean(city))
    if mm:city,province=mm[1],mm[2]
    lat=lon=None
    link=elem.find_parent("a")
    if link:
        mm=re.search(r"[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)",link.get("href",""))
        if mm:lat,lon=float(mm[1]),float(mm[2])
    address=strings[1] if len(strings)>1 else ""
    return c.venue(name,city,province,address,lat,lon)

def parse_cr_detail(c,cid,mid):
    doc=soup(cr_details_url(cid,mid))
    section=doc.select_one("#contenitorePagina") or doc
    words=clean(section.get_text(" ",strip=True))
    result={"datetime":date_it(words),"venueId":parse_cr_venue(section,c),"sets":[]}
    home=[num(x.get_text(" ",strip=True)) for x in section.select("#risultatoCasa .parziale")]
    away=[num(x.get_text(" ",strip=True)) for x in section.select("#risultatoOspite .parziale")]
    result["sets"]=[[a,b] for a,b in zip(home,away) if a is not None and b is not None]
    return result

def parse_cr_round(c,cid,previous):
    comp_id=f"cr-{cid}"
    doc=soup(cr_results_url(cid))
    title=doc.select_one("#divCampionato")
    if title is None:raise ValueError(f"Campania {cid}: titolo non trovato")
    c.comp(comp_id,"Serie D Femminile","C","FIPAV Campania",cr_results_url(cid))
    section=doc.select_one("#contenitorePagina") or doc
    round_no=0;game_ids=[]
    for element in section.find_all(["div","a"]):
        if element.name=="div" and "divGiornata" in (element.get("class") or []):
            mm=re.search(r"\d+",element.get_text(" ",strip=True))
            round_no=int(mm[0]) if mm else round_no
            continue
        if element.name!="a" or "gara" not in (element.get("class") or []):continue
        mm=re.search(r"GaraId=(\d+)",element.get("href",""))
        if not mm:continue
        game=mm[1]
        home=c.cr_team(comp_id,cr_match_name(element.select_one(".squadraCasa")))
        away=c.cr_team(comp_id,cr_match_name(element.select_one(".squadraOspite")))
        if not home or not away:continue
        sh=element.select_one(".setCasa");sa=element.select_one(".setOspite")
        n1=num(sh.get_text(" ",strip=True)) if sh else None
        n2=num(sa.get_text(" ",strip=True)) if sa else None
        score=[n1,n2] if n1 is not None and n2 is not None else None
        gid=f"cr-{game}";old=previous.get(gid,{})
        # Usa esclusivamente dati precedenti provenienti dal nostro scraper diretto.
        details=None
        reuse = old.get("sourceVerified")=="fipav-direct" and old.get("datetime") and old.get("homeId")==home and old.get("awayId")==away
        if reuse:
            details={"datetime":old.get("datetime"),"venueId":old.get("venueId"),"sets":old.get("sets") or []}
            if details["venueId"] in previous_venues:
                c.venues[details["venueId"]]=previous_venues[details["venueId"]]
        if not reuse:
            try:details=parse_cr_detail(c,cid,game)
            except Exception as exc:
                print(f"CR {cid} gara {game}: dettaglio non raggiungibile: {exc}",flush=True)
        c.matches[gid]=dict(id=gid,competitionId=comp_id,round=round_no,
            datetime=details["datetime"] if details else None,
            homeId=home,awayId=away,venueId=details.get("venueId") if details else None,
            status="played" if score else "scheduled",
            statusLabel="disputata" if score else "da disputare",
            score=score,sets=details.get("sets",[]) if details else [],
            sourceUrl=cr_details_url(cid,game),sourceVerified="fipav-direct" if details else "fipav-list")
        game_ids.append(gid)
    if len(game_ids)<100:raise ValueError(f"Campania {cid}: meno di 100 gare: {len(game_ids)}")
    rank_doc=soup(cr_standings_url(cid))
    rows=rank_doc.select("table.tabellaClassifica tr")
    if not rows:raise ValueError("Campania: tabella classifica assente")
    mappings={"claPosizione":"position","claPunti":"points","claGareGiocate":"played",
      "claGareVinte":"wins","claGarePerse":"losses","claSetFatti":"sf","claSetSubiti":"sa",
      "claPuntiFatti":"pf","claPuntiSubiti":"pa","claPenalita":"penalty"}
    ranks=[]
    for row in rows:
        nm=row.select_one("td.claSquadra")
        if nm is None:continue
        tid=c.cr_team(comp_id,nm.get_text(" ",strip=True))
        record={"teamId":tid}
        for cls,key in mappings.items():
            cell=row.select_one("td."+cls)
            record[key]=num(cell.get_text(" ",strip=True)) if cell else 0
        ranks.append(record)
    if len(ranks)<5:raise ValueError(f"Campania: classifica incongruente: {len(ranks)}")
    c.comps[comp_id]["standings"]=ranks
    c.matches_per_comp[comp_id]=len(game_ids)
    print(f"CR {cid}: {len(game_ids)} gare, {len(ranks)} squadre, {sum(bool(c.matches[g]['datetime']) for g in game_ids)} date",flush=True)

previous_venues={}

def run(output,prior_path):
    old={}
    global previous_venues
    if prior_path and Path(prior_path).is_file():
        try:
            old=json.loads(Path(prior_path).read_text(encoding="utf8"))
            if old.get("provenance",{}).get("method")!="direct-fipav":
                old={}  # non ereditare dati precedentemente presi da feed terzi
        except (ValueError,OSError):old={}
    prior_matches={m["id"]:m for m in old.get("matches",[])}
    previous_venues={v["id"]:v for v in old.get("venues",[])}
    c=Collection()
    for cid,(name,group) in GIRONI_CE.items():
        parse_ce_round(c,cid,name,group)
    for cid in GIRONI_CR:
        parse_cr_round(c,cid,prior_matches)
    # Validazione prima di rendere disponibile il file.
    if len(c.comps)!=9 or len(c.matches)<180:raise ValueError("Campionati o gare mancanti")
    for cid,meta in c.comps.items():
        if not meta["standings"] or c.matches_per_comp.get(cid,0)==0:
            raise ValueError(f"{cid}: calendario o classifica non validi")
    if not any(t["isVirtus"] for t in c.teams.values()):
        raise ValueError("Identificativo società Virtus assente")
    updated=datetime.now(TZ).replace(microsecond=0).isoformat()
    data=dict(version=2,mode="official",season=STAGIONE,updatedAt=updated,
        club=dict(name="VIRTUS CASERTA",shortName="Virtus Caserta",
            city="Caserta",logo="logos/virtus_caserta_original.png"),
        competitions=list(c.comps.values()),teams=list(c.teams.values()),
        venues=list(c.venues.values()),matches=sorted(c.matches.values(),key=lambda m:(m.get("datetime") or "9999",m["id"])),
        provenance=dict(source=DATA_SOURCE,method="direct-fipav",
            sources=[BASE_CE,BASE_CR],retrievedAt=updated,
            note="Dati scaricati direttamente dai portali ufficiali FIPAV; non sono un live score."))
    output=Path(output);output.parent.mkdir(parents=True,exist_ok=True)
    tmp=output.with_suffix(".tmp")
    tmp.write_text(json.dumps(data,ensure_ascii=False,separators=(",",":")),encoding="utf8")
    tmp.replace(output)
    print("OK: FIPAV DIRETTO",len(data["competitions"]),"gironi,",len(data["teams"]),"squadre,",len(data["matches"]),"gare,",REQUESTS_MADE,"richieste",flush=True)

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--output",default="public/data.json")
    parser.add_argument("--previous",default="data.json")
    args=parser.parse_args()
    try:
        run(args.output,args.previous)
    except Exception as exc:
        print("ERRORE IMPORTAZIONE FIPAV DIRETTA:",type(exc).__name__,str(exc),file=sys.stderr,flush=True)
        sys.exit(1)
