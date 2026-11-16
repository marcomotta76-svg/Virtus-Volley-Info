#!/usr/bin/env python3
"""Test diagnostico di sola lettura su pagine ufficiali FIPAV."""
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlencode
import sys, time
u=[
 ("caserta_gare","https://caserta.portalefipav.net/risultati-classifiche.aspx?"+urlencode({"ComitatoId":19,"StId":2399,"DataDa":"","StatoGara":"","CId":94228,"SId":"","PId":7261,"btFiltro":"CERCA"})),
 ("caserta_cla","https://caserta.portalefipav.net/classifica.aspx?CId=94228"),
 ("campania_gare","https://www.fipavcampania.it/mobile/risultati.asp?CampionatoId=92747"),
 ("campania_cla","https://www.fipavcampania.it/mobile/risultati.asp?CampionatoId=92747&vis=classifica")]
ss=requests.Session();ss.headers.update({"User-Agent":"Mozilla/5.0 (compatible; VirtusVolleyInfo/1.0; +https://github.com/marcomotta76-svg/Virtus-Volley-Info)","Accept-Language":"it-IT,it;q=0.9"})
fail=0
for k,url in u:
 try:
  r=ss.get(url,timeout=28)
  soup=BeautifulSoup(r.content,"html.parser")
  sel={"giri":len(soup.select("table.tbl-risultati")),"gare":len(soup.select("a.gara")),"classifica_ce":len(soup.select("table.tbl-classifica tr")),"classifica_cr":len(soup.select("table.tabellaClassifica tr"))}
  print(k,"HTTP",r.status_code,"bytes",len(r.content),"url",r.url,"title",soup.title.get_text(" ",strip=True)[:110] if soup.title else "-","selectors",sel,"snippet",soup.get_text(" ",strip=True)[:230],flush=True)
  if r.status_code!=200 or len(r.content)<1000 or not any(sel.values()):fail+=1
 except Exception as exc:
  print(k,"ERROR",type(exc).__name__,str(exc)[:240],flush=True);fail+=1
 time.sleep(1.1)
print("PROBE_ERRORS",fail,flush=True)
sys.exit(0 if fail==0 else 1)
